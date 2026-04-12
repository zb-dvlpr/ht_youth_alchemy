import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const DEFAULT_VERSION = "2.3";

function buildParams(url: URL) {
  const version = url.searchParams.get("version") ?? DEFAULT_VERSION;
  const actionType = url.searchParams.get("actionType") ?? "view";
  const matchID = url.searchParams.get("matchID");
  const sourceSystem = url.searchParams.get("sourceSystem");
  const includeStartingLineup = url.searchParams.get("includeStartingLineup");
  const useLiveEventsAndTexts = url.searchParams.get("useLiveEventsAndTexts");
  const lastShownIndexes = url.searchParams.get("lastShownIndexes");

  const params = new URLSearchParams({
    file: "live",
    version,
    actionType,
  });

  if (matchID) params.set("matchID", matchID);
  if (sourceSystem) params.set("sourceSystem", sourceSystem);
  if (includeStartingLineup) {
    params.set("includeStartingLineup", includeStartingLineup);
  }
  if (useLiveEventsAndTexts) {
    params.set("useLiveEventsAndTexts", useLiveEventsAndTexts);
  }
  if (lastShownIndexes) params.set("lastShownIndexes", lastShownIndexes);

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
    const payload = buildChppErrorPayload("Failed to fetch live match data", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
