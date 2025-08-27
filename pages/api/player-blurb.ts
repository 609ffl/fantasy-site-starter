// pages/api/player-blurb.ts
// @ts-nocheck
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

function isWritableDir(p: string) {
  try {
    fs.mkdirSync(p, { recursive: true });
    const test = path.join(p, ".writetest");
    fs.writeFileSync(test, "ok");
    fs.unlinkSync(test);
    return true;
  } catch {
    return false;
  }
}

// Prefer /tmp on serverless; fallback to .next/cache locally
const FALLBACK_CACHE = path.join(process.cwd(), ".next", "cache", "player-blurbs");
const TMP_CACHE = "/tmp/player-blurbs";
const CACHE_DIR = isWritableDir(TMP_CACHE) ? TMP_CACHE : FALLBACK_CACHE;
isWritableDir(CACHE_DIR); // best-effort

function loadFacts() {
  const p = path.join(process.cwd(), "public", "data", "player_facts.json");
  if (!fs.existsSync(p)) throw new Error("player_facts.json not found. Run build:facts first.");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function normalize(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\./g, "")
    .replace(/['_-]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function promptFromFacts(f: any) {
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
- Extra: owner_counts ${JSON.stringify(f.owner_counts || {})}; best_pos_rank ${f.best_pos_rank ?? "n/a"}

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

    // tolerant lookup
    const qNorm = normalize(name);
    let f =
      facts.find((x: any) => normalize(x.player) === qNorm) ||
      facts.find((x: any) => normalize(x.player).includes(qNorm) || qNorm.includes(normalize(x.player)));

    // Soft fallback if not found
    if (!f) {
      return res.status(200).json({
        blurb: `${name} has appeared in the league, but no detailed stats were found in the current snapshot.`,
        bullets: [],
      });
    }

    const champYears = (Array.isArray(f.championship_years) ? f.championship_years : []).join("-");
    const cacheKey = `${f.player.replace(/[^\w-]/g, "_")}-${f.total_points}-${f.avg_season}-${f.championships}-${champYears}.json`;
    const cacheFile = path.join(CACHE_DIR, cacheKey);

    // Read cache if present (ignore errors)
    try {
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        return res.status(200).json(cached);
      }
    } catch {}

    // -------------------- Fact-driven builder (placeholder for LLM) --------------------
    const champs = Array.isArray(f.champ_contributions) ? f.champ_contributions : [];

    // Decide whether to say "Most owned by" or "Most successful owner"
    const countsObj = f.owner_counts || {};
    const maxCount =
      Object.keys(countsObj).length ? Math.max(...Object.values(countsObj)) : 0;

    let ownerClause = "";
    if (maxCount <= 1) {
      // No one owned him more than once → pick "most successful"
      if (champs.length >= 1) {
        // Prefer the most recent championship owner
        const latest = champs.slice().sort((a: any, b: any) => b.year - a.year)[0];
        ownerClause = `Most successful owner was ${latest.owner}`;
      } else {
        // Fall back to best season's owner
        ownerClause = `Most successful owner was ${f.best_season.owner}`;
      }
    } else {
      ownerClause = `Most owned by ${f.most_owned_by || "various managers"}`;
    }

    // Championship sentence
    let champLine = "";
    if (champs.length === 1) {
      const c = champs[0];
      champLine = ` He was part of ${c.team_name}’s ${c.year} title under ${c.owner}.`;
    } else if (champs.length > 1) {
      const years = champs.map((c: any) => c.year).sort().join(", ");
      champLine = ` Title contributor in ${years}.`;
    }

    // Top finish fallback if no top-3s
    let finishFallback = "";
    if ((f.top3_pos_finishes || 0) === 0) {
      const best = Number(f.best_pos_rank || Infinity);
      if (Number.isFinite(best)) {
        if (best <= 10) finishFallback = " Never cracked the top-3, but did post a top-10 positional finish.";
        else if (best <= 30) finishFallback = " Never cracked the top-3, but reached a top-30 positional finish.";
        else finishFallback = ` Never cracked the top-3; best positional rank was ${best}.`;
      } else {
        finishFallback = " Never cracked the top-3.";
      }
    }

    const out = {
      blurb:
        `${f.player} has appeared in ${f.seasons} season${f.seasons === 1 ? "" : "s"}, averaging ${f.avg_season} points with a ${f.best_season.year} peak at ${f.best_season.points}. ` +
        `${ownerClause}, he logged ${f.top3_pos_finishes} top-3 finish${f.top3_pos_finishes === 1 ? "" : "es"} and contributed to ${f.championships} championship team${f.championships === 1 ? "" : "s"}.` +
        champLine +
        finishFallback,
      bullets: (() => {
        const arr: string[] = [];

        // Specific championship bullets (most recent first, cap at 2)
        if (champs.length) {
          champs
            .slice()
            .sort((a: any, b: any) => b.year - a.year)
            .slice(0, 2)
            .forEach((c: any) => arr.push(`${c.year} Champion: ${c.team_name} (${c.owner})`));
        }

        // Peak + best positional finish bullet (if no top-3)
        arr.push(`Career high ${f.best_season.points} points (${f.best_season.year})`);
        if ((f.top3_pos_finishes || 0) === 0 && Number.isFinite(f.best_pos_rank)) {
          const best = Number(f.best_pos_rank);
          if (best <= 10) arr.push(`Best positional finish: top-10`);
          else if (best <= 30) arr.push(`Best positional finish: top-30`);
          else arr.push(`Best positional finish: ${best}th`);
        } else if ((f.top3_pos_finishes || 0) > 0) {
          arr.push(`Top-3 ${f.position} in ${f.top3_pos_finishes} season(s)`);
        }

        if (f.below_replacement_years >= 2) arr.push(`${f.below_replacement_years} below-replacement seasons`);

        // Adaptive trim
        const notable = champs.length || (f.top3_pos_finishes || 0) || (f.below_replacement_years || 0) >= 2;
        return notable ? arr.slice(0, 4) : arr.slice(0, 2);
      })(),
    };

    // write cache (ignore errors on serverless)
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(out, null, 2));
    } catch {}

    return res.status(200).json(out);
  } catch (err: any) {
    // Final soft fail so the UI shows something
    return res.status(200).json({
      blurb: "We couldn’t generate a blurb right now.",
      bullets: [],
      _debug: err?.message || "unknown error",
    });
  }
}
