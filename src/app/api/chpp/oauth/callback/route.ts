import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv, resolveChppCallbackUrl } from "@/lib/chpp/env";
import { createNodeOAuthClient, getAccessToken } from "@/lib/chpp/node-oauth";
import {
  CHPP_SESSION_COOKIE,
  chppSessionCookieOptions,
  sealChppSession,
} from "@/lib/chpp/session-cookie";

export async function GET(request: Request) {
  try {
    const { consumerKey, consumerSecret } = getChppEnv();
    const callbackUrl = resolveChppCallbackUrl({
      requestUrl: request.url,
      host: request.headers.get("host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
    });
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
      cookieStore.delete("chpp_req_token");
      cookieStore.delete("chpp_req_secret");
      return NextResponse.json(
        {
          error: "Request token mismatch or expired",
          ...(process.env.NODE_ENV === "production"
            ? {}
            : {
              debug: {
                requestPath: new URL(request.url).pathname,
                callbackUrl,
                requestHost: request.headers.get("host"),
                forwardedProto: request.headers.get("x-forwarded-proto"),
                hasRequestTokenCookie: Boolean(requestToken),
                hasRequestSecretCookie: Boolean(requestSecret),
                requestTokenMatches: requestToken === oauthToken,
              },
            }),
        },
        { status: 400 }
      );
    }

    const { token, secret } = await getAccessToken(
      client,
      oauthToken,
      requestSecret,
      oauthVerifier
    );

    const session = sealChppSession({
      accessToken: token,
      accessSecret: secret,
    });
    cookieStore.set(
      CHPP_SESSION_COOKIE,
      session,
      chppSessionCookieOptions
    );

    cookieStore.delete("chpp_access_token");
    cookieStore.delete("chpp_access_secret");
    cookieStore.delete("chpp_req_token");
    cookieStore.delete("chpp_req_secret");

    const redirectUrl = new URL(callbackUrl);
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error: "OAuth callback failed",
        ...(process.env.NODE_ENV === "production"
          ? {}
          : {
              details:
                error instanceof Error &&
                (error.message === "Missing CHPP_COOKIE_SECRET" ||
                  error.message ===
                    "CHPP_COOKIE_SECRET must be 32 bytes base64-encoded")
                  ? error.message
                  : "OAuth callback failed",
              debug: {
                requestPath: new URL(request.url).pathname,
                callbackUrl: resolveChppCallbackUrl({
                  requestUrl: request.url,
                  host: request.headers.get("host"),
                  forwardedProto: request.headers.get("x-forwarded-proto"),
                }),
                requestHost: request.headers.get("host"),
                forwardedProto: request.headers.get("x-forwarded-proto"),
              },
            }),
      },
      { status: 500 }
    );
  }
}
