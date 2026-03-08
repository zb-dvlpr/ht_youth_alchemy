import { NextResponse } from "next/server";
import { buildChppErrorPayload, chppErrorHttpStatus } from "@/lib/chpp/server";
import {
  assertChppPermissions,
  ChppAuthError,
  ChppPermissionError,
  fetchChppTokenCheck,
  getChppAuth,
} from "@/lib/chpp/server";

export async function GET(request: Request) {
  try {
    const skipPermissionCheck =
      new URL(request.url).searchParams.get("skipPermissionCheck") === "1";
    const auth = await getChppAuth();
    const { raw, permissions } = await fetchChppTokenCheck(auth);
    if (!skipPermissionCheck) {
      await assertChppPermissions(auth, undefined, permissions);
    }

    return NextResponse.json({ raw, permissions });
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
    const payload = buildChppErrorPayload("Failed to check token", error);
    const status = chppErrorHttpStatus(payload);
    return NextResponse.json(payload, { status });
  }
}
