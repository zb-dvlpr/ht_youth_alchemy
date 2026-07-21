import {
  normalizeHattrickSupporterTier,
  type HattrickSupporterTier,
} from "./supporterTier";

export const ALGORITHM_SETTINGS_STORAGE_KEY = "ya_allow_training_until_maxed_out_v1";
export const ALGORITHM_SETTINGS_EVENT = "ya:algorithm-settings";
export const DEFAULT_ALLOW_TRAINING_UNTIL_MAXED_OUT = true;
export const CLUB_CHRONICLE_SETTINGS_STORAGE_KEY = "ya_club_chronicle_settings_v1";
export const CLUB_CHRONICLE_SETTINGS_EVENT = "ya:club-chronicle-settings";
export const CLUB_CHRONICLE_DEBUG_EVENT = "ya:club-chronicle-debug";
export const YOUTH_NEW_MARKERS_DEBUG_EVENT = "ya:youth-new-markers-debug";
export const YOUTH_DEBUG_SE_FETCH_EVENT = "ya:youth-debug-se-fetch";
export const BUY_COFFEE_PROMPT_OPEN_EVENT = "ya:buy-coffee-prompt-open";
export const BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT = "ya:buy-coffee-prompt-debug-open";
export const DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS = 3;
export const DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT = 5;
export const DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT = 10;
export const DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED = false;
export const DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED = false;
export const YOUTH_SETTINGS_STORAGE_KEY = "ya_youth_staleness_days_v1";
export const YOUTH_SETTINGS_STORAGE_KEY_LEGACY = "ya_youth_staleness_hours_v1";
export const YOUTH_SETTINGS_EVENT = "ya:youth-settings";
export const DEFAULT_YOUTH_STALENESS_DAYS = 1;
export const SENIOR_SETTINGS_STORAGE_KEY = "ya_senior_staleness_days_v1";
export const SENIOR_SETTINGS_EVENT = "ya:senior-settings";
export const SENIOR_RATINGS_WIPE_EVENT = "ya:senior-ratings-wipe";
export const SENIOR_LINEUP_ALGORITHM_STORAGE_KEY =
  "ya_senior_lineup_algorithm_v1";
export const DEFAULT_SENIOR_LINEUP_ALGORITHM = "skills";
export const SENIOR_DEBUG_MANAGER_USER_ID_STORAGE_KEY =
  "ya_senior_debug_manager_user_id_v1";
export const SENIOR_DEBUG_MANAGER_USER_ID_EVENT =
  "ya:senior-debug-manager-user-id";
export const DEFAULT_SENIOR_STALENESS_DAYS = 1;
export const DEFAULT_SENIOR_PREDICTED_RATINGS_ENABLED = false;
export const LAST_REFRESH_STORAGE_KEY = "ya_last_refresh_ts_v1";
export const DEBUG_SETTINGS_STORAGE_KEY = "ya_debug_disable_scaling_v1";
export const DEBUG_SETTINGS_EVENT = "ya:debug-settings";
export const DEFAULT_DEBUG_DISABLE_SCALING = false;
export const YOUTH_NEW_MARKERS_DEBUG_STORAGE_KEY =
  "ya_youth_new_markers_debug_v1";
export const DEBUG_SUPPORTER_OVERRIDE_STORAGE_KEY_LEGACY =
  "ya_debug_supporter_override_v1";
export const DEBUG_SUPPORTER_TIER_OVERRIDE_STORAGE_KEY =
  "ya_debug_supporter_tier_override_v1";
export const DEBUG_SUPPORTER_TIER_OVERRIDE_EVENT =
  "ya:debug-supporter-tier-override";
export const DEBUG_TEAM_SPIRIT_STILL_IN_CUP_STORAGE_KEY =
  "ya_debug_team_spirit_still_in_cup_v1";
export const DEBUG_TEAM_SPIRIT_STILL_IN_CUP_EVENT =
  "ya:debug-team-spirit-still-in-cup";
export const DISPLAY_CURRENCY_SETTINGS_STORAGE_KEY = "ya_display_currency_v1";
export const DISPLAY_CURRENCY_SETTINGS_EVENT = "ya:display-currency-settings";

export type SeniorLineupAlgorithm = "skills" | "ratings";

type SeniorSettingsRecord = {
  stalenessDays: number;
  seniorPredictedRatingsEnabled: boolean;
};

