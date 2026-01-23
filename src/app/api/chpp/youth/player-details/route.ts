import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";
const DEFAULT_VERSION = "1.2";

function buildParams(url: URL) {
  const version = url.searchParams.get("version") ?? DEFAULT_VERSION;
  const youthPlayerID = url.searchParams.get("youthPlayerID");
  const showLastMatch = url.searchParams.get("showLastMatch");
  const showScoutCall = url.searchParams.get("showScoutCall");

  if (!youthPlayerID) {
    throw new Error("Missing required youthPlayerID parameter");
  }

  const params = new URLSearchParams({
    file: "youthplayerdetails",
    version,
    youthPlayerID,
  });

  if (showLastMatch) params.set("showLastMatch", showLastMatch);
  if (showScoutCall) params.set("showScoutCall", showScoutCall);

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
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      buildChppErrorPayload("Failed to fetch youth player details", error),
      { status: 502 }
    );
  }
}
