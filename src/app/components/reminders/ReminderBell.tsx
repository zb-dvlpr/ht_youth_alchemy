import { useEffect, useRef, useState } from "react";
import styles from "../../page.module.css";
import type { Messages } from "@/lib/i18n";
import { formatDateTime } from "@/lib/datetime";
import type {
  DismissedReminderHistoryEntry,
  ReminderAction,
  ReminderDisplayItem,
} from "@/lib/reminders/types";
import ReminderCard from "./ReminderCard";
import Tooltip from "../Tooltip";

type ReminderBellProps = {
  messages: Messages;
  enabled: boolean;
  due: ReminderDisplayItem[];
  snoozed: ReminderDisplayItem[];
  dismissed: DismissedReminderHistoryEntry[];
  onOpenBatch: () => void;
  onDismissedAction?: (
    action: ReminderAction,
    item: ReminderDisplayItem
  ) => void;
  buttonClassName?: string;
};

const dismissedHistoryEntryToDisplayItem = (
  entry: DismissedReminderHistoryEntry
): ReminderDisplayItem => ({
  candidate: {
    stableKey: entry.stableKey,
    triggerKey: entry.triggerKey,
    episodeKey: entry.episodeKey,
    ruleId: entry.ruleId,
    ruleVersion: entry.ruleVersion,
    scope: entry.scope,
    entityType: "dismissedReminder",
    entityId: entry.stableKey,
    severity: "info",
    title: entry.title,
    body: entry.bodyText,
    payload: entry.payload,
    actions: entry.actions,
  },
  record: {
    stableKey: entry.stableKey,
    ruleId: entry.ruleId,
    ruleVersion: entry.ruleVersion,
    scope: entry.scope,
    entityType: "dismissedReminder",
    entityId: entry.stableKey,
    dismissedAt: entry.dismissedAt,
    activeEpisodeKey: null,
    lastEpisodeKey: entry.episodeKey,
    firstSeenAt: entry.dismissedAt,
    lastSeenAt: entry.dismissedAt,
    lastTriggeredAt: entry.dismissedAt,
    lastEpisodeActiveAt: entry.dismissedAt,
    lastEpisodeClearedAt: null,
    suppressionExpiresAt: null,
  },
});

export default function ReminderBell({
  messages,
  enabled,
  due,
  snoozed,
  dismissed = [],
  onOpenBatch,
  onDismissedAction,
  buttonClassName,
}: ReminderBellProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dueCount = enabled ? due.length : 0;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node | null)) return;
      setOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div className={styles.reminderBellWrap} ref={wrapRef}>
      <Tooltip content={messages.reminderBellLabel}>
        <button
          type="button"
          className={buttonClassName ?? styles.feedbackButton}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={messages.reminderBellLabel}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span aria-hidden="true">🔔</span>
          {dueCount > 0 ? (
            <span className={styles.reminderBadge}>{dueCount}</span>
          ) : null}
        </button>
      </Tooltip>
      {open ? (
        <div className={styles.reminderDropdown}>
          <div className={styles.reminderDropdownHeader}>
            <strong>{messages.remindersTitle}</strong>
            {due.length > 0 ? (
              <button
                type="button"
                className={styles.feedbackLink}
                onClick={() => {
                  onOpenBatch();
                  setOpen(false);
                }}
              >
                {messages.reminderOpenModal}
              </button>
            ) : null}
          </div>
          {!enabled ? (
            <p className={styles.muted}>{messages.remindersDisabledState}</p>
          ) : (
            <>
              <section className={styles.reminderDropdownSection}>
                <h3>{messages.reminderDueNow}</h3>
                {due.length ? (
                  <div className={styles.reminderDropdownList}>
                    {due.map((item) => (
                      <ReminderCard
                        key={item.candidate.stableKey}
                        item={item}
                        messages={messages}
                        readonly
                      />
                    ))}
                  </div>
                ) : (
                  <p className={styles.muted}>{messages.reminderNoDue}</p>
                )}
              </section>
              <section className={styles.reminderDropdownSection}>
                <h3>{messages.reminderSnoozed}</h3>
                {snoozed.length ? (
                  <div className={styles.reminderDropdownList}>
                    {snoozed.map((item) => (
                      <ReminderCard
                        key={item.candidate.stableKey}
                        item={item}
                        messages={messages}
                        readonly
                      />
                    ))}
                  </div>
                ) : (
                  <p className={styles.muted}>{messages.reminderNoSnoozed}</p>
                )}
              </section>
              <section className={styles.reminderDropdownSection}>
                <h3>{messages.remindersDismissedSectionTitle}</h3>
                {dismissed.length ? (
                  <div className={styles.reminderDropdownList}>
                    {dismissed.map((entry) => {
                      const item = dismissedHistoryEntryToDisplayItem(entry);
                      return (
                        <ReminderCard
                          key={`${entry.stableKey}-${entry.dismissedAt}`}
                          item={item}
                          messages={messages}
                          readonly
                          showActions
                          showDismissControls={false}
                          meta={messages.remindersDismissedAtLabel.replace(
                            "{{time}}",
                            formatDateTime(entry.dismissedAt)
                          )}
                          onAction={onDismissedAction}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.muted}>
                    {messages.remindersNoDismissed}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
