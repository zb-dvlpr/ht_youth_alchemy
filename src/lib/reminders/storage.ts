import {
  REMINDER_DEFAULT_SNOOZE_MS,
  REMINDER_STORAGE_VERSION,
  type DismissedReminderHistoryEntry,
  type ReminderAction,
  type ReminderPreferences,
  type ReminderStorageExport,
  type ReminderStorageState,
  type ReminderSuppressionRecord,
} from "./types";
import {
  isQuotaExceededError,
  runStorageHousekeeping,
} from "@/lib/storageHousekeeping";

export type { ReminderStorageExport } from "./types";

export const REMINDER_STORAGE_KEY = "ya_reminders_state_v1";
export const REMINDER_STORAGE_EVENT = "ya:reminders-state";

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  enabled: true,
  defaultSnoozeDurationMsByRuleId: {},
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNullableString = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

const isOptionalNumber = (value: unknown): value is number | undefined =>
  typeof value === "undefined" || isFiniteNumber(value);

const isOptionalTeamId = (
  value: unknown
): value is number | string | null | undefined =>
  typeof value === "undefined" ||
  value === null ||
  typeof value === "string" ||
  isFiniteNumber(value);

const isReminderScope = (
  value: unknown
): value is ReminderSuppressionRecord["scope"] =>
  value === "senior" ||
  value === "youth" ||
  value === "clubChronicle" ||
  value === "shared";

const compactDismissedReminderHistory = (
  history: DismissedReminderHistoryEntry[]
): DismissedReminderHistoryEntry[] =>
  history.map((entry) => ({
    ...entry,
    payload: undefined,
  }));

export const emptyReminderStorageState = (): ReminderStorageState => ({
  version: REMINDER_STORAGE_VERSION,
  preferences: { ...DEFAULT_REMINDER_PREFERENCES },
  records: {},
  dismissedHistory: [],
});

export const sanitizeReminderPreferences = (
  value: unknown
): ReminderPreferences => {
  if (!isObject(value)) return { ...DEFAULT_REMINDER_PREFERENCES };
  const rawDefaults = isObject(value.defaultSnoozeDurationMsByRuleId)
    ? value.defaultSnoozeDurationMsByRuleId
    : {};
  const defaultSnoozeDurationMsByRuleId: Record<string, number> = {};
  Object.entries(rawDefaults).forEach(([ruleId, duration]) => {
    if (ruleId && isFiniteNumber(duration) && duration > 0) {
      defaultSnoozeDurationMsByRuleId[ruleId] = duration;
    }
  });
  return {
    enabled:
      typeof value.enabled === "boolean"
        ? value.enabled
        : DEFAULT_REMINDER_PREFERENCES.enabled,
    defaultSnoozeDurationMsByRuleId,
  };
};

export const sanitizeReminderRecord = (
  value: unknown
): ReminderSuppressionRecord | null => {
  if (!isObject(value)) return null;
  if (
    typeof value.stableKey !== "string" ||
    !value.stableKey ||
    typeof value.ruleId !== "string" ||
    !value.ruleId ||
    !isFiniteNumber(value.ruleVersion) ||
    !isReminderScope(value.scope) ||
    typeof value.entityType !== "string" ||
    !value.entityType ||
    typeof value.entityId !== "string" ||
    !value.entityId ||
    !isNullableString(value.activeEpisodeKey) ||
    !isNullableString(value.lastEpisodeKey) ||
    !isFiniteNumber(value.firstSeenAt) ||
    !isFiniteNumber(value.lastSeenAt) ||
    !isOptionalTeamId(value.teamId) ||
    !isOptionalNumber(value.dismissedAt) ||
    !isOptionalNumber(value.snoozedUntil) ||
    !isOptionalNumber(value.snoozeDurationMs)
  ) {
    return null;
  }
  const nullableNumberKeys = [
    "lastTriggeredAt",
    "lastEpisodeActiveAt",
    "lastEpisodeClearedAt",
    "suppressionExpiresAt",
  ] as const;
  for (const key of nullableNumberKeys) {
    const item = value[key];
    if (item !== null && !isFiniteNumber(item)) return null;
  }
  return {
    stableKey: value.stableKey,
    ruleId: value.ruleId,
    ruleVersion: value.ruleVersion,
    scope: value.scope as ReminderSuppressionRecord["scope"],
    teamId: value.teamId,
    entityType: value.entityType,
    entityId: value.entityId,
    dismissedAt: value.dismissedAt,
    snoozedUntil: value.snoozedUntil,
    snoozeDurationMs: value.snoozeDurationMs,
    activeEpisodeKey: value.activeEpisodeKey,
    lastEpisodeKey: value.lastEpisodeKey,
    firstSeenAt: value.firstSeenAt,
    lastSeenAt: value.lastSeenAt,
    lastTriggeredAt: value.lastTriggeredAt as number | null,
    lastEpisodeActiveAt: value.lastEpisodeActiveAt as number | null,
    lastEpisodeClearedAt: value.lastEpisodeClearedAt as number | null,
    suppressionExpiresAt: value.suppressionExpiresAt as number | null,
  };
};

