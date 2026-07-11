export type ChppEnv = {
  consumerKey: string;
  consumerSecret: string;
};

const CHPP_OAUTH_CALLBACK_PATH = "/api/chpp/oauth/callback";
const ALLOWED_CHPP_OAUTH_HOSTNAMES = new Set([
  "ht-alchemy.app",
  "www.ht-alchemy.app",
  "localhost",
  "127.0.0.1",
]);

export class InvalidChppOAuthHostError extends Error {
  constructor(hostname: string) {
    super(`Untrusted OAuth request host: ${hostname}`);
    this.name = "InvalidChppOAuthHostError";
  }
}

export function isAllowedChppOAuthHostname(hostname: string): boolean {
  return (
    ALLOWED_CHPP_OAUTH_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".vercel.app")
  );
}

export function getChppOAuthCallbackUrl(request: Request): string {
  const requestUrl = new URL(request.url);
  const { hostname } = requestUrl;

  if (!isAllowedChppOAuthHostname(hostname)) {
    throw new InvalidChppOAuthHostError(hostname);
  }

  return new URL(CHPP_OAUTH_CALLBACK_PATH, requestUrl.origin).toString();
}

export function getChppEnv(): ChppEnv {
  const consumerKey = process.env.CHPP_CONSUMER_KEY;
  const consumerSecret = process.env.CHPP_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    const missing = [
      !consumerKey ? "CHPP_CONSUMER_KEY" : null,
      !consumerSecret ? "CHPP_CONSUMER_SECRET" : null,
    ].filter(Boolean);

    throw new Error(
      `Missing required CHPP env vars: ${missing.join(", ")}`
    );
  }

  return { consumerKey, consumerSecret };
}
