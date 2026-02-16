import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const TEAMDETAILS_VERSION = "3.8";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const userId = searchParams.get("userId");

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "teamdetails",
      version: TEAMDETAILS_VERSION,
    });
    if (teamId) {
      params.set("teamID", teamId);
    } else if (userId) {
      params.set("userID", userId);
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
    const payload = buildChppErrorPayload("Failed to fetch team details", error);
    return NextResponse.json(payload, {
      status: payload.statusCode === 401 ? 401 : 502,
    });
  }
}
