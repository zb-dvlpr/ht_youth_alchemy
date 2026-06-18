"use client";

import type { OriginFlagDisplay } from "@/lib/originFlag";
import styles from "../page.module.css";
import Tooltip from "./Tooltip";

type OriginFlagProps = {
  display?: OriginFlagDisplay | null;
  className?: string;
};

export default function OriginFlag({ display, className }: OriginFlagProps) {
  if (!display) return null;

  return (
    <Tooltip content={display.label}>
      <span
        className={className ?? styles.playerOriginFlag}
        aria-label={display.label}
      >
        {display.kind === "text" ? (
          <span className={styles.playerOriginTextBadge}>{display.value}</span>
        ) : (
          display.value
        )}
      </span>
    </Tooltip>
  );
}
