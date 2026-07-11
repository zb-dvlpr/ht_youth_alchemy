import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getChppEnv,
  getChppOAuthCallbackUrl,
  InvalidChppOAuthHostError,
} from "@/lib/chpp/env";
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
import { buildChppErrorPayload } from "@/lib/chpp/server";
import { buildOauthErrorRedirectUrl } from "@/lib/chpp/oauth-errors";

function clearOauthCookies(response: NextResponse, names: readonly string[]) {
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

function clearAllOauthCookies(response: NextResponse) {
  clearOauthCookies(response, [
    "chpp_access_token",
    "chpp_access_secret",
    "chpp_req_token",
    "chpp_req_secret",
    CHPP_PERMISSION_FLOW_COOKIE,
  ]);
}

function logOauthCallbackFailure(
  request: Request,
  payload: ReturnType<typeof buildChppErrorPayload>,
  error: unknown
) {
  const errorObject =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : null;

  console.error("CHPP OAuth callback failed", {
    phase: "callback",
    oauthPhase:
      errorObject && typeof errorObject.phase === "string"
        ? errorObject.phase
        : null,
    endpoint:
      errorObject && typeof errorObject.endpoint === "string"
        ? errorObject.endpoint
        : null,
    statusCode: payload.statusCode,
    statusText:
      errorObject && typeof errorObject.statusText === "string"
        ? errorObject.statusText
        : null,
    code: payload.code,
    host: request.headers.get("host"),
    path: new URL(request.url).pathname,
    vercelId: request.headers.get("x-vercel-id"),
    dataPreview:
      errorObject && typeof errorObject.data === "string"
        ? errorObject.data.slice(0, 500)
        : null,
    details:
      process.env.NODE_ENV === "production"
        ? undefined
        : payload.debugDetails ?? payload.details,
  });
}

export async function GET(request: Request) {
  try {
    const callbackUrl = getChppOAuthCallbackUrl(request);
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

    clearAllOauthCookies(response);
    return response;
  } catch (error) {
    if (error instanceof InvalidChppOAuthHostError) {
      const response = NextResponse.json(
        { error: "Invalid OAuth request host." },
        { status: 400 }
      );
      clearTemporaryOauthCookies(response);
      return response;
    }

    const payload = buildChppErrorPayload("OAuth callback failed", error);
    logOauthCallbackFailure(request, payload, error);

    const response = NextResponse.redirect(
      buildOauthErrorRedirectUrl({
        requestUrl: request.url,
        phase: "callback",
        statusCode: payload.statusCode,
        code: payload.code,
      })
    );
    clearTemporaryOauthCookies(response);
    return response;
  }
}
