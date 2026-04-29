"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import {
  hattrickMatchUrlWithSourceSystem,
  hattrickYouthMatchUrl,
} from "@/lib/hattrick/urls";

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
  SourceSystem?: string;
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

export type MatchOrdersLineupPayload = {
  positions: Array<{ id: number; behaviour: number }>;
  bench: Array<{ id: number; behaviour: number }>;
  kickers: Array<{ id: number; behaviour: number }>;
  captain: number;
  setPieces: number;
  settings: {
    tactic: number;
    speechLevel: number;
    newLineup: string;
    coachModifier: number;
    manMarkerPlayerId: number;
    manMarkingPlayerId: number;
  };
  substitutions: Array<{
    playerin: number;
    playerout: number;
    orderType: number;
    min: number;
    pos: number;
    beh: number;
    card: number;
    standing: number;
  }>;
};

type UpcomingMatchesProps = {
  response: MatchesResponse;
  messages: Messages;
  assignments: LineupAssignments;
  behaviors?: LineupBehaviors;
  captainId?: number | null;
  penaltyKickerIds?: number[];
  setPiecesId?: number | null;
  tacticType?: number;
  onRefresh?: () => boolean | Promise<boolean>;
  onLoadLineup?: (
    assignments: LineupAssignments,
    behaviors: LineupBehaviors,
    matchId: number,
    tacticType?: number
  ) => void;
  onSetBestLineup?: (matchId: number) => void | Promise<void>;
  onSetBestLineupMode?: (
    matchId: number,
    mode: SetBestLineupMode,
    fixedFormation?: string | null
  ) => void | Promise<void>;
  onAnalyzeOpponent?: (matchId: number) => void | Promise<void>;
  getOpponentCupStatus?: (opponentTeamId: number) => boolean | null;
  ensureOpponentCupStatus?: (opponentTeamId: number) => void | Promise<boolean | null>;
  loadedMatchId?: number | null;
  submitEnabledMatchId?: number | null;
  submitRestrictedTooltipBuilder?: (targetMatch: Match | undefined) => ReactNode;
  onSubmitSuccess?: (matchId: number, lineupPayload: MatchOrdersLineupPayload) => void;
  buildSubmitLineupPayload?: (
    matchId: number,
    defaultPayload: MatchOrdersLineupPayload
  ) => MatchOrdersLineupPayload | Promise<MatchOrdersLineupPayload>;
  sourceSystem?: string;
  includeTournamentMatches?: boolean;
  onIncludeTournamentMatchesChange?: (next: boolean) => void;
  setBestLineupHelpAnchor?: string;
  showExtraTimeSetBestLineupMode?: boolean;
  keepBestLineupMenuTopmost?: boolean;
  fixedFormationOptions?: string[];
  selectedFixedFormation?: string | null;
  onSelectedFixedFormationChange?: (formation: string | null) => void;
  setBestLineupCustomContent?: ReactNode;
  setBestLineupDisabledTooltipBuilder?: (match: Match) => ReactNode;
};

export type SetBestLineupMode =
  | "trainingAware"
  | "ignoreTraining"
  | "extraTime"
  | "fixedFormation";

const DEFAULT_ALLOWED_MATCH_TYPES = new Set<number>([1, 2, 3, 4, 5, 8, 9]);
const TOURNAMENT_MATCH_TYPES = new Set<number>([50, 51]);
const EXTRA_TIME_ALLOWED_MATCH_TYPES = new Set<number>([2, 3, 5, 9]);

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

function resolveMatchSourceSystem(
  match: Match | undefined,
  fallbackSourceSystem: string
): string {
  const explicitSource =
    match && typeof match.SourceSystem === "string" && match.SourceSystem.trim().length > 0
      ? match.SourceSystem.trim()
      : null;
  if (explicitSource) return explicitSource;
  const matchType = Number(match?.MatchType);
  if (Number.isFinite(matchType) && TOURNAMENT_MATCH_TYPES.has(matchType)) {
    return "htointegrated";
  }
  return fallbackSourceSystem;
}

