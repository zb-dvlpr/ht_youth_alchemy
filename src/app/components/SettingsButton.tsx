"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { useNotifications } from "./notifications/NotificationsProvider";
import Modal from "./Modal";
import AppLicenseModal from "./AppLicenseModal";
import AppLicenseDetails from "./AppLicenseDetails";
import QRCode from "qrcode";
import {
  dispatchAnalyticsConsentChange,
  readAnalyticsConsent,
  subscribeAnalyticsConsentChange,
  writeAnalyticsConsent,
  type AnalyticsConsent,
} from "@/lib/analyticsConsent";
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
import {
  clearAppLicenseState,
  deactivateAppLicense,
  dispatchAppLicenseLimitExceededEvent,
  dispatchAppLicenseRevokedEvent,
  fetchStoredAppLicenseDetails,
  hasActiveAppLicenseState,
  isPremiumLicensingEnabled,
  readAppLicenseState,
} from "@/lib/license";
import type { LemonSqueezyLicenseDetails } from "@/lib/lemonsqueezyLicense";
import {
  exportReminderStorageState,
  importReminderStorageExport,
  readReminderStorageState,
  setRemindersEnabled,
  subscribeReminderStorageState,
  type ReminderStorageExport,
} from "@/lib/reminders/storage";
import {
  collectLocalStorageDiagnostics,
  collectStorageDiagnostics,
  type LocalStorageDiagnostics,
  type StorageDiagnostics,
} from "@/lib/storageDiagnostics";

type SettingsButtonProps = {
  messages: Messages;
  variant?: "icon" | "launcher";
};

type ExportPayload = {
  version: number;
  exportedAt: string;
  entries: Record<string, string>;
  reminders?: ReminderStorageExport;
};

const STORAGE_PREFIX = "ya_";

type ImportedChronicleWatchlists = ReturnType<
  typeof importChronicleWatchlistsFromQrString
>;

