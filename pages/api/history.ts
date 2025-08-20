import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

/** ---------- Types ---------- */
type Row = Record<string, any>;

type OwnerSeason = {
  year: number;
  owner: string;
  team_name: string;
  total_points: number;
  players: Array<{
    player: string;
    nfl_team: string;
    position: string;
    fantasy_points: number;
  }>;
};

type Career = {
  owner: string;
  seasons?: number;       // number of years with a numeric entry in pivot (blanks don't count)
  total_points: number;   // TOTAL row from pivot
  pf_per_game?: number;   // PF/G row (or computed TOTAL/GAMES)
  first_year?: number;
  last_year?: number;
};

type CareerRecordRow = {
  owner: string;
  seasons?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  playoff_appearances?: number;
  championship_years?: number[];
};

/** ---------- Config (paths) ---------- */
const ROSTER_CSV =
  process.env.HISTORY_CSV || path.join(process.cwd(), "data", "history.csv");
const CAREER_PF_CSV =
  process.env.CAREER_PF_CSV || path.join(process.cwd(), "data", "career_records.csv");
const CAREER_RECORDS_CSV =
  process.env.CAREER_RECORDS_CSV ||
  path.join(process.cwd(), "data", "career_records.csv");

/** ---------- Helpers ---------- */
function readCsv(fp: string): Row[] {
  const txt = fs.readFileSync(fp, "utf8");
  const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true }) as { data: Row[] };
  return (parsed.data || []) as Row[];
}

/** strict numeric parser: blanks/—/- are NaN, commas are removed */
const asNum = (v: any) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (s === "" || s === "—" || s === "-") return NaN;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

// robust parser for "103-80-2" -> {wins:103, losses:80, ties:2}
function parseRecordTriplet(s: string | undefined | null) {
  const raw = String(s ?? "").trim();
  if (!raw) return { wins: undefined, losses: undefined, ties: undefined };
  const m = raw.match(/(-?\d+)\s*[-–]\s*(-?\d+)\s*[-–]\s*(-?\d+)/);
  if (!m) return { wins: undefined, losses: undefined, ties: undefined };
  const [, w, l, t] = m;
  return { wins: Number(w), losses: Number(l), ties: Number(t) };
}

function parseChampionshipYears(s: string | undefined | null) {
  const raw = String(s ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n)) as number[];
}

function normalizeHeaderKey(k: string) {
  const lower = (k || "").toLowerCase().trim();
  // handle the CSV's typo "Careeer Record"
  if (lower.includes("careeer record") || lower.includes("career record")) return "career_record";
  if (lower.startsWith("playoff")) return "playoff_appearances";
  return lower.replace(/\s+/g, "_");
}

function readCareerRecords(fp: string) {
  if (!fs.existsSync(fp)) return new Map<string, CareerRecordRow>();
  const txt = fs.readFileSync(fp, "utf8");
  const parsed = Papa.parse(txt, { header: true, skipEmptyLines: true }) as { data: Row[] };
  const rows = (parsed.data || []) as Row[];
  const out = new Map<string, CareerRecordRow>();

  for (const r of rows) {
    // normalize headers
    const norm: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) norm[normalizeHeaderKey(k)] = v;

    const owner = String(norm["owner"] ?? "").trim();
    if (!owner) continue;

    const seasons = asNum(norm["seasons"]);
    const playoff_appearances = asNum(norm["playoff_appearances"]);
    const { wins, losses, ties } = parseRecordTriplet(norm["career_record"]);
    const championship_years = parseChampionshipYears(norm["championships"]);

    out.set(owner, {
      owner,
      seasons: Number.isFinite(seasons) ? Number(seasons) : undefined,
      wins,
      losses,
      ties,
      playoff_appearances: Number.isFinite(playoff_appearances)
        ? playoff_appearances
        : undefined,
      championship_years,
    });
  }

  return out;
}

/** ---------- Roster CSV (tidy rows) ---------- */
const KEYMAP_ROSTER: Record<string, string> = {
  year: "year",
  season: "year",
  owner: "owner",
  manager: "owner",
  manager_name: "owner",
  team: "team_name",
  team_name: "team_name",
  franchise: "team_name",
  player: "player",
  nfl_team: "nfl_team",
  pro_team: "nfl_team",
  position: "position",
  pos: "position",
  fantasy_points: "fantasy_points",
  pf: "fantasy_points",
  points: "fantasy_points",
  pts: "fantasy_points",
  total_points: "fantasy_points",
};

