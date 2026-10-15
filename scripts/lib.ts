/** Shared helpers for the browser scripts (e2e + recognizer diagnostics). */

import type { Page } from "puppeteer-core";

/** Unit-space polylines per letter (0..1, y down). Mouse-drawn, not font-rendered. */
export const LETTERS: Record<string, number[][][]> = {
  A: [
    [[0.02, 1], [0.5, 0], [0.98, 1]],
    [[0.2, 0.62], [0.8, 0.62]],
  ],
  P: [
    [[0.08, 0], [0.08, 1]],
    [[0.08, 0.02], [0.72, 0.02], [0.95, 0.27], [0.7, 0.52], [0.08, 0.52]],
  ],
  L: [[[0.12, 0], [0.12, 1], [0.9, 1]]],
  E: [
    [[0.9, 0], [0.12, 0], [0.12, 1], [0.9, 1]],
    [[0.12, 0.5], [0.68, 0.5]],
  ],
  T: [
    [[0.02, 0.04], [0.98, 0.04]],
    [[0.5, 0.04], [0.5, 1]],
  ],
  Z: [[[0.05, 0.05], [0.95, 0.05], [0.05, 1], [0.95, 1]]],
  R: [
    [[0.08, 0], [0.08, 1]],
    [[0.08, 0.02], [0.7, 0.02], [0.94, 0.26], [0.68, 0.5], [0.08, 0.5]],
    [[0.4, 0.5], [0.95, 1]],
  ],
  H: [
    [[0.08, 0], [0.08, 1]],
    [[0.92, 0], [0.92, 1]],
    [[0.08, 0.5], [0.92, 0.5]],
  ],
  G: [
    [[0.95, 0.2], [0.6, 0], [0.2, 0.1], [0.03, 0.5], [0.2, 0.9], [0.6, 1], [0.95, 0.8], [0.95, 0.55], [0.55, 0.55]],
  ],
  D: [
    [[0.1, 0], [0.1, 1]],
    [[0.1, 0], [0.6, 0], [0.95, 0.5], [0.6, 1], [0.1, 1]],
  ],
  O: [
    [[0.5, 0], [0.9, 0.25], [0.95, 0.6], [0.6, 1], [0.25, 0.95], [0.03, 0.55], [0.15, 0.18], [0.5, 0]],
  ],
  B: [
    [[0.1, 0], [0.1, 1]],
    [[0.1, 0], [0.6, 0], [0.85, 0.25], [0.6, 0.5], [0.1, 0.5]],
    [[0.1, 0.5], [0.65, 0.5], [0.9, 0.75], [0.65, 1], [0.1, 1]],
  ],
  C: [[[0.95, 0.2], [0.6, 0], [0.2, 0.12], [0.05, 0.5], [0.2, 0.88], [0.6, 1], [0.95, 0.8]]],
  N: [[[0.08, 1], [0.08, 0], [0.92, 1], [0.92, 0]]],
  F: [
    [[0.1, 1], [0.1, 0], [0.9, 0]],
    [[0.1, 0.5], [0.7, 0.5]],
  ],
  M: [[[0.05, 1], [0.05, 0], [0.5, 0.65], [0.95, 0], [0.95, 1]]],
  U: [[[0.08, 0], [0.08, 0.7], [0.3, 1], [0.7, 1], [0.92, 0.7], [0.92, 0]]],
  I: [[[0.5, 0], [0.5, 1]]],
  S: [[[0.95, 0.15], [0.6, 0], [0.2, 0.12], [0.15, 0.4], [0.5, 0.52], [0.85, 0.64], [0.8, 0.9], [0.4, 1], [0.05, 0.85]]],
  W: [[[0.02, 0], [0.25, 1], [0.5, 0.35], [0.75, 1], [0.98, 0]]],
  Y: [
    [[0.05, 0], [0.5, 0.55], [0.95, 0]],
    [[0.5, 0.55], [0.5, 1]],
  ],
  K: [
    [[0.1, 0], [0.1, 1]],
    [[0.9, 0], [0.1, 0.55], [0.95, 1]],
  ],
};

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export function makeChecker() {
  const results: Check[] = [];
  const check = (name: string, pass: boolean, detail = "") => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };
  return { results, check };
}

export async function inkCount(page: Page): Promise<number> {
  return page.$eval('[data-testid="handwriting-canvas"]', (el) => {
    const canvas = el as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < 160) n++;
    }
    return n;
  });
}

export async function writeWord(page: Page, word: string): Promise<void> {
  const handle = await page.$('[data-testid="handwriting-canvas"]');
  if (!handle) throw new Error("canvas not found");
  // Real users scroll the paper into view before writing; mouse events outside
  // the viewport would otherwise be dropped by the browser.
  await handle.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await new Promise((r) => setTimeout(r, 150));
  const box = await handle.boundingBox();
  if (!box) throw new Error("canvas has no box");

  const letterH = Math.min(170, box.height * 0.4);
  const letterW = letterH * 0.6;
  const gap = letterH * 0.2;
  const totalW = word.length * letterW + (word.length - 1) * gap;
  const startX = box.x + Math.max(50, (box.width - totalW) / 2);
  const baselineY = box.y + box.height * 0.62;

  for (let i = 0; i < word.length; i++) {
    const strokes = LETTERS[word[i]];
    if (!strokes) throw new Error(`no glyph for ${word[i]}`);
    const ox = startX + i * (letterW + gap);
    const oy = baselineY - letterH;
    for (const polyline of strokes) {
      const pts = polyline.map(([px, py]) => [ox + px * letterW, oy + py * letterH] as [number, number]);
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (let k = 1; k < pts.length; k++) {
        await page.mouse.move(pts[k][0], pts[k][1], { steps: 10 });
      }
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

export async function textOf(page: Page, sel: string): Promise<string> {
  const el = await page.$(sel);
  if (!el) return "";
  return (await el.evaluate((n) => n.textContent ?? "")).trim();
}

export async function waitText(page: Page, sel: string, timeout = 5000): Promise<string> {
  await page.waitForSelector(sel, { timeout });
  return textOf(page, sel);
}

/** Sweeps a horizontal and a vertical line so every stroke of a drawn letter is crossed. */
export async function dragErase(page: Page): Promise<void> {
  const handle = await page.$('[data-testid="handwriting-canvas"]');
  if (!handle) throw new Error("canvas not found");
  const box = await handle.boundingBox();
  if (!box) throw new Error("canvas has no box");

  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + 5, y);
  await page.mouse.down();
  for (let x = 5; x < box.width - 5; x += 12) {
    await page.mouse.move(box.x + x, y, { steps: 1 });
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 80));

  const x = box.x + box.width * 0.5;
  await page.mouse.move(x, box.y + 5);
  await page.mouse.down();
  for (let yy = 5; yy < box.height - 5; yy += 12) {
    await page.mouse.move(x, box.y + yy, { steps: 1 });
  }
  await page.mouse.up();
}
