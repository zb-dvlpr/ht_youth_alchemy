import {
  CHPP_ENDPOINTS,
  createOAuthClient,
  type OAuthToken,
} from "@/lib/chpp/oauth";

export type NodeOAuthClient = {
  signer: ReturnType<typeof createOAuthClient>;
  callbackUrl: string;
};

export function createNodeOAuthClient(
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string
): NodeOAuthClient {
  return {
    signer: createOAuthClient(consumerKey, consumerSecret),
    callbackUrl,
  };
}

export type RequestTokenResult = {
  token: string;
  secret: string;
  results?: Record<string, string>;
};

export type AccessTokenResult = {
  token: string;
  secret: string;
  results?: Record<string, string>;
};

type OAuthRequestData = {
  url: string;
  method: string;
  data?: Record<string, string | string[]>;
};

function getAuthorizationHeader(
  client: NodeOAuthClient,
  requestData: OAuthRequestData,
  token?: OAuthToken,
  oauthParameters?: Record<string, string>
) {
  const authorization = client.signer.authorize(requestData, token);
  const header = client.signer.toHeader({
    ...authorization,
    ...oauthParameters,
  });
  return { Authorization: header.Authorization };
}

function parseTokenResult(
  body: string,
  failureMessage: string
): {
  token: string;
  secret: string;
  results: Record<string, string>;
} {
  const params = new URLSearchParams(body);
  const token = params.get("oauth_token");
  const secret = params.get("oauth_token_secret");

  if (!token || !secret) {
    throw new Error(failureMessage);
  }

  const results = Object.fromEntries(params.entries());
  delete results.oauth_token;
  delete results.oauth_token_secret;
  return { token, secret, results };
}

function createHttpError(message: string, statusCode: number) {
  return Object.assign(new Error(`${message}: ${statusCode}`), {
    statusCode,
  });
}

function formBodyData(body: string, contentType: string) {
  if (
    contentType.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/x-www-form-urlencoded"
  ) {
    return undefined;
  }

  const data: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(body)) {
    const current = data[key];
    if (current === undefined) {
      data[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      data[key] = [current, value];
    }
  }
  return data;
}

type OAuthData = Record<string, string | string[]>;

function appendOAuthDataValue(data: OAuthData, key: string, value: string) {
  const current = data[key];

  if (current === undefined) {
    data[key] = value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(value);
    return;
  }

  data[key] = [current, value];
}

function searchParamsData(searchParams: URLSearchParams) {
  const data: OAuthData = {};

  for (const [key, value] of searchParams.entries()) {
    appendOAuthDataValue(data, key, value);
  }

  return data;
}

function mergeOAuthData(...sources: Array<OAuthData | undefined>) {
  const merged: OAuthData = {};

  sources.forEach((source) => {
    if (!source) return;

    Object.entries(source).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => appendOAuthDataValue(merged, key, entry));
      } else {
        appendOAuthDataValue(merged, key, value);
      }
    });
  });

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function oauthBaseUrl(url: URL) {
  return `${url.origin}${url.pathname}`;
}

function buildOAuthRequestData(
  method: "GET" | "POST",
  requestUrl: URL,
  body?: string,
  contentType?: string
): OAuthRequestData {
  const queryData = searchParamsData(requestUrl.searchParams);
  const bodyData =
    body && contentType ? formBodyData(body, contentType) : undefined;

  return {
    url: oauthBaseUrl(requestUrl),
    method,
    data: mergeOAuthData(queryData, bodyData),
  };
}

export async function getRequestToken(
  client: NodeOAuthClient
): Promise<RequestTokenResult> {
  const requestUrl = new URL(CHPP_ENDPOINTS.requestToken);
  const oauthParameters = {
    oauth_callback: client.callbackUrl,
  };
  const requestData = {
    url: requestUrl.toString(),
    method: "GET",
    data: oauthParameters,
  };
  const headers = getAuthorizationHeader(
    client,
    requestData,
    undefined,
    oauthParameters
  );
  const response = await fetch(requestUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const body = await response.text();

  if (!response.ok) {
    throw createHttpError("Failed to obtain request token", response.status);
  }

  return parseTokenResult(body, "Failed to obtain request token");
}

export async function getAccessToken(
  client: NodeOAuthClient,
  requestToken: string,
  requestSecret: string,
  verifier: string
): Promise<AccessTokenResult> {
  const requestUrl = new URL(CHPP_ENDPOINTS.accessToken);
  const oauthParameters = {
    oauth_verifier: verifier,
  };
  const requestData = {
    url: requestUrl.toString(),
    method: "GET",
    data: oauthParameters,
  };
  const token = {
    key: requestToken,
    secret: requestSecret,
  };
  const headers = getAuthorizationHeader(
    client,
    requestData,
    token,
    oauthParameters
  );
  const response = await fetch(requestUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const body = await response.text();

  if (!response.ok) {
    throw createHttpError("Failed to obtain access token", response.status);
  }

  return parseTokenResult(body, "Failed to obtain access token");
}

export async function getProtectedResource(
  client: NodeOAuthClient,
  url: string,
  accessToken: string,
  accessSecret: string
): Promise<string> {
  const requestUrl = new URL(url);
  const requestData = buildOAuthRequestData("GET", requestUrl);
  const headers = getAuthorizationHeader(client, requestData, {
    key: accessToken,
    secret: accessSecret,
  });
  const response = await fetch(requestUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const body = await response.text();

  if (!response.ok) {
    throw createHttpError("CHPP GET failed", response.status);
  }

  return body;
}

export async function postProtectedResource(
  client: NodeOAuthClient,
  url: string,
  accessToken: string,
  accessSecret: string,
  body: string,
  contentType: string
): Promise<string> {
  const requestUrl = new URL(url);
  const requestData = buildOAuthRequestData(
    "POST",
    requestUrl,
    body,
    contentType
  );
  const oauthHeaders = getAuthorizationHeader(client, requestData, {
    key: accessToken,
    secret: accessSecret,
  });
  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      ...oauthHeaders,
      "Content-Type": contentType,
    },
    body,
    cache: "no-store",
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw createHttpError("CHPP POST failed", response.status);
  }

  return responseBody;
}
