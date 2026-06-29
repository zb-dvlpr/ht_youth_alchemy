import { cookies, headers } from "next/headers";
import { XMLParser } from "fast-xml-parser";
import { getChppEnv } from "@/lib/chpp/env";
import { CHPP_ENDPOINTS } from "@/lib/chpp/oauth";
import {
  CHPP_SESSION_COOKIE,
  openChppSession,
} from "@/lib/chpp/session-cookie";
import {
  getMissingChppPermissions,
  parseExtendedPermissionsFromCheckToken,
} from "@/lib/chpp/permissions";
import {
  ChppUpstreamError,
  createNodeOAuthClient,
  getProtectedResource,
  postProtectedResource,
} from "@/lib/chpp/node-oauth";

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
    const permissionLabels: Record<string, string> = {
      place_bid: "Place bid",
      set_matchorder: "Set match order",
      set_training: "Set training",
      manage_youthplayers: "Manage youth players",
    };
    const labels = missingPermissions.map(
      (permission) => permissionLabels[permission] ?? permission
    );
    super(
      `This action requires the ${labels.join(
        ", "
      )} CHPP permission${labels.length === 1 ? "" : "s"}. Reconnect CHPP to grant access.`
    );
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
  const session = openChppSession(
    cookieStore.get(CHPP_SESSION_COOKIE)?.value
  );

  if (!session) {
    throw new ChppAuthError();
  }

  return {
    client,
    accessToken: session.accessToken,
    accessSecret: session.accessSecret,
  };
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
  requiredPermissions?: readonly string[],
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
  const isUpstreamError = error instanceof ChppUpstreamError;
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
  const phase =
    errorObject && typeof errorObject.phase === "string"
      ? errorObject.phase
      : null;
  const combinedText = [details, data].join(" ").toLowerCase();
  const hasServiceUnavailableMarker =
    combinedText.includes("the service is unavailable") ||
    combinedText.includes("service unavailable");
  const isConfigError =
    error instanceof Error &&
    (error.message.startsWith("Missing required CHPP env vars:") ||
      error.message === "Missing CHPP_COOKIE_SECRET" ||
      error.message === "CHPP_COOKIE_SECRET must be 32 bytes base64-encoded");
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
  const isAuthorizeUnavailable =
    phase === "authorize-preflight" &&
    ((inferredStatusCode ?? 503) === 503 || hasServiceUnavailableMarker);
  if (isAuthorizeUnavailable) {
    return {
      error: message,
      details:
        "Hattrick CHPP authorization is currently unavailable. Please try again later.",
      statusCode: 503,
      code: "CHPP_AUTHORIZE_UNAVAILABLE",
      data: isDev ? data : null,
      debugDetails: isDev ? details : null,
    };
  }
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
    if (isConfigError) {
      return "CHPP OAuth is not configured correctly on this app instance.";
    }
    if (errorCode === "CHPP_DEBUG_SIMULATED_4XX") {
      return "Simulated OAuth client-side error (4xx).";
    }
    if (errorCode === "CHPP_DEBUG_SIMULATED_5XX") {
      return "Simulated OAuth server-side error (5xx).";
    }
    if (isServerError) {
      return "Hattrick OAuth/CHPP returned a server-side error. Please retry later.";
    }
    if (isClientError) {
      return "Hattrick OAuth/CHPP rejected the request. Reconnect and retry.";
    }
    return hasHtmlPayload
      ? "Hattrick OAuth/CHPP returned an unexpected error response. Please retry; if it continues, contact Hattrick staff."
      : details;
  })();

  return {
    error: message,
    details: friendlyDetails,
    code:
      errorCode ??
      (isConfigError
        ? "APP_CONFIG_ERROR"
        : isServerError
          ? "CHPP_UPSTREAM_5XX"
          : isClientError
            ? "CHPP_UPSTREAM_4XX"
            : isUpstreamError
              ? "CHPP_UPSTREAM_ERROR"
              : null),
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
