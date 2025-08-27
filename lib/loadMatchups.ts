// lib/loadMatchups.ts
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type Matchup = {
  aOwner: string;     // Column A
  aScore: number;     // Column B
  bScore: number;     // Column C
  bOwner: string;     // Column D
  year: number;       // Column E
};

export type H2HRow = {
  opponent: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pf: number;  // points for (vs that opponent)
  pa: number;  // points against
  diff: number;
  winPct: number; // wins + 0.5*ties over games
  lastYear: number; // most recent meeting year
};

let _cache: { matchups: Matchup[] } | null = null;

export function loadAllMatchups(): Matchup[] {
  if (_cache?.matchups) return _cache.matchups;

  const csvPath = path.join(process.cwd(), "data", "all_matchups.csv");
  const text = fs.readFileSync(csvPath, "utf8");

  // Try to gracefully handle optional header row.
  const parsed = Papa.parse<string[]>(text, {
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as any[];

  // If the first row looks like headers, drop it
  const looksLikeHeader = (r: any[]) =>
    r && r.length >= 5 &&
    typeof r[0] === "string" && /owner|team/i.test(r[0]) &&
    typeof r[3] === "string" && /owner|team/i.test(r[3]);

  const data = (looksLikeHeader(rows[0]) ? rows.slice(1) : rows)
    .filter(r => r && r.length >= 5)
    .map(r => {
      const [aOwner, aScore, bScore, bOwner, year] = r;
      return {
        aOwner: String(aOwner).trim(),
        aScore: Number(aScore),
        bScore: Number(bScore),
        bOwner: String(bOwner).trim(),
        year: Number(year),
      } as Matchup;
    });

  _cache = { matchups: data };
  return data;
}

export function computeHeadToHeadForOwner(owner: string): { rows: H2HRow[], summary: Omit<H2HRow, "opponent"> } {
  const all = loadAllMatchups();
  const rowsByOpponent = new Map<string, H2HRow>();

  const addGame = (me: string, opp: string, myScore: number, oppScore: number, yr: number) => {
    if (!rowsByOpponent.has(opp)) {
      rowsByOpponent.set(opp, {
        opponent: opp, games: 0, wins: 0, losses: 0, ties: 0,
        pf: 0, pa: 0, diff: 0, winPct: 0, lastYear: 0
      });
    }
    const row = rowsByOpponent.get(opp)!;
    row.games += 1;
    row.pf += myScore;
    row.pa += oppScore;
    row.diff = row.pf - row.pa;
    if (myScore > oppScore) row.wins += 1;
    else if (myScore < oppScore) row.losses += 1;
    else row.ties += 1;
    row.lastYear = Math.max(row.lastYear, yr);
  };

  for (const m of all) {
    // owner could be in column A or D
    if (m.aOwner === owner) addGame(m.aOwner, m.bOwner, m.aScore, m.bScore, m.year);
    if (m.bOwner === owner) addGame(m.bOwner, m.aOwner, m.bScore, m.aScore, m.year);
  }

  const rows = Array.from(rowsByOpponent.values()).map(r => ({
    ...r,
    winPct: r.games ? (r.wins + 0.5 * r.ties) / r.games : 0
  }));

  // Build overall summary
  const summary = rows.reduce((acc, r) => {
    acc.games += r.games;
    acc.wins += r.wins;
    acc.losses += r.losses;
    acc.ties += r.ties;
    acc.pf += r.pf;
    acc.pa += r.pa;
    acc.diff = acc.pf - acc.pa;
    acc.lastYear = Math.max(acc.lastYear, r.lastYear);
    return acc;
  }, {
    games: 0, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, diff: 0, winPct: 0, lastYear: 0
  });

  summary.winPct = summary.games ? (summary.wins + 0.5 * summary.ties) / summary.games : 0;

  // Sort by best win%, then by games desc
  rows.sort((a, b) => {
  // primary: most wins
  if (b.wins !== a.wins) return b.wins - a.wins;
  // secondary: more games
  if (b.games !== a.games) return b.games - a.games;
  // tertiary: higher win%
  if (b.winPct !== a.winPct) return b.winPct - a.winPct;
  // last tie-breaker: alphabetical by opponent
  return a.opponent.localeCompare(b.opponent);
  });

  return { rows, summary };
}