export type StoredDisplayCurrencySetting =
  | { mode: "default" }
  | {
      mode: "override";
      countryId?: number;
      countryName?: string;
      currencyName: string;
      currencyRate: number;
    };

const DEFAULT_DISPLAY_CURRENCY_SETTING: StoredDisplayCurrencySetting = {
  mode: "default",
};

const isValidDisplayCurrencyOverride = (
  value: unknown
): value is Extract<StoredDisplayCurrencySetting, { mode: "override" }> => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    mode?: unknown;
    countryId?: unknown;
    countryName?: unknown;
    currencyName?: unknown;
    currencyRate?: unknown;
  };
  return (
    candidate.mode === "override" &&
    typeof candidate.currencyName === "string" &&
    candidate.currencyName.trim().length > 0 &&
    typeof candidate.currencyRate === "number" &&
    Number.isFinite(candidate.currencyRate) &&
    candidate.currencyRate > 0
  );
};

export function readDisplayCurrencySetting(): StoredDisplayCurrencySetting {
  if (typeof window === "undefined") return DEFAULT_DISPLAY_CURRENCY_SETTING;
  try {
    const stored = window.localStorage.getItem(DISPLAY_CURRENCY_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_DISPLAY_CURRENCY_SETTING;
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object") return DEFAULT_DISPLAY_CURRENCY_SETTING;
    if ((parsed as { mode?: unknown }).mode === "default") {
      return DEFAULT_DISPLAY_CURRENCY_SETTING;
    }
    if (isValidDisplayCurrencyOverride(parsed)) {
      const parsedOverride = parsed as Extract<
        StoredDisplayCurrencySetting,
        { mode: "override" }
      >;
      return {
        mode: "override",
        countryId:
          typeof parsedOverride.countryId === "number" &&
          Number.isFinite(parsedOverride.countryId) &&
          parsedOverride.countryId >= 0
            ? parsedOverride.countryId
            : undefined,
        countryName:
          typeof parsedOverride.countryName === "string" &&
          parsedOverride.countryName.trim().length > 0
            ? parsedOverride.countryName.trim()
            : undefined,
        currencyName: parsedOverride.currencyName.trim(),
        currencyRate: parsedOverride.currencyRate,
      };
    }
    return DEFAULT_DISPLAY_CURRENCY_SETTING;
  } catch {
    return DEFAULT_DISPLAY_CURRENCY_SETTING;
  }
}

export function dispatchDisplayCurrencySettingsEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DISPLAY_CURRENCY_SETTINGS_EVENT));
}

export function writeDisplayCurrencySetting(
  setting: StoredDisplayCurrencySetting
): void {
  if (typeof window === "undefined") return;
  try {
    const normalized =
      setting.mode === "override" && isValidDisplayCurrencyOverride(setting)
        ? {
            mode: "override" as const,
            countryId:
              typeof setting.countryId === "number" &&
              Number.isFinite(setting.countryId) &&
              setting.countryId >= 0
                ? setting.countryId
                : undefined,
            countryName:
              typeof setting.countryName === "string" &&
              setting.countryName.trim().length > 0
                ? setting.countryName.trim()
                : undefined,
            currencyName: setting.currencyName.trim(),
            currencyRate: setting.currencyRate,
          }
        : DEFAULT_DISPLAY_CURRENCY_SETTING;
    window.localStorage.setItem(
      DISPLAY_CURRENCY_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // ignore storage errors
  }
  dispatchDisplayCurrencySettingsEvent();
}

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
          ongoingMatchesEnabled?: boolean;
          ongoingMatchesTournamentEnabled?: boolean;
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
        ongoingMatchesEnabled:
          parsed?.ongoingMatchesEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED,
        ongoingMatchesTournamentEnabled:
          parsed?.ongoingMatchesTournamentEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED,
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
          ongoingMatchesEnabled?: boolean;
          ongoingMatchesTournamentEnabled?: boolean;
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
        ongoingMatchesEnabled:
          parsed?.ongoingMatchesEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED,
        ongoingMatchesTournamentEnabled:
          parsed?.ongoingMatchesTournamentEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED,
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
          ongoingMatchesEnabled?: boolean;
          ongoingMatchesTournamentEnabled?: boolean;
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
        ongoingMatchesEnabled:
          parsed?.ongoingMatchesEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED,
        ongoingMatchesTournamentEnabled:
          parsed?.ongoingMatchesTournamentEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED,
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function readClubChronicleOngoingMatchesEnabled(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED;
  }
  try {
    const stored = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED;
    const parsed = JSON.parse(stored) as { ongoingMatchesEnabled?: boolean };
    return parsed?.ongoingMatchesEnabled ?? DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED;
  } catch {
    return DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED;
  }
}

