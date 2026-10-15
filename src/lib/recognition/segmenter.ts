/**
 * Groups raw pen strokes into individual written glyphs (letters).
 *
 * Strategy: strokes that horizontally overlap (or nearly touch) belong to the
 * same glyph — this naturally joins the dot of an "i", the crossbar of a "t",
 * the two strokes of an "x" or a "k" — while keeping neighbouring letters apart.
 */

import type { Stroke } from "@/lib/types";
import {
  bboxHeight,
  bboxOf,
  bboxWidth,
  emptyBBox,
  extendBBox,
  type BBox,
} from "./geometry";

export interface SegmentedGlyph {
  strokes: Stroke[];
  box: BBox;
}

interface StrokeBox {
  stroke: Stroke;
  box: BBox;
}

function horizontalGap(a: BBox, b: BBox): number {
  if (a.maxX < b.minX) return b.minX - a.maxX;
  if (b.maxX < a.minX) return a.minX - b.maxX;
  return 0;
}

function horizontalOverlap(a: BBox, b: BBox): number {
  const left = Math.max(a.minX, b.minX);
  const right = Math.min(a.maxX, b.maxX);
  return Math.max(0, right - left);
}

/** Filters pin-pricks and stray dots produced by accidental taps. */
function isNoise(sb: StrokeBox, medianHeight: number): boolean {
  const w = bboxWidth(sb.box);
  const h = bboxHeight(sb.box);
  if (sb.stroke.points.length < 2 && Math.max(w, h) < 3) return true;
  return Math.max(w, h) < Math.max(2.5, medianHeight * 0.06);
}

export function segmentStrokes(strokes: Stroke[]): SegmentedGlyph[] {
  const penStrokes = strokes.filter((s) => s.tool === "pen" && s.points.length > 0);
  if (penStrokes.length === 0) return [];

  const boxes: StrokeBox[] = penStrokes.map((stroke) => ({ stroke, box: bboxOf([stroke]) }));

  // Median stroke height is the scale reference for "small" and "touching".
  const heights = boxes.map((b) => bboxHeight(b.box)).sort((a, a2) => a - a2);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 20;

  const kept = boxes.filter((b) => !isNoise(b, medianHeight));
  const usable = kept.length > 0 ? kept : boxes;

  // Union-find over horizontal adjacency.
  const parent = usable.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number) => {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[rj] = ri;
  };

  const touchGap = Math.max(3, medianHeight * 0.12);
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const a = usable[i].box;
      const b = usable[j].box;
      const overlap = horizontalOverlap(a, b);
      const minW = Math.max(1, Math.min(bboxWidth(a), bboxWidth(b)));
      const near = horizontalGap(a, b) <= touchGap;
      if (overlap >= minW * 0.2 || near) union(i, j);
    }
  }

  const groups = new Map<number, StrokeBox[]>();
  usable.forEach((sb, i) => {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(sb);
    groups.set(root, list);
  });

  const glyphs: SegmentedGlyph[] = [];
  for (const list of groups.values()) {
    let box = emptyBBox();
    for (const sb of list) {
      box = extendBBox(box, sb.box.minX, sb.box.minY);
      box = extendBBox(box, sb.box.maxX, sb.box.maxY);
    }
    glyphs.push({ strokes: list.map((s) => s.stroke), box });
  }

  // Reading order: left to right.
  glyphs.sort((a, b) => a.box.minX - b.box.minX);
  return glyphs;
}

/** Global writing band (used for baseline / vertical-position features). */
export function writingBand(glyphs: SegmentedGlyph[]): BBox {
  let box = emptyBBox();
  for (const g of glyphs) {
    box = extendBBox(box, g.box.minX, g.box.minY);
    box = extendBBox(box, g.box.maxX, g.box.maxY);
  }
  return box;
}

/**
 * Classifies where a glyph sits relative to the writing band:
 * - "mid": x-height zone (a, c, e, m, n, o ...)
 * - "above": cap / ascender zone (A, B, T, h, l ...)
 * - "below": descender zone (g, p, y ...)
 */
export function verticalPositionOf(glyphBox: BBox, band: BBox): "above" | "mid" | "below" {
  const bandH = Math.max(1, bboxHeight(band));
  const centerY = (glyphBox.minY + glyphBox.maxY) / 2;
  const rel = (centerY - band.minY) / bandH; // 0 = top of writing, 1 = bottom
  if (rel > 0.78) return "below";
  if (rel < 0.42) return "above";
  return "mid";
}
