"use client";

import { useCallback, useState } from "react";

import type { Messages } from "@/lib/i18n";
import {
  type AppLicenseState,
  readAppLicenseState,
  writeAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import Modal from "./Modal";
import { useNotifications } from "./notifications/NotificationsProvider";

type AppLicenseModalProps = {
  open: boolean;
  messages: Messages;
  onClose: () => void;
  onSaved?: (state: AppLicenseState) => void;
};

const IS_DEV_BUILD = process.env.NODE_ENV !== "production";

export default function AppLicenseModal({
  open,
  messages,
  onClose,
  onSaved,
}: AppLicenseModalProps) {
  const [licenseInput, setLicenseInput] = useState(() =>
    readAppLicenseState().licenseKey
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const { addNotification } = useNotifications();

  const saveLicense = useCallback(() => {
    const trimmed = licenseInput.trim();
    if (!trimmed) {
      setFeedback(messages.clubChroniclePremiumLicenseKeyRequired);
      return;
    }
    const nextState: AppLicenseState = IS_DEV_BUILD
      ? {
          licenseKey: trimmed,
          premiumUnlocked: true,
          validatedAt: Date.now(),
        }
      : {
          licenseKey: trimmed,
          premiumUnlocked: false,
          validatedAt: null,
        };
    writeAppLicenseState(nextState);
    onSaved?.(nextState);
    if (IS_DEV_BUILD) {
      setFeedback(null);
      onClose();
      addNotification(messages.clubChroniclePremiumLicenseUnlocked);
      return;
    }
    setFeedback(messages.clubChroniclePremiumLicensePendingValidation);
  }, [
    addNotification,
    licenseInput,
    messages.clubChroniclePremiumLicenseKeyRequired,
    messages.clubChroniclePremiumLicensePendingValidation,
    messages.clubChroniclePremiumLicenseUnlocked,
    onClose,
    onSaved,
  ]);

  return (
    <Modal
      open={open}
      title={messages.clubChroniclePremiumLicenseTitle}
      className={styles.watchlistModal}
      body={
        <div className={styles.watchlistPanel}>
          <p className={styles.muted}>{messages.clubChroniclePremiumLicenseBody}</p>
          <div className={styles.watchlistSection}>
            <button
              type="button"
              className={styles.watchlistButton}
              onClick={() => {}}
            >
              {messages.clubChroniclePremiumBuyButton}
            </button>
          </div>
          <div className={styles.watchlistSection}>
            <label
              className={styles.watchlistHeading}
              htmlFor="app-premium-license-input"
            >
              {messages.clubChroniclePremiumLicenseFieldLabel}
            </label>
            <div className={styles.watchlistInputRow}>
              <input
                id="app-premium-license-input"
                type="text"
                className={styles.watchlistInput}
                value={licenseInput}
                onChange={(event) => setLicenseInput(event.target.value)}
                placeholder={messages.clubChroniclePremiumLicensePlaceholder}
              />
            </div>
            {feedback ? (
              <p className={styles.watchlistPremiumHint}>{feedback}</p>
            ) : null}
          </div>
        </div>
      }
      actions={
        <div className={styles.modalButtonRow}>
          <button
            type="button"
            className={styles.confirmCancel}
            onClick={onClose}
          >
            {messages.closeLabel}
          </button>
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={saveLicense}
            disabled={!licenseInput.trim()}
          >
            {messages.clubChroniclePremiumLicenseSubmit}
          </button>
        </div>
      }
      closeOnBackdrop
      onClose={onClose}
    />
  );
}
