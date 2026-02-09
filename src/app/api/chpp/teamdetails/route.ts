import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const TEAMDETAILS_VERSION = "1.8";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    if (!teamId) {
      return NextResponse.json(
        { error: "Missing teamId query parameter." },
        { status: 400 }
      );
    }

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "teamdetails",
      version: TEAMDETAILS_VERSION,
      teamID: teamId,
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
    const payload = buildChppErrorPayload("Failed to fetch team details", error);
    return NextResponse.json(payload, {
      status: payload.statusCode === 401 ? 401 : 502,
    });
  }
}
