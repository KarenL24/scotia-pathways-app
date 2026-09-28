import { NextRequest, NextResponse } from "next/server";

// Default voice: "Rachel", one of ElevenLabs' standard premade voices.
// Swap via ELEVENLABS_VOICE_ID in .env.local, or pick another from
// https://elevenlabs.io/app/voice-library
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing 'text' string in request body." }, { status: 400 });
  }
  // ElevenLabs bills per character — keep a sane cap so a bug can't run up a bill.
  if (text.length > 2000) {
    return NextResponse.json({ error: "Text too long (max 2000 characters)." }, { status: 400 });
  }

  let elevenRes: Response;
  try {
    elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach ElevenLabs." }, { status: 502 });
  }

  if (!elevenRes.ok || !elevenRes.body) {
    const detail = await elevenRes.text().catch(() => "");
    return NextResponse.json(
      { error: `ElevenLabs request failed (${elevenRes.status})`, detail },
      { status: elevenRes.status || 502 }
    );
  }

  return new NextResponse(elevenRes.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
