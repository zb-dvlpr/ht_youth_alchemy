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
    const oauthClient = client as unknown as {
      getOAuthRequestToken: (
        callback: (
          error: unknown,
          token?: string,
          tokenSecret?: string,
          results?: Record<string, string>
        ) => void
      ) => void;
    };
    oauthClient.getOAuthRequestToken((
      error: unknown,
      token?: string,
      tokenSecret?: string,
      results?: Record<string, string>
    ) => {
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
    const oauthClient = client as unknown as {
      getOAuthAccessToken: (
        requestToken: string,
        requestSecret: string,
        verifier: string,
        callback: (
          error: unknown,
          token?: string,
          tokenSecret?: string,
          results?: Record<string, string>
        ) => void
      ) => void;
    };
    oauthClient.getOAuthAccessToken(
      requestToken,
      requestSecret,
      verifier,
      (
        error: unknown,
        token?: string,
        tokenSecret?: string,
        results?: Record<string, string>
      ) => {
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
    const oauthClient = client as unknown as {
      get: (
        url: string,
        accessToken: string,
        accessSecret: string,
        callback: (error: unknown, data: unknown) => void
      ) => void;
    };
    oauthClient.get(url, accessToken, accessSecret, (error: unknown, data: unknown) => {
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
    const oauthClient = client as unknown as {
      post: (
        url: string,
        accessToken: string,
        accessSecret: string,
        body: string,
        contentType: string,
        callback: (error: unknown, data: unknown) => void
      ) => void;
    };
    oauthClient.post(
      url,
      accessToken,
      accessSecret,
      body,
      contentType,
      (error: unknown, data: unknown) => {
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
