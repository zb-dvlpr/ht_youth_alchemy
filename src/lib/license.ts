export type AppLicenseState = {
  licenseKey: string;
  premiumUnlocked: boolean;
  validatedAt: number | null;
};

export const APP_LICENSE_STORAGE_KEY = "ya_premium_license_v1";
const LEGACY_CLUB_CHRONICLE_LICENSE_STORAGE_KEY = "ya_cc_premium_license_v1";
export const APP_LICENSE_EVENT = "ya:app-license-state";

const EMPTY_LICENSE_STATE: AppLicenseState = {
  licenseKey: "",
  premiumUnlocked: false,
  validatedAt: null,
};

const isBrowser = () => typeof window !== "undefined";

const parseLicenseState = (raw: string | null): AppLicenseState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AppLicenseState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      licenseKey:
        typeof parsed.licenseKey === "string" ? parsed.licenseKey : "",
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
