"use client";

import { useState, type ComponentProps } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import UpcomingMatches from "./UpcomingMatches";
import SeniorTeamSpirit from "./SeniorTeamSpirit";
import type { CoachLeadership } from "@/lib/teamSpirit";

type SeniorMatchesPanelProps = ComponentProps<typeof UpcomingMatches> & {
  currentSeason: number | null;
  selectedSeniorTeamId: number | null;
  defaultCoachLeadership: CoachLeadership | null;
};

export default function SeniorMatchesPanel({
  currentSeason,
  selectedSeniorTeamId,
  defaultCoachLeadership,
  messages,
  onRefresh,
  ...upcomingProps
}: SeniorMatchesPanelProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "teamSpirit">("upcoming");

  return (
    <div className={styles.seniorMatchesPanel}>
      <div className={styles.detailsHeader}>
        <div className={styles.detailsTabs}>
          <button
            type="button"
            className={`${styles.detailsTabButton} ${
              activeTab === "upcoming" ? styles.detailsTabActive : ""
            }`}
            onClick={() => setActiveTab("upcoming")}
          >
            {messages.seniorMatchesUpcomingTab}
          </button>
          <button
            type="button"
            className={`${styles.detailsTabButton} ${
              activeTab === "teamSpirit" ? styles.detailsTabActive : ""
            }`}
            onClick={() => setActiveTab("teamSpirit")}
          >
            {messages.seniorMatchesTeamSpiritTab}
          </button>
        </div>
      </div>
      {activeTab === "upcoming" ? (
        <UpcomingMatches messages={messages as Messages} onRefresh={onRefresh} {...upcomingProps} />
      ) : (
        <SeniorTeamSpirit
          matchesResponse={upcomingProps.response}
          messages={messages}
          teamId={selectedSeniorTeamId}
          currentSeason={currentSeason}
          defaultCoachLeadership={defaultCoachLeadership}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
