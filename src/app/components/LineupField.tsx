"use client";

import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";

export type LineupAssignments = Record<string, number | null>;

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName?: string;
  LastName: string;
};

type LineupFieldProps = {
  assignments: LineupAssignments;
  playersById: Map<number, YouthPlayer>;
  onAssign: (slotId: string, playerId: number) => void;
  onClear: (slotId: string) => void;
  onMove?: (fromSlot: string, toSlot: string) => void;
  onRandomize?: () => void;
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

function formatName(player: YouthPlayer) {
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

export default function LineupField({
  assignments,
  playersById,
  onAssign,
  onClear,
  onMove,
  onRandomize,
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
      <div className={styles.fieldHeader}>{messages.lineupTitle}</div>
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
              const assignedPlayer = assignedId
                ? playersById.get(assignedId) ?? null
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
                  className={styles.fieldSlot}
                  onDrop={(event) => handleDrop(position.id, event)}
                  onDragOver={handleDragOver}
                >
                  {assignedPlayer ? (
                    <div className={styles.slotContent}>
                      <span
                        className={styles.slotName}
                        draggable
                        title={messages.dragPlayerHint}
                        onDragStart={(event) => {
                          if (!dragPayload) return;
                          event.dataTransfer.setData(
                            "application/json",
                            dragPayload
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                      >
                        {formatName(assignedPlayer)}
                      </span>
                      <span className={styles.slotLabel}>{position.label}</span>
                      <button
                        type="button"
                        className={styles.slotClear}
                        onClick={() => onClear(position.id)}
                        aria-label={`${messages.clearSlot} ${position.label}`}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className={styles.fieldLabel}>{position.label}</span>
                  )}
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
    </div>
  );
}
