"use client";

import styles from "../page.module.css";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
};

type YouthPlayerListProps = {
  players: YouthPlayer[];
  assignedIds?: Set<number>;
  selectedId?: number | null;
  onSelect?: (playerId: number) => void;
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
      <h2 className={styles.sectionTitle}>Youth Player List</h2>
      {players.length === 0 ? (
        <p className={styles.muted}>No youth players returned.</p>
      ) : (
        <ul className={styles.list}>
          {players.map((player) => {
            const fullName = formatPlayerName(player);
            const isSelected = selectedId === player.YouthPlayerID;
            const isAssigned = assignedIds?.has(player.YouthPlayerID) ?? false;

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
                    <span className={styles.playerName}>{fullName}</span>
                    <span className={styles.playerId}>
                      ID: {player.YouthPlayerID}
                    </span>
                    {isAssigned ? (
                      <span className={styles.assignedTag}>Assigned</span>
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
