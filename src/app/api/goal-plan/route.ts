import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GOAL_PLAN_SCHEMA, type GoalPlan } from "@/lib/goalPlan";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set on the server. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  const monthlyIncome = typeof body?.monthlyIncome === "number" ? body.monthlyIncome : 4850;

  if (!goal) {
    return NextResponse.json({ error: "Missing 'goal' in request body." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1",
      tools: [{ type: "web_search_preview" }],
      input: [
        {
          role: "system",
          content:
            "You are the planning engine behind a Scotiabank personal-finance app called Pathways. " +
            "Given a free-text savings/financial goal typed by a user, and their approximate monthly income, " +
            "produce a realistic, encouraging, Canada-specific plan.\n\n" +
            "You MUST use the web_search tool to ground this plan in REAL Scotiabank content:\n" +
            "1. Search scotiabank.com for real, current Scotiabank account/product pages relevant to this goal " +
            "(e.g. FHSA, TFSA, RRSP, high-interest savings accounts, mortgages, lines of credit). Use their real " +
            "names and real features/limits for the 'waysToGetThere' pros/cons — do not invent product details.\n" +
            "2. Search for real Scotiabank videos (Scotiabank's official YouTube channel) and real Scotiabank " +
            "podcast episodes (e.g. Scotiabank's 'Perspectives' podcast, or other officially Scotiabank-branded " +
            "audio/video series) relevant to this goal. Only include a video/podcast in 'media' if you found a " +
            "real URL for it via search — never fabricate a title, episode number, duration, or URL.\n" +
            "3. List the real pages you used to ground this plan in 'sources' (at least one, ideally scotiabank.com).\n\n" +
            "If web search turns up nothing relevant for a given field, it is better to return an empty array " +
            "than to invent a fake Scotiabank resource. Keep all text concise (mobile app card copy, not " +
            "paragraphs). Amounts in CAD.\n\n" +
            "NUMBERS MUST BE INTERNALLY CONSISTENT. targetAmount, etaMonths, and nextBestAction.suggestedMonthly " +
            "are all shown together on the same screen, so they must agree with each other: " +
            "etaMonths = round(targetAmount / suggestedMonthly). The dollar figure you state in " +
            "nextBestAction.title and nextBestAction.confirm must be exactly suggestedMonthly, formatted the same " +
            "way (e.g. if suggestedMonthly is 400, say '$400/mo' everywhere, not '$400' in one place and '$450' " +
            "in another). suggestedMonthly must also be realistic against the stated monthly income — it should " +
            "leave room for typical fixed costs and spending, not consume the whole income."
        },
        {
          role: "user",
          content: `Goal: "${goal}"\nApprox. monthly income: $${monthlyIncome} CAD.`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: GOAL_PLAN_SCHEMA.name,
          strict: GOAL_PLAN_SCHEMA.strict,
          schema: GOAL_PLAN_SCHEMA.schema
        }
      }
    });

    const raw = response.output_text;
    if (!raw) {
      return NextResponse.json({ error: "No content returned from model." }, { status: 502 });
    }

    const plan = JSON.parse(raw) as GoalPlan;
    return NextResponse.json(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error calling OpenAI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
