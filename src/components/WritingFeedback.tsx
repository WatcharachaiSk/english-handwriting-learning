"use client";

/**
 * Writing feedback (Section 3): expected word vs AI prediction, spelling
 * accuracy, per-letter comparison and the three actions — Try Again,
 * Listen to Pronunciation, Continue.
 */

import type { WritingFeedback as Feedback } from "@/lib/recognition/check";
import { ArrowRightIcon, CheckIcon, RefreshIcon, SpeakerIcon } from "@/components/icons";

interface WritingFeedbackProps {
  feedback: Feedback;
  onTryAgain: () => void;
  onListen: () => void;
  onContinue: () => void;
  speaking: boolean;
  speechEnabled: boolean;
}

const TONE_STYLES: Record<Feedback["tone"], { chip: string; border: string; bg: string }> = {
  correct: { chip: "bg-correct text-white", border: "border-correct/30", bg: "bg-correct-soft/60" },
  almost: { chip: "bg-warn text-white", border: "border-warn/30", bg: "bg-warn-soft/60" },
  unclear: { chip: "bg-ink-soft text-white", border: "border-black/15", bg: "bg-black/[0.03]" },
  wrong: { chip: "bg-[#DC2626] text-white", border: "border-red-300", bg: "bg-red-50" },
};

export default function WritingFeedback({
  feedback,
  onTryAgain,
  onListen,
  onContinue,
  speaking,
  speechEnabled,
}: WritingFeedbackProps) {
  const { check, tone, title, detail } = feedback;
  const styles = TONE_STYLES[tone];
  const accuracyPct = Math.round(check.spellingAccuracy * 100);
  const confidencePct = Math.round(check.recognitionConfidence * 100);

  return (
    <section
      data-testid="writing-feedback"
      className={`animate-fade-up rounded-2xl border ${styles.border} ${styles.bg} p-4`}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.chip}`}>
          {tone === "correct" ? <CheckIcon size={17} /> : <RefreshIcon size={16} />}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink" data-testid="feedback-title">
            {title}
          </h3>
          <p className="mt-0.5 text-sm text-ink-soft" data-testid="feedback-detail">
            {detail}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-white/80 p-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Expected</dt>
          <dd className="font-bold text-ink" data-testid="feedback-expected">
            {check.expectedWord}
          </dd>
        </div>
        <div className="rounded-xl bg-white/80 p-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-ink-faint">AI read</dt>
          <dd className="font-bold text-ink" data-testid="feedback-predicted">
            {check.predictedWord}
          </dd>
        </div>
        <div className="rounded-xl bg-white/80 p-2.5">
          <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Spelling accuracy</dt>
          <dd className="font-bold text-ink tabular-nums" data-testid="feedback-accuracy">
            {accuracyPct}%
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Letter comparison">
        {check.letterComparison.map((l, i) => (
          <span
            key={i}
            title={l.match ? "looks right" : `expected ${l.expected}, read ${l.recognized ?? "nothing"}`}
            className={`flex h-8 w-7 items-center justify-center rounded-md border text-sm font-bold ${
              l.match ? "border-correct/40 bg-correct-soft text-correct" : "border-warn/40 bg-warn-soft text-warn"
            }`}
          >
            {l.expected}
          </span>
        ))}
        <span className="ml-1 text-xs text-ink-faint">
          AI confidence {confidencePct}% (estimate)
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTryAgain}
          data-testid="feedback-try-again"
          className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-black/[0.03]"
        >
          <RefreshIcon size={16} />
          Try Again
        </button>
        <button
          type="button"
          onClick={onListen}
          disabled={!speechEnabled}
          data-testid="feedback-listen"
          className={`inline-flex items-center gap-2 rounded-xl bg-hint px-4 py-2 text-sm font-semibold text-white transition hover:bg-hint/90 disabled:opacity-40 ${
            speaking ? "ring-2 ring-hint/40" : ""
          }`}
        >
          <SpeakerIcon size={16} />
          Listen to Pronunciation
        </button>
        <button
          type="button"
          onClick={onContinue}
          data-testid="feedback-continue"
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink/90"
        >
          Continue
          <ArrowRightIcon size={16} />
        </button>
      </div>
    </section>
  );
}
