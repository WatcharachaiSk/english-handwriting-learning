"use client";

import { useCallback, useState } from "react";
import type { Stroke } from "@/lib/types";

interface HistoryState {
  present: Stroke[];
  past: Stroke[][];

  future: Stroke[][];
}

const HISTORY_LIMIT = 100;

/**
 * Undo/redo history for pen strokes. `commit` is called at the end of a
 * gesture (pointer up), so a single stroke — or one eraser sweep — is one
 * history entry.
 */
export function useStrokeHistory(initial: Stroke[] = []) {
  const [state, setState] = useState<HistoryState>({
    present: initial,
    past: [],
    future: [],
  });

  const commit = useCallback((next: Stroke[]) => {
    setState((s) => {
      if (next === s.present) return s;
      const past = [...s.past, s.present];
      if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
      return { present: next, past, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        present: previous,
        past: s.past.slice(0, -1),
        future: [s.present, ...s.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        present: next,
        past: [...s.past, s.present].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
      };
    });
  }, []);

  /** Jump to a known state (word change / clear-all reset). */
  const reset = useCallback((next: Stroke[] = []) => {
    setState({ present: next, past: [], future: [] });
  }, []);

  return {
    strokes: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit,
    undo,
    redo,
    reset,
  };
}
