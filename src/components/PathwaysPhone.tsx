"use client";

import { useMemo, useState } from "react";
import { GOALS, SERIES, COHORTS, BINS, TREND, TREND_YOU, money, compact, ord, grow } from "@/lib/data";
import { C } from "@/lib/palette";
import type { ActiveGoal } from "@/lib/types";
import type { GoalPlan } from "@/lib/goalPlan";

const INCOME = 4850;

function planToGoal(plan: GoalPlan): ActiveGoal {
  return {
    id: "custom",
    label: plan.goalLabel,
    target: plan.targetAmount,
    saved: 0,
    kind: "save",
    targetEtaMonths: plan.etaMonths,
    nba: {
      title: plan.nextBestAction.title,
      cta: plan.nextBestAction.cta,
      done: plan.nextBestAction.cta + " done",
      confirm: plan.nextBestAction.confirm,
      reason: plan.nextBestAction.reason
    },
    suggestions: plan.waysToGetThere.map((w, i) => ({
      id: "ai-" + i,
      title: w.title,
      meta: w.meta,
      cta: w.cta,
      pros: w.pros,
      cons: w.cons
    })),
    media: plan.media,
    sources: plan.sources
  };
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{ background: C.bg, border: "1px solid #e4e4e7", boxShadow: "0 1px 2px rgba(38,38,43,.05)", borderRadius: 20, padding: "12px 14px" }}
    >
      {children}
    </section>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", opacity: 0.55, fontWeight: 600 }}>{children}</div>;
}

function Disclosure({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        width: "100%",
        marginTop: 9,
        padding: "5px 0 0",
        border: 0,
        borderTop: `1px solid ${C.divider}`,
        background: "transparent",
        cursor: "pointer",
        color: C.text
      }}
    >
      <span style={{ flex: 1, textAlign: "left", fontSize: 10, opacity: 0.6 }}>{label}</span>
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.45, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
      >
        <path d="M6 9l6 6 6-6"></path>
      </svg>
    </button>
  );
}

