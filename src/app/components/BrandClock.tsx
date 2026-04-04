"use client";

import { useSyncExternalStore } from "react";
import styles from "../page.module.css";
import { formatCentralEuropeTime } from "@/lib/datetime";

let currentClockValue = 0;
const clockListeners = new Set<() => void>();
let clockIntervalId: number | null = null;

const emitClockUpdate = () => {
  currentClockValue = Date.now();
  clockListeners.forEach((listener) => listener());
};

const subscribeToClock = (callback: () => void) => {
  clockListeners.add(callback);
  if (clockListeners.size === 1) {
    emitClockUpdate();
    clockIntervalId = window.setInterval(emitClockUpdate, 1000);
  }
  return () => {
    clockListeners.delete(callback);
    if (!clockListeners.size && clockIntervalId !== null) {
      window.clearInterval(clockIntervalId);
      clockIntervalId = null;
    }
  };
};

const getClockSnapshot = () => currentClockValue;
const getClockServerSnapshot = () => 0;

export default function BrandClock() {
  const now = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getClockServerSnapshot
  );

  const { label, time, zoneAbbreviation } = now > 0
    ? formatCentralEuropeTime(now)
    : {
        label: "CET 00:00:00",
        time: "00:00:00",
        zoneAbbreviation: "CET",
      };

  return (
    <div className={styles.brandClock} aria-label={label}>
      <span className={styles.brandClockZone}>{zoneAbbreviation}</span>
      <span className={styles.brandClockTime}>{time}</span>
    </div>
  );
}
