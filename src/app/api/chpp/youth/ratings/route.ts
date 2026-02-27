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

const MATCHES_VERSION = "2.9";
const MATCHLINEUP_VERSION = "2.1";

type MatchSummary = {
  Status?: string;
  MatchDate?: string;
  MatchID?: number;
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
    const matchesParams = new URLSearchParams({
      file: "matches",
      version: MATCHES_VERSION,
      isYouth: "true",
    });
    if (teamID) matchesParams.set("teamID", teamID);
    const { parsed: matchesParsed } = await fetchChppXml(auth, matchesParams);

    const team = matchesParsed?.HattrickData?.Team;
    const teamId = teamID ?? team?.TeamID;
    const matchList = normalizeArray<MatchSummary>(
      team?.MatchList?.Match as MatchSummary | MatchSummary[] | undefined
    );

    const finishedMatches = matchList
      .filter((match) => match?.Status === "FINISHED")
      .map((match) => ({
        ...match,
        _date: parseChppDate(match.MatchDate)?.getTime() ?? 0,
      }))
      .sort((a, b) => b._date - a._date)
      .slice(0, 10);

    if (!teamId || finishedMatches.length === 0) {
      return NextResponse.json(
        { error: "No finished youth matches found." },
        { status: 404 }
      );
    }

    const playersMap = new Map<
      number,
      { id: number; name: string; ratings: Record<string, number> }
    >();

    for (const match of finishedMatches) {
      const matchId = match.MatchID;
      const lineupParams = new URLSearchParams({
        file: "matchlineup",
        version: MATCHLINEUP_VERSION,
        matchID: String(matchId),
        teamID: String(teamId),
        sourceSystem: "Youth",
      });
      const { parsed: lineupParsed } = await fetchChppXml(auth, lineupParams);
      const lineupPlayers =
        lineupParsed?.HattrickData?.Team?.Lineup?.Player;
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
          });
        }

        const entry = playersMap.get(playerId)!;
        const key = String(column);
        const existing = entry.ratings[key];
        if (existing === undefined || rating > existing) {
          entry.ratings[key] = rating;
        }
      });
    }

    return NextResponse.json({
      positions: POSITION_COLUMNS,
      players: Array.from(playersMap.values()),
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
