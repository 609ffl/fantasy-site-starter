import type { NextApiRequest, NextApiResponse } from "next";
import { fetchLeague } from "../../lib/api/espn";
import { computeStandings } from "../../lib/standings/compute";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const { teams, matchups, settings } = await fetchLeague();
    const table = computeStandings(teams, matchups, settings);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ ...table, teams, matchups });
  } catch (e: any) {
    console.error("standings error:", e);
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