export default function SettingsButton({
  messages,
  variant = "icon",
}: SettingsButtonProps) {
  const premiumLicensingEnabled = isPremiumLicensingEnabled();
  const isMobileLauncherVariant = variant === "launcher";
  const [open, setOpen] = useState(false);
  const [youthSettingsOpen, setYouthSettingsOpen] = useState(false);
  const [seniorSettingsOpen, setSeniorSettingsOpen] = useState(false);
  const [chronicleSettingsOpen, setChronicleSettingsOpen] = useState(false);
  const [generalSettingsOpen, setGeneralSettingsOpen] = useState(false);
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
  const [licenseSettingsOpen, setLicenseSettingsOpen] = useState(false);
  const [licenseEntryOpen, setLicenseEntryOpen] = useState(false);
  const [licenseEntryNonce, setLicenseEntryNonce] = useState(0);
  const [licenseDetails, setLicenseDetails] =
    useState<LemonSqueezyLicenseDetails | null>(null);
  const [licenseDetailsLoading, setLicenseDetailsLoading] = useState(false);
  const [licenseDetailsUnavailable, setLicenseDetailsUnavailable] = useState(false);
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
  const [storageDiagnosticsOpen, setStorageDiagnosticsOpen] = useState(false);
  const [storageDiagnosticsLoading, setStorageDiagnosticsLoading] =
    useState(false);
  const [storageDiagnostics, setStorageDiagnostics] =
    useState<StorageDiagnostics | null>(null);
  const [storageManagementOpen, setStorageManagementOpen] = useState(false);
  const [storageManagementLoading, setStorageManagementLoading] =
    useState(false);
  const [storageManagement, setStorageManagement] =
    useState<LocalStorageDiagnostics | null>(null);
  const [pendingStorageWipeKey, setPendingStorageWipeKey] = useState<string | null>(
    null
  );
  const [storageWipePending, setStorageWipePending] = useState(false);
  const [pendingStorageWipeAll, setPendingStorageWipeAll] = useState(false);
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
  const [remindersEnabled, setRemindersEnabledState] = useState(true);
  const [analyticsConsent, setAnalyticsConsent] =
    useState<AnalyticsConsent | null>(null);
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
  const hasStoredActiveLicense = premiumLicensingEnabled
    ? hasActiveAppLicenseState(readAppLicenseState())
    : false;

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
    setRemindersEnabledState(readReminderStorageState().preferences.enabled);
    setAnalyticsConsent(readAnalyticsConsent());
    if (process.env.NODE_ENV !== "production") {
      setDebugOauthErrorMode(readChppDebugOauthErrorMode());
      setDebugRandomNewMarkersEnabled(readYouthNewMarkersDebugEnabled());
      setDebugSeniorManagerUserId(readSeniorDebugManagerUserId());
    }
  }, []);

  useEffect(() => {
    const syncReminders = () => {
      setRemindersEnabledState(readReminderStorageState().preferences.enabled);
    };
    syncReminders();
    return subscribeReminderStorageState(syncReminders);
  }, []);

  useEffect(() => {
    const syncAnalyticsConsent = () => {
      setAnalyticsConsent(readAnalyticsConsent());
    };
    syncAnalyticsConsent();
    return subscribeAnalyticsConsentChange(syncAnalyticsConsent);
  }, []);

  useEffect(() => {
    if (!premiumLicensingEnabled) return;
    if (!licenseSettingsOpen) return;
    const currentState = readAppLicenseState();
    const hasActiveLicense = hasActiveAppLicenseState(currentState);
    if (!hasActiveLicense) {
      setLicenseDetails(null);
      setLicenseDetailsLoading(false);
      setLicenseDetailsUnavailable(false);
      return;
    }
    let active = true;
    setLicenseDetailsLoading(true);
    setLicenseDetailsUnavailable(false);
    void (async () => {
      const result = await fetchStoredAppLicenseDetails();
      if (!active) return;
      if (result.transientFailure) {
        setLicenseDetails(null);
        setLicenseDetailsUnavailable(true);
        setLicenseDetailsLoading(false);
        return;
      }
      if (result.exceededActivationLimit) {
        clearAppLicenseState();
        dispatchAppLicenseLimitExceededEvent(result.details);
        setLicenseDetails(null);
        setLicenseDetailsUnavailable(false);
        setLicenseDetailsLoading(false);
        setLicenseSettingsOpen(false);
        return;
      }
      if (!result.valid || !result.details) {
        clearAppLicenseState();
        setLicenseDetails(null);
        setLicenseDetailsUnavailable(false);
        setLicenseDetailsLoading(false);
        return;
      }
      setLicenseDetails(result.details);
      setLicenseDetailsUnavailable(false);
      setLicenseDetailsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [licenseSettingsOpen, premiumLicensingEnabled]);

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
        reminders: exportReminderStorageState(),
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
        if (parsed.reminders) {
          importReminderStorageExport(parsed.reminders);
        }
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

  const handleRemindersEnabledToggle = (nextValue: boolean) => {
    setRemindersEnabledState(nextValue);
    setRemindersEnabled(nextValue);
  };

  const handleAnalyticsConsentChange = (nextConsent: AnalyticsConsent) => {
    setAnalyticsConsent(nextConsent);
    writeAnalyticsConsent(nextConsent);
    dispatchAnalyticsConsentChange();
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

  const refreshStorageDiagnostics = async () => {
    if (!isDev) return;
    setStorageDiagnosticsLoading(true);
    try {
      setStorageDiagnostics(await collectStorageDiagnostics());
    } catch {
      setStorageDiagnostics({
        originUsageBytes: null,
        originQuotaBytes: null,
        originUsageFormatted: null,
        originQuotaFormatted: null,
        originUsagePct: null,
        localStorageBytes: null,
        localStorageFormatted: null,
        localStorageKeys: [],
        error: messages.settingsDebugStorageError,
      });
    } finally {
      setStorageDiagnosticsLoading(false);
    }
  };

  const handleOpenStorageDiagnostics = () => {
    if (!isDev) return;
    setDebugSettingsOpen(false);
    setStorageDiagnosticsOpen(true);
    setStorageDiagnostics(null);
    void refreshStorageDiagnostics();
  };

  const refreshStorageManagement = () => {
    setStorageManagementLoading(true);
    try {
      setStorageManagement(collectLocalStorageDiagnostics());
    } catch {
      setStorageManagement({
        localStorageBytes: null,
        localStorageFormatted: null,
        localStorageKeys: [],
        error: messages.settingsStorageManagementReadError,
      });
    } finally {
      setStorageManagementLoading(false);
    }
  };

  const handleOpenStorageManagement = () => {
    setGeneralSettingsOpen(false);
    setStorageManagementOpen(true);
    setStorageManagement(null);
    refreshStorageManagement();
  };

  const handleConfirmStorageWipe = () => {
    const key = pendingStorageWipeKey;
    if (!key || typeof window === "undefined") return;
    setStorageWipePending(true);
    try {
      window.localStorage.removeItem(key);
      setPendingStorageWipeKey(null);
      refreshStorageManagement();
      addNotification(
        messages.settingsStorageManagementWipeSuccess.replace("{{key}}", key)
      );
    } catch {
      addNotification(
        messages.settingsStorageManagementWipeError.replace("{{key}}", key)
      );
    } finally {
      setStorageWipePending(false);
    }
  };

  const handleConfirmStorageWipeAll = () => {
    if (typeof window === "undefined") return;
    const keysToRemove =
      storageManagement?.localStorageKeys.map((row) => row.key) ?? [];
    if (keysToRemove.length === 0) {
      setPendingStorageWipeAll(false);
      return;
    }

    setStorageWipePending(true);
    try {
      keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      setPendingStorageWipeAll(false);
      refreshStorageManagement();
      addNotification(messages.settingsStorageManagementWipeAllSuccess);
    } catch {
      addNotification(messages.settingsStorageManagementWipeAllError);
    } finally {
      setStorageWipePending(false);
    }
  };

  const handleOpenLicenseEntry = () => {
    setLicenseSettingsOpen(false);
    setLicenseEntryNonce((prev) => prev + 1);
    setLicenseEntryOpen(true);
  };

  const handleRevokeLicense = async () => {
    const licenseState = readAppLicenseState();
    const licenseKey = licenseState.licenseKey.trim();
    const instanceId = licenseState.instanceId.trim();
    if (!licenseKey || !instanceId) {
      clearAppLicenseState();
      dispatchAppLicenseRevokedEvent(null);
      setLicenseSettingsOpen(false);
      return;
    }
    const result = await deactivateAppLicense(licenseKey, instanceId);
    if (!result.deactivated) {
      addNotification(messages.settingsLicenseRevokePending);
      return;
    }
    clearAppLicenseState();
    dispatchAppLicenseRevokedEvent(result.details);
    setLicenseSettingsOpen(false);
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
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={() => {
              setReminderSettingsOpen(true);
              setOpen(false);
            }}
          >
            {messages.settingsReminders}
          </button>
          {premiumLicensingEnabled ? (
            <button
              type="button"
              className={styles.feedbackLink}
              onClick={() => {
                setLicenseSettingsOpen(true);
                setOpen(false);
              }}
            >
              {messages.settingsLicense}
            </button>
          ) : null}
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
      {premiumLicensingEnabled ? (
        <>
          <Modal
            open={licenseSettingsOpen}
            title={messages.settingsLicenseTitle}
            className={styles.licenseModal}
            body={
              <div className={styles.settingsModalBody}>
                <p className={styles.muted}>{messages.settingsLicenseBody}</p>
                {licenseDetailsLoading ? (
                  <p className={styles.muted}>{messages.settingsLicenseLoading}</p>
                ) : licenseDetails ? (
                  <AppLicenseDetails details={licenseDetails} messages={messages} />
                ) : licenseDetailsUnavailable ? (
                  <p className={styles.watchlistPremiumHint}>
                    {messages.clubChroniclePremiumLicenseValidationUnavailable}
                  </p>
                ) : (
                  <p className={styles.muted}>{messages.settingsLicenseNoActive}</p>
                )}
                <button
                  type="button"
                  className={styles.settingsActionButton}
                  onClick={handleOpenLicenseEntry}
                >
                  {messages.settingsLicenseBuyButton}
                </button>
                <button
                  type="button"
                  className={styles.settingsDangerButton}
                  onClick={() => {
                    void handleRevokeLicense();
                  }}
                  disabled={
                    licenseDetailsLoading ||
                    (!hasStoredActiveLicense && !licenseDetailsUnavailable)
                  }
                >
                  {messages.settingsLicenseRevokeButton}
                </button>
              </div>
            }
            actions={
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => setLicenseSettingsOpen(false)}
              >
                {messages.closeLabel}
              </button>
            }
            closeOnBackdrop
            onClose={() => setLicenseSettingsOpen(false)}
          />
          <AppLicenseModal
            key={licenseEntryNonce}
            open={licenseEntryOpen}
            messages={messages}
            onClose={() => setLicenseEntryOpen(false)}
          />
        </>
      ) : null}
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
            <section className={styles.settingsSection}>
              <div className={styles.settingsSectionHeader}>
                <h3>{messages.settingsAnalyticsConsentTitle}</h3>
                <p className={styles.muted}>
                  {messages.settingsAnalyticsConsentDescription}
                </p>
              </div>
              <p className={styles.muted}>
                {analyticsConsent === "granted"
                  ? messages.settingsAnalyticsConsentStatusGranted
                  : analyticsConsent === "denied"
                    ? messages.settingsAnalyticsConsentStatusDenied
                    : messages.settingsAnalyticsConsentStatusUnset}
              </p>
              <div className={styles.settingsChoiceRow}>
                <button
                  type="button"
                  className={styles.settingsActionButton}
                  onClick={() => handleAnalyticsConsentChange("denied")}
                  disabled={analyticsConsent === "denied"}
                >
                  {messages.settingsAnalyticsConsentDenyButton}
                </button>
                <button
                  type="button"
                  className={styles.settingsActionButton}
                  onClick={() => handleAnalyticsConsentChange("granted")}
                  disabled={analyticsConsent === "granted"}
                >
                  {messages.settingsAnalyticsConsentGrantButton}
                </button>
              </div>
            </section>
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
            <button
              type="button"
              className={styles.settingsActionButton}
              onClick={handleOpenStorageManagement}
            >
              {messages.settingsStorageManagementButton}
            </button>
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
        open={storageManagementOpen}
        title={messages.settingsStorageManagementTitle}
        body={
          <div className={styles.settingsModalBody}>
            {storageManagementLoading ? (
              <p className={styles.muted}>
                {messages.settingsDebugStorageLoading}
              </p>
            ) : null}
            {storageManagement ? (
              <>
                <section className={styles.storageDiagnosticsSection}>
                  <p className={styles.storageDiagnosticsValue}>
                    {messages.settingsStorageManagementTotalUsed.replace(
                      "{{size}}",
                      storageManagement.localStorageFormatted ??
                        messages.unknownShort
                    )}
                  </p>
                  {storageManagement.error ? (
                    <p className={styles.errorText}>
                      {messages.settingsStorageManagementReadError}
                    </p>
                  ) : null}
                </section>
                {storageManagement.localStorageKeys.length > 0 ? (
                  <>
                    <div className={styles.storageDiagnosticsTableWrap}>
                      <table className={styles.storageDiagnosticsTable}>
                        <thead>
                          <tr>
                            <th>{messages.settingsStorageManagementKeyColumn}</th>
                            <th>{messages.settingsStorageManagementUsageColumn}</th>
                            <th>{messages.settingsStorageManagementActionColumn}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {storageManagement.localStorageKeys.map((row) => (
                            <tr key={row.key}>
                              <td title={row.key}>{row.key}</td>
                              <td>{row.formatted}</td>
                              <td>
                                <button
                                  type="button"
                                  className={styles.settingsDangerButton}
                                  onClick={() => setPendingStorageWipeKey(row.key)}
                                  aria-label={`${messages.settingsStorageManagementWipeButton}: ${row.key}`}
                                >
                                  {messages.settingsStorageManagementWipeButton}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      className={styles.settingsDangerButton}
                      onClick={() => setPendingStorageWipeAll(true)}
                      disabled={storageManagementLoading || storageWipePending}
                    >
                      {messages.settingsStorageManagementWipeAllButton}
                    </button>
                  </>
                ) : storageManagement.localStorageBytes !== null ? (
                  <p className={styles.muted}>
                    {messages.settingsStorageManagementNoKeys}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={() => setStorageManagementOpen(false)}
            >
              {messages.closeLabel}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={refreshStorageManagement}
              disabled={storageManagementLoading}
            >
              {messages.settingsDebugStorageRefreshButton}
            </button>
          </>
        }
        closeOnBackdrop
        onClose={() => setStorageManagementOpen(false)}
      />
      <Modal
        open={pendingStorageWipeKey !== null}
        title={messages.settingsStorageManagementWipeConfirmTitle}
        body={
          <div className={styles.settingsModalBody}>
            <p className={styles.muted}>
              {messages.settingsStorageManagementWipeConfirmBody.replace(
                "{{key}}",
                pendingStorageWipeKey ?? ""
              )}
            </p>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={() => setPendingStorageWipeKey(null)}
              disabled={storageWipePending}
            >
              {messages.confirmCancel}
            </button>
            <button
              type="button"
              className={styles.settingsDangerButton}
              onClick={handleConfirmStorageWipe}
              disabled={storageWipePending}
            >
              {messages.settingsStorageManagementWipeButton}
            </button>
          </>
        }
        closeOnBackdrop
        onClose={() => {
          if (storageWipePending) return;
          setPendingStorageWipeKey(null);
        }}
      />
      <Modal
        open={pendingStorageWipeAll}
        title={messages.settingsStorageManagementWipeAllConfirmTitle}
        body={
          <div className={styles.settingsModalBody}>
            <p className={styles.muted}>
              {messages.settingsStorageManagementWipeAllConfirmBody}
            </p>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={() => setPendingStorageWipeAll(false)}
              disabled={storageWipePending}
            >
              {messages.confirmCancel}
            </button>
            <button
              type="button"
              className={styles.settingsDangerButton}
              onClick={handleConfirmStorageWipeAll}
              disabled={storageWipePending}
            >
              {messages.settingsStorageManagementWipeAllButton}
            </button>
          </>
        }
        closeOnBackdrop
        onClose={() => {
          if (storageWipePending) return;
          setPendingStorageWipeAll(false);
        }}
      />
      <Modal
        open={reminderSettingsOpen}
        title={messages.settingsRemindersTitle}
        body={
          <div className={styles.settingsModalBody}>
            <label className={styles.algorithmsToggle}>
              <span className={styles.algorithmsToggleText}>
                {messages.settingsRemindersEnableLabel}
              </span>
              <input
                type="checkbox"
                className={styles.algorithmsToggleInput}
                checked={remindersEnabled}
                onChange={(event) =>
                  handleRemindersEnabledToggle(event.target.checked)
                }
              />
              <span className={styles.algorithmsToggleSwitch} aria-hidden="true" />
            </label>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setReminderSettingsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        onClose={() => setReminderSettingsOpen(false)}
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
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={handleOpenStorageDiagnostics}
            >
              {messages.settingsDebugStorageButton}
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
      {isDev ? (
        <Modal
          open={storageDiagnosticsOpen}
          title={messages.settingsDebugStorageTitle}
          body={
            <div className={styles.settingsModalBody}>
              {storageDiagnosticsLoading ? (
                <p className={styles.muted}>
                  {messages.settingsDebugStorageLoading}
                </p>
              ) : null}
              {storageDiagnostics ? (
                <>
                  <section className={styles.storageDiagnosticsSection}>
                    <h3 className={styles.storageDiagnosticsHeading}>
                      {messages.settingsDebugStorageOriginEstimateLabel}
                    </h3>
                    {storageDiagnostics.originUsageFormatted &&
                    storageDiagnostics.originQuotaFormatted ? (
                      <p className={styles.storageDiagnosticsValue}>
                        {storageDiagnostics.originUsageFormatted} /{" "}
                        {storageDiagnostics.originQuotaFormatted} (
                        {storageDiagnostics.originUsagePct !== null
                          ? `${storageDiagnostics.originUsagePct.toFixed(1)}%`
                          : messages.unknownShort}
                        )
                      </p>
                    ) : (
                      <p className={styles.muted}>
                        {messages.settingsDebugStorageOriginUnavailable}
                      </p>
                    )}
                  </section>
                  <section className={styles.storageDiagnosticsSection}>
                    <h3 className={styles.storageDiagnosticsHeading}>
                      {messages.settingsDebugStorageLocalStorageApproxLabel}
                    </h3>
                    <p className={styles.storageDiagnosticsValue}>
                      {storageDiagnostics.localStorageFormatted ??
                        messages.unknownShort}
                    </p>
                    {storageDiagnostics.error ? (
                      <p className={styles.errorText}>
                        {messages.settingsDebugStorageError}
                      </p>
                    ) : null}
                    {storageDiagnostics.localStorageKeys.length > 0 ? (
                      <div className={styles.storageDiagnosticsTableWrap}>
                        <table className={styles.storageDiagnosticsTable}>
                          <thead>
                            <tr>
                              <th>
                                {messages.settingsDebugStorageBreakdownKeyColumn}
                              </th>
                              <th>
                                {
                                  messages.settingsDebugStorageBreakdownUsageColumn
                                }
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {storageDiagnostics.localStorageKeys.map((row) => (
                              <tr key={row.key}>
                                <td title={row.key}>{row.key}</td>
                                <td>{row.formatted}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : storageDiagnostics.localStorageBytes !== null ? (
                      <p className={styles.muted}>
                        {messages.settingsDebugStorageNoLocalStorageKeys}
                      </p>
                    ) : null}
                  </section>
                </>
              ) : null}
            </div>
          }
          actions={
            <>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={() => setStorageDiagnosticsOpen(false)}
              >
                {messages.closeLabel}
              </button>
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => void refreshStorageDiagnostics()}
                disabled={storageDiagnosticsLoading}
              >
                {messages.settingsDebugStorageRefreshButton}
              </button>
            </>
          }
          closeOnBackdrop
          onClose={() => setStorageDiagnosticsOpen(false)}
        />
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
