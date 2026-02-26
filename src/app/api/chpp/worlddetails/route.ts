import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const WORLDDETAILS_VERSION = "2.0";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId");
    const leagueId = searchParams.get("leagueId");
    const includeRegions = searchParams.get("includeRegions");

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "worlddetails",
      version: WORLDDETAILS_VERSION,
    });
    if (countryId) {
      params.set("countryID", countryId);
    }
    if (leagueId) {
      params.set("leagueID", leagueId);
    }
    if (includeRegions === "true" || includeRegions === "false") {
      params.set("includeRegions", includeRegions);
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
    const payload = buildChppErrorPayload("Failed to fetch world details", error);
    return NextResponse.json(payload, {
      status: payload.statusCode === 401 ? 401 : 502,
    });
  }
}
