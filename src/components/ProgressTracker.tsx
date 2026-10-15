"use client";

/** Word progress + score, used inside LearningHeader. */

interface ProgressTrackerProps {
  current: number;
  total: number;
  score: number;
  compact?: boolean;
}

export default function ProgressTracker({ current, total, score, compact = false }: ProgressTrackerProps) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className={compact ? "flex items-center gap-3" : "flex w-full flex-col gap-1.5"}>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium text-ink" data-testid="progress-label">
          Word {Math.min(current + 1, total)} of {total}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-correct-soft px-2.5 py-0.5 text-xs font-semibold text-correct"
          data-testid="score-label"
        >
          ★ {score} pts
        </span>
      </div>
      <div
        className={`h-1.5 overflow-hidden rounded-full bg-black/10 ${compact ? "w-24" : "w-full"}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Lesson progress"
      >
        <div
          className="h-full rounded-full bg-hint transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
