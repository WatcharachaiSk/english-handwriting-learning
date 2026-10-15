/**
 * Similarity scoring and word-level decoding.
 *
 * - inkF1: tolerant ink-overlap (F1) between two normalized grids.
 * - letterSimilarities: per-glyph similarity against every letter A-Z.
 * - alignScore: dynamic-programming alignment of glyph sequence against a word
 *   (handles missing / extra letters), used both for spelling checks and for
 *   ranking dictionary candidates.
 */

import type { RasterizedGlyph } from "./geometry";
import type { LetterTemplate, TemplateStore } from "./templates";

export const GAP_COST = 0.85;
const INK_THRESHOLD = 0.35;

/** Tolerant Dice/F1 over two ink grids with a 1-cell neighbourhood. */
export function inkF1(a: number[], b: number[], threshold = INK_THRESHOLD, radius = 1): number {
  let aInk = 0;
  let bInk = 0;
  let aHit = 0;
  let bHit = 0;
  const n = Math.sqrt(a.length);

  const covered = (src: number[], target: number[], idx: number) => {
    const cx = idx % n;
    const cy = Math.floor(idx / n);
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        const x = cx + ox;
        const y = cy + oy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        if (target[y * n + x] >= threshold) return true;
      }
    }
    return false;
  };

  for (let i = 0; i < a.length; i++) {
    if (a[i] >= threshold) {
      aInk++;
      if (covered(a, b, i)) aHit++;
    }
  }
  for (let i = 0; i < b.length; i++) {
    if (b[i] >= threshold) {
      bInk++;
      if (covered(b, a, i)) bHit++;
    }
  }
  if (aInk === 0 || bInk === 0) return 0;
  const precision = aHit / aInk;
  const recall = bHit / bInk;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/** 1 when aspect ratios agree, decaying with log-ratio distance. */
export function aspectSimilarity(a: number, b: number): number {
  if (!isFinite(a) || !isFinite(b) || a <= 0 || b <= 0) return 0.5;
  const dist = Math.abs(Math.log(a / b));
  return Math.max(0, 1 - dist / Math.log(6));
}

export function glyphTemplateSimilarity(glyph: RasterizedGlyph, t: LetterTemplate): number {
  return 0.78 * inkF1(glyph.grid, t.grid) + 0.22 * aspectSimilarity(glyph.aspect, t.aspect);
}

/** Similarity of one glyph against A-Z (case-insensitive, best variant wins). */
export function letterSimilarities(glyph: RasterizedGlyph, store: TemplateStore): number[] {
  const out = new Array<number>(26).fill(0);
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    let best = 0;
    for (const t of store.variants(letter)) {
      const s = glyphTemplateSimilarity(glyph, t);
      if (s > best) best = s;
    }
    out[i] = best;
  }
  return out;
}

export interface AlignmentResult {
  /** 0..1 overall match between the glyph sequence and the word. */
  score: number;
  /**
   * Per expected letter: best similarity of the glyph it aligned to, or null
   * when the letter was not written at all.
   */
  perLetter: (number | null)[];
  /** Best-guess recognized letter for each expected letter slot. */
  recognized: (string | null)[];
}

function charIndex(c: string): number {
  const i = c.charCodeAt(0) - 65;
  return i >= 0 && i < 26 ? i : -1;
}

/**
 * Wagner-Fischer style alignment where substitution cost comes from the visual
 * similarity of the glyph to that letter (not from string equality).
 */
export function alignToWord(glyphSims: number[][], word: string): AlignmentResult {
  const letters = word.toUpperCase().split("").filter((c) => charIndex(c) >= 0);
  const N = glyphSims.length;
  const L = letters.length;

  if (L === 0) return { score: 0, perLetter: [], recognized: [] };
  if (N === 0) return { score: 0, perLetter: letters.map(() => null), recognized: letters.map(() => null) };

  const cost: number[][] = Array.from({ length: N + 1 }, () => new Array<number>(L + 1).fill(0));
  const back: number[][] = Array.from({ length: N + 1 }, () => new Array<number>(L + 1).fill(0)); // 0=diag,1=up,2=left

  for (let i = 1; i <= N; i++) {
    cost[i][0] = i * GAP_COST;
    back[i][0] = 1;
  }
  for (let j = 1; j <= L; j++) {
    cost[0][j] = j * GAP_COST;
    back[0][j] = 2;
  }

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= L; j++) {
      const li = charIndex(letters[j - 1]);
      const sim = li >= 0 ? glyphSims[i - 1][li] : 0;
      const sub = cost[i - 1][j - 1] + (1 - sim);
      const del = cost[i - 1][j] + GAP_COST; // extra glyph
      const ins = cost[i][j - 1] + GAP_COST; // missing glyph
      let best = sub;
      let dir = 0;
      if (del < best) {
        best = del;
        dir = 1;
      }
      if (ins < best) {
        best = ins;
        dir = 2;
      }
      cost[i][j] = best;
      back[i][j] = dir;
    }
  }

  // Backtrack to recover per-letter detail.
  const perLetter: (number | null)[] = letters.map(() => null);
  const recognized: (string | null)[] = letters.map(() => null);
  let i = N;
  let j = L;
  while (i > 0 && j > 0) {
    const dir = back[i][j];
    if (dir === 0) {
      const li = charIndex(letters[j - 1]);
      const sim = li >= 0 ? glyphSims[i - 1][li] : 0;
      perLetter[j - 1] = sim;
      recognized[j - 1] = bestLetterForGlyph(glyphSims[i - 1], letters[j - 1], sim);
      i--;
      j--;
    } else if (dir === 1) {
      i--;
    } else {
      j--;
    }
  }

  const normalizer = Math.max(N, L);
  const score = Math.max(0, 1 - cost[N][L] / normalizer);
  return { score, perLetter, recognized };
}

/** The literal letter the glyph looks most like (may differ from expected). */
export function bestLetterForGlyph(sims: number[], expected: string, expectedSim: number): string {
  let bestIdx = 0;
  for (let k = 1; k < 26; k++) if (sims[k] > sims[bestIdx]) bestIdx = k;
  const bestLetter = String.fromCharCode(65 + bestIdx);
  // Only accept the alternative when it is clearly a better visual match.
  if (bestLetter !== expected && sims[bestIdx] < expectedSim + 0.06) return expected;
  return bestLetter;
}

export interface RankedWord {
  word: string;
  score: number;
  confidence: number;
}

/** Maps an alignment score to a calibrated confidence, capped below 1.0. */
export function calibrate(score: number): number {
  if (score <= 0.5) return Math.max(0, score * 0.1);
  const v = 0.05 + ((score - 0.5) / 0.45) * 0.9;
  return Math.min(0.97, Math.max(0, v));
}

export function rankWords(
  glyphSims: number[][],
  candidates: string[],
  priorWords: Set<string>,
): RankedWord[] {
  const seen = new Set<string>();
  const ranked: RankedWord[] = [];
  for (const raw of candidates) {
    const word = raw.toUpperCase();
    if (seen.has(word)) continue;
    seen.add(word);
    const align = alignToWord(glyphSims, word);
    if (align.score <= 0) continue;
    // Words from the current lesson get a small, explicit prior boost.
    const bonus = priorWords.has(word) ? 0.04 : 0;
    const score = Math.min(1, align.score + bonus);
    ranked.push({ word, score, confidence: calibrate(score) });
  }
  ranked.sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  return ranked;
}

/** Levenshtein distance on plain letters (used for reporting only). */
export function letterDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j - 1] + cost, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  return dp[m][n];
}
