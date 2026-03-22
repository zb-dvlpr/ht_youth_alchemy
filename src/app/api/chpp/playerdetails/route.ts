import { NextResponse } from "next/server";
import {
  assertChppPermissions,
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  ChppPermissionError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const PLAYERDETAILS_VERSION = "3.2";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");
    const includeMatchInfo = searchParams.get("includeMatchInfo");
    if (!playerId) {
      return NextResponse.json(
        { error: "Missing playerId query parameter." },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "playerdetails",
      version: PLAYERDETAILS_VERSION,
      playerID: playerId,
      actionType: "view",
    });
    if (includeMatchInfo === "true" || includeMatchInfo === "1") {
      params.set("includeMatchInfo", "true");
    }

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    return NextResponse.json({ data: parsed, raw: rawXml });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch player details", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          playerId?: unknown;
          teamId?: unknown;
          bidAmount?: unknown;
          maxBidAmount?: unknown;
        }
      | null;

    const parsePositiveInteger = (value: unknown) => {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isInteger(parsed) && parsed > 0) return parsed;
      }
      return null;
    };

    const parseOptionalPositiveInteger = (value: unknown) => {
      if (value === null || value === undefined || value === "") return null;
      return parsePositiveInteger(value);
    };

    const playerId = parsePositiveInteger(body?.playerId);
    const teamId = parsePositiveInteger(body?.teamId);
    const bidAmount = parseOptionalPositiveInteger(body?.bidAmount);
    const maxBidAmount = parseOptionalPositiveInteger(body?.maxBidAmount);

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required for actionType=placeBid" }, {
        status: 400,
      });
    }
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required for actionType=placeBid" }, {
        status: 400,
      });
    }
    if (bidAmount === null && maxBidAmount === null) {
      return NextResponse.json(
        { error: "bidAmount or maxBidAmount is required for actionType=placeBid" },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    await assertChppPermissions(auth, ["place_bid"]);

    const params = new URLSearchParams({
      file: "playerdetails",
      version: PLAYERDETAILS_VERSION,
      actionType: "placeBid",
      playerID: String(playerId),
      teamId: String(teamId),
    });
    if (bidAmount !== null) {
      params.set("bidAmount", String(bidAmount));
    }
    if (maxBidAmount !== null) {
      params.set("maxBidAmount", String(maxBidAmount));
    }

    const { parsed, rawXml } = await fetchChppXml(auth, params);
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
    const payload = buildChppErrorPayload("Failed to place bid", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
