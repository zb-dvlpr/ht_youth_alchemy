export type ChppEnv = {
  consumerKey: string;
  consumerSecret: string;
  callbackUrl: string;
};

const DEV_FALLBACK_CALLBACK_PATH = "/api/chpp/oauth/callback";
type CallbackResolutionInput = {
  requestUrl?: string;
  host?: string | null;
  forwardedProto?: string | null;
};

export function getChppEnv(): ChppEnv {
  const consumerKey = process.env.CHPP_CONSUMER_KEY;
  const consumerSecret = process.env.CHPP_CONSUMER_SECRET;
  const callbackUrl = process.env.CHPP_CALLBACK_URL;

  if (!consumerKey || !consumerSecret || !callbackUrl) {
    const missing = [
      !consumerKey ? "CHPP_CONSUMER_KEY" : null,
      !consumerSecret ? "CHPP_CONSUMER_SECRET" : null,
      !callbackUrl ? "CHPP_CALLBACK_URL" : null,
    ].filter(Boolean);

    throw new Error(
      `Missing required CHPP env vars: ${missing.join(", ")}`
    );
  }

  return { consumerKey, consumerSecret, callbackUrl };
}

export function resolveChppCallbackUrl(input?: string | CallbackResolutionInput): string {
  const { callbackUrl } = getChppEnv();
  if (process.env.NODE_ENV === "production" || !input) {
    return callbackUrl;
  }

  try {
    const configured = new URL(callbackUrl);
    const pathname = configured.pathname || DEV_FALLBACK_CALLBACK_PATH;
    const requestUrl = typeof input === "string" ? input : input.requestUrl;
    const requestHost = typeof input === "string" ? null : input.host;
    const requestProto = typeof input === "string" ? null : input.forwardedProto;

    if (requestHost) {
      const protocol =
        requestProto ??
        (requestHost.startsWith("localhost") || requestHost.startsWith("127.0.0.1")
          ? "http"
          : configured.protocol.replace(":", "") || "https");
      return `${protocol}://${requestHost}${pathname}`;
    }

    if (requestUrl) {
      const request = new URL(requestUrl);
      return `${request.origin}${pathname}`;
    }

    return callbackUrl;
  } catch {
    return callbackUrl;
  }
}
