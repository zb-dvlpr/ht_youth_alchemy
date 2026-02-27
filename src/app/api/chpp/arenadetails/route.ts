import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const ARENADETAILS_VERSION = "1.7";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const arenaId = searchParams.get("arenaId");
    const teamId = searchParams.get("teamId");

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "arenadetails",
      version: ARENADETAILS_VERSION,
    });
    if (arenaId) {
      params.set("arenaID", arenaId);
    } else if (teamId) {
      params.set("teamId", teamId);
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
    const payload = buildChppErrorPayload("Failed to fetch arena details", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
