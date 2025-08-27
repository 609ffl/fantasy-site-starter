// pages/api/player-blurb.ts
// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".next", "cache", "player-blurbs");
fs.mkdirSync(CACHE_DIR, { recursive: true });

function loadFacts() {
  const p = path.join(process.cwd(), "public", "data", "player_facts.json");
  if (!fs.existsSync(p)) throw new Error("player_facts.json not found. Run build:facts first.");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function promptFromFacts(f: any) {
  // champ_contributions is an array: [{ year, owner, team_name }]
  const champs = Array.isArray(f.champ_contributions) ? f.champ_contributions : [];
  const champLines = champs.length
    ? champs.map((c: any) => `${c.year}: ${c.team_name} (${c.owner})`).join("; ")
    : "n/a";

  return `
You are a fantasy-football beat writer covering the 609MFFL.
Write a 2–4 sentence blurb about this player's career in this league.
Tone: balanced sportswriter; factual first; light, tasteful humor allowed; no profanity.
Praise truly elite seasons; gently poke repeated underperformance. No speculation.

Facts:
- Player: ${f.player} (${f.position})
- Seasons: ${f.seasons} (${f.season_years.join(", ")})
- Total points: ${f.total_points}; Avg per season: ${f.avg_season}
- Best: ${f.best_season.year} (${f.best_season.points} pts, owner: ${f.best_season.owner})
- Worst: ${f.worst_season.year} (${f.worst_season.points} pts, owner: ${f.worst_season.owner})
- Owners: ${f.owners.join(", ")}
- Most owned by: ${f.most_owned_by ?? "n/a"}
- Championships contributed: ${f.championships}
- Championship details: ${champLines}
- Avg playoff seed when rostered: ${f.avg_seed_when_rostered ?? "n/a"}
- Pos accolades: top-3 finishes ${f.top3_pos_finishes}; below-replacement years ${f.below_replacement_years}

Guidance:
- If exactly one championship contribution, name the team, owner, and year in one concise clause.
- If multiple, summarize the years (and optionally the most notable team/owner once).

After the blurb, output a "Notable Facts" section with 0–4 bullets.
Rules for bullets:
- Only include bullets if facts are genuinely notable (records, extremes, championships, repeated bust years, etc).
- Average/forgettable players: 0–1 bullet.
- Elite or infamous players: up to 4 bullets.
- Keep each bullet under 12 words and strictly factual.

Return JSON ONLY:
{"blurb": "...", "bullets": ["...", "..."] }
`.trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const name = (req.query.name || req.body?.name || "").toString().trim();
    if (!name) return res.status(400).json({ error: "Missing ?name=" });

    const facts = loadFacts();
    const f = facts.find((x: any) => x.player.toLowerCase() === name.toLowerCase());
    if (!f) return res.status(404).json({ error: "Player not found in facts" });

    const champYears = (Array.isArray(f.championship_years) ? f.championship_years : []).join("-");
    const key = `${f.player.replace(/[^\w-]/g, "_")}-${f.total_points}-${f.avg_season}-${f.championships}-${champYears}.json`;
    const cacheFile = path.join(CACHE_DIR, key);
    if (fs.existsSync(cacheFile)) {
      return res.status(200).json(JSON.parse(fs.readFileSync(cacheFile, "utf8")));
    }

    // ---- LLM call (wire later) ----
    // const completion = await openai.chat.completions.create({
    //   model: "gpt-5-thinking",
    //   messages: [{ role: "user", content: promptFromFacts(f) }],
    //   temperature: 0.6,
    //   max_tokens: 220,
    // });
    // const out = JSON.parse(completion.choices[0].message.content);

    // ---- TEMP placeholder: fact-driven text so route works immediately ----
    const champs = Array.isArray(f.champ_contributions) ? f.champ_contributions : [];
    let champLine = "";
    if (champs.length === 1) {
      const c = champs[0];
      champLine = ` He was part of ${c.team_name}’s ${c.year} title under ${c.owner}.`;
    } else if (champs.length > 1) {
      const years = champs.map((c: any) => c.year).sort().join(", ");
      champLine = ` Title contributor in ${years}.`;
    }

    const out = {
      blurb:
        `${f.player} has appeared in ${f.seasons} seasons, averaging ${f.avg_season} points with a ${f.best_season.year} peak at ${f.best_season.points}. ` +
        `Most owned by ${f.most_owned_by || "various managers"}, he logged ${f.top3_pos_finishes} top-3 finishes and contributed to ${f.championships} championship team${f.championships === 1 ? "" : "s"}.` +
        champLine,
      bullets: (() => {
        const arr: string[] = [];
        // Pos accolades
        if (f.top3_pos_finishes >= 1)
          arr.push(`Top-3 ${f.position} in ${f.top3_pos_finishes} season(s)`);
        // Specific championship bullets (most recent first, cap at 2 for brevity)
        if (champs.length) {
          champs
            .slice() // copy
            .sort((a: any, b: any) => b.year - a.year)
            .slice(0, 2)
            .forEach((c: any) => {
              arr.push(`${c.year} Champion: ${c.team_name} (${c.owner})`);
            });
        }
        // Peak + liability info
        arr.push(`Career high ${f.best_season.points} points (${f.best_season.year})`);
        if (f.below_replacement_years >= 2)
          arr.push(`${f.below_replacement_years} below-replacement seasons`);

        // Adaptive trim for average/forgettable players
        const isAverage =
          f.top3_pos_finishes === 0 &&
          f.championships === 0 &&
          f.below_replacement_years < 2;
        return (isAverage ? arr.slice(0, 1) : arr.slice(0, 4));
      })(),
    };

    fs.writeFileSync(cacheFile, JSON.stringify(out, null, 2));
    return res.status(200).json(out);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate player blurb" });
  }
}
