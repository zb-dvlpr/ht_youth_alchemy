import styles from "../../page.module.css";
import type { Messages } from "@/lib/i18n";
import {
  hattrickMatchUrlWithSourceSystem,
  hattrickPlayerUrl,
  hattrickYouthMatchUrl,
  hattrickYouthPlayerUrl,
} from "@/lib/hattrick/urls";
import {
  REMINDER_SNOOZE_OPTIONS_MS,
  type ReminderAction,
  type ReminderDisplayItem,
} from "@/lib/reminders/types";

const formatSnoozeDuration = (messages: Messages, durationMs: number) => {
  switch (durationMs) {
    case 6 * 60 * 60 * 1000:
      return messages.reminderSnooze6Hours;
    case 24 * 60 * 60 * 1000:
      return messages.reminderSnooze1Day;
    case 3 * 24 * 60 * 60 * 1000:
      return messages.reminderSnooze3Days;
    case 7 * 24 * 60 * 60 * 1000:
      return messages.reminderSnooze1Week;
    default:
      return messages.reminderSnooze1Day;
  }
};

type ReminderCardProps = {
  item: ReminderDisplayItem;
  messages: Messages;
  onDismiss?: (item: ReminderDisplayItem) => void;
  onSnooze?: (item: ReminderDisplayItem, durationMs: number) => void;
  onAction?: (action: ReminderAction, item: ReminderDisplayItem) => void;
  readonly?: boolean;
  showActions?: boolean;
  showDismissControls?: boolean;
  meta?: string;
};

const renderReminderBody = (item: ReminderDisplayItem, messages: Messages) => {
  const { candidate } = item;
  if (candidate.ruleId !== "senior.player.injury.gte2w") return candidate.body;
  const playerId = Number(candidate.payload?.playerId);
  const playerName =
    typeof candidate.payload?.playerName === "string"
      ? candidate.payload.playerName
      : "";
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
  meta,
}: ReminderCardProps) {
  const { candidate } = item;
  return (
    <article
      className={`${styles.reminderCard} ${styles[`reminderCard_${candidate.severity}`]}`}
    >
      <div className={styles.reminderCardHeader}>
        <span className={styles.reminderScope}>{candidate.scope}</span>
        <strong>{candidate.title}</strong>
      </div>
      {meta ? <span className={styles.muted}>{meta}</span> : null}
      <p>
        {renderYouthPromotionReminderBody(item, messages) ??
          renderMatchReminderBody(item, messages) ??
          renderReminderBody(item, messages)}
      </p>
      {showActions && candidate.actions?.length ? (
        <div className={styles.reminderActionRow}>
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
      {showDismissControls ? (
        <div className={styles.reminderActionRow}>
          <button
            type="button"
            className={styles.confirmCancel}
            onClick={() => onDismiss?.(item)}
          >
            {messages.reminderDismiss}
          </button>
          {REMINDER_SNOOZE_OPTIONS_MS.map((durationMs) => (
            <button
              key={durationMs}
              type="button"
              className={styles.confirmSubmit}
              onClick={() => onSnooze?.(item, durationMs)}
            >
              {messages.reminderSnooze} {formatSnoozeDuration(messages, durationMs)}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
