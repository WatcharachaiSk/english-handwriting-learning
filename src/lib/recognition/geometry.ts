/**
 * Pure geometry helpers for turning raw pen strokes into normalized ink grids.
 * No DOM APIs are used here so the pipeline can run (and be unit tested)
 * anywhere.
 */

import type { Stroke, StrokePoint } from "@/lib/types";

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Normalized ink-grid resolution (GRID x GRID cells). */
export const GRID = 16;

export function emptyBBox(): BBox {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function isEmptyBBox(b: BBox): boolean {
  return b.minX > b.maxX || b.minY > b.maxY;
}

export function bboxWidth(b: BBox): number {
  return Math.max(0, b.maxX - b.minX);
}

export function bboxHeight(b: BBox): number {
  return Math.max(0, b.maxY - b.minY);
}

export function extendBBox(b: BBox, x: number, y: number): BBox {
  return {
    minX: Math.min(b.minX, x),
    minY: Math.min(b.minY, y),
    maxX: Math.max(b.maxX, x),
    maxY: Math.max(b.maxY, y),
  };
}

export function bboxOf(strokes: Stroke[]): BBox {
  let box = emptyBBox();
  for (const s of strokes) {
    for (const p of s.points) box = extendBBox(box, p.x, p.y);
  }
  return box;
}

export function unionBBox(a: BBox, b: BBox): BBox {
  if (isEmptyBBox(a)) return b;
  if (isEmptyBBox(b)) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** A point-to-point polyline is resampled so ink is continuous, not dotted. */
function interpolate(a: StrokePoint, b: StrokePoint, out: StrokePoint[]): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const step = 1.2;
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({
      x: a.x + dx * t,
      y: a.y + dy * t,
      p: a.p + (b.p - a.p) * t,
      t: a.t + (b.t - a.t) * t,
    });
  }
}

export function strokeSamples(stroke: Stroke): StrokePoint[] {
  const pts = stroke.points;
  if (pts.length === 0) return [];
  const out: StrokePoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) interpolate(pts[i - 1], pts[i], out);
  return out;
}

export interface RasterizedGlyph {
  /** GRID*GRID values in [0,1]. */
  grid: number[];
  /** bbox width / height (0 when degenerate). */
  aspect: number;
  widthPx: number;
  heightPx: number;
}

/**
 * Rasterizes a set of strokes into a normalized GRID x GRID ink map using the
 * glyph's own bounding box — so size and position on the page do not matter.
 */
export function rasterizeGlyph(strokes: Stroke[], box: BBox, grid = GRID): RasterizedGlyph {
  const w = Math.max(1, bboxWidth(box));
  const h = Math.max(1, bboxHeight(box));
  const cells = new Float32Array(grid * grid);

  for (const stroke of strokes) {
    for (const p of strokeSamples(stroke)) {
      const gx = ((p.x - box.minX) / w) * grid;
      const gy = ((p.y - box.minY) / h) * grid;
      const cx = Math.min(grid - 1, Math.max(0, Math.floor(gx)));
      const cy = Math.min(grid - 1, Math.max(0, Math.floor(gy)));
      const idx = cy * grid + cx;
      cells[idx] = Math.min(1, cells[idx] + 0.5 + p.p * 0.5);
      // Soft spread: a fat pen still only fills its neighbourhood once.
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= grid || ny >= grid) continue;
          const nIdx = ny * grid + nx;
          cells[nIdx] = Math.max(cells[nIdx], 0.45);
        }
      }
    }
  }

  let max = 0;
  for (let i = 0; i < cells.length; i++) max = Math.max(max, cells[i]);
  const gridArr = new Array<number>(cells.length);
  for (let i = 0; i < cells.length; i++) gridArr[i] = max > 0 ? cells[i] / max : 0;

  return {
    grid: gridArr,
    aspect: w / h,
    widthPx: w,
    heightPx: h,
  };
}

/** Ink coverage in [0,1] — used to reject accidental dots/scratches. */
export function inkRatio(grid: number[], threshold = 0.35): number {
  let n = 0;
  for (const v of grid) if (v >= threshold) n++;
  return n / grid.length;
}
