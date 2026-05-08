"use client";

import { useEffect, useState } from "react";

import { type Messages } from "@/lib/i18n";
import {
  APP_LICENSE_EVENT,
  APP_LICENSE_STORAGE_KEY,
  consumeLicenseKeyFromUrl,
  readAppLicenseState,
  revalidateStoredAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import Tooltip from "./Tooltip";
import { useNotifications } from "./notifications/NotificationsProvider";

type PremiumPillProps = {
  messages: Messages;
};

export default function PremiumPill({ messages }: PremiumPillProps) {
  const [hydrated, setHydrated] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    const sync = () => {
      setPremiumUnlocked(readAppLicenseState().premiumUnlocked);
    };
    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
      setHydrated(true);
      sync();
      void (async () => {
        const hadLicenseKeyInUrl = new URL(window.location.href).searchParams.has(
          "license_key"
        );
        const unlockedFromUrl = await consumeLicenseKeyFromUrl();
        sync();
        if (unlockedFromUrl) {
          addNotification(messages.clubChroniclePremiumLicenseUnlocked);
          return;
        }
        if (!hadLicenseKeyInUrl) {
          await revalidateStoredAppLicenseState();
        }
        sync();
      })();
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
  }, [
    addNotification,
    messages.clubChroniclePremiumLicenseUnlocked,
  ]);

  if (!hydrated || !premiumUnlocked) return null;

  return (
    <Tooltip content={messages.premiumPillTooltip}>
      <span className={styles.premiumPill} aria-label={messages.premiumPillTooltip}>
        {messages.premiumPillLabel}
      </span>
    </Tooltip>
  );
}
