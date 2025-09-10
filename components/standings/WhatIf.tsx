// @ts-nocheck
import { useMemo, useState } from "react";

type Matchup = {
  id: string; week: number; homeId: number; awayId: number;
  homeScore?: number; awayScore?: number;
};
type Team = { id:number; name:string };

// consider ESPN's 0-0 as "unplayed"
const isUnplayed = (m: Matchup) =>
  (m.homeScore == null && m.awayScore == null) ||
  (m.homeScore === 0 && m.awayScore === 0);

const isCompleted = (m: Matchup) =>
  m.homeScore != null && m.awayScore != null && !(m.homeScore === 0 && m.awayScore === 0);

function detectCurrentWeek(matchups: Matchup[]) {
  const completedWeeks = new Set(matchups.filter(isCompleted).map(m => m.week));
  if (completedWeeks.size === 0) return Math.min(...matchups.map(m => m.week));
  return Math.max(...completedWeeks) + 1;
}

/* ---------- UI atoms ---------- */
function BracketRow({
  home, away, picked, onPick,
}: {
  home: string; away: string; picked?: "home"|"away";
  onPick: (side: "home"|"away") => void;
}) {
  const base =
    "px-3 py-2 sm:px-4 sm:py-3 rounded-xl border text-sm sm:text-base min-w-0 transition select-none";
  const on  = "bg-purple-600 text-white border-purple-600 shadow-sm";
  const off = "bg-white text-gray-800 border-gray-300 hover:border-gray-400";

  return (
    <div className="rounded-2xl border p-2 sm:p-3 flex items-center justify-between gap-2 sm:gap-3">
      <button
        type="button"
        className={`${base} ${picked==="away" ? on : off} flex-1 text-left`}
        onClick={() => onPick("away")}
        aria-pressed={picked==="away"}
      >
        <span className="block truncate">{away}</span>
      </button>

      <span className="px-1 sm:px-2 shrink-0 text-[10px] sm:text-xs uppercase tracking-wide text-gray-500">
        at
      </span>

      <button
        type="button"
        className={`${base} ${picked==="home" ? on : off} flex-1 text-left`}
        onClick={() => onPick("home")}
        aria-pressed={picked==="home"}
      >
        <span className="block truncate">{home}</span>
      </button>
    </div>
  );
}

export default function WhatIf({
  teams, matchups, onApply, sims = 3000
}: {
  teams: Team[];
  matchups: Matchup[];
  // NOTE: returns both odds and your picks so the caller can update records too
  onApply: (payload: { odds: any[]; lockedResults: Record<string, number> }) => void;
  sims?: number;
}) {
  const teamName = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams]);

  // Build list of future weeks that have any unplayed games
  const futureWeeks = useMemo(() => {
    const cur = detectCurrentWeek(matchups);
    const set = new Set(
      matchups.filter(m => m.week >= cur && isUnplayed(m)).map(m => m.week)
    );
    return Array.from(set).sort((a, b) => a - b);
  }, [matchups]);

  const [week, setWeek] = useState<number | null>(futureWeeks[0] ?? null);

  const games = useMemo(
    () => (week == null ? [] : matchups.filter(m => m.week === week && isUnplayed(m))),
    [matchups, week]
  );

  const [picks, setPicks] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPick = (mId: string, winnerId: number) =>
    setPicks(prev => ({ ...prev, [mId]: winnerId }));

  const pickAll = (side: "home" | "away") => {
    const next: Record<string, number> = {};
    for (const g of games) next[g.id] = side === "home" ? g.homeId : g.awayId;
    setPicks(next);
  };

  const clearPicks = () => setPicks({});

  const apply = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/playoff-odds?sims=${sims}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedResults: picks }),
      });
      const txt = await r.text();
      const data = JSON.parse(txt);
      if (data.error) throw new Error(data.error);

      onApply({ odds: data.odds, lockedResults: picks });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!futureWeeks.length) {
    return <div className="p-4 rounded-xl border bg-gray-50">No upcoming games to what-if.</div>;
  }

  return (
    <div className="rounded-2xl border p-3 sm:p-4 bg-white space-y-3 sm:space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="font-semibold text-sm sm:text-base">What-If: Pick winners</div>
        <select
          className="rounded-lg border-gray-300 text-sm"
          value={week ?? undefined}
          onChange={e => { setWeek(Number(e.target.value)); setPicks({}); }}
        >
          {futureWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
        </select>

        <div className="ml-auto flex gap-2">
          <button
            className="px-3 py-2 rounded-lg border text-sm"
            onClick={() => pickAll("home")}
            disabled={!games.length}
          >
            Pick all home
          </button>
          <button
            className="px-3 py-2 rounded-lg border text-sm"
            onClick={() => pickAll("away")}
            disabled={!games.length}
          >
            Pick all away
          </button>
          <button
            className="px-3 py-2 rounded-lg border text-sm"
            onClick={clearPicks}
            disabled={Object.keys(picks).length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Match rows */}
      <div className="space-y-2.5 sm:space-y-3">
        {games.map((g) => (
          <BracketRow
            key={g.id}
            home={teamName.get(g.homeId)!}
            away={teamName.get(g.awayId)!}
            picked={
              picks[g.id] === g.homeId ? "home"
              : picks[g.id] === g.awayId ? "away"
              : undefined
            }
            onPick={(side) => setPick(g.id, side === "home" ? g.homeId : g.awayId)}
          />
        ))}
      </div>

      {/* Error (inline) */}
      {error && <div className="text-red-600 text-sm">Error: {error}</div>}

      {/* Sticky apply (mobile friendly) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t mt-2 sm:mt-3 p-3">
        <button
          className="w-full py-3 rounded-xl bg-purple-600 text-white font-medium shadow-sm disabled:opacity-50"
          disabled={busy || Object.keys(picks).length === 0}
          onClick={apply}
        >
          {busy ? "Computing…" : "Apply What-If"}
        </button>
      </div>
    </div>
  );
}
