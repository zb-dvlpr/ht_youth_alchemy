"use client";

import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import MobileFloatingActionMenu from "./MobileFloatingActionMenu";

export type MobileToolView =
  | "playerDetails"
  | "skillsMatrix"
  | "ratingsMatrix"
  | "lineupOptimizer"
  | "help";

type MobileToolMenuProps = {
  messages: Messages;
  toggleLabel: string;
  teamLabel: string;
  teamOptions: { id: number; label: string }[];
  selectedTeamId: number | null;
  onHome: () => void;
  onOpenHelp: () => void;
  onOpenPlayerList: () => void;
  onTeamChange: (teamId: number) => void;
  onRefresh: () => void;
  onOpenUpdates: () => void;
  activeView: MobileToolView;
  playerListActive?: boolean;
  onSelectView: (view: MobileToolView) => void;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
};

export default function MobileToolMenu({
  messages,
  toggleLabel,
  teamLabel,
  teamOptions,
  selectedTeamId,
  onHome,
  onOpenHelp,
  onOpenPlayerList,
  onTeamChange,
  onRefresh,
  onOpenUpdates,
  activeView,
  playerListActive = false,
  onSelectView,
  position,
  onPositionChange,
}: MobileToolMenuProps) {
  const openManual = () => {
    window.dispatchEvent(new CustomEvent("ya:manual-open"));
  };

  return (
    <MobileFloatingActionMenu
      toggleLabel={toggleLabel}
      position={position}
      onPositionChange={onPositionChange}
    >
      {({ closeMenu }) => (
        <>
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={() => {
              onHome();
              closeMenu();
            }}
          >
            {messages.mobileHomeLabel}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "help" ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => {
              onOpenHelp();
              closeMenu();
            }}
          >
            {messages.mobileHelpLabel}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          {teamOptions.length > 1 ? (
            <label className={styles.mobileYouthMenuField}>
              <span className={styles.mobileYouthMenuLabel}>{teamLabel}</span>
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
          ) : null}
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={() => {
              onRefresh();
              closeMenu();
            }}
          >
            {messages.refresh}
          </button>
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={() => {
              onOpenUpdates();
              closeMenu();
            }}
          >
            {messages.clubChronicleUpdatesTitle}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              playerListActive ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => {
              onOpenPlayerList();
              closeMenu();
            }}
          >
            {messages.mobilePlayerListLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "playerDetails" && !playerListActive
                ? styles.mobileYouthMenuActionActive
                : ""
            }`}
            onClick={() => {
              onSelectView("playerDetails");
              closeMenu();
            }}
          >
            {messages.detailsTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "skillsMatrix" ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => {
              onSelectView("skillsMatrix");
              closeMenu();
            }}
          >
            {messages.skillsMatrixTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "ratingsMatrix" ? styles.mobileYouthMenuActionActive : ""
            }`}
            onClick={() => {
              onSelectView("ratingsMatrix");
              closeMenu();
            }}
          >
            {messages.ratingsMatrixTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.mobileYouthMenuAction} ${
              activeView === "lineupOptimizer"
                ? styles.mobileYouthMenuActionActive
                : ""
            }`}
            onClick={() => {
              onSelectView("lineupOptimizer");
              closeMenu();
            }}
          >
            {messages.lineupTitle}
          </button>
          <div className={styles.mobileYouthMenuDivider} />
          <button
            type="button"
            className={styles.mobileYouthMenuAction}
            onClick={() => {
              openManual();
              closeMenu();
            }}
          >
            {messages.helpMenuManual}
          </button>
        </>
      )}
    </MobileFloatingActionMenu>
  );
}
