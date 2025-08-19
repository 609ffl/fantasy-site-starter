// lib/loadHistory.ts
import fs from "fs";
import path from "path";
import * as Papa from "papaparse";

export type PlayerYearOwner = {
  player: string;
  year: number;
  owner: string;
  fantasy_points: number;
};

function safeRead(p: string): string | null {
  try { return fs.readFileSync(p, "utf-8"); } catch { return null; }
}

export function loadPlayerHistory(): PlayerYearOwner[] {
  // 1) Try JSON first
  const jsonPath = path.join(process.cwd(), "data", "player_year_owner_points.json");
  const j = safeRead(jsonPath);
  if (j) {
    try {
      const rows = JSON.parse(j) as PlayerYearOwner[];
      if (Array.isArray(rows) && rows.length) return rows;
    } catch {}
  }

  // 2) Fallback: read and aggregate from CSV
  const csvPath = path.join(process.cwd(), "data", "history.csv");
  const csv = safeRead(csvPath);
  if (!csv) return [];

  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const rows = (parsed.data as any[]).map(r => ({
    player: String(r.player ?? "").trim(),
    year: Number(r.year),
    owner: String(r.owner ?? "").trim(),
    fantasy_points: Number(r.fantasy_points),
  }))
  // filter junk
  .filter(r => r.player && Number.isFinite(r.year) && r.owner && Number.isFinite(r.fantasy_points));

  // group by (player, year, owner) and sum points
  const key = (r: PlayerYearOwner) => `${r.player.toLowerCase()}|${r.year}|${r.owner.toLowerCase()}`;
  const map = new Map<string, PlayerYearOwner>();
  for (const r of rows) {
    const k = key(r);
    const cur = map.get(k);
    if (cur) cur.fantasy_points += r.fantasy_points;
    else map.set(k, { ...r });
  }

  return Array.from(map.values());
}