function normalizeRosterRows(rows: Row[]) {
  const out: Array<{
    year: number;
    owner: string;
    team_name: string;
    player: string;
    nfl_team: string;
    position: string;
    fantasy_points: number;
  }> = [];
  for (const r0 of rows) {
    const lower: Record<string, any> = {};
    for (const [k, v] of Object.entries(r0))
      lower[(k || "").toLowerCase().trim()] = v;

    const pick = (want: string) => {
      const found = Object.keys(lower).find(
        (kk) => KEYMAP_ROSTER[kk] === want || kk === want
      );
      return found != null ? lower[found] : undefined;
    };

    const year = asNum(pick("year"));
    const owner = String(pick("owner") ?? "").trim();
    const team_name = String(pick("team_name") ?? "").trim();
    const player = String(pick("player") ?? "").trim();
    const nfl_team = String(pick("nfl_team") ?? "").trim();
    const position = String(pick("position") ?? "").trim();
    const fantasy_points = Number(pick("fantasy_points") ?? 0);

    if (owner && Number.isFinite(year)) {
      out.push({
        year,
        owner,
        team_name,
        player,
        nfl_team,
        position,
        fantasy_points,
      });
    }
  }
  return out;
}

function buildFromRoster(rosterRows: ReturnType<typeof normalizeRosterRows>) {
  const byOwner = new Map<string, OwnerSeason[]>();
  const byYear = new Map<number, OwnerSeason[]>();

  // player index: every roster appearance (for player pages)
  const playerIndex = new Map<
    string,
    Array<{
      year: number;
      owner: string;
      team_name: string;
      position: string;
      nfl_team: string;
      fantasy_points: number;
    }>
  >();

  // group by (year, owner)
  const grouped = new Map<string, typeof rosterRows>();
  for (const r of rosterRows) {
    const key = `${r.year}::${r.owner}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  for (const [key, list] of grouped) {
    const [yr, owner] = key.split("::");
    const year = Number(yr);

    const players = list
      .map((x) => {
        const appearance = {
          year,
          owner,
          team_name: x.team_name,
          position: x.position,
          nfl_team: x.nfl_team,
          fantasy_points: Number(x.fantasy_points || 0),
        };
        const pname = (x.player || "").trim();
        if (pname) {
          if (!playerIndex.has(pname)) playerIndex.set(pname, []);
          playerIndex.get(pname)!.push(appearance);
        }
        return {
          player: pname,
          nfl_team: x.nfl_team,
          position: x.position,
          fantasy_points: Number(x.fantasy_points || 0),
        };
      })
      .sort((a, b) => b.fantasy_points - a.fantasy_points);

    const total_points = players.reduce(
      (s, p) => s + (p.fantasy_points || 0),
      0
    );
    const team_name =
      list.find((x) => x.team_name)?.team_name || list[0]?.team_name || "";

    const season: OwnerSeason = {
      year,
      owner,
      team_name,
      total_points,
      players,
    };

    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner)!.push(season);

    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(season);
  }

  for (const arr of byOwner.values()) arr.sort((a, b) => a.year - b.year);
  for (const arr of byYear.values()) arr.sort((a, b) => b.total_points - a.total_points);
  for (const arr of playerIndex.values()) arr.sort((a, b) => a.year - b.year);

  return { byOwner, byYear, playerIndex };
}

/** ---------- Career PF pivot (your sheet) ----------
 * Layout:
 * Row 1 = owner names (cols B..)
 * Col A = years (2011..2024), then TOTAL, GAMES, PF/G
 */
function parseCareerPivot(fp: string) {
  const rows = readCsv(fp);
  if (!rows.length) throw new Error("Career PF CSV appears empty");

  // detect first column by years/TOTAL/GAMES/PF/G signal
  const headers = Object.keys(rows[0]);
  let firstCol = headers[0];
  let bestScore = -1;
  for (const h of headers) {
    let score = 0;
    for (const r of rows.slice(0, 60)) {
      const v = String(r[h] ?? "").trim().toUpperCase();
      if (/^\d{4}$/.test(v)) score += 2;
      if (v === "TOTAL" || v === "GAMES" || v === "PF/G") score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      firstCol = h;
    }
  }

  const tag = (r: Row) => String(r[firstCol]).trim();
  const totalRow = rows.find((r) => tag(r).toUpperCase() === "TOTAL");
  const gamesRow = rows.find((r) => tag(r).toUpperCase() === "GAMES");
  const pfgRow = rows.find((r) => tag(r).toUpperCase() === "PF/G");
  if (!totalRow) throw new Error('Could not find "TOTAL" row in career PF CSV');

  const yearRows = rows.filter((r) => /^\d{4}$/.test(tag(r)));
  const years = yearRows.map((r) => Number(tag(r))).sort((a, b) => a - b);
  const ownerCols = headers.filter((k) => k !== firstCol);

  const career: Career[] = [];
  const yearly: Record<string, Array<{ year: number; points: number }>> = {};
  const totals: Record<string, number> = {};
  const games: Record<string, number> = {};
  const pfg: Record<string, number> = {};

  for (const col of ownerCols) {
    const owner = String(col).trim();

    // count seasons as numeric rows only; blanks don't count
    const playedYears: number[] = [];
    for (const yrRow of yearRows) {
      const v = asNum(yrRow[col]);
      if (Number.isFinite(v)) {
        const yr = Number(tag(yrRow));
        playedYears.push(yr);
        if (!yearly[owner]) yearly[owner] = [];
        yearly[owner].push({ year: yr, points: Number(v.toFixed(2)) });
      }
    }
    yearly[owner]?.sort((a, b) => a.year - b.year);

    const tot = asNum(totalRow[col]);
    const gms = gamesRow ? asNum(gamesRow[col]) : NaN;
    const pg = pfgRow ? asNum(pfgRow[col]) : NaN;

    totals[owner] = Number((Number(tot) || 0).toFixed(2));
    games[owner] = Number.isFinite(gms) ? gms : NaN;
    pfg[owner] = Number.isFinite(pg)
      ? Number(pg.toFixed(2))
      : Number.isFinite(tot) && Number.isFinite(gms) && gms > 0
      ? Number((tot / gms).toFixed(2))
      : NaN;

    career.push({
      owner,
      seasons: playedYears.length || undefined,
      total_points: totals[owner],
      pf_per_game: Number.isFinite(pfg[owner]) ? pfg[owner] : undefined,
      first_year: playedYears.length ? Math.min(...playedYears) : undefined,
      last_year: playedYears.length ? Math.max(...playedYears) : undefined,
    });
  }

  career.sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));

  return {
    career,
    matrix: { years, ownerCols, yearly, totals, games, pfg },
    meta: {
      firstCol,
      owners: ownerCols.length,
      yearSpan: years.length ? `${years[0]}–${years[years.length - 1]}` : "n/a",
    },
  };
}

/** ---------- Cache ---------- */
let CACHE:
  | {
      byOwner: Map<string, OwnerSeason[]>;
      byYear: Map<number, OwnerSeason[]>;
      playerIndex: Map<
        string,
        Array<{
          year: number;
          owner: string;
          team_name: string;
          position: string;
          nfl_team: string;
          fantasy_points: number;
        }>
      >;
      careerSummary: Career[];
      pivot?: {
        years: number[];
        ownerCols: string[];
        yearly: Record<string, Array<{ year: number; points: number }>>;
        totals: Record<string, number>;
        games: Record<string, number>;
        pfg: Record<string, number>;
      };
      careerRecords?: Map<string, CareerRecordRow>;
      source: "career_pf" | "computed";
      debug?: any;
    }
  | null = null;

function ensureCache() {
  if (CACHE) return;

  const rosterRows = fs.existsSync(ROSTER_CSV)
    ? normalizeRosterRows(readCsv(ROSTER_CSV))
    : [];
  const { byOwner, byYear, playerIndex } = buildFromRoster(rosterRows);

  // Load auxiliary datasets
  const careerRecords = readCareerRecords(CAREER_RECORDS_CSV);

  if (fs.existsSync(CAREER_PF_CSV)) {
    try {
      const { career, matrix, meta } = parseCareerPivot(CAREER_PF_CSV);
      CACHE = {
        byOwner,
        byYear,
        playerIndex,
        careerSummary: career,
        pivot: matrix,
        source: "career_pf",
        debug: meta,
        careerRecords,
      };
      return;
    } catch (e: any) {
      CACHE = {
        byOwner,
        byYear,
        playerIndex,
        careerSummary: [],
        source: "computed",
        debug: { error: e?.message },
        careerRecords,
      };
      return;
    }
  }

  CACHE = {
    byOwner,
    byYear,
    playerIndex,
    careerSummary: [],
    source: "computed",
    debug: { error: "CAREER_PF_CSV not found" },
    careerRecords,
  };
}

/** ---------- Handler ---------- */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // In dev, force refresh so CSV edits are visible without server restart
    if (process.env.NODE_ENV !== "production") {
      CACHE = null;
    }
    ensureCache();

    const { summary, owner, ownerPivot, player, year, debug } = req.query;

    // Summary table (career + top seasons + year list)
    if (summary) {
      const topSeasons = Array.from(CACHE!.byYear.values())
        .flat()
        .sort((a, b) => b.total_points - a.total_points)
        .slice(0, 25);

      const payload: any = {
        career: CACHE!.careerSummary,
        topSeasons,
        years: Array.from(CACHE!.byYear.keys()).sort((a, b) => a - b),
        source: CACHE!.source,
      };
      if (debug) payload._debug = CACHE!.debug;
      return res.status(200).json(payload);
    }

    // Roster-based owner detail (players by season) + Career overview merge
    if (owner) {
      const key = String(owner);
      const list = CACHE!.byOwner.get(key) || [];

      const rec = CACHE!.careerRecords?.get(key);
      const pivot = CACHE!.pivot;
      const pivotTotal = pivot ? pivot.totals[key] : undefined;
      const pivotGames = pivot ? pivot.games[key] : undefined;
      const pivotPfg = pivot ? pivot.pfg[key] : undefined;

      const career = {
        owner: key,
        seasons: rec?.seasons ?? (list.length || undefined),
        record:
          (rec?.wins ?? rec?.losses ?? rec?.ties) != null
            ? {
                wins: rec?.wins ?? 0,
                losses: rec?.losses ?? 0,
                ties: rec?.ties ?? 0,
              }
            : undefined,
        playoff_appearances: rec?.playoff_appearances,
        championships: rec?.championship_years?.length
          ? { count: rec.championship_years.length, years: rec.championship_years }
          : { count: 0, years: [] as number[] },
        total_pf: pivotTotal ?? undefined,
        games: Number.isFinite(pivotGames) ? pivotGames : undefined,
        pf_per_game: Number.isFinite(pivotPfg) ? pivotPfg : undefined,
      };

      return res.status(200).json({ owner: key, career, seasons: list });
    }

    // Pivot-based owner yearly totals (exact)
    if (ownerPivot) {
      const key = String(ownerPivot);
      const pivot = CACHE!.pivot;
      if (!pivot)
        return res.status(404).json({ error: "Career pivot not loaded" });
      const yearly = pivot.yearly[key] || [];
      return res.status(200).json({
        owner: key,
        yearly,
        total: pivot.totals[key] ?? null,
        games: Number.isFinite(pivot.games[key]) ? pivot.games[key] : null,
        pfg: Number.isFinite(pivot.pfg[key]) ? pivot.pfg[key] : null,
        span: yearly.length
          ? `${yearly[0].year}–${yearly[yearly.length - 1].year}`
          : null,
      });
    }

    // Player → all owners/years they've appeared on
    if (player) {
      const name = String(player).trim();
      const list = CACHE!.playerIndex.get(name) || [];
      const total_points = list.reduce(
        (s, x) => s + (x.fantasy_points || 0),
        0
      );
      const owners = Array.from(new Set(list.map((x) => x.owner)));
      return res.status(200).json({
        player: name,
        appearances: list,
        owners,
        seasons: list.length,
        total_points: Number(total_points.toFixed(2)),
      });
    }

    // Year view (standings for that season)
    if (year) {
      const y = Number(year);
      const list = CACHE!.byYear.get(y) || [];
      return res.status(200).json({ year: y, seasons: list });
    }

    return res
      .status(200)
      .json({
        ok: true,
        hint:
          "Use ?summary=1 (optionally &debug=1), ?owner=Name, ?ownerPivot=Name, ?player=Name, or ?year=YYYY",
      });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
