import type { NextApiRequest, NextApiResponse } from "next";
import { fetchLeague } from "../../lib/api/espn";
import { simulateOdds } from "../../lib/standings/odds";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sims = Number(req.query.sims ?? 5000);
    const { teams, matchups, settings } = await fetchLeague();

    let locked: Record<string, number> = {};
    if (req.method === "POST" && req.body) {
      // body: { lockedResults: { [matchupId]: winnerId } }
      if (typeof req.body === "string") {
        try { locked = JSON.parse(req.body).lockedResults ?? {}; } catch {}
      } else {
        locked = (req.body as any).lockedResults ?? {};
      }
    }

    const odds = simulateOdds(teams, matchups, settings, sims, locked);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ odds, settings });
  } catch (e: any) {
    console.error("odds error:", e);
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
