// pages/api/owner-top-players.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { loadOwnerTopPlayers } from "../../lib/topOwnerPlayers";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const owner = String(req.query.owner || "");
  if (!owner) return res.status(400).json({ error: "owner (slug) required" });

  try {
    const topPlayers = loadOwnerTopPlayers(owner, 15);
    return res.status(200).json({ topPlayers });
  } catch (e) {
    return res.status(200).json({ topPlayers: [] });
  }
}
