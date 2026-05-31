import { useEffect, useRef, useState } from "react";
import styles from "../../page.module.css";
import type { Messages } from "@/lib/i18n";
import type { ReminderDisplayItem } from "@/lib/reminders/types";
import ReminderCard from "./ReminderCard";
import Tooltip from "../Tooltip";

type ReminderBellProps = {
  messages: Messages;
  enabled: boolean;
  due: ReminderDisplayItem[];
  snoozed: ReminderDisplayItem[];
  onOpenBatch: () => void;
};

export default function ReminderBell({
  messages,
  enabled,
  due,
  snoozed,
  onOpenBatch,
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
          className={styles.feedbackButton}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={messages.reminderBellLabel}
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
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
