import { cookies, headers } from "next/headers";
import { XMLParser } from "fast-xml-parser";
import { getChppEnv } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import {
  getMissingChppPermissions,
  parseExtendedPermissionsFromCheckToken,
  REQUIRED_CHPP_EXTENDED_PERMISSIONS,
} from "@/lib/chpp/permissions";
import { createNodeOAuthClient, getProtectedResource, postProtectedResource } from "@/lib/chpp/node-oauth";

export const CHPP_XML_ENDPOINT = "https://chpp.hattrick.org/chppxml.ashx";
const DEBUG_OAUTH_ERROR_HEADER = "x-ya-debug-oauth-error";

type ChppClient = ReturnType<typeof createNodeOAuthClient>;

export type ChppAuth = {
  client: ChppClient;
  accessToken: string;
  accessSecret: string;
};

export class ChppAuthError extends Error {
  status = 401;
  code = "CHPP_AUTH_MISSING";

  constructor(message = "Missing CHPP access token. Re-auth required.") {
    super(message);
  }
}

export class ChppPermissionError extends ChppAuthError {
  override code = "CHPP_AUTH_PERMISSIONS_MISSING";
  missingPermissions: string[];

  constructor(missingPermissions: string[]) {
    super("CHPP authorization expired. Re-auth required.");
    this.missingPermissions = missingPermissions;
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
  if (process.env.NODE_ENV !== "production") {
    const headerStore = await headers();
    const debugMode = headerStore.get(DEBUG_OAUTH_ERROR_HEADER);
    if (debugMode === "4xx") {
      throw {
        statusCode: 429,
        code: "CHPP_DEBUG_SIMULATED_4XX",
        details: "Simulated CHPP OAuth client-side failure (4xx).",
      };
    }
    if (debugMode === "5xx") {
      throw {
        statusCode: 503,
        code: "CHPP_DEBUG_SIMULATED_5XX",
        details: "Simulated CHPP OAuth server-side failure (5xx).",
      };
    }
  }

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

export async function fetchChppTokenCheck(auth: ChppAuth) {
  const raw = await getProtectedResource(
    auth.client,
    CHPP_ENDPOINTS.checkToken,
    auth.accessToken,
    auth.accessSecret
  );
  return {
    raw,
    permissions: parseExtendedPermissionsFromCheckToken(raw),
  };
}

export async function assertChppPermissions(
  auth: ChppAuth,
  requiredPermissions: readonly string[] = REQUIRED_CHPP_EXTENDED_PERMISSIONS,
  grantedPermissions?: readonly string[]
) {
  const permissionsToValidate =
    grantedPermissions ?? (await fetchChppTokenCheck(auth)).permissions;
  const missingPermissions = getMissingChppPermissions(
    permissionsToValidate,
    requiredPermissions
  );
  if (missingPermissions.length > 0) {
    throw new ChppPermissionError(missingPermissions);
  }
  return permissionsToValidate;
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
  const errorCode =
    errorObject && typeof errorObject.code === "string"
      ? errorObject.code
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

  const hasHtmlPayload = [details, data].some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes("<html")
  );
  const inferredStatusCode = (() => {
    if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
      return statusCode;
    }
    const combined = [details, data].join(" ").toLowerCase();
    if (
      combined.includes("runtime error") ||
      combined.includes("server error in '/' application")
    ) {
      return 500;
    }
    return null;
  })();
  const isServerError =
    inferredStatusCode !== null
      ? inferredStatusCode >= 500
      : [details, data]
          .join(" ")
          .toLowerCase()
          .includes("server error");
  const isClientError =
    inferredStatusCode !== null
      ? inferredStatusCode >= 400 && inferredStatusCode < 500
      : false;

  const friendlyDetails = (() => {
    if (errorCode === "CHPP_DEBUG_SIMULATED_4XX") {
      return "Simulated OAuth client-side error (4xx).";
    }
    if (errorCode === "CHPP_DEBUG_SIMULATED_5XX") {
      return "Simulated OAuth server-side error (5xx).";
    }
    if (isServerError) {
      return "Hattrick OAuth/CHPP returned a server-side error (5xx). Please retry later and contact Hattrick staff if the issue persists.";
    }
    if (isClientError) {
      return "Hattrick OAuth/CHPP rejected the request (4xx). Reconnect and retry; if it continues, contact Hattrick staff.";
    }
    return hasHtmlPayload
      ? "Hattrick OAuth/CHPP returned an unexpected error response. Please retry; if it continues, contact Hattrick staff."
      : details;
  })();

  return {
    error: message,
    details: friendlyDetails,
    code: errorCode ?? (isServerError ? "CHPP_UPSTREAM_5XX" : null),
    ...(errorObject
      ? {
          statusCode: inferredStatusCode,
          data: isDev ? errorObject.data ?? null : null,
          debugDetails: isDev ? details : null,
        }
      : {}),
  };
}

export function chppErrorHttpStatus(payload: { statusCode?: number | null }) {
  const statusCode = payload.statusCode;
  if (statusCode === 401) return 401;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
    return statusCode;
  }
  return 502;
}
