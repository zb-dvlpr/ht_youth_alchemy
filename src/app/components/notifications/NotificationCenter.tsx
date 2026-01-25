"use client";

import { useMemo } from "react";
import styles from "../../page.module.css";
import { useNotifications } from "./NotificationsProvider";
import { Messages, Locale } from "@/lib/i18n";

type NotificationCenterProps = {
  locale: Locale;
  messages: Messages;
};

export default function NotificationCenter({
  locale,
  messages,
}: NotificationCenterProps) {
  const { notifications } = useNotifications();

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale]
  );

  return (
    <div className={styles.notificationCenter} aria-live="polite">
      {notifications.length === 0 ? (
        <span className={styles.notificationEmpty}>
          {messages.notificationEmpty}
        </span>
      ) : (
        <div className={styles.notificationList}>
          {notifications.map((notification) => (
            <div key={notification.id} className={styles.notificationItem}>
              <span className={styles.notificationTime}>
                {formatter.format(notification.timestamp)}
              </span>
              <span className={styles.notificationMessage}>
                {notification.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
