"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import {
  readAnalyticsConsent,
  subscribeAnalyticsConsentChange,
  type AnalyticsConsent,
} from "@/lib/analyticsConsent";

const measurementId =
  process.env.NEXT_PUBLIC_VERCEL_ENV === "production"
    ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID_PROD
    : process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID_DEV;

const trimmedMeasurementId = measurementId?.trim() ?? "";

function applyGaDisableFlag(
  consent: AnalyticsConsent | null,
  selectedMeasurementId: string
) {
  if (typeof window === "undefined" || !selectedMeasurementId) return;
  window[`ga-disable-${selectedMeasurementId}`] = consent !== "granted";
}

export default function GoogleAnalytics() {
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);

  useEffect(() => {
    const syncConsent = () => {
      setConsent(readAnalyticsConsent());
    };
    syncConsent();
    return subscribeAnalyticsConsentChange(syncConsent);
  }, []);

  useEffect(() => {
    if (!trimmedMeasurementId) return;
    applyGaDisableFlag(consent, trimmedMeasurementId);
  }, [consent]);

  if (consent !== "granted" || !trimmedMeasurementId) {
    return null;
  }

  return (
    <>
      <Script
        id="google-analytics-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${trimmedMeasurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          window['ga-disable-${trimmedMeasurementId}'] = false;
          gtag('js', new Date());
          gtag('config', '${trimmedMeasurementId}');
        `}
      </Script>
    </>
  );
}
