// pages/power/index.tsx
// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** ---------- Types ---------- */
type SeasonRow = {
  year: number;
  owner: string;
  record?: string;
  ppg?: number;
  finish?: string | number;
};

/** ---------- Small helpers ---------- */
const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function norm01(values: number[], value: number) {
  const vs = values.filter((v) => Number.isFinite(v));
  if (!vs.length) return 0.5;
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}
function invNorm01(values: number[], value?: number) {
  if (!Number.isFinite(value)) return 0;
  return 1 - norm01(values, value!);
}

/** ---------- UI defaults ---------- */
const DEFAULT_WEIGHTS = {
  winPct: 0.25,
  ppg: 0.15,
  championships: 0.25,
  playoffApps: 0.10,
  avgFinish: 0.15,
  samplePenalty: 0.05,
};

/** ---------- Light data path for legacy fallback ---------- */
function aggregateOwners(seasons: SeasonRow[]) {
  const by: Record<string, SeasonRow[]> = {};
  for (const s of seasons) {
    if (!s?.owner) continue;
    by[s.owner] = by[s.owner] || [];
    by[s.owner].push(s);
  }
  return Object.keys(by).map((owner) => ({ owner, seasons: by[owner] }));
}
function parseRecord(rec?: string) {
  if (!rec) return { w: 0, l: 0, t: 0 };
  const [w, l, t = 0] = rec.split("-").map((x) => parseInt(String(x).trim(), 10));
  return { w: w || 0, l: l || 0, t: t || 0 };
}
function computeCareerRows(owners: { owner: string; seasons: SeasonRow[] }[]) {
  let allWins = 0, allLosses = 0, allTies = 0, allYears: number[] = [];
  for (const o of owners) {
    for (const s of o.seasons) {
      const { w, l, t } = parseRecord(s.record);
      allWins += w; allLosses += l; allTies += t;
      if (typeof s.year === "number") allYears.push(s.year);
    }
  }
  const leagueGames = allWins + allLosses + allTies;
  const leagueWinPct = leagueGames > 0 ? (allWins + 0.5 * allTies) / leagueGames : 0.5;
  const maxYear = allYears.length ? Math.max(...allYears) : undefined;

  const rows = owners.map((o) => {
    let W = 0, L = 0, T = 0, lastYear = -Infinity;
    let championships = 0, playoffApps = 0;
    for (const s of o.seasons) {
      const { w, l, t } = parseRecord(s.record);
      W += w; L += l; T += t;
      const f = String(s.finish ?? "").toLowerCase();
      const n = Number(s.finish);
      if (!Number.isNaN(n) && n >= 1 && n <= 8) playoffApps++;
      if (f.includes("champ") || n === 1) championships++;
      if (typeof s.year === "number") lastYear = Math.max(lastYear, s.year);
    }
    const games = W + L + T;
    return {
      owner: o.owner,
      totals: { W, L, T, games },
      rawWinPct: games > 0 ? (W + 0.5 * T) / games : 0,
      avgPPG: 0, // unknown in fallback
      championships, playoffApps,
      avgFinish: undefined, seasonsCount: o.seasons.length,
      isActive: maxYear ? lastYear === maxYear : true,
    };
  });
  return { rows, leagueWinPct, priorGamesDefault: 24 };
}

