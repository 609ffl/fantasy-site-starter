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

function pct(v?: number) { return v == null ? "–" : `${Math.round(v * 100)}%`; }
function diff(pf: number, pa: number) { const d = pf - pa; return `${d > 0 ? "+" : ""}${d.toFixed(1)}`; }

// Circle rank pill
function rankBadge(r: number) {
  const palette = r === 1 ? "bg-yellow-500" : r === 2 ? "bg-gray-400" : r === 3 ? "bg-amber-700" : "bg-gray-200";
  const text = r <= 3 ? "text-white" : "text-gray-700";
  return `inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${palette} ${text}`;
}

// Seed badge: BYE for 1–2, Playoff for 3–6
function seedBadge(rank: number) {
  if (rank <= 2) {
    return <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">BYE</span>;
  }
  if (rank >= 3 && rank <= 6) {
    return <span className="ml-auto text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">Playoff</span>;
  }
  return null;
}

export default function StandingsPage() {
  // Always call hooks on every render
  const { data: stand } = useSWR("/api/standings", fetcher);
  const { data: baseOdds } = useSWR("/api/playoff-odds?sims=3000", fetcher);

  const [overrideOdds, setOverrideOdds] = useState<Odds[] | null>(null);

  // Derived data (safe with undefined)
  const teams: TeamRow[] = useMemo(
    () => (stand?.teams ?? stand ?? []) as TeamRow[],
    [stand]
  );

  const oddsList: Odds[] = useMemo(() => {
    const raw = overrideOdds ?? (baseOdds?.odds ?? baseOdds ?? []);
    return Array.isArray(raw) ? (raw as Odds[]) : [];
  }, [overrideOdds, baseOdds]);

  const oddsById = useMemo(() => {
    const m = new Map<number, Odds>();
    oddsList.forEach(o => m.set(o.teamId, o));
    return m;
  }, [oddsList]);

  // Sort standings: W-L diff, then wins, then PF, then name
  const rows = useMemo(() => {
    const arr = [...teams];
    arr.sort((a, b) => {
      const aw = a.wins - a.losses, bw = b.wins - b.losses;
      if (bw !== aw) return bw - aw;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [teams]);

  const onApply = ({ odds }: { odds: Odds[]; lockedResults: Record<string, number> }) => {
    setOverrideOdds(odds);
  };

  // Render branches after hooks
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
      {/* ===== Standings FIRST ===== */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Standings</h1>
          <p className="text-sm text-gray-500">Top 2 get a bye • 6 total playoff teams</p>
        </div>
        {overrideOdds && (
          <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setOverrideOdds(null)}>
            Clear What-If odds
          </button>
        )}
      </div>

      {/* Mobile standings cards */}
      <div className="grid sm:hidden gap-3">
        {rows.map((t, idx) => {
          const o = oddsById.get(t.id);
          const rank = idx + 1;
          return (
            <div key={t.id} className="rounded-2xl border p-4 bg-white">
              <div className="flex items-center gap-3">
                <div className={rankBadge(rank)}>{rank}</div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-gray-500">
                    {t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""} • PF {t.pf.toFixed(1)} • PA {t.pa.toFixed(1)} • Diff {diff(t.pf, t.pa)}
                  </div>
                </div>
                {seedBadge(rank)}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border p-2">
                  <div className="text-gray-500">Playoff</div>
                  <div className="font-semibold">{pct(o?.playoff)}</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-gray-500">Bye</div>
                  <div className="font-semibold">{pct(o?.bye)}</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-gray-500">Title</div>
                  <div className="font-semibold">{pct(o?.title)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop standings table */}
      <div className="hidden sm:block rounded-2xl border overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Team</th>
                <th className="px-4 py-3 text-right">W</th>
                <th className="px-4 py-3 text-right">L</th>
                <th className="px-4 py-3 text-right">T</th>
                <th className="px-4 py-3 text-right">PF</th>
                <th className="px-4 py-3 text-right">PA</th>
                <th className="px-4 py-3 text-right">Diff</th>
                <th className="px-4 py-3 text-center">Streak</th>
                <th className="px-4 py-3 text-right">Playoff</th>
                <th className="px-4 py-3 text-right">Bye</th>
                <th className="px-4 py-3 text-right">Title</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((t, idx) => {
                const o = oddsById.get(t.id);
                const rank = idx + 1;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={rankBadge(rank)}>{rank}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{t.name}</span>
                        {rank <= 2 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                            BYE
                          </span>
                        )}
                        {rank >= 3 && rank <= 6 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                            Playoff
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.wins}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.losses}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.ties ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.pf.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{t.pa.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{diff(t.pf, t.pa)}</td>
                    <td className="px-4 py-3 text-center">
                      {t.streak ? <span className="px-2 py-1 rounded-full bg-gray-100 text-xs">{t.streak}</span> : "–"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(o?.playoff)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(o?.bye)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(o?.title)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== What-If moved BELOW standings ===== */}
      <div className="rounded-2xl border bg-white">
        <WhatIf
          teams={rows.map(t => ({ id: t.id, name: t.name }))}
          matchups={stand.matchups || []}
          onApply={onApply}
          sims={3000}
        />
      </div>
    </div>
  );
}
