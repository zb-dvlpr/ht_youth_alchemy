"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { ChppAuthRequiredError, fetchChppJson } from "@/lib/chpp/client";
import { parseExtendedPermissionsFromCheckToken } from "@/lib/chpp/permissions";

type ConnectedStatusProps = {
  messages: Messages;
};

export default function ConnectedStatus({ messages }: ConnectedStatusProps) {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const { response, payload } = await fetchChppJson<{
          raw?: string;
          permissions?: string[];
        }>("/api/chpp/oauth/check-token?skipPermissionCheck=1",
          {
            cache: "no-store",
          }
        );
        if (!response.ok) return;
        const list = Array.isArray(payload?.permissions)
          ? payload.permissions
          : parseExtendedPermissionsFromCheckToken(payload?.raw ?? "");
        if (isActive) {
          setPermissions(list);
        }
      } catch (error) {
        if (error instanceof ChppAuthRequiredError) return;
        if (isActive) {
          setPermissions(null);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const permissionsText = permissions
    ? permissions.length
      ? permissions.join(", ")
      : messages.permissionsNone
    : messages.unknownShort;

  const handleDisconnect = async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    try {
      await fetch("/api/chpp/oauth/invalidate-token", { method: "POST" });
    } finally {
      window.location.reload();
    }
  };

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
