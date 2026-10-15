"use client";

import type { LearningMode } from "@/lib/types";
import { EarIcon, PencilSquareIcon, PencilIcon } from "@/components/icons";

const MODES: {
  id: LearningMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "copy",
    label: "Copy & Write",
    description: "See the word, then trace it with your own hand.",
    icon: <PencilIcon size={16} />,
  },
  {
    id: "listen",
    label: "Listen & Write",
    description: "Hear the word and read the meaning — the spelling stays hidden.",
    icon: <EarIcon size={16} />,
  },
  {
    id: "guess",
    label: "Guess & Write",
    description: "Only a Thai clue or example sentence is shown. Write the English word.",
    icon: <PencilSquareIcon size={16} />,
  },
];

interface LearningModeSelectorProps {
  value: LearningMode;
  onChange: (mode: LearningMode) => void;
}

export default function LearningModeSelector({ value, onChange }: LearningModeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="Learning mode">
        {MODES.map((m) => {
          const active = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`mode-${m.id}`}
              onClick={() => onChange(m.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition
                ${
                  active
                    ? "border-hint/50 bg-hint-soft text-hint shadow-sm"
                    : "border-black/10 bg-white text-ink-soft hover:border-black/20 hover:bg-black/[0.03]"
                }`}
            >
              <span className={active ? "text-hint" : "text-ink-faint"}>{m.icon}</span>
              <span className="font-semibold">{m.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-faint">{MODES.find((m) => m.id === value)?.description}</p>
    </div>
  );
}
