"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { useNotifications } from "./notifications/NotificationsProvider";
import Tooltip from "./Tooltip";
import { setDragGhost } from "@/lib/drag";
import { parseChppDate } from "@/lib/chpp/utils";
import { formatDate, formatDateTime } from "@/lib/datetime";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
  Age?: number;
  AgeDays?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  PlayerSkills?: PlayerSkills;
};

type SkillValue = number | string | { "#text"?: number | string };

type PlayerSkills = {
  KeeperSkill?: SkillValue;
  KeeperSkillMax?: SkillValue;
  DefenderSkill?: SkillValue;
  DefenderSkillMax?: SkillValue;
  PlaymakerSkill?: SkillValue;
  PlaymakerSkillMax?: SkillValue;
  WingerSkill?: SkillValue;
  WingerSkillMax?: SkillValue;
  PassingSkill?: SkillValue;
  PassingSkillMax?: SkillValue;
  ScorerSkill?: SkillValue;
  ScorerSkillMax?: SkillValue;
  SetPiecesSkill?: SkillValue;
  SetPiecesSkillMax?: SkillValue;
};

const specialtyName = (value: number | undefined, messages: Messages) => {
  switch (value) {
    case 0:
      return messages.specialtyNone;
    case 1:
      return messages.specialtyTechnical;
    case 2:
      return messages.specialtyQuick;
    case 3:
      return messages.specialtyPowerful;
    case 4:
      return messages.specialtyUnpredictable;
    case 5:
      return messages.specialtyHeadSpecialist;
    case 6:
      return messages.specialtyResilient;
    case 8:
      return messages.specialtySupport;
    default:
      return null;
  }
};

type YouthPlayerListProps = {
  players: YouthPlayer[];
  orderedPlayerIds?: number[] | null;
  orderSource?: "list" | "ratings" | "skills" | null;
  youthTeams?: { youthTeamId: number; youthTeamName: string }[];
  selectedYouthTeamId?: number | null;
  onTeamChange?: (teamId: number) => void;
  assignedIds?: Set<number>;
  selectedId?: number | null;
  starPlayerId?: number | null;
  dataHelpAnchor?: string;
  onToggleStar?: (playerId: number) => void;
  onSelect?: (playerId: number) => void;
  onAutoSelect?: () => void;
  onRefresh?: () => void;
  onOrderChange?: (orderedIds: number[]) => void;
  onSortStart?: () => void;
  refreshing?: boolean;
  refreshStatus?: string | null;
  lastGlobalRefreshAt?: number | null;
  hiddenSpecialtyByPlayerId?: Record<number, number>;
  messages: Messages;
};

type SortKey =
  | "name"
  | "age"
  | "promotionAge"
  | "arrival"
  | "promotable"
  | "keeper"
  | "defender"
  | "playmaker"
  | "winger"
  | "passing"
  | "scorer"
  | "setpieces"
  | "custom";

type SortDirection = "asc" | "desc";

const SORT_KEYS: SortKey[] = [
  "name",
  "age",
  "promotionAge",
  "arrival",
  "promotable",
  "keeper",
  "defender",
  "playmaker",
  "winger",
  "passing",
  "scorer",
  "setpieces",
  "custom",
];

function formatPlayerName(player?: YouthPlayer | null) {
  if (!player) return "";
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

function toSkillValue(value: SkillValue | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }
  const numeric = value["#text"];
  if (numeric === null || numeric === undefined) return null;
  const parsed = Number(numeric);
  return Number.isNaN(parsed) ? null : parsed;
}

function getSkillScore(
  player: YouthPlayer,
  currentKey: keyof PlayerSkills,
  maxKey: keyof PlayerSkills
) {
  const current = toSkillValue(player.PlayerSkills?.[currentKey]) ?? 0;
  const max = toSkillValue(player.PlayerSkills?.[maxKey]) ?? 0;
  return current + max;
}

function getSkillPairText(
  player: YouthPlayer,
  currentKey: keyof PlayerSkills,
  maxKey: keyof PlayerSkills
) {
  const current = toSkillValue(player.PlayerSkills?.[currentKey]) ?? 0;
  const max = toSkillValue(player.PlayerSkills?.[maxKey]) ?? 0;
  return `${current}/${max}`;
}

