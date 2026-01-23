import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";
import { normalizeArray, parseChppDate } from "@/lib/chpp/utils";
const MATCHES_VERSION = "2.9";
const MATCHLINEUP_VERSION = "2.1";

type MatchSummary = {
  Status?: string;
  MatchDate?: string;
  MatchID?: number;
};

export async function GET(request: Request) {
  try {
    const auth = await getChppAuth();
    const matchesParams = new URLSearchParams({
      file: "matches",
      version: MATCHES_VERSION,
      isYouth: "true",
    });
    const { parsed: matchesParsed } = await fetchChppXml(auth, matchesParams);

    const team = matchesParsed?.HattrickData?.Team;
    const teamId = team?.TeamID;
    const matchList = normalizeArray<MatchSummary>(
      team?.MatchList?.Match as MatchSummary | MatchSummary[] | undefined
    );

    const finishedMatches = matchList
      .filter((match) => match?.Status === "FINISHED")
      .map((match) => ({
        ...match,
        _date: parseChppDate(match.MatchDate)?.getTime() ?? 0,
      }))
      .sort((a, b) => b._date - a._date);

    if (!teamId || finishedMatches.length === 0) {
      return NextResponse.json(
        { error: "No finished youth matches found." },
        { status: 404 }
      );
    }

    const lastMatch = finishedMatches[0];
    const matchId = lastMatch.MatchID;

    const lineupParams = new URLSearchParams({
      file: "matchlineup",
      version: MATCHLINEUP_VERSION,
      matchID: String(matchId),
      teamID: String(teamId),
      sourceSystem: "Youth",
    });
    const { rawXml: lineupXml, parsed: lineupParsed } = await fetchChppXml(
      auth,
      lineupParams
    );

    const includeRaw = new URL(request.url).searchParams.get("raw") === "1";

    return NextResponse.json({
      matchId,
      teamId,
      data: lineupParsed,
      ...(includeRaw ? { raw: lineupXml } : {}),
    });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      buildChppErrorPayload("Failed to fetch match lineup", error),
      { status: 502 }
    );
  }
}
