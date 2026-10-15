"use client";

/**
 * Recognizer diagnostics (dev tool, not linked from the app).
 * Draw letters and inspect what the engine actually sees: segmentation,
 * per-glyph letter similarities and dictionary decoding.
 */

import { useCallback, useMemo, useState } from "react";
import HandwritingCanvas from "@/components/HandwritingCanvas";
import WritingToolbar from "@/components/WritingToolbar";
import { useStrokeHistory } from "@/hooks/useStrokeHistory";
import { rasterizeGlyph } from "@/lib/recognition/geometry";
import { alignToWord, letterSimilarities, rankWords } from "@/lib/recognition/scoring";
import { segmentStrokes } from "@/lib/recognition/segmenter";
import { getTemplateStore } from "@/lib/recognition/templates";
import { analyzeStrokes } from "@/lib/recognition/service";
import type { RecognitionResult, Stroke } from "@/lib/types";
import lexicon from "@/data/lexicon.json";

export default function DevPage() {
  const history = useStrokeHistory([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [size, setSize] = useState(5);
  const [color, setColor] = useState("#1F2933");
  const [showGuides, setShowGuides] = useState(true);
  const [result, setResult] = useState<RecognitionResult | null>(null);

  const store = useMemo(() => getTemplateStore(), []);

  const analyze = useCallback(
    (strokes: Stroke[]) => {
      const pen = strokes.filter((s) => s.tool === "pen");
      const glyphs = segmentStrokes(pen);
      const features = glyphs.map((g) => rasterizeGlyph(g.strokes, g.box));
      const sims = features.map((f) => letterSimilarities(f, store));
      const ranked = rankWords(sims, lexicon.words as string[], new Set());
      const res = analyzeStrokes(strokes, [], store);
      setResult({
        predictions: res.predictions,
        confidence: res.confidence,
        status: res.status,
        message: res.message,
        glyphSims: sims,
        backend: store.source,
      });
      setDebug(glyphs.map((g, i) => ({ box: g.box, feature: features[i], sims: sims[i], ranked: ranked.slice(0, 3) })));
    },
    [store],
  );

  const [debug, setDebug] = useState<
    { box: { minX: number; minY: number; maxX: number; maxY: number }; feature: { aspect: number; widthPx: number; heightPx: number }; sims: number[]; ranked: { word: string; score: number }[] }[]
  >([]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="text-xl font-bold">Recognizer diagnostics</h1>
      <p className="text-sm text-ink-faint">
        template store: {store.source} · ready={String(store.ready)}
      </p>

      <div className="mt-4 space-y-3">
        <HandwritingCanvas
          strokes={history.strokes}
          onCommit={history.commit}
          tool={tool}
          color={color}
          size={size}
          showGuides={showGuides}
          onGestureEnd={(s) => analyze(s)}
        />
        <WritingToolbar
          tool={tool}
          onToolChange={setTool}
          size={size}
          onSizeChange={setSize}
          color={color}
          onColorChange={setColor}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={history.undo}
          onRedo={history.redo}
          onClear={() => history.reset([])}
          showGuides={showGuides}
          onToggleGuides={() => setShowGuides((s) => !s)}
          hasInk={history.strokes.length > 0}
        />
      </div>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold">
          Glyphs: {debug.length} · status: {result?.status ?? "-"} · confidence:{" "}
          {result ? Math.round(result.confidence * 100) : 0}%
        </h2>
        <div className="space-y-2">
          {debug.map((d, i) => {
            const top = d.sims
              .map((s, idx) => ({ letter: String.fromCharCode(65 + idx), s }))
              .sort((a, b) => b.s - a.s)
              .slice(0, 5);
            return (
              <div key={i} className="rounded-xl border border-black/10 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-ink-faint">
                    #{i} box {Math.round(d.box.maxX - d.box.minX)}×{Math.round(d.box.maxY - d.box.minY)} ·
                    aspect {d.feature.aspect.toFixed(2)} · {d.feature.widthPx.toFixed(0)}×{d.feature.heightPx.toFixed(0)}px
                  </span>
                  <span className="font-mono text-xs text-ink-faint">
                    words: {d.ranked.map((r) => `${r.word} ${r.score.toFixed(2)}`).join(" | ")}
                  </span>
                </div>
                <div className="mt-2 flex gap-3">
                  {top.map((t) => (
                    <span key={t.letter} className="flex items-center gap-1.5">
                      <span className="text-lg font-bold">{t.letter}</span>
                      <span className="relative block h-2 w-24 rounded bg-black/10">
                        <span
                          className="absolute left-0 top-0 h-2 rounded bg-hint"
                          style={{ width: `${Math.round(t.s * 100)}%` }}
                        />
                      </span>
                      <span className="text-xs tabular-nums text-ink-soft">{t.s.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {debug.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-bold">Alignment vs APPLE</p>
            <pre className="mt-1 overflow-auto rounded-lg bg-black/5 p-3 text-xs">
              {JSON.stringify(
                alignToWord(
                  debug.map((d) => d.sims),
                  "APPLE",
                ),
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}
