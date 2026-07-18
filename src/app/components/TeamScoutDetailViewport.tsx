"use client";

import type { ReactNode } from "react";

import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";
import type { TeamScoutLikelyTrainingInfo } from "@/lib/clubChronicle/teamScoutDetailTypes";
import TeamScoutDetailCompactToolbar, {
  type TeamScoutDetailCompactToolbarTab,
} from "./TeamScoutDetailCompactToolbar";

type TeamScoutDetailViewportVariant = "modal" | "mobile-page";

type TeamScoutDetailViewportProps = {
  idPrefix: string;
  title: string;
  secondaryLabel?: string | null;
  messages: Messages;
  tabs?: TeamScoutDetailCompactToolbarTab[];
  likelyTraining?: TeamScoutLikelyTrainingInfo | null;
  matchSampleSize?: number | null;
  showForeignWageBonusNote?: boolean;
  onShowAnalyzedMatches?: (() => void) | null;
  onClose: () => void;
  standardMeta?: ReactNode;
  children: ReactNode;
  variant?: TeamScoutDetailViewportVariant;
};

export default function TeamScoutDetailViewport({
  idPrefix,
  title,
  secondaryLabel = null,
  messages,
  tabs,
  likelyTraining = null,
  matchSampleSize = null,
  showForeignWageBonusNote = false,
  onShowAnalyzedMatches = null,
  onClose,
  standardMeta = null,
  children,
  variant = "modal",
}: TeamScoutDetailViewportProps) {
  return (
    <div
      className={`${styles.teamScoutDetailViewport} ${
        variant === "mobile-page" ? styles.teamScoutDetailViewportMobilePage : ""
      }`}
    >
      <TeamScoutDetailCompactToolbar
        idPrefix={idPrefix}
        title={title}
        secondaryLabel={secondaryLabel}
        messages={messages}
        tabs={tabs}
        likelyTraining={likelyTraining}
        matchSampleSize={matchSampleSize}
        showForeignWageBonusNote={showForeignWageBonusNote}
        onShowAnalyzedMatches={onShowAnalyzedMatches}
        onClose={onClose}
      />
      {standardMeta ? (
        <div className={styles.teamScoutDetailStandardMeta}>{standardMeta}</div>
      ) : null}
      <div className={styles.teamScoutDetailViewportBody}>{children}</div>
    </div>
  );
}
