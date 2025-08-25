// lib/topTeamSeasons.ts
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type HistoryRow = {
  year: number | string;
  owner: string;         // e.g. "S. Dickson"
  team_name: string;     // e.g. "2 Many Cooks In the Kitchen"
};

export type CareerPFRow = {
  year: number | string;
  owner?: string;        // optional in case file uses team only
  team_name?: string;
  total_points: number | string;
};

export type TopTeamSeason = {
  year: number;
  owner: string;
  team_name: string;
  total_points: number;  // from career_pf.csv
};

// ---- utils ----
function parseCsv<T = any>(filePath: string): T[] {
  const csv = fs.readFileSync(filePath, "utf8");
  const result = Papa.parse(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  }) as unknown as { data: T[] };
  return result.data;
}

function norm(s?: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "") // strip punctuation
    .trim();
}

/**
 * We try to join career_pf to history first by (year + owner),
 * then fall back to (year + team_name).
 */
export function loadTopTeamSeasons(): TopTeamSeason[] {
  const dataDir = path.join(process.cwd(), "data");

  const history = parseCsv<HistoryRow>(path.join(dataDir, "history.csv"));
  const careerPF = parseCsv<CareerPFRow>(path.join(dataDir, "career_pf.csv"));

  // Build lookup from history
  const byYearOwner = new Map<string, HistoryRow>();
  const byYearTeam  = new Map<string, HistoryRow>();

  for (const h of history) {
    const y = Number(h.year);
    const keyOwner = `${y}|${norm(h.owner)}`;
    const keyTeam  = `${y}|${norm(h.team_name)}`;
    if (h.owner) byYearOwner.set(keyOwner, h);
    if (h.team_name) byYearTeam.set(keyTeam, h);
  }

  const rows: TopTeamSeason[] = [];
  const misses: CareerPFRow[] = [];

  for (const r of careerPF) {
    const y = Number(r.year);
    const pf = Number(r.total_points ?? 0);

    let match: HistoryRow | undefined;

    if (r.owner) {
      match = byYearOwner.get(`${y}|${norm(r.owner)}`);
    }
    if (!match && r.team_name) {
      match = byYearTeam.get(`${y}|${norm(r.team_name)}`);
    }

    if (match) {
      rows.push({
        year: y,
        owner: match.owner,
        team_name: match.team_name,
        total_points: pf,
      });
    } else {
      misses.push(r);
    }
  }

  // Optional: log any unmatched rows so you can fix spellings in CSVs
  if (misses.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[topTeamSeasons] Unmatched career_pf rows (${misses.length}):`,
      misses.slice(0, 5)
    );
  }

  // Sort by Total Points DESC
  rows.sort((a, b) => b.total_points - a.total_points);
  return rows;
}
