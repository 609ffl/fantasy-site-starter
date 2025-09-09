// @ts-nocheck
import useSWR from "swr";
import { useMemo, useState } from "react";
import WhatIf from "../../components/standings/WhatIf";
import { computeStandings } from "../../lib/standings/compute";

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
};

export default function StandingsPage() {
  const { data: stand }    = useSWR("/api/standings", fetcher);
  const { data: baseOdds } = useSWR("/api/playoff-odds?sims=3000", fetcher);

  // What-If state
  const [overrideOdds, setOverrideOdds] = useState<any[] | null>(null);
  const [lockedResults, setLockedResults] = useState<Record<string, number> | null>(null);

  // --- Hooks must run every render ---

  // Recompute standings table locally if we have picks; safe when stand is undefined
  const whatIfTable = useMemo(() => {
    if (!stand || !lockedResults) return null;

    const teamMap = new Map<number, any>(stand.teams.map((t: any) => [t.id, { ...t }]));
    const picksSet = new Set(Object.keys(lockedResults));

    for (const m of stand.matchups) {
      if (!picksSet.has(m.id)) continue;
      const winnerId = lockedResults[m.id];
      const home = teamMap.get(m.homeId);
      const away = teamMap.get(m.awayId);
      if (!home || !away) continue;

      if (winnerId === m.homeId) {
        home.wins += 1;
        away.losses += 1;
      } else if (winnerId === m.awayId) {
        away.wins += 1;
        home.losses += 1;
      }
    }

    return computeStandings([...teamMap.values()], stand.matchups, stand.settings);
  }, [lockedResults, stand]);

  // Choose which standings & odds to render (works while data is loading)
  const tableToShow = whatIfTable ?? stand ?? { sorted: [], settings: { playoffSeeds: 6 } };
  const oddsToShow  = overrideOdds ?? baseOdds?.odds ?? [];

  const mapOdds = useMemo(
    () => new Map((oddsToShow ?? []).map((o: any) => [o.teamId, o])),
    [oddsToShow]
  );

  const seeds = tableToShow.settings?.playoffSeeds ?? 6;

  // Flags for UI states (do not short-circuit before hooks)
  const loading = !stand || !baseOdds;
  const errorMsg =
    (stand && (stand as any).error ? `Standings: ${(stand as any).error}` : "") ||
    (baseOdds && (baseOdds as any).error ? `Odds: ${(baseOdds as any).error}` : "");

  // --- Render ---
  if (errorMsg) {
    return (
      <div className="p-6 text-red-600">
        Error loading data.<br />
        {errorMsg}
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Standings</h1>
        {whatIfTable && (
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-sm text-indigo-700">
            what-if applied
          </span>
        )}
      </div>

      <table className="w-full text-sm border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left">
            <th className="px-2">Seed</th>
            <th className="px-2">Team</th>
            <th className="px-2">W-L-T</th>
            <th className="px-2">PF</th>
            <th className="px-2">PA</th>
            <th className="px-2">Clinch%</th>
          </tr>
        </thead>
        <tbody>
          {tableToShow.sorted.map((t: any, i: number) => {
            const o = mapOdds.get(t.id);
            const seed = i + 1;
            const seeded = seed <= seeds;
            return (
              <tr key={t.id} className="bg-white shadow-sm">
                <td className="px-2 py-1">
                  <span className={`px-2 py-0.5 rounded ${seeded ? "bg-green-100" : "bg-gray-100"}`}>{seed}</span>
                </td>
                <td className="px-2 py-1">{t.name}</td>
                <td className="px-2 py-1">{t.wins}-{t.losses}-{t.ties}</td>
                <td className="px-2 py-1">{Number(t.pf).toFixed(2)}</td>
                <td className="px-2 py-1">{Number(t.pa).toFixed(2)}</td>
                <td className="px-2 py-1">{o?.clinchPct ?? 0}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* What-If drawer */}
      <WhatIf
        teams={stand.teams}
        matchups={stand.matchups}
        onApply={({ odds, lockedResults }) => {
          setOverrideOdds(odds);
          setLockedResults(lockedResults);
        }}
      />

      {(overrideOdds || lockedResults) && (
        <button
          className="px-3 py-1 rounded bg-gray-200"
          onClick={() => {
            setOverrideOdds(null);
            setLockedResults(null);
          }}
        >
          Reset What-If
        </button>
      )}
    </div>
  );
}
