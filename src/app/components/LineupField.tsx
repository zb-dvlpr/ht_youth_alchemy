"use client";

import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { setDragGhost } from "@/lib/drag";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import Tooltip from "./Tooltip";

export type LineupAssignments = Record<string, number | null>;

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName?: string;
  LastName: string;
  Specialty?: number;
  PlayerSkills?: Record<string, SkillValue>;
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

type LineupFieldProps = {
  assignments: LineupAssignments;
  playersById: Map<number, YouthPlayer>;
  playerDetailsById?: Map<number, { PlayerSkills?: Record<string, SkillValue> }>;
  onAssign: (slotId: string, playerId: number) => void;
  onClear: (slotId: string) => void;
  onMove?: (fromSlot: string, toSlot: string) => void;
  onRandomize?: () => void;
  onReset?: () => void;
  onOptimize?: () => void;
  optimizeDisabled?: boolean;
  optimizeDisabledReason?: string;
  trainedSlots?: {
    primary: Set<string>;
    secondary: Set<string>;
    all: Set<string>;
  };
  onHoverPlayer?: (playerId: number) => void;
  messages: Messages;
};

type PositionRow = {
  className: string;
  positions: { id: string; label: string }[];
};

const POSITION_ROWS: PositionRow[] = [
  { className: "fieldRowGoal", positions: [{ id: "KP", label: "KP" }] },
  {
    className: "fieldRowDef",
    positions: [
      { id: "WB_L", label: "WB" },
      { id: "CD_L", label: "CD" },
      { id: "CD_C", label: "CD" },
      { id: "CD_R", label: "CD" },
      { id: "WB_R", label: "WB" },
    ],
  },
  {
    className: "fieldRowMid",
    positions: [
      { id: "W_L", label: "W" },
      { id: "IM_L", label: "IM" },
      { id: "IM_C", label: "IM" },
      { id: "IM_R", label: "IM" },
      { id: "W_R", label: "W" },
    ],
  },
  {
    className: "fieldRowAtk",
    positions: [
      { id: "F_L", label: "F" },
      { id: "F_C", label: "F" },
      { id: "F_R", label: "F" },
    ],
  },
];

const MAX_SKILL_LEVEL = 8;

const SKILL_ROWS = [
  { key: "KeeperSkill", maxKey: "KeeperSkillMax", labelKey: "skillKeeper" },
  { key: "DefenderSkill", maxKey: "DefenderSkillMax", labelKey: "skillDefending" },
  { key: "PlaymakerSkill", maxKey: "PlaymakerSkillMax", labelKey: "skillPlaymaking" },
  { key: "WingerSkill", maxKey: "WingerSkillMax", labelKey: "skillWinger" },
  { key: "PassingSkill", maxKey: "PassingSkillMax", labelKey: "skillPassing" },
  { key: "ScorerSkill", maxKey: "ScorerSkillMax", labelKey: "skillScoring" },
  { key: "SetPiecesSkill", maxKey: "SetPiecesSkillMax", labelKey: "skillSetPieces" },
];

