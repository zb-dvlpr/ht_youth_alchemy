import { useState } from "react";
import styles from "../../page.module.css";
import type { Messages } from "@/lib/i18n";
import {
  hattrickMatchUrlWithSourceSystem,
  hattrickPlayerUrl,
  hattrickYouthMatchUrl,
  hattrickYouthPlayerUrl,
} from "@/lib/hattrick/urls";
import {
  REMINDER_DEFAULT_SNOOZE_MS,
  REMINDER_SNOOZE_DAY_OPTIONS,
  type ReminderAction,
  type ReminderDisplayItem,
} from "@/lib/reminders/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeSnoozeDays = (durationMs: number | undefined) => {
  if (!Number.isFinite(durationMs) || !durationMs) return 1;
  const dayCount = Math.round(durationMs / DAY_MS);
  return Math.min(5, Math.max(1, dayCount));
};

const formatSnoozeDayOption = (messages: Messages, days: number) =>
  (days === 1
    ? messages.remindersSnoozeDurationDay
    : messages.remindersSnoozeDurationDays
  ).replace("{{count}}", String(days));

type ReminderCardProps = {
  item: ReminderDisplayItem;
  messages: Messages;
  onDismiss?: (item: ReminderDisplayItem) => void;
  onSnooze?: (item: ReminderDisplayItem, durationMs: number) => void;
  onAction?: (action: ReminderAction, item: ReminderDisplayItem) => void;
  readonly?: boolean;
  showActions?: boolean;
  showDismissControls?: boolean;
  defaultSnoozeDurationMs?: number;
  meta?: string;
};

const renderReminderBody = (item: ReminderDisplayItem, messages: Messages) => {
  const { candidate } = item;
  if (
    candidate.ruleId !== "senior.player.injury.gte2w" &&
    candidate.ruleId !== "senior.player.salaryIncrease.gt100kSek"
  ) {
    return candidate.body;
  }
  const playerId = Number(candidate.payload?.playerId);
  const playerName =
    typeof candidate.payload?.playerName === "string"
      ? candidate.payload.playerName
      : "";
  if (candidate.ruleId === "senior.player.salaryIncrease.gt100kSek") {
    const previousSalary =
      typeof candidate.payload?.previousSalary === "string"
        ? candidate.payload.previousSalary
        : "";
    const currentSalary =
      typeof candidate.payload?.currentSalary === "string"
        ? candidate.payload.currentSalary
        : "";
    if (
      !Number.isFinite(playerId) ||
      !playerName ||
      !previousSalary ||
      !currentSalary
    ) {
      return candidate.body;
    }
    const template = messages.reminderSeniorSalaryIncreaseBody
      .replace("{{previousSalary}}", previousSalary)
      .replace("{{currentSalary}}", currentSalary);
    const [before, after] = template.split("{{playerName}}");
    return (
      <>
        {before}
        <a href={hattrickPlayerUrl(playerId)} target="_blank" rel="noreferrer">
          {playerName}
        </a>
        {after}
      </>
    );
  }
  const injuryWeeks = Number(candidate.payload?.injuryWeeks);
  if (!Number.isFinite(playerId) || !playerName || !Number.isFinite(injuryWeeks)) {
    return candidate.body;
  }
  const template = messages.reminderSeniorInjuryBody.replace(
    "{{weeks}}",
    String(injuryWeeks)
  );
  const [before, after] = template.split("{{playerName}}");
  return (
    <>
      {before}
      <a href={hattrickPlayerUrl(playerId)} target="_blank" rel="noreferrer">
        {playerName}
      </a>
      {after}
    </>
  );
};