const sanitizeReminderAction = (value: unknown): ReminderAction | null => {
  if (!isObject(value) || typeof value.label !== "string") return null;
  if (value.type === "openExternalUrl") {
    const payload = isObject(value.payload) ? value.payload : null;
    if (!payload || typeof payload.url !== "string") return null;
    return {
      type: "openExternalUrl",
      label: value.label,
      payload: {
        url: payload.url,
        playerId: isOptionalNumber(payload.playerId)
          ? payload.playerId
          : undefined,
        youthTeamId: isOptionalNumber(payload.youthTeamId)
          ? payload.youthTeamId
          : undefined,
        teamId: isOptionalNumber(payload.teamId) ? payload.teamId : undefined,
        arenaId: isOptionalNumber(payload.arenaId)
          ? payload.arenaId
          : undefined,
      },
    };
  }
  if (value.type === "app.focusTool") {
    const payload = isObject(value.payload) ? value.payload : null;
    if (
      !payload ||
      (payload.tool !== "senior" &&
        payload.tool !== "youth" &&
        payload.tool !== "chronicle")
    ) {
      return null;
    }
    return {
      type: "app.focusTool",
      label: value.label,
      payload: {
        tool: payload.tool,
        teamId: isOptionalTeamId(payload.teamId) ? payload.teamId : undefined,
        matchId: isOptionalNumber(payload.matchId)
          ? payload.matchId
          : undefined,
        sourceSystem:
          typeof payload.sourceSystem === "string"
            ? payload.sourceSystem
            : undefined,
      },
    };
  }
  if (value.type === "senior.openFindSimilarPlayers") {
    const payload = isObject(value.payload) ? value.payload : null;
    if (!payload || !isFiniteNumber(payload.playerId)) return null;
    return {
      type: "senior.openFindSimilarPlayers",
      label: value.label,
      payload: {
        playerId: payload.playerId,
        teamId: isOptionalNumber(payload.teamId) ? payload.teamId : undefined,
      },
    };
  }
  if (value.type === "youth.openPlayer") {
    const payload = isObject(value.payload) ? value.payload : null;
    if (!payload || !isFiniteNumber(payload.playerId)) return null;
    return {
      type: "youth.openPlayer",
      label: value.label,
      payload: {
        playerId: payload.playerId,
        teamId: isOptionalNumber(payload.teamId) ? payload.teamId : undefined,
      },
    };
  }
  if (value.type === "clubChronicle.openArenaPanel") {
    const payload = isObject(value.payload) ? value.payload : null;
    if (!payload || !isFiniteNumber(payload.teamId)) return null;
    return {
      type: "clubChronicle.openArenaPanel",
      label: value.label,
      payload: { teamId: payload.teamId },
    };
  }
  if (value.type === "openMatch") {
    const payload = isObject(value.payload) ? value.payload : null;
    if (!payload || !isFiniteNumber(payload.matchId)) return null;
    return {
      type: "openMatch",
      label: value.label,
      payload: {
        matchId: payload.matchId,
        sourceSystem:
          typeof payload.sourceSystem === "string"
            ? payload.sourceSystem
            : undefined,
      },
    };
  }
  return null;
};

const sanitizeDismissedReminderHistoryEntry = (
  value: unknown
): DismissedReminderHistoryEntry | null => {
  if (!isObject(value)) return null;
  if (
    typeof value.stableKey !== "string" ||
    !value.stableKey ||
    typeof value.triggerKey !== "string" ||
    !value.triggerKey ||
    typeof value.episodeKey !== "string" ||
    !value.episodeKey ||
    typeof value.ruleId !== "string" ||
    !value.ruleId ||
    !isFiniteNumber(value.ruleVersion) ||
    !isReminderScope(value.scope) ||
    !isFiniteNumber(value.dismissedAt) ||
    (value.dismissedBy !== "dismiss" && value.dismissedBy !== "action") ||
    typeof value.title !== "string" ||
    typeof value.bodyText !== "string"
  ) {
    return null;
  }
  const actions = Array.isArray(value.actions)
    ? value.actions.flatMap((action) => {
        const sanitized = sanitizeReminderAction(action);
        return sanitized ? [sanitized] : [];
      })
    : undefined;
  return {
    stableKey: value.stableKey,
    triggerKey: value.triggerKey,
    episodeKey: value.episodeKey,
    ruleId: value.ruleId,
    ruleVersion: value.ruleVersion,
    scope: value.scope,
    dismissedAt: value.dismissedAt,
    dismissedBy: value.dismissedBy,
    title: value.title,
    bodyText: value.bodyText,
    payload: isObject(value.payload) ? value.payload : undefined,
    actions: actions?.length ? actions : undefined,
  };
};

