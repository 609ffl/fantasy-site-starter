// pages/players/[player].tsx
// @ts-nocheck
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ownerSlug } from "../../lib/slug";
import { loadPlayerHistory } from "../../lib/loadHistory";

/* ---------------- name normalization helpers (unchanged) ---------------- */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\./g, "")
    .replace(/['_-]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function trimTrailingTeamFragment(s: string) {
  const m = s.match(/^(.*?)(?:\s+[A-Za-z]{1,3})$/);
  if (!m) return s;
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2 && parts[parts.length - 1].length <= 3) return m[1];
  return s;
}

/* ---------------- types ---------------- */
type Row = {
  player: string;
  year: number;
  owner: string;
  fantasy_points: number;
  result?: string; // joined in getServerSideProps
  seed?: number | null;
};

/* ---------------- page ---------------- */
export default function PlayerPage({
  player,
  rows,
  suggestions,
}: {
  player: string;
  rows: Row[];
  suggestions: string[];
}) {
  // group rows by year
  const byYear: Record<number, Row[]> = useMemo(() => {
    const m: Record<number, Row[]> = {};
    rows.forEach((r) => {
      if (!m[r.year]) m[r.year] = [];
      m[r.year].push(r);
    });
    return m;
  }, [rows]);

  const years = useMemo(
    () => Object.keys(byYear).map(Number).sort((a, b) => a - b),
    [byYear]
  );

  // Quick derived stats (“facts used”)
  const facts = useMemo(() => {
    const total = rows.reduce((s, r) => s + (Number(r.fantasy_points) || 0), 0);
    const seasons = years.length;
    const avg = seasons ? total / seasons : 0;
    const owners = Array.from(new Set(rows.map((r) => r.owner))).sort();
    const champCount = rows.filter(
      (r) => (r.result || "").toLowerCase().replace(/\./g, "").startsWith("champ")
    ).length;

    // most owned by
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.owner, (counts.get(r.owner) || 0) + 1));
    const mostOwnedBy = owners.length
      ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : undefined;

    return {
      seasons,
      totalPoints: total,
      avgPerSeason: avg,
      ownersCount: owners.length,
      mostOwnedBy,
      championships: champCount,
      seasonYears: years,
    };
  }, [rows, years]);

  /* ---------------- AI blurb state ---------------- */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBlurb, setAiBlurb] = useState<string>("");
  const [aiBullets, setAiBullets] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        setAiLoading(true);
        setAiError(null);
        const res = await fetch(`/api/player-blurb?name=${encodeURIComponent(player)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        setAiBlurb((json?.blurb || "").trim());
        setAiBullets(Array.isArray(json?.bullets) ? json.bullets.filter(Boolean) : []);
      } catch (e) {
        if (!cancelled) setAiError("Could not generate blurb yet.");
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }
    if (player) go();
    return () => {
      cancelled = true;
    };
  }, [player]);

  /* ---------------- UI ---------------- */
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm">
        <Link href="/history" className="text-violet-700 hover:underline">
          ← Back to History
        </Link>
      </div>

      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{player}</h1>
        <p className="text-sm text-zinc-600">Owners and points by season</p>
      </header>

      {/* Top grid: Blurb + Stats */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {/* Blurb card */}
        <div className="md:col-span-3 rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="text-base font-semibold text-zinc-800">AI Career Blurb</h2>
            <button
              onClick={() => {
                const ts = Date.now();
                setAiLoading(true);
                setAiError(null);
                fetch(`/api/player-blurb?name=${encodeURIComponent(player)}&t=${ts}`, {
                  cache: "no-store",
                })
                  .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
                  .then((j) => {
                    setAiBlurb((j?.blurb || "").trim());
                    setAiBullets(Array.isArray(j?.bullets) ? j.bullets.filter(Boolean) : []);
                  })
                  .catch(() => setAiError("Could not regenerate blurb."))
                  .finally(() => setAiLoading(false));
              }}
              disabled={aiLoading}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiLoading ? "Generating…" : "Regenerate"}
            </button>
          </div>
          <div className="px-4 py-4">
            {aiError ? (
              <p className="text-sm text-rose-700">{aiError}</p>
            ) : (
              <p className="text-[15px] leading-relaxed text-zinc-800">
                {aiLoading ? "Crunching numbers…" : aiBlurb || "No blurb yet."}
              </p>
            )}

            {!!aiBullets.length && (
              <div className="mt-3">
                <h3 className="mb-1 text-sm font-semibold text-zinc-700">Notable Facts</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800">
                  {aiBullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Facts tiles */}
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          <FactTile label="Seasons" value={facts.seasons} />
          <FactTile label="Total points" value={fmtNum(facts.totalPoints)} />
          <FactTile label="Avg / season" value={fmtNum(facts.avgPerSeason)} />
          <FactTile label="Championships" value={facts.championships} />
          <FactTile label="Most owned by" value={facts.mostOwnedBy || "—"} />
          <FactTile
            label="Active years"
            value={
              facts.seasonYears.length
                ? `${facts.seasonYears[0]}–${facts.seasonYears[facts.seasonYears.length - 1]}`
                : "—"
            }
          />
        </div>
      </section>

      {/* Points by Season (mini bars) */}
      <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-zinc-800">Points by Season</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {years.map((y) => {
            const seasonRows = byYear[y].slice().sort((a, b) => b.fantasy_points - a.fantasy_points);
            const max = Math.max(...seasonRows.map((r) => Number(r.fantasy_points) || 0), 1);
            return (
              <div key={y} className="rounded-lg border border-zinc-100 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">{y}</span>
                  <span className="text-sm text-zinc-700">
                    {Number(seasonRows[0].fantasy_points || 0).toFixed(1)}
                  </span>
                </div>
                <div className="h-2 w-full rounded bg-zinc-100">
                  <div
                    className="h-2 rounded bg-zinc-800"
                    style={{
                      width: `${Math.max(
                        2,
                        (Number(seasonRows[0].fantasy_points || 0) / max) * 100
                      )}%`,
                    }}
                    aria-label={`Season ${y} bar`}
                  />
                </div>
                <div className="mt-2 text-xs text-zinc-600">
                  Owner:{" "}
                  <Link
                    className="font-medium text-violet-700 hover:underline"
                    href={`/owners/${ownerSlug(seasonRows[0].owner)}`}
                  >
                    {seasonRows[0].owner}
                  </Link>
                  {typeof seasonRows[0].seed === "number" ? (
                    <> • Seed: <span className="font-medium">{seasonRows[0].seed}</span></>
                  ) : null}
                  {seasonRows[0].result ? (
                    <> • <span className="font-medium">{seasonRows[0].result}</span></>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Career table */}
      <section className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-800">Career Seasons</h2>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="bg-zinc-50 text-left text-sm text-zinc-700">
              <tr>
                <Th>Season</Th>
                <Th>Owner</Th>
                <Th numeric>Points</Th>
                <Th>Finish</Th>
              </tr>
            </thead>
            <tbody className="text-sm text-zinc-800">
              {years.flatMap((y) => {
                const seasonRows = byYear[y].slice().sort((a, b) => b.fantasy_points - a.fantasy_points);
                return seasonRows.map((r, i) => {
                  const isChamp = (r.result || "")
                    .toLowerCase()
                    .replace(/\./g, "")
                    .startsWith("champ");
                  const finishLabel = r.result
                    ? r.result
                    : typeof r.seed === "number"
                    ? `Seed ${r.seed}`
                    : "—";

                  return (
                    <tr key={`${y}-${r.owner}-${i}`} className="even:bg-white odd:bg-zinc-50/40">
                      <Td>{i === 0 ? y : ""}</Td>
                      <Td>
                        <Link className="text-violet-700 hover:underline" href={`/owners/${ownerSlug(r.owner)}`}>
                          {r.owner}
                        </Link>
                      </Td>
                      <Td numeric>{Number(r.fantasy_points ?? 0).toFixed(2)}</Td>
                      <Td>
                        <span className="mr-2">{finishLabel}</span>
                        {isChamp && <ChampionPill />}
                      </Td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Empty-state suggestions */}
      {!rows.length && (
        <div className="mt-4 text-zinc-600">
          <p>No rows found for this player.</p>
          {!!suggestions?.length && (
            <>
              <p>Did you mean:</p>
              <ul className="list-disc pl-5">
                {suggestions.map((s) => (
                  <li key={s}>
                    <Link className="text-violet-700 hover:underline" href={`/players/${encodeURIComponent(s)}`}>
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- tiny UI helpers ---------------- */
function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return <th className={`px-4 py-2 font-medium ${numeric ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return <td className={`px-4 py-2 ${numeric ? "text-right tabular-nums" : ""}`}>{children}</td>;
}
function ChampionPill() {
  return (
    <span
      title="Champion"
      className="inline-block rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[12px] font-medium text-amber-800 align-middle"
    >
      Champion
    </span>
  );
}
function FactTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
function fmtNum(n: number) {
  return Number.isFinite(n) ? (Math.round(n * 10) / 10).toLocaleString() : "—";
}

/* ---------------- Server-side props (joins standings for Finish/Champion) ---------------- */
export async function getServerSideProps(ctx: any) {
  const param = ctx.params?.player || "";
  const qRaw = decodeURIComponent(Array.isArray(param) ? param[0] : param);
  const qMain = trimTrailingTeamFragment(qRaw);
  const qNorm = normalize(qMain);

  const all = loadPlayerHistory();
  const withNorm = all.map((r) => ({
    ...r,
    _norm: normalize(trimTrailingTeamFragment(r.player || "")),
  }));

  let hits = withNorm.filter((r) => r._norm === qNorm);
  if (hits.length === 0) {
    hits = withNorm.filter((r) => r._norm.includes(qNorm) || qNorm.includes(r._norm));
  }
  if (hits.length === 0) {
    const qtoks = qNorm.split(" ").filter(Boolean);
    hits = withNorm.filter((r) => {
      const rtoks = r._norm.split(" ").filter(Boolean);
      const overlap = rtoks.filter((t) => qtoks.includes(t)).length;
      return overlap >= Math.min(2, qtoks.length);
    });
  }

  // join owner_year_standings.csv
  const fs = (await import("fs")).default;
  const path = (await import("path")).default;
  const p = path.join(process.cwd(), "data", "owner_year_standings.csv");
  const text = fs.readFileSync(p, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0]?.split(",").map((s) => s.trim()) || [];
  const idx = (k: string) => headers.findIndex((h) => h === k);
  const yIdx = idx("Year");
  const oIdx = idx("Owner");
  const rIdx = idx("Result");
  const sIdx = idx("Playoff Seed");

  const stMap = new Map<string, { result?: string; seed?: number | null }>();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const Year = Number((parts[yIdx] || "").trim());
    const Owner = (parts[oIdx] || "").trim();
    const Result = (parts[rIdx] || "").trim();
    const seedRaw = (parts[sIdx] || "").trim();
    const Seed = Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : null;
    if (Owner) stMap.set(`${Year}||${Owner}`, { result: Result, seed: Seed });
  }

  hits.sort((a, b) => a.year - b.year || a.owner.localeCompare(b.owner));
  const rows = hits.map(({ player, year, owner, fantasy_points }) => {
    const st = stMap.get(`${year}||${owner}`) || {};
    return {
      player,
      year,
      owner,
      fantasy_points,
      result: st.result || "",
      seed: typeof st.seed === "number" ? st.seed : null,
    };
  });

  let suggestions: string[] = [];
  if (rows.length === 0) {
    suggestions = Array.from(
      new Set(
        withNorm
          .filter((r) => r._norm.includes(qNorm.split(" ")[0] || "")) 
          .map((r) => r.player)
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 10);
  }

  return { props: { player: qMain, rows, suggestions } };
}
