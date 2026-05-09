import type { LemonSqueezyLicenseDetails } from "./lemonsqueezyLicense";

export type AppLicenseState = {
  licenseKey: string;
  instanceId: string;
  premiumUnlocked: boolean;
  validatedAt: number | null;
};

export type AppLicenseValidationResult = {
  valid: boolean;
  instanceId: string | null;
  details: LemonSqueezyLicenseDetails | null;
  transientFailure: boolean;
  exceededActivationLimit: boolean;
};

export type AppLicenseExpiringEventDetail = {
  details: LemonSqueezyLicenseDetails;
  threshold: "week" | "day";
};

export type AppLicenseDetailsResult = {
  valid: boolean;
  details: LemonSqueezyLicenseDetails | null;
  transientFailure: boolean;
  exceededActivationLimit: boolean;
};

type AppLicenseDeactivationResult = {
  deactivated: boolean;
  details: LemonSqueezyLicenseDetails | null;
  transientFailure: boolean;
};

export const APP_LICENSE_STORAGE_KEY = "ya_premium_license_v1";
const APP_LICENSE_EXPIRY_NOTICES_STORAGE_KEY =
  "ya_premium_license_expiry_notices_v1";
const LEGACY_CLUB_CHRONICLE_LICENSE_STORAGE_KEY = "ya_cc_premium_license_v1";
export const APP_LICENSE_EVENT = "ya:app-license-state";
export const APP_LICENSE_ACTIVATED_EVENT = "ya:app-license-activated";
export const APP_LICENSE_REVOKED_EVENT = "ya:app-license-revoked";
export const APP_LICENSE_LIMIT_EXCEEDED_EVENT = "ya:app-license-limit-exceeded";
export const APP_LICENSE_EXPIRING_EVENT = "ya:app-license-expiring";
const APP_LICENSE_QUERY_KEYS = [
  "license_key",
  "order_id",
  "order_identifier",
  "email",
  "name",
  "total",
] as const;

export const EMPTY_LICENSE_STATE: AppLicenseState = {
  licenseKey: "",
  instanceId: "",
  premiumUnlocked: false,
  validatedAt: null,
};

const isBrowser = () => typeof window !== "undefined";
let revalidationPromise: Promise<AppLicenseState> | null = null;
const APP_LICENSE_EXPIRING_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const APP_LICENSE_EXPIRING_DAY_MS = 24 * 60 * 60 * 1000;

type AppLicenseExpiryNoticesState = {
  licenseKey: string;
  expiresAt: string;
  weekShown: boolean;
  dayShown: boolean;
};

const parseLicenseState = (raw: string | null): AppLicenseState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppLicenseState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      licenseKey:
        typeof parsed.licenseKey === "string" ? parsed.licenseKey : "",
      instanceId:
        typeof parsed.instanceId === "string" ? parsed.instanceId : "",
      premiumUnlocked: parsed.premiumUnlocked === true,
      validatedAt:
        typeof parsed.validatedAt === "number" ? parsed.validatedAt : null,
    };
  } catch {
    return null;
  }
};

const parseLicenseExpiryNoticesState = (
  raw: string | null
): AppLicenseExpiryNoticesState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppLicenseExpiryNoticesState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      licenseKey:
        typeof parsed.licenseKey === "string" ? parsed.licenseKey : "",
      expiresAt:
        typeof parsed.expiresAt === "string" ? parsed.expiresAt : "",
      weekShown: parsed.weekShown === true,
      dayShown: parsed.dayShown === true,
    };
  } catch {
    return null;
  }
};

export const readAppLicenseState = (): AppLicenseState => {
  if (!isBrowser()) return EMPTY_LICENSE_STATE;
  const primary = parseLicenseState(
    window.localStorage.getItem(APP_LICENSE_STORAGE_KEY)
  );
  if (primary) return primary;
  const legacy = parseLicenseState(
    window.localStorage.getItem(LEGACY_CLUB_CHRONICLE_LICENSE_STORAGE_KEY)
  );
  return legacy ?? EMPTY_LICENSE_STATE;
};

const dispatchAppLicenseEvent = (state: AppLicenseState) => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(APP_LICENSE_EVENT, { detail: state }));
};

export const dispatchAppLicenseActivatedEvent = (
  details: LemonSqueezyLicenseDetails
) => {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent(APP_LICENSE_ACTIVATED_EVENT, {
      detail: details,
    })
  );
};

export const dispatchAppLicenseRevokedEvent = (
  details: LemonSqueezyLicenseDetails | null
) => {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent(APP_LICENSE_REVOKED_EVENT, {
      detail: details,
    })
  );
};

export const dispatchAppLicenseLimitExceededEvent = (
  details: LemonSqueezyLicenseDetails | null
) => {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent(APP_LICENSE_LIMIT_EXCEEDED_EVENT, {
      detail: details,
    })
  );
};

export const dispatchAppLicenseExpiringEvent = (
  detail: AppLicenseExpiringEventDetail
) => {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent(APP_LICENSE_EXPIRING_EVENT, {
      detail,
    })
  );
};

