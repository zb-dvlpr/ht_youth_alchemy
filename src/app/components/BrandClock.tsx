"use client";

import { useEffect, useState } from "react";
import styles from "../page.module.css";
import { formatCentralEuropeTime } from "@/lib/datetime";

export default function BrandClock() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const { label, time, zoneAbbreviation } = formatCentralEuropeTime(now);

  return (
    <div className={styles.brandClock} aria-label={label}>
      <span className={styles.brandClockZone}>{zoneAbbreviation}</span>
      <span className={styles.brandClockTime}>{time}</span>
    </div>
  );
}
