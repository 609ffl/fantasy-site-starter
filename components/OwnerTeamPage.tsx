// components/OwnerTeamPage.tsx
import React from "react";
import type { Entry } from "../lib/owners";

type CSSVars = React.CSSProperties & Record<string, string | number>;

export default function OwnerTeamPage({
  slug,
  teamName,
  ownerDisplay,
  logoSrc,
  record,
  playoffs,
  championships,
  seasons,
  colors,
}: Entry) {
  // Safe palette fallback if colors are missing
  const palette = colors ?? {
    primary: "#111827", // slate-900
    accent: "#3b82f6",  // blue-500
    dark: "#0f172a",    // slate-950
  };

  const ringStyle: CSSVars = {
    ["--tw-ring-color"]: palette.accent,           // Tailwind ring color var
    ["--tw-ring-offset-color"]: "#ffffff",         // improves contrast
  };

  const textMuted = { color: "#6b7280" }; // gray-500

  const wl = `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-5">
        <img
          src={logoSrc}
          alt={teamName}
          width={120}
          height={120}
          className="h-28 w-28 rounded-xl object-contain ring-2 ring-offset-2"
          style={ringStyle}
        />
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold" style={{ color: palette.dark }}>
            {teamName}
          </h1>
          <p className="text-sm" style={textMuted}>
            {ownerDisplay}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide" style={textMuted}>
            Career Record
          </div>
          <div className="text-2xl font-extrabold" style={{ color: palette.primary }}>
            {wl}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide" style={textMuted}>
            Playoff Apps
          </div>
          <div className="mt-1 text-2xl font-bold" style={{ color: palette.primary }}>
            {playoffs}
          </div>
        </div>
        <div className="rounded-2xl border p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide" style={textMuted}>
            Championships
          </div>
          <div className="mt-1 text-2xl font-bold" style={{ color: palette.primary }}>
            {championships}
          </div>
        </div>
        <div className="rounded-2xl border p-4 shadow-sm hidden sm:block">
          <div className="text-xs uppercase tracking-wide" style={textMuted}>
            Seasons Played
          </div>
          <div className="mt-1 text-2xl font-bold" style={{ color: palette.primary }}>
            {seasons.length}
          </div>
        </div>
      </div>

      {/* Seasons table */}
      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Year</th>
              <th className="px-4 py-3 font-semibold">Record</th>
              <th className="px-4 py-3 font-semibold">Finish</th>
            </tr>
          </thead>
          <tbody>
            {seasons
              .slice()
              .sort((a, b) => a.year - b.year)
              .map((s) => {
                const rec = `${s.wins}-${s.losses}`;
                return (
                  <tr key={`${slug}-${s.year}`} className="even:bg-gray-50/60">
                    <td className="px-4 py-3">{s.year}</td>
                    <td className="px-4 py-3">{rec}</td>
                    <td className="px-4 py-3">{s.finish ?? ""}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
