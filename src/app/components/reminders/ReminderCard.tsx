import styles from "../../page.module.css";
import type { Messages } from "@/lib/i18n";
import { hattrickPlayerUrl } from "@/lib/hattrick/urls";
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

export default function ReminderCard({
  item,
  messages,
  onDismiss,
  onSnooze,
  onAction,
  readonly = false,
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
      <p>{renderReminderBody(item, messages)}</p>
      {candidate.actions?.length ? (
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
      {!readonly ? (
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
