import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv, resolveChppCallbackUrl } from "@/lib/chpp/env";
import { createNodeOAuthClient, getAccessToken } from "@/lib/chpp/node-oauth";
import {
  CHPP_PERMISSION_FLOW_COOKIE,
  CHPP_PERMISSION_FLOW_VERSION,
} from "@/lib/chpp/permissions";
import {
  CHPP_SESSION_COOKIE,
  chppSessionCookieOptions,
  sealChppSession,
} from "@/lib/chpp/session-cookie";

function clearOauthCookies(
  response: NextResponse,
  names: readonly string[]
) {
  for (const name of names) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

function clearTemporaryOauthCookies(response: NextResponse) {
  clearOauthCookies(response, [
    "chpp_req_token",
    "chpp_req_secret",
    CHPP_PERMISSION_FLOW_COOKIE,
  ]);
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const permissionFlowVersion = cookieStore.get(
      CHPP_PERMISSION_FLOW_COOKIE
    )?.value;
    if (permissionFlowVersion !== CHPP_PERMISSION_FLOW_VERSION) {
      const redirectUrl = new URL("/", request.url);
      redirectUrl.searchParams.set("reauthorize", "1");
      redirectUrl.searchParams.set("reason", "stale-permission-flow");
      const response = NextResponse.redirect(redirectUrl);
      clearTemporaryOauthCookies(response);
      return response;
    }

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
      const response = NextResponse.json(
        { error: "Missing oauth_token or oauth_verifier" },
        { status: 400 }
      );
      clearTemporaryOauthCookies(response);
      return response;
    }

    const requestToken = cookieStore.get("chpp_req_token")?.value;
    const requestSecret = cookieStore.get("chpp_req_secret")?.value;

    if (!requestToken || !requestSecret || requestToken !== oauthToken) {
      const response = NextResponse.json(
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
      clearTemporaryOauthCookies(response);
      return response;
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
    const redirectUrl = new URL(callbackUrl);
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(
      CHPP_SESSION_COOKIE,
      session,
      chppSessionCookieOptions
    );

    clearOauthCookies(response, [
      "chpp_access_token",
      "chpp_access_secret",
      "chpp_req_token",
      "chpp_req_secret",
      CHPP_PERMISSION_FLOW_COOKIE,
    ]);
    return response;
  } catch (error) {
    const response = NextResponse.json(
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
    clearTemporaryOauthCookies(response);
    return response;
  }
}
