"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { LineupAssignments } from "./LineupField";
import { roleIdToSlotId } from "@/lib/positions";
import { useNotifications } from "./notifications/NotificationsProvider";

export type MatchTeam = {
  HomeTeamName?: string;
  AwayTeamName?: string;
  HomeTeamID?: number;
  AwayTeamID?: number;
};

export type Match = {
  MatchID: number;
  MatchDate?: string;
  Status?: string;
  OrdersGiven?: string | boolean;
  HomeTeam?: MatchTeam;
  AwayTeam?: MatchTeam;
};

export type MatchesResponse = {
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
  onLoadLineup?: (assignments: LineupAssignments, matchId: number) => void;
  loadedMatchId?: number | null;
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

function formatMatchDate(dateString: string | undefined, unknownDate: string) {
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

type LoadState = {
  status: "idle" | "loading" | "error";
  error?: string | null;
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
  matchId: number,
  match: Match,
  teamId: number | null,
  messages: Messages,
  hasLineup: boolean,
  state: MatchState,
  onSubmit: (matchId: number) => void,
  updatedLabel?: string | null,
  loadState?: LoadState,
  onLoadLineup?: (matchId: number) => void,
  isLoaded?: boolean,
  assignedCount?: number
) {
  const isUpcoming = match.Status === "UPCOMING";
  const canSubmit = Boolean(teamId) && isUpcoming && hasLineup;
  const ordersSet =
    match.OrdersGiven === "true" ||
    match.OrdersGiven === "True" ||
    match.OrdersGiven === true;
  const canLoad = Boolean(teamId) && isUpcoming && ordersSet;
  const statusText =
    match.Status === "UPCOMING"
      ? messages.matchStatusUpcoming
      : match.Status === "FINISHED"
      ? messages.matchStatusFinished
      : match.Status === "ONGOING"
      ? messages.matchStatusOngoing
      : match.Status ?? messages.unknownLabel;
  const lineupIssue =
    assignedCount && assignedCount > 11
      ? messages.submitOrdersMaxPlayers
      : assignedCount && assignedCount < 9
      ? messages.submitOrdersMinPlayers
      : null;

  return (
    <li key={matchId} className={styles.matchItem}>
      <div className={styles.matchTeams}>
        <span>{match.HomeTeam?.HomeTeamName ?? messages.homeLabel}</span>
        <span className={styles.vs}>vs</span>
        <span>{match.AwayTeam?.AwayTeamName ?? messages.awayLabel}</span>
      </div>
      <div className={styles.matchMeta}>
        <span>{formatMatchDate(match.MatchDate, messages.unknownDate)}</span>
        <span>
          {messages.statusLabel}: {statusText}
        </span>
        <span>
          {messages.ordersLabel}: {ordersSet ? messages.ordersSet : messages.ordersNotSet}
        </span>
      </div>
      {isUpcoming ? (
        <div className={styles.matchActions}>
          <Tooltip content={<div className={styles.tooltipCard}>{messages.loadLineupTooltip}</div>}>
            <button
              type="button"
              className={styles.matchButtonSecondary}
              onClick={() => onLoadLineup?.(matchId)}
              disabled={!canLoad || loadState?.status === "loading"}
              aria-label={messages.loadLineupTooltip}
            >
              {loadState?.status === "loading"
                ? messages.loadLineupLoading
                : messages.loadLineup}
            </button>
          </Tooltip>
          <Tooltip content={<div className={styles.tooltipCard}>{messages.submitOrdersTooltip}</div>}>
            <button
              type="button"
              className={styles.matchButton}
              onClick={() => onSubmit(matchId)}
              disabled={!canSubmit || state.status === "submitting"}
              aria-label={messages.submitOrdersTooltip}
              data-help-anchor="submit"
            >
              {state.status === "submitting"
                ? messages.submitOrdersPending
                : messages.submitOrders}
            </button>
          </Tooltip>
          {state.status === "success" ? (
            <span className={styles.matchSuccess}>
              {messages.submitOrdersSuccess}
            </span>
          ) : null}
          {loadState?.status === "error" ? (
            <span className={styles.matchError}>
              {messages.loadLineupError}
              {loadState.error ? `: ${loadState.error}` : ""}
            </span>
          ) : null}
          {state.status === "error" ? (
            <span className={styles.matchError}>
              {messages.submitOrdersError}
              {state.error ? `: ${state.error}` : ""}
            </span>
          ) : null}
          {!canSubmit && isUpcoming && lineupIssue ? (
            <span className={styles.matchError}>{lineupIssue}</span>
          ) : null}
          {updatedLabel ? (
            <span className={styles.matchUpdated}>{updatedLabel}</span>
          ) : null}
          {isLoaded ? (
            <span className={styles.matchLoaded}>{messages.loadLineupActive}</span>
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
  onLoadLineup,
  loadedMatchId,
}: UpcomingMatchesProps) {
  const { addNotification } = useNotifications();
  const [matchStates, setMatchStates] = useState<Record<number, MatchState>>({});
  const [loadStates, setLoadStates] = useState<Record<number, LoadState>>({});
  const [confirmMatchId, setConfirmMatchId] = useState<number | null>(null);
  const teamId =
    response.data?.HattrickData?.Team?.TeamID ??
    null;
  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const hasLineup = assignedCount >= 9 && assignedCount <= 11;

  const lineupPayload = useMemo(
    () => buildLineupPayload(assignments),
    [assignments]
  );

  const allMatches = normalizeMatches(
    response.data?.HattrickData?.MatchList?.Match ??
      response.data?.HattrickData?.Team?.MatchList?.Match
  );

  const matchById = useMemo(() => {
    const map = new Map<number, Match>();
    allMatches.forEach((match) => {
      const id = Number(match.MatchID);
      if (Number.isFinite(id)) {
        map.set(id, match);
      }
    });
    return map;
  }, [allMatches]);

  const formatMatchName = (match: Match | undefined) => {
    if (!match) return messages.unknownLabel;
    const home = match.HomeTeam?.HomeTeamName ?? messages.homeLabel;
    const away = match.AwayTeam?.AwayTeamName ?? messages.awayLabel;
    return `${home} vs ${away}`;
  };

  const handleSubmit = async (matchId: number) => {
    if (!teamId) return;
    if (!hasLineup) {
      setMatchStates((prev) => ({
        ...prev,
        [matchId]: {
          status: "error",
          error:
            assignedCount > 11
              ? messages.submitOrdersMaxPlayers
              : messages.submitOrdersMinPlayers,
        },
      }));
      return;
    }
    setConfirmMatchId(matchId);
    return;
  };

  const handleLoadLineup = async (matchId: number) => {
    if (!teamId) return;
    setLoadStates((prev) => ({
      ...prev,
      [matchId]: { status: "loading", error: null },
    }));
    try {
      const response = await fetch(
        `/api/chpp/matchorders?matchId=${matchId}&teamId=${teamId}`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.details || payload?.error || messages.loadLineupError
        );
      }
      const positionsRaw =
        payload?.data?.HattrickData?.MatchData?.Lineup?.Positions?.Player;
      const positions = Array.isArray(positionsRaw)
        ? positionsRaw
        : positionsRaw
        ? [positionsRaw]
        : [];
      const next: LineupAssignments = {};
      positions.forEach((player: { RoleID?: number; PlayerID?: number }) => {
        const playerId = Number(player?.PlayerID ?? 0);
        if (!playerId) return;
        const slot = roleIdToSlotId(Number(player?.RoleID ?? 0));
        if (!slot) return;
        const flippedSlot =
          slot === "WB_L"
            ? "WB_R"
            : slot === "WB_R"
            ? "WB_L"
            : slot === "CD_L"
            ? "CD_R"
            : slot === "CD_R"
            ? "CD_L"
            : slot === "W_L"
            ? "W_R"
            : slot === "W_R"
            ? "W_L"
            : slot === "IM_L"
            ? "IM_R"
            : slot === "IM_R"
            ? "IM_L"
            : slot === "F_L"
            ? "F_R"
            : slot === "F_R"
            ? "F_L"
            : slot;
        next[flippedSlot] = playerId;
      });
      if (Object.keys(next).length === 0) {
        throw new Error(messages.loadLineupUnavailable);
      }
      onLoadLineup?.(next, matchId);
      addNotification(
        `${messages.notificationLineupLoaded} ${formatMatchName(
          matchById.get(matchId)
        )}`
      );
      setLoadStates((prev) => ({
        ...prev,
        [matchId]: { status: "idle", error: null },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadStates((prev) => ({
        ...prev,
        [matchId]: { status: "error", error: message },
      }));
    }
  };

  const confirmSubmit = async () => {
    if (!confirmMatchId || !teamId) {
      setConfirmMatchId(null);
      return;
    }

    const matchId = confirmMatchId;
    setConfirmMatchId(null);

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

      const raw = payload?.raw ?? null;
      const ordersSet = raw ? raw.includes('OrdersSet="True"') : false;
      if (!ordersSet) {
        setMatchStates((prev) => ({
          ...prev,
          [matchId]: {
            status: "error",
            error: messages.submitOrdersReport,
            raw,
            updatedAt: null,
          },
        }));
        return;
      }

      setMatchStates((prev) => ({
        ...prev,
        [matchId]: {
          status: "success",
          raw: null,
          updatedAt: Date.now(),
        },
      }));
      addNotification(
        `${messages.notificationLineupSubmitted} ${formatMatchName(
          matchById.get(matchId)
        )}`
      );
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

  const upcoming = allMatches.filter((match) => match.Status === "UPCOMING");
  const sortedUpcoming = sortByDate(upcoming);
  const sortedAll = sortByDate(allMatches);

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
      {confirmMatchId ? (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmCard} role="dialog" aria-modal="true">
            <div className={styles.confirmTitle}>
              {messages.confirmSubmitOrders}
            </div>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={() => setConfirmMatchId(null)}
              >
                {messages.confirmCancel}
              </button>
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={confirmSubmit}
              >
                {messages.confirmSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {sortedUpcoming.length > 0 ? (
        <ul className={styles.matchList}>
          {sortedUpcoming.map((match) => {
            const matchId = Number(match.MatchID);
            if (!Number.isFinite(matchId)) return null;
            const state = matchStates[matchId] ?? { status: "idle" };
            const updatedLabel = state.updatedAt
              ? `${messages.submitOrdersUpdated}: ${new Date(
                  state.updatedAt
                ).toLocaleTimeString()}`
              : null;
            return renderMatch(
              matchId,
              match,
              teamId,
              messages,
              hasLineup,
              state,
              handleSubmit,
              updatedLabel,
              loadStates[matchId],
              handleLoadLineup,
              loadedMatchId === matchId,
              assignedCount
            );
          })}
        </ul>
      ) : sortedAll.length > 0 ? (
        <>
          <p className={styles.muted}>{messages.noUpcomingMatches}</p>
          <ul className={styles.matchList}>
            {sortedAll.map((match) => {
              const matchId = Number(match.MatchID);
              if (!Number.isFinite(matchId)) return null;
              const state = matchStates[matchId] ?? { status: "idle" };
              const updatedLabel = state.updatedAt
                ? `${messages.submitOrdersUpdated}: ${new Date(
                    state.updatedAt
                  ).toLocaleTimeString()}`
                : null;
              return renderMatch(
                matchId,
                match,
                teamId,
                messages,
                hasLineup,
                state,
                handleSubmit,
                updatedLabel,
                loadStates[matchId],
                handleLoadLineup,
                loadedMatchId === matchId,
                assignedCount
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
