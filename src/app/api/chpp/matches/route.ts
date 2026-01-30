import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";
const DEFAULT_VERSION = "2.9";

function buildParams(url: URL) {
  const version = url.searchParams.get("version") ?? DEFAULT_VERSION;
  const isYouth = url.searchParams.get("isYouth") ?? "true";
  const teamID = url.searchParams.get("teamID");
  const lastMatchDate = url.searchParams.get("lastMatchDate");

  const params = new URLSearchParams({
    file: "matches",
    version,
    isYouth,
  });

  if (teamID) params.set("teamID", teamID);
  if (lastMatchDate) params.set("lastMatchDate", lastMatchDate);

  return params;
}

export async function GET(request: Request) {
  try {
    const auth = await getChppAuth();
    const url = new URL(request.url);
    const params = buildParams(url);
    const { rawXml, parsed } = await fetchChppXml(auth, params);

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
    const payload = buildChppErrorPayload("Failed to fetch matches", error);
    return NextResponse.json(payload, {
      status: payload.statusCode === 401 ? 401 : 502,
    });
  }
}
