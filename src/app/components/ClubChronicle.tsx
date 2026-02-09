"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import Modal from "./Modal";

type SupportedTeam = {
  teamId: number;
  teamName: string;
  leagueName?: string | null;
  leagueLevelUnitName?: string | null;
};

type WatchlistStorage = {
  supportedSelections: Record<number, boolean>;
  manualTeams: ManualTeam[] | number[];
};

type ClubChronicleProps = {
  messages: Messages;
};

type ManualTeam = {
  teamId: number;
  teamName?: string;
  leagueName?: string | null;
  leagueLevelUnitName?: string | null;
};

const STORAGE_KEY = "ya_club_chronicle_watchlist_v1";

const normalizeSupportedTeams = (
  input:
    | {
        TeamId?: number | string;
        TeamName?: string;
        LeagueName?: string;
        LeagueLevelUnitName?: string;
      }[]
    | {
        TeamId?: number | string;
        TeamName?: string;
        LeagueName?: string;
        LeagueLevelUnitName?: string;
      }
    | undefined
): SupportedTeam[] => {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list
    .map((team) => ({
      teamId: Number(team.TeamId ?? 0),
      teamName: team.TeamName ?? "",
      leagueName: team.LeagueName ?? null,
      leagueLevelUnitName: team.LeagueLevelUnitName ?? null,
    }))
    .filter((team) => Number.isFinite(team.teamId) && team.teamId > 0);
};

const resolveTeamDetailsMeta = (
  team:
    | {
        LeagueName?: string;
        LeagueLevelUnitName?: string;
        League?: {
          LeagueName?: string;
          Name?: string;
        };
        LeagueLevelUnit?: {
          LeagueLevelUnitName?: string;
          Name?: string;
        };
      }
    | undefined
) => {
  if (!team) {
    return { leagueName: null, leagueLevelUnitName: null };
  }
  const leagueName =
    team.LeagueName ??
    team.League?.LeagueName ??
    team.League?.Name ??
    null;
  const leagueLevelUnitName =
    team.LeagueLevelUnitName ??
    team.LeagueLevelUnit?.LeagueLevelUnitName ??
    team.LeagueLevelUnit?.Name ??
    null;
  return { leagueName, leagueLevelUnitName };
};

