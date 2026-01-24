"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { LineupAssignments } from "./LineupField";

type MatchTeam = {
  HomeTeamName?: string;
  AwayTeamName?: string;
  HomeTeamID?: number;
  AwayTeamID?: number;
};

type Match = {
  MatchID: number;
  MatchDate?: string;
  Status?: string;
  OrdersGiven?: string | boolean;
  HomeTeam?: MatchTeam;
  AwayTeam?: MatchTeam;
};

type MatchesResponse = {
  data?: {
    HattrickData?: {
      Team?: {
        TeamID?: number;
        MatchList?: {
          Match?: Match[] | Match;
        };
      };
      MatchList?: {
        Match?: Match[] | Match;
      };
    };
  };
  error?: string;
  details?: string;
};

type UpcomingMatchesProps = {
  response: MatchesResponse;
  messages: Messages;
  assignments: LineupAssignments;
  onRefresh?: () => void;
};

function normalizeMatches(input?: Match[] | Match): Match[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function parseDate(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatMatchDate(dateString?: string, unknownDate: string) {
  const parsed = parseDate(dateString);
  if (!parsed) return unknownDate;
  return parsed.toLocaleString();
}

function sortByDate(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const aTime = parseDate(a.MatchDate)?.getTime() ?? 0;
    const bTime = parseDate(b.MatchDate)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

type MatchState = {
  status: "idle" | "submitting" | "success" | "error";
  error?: string | null;
  raw?: string | null;
  updatedAt?: number | null;
};

const POSITION_SLOT_ORDER = [
  "KP",
  "WB_L",
  "CD_L",
  "CD_C",
  "CD_R",
  "WB_R",
  "W_L",
  "IM_L",
  "IM_C",
  "IM_R",
  "W_R",
  "F_L",
  "F_C",
  "F_R",
] as const;

function buildLineupPayload(assignments: LineupAssignments) {
  const toId = (value: number | null | undefined) => value ?? 0;
  const positions = POSITION_SLOT_ORDER.map((slot) => ({
    id: toId(assignments[slot]),
    behaviour: 0,
  }));

  const bench = Array.from({ length: 14 }, () => ({ id: 0, behaviour: 0 }));
  const kickers = Array.from({ length: 11 }, () => ({ id: 0, behaviour: 0 }));

  return {
    positions,
    bench,
    kickers,
    captain: 0,
    setPieces: 0,
    settings: {
      tactic: 0,
      speechLevel: 0,
      newLineup: "",
      coachModifier: 0,
      manMarkerPlayerId: 0,
      manMarkingPlayerId: 0,
    },
    substitutions: [],
  };
}

function renderMatch(
  match: Match,
  teamId: number | null,
  messages: Messages,
  hasLineup: boolean,
  state: MatchState,
  onSubmit: (matchId: number) => void,
  updatedLabel?: string | null
) {
  const isUpcoming = match.Status === "UPCOMING";
  const canSubmit = Boolean(teamId) && isUpcoming && hasLineup;

  return (
    <li key={match.MatchID} className={styles.matchItem}>
      <div className={styles.matchTeams}>
        <span>{match.HomeTeam?.HomeTeamName ?? messages.homeLabel}</span>
        <span className={styles.vs}>vs</span>
        <span>{match.AwayTeam?.AwayTeamName ?? messages.awayLabel}</span>
      </div>
      <div className={styles.matchMeta}>
        <span>{formatMatchDate(match.MatchDate, messages.unknownDate)}</span>
        <span>
          {messages.statusLabel}: {match.Status ?? messages.unknownLabel}
        </span>
        <span>
          {messages.ordersLabel}: {match.OrdersGiven === "true" || match.OrdersGiven === true
            ? messages.ordersSet
            : messages.ordersNotSet}
        </span>
      </div>
      {isUpcoming ? (
        <div className={styles.matchActions}>
          <button
            type="button"
            className={styles.matchButton}
            onClick={() => onSubmit(match.MatchID)}
            disabled={!canSubmit || state.status === "submitting"}
          >
            {state.status === "submitting"
              ? messages.submitOrdersPending
              : messages.submitOrders}
          </button>
          {state.status === "success" ? (
            <span className={styles.matchSuccess}>
              {messages.submitOrdersSuccess}
            </span>
          ) : null}
          {state.status === "error" ? (
            <span className={styles.matchError}>
              {messages.submitOrdersError}
              {state.error ? `: ${state.error}` : ""}
            </span>
          ) : null}
          {updatedLabel ? (
            <span className={styles.matchUpdated}>{updatedLabel}</span>
          ) : null}
          {state.raw ? (
            <details className={styles.matchResponse}>
              <summary>{messages.submitOrdersResponse}</summary>
              <pre>{state.raw}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function UpcomingMatches({
  response,
  messages,
  assignments,
  onRefresh,
}: UpcomingMatchesProps) {
  const [matchStates, setMatchStates] = useState<Record<number, MatchState>>({});
  const teamId =
    response.data?.HattrickData?.Team?.TeamID ??
    null;
  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const hasLineup = assignedCount >= 9;

  const lineupPayload = useMemo(
    () => buildLineupPayload(assignments),
    [assignments]
  );

  const handleSubmit = async (matchId: number) => {
    if (!teamId) return;
    if (!hasLineup) {
      setMatchStates((prev) => ({
        ...prev,
        [matchId]: {
          status: "error",
          error: messages.submitOrdersMinPlayers,
        },
      }));
      return;
    }
    if (!window.confirm(messages.confirmSubmitOrders)) return;

    setMatchStates((prev) => ({
      ...prev,
      [matchId]: { status: "submitting" },
    }));

    try {
      const response = await fetch("/api/chpp/matchorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          teamId,
          lineup: lineupPayload,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; details?: string; data?: string; raw?: string }
        | null;
      if (!response.ok || payload?.error) {
        const message = payload?.details || payload?.error || "Submit failed";
        throw new Error(message);
      }

      setMatchStates((prev) => ({
        ...prev,
        [matchId]: {
          status: "success",
          raw: payload?.raw ?? null,
          updatedAt: Date.now(),
        },
      }));
      onRefresh?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMatchStates((prev) => ({
        ...prev,
        [matchId]: {
          status: "error",
          error: message,
          raw: null,
          updatedAt: null,
        },
      }));
    }
  };
  if (response.error) {
    return (
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
        <p className={styles.errorText}>{messages.unableToLoadMatches}</p>
        {response.details ? (
          <p className={styles.errorDetails}>{response.details}</p>
        ) : null}
      </div>
    );
  }

  const allMatches = normalizeMatches(
    response.data?.HattrickData?.MatchList?.Match ??
      response.data?.HattrickData?.Team?.MatchList?.Match
  );
  const upcoming = allMatches.filter((match) => match.Status === "UPCOMING");
  const sortedUpcoming = sortByDate(upcoming);
  const sortedAll = sortByDate(allMatches);

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
      {sortedUpcoming.length > 0 ? (
        <ul className={styles.matchList}>
          {sortedUpcoming.map((match) => {
            const state = matchStates[match.MatchID] ?? { status: "idle" };
            const updatedLabel =
              state.updatedAt &&
              `${messages.submitOrdersUpdated}: ${new Date(
                state.updatedAt
              ).toLocaleTimeString()}`;
            return renderMatch(
              match,
              teamId,
              messages,
              hasLineup,
              state,
              handleSubmit,
              updatedLabel
            );
          })}
        </ul>
      ) : sortedAll.length > 0 ? (
        <>
          <p className={styles.muted}>{messages.noUpcomingMatches}</p>
          <ul className={styles.matchList}>
            {sortedAll.map((match) => {
              const state = matchStates[match.MatchID] ?? { status: "idle" };
              const updatedLabel =
                state.updatedAt &&
                `${messages.submitOrdersUpdated}: ${new Date(
                  state.updatedAt
                ).toLocaleTimeString()}`;
              return renderMatch(
                match,
                teamId,
                messages,
                hasLineup,
                state,
                handleSubmit,
                updatedLabel
              );
            })}
          </ul>
        </>
      ) : (
        <p className={styles.muted}>{messages.noMatchesReturned}</p>
      )}
    </div>
  );
}
