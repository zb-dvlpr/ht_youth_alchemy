import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const PLAYERDETAILS_VERSION = "3.2";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");
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
