import { NextResponse } from "next/server";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  ChppAuthError,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";

const TRAINING_VERSION = "2.2";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const actionType = url.searchParams.get("actionType") ?? "view";
    const teamId = url.searchParams.get("teamId");

    const auth = await getChppAuth();
    const params = new URLSearchParams({
      file: "training",
      version: TRAINING_VERSION,
      actionType,
    });
    if (teamId) {
      params.set("teamId", teamId);
    }

    const { parsed, rawXml } = await fetchChppXml(auth, params);
    return NextResponse.json({ data: parsed, raw: rawXml });
  } catch (error) {
    if (error instanceof ChppAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const payload = buildChppErrorPayload("Failed to fetch training", error);
    return NextResponse.json(payload, {
      status: chppErrorHttpStatus(payload),
    });
  }
}
