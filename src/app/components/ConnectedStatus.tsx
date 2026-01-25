"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";

type ConnectedStatusProps = {
  messages: Messages;
};

export default function ConnectedStatus({ messages }: ConnectedStatusProps) {
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/chpp/oauth/check-token", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { raw?: string };
        const raw = payload.raw ?? "";
        const match = raw.match(/<ExtendedPermissions>([^<]*)<\/ExtendedPermissions>/);
        const content = match?.[1]?.trim() ?? "";
        const list = content
          ? content.split(",").map((value) => value.trim()).filter(Boolean)
          : [];
        if (isActive) {
          setPermissions(list);
        }
      } catch {
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

  return (
    <div className={styles.connectedInfo}>
      <span className={styles.connectedBadge}>{messages.connectedLabel}</span>
      <span className={styles.connectedPermissions}>
        {messages.permissionsLabel}{" "}
        {permissions ? (
          permissions.length ? (
            permissions.join(", ")
          ) : (
            messages.permissionsNone
          )
        ) : (
          messages.unknownShort
        )}
      </span>
    </div>
  );
}
