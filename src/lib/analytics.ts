import { readAnalyticsConsent } from "@/lib/analyticsConsent";

export type AnalyticsPrimitive = string | number | boolean | null;

export type AnalyticsEventParams = Record<
  string,
  AnalyticsPrimitive | AnalyticsPrimitive[] | undefined
>;

const NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_STRING_LENGTH = 100;
const FORBIDDEN_PARAM_TERMS = [
  "token",
  "oauth",
  "secret",
  "password",
  "email",
  "mail",
  "name",
  "firstname",
  "lastname",
  "nickname",
  "player",
  "playerid",
  "team",
  "teamid",
  "manager",
  "managerid",
  "user",
  "userid",
  "cookie",
  "session",
  "chpp",
  "raw",
  "payload",
  "response",
] as const;

function hasAnalyticsAccess() {
  if (typeof window === "undefined") return false;
  if (readAnalyticsConsent() !== "granted") return false;
  return typeof window.gtag === "function";
}

function isValidName(value: string) {
  return NAME_PATTERN.test(value);
}

function normalizeStringValue(value: string) {
  return value.trim().slice(0, MAX_STRING_LENGTH);
}

function sanitizePrimitive(
  value: AnalyticsPrimitive
): AnalyticsPrimitive | undefined {
  if (typeof value === "string") {
    const normalized = normalizeStringValue(value);
    return normalized ? normalized : undefined;
  }
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return undefined;
}

function sanitizeParamValue(
  value: AnalyticsPrimitive | AnalyticsPrimitive[] | undefined
): AnalyticsPrimitive | AnalyticsPrimitive[] | undefined {
  if (typeof value === "undefined") return undefined;
  if (Array.isArray(value)) {
    const sanitizedValues = value
      .map((entry) => sanitizePrimitive(entry))
      .filter((entry): entry is AnalyticsPrimitive => typeof entry !== "undefined");
    return sanitizedValues.length > 0 ? sanitizedValues : undefined;
  }
  return sanitizePrimitive(value);
}

function isForbiddenParamKey(key: string) {
  const normalizedKey = key.toLowerCase();
  return FORBIDDEN_PARAM_TERMS.some((term) => normalizedKey.includes(term));
}

function sanitizeParams(params?: AnalyticsEventParams) {
  if (!params) return undefined;
  const sanitizedEntries = Object.entries(params).flatMap(([key, value]) => {
    if (!isValidName(key)) return [];
    if (isForbiddenParamKey(key)) return [];
    const sanitizedValue = sanitizeParamValue(value);
    if (typeof sanitizedValue === "undefined") return [];
    return [[key, sanitizedValue] as const];
  });
  if (sanitizedEntries.length === 0) return undefined;
  return Object.fromEntries(sanitizedEntries) satisfies AnalyticsEventParams;
}

function sanitizeFeatureName(featureName: string) {
  const normalized = featureName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!normalized || !isValidName(normalized)) return null;
  return normalized;
}

export function trackAnalyticsEvent(
  eventName: string,
  params?: AnalyticsEventParams
) {
  if (!isValidName(eventName)) return;
  if (!hasAnalyticsAccess()) return;
  const sanitizedParams = sanitizeParams(params);
  window.gtag?.("event", eventName, sanitizedParams);
}

export function trackFeatureUsed(
  featureName: string,
  params?: AnalyticsEventParams
) {
  const sanitizedFeatureName = sanitizeFeatureName(featureName);
  if (!sanitizedFeatureName) return;
  trackAnalyticsEvent("feature_used", {
    ...params,
    feature_name: sanitizedFeatureName,
  });
}
