import { mapWithConcurrency } from "@/lib/async";
import {
  ChppAuthRequiredError,
  fetchChppJson,
} from "@/lib/chpp/client";
import { parseChppDate } from "@/lib/chpp/utils";
import type { Messages } from "@/lib/i18n";
import { normalizeMatchRoleId, positionLabelShortByRoleId } from "@/lib/positions";
import type {
  TeamScoutAnalyzedMatch,
  TeamScoutDerivedData,
  TeamScoutForm7RatingEntry,
  TeamScoutPlayingPositionEntry,
} from "./teamScoutDetailTypes";

type RawNode = Record<string, unknown>;

type TeamScoutMatchArchiveEntry = {
  matchId: number;
  matchType: number | null;
  matchDate: string | null;
  sourceSystem: string;
};

type TeamScoutMatchDetails = {
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeFormation: string | null;
  awayFormation: string | null;
  homeTacticType: number | null;
  awayTacticType: number | null;
  addedMinutes: number | null;
  matchDate: string | null;
  finishedDate: string | null;
  weatherId: number | null;
  manMarkerSubjectPlayerIds: number[];
};

type ResolvedTeamScoutMatch = {
  match: TeamScoutMatchArchiveEntry;
  formation: string | null;
  tacticType: number | null;
  matchDurationMinutes: number;
};

type TeamScoutLineupSnapshot = {
  matchId: number;
  teamId: number;
  sourceSystem: string;
  matchDate: string | null;
  starters: Set<number>;
  substitutionsOffMinuteByPlayerId: Map<number, number>;
  substitutionsOnMinuteByPlayerId: Map<number, number>;
  ratingByPlayerId: Map<number, number>;
  roleIdByPlayerId: Map<number, number>;
  activeIntervalsByPlayerId: Map<
    number,
    Array<{ roleId: number; startMinute: number; endMinute: number }>
  >;
};

export type TeamScoutDerivedDataPlayer = {
  playerId: number;
  playerName?: string | null;
  form?: number | null;
};

