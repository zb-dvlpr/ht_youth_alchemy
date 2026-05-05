"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { POSITION_COLUMNS, positionLabel } from "@/lib/positions";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { hattrickMatchUrlWithSourceSystem } from "@/lib/hattrick/urls";
import { formatDateTime } from "@/lib/datetime";
import Tooltip from "./Tooltip";

type RatingRow = {
  id: number;
  name: string;
  ratings: Record<string, number>;
  ratingMatchIds?: Record<string, number>;
  ratingMatchSourceSystems?: Record<string, string>;
};

export type RatingsMatrixResponse = {
  ratingsAlgorithmVersion?: number;
  positions: number[];
  players: RatingRow[];
  matchesAnalyzed?: number;
  lastAppliedMatchId?: number | null;
  lastAppliedMatchDateTime?: number | null;
  lastAppliedMatchSourceSystem?: string | null;
};

type RatingsMatrixProps = {
  response: RatingsMatrixResponse | null;
  showTitle?: boolean;
  messages: Messages;
  matchHrefBuilder?: (matchId: number) => string;
  specialtyByName?: Record<string, number | undefined>;
  hiddenSpecialtyByName?: Record<string, boolean>;
  hiddenSpecialtyMatchHrefByName?: Record<string, string | undefined>;
  motherClubBonusByName?: Record<string, boolean>;
  injuryStatusByName?: Record<string, { display: string; label: string; isHealthy: boolean }>;
  cardStatusByName?: Record<string, { display: string; label: string }>;
  newPlayerIds?: number[];
  newRatingsByPlayerId?: Record<number, number[]>;
  selectedName?: string | null;
  onSelectPlayer?: (playerName: string) => void;
  onPlayerDragStart?: (
    event: React.DragEvent<HTMLElement>,
    playerId: number,
    playerName: string
  ) => void;
  playerNameTooltip?: string;
  overallSkillLevelByPlayerId?: Record<number, number>;
  orderedPlayerIds?: number[] | null;
  orderSource?: "list" | "ratings" | "skills" | null;
  onOrderChange?: (orderedIds: number[]) => void;
  onSortStart?: () => void;
  manualEditingEnabled?: boolean;
  onManualEditingEnabledChange?: (enabled: boolean) => void;
  overwriteManualEditsEnabled?: boolean;
  onOverwriteManualEditsEnabledChange?: (enabled: boolean) => void;
  onDiscardManualEdits?: () => void;
  hasManualEdits?: boolean;
  onManualRatingChange?: (playerId: number, position: number, value: number | null) => void;
  manualEditedRatingsByPlayerId?: Record<number, Record<string, number>>;
};

function uniquePositions(positions: number[] | undefined) {
  if (!positions || positions.length === 0) return POSITION_COLUMNS;
  return POSITION_COLUMNS.filter((code) => positions.includes(code));
}

function formatRating(value: number | null) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(1);
}

function ratingStyle(value: number | null) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const normalized = Math.min(Math.max((value - 1) / 6, 0), 1);
  const hue = 120 * normalized;
  const alpha = 0.2 + normalized * 0.35;
  return {
    backgroundColor: `hsla(${hue}, 70%, 38%, ${alpha})`,
  } as React.CSSProperties;
}

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

