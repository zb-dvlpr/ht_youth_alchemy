"use client";

import Image from "next/image";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import {
  getChppHttpStatusLabel,
  type ChppAccessProblemKind,
} from "@/lib/chpp/httpStatusReasons";
import { reconnectChppWithTokenReset } from "@/lib/chpp/client";
import { hattrickHelpContactUrl } from "@/lib/hattrick/urls";

type ChppAccessGateProps = {
  messages: Messages;
  kind: ChppAccessProblemKind;
  statusCode?: number | null;
  reason?: string | null;
  details?: string | null;
  simulated?: boolean;
  onCloseSimulation?: () => void;
};

export default function ChppAccessGate({
  messages,
  kind,
  statusCode = null,
  reason = null,
  details = null,
  simulated = false,
  onCloseSimulation,
}: ChppAccessGateProps) {
  const title =
    kind === "missing-token"
      ? messages.chppAccessAuthorizationTitle
      : kind === "server-error"
        ? messages.chppAccessServerProblemTitle
        : messages.chppAccessClientProblemTitle;
  const resolvedReason = reason ?? messages.chppAccessUnknownReason;
  const statusText =
    typeof statusCode === "number"
      ? `${statusCode} ${getChppHttpStatusLabel(statusCode)}`
      : "-";
  const showDevClose =
    process.env.NODE_ENV !== "production" && simulated && onCloseSimulation;

  const handleReport = () => {
    if (typeof window === "undefined") return;
    window.open(hattrickHelpContactUrl(), "_blank", "noopener,noreferrer");
  };

  return (
    <section className={styles.chppAccessGate} aria-labelledby="chpp-access-title">
      <div className={styles.chppAccessCard}>
        <div className={styles.chppAccessLogo}>
          <Image
            src="/branding/ht_alchemy_logo.png"
            alt={messages.chppAccessLogoAlt}
            width={140}
            height={140}
            className={styles.chppAccessLogoImage}
            priority
          />
        </div>
        <h1 id="chpp-access-title" className={styles.chppAccessTitle}>
          {title}
        </h1>
        {kind === "missing-token" ? (
          <p className={styles.chppAccessBody}>
            {messages.chppAccessAuthorizationBody}
          </p>
        ) : (
          <>
            <div className={styles.chppAccessStatus}>
              <strong>{statusText}</strong>
            </div>
            <p className={styles.chppAccessReason}>{resolvedReason}</p>
            {kind === "server-error" ? (
              <p className={styles.chppAccessBody}>
                {messages.chppAccessServerProblemBody}
              </p>
            ) : null}
            {details ? (
              <p className={styles.chppAccessDetails}>{details}</p>
            ) : null}
          </>
        )}
        <div className={styles.chppAccessActions}>
          {kind === "missing-token" ? (
            <a className={styles.confirmSubmit} href="/api/chpp/oauth/start">
              {messages.chppAccessConnectAction}
            </a>
          ) : (
            <>
              {kind === "server-error" ? (
                <button
                  type="button"
                  className={styles.confirmCancel}
                  onClick={handleReport}
                >
                  {messages.chppAccessReportAction}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => {
                  void reconnectChppWithTokenReset();
                }}
              >
                {messages.chppAccessReauthorizeAction}
              </button>
            </>
          )}
        </div>
        {showDevClose ? (
          <button
            type="button"
            className={styles.chppAccessDevClose}
            onClick={onCloseSimulation}
          >
            {messages.chppAccessDevCloseSimulation}
          </button>
        ) : null}
      </div>
    </section>
  );
}
