import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { XMLParser } from "fast-xml-parser";
import { getChppEnv } from "@/lib/chpp/env";
import { createNodeOAuthClient, getProtectedResource } from "@/lib/chpp/node-oauth";

const CHPP_XML_ENDPOINT = "https://chpp.hattrick.org/chppxml.ashx";
const DEFAULT_VERSION = "1.2";

function buildParams(url: URL) {
  const version = url.searchParams.get("version") ?? DEFAULT_VERSION;
  const youthTeamID = url.searchParams.get("youthTeamID");

  const params = new URLSearchParams({
    file: "youthplayerlist",
    version,
    actionType: "details",
    showLastMatch: "true",
  });

  if (youthTeamID) params.set("youthTeamID", youthTeamID);

  return params;
}

function normalizePlayers(input?: unknown) {
  if (!input) return [] as any[];
  return Array.isArray(input) ? input : [input];
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

    const url = new URL(request.url);
    const params = buildParams(url);
    const requestUrl = `${CHPP_XML_ENDPOINT}?${params.toString()}`;

    const rawXml = await getProtectedResource(
      client,
      requestUrl,
      accessToken,
      accessSecret
    );

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const parsed = parser.parse(rawXml);

    const players = normalizePlayers(
      parsed?.HattrickData?.PlayerList?.YouthPlayer
    ).map((player: any) => {
      const fullName = [player.FirstName, player.NickName, player.LastName]
        .filter(Boolean)
        .join(" ");
      const lastMatch = player.LastMatch || null;
      return {
        id: player.YouthPlayerID,
        name: fullName,
        lastMatch: lastMatch
          ? {
              date: lastMatch.Date ?? null,
              youthMatchId: lastMatch.YouthMatchID ?? null,
              positionCode: lastMatch.PositionCode ?? null,
              minutes: lastMatch.PlayedMinutes ?? null,
              rating: lastMatch.Rating ?? null,
            }
          : null,
      };
    });

    return NextResponse.json({ players });
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
        error: "Failed to fetch ratings matrix",
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
