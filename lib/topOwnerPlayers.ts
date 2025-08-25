// lib/topOwnerPlayers.ts
import fs from "fs";
import path from "path";
import { ownerSlug } from "./slug";

type Row = Record<string, any>;

export type TopPlayerSeason = {
  year: number;
  player: string;
  points: number;
};

// CSV splitter with quoted comma support
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

function readCsv(filePath: string): Row[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  const rows: Row[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const row: Row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    rows.push(row);
  }
  return rows;
}

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function pick<T = any>(row: Row, keys: string[]): T | undefined {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k] as T;
  }
  return undefined;
}

// Extract last name in a loose way (used for fallback matching)
function lastNameSlug(name: string) {
  const parts = String(name).trim().split(/\s+/);
  const last = parts[parts.length - 1] || "";
  return ownerSlug(last);
}

function listCsvFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((f) => path.join(dir, f));
}

const OWNER_KEYS = [/owner/i, /manager/i, /team\s*owner/i];
const PLAYER_KEYS = [/player/i, /^name$/i, /player\s*name/i];
const YEAR_KEYS   = [/^year$/i, /season/i];
const WEEK_KEYS   = [/^week$/i];
const POINT_KEYS  = [
  /^(points|pts)$/i,
  /^(pf|pfr|points\s*for)$/i,
  /total/i,
  /fantasy.*points/i,
  /^fpts$/i,
  /^ppr$/i,
];

// choose first header matching any of the regexes
function chooseHeader(headers: string[], patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const hit = headers.find((h) => re.test(h));
    if (hit) return hit;
  }
  return undefined;
}

// Parse one CSV file and add owner/player/year/points rows into the accumulator
function harvestFromFile(filePath: string, targetSlug: string, acc: Map<string, number>) {
  const rows = readCsv(filePath);
  if (!rows.length) return;

  const headers = Object.keys(rows[0] ?? {});
  const kOwner  = chooseHeader(headers, OWNER_KEYS);
  const kPlayer = chooseHeader(headers, PLAYER_KEYS);
  const kYear   = chooseHeader(headers, YEAR_KEYS);
  const kWeek   = chooseHeader(headers, WEEK_KEYS);
  const kPoints = chooseHeader(headers, POINT_KEYS);

  // Require at least owner, player, and some idea of points
  if (!kOwner || !kPlayer || !kPoints) return;

  // If no year column, try to infer year from filename like "..._2018.csv"
  const fileYearMatch = filePath.match(/(?:^|[^\d])(20\d{2})(?:[^\d]|$)/);
  const inferredYear = fileYearMatch ? Number(fileYearMatch[1]) : undefined;

  for (const r of rows) {
    const ownerName = String(r[kOwner] ?? "").trim();
    if (!ownerName) continue;

    const rowSlug = ownerSlug(ownerName);
    const rowLast = lastNameSlug(ownerName);
    const targetLast = lastNameSlug(targetSlug.replace(/-/g, " "));

    // match by slug, or if that fails, by last name as a fallback
    if (rowSlug !== targetSlug && rowLast !== targetLast) continue;

    const player = String(r[kPlayer] ?? "").trim();
    if (!player) continue;

    const year = kYear ? toNumber(r[kYear]) : (inferredYear ?? 0);
    // If there's a week column, it's probably weekly data; we’ll sum by (year, player)
    const points = toNumber(r[kPoints]);

    const y = Number.isFinite(year) && year > 0 ? year : 0;
    const key = `${y}|${player}`;
    acc.set(key, (acc.get(key) ?? 0) + points);
  }
}

/**
 * Load top N player seasons for an owner (by slug) scanning all CSVs in /data.
 * Supports season or weekly logs; weekly rows are summed into season totals.
 */
export function loadOwnerTopPlayers(slug: string, limit = 15): TopPlayerSeason[] {
  const dataDir = path.join(process.cwd(), "data");
  const files = listCsvFiles(dataDir);
  if (!files.length) return [];

  const totals = new Map<string, number>(); // key = `${year}|${player}` -> points

  for (const fp of files) {
    harvestFromFile(fp, slug, totals);
  }

  if (totals.size === 0) return [];

  const out: TopPlayerSeason[] = [];
  for (const [key, points] of totals) {
    const [yearStr, player] = key.split("|");
    const year = Number(yearStr) || 0;
    out.push({ year, player, points });
  }

  out.sort((a, b) => b.points - a.points);
  return out.slice(0, limit);
}
