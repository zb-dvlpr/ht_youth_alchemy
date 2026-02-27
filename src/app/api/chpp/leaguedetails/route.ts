import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const LEAGUEDETAILS_VERSION = "1.6";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueLevelUnitId = searchParams.get("leagueLevelUnitId");
    if (!leagueLevelUnitId) {
      return NextResponse.json(
        { error: "Missing leagueLevelUnitId query parameter." },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "leaguedetails",
      version: LEAGUEDETAILS_VERSION,
      leagueLevelUnitID: leagueLevelUnitId,
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
    const payload = buildChppErrorPayload("Failed to fetch league details", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
