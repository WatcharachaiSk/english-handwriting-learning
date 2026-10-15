/** Progress + settings persistence (Section 9: localStorage, no account). */

import type { ProgressState, UserSettings } from "@/lib/types";

const KEY = "write-and-speak:progress:v1";

export const DEFAULT_SETTINGS: UserSettings = {
  penColor: "#1F2933",
  penSize: 5,
  rate: 1,
  accent: "en-US",
  muted: false,
  recognitionBackend: "local",
  levels: ["A1", "A2"],
};

export function defaultProgress(): ProgressState {
  return {
    version: 1,
    index: 0,
    score: 0,
    completed: {},
    mode: "copy",
    settings: DEFAULT_SETTINGS,
  };
}

export function loadProgress(): ProgressState {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    if (parsed && parsed.version !== 1) return defaultProgress();
    const base = defaultProgress();
    return {
      ...base,
      ...parsed,
      completed: parsed.completed ?? {},
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(state: ProgressState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full / private mode — progress simply stays in memory
  }
}

export function clearProgress(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
