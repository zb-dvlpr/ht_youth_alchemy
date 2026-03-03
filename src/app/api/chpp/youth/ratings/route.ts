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

const MATCHESARCHIVE_VERSION = "1.5";
const MATCHLINEUP_VERSION = "2.1";
const MATCH_LOOKBACK_DAYS = 220;
const MATCH_LOOKBACK_LIMIT = 50;

type MatchSummary = {
  Status?: string;
  MatchDate?: string;
  MatchID?: number | string;
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
    const teamID = url.searchParams.get("teamID");
    const formatArchiveDate = (date: Date) => date.toISOString().slice(0, 10);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const firstDate = new Date(today.getTime() - MATCH_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const matchesParams = new URLSearchParams({
      file: "matchesarchive",
      version: MATCHESARCHIVE_VERSION,
      isYouth: "true",
      FirstMatchDate: formatArchiveDate(firstDate),
      // Include today's completed matches in archive window.
      LastMatchDate: formatArchiveDate(tomorrow),
    });
    if (teamID) matchesParams.set("teamID", teamID);
    const { parsed: matchesParsed } = await fetchChppXml(auth, matchesParams);

    const team = matchesParsed?.HattrickData?.Team;
    const teamId = teamID ?? team?.TeamID;
    const matchList = normalizeArray<MatchSummary>(
      team?.MatchList?.Match as MatchSummary | MatchSummary[] | undefined
    );

    const finishedMatches = matchList
      .map((match) => ({
        ...match,
        _matchId: Number(match.MatchID ?? 0),
        _date: parseChppDate(match.MatchDate)?.getTime() ?? 0,
        _sourceSystem:
          typeof match.SourceSystem === "string" && match.SourceSystem
            ? match.SourceSystem
            : "youth",
      }))
      .filter((match) => Number.isFinite(match._matchId) && match._matchId > 0)
      .sort((a, b) => b._date - a._date)
      .slice(0, MATCH_LOOKBACK_LIMIT);

    if (!teamId || finishedMatches.length === 0) {
      return NextResponse.json({
        positions: POSITION_COLUMNS,
        players: [],
        matchesAnalyzed: 0,
      });
    }

    const playersMap = new Map<
      number,
      {
        id: number;
        name: string;
        ratings: Record<string, number>;
        ratingMatchIds: Record<string, number>;
      }
    >();

    for (const match of finishedMatches) {
      const matchId = match._matchId;
      const sourceCandidates = ["youth", "Youth"];
      let lineupParsed: unknown = null;
      for (const sourceSystem of sourceCandidates) {
        try {
          const lineupParams = new URLSearchParams({
            file: "matchlineup",
            version: MATCHLINEUP_VERSION,
            matchID: String(matchId),
            teamID: String(teamId),
            sourceSystem,
          });
          const result = await fetchChppXml(auth, lineupParams);
          lineupParsed = result.parsed;
          break;
        } catch {
          // try next youth case-variant
        }
      }
      if (!lineupParsed) continue;
      const lineupPlayers =
        (lineupParsed as { HattrickData?: { Team?: { Lineup?: { Player?: unknown } } } })
          ?.HattrickData?.Team?.Lineup?.Player;
      const normalized = normalizeArray<LineupPlayer>(
        lineupPlayers as LineupPlayer | LineupPlayer[] | undefined
      );

      normalized.forEach((player) => {
        const roleId = Number(player.RoleID);
        const column = normalizeMatchRoleId(roleId);
        if (!column) return;
        const rating = Number(player.RatingStars);
        if (Number.isNaN(rating)) return;
        if (rating === undefined || rating === null) return;
        const playerId = Number(player.PlayerID);
        if (Number.isNaN(playerId)) return;
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

        const entry = playersMap.get(playerId)!;
        const key = String(column);
          const existing = entry.ratings[key];
          if (existing === undefined || rating > existing) {
            entry.ratings[key] = rating;
            entry.ratingMatchIds[key] = Number(matchId);
          }
        });
      }

    return NextResponse.json({
      positions: POSITION_COLUMNS,
      players: Array.from(playersMap.values()),
      matchesAnalyzed: finishedMatches.length,
    });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload(
      "Failed to fetch ratings matrix",
      error
    );
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
