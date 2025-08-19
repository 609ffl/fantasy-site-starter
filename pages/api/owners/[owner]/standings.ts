import type { NextApiRequest, NextApiResponse } from "next";
import { loadOwnerStandings } from "../../../../lib/loadOwnerStandings";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = (req.query.owner as string) || "";
  const owner = decodeURIComponent(raw).trim().toLowerCase();

  const rows = loadOwnerStandings()
    .filter((r) => r.owner.trim().toLowerCase() === owner)
    .sort((a, b) => a.year - b.year);

  res.status(200).json(rows);
}
