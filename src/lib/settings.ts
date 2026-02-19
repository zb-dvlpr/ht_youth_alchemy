export const ALGORITHM_SETTINGS_STORAGE_KEY = "ya_allow_training_until_maxed_out_v1";
export const ALGORITHM_SETTINGS_EVENT = "ya:algorithm-settings";
export const DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT = true;
export const CLUB_CHRONICLE_SETTINGS_STORAGE_KEY = "ya_club_chronicle_settings_v1";
export const CLUB_CHRONICLE_SETTINGS_EVENT = "ya:club-chronicle-settings";
export const CLUB_CHRONICLE_DEBUG_EVENT = "ya:club-chronicle-debug";
export const DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS = 3;
export const DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT = 5;
export const DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT = 10;
export const YOUTH_SETTINGS_STORAGE_KEY = "ya_youth_staleness_hours_v1";
export const YOUTH_SETTINGS_EVENT = "ya:youth-settings";
export const DEFAULT_YOUTH_STALENESS_HOURS = 3;
export const LAST_REFRESH_STORAGE_KEY = "ya_last_refresh_ts_v1";
export const DEBUG_SETTINGS_STORAGE_KEY = "ya_debug_disable_scaling_v1";
export const DEBUG_SETTINGS_EVENT = "ya:debug-settings";
export const DEFAULT_DEBUG_DISABLE_SCALING = false;
export const GENERAL_SETTINGS_STORAGE_KEY = "ya_general_enable_scaling_v1";
export const GENERAL_SETTINGS_EVENT = "ya:general-settings";
export const DEFAULT_GENERAL_ENABLE_SCALING = false;

export function readAllowTrainingUntilMaxedOut(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT;
  }
  try {
    const stored = window.localStorage.getItem(ALGORITHM_SETTINGS_STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT;
    }
    return stored === "true";
  } catch {
    return DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT;
  }
}

export function writeAllowTrainingUntilMaxedOut(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ALGORITHM_SETTINGS_STORAGE_KEY,
      value ? "true" : "false"
    );
  } catch {
    // ignore storage errors
  }
}

export function readClubChronicleStalenessDays(): number {
  if (typeof window === "undefined") {
    return DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS;
  }
  try {
    const stored = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS;
    const parsed = JSON.parse(stored) as { stalenessDays?: number };
    const value = parsed?.stalenessDays ?? DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS;
    if (!Number.isFinite(value)) return DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS;
    return Math.min(7, Math.max(1, Math.round(value)));
  } catch {
    return DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS;
  }
}

