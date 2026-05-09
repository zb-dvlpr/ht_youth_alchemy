"use client";

import { useCallback, useState } from "react";

import type { Messages } from "@/lib/i18n";
import {
  type AppLicenseState,
  buildAppLicenseInstanceName,
  dispatchAppLicenseActivatedEvent,
  readAppLicenseState,
  validateAppLicenseKey,
  writeAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import Modal from "./Modal";

type AppLicenseModalProps = {
  open: boolean;
  messages: Messages;
  onClose: () => void;
  onSaved?: (state: AppLicenseState) => void;
};

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
  const [submitting, setSubmitting] = useState(false);

  const saveLicense = useCallback(async () => {
    const trimmed = licenseInput.trim();
    if (!trimmed) {
      setFeedback(messages.clubChroniclePremiumLicenseKeyRequired);
      return;
    }
    setSubmitting(true);
    const validation = await validateAppLicenseKey(trimmed, {
      instanceName: buildAppLicenseInstanceName(),
      activate: true,
    });
    if (validation.transientFailure) {
      setSubmitting(false);
      setFeedback(messages.clubChroniclePremiumLicenseValidationUnavailable);
      return;
    }
    if (!validation.valid || !validation.instanceId) {
      setSubmitting(false);
      setFeedback(messages.clubChroniclePremiumLicenseInvalid);
      return;
    }
    const nextState: AppLicenseState = {
      licenseKey: trimmed,
      instanceId: validation.instanceId,
      premiumUnlocked: true,
      validatedAt: Date.now(),
    };
    writeAppLicenseState(nextState);
    onSaved?.(nextState);
    setSubmitting(false);
    setFeedback(null);
    onClose();
    if (validation.details) {
      dispatchAppLicenseActivatedEvent(validation.details);
    }
  }, [
    licenseInput,
    messages.clubChroniclePremiumLicenseInvalid,
    messages.clubChroniclePremiumLicenseKeyRequired,
    messages.clubChroniclePremiumLicenseValidationUnavailable,
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
              onClick={() => undefined}
              disabled={submitting}
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
                disabled={submitting}
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
            disabled={submitting}
          >
            {messages.closeLabel}
          </button>
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => void saveLicense()}
            disabled={!licenseInput.trim() || submitting}
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
