"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";
import Modal from "./Modal";
import { getClientMessages } from "@/lib/clientLocale";
import {
  dispatchAnalyticsConsentChange,
  readAnalyticsConsent,
  subscribeAnalyticsConsentChange,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analyticsConsent";

export default function AnalyticsConsentModal() {
  const messages = getClientMessages();
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const [ready, setReady] = useState(false);
  const denyButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const syncConsent = () => {
      setConsent(readAnalyticsConsent());
      setReady(true);
    };
    syncConsent();
    return subscribeAnalyticsConsentChange(syncConsent);
  }, []);

  useEffect(() => {
    if (!ready || consent !== null) return;
    denyButtonRef.current?.focus();
  }, [consent, ready]);

  const handleConsentChoice = (nextConsent: AnalyticsConsent) => {
    writeAnalyticsConsent(nextConsent);
    dispatchAnalyticsConsentChange();
    setConsent(nextConsent);
  };

  return (
    <Modal
      open={ready && consent === null}
      title={messages.analyticsConsentModalTitle}
      body={
        <div className={styles.settingsModalBody}>
          <p className={styles.muted}>{messages.analyticsConsentModalBody}</p>
        </div>
      }
      actions={
        <>
          <button
            ref={denyButtonRef}
            type="button"
            className={styles.settingsActionButton}
            onClick={() => handleConsentChoice("denied")}
          >
            {messages.analyticsConsentDeniedAction}
          </button>
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => handleConsentChoice("granted")}
          >
            {messages.analyticsConsentGrantedAction}
          </button>
        </>
      }
      movable={false}
    />
  );
}
