"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { useNotifications } from "./notifications/NotificationsProvider";
import Modal from "./Modal";
import QRCode from "qrcode";
import {
  type ChppDebugOauthErrorMode,
  readChppDebugOauthErrorMode,
  writeChppDebugOauthErrorMode,
} from "@/lib/chpp/client";
import {
  ALGORITHM_SETTINGS_EVENT,
  readAllowTrainingUntilMaxedOut,
  writeAllowTrainingUntilMaxedOut,
  readYouthStalenessDays,
  writeYouthStalenessDays,
  YOUTH_SETTINGS_EVENT,
  readSeniorStalenessDays,
  writeSeniorStalenessDays,
  SENIOR_SETTINGS_EVENT,
  SENIOR_RATINGS_WIPE_EVENT,
  readSeniorDebugManagerUserId,
  writeSeniorDebugManagerUserId,
  SENIOR_DEBUG_MANAGER_USER_ID_EVENT,
  readClubChronicleStalenessDays,
  writeClubChronicleStalenessDays,
  readClubChronicleTransferHistoryCount,
  writeClubChronicleTransferHistoryCount,
  readClubChronicleUpdatesHistoryCount,
  writeClubChronicleUpdatesHistoryCount,
  CLUB_CHRONICLE_SETTINGS_EVENT,
  CLUB_CHRONICLE_DEBUG_EVENT,
  GENERAL_SETTINGS_EVENT,
  readGeneralEnableScaling,
  writeGeneralEnableScaling,
  YOUTH_NEW_MARKERS_DEBUG_EVENT,
  YOUTH_DEBUG_SE_FETCH_EVENT,
  BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT,
  readYouthNewMarkersDebugEnabled,
  writeYouthNewMarkersDebugEnabled,
} from "@/lib/settings";
import {
  applyImportedChronicleWatchlists,
  buildChronicleWatchlistsImportUrl,
  CLUB_CHRONICLE_WATCHLISTS_IMPORT_QUERY_PARAM,
  exportChronicleWatchlistsToQrString,
  importChronicleWatchlistsFromQrString,
  requestChronicleWatchlistsSnapshot,
  summarizeImportedChronicleWatchlists,
} from "@/lib/chronicleWatchlistTransfer";
import {
  backfillSeniorEncounteredPlayerModelFromLocalCache,
  evaluateSeniorEncounteredPlayerModel,
  getSeniorEncounteredPlayerModelSummary,
  type SeniorEncounteredPlayerModelSummary,
  type SeniorModelEvaluationResult,
} from "@/lib/seniorEncounteredPlayerModel";
import { formatDateTime } from "@/lib/datetime";

type SettingsButtonProps = {
  messages: Messages;
  variant?: "icon" | "launcher";
};

type ExportPayload = {
  version: number;
  exportedAt: string;
  entries: Record<string, string>;
};

const STORAGE_PREFIX = "ya_";
const SENIOR_DASHBOARD_DATA_STORAGE_KEY = "ya_senior_dashboard_data_v1";
const SENIOR_DASHBOARD_STATE_STORAGE_KEY = "ya_senior_dashboard_state_v1";

type ImportedChronicleWatchlists = ReturnType<
  typeof importChronicleWatchlistsFromQrString
>;

