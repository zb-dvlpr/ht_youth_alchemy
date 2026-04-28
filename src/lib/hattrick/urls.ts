const HATTRICK_BASE_URL = "https://www.hattrick.org";

const buildGotoUrl = (path: string) => `${HATTRICK_BASE_URL}/goto.ashx?path=${path}`;

export const hattrickPlayerUrl = (playerId: number | string) =>
  buildGotoUrl(`/Club/Players/Player.aspx?playerId=${playerId}`);

export const hattrickMatchUrl = (matchId: number | string) =>
  buildGotoUrl(`/Club/Matches/Match.aspx?matchID=${matchId}`);

export const hattrickMatchUrlWithSourceSystem = (
  matchId: number | string,
  sourceSystem?: string | null
) => {
  const normalizedSourceSystem =
    typeof sourceSystem === "string" ? sourceSystem.trim() : "";
  if (!normalizedSourceSystem) {
    return hattrickMatchUrl(matchId);
  }
  return buildGotoUrl(
    `/Club/Matches/Match.aspx?matchID=${matchId}&sourceSystem=${encodeURIComponent(normalizedSourceSystem)}`
  );
};

export const hattrickYouthMatchUrl = (
  matchId: number | string,
  teamId: number | string,
  youthTeamId: number | string
) =>
  buildGotoUrl(
    `/Club/Matches/Match.aspx?matchId=${matchId}&sourceSystem=Youth&teamId=${teamId}&youthTeamId=${youthTeamId}`
  );

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

export const hattrickForumThreadUrl = (threadId: number | string, n?: number | string) => {
  const nPart = n === undefined || n === null ? "" : `&n=${n}`;
  return buildGotoUrl(`/Forum/Read.aspx?t=${threadId}${nPart}`);
};

export const hattrickManagerUrl = (userId: number | string) =>
  buildGotoUrl(`/Club/Manager/?userId=${userId}`);

export const hattrickComposeMailUrl = (userId: number | string) =>
  buildGotoUrl(`/MyHattrick/Inbox/?actionType=newMail&userId=${userId}`);
