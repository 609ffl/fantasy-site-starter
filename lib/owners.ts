// lib/owners.ts
import fs from "fs";
import path from "path";

// ---------- Types ----------
export type Season = { year: number; wins: number; losses: number; finish?: string };
export type Entry = {
  slug: string;
  teamName: string;
  ownerDisplay: string;
  logoSrc: string;
  record: { wins: number; losses: number; ties?: number };
  playoffs: number;
  championships: number;
  seasons: Season[];
  // ✅ No null here — either the object or undefined
  colors?: { primary: string; accent: string; dark: string };
};

// ---------- OPTIONAL: override team name / colors / custom logo path ----------
const LOGOS: Record<string, { src?: string; teamName?: string; colors?: Entry["colors"] }> = {
  "g-nulty": {
    src: "/logos/goon-squad.png",
    teamName: "Marshall Ave Goon Squad",
    colors: { primary: "#9e2f2f", accent: "#e5d5a5", dark: "#1f3e6b" },
  },
  // add more owners here only if you want a nicer teamName or colors
};

// ---------- Utilities ----------
export function ownerSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Auto-detect a logo file by slug: /public/logos/<slug>.png
function detectLogo(slug: string): string | null {
  const p = path.join(process.cwd(), "public", "logos", `${slug}.png`);
  return fs.existsSync(p) ? `/logos/${slug}.png` : null;
}

// Get final brand (logoSrc, teamName, colors)
function getBrand(slug: string, ownerDisplay: string) {
  const override = LOGOS[slug] || {};
  const auto = detectLogo(slug);
  return {
    logoSrc: override.src ?? auto ?? "/logos/609ffl-logo.png",
    teamName: override.teamName ?? ownerDisplay,
    // ✅ Do NOT force null — leave undefined if missing
    colors: override.colors,
  };
}

// Normalize owner name for matching across files
function normOwner(name: string) {
  return (name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------- CSV helpers ----------
type Row = { Year: string; Owner: string; Record: string; Result?: string; [k: string]: any };

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseRecord(rec: string) {
  const parts = String(rec).split("-");
  const w = Number(parts[0] || 0) || 0;
  const l = Number(parts[1] || 0) || 0;
  const t = Number(parts[2] || 0) || 0;
  return { w, l, t };
}

function isPlayoff(result?: string) {
  if (!result) return false;
  const r = result.toLowerCase();
  if (/(dnq|did\s*not|miss(ed)?\s*playoffs)/i.test(r)) return false;
  return true;
}

function isChampionship(result?: string) {
  if (!result) return false;
  return /champ/i.test(result);
}

// Read owner-season rows safely; return [] if the file is missing or invalid
export function readRows(): Row[] {
  try {
    const file = path.join(process.cwd(), "data", "owner_year_standings.csv");
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return [];
    const [headerLine, ...lines] = raw.split(/\r?\n/);
    const headers = splitCsvLine(headerLine);
    const out: Row[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = splitCsvLine(line);
      const row: any = {};
      headers.forEach((h, i) => (row[h] = cells[i]));
      out.push(row as Row);
    }
    return out;
  } catch {
    return [];
  }
}

/** --------- career_records.csv (column D = Playoff Apps) ----------

- Location: data/career_records.csv
- If headers exist, we try to find columns named like "Owner" and "Playoff Apps".
- If no headers, we assume:
    A = Owner (index 0)
    D = Playoff Apps (index 3)

Returns a map: normalizedOwner -> numberOfApps
*/
function tryReadCareerRecords(): Record<string, number> {
  const map: Record<string, number> = {};
  try {
    const file = path.join(process.cwd(), "data", "career_records.csv");
    if (!fs.existsSync(file)) return map;
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return map;

    const [first, ...rest] = raw.split(/\r?\n/);
    const headerCells = splitCsvLine(first);
    const hasHeader =
      headerCells.some((h) => /owner/i.test(h)) ||
      headerCells.some((h) => /playoff/i.test(h));

    const put = (owner: string, apps: string | number | undefined) => {
      const key = normOwner(owner);
      const n = Number(apps);
      if (!key) return;
      if (!Number.isNaN(n)) map[key] = n;
    };

    if (hasHeader) {
      const idxOwner = headerCells.findIndex((h) => /owner/i.test(h));
      const idxApps = headerCells.findIndex((h) => /(playoff).*(apps?)/i.test(h));
      for (const line of rest) {
        if (!line.trim()) continue;
        const cells = splitCsvLine(line);
        const owner = cells[idxOwner] ?? "";
        const apps = cells[idxApps] ?? "";
        put(owner, apps);
      }
    } else {
      // No headers: use first line as data too
      for (const line of [first, ...rest]) {
        if (!line.trim()) continue;
        const cells = splitCsvLine(line);
        const owner = cells[0] ?? ""; // A
        const apps = cells[3] ?? "";  // D
        put(owner, apps);
      }
    }
  } catch {
    // swallow and return whatever we parsed so far
  }
  return map;
}

// ---------- Build entries from CSV ----------
export function buildEntriesFromRows(rows: Row[]): Entry[] {
  const byOwner: Record<string, Season[]> = {};

  for (const r of rows) {
    const owner = (r.Owner || "").trim();
    if (!owner) continue;
    const { w, l } = parseRecord(r.Record || "");
    const finish = (r.Result || "").trim() || undefined;
    const year = Number(r.Year);
    if (!byOwner[owner]) byOwner[owner] = [];
    byOwner[owner].push({ year, wins: w, losses: l, finish });
  }

  // Read career totals (column D) and map by normalized owner
  const careerPlayoffMap = tryReadCareerRecords();

  const entries: Entry[] = [];

  for (const owner of Object.keys(byOwner)) {
    const seasons = byOwner[owner].sort((a, b) => a.year - b.year);
    const totals = seasons.reduce(
      (acc, s) => {
        acc.wins += s.wins;
        acc.losses += s.losses;
        if (isPlayoff(s.finish)) acc.playoffs += 1;       // computed fallback
        if (isChampionship(s.finish)) acc.championships += 1;
        return acc;
      },
      { wins: 0, losses: 0, playoffs: 0, championships: 0 }
    );

    // Override playoffs with the master sheet (career_records.csv column D)
    const overridePlayoffs = careerPlayoffMap[normOwner(owner)];
    const playoffsFinal =
      typeof overridePlayoffs === "number" ? overridePlayoffs : totals.playoffs;

    const slug = ownerSlug(owner);
    const { logoSrc, teamName, colors } = getBrand(slug, owner);

    entries.push({
      slug,
      teamName,
      ownerDisplay: owner,
      logoSrc,
      record: { wins: totals.wins, losses: totals.losses },
      playoffs: playoffsFinal,                 // <-- from career_records when available
      championships: totals.championships,     // still computed from season results
      seasons,
      // ✅ Do NOT coerce to null; pass through (undefined when absent)
      colors,
    });
  }

  return entries;
}

// ---------- Public API ----------
export function getAllOwnerEntries(): Entry[] {
  return buildEntriesFromRows(readRows());
}

export function getOwnerEntryBySlug(slug: string): Entry | null {
  const all = getAllOwnerEntries();
  return all.find((e) => e.slug === slug) ?? null;
}
