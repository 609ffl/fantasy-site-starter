import type { NextApiRequest, NextApiResponse } from "next";
import { OWNER_NAME } from "../../data/owners";

const { LEAGUE_ID = "8379", SEASON = "2025", SWID, ESPN_S2 } = process.env;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const season = (req.query.season as string) || SEASON;

  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}?view=mTeam`;
  const headers: Record<string,string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent": UA,
    Referer: "https://fantasy.espn.com/",
  };
  if (SWID && ESPN_S2) headers.Cookie = `SWID=${SWID}; espn_s2=${ESPN_S2}`;

  try {
    const r = await fetch(url, { headers, redirect: "follow" });
    const txt = await r.text();
    if (!txt.trim().startsWith("{")) {
      return res.status(502).json({ error: "ESPN did not return JSON", preview: txt.slice(0, 400) });
    }

    const data = JSON.parse(txt);
    const rawTeams = (data.teams ?? []).map((t: any) => {
      const defaultName =
        (t.location && t.nickname) ? `${t.location} ${t.nickname}` :
        (t.nickname || `Team ${t.id}`);

      const ownerNames = (t.owners || []).map((id: string) => OWNER_NAME[id]).filter(Boolean);
      const name = ownerNames.length ? ownerNames.join(" & ") : defaultName;

      return { id: t.id, name, abbrev: t.abbrev, owners: t.owners };
    });

    const sorted = [...rawTeams].sort((a, b) => a.id - b.id);
    const displayNo: Record<number, number> = {};
    sorted.forEach((t: any, i: number) => (displayNo[t.id] = i + 1));
    const teams = rawTeams.map((t: any) => ({ ...t, displayNo: displayNo[t.id] }));


    return res.status(200).json({ league: LEAGUE_ID, season, teams });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Unknown error" });
  }
}
