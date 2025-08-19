import type { NextApiRequest, NextApiResponse } from "next";

const { LEAGUE_ID="8379", SEASON="2025", SWID, ESPN_S2 } = process.env;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/segments/0/leagues/${LEAGUE_ID}?view=mMatchupScore`;
  const headers: Record<string,string> = { Accept: "application/json, text/plain,*/*", "User-Agent": UA, Referer: "https://fantasy.espn.com/" };
  if (SWID && ESPN_S2) headers.Cookie = `SWID=${SWID}; espn_s2=${ESPN_S2}`;

  const r = await fetch(url, { headers, redirect: "follow" });
  const txt = await r.text();
  if (!txt.trim().startsWith("{")) return res.status(200).json({ week: 1 }); // safe fallback

  const data = JSON.parse(txt);
  // Heuristic: most recent matchupPeriodId present in the schedule
  const weeks = (data.schedule ?? []).map((m:any) => m.matchupPeriodId).filter((w:number)=>Number.isInteger(w));
  const week = weeks.length ? Math.max(...weeks) : 1;
  res.status(200).json({ week });
}
