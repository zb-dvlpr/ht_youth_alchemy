import {
  extractSeasonFromManagerCompendiumPayload,
  writeGlobalSeason,
} from "@/lib/season";
import {
  type ChppAccessProblemKind,
  getChppHttpStatusReason,
  isChppClientProblemStatus,
  isChppServerProblemStatus,
} from "@/lib/chpp/httpStatusReasons";

export const CHPP_AUTH_REQUIRED_EVENT = "chpp:auth-required";
export const CHPP_ACCESS_BLOCKED_EVENT = "chpp:access-blocked";
export const CHPP_DEBUG_OAUTH_ERROR_STORAGE_KEY =
  "ya_debug_oauth_error_mode_v1";
export type ChppDebugOauthErrorMode = "off" | "4xx" | "5xx";

export type ChppAccessBlockedDetail = {
  kind: ChppAccessProblemKind;
  statusCode?: number;
  reason?: string;
  details?: string | null;
  debugDetails?: string | null;
  simulated?: boolean;
};

const CHPP_AUTH_MARKERS = [
  "missing chpp access token",
  "re-auth required",
  "authorization expired",
];

export class ChppAuthRequiredError extends Error {
  constructor(message = "Missing CHPP access token. Re-auth required.") {
    super(message);
    this.name = "ChppAuthRequiredError";
  }
}

export class ChppAccessBlockedError extends ChppAuthRequiredError {
  detail: ChppAccessBlockedDetail;

  constructor(detail: ChppAccessBlockedDetail) {
    super(detail.details ?? detail.reason ?? "CHPP access is blocked.");
    this.name = "ChppAccessBlockedError";
    this.detail = detail;
  }
}

type AuthMeta = {
  code?: string;
  statusCode?: number;
  error?: string;
  details?: string;
  data?: string;
  debugDetails?: string;
};

const hasAuthMarker = (value: unknown) => {
  const text = String(value ?? "").toLowerCase();
  return CHPP_AUTH_MARKERS.some((marker) => text.includes(marker));
};

const getAuthMeta = (payload: unknown): AuthMeta => {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    statusCode:
      typeof record.statusCode === "number" ? record.statusCode : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    data: typeof record.data === "string" ? record.data : undefined,
    debugDetails:
      typeof record.debugDetails === "string" ? record.debugDetails : undefined,
  };
};

export function isChppAuthErrorPayload(payload: unknown, response?: Response) {
  const meta = getAuthMeta(payload);
  const hasMarker =
    hasAuthMarker(meta.error) ||
    hasAuthMarker(meta.details) ||
    hasAuthMarker(meta.data) ||
    hasAuthMarker(meta.debugDetails);
  const hasAuthCode = meta.code?.startsWith("CHPP_AUTH") ?? false;
  if ((response?.status === 401 || meta.statusCode === 401) && hasAuthCode) {
    return true;
  }
  return hasAuthCode || hasMarker;
}

export function dispatchChppAuthRequired(
  details?: string | null,
  debugDetails?: string | null
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHPP_AUTH_REQUIRED_EVENT, {
      detail: {
        details: details ?? "Missing CHPP access token. Re-auth required.",
        debugDetails: debugDetails ?? null,
      },
    })
  );
}

export function dispatchChppAccessBlocked(detail: ChppAccessBlockedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHPP_ACCESS_BLOCKED_EVENT, {
      detail,
    })
  );
}

export function readChppDebugOauthErrorMode(): ChppDebugOauthErrorMode {
  if (typeof window === "undefined") return "off";
  try {
    const stored = window.localStorage.getItem(CHPP_DEBUG_OAUTH_ERROR_STORAGE_KEY);
    return stored === "4xx" || stored === "5xx" ? stored : "off";
  } catch {
    return "off";
  }
}

export function writeChppDebugOauthErrorMode(mode: ChppDebugOauthErrorMode) {
  if (typeof window === "undefined") return;
  try {
    if (mode === "off") {
      window.localStorage.removeItem(CHPP_DEBUG_OAUTH_ERROR_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CHPP_DEBUG_OAUTH_ERROR_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export async function reconnectChppWithTokenReset(
  permissions?: readonly string[]
) {
  try {
    await fetch("/api/chpp/oauth/invalidate-token", {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    // Best effort only; continue to reconnect flow.
  }
  if (typeof window !== "undefined") {
    if (permissions) {
      const search = new URLSearchParams();
      if (permissions.length > 0) {
        search.set("permissions", permissions.join(","));
      }
      const query = search.toString();
      window.location.href = `/api/chpp/oauth/start${query ? `?${query}` : ""}`;
      return;
    }
    window.location.href = "/";
  }
}

const asUrlString = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }
  return String(input);
};

const resolveStatusCode = (payload: unknown, response: Response) => {
  const meta = getAuthMeta(payload);
  if (typeof meta.statusCode === "number" && Number.isFinite(meta.statusCode)) {
    return meta.statusCode;
  }
  return response.status;
};

const isMissingLocalChppAuthPayload = (payload: unknown) => {
  const meta = getAuthMeta(payload);
  const markerText = [meta.code, meta.error, meta.details, meta.data]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    meta.code === "CHPP_AUTH_MISSING" ||
    markerText.includes("missing chpp access token")
  );
};

const buildAccessBlockedDetail = (
  payload: unknown,
  response: Response
): ChppAccessBlockedDetail | null => {
  const meta = getAuthMeta(payload);
  if (isMissingLocalChppAuthPayload(payload)) {
    const details =
      meta.details ?? meta.error ?? "Missing CHPP access token. Re-auth required.";
    return {
      kind: "missing-token",
      details,
      debugDetails:
        process.env.NODE_ENV !== "production"
          ? [meta.debugDetails, meta.data].filter(Boolean).join("\n") || null
          : null,
    };
  }

  const statusCode = resolveStatusCode(payload, response);
  if (!isChppClientProblemStatus(statusCode) && !isChppServerProblemStatus(statusCode)) {
    return null;
  }
  return {
    kind: isChppServerProblemStatus(statusCode) ? "server-error" : "client-error",
    statusCode,
    reason: getChppHttpStatusReason(statusCode),
    details: meta.details ?? meta.error ?? null,
    debugDetails:
      process.env.NODE_ENV !== "production"
        ? [meta.debugDetails, meta.data].filter(Boolean).join("\n") || null
        : null,
  };
};

export async function fetchChppJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ response: Response; payload: T | null }> {
  const headers = new Headers(init?.headers);
  if (process.env.NODE_ENV !== "production") {
    const mode = readChppDebugOauthErrorMode();
    const url = asUrlString(input);
    if (mode !== "off" && url.includes("/api/chpp/")) {
      headers.set("x-ya-debug-oauth-error", mode);
    }
  }
  const response = await fetch(input, {
    ...init,
    headers,
  });
  const requestUrl = asUrlString(input);
  const payload = (await response.json().catch(() => null)) as T | null;
  if (requestUrl.includes("/api/chpp/managercompendium")) {
    writeGlobalSeason(extractSeasonFromManagerCompendiumPayload(payload));
  }
  if (requestUrl.includes("/api/chpp/")) {
    const blockedDetail = buildAccessBlockedDetail(payload, response);
    if (blockedDetail) {
      dispatchChppAccessBlocked(blockedDetail);
      if (blockedDetail.kind === "missing-token") {
        dispatchChppAuthRequired(
          blockedDetail.details,
          blockedDetail.debugDetails
        );
      }
      throw new ChppAccessBlockedError(blockedDetail);
    }
  }
  return { response, payload };
}
