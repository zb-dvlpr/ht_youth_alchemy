export type MatchLike = {
  MatchID?: number | string;
  MatchDate?: string;
  Status?: string;
  OrdersGiven?: string | boolean;
  MatchType?: number | string;
  SourceSystem?: string;
  HomeTeam?: {
    HomeTeamName?: string;
    HomeTeamID?: number | string;
  };
  AwayTeam?: {
    AwayTeamName?: string;
    AwayTeamID?: number | string;
  };
};

export const DEFAULT_VISIBLE_MATCH_TYPES = new Set<number>([1, 2, 3, 4, 5, 8, 9]);
export const TOURNAMENT_MATCH_TYPES = new Set<number>([50, 51]);

export function normalizeMatches<MatchType extends MatchLike>(
  input?: MatchType[] | MatchType
): MatchType[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export function hasExistingOrders(match: MatchLike | undefined): boolean {
  return (
    match?.OrdersGiven === "true" ||
    match?.OrdersGiven === "True" ||
    match?.OrdersGiven === true
  );
}

export function resolveMatchSourceSystem(
  match: MatchLike | undefined,
  fallbackSourceSystem: string
): string {
  const explicitSource =
    match && typeof match.SourceSystem === "string" && match.SourceSystem.trim().length > 0
      ? match.SourceSystem.trim()
      : null;
  if (explicitSource) return explicitSource;
  const matchType = Number(match?.MatchType);
  if (Number.isFinite(matchType) && TOURNAMENT_MATCH_TYPES.has(matchType)) {
    return "htointegrated";
  }
  return fallbackSourceSystem;
}

export function resolveOpponentTeam(
  match: MatchLike | undefined,
  teamId: number | null
): { teamId: number; teamName: string } | null {
  if (!match || typeof teamId !== "number" || !Number.isFinite(teamId) || teamId <= 0) {
    return null;
  }
  const homeTeamId = Number(match.HomeTeam?.HomeTeamID);
  const awayTeamId = Number(match.AwayTeam?.AwayTeamID);
  if (Number.isFinite(homeTeamId) && homeTeamId === teamId) {
    if (!Number.isFinite(awayTeamId) || awayTeamId <= 0) return null;
    return {
      teamId: awayTeamId,
      teamName: match.AwayTeam?.AwayTeamName ?? "",
    };
  }
  if (Number.isFinite(awayTeamId) && awayTeamId === teamId) {
    if (!Number.isFinite(homeTeamId) || homeTeamId <= 0) return null;
    return {
      teamId: homeTeamId,
      teamName: match.HomeTeam?.HomeTeamName ?? "",
    };
  }
  return null;
}

export function filterVisibleMatches<MatchType extends MatchLike>(
  matches: MatchType[],
  includeTournamentMatches: boolean
): MatchType[] {
  if (includeTournamentMatches) return matches;
  return matches.filter((match) => {
    const matchType = Number(match.MatchType);
    return Number.isFinite(matchType) && DEFAULT_VISIBLE_MATCH_TYPES.has(matchType);
  });
}

export function formatMatchName(
  match: MatchLike,
  fallbackHome: string,
  fallbackAway: string
) {
  const home = match.HomeTeam?.HomeTeamName?.trim() || fallbackHome;
  const away = match.AwayTeam?.AwayTeamName?.trim() || fallbackAway;
  return `${home} vs ${away}`;
}
