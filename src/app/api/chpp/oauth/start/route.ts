import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChppEnv } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import { createNodeOAuthClient, getRequestToken } from "@/lib/chpp/node-oauth";

export async function GET(request: Request) {
  try {
    const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
    const client = createNodeOAuthClient(
      consumerKey,
      consumerSecret,
      callbackUrl
    );

    const { token, secret } = await getRequestToken(client);

    const cookieStore = await cookies();
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

    const scope = "set_matchorder,manage_youthplayers";
    const authorizeUrl = `${CHPP_ENDPOINTS.authorize}?oauth_token=${encodeURIComponent(
      token
    )}&scope=${encodeURIComponent(scope)}`;
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
                callbackUrl: getChppEnv().callbackUrl,
                method: "node-oauth",
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
