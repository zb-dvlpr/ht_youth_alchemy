"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { fetchChppJson } from "@/lib/chpp/client";
import { hattrickMatchUrlWithSourceSystem } from "@/lib/hattrick/urls";
import { parseCoachLeadership } from "@/lib/clubChronicle/coach";
import {
  COACH_LEADERSHIP_VALUES,
  TEAM_SPIRIT_LABELS,
  applyTeamSpiritAttitude,
  calculateMidfieldPercent,
  calculateNaturalTeamSpirit,
  driftTeamSpiritDays,
  formatTeamSpirit,
  normalizeTeamSpiritPsychologistLevel,
  parseApiTeamAttitude,
  type CoachLeadership,
  type TeamSpiritAttitude,
} from "@/lib/teamSpirit";
import {
  migrateSeniorTeamSpiritLocalStorageSettings,
  pruneSeniorTeamSpiritSettingsForCurrentSeason,
  readSeniorTeamSpiritSettings,
  writeSeniorTeamSpiritSettings,
  type SeniorTeamSpiritSettings,
} from "@/lib/seniorTeamSpiritStorage";
import {
  HATTRICK_WEEK_MS,
  buildDebugMainCupMatch,
  buildMainCupPlaceholders,
  deduplicateTeamSpiritMatches,
  filterCurrentSeasonNonLeagueMatches,
  formatHattrickMatchDate,
  isActualMainCupMatch,
  isFinishedMatch,
  isInProgressMatch,
  isQualificationMatch,
  isTeamSpiritNonLeagueCandidate,
  isUpcomingMatch,
  matchKey,
  normalizeLeagueFixtures,
  normalizeTeamSpiritMatch,
  refreshTeamSpiritStatuses,
  sortTeamSpiritMatches,
  toTeamSpiritNumber,
  toTeamSpiritString,
  type TeamSpiritMatch,
} from "@/lib/seniorTeamSpiritTimeline";
import {
  DEBUG_TEAM_SPIRIT_STILL_IN_CUP_EVENT,
  DEBUG_TEAM_SPIRIT_STILL_IN_CUP_STORAGE_KEY,
  readDebugTeamSpiritStillInCup,
} from "@/lib/settings";
import type { Match, MatchesResponse } from "./UpcomingMatches";
import Tooltip from "./Tooltip";

type SeniorTeamSpiritProps = {
  matchesResponse: MatchesResponse;
  messages: Messages;
  teamId: number | null;
  currentSeason: number | null;
  defaultCoachLeadership: CoachLeadership | null;
  onRefresh?: () => boolean | Promise<boolean>;
};

type MatchDetailState = {
  status: "loading" | "success" | "error";
  attitude: TeamSpiritAttitude | null;
  error?: string | null;
};

type TeamSpiritBlockReason = "missingFinishedAttitude" | "matchInProgress";

type TimelineRow = {
  match: TeamSpiritMatch;
  attitude: TeamSpiritAttitude | null;
  calculatedBefore: number | null;
  before: number | null;
  beforeOverride: number | null;
  beforeOverridden: boolean;
  midfieldPercent: number | null;
  after: number | null;
  recoveryDays: number | null;
  afterRecovery: number | null;
  uncertain: boolean;
  blockedReason: TeamSpiritBlockReason | null;
  isFirstTeamSpiritMatch: boolean;
};

const MAX_SPORTS_PSYCHOLOGIST_LEVEL = 5;

function clampSportsPsychologistLevel(value: unknown): number {
  return normalizeTeamSpiritPsychologistLevel(Number(value));
}

function normalizeSportsPsychologistOnLevel(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_SPORTS_PSYCHOLOGIST_LEVEL, Math.floor(parsed)));
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  return toTeamSpiritNumber(value);
}

function toStringValue(value: unknown): string {
  return toTeamSpiritString(value);
}

function normalizeMatchesFromPayload(payload: unknown): Match[] {
  const root = (payload as { data?: { HattrickData?: unknown } } | null)?.data
    ?.HattrickData as
    | {
        Team?: { MatchList?: { Match?: Match[] | Match } };
        MatchList?: { Match?: Match[] | Match };
      }
    | undefined;
  return [
    ...asArray(root?.Team?.MatchList?.Match),
    ...asArray(root?.MatchList?.Match),
  ];
}

function fullElapsedDays(fromTime: number, toTime: number) {
  return Math.max(0, Math.floor((toTime - fromTime) / 86_400_000));
}

function attitudeLabel(messages: Messages, attitude: TeamSpiritAttitude) {
  if (attitude === "PIC") return messages.teamSpiritAttitudePic;
  if (attitude === "MOTS") return messages.teamSpiritAttitudeMots;
  return messages.teamSpiritAttitudePin;
}

function teamSpiritLevelLabel(messages: Messages, value: number) {
  switch (value) {
    case 0.5:
      return messages.teamSpiritLevel_0_5;
    case 1.5:
      return messages.teamSpiritLevel_1_5;
    case 2.5:
      return messages.teamSpiritLevel_2_5;
    case 3.5:
      return messages.teamSpiritLevel_3_5;
    case 4.5:
      return messages.teamSpiritLevel_4_5;
    case 5.5:
      return messages.teamSpiritLevel_5_5;
    case 6.5:
      return messages.teamSpiritLevel_6_5;
    case 7.5:
      return messages.teamSpiritLevel_7_5;
    case 8.5:
      return messages.teamSpiritLevel_8_5;
    case 9.5:
      return messages.teamSpiritLevel_9_5;
    case 10.5:
      return messages.teamSpiritLevel_10_5;
    default:
      return String(value);
  }
}

function closestTeamSpiritLabelValue(value: number): number {
  let closest = TEAM_SPIRIT_LABELS[0];
  for (const candidate of TEAM_SPIRIT_LABELS) {
    if (Math.abs(candidate.value - value) < Math.abs(closest.value - value)) {
      closest = candidate;
    }
  }
  return closest.value;
}

function formatCalculatedSeasonStartMessage(
  messages: Messages,
  value: number,
  psychologistLevel: number
) {
  const level = teamSpiritLevelLabel(messages, closestTeamSpiritLabelValue(value));
  return messages.teamSpiritCalculatedSeasonStart
    .replace("{{value}}", value.toFixed(1))
    .replace("{{level}}", level)
    .replace("{{psychologistLevel}}", String(psychologistLevel));
}

function matchTypeLabel(messages: Messages, match: TeamSpiritMatch) {
  const matchType = toNumber(match.MatchType);
  if (matchType === 1) return messages.teamSpiritLeagueMatch;
  if (matchType === 2) return messages.clubChronicleMatchTypeQualification;
  if (matchType === 3 && toNumber(match.CupLevel) === 1) {
    return messages.teamSpiritMainCupMatch;
  }
  return messages.matchTypeUnknown;
}