export function writeClubChronicleStalenessDays(value: number) {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.min(7, Math.max(1, Math.round(value)));
    const existing = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    const parsed = existing
      ? (JSON.parse(existing) as {
          transferHistoryCount?: number;
          updatesHistoryCount?: number;
        } | null)
      : null;
    const transferHistoryCount = Number(parsed?.transferHistoryCount);
    const updatesHistoryCount = Number(parsed?.updatesHistoryCount);
    const nextTransferHistoryCount = Number.isFinite(transferHistoryCount)
      ? Math.min(50, Math.max(1, Math.round(transferHistoryCount)))
      : DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT;
    const nextUpdatesHistoryCount = Number.isFinite(updatesHistoryCount)
      ? Math.min(50, Math.max(1, Math.round(updatesHistoryCount)))
      : DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT;
    window.localStorage.setItem(
      CLUB_CHRONICLE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        stalenessDays: clamped,
        transferHistoryCount: nextTransferHistoryCount,
        updatesHistoryCount: nextUpdatesHistoryCount,
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function readClubChronicleTransferHistoryCount(): number {
  if (typeof window === "undefined") {
    return DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT;
  }
  try {
    const stored = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT;
    const parsed = JSON.parse(stored) as { transferHistoryCount?: number };
    const value =
      parsed?.transferHistoryCount ??
      DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT;
    if (!Number.isFinite(value)) return DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT;
    return Math.min(50, Math.max(1, Math.round(value)));
  } catch {
    return DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT;
  }
}

export function writeClubChronicleTransferHistoryCount(value: number) {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.min(50, Math.max(1, Math.round(value)));
    const existing = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    const parsed = existing
      ? (JSON.parse(existing) as {
          stalenessDays?: number;
          updatesHistoryCount?: number;
        } | null)
      : null;
    const stalenessDays = Number(parsed?.stalenessDays);
    const updatesHistoryCount = Number(parsed?.updatesHistoryCount);
    const nextStalenessDays = Number.isFinite(stalenessDays)
      ? Math.min(7, Math.max(1, Math.round(stalenessDays)))
      : DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS;
    const nextUpdatesHistoryCount = Number.isFinite(updatesHistoryCount)
      ? Math.min(50, Math.max(1, Math.round(updatesHistoryCount)))
      : DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT;
    window.localStorage.setItem(
      CLUB_CHRONICLE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        stalenessDays: nextStalenessDays,
        transferHistoryCount: clamped,
        updatesHistoryCount: nextUpdatesHistoryCount,
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function readClubChronicleUpdatesHistoryCount(): number {
  if (typeof window === "undefined") {
    return DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT;
  }
  try {
    const stored = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT;
    const parsed = JSON.parse(stored) as { updatesHistoryCount?: number };
    const value =
      parsed?.updatesHistoryCount ??
      DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT;
    if (!Number.isFinite(value)) return DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT;
    return Math.min(50, Math.max(1, Math.round(value)));
  } catch {
    return DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT;
  }
}

export function writeClubChronicleUpdatesHistoryCount(value: number) {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.min(50, Math.max(1, Math.round(value)));
    const existing = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    const parsed = existing
      ? (JSON.parse(existing) as {
          stalenessDays?: number;
          transferHistoryCount?: number;
        } | null)
      : null;
    const stalenessDays = Number(parsed?.stalenessDays);
    const transferHistoryCount = Number(parsed?.transferHistoryCount);
    const nextStalenessDays = Number.isFinite(stalenessDays)
      ? Math.min(7, Math.max(1, Math.round(stalenessDays)))
      : DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS;
    const nextTransferHistoryCount = Number.isFinite(transferHistoryCount)
      ? Math.min(50, Math.max(1, Math.round(transferHistoryCount)))
      : DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT;
    window.localStorage.setItem(
      CLUB_CHRONICLE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        stalenessDays: nextStalenessDays,
        transferHistoryCount: nextTransferHistoryCount,
        updatesHistoryCount: clamped,
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function readYouthStalenessHours(): number {
  if (typeof window === "undefined") {
    return DEFAULT_YOUTH_STALENESS_HOURS;
  }
  try {
    const stored = window.localStorage.getItem(YOUTH_SETTINGS_STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_YOUTH_STALENESS_HOURS;
    }
    const value = Number(stored);
    if (!Number.isFinite(value)) {
      return DEFAULT_YOUTH_STALENESS_HOURS;
    }
    return Math.min(24, Math.max(1, Math.round(value)));
  } catch {
    return DEFAULT_YOUTH_STALENESS_HOURS;
  }
}

export function writeYouthStalenessHours(value: number) {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.min(24, Math.max(1, Math.round(value)));
    window.localStorage.setItem(YOUTH_SETTINGS_STORAGE_KEY, String(clamped));
  } catch {
    // ignore storage errors
  }
}

export function readLastRefreshTimestamp(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LAST_REFRESH_STORAGE_KEY);
    if (!stored) return null;
    const value = Number(stored);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastRefreshTimestamp(value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_REFRESH_STORAGE_KEY, String(value));
  } catch {
    // ignore storage errors
  }
}

export function readDebugDisableScaling(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_DEBUG_DISABLE_SCALING;
  }
  try {
    const stored = window.localStorage.getItem(DEBUG_SETTINGS_STORAGE_KEY);
    if (stored === null) return DEFAULT_DEBUG_DISABLE_SCALING;
    return stored === "true";
  } catch {
    return DEFAULT_DEBUG_DISABLE_SCALING;
  }
}

export function writeDebugDisableScaling(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DEBUG_SETTINGS_STORAGE_KEY,
      value ? "true" : "false"
    );
  } catch {
    // ignore storage errors
  }
}

export function readGeneralEnableScaling(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_GENERAL_ENABLE_SCALING;
  }
  try {
    const stored = window.localStorage.getItem(GENERAL_SETTINGS_STORAGE_KEY);
    if (stored === null) return DEFAULT_GENERAL_ENABLE_SCALING;
    return stored === "true";
  } catch {
    return DEFAULT_GENERAL_ENABLE_SCALING;
  }
}

export function writeGeneralEnableScaling(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GENERAL_SETTINGS_STORAGE_KEY,
      value ? "true" : "false"
    );
  } catch {
    // ignore storage errors
  }
}
