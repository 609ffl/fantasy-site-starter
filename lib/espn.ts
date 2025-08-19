
export function leagueUrl(leagueId: string | number, season: string | number, view = 'mMatchupScore') {
  return `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=${view}`;
}
