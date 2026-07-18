"use client";

import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";
import type { TeamScoutLikelyTrainingInfo } from "@/lib/clubChronicle/teamScoutDetailTypes";

type TeamScoutDetailInfoProps = {
  messages: Messages;
  likelyTraining?: TeamScoutLikelyTrainingInfo | null;
  matchSampleSize?: number | null;
  onShowAnalyzedMatches?: (() => void) | null;
  showForeignWageBonusNote?: boolean;
  variant?: "footer" | "popover";
};

export default function TeamScoutDetailInfo({
  messages,
  likelyTraining = null,
  matchSampleSize = null,
  onShowAnalyzedMatches = null,
  showForeignWageBonusNote = false,
  variant = "footer",
}: TeamScoutDetailInfoProps) {
  const className =
    variant === "popover"
      ? styles.teamScoutDetailInfoPopoverContent
      : styles.chronicleTsiWagesDetailModalFooterNotes;

  return (
    <div className={className}>
      <div className={styles.chronicleLegend}>
        <span className={styles.chronicleLegendText}>
          {messages.clubChronicleMainSkillEstimationFootnote}
        </span>
      </div>
      {likelyTraining ? (
        <div className={styles.chronicleLegend}>
          <span className={styles.chronicleLegendItem}>
            <span
              className={`${styles.chronicleLegendSwatch} ${styles.chronicleLikelyTraineeSwatch}`}
              aria-hidden="true"
            />
            <span>{messages.clubChronicleLikelyTraineeLegendLabel}</span>
          </span>
          <span className={styles.chronicleLegendText}>
            {messages.clubChronicleLikelyTraineeLegendRegimen.replace(
              "{{regimen}}",
              likelyTraining.label
            )}
          </span>
        </div>
      ) : null}
      {showForeignWageBonusNote ? (
        <div className={styles.chronicleLegend}>
          <span className={styles.chronicleLegendText}>
            ² {messages.seniorWageForeignExtraNote}
          </span>
        </div>
      ) : null}
      {typeof matchSampleSize === "number" ? (
        <div className={styles.chronicleLegend}>
          {onShowAnalyzedMatches ? (
            <button
              type="button"
              className={styles.chronicleLegendButton}
              onClick={onShowAnalyzedMatches}
            >
              {messages.clubChronicleDetailModalMatchesUsedLabel.replace(
                "{{count}}",
                String(matchSampleSize)
              )}
            </button>
          ) : (
            <span className={styles.chronicleLegendText}>
              {messages.clubChronicleDetailModalMatchesUsedLabel.replace(
                "{{count}}",
                String(matchSampleSize)
              )}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
