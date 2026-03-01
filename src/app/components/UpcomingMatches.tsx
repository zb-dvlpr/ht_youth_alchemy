"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import { LineupAssignments, LineupBehaviors } from "./LineupField";
import { roleIdToSlotId } from "@/lib/positions";
import { useNotifications } from "./notifications/NotificationsProvider";
import { formatChppDateTime, formatDateTime } from "@/lib/datetime";
import { parseChppDate } from "@/lib/chpp/utils";
import Modal from "./Modal";
import { ChppAuthRequiredError, fetchChppJson } from "@/lib/chpp/client";

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
  MatchType?: number | string;
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
  behaviors?: LineupBehaviors;
  captainId?: number | null;
  tacticType?: number;
  onRefresh?: () => boolean | Promise<boolean>;
  onLoadLineup?: (
    assignments: LineupAssignments,
    behaviors: LineupBehaviors,
    matchId: number
  ) => void;
  loadedMatchId?: number | null;
  onSubmitSuccess?: () => void;
  sourceSystem?: string;
};

function normalizeMatches(input?: Match[] | Match): Match[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

function formatMatchDate(dateString: string | undefined, unknownDate: string) {
  return formatChppDateTime(dateString) ?? unknownDate;
}

function sortByDate(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const aTime = parseChppDate(a.MatchDate)?.getTime() ?? 0;
    const bTime = parseChppDate(b.MatchDate)?.getTime() ?? 0;
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

const BENCH_SLOT_ORDER = [
  "B_GK",
  "B_CD",
  "B_WB",
  "B_IM",
  "B_F",
  "B_W",
  "B_X",
] as const;

function buildLineupPayload(
  assignments: LineupAssignments,
  behaviors?: LineupBehaviors,
  captainId?: number | null,
  tacticType?: number
) {
  const toId = (value: number | null | undefined) => value ?? 0;
  const positions = POSITION_SLOT_ORDER.map((slot) => ({
    id: toId(assignments[slot]),
    behaviour: behaviors?.[slot] ?? 0,
  }));

  const bench = [
    ...BENCH_SLOT_ORDER.map((slot) => ({
      id: toId(assignments[slot]),
      behaviour: 0,
    })),
    ...Array.from({ length: 7 }, () => ({ id: 0, behaviour: 0 })),
  ];
  const kickers = Array.from({ length: 11 }, () => ({ id: 0, behaviour: 0 }));

  return {
    positions,
    bench,
    kickers,
    captain: captainId ?? 0,
    setPieces: 0,
    settings: {
      tactic: typeof tacticType === "number" ? tacticType : 7,
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
  const matchTypeId = Number(match.MatchType);
  const matchTypeLabel = Number.isFinite(matchTypeId)
    ? (() => {
        switch (matchTypeId) {
          case 1:
            return messages.matchType1;
          case 2:
            return messages.matchType2;
          case 3:
            return messages.matchType3;
          case 4:
            return messages.matchType4;
          case 5:
            return messages.matchType5;
          case 6:
            return messages.matchType6;
          case 7:
            return messages.matchType7;
          case 8:
            return messages.matchType8;
          case 9:
            return messages.matchType9;
          case 10:
            return messages.matchType10;
          case 11:
            return messages.matchType11;
          case 12:
            return messages.matchType12;
          case 50:
            return messages.matchType50;
          case 51:
            return messages.matchType51;
          case 61:
            return messages.matchType61;
          case 62:
            return messages.matchType62;
          case 80:
            return messages.matchType80;
          case 100:
            return messages.matchType100;
          case 101:
            return messages.matchType101;
          case 102:
            return messages.matchType102;
          case 103:
            return messages.matchType103;
          case 104:
            return messages.matchType104;
          case 105:
            return messages.matchType105;
          case 106:
            return messages.matchType106;
          case 107:
            return messages.matchType107;
          default:
            return `${messages.matchTypeUnknown} ${matchTypeId}`;
        }
      })()
    : messages.matchTypeUnknown;
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
        <span className={styles.matchType}>({matchTypeLabel})</span>
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
          <Tooltip content={messages.loadLineupTooltip}>
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
          <Tooltip content={messages.submitOrdersTooltip}>
            <button
              type="button"
              className={styles.matchButton}
              onClick={() => onSubmit(matchId)}
              disabled={!canSubmit || state.status === "submitting"}
              aria-label={messages.submitOrdersTooltip}
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
  behaviors,
  captainId,
  tacticType,
  onRefresh,
  onLoadLineup,
  loadedMatchId,
  onSubmitSuccess,
  sourceSystem = "Youth",
}: UpcomingMatchesProps) {
  const { addNotification } = useNotifications();
  const [matchStates, setMatchStates] = useState<Record<number, MatchState>>({});
  const [loadStates, setLoadStates] = useState<Record<number, LoadState>>({});
  const [confirmMatchId, setConfirmMatchId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const teamId =
    response.data?.HattrickData?.Team?.TeamID ??
    null;
  const assignedCount = POSITION_SLOT_ORDER.filter(
    (slot) => Boolean(assignments[slot])
  ).length;
  const hasLineup = assignedCount >= 9 && assignedCount <= 11;

  const lineupPayload = useMemo(
    () => buildLineupPayload(assignments, behaviors, captainId, tacticType),
    [assignments, behaviors, captainId, tacticType]
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

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      const result = await onRefresh();
      if (result) {
        addNotification(messages.notificationMatchesRefreshed);
      } else {
        addNotification(messages.notificationMatchesRefreshFailed);
      }
    } catch {
      addNotification(messages.notificationMatchesRefreshFailed);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadLineup = async (matchId: number) => {
    if (!teamId) return;
    setLoadStates((prev) => ({
      ...prev,
      [matchId]: { status: "loading", error: null },
    }));
    try {
      const { response, payload } = await fetchChppJson<{
        data?: {
          HattrickData?: {
            MatchData?: {
              Lineup?: {
                Positions?: { Player?: unknown };
                Bench?: { Player?: unknown };
              };
            };
          };
        };
        error?: string;
        details?: string;
      }>(
        `/api/chpp/matchorders?matchId=${matchId}&teamId=${teamId}&sourceSystem=${encodeURIComponent(
          sourceSystem
        )}`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.details || payload?.error || messages.loadLineupError
        );
      }
      const positionsRaw =
        payload?.data?.HattrickData?.MatchData?.Lineup?.Positions?.Player;
      const benchRaw =
        payload?.data?.HattrickData?.MatchData?.Lineup?.Bench?.Player;
      const positions = Array.isArray(positionsRaw)
        ? positionsRaw
        : positionsRaw
        ? [positionsRaw]
        : [];
      const bench = Array.isArray(benchRaw)
        ? benchRaw
        : benchRaw
        ? [benchRaw]
        : [];
      const next: LineupAssignments = {};
      const nextBehaviors: LineupBehaviors = {};
      positions.forEach((player: { RoleID?: number; PlayerID?: number }) => {
        const playerId = Number(player?.PlayerID ?? 0);
        if (!playerId) return;
        const slot = roleIdToSlotId(Number(player?.RoleID ?? 0));
        if (!slot) return;
        const flippedSlot = slot.startsWith("B_")
          ? slot
          : slot === "WB_L"
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
        const behaviourValue = Number(
          (player as { Behaviour?: number; Behavior?: number })?.Behaviour ??
            (player as { Behaviour?: number; Behavior?: number })?.Behavior ??
            0
        );
        if (behaviourValue) {
          nextBehaviors[flippedSlot] = behaviourValue;
        }
      });
      bench.forEach((player: { RoleID?: number; PlayerID?: number }) => {
        const playerId = Number(player?.PlayerID ?? 0);
        if (!playerId) return;
        const slot = roleIdToSlotId(Number(player?.RoleID ?? 0));
        if (!slot || !slot.startsWith("B_")) return;
        next[slot] = playerId;
      });
      if (Object.keys(next).length === 0) {
        throw new Error(messages.loadLineupUnavailable);
      }
      onLoadLineup?.(next, nextBehaviors, matchId);
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
      if (error instanceof ChppAuthRequiredError) return;
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
      const { response, payload } = await fetchChppJson<{
        error?: string;
        details?: string;
        data?: string;
        raw?: string;
      }>("/api/chpp/matchorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          teamId,
          sourceSystem,
          lineup: lineupPayload,
        }),
      });
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
      onSubmitSuccess?.();
      onRefresh?.();
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
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
        <div className={styles.matchesHeader}>
          <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
          <Tooltip content={messages.matchesRefreshTooltip}>
            <button
              type="button"
              className={styles.sortToggle}
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label={messages.matchesRefreshTooltip}
            >
              ↻
            </button>
          </Tooltip>
        </div>
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
      <div className={styles.matchesHeader}>
        <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
        <Tooltip content={messages.matchesRefreshTooltip}>
          <button
            type="button"
            className={styles.sortToggle}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={messages.matchesRefreshTooltip}
          >
            ↻
          </button>
        </Tooltip>
      </div>
      <Modal
        open={!!confirmMatchId}
        variant="local"
        title={messages.confirmSubmitOrders}
        actions={
          <>
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
          </>
        }
      />
      {sortedUpcoming.length > 0 ? (
        <ul className={styles.matchList}>
          {sortedUpcoming.map((match) => {
            const matchId = Number(match.MatchID);
            if (!Number.isFinite(matchId)) return null;
            const state = matchStates[matchId] ?? { status: "idle" };
            const updatedLabel = state.updatedAt
              ? `${messages.submitOrdersUpdated}: ${formatDateTime(state.updatedAt)}`
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
                ? `${messages.submitOrdersUpdated}: ${formatDateTime(state.updatedAt)}`
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
