import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";
import { normalizeArray, parseChppDate } from "@/lib/chpp/utils";
import { POSITION_COLUMNS, normalizeMatchRoleId } from "@/lib/positions";
import { mapWithConcurrency } from "@/lib/async";

const MATCHESARCHIVE_VERSION = "1.5";
const MATCHLINEUP_VERSION = "2.1";
const MATCHDETAILS_VERSION = "3.1";
const PLAYERS_VERSION = "2.8";
const MATCH_FETCH_CONCURRENCY = 6;
const SENIOR_RATINGS_ALGORITHM_VERSION = 6;
const SENIOR_RATINGS_MIN_PLAYED_MINUTES = 85;
const SENIOR_RATINGS_MAX_PLAYED_MINUTES = 96;

type MatchSummary = {
  Status?: string;
  MatchDate?: string;
  MatchID?: number | string;
  MatchType?: number | string;
  SourceSystem?: string;
};

type LineupPlayer = {
  RoleID?: number | string;
  RatingStars?: number | string;
  RatingStarsEndOfMatch?: number | string;
  PlayerID?: number | string;
  FirstName?: string;
  NickName?: string;
  LastName?: string;
};

type MatchSubstitution = {
  OrderType?: number | string;
  SubjectPlayerID?: number | string;
  ObjectPlayerID?: number | string;
  MatchMinute?: number | string;
};

const inferSeniorMatchMinutes = (
  matchDate: string | null,
  finishedDate: string | null,
  addedMinutes: number | null
) => {
  const added = Math.max(0, addedMinutes ?? 0);
  const baselineElapsedMinutes = 45 + 15 + 45 + added;
  const startedAt = matchDate ? parseChppDate(matchDate) : null;
  const finishedAt = finishedDate ? parseChppDate(finishedDate) : null;
  const elapsedMinutes =
    startedAt && finishedAt
      ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000))
      : baselineElapsedMinutes;
  const hadExtraTime = elapsedMinutes > baselineElapsedMinutes;
  return 90 + added + (hadExtraTime ? 30 : 0);
};

const buildPlayedMinutesByPlayerId = (
  lineupPlayers: LineupPlayer[],
  substitutions: MatchSubstitution[],
  totalMatchMinutes: number
) => {
  const playedMinutesById = new Map<number, number>();
  const onFieldSince = new Map<number, number>();

  lineupPlayers.forEach((player) => {
    const playerId = Number(player.PlayerID);
    const roleId = Number(player.RoleID);
    if (!Number.isFinite(playerId) || playerId <= 0) return;
    if (!Number.isFinite(roleId) || roleId < 100 || roleId > 113) return;
    if (!onFieldSince.has(playerId)) {
      onFieldSince.set(playerId, 0);
    }
  });

  const closeInterval = (playerId: number, minute: number) => {
    const startedAt = onFieldSince.get(playerId);
    if (typeof startedAt !== "number") return;
    playedMinutesById.set(
      playerId,
      (playedMinutesById.get(playerId) ?? 0) + Math.max(0, minute - startedAt)
    );
    onFieldSince.delete(playerId);
  };

  [...substitutions]
    .map((substitution) => ({
      orderType: Number(substitution.OrderType),
      subjectPlayerId: Number(substitution.SubjectPlayerID),
      objectPlayerId: Number(substitution.ObjectPlayerID),
      minute: Math.min(
        totalMatchMinutes,
        Math.max(0, Number(substitution.MatchMinute) || totalMatchMinutes)
      ),
    }))
    .filter(
      (substitution) =>
        substitution.orderType === 1 &&
        Number.isFinite(substitution.subjectPlayerId) &&
        substitution.subjectPlayerId > 0 &&
        Number.isFinite(substitution.objectPlayerId) &&
        substitution.objectPlayerId > 0 &&
        substitution.subjectPlayerId !== substitution.objectPlayerId
    )
    .sort((left, right) => left.minute - right.minute)
    .forEach((substitution) => {
      closeInterval(substitution.subjectPlayerId, substitution.minute);
      if (!onFieldSince.has(substitution.objectPlayerId)) {
        onFieldSince.set(substitution.objectPlayerId, substitution.minute);
      }
    });

  onFieldSince.forEach((startedAt, playerId) => {
    playedMinutesById.set(
      playerId,
      (playedMinutesById.get(playerId) ?? 0) + Math.max(0, totalMatchMinutes - startedAt)
    );
  });

  return playedMinutesById;
};

