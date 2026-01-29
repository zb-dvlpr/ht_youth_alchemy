"use client";

import Tooltip from "./Tooltip";
import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";

type HelpToggleButtonProps = {
  messages: Messages;
};

export default function HelpToggleButton({ messages }: HelpToggleButtonProps) {
  return (
    <Tooltip
      content={messages.helpOpenTooltip}
    >
      <button
        type="button"
        className={styles.helpButton}
        aria-label={messages.helpOpenTooltip}
        onClick={() => {
          if (typeof window === "undefined") return;
          window.dispatchEvent(new CustomEvent("ya:help-open"));
        }}
      >
        {messages.helpIcon}
      </button>
    </Tooltip>
  );
}