export const sanitizeDismissedReminderHistory = (
  value: unknown
): DismissedReminderHistoryEntry[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .flatMap((entry) => {
      const sanitized = sanitizeDismissedReminderHistoryEntry(entry);
      return sanitized ? [sanitized] : [];
    })
    .sort((left, right) => right.dismissedAt - left.dismissedAt)
    .filter((entry) => {
      const key = `${entry.stableKey}:${entry.triggerKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
};

export const sanitizeReminderStorageState = (
  value: unknown
): ReminderStorageState => {
  if (!isObject(value) || value.version !== REMINDER_STORAGE_VERSION) {
    return emptyReminderStorageState();
  }
  const records: Record<string, ReminderSuppressionRecord> = {};
  if (isObject(value.records)) {
    Object.entries(value.records).forEach(([key, record]) => {
      const sanitized = sanitizeReminderRecord(record);
      if (sanitized && key === sanitized.stableKey) {
        records[key] = sanitized;
      }
    });
  }
  return {
    version: REMINDER_STORAGE_VERSION,
    preferences: sanitizeReminderPreferences(value.preferences),
    records,
    dismissedHistory: sanitizeDismissedReminderHistory(value.dismissedHistory),
  };
};

export const readReminderStorageState = (): ReminderStorageState => {
  if (typeof window === "undefined") return emptyReminderStorageState();
  try {
    const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) return emptyReminderStorageState();
    return sanitizeReminderStorageState(JSON.parse(raw));
  } catch {
    return emptyReminderStorageState();
  }
};

export const writeReminderStorageState = (state: ReminderStorageState): void => {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeReminderStorageState(state);
  try {
    window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new Event(REMINDER_STORAGE_EVENT));
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Could not write reminder storage state.", error);
      }
      return;
    }
    runStorageHousekeeping();
    try {
      const compactState = {
        ...sanitized,
        dismissedHistory: compactDismissedReminderHistory(
          sanitized.dismissedHistory
        ),
      };
      window.localStorage.setItem(
        REMINDER_STORAGE_KEY,
        JSON.stringify(compactState)
      );
      window.dispatchEvent(new Event(REMINDER_STORAGE_EVENT));
    } catch (retryError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Could not write reminder storage state after housekeeping.",
          retryError
        );
      }
    }
  }
};

export const subscribeReminderStorageState = (
  callback: () => void
): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (event.key === REMINDER_STORAGE_KEY) callback();
  };
  window.addEventListener(REMINDER_STORAGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(REMINDER_STORAGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
};

export const updateReminderPreferences = (
  updater: (preferences: ReminderPreferences) => ReminderPreferences
): ReminderStorageState => {
  const current = readReminderStorageState();
  const next = {
    ...current,
    preferences: sanitizeReminderPreferences(updater(current.preferences)),
  };
  writeReminderStorageState(next);
  return next;
};

export const setRemindersEnabled = (enabled: boolean): ReminderStorageState =>
  updateReminderPreferences((preferences) => ({
    ...preferences,
    enabled,
  }));

export const setDefaultReminderSnoozeDuration = (
  ruleId: string,
  durationMs: number
): ReminderStorageState =>
  updateReminderPreferences((preferences) => ({
    ...preferences,
    defaultSnoozeDurationMsByRuleId: {
      ...preferences.defaultSnoozeDurationMsByRuleId,
      [ruleId]: Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : REMINDER_DEFAULT_SNOOZE_MS,
    },
  }));

export const exportReminderStorageState = (
  state = readReminderStorageState()
): ReminderStorageExport => ({
  version: REMINDER_STORAGE_VERSION,
  exportedAt: Date.now(),
  reminders: {
    preferences: state.preferences,
    records: state.records,
    dismissedHistory: state.dismissedHistory,
  },
});

export const importReminderStorageExport = (
  value: unknown
): ReminderStorageState | null => {
  if (!isObject(value) || value.version !== REMINDER_STORAGE_VERSION) return null;
  if (!isObject(value.reminders)) return null;
  const state = sanitizeReminderStorageState({
    version: REMINDER_STORAGE_VERSION,
    preferences: value.reminders.preferences,
    records: value.reminders.records,
    dismissedHistory: value.reminders.dismissedHistory,
  });
  writeReminderStorageState(state);
  return state;
};

export const pruneReminderStorageState = (
  state: ReminderStorageState,
  now = Date.now(),
  maxAgeMs = 180 * 24 * 60 * 60 * 1000
): ReminderStorageState => {
  const records: Record<string, ReminderSuppressionRecord> = {};
  Object.entries(state.records).forEach(([key, record]) => {
    const newestActivity = Math.max(
      record.lastSeenAt,
      record.lastEpisodeActiveAt ?? 0,
      record.lastEpisodeClearedAt ?? 0,
      record.dismissedAt ?? 0,
      record.snoozedUntil ?? 0
    );
    if (record.activeEpisodeKey || now - newestActivity <= maxAgeMs) {
      records[key] = record;
    }
  });
  return { ...state, records };
};