function matchStatusLabel(messages: Messages, match: TeamSpiritMatch) {
  if (isFinishedMatch(match)) return messages.matchStatusFinished;
  if (isUpcomingMatch(match)) return messages.matchStatusUpcoming;
  if (isInProgressMatch(match)) return messages.matchStatusOngoing;
  return messages.matchStatusUpcoming;
}

function rawFieldExists(source: Record<string, unknown> | null | undefined, field: string) {
  return Boolean(source && Object.prototype.hasOwnProperty.call(source, field));
}

type SeniorTeamContext = {
  leagueLevelUnitId: number | null;
  stillInMainCup: boolean | null;
};

function normalizeStillInCup(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  const normalized = toStringValue(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function resolveStillInMainCup(cup: Record<string, unknown> | null): boolean | null {
  if (!cup) return null;

  const stillInAnyCup = normalizeStillInCup(cup.StillInCup);
  if (stillInAnyCup === null) return null;
  if (!stillInAnyCup) return false;

  const cupLevel = toNumber(cup.CupLevel);
  if (cupLevel === null || !Number.isFinite(cupLevel) || !Number.isInteger(cupLevel)) {
    return null;
  }

  return cupLevel === 1;
}

function extractLeagueLevelUnitId(team: Record<string, unknown> | null | undefined) {
  if (!team) return null;
  const leagueLevelUnit = asObjectRecord(team.LeagueLevelUnit);
  const league = asObjectRecord(team.League);
  const leagueLevelUnitId =
    toNumber(team.LeagueLevelUnitID) ??
    toNumber(team.LeagueLevelUnitId) ??
    toNumber(leagueLevelUnit?.LeagueLevelUnitID) ??
    toNumber(leagueLevelUnit?.LeagueLevelUnitId) ??
    toNumber(league?.LeagueLevelUnitID) ??
    toNumber(league?.LeagueLevelUnitId);
  return leagueLevelUnitId !== null && leagueLevelUnitId > 0 ? leagueLevelUnitId : null;
}

function resolveTeamDetailsContext(payload: unknown, teamId: number): SeniorTeamContext {
  const root = (payload as { data?: { HattrickData?: unknown } } | null)?.data
    ?.HattrickData as
    | {
        Team?: Record<string, unknown>;
        Teams?: { Team?: Record<string, unknown>[] | Record<string, unknown> };
      }
    | undefined;
  const teams = [
    ...asArray(root?.Team),
    ...asArray(root?.Teams?.Team),
  ].filter((team): team is Record<string, unknown> => Boolean(team));
  const selectedTeam =
    teams.find((team) => toNumber(team.TeamID) === teamId || toNumber(team.TeamId) === teamId) ??
    (teams.length === 1 ? teams[0] : null);
  const cup = asObjectRecord(selectedTeam?.Cup);
  return {
    leagueLevelUnitId: extractLeagueLevelUnitId(selectedTeam),
    stillInMainCup: resolveStillInMainCup(cup),
  };
}

function buildDefaultSettings(teamId: number, season: number): SeniorTeamSpiritSettings {
  return {
    schemaVersion: 2,
    teamId,
    season,
    coachLeadershipOverride: null,
    sportsPsychologistEnabledOverride: null,
    sportsPsychologistLevelOverride: null,
    upcomingAttitudes: {},
    teamSpiritBeforeMatchOverrides: {},
    updatedAt: Date.now(),
  };
}

function calculateRows(input: {
  matches: TeamSpiritMatch[];
  initialTeamSpirit: number | null;
  initialBlockedReason?: TeamSpiritBlockReason | null;
  attitudes: (match: TeamSpiritMatch) => TeamSpiritAttitude | null;
  beforeMatchOverrides: Record<string, number>;
  coachLeadership: CoachLeadership;
  sportsPsychologistLevel: number;
}): {
  rows: TimelineRow[];
  finalTeamSpirit: number | null;
  blockedReason: TeamSpiritBlockReason | null;
} {
  let current = input.initialTeamSpirit;
  let blockedReason = input.initialBlockedReason ?? null;
  const rows = input.matches.map((match, index) => {
    const key = matchKey(match);
    const isFirstTeamSpiritMatch = index === 0;
    const inProgress = isInProgressMatch(match);
    const finished = isFinishedMatch(match);
    const attitude = inProgress ? null : input.attitudes(match);
    const calculatedBefore = isFirstTeamSpiritMatch ? input.initialTeamSpirit : current;
    const beforeOverride = isFirstTeamSpiritMatch
      ? null
      : input.beforeMatchOverrides[key] ?? null;
    const before = isFirstTeamSpiritMatch
      ? input.initialTeamSpirit
      : beforeOverride ?? calculatedBefore;
    const midfieldPercent =
      before !== null && attitude ? calculateMidfieldPercent(before, attitude) : null;
    const after =
      before !== null && attitude ? applyTeamSpiritAttitude(before, attitude) : null;
    const nextMatch = input.matches[index + 1] ?? null;
    const recoveryDays = nextMatch ? fullElapsedDays(match.sortTime, nextMatch.sortTime) : null;
    const afterRecovery =
      after !== null && recoveryDays !== null
        ? driftTeamSpiritDays(
            after,
            recoveryDays,
            input.coachLeadership,
            input.sportsPsychologistLevel
          )
        : null;
    const rowBlockedReason =
      before === null
        ? blockedReason
        : inProgress
        ? "matchInProgress"
        : !attitude && finished
      ? "missingFinishedAttitude"
      : null;
    const rowUncertain = Boolean(rowBlockedReason);
    if (inProgress) {
      current = null;
      blockedReason = "matchInProgress";
    } else if (!attitude) {
      current = null;
      if (finished) blockedReason = "missingFinishedAttitude";
    } else if (after !== null) {
      current = afterRecovery ?? after;
      blockedReason = null;
    } else {
      current = null;
    }
    return {
      match,
      attitude,
      calculatedBefore,
      before,
      beforeOverride,
      beforeOverridden: beforeOverride !== null,
      midfieldPercent,
      after,
      recoveryDays,
      afterRecovery,
      uncertain: rowUncertain,
      blockedReason: rowBlockedReason,
      isFirstTeamSpiritMatch,
    };
  });
  return { rows, finalTeamSpirit: current, blockedReason };
}

export default function SeniorTeamSpirit({
  matchesResponse,
  messages,
  teamId,
  currentSeason,
  defaultCoachLeadership,
  onRefresh,
}: SeniorTeamSpiritProps) {
  const isDev = process.env.NODE_ENV !== "production";
  const [teamContextStatus, setTeamContextStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [teamContextError, setTeamContextError] = useState<string | null>(null);
  const [leagueLevelUnitId, setLeagueLevelUnitId] = useState<number | null>(null);
  const [stillInMainCup, setStillInMainCup] = useState<boolean | null>(null);
  const [leagueFixturesMatches, setLeagueFixturesMatches] = useState<TeamSpiritMatch[]>([]);
  const [leagueFixturesStatus, setLeagueFixturesStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [leagueFixturesError, setLeagueFixturesError] = useState<string | null>(null);
  const [archiveNonLeagueMatches, setArchiveNonLeagueMatches] = useState<TeamSpiritMatch[]>([]);
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "loading" | "error">("idle");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [clubStatus, setClubStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [clubWarning, setClubWarning] = useState<string | null>(null);
  const [fetchedPsychologistLevel, setFetchedPsychologistLevel] = useState<number | null>(null);
  const [fetchedCoachLeadership, setFetchedCoachLeadership] = useState<CoachLeadership | null>(null);
  const [settings, setSettings] = useState<SeniorTeamSpiritSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [matchDetails, setMatchDetails] = useState<Record<string, MatchDetailState>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [debugSimulateStillInMainCup, setDebugSimulateStillInMainCup] =
    useState(() =>
      process.env.NODE_ENV !== "production"
        ? readDebugTeamSpiritStillInCup()
        : false
    );
  const matchDetailsRunIdRef = useRef(0);
  const inFlightMatchDetailKeysRef = useRef<Set<string>>(new Set());
  const currentMatchDetailsRef = useRef<Record<string, MatchDetailState>>({});

  useEffect(() => {
    currentMatchDetailsRef.current = matchDetails;
  }, [matchDetails]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isDev || typeof window === "undefined") return;

    const sync = () => {
      setDebugSimulateStillInMainCup(readDebugTeamSpiritStillInCup());
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === DEBUG_TEAM_SPIRIT_STILL_IN_CUP_STORAGE_KEY ||
        event.key === null
      ) {
        sync();
      }
    };

    sync();
    window.addEventListener(DEBUG_TEAM_SPIRIT_STILL_IN_CUP_EVENT, sync);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(DEBUG_TEAM_SPIRIT_STILL_IN_CUP_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, [isDev]);

  const currentNonLeagueMatches = useMemo(
    () =>
      normalizeMatchesFromPayload(matchesResponse)
        .filter(isTeamSpiritNonLeagueCandidate)
        .map((match) => normalizeTeamSpiritMatch(match, nowMs))
        .filter((match): match is TeamSpiritMatch => Boolean(match)),
    [matchesResponse, nowMs]
  );

  const leagueFixturesWithCurrentStatus = useMemo(
    () => refreshTeamSpiritStatuses(leagueFixturesMatches, nowMs),
    [leagueFixturesMatches, nowMs]
  );

  const archiveNonLeagueWithCurrentStatus = useMemo(
    () => refreshTeamSpiritStatuses(archiveNonLeagueMatches, nowMs),
    [archiveNonLeagueMatches, nowMs]
  );

  const timelineMatches = useMemo(() => {
    if (leagueFixturesStatus !== "success" || leagueFixturesWithCurrentStatus.length === 0) {
      return [];
    }
    const sortedLeague = sortTeamSpiritMatches(leagueFixturesWithCurrentStatus);
    const firstLeagueTime = sortedLeague[0]?.sortTime ?? null;
    const lastLeagueTime = sortedLeague[sortedLeague.length - 1]?.sortTime ?? null;
    const archiveFiltered = filterCurrentSeasonNonLeagueMatches(
      archiveNonLeagueWithCurrentStatus,
      firstLeagueTime,
      lastLeagueTime
    );
    const currentFiltered = filterCurrentSeasonNonLeagueMatches(
      currentNonLeagueMatches,
      firstLeagueTime,
      lastLeagueTime
    );
    const realNonLeague = deduplicateTeamSpiritMatches([
      ...archiveFiltered,
      ...currentFiltered,
    ]);
    const realMatches = sortTeamSpiritMatches([
      ...leagueFixturesWithCurrentStatus,
      ...realNonLeague,
    ]);
    const qualificationEndTime = realMatches
      .filter((match) => !match.isSyntheticPlaceholder && isQualificationMatch(match))
      .reduce((latest, match) => Math.max(latest, match.sortTime), 0);
    const seasonEndTime =
      lastLeagueTime === null
        ? null
        : Math.max(lastLeagueTime + HATTRICK_WEEK_MS, qualificationEndTime);
    const effectiveStillInMainCup =
      isDev && debugSimulateStillInMainCup ? true : stillInMainCup === true;
    if (!effectiveStillInMainCup) return realMatches;
    const actualCupMatches = realMatches.filter(
      (match) => !match.isSyntheticPlaceholder && isActualMainCupMatch(match)
    );
    const sortedActualCupMatches = sortTeamSpiritMatches(actualCupMatches);
    const latestActualCupMatch =
      sortedActualCupMatches[sortedActualCupMatches.length - 1] ?? null;
    const occupiedSortTimes = new Set(realMatches.map((match) => match.sortTime));
    const debugDummy =
      isDev && debugSimulateStillInMainCup
        ? buildDebugMainCupMatch({
            teamId: teamId ?? 0,
            latestActualCupMatch,
            nowMs,
            seasonEndTime,
            occupiedSortTimes,
          })
        : null;
    if (debugDummy) occupiedSortTimes.add(debugDummy.sortTime);
    const placeholders = buildMainCupPlaceholders({
      teamId: teamId ?? 0,
      anchorCupMatch: debugDummy ?? latestActualCupMatch,
      seasonEndTime,
      occupiedSortTimes,
    });
    return sortTeamSpiritMatches([
      ...realMatches,
      ...(debugDummy ? [debugDummy] : []),
      ...placeholders,
    ]);
  }, [
    archiveNonLeagueWithCurrentStatus,
    currentNonLeagueMatches,
    debugSimulateStillInMainCup,
    isDev,
    leagueFixturesStatus,
    leagueFixturesWithCurrentStatus,
    nowMs,
    stillInMainCup,
    teamId,
  ]);

  const finishedMatches = useMemo(() => timelineMatches.filter(isFinishedMatch), [timelineMatches]);
  const completedMatchKeysSignature = useMemo(
    () => finishedMatches.map(matchKey).join("|"),
    [finishedMatches]
  );
  const timelineKeysSignature = useMemo(
    () => timelineMatches.map(matchKey).join("|"),
    [timelineMatches]
  );
  const finishedMatchesByKey = useMemo(() => {
    const map = new Map<string, TeamSpiritMatch>();
    for (const match of finishedMatches) map.set(matchKey(match), match);
    return map;
  }, [finishedMatches]);

  useEffect(() => {
    let cancelled = false;
    matchDetailsRunIdRef.current += 1;
    inFlightMatchDetailKeysRef.current.clear();
    currentMatchDetailsRef.current = {};
    setMatchDetails({});
    setArchiveNonLeagueMatches([]);
    setLeagueFixturesMatches([]);
    setLeagueLevelUnitId(null);
    setStillInMainCup(null);
    setTeamContextStatus("idle");
    setTeamContextError(null);
    setLeagueFixturesStatus("idle");
    setLeagueFixturesError(null);
    setFetchedPsychologistLevel(null);
    setFetchedCoachLeadership(null);
    setClubWarning(null);
    setSettings(null);
    setSettingsLoaded(false);
    if (!teamId || !currentSeason) return;
    void (async () => {
      await migrateSeniorTeamSpiritLocalStorageSettings();
      await pruneSeniorTeamSpiritSettingsForCurrentSeason(currentSeason);
      const stored = await readSeniorTeamSpiritSettings(teamId, currentSeason);
      if (cancelled) return;
      setSettings(stored ?? buildDefaultSettings(teamId, currentSeason));
      setSettingsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, currentSeason, refreshNonce]);

  useEffect(() => {
    if (
      !settings ||
      !settingsLoaded ||
      leagueFixturesStatus !== "success" ||
      archiveStatus === "loading" ||
      teamContextStatus !== "success"
    ) {
      return;
    }
    const currentKeys = new Set(timelineKeysSignature.split("|").filter(Boolean));
    const upcomingAttitudes = Object.fromEntries(
      Object.entries(settings.upcomingAttitudes).filter(([key]) => currentKeys.has(key))
    );
    const teamSpiritBeforeMatchOverrides = Object.fromEntries(
      Object.entries(settings.teamSpiritBeforeMatchOverrides).filter(([key]) =>
        currentKeys.has(key)
      )
    );
    if (
      Object.keys(upcomingAttitudes).length === Object.keys(settings.upcomingAttitudes).length &&
      Object.keys(teamSpiritBeforeMatchOverrides).length ===
        Object.keys(settings.teamSpiritBeforeMatchOverrides).length
    ) {
      return;
    }
    const next = {
      ...settings,
      upcomingAttitudes,
      teamSpiritBeforeMatchOverrides,
    };
    setSettings(next);
    void writeSeniorTeamSpiritSettings(next);
  }, [
    archiveStatus,
    leagueFixturesStatus,
    settings,
    settingsLoaded,
    teamContextStatus,
    timelineKeysSignature,
  ]);

  useEffect(() => {
    if (!teamId || !currentSeason) return;
    const controller = new AbortController();
    setTeamContextStatus("loading");
    setTeamContextError(null);
    setLeagueLevelUnitId(null);
    setStillInMainCup(null);
    setLeagueFixturesMatches([]);
    setLeagueFixturesStatus("idle");
    setLeagueFixturesError(null);
    fetchChppJson<unknown>(`/api/chpp/teamdetails?teamId=${teamId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(({ response, payload }) => {
        if (!response.ok) {
          throw new Error(
            (payload as { details?: string; error?: string } | null)?.details ??
              (payload as { error?: string } | null)?.error ??
              messages.teamSpiritLoadTeamDetailsFailed
          );
        }
        const context = resolveTeamDetailsContext(payload, teamId);
        if (!context.leagueLevelUnitId) {
          throw new Error(messages.teamSpiritLoadTeamDetailsFailed);
        }
        setLeagueLevelUnitId(context.leagueLevelUnitId);
        setStillInMainCup(context.stillInMainCup);
        setTeamContextStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLeagueLevelUnitId(null);
        setStillInMainCup(null);
        setTeamContextStatus("error");
        setTeamContextError(
          error instanceof Error ? error.message : messages.teamSpiritLoadTeamDetailsFailed
        );
      });
    return () => controller.abort();
  }, [teamId, currentSeason, refreshNonce, messages.teamSpiritLoadTeamDetailsFailed]);

  useEffect(() => {
    if (!teamId || !currentSeason || !leagueLevelUnitId) return;
    const controller = new AbortController();
    setLeagueFixturesStatus("loading");
    setLeagueFixturesError(null);
    setLeagueFixturesMatches([]);
    fetchChppJson<unknown>(
      `/api/chpp/leaguefixtures?leagueLevelUnitID=${leagueLevelUnitId}`,
      { cache: "no-store", signal: controller.signal }
    )
      .then(({ response, payload }) => {
        if (!response.ok) {
          throw new Error(
            (payload as { details?: string; error?: string } | null)?.details ??
              (payload as { error?: string } | null)?.error ??
              messages.teamSpiritLoadLeagueFixturesFailed
          );
        }
        const matches = normalizeLeagueFixtures(payload, teamId, Date.now());
        if (matches.length === 0) {
          throw new Error(messages.teamSpiritLoadLeagueFixturesFailed);
        }
        setLeagueFixturesMatches(matches);
        setLeagueFixturesStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLeagueFixturesMatches([]);
        setLeagueFixturesStatus("error");
        setLeagueFixturesError(
          error instanceof Error ? error.message : messages.teamSpiritLoadLeagueFixturesFailed
        );
      });
    return () => controller.abort();
  }, [
    teamId,
    currentSeason,
    leagueLevelUnitId,
    refreshNonce,
    messages.teamSpiritLoadLeagueFixturesFailed,
  ]);

  useEffect(() => {
    if (!teamId || !currentSeason) return;
    const controller = new AbortController();
    setArchiveStatus("loading");
    setArchiveError(null);
    fetchChppJson<unknown>(
      `/api/chpp/matchesarchive?teamId=${teamId}&isYouth=false&season=${currentSeason}`,
      { cache: "no-store", signal: controller.signal }
    )
      .then(({ response, payload }) => {
        if (!response.ok) {
          throw new Error(
            (payload as { details?: string; error?: string } | null)?.details ??
              (payload as { error?: string } | null)?.error ??
              messages.teamSpiritLoadArchiveFailed
          );
        }
        const matches = normalizeMatchesFromPayload(payload)
          .filter(isTeamSpiritNonLeagueCandidate)
          .map((match) => normalizeTeamSpiritMatch(match, Date.now()))
          .filter((match): match is TeamSpiritMatch => Boolean(match));
        setArchiveNonLeagueMatches(matches);
        setArchiveStatus("idle");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setArchiveStatus("error");
        setArchiveError(error instanceof Error ? error.message : messages.teamSpiritLoadArchiveFailed);
      });
    return () => controller.abort();
  }, [teamId, currentSeason, refreshNonce, messages.teamSpiritLoadArchiveFailed]);

  useEffect(() => {
    if (!teamId || !currentSeason) return;
    const controller = new AbortController();
    setClubStatus("loading");
    setClubWarning(null);
    fetchChppJson<unknown>(`/api/chpp/club?teamId=${teamId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(({ response, payload }) => {
        if (!response.ok) {
          throw new Error(
            (payload as { details?: string; error?: string } | null)?.details ??
              messages.teamSpiritLoadClubFailed
          );
        }
        const level = toNumber(
          (payload as {
            data?: { HattrickData?: { Team?: { Staff?: { SportPsychologistLevels?: unknown } } } };
          })?.data?.HattrickData?.Team?.Staff?.SportPsychologistLevels
        );
        setFetchedPsychologistLevel(clampSportsPsychologistLevel(level));
        setClubStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setFetchedPsychologistLevel(null);
        setClubStatus("error");
        setClubWarning(
          error instanceof Error ? error.message : messages.teamSpiritLoadClubFailed
        );
      });
    return () => controller.abort();
  }, [teamId, currentSeason, refreshNonce, messages.teamSpiritLoadClubFailed]);

  useEffect(() => {
    if (!teamId || !currentSeason || defaultCoachLeadership) return;
    const controller = new AbortController();
    fetchChppJson<unknown>(`/api/chpp/stafflist?teamId=${teamId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(({ response, payload }) => {
        if (!response.ok) return;
        const leadership = parseCoachLeadership(
          (payload as {
            data?: { HattrickData?: { StaffList?: { Trainer?: { Leadership?: unknown } } } };
          })?.data?.HattrickData?.StaffList?.Trainer?.Leadership
        );
        if (!controller.signal.aborted) setFetchedCoachLeadership(leadership);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetchedCoachLeadership(null);
      });
    return () => controller.abort();
  }, [teamId, currentSeason, refreshNonce, defaultCoachLeadership]);

  useEffect(() => {
    const runId = matchDetailsRunIdRef.current + 1;
    matchDetailsRunIdRef.current = runId;
    const inFlightMatchDetailKeys = inFlightMatchDetailKeysRef.current;
    inFlightMatchDetailKeys.clear();

    const finishedKeys = completedMatchKeysSignature
      .split("|")
      .filter(Boolean);
    const currentKeys = new Set(finishedKeys);

    setMatchDetails((current) => {
      const next: Record<string, MatchDetailState> = {};
      for (const key of currentKeys) {
        const existing = current[key];
        if (existing?.status === "success" || existing?.status === "error") {
          next[key] = existing;
        }
      }
      return next;
    });

    if (!teamId || !currentSeason || finishedKeys.length === 0) {
      return () => {
        if (matchDetailsRunIdRef.current === runId) {
          matchDetailsRunIdRef.current += 1;
          inFlightMatchDetailKeys.clear();
        }
      };
    }

    const matchesToRequest = finishedKeys
      .map((key) => finishedMatchesByKey.get(key) ?? null)
      .filter((match): match is TeamSpiritMatch => {
        if (!match) return false;
        if (match.isSyntheticPlaceholder || !match.MatchID) return false;
        const existing = currentMatchDetailsRef.current[matchKey(match)];
        return existing?.status !== "success" && existing?.status !== "error";
      });

    if (matchesToRequest.length === 0) {
      return () => {
        if (matchDetailsRunIdRef.current === runId) {
          matchDetailsRunIdRef.current += 1;
          inFlightMatchDetailKeys.clear();
        }
      };
    }

    const controller = new AbortController();
    for (const match of matchesToRequest) {
      inFlightMatchDetailKeys.add(matchKey(match));
    }
    setMatchDetails((current) => {
      const next = { ...current };
      for (const match of matchesToRequest) {
        const key = matchKey(match);
        if (next[key]?.status !== "success" && next[key]?.status !== "error") {
          next[key] = { status: "loading", attitude: null };
        }
      }
      return next;
    });

    const run = async () => {
      const queue = [...matchesToRequest];
      const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length > 0) {
          const match = queue.shift();
          if (!match) return;
          const key = matchKey(match);
          try {
            const { response, payload } = await fetchChppJson<unknown>(
              `/api/chpp/matchdetails?matchId=${match.MatchID}&sourceSystem=${encodeURIComponent(
                match.SourceSystem
              )}&matchEvents=false`,
              { cache: "no-store", signal: controller.signal }
            );
            if (!response.ok) {
              throw new Error(
                (payload as { details?: string; error?: string } | null)?.details ??
                  messages.teamSpiritLoadMatchDetailsFailed
              );
            }
            const detail = (payload as {
              data?: {
                HattrickData?: {
                  Match?: {
                    HomeTeam?: Record<string, unknown>;
                    AwayTeam?: Record<string, unknown>;
                  };
                };
              };
            })?.data?.HattrickData?.Match;
            const homeId =
              toNumber(detail?.HomeTeam?.HomeTeamID) ??
              toNumber(detail?.HomeTeam?.TeamID) ??
              toNumber(detail?.HomeTeam?.TeamId);
            const awayId =
              toNumber(detail?.AwayTeam?.AwayTeamID) ??
              toNumber(detail?.AwayTeam?.TeamID) ??
              toNumber(detail?.AwayTeam?.TeamId);
            const rawAttitude =
              homeId === teamId
                ? detail?.HomeTeam?.TeamAttitude
                : awayId === teamId
                ? detail?.AwayTeam?.TeamAttitude
                : null;
            if (process.env.NODE_ENV !== "production") {
              console.debug("[TeamSpirit] matchdetails parsed", {
                matchId: match.MatchID,
                sourceSystem: match.SourceSystem,
                selectedTeamId: teamId,
                homeId,
                awayId,
                homeHasHomeTeamID: rawFieldExists(detail?.HomeTeam, "HomeTeamID"),
                homeHasTeamID: rawFieldExists(detail?.HomeTeam, "TeamID"),
                homeHasTeamId: rawFieldExists(detail?.HomeTeam, "TeamId"),
                awayHasAwayTeamID: rawFieldExists(detail?.AwayTeam, "AwayTeamID"),
                awayHasTeamID: rawFieldExists(detail?.AwayTeam, "TeamID"),
                awayHasTeamId: rawFieldExists(detail?.AwayTeam, "TeamId"),
                rawAttitude,
              });
            }
            if (homeId !== teamId && awayId !== teamId) {
              throw new Error(messages.teamSpiritSelectedTeamNotInMatch);
            }
            const attitude = parseApiTeamAttitude(rawAttitude);
            if (matchDetailsRunIdRef.current !== runId) {
              if (process.env.NODE_ENV !== "production") {
                console.debug("[TeamSpirit] stale matchdetails success ignored", {
                  runId,
                  key,
                  matchId: match.MatchID,
                  sourceSystem: match.SourceSystem,
                });
              }
              continue;
            }
            inFlightMatchDetailKeys.delete(key);
            setMatchDetails((current) => ({
              ...current,
              [key]: { status: "success", attitude },
            }));
          } catch (error) {
            if (matchDetailsRunIdRef.current !== runId) {
              if (process.env.NODE_ENV !== "production") {
                console.debug("[TeamSpirit] stale matchdetails error ignored", {
                  runId,
                  key,
                  matchId: match.MatchID,
                  sourceSystem: match.SourceSystem,
                });
              }
              continue;
            }
            inFlightMatchDetailKeys.delete(key);
            setMatchDetails((current) => ({
              ...current,
              [key]: {
                status: "error",
                attitude: null,
                error:
                  controller.signal.aborted
                    ? messages.teamSpiritLoadMatchDetailsFailed
                    : error instanceof Error
                    ? error.message
                    : messages.teamSpiritLoadMatchDetailsFailed,
              },
            }));
          }
        }
      });
      await Promise.all(workers);
    };
    void run();
    return () => {
      if (matchDetailsRunIdRef.current === runId) {
        matchDetailsRunIdRef.current += 1;
        inFlightMatchDetailKeys.clear();
      }
      controller.abort();
    };
  }, [
    teamId,
    currentSeason,
    completedMatchKeysSignature,
    finishedMatchesByKey,
    refreshNonce,
    messages.teamSpiritLoadMatchDetailsFailed,
    messages.teamSpiritSelectedTeamNotInMatch,
  ]);

  const persistSettings = useCallback(
    (updater: (current: SeniorTeamSpiritSettings) => SeniorTeamSpiritSettings) => {
      if (!teamId || !currentSeason) return;
      setSettings((current) => {
        const base = current ?? buildDefaultSettings(teamId, currentSeason);
        const next = updater(base);
        void writeSeniorTeamSpiritSettings(next);
        return next;
      });
      setSettingsLoaded(true);
    },
    [teamId, currentSeason]
  );

  const actualCoachLeadership = defaultCoachLeadership ?? fetchedCoachLeadership;
  const effectiveCoachLeadership =
    settings?.coachLeadershipOverride ?? actualCoachLeadership ?? "weak";
  const detectedSportsPsychologistLevel = fetchedPsychologistLevel ?? 0;
  const effectiveSportsPsychologistEnabled =
    settings?.sportsPsychologistEnabledOverride ?? (detectedSportsPsychologistLevel > 0);
  const selectedSportsPsychologistLevel = normalizeSportsPsychologistOnLevel(
    settings?.sportsPsychologistLevelOverride ?? (detectedSportsPsychologistLevel || 1)
  );
  const sportsPsychologistLevelSelectValue =
    settings?.sportsPsychologistLevelOverride == null && detectedSportsPsychologistLevel > 0
      ? "detected"
      : String(selectedSportsPsychologistLevel);
  const effectiveSportsPsychologistLevel = effectiveSportsPsychologistEnabled
    ? selectedSportsPsychologistLevel
    : 0;
  const seasonStartTeamSpirit = calculateNaturalTeamSpirit(
    effectiveSportsPsychologistLevel
  );
  const seasonStartTeamSpiritMessage = formatCalculatedSeasonStartMessage(
    messages,
    seasonStartTeamSpirit,
    effectiveSportsPsychologistLevel
  );

  const rows = useMemo(() => {
    return calculateRows({
      matches: timelineMatches,
      initialTeamSpirit: seasonStartTeamSpirit,
      attitudes: (match) =>
        isUpcomingMatch(match)
          ? settings?.upcomingAttitudes[matchKey(match)] ?? "PIN"
          : matchDetails[matchKey(match)]?.attitude ?? null,
      beforeMatchOverrides: settings?.teamSpiritBeforeMatchOverrides ?? {},
      coachLeadership: effectiveCoachLeadership,
      sportsPsychologistLevel: effectiveSportsPsychologistLevel,
    }).rows;
  }, [
    effectiveCoachLeadership,
    effectiveSportsPsychologistLevel,
    matchDetails,
    seasonStartTeamSpirit,
    settings?.teamSpiritBeforeMatchOverrides,
    settings?.upcomingAttitudes,
    timelineMatches,
  ]);

  if (!currentSeason) {
    return (
      <div className={styles.card}>
        <p className={styles.errorText}>{messages.teamSpiritSeasonUnknown}</p>
      </div>
    );
  }

  const detailsLoading = finishedMatches.some(
    (match) => matchDetails[matchKey(match)]?.status === "loading"
  );
  const coachLeadershipOverridden = settings?.coachLeadershipOverride !== null &&
    settings?.coachLeadershipOverride !== undefined;
  const renderBeforeMatchLabel = (row: TimelineRow) => {
    if (row.isFirstTeamSpiritMatch) return messages.teamSpiritBeforeMatch;
    return (
      <span className={styles.teamSpiritControlLabelWithInfo}>
        <span>{messages.teamSpiritBeforeMatch}</span>
        <Tooltip content={messages.teamSpiritBeforeMatchTooltip}>
          <button
            type="button"
            className={styles.teamSpiritInfoButton}
            aria-label={messages.teamSpiritBeforeMatchInfoAria}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            i
          </button>
        </Tooltip>
      </span>
    );
  };
  const renderBeforeMatchControl = (row: TimelineRow, key: string) => {
    if (row.isFirstTeamSpiritMatch) {
      return (
        <span className={styles.teamSpiritSeasonStartNote}>
          {seasonStartTeamSpiritMessage}
        </span>
      );
    }
    const selectValue = row.beforeOverridden
      ? String(row.beforeOverride)
      : row.calculatedBefore !== null
      ? "calculated"
      : "unavailable";
    return (
      <div className={styles.teamSpiritBeforeMatchControl}>
        <select
          className={styles.sortSelect}
          value={selectValue}
          disabled={!settingsLoaded}
          onChange={(event) =>
            persistSettings((current) => {
              const nextOverrides = { ...current.teamSpiritBeforeMatchOverrides };
              if (event.target.value === "calculated") {
                delete nextOverrides[key];
              } else if (event.target.value !== "unavailable") {
                nextOverrides[key] = Number(event.target.value);
              }
              return {
                ...current,
                teamSpiritBeforeMatchOverrides: nextOverrides,
              };
            })
          }
        >
          {row.calculatedBefore !== null ? (
            <option value="calculated">
              {messages.teamSpiritCalculatedCurrent.replace(
                "{{value}}",
                formatTeamSpirit(row.calculatedBefore)
              )}
            </option>
          ) : (
            <option value="unavailable" disabled>
              {messages.teamSpiritCalculationUnavailable}
            </option>
          )}
          {TEAM_SPIRIT_LABELS.map((option) => (
            <option key={option.value} value={option.value}>
              {teamSpiritLevelLabel(messages, option.value)}
            </option>
          ))}
        </select>
        {row.beforeOverridden ? (
          <div className={styles.teamSpiritMatchOverrideMeta}>
            <span className={styles.teamSpiritOverrideBadge}>
              {messages.teamSpiritManuallyOverridden}
            </span>
            <button
              type="button"
              className={styles.teamSpiritInlineResetButton}
              onClick={() =>
                persistSettings((current) => {
                  const nextOverrides = { ...current.teamSpiritBeforeMatchOverrides };
                  delete nextOverrides[key];
                  return {
                    ...current,
                    teamSpiritBeforeMatchOverrides: nextOverrides,
                  };
                })
              }
            >
              {messages.teamSpiritReset}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`${styles.card} ${styles.teamSpiritCard}`}>
      <div className={styles.matchesHeader}>
        <h2 className={styles.sectionTitle}>{messages.seniorMatchesTeamSpiritTab}</h2>
        <button
          type="button"
          className={styles.sortToggle}
          onClick={() => {
            matchDetailsRunIdRef.current += 1;
            inFlightMatchDetailKeysRef.current.clear();
            currentMatchDetailsRef.current = {};
            setMatchDetails({});
            setArchiveNonLeagueMatches([]);
            setLeagueFixturesMatches([]);
            setRefreshNonce((current) => current + 1);
            void onRefresh?.();
          }}
          aria-label={messages.teamSpiritRefresh}
        >
          ↻
        </button>
      </div>
      <div className={styles.teamSpiritControls}>
        <div className={styles.teamSpiritControlRow}>
          <label className={styles.teamSpiritControl}>
            <span className={styles.teamSpiritControlLabelWithInfo}>
              <span>{messages.teamSpiritCoachLeadership}</span>
              <Tooltip content={messages.teamSpiritCoachLeadershipTooltip}>
                <button
                  type="button"
                  className={styles.teamSpiritInfoButton}
                  aria-label={messages.teamSpiritCoachLeadershipInfoAria}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  i
                </button>
              </Tooltip>
            </span>
            <select
              className={styles.sortSelect}
              value={settings?.coachLeadershipOverride ?? "actual"}
              disabled={!settingsLoaded}
              onChange={(event) =>
                persistSettings((current) => ({
                  ...current,
                  coachLeadershipOverride:
                    event.target.value === "actual"
                      ? null
                      : (event.target.value as CoachLeadership),
                }))
              }
            >
              <option value="actual">
                {messages.teamSpiritCoachLeadershipActual.replace(
                  "{{leadership}}",
                  actualCoachLeadership ?? messages.unknownShort
                )}
              </option>
              {COACH_LEADERSHIP_VALUES.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.key}
                </option>
              ))}
            </select>
          </label>
          {coachLeadershipOverridden ? (
            <div className={styles.teamSpiritOverrideMeta}>
              <span className={styles.teamSpiritOverrideBadge}>
                {messages.teamSpiritManuallyOverridden}
              </span>
              <button
                type="button"
                className={styles.teamSpiritInlineResetButton}
                onClick={() =>
                  persistSettings((current) => ({
                    ...current,
                    coachLeadershipOverride: null,
                  }))
                }
              >
                {messages.teamSpiritReset}
              </button>
            </div>
          ) : null}
        </div>
        <div className={`${styles.teamSpiritControlRow} ${styles.teamSpiritPsychologistRow}`}>
          <label className={styles.matchesFilterToggle}>
            <input
              type="checkbox"
              className={styles.matchesFilterToggleInput}
              checked={effectiveSportsPsychologistEnabled}
              disabled={!settingsLoaded}
              onChange={(event) =>
                persistSettings((current) => ({
                  ...current,
                  sportsPsychologistEnabledOverride: event.target.checked,
                }))
              }
            />
            <span className={styles.matchesFilterToggleTrack} aria-hidden="true" />
            <span className={styles.matchesFilterToggleLabel}>
              <span className={styles.teamSpiritControlLabelWithInfo}>
                <span>{messages.teamSpiritSportsPsychologist}</span>
                <Tooltip content={messages.teamSpiritSportsPsychologistTooltip}>
                  <button
                    type="button"
                    className={styles.teamSpiritInfoButton}
                    aria-label={messages.teamSpiritSportsPsychologistInfoAria}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    i
                  </button>
                </Tooltip>
              </span>
            </span>
          </label>
          <label className={styles.teamSpiritControl}>
            <span>{messages.teamSpiritSportsPsychologistLevel}</span>
            <select
              className={styles.sortSelect}
              value={sportsPsychologistLevelSelectValue}
              disabled={!settingsLoaded || !effectiveSportsPsychologistEnabled}
              onChange={(event) =>
                persistSettings((current) => ({
                  ...current,
                  sportsPsychologistLevelOverride:
                    event.target.value === "detected" ? null : Number(event.target.value),
                }))
              }
            >
              {detectedSportsPsychologistLevel > 0 ? (
                <option value="detected">
                  {messages.teamSpiritSportsPsychologistLevelDetected.replace(
                    "{{level}}",
                    String(detectedSportsPsychologistLevel)
                  )}
                </option>
              ) : null}
              {Array.from({ length: MAX_SPORTS_PSYCHOLOGIST_LEVEL }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {!actualCoachLeadership && !settings?.coachLeadershipOverride ? (
        <p className={styles.teamSpiritWarning}>{messages.teamSpiritCoachLeadershipDefaultWarning}</p>
      ) : null}
      {clubStatus === "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritLoadingClub}</p>
      ) : null}
      {clubWarning ? <p className={styles.teamSpiritWarning}>{clubWarning}</p> : null}
      {clubStatus === "success" && fetchedPsychologistLevel === 0 ? (
        <p className={styles.muted}>{messages.teamSpiritNoSportsPsychologistDetected}</p>
      ) : null}
      {archiveStatus === "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritLoadingArchive}</p>
      ) : null}
      {teamContextStatus === "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritLoadingTeamDetails}</p>
      ) : null}
      {teamContextStatus === "error" ? (
        <p className={styles.errorText}>
          {teamContextError ?? messages.teamSpiritLoadTeamDetailsFailed}
        </p>
      ) : null}
      {leagueFixturesStatus === "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritLoadingLeagueFixtures}</p>
      ) : null}
      {leagueFixturesStatus === "error" ? (
        <p className={styles.errorText}>
          {leagueFixturesError ?? messages.teamSpiritLoadLeagueFixturesFailed}
        </p>
      ) : null}
      {archiveStatus === "error" ? (
        <p className={styles.errorText}>{archiveError ?? messages.teamSpiritLoadArchiveFailed}</p>
      ) : null}
      {detailsLoading ? <p className={styles.muted}>{messages.teamSpiritLoadingDetails}</p> : null}
      {timelineMatches.length === 0 &&
      archiveStatus !== "loading" &&
      leagueFixturesStatus !== "loading" &&
      teamContextStatus !== "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritNoMatches}</p>
      ) : (
        <ul className={styles.matchList}>
          {rows.map((row) => {
            const key = matchKey(row.match);
            const finished = isFinishedMatch(row.match);
            const inProgress = isInProgressMatch(row.match);
            const upcoming = isUpcomingMatch(row.match);
            const detail = matchDetails[key];
            const matchTitle = `${row.match.HomeTeam?.HomeTeamName ?? messages.homeLabel} vs ${
              row.match.AwayTeam?.AwayTeamName ?? messages.awayLabel
            }`;
            const displayTitle =
              row.match.syntheticKind === "debugMainCupMatch"
                ? messages.teamSpiritDebugMainCupMatch
                : row.match.syntheticKind === "mainCupPlaceholder"
                  ? messages.teamSpiritMainCupPlaceholder
                  : matchTitle;
            const unavailableValue =
              row.blockedReason === "matchInProgress"
                ? messages.teamSpiritUnavailableMatchInProgress
                : messages.teamSpiritCalculationUnavailable;
            return (
              <li key={key} className={styles.matchItem}>
                {row.match.isSyntheticPlaceholder || !row.match.MatchID ? (
                  <span className={styles.teamSpiritMatchTitleLink}>{displayTitle}</span>
                ) : (
                  <a
                    className={styles.teamSpiritMatchTitleLink}
                    href={hattrickMatchUrlWithSourceSystem(
                      row.match.MatchID,
                      row.match.SourceSystem
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {displayTitle}
                  </a>
                )}
                <div className={styles.matchMeta}>
                  <span>{matchTypeLabel(messages, row.match)}</span>
                  <span>
                    {formatHattrickMatchDate(row.match.MatchDate) ?? row.match.MatchDate}
                  </span>
                  <span>{matchStatusLabel(messages, row.match)}</span>
                </div>
                {row.match.syntheticKind === "mainCupPlaceholder" ? (
                  <p className={styles.teamSpiritPlaceholderExplanation}>
                    {messages.teamSpiritMainCupPlaceholderExplanation}
                  </p>
                ) : null}
                <div className={styles.teamSpiritStats}>
                  <div className={styles.teamSpiritStatRow}>
                    <span>
                      {upcoming
                        ? messages.teamSpiritAttitudeToBeUsed
                        : messages.teamSpiritAttitudeUsed}
                    </span>
                    {finished ? (
                      <strong>
                        {detail?.status === "loading"
                          ? messages.teamSpiritLoadingDetails
                          : detail?.status === "error"
                          ? messages.teamSpiritCalculationUnavailable
                          : row.attitude
                          ? attitudeLabel(messages, row.attitude)
                          : messages.teamSpiritMissingTeamAttitude}
                      </strong>
                    ) : inProgress ? (
                      <strong>{messages.teamSpiritUnavailableMatchInProgress}</strong>
                    ) : (
                      <select
                        className={styles.sortSelect}
                        value={row.attitude ?? "PIN"}
                        disabled={!settingsLoaded}
                        onChange={(event) =>
                          persistSettings((current) => ({
                            ...current,
                            upcomingAttitudes: {
                              ...current.upcomingAttitudes,
                              [key]: event.target.value as TeamSpiritAttitude,
                            },
                          }))
                        }
                      >
                        <option value="PIC">{messages.teamSpiritAttitudePic}</option>
                        <option value="PIN">{messages.teamSpiritAttitudePin}</option>
                        <option value="MOTS">{messages.teamSpiritAttitudeMots}</option>
                      </select>
                    )}
                  </div>
                  {!upcoming ? (
                    <table className={styles.teamSpiritCompletedTable}>
                      <tbody>
                        <tr>
                          <th scope="row">{renderBeforeMatchLabel(row)}</th>
                          <td>{renderBeforeMatchControl(row, key)}</td>
                        </tr>
                        <tr>
                          <th scope="row">{messages.teamSpiritAfterMatch}</th>
                          <td>
                            {row.after !== null
                              ? formatTeamSpirit(row.after)
                              : unavailableValue}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <>
                      <div className={styles.teamSpiritStatRow}>
                        <span>{renderBeforeMatchLabel(row)}</span>
                        {renderBeforeMatchControl(row, key)}
                      </div>
                      <div className={styles.teamSpiritStatRow}>
                        <span>{messages.teamSpiritAfterMatch}</span>
                        <strong>
                          {row.after !== null
                            ? formatTeamSpirit(row.after)
                            : unavailableValue}
                        </strong>
                      </div>
                      <table className={styles.teamSpiritMidfieldTable}>
                        <thead>
                          <tr>
                            <th scope="col">{messages.teamSpiritMidfieldIfYou}</th>
                            <th scope="col">{messages.teamSpiritMidfieldPerformance}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["PIC", messages.teamSpiritAttitudePicShort],
                            ["PIN", messages.teamSpiritAttitudePin],
                            ["MOTS", messages.teamSpiritAttitudeMotsShort],
                          ].map(([attitude, label]) => (
                            <tr key={attitude}>
                              <th scope="row">{label}</th>
                              <td>
                                {row.before !== null
                                  ? `${calculateMidfieldPercent(
                                      row.before,
                                      attitude as TeamSpiritAttitude
                                    )}%`
                                  : messages.teamSpiritCalculationUnavailable}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
                {detail?.status === "error" ? (
                  <p className={styles.teamSpiritWarning}>
                    {messages.teamSpiritLoadMatchDetailsFailed}: {detail.error}
                  </p>
                ) : null}
                {finished && detail?.status === "success" && !detail.attitude ? (
                  <p className={styles.teamSpiritWarning}>
                    {messages.teamSpiritMissingTeamAttitude}
                  </p>
                ) : null}
                {row.blockedReason === "matchInProgress" ? (
                  <p className={styles.teamSpiritWarning}>
                    {messages.teamSpiritCalculationUnavailableMatchInProgress}
                  </p>
                ) : row.uncertain ? (
                  <p className={styles.teamSpiritWarning}>{messages.teamSpiritCalculationUncertain}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
