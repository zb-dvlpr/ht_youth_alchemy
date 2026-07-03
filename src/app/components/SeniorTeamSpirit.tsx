"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { fetchChppJson } from "@/lib/chpp/client";
import { formatChppDateTime } from "@/lib/datetime";
import { parseChppDate } from "@/lib/chpp/utils";
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
  status: "idle" | "loading" | "success" | "error";
  attitude: TeamSpiritAttitude | null;
  error?: string | null;
};

type SettingsState = {
  startingTeamSpirit: number;
  coachLeadership: CoachLeadership;
  sportsPsychologistEnabled: boolean;
  sportsPsychologistLevel: number;
  attitudes: Record<string, TeamSpiritAttitude>;
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

const DEFAULT_SETTINGS: SettingsState = {
  startingTeamSpirit: 4.5,
  coachLeadership: "weak",
  sportsPsychologistEnabled: false,
  sportsPsychologistLevel: 0,
  attitudes: {},
};

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

function settingsKey(teamId: number, season: number) {
  return `ya_senior_team_spirit_settings_v1_${teamId}_${season}`;
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
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [matchDetails, setMatchDetails] = useState<Record<string, MatchDetailState>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const initializedSettingsKeyRef = useRef<string | null>(null);

  const upcomingMatches = useMemo(
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
    for (const match of upcomingMatches) {
      const key = matchKey(match);
      if (!isCompletedMatch(match) || !map.has(key)) {
        map.set(key, match);
      }
    }
    return [...map.values()].sort((a, b) => a.sortTime - b.sortTime);
  }, [archiveMatches, upcomingMatches]);

  const completedMatches = useMemo(
    () => timelineMatches.filter(isCompletedMatch),
    [timelineMatches]
  );

  useEffect(() => {
    if (!teamId || !currentSeason) return;
    const key = settingsKey(teamId, currentSeason);
    initializedSettingsKeyRef.current = key;
    setSettings((current) => {
      let stored: Partial<SettingsState> | null = null;
      try {
        stored = JSON.parse(window.localStorage.getItem(key) ?? "null");
      } catch {
        stored = null;
      }
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        coachLeadership: stored?.coachLeadership ?? defaultCoachLeadership ?? "weak",
        sportsPsychologistLevel:
          typeof stored?.sportsPsychologistLevel === "number"
            ? stored.sportsPsychologistLevel
            : current.sportsPsychologistLevel,
        sportsPsychologistEnabled:
          typeof stored?.sportsPsychologistEnabled === "boolean"
            ? stored.sportsPsychologistEnabled
            : current.sportsPsychologistEnabled,
        attitudes: stored?.attitudes ?? {},
      };
    });
  }, [teamId, currentSeason, defaultCoachLeadership]);

  useEffect(() => {
    if (!teamId || !currentSeason) return;
    const key = settingsKey(teamId, currentSeason);
    if (initializedSettingsKeyRef.current !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      // ignore storage failures
    }
  }, [teamId, currentSeason, settings]);

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
        const normalizedLevel = Math.max(0, Math.min(10, Math.floor(level ?? 0)));
        setFetchedPsychologistLevel(normalizedLevel);
        setSettings((current) => ({
          ...current,
          sportsPsychologistEnabled: normalizedLevel > 0,
          sportsPsychologistLevel: normalizedLevel,
        }));
        setClubStatus("success");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setFetchedPsychologistLevel(null);
        setClubStatus("error");
        setClubWarning(
          error instanceof Error ? error.message : messages.teamSpiritLoadClubFailed
        );
        setSettings((current) => ({
          ...current,
          sportsPsychologistEnabled: false,
          sportsPsychologistLevel: 0,
        }));
      });
    return () => controller.abort();
  }, [teamId, currentSeason, refreshNonce, messages.teamSpiritLoadClubFailed]);

  useEffect(() => {
    if (!teamId || completedMatches.length === 0) return;
    let cancelled = false;
    const missing = completedMatches.filter((match) => {
      const key = matchKey(match);
      return !matchDetails[key] || matchDetails[key].status === "idle";
    });
    if (missing.length === 0) return;
    setMatchDetails((current) => {
      const next = { ...current };
      for (const match of missing) {
        next[matchKey(match)] = { status: "loading", attitude: null };
      }
      return next;
    });

    const run = async () => {
      const queue = [...missing];
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
            const rawAttitude =
              homeId === teamId
                ? detail?.HomeTeam?.TeamAttitude
                : awayId === teamId
                ? detail?.AwayTeam?.TeamAttitude
                : null;
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
  }, [teamId, completedMatches, matchDetails, messages.teamSpiritLoadMatchDetailsFailed]);

  const updateSettings = useCallback((updater: (current: SettingsState) => SettingsState) => {
    setSettings((current) => updater(current));
  }, []);

  const rows = useMemo<TimelineRow[]>(() => {
    const effectivePsychologistLevel = settings.sportsPsychologistEnabled
      ? settings.sportsPsychologistLevel
      : 0;
    let current: number | null = settings.startingTeamSpirit;
    let uncertain = false;
    return timelineMatches.map((match, index) => {
      const key = matchKey(match);
      const completed = isCompletedMatch(match);
      const attitude = completed
        ? matchDetails[key]?.attitude ?? null
        : settings.attitudes[key] ?? "PIN";
      const before = current;
      const midfieldPercent =
        before !== null && attitude ? calculateMidfieldPercent(before, attitude) : null;
      const after =
        before !== null && attitude ? applyTeamSpiritAttitude(before, attitude) : null;
      const nextMatch = timelineMatches[index + 1] ?? null;
      const recoveryDays = nextMatch ? fullElapsedDays(match.sortTime, nextMatch.sortTime) : null;
      const afterRecovery =
        after !== null && recoveryDays !== null
          ? driftTeamSpiritDays(
              after,
              recoveryDays,
              settings.coachLeadership,
              effectivePsychologistLevel
            )
          : null;
      const rowUncertain = uncertain || (completed && !attitude);
      if (completed && !attitude) {
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
  }, [matchDetails, settings, timelineMatches]);

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

  return (
    <div className={`${styles.card} ${styles.teamSpiritCard}`}>
      <div className={styles.matchesHeader}>
        <h2 className={styles.sectionTitle}>{messages.seniorMatchesTeamSpiritTab}</h2>
        <button
          type="button"
          className={styles.sortToggle}
          onClick={() => {
            setMatchDetails({});
            setRefreshNonce((current) => current + 1);
            void onRefresh?.();
          }}
          aria-label={messages.teamSpiritRefresh}
        >
          ↻
        </button>
      </div>
      <div className={styles.teamSpiritControls}>
        <label className={styles.teamSpiritControl}>
          <span>{messages.teamSpiritStartingTeamSpirit}</span>
          <select
            className={styles.sortSelect}
            value={settings.startingTeamSpirit}
            onChange={(event) =>
              updateSettings((current) => ({
                ...current,
                startingTeamSpirit: Number(event.target.value),
              }))
            }
          >
            {TEAM_SPIRIT_LABELS.map((option) => (
              <option key={option.value} value={option.value}>
                {teamSpiritLevelLabel(messages, option.value)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.teamSpiritControl}>
          <span>{messages.teamSpiritCoachLeadership}</span>
          <select
            className={styles.sortSelect}
            value={settings.coachLeadership}
            onChange={(event) =>
              updateSettings((current) => ({
                ...current,
                coachLeadership: event.target.value as CoachLeadership,
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
        <label className={styles.matchesFilterToggle}>
          <input
            type="checkbox"
            className={styles.matchesFilterToggleInput}
            checked={settings.sportsPsychologistEnabled}
            onChange={(event) =>
              updateSettings((current) => ({
                ...current,
                sportsPsychologistEnabled: event.target.checked,
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
            value={settings.sportsPsychologistLevel}
            onChange={(event) =>
              updateSettings((current) => ({
                ...current,
                sportsPsychologistLevel: Number(event.target.value),
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
      <p className={styles.teamSpiritNote}>{messages.teamSpiritFormulaNote}</p>
      {!defaultCoachLeadership ? (
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
            return (
              <li key={key} className={styles.matchItem}>
                <div className={styles.matchTeams}>
                  <span>{row.match.HomeTeam?.HomeTeamName ?? messages.homeLabel}</span>
                  <span className={styles.vs}>vs</span>
                  <span>{row.match.AwayTeam?.AwayTeamName ?? messages.awayLabel}</span>
                </div>
                <div className={styles.matchMeta}>
                  <span>{matchTypeLabel(messages, row.match)}</span>
                  <span>{formatChppDateTime(row.match.MatchDate) ?? row.match.MatchDate}</span>
                  <span>{row.match.Status ?? messages.unknownLabel}</span>
                </div>
                <div className={styles.teamSpiritStats}>
                  <div className={styles.teamSpiritStatRow}>
                    <span>{messages.teamSpiritAttitude}</span>
                    {completed ? (
                      <strong>
                        {row.attitude ? attitudeLabel(messages, row.attitude) : messages.teamSpiritMissingTeamAttitude}
                      </strong>
                    ) : (
                      <select
                        className={styles.sortSelect}
                        value={row.attitude ?? "PIN"}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            attitudes: {
                              ...current.attitudes,
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
