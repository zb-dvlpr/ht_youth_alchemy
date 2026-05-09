"use client";

import { useEffect, useState } from "react";

import { type Messages } from "@/lib/i18n";
import type { LemonSqueezyLicenseDetails } from "@/lib/lemonsqueezyLicense";
import {
  APP_LICENSE_EVENT,
  APP_LICENSE_ACTIVATED_EVENT,
  APP_LICENSE_EXPIRING_EVENT,
  APP_LICENSE_LIMIT_EXCEEDED_EVENT,
  APP_LICENSE_REVOKED_EVENT,
  APP_LICENSE_STORAGE_KEY,
  clearAppLicenseState,
  consumeLicenseKeyFromUrl,
  fetchStoredAppLicenseDetails,
  openAppLicensePurchaseUrl,
  readAppLicenseState,
  readAppLicensePurchaseUrl,
  revalidateStoredAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import AppLicenseModal from "./AppLicenseModal";
import AppLicenseDetails from "./AppLicenseDetails";
import Modal from "./Modal";
import PremiumStatusPill from "./PremiumStatusPill";
import { useNotifications } from "./notifications/NotificationsProvider";

type PremiumPillProps = {
  messages: Messages;
};

const LICENSE_REVALIDATION_INTERVAL_MS = 60 * 60 * 1000;

export default function PremiumPill({ messages }: PremiumPillProps) {
  const hasPurchaseUrl = Boolean(readAppLicensePurchaseUrl());
  const [hydrated, setHydrated] = useState(false);
  const [licenseEntryOpen, setLicenseEntryOpen] = useState(false);
  const [licenseDetailsOpen, setLicenseDetailsOpen] = useState(false);
  const [licenseDetails, setLicenseDetails] =
    useState<LemonSqueezyLicenseDetails | null>(null);
  const [licenseDetailsLoading, setLicenseDetailsLoading] = useState(false);
  const [licenseDetailsUnavailable, setLicenseDetailsUnavailable] = useState(false);
  const [activatedDetails, setActivatedDetails] =
    useState<LemonSqueezyLicenseDetails | null>(null);
  const [expiringDetails, setExpiringDetails] =
    useState<LemonSqueezyLicenseDetails | null>(null);
  const [expiringThreshold, setExpiringThreshold] = useState<"week" | "day" | null>(null);
  const [licenseRevoked, setLicenseRevoked] = useState(false);
  const [licenseLimitExceeded, setLicenseLimitExceeded] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!licenseDetailsOpen) return;
    let active = true;
    void (async () => {
      const currentState = readAppLicenseState();
      const hasActiveLicense =
        currentState.premiumUnlocked &&
        currentState.licenseKey.trim().length > 0 &&
        currentState.instanceId.trim().length > 0;
      if (!active) return;
      if (!hasActiveLicense) {
        setLicenseDetails(null);
        setLicenseDetailsLoading(false);
        setLicenseDetailsUnavailable(false);
        return;
      }
      setLicenseDetailsLoading(true);
      setLicenseDetailsUnavailable(false);
      const result = await fetchStoredAppLicenseDetails();
      if (!active) return;
      if (result.transientFailure) {
        setLicenseDetails(null);
        setLicenseDetailsUnavailable(true);
        setLicenseDetailsLoading(false);
        return;
      }
      if (result.exceededActivationLimit) {
        clearAppLicenseState();
        setLicenseDetails(null);
        setLicenseDetailsUnavailable(false);
        setLicenseDetailsLoading(false);
        setLicenseDetailsOpen(false);
        setLicenseLimitExceeded(true);
        return;
      }
      if (!result.valid || !result.details) {
        clearAppLicenseState();
        setLicenseDetails(null);
        setLicenseDetailsUnavailable(false);
        setLicenseDetailsLoading(false);
        return;
      }
      setLicenseDetails(result.details);
      setLicenseDetailsUnavailable(false);
      setLicenseDetailsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [licenseDetailsOpen]);

  useEffect(() => {
    const sync = () => {
      void readAppLicenseState().premiumUnlocked;
    };
    const revalidateIfActive = async () => {
      const state = readAppLicenseState();
      if (
        !state.premiumUnlocked ||
        !state.licenseKey.trim() ||
        !state.instanceId.trim()
      ) {
        sync();
        return;
      }
      await revalidateStoredAppLicenseState();
      sync();
    };
    let frameId = 0;
    let intervalId = 0;
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
          await revalidateIfActive();
        }
        sync();
      })();
      intervalId = window.setInterval(() => {
        void revalidateIfActive();
      }, LICENSE_REVALIDATION_INTERVAL_MS);
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
    const handleExpiring = (
      event: Event
    ) => {
      const detail = (event as CustomEvent<{
        details: LemonSqueezyLicenseDetails;
        threshold: "week" | "day";
      }>).detail;
      if (!detail?.details || !detail?.threshold) return;
      setExpiringDetails(detail.details);
      setExpiringThreshold(detail.threshold);
      sync();
    };
    const handleLimitExceeded = () => {
      setLicenseLimitExceeded(true);
      sync();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(APP_LICENSE_EVENT, sync);
    window.addEventListener(APP_LICENSE_ACTIVATED_EVENT, handleActivated);
    window.addEventListener(APP_LICENSE_EXPIRING_EVENT, handleExpiring);
    window.addEventListener(APP_LICENSE_LIMIT_EXCEEDED_EVENT, handleLimitExceeded);
    window.addEventListener(APP_LICENSE_REVOKED_EVENT, handleRevoked);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(APP_LICENSE_EVENT, sync);
      window.removeEventListener(APP_LICENSE_ACTIVATED_EVENT, handleActivated);
      window.removeEventListener(APP_LICENSE_EXPIRING_EVENT, handleExpiring);
      window.removeEventListener(
        APP_LICENSE_LIMIT_EXCEEDED_EVENT,
        handleLimitExceeded
      );
      window.removeEventListener(APP_LICENSE_REVOKED_EVENT, handleRevoked);
    };
  }, [
    addNotification,
    messages.clubChroniclePremiumLicenseUnlocked,
  ]);

  return (
    <>
      {hydrated ? (
        <PremiumStatusPill
          messages={messages}
          onClick={(premiumUnlocked) => {
            if (premiumUnlocked) {
              setLicenseDetailsOpen(true);
              return;
            }
            setLicenseEntryOpen(true);
          }}
        />
      ) : null}
      <AppLicenseModal
        open={licenseEntryOpen}
        messages={messages}
        onClose={() => setLicenseEntryOpen(false)}
      />
      <Modal
        open={licenseDetailsOpen}
        title={messages.settingsLicenseTitle}
        className={styles.licenseModal}
        body={
          <div className={styles.settingsModalBody}>
            <p className={styles.muted}>{messages.settingsLicenseBody}</p>
            {licenseDetailsLoading ? (
              <p className={styles.muted}>{messages.settingsLicenseLoading}</p>
            ) : licenseDetails ? (
              <AppLicenseDetails details={licenseDetails} messages={messages} />
            ) : licenseDetailsUnavailable ? (
              <p className={styles.watchlistPremiumHint}>
                {messages.clubChroniclePremiumLicenseValidationUnavailable}
              </p>
            ) : (
              <p className={styles.muted}>{messages.settingsLicenseNoActive}</p>
            )}
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setLicenseDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setLicenseDetailsOpen(false)}
      />
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
        open={expiringDetails !== null && expiringThreshold !== null}
        title={
          expiringThreshold === "day"
            ? messages.settingsLicenseExpiringDayTitle
            : messages.settingsLicenseExpiringWeekTitle
        }
        className={styles.licenseModal}
        body={
          <p>
            {expiringThreshold === "day"
              ? messages.settingsLicenseExpiringDayBody
              : messages.settingsLicenseExpiringWeekBody}
          </p>
        }
        actions={
          <div className={styles.modalButtonRow}>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={() => {
                openAppLicensePurchaseUrl();
              }}
              disabled={!hasPurchaseUrl}
            >
              {messages.settingsLicenseRenewButton}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={() => {
                setExpiringDetails(null);
                setExpiringThreshold(null);
              }}
            >
              {messages.closeLabel}
            </button>
          </div>
        }
        closeOnBackdrop
        onClose={() => {
          setExpiringDetails(null);
          setExpiringThreshold(null);
        }}
      />
      <Modal
        open={licenseLimitExceeded}
        title={messages.settingsLicenseLimitExceededTitle}
        body={<p>{messages.settingsLicenseLimitExceededBody}</p>}
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setLicenseLimitExceeded(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setLicenseLimitExceeded(false)}
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
