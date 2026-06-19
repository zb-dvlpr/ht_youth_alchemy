"use client";

import { useState } from "react";
import styles from "../page.module.css";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { useChppPermissions } from "./ChppPermissionsProvider";

type ConnectedStatusProps = {
  messages: Messages;
  variant?: "default" | "buttonOnly";
};

export default function ConnectedStatus({
  messages,
  variant = "default",
}: ConnectedStatusProps) {
  const { loading, permissions } = useChppPermissions();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const analyticsSource: "desktop_header" | "mobile_header" =
    variant === "buttonOnly" ? "mobile_header" : "desktop_header";

  const permissionsText = !loading
    ? permissions.length
      ? permissions.join(", ")
      : messages.permissionsNone
    : messages.unknownShort;

  const handleDisconnect = async () => {
    if (isDisconnecting) return;
    trackAnalyticsEvent("app_connection_used", {
      feature: "disconnect_token_clicked",
      app_source: analyticsSource,
    });
    setIsDisconnecting(true);
    try {
      await fetch("/api/chpp/oauth/invalidate-token", { method: "POST" });
    } finally {
      window.location.reload();
    }
  };

  if (variant === "buttonOnly") {
    return (
      <button
        type="button"
        className={styles.mobileDisconnectButton}
        onClick={handleDisconnect}
        aria-label={messages.disconnectTitle}
        disabled={isDisconnecting}
      >
        {messages.disconnectLabel}
      </button>
    );
  }

  return (
    <div className={styles.connectedInfo}>
      <Tooltip
        variant="stacked"
        content={`${messages.permissionsLabel} ${permissionsText}`}
      >
        <span className={styles.connectedBadge}>{messages.connectedLabel}</span>
      </Tooltip>
      <Tooltip content={messages.disconnectTitle}>
        <button
          type="button"
          className={styles.disconnectButton}
          onClick={handleDisconnect}
          aria-label={messages.disconnectTitle}
          disabled={isDisconnecting}
        >
          ⏻
        </button>
      </Tooltip>
    </div>
  );
}
