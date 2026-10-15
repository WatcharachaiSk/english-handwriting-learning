"use client";

/**
 * The paper. Pointer Events based, so mouse, trackpad, stylus and touch all
 * work; pressure thickens the stroke on supported pens.
 *
 * Strokes live in the parent (for undo/redo + recognition); this component
 * only paints them and reports committed gestures.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Stroke, StrokePoint } from "@/lib/types";

export type PenTool = "pen" | "eraser";

interface HandwritingCanvasProps {
  strokes: Stroke[];
  onCommit: (next: Stroke[]) => void;
  tool: PenTool;
  color: string;
  size: number;
  showGuides: boolean;
  disabled?: boolean;
  /** Fires once per committed gesture (used to trigger live prediction). */
  onGestureEnd?: (finalStrokes: Stroke[]) => void;
  /** Fires on the very first ink of the current word. */
  onFirstWrite?: () => void;
}

const PAPER = "#FAF7EE";
const RULE = "#DCE6F2";
const MARGIN = "#F1D9D9";
const GUIDE = "#BBD5F7";

function newStrokeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function tracePath(ctx: CanvasRenderingContext2D, points: StrokePoint[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) {
    ctx.lineTo(points[0].x + 0.01, points[0].y);
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function strokeAlpha(stroke: Stroke): number {
  const avg = stroke.points.reduce((n, p) => n + p.p, 0) / Math.max(1, stroke.points.length);
  return 0.82 + avg * 0.3; // firmer pressure → slightly bolder
}

export default function HandwritingCanvas({
  strokes,
  onCommit,
  tool,
  color,
  size,
  showGuides,
  disabled = false,
  onGestureEnd,
  onFirstWrite,
}: HandwritingCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayRef = useRef<Stroke[]>(strokes);
  const drawingRef = useRef<Stroke | null>(null);
  const eraseRef = useRef<{ remaining: Stroke[]; removed: boolean } | null>(null);
  const lastPointRef = useRef<StrokePoint | null>(null);
  const wroteOnceRef = useRef(false);
  const [hasInk, setHasInk] = useState(strokes.length > 0);

  displayRef.current = strokes;

  /** Full repaint: paper + guides + every committed stroke. */
  const render = useCallback(
    (list: Stroke[]) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);

      // Paper
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Notebook rules
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 1;
      const ruleGap = 44;
      for (let y = ruleGap; y < rect.height; y += ruleGap) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(rect.width, Math.round(y) + 0.5);
        ctx.stroke();
      }
      // Left margin, like a real notebook
      ctx.strokeStyle = MARGIN;
      ctx.beginPath();
      ctx.moveTo(40.5, 0);
      ctx.lineTo(40.5, rect.height);
      ctx.stroke();

      // Handwriting practice guides (top / dashed mid / baseline)
      if (showGuides) {
        const band = Math.min(150, Math.max(78, rect.height * 0.32));
        const baseline = rect.height / 2 + band / 2;
        const mid = baseline - band / 2;
        const top = baseline - band;
        ctx.strokeStyle = GUIDE;
        ctx.lineWidth = 1;
        for (const y of [top, baseline]) {
          ctx.beginPath();
          ctx.moveTo(56, Math.round(y) + 0.5);
          ctx.lineTo(rect.width - 24, Math.round(y) + 0.5);
          ctx.stroke();
        }
        ctx.setLineDash([7, 7]);
        ctx.beginPath();
        ctx.moveTo(56, Math.round(mid) + 0.5);
        ctx.lineTo(rect.width - 24, Math.round(mid) + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Ink
      for (const stroke of list) {
        if (stroke.points.length === 0) continue;
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = stroke.size;
        ctx.globalAlpha = strokeAlpha(stroke);
        if (stroke.points.length === 1) {
          ctx.beginPath();
          ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          tracePath(ctx, stroke.points);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
    [showGuides],
  );

  // Repaint on external changes (undo/redo/word change/guide toggle/resize).
  useEffect(() => {
    displayRef.current = strokes;
    setHasInk(strokes.length > 0);
    if (strokes.length === 0) wroteOnceRef.current = false;
    render(strokes);
  }, [strokes, render]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => render(displayRef.current));
    ro.observe(container);
    return () => ro.disconnect();
  }, [render]);

  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const pressure = e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: pressure,
      t: Date.now(),
    };
  };

  const hitStrokes = (point: StrokePoint, list: Stroke[]): Stroke[] => {
    const radius = Math.max(10, size * 2);
    return list.filter((s) =>
      s.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) <= radius + s.size / 2),
    );
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || e.button === 1 || e.button === 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const point = toPoint(e);

    if (tool === "eraser") {
      eraseRef.current = { remaining: displayRef.current.slice(), removed: false };
      const hits = hitStrokes(point, displayRef.current);
      if (hits.length) {
        const ids = new Set(hits.map((s) => s.id));
        eraseRef.current.remaining = displayRef.current.filter((s) => !ids.has(s.id));
        eraseRef.current.removed = true;
        displayRef.current = eraseRef.current.remaining;
        render(displayRef.current);
      }
      lastPointRef.current = point;
      return;
    }

    // Pen down: repaint so the new stroke lands on a clean frame.
    render(displayRef.current);
    if (!wroteOnceRef.current) {
      wroteOnceRef.current = true;
      onFirstWrite?.();
    }
    drawingRef.current = {
      id: newStrokeId(),
      tool: "pen",
      color,
      size,
      points: [point],
    };
    lastPointRef.current = point;
    // Draw the initial dot immediately.
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
      ctx.fillStyle = color;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = toPoint(e);

    if (eraseRef.current) {
      const hits = hitStrokes(point, displayRef.current);
      if (hits.length) {
        const ids = new Set(hits.map((s) => s.id));
        eraseRef.current.remaining = eraseRef.current.remaining.filter((s) => !ids.has(s.id));
        eraseRef.current.removed = true;
        displayRef.current = eraseRef.current.remaining;
        render(displayRef.current);
      }
      lastPointRef.current = point;
      return;
    }

    const live = drawingRef.current;
    if (!live) return;
    const prev = lastPointRef.current ?? live.points[live.points.length - 1];
    const dist = Math.hypot(point.x - prev.x, point.y - prev.y);
    if (dist < 0.8) return;
    live.points.push(point);
    lastPointRef.current = point;

    const rect = canvas.getBoundingClientRect();
    ctx.setTransform(canvas.width / rect.width, 0, 0, canvas.height / rect.height, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const finishGesture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }

    if (eraseRef.current) {
      const { remaining, removed } = eraseRef.current;
      eraseRef.current = null;
      if (removed) {
        onCommit(remaining);
        onGestureEnd?.(remaining);
      }
      return;
    }

    const live = drawingRef.current;
    if (!live) return;
    drawingRef.current = null;
    lastPointRef.current = null;
    if (live.points.length > 0) {
      setHasInk(true);
      const next = [...displayRef.current, live];
      onCommit(next);
      onGestureEnd?.(next);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative h-[340px] w-full overflow-hidden rounded-2xl border border-paper-edge bg-paper-cream shadow-card sm:h-[420px] lg:h-[470px]"
    >
      <canvas
        ref={canvasRef}
        data-testid="handwriting-canvas"
        className="block h-full w-full cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        aria-label="Handwriting area. Write the vocabulary word here."
        role="application"
      />
      {!hasInk && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-7">
          <p className="rounded-full bg-white/70 px-4 py-1.5 text-sm text-ink-faint">
            Write here with your mouse, finger or stylus
          </p>
        </div>
      )}
    </div>
  );
}
