import { cookies } from "next/headers";
import { XMLParser } from "fast-xml-parser";
import { getChppEnv } from "@/lib/chpp/env";
import { createNodeOAuthClient, getProtectedResource, postProtectedResource } from "@/lib/chpp/node-oauth";

export const CHPP_XML_ENDPOINT = "https://chpp.hattrick.org/chppxml.ashx";

type ChppClient = ReturnType<typeof createNodeOAuthClient>;

export type ChppAuth = {
  client: ChppClient;
  accessToken: string;
  accessSecret: string;
};

export class ChppAuthError extends Error {
  status = 401;

  constructor(message = "Missing CHPP access token. Re-auth required.") {
    super(message);
  }
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export function parseChppXml(rawXml: string) {
  return xmlParser.parse(rawXml);
}

export function buildChppUrl(params: URLSearchParams) {
  return `${CHPP_XML_ENDPOINT}?${params.toString()}`;
}

export async function getChppAuth(): Promise<ChppAuth> {
  const { consumerKey, consumerSecret, callbackUrl } = getChppEnv();
  const client = createNodeOAuthClient(consumerKey, consumerSecret, callbackUrl);

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("chpp_access_token")?.value;
  const accessSecret = cookieStore.get("chpp_access_secret")?.value;

  if (!accessToken || !accessSecret) {
    throw new ChppAuthError();
  }

  return { client, accessToken, accessSecret };
}

export async function fetchChppXml(
  auth: ChppAuth,
  paramsOrUrl: URLSearchParams | string
) {
  const requestUrl =
    typeof paramsOrUrl === "string" ? paramsOrUrl : buildChppUrl(paramsOrUrl);
  const rawXml = await getProtectedResource(
    auth.client,
    requestUrl,
    auth.accessToken,
    auth.accessSecret
  );

  return { rawXml, parsed: parseChppXml(rawXml) };
}

export async function postChppXml(
  auth: ChppAuth,
  paramsOrUrl: URLSearchParams | string,
  body: string,
  contentType = "application/json"
) {
  const requestUrl =
    typeof paramsOrUrl === "string" ? paramsOrUrl : buildChppUrl(paramsOrUrl);
  const rawXml = await postProtectedResource(
    auth.client,
    requestUrl,
    auth.accessToken,
    auth.accessSecret,
    body,
    contentType
  );

  return { rawXml, parsed: parseChppXml(rawXml) };
}

export function buildChppErrorPayload(message: string, error: unknown) {
  const isDev = process.env.NODE_ENV !== "production";
  const safeDetails = (() => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  })();
  const details =
    safeDetails === "[object Object]" ? "Unexpected CHPP error object" : safeDetails;
  const errorObject =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : null;
  const statusCode =
    errorObject &&
    (typeof errorObject.statusCode === "number" ||
      typeof errorObject.statusCode === "string")
      ? Number(errorObject.statusCode)
      : null;
  const data =
    errorObject && typeof errorObject.data === "string"
      ? errorObject.data
      : null;
  const unauthorizedText = [details, data]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const isUnauthorized =
    statusCode === 401 ||
    unauthorizedText.includes("401 - unauthorized");
  const hasAuthExpiredMarker =
    unauthorizedText.includes("missing chpp access token") ||
    unauthorizedText.includes("authorization expired") ||
    unauthorizedText.includes("re-auth required") ||
    unauthorizedText.includes("token rejected") ||
    unauthorizedText.includes("token expired") ||
    unauthorizedText.includes("invalid token");

  if (isUnauthorized && hasAuthExpiredMarker) {
    return {
      error: "CHPP authorization expired. Re-auth required.",
      details: "CHPP authorization expired. Re-auth required.",
      statusCode: 401,
      code: "CHPP_AUTH_EXPIRED",
      data: isDev ? data : null,
      debugDetails: isDev ? details : null,
    };
  }

  return {
    error: message,
    details,
    ...(errorObject
      ? {
          statusCode,
          data: errorObject.data ?? null,
        }
      : {}),
  };
}
