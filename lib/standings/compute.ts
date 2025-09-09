import { Team, Matchup, LeagueSettings } from "./types";

export function computeStandings(teams: Team[], _matchups: Matchup[], settings: LeagueSettings) {
  const winPct = (t: Team) => {
    const g = t.wins + t.losses + t.ties;
    return g ? (t.wins + 0.5 * t.ties) / g : 0;
  };

  const sorted = [...teams].sort((a, b) => {
    const wpa = winPct(a), wpb = winPct(b);
    if (wpa !== wpb) return wpb - wpa;           // higher win% first
    if (a.pf !== b.pf) return b.pf - a.pf;       // then points for
    if (a.pa !== b.pa) return a.pa - b.pa;       // then lower points against
    return a.name.localeCompare(b.name);
  });

  const seeds = sorted.slice(0, settings.playoffSeeds).map((t) => t.id);
  return { sorted, seeds, settings };
}
