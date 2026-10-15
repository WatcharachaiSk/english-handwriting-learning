/**
 * Letter templates used by the on-device template matcher.
 *
 * In the browser templates are built by rasterizing each letter (upper- and
 * lowercase) with a handwriting-style font into a normalized ink grid, so the
 * comparison is image-vs-image (ink shape), never text-vs-text.
 *
 * The store is behind an interface so a TensorFlow.js model or a backend
 * classifier can replace it without touching the UI.
 */

import { GRID } from "./geometry";

export interface LetterTemplate {
  /** GRID*GRID values in [0,1] ink coverage. */
  grid: number[];
  /** ink bbox width / height. */
  aspect: number;
  /**
   * Vertical centre of the glyph relative to its own height, measured from the
   * baseline (negative = above baseline). Used as a weak prior only.
   */
  centerY: number;
  /** Which case this variant was rendered from ("A" | "a"). */
  case: "upper" | "lower";
}

export interface TemplateStore {
  readonly ready: boolean;
  readonly source: string;
  /** Variants available for an uppercase letter, e.g. "A" -> [A, a]. */
  variants(letter: string): LetterTemplate[];
}

const FONT_STACK =
  "'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', 'Segoe Print', 'Bradley Hand', 'Bradley Hand ITC', cursive, sans-serif";

const ALPHA_THRESHOLD = 60;

interface RenderedGlyph {
  grid: number[];
  aspect: number;
  centerY: number;
}

function renderGlyph(ch: string): RenderedGlyph | null {
  if (typeof document === "undefined") return null;
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.font = `700 84px ${FONT_STACK}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#000000";
  const originX = 40;
  const baseline = 96;
  ctx.fillText(ch, originX, baseline);

  const { data } = ctx.getImageData(0, 0, S, S);
  let minX = S;
  let minY = S;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const a = data[(y * S + x) * 4 + 3];
      if (a >= ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  // Max-pool the alpha channel into GRID x GRID, then soften with the same
  // neighbourhood spread that user strokes get in rasterizeGlyph().
  const raw = new Float32Array(GRID * GRID);
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x0 = minX + Math.floor((gx * bw) / GRID);
      const x1 = minX + Math.floor(((gx + 1) * bw) / GRID);
      const y0 = minY + Math.floor((gy * bh) / GRID);
      const y1 = minY + Math.floor(((gy + 1) * bh) / GRID);
      let best = 0;
      for (let y = y0; y <= Math.max(y0, y1 - 1); y++) {
        for (let x = x0; x <= Math.max(x0, x1 - 1); x++) {
          const a = data[(y * S + x) * 4 + 3];
          if (a > best) best = a;
        }
      }
      raw[gy * GRID + gx] = best / 255;
    }
  }

  const grid = new Array<number>(GRID * GRID);
  for (let i = 0; i < raw.length; i++) {
    let v = raw[i];
    if (v >= 0.5) v = 1;
    else if (v >= 0.2) v = Math.max(v, 0.45);
    grid[i] = v;
  }

  const centerPx = (minY + maxY + 1) / 2;
  return {
    grid,
    aspect: bw / bh,
    centerY: (centerPx - baseline) / bh,
  };
}

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";

class CanvasTemplateStore implements TemplateStore {
  readonly source = `rasterized glyphs (${FONT_STACK.split(",")[0]} …)`;
  private cache = new Map<string, LetterTemplate[]>();
  private built = false;

  get ready(): boolean {
    return this.built;
  }

  build(): void {
    if (this.built || typeof document === "undefined") return;
    for (let i = 0; i < 26; i++) {
      const variants: LetterTemplate[] = [];
      const up = renderGlyph(UPPER[i]);
      if (up) variants.push({ ...up, case: "upper" });
      const lo = renderGlyph(LOWER[i]);
      if (lo) variants.push({ ...lo, case: "lower" });
      this.cache.set(UPPER[i], variants);
    }
    this.built = this.cache.size === 26;
  }

  variants(letter: string): LetterTemplate[] {
    if (!this.built) this.build();
    return this.cache.get(letter.toUpperCase()) ?? [];
  }
}

/**
 * Manual store for non-DOM environments (unit tests, SSR). Templates are
 * supplied by the caller using the same shape the canvas renderer produces.
 */
export class StaticTemplateStore implements TemplateStore {
  readonly source = "static templates";
  readonly ready = true;
  constructor(private map: Record<string, LetterTemplate[]>) {}
  variants(letter: string): LetterTemplate[] {
    return this.map[letter.toUpperCase()] ?? [];
  }
}

let browserStore: TemplateStore | null = null;

export function getTemplateStore(): TemplateStore {
  if (!browserStore) browserStore = new CanvasTemplateStore();
  return browserStore;
}
