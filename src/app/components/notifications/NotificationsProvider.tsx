"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type NotificationItem = {
  id: string;
  message: string;
  timestamp: number;
};

type NotificationsContextValue = {
  notifications: NotificationItem[];
  addNotification: (message: string) => void;
  clearNotifications: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

const MAX_NOTIFICATIONS = 5;

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const addNotification = useCallback((message: string) => {
    setNotifications((prev) => {
      const next = [
        { id: createId(), message, timestamp: Date.now() },
        ...prev,
      ];
      return next.slice(0, MAX_NOTIFICATIONS);
    });
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo(
    () => ({ notifications, addNotification, clearNotifications }),
    [notifications, addNotification, clearNotifications]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
