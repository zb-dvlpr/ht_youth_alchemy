"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { setDragGhost } from "@/lib/drag";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
  Age?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  PlayerSkills?: PlayerSkills;
};

type SkillValue = number | { "#text"?: number };

type PlayerSkills = {
  KeeperSkill?: SkillValue;
  DefenderSkill?: SkillValue;
  PlaymakerSkill?: SkillValue;
  WingerSkill?: SkillValue;
  PassingSkill?: SkillValue;
  ScorerSkill?: SkillValue;
  SetPiecesSkill?: SkillValue;
};

type YouthPlayerListProps = {
  players: YouthPlayer[];
  assignedIds?: Set<number>;
  selectedId?: number | null;
  starPlayerId?: number | null;
  onToggleStar?: (playerId: number) => void;
  onSelect?: (playerId: number) => void;
  messages: Messages;
};

type SortKey =
  | "name"
  | "age"
  | "arrival"
  | "promotable"
  | "keeper"
  | "defender"
  | "playmaker"
  | "winger"
  | "passing"
  | "scorer"
  | "setpieces";

type SortDirection = "asc" | "desc";

function formatPlayerName(player?: YouthPlayer | null) {
  if (!player) return "";
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

function toSkillValue(value: SkillValue | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const numeric = value["#text"];
  return typeof numeric === "number" ? numeric : null;
}

function getSkill(player: YouthPlayer, key: keyof PlayerSkills) {
  return toSkillValue(player.PlayerSkills?.[key]);
}

function parseArrival(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

export default function YouthPlayerList({
  players,
  assignedIds,
  selectedId,
  starPlayerId,
  onToggleStar,
  onSelect,
  messages,
}: YouthPlayerListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    playerId: number
  ) => {
    const player = players.find((item) => item.YouthPlayerID === playerId);
    if (player) {
      setDragGhost(event, {
        label: formatPlayerName(player),
        className: styles.dragGhost,
        slotSelector: `.${styles.fieldSlot}`,
      });
    }
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "player", playerId })
    );
    event.dataTransfer.setData("text/plain", String(playerId));
    event.dataTransfer.effectAllowed = "move";
  };

  const sortedPlayers = useMemo(() => {
    const list = [...players];
    const compareNumber = (
      a: number | null,
      b: number | null,
      direction: "asc" | "desc"
    ) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return direction === "asc" ? a - b : b - a;
    };

    const compare = (a: YouthPlayer, b: YouthPlayer) => {
      switch (sortKey) {
        case "age":
          return compareNumber(a.Age ?? null, b.Age ?? null, "desc");
        case "arrival":
          return compareNumber(
            parseArrival(a.ArrivalDate),
            parseArrival(b.ArrivalDate),
            "asc"
          );
        case "promotable":
          return compareNumber(
            a.CanBePromotedIn ?? null,
            b.CanBePromotedIn ?? null,
            "asc"
          );
        case "keeper":
          return compareNumber(getSkill(a, "KeeperSkill"), getSkill(b, "KeeperSkill"), "desc");
        case "defender":
          return compareNumber(
            getSkill(a, "DefenderSkill"),
            getSkill(b, "DefenderSkill"),
            "desc"
          );
        case "playmaker":
          return compareNumber(
            getSkill(a, "PlaymakerSkill"),
            getSkill(b, "PlaymakerSkill"),
            "desc"
          );
        case "winger":
          return compareNumber(
            getSkill(a, "WingerSkill"),
            getSkill(b, "WingerSkill"),
            "desc"
          );
        case "passing":
          return compareNumber(
            getSkill(a, "PassingSkill"),
            getSkill(b, "PassingSkill"),
            "desc"
          );
        case "scorer":
          return compareNumber(
            getSkill(a, "ScorerSkill"),
            getSkill(b, "ScorerSkill"),
            "desc"
          );
        case "setpieces":
          return compareNumber(
            getSkill(a, "SetPiecesSkill"),
            getSkill(b, "SetPiecesSkill"),
            "desc"
          );
        case "name":
        default:
          return formatPlayerName(a).localeCompare(formatPlayerName(b));
      }
    };

    return list.sort((a, b) =>
      sortDirection === "asc" ? compare(a, b) : compare(b, a)
    );
  }, [players, sortKey, sortDirection]);

  return (
    <div className={styles.card}>
      <div className={styles.listHeader}>
        <h2 className={`${styles.sectionTitle} ${styles.listHeaderTitle}`}>
          {messages.youthPlayerList}
        </h2>
        <label className={styles.sortControl}>
          <span className={styles.sortLabel}>{messages.sortLabel}</span>
          <select
            className={styles.sortSelect}
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            <option value="name">{messages.sortName}</option>
            <option value="age">{messages.sortAge}</option>
            <option value="arrival">{messages.sortArrival}</option>
            <option value="promotable">{messages.sortPromotable}</option>
            <option value="keeper">{messages.sortKeeper}</option>
            <option value="defender">{messages.sortDefender}</option>
            <option value="playmaker">{messages.sortPlaymaker}</option>
            <option value="winger">{messages.sortWinger}</option>
            <option value="passing">{messages.sortPassing}</option>
            <option value="scorer">{messages.sortScorer}</option>
            <option value="setpieces">{messages.sortSetPieces}</option>
          </select>
        </label>
        <button
          type="button"
          className={styles.sortToggle}
          aria-label={messages.sortToggleAria}
          onClick={() =>
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
          }
          title={messages.sortToggleAria}
        >
          {sortDirection === "asc" ? "↕️" : "↕️"}
        </button>
      </div>
      {players.length === 0 ? (
        <p className={styles.muted}>{messages.noYouthPlayers}</p>
      ) : (
        <ul className={styles.list}>
          {sortedPlayers.map((player) => {
            const fullName = formatPlayerName(player);
            const isSelected = selectedId === player.YouthPlayerID;
            const isAssigned = assignedIds?.has(player.YouthPlayerID) ?? false;
            const isStar = starPlayerId === player.YouthPlayerID;

            const specialtyEmoji =
              player.Specialty && player.Specialty !== 0
                ? player.Specialty
                : null;

            return (
              <li key={player.YouthPlayerID} className={styles.listItem}>
                <div className={styles.playerRow}>
                  <button
                    type="button"
                    className={`${styles.starButton} ${
                      isStar ? styles.starButtonActive : ""
                    }`}
                    onClick={() => onToggleStar?.(player.YouthPlayerID)}
                    aria-label={messages.starPlayerLabel}
                    title={messages.starPlayerLabel}
                  >
                    ★
                  </button>
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
