import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  buildChppErrorPayload,
  ChppAuthError,
  buildChppUrl,
  parseChppXml,
} from "@/lib/chpp/server";
import { getChppEnv } from "@/lib/chpp/env";
import { createOAuthClient, toAuthHeader } from "@/lib/chpp/oauth";

const MATCHORDERS_VERSION = "3.1";

type MatchOrdersRequest = {
  matchId?: number;
  teamId?: number;
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

    const { consumerKey, consumerSecret } = getChppEnv();
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("chpp_access_token")?.value;
    const accessSecret = cookieStore.get("chpp_access_secret")?.value;

    if (!accessToken || !accessSecret) {
      throw new ChppAuthError();
    }

    const oauth = createOAuthClient(consumerKey, consumerSecret);
    const params = new URLSearchParams({
      file: "matchorders",
      version: MATCHORDERS_VERSION,
      actionType: "setmatchorder",
      matchID: String(payload.matchId),
      teamId: String(payload.teamId),
      sourceSystem: "Youth",
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
    if (error instanceof ChppAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      buildChppErrorPayload("Failed to submit match orders", error),
      { status: 502 }
    );
  }
}
