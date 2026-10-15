"use client";

/**
 * Floating notebook toolbar: pen, eraser, size, colour, undo/redo, clear,
 * guides toggle — plus the primary Check / Next actions.
 * Keyboard: P = pen, E = eraser, Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo.
 */

import type { PenTool } from "@/components/HandwritingCanvas";

const COLORS = [
  { value: "#1F2933", label: "Ink" },
  { value: "#2563EB", label: "Blue" },
  { value: "#DC2626", label: "Red" },
];

interface WritingToolbarProps {
  tool: PenTool;
  onToolChange: (tool: PenTool) => void;
  size: number;
  onSizeChange: (size: number) => void;
  color: string;
  onColorChange: (color: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  showGuides: boolean;
  onToggleGuides: () => void;
  hasInk: boolean;
}

function ToolButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
  testId,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm font-medium transition
        ${active ? "bg-hint-soft text-hint ring-1 ring-hint/40" : "text-ink-soft hover:bg-black/5"}
        disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent`}
    >
      {children}
    </button>
  );
}

const iconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default function WritingToolbar({
  tool,
  onToolChange,
  size,
  onSizeChange,
  color,
  onColorChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  showGuides,
  onToggleGuides,
  hasInk,
}: WritingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-black/5 bg-white/95 p-1.5 shadow-toolbar backdrop-blur">
      <ToolButton active={tool === "pen"} onClick={() => onToolChange("pen")} title="Pen (P)" testId="tool-pen">
        <svg {...iconProps}>
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
        <span className="hidden md:inline">Pen</span>
      </ToolButton>

      <ToolButton active={tool === "eraser"} onClick={() => onToolChange("eraser")} title="Eraser (E)" testId="tool-eraser">
        <svg {...iconProps}>
          <path d="M7 21h13" />
          <path d="M11.5 21L20 12.5a2 2 0 000-2.83l-5.67-5.67a2 2 0 00-2.83 0L3 12.57a2 2 0 000 2.83l5.5 5.5" />
        </svg>
        <span className="hidden md:inline">Eraser</span>
      </ToolButton>

      <div className="mx-1 hidden h-6 w-px bg-black/10 sm:block" />

      <label className="hidden items-center gap-2 px-1.5 text-xs text-ink-faint sm:flex" title="Pen size">
        <input
          type="range"
          min={2}
          max={14}
          step={1}
          value={size}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="h-1 w-20 cursor-pointer accent-ink"
          aria-label="Pen size"
          data-testid="pen-size"
        />
        <span className="w-4 text-right tabular-nums">{size}</span>
      </label>

      <div className="flex items-center gap-1 px-1" role="group" aria-label="Pen colour">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            aria-label={`${c.label} ink`}
            aria-pressed={color === c.value}
            onClick={() => onColorChange(c.value)}
            className={`h-5 w-5 rounded-full transition ${
              color === c.value ? "ring-2 ring-offset-2 ring-hint" : "ring-1 ring-black/15"
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>

      <div className="mx-1 hidden h-6 w-px bg-black/10 sm:block" />

      <ToolButton disabled={!canUndo} onClick={onUndo} title="Undo (Ctrl/Cmd+Z)" testId="tool-undo">
        <svg {...iconProps}>
          <path d="M3 7v6h6" />
          <path d="M3.51 13a9 9 0 102.13-9.36L3 7" />
        </svg>
        <span className="hidden lg:inline">Undo</span>
      </ToolButton>
      <ToolButton disabled={!canRedo} onClick={onRedo} title="Redo (Ctrl/Cmd+Shift+Z)" testId="tool-redo">
        <svg {...iconProps}>
          <path d="M21 7v6h-6" />
          <path d="M20.49 13a9 9 0 11-2.12-9.36L21 7" />
        </svg>
        <span className="hidden lg:inline">Redo</span>
      </ToolButton>
      <ToolButton disabled={!hasInk} onClick={onClear} title="Clear page (Ctrl/Cmd+K)" testId="tool-clear">
        <svg {...iconProps}>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </svg>
        <span className="hidden lg:inline">Clear</span>
      </ToolButton>
      <ToolButton active={showGuides} onClick={onToggleGuides} title="Toggle guide lines">
        <svg {...iconProps}>
          <path d="M3 6h18M3 12h18M3 18h18" strokeDasharray="4 4" />
        </svg>
        <span className="hidden lg:inline">Guides</span>
      </ToolButton>
    </div>
  );
}
