// lib/loadMatchups.ts
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type Matchup = {
  aOwner: string;     // Col A
  aScore: number;     // Col B
  bScore: number;     // Col C
  bOwner: string;     // Col D
  year: number;       // Col E
};

export type H2HRow = {
  opponent: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pf: number;   // totals; UI computes per-game
  pa: number;   // totals; UI computes per-game
  diff: number; // pf - pa
  winPct: number;
  lastYear: number;
};

let _cache: { matchups: Matchup[] } | null = null;

export function loadAllMatchups(): Matchup[] {
  if (_cache?.matchups) return _cache.matchups;

  const csvPath = path.join(process.cwd(), "data", "all_matchups.csv");
  const text = fs.readFileSync(csvPath, "utf8");

  // Parse without generics to avoid TS complaint if @types/papaparse isn't installed
  const parsed = Papa.parse(text, {
    dynamicTyping: true,
    skipEmptyLines: true,
  }) as unknown as { data: any[] };

  const rows = Array.isArray(parsed.data) ? parsed.data : [];

  // If first row looks like headers, drop it
  const looksLikeHeader = (r: any[]) =>
    r &&
    r.length >= 5 &&
    typeof r[0] === "string" &&
    /owner|team/i.test(r[0]) &&
    typeof r[3] === "string" &&
    /owner|team/i.test(r[3]);

  const data: Matchup[] = (looksLikeHeader(rows[0]) ? rows.slice(1) : rows)
    .filter((r: any[]) => r && r.length >= 5)
    .map((r: any[]) => {
      const [aOwner, aScore, bScore, bOwner, year] = r;
      return {
        aOwner: String(aOwner).trim(),
        aScore: Number(aScore),
        bScore: Number(bScore),
        bOwner: String(bOwner).trim(),
        year: Number(year),
      };
    });

  _cache = { matchups: data };
  return data;
}

export function computeHeadToHeadForOwner(owner: string): {
  rows: H2HRow[];
  summary: Omit<H2HRow, "opponent">;
} {
  const all = loadAllMatchups();

  // Build opponent rows by aggregating from raw games
  const rowsByOpponent = new Map<string, H2HRow>();

  const addGame = (
    me: string,
    opp: string,
    myScore: number,
    oppScore: number,
    yr: number
  ) => {
    if (!rowsByOpponent.has(opp)) {
      rowsByOpponent.set(opp, {
        opponent: opp,
        games: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pf: 0,
        pa: 0,
        diff: 0,
        winPct: 0,
        lastYear: 0,
      });
    }
    const row = rowsByOpponent.get(opp)!;
    row.games += 1;
    row.pf += myScore;
    row.pa += oppScore;
    if (myScore > oppScore) row.wins += 1;
    else if (myScore < oppScore) row.losses += 1;
    else row.ties += 1;
    row.diff = row.pf - row.pa;
    row.lastYear = Math.max(row.lastYear, yr);
  };

  for (const m of all) {
    if (m.aOwner === owner) addGame(m.aOwner, m.bOwner, m.aScore, m.bScore, m.year);
    if (m.bOwner === owner) addGame(m.bOwner, m.aOwner, m.bScore, m.aScore, m.year);
  }

  const rows = Array.from(rowsByOpponent.values()).map((r) => ({
    ...r,
    winPct: r.games ? (r.wins + 0.5 * r.ties) / r.games : 0,
  }));

  // ---- SUMMARY: derive directly from raw games (no re-adding rows) ----------
  const summary = {
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    pf: 0,
    pa: 0,
    diff: 0,
    winPct: 0,
    lastYear: 0,
  };

  for (const m of all) {
    if (m.aOwner === owner || m.bOwner === owner) {
      const isA = m.aOwner === owner;
      const myScore = isA ? m.aScore : m.bScore;
      const oppScore = isA ? m.bScore : m.aScore;

      summary.games += 1;
      summary.pf += myScore;
      summary.pa += oppScore;
      if (myScore > oppScore) summary.wins += 1;
      else if (myScore < oppScore) summary.losses += 1;
      else summary.ties += 1;
      summary.lastYear = Math.max(summary.lastYear, m.year);
    }
  }
  summary.diff = summary.pf - summary.pa;
  summary.winPct = summary.games
    ? (summary.wins + 0.5 * summary.ties) / summary.games
    : 0;

  // ---- Default sort: wins desc, then games desc, then win% desc, then name ---
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.games !== a.games) return b.games - a.games;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return a.opponent.localeCompare(b.opponent);
  });

  return { rows, summary };
}
