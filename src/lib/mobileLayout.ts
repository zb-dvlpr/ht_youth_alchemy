export const MOBILE_LAYOUT_MAX_WIDTH = 900;
export const MOBILE_LAYOUT_MEDIA_QUERY = `(max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px)`;

export type LayoutPreference = "auto" | "mobile" | "desktop";

export const DEFAULT_LAYOUT_PREFERENCE: LayoutPreference = "auto";
export const LAYOUT_PREFERENCE_STORAGE_KEY = "ya_layout_preference_v1";
export const LAYOUT_PREFERENCE_EVENT = "ya:layout-preference";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    mobile?: boolean;
  };
};

const isValidPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const safeMatchMedia = (query: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia?.(query).matches === true;
  } catch {
    return false;
  }
};

export function isLayoutPreference(value: unknown): value is LayoutPreference {
  return value === "auto" || value === "mobile" || value === "desktop";
}

export function normalizeLayoutPreference(value: unknown): LayoutPreference {
  return isLayoutPreference(value) ? value : DEFAULT_LAYOUT_PREFERENCE;
}

export function readLayoutPreference(): LayoutPreference {
  if (typeof window === "undefined") return DEFAULT_LAYOUT_PREFERENCE;
  try {
    return normalizeLayoutPreference(
      window.localStorage.getItem(LAYOUT_PREFERENCE_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_LAYOUT_PREFERENCE;
  }
}

export function dispatchLayoutPreferenceEvent(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(LAYOUT_PREFERENCE_EVENT));
  } catch {
    // ignore event dispatch errors
  }
}

export function writeLayoutPreference(preference: LayoutPreference): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeLayoutPreference(preference);
  try {
    window.localStorage.setItem(LAYOUT_PREFERENCE_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
  dispatchLayoutPreferenceEvent();
}

export function detectAutomaticMobileLayout(): boolean {
  if (typeof window === "undefined") return false;

  let innerWidthMobile = false;
  try {
    innerWidthMobile =
      isValidPositiveNumber(window.innerWidth) &&
      window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH;
  } catch {
    innerWidthMobile = false;
  }

  let visualViewportMobile = false;
  try {
    const visualViewportWidth = window.visualViewport?.width;
    visualViewportMobile =
      isValidPositiveNumber(visualViewportWidth) &&
      visualViewportWidth <= MOBILE_LAYOUT_MAX_WIDTH;
  } catch {
    visualViewportMobile = false;
  }

  const cssViewportMobile =
    safeMatchMedia(MOBILE_LAYOUT_MEDIA_QUERY) ||
    innerWidthMobile ||
    visualViewportMobile;

  let physicalScreenMin = Number.POSITIVE_INFINITY;
  try {
    const screenWidth = window.screen?.width;
    const screenHeight = window.screen?.height;
    const validScreenWidth = isValidPositiveNumber(screenWidth)
      ? screenWidth
      : Number.POSITIVE_INFINITY;
    const validScreenHeight = isValidPositiveNumber(screenHeight)
      ? screenHeight
      : Number.POSITIVE_INFINITY;
    physicalScreenMin = Math.min(validScreenWidth, validScreenHeight);
  } catch {
    physicalScreenMin = Number.POSITIVE_INFINITY;
  }

  let maxTouchPoints = 0;
  try {
    maxTouchPoints = isValidPositiveNumber(navigator.maxTouchPoints)
      ? navigator.maxTouchPoints
      : 0;
  } catch {
    maxTouchPoints = 0;
  }
  const touchCapable =
    maxTouchPoints > 0 || safeMatchMedia("(pointer: coarse)");
  const likelyHandheldFromScreenAndTouch =
    physicalScreenMin <= MOBILE_LAYOUT_MAX_WIDTH && touchCapable;

  let userAgentDataMobile = false;
  try {
    const navigatorWithUserAgentData = navigator as NavigatorWithUserAgentData;
    userAgentDataMobile =
      navigatorWithUserAgentData.userAgentData?.mobile === true;
  } catch {
    userAgentDataMobile = false;
  }

  return (
    cssViewportMobile ||
    userAgentDataMobile ||
    likelyHandheldFromScreenAndTouch
  );
}

export function resolveMobileLayout(
  preference: LayoutPreference = readLayoutPreference()
): boolean {
  if (preference === "mobile") return true;
  if (preference === "desktop") return false;
  return detectAutomaticMobileLayout();
}
