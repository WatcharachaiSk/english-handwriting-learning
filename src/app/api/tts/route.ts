/**
 * Text-to-Speech backend seam (Section 4: Web Speech API first, external TTS
 * API later).
 *
 * Configure TTS_API_URL to point at any provider (or your own wrapper):
 *
 *   TTS_API_URL=https://api.example.com/tts npm run dev
 *
 * request : { text, lang: "en-US" | "en-GB", rate: 0.75 | 1 | 1.25 }
 * response: { audioUrl: string }
 *
 * Without it, the route answers 501 and the client keeps using the browser's
 * speechSynthesis — the UI does not change either way.
 */

export const runtime = "nodejs";

interface TTSRequest {
  text?: unknown;
  lang?: unknown;
  rate?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: TTSRequest;
  try {
    body = (await request.json()) as TTSRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "text is required" }, { status: 400 });

  const lang = body.lang === "en-GB" ? "en-GB" : "en-US";
  const rate = body.rate === 0.75 || body.rate === 1.25 ? body.rate : 1;

  const ttsUrl = process.env.TTS_API_URL;
  if (!ttsUrl) {
    return Response.json(
      {
        error: "not_configured",
        message: "TTS_API_URL is not set — the client should fall back to the Web Speech API.",
      },
      { status: 501 },
    );
  }

  try {
    const upstream = await fetch(ttsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang, rate }),
    });
    if (!upstream.ok) {
      return Response.json({ error: `TTS provider replied ${upstream.status}` }, { status: 502 });
    }
    const data = (await upstream.json()) as { audioUrl?: string };
    if (!data.audioUrl) {
      return Response.json({ error: "Provider returned no audioUrl" }, { status: 502 });
    }
    return Response.json({ audioUrl: data.audioUrl });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "TTS request failed" },
      { status: 502 },
    );
  }
}