const readStorage = (): WatchlistStorage => {
  if (typeof window === "undefined") {
    return { supportedSelections: {}, manualTeams: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { supportedSelections: {}, manualTeams: [] };
    const parsed = JSON.parse(raw) as WatchlistStorage;
    return {
      supportedSelections: parsed.supportedSelections ?? {},
      manualTeams: parsed.manualTeams ?? [],
    };
  } catch {
    return { supportedSelections: {}, manualTeams: [] };
  }
};

const writeStorage = (payload: WatchlistStorage) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

export default function ClubChronicle({ messages }: ClubChronicleProps) {
  const [supportedTeams, setSupportedTeams] = useState<SupportedTeam[]>([]);
  const [supportedSelections, setSupportedSelections] = useState<
    Record<number, boolean>
  >({});
  const [manualTeams, setManualTeams] = useState<ManualTeam[]>([]);
  const [teamIdInput, setTeamIdInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const initializedRef = useRef(false);

  const supportedById = useMemo(
    () =>
      new Set<number>(supportedTeams.map((team) => Number(team.teamId ?? 0))),
    [supportedTeams]
  );

  const manualById = useMemo(
    () => new Set<number>(manualTeams.map((team) => Number(team.teamId))),
    [manualTeams]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/chpp/supporters", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              data?: {
                HattrickData?: {
                  SupportedTeams?: {
                    SupportedTeam?:
                      | {
                          TeamId?: number | string;
                          TeamName?: string;
                          LeagueName?: string;
                          LeagueLevelUnitName?: string;
                        }[]
                      | {
                          TeamId?: number | string;
                          TeamName?: string;
                          LeagueName?: string;
                          LeagueLevelUnitName?: string;
                        };
                  };
                };
              };
              error?: string;
              details?: string;
            }
          | null;
        if (!response.ok || payload?.error) {
          throw new Error(payload?.details || payload?.error || "Fetch failed");
        }
        const raw =
          payload?.data?.HattrickData?.SupportedTeams?.SupportedTeam;
        const nextSupportedTeams = normalizeSupportedTeams(raw);
        const stored = readStorage();
        const nextSelections: Record<number, boolean> = {};
        nextSupportedTeams.forEach((team) => {
          const key = team.teamId;
          if (stored.supportedSelections[key] === undefined) {
            nextSelections[key] = true;
          } else {
            nextSelections[key] = stored.supportedSelections[key];
          }
        });
        if (active) {
        const normalizedManualTeams = (stored.manualTeams ?? []).map(
          (item) => {
            if (typeof item === "number") {
              return { teamId: item };
            }
            return {
              teamId: Number(item.teamId),
              teamName: item.teamName ?? "",
              leagueName: item.leagueName ?? null,
              leagueLevelUnitName: item.leagueLevelUnitName ?? null,
            };
          }
        );
          setSupportedTeams(nextSupportedTeams);
          setSupportedSelections(nextSelections);
          setManualTeams(normalizedManualTeams);
          initializedRef.current = true;
          writeStorage({
            supportedSelections: nextSelections,
            manualTeams: normalizedManualTeams,
          });
        }
      } catch {
        if (active) {
          setError(messages.watchlistError);
          if (watchlistOpen) {
            setErrorOpen(true);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [messages.watchlistError, watchlistOpen]);

  useEffect(() => {
    if (!initializedRef.current) return;
    writeStorage({ supportedSelections, manualTeams });
  }, [supportedSelections, manualTeams]);

  const handleAddTeam = async () => {
    const trimmed = teamIdInput.trim();
    const parsed = Number(trimmed);
    if (!trimmed || Number.isNaN(parsed) || parsed <= 0) {
      setError(messages.watchlistAddInvalid);
      setErrorOpen(true);
      return;
    }
    if (supportedById.has(parsed) || manualById.has(parsed)) {
      setError(messages.watchlistAddDuplicate);
      setErrorOpen(true);
      return;
    }
    setIsValidating(true);
    try {
      const response = await fetch(`/api/chpp/teamdetails?teamId=${parsed}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              HattrickData?: {
                Team?: {
                  TeamID?: number | string;
                  TeamName?: string;
                  LeagueName?: string;
                  LeagueLevelUnitName?: string;
                  League?: {
                    LeagueName?: string;
                    Name?: string;
                  };
                  LeagueLevelUnit?: {
                    LeagueLevelUnitName?: string;
                    Name?: string;
                  };
                };
              };
            };
            error?: string;
            details?: string;
          }
        | null;
      const team = payload?.data?.HattrickData?.Team;
      const teamId = team?.TeamID;
      if (!response.ok || payload?.error || !teamId) {
        setError(messages.watchlistAddNotFound);
        setErrorOpen(true);
        return;
      }
      const meta = resolveTeamDetailsMeta(team);
      setManualTeams((prev) => [
        ...prev,
        {
          teamId: parsed,
          teamName: team?.TeamName ?? "",
          leagueName: meta.leagueName,
          leagueLevelUnitName: meta.leagueLevelUnitName,
        },
      ]);
      setTeamIdInput("");
      setError(null);
    } catch {
      setError(messages.watchlistError);
      setErrorOpen(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleToggleSupported = (teamId: number) => {
    setSupportedSelections((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  const handleRemoveManual = (teamId: number) => {
    setManualTeams((prev) => prev.filter((team) => team.teamId !== teamId));
  };

  return (
    <div className={styles.clubChronicleStack}>
      <div className={styles.watchlistFabWrap}>
        <Tooltip content={messages.watchlistTitle}>
          <button
            type="button"
            className={styles.watchlistFab}
            onClick={() => setWatchlistOpen(true)}
            aria-label={messages.watchlistTitle}
          >
            ☰
          </button>
        </Tooltip>
      </div>

      <Modal
        open={watchlistOpen}
        title={messages.watchlistTitle}
        className={styles.watchlistModal}
        body={
          <div className={styles.watchlistPanel}>
            {loading ? (
              <p className={styles.muted}>{messages.watchlistLoading}</p>
            ) : null}
            <div className={styles.watchlistSection}>
              <h3 className={styles.watchlistHeading}>
                {messages.watchlistSupportedTitle}
              </h3>
              {supportedTeams.length ? (
                <ul className={styles.watchlistList}>
                  {supportedTeams.map((team) => (
                    <li key={team.teamId} className={styles.watchlistRow}>
                      <label className={styles.watchlistTeam}>
                        <input
                          type="checkbox"
                          checked={supportedSelections[team.teamId] ?? false}
                          onChange={() => handleToggleSupported(team.teamId)}
                        />
                        <span className={styles.watchlistName}>
                          {team.teamName ||
                            `${messages.watchlistTeamLabel} ${team.teamId}`}
                        </span>
                      </label>
                      {(team.leagueName || team.leagueLevelUnitName) ? (
                        <span className={styles.watchlistMeta}>
                          {[team.leagueName, team.leagueLevelUnitName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>
                  {messages.watchlistSupportedEmpty}
                </p>
              )}
            </div>

            <div className={styles.watchlistSection}>
              <h3 className={styles.watchlistHeading}>
                {messages.watchlistManualTitle}
              </h3>
              {manualTeams.length ? (
                <ul className={styles.watchlistList}>
                  {manualTeams.map((team) => (
                    <li key={team.teamId} className={styles.watchlistRow}>
                      <div className={styles.watchlistTeam}>
                        <Tooltip content={messages.watchlistRemoveTooltip}>
                          <button
                            type="button"
                            className={styles.watchlistRemove}
                            onClick={() => handleRemoveManual(team.teamId)}
                            aria-label={messages.watchlistRemoveTooltip}
                          >
                            🗑️
                          </button>
                        </Tooltip>
                        <span className={styles.watchlistName}>
                          {team.teamName ||
                            `${messages.watchlistTeamLabel} ${team.teamId}`}
                        </span>
                      </div>
                      {(team.leagueName || team.leagueLevelUnitName) ? (
                        <span className={styles.watchlistMeta}>
                          {[team.leagueName, team.leagueLevelUnitName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>{messages.watchlistManualEmpty}</p>
              )}
            </div>

            <div className={styles.watchlistSection}>
              <h3 className={styles.watchlistHeading}>
                {messages.watchlistAddTitle}
              </h3>
              <div className={styles.watchlistInputRow}>
                <input
                  type="text"
                  className={styles.watchlistInput}
                  value={teamIdInput}
                  onChange={(event) => setTeamIdInput(event.target.value)}
                  placeholder={messages.watchlistAddPlaceholder}
                />
                <button
                  type="button"
                  className={styles.watchlistButton}
                  onClick={handleAddTeam}
                  disabled={isValidating}
                >
                  {messages.watchlistAddButton}
                </button>
              </div>
            </div>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setWatchlistOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setWatchlistOpen(false)}
      />

      <Modal
        open={errorOpen && Boolean(error)}
        title={messages.watchlistTitle}
        body={<p className={styles.muted}>{error}</p>}
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => {
              setErrorOpen(false);
              setError(null);
            }}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => {
          setErrorOpen(false);
          setError(null);
        }}
      />
    </div>
  );
}
