import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import {
  createNodeOAuthClient,
  getProtectedResource,
} from "@/lib/chpp/node-oauth";

async function invalidateToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("chpp_access_token")?.value;
  const accessSecret = cookieStore.get("chpp_access_secret")?.value;

  let raw: string | null = null;
  let errorMessage: string | null = null;

  if (accessToken && accessSecret) {
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
        accessToken,
        accessSecret
      );
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : String(error);
    }
  } else {
    errorMessage = "Missing CHPP access token. Re-auth required.";
  }

  cookieStore.delete("chpp_access_token");
  cookieStore.delete("chpp_access_secret");

  if (errorMessage) {
    return NextResponse.json({
      ok: false,
      error: "Failed to invalidate token",
      details: errorMessage,
    });
  }

  return NextResponse.json({ ok: true, raw });
}

export async function POST() {
  return invalidateToken();
}

export async function GET() {
  return invalidateToken();
}