export const hasExceededAppLicenseActivationLimit = (
  details: LemonSqueezyLicenseDetails | null | undefined
) => {
  if (!details) return false;
  if (
    typeof details.activationLimit !== "number" ||
    typeof details.activationUsage !== "number"
  ) {
    return false;
  }
  return details.activationUsage > details.activationLimit;
};

export const writeAppLicenseState = (state: AppLicenseState) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(APP_LICENSE_STORAGE_KEY, JSON.stringify(state));
  window.localStorage.removeItem(LEGACY_CLUB_CHRONICLE_LICENSE_STORAGE_KEY);
  dispatchAppLicenseEvent(state);
};

export const clearAppLicenseState = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(APP_LICENSE_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_CLUB_CHRONICLE_LICENSE_STORAGE_KEY);
  dispatchAppLicenseEvent(EMPTY_LICENSE_STATE);
};

export const readAppLicensePurchaseUrl = () => {
  const raw = process.env.NEXT_PUBLIC_HT_ALCHEMY_LICENSE_BUY_URL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const openAppLicensePurchaseUrl = () => {
  if (!isBrowser()) return false;
  const url = readAppLicensePurchaseUrl();
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};

const readAppLicenseExpiryNoticesState = (): AppLicenseExpiryNoticesState | null => {
  if (!isBrowser()) return null;
  return parseLicenseExpiryNoticesState(
    window.localStorage.getItem(APP_LICENSE_EXPIRY_NOTICES_STORAGE_KEY)
  );
};

const writeAppLicenseExpiryNoticesState = (
  state: AppLicenseExpiryNoticesState
) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    APP_LICENSE_EXPIRY_NOTICES_STORAGE_KEY,
    JSON.stringify(state)
  );
};

const getAppLicenseExpiryWarningThreshold = (
  details: LemonSqueezyLicenseDetails
): "week" | "day" | null => {
  const expiresAt = details.expiresAt?.trim() ?? "";
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return null;
  const remainingMs = expiresAtMs - Date.now();
  if (remainingMs <= 0) return null;
  if (remainingMs <= APP_LICENSE_EXPIRING_DAY_MS) return "day";
  if (remainingMs <= APP_LICENSE_EXPIRING_WEEK_MS) return "week";
  return null;
};

const maybeDispatchAppLicenseExpiringEvent = (
  details: LemonSqueezyLicenseDetails | null
) => {
  if (!isBrowser() || !details) return;
  const licenseKey = details.key?.trim() ?? "";
  const expiresAt = details.expiresAt?.trim() ?? "";
  if (!licenseKey || !expiresAt) return;
  const threshold = getAppLicenseExpiryWarningThreshold(details);
  if (!threshold) return;
  const currentState = readAppLicenseExpiryNoticesState();
  const nextState: AppLicenseExpiryNoticesState =
    currentState &&
    currentState.licenseKey === licenseKey &&
    currentState.expiresAt === expiresAt
      ? currentState
      : {
          licenseKey,
          expiresAt,
          weekShown: false,
          dayShown: false,
        };
  if (threshold === "day" && nextState.dayShown) return;
  if (threshold === "week" && nextState.weekShown) return;
  if (threshold === "day") {
    nextState.dayShown = true;
  } else {
    nextState.weekShown = true;
  }
  writeAppLicenseExpiryNoticesState(nextState);
  dispatchAppLicenseExpiringEvent({
    details,
    threshold,
  });
};

export const buildAppLicenseInstanceName = () => {
  if (!isBrowser()) return "HT Alchemy";
  const language =
    typeof navigator.language === "string" && navigator.language.trim()
      ? navigator.language.trim()
      : "unknown-language";
  const platform =
    typeof navigator.platform === "string" && navigator.platform.trim()
      ? navigator.platform.trim()
      : "unknown-platform";
  return `HT Alchemy (${platform}; ${language})`;
};

export const validateAppLicenseKey = async (
  licenseKey: string,
  options?: {
    instanceId?: string | null;
    instanceName?: string | null;
    activate?: boolean;
  }
): Promise<AppLicenseValidationResult> => {
  const trimmed = licenseKey.trim();
  if (!trimmed) {
    return {
      valid: false,
      instanceId: null,
      details: null,
      transientFailure: false,
      exceededActivationLimit: false,
    };
  }
  try {
    const response = await fetch("/api/license/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        licenseKey: trimmed,
        instanceId: options?.instanceId?.trim() || null,
        instanceName: options?.instanceName?.trim() || null,
        activate: options?.activate !== false,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          valid?: boolean;
          instanceId?: string | null;
          details?: LemonSqueezyLicenseDetails | null;
        }
      | null;
    if (!response.ok) {
      const details =
        payload?.details && typeof payload.details === "object"
          ? payload.details
          : null;
      return {
        valid: false,
        instanceId: null,
        details,
        transientFailure: response.status >= 500,
        exceededActivationLimit: hasExceededAppLicenseActivationLimit(details),
      };
    }
    const details =
      payload?.details && typeof payload.details === "object"
        ? payload.details
        : null;
    const exceededActivationLimit =
      hasExceededAppLicenseActivationLimit(details);
    if (payload?.valid === true && details && !exceededActivationLimit) {
      maybeDispatchAppLicenseExpiringEvent(details);
    }
    return {
      valid: payload?.valid === true && !exceededActivationLimit,
      instanceId:
        typeof payload?.instanceId === "string" && payload.instanceId.trim()
          ? payload.instanceId.trim()
          : null,
      details,
      transientFailure: false,
      exceededActivationLimit,
    };
  } catch {
    return {
      valid: false,
      instanceId: null,
      details: null,
      transientFailure: true,
      exceededActivationLimit: false,
    };
  }
};

