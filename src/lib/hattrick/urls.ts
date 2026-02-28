const HATTRICK_BASE_URL = "https://www.hattrick.org";

const buildGotoUrl = (path: string) => `${HATTRICK_BASE_URL}/goto.ashx?path=${path}`;

export const hattrickPlayerUrl = (playerId: number | string) =>
  buildGotoUrl(`/Club/Players/Player.aspx?playerId=${playerId}`);

export const hattrickMatchUrl = (matchId: number | string) =>
  buildGotoUrl(`/Club/Matches/Match.aspx?matchID=${matchId}`);

export const hattrickArticleUrl = (articleId: number | string) =>
  buildGotoUrl(`/Community/Press/?ArticleID=${articleId}`);

export const hattrickYouthPlayerUrl = (youthPlayerId: number | string) =>
  buildGotoUrl(`/Club/Players/YouthPlayer.aspx?YouthPlayerID=${youthPlayerId}`);

export const hattrickTeamUrl = (teamId: number | string) =>
  buildGotoUrl(`/Club/?TeamID=${teamId}`);

export const hattrickTeamPlayersUrl = (teamId: number | string) =>
  buildGotoUrl(`/Club/Players/?TeamID=${teamId}`);

export const hattrickTeamTransfersUrl = (teamId: number | string) =>
  buildGotoUrl(`/Club/Transfers/transfersTeam.aspx?teamId=${teamId}`);

export const hattrickSeriesUrl = (
  leagueLevelUnitId: number | string,
  teamId: number | string
) =>
  buildGotoUrl(
    `/World/Series/?LeagueLevelUnitID=${leagueLevelUnitId}&TeamID=${teamId}`
  );

export const hattrickYouthTeamUrl = (youthTeamId: number | string) =>
  buildGotoUrl(`/Club/Youth/?YouthTeamID=${youthTeamId}`);