export default function RatingsMatrix({
  response,
  showTitle = true,
  messages,
  matchHrefBuilder,
  specialtyByName,
  hiddenSpecialtyByName,
  hiddenSpecialtyMatchHrefByName,
  motherClubBonusByName,
  injuryStatusByName,
  cardStatusByName,
  newPlayerIds = [],
  newRatingsByPlayerId = {},
  selectedName,
  onSelectPlayer,
  onPlayerDragStart,
  playerNameTooltip,
  overallSkillLevelByPlayerId = {},
  orderedPlayerIds,
  orderSource,
  onOrderChange,
  onSortStart,
  manualEditingEnabled = false,
  onManualEditingEnabledChange,
  overwriteManualEditsEnabled = false,
  onOverwriteManualEditsEnabledChange,
  onDiscardManualEdits,
  hasManualEdits = false,
  onManualRatingChange,
  manualEditedRatingsByPlayerId = {},
}: RatingsMatrixProps) {
  const newPlayerIdSet = useMemo(() => new Set(newPlayerIds), [newPlayerIds]);
  const players = useMemo(() => response?.players ?? [], [response?.players]);
  const positions = useMemo(
    () => uniquePositions(response?.positions),
    [response?.positions]
  );
  const matchesAnalyzed = useMemo(() => {
    if (
      typeof response?.matchesAnalyzed === "number" &&
      Number.isFinite(response.matchesAnalyzed)
    ) {
      return Math.max(0, Math.floor(response.matchesAnalyzed));
    }
    const derived = new Set<number>();
    (response?.players ?? []).forEach((row) => {
      if (!row.ratingMatchIds) return;
      Object.values(row.ratingMatchIds).forEach((matchId) => {
        if (typeof matchId === "number" && Number.isFinite(matchId) && matchId > 0) {
          derived.add(matchId);
        }
      });
    });
    return derived.size;
  }, [response]);
  const lastAppliedFooterParts = useMemo(() => {
    const matchId = response?.lastAppliedMatchId;
    const matchDateTime = response?.lastAppliedMatchDateTime;
    if (
      typeof matchId !== "number" ||
      !Number.isFinite(matchId) ||
      matchId <= 0 ||
      typeof matchDateTime !== "number" ||
      !Number.isFinite(matchDateTime) ||
      matchDateTime <= 0
    ) {
      return null;
    }
    const dateTimeLabel = formatDateTime(matchDateTime);
    const template = messages.ratingsLastAppliedMatchLabel;
    const token = "{matchId}";
    const tokenIndex = template.indexOf(token);
    const href = matchHrefBuilder
      ? matchHrefBuilder(matchId)
      : hattrickMatchUrlWithSourceSystem(
          matchId,
          response?.lastAppliedMatchSourceSystem
        );
    if (tokenIndex < 0) {
      const resolved = template.replace("{dateTime}", dateTimeLabel);
      return {
        href,
        matchId: Math.floor(matchId),
        before: `${resolved} `,
        after: "",
      };
    }
    const before = template
      .slice(0, tokenIndex)
      .replace("{dateTime}", dateTimeLabel);
    const after = template
      .slice(tokenIndex + token.length)
      .replace("{dateTime}", dateTimeLabel);
    return {
      href,
      matchId: Math.floor(matchId),
      before,
      after,
    };
  }, [
    matchHrefBuilder,
    messages.ratingsLastAppliedMatchLabel,
    response?.lastAppliedMatchDateTime,
    response?.lastAppliedMatchId,
    response?.lastAppliedMatchSourceSystem,
  ]);
  const [sortKey, setSortKey] = useState<number | "name" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const pendingSortRef = useRef(false);

  const sortedByRating = useMemo(() => {
    if (!sortKey) return players;
    const direction = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") {
      return [...players].sort((a, b) =>
        a.name.localeCompare(b.name) * direction
      );
    }
    return [...players].sort((a, b) => {
      const aVal = a.ratings[String(sortKey)];
      const bVal = b.ratings[String(sortKey)];
      const aNum = typeof aVal === "number" ? aVal : null;
      const bNum = typeof bVal === "number" ? bVal : null;
      if (aNum === null && bNum === null) return 0;
      if (aNum === null) return 1;
      if (bNum === null) return -1;
      return (aNum - bNum) * direction;
    });
  }, [players, sortDir, sortKey]);

  const orderedRows = useMemo(() => {
    if (
      orderedPlayerIds &&
      orderSource &&
      (orderSource !== "ratings" || !sortKey)
    ) {
      const map = new Map(players.map((row) => [row.id, row]));
      return orderedPlayerIds
        .map((id) => map.get(id))
        .filter((row): row is RatingRow => Boolean(row));
    }
    if (!sortKey) return players;
    return sortedByRating;
  }, [orderSource, orderedPlayerIds, players, sortKey, sortedByRating]);

  useEffect(() => {
    if (!onOrderChange) return;
    if (!sortKey) return;
    if (orderSource && orderSource !== "ratings") return;
    const nextOrder = sortedByRating.map((row) => row.id);
    if (
      orderedPlayerIds &&
      orderedPlayerIds.length === nextOrder.length &&
      orderedPlayerIds.every((id, index) => id === nextOrder[index])
    ) {
      return;
    }
    onOrderChange(nextOrder);
  }, [
    onOrderChange,
    sortKey,
    sortDir,
    sortedByRating,
    orderSource,
    orderedPlayerIds,
  ]);

  const handleSort = (position: number | "name") => {
    pendingSortRef.current = true;
    onSortStart?.();
    if (sortKey === position) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(position);
      setSortDir("desc");
    }
  };

  const handleManualInputCommit = (
    playerId: number,
    position: number,
    rawValue: string
  ) => {
    if (!onManualRatingChange) return;
    const trimmed = rawValue.trim();
    if (!trimmed) {
      onManualRatingChange(playerId, position, null);
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(25, Math.max(0, Math.round(parsed * 10) / 10));
    onManualRatingChange(playerId, position, clamped);
  };

  useEffect(() => {
    if (orderSource && orderSource !== "ratings" && sortKey !== null) {
      if (pendingSortRef.current) {
        pendingSortRef.current = false;
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSortKey(null);
    }
    if (orderSource === "ratings") {
      pendingSortRef.current = false;
    }
  }, [orderSource, sortKey]);

  if (players.length === 0) {
    return (
      <div className={styles.card}>
        {showTitle ? (
          <h2 className={styles.sectionTitle}>{messages.ratingsTitle}</h2>
        ) : null}
        <p className={styles.muted}>{messages.noMatchesReturned}</p>
      </div>
    );
  }

  return (
    <div className={showTitle ? styles.card : undefined}>
      {showTitle ? (
        <h2 className={styles.sectionTitle}>{messages.ratingsTitle}</h2>
      ) : null}
      {onManualEditingEnabledChange ? (
        <div className={styles.ratingsMatrixControls}>
          <Tooltip content={messages.ratingsManualOverrideTooltip}>
            <label className={styles.matchesFilterToggle}>
              <input
                type="checkbox"
                className={styles.matchesFilterToggleInput}
                checked={manualEditingEnabled}
                onChange={(event) =>
                  onManualEditingEnabledChange(event.currentTarget.checked)
                }
              />
              <span className={styles.matchesFilterToggleTrack} aria-hidden="true" />
              <span className={styles.matchesFilterToggleLabel}>
                {messages.ratingsManualOverrideToggle}
              </span>
            </label>
          </Tooltip>
          <Tooltip content={messages.ratingsOverwriteManualEditsTooltip}>
            <label className={styles.matchesFilterToggle}>
              <input
                type="checkbox"
                className={styles.matchesFilterToggleInput}
                checked={overwriteManualEditsEnabled}
                disabled={!hasManualEdits}
                onChange={(event) =>
                  onOverwriteManualEditsEnabledChange?.(event.currentTarget.checked)
                }
              />
              <span className={styles.matchesFilterToggleTrack} aria-hidden="true" />
              <span className={styles.matchesFilterToggleLabel}>
                {messages.ratingsOverwriteManualEditsToggle}
              </span>
            </label>
          </Tooltip>
          <button
            type="button"
            className={styles.settingsActionButton}
            onClick={() => onDiscardManualEdits?.()}
            disabled={!hasManualEdits}
          >
            {messages.ratingsDiscardManualEditsButton}
          </button>
        </div>
      ) : null}
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.matrixIndexHeader}>
                {messages.ratingsIndexLabel}
              </th>
              <th className={styles.matrixPlayerHeader}>
                <button
                  type="button"
                  className={styles.matrixSortButton}
                  onClick={() => handleSort("name")}
                  aria-label={`${messages.ratingsSortBy} ${messages.ratingsPlayerLabel}`}
                >
                  {messages.ratingsPlayerLabel}
                  <span className={styles.matrixSortIcon}>
                    {sortKey === "name"
                      ? sortDir === "asc"
                        ? "▲"
                        : "▼"
                      : "⇅"}
                  </span>
                </button>
              </th>
              <th className={styles.matrixSpecialtyHeader}>
                {messages.ratingsSpecialtyLabel}
              </th>
              {positions.map((position) => {
                const isActive = sortKey === position;
                const direction = isActive ? sortDir : "desc";
                return (
                  <th key={position}>
                    <button
                      type="button"
                      className={styles.matrixSortButton}
                      onClick={() => handleSort(position)}
                      aria-label={`${messages.ratingsSortBy} ${positionLabel(
                        position,
                        messages
                      )}`}
                    >
                      {positionLabel(position, messages)}
                      <span className={styles.matrixSortIcon}>
                        {isActive ? (direction === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {orderedRows.map((row, index) => {
              const isSelected = selectedName === row.name;
              const isNewPlayer = newPlayerIdSet.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={`${styles.matrixRow} ${
                    isSelected ? styles.matrixRowSelected : ""
                  }`}
                >
                <td className={styles.matrixIndex}>{index + 1}</td>
                <td className={styles.matrixPlayer}>
                  <div className={styles.matrixPlayerContent}>
                    {onPlayerDragStart ? (
                      <Tooltip content={playerNameTooltip ?? messages.dragPlayerHint}>
                        <button
                          type="button"
                          className={styles.matrixPlayerButton}
                          onClick={() => onSelectPlayer?.(row.name)}
                          disabled={!onSelectPlayer}
                          draggable
                          onDragStart={(event) =>
                            onPlayerDragStart(event, row.id, row.name)
                          }
                        >
                          {row.name}
                        </button>
                      </Tooltip>
                    ) : (
                      <button
                        type="button"
                        className={styles.matrixPlayerButton}
                        onClick={() => onSelectPlayer?.(row.name)}
                        disabled={!onSelectPlayer}
                      >
                        {row.name}
                      </button>
                    )}
                    {motherClubBonusByName?.[row.name] ? (
                      <Tooltip content={messages.motherClubBonusTooltip}>
                        <span
                          className={styles.seniorMotherClubHeart}
                          aria-label={messages.motherClubBonusTooltip}
                        >
                          ❤
                        </span>
                      </Tooltip>
                    ) : null}
                    {injuryStatusByName?.[row.name] ? (
                      <span
                        className={
                          injuryStatusByName[row.name].isHealthy
                            ? styles.matrixInjuryHealthy
                            : styles.matrixInjuryStatus
                        }
                        title={injuryStatusByName[row.name].label}
                      >
                        {injuryStatusByName[row.name].display}
                      </span>
                    ) : null}
                    {cardStatusByName?.[row.name] ? (
                      <span
                        className={styles.matrixCardStatus}
                        title={cardStatusByName[row.name].label}
                        aria-label={cardStatusByName[row.name].label}
                      >
                        {cardStatusByName[row.name].display}
                      </span>
                    ) : null}
                    {isNewPlayer ? (
                      <span className={styles.matrixNewPill}>
                        {messages.matrixNewPillLabel}
                      </span>
                    ) : null}
                    {typeof overallSkillLevelByPlayerId[row.id] === "number" ? (
                      <Tooltip content={messages.scoutOverallSkillLevelTooltip}>
                        <span className={styles.matrixScoutOverallBadge}>
                          {overallSkillLevelByPlayerId[row.id]}
                        </span>
                      </Tooltip>
                    ) : null}
                  </div>
                </td>
                <td className={styles.matrixSpecialty}>
                  {specialtyByName && specialtyByName[row.name] !== undefined ? (
                    <Tooltip
                      content={
                        hiddenSpecialtyByName?.[row.name]
                          ? `${messages.hiddenSpecialtyTooltip}: ${
                              specialtyName(specialtyByName[row.name], messages) ??
                              messages.specialtyLabel
                            } (${messages.hiddenSpecialtyTooltipLinkHint})`
                          : specialtyName(specialtyByName[row.name], messages) ??
                            messages.specialtyLabel
                      }
                    >
                      {hiddenSpecialtyByName?.[row.name] &&
                      hiddenSpecialtyMatchHrefByName?.[row.name] ? (
                        <a
                          className={styles.specialtyDiscoveryLink}
                          href={hiddenSpecialtyMatchHrefByName[row.name]}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span
                            className={`${styles.playerSpecialty} ${
                              hiddenSpecialtyByName?.[row.name]
                                ? styles.hiddenSpecialtyBadge
                                : ""
                            }`}
                          >
                            {SPECIALTY_EMOJI[specialtyByName[row.name] as number] ?? "—"}
                          </span>
                        </a>
                      ) : (
                        <span
                          className={`${styles.playerSpecialty} ${
                            hiddenSpecialtyByName?.[row.name]
                              ? styles.hiddenSpecialtyBadge
                              : ""
                          }`}
                        >
                          {SPECIALTY_EMOJI[specialtyByName[row.name] as number] ?? "—"}
                        </span>
                      )}
                    </Tooltip>
                  ) : (
                    "—"
                  )}
                </td>
                {positions.map((position) => {
                  const rating = row.ratings[String(position)] ?? null;
                  const ratingMatchId = row.ratingMatchIds?.[String(position)];
                  const ratingMatchSourceSystem =
                    row.ratingMatchSourceSystems?.[String(position)];
                  const isManuallyEdited =
                    typeof manualEditedRatingsByPlayerId[row.id]?.[String(position)] ===
                    "number";
                  const isNewRating =
                    newRatingsByPlayerId[row.id]?.includes(position) ?? false;
                  return (
                    <td
                      key={position}
                      className={`${styles.matrixCell} ${
                        isNewRating ? styles.matrixCellHasNew : ""
                      } ${isManuallyEdited ? styles.matrixCellManualEdited : ""}${
                        manualEditingEnabled ? ` ${styles.matrixCellManualEditing}` : ""
                      }`}
                      style={ratingStyle(rating)}
                    >
                      {isNewRating ? (
                        <Tooltip content={messages.matrixNewNTooltip}>
                          <span className={styles.matrixCellNewTag}>N</span>
                        </Tooltip>
                      ) : null}
                      {manualEditingEnabled ? (
                        <span
                          className={styles.matrixCellManualEditingCaret}
                          aria-hidden="true"
                        />
                      ) : null}
                      {isManuallyEdited ? (
                        <span
                          className={styles.matrixCellManualEditedIcon}
                          aria-label={messages.ratingsManualEditedIndicator}
                          title={messages.ratingsManualEditedIndicator}
                        >
                          ✎
                        </span>
                      ) : null}
                      {manualEditingEnabled && onManualRatingChange ? (
                        <input
                          key={`${row.id}-${position}-${rating ?? "empty"}-edit`}
                          type="text"
                          inputMode="decimal"
                          className={styles.ratingsMatrixManualInput}
                          defaultValue={rating !== null ? String(Number(rating.toFixed(1))) : ""}
                          aria-label={messages.ratingsManualEditCellLabel
                            .replace("{player}", row.name)
                            .replace("{position}", positionLabel(position, messages))}
                          onBlur={(event) =>
                            handleManualInputCommit(row.id, position, event.currentTarget.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                            if (event.key === "Escape") {
                              event.currentTarget.value =
                                rating !== null ? String(Number(rating.toFixed(1))) : "";
                              event.currentTarget.blur();
                            }
                          }}
                        />
                      ) : rating !== null && Number.isFinite(ratingMatchId) ? (
                        <a
                          className={styles.matrixRatingLink}
                          href={
                            matchHrefBuilder
                              ? matchHrefBuilder(ratingMatchId as number)
                              : hattrickMatchUrlWithSourceSystem(
                                  ratingMatchId as number,
                                  ratingMatchSourceSystem
                                )
                          }
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${messages.lastMatchRatingLabel}: ${formatRating(
                            rating
                          )}`}
                        >
                          <span className={styles.matrixValueWithFlag}>
                            <span>{formatRating(rating)}</span>
                          </span>
                        </a>
                      ) : (
                        <span className={styles.matrixValueWithFlag}>
                          <span>{formatRating(rating)}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
      {matchesAnalyzed !== null ? (
        <p className={styles.muted}>
          {messages.ratingsMatchesAnalyzed.replace("{count}", String(matchesAnalyzed))}
        </p>
      ) : null}
      {lastAppliedFooterParts ? (
        <p className={styles.muted}>
          {lastAppliedFooterParts.before}
          <a
            className={`${styles.matrixRatingLink} ${styles.matrixFooterLink}`}
            href={lastAppliedFooterParts.href}
            target="_blank"
            rel="noreferrer"
          >
            {lastAppliedFooterParts.matchId}
          </a>
          {lastAppliedFooterParts.after}
        </p>
      ) : null}
    </div>
  );
}
