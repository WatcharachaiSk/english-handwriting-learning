/** Shared domain types for the Write & Speak learning app. */

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** Learning modes (Section 5 of the spec). */
export type LearningMode = "copy" | "listen" | "guess";

/** A single vocabulary record (Section 6 of the spec). */
export interface VocabularyEntry {
  id: string;
  word: string;
  meaningTh: string;
  phonetic: string;
  partOfSpeech: string;
  exampleSentence: string;
  exampleMeaningTh: string;
  cefrLevel: CefrLevel;
  category: string;
  audioText: string;
}

/** Shape of the on-disk JSON dataset. */
export interface VocabularyDataset {
  version: number;
  levels: CefrLevel[];
  entries: VocabularyEntry[];
}

/** One captured pen stroke, in canvas coordinates. */
export interface StrokePoint {
  x: number;
  y: number;
  /** Normalised pressure (0..1); falls back to 0.5 when unsupported. */
  p: number;
  /** ms epoch, used for velocity-aware smoothing. */
  t: number;
}

export interface Stroke {
  id: string;
  /** "pen" draws, "eraser" removes hit strokes (kept in history for undo). */
  tool: "pen" | "eraser";
  color: string;
  size: number;
  points: StrokePoint[];
}

/** A segmented handwritten glyph (one written letter candidate). */
export interface GlyphBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Normalised ink grid: GRID x GRID values in [0,1]. */
  grid: number[];
  strokeCount: number;
  /** Baseline-relative hint: x-height vs cap-height classification. */
  verticalPosition: "above" | "mid" | "below";
}

/** One candidate letter hypothesis produced by the recognizer. */
export interface LetterHypothesis {
  letter: string;
  /** 0..1 similarity between the glyph and the letter template. */
  score: number;
}

/** What the handwriting looks like (Section 2D: separate from spelling). */
export interface RecognitionPrediction {
  word: string;
  /** 0..1 model confidence, calibrated — never presented as 100% certain. */
  confidence: number;
  letters: LetterHypothesis[][];
}

export interface RecognitionResult {
  predictions: RecognitionPrediction[];
  /** Overall 0..1 confidence of the best prediction. */
  confidence: number;
  /** Set when the recognizer does not have enough signal yet. */
  status: "ok" | "low_signal" | "error";
  message?: string;
  /**
   * Per-glyph similarity against A–Z (0..1). Carried so the spelling checker
   * can compare handwriting with the expected word independently from the
   * dictionary ranking (Section 2D: recognition ≠ spelling verification).
   */
  glyphSims?: number[][];
  /** How the result was produced, for the provenance chip in the UI. */
  backend?: string;
}

/** Recognition input: raw strokes only — no text input is ever used. */
export interface RecognitionInput {
  strokes: Stroke[];
  /** Candidate words the current session is drawing from (optional prior). */
  vocabulary: string[];
}

/**
 * Pluggable recognition backend. The UI only depends on this interface so the
 * local template recognizer can be swapped for TensorFlow.js or a hosted
 * handwriting model without touching components (Section 7).
 */
export interface RecognitionService {
  readonly name: string;
  /** Human-readable provenance shown in the UI (real model vs adapter). */
  readonly kind: "local" | "remote" | "model";
  recognize(input: RecognitionInput): Promise<RecognitionResult>;
}

/** Result of comparing handwriting with the expected word (Section 3). */
export interface SpellingCheck {
  expectedWord: string;
  /** Best AI prediction — what the handwriting looks like. */
  predictedWord: string;
  /** 0..1: how much of the expected word was written correctly. */
  spellingAccuracy: number;
  /** 0..1: how confident the recognizer is about its own read. */
  recognitionConfidence: number;
  correct: boolean;
  /** Per-letter detail: expected vs recognized. */
  letterComparison: {
    expected: string;
    recognized: string | null;
    match: boolean;
  }[];
}

export interface ProgressState {
  version: 1;
  index: number;
  score: number;
  /** entry id -> best spelling accuracy (0..1) */
  completed: Record<string, number>;
  mode: LearningMode;
  settings: UserSettings;
}

export interface UserSettings {
  penColor: string;
  penSize: number;
  rate: 0.75 | 1 | 1.25;
  accent: "en-US" | "en-GB";
  muted: boolean;
  recognitionBackend: "local" | "remote";
  /** CEFR levels included in the lesson (Section 6). */
  levels: CefrLevel[];
}
