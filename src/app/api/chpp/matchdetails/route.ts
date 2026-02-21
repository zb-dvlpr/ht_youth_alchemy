import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const MATCHDETAILS_VERSION = "3.1";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");
    const sourceSystem = searchParams.get("sourceSystem") ?? "Hattrick";
    const matchEvents = searchParams.get("matchEvents");
    if (!matchId) {
      return NextResponse.json(
        { error: "Missing matchId query parameter." },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "matchdetails",
      version: MATCHDETAILS_VERSION,
      matchID: matchId,
      sourceSystem,
    });
    if (matchEvents === "true" || matchEvents === "false") {
      params.set("matchEvents", matchEvents);
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
    const payload = buildChppErrorPayload("Failed to fetch match details", error);
    return NextResponse.json(payload, {
      status: payload.statusCode === 401 ? 401 : 502,
    });
  }
}
