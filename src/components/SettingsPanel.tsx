"use client";

/** Settings panel: level filter, accent, speed, recognition backend, reset. */

import type { Accent, Rate } from "@/lib/speech";
import type { CefrLevel } from "@/lib/types";

export interface SettingsValues {
  levels: CefrLevel[];
  accent: Accent;
  rate: Rate;
  muted: boolean;
  recognitionBackend: "local" | "remote";
}

interface SettingsPanelProps {
  values: SettingsValues;
  availableLevels: CefrLevel[];
  onChange: (patch: Partial<SettingsValues>) => void;
  onResetProgress: () => void;
  onClose: () => void;
}

const ALL_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function SettingsPanel({
  values,
  availableLevels,
  onChange,
  onResetProgress,
  onClose,
}: SettingsPanelProps) {
  const toggleLevel = (level: CefrLevel) => {
    const next = values.levels.includes(level)
      ? values.levels.filter((l) => l !== level)
      : [...values.levels, level];
    onChange({ levels: next.length ? next : [level] });
  };

  return (
    <div
      data-testid="settings-panel"
      className="absolute right-2 top-[calc(100%+8px)] z-40 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/10 bg-white p-4 shadow-toolbar"
      role="dialog"
      aria-label="Settings"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Settings</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-faint hover:text-ink"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 space-y-4 text-sm">
        <div>
          <p className="mb-1.5 font-semibold text-ink">Level</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_LEVELS.map((l) => {
              const enabled = availableLevels.includes(l);
              const active = values.levels.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  disabled={!enabled}
                  onClick={() => toggleLevel(l)}
                  title={enabled ? undefined : "No words for this level yet"}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-hint text-white"
                      : enabled
                        ? "bg-black/5 text-ink-soft hover:bg-black/10"
                        : "cursor-not-allowed bg-black/[0.03] text-ink-faint/60"
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            A1 &amp; A2 shipped with the dataset — B1–C2 unlock when you add entries to{" "}
            <code className="rounded bg-black/5 px-1">vocabulary.json</code>.
          </p>
        </div>

        <div>
          <p className="mb-1.5 font-semibold text-ink">Accent</p>
          <div className="flex gap-1.5">
            {(["en-US", "en-GB"] as Accent[]).map((a) => (
              <button
                key={a}
                type="button"
                data-testid={`accent-${a}`}
                onClick={() => onChange({ accent: a })}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  values.accent === a ? "bg-hint text-white" : "bg-black/5 text-ink-soft hover:bg-black/10"
                }`}
              >
                {a === "en-US" ? "🇺🇸 American" : "🇬🇧 British"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-semibold text-ink">Speech speed</p>
          <div className="flex gap-1.5">
            {([0.75, 1, 1.25] as Rate[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onChange({ rate: r })}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  values.rate === r ? "bg-hint text-white" : "bg-black/5 text-ink-soft hover:bg-black/10"
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-semibold text-ink">Recognition backend</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              data-testid="backend-local"
              onClick={() => onChange({ recognitionBackend: "local" })}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                values.recognitionBackend === "local" ? "bg-hint text-white" : "bg-black/5 text-ink-soft hover:bg-black/10"
              }`}
            >
              On-device
            </button>
            <button
              type="button"
              data-testid="backend-remote"
              onClick={() => onChange({ recognitionBackend: "remote" })}
              className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                values.recognitionBackend === "remote" ? "bg-hint text-white" : "bg-black/5 text-ink-soft hover:bg-black/10"
              }`}
            >
              Backend API
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            “Backend API” posts strokes to <code className="rounded bg-black/5 px-1">/api/recognize</code> where a
            TFJS / server model can be mounted; it falls back to on-device until a model is configured.
          </p>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.03] px-3 py-2.5">
          <span className="font-medium text-ink">Mute pronunciation</span>
          <input
            type="checkbox"
            checked={values.muted}
            onChange={(e) => onChange({ muted: e.target.checked })}
            className="h-4 w-4 accent-hint"
          />
        </label>

        <button
          type="button"
          onClick={onResetProgress}
          data-testid="reset-progress"
          className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-[#DC2626] transition hover:bg-red-100"
        >
          Reset progress &amp; scores
        </button>
      </div>
    </div>
  );
}
