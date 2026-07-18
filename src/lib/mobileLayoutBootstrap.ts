import {
  LAYOUT_PREFERENCE_STORAGE_KEY,
  MOBILE_LAYOUT_MAX_WIDTH,
} from "./mobileLayout";

export const MOBILE_LAYOUT_BOOTSTRAP_SCRIPT = `
(function () {
  var pendingTimeout = null;
  function validNumber(value) {
    return typeof value === "number" && isFinite(value) && value > 0;
  }
  function matches(query) {
    try {
      return typeof window.matchMedia === "function" &&
        window.matchMedia(query).matches === true;
    } catch (error) {
      return false;
    }
  }
  function readPreference() {
    try {
      var stored = window.localStorage.getItem("${LAYOUT_PREFERENCE_STORAGE_KEY}");
      return stored === "mobile" || stored === "desktop" || stored === "auto"
        ? stored
        : "auto";
    } catch (error) {
      return "auto";
    }
  }
  function detectAutomatic() {
    var cssViewportMobile = false;
    try {
      cssViewportMobile =
        matches("(max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px)") ||
        (validNumber(window.innerWidth) && window.innerWidth <= ${MOBILE_LAYOUT_MAX_WIDTH}) ||
        (validNumber(window.visualViewport && window.visualViewport.width) &&
          window.visualViewport.width <= ${MOBILE_LAYOUT_MAX_WIDTH});
    } catch (error) {
      cssViewportMobile = false;
    }
    var physicalScreenMin = Infinity;
    try {
      var screenWidth = window.screen && window.screen.width;
      var screenHeight = window.screen && window.screen.height;
      physicalScreenMin = Math.min(
        validNumber(screenWidth) ? screenWidth : Infinity,
        validNumber(screenHeight) ? screenHeight : Infinity
      );
    } catch (error) {
      physicalScreenMin = Infinity;
    }
    var touchCapable = false;
    try {
      touchCapable =
        (validNumber(navigator.maxTouchPoints) && navigator.maxTouchPoints > 0) ||
        matches("(pointer: coarse)");
    } catch (error) {
      touchCapable = matches("(pointer: coarse)");
    }
    var userAgentDataMobile = false;
    try {
      userAgentDataMobile =
        navigator.userAgentData && navigator.userAgentData.mobile === true;
    } catch (error) {
      userAgentDataMobile = false;
    }
    return (
      cssViewportMobile ||
      userAgentDataMobile ||
      (physicalScreenMin <= ${MOBILE_LAYOUT_MAX_WIDTH} && touchCapable)
    );
  }
  try {
    var root = document.documentElement;
    root.dataset.mobileLayoutPending = "true";
    pendingTimeout = window.setTimeout(function () {
      try {
        delete root.dataset.mobileLayoutPending;
      } catch (error) {}
    }, 3000);
    var preference = readPreference();
    var mobile =
      preference === "mobile"
        ? true
        : preference === "desktop"
          ? false
          : detectAutomatic();
    if (mobile) {
      root.dataset.mobileShell = "true";
    } else {
      delete root.dataset.mobileShell;
    }
    window.__yaMobileLayoutPendingTimeout = pendingTimeout;
  } catch (error) {
    try {
      delete document.documentElement.dataset.mobileLayoutPending;
    } catch (innerError) {}
  }
})();
`;
