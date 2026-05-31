export type ReminderScope = "senior" | "youth" | "clubChronicle" | "shared";

export type ReminderSeverity = "info" | "warning" | "critical";

export type ReminderSuppressionExpiry =
  | {
      type: "afterEpisodeClears";
      clearForMs: number;
    }
  | {
      type: "fixedDuration";
      durationMs: number;
    }
  | {
      type: "never";
      reason: string;
    };

export type ReminderAction =
  | {
      type: "senior.openFindSimilarPlayers";
      label: string;
      payload: { teamId?: number; playerId: number };
    }
  | {
      type: "youth.openPlayer";
      label: string;
      payload: { teamId?: number; playerId: number };
    }
  | {
      type: "clubChronicle.openArenaPanel";
      label: string;
      payload: { teamId: number };
    }
  | {
      type: "openMatch";
      label: string;
      payload: { matchId: number; sourceSystem?: string };
    };

export type ReminderCandidate = {
  stableKey: string;
  episodeKey: string;
  triggerKey: string;
  ruleId: string;
  ruleVersion: number;
  scope: ReminderScope;
  teamId?: number | string | null;
  entityType: string;
  entityId: string;
  severity: ReminderSeverity;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  actions?: ReminderAction[];
};

export type ReminderRule<Context = unknown> = {
  ruleId: string;
  version: number;
  scope: ReminderScope;
  suppressionExpiry: ReminderSuppressionExpiry;
  evaluate: (context: Context) => ReminderCandidate[];
};

export type ReminderPreferences = {
  enabled: boolean;
  defaultSnoozeDurationMsByRuleId: Record<string, number>;
};

export type ReminderSuppressionRecord = {
  stableKey: string;
  ruleId: string;
  ruleVersion: number;
  scope: ReminderScope;
  teamId?: number | string | null;
  entityType: string;
  entityId: string;
  dismissedAt?: number;
  snoozedUntil?: number;
  snoozeDurationMs?: number;
  activeEpisodeKey: string | null;
  lastEpisodeKey: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  lastTriggeredAt: number | null;
  lastEpisodeActiveAt: number | null;
  lastEpisodeClearedAt: number | null;
  suppressionExpiresAt: number | null;
};

export type ReminderStorageState = {
  version: 1;
  preferences: ReminderPreferences;
  records: Record<string, ReminderSuppressionRecord>;
};

export type ReminderStorageExport = {
  version: 1;
  exportedAt: number;
  reminders: {
    preferences: ReminderPreferences;
    records: Record<string, ReminderSuppressionRecord>;
  };
};

export type ReminderDisplayItem = {
  candidate: ReminderCandidate;
  record: ReminderSuppressionRecord;
};

export type ReminderEvaluationResult = {
  due: ReminderDisplayItem[];
  snoozed: ReminderDisplayItem[];
  newlyDueToSurface: ReminderDisplayItem[];
  state: ReminderStorageState;
};

export const REMINDER_STORAGE_VERSION = 1;
export const REMINDER_DEFAULT_SNOOZE_MS = 24 * 60 * 60 * 1000;
export const REMINDER_SNOOZE_OPTIONS_MS = [
  6 * 60 * 60 * 1000,
  REMINDER_DEFAULT_SNOOZE_MS,
  3 * REMINDER_DEFAULT_SNOOZE_MS,
  7 * REMINDER_DEFAULT_SNOOZE_MS,
] as const;
