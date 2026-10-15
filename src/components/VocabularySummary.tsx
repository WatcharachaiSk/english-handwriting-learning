"use client";

/** End-of-lesson summary: words practiced, accuracy per word, total score. */

import { RefreshIcon, TrophyIcon } from "@/components/icons";
import type { VocabularyEntry } from "@/lib/types";

interface VocabularySummaryProps {
  entries: VocabularyEntry[];
  completed: Record<string, number>;
  score: number;
  onRestart: () => void;
}

export default function VocabularySummary({ entries, completed, score, onRestart }: VocabularySummaryProps) {
  const practiced = entries.filter((e) => completed[e.id] !== undefined);
  const average = practiced.length
    ? Math.round((practiced.reduce((n, e) => n + (completed[e.id] ?? 0), 0) / practiced.length) * 100)
    : 0;

  return (
    <section className="rounded-2xl border border-black/10 bg-white p-6 shadow-card" data-testid="vocabulary-summary">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warn-soft text-warn">
          <TrophyIcon size={22} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-ink">Lesson complete!</h2>
          <p className="text-sm text-ink-soft">
            {practiced.length} of {entries.length} words practiced · average accuracy {average}% · {score} points
          </p>
        </div>
        <button
          type="button"
          onClick={onRestart}
          data-testid="restart-lesson"
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/90"
        >
          <RefreshIcon size={16} />
          Practice again
        </button>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => {
          const acc = completed[e.id];
          const seen = acc !== undefined;
          return (
            <li
              key={e.id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                seen ? "border-correct/25 bg-correct-soft/50" : "border-black/10 bg-paper-cream"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{e.word}</p>
                <p className="truncate text-xs text-ink-faint">{e.meaningTh}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold tabular-nums ${
                  seen ? "bg-white text-correct" : "bg-black/5 text-ink-faint"
                }`}
              >
                {seen ? `${Math.round(acc * 100)}%` : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
