"use client";

import { useEffect, useState } from "react";

import type { Messages } from "@/lib/i18n";
import {
  APP_LICENSE_EVENT,
  APP_LICENSE_STORAGE_KEY,
  hasActiveAppLicenseState,
  isPremiumLicensingEnabled,
  readAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import Tooltip from "./Tooltip";

type PremiumStatusPillProps = {
  messages: Messages;
  className?: string;
  onClick?: (premiumUnlocked: boolean) => void;
};

export default function PremiumStatusPill({
  messages,
  className,
  onClick,
}: PremiumStatusPillProps) {
  const premiumLicensingEnabled = isPremiumLicensingEnabled();
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setPremiumUnlocked(hasActiveAppLicenseState(readAppLicenseState()));
    };
    sync();
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== APP_LICENSE_STORAGE_KEY) return;
      sync();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(APP_LICENSE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(APP_LICENSE_EVENT, sync);
    };
  }, []);

  const label = !premiumLicensingEnabled
    ? messages.betaPillLabel
    : premiumUnlocked
      ? messages.premiumPillLabel
      : messages.freePillLabel;
  const tooltip = !premiumLicensingEnabled
    ? messages.betaPillTooltip
    : premiumUnlocked
      ? messages.premiumPillTooltip
      : messages.freePillTooltip;
  const pillClassName = !premiumLicensingEnabled
    ? styles.betaPill
    : premiumUnlocked
      ? styles.premiumPill
      : styles.freePill;
  const combinedClassName = `${pillClassName}${className ? ` ${className}` : ""}`;

  if (premiumLicensingEnabled && onClick) {
    return (
      <Tooltip content={tooltip}>
        <button
          type="button"
          className={styles.premiumStatusPillButton}
          aria-label={tooltip}
          onClick={() => onClick(premiumUnlocked)}
        >
          <span className={combinedClassName}>{label}</span>
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip}>
      <span className={combinedClassName} aria-label={tooltip}>
        {label}
      </span>
    </Tooltip>
  );
}
