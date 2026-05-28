"use client";

import { useEffect, useRef } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  readAnalyticsConsent,
  subscribeAnalyticsConsentChange,
} from "@/lib/analyticsConsent";

export default function AnalyticsAppLoadedTracker() {
  const sentRef = useRef(false);

  useEffect(() => {
    const maybeSend = () => {
      if (sentRef.current) return;
      if (readAnalyticsConsent() !== "granted") return;
      if (typeof window === "undefined" || !window.gtag) return;

      sentRef.current = true;
      trackAnalyticsEvent("app_loaded", {
        app_area: "root",
      });
    };

    maybeSend();

    const unsubscribe = subscribeAnalyticsConsentChange(maybeSend);
    const shortTimeoutId = window.setTimeout(maybeSend, 500);
    const longTimeoutId = window.setTimeout(maybeSend, 2000);

    return () => {
      unsubscribe();
      window.clearTimeout(shortTimeoutId);
      window.clearTimeout(longTimeoutId);
    };
  }, []);

  return null;
}
