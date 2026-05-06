"use client";

import { useEffect, useState } from "react";

import { type Messages } from "@/lib/i18n";
import {
  APP_LICENSE_EVENT,
  APP_LICENSE_STORAGE_KEY,
  readAppLicenseState,
  revalidateStoredAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import Tooltip from "./Tooltip";

type PremiumPillProps = {
  messages: Messages;
};

export default function PremiumPill({ messages }: PremiumPillProps) {
  const [hydrated, setHydrated] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPremiumUnlocked(readAppLicenseState().premiumUnlocked);
    };
    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
      setHydrated(true);
      sync();
      void revalidateStoredAppLicenseState().then(sync);
    });
    if (typeof window === "undefined") return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== APP_LICENSE_STORAGE_KEY) return;
      sync();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(APP_LICENSE_EVENT, sync);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(APP_LICENSE_EVENT, sync);
    };
  }, []);

  if (!hydrated || !premiumUnlocked) return null;

  return (
    <Tooltip content={messages.premiumPillTooltip}>
      <span className={styles.premiumPill} aria-label={messages.premiumPillTooltip}>
        {messages.premiumPillLabel}
      </span>
    </Tooltip>
  );
}
