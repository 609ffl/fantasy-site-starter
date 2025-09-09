// lib/standings/odds.ts
import { Team, Matchup, LeagueSettings } from "./types";
import { computeStandings } from "./compute";

function rating(t: Team) {
  const g = Math.max(1, t.wins + t.losses + t.ties);
  return (t.pf / g) - (t.pa / g);
}
function winProb(a: Team, b: Team) {
  const k = 8;
  const diff = rating(a) - rating(b);
  return 1 / (1 + Math.exp(-diff / k));
}

// ESPN sometimes encodes unplayed games as 0–0 instead of nulls.
const isUnplayed = (m: Matchup) =>
  (m.homeScore == null && m.awayScore == null) ||
  (m.homeScore === 0 && m.awayScore === 0);

/**
 * lockedResults: { [matchupId]: winnerTeamId }
 */
export function simulateOdds(
  teams: Team[],
  matchups: Matchup[],
  settings: LeagueSettings,
  sims = 10000,
  lockedResults: Record<string, number> = {}
) {
  const tallies = new Map<number, { clinch: number; seeds: number[] }>();
  teams.forEach((t) =>
    tallies.set(t.id, { clinch: 0, seeds: Array(settings.playoffSeeds).fill(0) })
  );

  // Simulate only unplayed games (null-null OR 0-0)
  const future = matchups.filter(isUnplayed);

  for (let s = 0; s < sims; s++) {
    // copy team records for this simulation
    const T = new Map<number, Team>(teams.map((t) => [t.id, { ...t }]));

    for (const m of future) {
      const home = T.get(m.homeId)!;
      const away = T.get(m.awayId)!;

      let homeWins: boolean;
      const lockedWinner = lockedResults[m.id];
      if (lockedWinner === m.homeId) homeWins = true;
      else if (lockedWinner === m.awayId) homeWins = false;
      else {
        const pHome = winProb(home, away);
        homeWins = Math.random() < pHome;
      }

      const winner = homeWins ? home : away;
      const loser  = homeWins ? away : home;
      winner.wins += 1;
      loser.losses += 1;
      // (v1: we skip PF/PA changes for simulated games)
    }

    const { sorted } = computeStandings([...T.values()], matchups, settings);
    sorted.forEach((t, idx) => {
      const rec = tallies.get(t.id)!;
      if (idx < settings.playoffSeeds) {
        rec.clinch += 1;
        rec.seeds[idx] += 1;
      }
    });
  }

  return teams.map((t) => {
    const rec = tallies.get(t.id)!;
    return {
      teamId: t.id,
      clinchPct: +(100 * rec.clinch / sims).toFixed(1),
      seedPct: rec.seeds.map((n) => +(100 * n / sims).toFixed(1)),
    };
  });
}
