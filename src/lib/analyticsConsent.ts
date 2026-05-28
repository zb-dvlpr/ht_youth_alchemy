export const ANALYTICS_CONSENT_STORAGE_KEY = "ya_ga_consent";
const ANALYTICS_CONSENT_CHANGE_EVENT = "analytics-consent-change";

export type AnalyticsConsent = "granted" | "denied";

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    if (stored === "granted" || stored === "denied") {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(consent: AnalyticsConsent): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
  } catch {
    // ignore storage errors
  }
}

export function dispatchAnalyticsConsentChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_CHANGE_EVENT));
}

export function subscribeAnalyticsConsentChange(
  callback: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handleConsentChange = () => {
    callback();
  };
  window.addEventListener(ANALYTICS_CONSENT_CHANGE_EVENT, handleConsentChange);
  return () => {
    window.removeEventListener(
      ANALYTICS_CONSENT_CHANGE_EVENT,
      handleConsentChange
    );
  };
}
