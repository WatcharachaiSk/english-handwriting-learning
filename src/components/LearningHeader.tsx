"use client";

/** App header: logo, progress, score, mute toggle and settings (Section 2A). */

import ProgressTracker from "@/components/ProgressTracker";
import { SettingsIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/icons";

interface LearningHeaderProps {
  index: number;
  total: number;
  score: number;
  muted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  settingsOpen: boolean;
}

export default function LearningHeader({
  index,
  total,
  score,
  muted,
  onToggleMute,
  onOpenSettings,
  settingsOpen,
}: LearningHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M17 3l4 4L8 20H4v-4L17 3z" />
              <path d="M14 6l4 4" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-ink" data-testid="app-logo">
              Write &amp; Speak
            </p>
            <p className="hidden text-[11px] text-ink-faint sm:block">Handwriting practice with AI feedback</p>
          </div>
        </div>

        <div className="mx-auto hidden md:block">
          <ProgressTracker current={index} total={total} score={score} compact />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="md:hidden">
            <ProgressTracker current={index} total={total} score={score} compact />
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            data-testid="mute-toggle"
            aria-pressed={muted}
            title={muted ? "Unmute pronunciation" : "Mute pronunciation"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-ink-soft transition hover:bg-black/[0.03]"
          >
            {muted ? <SpeakerOffIcon size={17} /> : <SpeakerIcon size={17} />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            data-testid="settings-toggle"
            aria-expanded={settingsOpen}
            aria-label="Settings"
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
              settingsOpen
                ? "border-hint/50 bg-hint-soft text-hint"
                : "border-black/10 bg-white text-ink-soft hover:bg-black/[0.03]"
            }`}
          >
            <SettingsIcon size={17} />
          </button>
        </div>
      </div>

      <div className="border-t border-black/5 px-4 pb-2 pt-1.5 md:hidden">
        <ProgressTracker current={index} total={total} score={score} />
      </div>
    </header>
  );
}
