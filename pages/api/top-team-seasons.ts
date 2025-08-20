// pages/api/top-team-seasons.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

type HistoryRow = { year: number; owner: string; team_name: string };
type TopTeamSeason = { year: number; owner: string; team_name: string; total_points: number };

const DATA_DIR = path.join(process.cwd(), "data"); // <-- your CSVs should be here
const HISTORY_FILE = path.join(DATA_DIR, "history.csv");
const CAREER_PF_FILE = path.join(DATA_DIR, "career_pf.csv");

function fileExists(p: string) {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function parseCsv(filePath: string): any[] {
  const csv = fs.readFileSync(filePath, "utf8");
  const parsed: any = Papa.parse(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return parsed?.data ?? [];
}

function norm(s?: string) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

// pick first present key from a list
function pick(row: Record<string, any>, names: string[], def?: any) {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null && row[n] !== "") return row[n];
  }
  return def;
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
        message:
          "CSV not found in /data. Ensure history.csv and career_pf.csv are in the project root /data directory and pushed to GitHub.",
      },
      topTeamSeasons: [],
    });
  }

  try {
    const historyRaw = parseCsv(HISTORY_FILE);
    const careerRaw = parseCsv(CAREER_PF_FILE);

    // Normalize HISTORY rows
    const history: HistoryRow[] = historyRaw
      .map((r) => {
        const year = Number(pick(r, ["year", "Year", "season", "Season"]));
        const owner = String(pick(r, ["owner", "Owner", "owner_name", "Owner Name"], ""));
        const team_name = String(pick(r, ["team_name", "Team Name", "team", "Team"], ""));
        return { year, owner, team_name };
      })
      .filter((r) => Number.isFinite(r.year));

    // Build lookups
    const byYearOwner = new Map<string, HistoryRow>();
    const byYearTeam = new Map<string, HistoryRow>();
    for (const h of history) {
      if (h.owner) byYearOwner.set(`${h.year}|${norm(h.owner)}`, h);
      if (h.team_name) byYearTeam.set(`${h.year}|${norm(h.team_name)}`, h);
    }

    // Normalize CAREER_PF rows and join
    const rows: TopTeamSeason[] = [];
    const misses: any[] = [];

    for (const raw of careerRaw) {
      const year = Number(pick(raw, ["year", "Year", "season", "Season"]));
      if (!Number.isFinite(year)) {
        misses.push({ reason: "no_year", raw });
        continue;
      }

      // common PF column names this tries:
      const pf = Number(
        pick(raw, [
          "total_points",
          "Total Points",
          "total_points_for",
          "Total Points For",
          "points_for_total",
          "PF Total",
          "total",
          "Total",
          "points",
          "PF",
          "Points",
        ])
      );
      if (!Number.isFinite(pf)) {
        misses.push({ reason: "no_pf", raw });
        continue;
      }

      const owner = String(pick(raw, ["owner", "Owner", "owner_name", "Owner Name"], ""));
      const team = String(pick(raw, ["team_name", "Team Name", "team", "Team"], ""));

      let match = owner ? byYearOwner.get(`${year}|${norm(owner)}`) : undefined;
      if (!match && team) match = byYearTeam.get(`${year}|${norm(team)}`);

      if (match) {
        rows.push({
          year,
          owner: match.owner,
          team_name: match.team_name,
          total_points: pf,
        });
      } else {
        misses.push({ reason: "no_join", raw });
      }
    }

    rows.sort((a, b) => b.total_points - a.total_points);

    const meta: any = {
      history_file_found: historyExists,
      career_pf_file_found: careerExists,
      history_rows: historyRaw.length,
      career_pf_rows: careerRaw.length,
      matched: rows.length,
      unmatched: misses.length,
    };

    if (debug) {
      meta.history_headers = historyRaw[0] ? Object.keys(historyRaw[0]) : [];
      meta.career_pf_headers = careerRaw[0] ? Object.keys(careerRaw[0]) : [];
      meta.sample_history = historyRaw.slice(0, 3);
      meta.sample_career_pf = careerRaw.slice(0, 3);
      meta.sample_unmatched = misses.slice(0, 5);
    }

    return res.status(200).json({ meta, topTeamSeasons: rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to load" });
  }
}