export function readClubChronicleOngoingMatchesTournamentEnabled(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED;
  }
  try {
    const stored = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED;
    const parsed = JSON.parse(stored) as {
      ongoingMatchesTournamentEnabled?: boolean;
    };
    return (
      parsed?.ongoingMatchesTournamentEnabled ??
      DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED
    );
  } catch {
    return DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED;
  }
}

export function writeClubChronicleOngoingMatchesSettings(settings: {
  enabled?: boolean;
  tournamentEnabled?: boolean;
}) {
  if (typeof window === "undefined") return;
  try {
    const existing = window.localStorage.getItem(CLUB_CHRONICLE_SETTINGS_STORAGE_KEY);
    const parsed = existing
      ? (JSON.parse(existing) as {
          stalenessDays?: number;
          transferHistoryCount?: number;
          updatesHistoryCount?: number;
          ongoingMatchesEnabled?: boolean;
          ongoingMatchesTournamentEnabled?: boolean;
        } | null)
      : null;
    const stalenessDays = Number(parsed?.stalenessDays);
    const transferHistoryCount = Number(parsed?.transferHistoryCount);
    const updatesHistoryCount = Number(parsed?.updatesHistoryCount);
    window.localStorage.setItem(
      CLUB_CHRONICLE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        stalenessDays: Number.isFinite(stalenessDays)
          ? Math.min(7, Math.max(1, Math.round(stalenessDays)))
          : DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS,
        transferHistoryCount: Number.isFinite(transferHistoryCount)
          ? Math.min(50, Math.max(1, Math.round(transferHistoryCount)))
          : DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT,
        updatesHistoryCount: Number.isFinite(updatesHistoryCount)
          ? Math.min(50, Math.max(1, Math.round(updatesHistoryCount)))
          : DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT,
        ongoingMatchesEnabled:
          settings.enabled ??
          parsed?.ongoingMatchesEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_ENABLED,
        ongoingMatchesTournamentEnabled:
          settings.tournamentEnabled ??
          parsed?.ongoingMatchesTournamentEnabled ??
          DEFAULT_CLUB_CHRONICLE_ONGOING_MATCHES_TOURNAMENT_ENABLED,
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function readYouthStalenessDays(): number {
  if (typeof window === "undefined") {
    return DEFAULT_YOUTH_STALENESS_DAYS;
  }
  try {
    const stored = window.localStorage.getItem(YOUTH_SETTINGS_STORAGE_KEY);
    if (stored !== null) {
      const value = Number(stored);
      if (!Number.isFinite(value)) {
        return DEFAULT_YOUTH_STALENESS_DAYS;
      }
      return Math.min(7, Math.max(1, Math.round(value)));
    }

    const legacyStored = window.localStorage.getItem(YOUTH_SETTINGS_STORAGE_KEY_LEGACY);
    if (legacyStored === null) {
      return DEFAULT_YOUTH_STALENESS_DAYS;
    }
    const legacyHours = Number(legacyStored);
    if (!Number.isFinite(legacyHours)) {
      return DEFAULT_YOUTH_STALENESS_DAYS;
    }
    return Math.min(7, Math.max(1, Math.ceil(legacyHours / 24)));
  } catch {
    return DEFAULT_YOUTH_STALENESS_DAYS;
  }
}

export function writeYouthStalenessDays(value: number) {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.min(7, Math.max(1, Math.round(value)));
    window.localStorage.setItem(YOUTH_SETTINGS_STORAGE_KEY, String(clamped));
    window.localStorage.removeItem(YOUTH_SETTINGS_STORAGE_KEY_LEGACY);
  } catch {
    // ignore storage errors
  }
}

export function readSeniorStalenessDays(): number {
  if (typeof window === "undefined") {
    return DEFAULT_SENIOR_STALENESS_DAYS;
  }
  try {
    const stored = window.localStorage.getItem(SENIOR_SETTINGS_STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_SENIOR_STALENESS_DAYS;
    }
    if (stored.trim().startsWith("{")) {
      const parsed = JSON.parse(stored) as Partial<SeniorSettingsRecord> | null;
      const value = Number(parsed?.stalenessDays);
      if (!Number.isFinite(value)) {
        return DEFAULT_SENIOR_STALENESS_DAYS;
      }
      return Math.min(7, Math.max(1, Math.round(value)));
    }
    const value = Number(stored);
    if (!Number.isFinite(value)) {
      return DEFAULT_SENIOR_STALENESS_DAYS;
    }
    return Math.min(7, Math.max(1, Math.round(value)));
  } catch {
    return DEFAULT_SENIOR_STALENESS_DAYS;
  }
}

export function readSeniorPredictedRatingsEnabled(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_SENIOR_PREDICTED_RATINGS_ENABLED;
  }
  try {
    const stored = window.localStorage.getItem(SENIOR_SETTINGS_STORAGE_KEY);
    if (stored === null || !stored.trim().startsWith("{")) {
      return DEFAULT_SENIOR_PREDICTED_RATINGS_ENABLED;
    }
    const parsed = JSON.parse(stored) as Partial<SeniorSettingsRecord> | null;
    return parsed?.seniorPredictedRatingsEnabled === true;
  } catch {
    return DEFAULT_SENIOR_PREDICTED_RATINGS_ENABLED;
  }
}

function writeSeniorSettingsRecord(update: Partial<SeniorSettingsRecord>) {
  if (typeof window === "undefined") return;
  try {
    const existing = window.localStorage.getItem(SENIOR_SETTINGS_STORAGE_KEY);
    let current: SeniorSettingsRecord = {
      stalenessDays: DEFAULT_SENIOR_STALENESS_DAYS,
      seniorPredictedRatingsEnabled:
        DEFAULT_SENIOR_PREDICTED_RATINGS_ENABLED,
    };
    if (existing !== null) {
      if (existing.trim().startsWith("{")) {
        const parsed = JSON.parse(existing) as Partial<SeniorSettingsRecord> | null;
        const stalenessDays = Number(parsed?.stalenessDays);
        current = {
          stalenessDays: Number.isFinite(stalenessDays)
            ? Math.min(7, Math.max(1, Math.round(stalenessDays)))
            : DEFAULT_SENIOR_STALENESS_DAYS,
          seniorPredictedRatingsEnabled:
            parsed?.seniorPredictedRatingsEnabled === true,
        };
      } else {
        const legacyStalenessDays = Number(existing);
        current = {
          stalenessDays: Number.isFinite(legacyStalenessDays)
            ? Math.min(7, Math.max(1, Math.round(legacyStalenessDays)))
            : DEFAULT_SENIOR_STALENESS_DAYS,
          seniorPredictedRatingsEnabled:
            DEFAULT_SENIOR_PREDICTED_RATINGS_ENABLED,
        };
      }
    }
    const next: SeniorSettingsRecord = {
      stalenessDays:
        update.stalenessDays === undefined
          ? current.stalenessDays
          : Math.min(7, Math.max(1, Math.round(update.stalenessDays))),
      seniorPredictedRatingsEnabled:
        update.seniorPredictedRatingsEnabled === undefined
          ? current.seniorPredictedRatingsEnabled
          : update.seniorPredictedRatingsEnabled === true,
    };
    window.localStorage.setItem(
      SENIOR_SETTINGS_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch {
    // ignore storage errors
  }
}

export function writeSeniorStalenessDays(value: number) {
  if (typeof window === "undefined") return;
  writeSeniorSettingsRecord({ stalenessDays: value });
}

export function writeSeniorPredictedRatingsEnabled(value: boolean) {
  if (typeof window === "undefined") return;
  writeSeniorSettingsRecord({ seniorPredictedRatingsEnabled: value === true });
}

export function readSeniorLineupAlgorithm(): SeniorLineupAlgorithm {
  if (typeof window === "undefined") return DEFAULT_SENIOR_LINEUP_ALGORITHM;
  try {
    const stored = window.localStorage.getItem(
      SENIOR_LINEUP_ALGORITHM_STORAGE_KEY
    );
    return stored === "ratings" ? "ratings" : "skills";
  } catch {
    return DEFAULT_SENIOR_LINEUP_ALGORITHM;
  }
}

export function writeSeniorLineupAlgorithm(value: SeniorLineupAlgorithm): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SENIOR_LINEUP_ALGORITHM_STORAGE_KEY,
      value === "ratings" ? "ratings" : "skills"
    );
  } catch {
    // ignore storage errors
  }
}

