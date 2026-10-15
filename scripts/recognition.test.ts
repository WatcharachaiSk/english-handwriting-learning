/**
 * Unit tests for the DOM-free parts of the recognition pipeline.
 * Run with: npm run test:recognition
 *
 * Covers: stroke segmentation, ink similarity, DP word alignment,
 * confidence calibration and the spelling-check/feedback rules.
 * Letter classification itself needs a DOM (templates are rasterized from a
 * font) and is covered by scripts/e2e.ts + scripts/diagnose.ts in Chrome.
 */

import type { Stroke, StrokePoint } from "@/lib/types";
import { checkWriting, CORRECT_THRESHOLD } from "@/lib/recognition/check";
import { inkF1, aspectSimilarity, alignToWord, calibrate, rankWords, letterDistance } from "@/lib/recognition/scoring";
import { segmentStrokes } from "@/lib/recognition/segmenter";
import { rasterizeGlyph, GRID } from "@/lib/recognition/geometry";

let passed = 0;
const failures: string[] = [];

function expect(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function stroke(points: [number, number][], tool: Stroke["tool"] = "pen"): Stroke {
  const pts: StrokePoint[] = points.map(([x, y], i) => ({ x, y, p: 0.5, t: i * 16 }));
  return { id: `s${Math.random().toString(36).slice(2)}`, tool, color: "#000", size: 5, points: pts };
}

function boxStroke(x0: number, y0: number, x1: number, y1: number): Stroke {
  // Rectangle-ish scribble that spans (x0..x1, y0..y1).
  return stroke([
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ]);
}

// ---------- segmentation -----------------------------------------------------
{
  const far = segmentStrokes([boxStroke(0, 0, 40, 60), boxStroke(120, 0, 160, 60)]);
  expect("separates letters that are far apart", far.length === 2, `got ${far.length}`);

  const overlapping = segmentStrokes([boxStroke(0, 0, 50, 60), boxStroke(45, 0, 90, 60)]);
  expect("merges horizontally overlapping strokes (i-dot, t-bar)", overlapping.length === 1, `got ${overlapping.length}`);

  const stacked = segmentStrokes([boxStroke(0, 0, 40, 60), boxStroke(0, 58, 40, 120)]);
  expect("merges vertically stacked strokes of one letter", stacked.length === 1, `got ${stacked.length}`);

  const ordered = segmentStrokes([boxStroke(300, 0, 340, 60), boxStroke(0, 0, 40, 60)]);
  expect("orders glyphs left to right", ordered[0].box.minX < ordered[1].box.minX);

  const noise = segmentStrokes([boxStroke(0, 0, 40, 60), stroke([[500, 300], [500.5, 300.5]])]);
  expect("drops pin-prick noise", noise.length === 1, `got ${noise.length}`);

  const eraserOnly = segmentStrokes([boxStroke(0, 0, 40, 60), stroke([[10, 10], [30, 30]], "eraser")]);
  expect("ignores eraser strokes", eraserOnly.length === 1, `got ${eraserOnly.length}`);
}

// ---------- rasterization ----------------------------------------------------
{
  const g = rasterizeGlyph([boxStroke(0, 0, 40, 60)], { minX: 0, minY: 0, maxX: 40, maxY: 60 });
  expect("grid has GRID*GRID cells", g.grid.length === GRID * GRID, `${g.grid.length}`);
  expect("grid values normalized to [0,1]", g.grid.every((v) => v >= 0 && v <= 1));
  expect("aspect = width/height", Math.abs(g.aspect - 40 / 60) < 1e-6, `${g.aspect}`);
  expect("box stroke fills the border cells", g.grid[0] > 0.3 && g.grid[GRID - 1] > 0.3);
}

// ---------- similarity -------------------------------------------------------
{
  const a = rasterizeGlyph([boxStroke(0, 0, 40, 60)], { minX: 0, minY: 0, maxX: 40, maxY: 60 }).grid;
  const b = rasterizeGlyph([boxStroke(0, 0, 40, 60)], { minX: 0, minY: 0, maxX: 40, maxY: 60 }).grid;
  expect("identical shapes score ~1", inkF1(a, b) > 0.95, `${inkF1(a, b).toFixed(3)}`);

  const line = rasterizeGlyph([stroke([[0, 0], [60, 0]])], { minX: 0, minY: 0, maxX: 60, maxY: 60 }).grid;
  expect("very different shapes score low", inkF1(a, line) < 0.6, `${inkF1(a, line).toFixed(3)}`);

  expect("matching aspects score 1", aspectSimilarity(0.8, 0.8) === 1);
  expect("6x aspect distance scores 0", aspectSimilarity(1, Math.E ** Math.log(6)) < 0.05 || aspectSimilarity(1, 6) < 0.05);
}

// ---------- DP alignment -----------------------------------------------------
{
  const high = (c: string) => {
    const sims = new Array<number>(26).fill(0.05);
    sims[c.charCodeAt(0) - 65] = 0.92;
    return sims;
  };
  const good = "APPLE".split("").map(high);
  const res = alignToWord(good, "APPLE");
  expect("perfect glyphs align perfectly", res.score >= 0.9, `${res.score.toFixed(3)}`);
  expect("recognized letters match", res.recognized.join("") === "APPLE", JSON.stringify(res.recognized));

  const wrong = "ZZZZZ".split("").map(high);
  const res2 = alignToWord(wrong, "APPLE");
  expect("wrong glyphs score low", res2.score < CORRECT_THRESHOLD, `${res2.score.toFixed(3)}`);

  const missing = "APPL".split("").map(high); // 4 glyphs, 5-letter word
  const res3 = alignToWord(missing, "APPLE");
  expect("missing letter is penalised", res3.score < 0.9 && res3.score > 0.4, `${res3.score.toFixed(3)}`);
  expect("missing letter reported as null", res3.perLetter.some((p) => p === null), JSON.stringify(res3.perLetter));

  expect("empty glyph set scores 0", alignToWord([], "APPLE").score === 0);
}

// ---------- calibration + ranking -------------------------------------------
{
  expect("calibrate never reports 100%", calibrate(1) < 1 && calibrate(1) <= 0.97, `${calibrate(1)}`);
  expect("calibrate is monotonic", calibrate(0.9) > calibrate(0.7) && calibrate(0.7) > calibrate(0.55));
  expect("calibrate floors at 0-ish", calibrate(0) >= 0 && calibrate(0.3) < 0.1);

  const high2 = (c: string) => {
    const sims = new Array<number>(26).fill(0.02);
    sims[c.charCodeAt(0) - 65] = 0.9;
    return sims;
  };
  const appleGlyphs = "APPLE".split("").map(high2);
  const ranked = rankWords(appleGlyphs, ["APPLE", "APPLY", "BANANA"], new Set());
  expect("dictionary decoding finds the written word", ranked[0]?.word === "APPLE", JSON.stringify(ranked.slice(0, 3)));
  expect("top candidate carries confidence < 1", ranked[0].confidence < 1 && ranked[0].confidence > 0.5, `${ranked[0].confidence}`);

  const rankedPlain = rankWords(appleGlyphs, ["APPLE", "APPLY"], new Set());
  const rankedPrior = rankWords(appleGlyphs, ["APPLE", "APPLY"], new Set(["APPLY"]));
  const applyPlain = rankedPlain.find((r) => r.word === "APPLY")!.score;
  const applyPrior = rankedPrior.find((r) => r.word === "APPLY")!.score;
  expect("lesson prior boosts its words", applyPrior > applyPlain, `${applyPlain} → ${applyPrior}`);
  expect("prior never overrides clearly better handwriting", rankedPrior[0].word === "APPLE", JSON.stringify(rankedPrior));
}

// ---------- spelling check + feedback ----------------------------------------
{
  const perfect = {
    predictions: [{ word: "APPLE", confidence: 0.9, letters: [] }],
    confidence: 0.9,
    status: "ok" as const,
    glyphSims: "APPLE".split("").map((c) => {
      const s = new Array<number>(26).fill(0.05);
      s[c.charCodeAt(0) - 65] = 0.9;
      return s;
    }),
  };
  const fb = checkWriting("APPLE", perfect);
  expect("correct answer feedback", fb.tone === "correct" && fb.check.correct, `${fb.tone}: ${fb.title}`);
  expect("spelling accuracy 100% when all letters read", fb.check.spellingAccuracy === 1, `${fb.check.spellingAccuracy}`);
  expect("feedback title matches spec copy", fb.title.includes("Correct! Great job!"), fb.title);

  const wrong = {
    predictions: [{ word: "ZZZZZ", confidence: 0.8, letters: [] }],
    confidence: 0.8,
    status: "ok" as const,
    glyphSims: "ZZZZZ".split("").map((c) => {
      const s = new Array<number>(26).fill(0.05);
      s[c.charCodeAt(0) - 65] = 0.9;
      return s;
    }),
  };
  const fb2 = checkWriting("APPLE", wrong);
  expect("wrong answer not correct", !fb2.check.correct, fb2.title);
  expect("wrong answer accuracy is 0", fb2.check.spellingAccuracy === 0, `${fb2.check.spellingAccuracy}`);

  const empty = checkWriting("APPLE", { predictions: [], confidence: 0, status: "low_signal" });
  expect("no-ink gives guidance instead of a score", empty.tone === "unclear" && !empty.check.correct, empty.title);

  const partial = {
    predictions: [{ word: "APLPL", confidence: 0.7, letters: [] }],
    confidence: 0.7,
    status: "ok" as const,
    glyphSims: "APPLF".split("").map((c) => {
      const s = new Array<number>(26).fill(0.05);
      s[c.charCodeAt(0) - 65] = 0.85;
      return s;
    }),
  };
  const fb3 = checkWriting("APPLE", partial);
  expect("one clearly-wrong letter is not 'correct'", !fb3.check.correct, `${fb3.tone}: ${fb3.title}`);
  expect("one bad letter reads as 'Almost there'", fb3.tone === "almost" || fb3.tone === "unclear", fb3.title);
  expect("accuracy reflects the bad letter", fb3.check.spellingAccuracy === 0.8, `${fb3.check.spellingAccuracy}`);

  const missingFinal = {
    predictions: [{ word: "APPL", confidence: 0.8, letters: [] }],
    confidence: 0.8,
    status: "ok" as const,
    glyphSims: "APPL".split("").map((c) => {
      const s = new Array<number>(26).fill(0.05);
      s[c.charCodeAt(0) - 65] = 0.9;
      return s;
    }),
  };
  const fb4 = checkWriting("APPLE", missingFinal);
  expect("missing final letter is not 'correct'", !fb4.check.correct, `${fb4.tone}: ${fb4.title}`);
}

expect("letter distance sanity", letterDistance("APPLE", "APPLY") === 1 && letterDistance("APPLE", "APPLE") === 0);

console.log(`\n${passed}/${passed + failures.length} unit checks passed`);
if (failures.length) {
  console.log("Failed:\n" + failures.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