export const fetchStoredAppLicenseDetails = async (): Promise<AppLicenseDetailsResult> => {
  const state = readAppLicenseState();
  const licenseKey = state.licenseKey.trim();
  const instanceId = state.instanceId.trim();
  if (!licenseKey || !instanceId) {
    return {
      valid: false,
      details: null,
      transientFailure: false,
      exceededActivationLimit: false,
    };
  }
  const validation = await validateAppLicenseKey(licenseKey, {
    instanceId,
    activate: false,
  });
  return {
    valid: validation.valid,
    details: validation.details,
    transientFailure: validation.transientFailure,
    exceededActivationLimit: validation.exceededActivationLimit,
  };
};

export const deactivateAppLicense = async (
  licenseKey: string,
  instanceId: string
): Promise<AppLicenseDeactivationResult> => {
  const trimmedLicenseKey = licenseKey.trim();
  const trimmedInstanceId = instanceId.trim();
  if (!trimmedLicenseKey || !trimmedInstanceId) {
    return {
      deactivated: false,
      details: null,
      transientFailure: false,
    };
  }
  try {
    const response = await fetch("/api/license/deactivate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        licenseKey: trimmedLicenseKey,
        instanceId: trimmedInstanceId,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          deactivated?: boolean;
          details?: LemonSqueezyLicenseDetails | null;
        }
      | null;
    if (!response.ok) {
      return {
        deactivated: false,
        details:
          payload?.details && typeof payload.details === "object"
            ? payload.details
            : null,
        transientFailure: response.status >= 500,
      };
    }
    return {
      deactivated: payload?.deactivated === true,
      details:
        payload?.details && typeof payload.details === "object"
          ? payload.details
          : null,
      transientFailure: false,
    };
  } catch {
    return {
      deactivated: false,
      details: null,
      transientFailure: true,
    };
  }
};

export const consumeLicenseKeyFromUrl = async (): Promise<AppLicenseState | null> => {
  if (!isBrowser()) return null;
  const currentUrl = new URL(window.location.href);
  const licenseKey = currentUrl.searchParams.get("license_key")?.trim() ?? "";
  if (!licenseKey) return null;
  APP_LICENSE_QUERY_KEYS.forEach((key) => currentUrl.searchParams.delete(key));
  window.history.replaceState({}, "", currentUrl.toString());
  const validation = await validateAppLicenseKey(licenseKey, {
    instanceName: buildAppLicenseInstanceName(),
    activate: true,
  });
  if (validation.exceededActivationLimit) {
    clearAppLicenseState();
    dispatchAppLicenseLimitExceededEvent(validation.details);
    return null;
  }
  if (!validation.valid || validation.transientFailure || !validation.instanceId) {
    return null;
  }
  const nextState: AppLicenseState = {
    licenseKey,
    instanceId: validation.instanceId,
    premiumUnlocked: true,
    validatedAt: Date.now(),
  };
  writeAppLicenseState(nextState);
  if (validation.details) {
    dispatchAppLicenseActivatedEvent(validation.details);
  }
  return nextState;
};

export const revalidateStoredAppLicenseState = async (): Promise<AppLicenseState> => {
  if (!isBrowser()) return EMPTY_LICENSE_STATE;
  if (revalidationPromise) return revalidationPromise;
  revalidationPromise = (async () => {
    const currentState = readAppLicenseState();
    const trimmed = currentState.licenseKey.trim();
    const instanceId = currentState.instanceId.trim();
    if (!trimmed || !instanceId) {
      if (
        currentState.licenseKey ||
        currentState.instanceId ||
        currentState.premiumUnlocked ||
        currentState.validatedAt !== null
      ) {
        clearAppLicenseState();
      }
      return EMPTY_LICENSE_STATE;
    }
    const validation = await validateAppLicenseKey(trimmed, {
      instanceId,
      activate: false,
    });
    if (validation.transientFailure) {
      return readAppLicenseState();
    }
    if (!validation.valid) {
      clearAppLicenseState();
      if (validation.exceededActivationLimit) {
        dispatchAppLicenseLimitExceededEvent(validation.details);
      }
      return EMPTY_LICENSE_STATE;
    }
    const nextState: AppLicenseState = {
      licenseKey: trimmed,
      instanceId,
      premiumUnlocked: true,
      validatedAt: Date.now(),
    };
    writeAppLicenseState(nextState);
    return nextState;
  })();
  try {
    return await revalidationPromise;
  } finally {
    revalidationPromise = null;
  }
};
