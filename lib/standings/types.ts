export type Team = {
  id: number;
  name: string;
  division?: string;
  wins: number;
  losses: number;
  ties: number;
  pf: number; // points for (to date)
  pa: number; // points against (to date)
};

export type Matchup = {
  id: string;
  week: number;
  homeId: number;
  awayId: number;
  homeScore?: number; // present if completed
  awayScore?: number; // present if completed
};

export type LeagueSettings = {
  playoffSeeds: number;
  weeks: number;
  tiebreakers: Array<"headToHead" | "pointsFor" | "divisionRecord" | "pointsAgainst">;
};
