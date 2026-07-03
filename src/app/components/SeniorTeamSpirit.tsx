"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { fetchChppJson } from "@/lib/chpp/client";
import { formatChppDateTime } from "@/lib/datetime";
import { parseChppDate } from "@/lib/chpp/utils";
import { hattrickMatchUrlWithSourceSystem } from "@/lib/hattrick/urls";
import {
  COACH_LEADERSHIP_VALUES,
  TEAM_SPIRIT_LABELS,
  applyTeamSpiritAttitude,
  calculateMidfieldPercent,
  driftTeamSpiritDays,
  formatTeamSpirit,
  parseApiTeamAttitude,
  type CoachLeadership,
  type TeamSpiritAttitude,
} from "@/lib/teamSpirit";
import {
  migrateSeniorTeamSpiritLocalStorageSettings,
  readSeniorTeamSpiritSettings,
  writeSeniorTeamSpiritSettings,
  type SeniorTeamSpiritSettings,
} from "@/lib/seniorTeamSpiritStorage";
import type { Match, MatchesResponse } from "./UpcomingMatches";

type SeniorTeamSpiritProps = {
  matchesResponse: MatchesResponse;
  messages: Messages;
  teamId: number | null;
  currentSeason: number | null;
  defaultCoachLeadership: CoachLeadership | null;
  onRefresh?: () => boolean | Promise<boolean>;
};

type TeamSpiritMatch = Match & {
  MatchID: number;
  SourceSystem: string;
  sortTime: number;
};

type MatchDetailState = {
  status: "loading" | "success" | "error";
  attitude: TeamSpiritAttitude | null;
  error?: string | null;
};

type TimelineRow = {
  match: TeamSpiritMatch;
  attitude: TeamSpiritAttitude | null;
  before: number | null;
  midfieldPercent: number | null;
  after: number | null;
  recoveryDays: number | null;
  afterRecovery: number | null;
  uncertain: boolean;
};

const SEASON_START_TEAM_SPIRIT = 4.5;

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    return typeof text === "string" || typeof text === "number" ? String(text) : "";
  }
  return String(value);
}