export async function GET(request: Request) {
  try {
    const auth = await getChppAuth();
    const url = new URL(request.url);
    const teamID = url.searchParams.get("teamID") ?? url.searchParams.get("teamId");
    const season = Number(url.searchParams.get("season") ?? 0);
    const firstMatchDate = url.searchParams.get("firstMatchDate");
    const lastMatchDate = url.searchParams.get("lastMatchDate");
    const fromTsRaw = Number(url.searchParams.get("fromTs") ?? 0);
    const fromMatchIdRaw = Number(url.searchParams.get("fromMatchId") ?? 0);
    const fromTs =
      Number.isFinite(fromTsRaw) && fromTsRaw > 0 ? Math.floor(fromTsRaw) : null;
    const fromMatchId =
      Number.isFinite(fromMatchIdRaw) && fromMatchIdRaw > 0
        ? Math.floor(fromMatchIdRaw)
        : null;
    const matchesParams = new URLSearchParams({
      file: "matchesarchive",
      version: MATCHESARCHIVE_VERSION,
      isYouth: "false",
      includeHTO: "true",
    });
    if (teamID) matchesParams.set("teamID", teamID);
    if (Number.isFinite(season) && season > 0) {
      matchesParams.set("season", String(Math.floor(season)));
    }
    if (firstMatchDate) {
      matchesParams.set("FirstMatchDate", firstMatchDate);
    }
    if (lastMatchDate) {
      matchesParams.set("LastMatchDate", lastMatchDate);
    }
    const { parsed: matchesParsed } = await fetchChppXml(auth, matchesParams);

    const team = matchesParsed?.HattrickData?.Team;
    const resolvedTeamId = teamID ?? team?.TeamID;
    const matchList = normalizeArray<MatchSummary>(
      team?.MatchList?.Match as MatchSummary | MatchSummary[] | undefined
    );

    const finishedMatches = matchList
      .filter((match) => {
        if (typeof match?.Status === "string" && match.Status !== "FINISHED") return false;
        const matchTime = parseChppDate(match.MatchDate)?.getTime() ?? 0;
        return matchTime > 0 && matchTime <= Date.now();
      })
      .map((match) => ({
        ...match,
        _matchId: Number(match.MatchID ?? 0),
        _date: parseChppDate(match.MatchDate)?.getTime() ?? 0,
        _sourceSystem:
          typeof match.SourceSystem === "string" && match.SourceSystem
            ? match.SourceSystem
            : "Hattrick",
      }))
      .filter((match) => Number.isFinite(match._matchId) && match._matchId > 0)
      .filter((match) => {
        if (fromTs !== null) {
          if (match._date > fromTs) return true;
          if (match._date < fromTs) return false;
          if (fromMatchId !== null) {
            return match._matchId > fromMatchId;
          }
          return true;
        }
        if (fromMatchId !== null) {
          return match._matchId > fromMatchId;
        }
        return true;
      })
      .sort((a, b) => a._date - b._date);

    if (!resolvedTeamId || finishedMatches.length === 0) {
      return NextResponse.json({
        ratingsAlgorithmVersion: SENIOR_RATINGS_ALGORITHM_VERSION,
        positions: POSITION_COLUMNS,
        players: [],
        matchesAnalyzed: 0,
        lastAppliedMatchId: null,
        lastAppliedMatchDateTime: null,
        lastAppliedMatchSourceSystem: null,
      });
    }

    const playersParams = new URLSearchParams({
      file: "players",
      version: PLAYERS_VERSION,
      actionType: "view",
      orderBy: "PlayerNumber",
      teamID: String(resolvedTeamId),
    });
    const { parsed: playersParsed } = await fetchChppXml(auth, playersParams);
    const seniorPlayerIdSet = new Set<number>(
      normalizeArray<{ PlayerID?: number | string }>(
        playersParsed?.HattrickData?.Team?.PlayerList?.Player as
          | { PlayerID?: number | string }
          | Array<{ PlayerID?: number | string }>
          | undefined
      )
        .map((player) => Number(player.PlayerID))
        .filter((playerId) => Number.isFinite(playerId) && playerId > 0)
    );

    const playersMap = new Map<
      number,
      {
        id: number;
        name: string;
        ratings: Record<string, number>;
        ratingMatchIds: Record<string, number>;
        ratingMatchSourceSystems: Record<string, string>;
      }
    >();

    const lineupResponses = await mapWithConcurrency(
      finishedMatches,
      MATCH_FETCH_CONCURRENCY,
      async (match) => {
        try {
          const lineupParams = new URLSearchParams({
            file: "matchlineup",
            version: MATCHLINEUP_VERSION,
            matchID: String(match._matchId),
            teamID: String(resolvedTeamId),
            sourceSystem: match._sourceSystem,
          });
          const detailsParams = new URLSearchParams({
            file: "matchdetails",
            version: MATCHDETAILS_VERSION,
            matchID: String(match._matchId),
            sourceSystem: match._sourceSystem,
            matchEvents: "false",
          });
          const [{ parsed: lineupParsed }, { parsed: detailsParsed }] = await Promise.all([
            fetchChppXml(auth, lineupParams),
            fetchChppXml(auth, detailsParams),
          ]);
          const matchDetails = detailsParsed?.HattrickData?.Match;
          const totalMatchMinutes = inferSeniorMatchMinutes(
            typeof matchDetails?.MatchDate === "string" ? matchDetails.MatchDate : null,
            typeof matchDetails?.FinishedDate === "string" ? matchDetails.FinishedDate : null,
            Number.isFinite(Number(matchDetails?.AddedMinutes))
              ? Number(matchDetails?.AddedMinutes)
              : null
          );
          const lineupPlayers = normalizeArray<LineupPlayer>(
            lineupParsed?.HattrickData?.Team?.Lineup?.Player as
              | LineupPlayer
              | LineupPlayer[]
              | undefined
          );
          const playedMinutesById = buildPlayedMinutesByPlayerId(
            normalizeArray<LineupPlayer>(
              lineupParsed?.HattrickData?.Team?.StartingLineup?.Player as
                | LineupPlayer
                | LineupPlayer[]
                | undefined
            ),
            normalizeArray<MatchSubstitution>(
              lineupParsed?.HattrickData?.Team?.Substitutions?.Substitution as
                | MatchSubstitution
                | MatchSubstitution[]
                | undefined
            ),
            totalMatchMinutes
          );
          return {
            matchId: match._matchId,
            matchDate: match._date,
            sourceSystem: match._sourceSystem,
            ok: true,
            lineupPlayers,
            playedMinutesById,
          };
        } catch {
          return {
            matchId: match._matchId,
            matchDate: match._date,
            sourceSystem: match._sourceSystem,
            ok: false,
            lineupPlayers: [] as LineupPlayer[],
            playedMinutesById: new Map<number, number>(),
          };
        }
      }
    );

    lineupResponses.forEach((result) => {
      result.lineupPlayers.forEach((player) => {
        const roleId = Number(player.RoleID);
        const column = normalizeMatchRoleId(roleId);
        if (!column) return;
        const rating = Number(player.RatingStarsEndOfMatch);
        if (!Number.isFinite(rating)) return;
        const playerId = Number(player.PlayerID);
        if (!Number.isFinite(playerId) || playerId <= 0) return;
        if (!seniorPlayerIdSet.has(playerId)) return;
        const playedMinutes = result.playedMinutesById.get(playerId) ?? 0;
        if (
          playedMinutes < SENIOR_RATINGS_MIN_PLAYED_MINUTES ||
          playedMinutes > SENIOR_RATINGS_MAX_PLAYED_MINUTES
        ) {
          return;
        }
        const fullName = [player.FirstName, player.NickName, player.LastName]
          .filter(Boolean)
          .join(" ");

        if (!playersMap.has(playerId)) {
          playersMap.set(playerId, {
            id: playerId,
            name: fullName,
            ratings: {},
            ratingMatchIds: {},
            ratingMatchSourceSystems: {},
          });
        }

        const entry = playersMap.get(playerId);
        if (!entry) return;
        const key = String(column);
        // Ratings matrix bootstrap is chronological: oldest to newest, newest overwrites.
        entry.ratings[key] = rating;
        entry.ratingMatchIds[key] = result.matchId;
        entry.ratingMatchSourceSystems[key] = result.sourceSystem;
      });
    });

    let lastAppliedMatchId: number | null = null;
    let lastAppliedMatchDateTime: number | null = null;
    let lastAppliedMatchSourceSystem: string | null = null;
    for (let index = lineupResponses.length - 1; index >= 0; index -= 1) {
      const row = lineupResponses[index];
      if (!row.ok) continue;
      lastAppliedMatchId = row.matchId;
      lastAppliedMatchDateTime = row.matchDate;
      lastAppliedMatchSourceSystem = row.sourceSystem;
      break;
    }

    return NextResponse.json({
      ratingsAlgorithmVersion: SENIOR_RATINGS_ALGORITHM_VERSION,
      positions: POSITION_COLUMNS,
      players: Array.from(playersMap.values()),
      matchesAnalyzed: lineupResponses.filter((result) => result.ok).length,
      lastAppliedMatchId,
      lastAppliedMatchDateTime,
      lastAppliedMatchSourceSystem,
    });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch senior ratings matrix", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
