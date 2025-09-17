import React, { useMemo, useState } from "react";

/**
 * Ultra-Simple 3-Team Trade Visualizer
 * --------------------------------------------------------------
 * - Edit team names (A, B, C)
 * - Six text boxes: A→B, A→C, B→A, B→C, C→A, C→B
 * - Simple triangle diagram with arrows only when text is present
 * - Text summary below
 * - No extra dependencies besides React
 */

type TeamKey = "A" | "B" | "C";

export default function ThreeTeamTradeVisualizer() {
  const [names, setNames] = useState<Record<TeamKey, string>>({
    A: "Team A",
    B: "Team B",
    C: "Team C",
  });

  const [m, setM] = useState({
    AB: "",
    AC: "",
    BA: "",
    BC: "",
    CA: "",
    CB: "",
  });

  const set = (k: keyof typeof m, v: string) =>
    setM((s) => ({ ...s, [k]: v }));

  const summary = useMemo(() => {
    const out: string[] = [];
    if (m.AB.trim()) out.push(`${names.A} → ${names.B}: ${m.AB.trim()}`);
    if (m.AC.trim()) out.push(`${names.A} → ${names.C}: ${m.AC.trim()}`);
    if (m.BA.trim()) out.push(`${names.B} → ${names.A}: ${m.BA.trim()}`);
    if (m.BC.trim()) out.push(`${names.B} → ${names.C}: ${m.BC.trim()}`);
    if (m.CA.trim()) out.push(`${names.C} → ${names.A}: ${m.CA.trim()}`);
    if (m.CB.trim()) out.push(`${names.C} → ${names.B}: ${m.CB.trim()}`);
    return out.join("\n") || "(No trades yet)";
  }, [m, names]);

  // Triangle anchors
  const W = 720,
    H = 420;
  const anchors = {
    A: { x: 110, y: 110 },
    B: { x: W - 110, y: 110 },
    C: { x: W / 2, y: H - 110 },
  } as const;

  function arrow(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = to.x - from.x,
      dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len,
      uy = dy / len;
    const endX = to.x - ux * 12,
      endY = to.y - uy * 12; // leave room for arrowhead
    return `M ${from.x} ${from.y} L ${endX} ${endY}`;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-4 text-2xl font-semibold">3-Team Trade (Simple)</h1>

      {/* Team name inputs */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(Object.keys(names) as TeamKey[]).map((k) => (
          <input
            key={k}
            value={names[k]}
            onChange={(e) =>
              setNames((s) => ({ ...s, [k]: e.target.value }))
            }
            className="rounded-lg border px-3 py-2 text-sm"
          />
        ))}
      </div>

      {/* Trade text boxes */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Box label={`${names.A} → ${names.B}`} value={m.AB} onChange={(v) => set("AB", v)} />
        <Box label={`${names.A} → ${names.C}`} value={m.AC} onChange={(v) => set("AC", v)} />
        <Box label={`${names.B} → ${names.A}`} value={m.BA} onChange={(v) => set("BA", v)} />
        <Box label={`${names.B} → ${names.C}`} value={m.BC} onChange={(v) => set("BC", v)} />
        <Box label={`${names.C} → ${names.A}`} value={m.CA} onChange={(v) => set("CA", v)} />
        <Box label={`${names.C} → ${names.B}`} value={m.CB} onChange={(v) => set("CB", v)} />
      </div>

      {/* Diagram */}
      <div className="overflow-auto rounded-2xl border bg-background p-3">
        <svg width={W} height={H} className="block w-full">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <polygon points="0 0, 8 4, 0 8" fill="currentColor" />
            </marker>
            <style>{`.node{font:13px sans-serif;}`}</style>
          </defs>

          {/* Team nodes */}
          {(Object.keys(anchors) as TeamKey[]).map((k) => (
            <g key={k}>
              <circle cx={anchors[k].x} cy={anchors[k].y} r={12} fill="black" />
              <text
                className="node"
                x={anchors[k].x + 16}
                y={anchors[k].y + 4}
                fill="#111"
              >
                {names[k]}
              </text>
            </g>
          ))}

          {/* Arrows if box filled */}
          {m.AB.trim() && (
            <ArrowLine from={anchors.A} to={anchors.B} label={m.AB} />
          )}
          {m.AC.trim() && (
            <ArrowLine from={anchors.A} to={anchors.C} label={m.AC} />
          )}
          {m.BA.trim() && (
            <ArrowLine from={anchors.B} to={anchors.A} label={m.BA} />
          )}
          {m.BC.trim() && (
            <ArrowLine from={anchors.B} to={anchors.C} label={m.BC} />
          )}
          {m.CA.trim() && (
            <ArrowLine from={anchors.C} to={anchors.A} label={m.CA} />
          )}
          {m.CB.trim() && (
            <ArrowLine from={anchors.C} to={anchors.B} label={m.CB} />
          )}
        </svg>
      </div>

      {/* Summary */}
      <div className="mt-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
          Text summary
        </div>
        <pre className="whitespace-pre-wrap rounded-xl border p-3 text-sm leading-5">
          {summary}
        </pre>
      </div>
    </div>
  );
}

function Box({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-1 text-xs opacity-70">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Player X, 2026 1st, FAAB $50"
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  );
}

function ArrowLine({
  from,
  to,
  label,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  label: string;
}) {
  const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  return (
    <g>
      <path
        d={path}
        stroke="#111"
        strokeWidth={3}
        fill="none"
        markerEnd="url(#arrow)"
      />
      <text
        x={(from.x + to.x) / 2}
        y={(from.y + to.y) / 2 - 8}
        textAnchor="middle"
        fontSize="12"
      >
        {label}
      </text>
    </g>
  );
}
