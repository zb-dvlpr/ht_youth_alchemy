"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";
import type { TeamScoutLikelyTrainingInfo } from "@/lib/clubChronicle/teamScoutDetailTypes";
import TeamScoutDetailInfo from "./TeamScoutDetailInfo";

export type TeamScoutDetailCompactToolbarTab = {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
};

type TeamScoutDetailCompactToolbarProps = {
  idPrefix: string;
  title: string;
  secondaryLabel?: string | null;
  messages: Messages;
  likelyTraining?: TeamScoutLikelyTrainingInfo | null;
  matchSampleSize?: number | null;
  onShowAnalyzedMatches?: (() => void) | null;
  showForeignWageBonusNote?: boolean;
  tabs?: TeamScoutDetailCompactToolbarTab[];
  onClose: () => void;
};

export default function TeamScoutDetailCompactToolbar({
  idPrefix,
  title,
  secondaryLabel = null,
  messages,
  likelyTraining = null,
  matchSampleSize = null,
  onShowAnalyzedMatches = null,
  showForeignWageBonusNote = false,
  tabs,
  onClose,
}: TeamScoutDetailCompactToolbarProps) {
  const reactId = useId();
  const popoverId = `${idPrefix}-info-${reactId.replace(/:/g, "")}`;
  const [infoOpen, setInfoOpen] = useState(false);
  const infoWrapRef = useRef<HTMLDivElement | null>(null);
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);

  const closeInfo = useCallback((restoreFocus: boolean) => {
    setInfoOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => infoButtonRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    if (!infoOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && infoWrapRef.current?.contains(target)) return;
      closeInfo(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeInfo(true);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [closeInfo, infoOpen]);

  return (
    <div className={styles.teamScoutDetailCompactToolbar}>
      {tabs?.length ? (
        <div className={styles.teamScoutDetailCompactTabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.active}
              className={`${styles.teamScoutDetailCompactTab} ${
                tab.active ? styles.teamScoutDetailCompactTabActive : ""
              }`}
              onClick={tab.onSelect}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.teamScoutDetailCompactHeading}>
        <span className={styles.teamScoutDetailCompactTitle} title={title}>
          {title}
        </span>
        {secondaryLabel ? (
          <span
            className={styles.teamScoutDetailCompactSecondary}
            title={secondaryLabel}
          >
            {secondaryLabel}
          </span>
        ) : null}
      </div>
      <div className={styles.teamScoutDetailCompactMeta} aria-hidden="true">
        {likelyTraining ? (
          <span className={styles.teamScoutDetailCompactMetaChip}>
            {likelyTraining.label}
          </span>
        ) : null}
        {typeof matchSampleSize === "number" ? (
          <span className={styles.teamScoutDetailCompactMetaChip}>
            {String(matchSampleSize)}
          </span>
        ) : null}
      </div>
      <div className={styles.teamScoutDetailCompactActions}>
        <div
          className={styles.teamScoutDetailCompactInfoWrap}
          ref={infoWrapRef}
        >
          <button
            ref={infoButtonRef}
            type="button"
            className={styles.teamScoutDetailCompactIconButton}
            aria-label={messages.teamScoutDetailInfoButtonLabel}
            title={messages.teamScoutDetailInfoButtonLabel}
            aria-expanded={infoOpen}
            aria-controls={popoverId}
            onClick={() => setInfoOpen((open) => !open)}
          >
            ⓘ
          </button>
          {infoOpen ? (
            <div
              id={popoverId}
              className={styles.teamScoutDetailCompactInfoPopover}
              role="dialog"
              aria-modal="false"
              aria-label={messages.teamScoutDetailInfoButtonLabel}
            >
              <TeamScoutDetailInfo
                messages={messages}
                likelyTraining={likelyTraining}
                matchSampleSize={matchSampleSize}
                onShowAnalyzedMatches={onShowAnalyzedMatches}
                showForeignWageBonusNote={showForeignWageBonusNote}
                variant="popover"
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.teamScoutDetailCompactIconButton}
          aria-label={messages.closeLabel}
          title={messages.closeLabel}
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}
