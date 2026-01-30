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
  const actionType = url.searchParams.get("actionType");

  if (!youthPlayerID) {
    throw new Error("Missing required youthPlayerID parameter");
  }

  const params = new URLSearchParams({
    file: "youthplayerdetails",
    version,
    youthPlayerID,
  });

  if (actionType) params.set("actionType", actionType);
  if (showLastMatch) params.set("showLastMatch", showLastMatch);
  if (showScoutCall) params.set("showScoutCall", showScoutCall);

  return params;
}

export async function GET(request: Request) {
  try {
    const auth = await getChppAuth();
    const url = new URL(request.url);
    const useUnlock = url.searchParams.get("unlockSkills") === "1";
    if (useUnlock) {
      url.searchParams.set("actionType", "unlockskills");
    }
    const params = buildParams(url);
    let { rawXml, parsed } = await fetchChppXml(auth, params);
    const fileName = (parsed?.HattrickData?.FileName as string | undefined) ?? "";
    if (useUnlock && fileName.toLowerCase() === "chpperror.xml") {
      url.searchParams.set("actionType", "details");
      const fallback = await fetchChppXml(auth, buildParams(url));
      rawXml = fallback.rawXml;
      parsed = fallback.parsed;
    }

    const includeRaw = url.searchParams.get("raw") === "1";

    return NextResponse.json({
      data: parsed,
      ...(useUnlock
        ? {
            unlockStatus:
              fileName.toLowerCase() === "chpperror.xml" ? "denied" : "success",
          }
        : {}),
      ...(includeRaw ? { raw: rawXml } : {}),
    });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload(
      "Failed to fetch youth player details",
      error
    );
    return NextResponse.json(payload, {
      status: payload.statusCode === 401 ? 401 : 502,
    });
  }
}
