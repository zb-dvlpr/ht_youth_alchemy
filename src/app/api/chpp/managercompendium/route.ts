import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const DEFAULT_VERSION = "1.5";

export async function GET(request: Request) {
  try {
    const auth = await getChppAuth();
    const url = new URL(request.url);
    const version = url.searchParams.get("version") ?? DEFAULT_VERSION;
    const userId = url.searchParams.get("userId");

    const params = new URLSearchParams({
      file: "managercompendium",
      version,
    });

    if (userId) params.set("userId", userId);

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
    const payload = buildChppErrorPayload(
      "Failed to fetch manager compendium",
      error
    );
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
