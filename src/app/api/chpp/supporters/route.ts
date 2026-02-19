import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const SUPPORTERS_VERSION = "1.0";

export async function GET() {
  try {
    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "supporters",
      version: SUPPORTERS_VERSION,
      actionType: "supportedteams",
    });

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    return NextResponse.json({ data: parsed, raw: rawXml });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: "CHPP_AUTH_MISSING" },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch supporters", error);
    return NextResponse.json(payload, {
      status: payload.statusCode === 401 ? 401 : 502,
    });
  }
}
