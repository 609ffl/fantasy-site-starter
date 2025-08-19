import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { SWID, ESPN_S2, LEAGUE_ID, SEASON } = process.env;
  res.status(200).json({
    hasSWID: !!SWID,
    swidStartsWith: SWID?.slice(0, 2),
    hasS2: !!ESPN_S2,
    s2Len: ESPN_S2?.length ?? 0,
    league: LEAGUE_ID,
    season: SEASON
  });
}
