"use client";

import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";

type MobileManualButtonProps = {
  messages: Messages;
};

export default function MobileManualButton({ messages }: MobileManualButtonProps) {
  return (
    <button
      type="button"
      className={styles.mobileLauncherUtilityButton}
      aria-label={messages.helpMenuManual}
      onClick={() => {
        window.dispatchEvent(new CustomEvent("ya:manual-open"));
      }}
    >
      <span className={styles.mobileLauncherUtilityIcon} aria-hidden="true">
        {messages.helpIcon}
      </span>
      <span>{messages.mobileHelpLabel}</span>
    </button>
  );
}
