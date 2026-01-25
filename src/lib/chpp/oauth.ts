import OAuth from "oauth-1.0a";
import crypto from "crypto";

export const CHPP_ENDPOINTS = {
  requestToken: "https://chpp.hattrick.org/oauth/request_token.ashx",
  authorize: "https://chpp.hattrick.org/oauth/authorize.aspx",
  accessToken: "https://chpp.hattrick.org/oauth/access_token.ashx",
  checkToken: "https://chpp.hattrick.org/oauth/check_token.ashx",
  invalidateToken: "https://chpp.hattrick.org/oauth/invalidate_token.ashx",
} as const;

export type OAuthToken = {
  key: string;
  secret: string;
};

export function createOAuthClient(consumerKey: string, consumerSecret: string) {
  return new OAuth({
    consumer: { key: consumerKey, secret: consumerSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

export function parseTokenResponse(body: string): OAuthToken & {
  raw: string;
  oauthCallbackConfirmed?: string | null;
} {
  const params = new URLSearchParams(body);
  return {
    key: params.get("oauth_token") ?? "",
    secret: params.get("oauth_token_secret") ?? "",
    oauthCallbackConfirmed: params.get("oauth_callback_confirmed"),
    raw: body,
  };
}

export function toAuthHeader(oauth: OAuth, requestData: OAuth.RequestOptions, token?: OAuthToken) {
  return oauth.toHeader(oauth.authorize(requestData, token));
}
