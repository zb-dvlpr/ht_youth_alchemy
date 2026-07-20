import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const LEAGUEFIXTURES_VERSION = "1.2";

function parseLeagueLevelUnitId(url: URL) {
  const raw =
    url.searchParams.get("leagueLevelUnitID") ??
    url.searchParams.get("leagueLevelUnitId");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) return null;
  return String(parsed);
}

export async function GET(request: Request) {
  try {
    const auth = await getChppAuth();
    const url = new URL(request.url);
    const leagueLevelUnitID = parseLeagueLevelUnitId(url);

    if (!leagueLevelUnitID) {
      return NextResponse.json(
        { error: "A valid positive integer leagueLevelUnitID is required." },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      file: "leaguefixtures",
      version: LEAGUEFIXTURES_VERSION,
      leagueLevelUnitID,
    });

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
    const payload = buildChppErrorPayload("Failed to fetch league fixtures", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
