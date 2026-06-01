import {
  REMINDER_DEFAULT_SNOOZE_MS,
  type ReminderCandidate,
  type ReminderDisplayItem,
  type ReminderEvaluationResult,
  type ReminderRule,
  type ReminderScope,
  type ReminderStorageState,
  type ReminderSuppressionExpiry,
  type ReminderSuppressionRecord,
} from "./types";
import {
  emptyReminderStorageState,
  pruneReminderStorageState,
  setDefaultReminderSnoozeDuration,
  writeReminderStorageState,
} from "./storage";

const VALID_SCOPES: ReminderScope[] = [
  "senior",
  "youth",
  "clubChronicle",
  "shared",
];

const isValidExpiry = (expiry: ReminderSuppressionExpiry | undefined) => {
  if (!expiry) return false;
  if (expiry.type === "afterEpisodeClears") {
    return Number.isFinite(expiry.clearForMs) && expiry.clearForMs >= 0;
  }
  if (expiry.type === "fixedDuration") {
    return Number.isFinite(expiry.durationMs) && expiry.durationMs > 0;
  }
  if (expiry.type === "never") {
    return typeof expiry.reason === "string" && expiry.reason.trim().length > 0;
  }
  if (expiry.type === "candidateDuration") return true;
  return false;
};

const isSuppressionExpired = (
  record: ReminderSuppressionRecord,
  expiry: ReminderSuppressionExpiry,
  now: number
) => {
  if (!record.dismissedAt) return false;
  if (typeof record.suppressionExpiresAt === "number") {
    if (
      expiry.type === "candidateDuration" &&
      record.activeEpisodeKey &&
      !(
        typeof record.lastEpisodeClearedAt === "number" &&
        record.lastEpisodeClearedAt > record.dismissedAt
      )
    ) {
      return false;
    }
    return now >= record.suppressionExpiresAt;
  }
  if (expiry.type === "fixedDuration") {
    return now >= record.dismissedAt + expiry.durationMs;
  }
  if (expiry.type === "afterEpisodeClears") {
    if (record.activeEpisodeKey) return false;
    if (!record.lastEpisodeClearedAt) return false;
    return now >= record.lastEpisodeClearedAt + expiry.clearForMs;
  }
  return false;
};

export const validateReminderRule = (rule: ReminderRule): void => {
  if (!rule.ruleId) throw new Error("Reminder ruleId is required.");
  if (!Number.isFinite(rule.version) || rule.version <= 0) {
    throw new Error(`Reminder rule ${rule.ruleId} must have a positive version.`);
  }
  if (!VALID_SCOPES.includes(rule.scope)) {
    throw new Error(`Reminder rule ${rule.ruleId} has an invalid scope.`);
  }
  if (!isValidExpiry(rule.suppressionExpiry)) {
    throw new Error(`Reminder rule ${rule.ruleId} must define a valid expiry policy.`);
  }
};

export const validateReminderCandidate = (
  rule: ReminderRule,
  candidate: ReminderCandidate
): void => {
  if (!candidate.stableKey) throw new Error("Reminder stableKey is required.");
  if (!candidate.episodeKey) throw new Error("Reminder episodeKey is required.");
  if (!candidate.triggerKey) throw new Error("Reminder triggerKey is required.");
  if (candidate.ruleId !== rule.ruleId) {
    throw new Error(`Reminder candidate ${candidate.stableKey} rule mismatch.`);
  }
  if (candidate.ruleVersion !== rule.version) {
    throw new Error(`Reminder candidate ${candidate.stableKey} version mismatch.`);
  }
  if (candidate.scope !== rule.scope) {
    throw new Error(`Reminder candidate ${candidate.stableKey} scope mismatch.`);
  }
  if (!candidate.entityType || !candidate.entityId) {
    throw new Error(`Reminder candidate ${candidate.stableKey} needs an entity.`);
  }
  if (
    candidate.dismissalExpiryDurationMs !== undefined &&
    (!Number.isFinite(candidate.dismissalExpiryDurationMs) ||
      candidate.dismissalExpiryDurationMs <= 0)
  ) {
    throw new Error(
      `Reminder candidate ${candidate.stableKey} has an invalid dismissal expiry duration.`
    );
  }
  if (
    candidate.expiresAt !== undefined &&
    (!Number.isFinite(candidate.expiresAt) || candidate.expiresAt <= 0)
  ) {
    throw new Error(`Reminder candidate ${candidate.stableKey} has an invalid expiry.`);
  }
};