export default function SettingsButton({
  messages,
  variant = "icon",
}: SettingsButtonProps) {
  const isMobileLauncherVariant = variant === "launcher";
  const [open, setOpen] = useState(false);
  const [youthSettingsOpen, setYouthSettingsOpen] = useState(false);
  const [seniorSettingsOpen, setSeniorSettingsOpen] = useState(false);
  const [seniorRatingsWipeWarningOpen, setSeniorRatingsWipeWarningOpen] = useState(false);
  const [chronicleSettingsOpen, setChronicleSettingsOpen] = useState(false);
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const [chronicleQrExportOpen, setChronicleQrExportOpen] = useState(false);
  const [chronicleQrImportOpen, setChronicleQrImportOpen] = useState(false);
  const [seniorMlInfoOpen, setSeniorMlInfoOpen] = useState(false);
  const [seniorMlEvaluationOpen, setSeniorMlEvaluationOpen] = useState(false);
  const [seniorMlSummary, setSeniorMlSummary] =
    useState<SeniorEncounteredPlayerModelSummary | null>(null);
  const [seniorMlEvaluation, setSeniorMlEvaluation] =
    useState<SeniorModelEvaluationResult | null>(null);
  const [seniorMlEvaluating, setSeniorMlEvaluating] = useState(false);
  const [chronicleQrImportWarningOpen, setChronicleQrImportWarningOpen] =
    useState(false);
  const [debugSettingsOpen, setDebugSettingsOpen] = useState(false);
  const [allowTrainingUntilMaxedOut, setAllowTrainingUntilMaxedOut] =
    useState(true);
  const [stalenessDays, setStalenessDays] = useState(1);
  const [seniorStalenessDays, setSeniorStalenessDays] = useState(1);
  const [chronicleStalenessDays, setChronicleStalenessDays] = useState(3);
  const [chronicleTransferHistoryCount, setChronicleTransferHistoryCount] =
    useState(5);
  const [chronicleUpdatesHistoryCount, setChronicleUpdatesHistoryCount] =
    useState(10);
  const [enableAppScaling, setEnableAppScaling] = useState(false);
  const [debugOauthErrorMode, setDebugOauthErrorMode] =
    useState<ChppDebugOauthErrorMode>("off");
  const [debugRandomNewMarkersEnabled, setDebugRandomNewMarkersEnabled] =
    useState(false);
  const [debugSeniorManagerUserId, setDebugSeniorManagerUserId] = useState("");
  const [debugYouthSeMatchId, setDebugYouthSeMatchId] = useState("");
  const [chronicleQrEncoded, setChronicleQrEncoded] = useState<string | null>(null);
  const [chronicleQrImageUrl, setChronicleQrImageUrl] = useState<string | null>(
    null
  );
  const [pendingImportedChronicleWatchlists, setPendingImportedChronicleWatchlists] =
    useState<ImportedChronicleWatchlists | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handledChronicleImportUrlRef = useRef(false);
  const { addNotification } = useNotifications();
  const isDev = process.env.NODE_ENV !== "production";
  const pendingChronicleImportSummary = pendingImportedChronicleWatchlists
    ? summarizeImportedChronicleWatchlists(pendingImportedChronicleWatchlists)
    : null;
  const chronicleExportSummary = useMemo(() => {
    if (!chronicleQrEncoded) return null;
    try {
      return summarizeImportedChronicleWatchlists(
        importChronicleWatchlistsFromQrString(chronicleQrEncoded)
      );
    } catch {
      return null;
    }
  }, [chronicleQrEncoded]);

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
    setStalenessDays(readYouthStalenessDays());
    setSeniorStalenessDays(readSeniorStalenessDays());
    setChronicleStalenessDays(readClubChronicleStalenessDays());
    setChronicleTransferHistoryCount(readClubChronicleTransferHistoryCount());
    setChronicleUpdatesHistoryCount(readClubChronicleUpdatesHistoryCount());
    setEnableAppScaling(readGeneralEnableScaling());
    if (process.env.NODE_ENV !== "production") {
      setDebugOauthErrorMode(readChppDebugOauthErrorMode());
      setDebugRandomNewMarkersEnabled(readYouthNewMarkersDebugEnabled());
      setDebugSeniorManagerUserId(readSeniorDebugManagerUserId());
    }
  }, []);

  useEffect(() => {
    if (!chronicleQrExportOpen) return;
    let active = true;
    const build = async () => {
      try {
        const encoded =
          chronicleQrEncoded ??
          exportChronicleWatchlistsToQrString(
            requestChronicleWatchlistsSnapshot()
          );
        const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
        const importBaseUrl = configuredBaseUrl
          ? new URL(window.location.pathname, configuredBaseUrl).toString()
          : `${window.location.origin}${window.location.pathname}`;
        const importUrl = buildChronicleWatchlistsImportUrl(
          encoded,
          importBaseUrl
        );
        const dataUrl = await QRCode.toDataURL(importUrl, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
        });
        if (active) {
          setChronicleQrImageUrl(dataUrl);
        }
      } catch {
        if (active) {
          setChronicleQrImageUrl(null);
          addNotification(messages.settingsChronicleQrExportFailed);
          setChronicleQrExportOpen(false);
        }
      }
    };
    setChronicleQrImageUrl(null);
    void build();
    return () => {
      active = false;
    };
  }, [
    addNotification,
    chronicleQrEncoded,
    chronicleQrExportOpen,
    messages.settingsChronicleQrExportFailed,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (handledChronicleImportUrlRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(CLUB_CHRONICLE_WATCHLISTS_IMPORT_QUERY_PARAM);
    if (!encoded) return;
    handledChronicleImportUrlRef.current = true;
    try {
      const imported = importChronicleWatchlistsFromQrString(encoded);
      setPendingImportedChronicleWatchlists(imported);
      setChronicleQrImportOpen(false);
      setChronicleQrImportWarningOpen(true);
    } catch {
      addNotification(messages.settingsChronicleQrImportFailed);
      params.delete(CLUB_CHRONICLE_WATCHLISTS_IMPORT_QUERY_PARAM);
      const cleanedUrl = new URL(window.location.href);
      cleanedUrl.search = params.toString();
      window.history.replaceState({}, "", cleanedUrl.toString());
    }
  }, [
    addNotification,
    messages.settingsChronicleQrImportFailed,
  ]);

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

  const handleOpenChronicleQrExport = () => {
    try {
      const snapshot = requestChronicleWatchlistsSnapshot();
      setChronicleQrEncoded(exportChronicleWatchlistsToQrString(snapshot));
      setChronicleQrExportOpen(true);
    } catch {
      setChronicleQrEncoded(null);
      addNotification(messages.settingsChronicleQrExportFailed);
    }
  };

  const handleOpenChronicleQrImport = () => {
    setPendingImportedChronicleWatchlists(null);
    setChronicleQrImportOpen(true);
  };

  const clearChronicleImportUrl = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete(CLUB_CHRONICLE_WATCHLISTS_IMPORT_QUERY_PARAM);
    window.history.replaceState({}, "", url.toString());
  };

  const handleConfirmChronicleQrImport = () => {
    if (!pendingImportedChronicleWatchlists || typeof window === "undefined") return;
    try {
      clearChronicleImportUrl();
      applyImportedChronicleWatchlists(pendingImportedChronicleWatchlists);
      const reloadedUrl = new URL(window.location.href);
      reloadedUrl.searchParams.delete(CLUB_CHRONICLE_WATCHLISTS_IMPORT_QUERY_PARAM);
      window.location.replace(reloadedUrl.toString());
    } catch {
      addNotification(messages.settingsChronicleQrImportFailed);
    }
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

  const handleStalenessDaysChange = (value: number) => {
    const nextValue = Math.min(7, Math.max(1, Math.round(value)));
    setStalenessDays(nextValue);
    writeYouthStalenessDays(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(YOUTH_SETTINGS_EVENT, {
          detail: { stalenessDays: nextValue },
        })
      );
    }
  };

  const handleSeniorStalenessDaysChange = (value: number) => {
    const nextValue = Math.min(7, Math.max(1, Math.round(value)));
    setSeniorStalenessDays(nextValue);
    writeSeniorStalenessDays(nextValue);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(SENIOR_SETTINGS_EVENT, {
          detail: { stalenessDays: nextValue },
        })
      );
    }
  };

  const handleAcknowledgeSeniorRatingsWipeWarning = () => {
    if (typeof window !== "undefined") {
      try {
        const rawData = window.localStorage.getItem(SENIOR_DASHBOARD_DATA_STORAGE_KEY);
        if (rawData) {
          const parsed = JSON.parse(rawData) as Record<string, unknown>;
          window.localStorage.setItem(
            SENIOR_DASHBOARD_DATA_STORAGE_KEY,
            JSON.stringify({
              ...parsed,
              ratingsResponse: null,
            })
          );
        }
      } catch {
        // ignore storage parse/write errors
      }
      try {
        const rawState = window.localStorage.getItem(SENIOR_DASHBOARD_STATE_STORAGE_KEY);
        if (rawState) {
          const parsed = JSON.parse(rawState) as Record<string, unknown>;
          window.localStorage.setItem(
            SENIOR_DASHBOARD_STATE_STORAGE_KEY,
            JSON.stringify({
              ...parsed,
              updatesHistory: [],
              selectedUpdatesId: null,
              matrixNewMarkers: {
                playerIds: [],
                ratingsByPlayerId: {},
                skillsCurrentByPlayerId: {},
                skillsMaxByPlayerId: {},
              },
            })
          );
        }
      } catch {
        // ignore storage parse/write errors
      }
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SENIOR_RATINGS_WIPE_EVENT));
    }
    addNotification(messages.notificationSeniorRatingsMatrixWiped);
    setSeniorRatingsWipeWarningOpen(false);
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

  const handleOpenSeniorMlInfo = async () => {
    await backfillSeniorEncounteredPlayerModelFromLocalCache();
    setSeniorMlSummary(getSeniorEncounteredPlayerModelSummary());
    setSeniorMlInfoOpen(true);
  };

  const handleEvaluateSeniorMlModel = async () => {
    setSeniorMlEvaluationOpen(true);
    setSeniorMlEvaluating(true);
    setSeniorMlEvaluation(null);
    try {
      await backfillSeniorEncounteredPlayerModelFromLocalCache();
      setSeniorMlEvaluation(await evaluateSeniorEncounteredPlayerModel());
    } catch {
      addNotification(messages.notificationSeniorMlEvaluationFailed);
    } finally {
      setSeniorMlEvaluating(false);
    }
  };

  const handleDebugRandomNewMarkersToggle = (enabled: boolean) => {
    setDebugRandomNewMarkersEnabled(enabled);
    writeYouthNewMarkersDebugEnabled(enabled);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(YOUTH_NEW_MARKERS_DEBUG_EVENT, {
          detail: { mode: enabled ? "on" : "off" },
        })
      );
    }
  };

  const handleDebugOauthErrorModeChange = (mode: ChppDebugOauthErrorMode) => {
    setDebugOauthErrorMode(mode);
    writeChppDebugOauthErrorMode(mode);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CLUB_CHRONICLE_DEBUG_EVENT, {
          detail: {
            type: "oauth-mode-changed",
            mode,
          },
        })
      );
    }
    addNotification(
      `${messages.notificationDebugOauthMode} ${
        mode === "4xx"
          ? messages.devOauthErrorSim4xx
          : mode === "5xx"
            ? messages.devOauthErrorSim5xx
            : messages.devOauthErrorSimOff
      }`
    );
  };

  const handleFetchYouthSpecialEvents = () => {
    const matchId = Number(debugYouthSeMatchId.trim());
    if (!Number.isFinite(matchId) || matchId <= 0) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(YOUTH_DEBUG_SE_FETCH_EVENT, {
          detail: { matchId: Math.floor(matchId) },
        })
      );
    }
  };

  const handleApplySeniorDebugManagerUserId = () => {
    const normalizedUserId = debugSeniorManagerUserId.trim().replace(/\D+/g, "");
    setDebugSeniorManagerUserId(normalizedUserId);
    writeSeniorDebugManagerUserId(normalizedUserId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(SENIOR_DEBUG_MANAGER_USER_ID_EVENT, {
          detail: {
            userId: normalizedUserId || null,
          },
        })
      );
    }
  };

  const handleOpenBuyCoffeePromptDebug = () => {
    setDebugSettingsOpen(false);
    setOpen(false);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT));
    });
  };

  return (
    <div className={styles.feedbackWrap}>
      {variant === "launcher" ? (
        <button
          type="button"
          className={styles.mobileLauncherUtilityButton}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={messages.settingsTooltip}
          ref={buttonRef}
        >
          <span className={styles.mobileLauncherUtilityIcon} aria-hidden="true">
            ⚙️
          </span>
          <span>{messages.settingsTooltip}</span>
        </button>
      ) : (
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
      )}
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
              setSeniorSettingsOpen(true);
              setOpen(false);
            }}
          >
            {messages.settingsSenior}
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
                  max={7}
                  step={1}
                  value={stalenessDays}
                  className={styles.settingsFieldInput}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    handleStalenessDaysChange(value);
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
        open={seniorSettingsOpen}
        title={messages.settingsSeniorTitle}
        body={
          <div className={styles.settingsModalBody}>
            <Tooltip content={messages.settingsSeniorStalenessHint} fullWidth>
              <label className={styles.settingsField}>
                <span className={styles.settingsFieldLabel}>
                  {messages.settingsSeniorStalenessLabel}
                </span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={seniorStalenessDays}
                  className={styles.settingsFieldInput}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    handleSeniorStalenessDaysChange(value);
                  }}
                />
              </label>
            </Tooltip>
            <div className={styles.settingsField}>
              <span className={styles.settingsFieldLabel}>
                {messages.settingsSeniorRatingsWipeLabel}
              </span>
              <button
                type="button"
                className={styles.settingsDangerButton}
                onClick={() => setSeniorRatingsWipeWarningOpen(true)}
              >
                {messages.settingsSeniorRatingsWipeButton}
              </button>
            </div>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setSeniorSettingsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setSeniorSettingsOpen(false)}
      />
      <Modal
        open={seniorRatingsWipeWarningOpen}
        title={messages.settingsSeniorRatingsWipeWarningTitle}
        body={
          <p>{messages.settingsSeniorRatingsWipeWarningBody}</p>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={handleAcknowledgeSeniorRatingsWipeWarning}
          >
            {messages.settingsSeniorRatingsWipeWarningAcknowledge}
          </button>
        }
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
            <Tooltip
              content={messages.settingsGeneralChronicleWatchlistsExportHint}
              fullWidth
            >
              <button
                type="button"
                className={styles.settingsActionButton}
                onClick={handleOpenChronicleQrExport}
              >
                {messages.settingsGeneralChronicleWatchlistsExportLabel}
              </button>
            </Tooltip>
            {isMobileLauncherVariant ? (
              <Tooltip
                content={messages.settingsGeneralChronicleWatchlistsImportHint}
                fullWidth
              >
                <button
                  type="button"
                  className={styles.settingsActionButton}
                  onClick={handleOpenChronicleQrImport}
                >
                  {messages.settingsGeneralChronicleWatchlistsImportLabel}
                </button>
              </Tooltip>
            ) : null}
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
            {!isMobileLauncherVariant ? (
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
            ) : null}
            {isDev ? (
              <section className={styles.settingsSection}>
                <div className={styles.settingsSectionHeader}>
                  <h3>{messages.settingsMachineLearningTitle}</h3>
                  <p className={styles.muted}>{messages.settingsMachineLearningBody}</p>
                </div>
                <Tooltip content={messages.settingsMachineLearningInfoHint} fullWidth>
                  <button
                    type="button"
                    className={styles.settingsActionButton}
                    onClick={handleOpenSeniorMlInfo}
                  >
                    {messages.settingsMachineLearningInfoLabel}
                  </button>
                </Tooltip>
                <Tooltip content={messages.settingsMachineLearningTestHint} fullWidth>
                  <button
                    type="button"
                    className={styles.settingsActionButton}
                    onClick={handleEvaluateSeniorMlModel}
                    disabled={seniorMlEvaluating}
                  >
                    {seniorMlEvaluating
                      ? messages.settingsMachineLearningTestingLabel
                      : messages.settingsMachineLearningTestLabel}
                  </button>
                </Tooltip>
              </section>
            ) : null}
            <Tooltip content={messages.settingsGeneralExportAllHint} fullWidth>
              <button
                type="button"
                className={styles.settingsActionButton}
                onClick={handleExport}
              >
                {messages.settingsGeneralExportAllLabel}
              </button>
            </Tooltip>
            <Tooltip content={messages.settingsGeneralImportAllHint} fullWidth>
              <button
                type="button"
                className={styles.settingsActionButton}
                onClick={handleImport}
              >
                {messages.settingsGeneralImportAllLabel}
              </button>
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
      {isDev ? (
        <>
          <Modal
            open={seniorMlInfoOpen}
            title={messages.seniorMlInfoTitle}
            body={
              <div className={styles.settingsModalBody}>
                {seniorMlSummary && seniorMlSummary.sampleCount > 0 ? (
                  <div className={styles.settingsInfoGrid}>
                    <span>{messages.seniorMlModelTypeLabel}</span>
                    <strong>{messages.seniorMlModelTypeValue}</strong>
                    <span>{messages.seniorMlSampleCountLabel}</span>
                    <strong>{seniorMlSummary.sampleCount}</strong>
                    <span>{messages.seniorMlDistinctPlayersLabel}</span>
                    <strong>{seniorMlSummary.distinctPlayerCount}</strong>
                    <span>{messages.seniorMlTargetsLabel}</span>
                    <strong>{messages.seniorMlTargetsValue}</strong>
                    <span>{messages.seniorMlLastUpdatedLabel}</span>
                    <strong>
                      {seniorMlSummary.updatedAt
                        ? formatDateTime(seniorMlSummary.updatedAt)
                        : messages.unknownShort}
                    </strong>
                    <span>{messages.seniorMlSourcesLabel}</span>
                    <strong>
                      {messages.seniorMlSourceOwnSenior}:{" "}
                      {seniorMlSummary.sourceCounts.ownSenior}
                      {" · "}
                      {messages.seniorMlSourceSeniorMarket}:{" "}
                      {seniorMlSummary.sourceCounts.seniorTransferMarket}
                      {" · "}
                      {messages.seniorMlSourceYouthMarket}:{" "}
                      {seniorMlSummary.sourceCounts.youthTransferMarket}
                    </strong>
                  </div>
                ) : (
                  <p className={styles.muted}>{messages.seniorMlNoData}</p>
                )}
              </div>
            }
            actions={
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => setSeniorMlInfoOpen(false)}
              >
                {messages.closeLabel}
              </button>
            }
            closeOnBackdrop
            onClose={() => setSeniorMlInfoOpen(false)}
          />
          <Modal
            open={seniorMlEvaluationOpen}
            title={messages.seniorMlEvaluationTitle}
            body={
              <div className={styles.settingsModalBody}>
                {seniorMlEvaluating ? (
                  <p className={styles.muted}>
                    {messages.settingsMachineLearningTestingLabel}
                  </p>
                ) : seniorMlEvaluation && seniorMlEvaluation.testedCount > 0 ? (
                  <div className={styles.settingsInfoGrid}>
                    <span>{messages.seniorMlSampleCountLabel}</span>
                    <strong>{seniorMlEvaluation.sampleCount}</strong>
                    <span>{messages.seniorMlDistinctPlayersLabel}</span>
                    <strong>{seniorMlEvaluation.distinctPlayerCount}</strong>
                    <span>{messages.seniorMlEvaluationTestedCount}</span>
                    <strong>{seniorMlEvaluation.testedCount}</strong>
                    <span>{messages.seniorMlEvaluationTsiMae}</span>
                    <strong>
                      {seniorMlEvaluation.tsiMae !== null
                        ? Math.round(seniorMlEvaluation.tsiMae).toLocaleString()
                        : messages.unknownShort}
                    </strong>
                    <span>{messages.seniorMlEvaluationWageMae}</span>
                    <strong>
                      {seniorMlEvaluation.wageMaeSek !== null
                        ? `€${Math.round(
                            seniorMlEvaluation.wageMaeSek / 10
                          ).toLocaleString()}`
                        : messages.unknownShort}
                    </strong>
                    <span>{messages.seniorMlEvaluationAgeMae}</span>
                    <strong>
                      {seniorMlEvaluation.ageMaeDays !== null
                        ? messages.seniorMlEvaluationAgeDays.replace(
                            "{{days}}",
                            String(Math.round(seniorMlEvaluation.ageMaeDays))
                          )
                        : messages.unknownShort}
                    </strong>
                  </div>
                ) : seniorMlEvaluation ? (
                  <p className={styles.muted}>
                    {messages.seniorMlEvaluationNotReady}
                  </p>
                ) : (
                  <p className={styles.muted}>{messages.seniorMlEvaluationEmpty}</p>
                )}
              </div>
            }
            actions={
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => setSeniorMlEvaluationOpen(false)}
              >
                {messages.closeLabel}
              </button>
            }
            closeOnBackdrop
            onClose={() => setSeniorMlEvaluationOpen(false)}
          />
        </>
      ) : null}
      <Modal
        open={chronicleQrExportOpen}
        title={messages.settingsChronicleQrExportTitle}
        body={
          <div className={styles.settingsModalBody}>
            <p className={styles.muted}>{messages.settingsChronicleQrExportBody}</p>
            {chronicleExportSummary ? (
              <div className={styles.settingsImportWarningStats}>
                <p className={styles.muted}>
                  {messages.settingsChronicleQrExportSummaryTitle}
                </p>
                <span>
                  {messages.settingsChronicleQrImportTabsSummaryLabel}:{" "}
                  {chronicleExportSummary.tabCount}
                </span>
                <span>
                  {messages.settingsChronicleQrImportDirectTeamsSummaryLabel}:{" "}
                  {chronicleExportSummary.directTeamCount}
                </span>
                <span>
                  {messages.settingsChronicleQrImportOwnLeaguesSummaryLabel}:{" "}
                  {chronicleExportSummary.ownLeagueCount}
                </span>
                <span>
                  {messages.settingsChronicleQrImportManualTeamsSummaryLabel}:{" "}
                  {chronicleExportSummary.manualTeamCount}
                </span>
              </div>
            ) : null}
            {chronicleQrImageUrl ? (
              <div className={styles.settingsQrCodeWrap}>
                <Image
                  src={chronicleQrImageUrl}
                  alt={messages.settingsChronicleQrExportTitle}
                  className={styles.settingsQrCodeImage}
                  width={280}
                  height={280}
                  unoptimized
                />
              </div>
            ) : (
              <p className={styles.muted}>{messages.clubChronicleLoading}</p>
            )}
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setChronicleQrExportOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setChronicleQrExportOpen(false)}
      />
      <Modal
        open={chronicleQrImportOpen}
        title={messages.settingsChronicleQrImportTitle}
        body={
          <div className={styles.settingsModalBody}>
            <p className={styles.muted}>{messages.settingsChronicleQrImportBody}</p>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setChronicleQrImportOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setChronicleQrImportOpen(false)}
      />
      <Modal
        open={chronicleQrImportWarningOpen}
        title={messages.settingsChronicleQrImportWarningTitle}
        body={
          <div className={styles.settingsModalBody}>
            <p className={styles.muted}>
              {messages.settingsChronicleQrImportWarningBody}
            </p>
            {pendingChronicleImportSummary ? (
              <div className={styles.settingsImportWarningStats}>
                <span>
                  {messages.settingsChronicleQrImportTabsSummaryLabel}:{" "}
                  {pendingChronicleImportSummary.tabCount}
                </span>
                <span>
                  {messages.settingsChronicleQrImportDirectTeamsSummaryLabel}:{" "}
                  {pendingChronicleImportSummary.directTeamCount}
                </span>
                <span>
                  {messages.settingsChronicleQrImportOwnLeaguesSummaryLabel}:{" "}
                  {pendingChronicleImportSummary.ownLeagueCount}
                </span>
                <span>
                  {messages.settingsChronicleQrImportManualTeamsSummaryLabel}:{" "}
                  {pendingChronicleImportSummary.manualTeamCount}
                </span>
              </div>
            ) : null}
          </div>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={() => {
                clearChronicleImportUrl();
                setChronicleQrImportWarningOpen(false);
              }}
            >
              {messages.closeLabel}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={handleConfirmChronicleQrImport}
            >
              {messages.settingsChronicleQrImportConfirm}
            </button>
          </>
        }
        closeOnBackdrop
        onClose={() => setChronicleQrImportWarningOpen(false)}
      />
      <Modal
        open={debugSettingsOpen}
        title={messages.settingsDebugTitle}
        body={
          <div className={styles.settingsModalBody}>
            <label className={styles.settingsField}>
              <span className={styles.settingsFieldLabel}>
                {messages.devOauthErrorSimLabel}
              </span>
              <select
                className={styles.settingsFieldInput}
                value={debugOauthErrorMode}
                onChange={(event) =>
                  handleDebugOauthErrorModeChange(
                    event.target.value as ChppDebugOauthErrorMode
                  )
                }
              >
                <option value="off">{messages.devOauthErrorSimOff}</option>
                <option value="4xx">{messages.devOauthErrorSim4xx}</option>
                <option value="5xx">{messages.devOauthErrorSim5xx}</option>
              </select>
            </label>
            <p className={styles.muted}>{messages.devOauthErrorSimHint}</p>
            <label className={styles.algorithmsToggle}>
              <span className={styles.algorithmsToggleText}>
                {messages.settingsDebugRandomNewMarkersLabel}
              </span>
              <input
                type="checkbox"
                className={styles.algorithmsToggleInput}
                checked={debugRandomNewMarkersEnabled}
                onChange={(event) =>
                  handleDebugRandomNewMarkersToggle(event.target.checked)
                }
              />
              <span
                className={styles.algorithmsToggleSwitch}
                aria-hidden="true"
              />
            </label>
            <label className={styles.settingsField}>
              <span className={styles.settingsFieldLabel}>
                {messages.devManagerUserIdLabel}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.settingsFieldInput}
                  placeholder={messages.devManagerUserIdPlaceholder}
                  value={debugSeniorManagerUserId}
                  onChange={(event) =>
                    setDebugSeniorManagerUserId(
                      event.target.value.replace(/\D+/g, "")
                    )
                  }
                />
                <button
                  type="button"
                  className={styles.confirmSubmit}
                  onClick={handleApplySeniorDebugManagerUserId}
                >
                  {messages.devManagerLoadTeams}
                </button>
              </div>
            </label>
            <label className={styles.settingsField}>
              <span className={styles.settingsFieldLabel}>
                {messages.debugYouthSeMatchIdLabel}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.settingsFieldInput}
                  value={debugYouthSeMatchId}
                  onChange={(event) => setDebugYouthSeMatchId(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.confirmSubmit}
                  onClick={handleFetchYouthSpecialEvents}
                >
                  {messages.debugYouthSeFetchButton}
                </button>
              </div>
            </label>
            <p className={styles.muted}>{messages.debugYouthSeFetchHint}</p>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={handleOpenBuyCoffeePromptDebug}
            >
              {messages.settingsDebugBuyCoffeePromptButton}
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
