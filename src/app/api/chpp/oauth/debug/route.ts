import { NextResponse } from "next/server";
import { getChppEnv } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";

export async function GET() {
  try {
    const { callbackUrl } = getChppEnv();

    return NextResponse.json({
      env: {
        hasConsumerKey: Boolean(process.env.CHPP_CONSUMER_KEY),
        hasConsumerSecret: Boolean(process.env.CHPP_CONSUMER_SECRET),
        callbackUrl,
      },
      endpoints: CHPP_ENDPOINTS,
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
