import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GOALS, SERIES, COHORTS, money, ord, grow } from "./data";

// MCP tools over the same mock data the dashboard uses. There's no backend
// or per-user storage in this app, so every tool is read-only and takes the
// "what if" inputs (income, goal, contribution) as arguments instead of
// reading a saved profile.

const goalId = z.enum(["home", "debt"]).default("home").describe("Which goal: 'home' (down payment) or 'debt' (student loan)");
const monthlyIncome = z.number().min(1000).max(100000).optional().describe("Monthly take-home income in CAD. Defaults to 4850.");
const monthlyContribution = z
  .number()
  .min(0)
  .optional()
  .describe("Monthly amount put toward the goal in CAD. Defaults to the suggested split (~25% of take-home). Clamped to what the budget allows.");

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }]
});

const monthLabel = (monthsFromNow: number) =>
  new Date(2026, 7 + monthsFromNow, 1).toLocaleDateString("en-CA", { month: "short", year: "numeric" });

// Same income-allocation and pacing formulas as PathwaysPhone.tsx — keep the
// two in sync if either changes.
function budgetFor(id: "home" | "debt", incomeArg?: number, contribArg?: number) {
  const income = incomeArg ?? 4850;
  const fixed = Math.round(income * 0.449);
  const flex = income - fixed;
  const suggested = Math.min(Math.round((income * 0.25) / 5) * 5, flex - 300);
  const contrib = Math.min(Math.max(contribArg ?? suggested, 300), flex - 300);
  const spend = flex - contrib;

  const goal = GOALS.find((g) => g.id === id) || GOALS[0];
  const remaining = Math.max(goal.target - goal.saved, 0);
  const monthsToGoal = Math.max(Math.ceil(remaining / Math.max(contrib, 1)), 1);
  const deltaMonths = goal.targetEtaMonths - monthsToGoal;

  return { income, fixed, spend, suggested, contrib, goal, monthsToGoal, deltaMonths };
}

export function createPathwaysMcpServer() {
  const server = new McpServer({ name: "scotia-pathways", version: "0.1.0" });

  server.registerTool(
    "list_goals",
    {
      title: "List goals",
      description: "List the built-in savings/debt goals in Pathways, with target, amount saved so far, and target date.",
      annotations: { readOnlyHint: true }
    },
    async () =>
      json(
        GOALS.map((g) => ({
          id: g.id,
          label: g.label,
          kind: g.kind,
          target: g.target,
          saved: g.saved,
          targetDate: monthLabel(g.targetEtaMonths)
        }))
      )
  );

  server.registerTool(
    "get_dashboard_summary",
    {
      title: "Dashboard summary",
      description:
        "Summarize the Pathways dashboard for a goal: monthly budget split, goal progress and projected finish date, and the suggested next action. Same numbers the app shows.",
      inputSchema: { goalId, monthlyIncome, monthlyContribution },
      annotations: { readOnlyHint: true }
    },
    async ({ goalId, monthlyIncome, monthlyContribution }) => {
      const b = budgetFor(goalId, monthlyIncome, monthlyContribution);
      const nbaAmount = money(Math.round((b.contrib * 0.42) / 5) * 5);
      return json({
        budget: { income: b.income, fixed: b.fixed, spend: b.spend, invest: b.contrib, suggestedInvest: b.suggested },
        goal: {
          label: b.goal.label,
          saved: b.goal.saved,
          target: b.goal.target,
          progress: Math.min((b.goal.saved / b.goal.target) * 100, 100).toFixed(1) + "%",
          targetDate: monthLabel(b.goal.targetEtaMonths),
          projectedDate: monthLabel(b.monthsToGoal),
          versusTarget:
            b.deltaMonths === 0 ? "On target" : b.deltaMonths > 0 ? b.deltaMonths + " mo early" : Math.abs(b.deltaMonths) + " mo late"
        },
        nextBestAction: { title: b.goal.nba.title.replace("$510", nbaAmount), reason: b.goal.nba.reason }
      });
    }
  );

  server.registerTool(
    "project_savings",
    {
      title: "Project savings",
      description:
        "Project how a goal's balance grows over a number of years under each investment path (growth equity, balanced ETF, FHSA + GIC ladder, high-interest savings), and whether each path clears the goal's target.",
      inputSchema: {
        goalId,
        monthlyIncome,
        monthlyContribution,
        years: z.number().min(1).max(40).default(5).describe("Projection horizon in years")
      },
      annotations: { readOnlyHint: true }
    },
    async ({ goalId, monthlyIncome, monthlyContribution, years }) => {
      const b = budgetFor(goalId, monthlyIncome, monthlyContribution);
      return json({
        goal: b.goal.label,
        startingBalance: b.goal.saved,
        target: b.goal.target,
        monthlyContribution: b.contrib,
        years,
        paths: SERIES.map((s) => {
          const endValue = Math.round(grow(b.goal.saved, b.contrib, s.rate, years));
          return {
            id: s.id,
            name: s.name,
            riskLens: s.lens,
            annualRate: s.rate,
            note: s.note,
            endValue,
            clearsGoal: endValue >= b.goal.target
          };
        }),
        disclaimer: "Illustrative projections at fixed assumed rates — not financial advice."
      });
    }
  );

  server.registerTool(
    "get_peer_comparison",
    {
      title: "Peer comparison",
      description: "Compare the user to a peer cohort (by age, income, or net worth): percentile, cohort size, and how monthly investing stacks up against the cohort median.",
      inputSchema: {
        basis: z.enum(["age", "income", "net"]).default("age").describe("Which cohort to compare against"),
        monthlyIncome,
        monthlyContribution
      },
      annotations: { readOnlyHint: true }
    },
    async ({ basis, monthlyIncome, monthlyContribution }) => {
      const b = budgetFor("home", monthlyIncome, monthlyContribution);
      const co = COHORTS[basis];
      const savedShare = Math.round((b.contrib / b.income) * 100);
      return json({
        cohort: co.label,
        cohortSize: co.size,
        percentile: co.pct,
        headline: ord(co.pct) + " percentile · " + (basis === "income" ? savedShare + "% of take-home invested" : co.you),
        rows: [
          { metric: "Invested each month", you: money(b.contrib), cohort: "$640", gap: Math.round((b.contrib / 640) * 10) / 10 + "× the median" },
          { metric: "Share of take-home saved", you: savedShare + "%", cohort: "14%", gap: "+" + Math.max(savedShare - 14, 0) + " pts" }
        ]
      });
    }
  );

  server.registerTool(
    "get_recommendations",
    {
      title: "Ways to get there",
      description: "Get the recommended strategies for a built-in goal, each with pros and cons and the related podcast episode.",
      inputSchema: { goalId },
      annotations: { readOnlyHint: true }
    },
    async ({ goalId }) =>
      json(
        (GOALS.find((g) => g.id === goalId) || GOALS[0]).suggestions.map((s) => ({
          id: s.id,
          action: s.cta,
          investmentPath: SERIES.find((x) => x.id === s.series)?.name,
          episode: s.title + " (" + s.meta + ")",
          pros: s.pros,
          cons: s.cons
        }))
      )
  );

  return server;
}