export default function PathwaysPhone() {
  // ── core goal selection ──────────────────────────
  const [goalId, setGoalId] = useState<"home" | "debt">("home");
  const [customGoalText, setCustomGoalText] = useState("");
  const [customPlan, setCustomPlan] = useState<GoalPlan | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // ── money meter ──────────────────────────────────
  const [focus, setFocus] = useState<string | null>(null);
  const [contribState, setContribState] = useState<number | null>(null);

  // ── accordions ───────────────────────────────────
  const [openMeter, setOpenMeter] = useState(false);
  const [openGoal, setOpenGoal] = useState(false);
  const [openPeers, setOpenPeers] = useState(false);
  const [openNba, setOpenNba] = useState(false);
  const [openProj, setOpenProj] = useState(false);

  // ── peer comparison ──────────────────────────────
  const [cohortBasis, setCohortBasis] = useState<"age" | "income" | "net">("age");

  // ── next best action ─────────────────────────────
  const [nbaState, setNbaState] = useState<"idle" | "done" | "skipped">("idle");

  // ── ways to get there / projection ───────────────
  const [line, setLine] = useState<string | null>(null);
  const [openSuggestion, setOpenSuggestion] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<number | "custom">(5);
  const [customYears, setCustomYears] = useState(7);
  const [chartVar, setChartVar] = useState<"lines" | "bands" | "panels">("lines");

  async function generatePlan() {
    if (!customGoalText.trim()) return;
    setCustomLoading(true);
    setCustomError(null);
    try {
      const res = await fetch("/api/goal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: customGoalText, monthlyIncome: INCOME })
      });
      const data = (await res.json()) as GoalPlan & { error?: string };
      if (!res.ok) throw new Error(data?.error || "Failed to generate plan.");
      setCustomPlan(data);
      // Keep the money-meter slider consistent with the plan's own pacing math
      // (target / eta) rather than the income-based default, which has no
      // relationship to an arbitrary typed goal's size.
      const flexBudget = INCOME - Math.round(INCOME * 0.449);
      const clamped = Math.min(Math.max(data.nextBestAction.suggestedMonthly, 300), flexBudget - 300);
      setContribState(clamped);
      setNbaState("idle");
      setLine(null);
      setOpenSuggestion(null);
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCustomLoading(false);
    }
  }

  function pickPreset(id: "home" | "debt") {
    setGoalId(id);
    setCustomPlan(null);
    setCustomGoalText("");
    setCustomError(null);
    setContribState(null);
    setNbaState("idle");
    setLine(null);
    setOpenSuggestion(null);
  }

  const goal: ActiveGoal = useMemo(() => {
    if (customPlan) return planToGoal(customPlan);
    return GOALS.find((g) => g.id === goalId) || GOALS[0];
  }, [customPlan, goalId]);

  // ── derived numbers (income allocation) ──────────
  const fixed = Math.round(INCOME * 0.449);
  const flex = INCOME - fixed;
  const suggested = Math.min(Math.round((INCOME * 0.25) / 5) * 5, flex - 300);
  const contrib = Math.min(Math.max(contribState ?? suggested, 300), flex - 300);
  const spend = flex - contrib;

  const L = Math.PI * 104,
    gap = 5;
  const seg = (v: number) => Math.max((L * v) / INCOME - gap, 2);
  const a = seg(fixed),
    b = seg(spend),
    c = seg(contrib);
  const dash = (l: number) => l + " " + L * 2;
  const op = (k: string) => (focus && focus !== k ? 0.2 : 1);
  const th = Math.PI * (1 - (fixed + spend) / INCOME);
  const nx = 130 + 104 * Math.cos(th),
    ny = 126 - 104 * Math.sin(th);
  const pct = (v: number) => Math.round((v / INCOME) * 100) + "%";
  const slices = [
    { key: "fixed", short: "Fixed", amount: money(fixed), pct: pct(fixed), color: C.neutral500 },
    { key: "spend", short: "Spend", amount: money(spend), pct: pct(spend), color: C.accent2_500 },
    { key: "invest", short: "Invest", amount: money(contrib), pct: pct(contrib), color: C.accent }
  ];
  const focusMap: Record<string, [string, string, string]> = {
    fixed: ["Fixed", money(fixed), "rent, phone, insurance"],
    spend: ["To spend", money(spend), "day to day"],
    invest: ["To invest", money(contrib), "toward the goal"]
  };
  const meter = (focus && focusMap[focus]) || ["This month", money(INCOME), "after tax"];

  // ── goal pacing ───────────────────────────────────
  const remaining = Math.max(goal.target - goal.saved, 0);
  const monthsToGoal = Math.max(Math.ceil(remaining / Math.max(contrib, 1)), 1);
  const eta = new Date(2026, 7 + monthsToGoal, 1);
  const etaLabel = eta.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
  const targetDate = new Date(2026, 7 + goal.targetEtaMonths, 1).toLocaleDateString("en-CA", { month: "short", year: "numeric" });
  const deltaMonths = goal.targetEtaMonths - monthsToGoal;
  const goalPct = Math.min((goal.saved / goal.target) * 100, 100).toFixed(1) + "%";

  // ── peer comparison ───────────────────────────────
  const co = COHORTS[cohortBasis] || COHORTS.age;
  const fhsaYou = nbaState === "done" ? "Yes" : "No";

  // ── projection chart ──────────────────────────────
  const years = horizon === "custom" ? customYears : horizon;
  const N = 44;
  const raw = SERIES.map((s) => {
    const vals: number[] = [];
    for (let i = 0; i <= N; i++) vals.push(grow(goal.saved, contrib, s.rate, (years * i) / N));
    return { ...s, vals, endVal: vals[N] };
  });
  const lens = "Balanced";
  const pick = raw.find((s) => s.lens === lens) || raw[1];
  const bandOn = chartVar === "bands";
  const focused = raw.find((s) => s.id === line) || pick;
  const bandHi: number[] = [],
    bandLo: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (years * i) / N;
    bandHi.push(grow(goal.saved, contrib, focused.rate * 1.45, t));
    bandLo.push(grow(goal.saved, contrib, focused.rate * 0.5, t));
  }
  const rawMax = Math.max(...raw.map((s) => s.endVal), goal.target * 1.02, bandOn ? bandHi[N] : 0);
  const step = Math.pow(10, Math.floor(Math.log10(rawMax / 4)));
  const gridStep = Math.ceil(rawMax / 4 / step) * step;
  const max = gridStep * 4;
  const X = (i: number) => 6 + (318 * i) / N;
  const Y = (v: number) => 172 - (v / max) * 164;
  const bandPath =
    "M" +
    bandHi.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" L") +
    " L" +
    bandLo
      .slice()
      .reverse()
      .map((v, i) => X(N - i).toFixed(1) + "," + Y(v).toFixed(1))
      .join(" L") +
    " Z";
  const grid = [1, 2, 3, 4].map((k) => ({ y: Y(gridStep * k), label: compact(gridStep * k) }));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f, i) => ({
    x: 6 + 318 * f,
    anchor: i === 0 ? "start" : i === 4 ? "end" : "middle",
    label: f === 0 ? "now" : Math.round(years * f * 10) / 10 + "y"
  }));
  const targetY = Y(goal.target);
  const targetOn = goal.target <= max;

  const isCustomActive = !!customPlan;
  const goalSuggested = isCustomActive && customPlan ? Math.min(Math.max(customPlan.nextBestAction.suggestedMonthly, 300), flex - 300) : suggested;

  // Presets carry a literal "$510" placeholder in their copy that the original
  // design substitutes live with 42% of whatever the invest slider is set to;
  // custom AI-generated goals already state a self-consistent dollar figure,
  // so the replace is a no-op there (no "$510" substring to find).
  const nbaAmount = Math.round((contrib * 0.42) / 5) * 5;
  const nbaTitle = goal.nba.title.replace("$510", money(nbaAmount));
  const nbaConfirm = goal.nba.confirm.replace("$510", money(nbaAmount));

  return (
    <div style={{ width: "100%", maxWidth: 402, borderRadius: 40, background: C.neutral200, boxShadow: "0 12px 32px rgba(38,38,43,.18)", overflow: "hidden", fontFamily: "system-ui, sans-serif", color: C.text }}>
      <div style={{ padding: "28px 14px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 25, color: "#000" }}>Pathways</h1>
        </div>

        {/* ── money meter ─────────────────────────── */}
        <Card>
          <div style={{ position: "relative", margin: "0 auto", width: "100%", maxWidth: 224 }}>
            <svg viewBox="0 0 260 150" style={{ width: "100%", display: "block" }}>
              <path d="M26 126 A104 104 0 0 1 234 126" fill="none" stroke={C.neutral200} strokeWidth={21} strokeLinecap="round" />
              <path d="M26 126 A104 104 0 0 1 234 126" fill="none" stroke={C.neutral500} strokeWidth={21} strokeLinecap="round" strokeDasharray={dash(a)} strokeDashoffset={0} opacity={op("fixed")} />
              <path d="M26 126 A104 104 0 0 1 234 126" fill="none" stroke={C.accent2_500} strokeWidth={21} strokeLinecap="round" strokeDasharray={dash(b)} strokeDashoffset={-(a + gap)} opacity={op("spend")} />
              <path d="M26 126 A104 104 0 0 1 234 126" fill="none" stroke={C.accent} strokeWidth={21} strokeLinecap="round" strokeDasharray={dash(c)} strokeDashoffset={-(a + b + gap * 2)} opacity={op("invest")} />
              <line x1={130 + (nx - 130) * 0.885} y1={126 + (ny - 126) * 0.885} x2={130 + (nx - 130) * 1.115} y2={126 + (ny - 126) * 1.115} stroke={C.bg} strokeWidth={3} strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.55 }}>{meter[0]}</div>
              <div style={{ fontWeight: 700, fontSize: 26, lineHeight: 1.02 }}>{meter[1]}</div>
              <div style={{ fontSize: 9, opacity: 0.5 }}>{meter[2]}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, marginTop: -4 }}>
            {slices.map((s) => (
              <button
                key={s.key}
                onClick={() => setFocus(focus === s.key ? null : s.key)}
                style={{ flex: 1, minWidth: 0, padding: "6px 4px", border: `1px solid ${focus === s.key ? C.accent300 : "transparent"}`, background: focus === s.key ? C.tile : "transparent", borderRadius: 14, cursor: "pointer", color: C.text, textAlign: "center" }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                  <span style={{ fontSize: 8.5, letterSpacing: ".05em", textTransform: "uppercase", opacity: 0.6 }}>{s.short}</span>
                </span>
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 700, marginTop: 1 }}>{s.amount}</span>
                <span style={{ display: "block", fontSize: 8.5, opacity: 0.5 }}>{s.pct}</span>
              </button>
            ))}
          </div>

          <Disclosure label={"Adjust the split — " + money(contrib) + "/mo invested"} open={openMeter} onToggle={() => setOpenMeter((v) => !v)} />
          {openMeter && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                <span style={{ fontSize: 10.5, opacity: 0.7 }}>Invest vs. spend</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.accent700 }}>
                  {money(contrib)}
                  <span style={{ fontSize: 9, opacity: 0.6 }}>/mo</span>
                </span>
              </div>
              <input
                type="range"
                min={300}
                max={flex - 300}
                step={5}
                value={contrib}
                onChange={(e) => setContribState(+e.target.value)}
                style={{ width: "100%", height: 18, cursor: "pointer", accentColor: C.accent }}
              />
              <div style={{ fontSize: 9.5, opacity: 0.55 }}>
                {money(spend)} left to spend · {Math.round((contrib / INCOME) * 100)}% of take-home invested
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setContribState(goalSuggested)}
                  style={{ background: C.accent, color: "#fff", border: 0, borderRadius: 999, fontSize: 11.5, padding: "5px 12px", whiteSpace: "nowrap", cursor: "pointer" }}
                >
                  Use suggested split
                </button>
                <span style={{ fontSize: 9.5, opacity: 0.55 }}>
                  {contrib === goalSuggested
                    ? "You are on the suggested split for " + goal.label.toLowerCase() + "."
                    : "Pathways suggests " + money(goalSuggested) + "/mo for " + goal.label.toLowerCase() + "."}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* ── goal ─────────────────────────────────── */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <Kicker>Your goal</Kicker>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.15, marginTop: 1 }}>{goal.label}</div>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, flex: "none", color: deltaMonths >= 0 ? C.accent2_700 : C.accent700 }}>
              {deltaMonths === 0 ? "On target" : deltaMonths > 0 ? deltaMonths + " mo early" : Math.abs(deltaMonths) + " mo late"}
            </span>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ height: 8, borderRadius: 999, background: C.neutral200, overflow: "hidden", display: "flex" }}>
              <div style={{ width: goalPct, background: C.accent, borderRadius: 999 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginTop: 4 }}>
              <span>
                <strong>{money(goal.saved)}</strong> <span style={{ opacity: 0.55 }}>{goal.kind === "debt" ? "repaid" : "saved"}</span>
              </span>
              <span style={{ opacity: 0.55 }}>
                of {money(goal.target)} · {etaLabel}
              </span>
            </div>
          </div>

          <Disclosure label="Change goal & see pacing" open={openGoal} onToggle={() => setOpenGoal((v) => !v)} />
          {openGoal && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ flex: 1, background: C.tile, borderRadius: 14, padding: "7px 10px" }}>
                  <div style={{ fontSize: 8.5, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.5 }}>On this pace</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{etaLabel}</div>
                </div>
                <div style={{ flex: 1, background: C.tile, borderRadius: 14, padding: "7px 10px" }}>
                  <div style={{ fontSize: 8.5, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.5 }}>Target date</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{targetDate}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 7 }}>
                {GOALS.map((g) => {
                  const on = !isCustomActive && g.id === goalId;
                  return (
                    <button
                      key={g.id}
                      onClick={() => pickPreset(g.id as "home" | "debt")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "8px 11px",
                        border: `1px solid ${on ? C.accent300 : C.divider}`,
                        background: on ? C.tile : "transparent",
                        borderRadius: 16,
                        cursor: "pointer",
                        textAlign: "left",
                        color: C.text
                      }}
                    >
                      <span style={{ width: 13, height: 13, flex: "none", borderRadius: "50%", border: `1.5px solid ${on ? C.accent : C.divider}`, background: on ? C.accent : "transparent", boxShadow: on ? `inset 0 0 0 3px ${C.bg}` : "none" }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.2 }}>{g.label}</span>
                      <span style={{ fontSize: 10, opacity: 0.55, flex: "none" }}>{money(g.target)}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.divider}` }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    value={customGoalText}
                    onChange={(e) => setCustomGoalText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && generatePlan()}
                    placeholder="Or type your own goal…"
                    style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "8px 11px", border: `1px solid ${C.divider}`, borderRadius: 12, background: C.tile, fontSize: 12, color: C.text }}
                  />
                  <button
                    onClick={generatePlan}
                    disabled={customLoading || !customGoalText.trim()}
                    style={{ borderRadius: 12, background: C.accent, color: "#fff", border: 0, fontSize: 12, fontWeight: 600, padding: "0 14px", cursor: "pointer", opacity: customLoading || !customGoalText.trim() ? 0.4 : 1 }}
                  >
                    {customLoading ? "…" : "Go"}
                  </button>
                </div>
                {customError && <div style={{ fontSize: 10, color: C.accent700, marginTop: 5 }}>{customError}</div>}
                {isCustomActive && (
                  <div style={{ fontSize: 9.5, opacity: 0.55, marginTop: 5 }}>
                    Showing an AI-generated plan for &ldquo;{goal.label}&rdquo;. Story, next best action, and ways to get there below are all generated for this goal.
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* ── peer comparison ──────────────────────── */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Kicker>How you compare</Kicker>
            <span style={{ fontSize: 9.5, opacity: 0.55 }}>{co.size}</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.15, marginTop: 1 }}>
            {ord(co.pct)} percentile · {cohortBasis === "income" ? Math.round((contrib / INCOME) * 100) + "% of take-home invested" : co.you}
          </div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>{co.label}</div>

          <div style={{ display: "flex", gap: 4, marginTop: 9 }}>
            {(["age", "income", "net"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setCohortBasis(v)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  border: `1px solid ${cohortBasis === v ? C.accent : C.divider}`,
                  background: cohortBasis === v ? C.accent : "transparent",
                  color: cohortBasis === v ? C.tile : C.text,
                  borderRadius: 999,
                  cursor: "pointer",
                  fontSize: 10.5,
                  fontWeight: 600
                }}
              >
                {v === "age" ? "By age" : v === "income" ? "By income" : "By net worth"}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 11 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
              {BINS.map((h, i) => (
                <div
                  key={i}
                  style={{ flex: 1, height: Math.round((h / 86) * 44) + "px", borderRadius: "3px 3px 0 0", background: i === Math.min(Math.floor((co.pct / 100) * 12), 11) ? C.accent : C.neutral300 }}
                />
              ))}
            </div>
            <div style={{ position: "relative", height: 1, background: C.divider, marginTop: 3 }}>
              <div style={{ position: "absolute", left: co.pct + "%", top: -3, transform: "translateX(-50%)", width: 2, height: 7, borderRadius: 2, background: C.accent }} />
            </div>
            <div style={{ position: "relative", height: 13, marginTop: 2 }}>
              <span style={{ position: "absolute", left: 0, fontSize: 9, opacity: 0.45 }}>lower</span>
              <span style={{ position: "absolute", left: co.pct + "%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: C.accent700, whiteSpace: "nowrap" }}>you</span>
              <span style={{ position: "absolute", right: 0, fontSize: 9, opacity: 0.45 }}>higher</span>
            </div>
          </div>

          <Disclosure label="What your cohort is doing" open={openPeers} onToggle={() => setOpenPeers((v) => !v)} />
          {openPeers && (
            <div style={{ marginTop: 9 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  { name: "Invested each month", you: money(contrib), co: "$640", youW: "100%", coW: Math.round((640 / contrib) * 100) + "%", gap: Math.round((contrib / 640) * 10) / 10 + "× the median" },
                  { name: "Share of take-home saved", you: Math.round((contrib / INCOME) * 100) + "%", co: "14%", youW: Math.min(Math.round((contrib / INCOME) * 100) * 2.8, 100) + "%", coW: "39%", gap: "+" + Math.max(Math.round((contrib / INCOME) * 100) - 14, 0) + " pts" },
                  { name: "Have opened an FHSA", you: fhsaYou, co: "31%", youW: fhsaYou === "Yes" ? "100%" : "4%", coW: "31%", gap: fhsaYou === "Yes" ? "ahead of 69%" : "not yet" }
                ].map((r) => (
                  <div key={r.name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                      <span>{r.name}</span>
                      <span style={{ opacity: 0.55 }}>{r.gap}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ width: 26, flex: "none", fontSize: 9, opacity: 0.5 }}>you</span>
                      <span style={{ flex: 1, height: 7, borderRadius: 999, background: C.neutral200, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: r.youW, background: C.accent, borderRadius: 999 }} />
                      </span>
                      <span style={{ width: 52, flex: "none", textAlign: "right", fontSize: 10, fontWeight: 700 }}>{r.you}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ width: 26, flex: "none", fontSize: 9, opacity: 0.5 }}>peers</span>
                      <span style={{ flex: 1, height: 7, borderRadius: 999, background: C.neutral200, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: r.coW, background: C.accent2_500, borderRadius: 999 }} />
                      </span>
                      <span style={{ width: 52, flex: "none", textAlign: "right", fontSize: 10, opacity: 0.6 }}>{r.co}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: C.tile, borderRadius: 16, padding: "9px 11px", marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600 }}>Where the cohort is heading</span>
                  <span style={{ fontSize: 10, color: C.accent2_700, fontWeight: 700 }}>+18% YoY</span>
                </div>
                <svg viewBox="0 0 240 40" style={{ width: "100%", height: 34, display: "block", marginTop: 4, overflow: "visible" }}>
                  <polyline
                    points={TREND.map((v, i) => ((240 * i) / (TREND.length - 1)).toFixed(1) + "," + (38 - (v / 100) * 34).toFixed(1)).join(" ")}
                    fill="none"
                    stroke={C.accent2_600}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={TREND_YOU.map((v, i) => ((240 * i) / (TREND_YOU.length - 1)).toFixed(1) + "," + (38 - (v / 100) * 34).toFixed(1)).join(" ")}
                    fill="none"
                    stroke={C.accent}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="4 3"
                  />
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, opacity: 0.45 }}>
                  <span>Sep 2025</span>
                  <span>Aug 2026</span>
                </div>
                <p style={{ fontSize: 10.5, opacity: 0.72, margin: "6px 0 0" }}>
                  Your cohort has been moving money out of chequing and into registered accounts all year — median monthly contributions are up 18%. You are running ahead of that curve (dashed line).
                </p>
              </div>
              <div style={{ fontSize: 9, opacity: 0.45, marginTop: 7 }}>
                Cohort figures are anonymised aggregates of Scotiabank customers matching your age band, region and income. Nobody&apos;s individual data is shown.
              </div>
            </div>
          )}
        </Card>

        {/* ── next best action ──────────────────────── */}
        <section style={{ borderRadius: 26, padding: "13px 15px", background: C.accent800, color: C.accent100, boxShadow: "0 12px 32px rgba(38,38,43,.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: C.accent300 }}>Next best action</span>
          </div>
          {nbaState === "idle" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.18, marginTop: 4 }}>{nbaTitle}</div>
              <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                <button
                  onClick={() => setNbaState("done")}
                  style={{ flex: 1, background: C.accent300, color: C.accent900, border: 0, borderRadius: 999, fontSize: 13, padding: "7px 12px", whiteSpace: "nowrap", fontWeight: 600, cursor: "pointer" }}
                >
                  {goal.nba.cta}
                </button>
                <button
                  onClick={() => setNbaState("skipped")}
                  style={{ flex: "none", border: `1px solid ${C.accent600}`, color: C.accent200, background: "transparent", borderRadius: 999, fontSize: 13, padding: "7px 14px", whiteSpace: "nowrap", cursor: "pointer" }}
                >
                  Not now
                </button>
              </div>
              <button
                onClick={() => setOpenNba((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", marginTop: 9, padding: "5px 0 0", border: 0, borderTop: `1px solid ${C.accent700}`, background: "transparent", cursor: "pointer", color: C.accent200 }}
              >
                <span style={{ flex: 1, textAlign: "left", fontSize: 10 }}>Why this, and what happens</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" style={{ transform: openNba ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {openNba && (
                <div style={{ marginTop: 6 }}>
                  <p style={{ fontSize: 11, margin: 0, color: C.accent200 }}>{goal.nba.reason}</p>
                  <div style={{ fontSize: 10, color: C.accent300, opacity: 0.85, marginTop: 5 }}>One tap — the account opens and the transfer is scheduled. Nothing else to sign.</div>
                </div>
              )}
            </div>
          )}
          {nbaState === "done" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6 }}>
                <span style={{ width: 29, height: 29, flex: "none", borderRadius: "50%", background: C.accent2_400, color: C.accent2_900, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.15 }}>{goal.nba.done}</div>
                  <div style={{ fontSize: 10.5, color: C.accent200 }}>{nbaConfirm}</div>
                </div>
              </div>
              <button onClick={() => setNbaState("idle")} style={{ marginTop: 9, border: `1px solid ${C.accent600}`, color: C.accent200, background: "transparent", borderRadius: 999, fontSize: 11.5, padding: "4px 12px", cursor: "pointer" }}>
                Undo
              </button>
            </div>
          )}
          {nbaState === "skipped" && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 5 }}>Parked for now</div>
              <p style={{ fontSize: 11, margin: "3px 0 0", color: C.accent200 }}>We&apos;ll raise it again after your next pay deposit.</p>
              <button onClick={() => setNbaState("idle")} style={{ marginTop: 8, border: `1px solid ${C.accent600}`, color: C.accent200, background: "transparent", borderRadius: 999, fontSize: 11.5, padding: "4px 12px", cursor: "pointer" }}>
                Bring it back
              </button>
            </div>
          )}
        </section>

        {/* ── ways to get there + projection ────────── */}
        <Card>
          <Kicker>Ways to get there</Kicker>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.15, marginTop: 1 }}>
            {compact(pick.endVal)} on the {lens.toLowerCase()} path
          </div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>
            {money(contrib)}/mo from {money(goal.saved)} today · {years}-year view
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
            {goal.suggestions.map((v) => {
              const isOpen = openSuggestion === v.id;
              const isLine = line === v.series;
              return (
                <div key={v.id} style={{ background: isLine ? C.accent100 : C.tile, border: `1px solid ${isLine ? C.accent300 : "transparent"}`, borderRadius: 18, overflow: "hidden" }}>
                  <button
                    onClick={() => {
                      setOpenSuggestion(isOpen ? null : v.id);
                      if (v.series) setLine(line === v.series ? null : v.series);
                    }}
                    style={{ display: "flex", gap: 9, padding: 9, border: 0, background: "transparent", cursor: "pointer", textAlign: "left", color: C.text, alignItems: "center", width: "100%" }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 13, lineHeight: 1.18 }}>{v.title}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                        <span style={{ fontSize: 9.5, opacity: 0.55 }}>{v.meta}</span>
                      </span>
                    </span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.4, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "0 10px 10px" }}>
                      <div style={{ height: 1, background: C.divider, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 9 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8.5, letterSpacing: ".09em", textTransform: "uppercase", color: C.accent2_700, marginBottom: 4 }}>Pros</div>
                          {v.pros.map((p, j) => (
                            <div key={j} style={{ fontSize: 10.5, lineHeight: 1.35, opacity: 0.85, marginBottom: 3 }}>{p}</div>
                          ))}
                        </div>
                        <div style={{ width: 1, background: C.divider, flex: "none" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8.5, letterSpacing: ".09em", textTransform: "uppercase", color: C.accent700, marginBottom: 4 }}>Cons</div>
                          {v.cons.map((cn, j) => (
                            <div key={j} style={{ fontSize: 10.5, lineHeight: 1.35, opacity: 0.85, marginBottom: 3 }}>{cn}</div>
                          ))}
                        </div>
                      </div>
                      <button style={{ width: "100%", marginTop: 9, fontSize: 12, padding: "6px 12px", background: C.accent, color: "#fff", border: 0, borderRadius: 999, cursor: "pointer", fontWeight: 600 }}>{v.cta}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {goal.media.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.5 }}>
                Real Scotiabank videos &amp; podcasts
              </div>
              {goal.media.map((m, i) => (
                <a
                  key={i}
                  href={m.url || "#"}
                  target={m.url ? "_blank" : undefined}
                  rel={m.url ? "noopener noreferrer" : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${C.divider}`, borderRadius: 14, textDecoration: "none", color: C.text, opacity: m.url ? 1 : 0.5 }}
                >
                  <span style={{ width: 26, height: 26, flex: "none", borderRadius: 8, background: C.tile, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                    {m.type === "podcast" ? "🎙️" : "▶"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, lineHeight: 1.2 }}>{m.title}</span>
                    <span style={{ display: "block", fontSize: 9.5, opacity: 0.55 }}>
                      {m.source}
                      {m.duration ? " · " + m.duration : ""}
                    </span>
                  </span>
                  <span style={{ opacity: 0.4 }}>→</span>
                </a>
              ))}
            </div>
          )}

          {isCustomActive && goal.sources.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.divider}` }}>
              <div style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.5, marginBottom: 4 }}>Grounded in</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {goal.sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9.5, color: C.accent700, textDecoration: "none" }}>
                    {s.title}
                  </a>
                ))}
              </div>
              <div style={{ fontSize: 8.5, opacity: 0.45, marginTop: 4 }}>
                AI-generated from live web search — verify account details on scotiabank.com before acting.
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 13, paddingTop: 11, borderTop: `1px solid ${C.divider}` }}>
            <span style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.5 }}>Where that lands</span>
            <span style={{ flex: 1, height: 1, background: C.divider }} />
          </div>

          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {[1, 5, 10, "custom" as const].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                style={{
                  flex: 1,
                  padding: "5px 0",
                  border: `1px solid ${horizon === h ? C.accent : C.divider}`,
                  background: horizon === h ? C.accent : "transparent",
                  color: horizon === h ? C.tile : C.text,
                  borderRadius: 999,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700
                }}
              >
                {h === "custom" ? "Custom" : h + "yr"}
              </button>
            ))}
          </div>

          {horizon === "custom" && (
            <div style={{ marginTop: 7, background: C.tile, borderRadius: 14, padding: "7px 11px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                <span style={{ opacity: 0.65 }}>Forecast horizon</span>
                <span style={{ fontWeight: 700, color: C.accent700 }}>
                  {customYears} {customYears === 1 ? "year" : "years"}
                </span>
              </div>
              <input type="range" min={1} max={30} step={1} value={customYears} onChange={(e) => setCustomYears(+e.target.value)} style={{ width: "100%", height: 18, cursor: "pointer", accentColor: C.accent }} />
            </div>
          )}

          {chartVar !== "panels" && (
            <div style={{ marginTop: 8 }}>
              <svg viewBox="0 0 330 206" style={{ width: "100%", display: "block", overflow: "visible" }}>
                {grid.map((g, i) => (
                  <g key={i}>
                    <line x1={6} x2={324} y1={g.y} y2={g.y} stroke={C.divider} strokeWidth={1} />
                    <text x={324} y={g.y - 3} textAnchor="end" fontSize={8.5} fill={C.text} opacity={0.45}>{g.label}</text>
                  </g>
                ))}
                <path d={bandPath} fill={C.accent300} opacity={bandOn ? 0.5 : 0} />
                {targetOn && (
                  <>
                    <line x1={6} x2={324} y1={targetY} y2={targetY} stroke={C.accent700} strokeWidth={1.5} strokeDasharray="5 4" />
                    <text x={8} y={targetY - 4} fontSize={8.5} fill={C.accent700}>goal {money(goal.target)}</text>
                  </>
                )}
                {raw.map((s) => {
                  const points = s.vals.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");
                  const isFocused = line === s.id;
                  return (
                    <polyline
                      key={s.id}
                      points={points}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={isFocused ? 3.4 : !line && s.lens === lens ? 3.2 : 2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={line ? (isFocused ? 1 : 0.18) : s.lens === lens ? 1 : 0.6}
                    />
                  );
                })}
                {xTicks.map((t, i) => (
                  <text key={i} x={t.x} y={204} textAnchor={t.anchor as "start" | "middle" | "end"} fontSize={8.5} fill={C.text} opacity={0.45}>{t.label}</text>
                ))}
              </svg>
            </div>
          )}

          {chartVar === "panels" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
              {raw.map((s) => {
                const mini = s.vals.filter((_, i) => i % 4 === 0);
                const isLineSel = line === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setLine(line === s.id ? null : s.id)}
                    style={{ textAlign: "left", border: `1px solid ${isLineSel ? C.accent300 : "transparent"}`, background: isLineSel ? C.tile : C.neutral100, borderRadius: 16, padding: "9px 10px", cursor: "pointer", color: C.text }}
                  >
                    <span style={{ display: "block", fontSize: 10, lineHeight: 1.2, fontWeight: 600, minHeight: 24 }}>{s.name}</span>
                    <svg viewBox="0 0 120 34" style={{ width: "100%", height: 28, display: "block", marginTop: 3, overflow: "visible" }}>
                      <polyline
                        points={mini.map((v, i, arr) => ((120 * i) / (arr.length - 1)).toFixed(1) + "," + (32 - (v / max) * 30).toFixed(1)).join(" ")}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{compact(s.endVal)}</span>
                      <span style={{ fontSize: 8.5, opacity: 0.55 }}>{(s.rate * 100).toFixed(1)}% / yr</span>
                    </span>
                    <span style={{ display: "block", height: 4, borderRadius: 999, background: C.neutral200, overflow: "hidden", marginTop: 5 }}>
                      <span style={{ display: "block", height: "100%", width: Math.min((s.endVal / goal.target) * 100, 100).toFixed(0) + "%", background: s.color, borderRadius: 999 }} />
                    </span>
                    <span style={{ display: "block", fontSize: 8.5, opacity: 0.6, marginTop: 2 }}>
                      {s.endVal >= goal.target ? "clears the goal" : Math.round((s.endVal / goal.target) * 100) + "% of goal"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <Disclosure label="All four investment vehicles & chart style" open={openProj} onToggle={() => setOpenProj((v) => !v)} />
          {openProj && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 5px 4px 9px", border: `1px dashed ${C.neutral400}`, borderRadius: 999 }}>
                <span style={{ fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.5, flex: "none" }}>Variant</span>
                <div style={{ display: "flex", gap: 3, flex: 1 }}>
                  {(["lines", "bands", "panels"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartVar(v)}
                      style={{ flex: 1, padding: "4px 0", border: 0, background: chartVar === v ? C.accent : "transparent", color: chartVar === v ? C.tile : C.text, borderRadius: 999, cursor: "pointer", fontSize: 10, fontWeight: 600 }}
                    >
                      {v[0].toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 7 }}>
                {raw.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setLine(line === s.id ? null : s.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px", border: `1px solid ${line === s.id ? C.accent300 : "transparent"}`, background: line === s.id ? C.tile : "transparent", borderRadius: 999, cursor: "pointer", textAlign: "left", color: C.text }}
                  >
                    <span style={{ width: 14, height: 3, flex: "none", borderRadius: 999, background: s.color }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 11, lineHeight: 1.15, fontWeight: 600 }}>{s.name}</span>
                      <span style={{ display: "block", fontSize: 9, opacity: 0.55 }}>{s.note}</span>
                    </span>
                    <span style={{ textAlign: "right", flex: "none" }}>
                      <span style={{ display: "block", fontWeight: 700, fontSize: 12.5 }}>{compact(s.endVal)}</span>
                      <span style={{ display: "block", fontSize: 8.5, opacity: 0.55 }}>{(s.rate * 100).toFixed(1)}% / yr</span>
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 9.5, opacity: 0.55, marginTop: 6 }}>
                {bandOn ? "Shaded range is the plausible spread on " + focused.name.toLowerCase() + "." : "Tap a way, or a line below, to bring it forward."}
              </div>
              <p style={{ fontSize: 9, lineHeight: 1.4, opacity: 0.5, margin: "6px 0 0" }}>
                Projections are illustrative, assume monthly compounding at the rates shown, and are not a forecast of actual returns.
              </p>
            </div>
          )}
        </Card>

        <div style={{ height: 4 }} />
      </div>

      <button
        aria-label="DJ"
        title="DJ"
        style={{ position: "fixed", left: 16, bottom: 20, width: 52, height: 52, border: 0, borderRadius: "50%", background: C.accent, boxShadow: "0 12px 32px rgba(38,38,43,.18)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 20 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="13.2" r="8" fill="#fff" />
          <path d="M12 5.2v-2M12 3.2c1.1-1.4 2.5-1.8 3.6-1.6-.2 1.2-1.1 2.3-2.3 2.7-.4-.4-.8-.8-1.3-1.1z" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
    </div>
  );
}
