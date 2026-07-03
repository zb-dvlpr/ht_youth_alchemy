import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const CLUB_VERSION = "1.5";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId") ?? searchParams.get("teamID");

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "club",
      version: searchParams.get("version") ?? CLUB_VERSION,
    });
    if (teamId) {
      params.set("teamId", teamId);
    }

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    const includeRaw = searchParams.get("raw") === "1";
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
    const payload = buildChppErrorPayload("Failed to fetch club data", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