const renderMatchReminderBody = (
  item: ReminderDisplayItem,
  messages: Messages
) => {
  const { candidate } = item;
  if (
    candidate.ruleId !== "senior.match.lineupMissingWithin48h" &&
    candidate.ruleId !== "youth.match.lineupMissingWithin48h"
  ) {
    return null;
  }
  const scope = candidate.payload?.scope;
  const matchId = Number(candidate.payload?.matchId);
  const teamId = Number(candidate.payload?.teamId);
  const sourceSystem =
    typeof candidate.payload?.sourceSystem === "string"
      ? candidate.payload.sourceSystem
      : "Hattrick";
  const matchName =
    typeof candidate.payload?.matchName === "string"
      ? candidate.payload.matchName
      : "";
  const timeRemaining =
    typeof candidate.payload?.timeRemaining === "string"
      ? candidate.payload.timeRemaining
      : "";
  if (
    (scope !== "senior" && scope !== "youth") ||
    !Number.isFinite(matchId) ||
    !Number.isFinite(teamId) ||
    !matchName ||
    !timeRemaining
  ) {
    return candidate.body;
  }
  const href =
    scope === "youth"
      ? hattrickYouthMatchUrl(matchId, teamId, teamId)
      : hattrickMatchUrlWithSourceSystem(matchId, sourceSystem);
  const template = messages.reminderMatchLineupMissingBody.replace(
    "{{timeRemaining}}",
    timeRemaining
  );
  const [before, after] = template.split("{{matchName}}");
  return (
    <>
      {before}
      <a href={href} target="_blank" rel="noreferrer">
        {matchName}
      </a>
      {after}
    </>
  );
};

const renderYouthPromotionReminderBody = (
  item: ReminderDisplayItem,
  messages: Messages
) => {
  const { candidate } = item;
  if (candidate.ruleId !== "youth.player.canBePromoted.within48h") {
    return null;
  }
  const playerId = Number(candidate.payload?.playerId);
  const playerName =
    typeof candidate.payload?.playerName === "string"
      ? candidate.payload.playerName
      : "";
  const timeRemaining =
    typeof candidate.payload?.timeRemaining === "string"
      ? candidate.payload.timeRemaining
      : "";
  if (!Number.isFinite(playerId) || !playerName || !timeRemaining) {
    return candidate.body;
  }
  const template = messages.reminderYouthPromotionBody.replace(
    "{{timeRemaining}}",
    timeRemaining
  );
  const [before, after] = template.split("{{playerName}}");
  return (
    <>
      {before}
      <a href={hattrickYouthPlayerUrl(playerId)} target="_blank" rel="noreferrer">
        {playerName}
      </a>
      {after}
    </>
  );
};

export default function ReminderCard({
  item,
  messages,
  onDismiss,
  onSnooze,
  onAction,
  readonly = false,
  showActions = true,
  showDismissControls = !readonly,
  defaultSnoozeDurationMs = REMINDER_DEFAULT_SNOOZE_MS,
  meta,
}: ReminderCardProps) {
  const { candidate } = item;
  const [selectedSnoozeDays, setSelectedSnoozeDays] = useState(() =>
    normalizeSnoozeDays(defaultSnoozeDurationMs)
  );
  return (
    <article
      className={`${styles.reminderCard} ${styles[`reminderCard_${candidate.severity}`]}`}
    >
      <div className={styles.reminderCardHeader}>
        <span className={styles.reminderScope}>{candidate.scope}</span>
        <strong>{candidate.title}</strong>
      </div>
      {meta ? <span className={styles.muted}>{meta}</span> : null}
      <div className={styles.reminderContentRow}>
        <p className={styles.reminderBody}>
          {renderYouthPromotionReminderBody(item, messages) ??
            renderMatchReminderBody(item, messages) ??
            renderReminderBody(item, messages)}
        </p>
        {showActions && candidate.actions?.length ? (
          <div className={styles.reminderPrimaryActions}>
            {candidate.actions.map((action, index) => (
              <button
                key={`${action.type}-${index}`}
                type="button"
                className={styles.settingsActionButton}
                onClick={() => onAction?.(action, item)}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {showDismissControls ? (
        <div className={styles.reminderManagementControls}>
          <div className={styles.reminderSnoozeControl}>
            <label
              className={styles.reminderSnoozeLabel}
              htmlFor={`snooze-${candidate.stableKey}`}
            >
              {messages.remindersSnoozeForLabel}
            </label>
            <select
              id={`snooze-${candidate.stableKey}`}
              className={styles.reminderSnoozeSelect}
              value={selectedSnoozeDays}
              onChange={(event) =>
                setSelectedSnoozeDays(Number(event.target.value))
              }
            >
              {REMINDER_SNOOZE_DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {formatSnoozeDayOption(messages, days)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={() => onSnooze?.(item, selectedSnoozeDays * DAY_MS)}
            >
              {messages.remindersSnoozeButtonLabel}
            </button>
          </div>
          <button
            type="button"
            className={`${styles.confirmCancel} ${styles.reminderDismissButton}`}
            onClick={() => onDismiss?.(item)}
          >
            {messages.reminderDismiss}
          </button>
        </div>
      ) : null}
    </article>
  );
}
