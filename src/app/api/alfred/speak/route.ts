import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* Alfred's voice — ElevenLabs "Julian" Text-to-Speech. Returns mp3 audio that
   the client plays. The API key stays server-side. Requires a signed-in user
   so the key can't be used to burn credits anonymously. On any failure the
   client falls back to the browser voice, so Alfred is never silent. */

const VOICE_ID = "7p1Ofvcwsv7UBPoFNcpI"; // Julian

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Voice isn't configured." }, { status: 503 });
  }

  // Only for signed-in users (protects the key from anonymous abuse).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "No text." }, { status: 400 });

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          // Low-latency model for responsive conversation.
          model_id: "eleven_turbo_v2_5",
          // Dignified but conversational delivery.
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("ElevenLabs TTS failed:", res.status, detail.slice(0, 300));
      return NextResponse.json({ error: "Voice unavailable." }, { status: 502 });
    }

    // Stream the mp3 straight through to the client.
    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("ElevenLabs TTS error:", e);
    return NextResponse.json({ error: "Voice unavailable." }, { status: 502 });
  }
}
