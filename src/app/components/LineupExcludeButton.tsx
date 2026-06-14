"use client";

import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";

type LineupExcludeButtonProps = {
  playerName: string;
  excluded: boolean;
  onToggle: () => void;
  messages: Messages;
};

export default function LineupExcludeButton({
  playerName,
  excluded,
  onToggle,
  messages,
}: LineupExcludeButtonProps) {
  const label = excluded
    ? messages.lineupExclusionAllowLabel.replace("{{player}}", playerName)
    : messages.lineupExclusionExcludeLabel.replace("{{player}}", playerName);

  return (
    <Tooltip content={messages.lineupExclusionTooltip}>
      <button
        type="button"
        className={`${styles.lineupExcludeButton} ${
          excluded ? styles.lineupExcludeButtonActive : ""
        }`}
        aria-pressed={excluded}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <svg
          className={styles.lineupExcludeIcon}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            className={styles.lineupExcludeIconShape}
            d="M8.4 3h7.2L21 8.4v7.2L15.6 21H8.4L3 15.6V8.4L8.4 3Z"
          />
          {excluded ? (
            <path
              className={styles.lineupExcludeIconSymbol}
              d="M8.2 8.2 15.8 15.8M15.8 8.2 8.2 15.8"
            />
          ) : null}
        </svg>
      </button>
    </Tooltip>
  );
}