function parseMatchDate(value: unknown): Date | null {
  const parsed = parseChppDate(toStringValue(value));
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
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

function isTeamSpiritMatch(match: Match): boolean {
  const matchType = toNumber(match.MatchType);
  if (matchType === 1) return true;
  if (matchType !== 3) return false;
  return toNumber(match.CupLevel) === 1;
}

function matchKey(match: { SourceSystem?: string; MatchID: number | string }) {
  const source = match.SourceSystem?.trim() || "Hattrick";
  return `${source}:${match.MatchID}`;
}

function normalizeTimelineMatch(match: Match): TeamSpiritMatch | null {
  const matchId = toNumber(match.MatchID);
  const matchDate = parseMatchDate(match.MatchDate);
  if (!matchId || !matchDate) return null;
  return {
    ...match,
    MatchID: matchId,
    SourceSystem: match.SourceSystem?.trim() || "Hattrick",
    sortTime: matchDate.getTime(),
  };
}

function isCompletedMatch(match: TeamSpiritMatch) {
  if (match.Status === "FINISHED") return true;
  return match.sortTime < Date.now() && match.Status !== "UPCOMING";
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

function matchTypeLabel(messages: Messages, match: TeamSpiritMatch) {
  const matchType = toNumber(match.MatchType);
  if (matchType === 1) return messages.teamSpiritLeagueMatch;
  if (matchType === 3 && toNumber(match.CupLevel) === 1) {
    return messages.teamSpiritMainCupMatch;
  }
  return messages.matchTypeUnknown;
}

function matchStatusLabel(messages: Messages, match: TeamSpiritMatch) {
  if (isCompletedMatch(match)) return messages.matchStatusFinished;
  if (match.Status === "UPCOMING") return messages.matchStatusUpcoming;
  if (match.Status === "ONGOING") return messages.matchStatusOngoing;
  return match.Status ?? messages.matchStatusUpcoming;
}

function buildDefaultSettings(teamId: number, season: number): SeniorTeamSpiritSettings {
  return {
    schemaVersion: 1,
    teamId,
    season,
    currentTeamSpiritOverride: null,
    coachLeadershipOverride: null,
    sportsPsychologistEnabledOverride: null,
    sportsPsychologistLevelOverride: null,
    upcomingAttitudes: {},
    updatedAt: Date.now(),
  };
}

function calculateRows(input: {
  matches: TeamSpiritMatch[];
  initialTeamSpirit: number | null;
  attitudes: (match: TeamSpiritMatch) => TeamSpiritAttitude | null;
  coachLeadership: CoachLeadership;
  sportsPsychologistLevel: number;
}): { rows: TimelineRow[]; finalTeamSpirit: number | null } {
  let current = input.initialTeamSpirit;
  let uncertain = current === null;
  const rows = input.matches.map((match, index) => {
    const attitude = input.attitudes(match);
    const before = current;
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
    const rowUncertain = uncertain || !attitude;
    if (!attitude) {
      current = null;
      uncertain = true;
    } else {
      current = afterRecovery ?? after;
    }
    return {
      match,
      attitude,
      before,
      midfieldPercent,
      after,
      recoveryDays,
      afterRecovery,
      uncertain: rowUncertain,
    };
  });
  return { rows, finalTeamSpirit: current };
}

export default function SeniorTeamSpirit({
  matchesResponse,
  messages,
  teamId,
  currentSeason,
  defaultCoachLeadership,
  onRefresh,
}: SeniorTeamSpiritProps) {
  const [archiveMatches, setArchiveMatches] = useState<TeamSpiritMatch[]>([]);
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "loading" | "error">("idle");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [clubStatus, setClubStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [clubWarning, setClubWarning] = useState<string | null>(null);
  const [fetchedPsychologistLevel, setFetchedPsychologistLevel] = useState<number | null>(null);
  const [settings, setSettings] = useState<SeniorTeamSpiritSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [matchDetails, setMatchDetails] = useState<Record<string, MatchDetailState>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestedMatchDetailKeysRef = useRef<Set<string>>(new Set());
  const matchDetailsRef = useRef<Record<string, MatchDetailState>>({});

  useEffect(() => {
    matchDetailsRef.current = matchDetails;
  }, [matchDetails]);

  const upcomingSourceMatches = useMemo(
    () =>
      normalizeMatchesFromPayload(matchesResponse)
        .filter(isTeamSpiritMatch)
        .map(normalizeTimelineMatch)
        .filter((match): match is TeamSpiritMatch => Boolean(match)),
    [matchesResponse]
  );

  const timelineMatches = useMemo(() => {
    const map = new Map<string, TeamSpiritMatch>();
    for (const match of archiveMatches) map.set(matchKey(match), match);
    for (const match of upcomingSourceMatches) {
      const key = matchKey(match);
      if (!isCompletedMatch(match) || !map.has(key)) map.set(key, match);
    }
    return [...map.values()].sort((a, b) => a.sortTime - b.sortTime);
  }, [archiveMatches, upcomingSourceMatches]);

  const completedMatches = useMemo(
    () => timelineMatches.filter(isCompletedMatch),
    [timelineMatches]
  );
  const upcomingMatches = useMemo(
    () => timelineMatches.filter((match) => !isCompletedMatch(match)),
    [timelineMatches]
  );
  const completedMatchKeysSignature = useMemo(
    () => completedMatches.map(matchKey).join("|"),
    [completedMatches]
  );

  useEffect(() => {
    let cancelled = false;
    requestedMatchDetailKeysRef.current.clear();
    matchDetailsRef.current = {};
    setMatchDetails({});
    setArchiveMatches([]);
    setFetchedPsychologistLevel(null);
    setClubWarning(null);
    setSettings(null);
    setSettingsLoaded(false);
    if (!teamId || !currentSeason) return;
    void (async () => {
      await migrateSeniorTeamSpiritLocalStorageSettings();
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
          .filter(isTeamSpiritMatch)
          .map(normalizeTimelineMatch)
          .filter((match): match is TeamSpiritMatch => Boolean(match));
        setArchiveMatches(matches);
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
        setFetchedPsychologistLevel(Math.max(0, Math.min(10, Math.floor(level ?? 0))));
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
    if (!teamId || completedMatches.length === 0) return;
    let cancelled = false;
    const matchesToRequest = completedMatches.filter((match) => {
      const key = matchKey(match);
      const existing = matchDetailsRef.current[key];
      return (
        !requestedMatchDetailKeysRef.current.has(key) &&
        existing?.status !== "success" &&
        existing?.status !== "error"
      );
    });
    if (matchesToRequest.length === 0) return;
    for (const match of matchesToRequest) {
      requestedMatchDetailKeysRef.current.add(matchKey(match));
    }
    setMatchDetails((current) => {
      const next = { ...current };
      for (const match of matchesToRequest) {
        next[matchKey(match)] = { status: "loading", attitude: null };
      }
      return next;
    });

    const run = async () => {
      const queue = [...matchesToRequest];
      const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length > 0 && !cancelled) {
          const match = queue.shift();
          if (!match) return;
          const key = matchKey(match);
          try {
            const { response, payload } = await fetchChppJson<unknown>(
              `/api/chpp/matchdetails?matchId=${match.MatchID}&sourceSystem=${encodeURIComponent(
                match.SourceSystem
              )}&matchEvents=false`,
              { cache: "no-store" }
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
                    HomeTeam?: { TeamID?: unknown; TeamAttitude?: unknown };
                    AwayTeam?: { TeamID?: unknown; TeamAttitude?: unknown };
                  };
                };
              };
            })?.data?.HattrickData?.Match;
            const homeId = toNumber(detail?.HomeTeam?.TeamID);
            const awayId = toNumber(detail?.AwayTeam?.TeamID);
            if (homeId !== teamId && awayId !== teamId) {
              throw new Error(messages.teamSpiritSelectedTeamNotInMatch);
            }
            const rawAttitude =
              homeId === teamId
                ? detail?.HomeTeam?.TeamAttitude
                : detail?.AwayTeam?.TeamAttitude;
            const attitude = parseApiTeamAttitude(rawAttitude);
            if (cancelled) return;
            setMatchDetails((current) => ({
              ...current,
              [key]: { status: "success", attitude },
            }));
          } catch (error) {
            if (cancelled) return;
            setMatchDetails((current) => ({
              ...current,
              [key]: {
                status: "error",
                attitude: null,
                error:
                  error instanceof Error
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
      cancelled = true;
    };
  }, [
    teamId,
    completedMatchKeysSignature,
    refreshNonce,
    completedMatches,
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

  const effectiveCoachLeadership =
    settings?.coachLeadershipOverride ?? defaultCoachLeadership ?? "weak";
  const effectiveSportsPsychologistEnabled =
    settings?.sportsPsychologistEnabledOverride ?? ((fetchedPsychologistLevel ?? 0) > 0);
  const selectedSportsPsychologistLevel =
    settings?.sportsPsychologistLevelOverride ?? fetchedPsychologistLevel ?? 0;
  const effectiveSportsPsychologistLevel = effectiveSportsPsychologistEnabled
    ? selectedSportsPsychologistLevel
    : 0;

  const completedRowsResult = useMemo(() => {
    const completedWithBoundary =
      upcomingMatches[0] && completedMatches.length > 0
        ? [...completedMatches, upcomingMatches[0]]
        : completedMatches;
    const rows = calculateRows({
      matches: completedWithBoundary,
      initialTeamSpirit: SEASON_START_TEAM_SPIRIT,
      attitudes: (match) => matchDetails[matchKey(match)]?.attitude ?? null,
      coachLeadership: effectiveCoachLeadership,
      sportsPsychologistLevel: effectiveSportsPsychologistLevel,
    }).rows;
    const completedRows = rows.slice(0, completedMatches.length);
    const lastCompleted = completedRows[completedRows.length - 1] ?? null;
    return {
      rows: completedRows,
      calculatedCurrentTeamSpirit:
        completedMatches.length === 0
          ? SEASON_START_TEAM_SPIRIT
          : lastCompleted?.afterRecovery ?? lastCompleted?.after ?? null,
    };
  }, [
    completedMatches,
    effectiveCoachLeadership,
    effectiveSportsPsychologistLevel,
    matchDetails,
    upcomingMatches,
  ]);

  const projectedCurrentTeamSpirit =
    settings?.currentTeamSpiritOverride ??
    completedRowsResult.calculatedCurrentTeamSpirit;

  const upcomingRows = useMemo(() => {
    return calculateRows({
      matches: upcomingMatches,
      initialTeamSpirit: projectedCurrentTeamSpirit,
      attitudes: (match) => settings?.upcomingAttitudes[matchKey(match)] ?? "PIN",
      coachLeadership: effectiveCoachLeadership,
      sportsPsychologistLevel: effectiveSportsPsychologistLevel,
    }).rows;
  }, [
    effectiveCoachLeadership,
    effectiveSportsPsychologistLevel,
    projectedCurrentTeamSpirit,
    settings?.upcomingAttitudes,
    upcomingMatches,
  ]);

  const rows = useMemo(
    () => [...completedRowsResult.rows, ...upcomingRows],
    [completedRowsResult.rows, upcomingRows]
  );

  if (!currentSeason) {
    return (
      <div className={styles.card}>
        <p className={styles.errorText}>{messages.teamSpiritSeasonUnknown}</p>
      </div>
    );
  }

  const detailsLoading = completedMatches.some(
    (match) => matchDetails[matchKey(match)]?.status === "loading"
  );
  const currentOverrideValue =
    settings?.currentTeamSpiritOverride === null || settings?.currentTeamSpiritOverride === undefined
      ? "calculated"
      : String(settings.currentTeamSpiritOverride);
  const calculatedCurrentLabel =
    completedRowsResult.calculatedCurrentTeamSpirit !== null
      ? messages.teamSpiritCalculatedCurrent.replace(
          "{{value}}",
          formatTeamSpirit(completedRowsResult.calculatedCurrentTeamSpirit)
        )
      : messages.teamSpiritCalculatedUnavailable;

  return (
    <div className={`${styles.card} ${styles.teamSpiritCard}`}>
      <div className={styles.matchesHeader}>
        <h2 className={styles.sectionTitle}>{messages.seniorMatchesTeamSpiritTab}</h2>
        <button
          type="button"
          className={styles.sortToggle}
          onClick={() => {
            requestedMatchDetailKeysRef.current.clear();
            matchDetailsRef.current = {};
            setMatchDetails({});
            setArchiveMatches([]);
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
            <span>{messages.teamSpiritCurrentTeamSpirit}</span>
            <select
              className={styles.sortSelect}
              value={currentOverrideValue}
              disabled={!settingsLoaded}
              onChange={(event) =>
                persistSettings((current) => ({
                  ...current,
                  currentTeamSpiritOverride:
                    event.target.value === "calculated" ? null : Number(event.target.value),
                }))
              }
            >
              <option value="calculated">{calculatedCurrentLabel}</option>
              {TEAM_SPIRIT_LABELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {teamSpiritLevelLabel(messages, option.value)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.teamSpiritControlRow}>
          <label className={styles.teamSpiritControl}>
            <span>{messages.teamSpiritCoachLeadership}</span>
            <select
              className={styles.sortSelect}
              value={effectiveCoachLeadership}
              disabled={!settingsLoaded}
              onChange={(event) =>
                persistSettings((current) => ({
                  ...current,
                  coachLeadershipOverride: event.target.value as CoachLeadership,
                }))
              }
            >
              {COACH_LEADERSHIP_VALUES.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.key}
                </option>
              ))}
            </select>
          </label>
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
              {messages.teamSpiritSportsPsychologist}
            </span>
          </label>
          <label className={styles.teamSpiritControl}>
            <span>{messages.teamSpiritSportsPsychologistLevel}</span>
            <select
              className={styles.sortSelect}
              value={selectedSportsPsychologistLevel}
              disabled={!settingsLoaded}
              onChange={(event) =>
                persistSettings((current) => ({
                  ...current,
                  sportsPsychologistLevelOverride: Number(event.target.value),
                }))
              }
            >
              {Array.from({ length: 11 }, (_, level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {!defaultCoachLeadership && !settings?.coachLeadershipOverride ? (
        <p className={styles.teamSpiritWarning}>{messages.teamSpiritCoachLeadershipDefaultWarning}</p>
      ) : null}
      {clubStatus === "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritLoadingClub}</p>
      ) : null}
      {clubWarning ? <p className={styles.teamSpiritWarning}>{clubWarning}</p> : null}
      {typeof fetchedPsychologistLevel === "number" ? (
        <p className={styles.muted}>
          {messages.teamSpiritFetchedPsychologistLevel.replace(
            "{{level}}",
            String(fetchedPsychologistLevel)
          )}
        </p>
      ) : null}
      {archiveStatus === "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritLoadingArchive}</p>
      ) : null}
      {archiveStatus === "error" ? (
        <p className={styles.errorText}>{archiveError ?? messages.teamSpiritLoadArchiveFailed}</p>
      ) : null}
      {detailsLoading ? <p className={styles.muted}>{messages.teamSpiritLoadingDetails}</p> : null}
      {timelineMatches.length === 0 && archiveStatus !== "loading" ? (
        <p className={styles.muted}>{messages.teamSpiritNoMatches}</p>
      ) : (
        <ul className={styles.matchList}>
          {rows.map((row) => {
            const key = matchKey(row.match);
            const completed = isCompletedMatch(row.match);
            const detail = matchDetails[key];
            const matchTitle = `${row.match.HomeTeam?.HomeTeamName ?? messages.homeLabel} vs ${
              row.match.AwayTeam?.AwayTeamName ?? messages.awayLabel
            }`;
            return (
              <li key={key} className={styles.matchItem}>
                <a
                  className={styles.teamSpiritMatchTitleLink}
                  href={hattrickMatchUrlWithSourceSystem(row.match.MatchID, row.match.SourceSystem)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {matchTitle}
                </a>
                <div className={styles.matchMeta}>
                  <span>{matchTypeLabel(messages, row.match)}</span>
                  <span>{formatChppDateTime(row.match.MatchDate) ?? row.match.MatchDate}</span>
                  <span>{matchStatusLabel(messages, row.match)}</span>
                </div>
                <div className={styles.teamSpiritStats}>
                  <div className={styles.teamSpiritStatRow}>
                    <span>{messages.teamSpiritAttitude}</span>
                    {completed ? (
                      <strong>
                        {detail?.status === "loading"
                          ? messages.teamSpiritLoadingDetails
                          : row.attitude
                          ? attitudeLabel(messages, row.attitude)
                          : messages.teamSpiritMissingTeamAttitude}
                      </strong>
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
                  <div className={styles.teamSpiritStatRow}>
                    <span>{messages.teamSpiritBefore}</span>
                    <strong>{row.before !== null ? formatTeamSpirit(row.before) : messages.teamSpiritCalculationUnavailable}</strong>
                  </div>
                  <div className={styles.teamSpiritStatRow}>
                    <span>{messages.teamSpiritMidfield}</span>
                    <strong>{row.midfieldPercent !== null ? `${row.midfieldPercent}%` : messages.teamSpiritCalculationUnavailable}</strong>
                  </div>
                  <div className={styles.teamSpiritStatRow}>
                    <span>{messages.teamSpiritAfterMatch}</span>
                    <strong>{row.after !== null ? formatTeamSpirit(row.after) : messages.teamSpiritCalculationUnavailable}</strong>
                  </div>
                  {row.recoveryDays !== null ? (
                    <>
                      <div className={styles.teamSpiritStatRow}>
                        <span>{messages.teamSpiritRecoveryBeforeNext}</span>
                        <strong>
                          {messages.teamSpiritDailyUpdates.replace(
                            "{{count}}",
                            String(row.recoveryDays)
                          )}
                        </strong>
                      </div>
                      <div className={styles.teamSpiritStatRow}>
                        <span>{messages.teamSpiritAfterRecovery}</span>
                        <strong>
                          {row.afterRecovery !== null
                            ? formatTeamSpirit(row.afterRecovery)
                            : messages.teamSpiritCalculationUnavailable}
                        </strong>
                      </div>
                    </>
                  ) : null}
                </div>
                {detail?.status === "error" ? (
                  <p className={styles.teamSpiritWarning}>
                    {messages.teamSpiritLoadMatchDetailsFailed}: {detail.error}
                  </p>
                ) : null}
                {completed && detail?.status === "success" && !detail.attitude ? (
                  <p className={styles.teamSpiritWarning}>
                    {messages.teamSpiritMissingTeamAttitude}
                  </p>
                ) : null}
                {row.uncertain ? (
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
