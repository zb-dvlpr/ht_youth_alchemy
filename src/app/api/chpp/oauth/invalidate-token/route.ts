import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import {
  CHPP_SESSION_COOKIE,
  openChppSession,
} from "@/lib/chpp/session-cookie";
import {
  createNodeOAuthClient,
  getProtectedResource,
} from "@/lib/chpp/node-oauth";
import {
  assertSameOrigin,
  InvalidOriginError,
} from "@/lib/security/origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof InvalidOriginError) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }
    throw error;
  }

  const cookieStore = await cookies();
  const session = openChppSession(
    cookieStore.get(CHPP_SESSION_COOKIE)?.value
  );

  let raw: string | null = null;
  let invalidationFailed = false;

  if (session) {
    try {
      const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
      const client = createNodeOAuthClient(
        consumerKey,
        consumerSecret,
        callbackUrl
      );
      raw = await getProtectedResource(
        client,
        CHPP_ENDPOINTS.invalidateToken,
        session.accessToken,
        session.accessSecret
      );
    } catch {
      invalidationFailed = true;
    }
  } else {
    invalidationFailed = true;
  }

  cookieStore.delete(CHPP_SESSION_COOKIE);
  cookieStore.delete("chpp_access_token");
  cookieStore.delete("chpp_access_secret");
  cookieStore.delete("chpp_req_token");
  cookieStore.delete("chpp_req_secret");

  if (invalidationFailed) {
    return NextResponse.json({
      ok: false,
      error: "Failed to invalidate token",
      details: "CHPP token invalidation failed or no active session was found.",
    });
  }

  return NextResponse.json({ ok: true, raw });
}
