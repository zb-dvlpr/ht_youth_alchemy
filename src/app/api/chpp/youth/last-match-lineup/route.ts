import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { XMLParser } from "fast-xml-parser";
import { getChppEnv } from "@/lib/chpp/env";
import { createNodeOAuthClient, getProtectedResource } from "@/lib/chpp/node-oauth";

const CHPP_XML_ENDPOINT = "https://chpp.hattrick.org/chppxml.ashx";
const MATCHES_VERSION = "2.9";
const MATCHLINEUP_VERSION = "2.1";

function normalizeMatches(input?: unknown) {
  if (!input) return [] as any[];
  return Array.isArray(input) ? input : [input];
}

function parseDate(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(request: Request) {
  try {
    const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
    const client = createNodeOAuthClient(
      consumerKey,
      consumerSecret,
      callbackUrl
    );

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("chpp_access_token")?.value;
    const accessSecret = cookieStore.get("chpp_access_secret")?.value;

    if (!accessToken || !accessSecret) {
      return NextResponse.json(
        { error: "Missing CHPP access token. Re-auth required." },
        { status: 401 }
      );
    }

    const matchesUrl = `${CHPP_XML_ENDPOINT}?file=matches&version=${MATCHES_VERSION}&isYouth=true`;
    const matchesXml = await getProtectedResource(
      client,
      matchesUrl,
      accessToken,
      accessSecret
    );

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const matchesParsed = parser.parse(matchesXml);

    const team = matchesParsed?.HattrickData?.Team;
    const teamId = team?.TeamID;
    const matchList = normalizeMatches(team?.MatchList?.Match);

    const finishedMatches = matchList
      .filter((match: any) => match?.Status === "FINISHED")
      .map((match: any) => ({
        ...match,
        _date: parseDate(match.MatchDate)?.getTime() ?? 0,
      }))
      .sort((a: any, b: any) => b._date - a._date);

    if (!teamId || finishedMatches.length === 0) {
      return NextResponse.json(
        { error: "No finished youth matches found." },
        { status: 404 }
      );
    }

    const lastMatch = finishedMatches[0];
    const matchId = lastMatch.MatchID;

    const lineupUrl = `${CHPP_XML_ENDPOINT}?file=matchlineup&version=${MATCHLINEUP_VERSION}&matchID=${matchId}&teamID=${teamId}&sourceSystem=Youth`;
    const lineupXml = await getProtectedResource(
      client,
      lineupUrl,
      accessToken,
      accessSecret
    );
    const lineupParsed = parser.parse(lineupXml);

    const includeRaw = new URL(request.url).searchParams.get("raw") === "1";

    return NextResponse.json({
      matchId,
      teamId,
      data: lineupParsed,
      ...(includeRaw ? { raw: lineupXml } : {}),
    });
  } catch (error) {
    const details =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error);
    const errorObject =
      error && typeof error === "object" && !Array.isArray(error)
        ? (error as Record<string, unknown>)
        : null;
    return NextResponse.json(
      {
        error: "Failed to fetch match lineup",
        details,
        ...(errorObject
          ? {
              statusCode: errorObject.statusCode ?? null,
              data: errorObject.data ?? null,
            }
          : {}),
      },
      { status: 502 }
    );
  }
}