export function readSeniorDebugManagerUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const stored = window.localStorage.getItem(
      SENIOR_DEBUG_MANAGER_USER_ID_STORAGE_KEY
    );
    return typeof stored === "string" ? stored.trim() : "";
  } catch {
    return "";
  }
}

export function writeSeniorDebugManagerUserId(value: string) {
  if (typeof window === "undefined") return;
  try {
    const normalized = value.trim();
    if (normalized) {
      window.localStorage.setItem(
        SENIOR_DEBUG_MANAGER_USER_ID_STORAGE_KEY,
        normalized
      );
      return;
    }
    window.localStorage.removeItem(SENIOR_DEBUG_MANAGER_USER_ID_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function readLastRefreshTimestamp(
  storageKey = LAST_REFRESH_STORAGE_KEY
): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return null;
    const value = Number(stored);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastRefreshTimestamp(
  value: number,
  storageKey = LAST_REFRESH_STORAGE_KEY
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, String(value));
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

export function readYouthNewMarkersDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(YOUTH_NEW_MARKERS_DEBUG_STORAGE_KEY);
    if (stored === null) return false;
    return stored === "true";
  } catch {
    return false;
  }
}

export function writeYouthNewMarkersDebugEnabled(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      YOUTH_NEW_MARKERS_DEBUG_STORAGE_KEY,
      value ? "true" : "false"
    );
  } catch {
    // ignore storage errors
  }
}