/** ---------- Robust scoring (handles missing values) ---------- */
function applyScoring(
  rowsIn: any[],
  opts: {
    weights: typeof DEFAULT_WEIGHTS;
    leagueWinPct: number;
    priorGames: number;
    minSeasonsForNoPenalty: number;
    ringCurveK: number;
    includeRetired: boolean;
  }
) {
  const { weights, leagueWinPct, priorGames, minSeasonsForNoPenalty, ringCurveK, includeRetired } = opts;
  const rows = includeRetired ? rowsIn : rowsIn.filter((r) => r.isActive);

  const enriched = rows.map((r) => {
    const gp = Number(r?.totals?.games ?? 0);
    const W = Number(r?.totals?.W ?? 0);
    const T = Number(r?.totals?.T ?? 0);
    const ebWins = W + 0.5 * T + leagueWinPct * priorGames;
    const ebGames = gp + priorGames;
    const adjWinPct = ebGames > 0 ? ebWins / ebGames : leagueWinPct;

    const rings = Number(r?.championships ?? 0);
    const ringScore = 1 - Math.exp(-ringCurveK * rings);

    const seasons = Number(r?.seasonsCount ?? 0);
    const penalty = seasons >= minSeasonsForNoPenalty ? 0 :
      (minSeasonsForNoPenalty - seasons) / Math.max(1, minSeasonsForNoPenalty);

    return {
      ...r,
      adjWinPct,
      ringScore,
      penalty,
      avgPPG: Number(r?.avgPPG ?? 0),
      championships: rings,
      playoffApps: Number(r?.playoffApps ?? 0),
      avgFinish: Number.isFinite(Number(r?.avgFinish)) ? Number(r.avgFinish) : undefined,
    };
  });

  const winPctsAdj = enriched.map((r) => r.adjWinPct);
  const ppgs = enriched.map((r) => r.avgPPG ?? 0);
  const champs = enriched.map((r) => r.championships ?? 0);
  const poApps = enriched.map((r) => r.playoffApps ?? 0);
  const avgFinVals = enriched.map((r) => (Number.isFinite(r.avgFinish) ? (r.avgFinish as number) : undefined))
                             .filter((v): v is number => Number.isFinite(v));
  const hasAvgFinish = avgFinVals.length > 0;

  const scored = enriched.map((r) => {
    const base =
      (weights.winPct ?? 0)        * norm01(winPctsAdj, r.adjWinPct) +
      (weights.ppg ?? 0)           * norm01(ppgs, r.avgPPG ?? 0) +
      (weights.championships ?? 0) * norm01(champs, r.championships ?? 0) +
      (weights.playoffApps ?? 0)   * norm01(poApps, r.playoffApps ?? 0) +
      (hasAvgFinish ? (weights.avgFinish ?? 0) * invNorm01(avgFinVals, r.avgFinish!) : 0) +
      (weights.samplePenalty ?? 0) * (1 - clamp(r.penalty, 0, 1));

    const ringCurveBonus = 0.5 * (weights.championships ?? 0) * r.ringScore;
    return { ...r, powerScore: 100 * (base + ringCurveBonus) };
  })
  .sort((a, b) => {
    if (b.powerScore !== a.powerScore) return b.powerScore - a.powerScore;
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.adjWinPct !== a.adjWinPct) return b.adjWinPct - a.adjWinPct;
    return (b.totals.W - b.totals.L) - (a.totals.W - a.totals.L);
  })
  .map((r, i) => ({ rank: i + 1, ...r }));

  return scored;
}

