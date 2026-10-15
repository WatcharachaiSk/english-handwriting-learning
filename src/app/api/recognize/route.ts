/**
 * Handwriting recognition backend (Section 7: "can be swapped for a backend
 * API for processing").
 *
 * The route forwards raw strokes to an external model endpoint when
 * MODEL_URL is configured, e.g.
 *
 *   MODEL_URL=http://localhost:8000/predict npm run dev
 *
 * Expected contract (JSON):
 *   request : { strokes: [{ tool, color, size, points: [[x,y,p,t], ...] }], vocabulary: string[] }
 *   response: RecognitionResult  (see src/lib/types.ts)
 *
 * Until MODEL_URL is set it answers 501 and the client transparently falls
 * back to the on-device recognizer, so the UI never breaks.
 *
 * To run a TensorFlow.js / server model in-process instead, import it here and
 * replace the forward block with your inference call — the response shape is
 * the only contract the client relies on.
 */

import type { RecognitionResult } from "@/lib/types";

export const runtime = "nodejs";

interface SerializedStroke {
  tool?: string;
  color?: string;
  size?: number;
  points?: [number, number, number, number][];
}

function isPayload(value: unknown): value is { strokes: SerializedStroke[]; vocabulary?: string[] } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { strokes?: unknown };
  return Array.isArray(v.strokes);
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "error", message: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPayload(body)) {
    return Response.json({ status: "error", message: "Missing strokes[]" }, { status: 400 });
  }

  const modelUrl = process.env.MODEL_URL;

  if (!modelUrl) {
    const result: Partial<RecognitionResult> = {
      status: "error",
      message:
        "MODEL_URL is not configured — no handwriting model is mounted on the server yet. The client will use its on-device recognizer.",
      predictions: [],
      confidence: 0,
      backend: "/api/recognize (not configured)",
    };
    return Response.json(result, { status: 501 });
  }

  try {
    const upstream = await fetch(modelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!upstream.ok) {
      return Response.json(
        { status: "error", message: `Model endpoint replied ${upstream.status}`, predictions: [], confidence: 0 },
        { status: 502 },
      );
    }
    const data = (await upstream.json()) as RecognitionResult;
    return Response.json({
      ...data,
      backend: data.backend ?? `Server model (${modelUrl})`,
    });
  } catch (err) {
    return Response.json(
      {
        status: "error",
        message: err instanceof Error ? err.message : "Model request failed",
        predictions: [],
        confidence: 0,
      },
      { status: 502 },
    );
  }
}
