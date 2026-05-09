"use client";

import { useEffect, useState } from "react";

import type { Messages } from "@/lib/i18n";
import {
  APP_LICENSE_EVENT,
  APP_LICENSE_STORAGE_KEY,
  readAppLicenseState,
} from "@/lib/license";

import styles from "../page.module.css";
import Tooltip from "./Tooltip";

type PremiumStatusPillProps = {
  messages: Messages;
  className?: string;
};

export default function PremiumStatusPill({
  messages,
  className,
}: PremiumStatusPillProps) {
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      setPremiumUnlocked(readAppLicenseState().premiumUnlocked);
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

  const label = premiumUnlocked
    ? messages.premiumPillLabel
    : messages.freePillLabel;
  const tooltip = premiumUnlocked
    ? messages.premiumPillTooltip
    : messages.freePillTooltip;
  const pillClassName = premiumUnlocked ? styles.premiumPill : styles.freePill;

  return (
    <Tooltip content={tooltip}>
      <span
        className={`${pillClassName}${className ? ` ${className}` : ""}`}
        aria-label={tooltip}
      >
        {label}
      </span>
    </Tooltip>
  );
}
