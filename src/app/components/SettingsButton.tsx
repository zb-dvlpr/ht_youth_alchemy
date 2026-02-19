"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { useNotifications } from "./notifications/NotificationsProvider";
import Modal from "./Modal";
import {
  ALGORITHM_SETTINGS_EVENT,
  readAllowTrainingUntilMaxedOut,
  writeAllowTrainingUntilMaxedOut,
  readYouthStalenessHours,
  writeYouthStalenessHours,
  YOUTH_SETTINGS_EVENT,
  readClubChronicleStalenessDays,
  writeClubChronicleStalenessDays,
  readClubChronicleTransferHistoryCount,
  writeClubChronicleTransferHistoryCount,
  readClubChronicleUpdatesHistoryCount,
  writeClubChronicleUpdatesHistoryCount,
  CLUB_CHRONICLE_DEBUG_EVENT,
  CLUB_CHRONICLE_SETTINGS_EVENT,
  GENERAL_SETTINGS_EVENT,
  readGeneralEnableScaling,
  writeGeneralEnableScaling,
} from "@/lib/settings";

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
  const [youthSettingsOpen, setYouthSettingsOpen] = useState(false);
  const [chronicleSettingsOpen, setChronicleSettingsOpen] = useState(false);
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const [debugSettingsOpen, setDebugSettingsOpen] = useState(false);
  const [allowTrainingUntilMaxedOut, setAllowTrainingUntilMaxedOut] =
    useState(true);
  const [stalenessHours, setStalenessHours] = useState(3);
  const [chronicleStalenessDays, setChronicleStalenessDays] = useState(3);
  const [chronicleTransferHistoryCount, setChronicleTransferHistoryCount] =
    useState(5);
  const [chronicleUpdatesHistoryCount, setChronicleUpdatesHistoryCount] =
    useState(10);
  const [enableAppScaling, setEnableAppScaling] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { addNotification } = useNotifications();
  const isDev = process.env.NODE_ENV !== "production";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAllowTrainingUntilMaxedOut(readAllowTrainingUntilMaxedOut());
    setStalenessHours(readYouthStalenessHours());
    setChronicleStalenessDays(readClubChronicleStalenessDays());
    setChronicleTransferHistoryCount(readClubChronicleTransferHistoryCount());
    setChronicleUpdatesHistoryCount(readClubChronicleUpdatesHistoryCount());
    setEnableAppScaling(readGeneralEnableScaling());
  }, []);

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

  const handleAllowTrainingToggle = (nextValue: boolean) => {
    setAllowTrainingUntilMaxedOut(nextValue);
    writeAllowTrainingUntilMaxedOut(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(ALGORITHM_SETTINGS_EVENT, {
          detail: { allowTrainingUntilMaxedOut: nextValue },
        })
      );
    }
  };

  const handleStalenessHoursChange = (value: number) => {
    const nextValue = Math.min(24, Math.max(1, Math.round(value)));
    setStalenessHours(nextValue);
    writeYouthStalenessHours(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(YOUTH_SETTINGS_EVENT, {
          detail: { stalenessHours: nextValue },
        })
      );
    }
  };

  const handleChronicleStalenessChange = (value: number) => {
    const nextValue = Math.min(7, Math.max(1, Math.round(value)));
    setChronicleStalenessDays(nextValue);
    writeClubChronicleStalenessDays(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CLUB_CHRONICLE_SETTINGS_EVENT, {
          detail: {
            stalenessDays: nextValue,
            transferHistoryCount: chronicleTransferHistoryCount,
            updatesHistoryCount: chronicleUpdatesHistoryCount,
          },
        })
      );
    }
  };

  const handleChronicleTransferHistoryCountChange = (value: number) => {
    const nextValue = Math.min(50, Math.max(1, Math.round(value)));
    setChronicleTransferHistoryCount(nextValue);
    writeClubChronicleTransferHistoryCount(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CLUB_CHRONICLE_SETTINGS_EVENT, {
          detail: {
            stalenessDays: chronicleStalenessDays,
            transferHistoryCount: nextValue,
            updatesHistoryCount: chronicleUpdatesHistoryCount,
          },
        })
      );
    }
  };

  const handleChronicleUpdatesHistoryCountChange = (value: number) => {
    const nextValue = Math.min(50, Math.max(1, Math.round(value)));
    setChronicleUpdatesHistoryCount(nextValue);
    writeClubChronicleUpdatesHistoryCount(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CLUB_CHRONICLE_SETTINGS_EVENT, {
          detail: {
            stalenessDays: chronicleStalenessDays,
            transferHistoryCount: chronicleTransferHistoryCount,
            updatesHistoryCount: nextValue,
          },
        })
      );
    }
  };

  const handleEnableScalingToggle = (nextValue: boolean) => {
    setEnableAppScaling(nextValue);
    writeGeneralEnableScaling(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(GENERAL_SETTINGS_EVENT, {
          detail: { enableScaling: nextValue },
        })
      );
    }
  };

  const handleShowDummyUpdates = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CLUB_CHRONICLE_DEBUG_EVENT));
    }
    setDebugSettingsOpen(false);
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
            onClick={() => {
              setYouthSettingsOpen(true);
              setOpen(false);
            }}
          >
            {messages.settingsYouth}
          </button>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={() => {
              setChronicleSettingsOpen(true);
              setOpen(false);
            }}
          >
            {messages.settingsClubChronicle}
          </button>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={() => {
              setGeneralSettingsOpen(true);
              setOpen(false);
            }}
          >
            {messages.settingsGeneral}
          </button>
          {isDev ? (
            <button
              type="button"
              className={styles.feedbackLink}
              onClick={() => {
                setDebugSettingsOpen(true);
                setOpen(false);
              }}
            >
              {messages.settingsDebug}
            </button>
          ) : null}
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
      <Modal
        open={youthSettingsOpen}
        title={messages.settingsYouthTitle}
        body={
          <div className={styles.settingsModalBody}>
            <Tooltip
              content={messages.settingsAlgorithmsAllowTrainingTooltip}
              fullWidth
            >
              <label className={styles.algorithmsToggle}>
                <span className={styles.algorithmsToggleText}>
                  {messages.settingsAlgorithmsAllowTrainingLabel}
                </span>
                <input
                  type="checkbox"
                  className={styles.algorithmsToggleInput}
                  checked={allowTrainingUntilMaxedOut}
                  onChange={(event) =>
                    handleAllowTrainingToggle(event.target.checked)
                  }
                />
                <span
                  className={styles.algorithmsToggleSwitch}
                  aria-hidden="true"
                />
              </label>
            </Tooltip>
            <Tooltip content={messages.settingsYouthStalenessHint} fullWidth>
              <label className={styles.settingsField}>
                <span className={styles.settingsFieldLabel}>
                  {messages.settingsYouthStalenessLabel}
                </span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={stalenessHours}
                  className={styles.settingsFieldInput}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    handleStalenessHoursChange(value);
                  }}
                />
              </label>
            </Tooltip>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setYouthSettingsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setYouthSettingsOpen(false)}
      />
      <Modal
        open={chronicleSettingsOpen}
        title={messages.settingsClubChronicleTitle}
        body={
          <div className={styles.settingsModalBody}>
            <Tooltip
              content={messages.settingsClubChronicleStalenessHint}
              fullWidth
            >
              <label className={styles.settingsField}>
                <span className={styles.settingsFieldLabel}>
                  {messages.settingsClubChronicleStalenessLabel}
                </span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={chronicleStalenessDays}
                  className={styles.settingsFieldInput}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    handleChronicleStalenessChange(value);
                  }}
                />
              </label>
            </Tooltip>
            <Tooltip
              content={messages.settingsClubChronicleTransferHistoryHint}
              fullWidth
            >
              <label className={styles.settingsField}>
                <span className={styles.settingsFieldLabel}>
                  {messages.settingsClubChronicleTransferHistoryLabel}
                </span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={chronicleTransferHistoryCount}
                  className={styles.settingsFieldInput}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    handleChronicleTransferHistoryCountChange(value);
                  }}
                />
              </label>
            </Tooltip>
            <Tooltip
              content={messages.settingsClubChronicleUpdatesHistoryHint}
              fullWidth
            >
              <label className={styles.settingsField}>
                <span className={styles.settingsFieldLabel}>
                  {messages.settingsClubChronicleUpdatesHistoryLabel}
                </span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={chronicleUpdatesHistoryCount}
                  className={styles.settingsFieldInput}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    handleChronicleUpdatesHistoryCountChange(value);
                  }}
                />
              </label>
            </Tooltip>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setChronicleSettingsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setChronicleSettingsOpen(false)}
      />
      <Modal
        open={generalSettingsOpen}
        title={messages.settingsGeneralTitle}
        body={
          <div className={styles.settingsModalBody}>
            <Tooltip
              content={messages.settingsGeneralEnableScalingTooltip}
              fullWidth
            >
              <label className={styles.algorithmsToggle}>
                <span className={styles.algorithmsToggleText}>
                  {messages.settingsGeneralEnableScalingLabel}
                </span>
                <input
                  type="checkbox"
                  className={styles.algorithmsToggleInput}
                  checked={enableAppScaling}
                  onChange={(event) =>
                    handleEnableScalingToggle(event.target.checked)
                  }
                />
                <span
                  className={styles.algorithmsToggleSwitch}
                  aria-hidden="true"
                />
              </label>
            </Tooltip>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setGeneralSettingsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setGeneralSettingsOpen(false)}
      />
      <Modal
        open={debugSettingsOpen}
        title={messages.settingsDebugTitle}
        body={
          <div className={styles.settingsModalBody}>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={handleShowDummyUpdates}
            >
              {messages.settingsDebugDisableScalingLabel}
            </button>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmCancel}
            onClick={() => setDebugSettingsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setDebugSettingsOpen(false)}
      />
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
