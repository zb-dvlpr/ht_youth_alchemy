"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../page.module.css";

type StartupLoadingExperienceProps = {
  title: string;
  subtitle?: string | null;
  status?: string | null;
  statuses?: string[];
  progressPct?: number | null;
  showProgress?: boolean;
  overlay?: boolean;
  fading?: boolean;
};

const FALLBACK_PROGRESS_MAX = 94;
const STATUS_ROTATION_MS = 900;

export default function StartupLoadingExperience({
  title,
  subtitle = null,
  status = null,
  statuses = [],
  progressPct = null,
  showProgress = true,
  overlay = false,
  fading = false,
}: StartupLoadingExperienceProps) {
  const rotatingStatuses = useMemo(
    () => statuses.filter((entry): entry is string => Boolean(entry?.trim())),
    [statuses]
  );
  const [fallbackStatusIndex, setFallbackStatusIndex] = useState(0);

  useEffect(() => {
    if (status || rotatingStatuses.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setFallbackStatusIndex((current) => (current + 1) % rotatingStatuses.length);
    }, STATUS_ROTATION_MS);
    return () => window.clearInterval(intervalId);
  }, [rotatingStatuses, status]);

  const resolvedFallbackStatusIndex =
    rotatingStatuses.length > 0 ? fallbackStatusIndex % rotatingStatuses.length : 0;

  const resolvedStatus =
    typeof status === "string" && status.trim().length > 0
      ? status
      : rotatingStatuses[resolvedFallbackStatusIndex] ?? "";
  const resolvedProgressPct =
    typeof progressPct === "number" && Number.isFinite(progressPct)
      ? Math.max(0, Math.min(100, Math.round(progressPct)))
      : rotatingStatuses.length > 0
        ? Math.max(
            8,
            Math.min(
              FALLBACK_PROGRESS_MAX,
              Math.round(((resolvedFallbackStatusIndex + 1) / rotatingStatuses.length) * 100)
            )
          )
        : 12;

  return (
    <div
      className={`${styles.startupLoadingShell}${overlay ? ` ${styles.startupLoadingOverlay}` : ""}${
        fading ? ` ${styles.startupLoadingShellFading}` : ""
      }`}
      aria-busy="true"
      aria-live="polite"
    >
      <div className={styles.startupLoadingCard}>
        <span className={`${styles.spinner} ${styles.startupLoadingSpinner}`} aria-hidden="true" />
        <div className={styles.startupLoadingTextBlock}>
          <h2 className={styles.startupLoadingTitle}>{title}</h2>
          {subtitle ? <p className={styles.startupLoadingSubtitle}>{subtitle}</p> : null}
          {resolvedStatus ? <p className={styles.startupLoadingStatus}>{resolvedStatus}</p> : null}
        </div>
        {showProgress ? (
          <div className={styles.startupLoadingProgressRow}>
            <div className={styles.startupLoadingProgressTrack} aria-hidden="true">
              <span
                className={styles.startupLoadingProgressFill}
                style={{ width: `${resolvedProgressPct}%` }}
              />
            </div>
            <span className={styles.startupLoadingProgressValue}>{resolvedProgressPct}%</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
