import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import { ChppUpstreamError } from "@/lib/chpp/node-oauth";

const AUTHORIZE_PREFLIGHT_TIMEOUT_MS = 3000;

function isAuthorizeOutageBody(body: string) {
  const lowerBody = body.toLowerCase();
  return (
    lowerBody.includes("the service is unavailable") ||
    lowerBody.includes("service unavailable") ||
    lowerBody.includes("server too busy")
  );
}

export async function assertChppAuthorizePageAvailable() {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AUTHORIZE_PREFLIGHT_TIMEOUT_MS
  );

  try {
    const url = new URL(CHPP_ENDPOINTS.authorize);
    url.searchParams.set("oauth_token", "alchemy_healthcheck");

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.text();

    if (response.status >= 500 || isAuthorizeOutageBody(body)) {
      throw new ChppUpstreamError({
        message: "CHPP authorize page unavailable",
        statusCode: response.status || 503,
        statusText: response.statusText,
        phase: "authorize-preflight",
        endpoint: "authorize",
        data: body,
      });
    }
  } catch (error) {
    if (error instanceof ChppUpstreamError) {
      throw error;
    }

    throw new ChppUpstreamError({
      message: "CHPP authorize page preflight failed",
      statusCode: 503,
      phase: "authorize-preflight",
      endpoint: "authorize",
      data: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}
