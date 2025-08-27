// scripts/buildPlayerFacts.ts
/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

type HistRow = {
  year: string | number;
  owner: string;
  team_name: string;
  player: string;
  nfl_team: string;
  position: string;
  fantasy_points: string | number;
};

type StandingRow = {
  Year: string | number;
  Owner: string;
  Record: string;
  Result: string;         // e.g., "Champ", "Elim. Rd 1", "DNQ", "DNP"
  PPG: string | number;
  "Playoff Seed": string; // "1","2","DNQ","DNP"
};

function readCSV<T = any>(p: string): T[] {
  const text = fs.readFileSync(p, "utf8");
  const parsed = Papa.parse<T>(text, { header: true, skipEmptyLines: true });
  return parsed.data as T[];
}

function toNum(x: any): number {
  const n = Number(String(x).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toSeed(x: any): number | null {
  const n = Number(String(x));
  return Number.isFinite(n) ? n : null;
}

function isChamp(result?: string): boolean {
  if (!result) return false;
  const s = String(result).toLowerCase().replace(/\./g, "").trim();
  // covers "champ", "champion", "championship", etc.
  return s.startsWith("champ");
}

function main() {
  const root = process.cwd();
  const hist = readCSV<HistRow>(path.join(root, "data/history.csv"));
  const standings = readCSV<StandingRow>(path.join(root, "data/owner_year_standings.csv"));

  // quick map for (year, owner) -> { Result, Seed }
  const stMap = new Map<string, { result?: string; seed?: number | null }>();
  for (const r of standings) {
    const k = `${r.Year}||${r.Owner}`;
    stMap.set(k, { result: r.Result?.toString(), seed: toSeed(r["Playoff Seed"]) });
  }

  // attach rank within position per year
  const byYearPos = new Map<string, HistRow[]>();
  for (const r of hist) {
    const k = `${r.year}||${r.position}`;
    const arr = byYearPos.get(k) || [];
    arr.push(r);
    byYearPos.set(k, arr);
  }
  const posRank = new Map<HistRow, { rank: number; count: number }>();
  for (const [, arr] of byYearPos) {
    arr.sort((a, b) => toNum(b.fantasy_points) - toNum(a.fantasy_points));
    arr.forEach((r, i) => posRank.set(r, { rank: i + 1, count: arr.length }));
  }

  // build per-player facts
  const byPlayer = new Map<string, HistRow[]>();
  for (const r of hist) {
    const name = r.player.trim();
    byPlayer.set(name, (byPlayer.get(name) || []).concat(r));
  }

  const facts: any[] = [];
  for (const [player, rows] of byPlayer.entries()) {
    const seasons = Array.from(new Set(rows.map((r) => Number(r.year)))).sort((a, b) => a - b);
    const owners = Array.from(new Set(rows.map((r) => r.owner)));

    const seasonRows = rows.map((r) => {
      const key = `${r.year}||${r.owner}`;
      const st = stMap.get(key) || {};
      const pr = posRank.get(r)!;
      return {
        year: Number(r.year),
        owner: r.owner,
        team_name: r.team_name,
        points: toNum(r.fantasy_points),
        result: st.result,
        seed: st.seed ?? null,
        pos_rank: pr.rank,
        pos_count: pr.count,
      };
    });

    const total = seasonRows.reduce((s, x) => s + x.points, 0);
    const avg = total / (seasonRows.length || 1);
    const best = seasonRows.reduce((a, b) => (b.points > a.points ? b : a), seasonRows[0]);
    const worst = seasonRows.reduce((a, b) => (b.points < a.points ? b : a), seasonRows[0]);

    // championship contributions with details
    const champContribs = seasonRows
      .filter((x) => isChamp(x.result))
      .map((x) => ({ year: x.year, owner: x.owner, team_name: x.team_name }))
      .sort((a, b) => a.year - b.year);

    const champs = champContribs.length;

    const ownerCounts: Record<string, number> = {};
    seasonRows.forEach((x) => {
      ownerCounts[x.owner] = (ownerCounts[x.owner] || 0) + 1;
    });
    const mostOwnedBy = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const top3 = seasonRows.filter((x) => x.pos_rank <= 3).length;
    const top10 = seasonRows.filter((x) => x.pos_rank <= 10).length;
    const belowReplacement = seasonRows.filter((x) => x.pos_rank > Math.floor(x.pos_count * 0.5)).length;

    facts.push({
      player,
      position: rows[0].position,
      seasons: seasons.length,
      season_years: seasons,
      owners,
      most_owned_by: mostOwnedBy,
      total_points: Number(total.toFixed(1)),
      avg_season: Number(avg.toFixed(1)),
      best_season: { year: best.year, points: Number(best.points.toFixed(1)), owner: best.owner },
      worst_season: { year: worst.year, points: Number(worst.points.toFixed(1)), owner: worst.owner },

      // NEW: championship details
      championships: champs,
      champ_contributions: champContribs,              // [{year, owner, team_name}]
      championship_years: champContribs.map((c) => c.year), // convenience for UI/prompts

      avg_seed_when_rostered: (() => {
        const seeds = seasonRows.map((x) => x.seed).filter((n): n is number => Number.isFinite(n as any));
        if (!seeds.length) return null;
        const mean = seeds.reduce((a, b) => a + b, 0) / seeds.length;
        return Number(mean.toFixed(2));
      })(),
      top3_pos_finishes: top3,
      top10_pos_finishes: top10,
      below_replacement_years: belowReplacement,
    });
  }

  const outDir = path.join(root, "public/data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "player_facts.json"), JSON.stringify(facts, null, 2));
  console.log(`Wrote ${facts.length} players → /public/data/player_facts.json`);
}

main();

