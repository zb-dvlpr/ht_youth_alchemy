import { NextResponse } from "next/server";
import {
  assertChppPermissions,
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  ChppPermissionError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";
const DEFAULT_VERSION = "1.3";

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
    let rawXml = "";
    let parsed: unknown = null;
    let unlockStatus: "success" | "denied" | null = null;

    if (useUnlock) {
      await assertChppPermissions(auth, ["manage_youthplayers"]);
      try {
        url.searchParams.set("actionType", "unlockskills");
        const unlockResult = await fetchChppXml(auth, buildParams(url));
        rawXml = unlockResult.rawXml;
        parsed = unlockResult.parsed;
        const fileName =
          (unlockResult.parsed?.HattrickData?.FileName as string | undefined) ?? "";
        if (fileName.toLowerCase() === "chpperror.xml") {
          unlockStatus = "denied";
          url.searchParams.set("actionType", "details");
          const fallback = await fetchChppXml(auth, buildParams(url));
          rawXml = fallback.rawXml;
          parsed = fallback.parsed;
        } else {
          unlockStatus = "success";
        }
      } catch {
        // Some CHPP setups deny unlockskills at transport layer; return regular details instead.
        unlockStatus = "denied";
        url.searchParams.set("actionType", "details");
        const fallback = await fetchChppXml(auth, buildParams(url));
        rawXml = fallback.rawXml;
        parsed = fallback.parsed;
      }
    } else {
      const result = await fetchChppXml(auth, buildParams(url));
      rawXml = result.rawXml;
      parsed = result.parsed;
    }

    const includeRaw = url.searchParams.get("raw") === "1";

    return NextResponse.json({
      data: parsed,
      ...(useUnlock && unlockStatus ? { unlockStatus } : {}),
      ...(includeRaw ? { raw: rawXml } : {}),
    });
  } catch (error) {
    if (error instanceof ChppPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.message,
          code: error.code,
          missingPermissions: error.missingPermissions,
        },
        { status: error.status }
      );
    }
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload(
      "Failed to fetch youth player details",
      error
    );
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