const TEAM_SCOUT_DETAIL_MATCH_LIMIT = 20;
const TEAM_SCOUT_DETAIL_MATCH_TYPES = new Set([1, 2, 3, 4, 5, 8, 9]);
const TEAM_SCOUT_MATCH_DETAILS_FETCH_CONCURRENCY = 6;

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseNumberNode = (value: unknown): number | null => {
  if (value && typeof value === "object" && "#text" in (value as RawNode)) {
    return parseNumber((value as RawNode)["#text"]);
  }
  return parseNumber(value);
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseStringNode = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "object" && "#text" in (value as RawNode)) {
    const text = (value as RawNode)["#text"];
    if (typeof text !== "string") return null;
    const trimmed = text.trim();
    return trimmed ? trimmed : null;
  }
  return null;
};

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const parseMatchDateValue = (value: unknown): number => {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeTeamScoutLineup = (
  payload: {
    data?: {
      HattrickData?: {
        MatchID?: unknown;
        MatchDate?: unknown;
        Team?: {
          TeamID?: unknown;
          StartingLineup?: { Player?: unknown };
          Substitutions?: { Substitution?: unknown };
          Lineup?: { Player?: unknown };
        };
      };
    };
  } | null | undefined,
  sourceSystem: string
): TeamScoutLineupSnapshot | null => {
  const data = payload?.data?.HattrickData;
  const teamNode = data?.Team;
  const matchId = parseNumberNode(data?.MatchID);
  const teamId = parseNumberNode(teamNode?.TeamID);
  if (!matchId || !teamId) return null;
  const starters = new Set<number>();
  const substitutionsOffMinuteByPlayerId = new Map<number, number>();
  const substitutionsOnMinuteByPlayerId = new Map<number, number>();
  const ratingByPlayerId = new Map<number, number>();
  const roleIdByPlayerId = new Map<number, number>();
  const activeIntervalsByPlayerId = new Map<
    number,
    Array<{ roleId: number; startMinute: number; endMinute: number }>
  >();
  const activeAssignments = new Map<number, { roleId: number; startMinute: number }>();
  const startingLineup = toArray(
    teamNode?.StartingLineup?.Player as RawNode | RawNode[] | null
  );
  startingLineup.forEach((player) => {
    const playerId = parseOptionalNumber(player?.PlayerID);
    const roleId = parseOptionalNumber(player?.RoleID);
    if (playerId && playerId > 0) {
      starters.add(playerId);
      if (roleId !== null && roleId !== undefined && roleId >= 100 && roleId <= 113) {
        activeAssignments.set(playerId, { roleId, startMinute: 0 });
      }
    }
  });
  const substitutions = toArray(
    teamNode?.Substitutions?.Substitution as RawNode | RawNode[] | null
  );
  substitutions.forEach((entry) => {
    const minute = parseOptionalNumber(entry?.MatchMinute);
    if (minute === null || minute === undefined) return;
    const orderType = parseOptionalNumber(entry?.OrderType);
    if (orderType === 3) return;
    const subjectPlayerId = parseOptionalNumber(entry?.SubjectPlayerID);
    const objectPlayerId = parseOptionalNumber(entry?.ObjectPlayerID);
    if (subjectPlayerId && subjectPlayerId > 0) {
      const previous = substitutionsOffMinuteByPlayerId.get(subjectPlayerId);
      if (previous === undefined || minute < previous) {
        substitutionsOffMinuteByPlayerId.set(subjectPlayerId, minute);
      }
    }
    if (objectPlayerId && objectPlayerId > 0) {
      const previous = substitutionsOnMinuteByPlayerId.get(objectPlayerId);
      if (previous === undefined || minute < previous) {
        substitutionsOnMinuteByPlayerId.set(objectPlayerId, minute);
      }
    }
  });
  substitutions
    .map((entry, index) => ({
      index,
      minute: parseOptionalNumber(entry?.MatchMinute),
      orderType: parseOptionalNumber(entry?.OrderType),
      subjectPlayerId: parseOptionalNumber(entry?.SubjectPlayerID),
      objectPlayerId: parseOptionalNumber(entry?.ObjectPlayerID),
      newPositionId: parseOptionalNumber(entry?.NewPositionId),
    }))
    .filter((entry) => entry.minute !== null && entry.minute !== undefined)
    .sort(
      (left, right) =>
        (left.minute ?? Number.MAX_SAFE_INTEGER) -
          (right.minute ?? Number.MAX_SAFE_INTEGER) || left.index - right.index
    )
    .forEach((entry) => {
      const minute = Math.max(0, Math.min(96, entry.minute ?? 96));
      const nextRoleId =
        entry.newPositionId !== null &&
        entry.newPositionId !== undefined &&
        entry.newPositionId >= 100 &&
        entry.newPositionId <= 113
          ? entry.newPositionId
          : null;
      const closeAssignment = (playerId: number) => {
        const assignment = activeAssignments.get(playerId);
        if (!assignment) return;
        const intervals = activeIntervalsByPlayerId.get(playerId) ?? [];
        intervals.push({
          roleId: assignment.roleId,
          startMinute: assignment.startMinute,
          endMinute: minute,
        });
        activeIntervalsByPlayerId.set(playerId, intervals);
        activeAssignments.delete(playerId);
      };
      if (entry.orderType === 3) {
        const subjectPlayerId =
          entry.subjectPlayerId && entry.subjectPlayerId > 0
            ? entry.subjectPlayerId
            : null;
        const objectPlayerId =
          entry.objectPlayerId && entry.objectPlayerId > 0
            ? entry.objectPlayerId
            : null;
        if (!subjectPlayerId || !objectPlayerId) return;
        const subjectAssignment = activeAssignments.get(subjectPlayerId);
        const objectAssignment = activeAssignments.get(objectPlayerId);
        if (!subjectAssignment || !objectAssignment) return;
        closeAssignment(subjectPlayerId);
        if (objectPlayerId !== subjectPlayerId) closeAssignment(objectPlayerId);
        activeAssignments.set(subjectPlayerId, {
          roleId: objectAssignment.roleId,
          startMinute: minute,
        });
        activeAssignments.set(objectPlayerId, {
          roleId: subjectAssignment.roleId,
          startMinute: minute,
        });
        return;
      }
      if (
        entry.subjectPlayerId &&
        entry.subjectPlayerId > 0 &&
        activeAssignments.has(entry.subjectPlayerId)
      ) {
        closeAssignment(entry.subjectPlayerId);
      }
      if (
        entry.objectPlayerId &&
        entry.objectPlayerId > 0 &&
        entry.objectPlayerId !== entry.subjectPlayerId &&
        activeAssignments.has(entry.objectPlayerId)
      ) {
        closeAssignment(entry.objectPlayerId);
      }
      if (entry.objectPlayerId && entry.objectPlayerId > 0 && nextRoleId !== null) {
        activeAssignments.set(entry.objectPlayerId, {
          roleId: nextRoleId,
          startMinute: minute,
        });
      }
    });
  const lineupPlayers = toArray(teamNode?.Lineup?.Player as RawNode | RawNode[] | null);
  lineupPlayers.forEach((player) => {
    const playerId = parseOptionalNumber(player?.PlayerID);
    const roleId = parseOptionalNumber(player?.RoleID);
    const rating = parseNumberNode(player?.RatingStarsEndOfMatch);
    if (
      playerId &&
      playerId > 0 &&
      roleId !== null &&
      roleId !== undefined &&
      roleId >= 100 &&
      roleId <= 113 &&
      !roleIdByPlayerId.has(playerId)
    ) {
      roleIdByPlayerId.set(playerId, roleId);
    }
    if (playerId && playerId > 0 && rating !== null && Number.isFinite(rating)) {
      ratingByPlayerId.set(playerId, rating);
    }
  });
  activeAssignments.forEach((assignment, playerId) => {
    const intervals = activeIntervalsByPlayerId.get(playerId) ?? [];
    intervals.push({
      roleId: assignment.roleId,
      startMinute: assignment.startMinute,
      endMinute: 96,
    });
    activeIntervalsByPlayerId.set(playerId, intervals);
  });
  return {
    matchId,
    teamId,
    sourceSystem,
    matchDate: parseStringNode(data?.MatchDate),
    starters,
    substitutionsOffMinuteByPlayerId,
    substitutionsOnMinuteByPlayerId,
    ratingByPlayerId,
    roleIdByPlayerId,
    activeIntervalsByPlayerId,
  };
};

const resolveForm7PlayedMinutes = (
  lineup: TeamScoutLineupSnapshot,
  playerId: number,
  matchDurationMinutes: number
) => {
  const normalizedDuration = Math.max(0, Math.min(96, matchDurationMinutes));
  if (lineup.starters.has(playerId)) {
    const subOffMinute = lineup.substitutionsOffMinuteByPlayerId.get(playerId);
    return subOffMinute !== undefined
      ? Math.max(0, Math.min(normalizedDuration, subOffMinute))
      : normalizedDuration;
  }
  const subOnMinute = lineup.substitutionsOnMinuteByPlayerId.get(playerId);
  if (subOnMinute !== undefined) {
    const entryMinute = Math.max(0, Math.min(normalizedDuration, subOnMinute));
    return Math.max(0, normalizedDuration - entryMinute);
  }
  return 0;
};

const mergeForm7RatingEntries = (
  existingEntries: TeamScoutForm7RatingEntry[] | null | undefined,
  newEntries: TeamScoutForm7RatingEntry[]
) => {
  const merged = [...newEntries, ...(existingEntries ?? [])];
  merged.sort((left, right) => {
    const leftTime =
      parseChppDate(left.matchDate ?? "")?.getTime() ?? left.recordedAt ?? 0;
    const rightTime =
      parseChppDate(right.matchDate ?? "")?.getTime() ?? right.recordedAt ?? 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return (right.recordedAt ?? 0) - (left.recordedAt ?? 0);
  });
  const deduped: TeamScoutForm7RatingEntry[] = [];
  const seenCombos = new Set<string>();
  merged.forEach((entry) => {
    const comboKey = `${entry.ratingStarsEndOfMatch}:${entry.weatherId}`;
    if (seenCombos.has(comboKey)) return;
    seenCombos.add(comboKey);
    deduped.push(entry);
  });
  return deduped.slice(0, 20);
};

const fetchTeamScoutRecentMatches = async (
  teamId: number,
  matchLimit: number
): Promise<TeamScoutMatchArchiveEntry[]> => {
  const { response, payload } = await fetchChppJson<{
    data?: {
      HattrickData?: {
        Team?: {
          MatchList?: {
            Match?: unknown;
          };
        };
      };
    };
    error?: string;
  }>(`/api/chpp/matchesarchive?teamId=${teamId}`, {
    cache: "no-store",
  });
  if (!response.ok || payload?.error) return [];

  const rawMatches = payload?.data?.HattrickData?.Team?.MatchList?.Match;
  const matchList = toArray(rawMatches as RawNode | RawNode[] | null | undefined);
  const relevant: TeamScoutMatchArchiveEntry[] = [];
  matchList.forEach((match) => {
    const matchId = parseNumberNode(match?.MatchID) ?? 0;
    if (matchId <= 0) return;
    const matchType = parseNumberNode(match?.MatchType);
    if (matchType === null || !TEAM_SCOUT_DETAIL_MATCH_TYPES.has(matchType)) {
      return;
    }
    relevant.push({
      matchId,
      matchType,
      matchDate: typeof match?.MatchDate === "string" ? String(match.MatchDate) : null,
      sourceSystem:
        typeof match?.SourceSystem === "string" && match.SourceSystem
          ? String(match.SourceSystem)
          : "Hattrick",
    });
  });
  return relevant
    .sort(
      (left, right) =>
        parseMatchDateValue(right.matchDate) - parseMatchDateValue(left.matchDate)
    )
    .slice(0, matchLimit);
};

const fetchTeamScoutMatchDetails = async (
  matchId: number,
  sourceSystem: string,
  cache: Map<number, TeamScoutMatchDetails>
): Promise<TeamScoutMatchDetails | null> => {
  if (cache.has(matchId)) return cache.get(matchId) ?? null;
  try {
    const { response, payload } = await fetchChppJson<{
      data?: {
        HattrickData?: {
          Match?: {
            MatchDate?: unknown;
            FinishedDate?: unknown;
            AddedMinutes?: unknown;
            Arena?: {
              WeatherID?: unknown;
            };
            EventList?: {
              Event?: RawNode | RawNode[];
            };
            HomeTeam?: RawNode;
            AwayTeam?: RawNode;
          };
        };
      };
    }>(
      `/api/chpp/matchdetails?matchId=${matchId}&sourceSystem=${encodeURIComponent(
        sourceSystem
      )}&matchEvents=true`,
      { cache: "no-store" }
    );
    if (!response.ok) return null;
    const match = payload?.data?.HattrickData?.Match;
    const home = (match?.HomeTeam ?? {}) as RawNode;
    const away = (match?.AwayTeam ?? {}) as RawNode;
    const eventList = toArray(match?.EventList?.Event as RawNode | RawNode[] | undefined);
    const details: TeamScoutMatchDetails = {
      homeTeamId: parseNumber(home?.HomeTeamID),
      awayTeamId: parseNumber(away?.AwayTeamID),
      homeFormation:
        typeof home?.Formation === "string" ? String(home.Formation) : null,
      awayFormation:
        typeof away?.Formation === "string" ? String(away.Formation) : null,
      homeTacticType: parseNumber(home?.TacticType),
      awayTacticType: parseNumber(away?.TacticType),
      addedMinutes: parseNumber(match?.AddedMinutes),
      matchDate: parseStringNode(match?.MatchDate),
      finishedDate: parseStringNode(match?.FinishedDate),
      weatherId: parseNumberNode(match?.Arena?.WeatherID),
      manMarkerSubjectPlayerIds: Array.from(
        new Set(
          eventList
            .filter((entry) => {
              const eventTypeId = parseNumberNode(entry?.EventTypeID);
              return eventTypeId !== null && eventTypeId >= 380 && eventTypeId <= 389;
            })
            .map((entry) => parseNumberNode(entry?.SubjectPlayerID))
            .filter((playerId): playerId is number => Boolean(playerId && playerId > 0))
        )
      ),
    };
    cache.set(matchId, details);
    return details;
  } catch (error) {
    if (error instanceof ChppAuthRequiredError) throw error;
    return null;
  }
};

const resolveTeamScoutMatches = async (
  teamId: number,
  matches: TeamScoutMatchArchiveEntry[],
  detailCache: Map<number, TeamScoutMatchDetails>,
  onMatchProcessed?: () => void
): Promise<ResolvedTeamScoutMatch[]> => {
  const resolved = await mapWithConcurrency(
    matches,
    TEAM_SCOUT_MATCH_DETAILS_FETCH_CONCURRENCY,
    async (match) => {
      const details = await fetchTeamScoutMatchDetails(
        match.matchId,
        match.sourceSystem,
        detailCache
      );
      onMatchProcessed?.();
      if (!details) return null;
      const isHome = details.homeTeamId === teamId;
      const isAway = details.awayTeamId === teamId;
      if (!isHome && !isAway) return null;
      return {
        match,
        formation: isHome ? details.homeFormation : details.awayFormation,
        tacticType: isHome ? details.homeTacticType : details.awayTacticType,
        matchDurationMinutes: Math.min(
          96,
          Math.max(90, 90 + Math.max(0, details.addedMinutes ?? 0))
        ),
      } satisfies ResolvedTeamScoutMatch;
    }
  );
  return resolved.filter((entry): entry is ResolvedTeamScoutMatch => Boolean(entry));
};

const fetchTeamScoutLineup = async (
  matchId: number,
  teamId: number,
  sourceSystem: string,
  lineupCache: Map<string, TeamScoutLineupSnapshot | null>,
  onLineupProcessed?: () => void
) => {
  const cacheKey = `${matchId}:${teamId}:${sourceSystem}`;
  if (lineupCache.has(cacheKey)) {
    return lineupCache.get(cacheKey) ?? null;
  }
  try {
    const { response, payload } = await fetchChppJson<{
      data?: {
        HattrickData?: {
          MatchID?: unknown;
          MatchDate?: unknown;
          Team?: {
            TeamID?: unknown;
            StartingLineup?: { Player?: unknown };
            Substitutions?: { Substitution?: unknown };
            Lineup?: { Player?: unknown };
          };
        };
      };
      error?: string;
    }>(
      `/api/chpp/match-lineup?matchId=${matchId}&teamId=${teamId}&sourceSystem=${encodeURIComponent(
        sourceSystem
      )}`,
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      lineupCache.set(cacheKey, null);
      onLineupProcessed?.();
      return null;
    }
    const normalized = normalizeTeamScoutLineup(payload, sourceSystem);
    lineupCache.set(cacheKey, normalized);
    onLineupProcessed?.();
    return normalized;
  } catch (error) {
    if (error instanceof ChppAuthRequiredError) throw error;
    lineupCache.set(cacheKey, null);
    onLineupProcessed?.();
    return null;
  }
};

export async function loadTeamScoutDerivedData({
  teamId,
  players,
  messages,
  matchLimit = TEAM_SCOUT_DETAIL_MATCH_LIMIT,
  existingForm7RatingsByPlayerId,
  onMatchDetailsProgress,
  onMatchLineupsProgress,
}: {
  teamId: number;
  players: TeamScoutDerivedDataPlayer[];
  messages?: Messages;
  matchLimit?: number;
  existingForm7RatingsByPlayerId?: Record<number, TeamScoutForm7RatingEntry[]>;
  onMatchDetailsProgress?: () => void;
  onMatchLineupsProgress?: () => void;
}): Promise<TeamScoutDerivedData> {
  const detailCache = new Map<number, TeamScoutMatchDetails>();
  const lineupCache = new Map<string, TeamScoutLineupSnapshot | null>();
  const matches = await fetchTeamScoutRecentMatches(teamId, matchLimit);
  const resolvedMatches = await resolveTeamScoutMatches(
    teamId,
    matches,
    detailCache,
    onMatchDetailsProgress
  );
  const analyzedMatches = resolvedMatches.map(
    (resolved) =>
      ({
        matchId: resolved.match.matchId,
        matchType: resolved.match.matchType,
        matchDate: resolved.match.matchDate,
        sourceSystem: resolved.match.sourceSystem,
        matchDurationMinutes: resolved.matchDurationMinutes,
        formation: resolved.formation,
        tacticType: resolved.tacticType,
      }) satisfies TeamScoutAnalyzedMatch
  );
  const playerIds = new Set(players.map((player) => player.playerId));
  const currentForm7Players = players.filter((player) => player.form === 7);
  const form7RatingsByPlayerId: Record<number, TeamScoutForm7RatingEntry[]> = {
    ...(existingForm7RatingsByPlayerId ?? {}),
  };
  const minutesByPlayerId = new Map<number, Map<number, number>>();
  const manMarkerPlayerIds = new Set<number>();

  for (const match of analyzedMatches) {
    const details = await fetchTeamScoutMatchDetails(
      match.matchId,
      match.sourceSystem,
      detailCache
    );
    details?.manMarkerSubjectPlayerIds.forEach((playerId) => {
      if (playerIds.has(playerId)) manMarkerPlayerIds.add(playerId);
    });
    const lineup = await fetchTeamScoutLineup(
      match.matchId,
      teamId,
      match.sourceSystem || "Hattrick",
      lineupCache,
      onMatchLineupsProgress
    );
    if (!lineup) continue;
    const matchDurationMinutes = Math.max(
      0,
      Math.min(96, match.matchDurationMinutes ?? 96)
    );
    lineup.activeIntervalsByPlayerId.forEach((intervals, playerId) => {
      const roleMinutes = minutesByPlayerId.get(playerId) ?? new Map<number, number>();
      intervals.forEach((interval) => {
        const roleId = normalizeMatchRoleId(interval.roleId);
        if (roleId === null) return;
        const minutes = Math.max(
          0,
          Math.min(matchDurationMinutes, interval.endMinute) -
            Math.max(0, Math.min(matchDurationMinutes, interval.startMinute))
        );
        if (minutes <= 0) return;
        roleMinutes.set(roleId, (roleMinutes.get(roleId) ?? 0) + minutes);
      });
      if (roleMinutes.size > 0) {
        minutesByPlayerId.set(playerId, roleMinutes);
      }
    });

    const weatherId = details?.weatherId ?? null;
    if (!details?.finishedDate || weatherId === null) continue;
    currentForm7Players.forEach((player) => {
      const playedMinutes = resolveForm7PlayedMinutes(
        lineup,
        player.playerId,
        matchDurationMinutes
      );
      if (playedMinutes < 80 || playedMinutes > 96) return;
      const ratingStarsEndOfMatch = lineup.ratingByPlayerId.get(player.playerId);
      if (ratingStarsEndOfMatch === undefined || ratingStarsEndOfMatch === null) return;
      const roleId = lineup.roleIdByPlayerId.get(player.playerId) ?? null;
      form7RatingsByPlayerId[player.playerId] = mergeForm7RatingEntries(
        form7RatingsByPlayerId[player.playerId],
        [
          {
            matchId: match.matchId,
            sourceSystem: match.sourceSystem,
            matchDate: details.matchDate ?? match.matchDate,
            ratingStarsEndOfMatch,
            weatherId,
            roleId,
            recordedAt: Date.now(),
          },
        ]
      );
    });
  }

  const playingPositionByPlayerId: Record<number, TeamScoutPlayingPositionEntry[]> = {};
  players.forEach((player) => {
    const roleMinutes = minutesByPlayerId.get(player.playerId);
    if (!roleMinutes || roleMinutes.size === 0) return;
    playingPositionByPlayerId[player.playerId] = Array.from(roleMinutes.entries())
      .map(([roleId, minutes]) => ({ roleId, minutes }))
      .sort((left, right) => {
        if (right.minutes !== left.minutes) return right.minutes - left.minutes;
        if (messages) {
          const leftLabel = positionLabelShortByRoleId(left.roleId, messages) ?? "";
          const rightLabel = positionLabelShortByRoleId(right.roleId, messages) ?? "";
          return leftLabel.localeCompare(rightLabel);
        }
        return left.roleId - right.roleId;
      });
  });

  return {
    form7RatingsByPlayerId,
    playingPositionByPlayerId,
    manMarkerByPlayerId: Object.fromEntries(
      Array.from(manMarkerPlayerIds.values()).map((playerId) => [playerId, true])
    ) as Record<number, boolean>,
    analyzedMatches,
    matchSampleSize: analyzedMatches.length,
  };
}