export function readDebugSupporterTierOverride(): HattrickSupporterTier {
  if (typeof window === "undefined") return "none";
  try {
    const stored = window.localStorage.getItem(
      DEBUG_SUPPORTER_TIER_OVERRIDE_STORAGE_KEY
    );
    if (stored !== null) {
      const normalizedTier = normalizeHattrickSupporterTier(stored);
      if (normalizedTier) return normalizedTier;
      window.localStorage.setItem(
        DEBUG_SUPPORTER_TIER_OVERRIDE_STORAGE_KEY,
        "none"
      );
      return "none";
    }

    const legacyStored = window.localStorage.getItem(
      DEBUG_SUPPORTER_OVERRIDE_STORAGE_KEY_LEGACY
    );
    const migratedTier: HattrickSupporterTier =
      legacyStored === "true" ? "gold" : "none";
    window.localStorage.setItem(
      DEBUG_SUPPORTER_TIER_OVERRIDE_STORAGE_KEY,
      migratedTier
    );
    window.localStorage.removeItem(DEBUG_SUPPORTER_OVERRIDE_STORAGE_KEY_LEGACY);
    return migratedTier;
  } catch {
    return "none";
  }
}

export function writeDebugSupporterTierOverride(
  tier: HattrickSupporterTier
): void {
  if (typeof window === "undefined") return;
  const normalizedTier = normalizeHattrickSupporterTier(tier) ?? "none";
  try {
    window.localStorage.setItem(
      DEBUG_SUPPORTER_TIER_OVERRIDE_STORAGE_KEY,
      normalizedTier
    );
    window.localStorage.removeItem(DEBUG_SUPPORTER_OVERRIDE_STORAGE_KEY_LEGACY);
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent(DEBUG_SUPPORTER_TIER_OVERRIDE_EVENT, {
      detail: { tier: normalizedTier },
    })
  );
}

export function readDebugTeamSpiritStillInCup(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(
        DEBUG_TEAM_SPIRIT_STILL_IN_CUP_STORAGE_KEY
      ) === "true"
    );
  } catch {
    return false;
  }
}

export function writeDebugTeamSpiritStillInCup(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DEBUG_TEAM_SPIRIT_STILL_IN_CUP_STORAGE_KEY,
      value ? "true" : "false"
    );
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent(DEBUG_TEAM_SPIRIT_STILL_IN_CUP_EVENT, {
      detail: { enabled: value },
    })
  );
}
