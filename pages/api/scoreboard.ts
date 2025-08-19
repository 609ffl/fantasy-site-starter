import type { NextApiRequest, NextApiResponse } from "next";
import { leagueUrl } from "../../lib/espn";

const { LEAGUE_ID = "8379", SEASON = "2025", SWID, ESPN_S2 } = process.env;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const URLS = [
  (s: string, l: string) =>
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${s}/segments/0/leagues/${l}?view=mMatchupScore`,
  (s: string, l: string) =>
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${s}/segments/0/leagues/${l}?view=mMatchupScore`,
  (s: string, l: string, w: string) =>
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${s}/segments/0/leagues/${l}?view=mBoxscore&scoringPeriodId=${w}`,
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
    for (let i = 0; i < 2; i++) {
      const view = i === 0 ? "mMatchupScore" : "mTeam";
      const url = URLS[i](LEAGUE_ID, season, view);
      const r = await fetch(url, { headers, redirect: "follow" });
      const txt = await r.text();
      if (txt.trim().startsWith("{")) {
        return sendResponse(req, res, txt, week, season);
      }
    }

    const boxUrl = URLS[2](season, LEAGUE_ID, week);
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
      type GameLike = { homeTeamId: number | null; awayTeamId: number | null };
      ...
      .filter((g: GameLike) => g.homeTeamId !== null && g.awayTeamId !== null)

      .slice(0, 6);

    return res.status(200).json({ season, league: LEAGUE_ID, week, games });
  }

  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(raw);
}
