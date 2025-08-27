// pages/api/headtohead/[owner].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { computeHeadToHeadForOwner } from "../../../lib/loadMatchups";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const owner = String(req.query.owner || "").trim();
  if (!owner) return res.status(400).json({ error: "owner is required" });

  try {
    const { rows, summary } = computeHeadToHeadForOwner(owner);
    return res.status(200).json({ owner, rows, summary });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "failed to compute head-to-head" });
  }
}
