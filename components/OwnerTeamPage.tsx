// components/OwnerTeamPage.tsx
import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Entry } from "../lib/owners";

type CSSVars = React.CSSProperties & Record<string, string | number>;
type TopPlayerSeason = { year: number; player: string; points: number };

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
    ["--tw-ring-color"]: palette.accent,
    ["--tw-ring-offset-color"]: "#ffffff",
  };

  const textMuted = { color: "#6b7280" }; // gray-500
  const wl = `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`;

  // ---------- fetch Top 15 Player Seasons ----------
  const [topPlayers, setTopPlayers] = useState<TopPlayerSeason[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersErr, setPlayersErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/owner-top-players?owner=${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (!mounted) return;
        setTopPlayers(Array.isArray(json.topPlayers) ? json.topPlayers : []);
      } catch (e: any) {
        if (!mounted) return;
        setPlayersErr(e?.message || "Failed to load top players");
      } finally {
        if (mounted) setPlayersLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  const fmt2 = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "—";

  // ---------- tiny helpers for Seasons UI ----------
  const ResultPill = ({ text }: { text?: string }) => {
    const t = (text || "").trim();
    let cls = "border bg-gray-50 text-gray-700 border-gray-200";
    if (/champ/i.test(t)) cls = "border bg-amber-50 text-amber-900 border-amber-200";
    else if (/elim/i.test(t)) cls = "border bg-rose-50 text-rose-700 border-rose-200";
    else if (/rd/i.test(t)) cls = "border bg-sky-50 text-sky-700 border-sky-200";
    else if (/dnq/i.test(t)) cls = "border bg-gray-100 text-gray-600 border-gray-200";
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
        {t || "—"}
      </span>
    );
  };

  const WLBar = ({ w, l }: { w: number; l: number }) => {
    const total = Math.max(1, (w || 0) + (l || 0));
    const pct = Math.round((w / total) * 100);
    return (
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    );
  };

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

      {/* Seasons (mobile-first, prettier) */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold" style={{ color: palette.dark }}>
          Seasons
        </h2>

        <ul className="divide-y rounded-2xl border bg-white">
          {seasons
            .slice()
            .sort((a, b) => a.year - b.year)
            .map((s) => (
              <li key={`${slug}-${s.year}`} className="p-3 sm:p-4 hover:bg-gray-50/80">
                {/* Row 1: year chip + result pill */}
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/history/${s.year}`}
                    className="rounded-full border px-3 py-1 text-xs font-semibold underline"
                  >
                    {s.year}
                  </Link>
                  <ResultPill text={s.finish} />
                </div>

                {/* Row 2: record + win% bar */}
                <div className="mt-2 flex items-center gap-3 sm:gap-4">
                  <div className="text-base font-semibold shrink-0" style={{ color: palette.primary }}>
                    {s.wins}-{s.losses}
                  </div>
                  <div className="min-w-0 grow">
                    <WLBar w={s.wins} l={s.losses} />
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </div>

      {/* Top 15 Player Seasons */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold" style={{ color: palette.dark }}>
          Top 15 Player Seasons (All-Time)
        </h2>
        {playersLoading && <p className="text-sm" style={textMuted}>Loading…</p>}
        {playersErr && <p className="text-sm text-red-600">{playersErr}</p>}

        {!playersLoading && !playersErr && (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Year</th>
                  <th className="px-4 py-3 font-semibold">Player</th>
                  <th className="px-4 py-3 font-semibold text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {topPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-gray-500">
                      No roster data found.
                    </td>
                  </tr>
                ) : (
                  topPlayers.map((p, i) => (
                    <tr key={`${p.player}-${p.year}-${i}`} className="even:bg-gray-50/60">
                      <td className="px-4 py-3">{i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/history/${p.year}`} className="underline">
                          {p.year}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/players/${encodeURIComponent(p.player)}`}
                          className="underline"
                          title={`View ${p.player} page`}
                        >
                          {p.player}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {fmt2(p.points)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
