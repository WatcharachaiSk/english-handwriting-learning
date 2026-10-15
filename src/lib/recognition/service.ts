/**
 * Recognition services.
 *
 * LocalRecognitionService is the default on-device adapter: it segments the
 * raw strokes into glyphs, rasterizes them into normalized ink grids and
 * decodes them against letter templates + a dictionary with a DP decoder.
 * No text input is involved anywhere — this really reads the pen strokes.
 *
 * RemoteRecognitionService shows the pluggable path: POST strokes to
 * /api/recognize, where a TensorFlow.js / server-side model can be mounted.
 * Until a model is configured there it transparently falls back to the local
 * matcher and says so in the UI.
 */

import lexiconData from "@/data/lexicon.json";
import type {
  RecognitionInput,
  RecognitionResult,
  RecognitionService,
  Stroke,
} from "@/lib/types";
import { inkRatio, rasterizeGlyph } from "./geometry";
import { calibrate, letterSimilarities, rankWords } from "./scoring";
import { segmentStrokes } from "./segmenter";
import { getTemplateStore, type TemplateStore } from "./templates";

const LEXICON: string[] = lexiconData.words;
const MIN_POINTS = 6;
const MIN_INK = 0.012;

export interface Analysis {
  status: RecognitionResult["status"];
  message?: string;
  glyphSims: number[][];
  predictions: RecognitionResult["predictions"];
  confidence: number;
}

/** Core pipeline shared by the local service and the spelling checker. */
export function analyzeStrokes(
  strokes: Stroke[],
  vocabulary: string[],
  store: TemplateStore,
): Analysis {
  const pen = strokes.filter((s) => s.tool === "pen" && s.points.length > 1);
  const pointCount = pen.reduce((n, s) => n + s.points.length, 0);
  if (pointCount < MIN_POINTS) {
    return {
      status: "low_signal",
      message: "Not enough ink yet — start writing to get predictions.",
      glyphSims: [],
      predictions: [],
      confidence: 0,
    };
  }

  const glyphs = segmentStrokes(pen);
  if (glyphs.length === 0) {
    return {
      status: "low_signal",
      message: "No letter shapes detected yet — write a little bigger.",
      glyphSims: [],
      predictions: [],
      confidence: 0,
    };
  }

  const features = glyphs.map((g) => rasterizeGlyph(g.strokes, g.box));
  const ink = features.reduce((n, f) => n + inkRatio(f.grid), 0) / features.length;
  if (ink < MIN_INK) {
    return {
      status: "low_signal",
      message: "We can barely see any writing — try pressing more firmly.",
      glyphSims: [],
      predictions: [],
      confidence: 0,
    };
  }

  const glyphSims = features.map((f) => letterSimilarities(f, store));
  const prior = new Set(vocabulary.map((w) => w.toUpperCase()));
  const ranked = rankWords(glyphSims, LEXICON, prior);

  const predictions = ranked.slice(0, 3).map((r) => ({
    word: r.word,
    confidence: r.confidence,
    // Per glyph: the top-3 letter hypotheses that fed this word's score.
    letters: glyphSims.map((sims) =>
      sims
        .map((score, i) => ({ letter: String.fromCharCode(65 + i), score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    ),
  }));

  return {
    status: "ok",
    glyphSims,
    predictions,
    confidence: predictions.length ? calibrate(ranked[0].score) : 0,
  };
}

export class LocalRecognitionService implements RecognitionService {
  readonly name = "On-device template recognizer";
  readonly kind = "local" as const;

  constructor(private store: TemplateStore = getTemplateStore()) {}

  async recognize(input: RecognitionInput): Promise<RecognitionResult> {
    try {
      const analysis = analyzeStrokes(input.strokes, input.vocabulary ?? [], this.store);
      return {
        predictions: analysis.predictions,
        confidence: analysis.confidence,
        status: analysis.status,
        message: analysis.message,
        glyphSims: analysis.glyphSims,
        backend: `${this.name} · ${this.store.source}`,
      };
    } catch (err) {
      return {
        predictions: [],
        confidence: 0,
        status: "error",
        message: err instanceof Error ? err.message : "Recognition failed",
        backend: this.name,
      };
    }
  }
}

export class RemoteRecognitionService implements RecognitionService {
  readonly name = "Backend model (/api/recognize)";
  readonly kind = "remote" as const;

  constructor(private fallback: RecognitionService) {}

  async recognize(input: RecognitionInput): Promise<RecognitionResult> {
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strokes: input.strokes.map((s) => ({
            tool: s.tool,
            color: s.color,
            size: s.size,
            points: s.points.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, p.p, p.t]),
          })),
          vocabulary: input.vocabulary,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RecognitionResult;
      if (!data || data.status === "error") throw new Error(data?.message ?? "bad response");
      return { ...data, backend: data.backend ?? this.name };
    } catch {
      const local = await this.fallback.recognize(input);
      return {
        ...local,
        backend: `${this.name} unavailable → ${local.backend ?? "on-device"}`,
        message: local.message ?? "Backend model not configured yet — used the on-device matcher.",
      };
    }
  }
}

let localSingleton: LocalRecognitionService | null = null;
let remoteSingleton: RemoteRecognitionService | null = null;

export function getRecognitionService(backend: "local" | "remote"): RecognitionService {
  if (backend === "remote") {
    if (!remoteSingleton) {
      if (!localSingleton) localSingleton = new LocalRecognitionService();
      remoteSingleton = new RemoteRecognitionService(localSingleton);
    }
    return remoteSingleton;
  }
  if (!localSingleton) localSingleton = new LocalRecognitionService();
  return localSingleton;
}
