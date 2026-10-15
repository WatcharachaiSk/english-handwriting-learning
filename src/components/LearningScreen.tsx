"use client";

/**
 * The Learning Screen (Sections 2–5, 9): wires the canvas, the recognizer,
 * the checker, TTS, modes, progress and settings together.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HandwritingCanvas, { type PenTool } from "@/components/HandwritingCanvas";
import LearningHeader from "@/components/LearningHeader";
import LearningModeSelector from "@/components/LearningModeSelector";
import PredictionList from "@/components/PredictionList";
import PronunciationPlayer from "@/components/PronunciationPlayer";
import SettingsPanel, { type SettingsValues } from "@/components/SettingsPanel";
import VocabularySummary from "@/components/VocabularySummary";
import WordChallengeCard from "@/components/WordChallengeCard";
import WritingFeedbackView from "@/components/WritingFeedback";
import WritingToolbar from "@/components/WritingToolbar";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { useSpeech } from "@/hooks/useSpeech";
import { useStrokeHistory } from "@/hooks/useStrokeHistory";
import { checkWriting, type WritingFeedback as FeedbackResult } from "@/lib/recognition/check";
import { getRecognitionService, analyzeStrokes } from "@/lib/recognition/service";
import { getTemplateStore } from "@/lib/recognition/templates";
import { segmentStrokes } from "@/lib/recognition/segmenter";
import { rasterizeGlyph } from "@/lib/recognition/geometry";
import { letterSimilarities, rankWords, alignToWord } from "@/lib/recognition/scoring";
import lexiconWords from "@/data/lexicon.json";
import type { RecognitionResult, Stroke, UserSettings, VocabularyEntry } from "@/lib/types";
import { clearProgress, defaultProgress, loadProgress, saveProgress } from "@/lib/storage";
import { buildLesson, levelsAvailable } from "@/lib/vocabulary";

const BASE_POINTS = 10;
const HINT_PENALTY = 2;

export default function LearningScreen() {
  const [hydrated, setHydrated] = useState(false);
  const [progress, setProgress] = useState(defaultProgress());
  const [tool, setTool] = useState<PenTool>("pen");
  const [showGuides, setShowGuides] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const history = useStrokeHistory([]);
  const speech = useSpeech();
  const requestRef = useRef(0);

  const settings = progress.settings;
  const lesson = useMemo(() => buildLesson(settings.levels), [settings.levels]);
  const entry: VocabularyEntry | undefined = lesson[progress.index];
  const finished = progress.index >= lesson.length;

  // ---- hydration (localStorage) ------------------------------------------------
  useEffect(() => {
    const saved = loadProgress();
    setProgress(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => saveProgress(progress), 250);
    return () => window.clearTimeout(timer);
  }, [progress, hydrated]);

  // ---- debug hook (opt-in: localStorage "ws:debug" = "1") --------------------
  // Lets scripts/inspect the exact engine output on this screen.
  useEffect(() => {
    let enabled = false;
    try {
      enabled = window.localStorage.getItem("ws:debug") === "1";
    } catch {
      enabled = false;
    }
    if (!enabled) return;
    const w = window as unknown as Record<string, unknown>;
    w.__wsDebug = {
      strokes: history.strokes,
      vocabulary: lesson.map((e) => e.word),
      store: getTemplateStore(),
      segmentStrokes,
      rasterizeGlyph,
      letterSimilarities,
      rankWords,
      alignToWord,
      lexicon: lexiconWords.words,
      analyze: () =>
        analyzeStrokes(history.strokes, lesson.map((e) => e.word), getTemplateStore()),
    };
  });

  // ---- word transitions --------------------------------------------------------
  const resetWordState = useCallback(() => {
    history.reset([]);
    setHintCount(0);
    setRevealed(false);
    setFeedback(null);
    setResult(null);
    setSelectedWord(null);
  }, [history]);

  const patchSettings = useCallback((patch: Partial<UserSettings>) => {
    setProgress((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  }, []);

  // Levels changed → clamp the index and start the new word fresh.
  const handleSettingsPatch = useCallback(
    (patch: Partial<UserSettings>) => {
      setProgress((p) => {
        const next = { ...p, settings: { ...p.settings, ...patch } };
        if (patch.levels) {
          const length = buildLesson(patch.levels).length;
          next.index = Math.min(p.index, Math.max(0, length - 1));
        }
        return next;
      });
      if (patch.levels || patch.recognitionBackend) resetWordState();
    },
    [resetWordState],
  );

  // ---- recognition -------------------------------------------------------------
  const runRecognition = useCallback(
    async (strokes = history.strokes): Promise<RecognitionResult | null> => {
      if (!entry) return null;
      const service = getRecognitionService(settings.recognitionBackend);
      const requestId = ++requestRef.current;
      setBusy(true);
      try {
        const res = await service.recognize({
          strokes,
          vocabulary: lesson.map((e) => e.word),
        });
        if (requestId !== requestRef.current) return null; // stale response
        setResult(res);
        return res;
      } finally {
        if (requestId === requestRef.current) setBusy(false);
      }
    },
    [entry, history.strokes, lesson, settings.recognitionBackend],
  );

  const handleGestureEnd = useCallback(
    (strokes: Stroke[]) => {
      void runRecognition(strokes);
    },
    [runRecognition],
  );

  // ---- actions -----------------------------------------------------------------
  const speak = useCallback(
    (text: string) => {
      if (settings.muted || !text.trim()) return;
      void speech.speak(text, { rate: settings.rate, accent: settings.accent });
    },
    [settings.accent, settings.muted, settings.rate, speech],
  );

  const handleCheck = useCallback(async () => {
    if (!entry || history.strokes.length === 0 || checking) return;
    setChecking(true);
    try {
      const res = (await runRecognition()) ?? {
        predictions: [],
        confidence: 0,
        status: "error" as const,
        message: "Recognition service unavailable.",
      };
      const fb = checkWriting(entry.word, res);
      setFeedback(fb);

      setProgress((p) => {
        const prevAcc = p.completed[entry.id];
        const best = Math.max(prevAcc ?? 0, fb.check.spellingAccuracy);
        const alreadyAwarded = prevAcc !== undefined && prevAcc >= 0.9;
        const points =
          fb.check.correct && !revealed && !alreadyAwarded
            ? Math.max(2, BASE_POINTS - HINT_PENALTY * hintCount)
            : 0;
        return {
          ...p,
          score: p.score + points,
          completed: { ...p.completed, [entry.id]: best },
        };
      });
    } finally {
      setChecking(false);
    }
  }, [checking, entry, hintCount, history.strokes, revealed, runRecognition]);

  const goNext = useCallback(() => {
    resetWordState();
    setProgress((p) => ({ ...p, index: Math.min(p.index + 1, lesson.length) }));
  }, [lesson.length, resetWordState]);

  const handleHint = useCallback(() => {
    if (!entry) return;
    setHintCount((n) => Math.min(n + 1, entry.word.length));
  }, [entry]);

  const handleShowAnswer = useCallback(() => {
    setRevealed(true);
    setHintCount(entry ? entry.word.length : 0);
  }, [entry]);

  const handleSelectPrediction = useCallback(
    (word: string) => {
      setSelectedWord(word);
      // Tapping a suggestion is an explicit confirmation → pronunciation allowed.
      speak(word);
    },
    [speak],
  );

  const handleResetProgress = useCallback(() => {
    clearProgress();
    setProgress(defaultProgress());
    resetWordState();
    setSettingsOpen(false);
  }, [resetWordState]);

  // ---- keyboard shortcuts (Section 9) -------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (meta && key === "y") {
        e.preventDefault();
        history.redo();
        return;
      }
      if (meta && key === "k") {
        e.preventDefault();
        history.reset([]);
        return;
      }
      if (meta) return;
      if (key === "p") setTool("pen");
      if (key === "e") setTool("eraser");
      if (key === "g") setShowGuides((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history]);

  // ---- render -------------------------------------------------------------------
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="h-14 animate-pulse rounded-2xl bg-black/5" />
          <div className="mt-4 h-40 animate-pulse rounded-2xl bg-black/5" />
          <div className="mt-4 h-[380px] animate-pulse rounded-2xl bg-black/5" />
          <p className="mt-4 text-center text-sm text-ink-faint">Loading your notebook…</p>
        </div>
      </div>
    );
  }

  const wordVisible = !finished && (progress.mode === "copy" || revealed);
  const hasInk = history.strokes.length > 0;

  return (
    <div className="min-h-screen bg-paper pb-16">
      <div className="relative">
        <LearningHeader
          index={progress.index}
          total={lesson.length}
          score={progress.score}
          muted={settings.muted}
          settingsOpen={settingsOpen}
          onToggleMute={() => {
            if (!settings.muted) speech.cancel();
            patchSettings({ muted: !settings.muted });
          }}
          onOpenSettings={() => setSettingsOpen((s) => !s)}
        />
        {settingsOpen && (
          <SettingsPanel
            values={{
              levels: settings.levels,
              accent: settings.accent,
              rate: settings.rate,
              muted: settings.muted,
              recognitionBackend: settings.recognitionBackend,
            }}
            availableLevels={levelsAvailable()}
            onChange={handleSettingsPatch}
            onResetProgress={handleResetProgress}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {finished ? (
          <div className="mt-4">
            <VocabularySummary
              entries={lesson}
              completed={progress.completed}
              score={progress.score}
              onRestart={() => {
                resetWordState();
                setProgress((p) => ({ ...p, index: 0 }));
              }}
            />
          </div>
        ) : (
          <>
            <LearningModeSelector
              value={progress.mode}
              onChange={(mode) => {
                setProgress((p) => ({ ...p, mode }));
                resetWordState();
              }}
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
              {/* Left: challenge + paper + actions */}
              <div className="min-w-0 space-y-4">
                <WordChallengeCard
                  entry={entry}
                  mode={progress.mode}
                  revealed={revealed}
                  hintCount={hintCount}
                  onHint={handleHint}
                  onShowAnswer={handleShowAnswer}
                  onSpeakWord={() => speak(entry.word)}
                  speaking={speech.speaking}
                  speechEnabled={speech.supported && !settings.muted}
                >
                  <PronunciationPlayer
                    text={entry.word}
                    meaningTh={entry.meaningTh}
                    phonetic={wordVisible ? entry.phonetic : undefined}
                    exampleSentence={wordVisible ? entry.exampleSentence : undefined}
                    exampleMeaningTh={wordVisible ? entry.exampleMeaningTh : undefined}
                    rate={settings.rate}
                    onRateChange={(rate) => patchSettings({ rate })}
                    accent={settings.accent}
                    muted={settings.muted}
                    speaking={speech.speaking}
                    hasVoices={speech.hasVoices}
                    supported={speech.supported}
                    onSpeak={speak}
                    onCancel={speech.cancel}
                    caption={wordVisible ? "Practice pronunciation" : "Hear it, then write it"}
                    hidden={!wordVisible}
                    hiddenPattern={entry.word
                      .split("")
                      .map((ch, i) => (i < hintCount ? ch : "_"))
                      .join(" ")}
                  />
                </WordChallengeCard>

                <div className="space-y-3">
                  <HandwritingCanvas
                    strokes={history.strokes}
                    onCommit={history.commit}
                    tool={tool}
                    color={settings.penColor}
                    size={settings.penSize}
                    showGuides={showGuides}
                    onGestureEnd={handleGestureEnd}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <WritingToolbar
                      tool={tool}
                      onToolChange={setTool}
                      size={settings.penSize}
                      onSizeChange={(penSize) => patchSettings({ penSize })}
                      color={settings.penColor}
                      onColorChange={(penColor) => patchSettings({ penColor })}
                      canUndo={history.canUndo}
                      canRedo={history.canRedo}
                      onUndo={history.undo}
                      onRedo={history.redo}
                      onClear={() => {
                        history.reset([]);
                        setFeedback(null);
                      }}
                      showGuides={showGuides}
                      onToggleGuides={() => setShowGuides((s) => !s)}
                      hasInk={hasInk}
                    />

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCheck()}
                        disabled={!hasInk || checking}
                        data-testid="check-writing"
                        className="inline-flex items-center gap-2 rounded-xl bg-correct px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-correct/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckIcon size={17} />
                        {checking ? "Checking…" : "Check My Writing"}
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        data-testid="next-word"
                        className="inline-flex items-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-black/[0.03]"
                      >
                        Next word
                        <ArrowRightIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {feedback && (
                  <WritingFeedbackView
                    feedback={feedback}
                    onTryAgain={() => {
                      setFeedback(null);
                      history.reset([]);
                      setSelectedWord(null);
                    }}
                    onListen={() => speak(entry.word)}
                    onContinue={goNext}
                    speaking={speech.speaking}
                    speechEnabled={speech.supported && !settings.muted}
                  />
                )}

                {!speech.supported && (
                  <p className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
                    Your browser does not expose the Web Speech API, so pronunciation is disabled here.
                  </p>
                )}
              </div>

              {/* Right: live AI side panel (never overlaps the writing area) */}
              <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <PredictionList
                  result={result}
                  busy={busy}
                  onSelect={handleSelectPrediction}
                  selectedWord={selectedWord}
                />

                <div className="rounded-2xl border border-black/10 bg-white p-4 text-xs leading-relaxed text-ink-soft shadow-card">
                  <p className="mb-1.5 font-bold text-ink">How it works</p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>Write the word on the paper (mouse, finger or stylus).</li>
                    <li>The recognizer reads your strokes and suggests words live.</li>
                    <li>Press <strong>Check My Writing</strong> to compare with the expected spelling.</li>
                    <li>Listen to the correct pronunciation, then continue.</li>
                  </ol>
                  <p className="mt-2 text-ink-faint">
                    Shortcuts: <kbd className="rounded bg-black/5 px-1">P</kbd> pen ·{" "}
                    <kbd className="rounded bg-black/5 px-1">E</kbd> eraser ·{" "}
                    <kbd className="rounded bg-black/5 px-1">⌘Z</kbd> undo ·{" "}
                    <kbd className="rounded bg-black/5 px-1">⌘⇧Z</kbd> redo ·{" "}
                    <kbd className="rounded bg-black/5 px-1">⌘K</kbd> clear
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
