export type WaysOption = {
  title: string;
  meta: string;
  pros: string[];
  cons: string[];
  cta: string;
};

export type MediaItem = {
  title: string;
  type: "video" | "podcast";
  source: string;
  url: string;
  duration: string;
};

export type SourceCitation = {
  title: string;
  url: string;
};

export type GoalPlan = {
  goalLabel: string;
  targetAmount: number;
  etaMonths: number;
  nextBestAction: {
    title: string;
    cta: string;
    reason: string;
    confirm: string;
    suggestedMonthly: number;
  };
  waysToGetThere: WaysOption[];
  media: MediaItem[];
  sources: SourceCitation[];
};

export const GOAL_PLAN_SCHEMA = {
  name: "goal_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      goalLabel: { type: "string", description: "Short, cleaned-up title for the goal (e.g. 'Trip to Japan')." },
      targetAmount: { type: "number", description: "Realistic dollar amount (CAD) needed to hit this goal." },
      etaMonths: {
        type: "integer",
        description:
          "Number of months to reach targetAmount. MUST equal round(targetAmount / nextBestAction.suggestedMonthly) — these three numbers have to be mutually consistent."
      },
      nextBestAction: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description: "A single concrete next action naming the exact suggestedMonthly dollar figure, e.g. 'Move $400/mo into a travel fund'. The dollar amount stated here must equal suggestedMonthly."
          },
          cta: { type: "string", description: "Short button label, e.g. 'Open savings account'." },
          reason: { type: "string", description: "1-2 sentences on why this action, specifically, moves the goal forward." },
          confirm: { type: "string", description: "Short confirmation text shown after the action is taken, restating suggestedMonthly." },
          suggestedMonthly: {
            type: "number",
            description: "Realistic monthly CAD contribution. Must satisfy targetAmount / suggestedMonthly ≈ etaMonths, and must be affordable relative to the user's stated monthly income (leave room for fixed costs and spending)."
          }
        },
        required: ["title", "cta", "reason", "confirm", "suggestedMonthly"]
      },
      waysToGetThere: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "Name of a real Scotiabank product/path, e.g. 'Scotia Savings Accelerator Account'." },
            meta: { type: "string", description: "Short descriptor of the real product, grounded in what you found on scotiabank.com." },
            pros: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, description: "Real features/benefits of this actual Scotiabank product." },
            cons: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, description: "Real limitations/tradeoffs of this actual Scotiabank product." },
            cta: { type: "string", description: "Button label to adopt this path." }
          },
          required: ["title", "meta", "pros", "cons", "cta"]
        }
      },
      media: {
        type: "array",
        minItems: 0,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "Real title of a Scotiabank video or podcast episode found via web search." },
            type: { type: "string", enum: ["video", "podcast"] },
            source: { type: "string", description: "Where it's published, e.g. 'Scotiabank YouTube' or 'Scotiabank Perspectives podcast'." },
            url: { type: "string", description: "The real URL you found via search. Never invent this." },
            duration: { type: "string", description: "Runtime if known, e.g. '12 min'. Empty string if unknown." }
          },
          required: ["title", "type", "source", "url", "duration"]
        }
      },
      sources: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", description: "Title of the real page you used to ground this plan." },
            url: { type: "string", description: "Its real URL, ideally on scotiabank.com." }
          },
          required: ["title", "url"]
        }
      }
    },
    required: ["goalLabel", "targetAmount", "etaMonths", "nextBestAction", "waysToGetThere", "media", "sources"]
  }
} as const;