export const evaluateReminderRules = <Context>(
  rules: ReminderRule<Context>[],
  context: Context
): ReminderCandidate[] => {
  const seen = new Set<string>();
  return rules.flatMap((rule) => {
    validateReminderRule(rule as ReminderRule);
    const candidates = rule.evaluate(context) ?? [];
    candidates.forEach((candidate) => {
      validateReminderCandidate(rule as ReminderRule, candidate);
      const duplicateKey = `${candidate.stableKey}:${candidate.triggerKey}`;
      if (seen.has(duplicateKey)) {
        throw new Error(`Duplicate reminder candidate ${duplicateKey}.`);
      }
      seen.add(duplicateKey);
    });
    return candidates;
  });
};

const createRecord = (
  candidate: ReminderCandidate,
  now: number
): ReminderSuppressionRecord => ({
  stableKey: candidate.stableKey,
  ruleId: candidate.ruleId,
  ruleVersion: candidate.ruleVersion,
  scope: candidate.scope,
  teamId: candidate.teamId,
  entityType: candidate.entityType,
  entityId: candidate.entityId,
  activeEpisodeKey: candidate.episodeKey,
  lastEpisodeKey: candidate.episodeKey,
  firstSeenAt: now,
  lastSeenAt: now,
  lastTriggeredAt: now,
  lastEpisodeActiveAt: now,
  lastEpisodeClearedAt: null,
  suppressionExpiresAt: null,
});

const updateActiveRecord = (
  record: ReminderSuppressionRecord,
  candidate: ReminderCandidate,
  now: number
): ReminderSuppressionRecord => ({
  ...record,
  ruleId: candidate.ruleId,
  ruleVersion: candidate.ruleVersion,
  scope: candidate.scope,
  teamId: candidate.teamId,
  entityType: candidate.entityType,
  entityId: candidate.entityId,
  activeEpisodeKey: candidate.episodeKey,
  lastEpisodeKey: candidate.episodeKey,
  lastSeenAt: now,
  lastTriggeredAt: now,
  lastEpisodeActiveAt: now,
  lastEpisodeClearedAt:
    record.activeEpisodeKey === candidate.episodeKey
      ? record.lastEpisodeClearedAt
      : record.activeEpisodeKey === null
      ? record.lastEpisodeClearedAt
      : null,
});

const suppressRecordIfExpired = (
  record: ReminderSuppressionRecord,
  rule: ReminderRule | undefined,
  now: number
) => {
  if (!record.dismissedAt || !rule || record.ruleVersion !== rule.version) {
    return record;
  }
  if (!isSuppressionExpired(record, rule.suppressionExpiry, now)) return record;
  return {
    ...record,
    dismissedAt: undefined,
    suppressionExpiresAt: null,
  };
};

