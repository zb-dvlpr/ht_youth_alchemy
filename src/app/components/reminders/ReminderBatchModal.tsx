import Modal from "../Modal";
import styles from "../../page.module.css";
import type { Messages } from "@/lib/i18n";
import type { ReminderAction, ReminderDisplayItem } from "@/lib/reminders/types";
import ReminderCard from "./ReminderCard";

type ReminderBatchModalProps = {
  open: boolean;
  messages: Messages;
  reminders: ReminderDisplayItem[];
  onClose: () => void;
  onDismiss: (item: ReminderDisplayItem) => void;
  onSnooze: (item: ReminderDisplayItem, durationMs: number) => void;
  onAction: (action: ReminderAction, item: ReminderDisplayItem) => void;
  onTurnOff: () => void;
  defaultSnoozeDurationMsByRuleId?: Record<string, number>;
};

export default function ReminderBatchModal({
  open,
  messages,
  reminders,
  onClose,
  onDismiss,
  onSnooze,
  onAction,
  onTurnOff,
  defaultSnoozeDurationMsByRuleId = {},
}: ReminderBatchModalProps) {
  return (
    <Modal
      open={open}
      title={messages.remindersTitle}
      className={styles.remindersModal}
      movable={false}
      body={
        <div className={styles.reminderModalBody}>
          {reminders.length ? (
            reminders.map((item) => (
              <ReminderCard
                key={item.candidate.stableKey}
                item={item}
                messages={messages}
                onDismiss={onDismiss}
                onSnooze={onSnooze}
                onAction={onAction}
                defaultSnoozeDurationMs={
                  defaultSnoozeDurationMsByRuleId[item.candidate.ruleId]
                }
              />
            ))
          ) : (
            <p className={styles.muted}>{messages.reminderNoDue}</p>
          )}
        </div>
      }
      actions={
        <>
          <button
            type="button"
            className={styles.confirmCancel}
            onClick={onTurnOff}
          >
            {messages.reminderTurnOff}
          </button>
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={onClose}
          >
            {messages.closeLabel}
          </button>
        </>
      }
      onClose={onClose}
    />
  );
}
