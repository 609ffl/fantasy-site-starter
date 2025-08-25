// lib/topOwnerPlayers.ts
import fs from "fs";
import path from "path";
import { ownerSlug } from "./slug";

type Row = { [k: string]: any };

export type TopPlayerSeason = {
  year: number;
  player: string;
  points: number;
};

// simple CSV splitter (handles quoted commas)
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function readRosterRows(): Row[] {
  const dataDir = path.join(process.cwd(), "data");
  const candidates = ["roster.csv", "rosters.csv", "roster_history.csv"];
  let filePath: string | null = null;

  for (const f of candidates) {
    const p = path.join(dataDir, f);
    if (fs.existsSync(p)) { filePath = p; break; }
  }
  if (!filePath) return [];

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];

  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  const rows: Row[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const row: any = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    rows.push(row);
  }
  return rows;
}

// Pull a numeric value from likely columns
function numberFrom(row: Row, keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

/**
 * Returns the top N player seasons for a given owner slug.
 * We try to be schema-tolerant: Owner/owner, Player/player, Year/year,
 * and Points/Total/PF columns.
 */
export function loadOwnerTopPlayers(slug: string, limit = 15): TopPlayerSeason[] {
  const rows = readRosterRows();
  if (!rows.length) return [];

  const result: TopPlayerSeason[] = [];
  for (const r of rows) {
    const ownerName = String(r.Owner ?? r.owner ?? "").trim();
    if (!ownerName) continue;
    if (ownerSlug(ownerName) !== slug) continue;

    const player = String(r.Player ?? r.player ?? "").trim();
    const year = Number(r.Year ?? r.year ?? 0);
    const points = numberFrom(r, ["Points", "points", "Total", "total", "PF", "pf"]);

    if (player && Number.isFinite(year) && Number.isFinite(points)) {
      result.push({ player, year, points });
    }
  }

  result.sort((a, b) => b.points - a.points);
  return result.slice(0, limit);
}
