"use client";

/**
 * Pronunciation player (Section 4): speaks the confirmed/detected word with
 * the Web Speech API, with accent + speed controls and example sentence
 * playback. Never speaks automatically on low-confidence detections — the
 * learner presses the button (their tap *is* the confirmation).
 */

import type { Accent, Rate } from "@/lib/speech";
import { RefreshIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/icons";

const RATES: Rate[] = [0.75, 1, 1.25];

interface PronunciationPlayerProps {
  text: string;
  meaningTh?: string;
  phonetic?: string;
  exampleSentence?: string;
  exampleMeaningTh?: string;
  rate: Rate;
  onRateChange: (rate: Rate) => void;
  accent: Accent;
  muted: boolean;
  speaking: boolean;
  hasVoices: boolean;
  supported: boolean;
  onSpeak: (text: string) => void;
  onCancel: () => void;
  /** Shown above the word, e.g. "Target word" / "AI read". */
  caption?: string;
  hidden?: boolean;
  hiddenPattern?: string;
}

export default function PronunciationPlayer({
  text,
  meaningTh,
  phonetic,
  exampleSentence,
  exampleMeaningTh,
  rate,
  onRateChange,
  accent,
  muted,
  speaking,
  hasVoices,
  supported,
  onSpeak,
  onCancel,
  caption,
  hidden = false,
  hiddenPattern,
}: PronunciationPlayerProps) {
  const canSpeak = supported && !muted && text.trim().length > 0;
  const accentLabel = accent === "en-US" ? "🇺🇸 American" : "🇬🇧 British";

  const handleSpeak = () => {
    if (!canSpeak) return;
    if (speaking) onCancel();
    else onSpeak(text);
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {caption && <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{caption}</p>}
          {hidden ? (
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-ink" data-testid="hidden-word">
              {hiddenPattern ?? "—"}
            </p>
          ) : (
            <p className="truncate text-3xl font-bold tracking-wide text-ink" data-testid="player-word">
              {text}
            </p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            {!hidden && phonetic && <span className="font-mono text-ink-faint">{phonetic}</span>}
            {meaningTh && <span>{meaningTh}</span>}
          </div>
        </div>

        <button
          type="button"
          data-testid="speak-button"
          onClick={handleSpeak}
          disabled={!canSpeak}
          title={canSpeak ? `Listen (${accentLabel}, ${rate}x)` : "Speech unavailable"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition
            ${speaking ? "bg-hint text-white shadow-lg" : "bg-hint-soft text-hint hover:bg-hint/20"}
            disabled:cursor-not-allowed disabled:bg-black/5 disabled:text-ink-faint`}
        >
          {muted || !supported ? <SpeakerOffIcon size={22} /> : speaking ? <RefreshIcon size={22} className="animate-spin" /> : <SpeakerIcon size={22} />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-black/5 p-1" role="group" aria-label="Speaking speed">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              data-testid={`rate-${r}`}
              onClick={() => onRateChange(r)}
              aria-pressed={rate === r}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                rate === r ? "bg-white text-hint shadow-sm" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-faint">
          {accentLabel}
          {!hasVoices && supported && " · no voice installed"}
        </span>
      </div>

      {exampleSentence && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-paper-cream p-3">
          <button
            type="button"
            onClick={() => canSpeak && onSpeak(exampleSentence)}
            disabled={!canSpeak}
            data-testid="speak-example"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-hint ring-1 ring-black/10 transition hover:bg-hint-soft disabled:opacity-40"
            title="Listen to the example sentence"
            aria-label="Listen to the example sentence"
          >
            <SpeakerIcon size={16} />
          </button>
          <div className="min-w-0">
            <p className="text-sm text-ink">{exampleSentence}</p>
            {exampleMeaningTh && <p className="mt-0.5 text-xs text-ink-faint">{exampleMeaningTh}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
