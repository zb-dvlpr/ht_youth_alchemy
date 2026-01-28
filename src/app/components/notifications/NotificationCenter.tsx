"use client";

import styles from "../../page.module.css";
import { useNotifications } from "./NotificationsProvider";
import { Messages, Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/datetime";

type NotificationCenterProps = {
  locale: Locale;
  messages: Messages;
};

export default function NotificationCenter({
  locale,
  messages,
}: NotificationCenterProps) {
  const { notifications } = useNotifications();

  void locale;

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
                {formatDateTime(notification.timestamp)}
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
