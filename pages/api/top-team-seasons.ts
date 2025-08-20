// pages/api/top-team-seasons.ts
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

type HistoryRow = {
  year: number | string;
  owner: string;
  team_name: string;
};

type CareerPFRow = {
  year: number | string;
  owner?: string;
  team_name?: string;
  total_points: number | string;
};

type TopTeamSeason = {
  year: number;
  owner: string;
  team_name: string;
  total_points: number; // from career_pf.csv
};

function parseCsv<T = any>(filePath: string): T[] {
  const csv = fs.readFileSync(filePath, "utf8");
  // No generic on Papa.parse; cast the result instead (avoids the TS error)
  const parsed: any = Papa.parse(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return (parsed?.data ?? []) as T[];
}

function norm(s?: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const dataDir = path.join(process.cwd(), "data");

    const history = parseCsv<HistoryRow>(path.join(dataDir, "history.csv"));
    const careerPF = parseCsv<CareerPFRow>(path.join(dataDir, "career_pf.csv"));

    const byYearOwner = new Map<string, HistoryRow>();
    const byYearTeam = new Map<string, HistoryRow>();
    for (const h of history) {
      const y = Number(h.year);
      if (!Number.isFinite(y)) continue;
      if (h.owner) byYearOwner.set(`${y}|${norm(h.owner)}`, h);
      if (h.team_name) byYearTeam.set(`${y}|${norm(h.team_name)}`, h);
    }

    const rows: TopTeamSeason[] = [];
    const misses: CareerPFRow[] = [];

    for (const r of careerPF) {
      const y = Number(r.year);
      if (!Number.isFinite(y)) continue;

      const pf = Number(r.total_points ?? 0);
      if (!Number.isFinite(pf)) continue;

      let h: HistoryRow | undefined =
        r.owner ? byYearOwner.get(`${y}|${norm(r.owner)}`) : undefined;
      if (!h && r.team_name) h = byYearTeam.get(`${y}|${norm(r.team_name)}`);

      if (h) {
        rows.push({
          year: y,
          owner: h.owner,
          team_name: h.team_name,
          total_points: pf,
        });
      } else {
        misses.push(r);
      }
    }

    if (misses.length && process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[/api/top-team-seasons] Unmatched rows:", misses.slice(0, 5));
    }

    rows.sort((a, b) => b.total_points - a.total_points);
    res.status(200).json({ topTeamSeasons: rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Failed to load top team seasons" });
  }
}
