"use client";

import { useEffect, useState } from "react";

import { type Messages } from "@/lib/i18n";
import type { LemonSqueezyLicenseDetails } from "@/lib/lemonsqueezyLicense";
import {
  APP_LICENSE_EVENT,
  APP_LICENSE_ACTIVATED_EVENT,
  APP_LICENSE_REVOKED_EVENT,
  APP_LICENSE_STORAGE_KEY,
  consumeLicenseKeyFromUrl,
  readAppLicenseState,
  revalidateStoredAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import AppLicenseDetails from "./AppLicenseDetails";
import Modal from "./Modal";
import Tooltip from "./Tooltip";
import { useNotifications } from "./notifications/NotificationsProvider";

type PremiumPillProps = {
  messages: Messages;
};

export default function PremiumPill({ messages }: PremiumPillProps) {
  const [hydrated, setHydrated] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [activatedDetails, setActivatedDetails] =
    useState<LemonSqueezyLicenseDetails | null>(null);
  const [licenseRevoked, setLicenseRevoked] = useState(false);
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
    const handleActivated = (event: Event) => {
      const details = (event as CustomEvent<LemonSqueezyLicenseDetails | null>).detail;
      if (details) {
        setActivatedDetails(details);
      }
      sync();
    };
    const handleRevoked = () => {
      setLicenseRevoked(true);
      sync();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(APP_LICENSE_EVENT, sync);
    window.addEventListener(APP_LICENSE_ACTIVATED_EVENT, handleActivated);
    window.addEventListener(APP_LICENSE_REVOKED_EVENT, handleRevoked);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(APP_LICENSE_EVENT, sync);
      window.removeEventListener(APP_LICENSE_ACTIVATED_EVENT, handleActivated);
      window.removeEventListener(APP_LICENSE_REVOKED_EVENT, handleRevoked);
    };
  }, [
    addNotification,
    messages.clubChroniclePremiumLicenseUnlocked,
  ]);

  return (
    <>
      {hydrated && premiumUnlocked ? (
        <Tooltip content={messages.premiumPillTooltip}>
          <span className={styles.premiumPill} aria-label={messages.premiumPillTooltip}>
            {messages.premiumPillLabel}
          </span>
        </Tooltip>
      ) : null}
      <Modal
        open={activatedDetails !== null}
        title={messages.settingsLicenseActivationSuccessTitle}
        className={styles.licenseModal}
        body={
          activatedDetails ? (
            <div className={styles.settingsModalBody}>
              <p className={styles.muted}>
                {messages.settingsLicenseActivationSuccessBody}
              </p>
              <AppLicenseDetails details={activatedDetails} messages={messages} />
            </div>
          ) : undefined
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setActivatedDetails(null)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setActivatedDetails(null)}
      />
      <Modal
        open={licenseRevoked}
        title={messages.settingsLicenseRevocationSuccessTitle}
        body={<p>{messages.settingsLicenseRevocationSuccessBody}</p>}
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setLicenseRevoked(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setLicenseRevoked(false)}
      />
    </>
  );
}