/** ---------- Page ---------- */
export default function PowerPage() {
  const [data, setData] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [priorGames, setPriorGames] = useState(24);
  const [minSeasons, setMinSeasons] = useState(3);
  const [ringCurveK, setRingCurveK] = useState(0.8);
  const [includeRetired, setIncludeRetired] = useState(true);

  const weightSum = Object.values(weights).reduce((a,b)=>a+b,0);

  useEffect(() => {
    (async () => {
      try {
        // prefer pre-aggregated owners (fast path)
        const p = await fetch("/api/history?power=1");
        if (p.ok) {
          const j = await p.json();
          if (j?.owners?.length) {
            (window as any).__powerOwners = j.owners;
            setLoading(false);
            return;
          }
        }
        // fallback to season rows
        const urls = ["/api/history?summary=1", "/api/history"];
        for (const url of urls) {
          const res = await fetch(url);
          if (!res.ok) continue;
          const raw = await res.json();
          if (Array.isArray(raw)) { setData(raw); setLoading(false); return; }
          if (Array.isArray(raw?.seasons)) { setData(raw.seasons); setLoading(false); return; }
        }
        throw new Error("No season rows found.");
      } catch (e: any) {
        setError(e?.message || "Failed to load history");
        setLoading(false);
      }
    })();
  }, []);

  const computed = useMemo(() => {
    const pre = (typeof window !== "undefined" && (window as any).__powerOwners) || null;
    if (pre && Array.isArray(pre) && pre.length) {
      const leagueWinPct = 0.5;
      const scored = applyScoring(pre, {
        weights, leagueWinPct,
        priorGames, minSeasonsForNoPenalty: minSeasons,
        ringCurveK, includeRetired
      });
      return { scored, leagueWinPct };
    }
    const owners = aggregateOwners(data);
    const { rows, leagueWinPct, priorGamesDefault } = computeCareerRows(owners);
    const scored = applyScoring(rows, {
      weights, leagueWinPct,
      priorGames: priorGames ?? priorGamesDefault,
      minSeasonsForNoPenalty: minSeasons,
      ringCurveK, includeRetired
    });
    return { scored, leagueWinPct };
  }, [data, weights, priorGames, minSeasons, ringCurveK, includeRetired]);

  if (loading) return <div className="p-10 text-center text-lg">Loading career power rankings…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const { scored, leagueWinPct } = computed;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* Topbar */}
      <div className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Career Power Rankings</h1>
          <div className="hidden sm:flex items-center gap-6 text-sm">
            <div className="px-3 py-1 rounded-full bg-slate-100">League baseline win%: {(leagueWinPct*100).toFixed(1)}%</div>
            <div className="px-3 py-1 rounded-full bg-slate-100">Weights Σ = {weightSum.toFixed(2)}</div>
            <Link className="underline" href="/owners">Back to Owners</Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Control strip */}
        <div className="rounded-2xl border shadow-sm bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs uppercase opacity-70">Prior Games (shrinkage)</label>
              <input type="number" className="mt-1 w-full border rounded-xl p-2"
                value={priorGames} onChange={(e) => setPriorGames(parseInt(e.target.value||"0",10))} />
              <p className="text-xs opacity-60 mt-1">Higher = more conservative toward league avg</p>
            </div>
            <div>
              <label className="text-xs uppercase opacity-70">Min Seasons (no penalty)</label>
              <input type="number" className="mt-1 w-full border rounded-xl p-2"
                value={minSeasons} onChange={(e) => setMinSeasons(parseInt(e.target.value||"0",10))} />
              <p className="text-xs opacity-60 mt-1">Short careers get a small down-weight</p>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="flex-1">
                <label className="text-xs uppercase opacity-70">Ring Curve (k)</label>
                <input type="range" min={0.1} max={1.5} step={0.05} className="w-full"
                  value={ringCurveK} onChange={(e)=>setRingCurveK(parseFloat(e.target.value))}/>
                <div className="text-xs opacity-70">Current: {ringCurveK.toFixed(2)}</div>
              </div>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={includeRetired} onChange={(e)=>setIncludeRetired(e.target.checked)} />
                Include retired
              </label>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <h3 className="font-medium mb-2">Weights <span className="text-xs opacity-60">(Σ {weightSum.toFixed(2)})</span></h3>
            <div className="grid gap-3">
              {Object.entries(weights).map(([key, val]) => (
                <div key={key} className="grid grid-cols-[140px_1fr_60px] items-center gap-3">
                  <div className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").toLowerCase()}</div>
                  <input type="range" min={0} max={0.5} step={0.01} value={val}
                    onChange={(e)=>setWeights({...weights,[key]:parseFloat(e.target.value)})}/>
                  <div className="text-right text-sm tabular-nums">{val.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Share / Links */}
        <div className="rounded-xl border bg-white px-3 py-2 text-sm flex items-center justify-between">
          <div className="opacity-70">Quick links:</div>
          <div className="flex flex-wrap gap-3">
            <a className="underline" href="/api/history?power=1" target="_blank" rel="noreferrer">API (owners)</a>
            <a className="underline" href="/api/history?summary=1" target="_blank" rel="noreferrer">API (summary)</a>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 sticky top-[52px]">
              <tr className="text-left">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Power</th>
                <th className="px-3 py-2">Rings</th>
                <th className="px-3 py-2">Seasons</th>
                <th className="px-3 py-2">GP</th>
                <th className="px-3 py-2">W-L-T</th>
                <th className="px-3 py-2">Adj Win%</th>
                <th className="px-3 py-2">PPG</th>
                <th className="px-3 py-2">PO Apps</th>
                <th className="px-3 py-2">Avg Finish</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {computed.scored.map((r) => (
                <tr key={r.owner} className="border-t hover:bg-slate-50/60">
                  <td className="px-3 py-2 tabular-nums">
                    {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                  </td>
                  <td className="px-3 py-2">
                    <Link className="underline" href={`/owners/${encodeURIComponent(r.owner.toLowerCase().replace(/\s+/g,"-"))}`}>{r.owner}</Link>
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{r.powerScore.toFixed(1)}</td>
                  <td className="px-3 py-2">
                    {r.championships > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                        💍 {r.championships}
                      </span>
                    ) : "0"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.seasonsCount}</td>
                  <td className="px-3 py-2 tabular-nums">{r.totals.games}</td>
                  <td className="px-3 py-2 tabular-nums">{r.totals.W}-{r.totals.L}{r.totals.T ? `-${r.totals.T}` : ""}</td>
                  <td className="px-3 py-2">
                    <div className="tabular-nums">{(r.adjWinPct*100).toFixed(1)}%</div>
                    <div className="h-1 mt-1 rounded bg-slate-200">
                      <div className="h-full rounded bg-sky-500" style={{width: `${(r.adjWinPct*100).toFixed(0)}%`}}/>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="tabular-nums">{r.avgPPG?.toFixed(2) ?? "-"}</div>
                    <div className="h-1 mt-1 rounded bg-slate-200">
                      <div className="h-full rounded bg-indigo-500" style={{width: `${Math.min(100, (r.avgPPG/140)*100)}%`}}/>
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.playoffApps}</td>
                  <td className="px-3 py-2 tabular-nums">{Number.isFinite(r.avgFinish) ? r.avgFinish.toFixed(2) : "-"}</td>
                  <td className="px-3 py-2">
                    {r.isActive
                      ? <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs">Active</span>
                      : <span className="px-2 py-1 rounded-full bg-slate-200 text-slate-700 text-xs">Retired</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs opacity-70">
          * Adj Win% uses Empirical-Bayes shrinkage toward league average. Rings use a diminishing-returns curve.
        </p>
      </div>
    </div>
  );
}
