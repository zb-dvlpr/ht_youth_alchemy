import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";
const DEFAULT_VERSION = "1.2";
const DEFAULT_ACTION = "list";

function buildParams(url: URL) {
  const actionType = url.searchParams.get("actionType") ?? DEFAULT_ACTION;
  const version = url.searchParams.get("version") ?? DEFAULT_VERSION;
  const orderBy = url.searchParams.get("orderBy");
  const youthTeamID = url.searchParams.get("youthTeamID");
  const showScoutCall = url.searchParams.get("showScoutCall");
  const showLastMatch = url.searchParams.get("showLastMatch");

  const params = new URLSearchParams({
    file: "youthplayerlist",
    version,
    actionType,
  });

  if (orderBy) params.set("orderBy", orderBy);
  if (youthTeamID) params.set("youthTeamID", youthTeamID);
  if (showScoutCall) params.set("showScoutCall", showScoutCall);
  if (showLastMatch) params.set("showLastMatch", showLastMatch);

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
      buildChppErrorPayload("Failed to fetch youth player list", error),
      { status: 502 }
    );
  }
}
