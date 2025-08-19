// pages/api/scoreboard.ts
import type { NextApiRequest, NextApiResponse } from "next";

const { LEAGUE_ID = "8379", SEASON = "2025", SWID, ESPN_S2 } = process.env;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Standardize helper signatures as (leagueId, season, [extra])
const URLS: Array<(l: string, s: string, w?: string) => string> = [
  // matchup score (read replica)
  (l: string, s: string) =>
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${s}/segments/0/leagues/${l}?view=mMatchupScore`,
  // matchup score (primary)
  (l: string, s: string) =>
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${s}/segments/0/leagues/${l}?view=mMatchupScore`,
  // specific week boxscore (make w optional to satisfy TS)
  (l: string, s: string, w?: string) =>
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${s}/segments/0/leagues/${l}?view=mBoxscore&scoringPeriodId=${w ?? ""}`,
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const week = (req.query.week as string) || "1";
  const season = (req.query.season as string) || SEASON;

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent": UA,
    Referer: "https://fantasy.espn.com/",
  };
  if (SWID && ESPN_S2) headers.Cookie = `SWID=${SWID}; espn_s2=${ESPN_S2}`;

  try {
    // Try two endpoints for the same view (some leagues require cookies / different hosts)
    for (let i = 0; i < 2; i++) {
      const url = URLS[i](LEAGUE_ID, season);
      const r = await fetch(url, { headers, redirect: "follow" });
      const txt = await r.text();
      if (txt.trim().startsWith("{")) {
        return sendResponse(req, res, txt, week, season);
      }
    }

    // Fallback: pull specific week boxscore
    const boxUrl = URLS[2](LEAGUE_ID, season, week);
    const rb = await fetch(boxUrl, { headers, redirect: "follow" });
    const tb = await rb.text();
    if (tb.trim().startsWith("{")) {
      return sendResponse(req, res, tb, week, season);
    }

    return res.status(502).json({
      error: "ESPN did not return JSON after following redirects.",
      preview: (tb || "").slice(0, 400),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Unknown error" });
  }
}

function sendResponse(
  req: NextApiRequest,
  res: NextApiResponse,
  raw: string,
  week: string,
  season: string
) {
  if (req.query.summary) {
    const data = JSON.parse(raw);
    const weekNum = parseInt(week, 10);

    const weekSchedule = (data.schedule ?? []).filter(
      (m: any) => m.matchupPeriodId === weekNum
    );

    const games = weekSchedule
      .map((m: any) => ({
        id: m.id,
        homeTeamId: m.home?.teamId ?? null,
        homePoints: m.home?.totalPoints ?? 0,
        awayTeamId: m.away?.teamId ?? null,
        awayPoints: m.away?.totalPoints ?? 0,
        periodId: m.matchupPeriodId ?? null,
      }))
      .filter((g: any) => g.homeTeamId !== null && g.awayTeamId !== null)
      .slice(0, 6);

    return res.status(200).json({ season, league: LEAGUE_ID, week, games });
  }

  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(raw);
}
