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
const PLAYERS_VERSION = "2.8";
const RATING_MATCH_TYPES = new Set<number>([1, 2, 3, 4, 5, 8, 9]);
const MATCH_FETCH_CONCURRENCY = 6;
const MATCH_LOOKBACK_DAYS = 420;
const MATCH_LOOKBACK_LIMIT = 20;

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
  PlayerID?: number | string;
  FirstName?: string;
  NickName?: string;
  LastName?: string;
};

export async function GET(request: Request) {
  try {
    const auth = await getChppAuth();
    const url = new URL(request.url);
    const teamID = url.searchParams.get("teamID") ?? url.searchParams.get("teamId");
    const formatArchiveDate = (date: Date) => date.toISOString().slice(0, 10);
    const today = new Date();
    const firstDate = new Date(today.getTime() - MATCH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const matchesParams = new URLSearchParams({
      file: "matchesarchive",
      version: MATCHESARCHIVE_VERSION,
      isYouth: "false",
      FirstMatchDate: formatArchiveDate(firstDate),
      LastMatchDate: formatArchiveDate(today),
    });
    if (teamID) matchesParams.set("teamID", teamID);
    const { parsed: matchesParsed } = await fetchChppXml(auth, matchesParams);

    const team = matchesParsed?.HattrickData?.Team;
    const resolvedTeamId = teamID ?? team?.TeamID;
    const matchList = normalizeArray<MatchSummary>(
      team?.MatchList?.Match as MatchSummary | MatchSummary[] | undefined
    );

    const finishedMatches = matchList
      .filter((match) => {
        if (typeof match?.Status === "string" && match.Status !== "FINISHED") return false;
        const matchType = Number(match.MatchType);
        return Number.isFinite(matchType) && RATING_MATCH_TYPES.has(matchType);
      })
      .map((match) => ({
        ...match,
        _matchId: Number(match.MatchID ?? 0),
        _matchType: Number(match.MatchType ?? 0),
        _date: parseChppDate(match.MatchDate)?.getTime() ?? 0,
        _sourceSystem:
          typeof match.SourceSystem === "string" && match.SourceSystem
            ? match.SourceSystem
            : "Hattrick",
      }))
      .filter((match) => Number.isFinite(match._matchId) && match._matchId > 0)
      .sort((a, b) => b._date - a._date)
      .slice(0, MATCH_LOOKBACK_LIMIT);

    if (!resolvedTeamId || finishedMatches.length === 0) {
      return NextResponse.json({
        positions: POSITION_COLUMNS,
        players: [],
        matchesAnalyzed: 0,
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
          const { parsed: lineupParsed } = await fetchChppXml(auth, lineupParams);
          return {
            matchId: match._matchId,
            ok: true,
            lineupPlayers: normalizeArray<LineupPlayer>(
              lineupParsed?.HattrickData?.Team?.Lineup?.Player as
                | LineupPlayer
                | LineupPlayer[]
                | undefined
            ),
          };
        } catch {
          return {
            matchId: match._matchId,
            ok: false,
            lineupPlayers: [] as LineupPlayer[],
          };
        }
      }
    );

    lineupResponses.forEach((result) => {
      result.lineupPlayers.forEach((player) => {
        const roleId = Number(player.RoleID);
        const column = normalizeMatchRoleId(roleId);
        if (!column) return;
        const rating = Number(player.RatingStars);
        if (!Number.isFinite(rating)) return;
        const playerId = Number(player.PlayerID);
        if (!Number.isFinite(playerId) || playerId <= 0) return;
        if (!seniorPlayerIdSet.has(playerId)) return;
        const fullName = [player.FirstName, player.NickName, player.LastName]
          .filter(Boolean)
          .join(" ");

        if (!playersMap.has(playerId)) {
          playersMap.set(playerId, {
            id: playerId,
            name: fullName,
            ratings: {},
            ratingMatchIds: {},
          });
        }

        const entry = playersMap.get(playerId);
        if (!entry) return;
        const key = String(column);
        const existing = entry.ratings[key];
        if (existing === undefined || rating > existing) {
          entry.ratings[key] = rating;
          entry.ratingMatchIds[key] = result.matchId;
        }
      });
    });

    return NextResponse.json({
      positions: POSITION_COLUMNS,
      players: Array.from(playersMap.values()),
      matchesAnalyzed: lineupResponses.filter((result) => result.ok).length,
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
