"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { useNotifications } from "./notifications/NotificationsProvider";

type SettingsButtonProps = {
  messages: Messages;
};

type ExportPayload = {
  version: number;
  exportedAt: string;
  entries: Record<string, string>;
};

const STORAGE_PREFIX = "ya_";

export default function SettingsButton({ messages }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target ?? null)) return;
      if (menuRef.current?.contains(target ?? null)) return;
      setOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  const handleExport = () => {
    if (typeof window === "undefined") return;
    try {
      const entries: Record<string, string> = {};
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
        const value = window.localStorage.getItem(key);
        if (value === null) continue;
        entries[key] = value;
      }
      const payload: ExportPayload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        entries,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `youth-alchemy-data-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      addNotification(messages.settingsExportSuccess);
    } catch {
      addNotification(messages.settingsExportFailed);
    } finally {
      setOpen(false);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const applyImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ExportPayload;
      if (!parsed || typeof parsed !== "object" || !parsed.entries) {
        throw new Error("invalid payload");
      }
      const entries = parsed.entries;
      if (typeof window !== "undefined") {
        const keysToRemove: string[] = [];
        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index);
          if (key && key.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
        Object.entries(entries).forEach(([key, value]) => {
          if (!key.startsWith(STORAGE_PREFIX)) return;
          window.localStorage.setItem(key, value);
        });
      }
      addNotification(messages.settingsImportSuccess);
      window.location.reload();
    } catch {
      addNotification(messages.settingsImportFailed);
    } finally {
      setOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className={styles.feedbackWrap}>
      <Tooltip content={messages.settingsTooltip}>
        <button
          type="button"
          className={styles.feedbackButton}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={messages.settingsTooltip}
          ref={buttonRef}
        >
          ⚙️
        </button>
      </Tooltip>
      {open ? (
        <div className={styles.feedbackMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={handleExport}
          >
            {messages.settingsExport}
          </button>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={handleImport}
          >
            {messages.settingsImport}
          </button>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className={styles.settingsFileInput}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void applyImport(file);
        }}
      />
    </div>
  );
}
