// @ts-nocheck
import useSWR from "swr";
import { useMemo, useState } from "react";
import WhatIf from "../../components/standings/WhatIf";

const fetcher = async (u:string) => {
  const r = await fetch(u);
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error: text }; }
};

export default function StandingsPage() {
  const { data: stand } = useSWR("/api/standings", fetcher);
  const { data: baseOdds }  = useSWR("/api/playoff-odds?sims=3000", fetcher);

  const [overrideOdds, setOverrideOdds] = useState<any[] | null>(null);

  if (!stand || !baseOdds) return <div className="p-6">Loading…</div>;
  if (stand.error || baseOdds.error) {
    return (
      <div className="p-6 text-red-600">
        Error loading data.<br/>
        {stand.error && <div>Standings: {String(stand.error)}</div>}
        {baseOdds.error && <div>Odds: {String(baseOdds.error)}</div>}
      </div>
    );
  }

  const odds = overrideOdds ?? baseOdds.odds;
  const mapOdds = new Map((odds ?? []).map((o:any)=>[o.teamId, o]));
  const seeds = stand.settings?.playoffSeeds ?? 6;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Standings</h1>

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
          {stand.sorted.map((t:any, i:number)=>{
            const o = mapOdds.get(t.id);
            const seed = i+1;
            const seeded = seed <= seeds;
            return (
              <tr key={t.id} className="bg-white shadow-sm">
                <td className="px-2 py-1">
                  <span className={`px-2 py-0.5 rounded ${seeded?'bg-green-100':'bg-gray-100'}`}>{seed}</span>
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
        onApply={(newOdds:any[]) => setOverrideOdds(newOdds)}
      />
      {overrideOdds && (
        <button
          className="px-3 py-1 rounded bg-gray-200"
          onClick={() => setOverrideOdds(null)}
        >
          Reset What-If
        </button>
      )}
    </div>
  );
}
