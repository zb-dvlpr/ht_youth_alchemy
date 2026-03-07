import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const MATCHLINEUP_VERSION = "2.1";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matchId = url.searchParams.get("matchId");
    const teamId = url.searchParams.get("teamId") ?? url.searchParams.get("teamID");
    const sourceSystem = url.searchParams.get("sourceSystem") ?? "Hattrick";

    if (!matchId || !teamId) {
      return NextResponse.json(
        { error: "Missing matchId or teamId query parameter." },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "matchlineup",
      version: MATCHLINEUP_VERSION,
      matchID: matchId,
      teamID: teamId,
      sourceSystem,
    });

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    const includeRaw = url.searchParams.get("raw") === "1";

    return NextResponse.json({
      data: parsed,
      ...(includeRaw ? { raw: rawXml } : {}),
    });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch match lineup", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
