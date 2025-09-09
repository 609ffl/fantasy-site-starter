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

export default function WhatIf({
  teams, matchups, onApply, sims=3000
}: { teams: Team[]; matchups: Matchup[]; onApply: (odds:any)=>void; sims?: number; }) {

  const teamName = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams]);

  // build list of future weeks that have any unplayed games
  const futureWeeks = useMemo(() => {
    const cur = detectCurrentWeek(matchups);
    const set = new Set(matchups
      .filter(m => m.week >= cur && isUnplayed(m))
      .map(m => m.week));
    return Array.from(set).sort((a,b)=>a-b);
  }, [matchups]);

  const [week, setWeek] = useState<number | null>(futureWeeks[0] ?? null);

  const games = useMemo(() =>
    week == null ? [] : matchups.filter(m => m.week === week && isUnplayed(m)),
  [matchups, week]);

  const [picks, setPicks] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setPick = (mId:string, winnerId:number) =>
    setPicks(prev => ({ ...prev, [mId]: winnerId }));

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
      onApply(data.odds);
    } catch (e:any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!futureWeeks.length) {
    return <div className="p-4 rounded bg-gray-50">No upcoming games to what-if.</div>;
  }

  return (
    <div className="p-4 border rounded space-y-3">
      <div className="flex items-center gap-3">
        <div className="font-semibold">What-If: Pick winners</div>
        <select
          className="border rounded px-2 py-1"
          value={week ?? undefined}
          onChange={e => { setWeek(Number(e.target.value)); setPicks({}); }}
        >
          {futureWeeks.map(w => <option key={w} value={w}>Week {w}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {games.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <span className="mr-2">{teamName.get(g.awayId)}</span>
              <span className="mx-1">at</span>
              <span>{teamName.get(g.homeId)}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`m-${g.id}`}
                  checked={picks[g.id] === g.awayId}
                  onChange={() => setPick(g.id, g.awayId)}
                />
                {teamName.get(g.awayId)}
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`m-${g.id}`}
                  checked={picks[g.id] === g.homeId}
                  onChange={() => setPick(g.id, g.homeId)}
                />
                {teamName.get(g.homeId)}
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50"
          disabled={busy || Object.keys(picks).length===0}
          onClick={apply}
        >
          {busy ? "Computing…" : "Apply What-If"}
        </button>
        {error && <div className="text-red-600 text-sm">Error: {error}</div>}
      </div>
    </div>
  );
}
