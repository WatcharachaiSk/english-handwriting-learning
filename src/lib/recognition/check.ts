/**
 * Answer checking (Section 3).
 *
 * Deliberately separate from "is the handwriting pretty": we compare the
 * recognised glyph sequence with the expected word, letter by letter, using
 * the visual similarity the recognizer produced.
 */

import type { RecognitionResult, SpellingCheck } from "@/lib/types";
import { alignToWord } from "./scoring";

/** A glyph counts as the expected letter from this visual similarity up. */
export const LETTER_MATCH_THRESHOLD = 0.55;
/** Overall alignment needed to call the answer correct. */
export const CORRECT_THRESHOLD = 0.63;

export type FeedbackTone = "correct" | "almost" | "unclear" | "wrong";

export interface WritingFeedback {
  check: SpellingCheck;
  tone: FeedbackTone;
  title: string;
  detail: string;
}

export function checkWriting(expectedWord: string, result: RecognitionResult): WritingFeedback {
  const expected = expectedWord.toUpperCase();
  const predicted = result.predictions[0]?.word ?? "";
  const glyphSims = result.glyphSims ?? [];

  const alignment = alignToWord(glyphSims, expected);

  const matchedLetters = alignment.perLetter.filter((s) => s !== null && s >= LETTER_MATCH_THRESHOLD);
  const spellingAccuracy = expected.length ? matchedLetters.length / expected.length : 0;

  const letterComparison = expected.split("").map((ch, i) => {
    const sim = alignment.perLetter[i];
    return {
      expected: ch,
      recognized: alignment.recognized[i],
      match: (sim ?? 0) >= LETTER_MATCH_THRESHOLD,
    };
  });

  // "Correct" means every expected letter was actually written and each glyph
  // looks like the letter it is supposed to be. A missing letter (APPL) or a
  // letter that clearly does not match (sim below the threshold) is *not*
  // correct — the learner gets "Almost there" instead.
  const allLettersWritten = alignment.perLetter.every((s) => s !== null);
  const allLettersMatch = alignment.perLetter.every((s) => (s ?? 0) >= LETTER_MATCH_THRESHOLD);
  const correct =
    predicted === expected ||
    (alignment.score >= CORRECT_THRESHOLD && allLettersWritten && allLettersMatch);
  const recognitionConfidence = result.confidence;

  const check: SpellingCheck = {
    expectedWord: expected,
    predictedWord: predicted || "—",
    spellingAccuracy,
    recognitionConfidence,
    correct,
    letterComparison,
  };

  if (result.status === "low_signal" || glyphSims.length === 0) {
    return {
      check: { ...check, spellingAccuracy: 0, correct: false },
      tone: "unclear",
      title: "We could not read any letters yet.",
      detail: result.message ?? "Write the word on the paper first, then press Check My Writing.",
    };
  }

  if (correct) {
    return {
      check,
      tone: "correct",
      title: "Correct! Great job!",
      detail:
        predicted === expected
          ? `Your handwriting reads “${predicted}”.`
          : `Spelled correctly, even though we read “${predicted}”.`,
    };
  }

  const wrongOnes = letterComparison.filter((l) => !l.match);
  const mismatchText = wrongOnes
    .map((l) => `expected “${l.expected}” (we read ${l.recognized ? `“${l.recognized}”` : "nothing"})`)
    .join(", ");

  if (alignment.score >= 0.45) {
    return {
      check,
      tone: "almost",
      title: "Almost there! Try again.",
      detail: `Check ${wrongOnes.length} letter${wrongOnes.length > 1 ? "s" : ""}: ${mismatchText}.`,
    };
  }

  if (recognitionConfidence < 0.5) {
    return {
      check,
      tone: "unclear",
      title: "We could not read your writing clearly.",
      detail: "Try writing a little larger inside the guide lines, or pick one of the suggestions above.",
    };
  }

  return {
    check,
    tone: "wrong",
    title: "Not quite right yet.",
    detail: `Expected “${expected}”, your writing looks like “${predicted}”. ${mismatchText}`,
  };
}
