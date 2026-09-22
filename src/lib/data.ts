import type { ActiveGoal, SeriesId } from "./types";

export const GOALS: ActiveGoal[] = [
  {
    id: "home",
    label: "Down payment — first home",
    target: 60000,
    saved: 18400,
    kind: "save",
    targetEtaMonths: 38,
    nba: {
      title: "Move $510 a month into a new FHSA",
      cta: "Open FHSA",
      done: "FHSA opened",
      confirm: "$510 from chequing, every 1st, from September.",
      reason:
        "It is the only shelter that deducts on the way in and pays out tax-free for a first home. At this pace it pulls your date forward by a few months."
    },
    suggestions: [
      {
        id: "fhsa",
        series: "fhsa",
        title: "Getting into the housing market",
        meta: "Ep. 212 · 26 min",
        cta: "Open an FHSA",
        pros: ["Contributions cut your taxable income", "Growth and withdrawals are tax-free for a first home"],
        cons: ["Capped at $8,000 a year", "Must be used within fifteen years"]
      },
      {
        id: "auto",
        series: "balanced",
        title: "Where rates go from here",
        meta: "Ep. 88 · 14 min",
        cta: "Schedule the transfer",
        pros: ["Money moves the day after payday", "Nothing left to decide each month"],
        cons: ["Needs a two-week cash buffer", "Overdraft risk if a pay date shifts"]
      },
      {
        id: "cash",
        series: "hisa",
        title: "Cash or invested: timing a purchase",
        meta: "Ep. 205 · 22 min",
        cta: "Compare cash options",
        pros: ["Down payment stays liquid", "No sequence risk near the purchase date"],
        cons: ["Real return near zero after inflation", "Interest is fully taxable"]
      }
    ],
    media: [],
    sources: []
  },
  {
    id: "debt",
    label: "Pay off the student loan",
    target: 23000,
    saved: 9800,
    kind: "debt",
    targetEtaMonths: 23,
    nba: {
      title: "Redirect $510 a month to the provincial balance",
      cta: "Redirect payment",
      done: "Payment redirected",
      confirm: "$510 to the accruing portion, every 1st, from September.",
      reason:
        "The federal half costs you nothing; the provincial half is the only balance still accruing. Paying it first clears the loan sooner."
    },
    suggestions: [
      {
        id: "avalanche",
        series: "hisa",
        title: "Paying down debt without stalling",
        meta: "Ep. 198 · 24 min",
        cta: "Split the payment",
        pros: ["Only the provincial balance accrues", "Interest saved is a guaranteed return"],
        cons: ["No tax shelter on the way", "Nothing invested while you repay"]
      },
      {
        id: "split",
        series: "balanced",
        title: "Repay or invest in a flat-rate market",
        meta: "Ep. 91 · 16 min",
        cta: "Model a 60/40 split",
        pros: ["Keeps compounding while the balance falls", "Easier to keep up with"],
        cons: ["Neither goal finishes first", "Harder to see progress month to month"]
      },
      {
        id: "freeze",
        series: "growth",
        title: "When the interest freeze lapses",
        meta: "Ep. 219 · 19 min",
        cta: "Set a 2027 reminder",
        pros: ["Nothing to change today", "Avoids a jump you did not budget for"],
        cons: ["Assumes policy holds", "Needs a review every spring"]
      }
    ],
    media: [],
    sources: []
  }
];

export const SERIES: { id: SeriesId; name: string; rate: number; color: string; note: string; lens: string }[] = [
  { id: "growth", name: "Growth equity", rate: 0.079, color: "#ec111a", note: "Widest swing, best 10-year odds", lens: "Growth" },
  { id: "balanced", name: "Balanced ETF portfolio", rate: 0.058, color: "#5f6e7e", note: "60/40, rebalanced quarterly", lens: "Balanced" },
  { id: "fhsa", name: "FHSA + GIC ladder", rate: 0.041, color: "#81818a", note: "Tax-sheltered, locked in steps", lens: "Conservative" },
  { id: "hisa", name: "High-interest savings", rate: 0.029, color: "#fb7d7d", note: "Fully liquid, no market risk", lens: "Conservative" }
];

export const COHORTS: Record<string, { label: string; size: string; pct: number; you: string }> = {
  age: { label: "Age 26–30 · Ontario", size: "41,200 customers", pct: 62, you: "$27,400 net worth" },
  income: { label: "Income $55–65k · Ontario", size: "28,700 customers", pct: 71, you: "25% of take-home invested" },
  net: { label: "Net worth $20–40k · all ages", size: "63,400 customers", pct: 48, you: "$27,400 net worth" }
};
export const BINS = [7, 13, 22, 36, 54, 71, 86, 78, 61, 42, 27, 15];
export const TREND = [38, 40, 39, 43, 46, 45, 49, 52, 55, 57, 60, 64];
export const TREND_YOU = [44, 46, 48, 52, 58, 61, 66, 70, 76, 82, 88, 95];

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
export const compact = (n: number) =>
  n >= 1000 ? "$" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : "$" + Math.round(n);
export const ord = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
export const grow = (p: number, c: number, rate: number, years: number) => {
  const m = rate / 12,
    n = years * 12;
  return p * Math.pow(1 + m, n) + c * ((Math.pow(1 + m, n) - 1) / m);
};
