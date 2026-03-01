import { NextResponse } from "next/server";
import {
  assertChppPermissions,
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  buildChppUrl,
  fetchChppXml,
  getChppAuth,
  parseChppXml,
  ChppPermissionError,
} from "@/lib/chpp/server";
import { getChppEnv } from "@/lib/chpp/env";
import { createOAuthClient, toAuthHeader } from "@/lib/chpp/oauth";

const MATCHORDERS_VERSION = "3.1";

type MatchOrdersRequest = {
  matchId?: number;
  teamId?: number;
  sourceSystem?: string;
  lineup?: Record<string, unknown>;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | MatchOrdersRequest
      | null;

    if (!payload?.matchId || !payload?.teamId || !payload?.lineup) {
      return NextResponse.json(
        { error: "Missing matchId, teamId, or lineup payload." },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    await assertChppPermissions(auth, ["set_matchorder"]);
    const { consumerKey, consumerSecret } = getChppEnv();
    const { accessToken, accessSecret } = auth;

    const oauth = createOAuthClient(consumerKey, consumerSecret);
    const params = new URLSearchParams({
      file: "matchorders",
      version: MATCHORDERS_VERSION,
      actionType: "setmatchorder",
      matchID: String(payload.matchId),
      teamId: String(payload.teamId),
      sourceSystem: payload.sourceSystem ?? "Youth",
    });

    const bodyParams = {
      lineup: JSON.stringify(payload.lineup),
    };
    const body = new URLSearchParams(bodyParams).toString();
    const requestUrl = buildChppUrl(params);
    const authHeader = toAuthHeader(
      oauth,
      {
        url: requestUrl,
        method: "POST",
        data: bodyParams,
      },
      { key: accessToken, secret: accessSecret }
    );

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const rawXml = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to submit match orders", statusCode: response.status, data: rawXml },
        { status: 502 }
      );
    }

    const parsed = parseChppXml(rawXml);
    return NextResponse.json({ data: parsed, raw: rawXml });
  } catch (error) {
    if (error instanceof ChppPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.message,
          code: error.code,
          missingPermissions: error.missingPermissions,
        },
        { status: error.status }
      );
    }
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload(
      "Failed to submit match orders",
      error
    );
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");
    const teamId = url.searchParams.get("teamId");
    const sourceSystem = url.searchParams.get("sourceSystem") ?? "Youth";

    if (!matchId || !teamId) {
      return NextResponse.json(
        { error: "Missing matchId or teamId." },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "matchorders",
      version: MATCHORDERS_VERSION,
      actionType: "view",
      matchID: matchId,
      teamId,
      sourceSystem,
    });

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    return NextResponse.json({ data: parsed, raw: rawXml });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch match orders", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