export const resolveReminderEvaluation = ({
  candidates,
  rules,
  state,
  now,
  surfacedTriggerKeysThisSession,
  activeEpisodes,
}: {
  candidates: ReminderCandidate[];
  rules: ReminderRule[];
  state: ReminderStorageState;
  now: number;
  surfacedTriggerKeysThisSession: Set<string>;
  activeEpisodes?: Array<{ stableKey: string; episodeKey: string }>;
}): ReminderEvaluationResult => {
  if (!state.preferences.enabled) {
    return {
      due: [],
      snoozed: [],
      newlyDueToSurface: [],
      state,
    };
  }

  const ruleById = new Map(rules.map((rule) => [rule.ruleId, rule]));
  const activeEpisodeByStableKey = new Map<string, string>();
  candidates.forEach((candidate) => {
    activeEpisodeByStableKey.set(candidate.stableKey, candidate.episodeKey);
  });
  activeEpisodes?.forEach((episode) => {
    if (episode.stableKey && episode.episodeKey) {
      activeEpisodeByStableKey.set(episode.stableKey, episode.episodeKey);
    }
  });
  const records: ReminderStorageState["records"] = { ...state.records };

  Object.entries(records).forEach(([key, record]) => {
    const activeEpisodeKey = activeEpisodeByStableKey.get(key);
    if (activeEpisodeKey) {
      records[key] = {
        ...record,
        activeEpisodeKey,
        lastEpisodeKey: activeEpisodeKey,
        lastEpisodeActiveAt: now,
        lastEpisodeClearedAt:
          record.activeEpisodeKey === activeEpisodeKey
            ? record.lastEpisodeClearedAt
            : record.activeEpisodeKey === null
            ? record.lastEpisodeClearedAt
            : null,
      };
      return;
    }
    if (record.activeEpisodeKey !== null) {
      records[key] = {
        ...record,
        activeEpisodeKey: null,
        lastEpisodeClearedAt: record.lastEpisodeClearedAt ?? now,
      };
    }
  });

  const due: ReminderDisplayItem[] = [];
  const snoozed: ReminderDisplayItem[] = [];
  const newlyDueToSurface: ReminderDisplayItem[] = [];

  candidates
    .filter(
      (candidate) =>
        candidate.expiresAt === undefined || candidate.expiresAt > now
    )
    .forEach((candidate) => {
    const rule = ruleById.get(candidate.ruleId);
    const existing = records[candidate.stableKey];
    const baseRecord =
      existing && existing.ruleVersion === candidate.ruleVersion
        ? updateActiveRecord(existing, candidate, now)
        : createRecord(candidate, now);
    const record = suppressRecordIfExpired(baseRecord, rule, now);
    records[candidate.stableKey] = record;

    const dismissed = Boolean(record.dismissedAt);
    const isSnoozed =
      typeof record.snoozedUntil === "number" && record.snoozedUntil > now;
    const item = { candidate, record };
    if (dismissed) return;
    if (isSnoozed) {
      snoozed.push(item);
      return;
    }
    due.push(item);
    if (!surfacedTriggerKeysThisSession.has(candidate.triggerKey)) {
      newlyDueToSurface.push(item);
    }
  });

  const nextState = pruneReminderStorageState({ ...state, records }, now);
  return {
    due,
    snoozed,
    newlyDueToSurface,
    state: nextState,
  };
};

export const dismissReminder = (
  candidate: ReminderCandidate,
  state: ReminderStorageState,
  rule: ReminderRule | undefined,
  now = Date.now()
): ReminderStorageState => {
  if (!rule) return state;
  validateReminderRule(rule);
  const current = state.records[candidate.stableKey] ?? createRecord(candidate, now);
  const suppressionExpiresAt =
    typeof candidate.dismissalExpiryDurationMs === "number"
      ? now + candidate.dismissalExpiryDurationMs
      : rule.suppressionExpiry.type === "fixedDuration"
      ? now + rule.suppressionExpiry.durationMs
      : null;
  const next = {
    ...state,
    records: {
      ...state.records,
      [candidate.stableKey]: {
        ...current,
        dismissedAt: now,
        snoozedUntil: undefined,
        suppressionExpiresAt,
      },
    },
  };
  writeReminderStorageState(next);
  return next;
};

export const snoozeReminder = (
  candidate: ReminderCandidate,
  state: ReminderStorageState,
  durationMs: number,
  now = Date.now()
): ReminderStorageState => {
  const safeDuration =
    Number.isFinite(durationMs) && durationMs > 0
      ? durationMs
      : REMINDER_DEFAULT_SNOOZE_MS;
  const current = state.records[candidate.stableKey] ?? createRecord(candidate, now);
  const next = {
    ...state,
    records: {
      ...state.records,
      [candidate.stableKey]: {
        ...current,
        snoozedUntil: now + safeDuration,
        snoozeDurationMs: safeDuration,
      },
    },
  };
  writeReminderStorageState(next);
  setDefaultReminderSnoozeDuration(candidate.ruleId, safeDuration);
  return next;
};

export const evaluateEmptyReminderState = (): ReminderEvaluationResult => ({
  due: [],
  snoozed: [],
  newlyDueToSurface: [],
  state: emptyReminderStorageState(),
});
