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
        <span className={styles.lineupExcludeGlyph} aria-hidden="true">
          {"⛔︎"}
        </span>
      </button>
    </Tooltip>
  );
}
