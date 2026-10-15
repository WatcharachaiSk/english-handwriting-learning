"use client";

/**
 * Live AI predictions while the learner writes (Section 2D).
 * Shows the top-3 candidates with a calibrated confidence bar, an honest
 * "estimate" disclaimer and an explicit empty/low-signal state.
 */

import type { RecognitionResult } from "@/lib/types";
import { SpeakerIcon } from "@/components/icons";

interface PredictionListProps {
  result: RecognitionResult | null;
  busy: boolean;
  onSelect: (word: string) => void;
  selectedWord?: string | null;
}

const EMPTY_HINT = "AI suggestions appear here as soon as you start writing.";

export default function PredictionList({ result, busy, onSelect, selectedWord }: PredictionListProps) {
  const predictions = result?.predictions ?? [];
  const isLow = !result || result.status !== "ok";

  return (
    <section
      className="rounded-2xl border border-black/10 bg-white p-4 shadow-card"
      aria-label="AI handwriting predictions"
      data-testid="prediction-list"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">AI predictions</h3>
        <span className="text-[11px] text-ink-faint">
          {busy ? "reading…" : `${predictions.length} suggestion${predictions.length === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="mt-3 space-y-2" aria-live="polite">
        {predictions.map((p, i) => {
          const pct = Math.round(p.confidence * 100);
          const selected = selectedWord === p.word;
          return (
            <button
              key={`${p.word}-${i}`}
              type="button"
              data-testid={`prediction-${i}`}
              data-word={p.word}
              onClick={() => onSelect(p.word)}
              className={`group w-full rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-hint/60 bg-hint-soft"
                  : "border-black/10 bg-paper-cream hover:border-hint/40 hover:bg-hint-soft/50"
              } ${i === 0 ? "ring-1 ring-hint/20" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold tracking-wide text-ink" data-testid={`prediction-word-${i}`}>
                  {p.word}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-ink-soft tabular-nums" data-testid={`prediction-conf-${i}`}>
                    {p.confidence > 0 ? `${pct}%` : "low"}
                  </span>
                  <SpeakerIcon
                    size={15}
                    className="text-hint opacity-0 transition group-hover:opacity-100"
                  />
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className={`h-full rounded-full ${selected ? "bg-hint" : i === 0 ? "bg-hint" : "bg-hint/50"}`}
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>
            </button>
          );
        })}

        {predictions.length === 0 && (
          <div className="rounded-xl border border-dashed border-black/15 bg-paper-cream px-3 py-4 text-center">
            <p className="text-sm text-ink-soft" data-testid="prediction-empty">
              {isLow ? (result?.message ?? EMPTY_HINT) : EMPTY_HINT}
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 border-t border-black/5 pt-2 text-[11px] leading-relaxed text-ink-faint">
        Estimates from {result?.backend ?? "the on-device recognizer"} — the model is not 100% accurate, so
        double-check the letters before you rely on a suggestion.
      </p>
    </section>
  );
}
