import type { NextApiRequest, NextApiResponse } from "next";
// If you don't use "@/" alias, keep this relative path:
import { loadPlayerHistory, type PlayerYearOwner } from "../../../../lib/loadHistory";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")                      // strip accents
    .replace(/\./g, "")                    // remove dots (C.J. -> CJ)
    .replace(/['_-]/g, "")                 // remove apostrophes/hyphens
    .replace(/\s+(jr|sr|ii|iii|iv)\b/g, "")// drop suffixes
    .replace(/\s+/g, " ")                  // collapse spaces
    .trim();
}

// Sometimes your sheet leaked team fragments to the end of the name like "Jay Cutler Ch"
// This trims a trailing 1–3 letter chunk if it's clearly a team fragment without a period
function trimTrailingTeamFragment(s: string) {
  const m = s.match(/^(.*?)(?:\s+[A-Za-z]{1,3})$/);
  if (!m) return s;
  // keep it only if removing makes the name closer to pure words
  const kept = m[1];
  // Heuristic: if the last word in original is <=3 letters and the kept still has at least 2 words, trim it.
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2 && parts[parts.length - 1].length <= 3) return kept;
  return s;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { player } = req.query as { player: string };
    if (!player) return res.status(400).json({ error: "Missing player parameter" });

    const rows = loadPlayerHistory(); // from JSON or CSV fallback

    const qRaw = decodeURIComponent(player).trim();
    const qMain = trimTrailingTeamFragment(qRaw);
    const qNorm = normalize(qMain);

    // Build index
    const withNorm = rows.map((r) => {
      const nameMain = trimTrailingTeamFragment(r.player || "");
      return { ...r, _norm: normalize(nameMain) };
    });

    // 1) exact normalized match
    let hits: PlayerYearOwner[] = withNorm.filter((r) => r._norm === qNorm);

    // 2) if none, try contains either way (handles extra middle initials etc.)
    if (hits.length === 0) {
      hits = withNorm.filter((r) => r._norm.includes(qNorm) || qNorm.includes(r._norm));
    }

    // 3) as last resort, split tokens and require overlap of 2+ tokens
    if (hits.length === 0) {
      const qtoks = qNorm.split(" ").filter(Boolean);
      hits = withNorm.filter((r) => {
        const rtoks = r._norm.split(" ").filter(Boolean);
        const overlap = rtoks.filter((t) => qtoks.includes(t)).length;
        return overlap >= Math.min(2, qtoks.length);
      });
    }

    // Sort nicely
    hits.sort((a, b) => a.year - b.year || a.owner.localeCompare(b.owner));

    if (hits.length > 0) {
      // Return only the public fields
      return res.status(200).json(
        hits.map(({ player, year, owner, fantasy_points }) => ({
          player,
          year,
          owner,
          fantasy_points,
        }))
      );
    }

    // If still nothing, return top 10 suggestions so the UI has something useful to show
    const suggestions = Array.from(
      new Set(
        withNorm
          .filter((r) => r._norm.includes(qNorm.split(" ")[0] || "")) // share first token
          .map((r) => r.player)
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 10);

    return res.status(200).json({ suggestions, found: [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
}