function resolveOpponentTeam(
  match: Match | undefined,
  teamId: number | null
): { teamId: number; teamName: string } | null {
  if (!match || typeof teamId !== "number" || !Number.isFinite(teamId) || teamId <= 0) {
    return null;
  }
  const homeTeamId = Number(match.HomeTeam?.HomeTeamID);
  const awayTeamId = Number(match.AwayTeam?.AwayTeamID);
  if (Number.isFinite(homeTeamId) && homeTeamId === teamId) {
    if (!Number.isFinite(awayTeamId) || awayTeamId <= 0) return null;
    return {
      teamId: awayTeamId,
      teamName: match.AwayTeam?.AwayTeamName ?? "",
    };
  }
  if (Number.isFinite(awayTeamId) && awayTeamId === teamId) {
    if (!Number.isFinite(homeTeamId) || homeTeamId <= 0) return null;
    return {
      teamId: homeTeamId,
      teamName: match.HomeTeam?.HomeTeamName ?? "",
    };
  }
  return null;
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
  tacticType?: number,
  penaltyKickerIds?: number[],
  setPiecesId?: number | null
): MatchOrdersLineupPayload {
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
  const kickers = Array.from({ length: 11 }, (_, index) => ({
    id: Number(penaltyKickerIds?.[index] ?? 0) || 0,
    behaviour: 0,
  }));

  return {
    positions,
    bench,
    kickers,
    captain: captainId ?? 0,
    setPieces: Number(setPiecesId ?? 0) || 0,
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

function parseLoadedTacticType(payload: unknown): number | null {
  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const text = record["#text"];
      if (typeof text === "string" || typeof text === "number") {
        const parsed = Number(text);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    return null;
  };
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const hattrickData =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>).HattrickData
      : null;
  if (!hattrickData || typeof hattrickData !== "object") return null;
  const matchData = (hattrickData as Record<string, unknown>).MatchData;
  if (!matchData || typeof matchData !== "object") return null;
  const matchDataRecord = matchData as Record<string, unknown>;
  const lineupNode =
    matchDataRecord.Lineup && typeof matchDataRecord.Lineup === "object"
      ? (matchDataRecord.Lineup as Record<string, unknown>)
      : null;
  const matchOrdersNode =
    matchDataRecord.MatchOrders && typeof matchDataRecord.MatchOrders === "object"
      ? (matchDataRecord.MatchOrders as Record<string, unknown>)
      : null;
  const settingsCandidates: unknown[] = [
    lineupNode?.Settings,
    matchDataRecord.Settings,
    matchOrdersNode?.Settings,
  ];
  const valueCandidates: unknown[] = [matchDataRecord.TacticType, matchDataRecord.Tactic];
  settingsCandidates.forEach((settings) => {
    if (!settings || typeof settings !== "object") return;
    const record = settings as Record<string, unknown>;
    valueCandidates.push(
      record.TacticType,
      record.Tactic,
      record.TacticTypeID,
      record.TacticTypeId
    );
  });
  for (const candidate of valueCandidates) {
    const parsed = toNumber(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
}

type SetBestLineupMenuButtonProps = {
  matchId: number;
  loading: boolean;
  messages: Messages;
  onSelectMode: (
    matchId: number,
    mode: SetBestLineupMode,
    fixedFormation?: string | null
  ) => void;
  helpAnchor?: string;
  showExtraTimeMode?: boolean;
  extraTimeModeEnabled?: boolean;
  fixedFormationOptions?: string[];
  selectedFixedFormation?: string | null;
  onSelectedFixedFormationChange?: (formation: string | null) => void;
  customContent?: ReactNode;
  disabledTooltip?: ReactNode;
};

function SetBestLineupMenuButton({
  matchId,
  loading,
  messages,
  onSelectMode,
  helpAnchor,
  showExtraTimeMode = false,
  extraTimeModeEnabled = false,
  fixedFormationOptions = [],
  selectedFixedFormation = null,
  onSelectedFixedFormationChange,
  customContent,
  disabledTooltip,
}: SetBestLineupMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [fixedFormationMenuOpen, setFixedFormationMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fixedFormationButtonRef = useRef<HTMLButtonElement | null>(null);
  const fixedFormationMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target ?? null)) return;
      if (menuRef.current?.contains(target ?? null)) return;
      if (fixedFormationButtonRef.current?.contains(target ?? null)) return;
      if (fixedFormationMenuRef.current?.contains(target ?? null)) return;
      setOpen(false);
      setFixedFormationMenuOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  const fixedFormationTemplate = messages.setBestLineupOptimizeByFormation.replace(
    "{{formation}}",
    "__FORMATION__"
  );
  const [fixedFormationPrefix, fixedFormationSuffix = ""] =
    fixedFormationTemplate.split("__FORMATION__");
  const fixedFormationInlineLabel = selectedFixedFormation ?? "?";
  const lineupAiDisabled = Boolean(disabledTooltip);
  const fixedFormationDisabled = !selectedFixedFormation || lineupAiDisabled;

  const trigger = (
    <button
      type="button"
      className={`${styles.optimizeButton} ${styles.matchBestLineupDazzleButton}`}
      onClick={() => {
        if (loading) return;
        setOpen((prev) => !prev);
      }}
      disabled={loading}
      aria-label={messages.setBestLineupTooltip}
      ref={triggerRef}
      data-help-anchor={helpAnchor}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : "✨"}
    </button>
  );

  return (
    <div className={styles.feedbackWrap}>
      <Tooltip content={messages.setBestLineupTooltip}>{trigger}</Tooltip>
      {open ? (
        <div className={styles.feedbackMenu} ref={menuRef}>
          {customContent ? customContent : null}
          <Tooltip
            content={disabledTooltip || messages.setBestLineupTrainingAwareTooltip}
            fullWidth
          >
            <button
              type="button"
              className={`${styles.feedbackLink} ${styles.optimizeMenuItem} ${
                lineupAiDisabled ? styles.optimizeMenuItemDisabled : ""
              }`}
              disabled={lineupAiDisabled}
              onClick={() => {
                if (lineupAiDisabled) return;
                setOpen(false);
                onSelectMode(matchId, "trainingAware");
              }}
            >
              {messages.setBestLineupTrainingAware}
            </button>
          </Tooltip>
          <Tooltip
            content={disabledTooltip || messages.setBestLineupIgnoreTrainingTooltip}
            fullWidth
          >
            <button
              type="button"
              className={`${styles.feedbackLink} ${styles.optimizeMenuItem} ${
                lineupAiDisabled ? styles.optimizeMenuItemDisabled : ""
              }`}
              disabled={lineupAiDisabled}
              onClick={() => {
                if (lineupAiDisabled) return;
                setOpen(false);
                onSelectMode(matchId, "ignoreTraining");
              }}
            >
              {messages.setBestLineupIgnoreTraining}
            </button>
          </Tooltip>
          {showExtraTimeMode ? (
            <Tooltip
              content={
                disabledTooltip ||
                (extraTimeModeEnabled
                  ? messages.setBestLineupAimForExtraTimeTooltip
                  : messages.setBestLineupAimForExtraTimeDisabledTooltip)
              }
              fullWidth
            >
              <button
                type="button"
                className={`${styles.feedbackLink} ${styles.optimizeMenuItem} ${
                  extraTimeModeEnabled && !lineupAiDisabled
                    ? ""
                    : styles.optimizeMenuItemDisabled
                }`}
                disabled={!extraTimeModeEnabled || lineupAiDisabled}
                onClick={() => {
                  if (!extraTimeModeEnabled || lineupAiDisabled) return;
                  setOpen(false);
                  onSelectMode(matchId, "extraTime");
                }}
              >
                {messages.setBestLineupAimForExtraTime}
              </button>
            </Tooltip>
          ) : null}
          <Tooltip
            content={
              fixedFormationMenuOpen
                ? ""
                : disabledTooltip ||
                  (fixedFormationDisabled
                  ? messages.setBestLineupOptimizeByFormationDisabledTooltip
                  : messages.setBestLineupOptimizeByFormationTooltip)
            }
            fullWidth
          >
            <span className={styles.optimizeMenuCustomWrap}>
              <span className={styles.optimizeMenuCustomLabel}>
                {fixedFormationPrefix}
                <span className={styles.optimizeMenuInlinePickerWrap}>
                  <button
                    ref={fixedFormationButtonRef}
                    type="button"
                    className={styles.optimizeMenuInlinePicker}
                    onClick={(event) => {
                      event.stopPropagation();
                      setFixedFormationMenuOpen((current) => !current);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={fixedFormationMenuOpen}
                    disabled={fixedFormationOptions.length === 0}
                  >
                    <span className={styles.optimizeMenuInlinePickerText}>
                      {fixedFormationInlineLabel}
                    </span>
                    <span className={styles.optimizeMenuInlinePickerChevron}>⌄</span>
                  </button>
                  {fixedFormationMenuOpen && fixedFormationOptions.length ? (
                    <div
                      ref={fixedFormationMenuRef}
                      className={`${styles.feedbackMenu} ${styles.optimizeMenuInlinePickerMenu}`}
                      role="menu"
                    >
                      {fixedFormationOptions.map((formation) => (
                        <button
                          key={formation}
                          type="button"
                          role="menuitem"
                          className={`${styles.feedbackLink} ${styles.optimizeMenuItem} ${
                            selectedFixedFormation === formation
                              ? styles.optimizeMenuInlinePickerOptionActive
                              : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectedFixedFormationChange?.(formation);
                            setFixedFormationMenuOpen(false);
                          }}
                        >
                          {formation}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </span>
                {fixedFormationSuffix}
              </span>
              <div className={styles.optimizeMenuCustomControls}>
                <button
                  type="button"
                  className={`${styles.feedbackLink} ${styles.optimizeMenuActionButton} ${
                    fixedFormationDisabled ? styles.optimizeMenuItemDisabled : ""
                  }`}
                  onClick={() => {
                    if (!selectedFixedFormation || lineupAiDisabled) return;
                    setOpen(false);
                    setFixedFormationMenuOpen(false);
                    onSelectMode(matchId, "fixedFormation", selectedFixedFormation);
                  }}
                  disabled={fixedFormationDisabled}
                >
                  {messages.setBestLineupOptimizeByFormationApply}
                </button>
              </div>
            </span>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}

function renderMatch(
  matchId: number,
  match: Match,
  teamId: number | null,
  sourceSystem: string,
  messages: Messages,
  hasLineup: boolean,
  state: MatchState,
  onSubmit: (matchId: number) => void,
  updatedLabel?: string | null,
  loadState?: LoadState,
  onLoadLineup?: (matchId: number) => void,
  onSetBestLineupMode?: (
    matchId: number,
    mode: SetBestLineupMode,
    fixedFormation?: string | null
  ) => void,
  onAnalyzeOpponent?: (matchId: number) => void,
  opponentCupStatus?: boolean | null,
  bestLineupPending?: boolean,
  analyzePending?: boolean,
  isLoaded?: boolean,
  submitEnabledMatchId?: number | null,
  submitRestrictedTooltip?: ReactNode,
  assignedCount?: number,
  setBestLineupHelpAnchor?: string,
  showExtraTimeSetBestLineupMode?: boolean,
  fixedFormationOptions?: string[],
  selectedFixedFormation?: string | null,
  onSelectedFixedFormationChange?: (formation: string | null) => void,
  setBestLineupCustomContent?: ReactNode,
  setBestLineupDisabledTooltip?: ReactNode
) {
  const isUpcoming = match.Status === "UPCOMING";
  const submitMatchRestrictionActive =
    typeof submitEnabledMatchId === "number" && submitEnabledMatchId > 0;
  const canSubmit =
    Boolean(teamId) &&
    isUpcoming &&
    hasLineup &&
    (!submitMatchRestrictionActive || submitEnabledMatchId === matchId);
  const submitRestrictedByOtherMatch =
    submitMatchRestrictionActive && submitEnabledMatchId !== matchId;
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
  const canShowBestLineupMenu =
    sourceSystem === "Hattrick" && Boolean(onSetBestLineupMode);
  const extraTimeModeEnabled =
    process.env.NODE_ENV !== "production" ||
    (Number.isFinite(matchTypeId) && EXTRA_TIME_ALLOWED_MATCH_TYPES.has(matchTypeId));
  const canAnalyzeOpponent = sourceSystem === "Hattrick" && Boolean(onAnalyzeOpponent);
  const showActionRow = isUpcoming || canAnalyzeOpponent;
  const resolvedMatchSourceSystem = resolveMatchSourceSystem(match, sourceSystem);
  const matchHref =
    sourceSystem === "Youth" && typeof teamId === "number" && Number.isFinite(teamId) && teamId > 0
      ? hattrickYouthMatchUrl(matchId, teamId, teamId)
      : hattrickMatchUrlWithSourceSystem(matchId, resolvedMatchSourceSystem);

  return (
    <li
      key={matchId}
      className={`${styles.matchItem} ${
        canShowBestLineupMenu ? styles.matchItemHasTopAction : ""
      }`}
    >
      {canShowBestLineupMenu ? (
        <div className={styles.matchBestLineupTopAction}>
          <SetBestLineupMenuButton
            matchId={matchId}
            loading={Boolean(bestLineupPending)}
            messages={messages}
            onSelectMode={onSetBestLineupMode!}
            helpAnchor={setBestLineupHelpAnchor}
            showExtraTimeMode={showExtraTimeSetBestLineupMode}
            extraTimeModeEnabled={extraTimeModeEnabled}
            fixedFormationOptions={fixedFormationOptions}
            selectedFixedFormation={selectedFixedFormation}
            onSelectedFixedFormationChange={onSelectedFixedFormationChange}
            customContent={setBestLineupCustomContent}
            disabledTooltip={setBestLineupDisabledTooltip}
          />
        </div>
      ) : null}
      <a
        className={styles.matchTeamsLink}
        href={matchHref}
        target="_blank"
        rel="noopener noreferrer"
      >
      <div className={styles.matchTeams}>
        <span>{match.HomeTeam?.HomeTeamName ?? messages.homeLabel}</span>
        <span className={styles.vs}>vs</span>
        <span>{match.AwayTeam?.AwayTeamName ?? messages.awayLabel}</span>
        <span className={styles.matchType}>({matchTypeLabel})</span>
      </div>
      </a>
      <div className={styles.matchMeta}>
        <span>{formatMatchDate(match.MatchDate, messages.unknownDate)}</span>
        <span>
          {messages.statusLabel}: {statusText}
        </span>
        <span>
          {messages.ordersLabel}: {ordersSet ? messages.ordersSet : messages.ordersNotSet}
        </span>
        {typeof opponentCupStatus === "boolean" ? (
          <span>
            {messages.clubChronicleFieldCup}:{" "}
            {opponentCupStatus
              ? messages.analyzeOpponentStillInCup
              : messages.analyzeOpponentNotInCup}
          </span>
        ) : null}
      </div>
      {showActionRow ? (
        <div className={styles.matchActions}>
          {isUpcoming ? (
            <>
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
          <Tooltip
            content={
              submitRestrictedByOtherMatch && submitRestrictedTooltip
                ? submitRestrictedTooltip
                : messages.submitOrdersTooltip
            }
          >
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
            </>
          ) : null}
          {canAnalyzeOpponent ? (
            <span className={styles.matchAnalyzeOpponentWrap}>
              <Tooltip content={messages.analyzeOpponentTooltip}>
                <button
                  type="button"
                  className={styles.matchButtonSecondary}
                  onClick={() => onAnalyzeOpponent?.(matchId)}
                  disabled={Boolean(analyzePending)}
                  aria-label={messages.analyzeOpponentTooltip}
                >
                  {messages.analyzeOpponent}
                </button>
              </Tooltip>
            </span>
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
  penaltyKickerIds,
  setPiecesId,
  tacticType,
  onRefresh,
  onLoadLineup,
  onSetBestLineup,
  onSetBestLineupMode,
  onAnalyzeOpponent,
  getOpponentCupStatus,
  ensureOpponentCupStatus,
  loadedMatchId,
  submitEnabledMatchId = null,
  submitRestrictedTooltipBuilder,
  onSubmitSuccess,
  buildSubmitLineupPayload,
  sourceSystem = "Youth",
  includeTournamentMatches = true,
  onIncludeTournamentMatchesChange,
  setBestLineupHelpAnchor,
  showExtraTimeSetBestLineupMode = false,
  keepBestLineupMenuTopmost = false,
  fixedFormationOptions = [],
  selectedFixedFormation = null,
  onSelectedFixedFormationChange,
  setBestLineupCustomContent,
  setBestLineupDisabledTooltipBuilder,
}: UpcomingMatchesProps) {
  const { addNotification } = useNotifications();
  const [matchStates, setMatchStates] = useState<Record<number, MatchState>>({});
  const [loadStates, setLoadStates] = useState<Record<number, LoadState>>({});
  const [confirmMatchId, setConfirmMatchId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bestLineupPendingMatchId, setBestLineupPendingMatchId] = useState<number | null>(
    null
  );
  const [analyzePendingMatchId, setAnalyzePendingMatchId] = useState<number | null>(null);
  const teamId =
    response.data?.HattrickData?.Team?.TeamID ??
    null;
  const assignedCount = POSITION_SLOT_ORDER.filter(
    (slot) => Boolean(assignments[slot])
  ).length;
  const hasLineup = assignedCount >= 9 && assignedCount <= 11;

  const lineupPayload = useMemo(
    () =>
      buildLineupPayload(
        assignments,
        behaviors,
        captainId,
        tacticType,
        penaltyKickerIds,
        setPiecesId
      ),
    [assignments, behaviors, captainId, tacticType, penaltyKickerIds, setPiecesId]
  );

  const allMatches = normalizeMatches(
    response.data?.HattrickData?.MatchList?.Match ??
      response.data?.HattrickData?.Team?.MatchList?.Match
  );
  const allowAllMatchTypes = onIncludeTournamentMatchesChange
    ? includeTournamentMatches
    : true;
  const visibleMatches = allMatches.filter((match) => {
    if (allowAllMatchTypes) return true;
    const matchType = Number(match.MatchType);
    return Number.isFinite(matchType) && DEFAULT_ALLOWED_MATCH_TYPES.has(matchType);
  });

  useEffect(() => {
    if (
      sourceSystem !== "Hattrick" ||
      !ensureOpponentCupStatus ||
      typeof teamId !== "number" ||
      !Number.isFinite(teamId) ||
      teamId <= 0
    ) {
      return;
    }
    const uniqueOpponentIds = new Set<number>();
    visibleMatches.forEach((match) => {
      const opponent = resolveOpponentTeam(match, teamId);
      if (opponent) uniqueOpponentIds.add(opponent.teamId);
    });
    uniqueOpponentIds.forEach((opponentTeamId) => {
      void ensureOpponentCupStatus(opponentTeamId);
    });
  }, [ensureOpponentCupStatus, sourceSystem, teamId, visibleMatches]);

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

  const submitRestrictionActive =
    typeof submitEnabledMatchId === "number" && submitEnabledMatchId > 0;
  const submitRestrictedMatch =
    submitRestrictionActive && submitEnabledMatchId !== null
      ? matchById.get(submitEnabledMatchId)
      : undefined;
  const canSubmitMatchId = (matchId: number) =>
    !submitRestrictionActive || submitEnabledMatchId === matchId;

  const handleSubmit = async (matchId: number) => {
    if (!teamId) return;
    if (!canSubmitMatchId(matchId)) return;
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
    const matchSourceSystem = resolveMatchSourceSystem(
      matchById.get(matchId),
      sourceSystem
    );
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
          matchSourceSystem
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
      const loadedTacticType = parseLoadedTacticType(payload);
      onLoadLineup?.(
        next,
        nextBehaviors,
        matchId,
        loadedTacticType !== null ? loadedTacticType : undefined
      );
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

  const handleSetBestLineupMode = async (
    matchId: number,
    mode: SetBestLineupMode,
    fixedFormation?: string | null
  ) => {
    if (bestLineupPendingMatchId !== null) return;
    if (!onSetBestLineupMode && !onSetBestLineup) return;
    setBestLineupPendingMatchId(matchId);
    try {
      if (onSetBestLineupMode) {
        await onSetBestLineupMode(matchId, mode, fixedFormation);
      } else if (onSetBestLineup) {
        await onSetBestLineup(matchId);
      }
    } finally {
      setBestLineupPendingMatchId((current) => (current === matchId ? null : current));
    }
  };

  const handleAnalyzeOpponent = async (matchId: number) => {
    if (!onAnalyzeOpponent || analyzePendingMatchId !== null) return;
    setAnalyzePendingMatchId(matchId);
    try {
      await onAnalyzeOpponent(matchId);
    } finally {
      setAnalyzePendingMatchId((current) => (current === matchId ? null : current));
    }
  };

  const confirmSubmit = async () => {
    if (!confirmMatchId || !teamId) {
      setConfirmMatchId(null);
      return;
    }

    const matchId = confirmMatchId;
    setConfirmMatchId(null);
    if (!canSubmitMatchId(matchId)) return;
    const matchSourceSystem = resolveMatchSourceSystem(
      matchById.get(matchId),
      sourceSystem
    );

    setMatchStates((prev) => ({
      ...prev,
      [matchId]: { status: "submitting" },
    }));

    try {
      const resolvedLineupPayload = buildSubmitLineupPayload
        ? await buildSubmitLineupPayload(matchId, lineupPayload)
        : lineupPayload;
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
          sourceSystem: matchSourceSystem,
          lineup: resolvedLineupPayload,
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
      onSubmitSuccess?.(matchId, resolvedLineupPayload);
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
  const tournamentToggle = onIncludeTournamentMatchesChange ? (
    <Tooltip content={messages.matchesIncludeTournamentTooltip}>
      <label className={styles.matchesFilterToggle}>
        <input
          type="checkbox"
          className={styles.matchesFilterToggleInput}
          checked={includeTournamentMatches}
          onChange={(event) =>
            onIncludeTournamentMatchesChange(event.currentTarget.checked)
          }
          aria-label={messages.matchesIncludeTournamentLabel}
        />
        <span className={styles.matchesFilterToggleTrack} aria-hidden="true" />
        <span className={styles.matchesFilterToggleLabel}>
          {messages.matchesIncludeTournamentLabel}
        </span>
      </label>
    </Tooltip>
  ) : null;

  if (response.error) {
    return (
      <div className={styles.card}>
        <div className={styles.matchesHeader}>
          <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
          <div className={styles.matchesHeaderControls}>
            {tournamentToggle}
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
        </div>
        <p className={styles.errorText}>{messages.unableToLoadMatches}</p>
        {response.details ? (
          <p className={styles.errorDetails}>{response.details}</p>
        ) : null}
      </div>
    );
  }

  const upcoming = visibleMatches.filter((match) => match.Status === "UPCOMING");
  const sortedUpcoming = sortByDate(upcoming);
  const sortedAll = sortByDate(visibleMatches);

  return (
    <div
      className={`${styles.card}${keepBestLineupMenuTopmost ? ` ${styles.seniorUpcomingMatches}` : ""}`}
    >
      <div className={styles.matchesHeader}>
        <h2 className={styles.sectionTitle}>{messages.matchesTitle}</h2>
        <div className={styles.matchesHeaderControls}>
          {tournamentToggle}
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
          {sortedUpcoming.map((match, index) => {
            const matchId = Number(match.MatchID);
            if (!Number.isFinite(matchId)) return null;
            const state = matchStates[matchId] ?? { status: "idle" };
            const updatedLabel = state.updatedAt
              ? `${messages.submitOrdersUpdated}: ${formatDateTime(state.updatedAt)}`
              : null;
            const opponent = resolveOpponentTeam(match, teamId);
            const opponentCupStatus =
              opponent && getOpponentCupStatus ? getOpponentCupStatus(opponent.teamId) : null;
            return renderMatch(
              matchId,
              match,
              teamId,
              sourceSystem,
              messages,
              hasLineup,
              state,
              handleSubmit,
              updatedLabel,
              loadStates[matchId],
              handleLoadLineup,
              handleSetBestLineupMode,
              handleAnalyzeOpponent,
              opponentCupStatus,
              bestLineupPendingMatchId === matchId,
              analyzePendingMatchId === matchId,
              loadedMatchId === matchId,
              submitEnabledMatchId,
              submitRestrictedTooltipBuilder?.(submitRestrictedMatch),
              assignedCount,
              index === 0 ? setBestLineupHelpAnchor : undefined,
              showExtraTimeSetBestLineupMode,
              fixedFormationOptions,
              selectedFixedFormation,
              onSelectedFixedFormationChange,
              setBestLineupCustomContent,
              setBestLineupDisabledTooltipBuilder?.(match)
            );
          })}
        </ul>
      ) : sortedAll.length > 0 ? (
        <>
          <p className={styles.muted}>{messages.noUpcomingMatches}</p>
          <ul className={styles.matchList}>
            {sortedAll.map((match, index) => {
              const matchId = Number(match.MatchID);
              if (!Number.isFinite(matchId)) return null;
              const state = matchStates[matchId] ?? { status: "idle" };
              const updatedLabel = state.updatedAt
                ? `${messages.submitOrdersUpdated}: ${formatDateTime(state.updatedAt)}`
                : null;
              const opponent = resolveOpponentTeam(match, teamId);
              const opponentCupStatus =
                opponent && getOpponentCupStatus ? getOpponentCupStatus(opponent.teamId) : null;
              return renderMatch(
                matchId,
                match,
                teamId,
                sourceSystem,
                messages,
                hasLineup,
                state,
                handleSubmit,
                updatedLabel,
                loadStates[matchId],
                handleLoadLineup,
                handleSetBestLineupMode,
                handleAnalyzeOpponent,
                opponentCupStatus,
                bestLineupPendingMatchId === matchId,
                analyzePendingMatchId === matchId,
                loadedMatchId === matchId,
                submitEnabledMatchId,
                submitRestrictedTooltipBuilder?.(submitRestrictedMatch),
                assignedCount,
                index === 0 ? setBestLineupHelpAnchor : undefined,
                showExtraTimeSetBestLineupMode,
                fixedFormationOptions,
                selectedFixedFormation,
                onSelectedFixedFormationChange,
                setBestLineupCustomContent,
                setBestLineupDisabledTooltipBuilder?.(match)
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
