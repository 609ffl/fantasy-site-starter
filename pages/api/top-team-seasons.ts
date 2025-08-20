// pages/api/top-team-seasons.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

type HistoryRow = { year: number; owner: string; team_name: string };
type TopTeamSeason = { year: number; owner: string; team_name: string; total_points: number };

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.csv");
const CAREER_PF_FILE = path.join(DATA_DIR, "career_pf.csv");

function fileExists(p: string) {
  try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; }
}

function parseCsv(filePath: string): any[] {
  const csv = fs.readFileSync(filePath, "utf8");
  const parsed: any = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  return parsed?.data ?? [];
}

function norm(s?: string) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
}

// pick first present key
function pick(row: Record<string, any>, names: string[], def?: any) {
  for (const n of names) if (row[n] !== undefined && row[n] !== null && row[n] !== "") return row[n];
  return def;
}

/** Convert wide career_pf (owner columns) -> long rows: {year, owner, total_points} */
function meltCareerPF(wideRows: Record<string, any>[]): { year: number; owner: string; total_points: number }[] {
  const long: { year: number; owner: string; total_points: number }[] = [];
  if (!wideRows.length) return long;

  const headers = Object.keys(wideRows[0]);

  // Identify the year column: prefer "year"/"Year"/"season", else the empty header "", else first column
  const yearKey =
    ["year", "Year", "season", "Season", ""].find((k) => headers.includes(k)) ?? headers[0];

  for (const row of wideRows) {
    const year = Number(row[yearKey]);
    if (!Number.isFinite(year)) continue;

    for (const key of headers) {
      if (key === yearKey) continue;
      const val = row[key];
      const n = Number(val);
      if (!Number.isFinite(n)) continue; // skip blanks / non-numbers

      const owner = String(key).trim();
      if (!owner) continue;

      long.push({ year, owner, total_points: n });
    }
  }
  return long;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const debug = req.query.debug === "1";

  const historyExists = fileExists(HISTORY_FILE);
  const careerExists = fileExists(CAREER_PF_FILE);

  if (!historyExists || !careerExists) {
    return res.status(200).json({
      meta: {
        history_file_found: historyExists,
        career_pf_file_found: careerExists,
        message: "CSV not found in /data. Ensure history.csv and career_pf.csv are committed to /data.",
      },
      topTeamSeasons: [],
    });
  }

  try {
    const historyRaw = parseCsv(HISTORY_FILE);
    const careerWide = parseCsv(CAREER_PF_FILE);

    // Normalize HISTORY (we only need year/owner/team_name)
    const history: HistoryRow[] = historyRaw
      .map((r) => ({
        year: Number(pick(r, ["year", "Year", "season", "Season"])),
        owner: String(pick(r, ["owner", "Owner", "owner_name", "Owner Name"], "")),
        team_name: String(pick(r, ["team_name", "Team Name", "team", "Team"], "")),
      }))
      .filter((r) => Number.isFinite(r.year));

    // Build lookups
    const byYearOwner = new Map<string, HistoryRow>();
    const byYearTeam = new Map<string, HistoryRow>();
    for (const h of history) {
      if (h.owner) byYearOwner.set(`${h.year}|${norm(h.owner)}`, h);
      if (h.team_name) byYearTeam.set(`${h.year}|${norm(h.team_name)}`, h);
    }

    // Pivot career_pf wide -> long
    const careerLong = meltCareerPF(careerWide);

    // Join (year + owner)
    const rows: TopTeamSeason[] = [];
    const misses: any[] = [];

    for (const r of careerLong) {
      const match = byYearOwner.get(`${r.year}|${norm(r.owner)}`);
      if (match) {
        rows.push({
          year: r.year,
          owner: match.owner,
          team_name: match.team_name,
          total_points: r.total_points,
        });
      } else {
        misses.push(r);
      }
    }

    // Sort by PF desc
    rows.sort((a, b) => b.total_points - a.total_points);

    // Limit to top 30
    const limited = rows.slice(0, 30);

    const meta: any = {
      history_rows: history.length,
      career_pf_rows_wide: careerWide.length,
      career_pf_rows_long: careerLong.length,
      matched: rows.length,
      unmatched: misses.length,
      returned: limited.length,
    };

    if (debug) {
      meta.sample_history_headers = historyRaw[0] ? Object.keys(historyRaw[0]) : [];
      meta.sample_career_pf_headers = careerWide[0] ? Object.keys(careerWide[0]) : [];
      meta.sample_long_rows = careerLong.slice(0, 5);
      meta.sample_unmatched = misses.slice(0, 5);
    }

    return res.status(200).json({ meta, topTeamSeasons: limited });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to load" });
  }
}

