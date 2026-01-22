import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv } from "@/lib/chpp/env";
import { createNodeOAuthClient, getAccessToken } from "@/lib/chpp/node-oauth";

export async function GET(request: Request) {
  try {
    const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
    const client = createNodeOAuthClient(
      consumerKey,
      consumerSecret,
      callbackUrl
    );

    const url = new URL(request.url);
    const oauthToken = url.searchParams.get("oauth_token");
    const oauthVerifier = url.searchParams.get("oauth_verifier");

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.json(
        { error: "Missing oauth_token or oauth_verifier" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const requestToken = cookieStore.get("chpp_req_token")?.value;
    const requestSecret = cookieStore.get("chpp_req_secret")?.value;

    if (!requestToken || !requestSecret || requestToken !== oauthToken) {
      return NextResponse.json(
        { error: "Request token mismatch or expired" },
        { status: 400 }
      );
    }

    const { token, secret } = await getAccessToken(
      client,
      oauthToken,
      requestSecret,
      oauthVerifier
    );

    cookieStore.set("chpp_access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    cookieStore.set("chpp_access_secret", secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    cookieStore.delete("chpp_req_token");
    cookieStore.delete("chpp_req_secret");

    return NextResponse.json({
      status: "ok",
      message: "CHPP OAuth completed. Access token stored in httpOnly cookies.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "OAuth callback failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
