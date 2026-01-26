"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { POSITION_COLUMNS, positionLabel } from "@/lib/positions";
import { SPECIALTY_EMOJI } from "@/lib/specialty";

type RatingRow = {
  id: number;
  name: string;
  ratings: Record<string, number>;
};

export type RatingsMatrixResponse = {
  positions: number[];
  players: RatingRow[];
};

type RatingsMatrixProps = {
  response: RatingsMatrixResponse | null;
  messages: Messages;
  specialtyByName?: Record<string, number | undefined>;
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

export default function RatingsMatrix({
  response,
  messages,
  specialtyByName,
}: RatingsMatrixProps) {
  if (!response || response.players.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{messages.ratingsTitle}</h2>
        <p className={styles.muted}>{messages.noMatchesReturned}</p>
      </div>
    );
  }

  const positions = uniquePositions(response.positions);
  const [sortKey, setSortKey] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return response.players;
    const direction = sortDir === "asc" ? 1 : -1;
    return [...response.players].sort((a, b) => {
      const aVal = a.ratings[String(sortKey)];
      const bVal = b.ratings[String(sortKey)];
      const aNum = typeof aVal === "number" ? aVal : null;
      const bNum = typeof bVal === "number" ? bVal : null;
      if (aNum === null && bNum === null) return 0;
      if (aNum === null) return 1;
      if (bNum === null) return -1;
      return (aNum - bNum) * direction;
    });
  }, [response.players, sortDir, sortKey]);

  const handleSort = (position: number) => {
    if (sortKey === position) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(position);
      setSortDir("desc");
    }
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>{messages.ratingsTitle}</h2>
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.matrixIndexHeader}>
                {messages.ratingsIndexLabel}
              </th>
              <th className={styles.matrixPlayerHeader}>
                {messages.ratingsPlayerLabel}
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
            {sortedRows.map((row, index) => (
              <tr key={row.id}>
                <td className={styles.matrixIndex}>{index + 1}</td>
                <td className={styles.matrixPlayer}>{row.name}</td>
                <td className={styles.matrixSpecialty}>
                  {specialtyByName && specialtyByName[row.name] !== undefined
                    ? SPECIALTY_EMOJI[specialtyByName[row.name] as number] ?? "—"
                    : "—"}
                </td>
                {positions.map((position) => {
                  const rating = row.ratings[String(position)] ?? null;
                  return (
                    <td
                      key={position}
                      className={styles.matrixCell}
                      style={ratingStyle(rating)}
                    >
                      {formatRating(rating)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
