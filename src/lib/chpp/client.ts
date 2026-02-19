export const CHPP_AUTH_REQUIRED_EVENT = "chpp:auth-required";

const CHPP_AUTH_MARKERS = [
  "missing chpp access token",
  "re-auth required",
  "authorization expired",
  "401 - unauthorized",
];

export class ChppAuthRequiredError extends Error {
  constructor(message = "Missing CHPP access token. Re-auth required.") {
    super(message);
    this.name = "ChppAuthRequiredError";
  }
}

type AuthMeta = {
  code?: string;
  statusCode?: number;
  error?: string;
  details?: string;
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
  };
};

export function isChppAuthErrorPayload(payload: unknown, response?: Response) {
  const meta = getAuthMeta(payload);
  return (
    response?.status === 401 ||
    meta.statusCode === 401 ||
    (meta.code?.startsWith("CHPP_AUTH") ?? false) ||
    hasAuthMarker(meta.error) ||
    hasAuthMarker(meta.details)
  );
}

export function dispatchChppAuthRequired(details?: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHPP_AUTH_REQUIRED_EVENT, {
      detail: {
        details: details ?? "Missing CHPP access token. Re-auth required.",
      },
    })
  );
}

export async function fetchChppJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<{ response: Response; payload: T | null }> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as T | null;
  if (isChppAuthErrorPayload(payload, response)) {
    const meta = getAuthMeta(payload);
    const details =
      meta.details ?? meta.error ?? "Missing CHPP access token. Re-auth required.";
    dispatchChppAuthRequired(details);
    throw new ChppAuthRequiredError(details);
  }
  return { response, payload };
}
