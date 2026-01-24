import { OAuth } from "oauth";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";

export function createNodeOAuthClient(
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string
) {
  return new OAuth(
    CHPP_ENDPOINTS.requestToken,
    CHPP_ENDPOINTS.accessToken,
    consumerKey,
    consumerSecret,
    "1.0",
    callbackUrl,
    "HMAC-SHA1"
  );
}

export type RequestTokenResult = {
  token: string;
  secret: string;
  results?: Record<string, string>;
};

export function getRequestToken(client: OAuth): Promise<RequestTokenResult> {
  return new Promise((resolve, reject) => {
    client.getOAuthRequestToken((error, token, tokenSecret, results) => {
      if (error || !token || !tokenSecret) {
        reject(error ?? new Error("Failed to obtain request token"));
        return;
      }
      resolve({ token, secret: tokenSecret, results });
    });
  });
}

export type AccessTokenResult = {
  token: string;
  secret: string;
  results?: Record<string, string>;
};

export function getAccessToken(
  client: OAuth,
  requestToken: string,
  requestSecret: string,
  verifier: string
): Promise<AccessTokenResult> {
  return new Promise((resolve, reject) => {
    client.getOAuthAccessToken(
      requestToken,
      requestSecret,
      verifier,
      (error, token, tokenSecret, results) => {
        if (error || !token || !tokenSecret) {
          reject(error ?? new Error("Failed to obtain access token"));
          return;
        }
        resolve({ token, secret: tokenSecret, results });
      }
    );
  });
}

export function getProtectedResource(
  client: OAuth,
  url: string,
  accessToken: string,
  accessSecret: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    client.get(url, accessToken, accessSecret, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      if (typeof data !== "string") {
        resolve(JSON.stringify(data));
        return;
      }
      resolve(data);
    });
  });
}

export function postProtectedResource(
  client: OAuth,
  url: string,
  accessToken: string,
  accessSecret: string,
  body: string,
  contentType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    client.post(url, accessToken, accessSecret, body, contentType, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      if (typeof data !== "string") {
        resolve(JSON.stringify(data));
        return;
      }
      resolve(data);
    });
  });
}
