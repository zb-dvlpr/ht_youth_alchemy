import { NextResponse } from "next/server";
import { getChppEnv, resolveChppCallbackUrl } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";

export async function GET(request: Request) {
  try {
    const { callbackUrl } = getChppEnv();
    const host = request.headers.get("host");
    const forwardedProto = request.headers.get("x-forwarded-proto");

    return NextResponse.json({
      env: {
        hasConsumerKey: Boolean(process.env.CHPP_CONSUMER_KEY),
        hasConsumerSecret: Boolean(process.env.CHPP_CONSUMER_SECRET),
        callbackUrl,
        resolvedCallbackUrl: resolveChppCallbackUrl({
          requestUrl: request.url,
          host,
          forwardedProto,
        }),
      },
      endpoints: CHPP_ENDPOINTS,
      request: {
        url: request.url,
        host,
        forwardedProto,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "CHPP env not configured",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
