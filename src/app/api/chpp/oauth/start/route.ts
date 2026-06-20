import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv, resolveChppCallbackUrl } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import {
  buildChppScopeParam,
  normalizeOptionalChppPermissions,
} from "@/lib/chpp/permissions";
import { createNodeOAuthClient, getRequestToken } from "@/lib/chpp/node-oauth";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const requestedPermissions = [
      ...requestUrl.searchParams.getAll("permission"),
      ...(requestUrl.searchParams.get("permissions")?.split(",") ?? []),
    ];
    const selectedPermissions =
      normalizeOptionalChppPermissions(requestedPermissions);
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

    const { token, secret } = await getRequestToken(client);

    const cookieStore = await cookies();
    cookieStore.delete("chpp_req_token");
    cookieStore.delete("chpp_req_secret");
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

    const scope = buildChppScopeParam(selectedPermissions);
    const authorizeUrl = new URL(CHPP_ENDPOINTS.authorize);
    authorizeUrl.searchParams.set("oauth_token", token);
    authorizeUrl.searchParams.set("scope", scope);
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const debug = new URL(request.url).searchParams.get("debug") === "1";
    return NextResponse.json(
      {
        error: "OAuth start failed",
        details: error instanceof Error ? error.message : String(error),
        ...(debug
          ? {
              debug: {
                requestTokenUrl: CHPP_ENDPOINTS.requestToken,
                accessTokenUrl: CHPP_ENDPOINTS.accessToken,
                authorizeUrl: CHPP_ENDPOINTS.authorize,
                callbackUrl: resolveChppCallbackUrl({
                  requestUrl: request.url,
                  host: request.headers.get("host"),
                  forwardedProto: request.headers.get("x-forwarded-proto"),
                }),
                method: "node-oauth",
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
