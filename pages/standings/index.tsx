// pages/standings/index.tsx
// @ts-nocheck
import useSWR from "swr";
import { useMemo, useState } from "react";
import WhatIf from "../../components/standings/WhatIf";

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
};

type TeamRow = {
  id: number; name: string;
  wins: number; losses: number; ties?: number;
  pf: number; pa: number; streak?: string;
};
type Odds = { teamId: number; playoff?: number; bye?: number; title?: number };
type Matchup = { id: string; week: number; homeId: number; awayId: number; homeScore?: number; awayScore?: number };

function pct(v?: number) { return v == null ? "–" : `${Math.round(v * 100)}%`; }
function diff(pf: number, pa: number) { const d = pf - pa; return `${d > 0 ? "+" : ""}${d.toFixed(1)}`; }

function seedBadge(rank: number) {
  if (rank <= 2) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">BYE</span>;
  if (rank <= 6) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Playoff</span>;
  return null;
}

export default function StandingsPage() {
  const { data: stand } = useSWR("/api/standings", fetcher);
  const { data: baseOdds } = useSWR("/api/playoff-odds?sims=3000", fetcher);

  const [overrideOdds, setOverrideOdds] = useState<Odds[] | null>(null);
  const [locked, setLocked] = useState<Record<string, number>>({}); // cumulative picks across weeks

  const teamsBase: TeamRow[] = useMemo(
    () => (stand?.teams ?? stand ?? []) as TeamRow[],
    [stand]
  );
  const matchups: Matchup[] = useMemo(
    () => (stand?.matchups ?? []) as Matchup[],
    [stand]
  );

  // Build winner/loser deltas from locked results
  const deltaByTeamId = useMemo(() => {
    const delta = new Map<number, { w: number; l: number }>();
    for (const [mid, winnerId] of Object.entries(locked)) {
      const g = matchups.find(m => m.id === mid);
      if (!g) continue;
      const loserId = winnerId === g.homeId ? g.awayId : g.homeId;
      const w = delta.get(winnerId) || { w:0, l:0 };
      const l = delta.get(loserId)  || { w:0, l:0 };
      w.w += 1; l.l += 1;
      delta.set(winnerId, w); delta.set(loserId, l);
    }
    return delta;
  }, [locked, matchups]);

  // Apply deltas to base standings (compact layout)
  const rows = useMemo(() => {
    const arr = teamsBase.map(t => {
      const d = deltaByTeamId.get(t.id);
      return d ? { ...t, wins: t.wins + d.w, losses: t.losses + d.l } : t;
    });
    // Sort by W-L diff, then W, then PF
    arr.sort((a, b) => {
      const aw = a.wins - a.losses, bw = b.wins - b.losses;
      if (bw !== aw) return bw - aw;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [teamsBase, deltaByTeamId]);

  // Odds selection (override after What-If)
  const oddsList: Odds[] = useMemo(() => {
    const raw = overrideOdds ?? (baseOdds?.odds ?? baseOdds ?? []);
    return Array.isArray(raw) ? (raw as Odds[]) : [];
  }, [overrideOdds, baseOdds]);

  const oddsById = useMemo(() => {
    const m = new Map<number, Odds>();
    oddsList.forEach(o => m.set(o.teamId, o));
    return m;
  }, [oddsList]);

  const onApply = ({ odds, lockedResults }: { odds: Odds[]; lockedResults: Record<string, number> }) => {
    setOverrideOdds(odds);
    setLocked(lockedResults); // persist across weeks
  };

  // Loading / error after hooks
  if (!stand || !baseOdds) {
    return <div className="p-6 text-sm text-gray-600">Loading…</div>;
  }
  if (stand.error || baseOdds.error) {
    return (
      <div className="p-6 text-red-600">
        Error loading data.<br />
        <pre className="text-xs text-gray-700 mt-2">{stand?.error || baseOdds?.error}</pre>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* ===== Standings (compact) ===== */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Standings</h1>
          <p className="text-sm text-gray-500">Top 2 get a bye • 6 total playoff teams</p>
        </div>
        {Object.keys(locked).length > 0 && (
          <button
            className="text-sm px-3 py-2 rounded-lg border"
            onClick={() => { setLocked({}); setOverrideOdds(null); }}
          >
            Clear What-If
          </button>
        )}
      </div>

      <div className="rounded-2xl border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left w-10">#</th>
              <th className="px-3 py-2 text-left">Team</th>
              <th className="px-3 py-2 text-right">W</th>
              <th className="px-3 py-2 text-right">L</th>
              <th className="px-3 py-2 text-right">PF</th>
              <th className="px-3 py-2 text-right">PA</th>
              <th className="px-3 py-2 text-right">Diff</th>
              <th className="px-3 py-2 text-right">Playoff</th>
              <th className="px-3 py-2 text-right">Bye</th>
              <th className="px-3 py-2 text-right">Title</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((t, idx) => {
              const o = oddsById.get(t.id);
              const rank = idx + 1;
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-left tabular-nums">{rank}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      {seedBadge(rank)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.wins}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.losses}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.pf.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.pa.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{diff(t.pf, t.pa)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(o?.playoff)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(o?.bye)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(o?.title)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== What-If BELOW standings, receives cumulative locked picks ===== */}
      <div className="rounded-2xl border bg-white">
        <WhatIf
          teams={teamsBase.map(t => ({ id: t.id, name: t.name }))}
          matchups={matchups}
          onApply={onApply}
          sims={3000}
          lockedSoFar={locked}
        />
      </div>
    </div>
  );
}