function parseArrival(dateString?: string) {
  return parseChppDate(dateString)?.getTime() ?? null;
}

function promotionAgeTotalDays(player: YouthPlayer) {
  if (
    player.Age === undefined ||
    player.AgeDays === undefined ||
    player.CanBePromotedIn === undefined
  ) {
    return null;
  }
  const daysPerYear = 112;
  return (
    player.Age * daysPerYear +
    player.AgeDays +
    Math.max(0, player.CanBePromotedIn)
  );
}

function ageTotalDays(player: YouthPlayer) {
  if (player.Age === undefined || player.AgeDays === undefined) {
    return null;
  }
  const daysPerYear = 112;
  return player.Age * daysPerYear + player.AgeDays;
}

export default function YouthPlayerList({
  players,
  orderedPlayerIds,
  orderSource,
  youthTeams = [],
  selectedYouthTeamId,
  onTeamChange,
  assignedIds,
  selectedId,
  starPlayerId,
  dataHelpAnchor,
  onToggleStar,
  onSelect,
  onAutoSelect,
  onRefresh,
  onOrderChange,
  onSortStart,
  refreshing,
  refreshStatus,
  lastGlobalRefreshAt = null,
  hiddenSpecialtyByPlayerId = {},
  messages,
}: YouthPlayerListProps) {
  const sortStorageKey = "ya_youth_player_list_sort_v1";
  const listCardRef = useRef<HTMLDivElement | null>(null);
  const nameRowRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const sortValueRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [nameAgeOverlap, setNameAgeOverlap] = useState<Record<number, boolean>>(
    {}
  );
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(sortStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        sortKey?: SortKey;
        sortDirection?: SortDirection;
      };
      if (parsed.sortKey && SORT_KEYS.includes(parsed.sortKey)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSortKey(parsed.sortKey);
      }
      if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") {
        setSortDirection(parsed.sortDirection);
      }
    } catch {
      // ignore restore errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        sortStorageKey,
        JSON.stringify({ sortKey, sortDirection })
      );
    } catch {
      // ignore persist errors
    }
  }, [sortDirection, sortKey]);

  const sortLabelForKey = (key: SortKey) => {
    switch (key) {
      case "age":
        return messages.sortAge;
      case "promotionAge":
        return messages.sortPromotionAge;
      case "arrival":
        return messages.sortArrival;
      case "promotable":
        return messages.sortPromotable;
      case "keeper":
        return messages.sortKeeper;
      case "defender":
        return messages.sortDefender;
      case "playmaker":
        return messages.sortPlaymaker;
      case "winger":
        return messages.sortWinger;
      case "passing":
        return messages.sortPassing;
      case "scorer":
        return messages.sortScorer;
      case "setpieces":
        return messages.sortSetPieces;
      case "custom":
        return messages.sortCustom;
      case "name":
      default:
        return messages.sortName;
    }
  };

  const isMatrixSortActive = Boolean(
    orderSource &&
      orderSource !== "list" &&
      (orderSource === "ratings" || orderSource === "skills") &&
      orderedPlayerIds?.length
  );

  useEffect(() => {
    if (isMatrixSortActive && sortKey !== "custom") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSortKey("custom");
      return;
    }
    if (!isMatrixSortActive && sortKey === "custom") {
      setSortKey("name");
    }
  }, [isMatrixSortActive, sortKey]);
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
          return compareNumber(
            ageTotalDays(a),
            ageTotalDays(b),
            "asc"
          );
        case "promotionAge":
          return compareNumber(
            promotionAgeTotalDays(a),
            promotionAgeTotalDays(b),
            "asc"
          );
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
          return compareNumber(
            getSkillScore(a, "KeeperSkill", "KeeperSkillMax"),
            getSkillScore(b, "KeeperSkill", "KeeperSkillMax"),
            "desc"
          );
        case "defender":
          return compareNumber(
            getSkillScore(a, "DefenderSkill", "DefenderSkillMax"),
            getSkillScore(b, "DefenderSkill", "DefenderSkillMax"),
            "desc"
          );
        case "playmaker":
          return compareNumber(
            getSkillScore(a, "PlaymakerSkill", "PlaymakerSkillMax"),
            getSkillScore(b, "PlaymakerSkill", "PlaymakerSkillMax"),
            "desc"
          );
        case "winger":
          return compareNumber(
            getSkillScore(a, "WingerSkill", "WingerSkillMax"),
            getSkillScore(b, "WingerSkill", "WingerSkillMax"),
            "desc"
          );
        case "passing":
          return compareNumber(
            getSkillScore(a, "PassingSkill", "PassingSkillMax"),
            getSkillScore(b, "PassingSkill", "PassingSkillMax"),
            "desc"
          );
        case "scorer":
          return compareNumber(
            getSkillScore(a, "ScorerSkill", "ScorerSkillMax"),
            getSkillScore(b, "ScorerSkill", "ScorerSkillMax"),
            "desc"
          );
        case "setpieces":
          return compareNumber(
            getSkillScore(a, "SetPiecesSkill", "SetPiecesSkillMax"),
            getSkillScore(b, "SetPiecesSkill", "SetPiecesSkillMax"),
            "desc"
          );
        case "custom":
          return 0;
        case "name":
        default:
          return formatPlayerName(a).localeCompare(formatPlayerName(b));
      }
    };

    return list.sort((a, b) =>
      sortDirection === "asc" ? compare(a, b) : compare(b, a)
    );
  }, [players, sortKey, sortDirection]);

  const sortMetricText = (player: YouthPlayer) => {
    const formatAgeDays = (totalDays: number | null) => {
      if (totalDays === null) return messages.unknownShort;
      const years = Math.floor(totalDays / 112);
      const days = totalDays % 112;
      return `${years}${messages.ageYearsShort} ${days}${messages.ageDaysShort}`;
    };

      switch (sortKey) {
        case "age":
          return formatAgeDays(ageTotalDays(player));
        case "promotionAge":
          return formatAgeDays(promotionAgeTotalDays(player));
        case "arrival": {
          const date = parseChppDate(player.ArrivalDate);
          if (!date) return messages.unknownShort;
          return formatDate(date);
        }
        case "promotable": {
          const days = player.CanBePromotedIn;
          if (days === undefined || days === null) return messages.unknownShort;
          return `${Math.max(0, days)}${messages.ageDaysShort}`;
        }
        case "keeper":
          return `${sortLabelForKey("keeper")}: ${getSkillPairText(
            player,
            "KeeperSkill",
            "KeeperSkillMax"
          )}`;
        case "defender":
          return `${sortLabelForKey("defender")}: ${getSkillPairText(
            player,
            "DefenderSkill",
            "DefenderSkillMax"
          )}`;
        case "playmaker":
          return `${sortLabelForKey("playmaker")}: ${getSkillPairText(
            player,
            "PlaymakerSkill",
            "PlaymakerSkillMax"
          )}`;
        case "winger":
          return `${sortLabelForKey("winger")}: ${getSkillPairText(
            player,
            "WingerSkill",
            "WingerSkillMax"
          )}`;
        case "passing":
          return `${sortLabelForKey("passing")}: ${getSkillPairText(
            player,
            "PassingSkill",
            "PassingSkillMax"
          )}`;
        case "scorer":
          return `${sortLabelForKey("scorer")}: ${getSkillPairText(
            player,
            "ScorerSkill",
            "ScorerSkillMax"
          )}`;
        case "setpieces":
          return `${sortLabelForKey("setpieces")}: ${getSkillPairText(
            player,
            "SetPiecesSkill",
            "SetPiecesSkillMax"
          )}`;
        case "custom":
          return messages.sortCustom;
        case "name":
          return messages.sortName;
        default:
          return messages.sortName;
      }
  };

  const orderedPlayers = useMemo(() => {
    if (orderedPlayerIds && orderSource && orderSource !== "list") {
      const map = new Map(players.map((player) => [player.YouthPlayerID, player]));
      return orderedPlayerIds
        .map((id) => map.get(id))
        .filter((player): player is YouthPlayer => Boolean(player));
    }
    return sortedPlayers;
  }, [orderedPlayerIds, orderSource, players, sortedPlayers]);

  useEffect(() => {
    if (!onOrderChange) return;
    if (sortKey === "custom") return;
    if (orderSource && orderSource !== "list") return;
    if (
      orderSource === "list" &&
      orderedPlayerIds &&
      orderedPlayerIds.length === sortedPlayers.length &&
      orderedPlayerIds.every(
        (id, index) => id === sortedPlayers[index]?.YouthPlayerID
      )
    ) {
      return;
    }
    onOrderChange(sortedPlayers.map((player) => player.YouthPlayerID));
  }, [sortedPlayers, onOrderChange, sortKey, orderSource, orderedPlayerIds]);

  const recomputeNameAgeOverlap = useCallback(() => {
    const next: Record<number, boolean> = {};
    orderedPlayers.forEach((player) => {
      const playerId = player.YouthPlayerID;
      const nameEl = nameRowRefs.current[playerId];
      const valueEl = sortValueRefs.current[playerId];
      if (!nameEl || !valueEl) {
        next[playerId] = false;
        return;
      }
      const nameRect = nameEl.getBoundingClientRect();
      const valueRect = valueEl.getBoundingClientRect();
      const overlaps =
        nameRect.right > valueRect.left - 8 &&
        nameRect.left < valueRect.right &&
        nameRect.top < valueRect.bottom &&
        nameRect.bottom > valueRect.top;
      next[playerId] = overlaps;
    });
    setNameAgeOverlap((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) return next;
      for (const key of nextKeys) {
        if (prev[Number(key)] !== next[Number(key)]) {
          return next;
        }
      }
      return prev;
    });
  }, [orderedPlayers]);

  useEffect(() => {
    const run = () => {
      window.requestAnimationFrame(recomputeNameAgeOverlap);
    };
    run();
    const root = listCardRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(run);
    observer.observe(root);
    window.addEventListener("resize", run);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [recomputeNameAgeOverlap]);

  const activeRefreshStatus = refreshing
    ? refreshStatus?.trim() || messages.refreshingLabel
    : null;

  return (
    <div className={styles.card} data-help-anchor={dataHelpAnchor} ref={listCardRef}>
      <div className={styles.listHeader}>
        <h2 className={`${styles.sectionTitle} ${styles.listHeaderTitle}`}>
          {messages.youthPlayerList}
        </h2>
        {youthTeams.length > 1 ? (
          <label className={styles.teamSelectControl}>
            <span className={styles.sortLabel}>{messages.youthTeamLabel}</span>
            <select
              className={styles.sortSelect}
              value={selectedYouthTeamId ?? ""}
              onChange={(event) => {
                const nextId = Number(event.target.value);
                if (Number.isNaN(nextId)) return;
                onTeamChange?.(nextId);
              }}
            >
              {youthTeams.map((team) => (
                <option key={team.youthTeamId} value={team.youthTeamId}>
                  {team.youthTeamName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={styles.listHeaderControls}>
          <label className={styles.sortControl}>
            <span className={styles.sortLabel}>{messages.sortLabel}</span>
            <select
              className={styles.sortSelect}
              value={sortKey}
              onChange={(event) => {
                onSortStart?.();
                const nextKey = event.target.value as SortKey;
                if (nextKey === "custom") return;
                setSortKey(nextKey);
                addNotification(
                  `${messages.notificationSortBy} ${sortLabelForKey(nextKey)}`
                );
              }}
            >
              {isMatrixSortActive && sortKey === "custom" ? (
                <option value="custom" hidden>
                  {messages.sortCustom}
                </option>
              ) : null}
              <option value="name">{messages.sortName}</option>
              <option value="age">{messages.sortAge}</option>
              <option value="promotionAge">{messages.sortPromotionAge}</option>
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
          <Tooltip
            content={messages.sortToggleAria}
          >
            <button
              type="button"
              className={styles.sortToggle}
              aria-label={messages.sortToggleAria}
              onClick={() => {
                onSortStart?.();
                const next = sortDirection === "asc" ? "desc" : "asc";
                setSortDirection(next);
                addNotification(
                  `${messages.notificationSortDirection} ${
                    next === "asc" ? messages.sortAscLabel : messages.sortDescLabel
                  }`
                );
              }}
            >
              {sortDirection === "asc" ? "↕️" : "↕️"}
            </button>
          </Tooltip>
          <Tooltip
            content={messages.refreshPlayerListTooltip}
          >
            <button
              type="button"
              className={styles.sortToggle}
              aria-label={messages.refreshPlayerListTooltip}
              onClick={() => onRefresh?.()}
              disabled={!onRefresh || refreshing}
            >
              ↻
            </button>
          </Tooltip>
          <Tooltip
            content={messages.autoSelectTitle}
          >
            <button
              type="button"
              className={styles.autoSelectButton}
              onClick={onAutoSelect}
              aria-label={messages.autoSelectTitle}
              data-help-anchor="auto-select"
            >
              {messages.autoSelectLabel}
            </button>
          </Tooltip>
        </div>
      </div>
      {activeRefreshStatus ? (
        <p className={styles.listRefreshStatus}>{activeRefreshStatus}</p>
      ) : null}
      {lastGlobalRefreshAt ? (
        <p className={styles.listRefreshStatus}>
          {messages.youthLastGlobalRefresh}: {formatDateTime(lastGlobalRefreshAt)}
        </p>
      ) : null}
      {players.length === 0 ? (
        <p className={styles.muted}>{messages.noYouthPlayers}</p>
      ) : (
        <ul className={styles.list}>
          {orderedPlayers.map((player, index) => {
            const fullName = formatPlayerName(player);
            const isSelected = selectedId === player.YouthPlayerID;
            const isAssigned = assignedIds?.has(player.YouthPlayerID) ?? false;
            const isStar = starPlayerId === player.YouthPlayerID;

            const specialtyEmoji =
              Number(player.Specialty ?? 0) > 0
                ? Number(player.Specialty)
                : Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0
                  ? Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID])
                  : null;
            const isHiddenSpecialty =
              Number(player.Specialty ?? 0) <= 0 && specialtyEmoji !== null;

            return (
              <li key={player.YouthPlayerID} className={styles.listItem}>
                <div className={styles.playerRow}>
                  <Tooltip content={messages.starPlayerLabel}>
                    <button
                      type="button"
                      className={`${styles.starButton} ${
                        isStar ? styles.starButtonActive : ""
                      }`}
                      data-help-anchor={index === 0 ? "star-first" : undefined}
                      onClick={() => {
                        if (!onToggleStar) return;
                        onToggleStar(player.YouthPlayerID);
                      }}
                      aria-label={messages.starPlayerLabel}
                    >
                      ★
                    </button>
                  </Tooltip>
                  <button
                    type="button"
                    className={`${styles.playerButton} ${
                      isAssigned ? styles.playerAssigned : ""
                    }`}
                    onClick={() => {
                      if (!onSelect) return;
                      if (selectedId === player.YouthPlayerID) return;
                      onSelect(player.YouthPlayerID);
                      addNotification(
                        `${messages.notificationPlayerSelected} ${fullName}`
                      );
                    }}
                    onDragStart={(event) =>
                      handleDragStart(event, player.YouthPlayerID)
                    }
                    draggable
                    aria-pressed={isSelected}
                  >
                    <span
                      className={styles.playerSortMetric}
                      ref={(node) => {
                        sortValueRefs.current[player.YouthPlayerID] = node;
                      }}
                    >
                      {sortMetricText(player)}
                    </span>
                    <span
                      className={`${styles.playerNameRow}${
                        nameAgeOverlap[player.YouthPlayerID]
                          ? ` ${styles.playerNameRowTruncate}`
                          : ""
                      }`}
                      ref={(node) => {
                        nameRowRefs.current[player.YouthPlayerID] = node;
                      }}
                    >
                      <span className={styles.playerName}>{fullName}</span>
                      {specialtyEmoji ? (
                        <Tooltip
                          content={
                            isHiddenSpecialty
                              ? `${messages.hiddenSpecialtyTooltip}: ${
                                  specialtyName(specialtyEmoji, messages) ??
                                  messages.specialtyLabel
                                }`
                              : specialtyName(specialtyEmoji, messages) ??
                                messages.specialtyLabel
                          }
                        >
                          <span
                            className={`${styles.playerSpecialty} ${
                              isHiddenSpecialty ? styles.hiddenSpecialtyBadge : ""
                            }`}
                          >
                            {SPECIALTY_EMOJI[specialtyEmoji]}
                          </span>
                        </Tooltip>
                      ) : null}
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
