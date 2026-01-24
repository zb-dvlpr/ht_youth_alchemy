"use client";

import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { SPECIALTY_EMOJI } from "@/lib/specialty";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
};

type YouthPlayerListProps = {
  players: YouthPlayer[];
  assignedIds?: Set<number>;
  selectedId?: number | null;
  onSelect?: (playerId: number) => void;
  messages: Messages;
};

function formatPlayerName(player?: YouthPlayer | null) {
  if (!player) return "";
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

export default function YouthPlayerList({
  players,
  assignedIds,
  selectedId,
  onSelect,
  messages,
}: YouthPlayerListProps) {
  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    playerId: number
  ) => {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "player", playerId })
    );
    event.dataTransfer.setData("text/plain", String(playerId));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>{messages.youthPlayerList}</h2>
      {players.length === 0 ? (
        <p className={styles.muted}>{messages.noYouthPlayers}</p>
      ) : (
        <ul className={styles.list}>
          {players.map((player) => {
            const fullName = formatPlayerName(player);
            const isSelected = selectedId === player.YouthPlayerID;
            const isAssigned = assignedIds?.has(player.YouthPlayerID) ?? false;

            const specialtyEmoji =
              player.Specialty && player.Specialty !== 0
                ? player.Specialty
                : null;

            return (
              <li key={player.YouthPlayerID} className={styles.listItem}>
                <div className={styles.playerRow}>
                  <button
                    type="button"
                    className={`${styles.playerButton} ${
                      isAssigned ? styles.playerAssigned : ""
                    }`}
                    onClick={() => onSelect?.(player.YouthPlayerID)}
                    onDragStart={(event) =>
                      handleDragStart(event, player.YouthPlayerID)
                    }
                    draggable
                    aria-pressed={isSelected}
                  >
                    <span className={styles.playerNameRow}>
                      <span className={styles.playerName}>{fullName}</span>
                      {specialtyEmoji ? (
                        <span className={styles.playerSpecialty}>
                          {SPECIALTY_EMOJI[specialtyEmoji]}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.playerId}>
                      ID: {player.YouthPlayerID}
                    </span>
                    {isAssigned ? (
                      <span className={styles.assignedTag}>
                        {messages.assigned}
                      </span>
                    ) : null}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
