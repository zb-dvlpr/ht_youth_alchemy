import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const TRANSFERS_TEAM_VERSION = "1.2";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const pageIndex = searchParams.get("pageIndex") ?? "1";

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "transfersteam",
      version: TRANSFERS_TEAM_VERSION,
      pageIndex,
    });
    if (teamId) {
      params.set("teamID", teamId);
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
    const payload = buildChppErrorPayload("Failed to fetch transfers team", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
