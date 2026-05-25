"use client";

import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";
import {
  readAnalyticsConsent,
  subscribeAnalyticsConsentChange,
  type AnalyticsConsent,
} from "@/lib/analyticsConsent";

export default function ConsentGatedVercelAnalytics() {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);

  useEffect(() => {
    const syncConsent = () => {
      setConsent(readAnalyticsConsent());
    };
    syncConsent();
    return subscribeAnalyticsConsentChange(syncConsent);
  }, []);

  if (consent !== "granted") {
    return null;
  }

  return <Analytics />;
}
