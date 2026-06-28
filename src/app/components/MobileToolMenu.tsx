"use client";

import { Messages } from "@/lib/i18n";
import { MANUAL_OPEN_EVENT } from "@/lib/mobileShellEvents";
import MobileFloatingActionMenu from "./MobileFloatingActionMenu";
import {
  MobileMenuAction,
  MobileMenuDivider,
  MobileMenuTeamSwitcher,
} from "./MobileFloatingMenuSections";

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
    window.dispatchEvent(new CustomEvent(MANUAL_OPEN_EVENT));
  };

  return (
    <MobileFloatingActionMenu
      toggleLabel={toggleLabel}
      position={position}
      onPositionChange={onPositionChange}
    >
      {({ closeMenu }) => (
        <>
          <MobileMenuAction
            onClick={() => {
              onHome();
              closeMenu();
            }}
          >
            {messages.mobileHomeLabel}
          </MobileMenuAction>
          <MobileMenuDivider />
          <MobileMenuAction
            active={activeView === "help"}
            onClick={() => {
              onOpenHelp();
              closeMenu();
            }}
          >
            {messages.mobileHelpLabel}
          </MobileMenuAction>
          <MobileMenuDivider />
          <MobileMenuTeamSwitcher
            label={teamLabel}
            teamOptions={teamOptions}
            selectedTeamId={selectedTeamId}
            onTeamChange={onTeamChange}
          />
          <MobileMenuDivider />
          <MobileMenuAction
            onClick={() => {
              onRefresh();
              closeMenu();
            }}
          >
            {messages.refresh}
          </MobileMenuAction>
          <MobileMenuAction
            onClick={() => {
              onOpenUpdates();
              closeMenu();
            }}
          >
            {messages.clubChronicleUpdatesTitle}
          </MobileMenuAction>
          <MobileMenuDivider />
          <MobileMenuAction
            active={playerListActive}
            onClick={() => {
              onOpenPlayerList();
              closeMenu();
            }}
          >
            {messages.mobilePlayerListLabel}
          </MobileMenuAction>
          <MobileMenuAction
            active={
              activeView === "playerDetails" && !playerListActive
            }
            onClick={() => {
              onSelectView("playerDetails");
              closeMenu();
            }}
          >
            {messages.detailsTabLabel}
          </MobileMenuAction>
          <MobileMenuAction
            active={activeView === "skillsMatrix"}
            onClick={() => {
              onSelectView("skillsMatrix");
              closeMenu();
            }}
          >
            {messages.skillsMatrixTabLabel}
          </MobileMenuAction>
          <MobileMenuAction
            active={activeView === "ratingsMatrix"}
            onClick={() => {
              onSelectView("ratingsMatrix");
              closeMenu();
            }}
          >
            {messages.ratingsMatrixTabLabel}
          </MobileMenuAction>
          <MobileMenuAction
            active={activeView === "lineupOptimizer"}
            onClick={() => {
              onSelectView("lineupOptimizer");
              closeMenu();
            }}
          >
            {messages.lineupTitle}
          </MobileMenuAction>
          <MobileMenuDivider />
          <MobileMenuAction
            onClick={() => {
              openManual();
              closeMenu();
            }}
          >
            {messages.helpMenuManual}
          </MobileMenuAction>
        </>
      )}
    </MobileFloatingActionMenu>
  );
}