function formatName(player: YouthPlayer) {
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

function getSkillLevel(skill?: SkillValue): number | null {
  if (!skill) return null;
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

function getSkillMax(skill?: SkillValue): number | null {
  if (!skill) return null;
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

export default function LineupField({
  assignments,
  playersById,
  playerDetailsById,
  onAssign,
  onClear,
  onMove,
  onRandomize,
  onReset,
  onOptimize,
  optimizeDisabled = false,
  optimizeDisabledReason,
  trainedSlots,
  onHoverPlayer,
  messages,
}: LineupFieldProps) {
  const handleDrop = (slotId: string, event: React.DragEvent) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    if (raw) {
      try {
        const payload = JSON.parse(raw) as {
          type?: string;
          playerId?: number;
          fromSlot?: string;
        };
        if (payload.type === "slot" && payload.fromSlot && onMove) {
          onMove(payload.fromSlot, slotId);
          return;
        }
        if (payload.type === "player" && payload.playerId) {
          onAssign(slotId, payload.playerId);
          return;
        }
      } catch {
        // fall through to plain text
      }
    }

    const fallback = event.dataTransfer.getData("text/plain");
    const playerId = Number(fallback);
    if (Number.isNaN(playerId)) return;
    onAssign(slotId, playerId);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div className={styles.fieldCard}>
      <div className={styles.fieldHeader}>
        <span>{messages.lineupTitle}</span>
        {onOptimize ? (
          <Tooltip
            content={
              <div className={styles.tooltipCard}>
                {optimizeDisabled
                  ? optimizeDisabledReason
                  : messages.optimizeLineupTitle}
              </div>
            }
          >
            <button
              type="button"
              className={styles.optimizeButton}
              onClick={onOptimize}
              aria-label={
                optimizeDisabled
                  ? optimizeDisabledReason
                  : messages.optimizeLineupTitle
              }
              disabled={optimizeDisabled}
              data-help-anchor="optimize"
            >
              ✨
            </button>
          </Tooltip>
        ) : null}
      </div>
      <div className={styles.fieldPitch}>
        <div className={styles.penaltyBox} />
        <div className={styles.penaltyArc} />
        <div className={styles.fieldGoal}>
          <div className={styles.fieldGoalNet} />
        </div>
        {POSITION_ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`${styles.fieldRow} ${styles[row.className]}`}
          >
            {row.positions.map((position) => {
              const assignedId = assignments[position.id] ?? null;
              const isPrimaryTrained = trainedSlots?.primary?.has(position.id) ?? false;
              const isSecondaryTrained =
                trainedSlots?.secondary?.has(position.id) ?? false;
              const isTrained = trainedSlots?.all?.has(position.id) ?? false;
              const trainingLabel = isPrimaryTrained && isSecondaryTrained
                ? messages.trainingSlotBoth
                : isPrimaryTrained
                ? messages.trainingSlotPrimary
                : isSecondaryTrained
                ? messages.trainingSlotSecondary
                : null;
              const assignedPlayer = assignedId
                ? playersById.get(assignedId) ?? null
                : null;
              const assignedDetails = assignedId
                ? playerDetailsById?.get(assignedId) ?? null
                : null;

              const dragPayload = assignedPlayer
                ? JSON.stringify({
                    type: "slot",
                    playerId: assignedPlayer.YouthPlayerID,
                    fromSlot: position.id,
                  })
                : null;

              return (
                <div
                  key={position.id}
                  className={`${styles.fieldSlot} ${
                    isTrained ? styles.trainedSlot : ""
                  } ${isPrimaryTrained ? styles.trainedPrimary : ""} ${
                    isSecondaryTrained ? styles.trainedSecondary : ""
                  }`}
                  onDrop={(event) => handleDrop(position.id, event)}
                  onDragOver={handleDragOver}
                >
                  {assignedPlayer ? (
                    <Tooltip
                      content={
                        <div className={styles.slotTooltipCard}>
                          <div className={styles.slotTooltipHint}>
                            {messages.dragPlayerHint}
                          </div>
                          <div className={styles.slotTooltipGrid}>
                            {SKILL_ROWS.map((row) => {
                              const skillSource =
                                assignedDetails?.PlayerSkills ??
                                assignedPlayer.PlayerSkills ??
                                null;
                              const current = getSkillLevel(
                                skillSource?.[row.key]
                              );
                              const max = getSkillMax(
                                skillSource?.[row.maxKey]
                              );
                              const hasCurrent = current !== null;
                              const hasMax = max !== null;
                              const currentText = hasCurrent
                                ? String(current)
                                : messages.unknownShort;
                              const maxText = hasMax
                                ? String(max)
                                : messages.unknownShort;
                              const currentPct = hasCurrent
                                ? Math.min(100, (current / MAX_SKILL_LEVEL) * 100)
                                : null;
                              const maxPct = hasMax
                                ? Math.min(100, (max / MAX_SKILL_LEVEL) * 100)
                                : null;

                              return (
                                <div key={row.key} className={styles.skillRow}>
                                  <div className={styles.skillLabel}>
                                    {messages[row.labelKey as keyof Messages]}
                                  </div>
                                  <div className={styles.skillBar}>
                                    {hasMax ? (
                                      <div
                                        className={styles.skillFillMax}
                                        style={{ width: `${maxPct}%` }}
                                      />
                                    ) : null}
                                    {hasCurrent ? (
                                      <div
                                        className={styles.skillFillCurrent}
                                        style={{ width: `${currentPct}%` }}
                                      />
                                    ) : null}
                                  </div>
                                  <div className={styles.skillValue}>
                                    {currentText}/{maxText}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      }
                      fullWidth
                    >
                      <div
                        className={styles.slotContent}
                        draggable
                        onMouseEnter={() => {
                          if (!assignedPlayer) return;
                          onHoverPlayer?.(assignedPlayer.YouthPlayerID);
                        }}
                        onDragStart={(event) => {
                          if (!dragPayload) return;
                          setDragGhost(event, {
                            label: formatName(assignedPlayer),
                            className: styles.dragGhost,
                            slotSelector: `.${styles.fieldSlot}`,
                          });
                          event.dataTransfer.setData(
                            "application/json",
                            dragPayload
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        <span className={styles.slotName}>
                          {formatName(assignedPlayer)}
                        </span>
                        {assignedPlayer.Specialty &&
                        assignedPlayer.Specialty !== 0 ? (
                          <span className={styles.slotEmoji}>
                            {SPECIALTY_EMOJI[assignedPlayer.Specialty]}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className={styles.slotClear}
                          onClick={() => onClear(position.id)}
                          aria-label={`${messages.clearSlot} ${position.label}`}
                        >
                          ×
                        </button>
                      </div>
                    </Tooltip>
                  ) : null}
                  {trainingLabel ? (
                    <span className={styles.trainingTag}>{trainingLabel}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        <div className={styles.centerCircle} />
        <div className={styles.centerSpot} />
      </div>
      {onRandomize ? (
        <button
          type="button"
          className={styles.lineupButton}
          onClick={onRandomize}
        >
          {messages.randomizeLineup}
        </button>
      ) : null}
      {onReset ? (
        <button
          type="button"
          className={styles.lineupButtonSecondary}
          onClick={onReset}
        >
          {messages.resetLineup}
        </button>
      ) : null}
    </div>
  );
}
