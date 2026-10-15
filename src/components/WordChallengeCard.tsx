"use client";

/**
 * Word challenge card (Section 2B).
 * In Listen & Write / Guess & Write the English word stays hidden behind an
 * underscore pattern until the learner asks for the answer.
 */

import type { LearningMode, VocabularyEntry } from "@/lib/types";
import { EyeIcon, LightbulbIcon, SpeakerIcon } from "@/components/icons";

interface WordChallengeCardProps {
  entry: VocabularyEntry;
  mode: LearningMode;
  revealed: boolean;
  hintCount: number;
  onHint: () => void;
  onShowAnswer: () => void;
  onSpeakWord: () => void;
  speaking: boolean;
  speechEnabled: boolean;
  children: React.ReactNode; // PronunciationPlayer
}

function patternFor(word: string): string {
  return word
    .split("")
    .map((ch) => (ch === " " ? " " : "_"))
    .join(" ");
}

export default function WordChallengeCard({
  entry,
  mode,
  revealed,
  hintCount,
  onHint,
  onShowAnswer,
  onSpeakWord,
  speaking,
  speechEnabled,
  children,
}: WordChallengeCardProps) {
  const word = entry.word.toUpperCase();
  const wordHidden = mode !== "copy" && !revealed;
  const hintTiles = word.split("").map((ch, i) => (i < hintCount ? ch : null));

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-card sm:p-5" aria-label="Word challenge">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-hint-soft px-2.5 py-1 font-semibold text-hint">{entry.cefrLevel}</span>
        <span className="rounded-full bg-black/5 px-2.5 py-1 font-medium text-ink-soft">{entry.category}</span>
        <span className="rounded-full bg-warn-soft px-2.5 py-1 font-medium text-warn">{entry.partOfSpeech}</span>
        <span className="ml-auto text-ink-faint" data-testid="challenge-mode">
          {mode === "copy" ? "Copy & Write" : mode === "listen" ? "Listen & Write" : "Guess & Write"}
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {wordHidden ? (mode === "listen" ? "Listen, then write it" : "Write the English word") : "Target word"}
        </p>

        {wordHidden ? (
          <>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-ink" data-testid="word-pattern">
              {patternFor(word)}
            </p>
            <div className="mt-2 rounded-xl bg-hint-soft/70 px-3 py-2">
              <p className="text-sm font-medium text-ink">{entry.meaningTh}</p>
              {mode === "guess" && (
                <p className="mt-0.5 text-xs text-ink-soft">คำใบ้: {entry.exampleMeaningTh}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-4xl font-bold tracking-wide text-ink sm:text-5xl" data-testid="target-word">
                {word}
              </h2>
              <span className="font-mono text-lg text-ink-faint">{entry.phonetic}</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft" data-testid="target-meaning">
              {entry.meaningTh}
            </p>
          </>
        )}
      </div>

      {/* Hint tiles */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Hint letters">
        {hintTiles.map((ch, i) => (
          <span
            key={i}
            className={`flex h-8 w-7 items-center justify-center rounded-md border text-sm font-bold ${
              ch ? "border-hint/40 bg-hint-soft text-hint" : "border-black/10 bg-paper-cream text-ink-faint"
            }`}
          >
            {ch ?? (i < hintCount ? word[i] : "·")}
          </span>
        ))}
        {hintCount > 0 && (
          <span className="ml-1 text-xs text-ink-faint">−2 pts per hint</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSpeakWord}
          disabled={!speechEnabled}
          data-testid="challenge-listen"
          className={`inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-black/[0.03] disabled:opacity-40 ${
            speaking ? "text-hint" : ""
          }`}
        >
          <SpeakerIcon size={16} />
          Listen
        </button>
        <button
          type="button"
          onClick={onHint}
          disabled={revealed || hintCount >= word.length}
          data-testid="challenge-hint"
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-black/[0.03] disabled:opacity-40"
        >
          <LightbulbIcon size={16} />
          Hint
        </button>
        <button
          type="button"
          onClick={onShowAnswer}
          disabled={revealed}
          data-testid="challenge-show-answer"
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-black/[0.03] disabled:opacity-40"
        >
          <EyeIcon size={16} />
          Show answer
        </button>
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}
