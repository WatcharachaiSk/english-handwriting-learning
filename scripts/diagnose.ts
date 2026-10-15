/** Diagnostic: draw a word and dump what the recognizer sees.
 *
 *   npx tsx scripts/diagnose.ts APPLE          # on /dev (dedicated diagnostics page)
 *   npx tsx scripts/diagnose.ts APPLE --home   # on the real learning screen
 */

import puppeteer from "puppeteer-core";
import { writeWord } from "./lib";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = process.env.APP_URL ?? "http://localhost:3100";
const WORD = (process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "APPLE");
const HOME = process.argv.includes("--home");

interface GlyphDump {
  box: { minX: number; minY: number; maxX: number; maxY: number };
  strokes: unknown[];
}

interface DebugHook {
  strokes: unknown[];
  store: unknown;
  segmentStrokes: (s: unknown[]) => GlyphDump[];
  rasterizeGlyph: (strokes: unknown[], box: GlyphDump["box"]) => { grid: number[]; aspect: number };
  letterSimilarities: (feat: { grid: number[]; aspect: number }, store: unknown) => number[];
  analyze: () => {
    status: string;
    confidence: number;
    predictions: { word: string; confidence: number }[];
    message?: string;
  };
}

function topLetters(sims: number[], n = 5): string {
  return sims
    .map((s, i) => ({ letter: String.fromCharCode(65 + i), s }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((t) => `${t.letter}${t.s.toFixed(2)}`)
    .join(" ");
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--lang=en-US"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1360, height: 1000 });
  page.on("pageerror", (e) => console.error("pageerror:", String(e)));

  if (HOME) {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("ws:debug", "1"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="handwriting-canvas"]');
  } else {
    await page.goto(`${BASE_URL}/dev`, { waitUntil: "networkidle0" });
  }
  await new Promise((r) => setTimeout(r, 700)); // let templates build

  await writeWord(page, WORD);
  await new Promise((r) => setTimeout(r, 700));

  const ink = await page
    .$eval('[data-testid="handwriting-canvas"]', (el) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let n = 0;
      for (let i = 0; i < data.length; i += 16) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < 160) n++;
      }
      return n;
    })
    .catch(() => -1);
  console.log(`== ${WORD} ${HOME ? "(home screen)" : "(dev page)"} ==`);
  console.log(`ink px ≈ ${ink}`);

  if (HOME) {
    const dump = await page.evaluate(() => {
      const hook = (window as unknown as { __wsDebug?: DebugHook }).__wsDebug;
      if (!hook) return { error: "no debug hook" };
      const pen = hook.strokes.filter((s) => {
        const t = s as { tool: string; points: unknown[] };
        return t.tool === "pen" && t.points.length > 1;
      });
      const glyphs = hook.segmentStrokes(pen);
      const rows = glyphs.map((g) => {
        const feat = hook.rasterizeGlyph(g.strokes, g.box);
        const sims = hook.letterSimilarities(feat, hook.store);
        return `box ${Math.round(g.box.maxX - g.box.minX)}×${Math.round(g.box.maxY - g.box.minY)} aspect ${feat.aspect.toFixed(2)} → ${topLettersLocal(sims)}`;
      });
      const res = hook.analyze();
      const t0 = performance.now();
      hook.analyze();
      const ms = performance.now() - t0;
      return {
        rows,
        ms,
        status: `${res.status} ${(res.confidence * 100).toFixed(0)}% ${res.message ?? ""}`,
        preds: res.predictions.map((p) => `${p.word} ${(p.confidence * 100).toFixed(0)}%`).join(" | "),
      };

      function topLettersLocal(sims: number[]): string {
        return sims
          .map((s, i) => ({ letter: String.fromCharCode(65 + i), s }))
          .sort((a, b) => b.s - a.s)
          .slice(0, 5)
          .map((t) => `${t.letter}${t.s.toFixed(2)}`)
          .join(" ");
      }
    });

    if ("error" in dump) console.log(dump.error);
    else {
      dump.rows.forEach((r, i) => console.log(`glyph ${i}: ${r}`));
      console.log(`status: ${dump.status} · predictions: ${dump.preds} · analyze ${dump.ms.toFixed(1)}ms`);
    }
    await browser.close();
    return;
  }

  const dump = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("main section > div > div")).map((el) =>
      (el.textContent ?? "").trim(),
    );
    const h2 = document.querySelector("main h2")?.textContent ?? "";
    const pre = document.querySelector("main pre")?.textContent ?? "";
    return { h2, rows, pre };
  });

  console.log(dump.h2);
  dump.rows.forEach((r, i) => console.log(`glyph ${i}: ${r}`));
  console.log(`alignment vs ${WORD}:`);
  try {
    const parsed = JSON.parse(dump.pre) as {
      score: number;
      perLetter: (number | null)[];
      recognized: (string | null)[];
    };
    console.log("  score:", parsed.score.toFixed(3));
    console.log(
      "  perLetter:",
      JSON.stringify(parsed.perLetter.map((n) => (n === null ? null : Number(n.toFixed(3))))),
    );
    console.log("  recognized:", JSON.stringify(parsed.recognized));
  } catch {
    console.log(dump.pre.slice(0, 500));
  }

  void topLetters;
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
