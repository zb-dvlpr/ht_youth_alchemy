import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import {
  createNodeOAuthClient,
  getProtectedResource,
} from "@/lib/chpp/node-oauth";

export async function GET() {
  try {
    const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
    const client = createNodeOAuthClient(
      consumerKey,
      consumerSecret,
      callbackUrl
    );

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("chpp_access_token")?.value;
    const accessSecret = cookieStore.get("chpp_access_secret")?.value;

    if (!accessToken || !accessSecret) {
      return NextResponse.json(
        { error: "Missing CHPP access token. Re-auth required." },
        { status: 401 }
      );
    }

    const raw = await getProtectedResource(
      client,
      CHPP_ENDPOINTS.checkToken,
      accessToken,
      accessSecret
    );

    return NextResponse.json({ raw });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check token",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
