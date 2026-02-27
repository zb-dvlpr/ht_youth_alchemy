import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const MATCHESARCHIVE_VERSION = "1.5";

function buildParams(url: URL) {
  const params = new URLSearchParams({
    file: "matchesarchive",
    version: url.searchParams.get("version") ?? MATCHESARCHIVE_VERSION,
  });

  const teamId = url.searchParams.get("teamId") ?? url.searchParams.get("teamID");
  const isYouth = url.searchParams.get("isYouth");
  const firstMatchDate =
    url.searchParams.get("firstMatchDate") ??
    url.searchParams.get("FirstMatchDate");
  const lastMatchDate =
    url.searchParams.get("lastMatchDate") ??
    url.searchParams.get("LastMatchDate");
  const season = url.searchParams.get("season");
  const includeHTO =
    url.searchParams.get("includeHTO") ?? url.searchParams.get("includeHto");

  if (teamId) params.set("teamID", teamId);
  if (isYouth) params.set("isYouth", isYouth);
  if (firstMatchDate) params.set("FirstMatchDate", firstMatchDate);
  if (lastMatchDate) params.set("LastMatchDate", lastMatchDate);
  if (season) params.set("season", season);
  if (includeHTO) params.set("includeHTO", includeHTO);

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
    const payload = buildChppErrorPayload("Failed to fetch matches archive", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
