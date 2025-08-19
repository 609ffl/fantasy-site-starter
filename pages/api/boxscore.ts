import type { NextApiRequest, NextApiResponse } from "next";

const { LEAGUE_ID = "8379", SEASON = "2025", SWID, ESPN_S2 } = process.env;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Lineup slot labels (lineupSlotId) */
const LINEUP_SLOT: Record<number, string> = {
  0: "QB",
  2: "RB",
  3: "RB/WR",
  4: "WR",
  5: "WR/TE",
  6: "TE",
  7: "OP",
  16: "D/ST",
  17: "K",
  20: "Bench",
  21: "IR",
  23: "FLEX",
};

/** Position labels (player.defaultPositionId) */
const POSITION: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "D/ST",
};

function detectBasePosition(player: any): string {
  const dp = player?.defaultPositionId;
  if (Number.isInteger(dp) && POSITION[dp!]) return POSITION[dp!];
  const elig: number[] = Array.isArray(player?.eligibleSlots) ? player.eligibleSlots : [];
  if (elig.includes(0)) return "QB";
  if (elig.includes(2) || elig.includes(3) || elig.includes(23)) return "RB";
  if (elig.includes(4) || elig.includes(5)) return "WR";
  if (elig.includes(6)) return "TE";
  if (elig.includes(17)) return "K";
  if (elig.includes(16)) return "D/ST";
  return "—";
}

function sumAppliedStats(obj: any): number {
  if (!obj || typeof obj !== "object") return 0;
  return Object.values(obj).reduce((s: number, v: any) => s + (typeof v === "number" ? v : 0), 0);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const week = (req.query.week as string) || "1";
  const season = (req.query.season as string) || SEASON;
  const matchupId = parseInt((req.query.matchupId as string) || "", 10);

  if (!Number.isInteger(matchupId)) {
    return res.status(400).json({ error: "matchupId (number) is required" });
  }

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent": UA,
    Referer: "https://fantasy.espn.com/",
  };
  if (SWID && ESPN_S2) headers.Cookie = `SWID=${SWID}; espn_s2=${ESPN_S2}`;

  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mBoxscore&scoringPeriodId=${week}`;

  try {
    const r = await fetch(url, { headers, redirect: "follow" });
    const txt = await r.text();
    if (!txt.trim().startsWith("{")) {
      return res.status(502).json({ error: "ESPN did not return JSON (boxscore).", preview: txt.slice(0, 300) });
    }

    const data = JSON.parse(txt);
    const matchup = (data.schedule || []).find((m: any) => m.id === matchupId);
    if (!matchup) return res.status(404).json({ error: "Matchup not found for that week" });

    // Prefer matchup-week snapshot; fall back to current ONLY if missing
    const entriesFor = (side: any) => ({
      mp: Array.isArray(side?.rosterForMatchupPeriod?.entries) ? side.rosterForMatchupPeriod.entries : [],
      cur: Array.isArray(side?.rosterForCurrentScoringPeriod?.entries) ? side.rosterForCurrentScoringPeriod.entries : [],
    });

    const pointsForEntry = (entry: any, weekNum: number) => {
      const direct =
        entry.appliedTotal ??
        entry.appliedStatTotal ??
        entry.playerPoolEntry?.appliedTotal ??
        entry.playerPoolEntry?.appliedStatTotal;
      if (typeof direct === "number") return Number((direct as number).toFixed?.(2) ?? direct);

      const stats =
        entry.playerPoolEntry?.player?.stats ||
        entry.playerPoolEntry?.stats ||
        entry.stats ||
        [];
      if (Array.isArray(stats) && stats.length) {
        const actual =
          stats.find((s: any) => s.scoringPeriodId === weekNum && s.statSourceId === 1) ||
          stats.find((s: any) => s.scoringPeriodId === weekNum);
        if (actual) {
          const at =
            actual.appliedTotal ??
            actual.appliedStatTotal ??
            sumAppliedStats(actual.appliedStats);
          if (typeof at === "number") return Number((at as number).toFixed?.(2) ?? at);
        }
      }
      return 0;
    };

    const mapSide = (side: any) => {
      const { mp, cur } = entriesFor(side);

      // Starters: take from matchup-period snapshot (non Bench/IR)
      const startersEntries = (mp.length ? mp : cur).filter((e: any) => e.lineupSlotId !== 20 && e.lineupSlotId !== 21);

      // Bench: prefer mp bench; if none in mp, pull bench from current snapshot
      let benchEntries = mp.filter((e: any) => e.lineupSlotId === 20 || e.lineupSlotId === 21);
      if (!benchEntries.length) {
        // pull bench from current that isn't already in starters (by playerId)
        const starterIds = new Set(
          startersEntries.map((e: any) => e.playerId ?? e.playerPoolEntry?.player?.id ?? e.playerPoolEntry?.id)
        );
        benchEntries = cur.filter((e: any) => {
          if (e.lineupSlotId !== 20 && e.lineupSlotId !== 21) return false;
          const pid = e.playerId ?? e.playerPoolEntry?.player?.id ?? e.playerPoolEntry?.id;
          return !starterIds.has(pid);
        });
      }

      const mapEntry = (e: any) => {
        const p = e.playerPoolEntry?.player;
        const name = p?.fullName || (p?.firstName && p?.lastName ? `${p.firstName} ${p.lastName}` : "Player");
        const nflTeam = p?.proTeamAbbreviation || "";
        const slotId = e.lineupSlotId;
        const slot =
          slotId === 0 && (p?.defaultPositionId ?? 1) !== 1
            ? detectBasePosition(p)
            : (LINEUP_SLOT[slotId] ?? `Slot ${slotId}`);
        const position = detectBasePosition(p);
        const points = pointsForEntry(e, Number(week));
        return { name, nflTeam, position, slot, lineupSlotId: slotId, points: Number(points.toFixed(2)) };
      };

      return {
        starters: startersEntries.map(mapEntry),
        bench: benchEntries.map(mapEntry),
      };
    };

    const home = mapSide(matchup.home);
    const away = mapSide(matchup.away);

    return res.status(200).json({
      season, week, matchupId,
      homeTeamId: matchup.home?.teamId ?? null,
      awayTeamId: matchup.away?.teamId ?? null,
      home, away,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Unknown error" });
  }
}
