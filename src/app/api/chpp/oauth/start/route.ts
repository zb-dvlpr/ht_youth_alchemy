import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getChppEnv,
  getChppOAuthCallbackUrl,
  InvalidChppOAuthHostError,
} from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import {
  buildChppScopeParam,
  CHPP_PERMISSION_FLOW_COOKIE,
  CHPP_PERMISSION_FLOW_QUERY_PARAM,
  CHPP_PERMISSION_FLOW_VERSION,
  normalizeOptionalChppPermissions,
} from "@/lib/chpp/permissions";
import { createNodeOAuthClient, getRequestToken } from "@/lib/chpp/node-oauth";
import { assertChppAuthorizePageAvailable } from "@/lib/chpp/health";
import { buildChppErrorPayload } from "@/lib/chpp/server";
import { buildOauthErrorRedirectUrl } from "@/lib/chpp/oauth-errors";

function clearTemporaryOauthCookies(response: NextResponse) {
  for (const name of [
    "chpp_req_token",
    "chpp_req_secret",
    CHPP_PERMISSION_FLOW_COOKIE,
  ]) {
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

function logOauthStartFailure(
  request: Request,
  payload: ReturnType<typeof buildChppErrorPayload>,
  error: unknown
) {
  const errorObject =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : null;

  console.error("CHPP OAuth start failed", {
    phase: "start",
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
  const requestUrl = new URL(request.url);
  let callbackUrl: string;
  try {
    callbackUrl = getChppOAuthCallbackUrl(request);
  } catch (error) {
    if (error instanceof InvalidChppOAuthHostError) {
      return NextResponse.json(
        { error: "Invalid OAuth request host." },
        { status: 400 }
      );
    }
    throw error;
  }

  if (
    requestUrl.searchParams.get(CHPP_PERMISSION_FLOW_QUERY_PARAM) !==
    CHPP_PERMISSION_FLOW_VERSION
  ) {
    const redirectUrl = new URL("/", requestUrl.origin);
    redirectUrl.searchParams.set("reauthorize", "1");
    redirectUrl.searchParams.set("reason", "stale-permission-flow");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const requestedPermissions = [
      ...requestUrl.searchParams.getAll("permission"),
      ...(requestUrl.searchParams.get("permissions")?.split(",") ?? []),
    ];
    const selectedPermissions =
      normalizeOptionalChppPermissions(requestedPermissions);
    const { consumerKey, consumerSecret } = getChppEnv();
    const client = createNodeOAuthClient(
      consumerKey,
      consumerSecret,
      callbackUrl
    );

    await assertChppAuthorizePageAvailable();
    const { token, secret } = await getRequestToken(client);

    const cookieStore = await cookies();
    cookieStore.delete("chpp_req_token");
    cookieStore.delete("chpp_req_secret");
    cookieStore.delete(CHPP_PERMISSION_FLOW_COOKIE);
    cookieStore.set("chpp_req_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    cookieStore.set("chpp_req_secret", secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    cookieStore.set(
      CHPP_PERMISSION_FLOW_COOKIE,
      CHPP_PERMISSION_FLOW_VERSION,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 10 * 60,
      }
    );

    const scope = buildChppScopeParam(selectedPermissions);
    const authorizeUrl = new URL(CHPP_ENDPOINTS.authorize);
    authorizeUrl.searchParams.set("oauth_token", token);
    authorizeUrl.searchParams.set("scope", scope);
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const payload = buildChppErrorPayload("OAuth start failed", error);
    logOauthStartFailure(request, payload, error);

    const response = NextResponse.redirect(
      buildOauthErrorRedirectUrl({
        requestUrl: request.url,
        phase: "start",
        statusCode: payload.statusCode,
        code: payload.code,
      })
    );
    clearTemporaryOauthCookies(response);
    return response;
  }
}
