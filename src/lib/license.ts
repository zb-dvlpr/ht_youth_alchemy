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
};

export type AppLicenseDetailsResult = {
  valid: boolean;
  details: LemonSqueezyLicenseDetails | null;
  transientFailure: boolean;
};

type AppLicenseDeactivationResult = {
  deactivated: boolean;
  details: LemonSqueezyLicenseDetails | null;
  transientFailure: boolean;
};

export const APP_LICENSE_STORAGE_KEY = "ya_premium_license_v1";
const LEGACY_CLUB_CHRONICLE_LICENSE_STORAGE_KEY = "ya_cc_premium_license_v1";
export const APP_LICENSE_EVENT = "ya:app-license-state";
export const APP_LICENSE_ACTIVATED_EVENT = "ya:app-license-activated";
export const APP_LICENSE_REVOKED_EVENT = "ya:app-license-revoked";
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
      return {
        valid: false,
        instanceId: null,
        details:
          payload?.details && typeof payload.details === "object"
            ? payload.details
            : null,
        transientFailure: response.status >= 500,
      };
    }
    return {
      valid: payload?.valid === true,
      instanceId:
        typeof payload?.instanceId === "string" && payload.instanceId.trim()
          ? payload.instanceId.trim()
          : null,
      details:
        payload?.details && typeof payload.details === "object"
          ? payload.details
          : null,
      transientFailure: false,
    };
  } catch {
    return {
      valid: false,
      instanceId: null,
      details: null,
      transientFailure: true,
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
