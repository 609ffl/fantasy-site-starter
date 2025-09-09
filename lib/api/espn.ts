// lib/api/espn.ts
import { Team, Matchup, LeagueSettings } from "../standings/types";

/** Fetch one week explicitly from the read cluster (robust for future weeks). */
async function fetchWeekJSON(
  season: string,
  leagueId: string,
  week: number,
  headers: Record<string, string>
) {
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mMatchupScore&scoringPeriodId=${week}`;
  const res = await fetch(url, { headers, redirect: "manual" });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!res.ok || !ct.includes("application/json")) {
    throw new Error(`Week ${week} fetch failed: ${res.status} ${ct} :: ${text.slice(0, 160)}`);
  }
  return JSON.parse(text);
}

/** Fetch from ESPN; request multiple views; fallback-derive records from schedule if needed. */
export async function fetchLeague(): Promise<{
  teams: Team[];
  matchups: Matchup[];
  settings: LeagueSettings;
}> {
  const season = process.env.SEASON!;
  const leagueId = process.env.LEAGUE_ID!;
  const swid = process.env.SWID || "";
  const s2 = process.env.ESPN_S2 || ""; // cookie value for cookie named "espn_s2"

  const cookie = swid && s2 ? `SWID=${swid}; espn_s2=${s2}` : "";

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
    Referer: `https://fantasy.espn.com/football/league?leagueId=${leagueId}`,
    Origin: "https://fantasy.espn.com",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (cookie) headers.Cookie = cookie;

  // Primary: try to get everything in one go
  const baseA = `https://fantasy.espn.com`;
  const baseB = `https://lm-api-reads.fantasy.espn.com`;
  const qs = `view=mTeam&view=mMatchupScore&view=mSettings&view=mSchedule`;
  const urlA = `${baseA}/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?${qs}`;
  const urlB = `${baseB}/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?${qs}`;

  async function get(url: string) {
    const res = await fetch(url, { headers, redirect: "manual" });
    const ct = res.headers.get("content-type") || "";
    const loc = res.headers.get("location") || "";
    const text = await res.text();
    if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status} ${ct} -> ${loc} :: ${text.slice(0, 160)}`);
    if (!ct.includes("application/json"))
      throw new Error(`ESPN returned non-JSON: ${res.status} ${ct} -> ${loc} :: ${text.slice(0, 160)}`);
    return JSON.parse(text);
  }

  let json: any;
  try {
    json = await get(urlA);
  } catch {
    json = await get(urlB);
  }

  // League settings
  const settings: LeagueSettings = {
    playoffSeeds: json?.settings?.playoffTeamCount ?? 6,
    weeks: json?.status?.finalScoringPeriod ?? 17,
    tiebreakers: ["headToHead", "pointsFor", "divisionRecord", "pointsAgainst"],
  };

  // ---- Ensure we have the full schedule ----
  let schedule: any[] = Array.isArray(json?.schedule) ? json.schedule : [];
  const weeksInSchedule = new Set<number>(schedule.map((m: any) => m.matchupPeriodId).filter(Boolean));

  if (weeksInSchedule.size <= 1) {
    // ESPN only sent the current/first week — fetch weeks 2..N explicitly
    const extra: any[] = [];
    for (let w = 2; w <= settings.weeks; w++) {
      try {
        const wJson = await fetchWeekJSON(String(season), String(leagueId), w, headers);
        if (Array.isArray(wJson?.schedule)) extra.push(...wJson.schedule);
      } catch (e) {
        // Non-fatal — continue gathering other weeks
        console.warn("week fetch error", w, e);
      }
    }
    schedule = [...schedule, ...extra];
  }

  // Deduplicate schedule by ESPN id (or synthesize one if missing)
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const m of schedule) {
    const id = String(m.id ?? `${m.matchupPeriodId}-${m.home?.teamId}-${m.away?.teamId}`);
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push({ ...m, id });
  }
  schedule = deduped;

  // ---- Teams (robust name fallback) ----
  const teamBasics: Record<number, Team> = {};
  for (const t of json?.teams ?? []) {
    const id = t.id;
    const name =
      [t.location, t.nickname].filter(Boolean).join(" ").trim() ||
      t.name ||
      t.teamNickname ||
      t.abbrev ||
      `Team ${id}`;

    teamBasics[id] = {
      id,
      name,
      division: t.divisionId != null ? String(t.divisionId) : undefined,
      wins: t.record?.overall?.wins ?? 0,
      losses: t.record?.overall?.losses ?? 0,
      ties: t.record?.overall?.ties ?? 0,
      pf: t.record?.overall?.pointsFor ?? 0,
      pa: t.record?.overall?.pointsAgainst ?? 0,
    };
  }

  // ---- Build matchups + (optional) derive records if ESPN didn't fill them ----
  const matchups: Matchup[] = [];
  const hasESPNRecords =
    Object.values(teamBasics).some((t) => t.wins + t.losses + t.ties > 0) ||
    Object.values(teamBasics).some((t) => t.pf + t.pa > 0);

  if (!hasESPNRecords) {
    for (const id of Object.keys(teamBasics)) {
      const n = Number(id);
      teamBasics[n].wins = 0;
      teamBasics[n].losses = 0;
      teamBasics[n].ties = 0;
      teamBasics[n].pf = 0;
      teamBasics[n].pa = 0;
    }
  }

  for (const m of schedule) {
    const homeId = m.home?.teamId;
    const awayId = m.away?.teamId;
    if (homeId == null || awayId == null) continue;

    const homeScore = m.home?.totalPoints;
    const awayScore = m.away?.totalPoints;

    matchups.push({
      id: String(m.id),
      week: m.matchupPeriodId,
      homeId,
      awayId,
      homeScore: typeof homeScore === "number" ? homeScore : undefined,
      awayScore: typeof awayScore === "number" ? awayScore : undefined,
    });

    // Derive records only when needed and we have scores
    if (!hasESPNRecords && typeof homeScore === "number" && typeof awayScore === "number") {
      const home = teamBasics[homeId];
      const away = teamBasics[awayId];
      if (!home || !away) continue;
      home.pf += homeScore;
      home.pa += awayScore;
      away.pf += awayScore;
      away.pa += homeScore;
      if (homeScore > awayScore) {
        home.wins++;
        away.losses++;
      } else if (homeScore < awayScore) {
        away.wins++;
        home.losses++;
      } else {
        home.ties++;
        away.ties++;
      }
    }
  }

  // If teams array was empty (extremely rare), synthesize from schedule ids
  if (!Object.keys(teamBasics).length) {
    const ids = new Set<number>();
    for (const m of matchups) {
      ids.add(m.homeId);
      ids.add(m.awayId);
    }
    for (const id of ids) {
      teamBasics[id] = { id, name: `Team ${id}`, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 };
    }
  }

  const teams = Object.values(teamBasics);
  return { teams, matchups, settings };
}

