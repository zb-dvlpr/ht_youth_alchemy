"use client";

import { type ReactNode } from "react";
import styles from "../page.module.css";

export function MobileMenuDivider() {
  return <div className={styles.mobileYouthMenuDivider} />;
}

export function MobileMenuAction({
  children,
  active = false,
  disabled = false,
  title,
  ariaLabel,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.mobileYouthMenuAction} ${
        active ? styles.mobileYouthMenuActionActive : ""
      }`}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function MobileMenuTeamSwitcher({
  label,
  teamOptions,
  selectedTeamId,
  onTeamChange,
}: {
  label: string;
  teamOptions: { id: number; label: string }[];
  selectedTeamId: number | null;
  onTeamChange: (teamId: number) => void;
}) {
  if (teamOptions.length <= 1) return null;

  return (
    <label className={styles.mobileYouthMenuField}>
      <span className={styles.mobileYouthMenuLabel}>{label}</span>
      <select
        className={styles.mobileYouthMenuSelect}
        value={selectedTeamId ?? ""}
        onChange={(event) => {
          const nextId = Number(event.target.value);
          if (Number.isNaN(nextId)) return;
          onTeamChange(nextId);
        }}
      >
        {teamOptions.map((team) => (
          <option key={team.id} value={team.id}>
            {team.label}
          </option>
        ))}
      </select>
    </label>
  );
}
