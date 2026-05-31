import styles from "../../page.module.css";
import type { Messages } from "@/lib/i18n";
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
      <p>{candidate.body}</p>
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
