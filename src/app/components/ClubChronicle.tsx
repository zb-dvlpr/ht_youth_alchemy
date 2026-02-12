"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import Tooltip from "./Tooltip";
import Modal from "./Modal";
import { useNotifications } from "./notifications/NotificationsProvider";
import {
  CLUB_CHRONICLE_SETTINGS_EVENT,
  CLUB_CHRONICLE_SETTINGS_STORAGE_KEY,
  DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS,
  readClubChronicleStalenessDays,
} from "@/lib/settings";

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
  leagueLevelUnitId?: number | null;
};

type LeaguePerformanceSnapshot = {
  leagueId: number | null;
  leagueName: string | null;
  leagueLevel: number | null;
  maxLevel: number | null;
  leagueLevelUnitId: number | null;
  leagueLevelUnitName: string | null;
  currentMatchRound: string | null;
  rank: number | null;
  userId: number | null;
  teamId: number | null;
  position: number | null;
  positionChange: string | null;
  teamName: string | null;
  matches: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  points: number | null;
  won: number | null;
  draws: number | null;
  lost: number | null;
  fetchedAt: number;
};

type LeaguePerformanceData = {
  current: LeaguePerformanceSnapshot;
  previous?: LeaguePerformanceSnapshot;
};

type LeagueTableRow = {
  teamId: number;
  teamName: string;
  snapshot?: LeaguePerformanceSnapshot | null;
  leaguePerformance?: LeaguePerformanceData;
  meta?: string | null;
};

type ChronicleTeamData = {
  teamId: number;
  teamName?: string;
  leagueName?: string | null;
  leagueLevelUnitName?: string | null;
  leagueLevelUnitId?: number | null;
  leaguePerformance?: LeaguePerformanceData;
};

type ChronicleCache = {
  version: number;
  teams: Record<number, ChronicleTeamData>;
  panelOrder?: string[];
  lastRefreshAt?: number | null;
};

type ChronicleUpdateField = {
  fieldKey: string;
  label: string;
  previous: string | null;
  current: string | null;
};

type ChronicleUpdates = {
  generatedAt: number;
  teams: Record<
    number,
    { teamId: number; teamName: string; changes: ChronicleUpdateField[] }
  >;
};

type ChronicleTableColumn<Row, Snapshot> = {
  key: string;
  label: string;
  getValue: (
    snapshot: Snapshot | undefined,
    row?: Row
  ) => string | number | null | undefined;
};

type ChronicleTableProps<Row, Snapshot> = {
  columns: ChronicleTableColumn<Row, Snapshot>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  getSnapshot: (row: Row) => Snapshot | undefined;
  onRowClick?: (row: Row) => void;
  formatValue: (value: string | number | null | undefined) => string;
  style?: CSSProperties;
};

const ChronicleTable = <Row, Snapshot>({
  columns,
  rows,
  getRowKey,
  getSnapshot,
  onRowClick,
  formatValue,
  style,
}: ChronicleTableProps<Row, Snapshot>) => (
  <div className={styles.chronicleTable} style={style}>
    <div className={styles.chronicleTableHeader}>
      {columns.map((column) => (
        <span key={`header-${column.key}`}>{column.label}</span>
      ))}
    </div>
    {rows.map((row) => {
      const snapshot = getSnapshot(row);
      const rowKey = getRowKey(row);
      return (
        <div
          key={rowKey}
          className={styles.chronicleTableRow}
          role={onRowClick ? "button" : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={
            onRowClick
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRowClick(row);
                  }
                }
              : undefined
          }
        >
          {columns.map((column) => (
            <span
              key={`${rowKey}-${column.key}`}
              className={styles.chronicleTableCell}
            >
              {formatValue(column.getValue(snapshot, row))}
            </span>
          ))}
        </div>
      );
    })}
  </div>
);

const STORAGE_KEY = "ya_club_chronicle_watchlist_v1";
const CACHE_KEY = "ya_cc_cache_v1";
const UPDATES_KEY = "ya_cc_updates_v1";
const PANEL_ORDER_KEY = "ya_cc_panel_order_v1";
const LAST_REFRESH_KEY = "ya_cc_last_refresh_ts_v1";
const PANEL_IDS = ["league-performance"] as const;
const SEASON_LENGTH_MS = 112 * 24 * 60 * 60 * 1000;
const MAX_CACHE_AGE_MS = SEASON_LENGTH_MS * 2;

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
        LeagueLevelUnitID?: number | string;
        League?: {
          LeagueName?: string;
          Name?: string;
        };
        LeagueLevelUnit?: {
          LeagueLevelUnitName?: string;
          Name?: string;
          LeagueLevelUnitID?: number | string;
        };
      }
    | undefined
) => {
  if (!team) {
    return { leagueName: null, leagueLevelUnitName: null, leagueLevelUnitId: null };
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
  const leagueLevelUnitIdRaw =
    team.LeagueLevelUnitID ?? team.LeagueLevelUnit?.LeagueLevelUnitID ?? null;
  const leagueLevelUnitId =
    leagueLevelUnitIdRaw !== null && leagueLevelUnitIdRaw !== undefined
      ? Number(leagueLevelUnitIdRaw)
      : null;
  return { leagueName, leagueLevelUnitName, leagueLevelUnitId };
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

const readChronicleCache = (): ChronicleCache => {
  if (typeof window === "undefined") {
    return { version: 1, teams: {} };
  }
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return { version: 1, teams: {} };
    const parsed = JSON.parse(raw) as ChronicleCache;
    return parsed && parsed.teams ? parsed : { version: 1, teams: {} };
  } catch {
    return { version: 1, teams: {} };
  }
};

const writeChronicleCache = (payload: ChronicleCache) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const readChronicleUpdates = (): ChronicleUpdates | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UPDATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChronicleUpdates;
    return parsed && parsed.teams ? parsed : null;
  } catch {
    return null;
  }
};

const writeChronicleUpdates = (payload: ChronicleUpdates | null) => {
  if (typeof window === "undefined") return;
  try {
    if (!payload) {
      window.localStorage.removeItem(UPDATES_KEY);
      return;
    }
    window.localStorage.setItem(UPDATES_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const readPanelOrder = (): string[] => {
  if (typeof window === "undefined") return [...PANEL_IDS];
  try {
    const raw = window.localStorage.getItem(PANEL_ORDER_KEY);
    if (!raw) return [...PANEL_IDS];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [...PANEL_IDS];
    return parsed.filter((id) => PANEL_IDS.includes(id as typeof PANEL_IDS[number]));
  } catch {
    return [...PANEL_IDS];
  }
};

const writePanelOrder = (order: string[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(order));
  } catch {
    // ignore storage errors
  }
};

const readLastRefresh = (): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_REFRESH_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const writeLastRefresh = (value: number) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_REFRESH_KEY, String(value));
  } catch {
    // ignore storage errors
  }
};

const pruneChronicleCache = (cache: ChronicleCache): ChronicleCache => {
  const now = Date.now();
  const nextTeams: Record<number, ChronicleTeamData> = {};
  Object.entries(cache.teams).forEach(([id, team]) => {
    const leaguePerformance = team.leaguePerformance;
    if (leaguePerformance?.current) {
      const age = now - leaguePerformance.current.fetchedAt;
      if (age > MAX_CACHE_AGE_MS) {
        return;
      }
    }
    let nextLeaguePerformance = leaguePerformance;
    if (leaguePerformance?.previous) {
      const age = now - leaguePerformance.previous.fetchedAt;
      if (age > MAX_CACHE_AGE_MS) {
        nextLeaguePerformance = {
          ...leaguePerformance,
          previous: undefined,
        };
      }
    }
    nextTeams[Number(id)] = {
      ...team,
      leaguePerformance: nextLeaguePerformance,
    };
  });
  return { ...cache, teams: nextTeams };
};

const getLatestCacheTimestamp = (cache: ChronicleCache): number | null => {
  let latest = 0;
  Object.values(cache.teams).forEach((team) => {
    const current = team.leaguePerformance?.current?.fetchedAt ?? 0;
    const previous = team.leaguePerformance?.previous?.fetchedAt ?? 0;
    latest = Math.max(latest, current, previous);
  });
  return latest > 0 ? latest : null;
};

export default function ClubChronicle({ messages }: ClubChronicleProps) {
  const [supportedTeams, setSupportedTeams] = useState<SupportedTeam[]>([]);
  const [supportedSelections, setSupportedSelections] = useState<
    Record<number, boolean>
  >({});
  const [manualTeams, setManualTeams] = useState<ManualTeam[]>([]);
  const [primaryTeam, setPrimaryTeam] = useState<ChronicleTeamData | null>(null);
  const [chronicleCache, setChronicleCache] = useState<ChronicleCache>(() =>
    pruneChronicleCache(readChronicleCache())
  );
  const [panelOrder, setPanelOrder] = useState<string[]>(() =>
    readPanelOrder()
  );
  const [updates, setUpdates] = useState<ChronicleUpdates | null>(() =>
    readChronicleUpdates()
  );
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [stalenessDays, setStalenessDays] = useState(
    DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS
  );
  const [refreshing, setRefreshing] = useState(false);
  const [teamIdInput, setTeamIdInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const initializedRef = useRef(false);
  const initialFetchRef = useRef(false);
  const staleRefreshRef = useRef(false);
  const { addNotification } = useNotifications();

  const supportedById = useMemo(
    () =>
      new Set<number>(supportedTeams.map((team) => Number(team.teamId ?? 0))),
    [supportedTeams]
  );

  const manualById = useMemo(
    () => new Set<number>(manualTeams.map((team) => Number(team.teamId))),
    [manualTeams]
  );

  const trackedTeams = useMemo(() => {
    const map = new Map<number, ChronicleTeamData>();
    supportedTeams.forEach((team) => {
      if (!supportedSelections[team.teamId]) return;
      const cached = chronicleCache.teams[team.teamId];
      map.set(team.teamId, {
        teamId: team.teamId,
        teamName: team.teamName,
        leagueName: team.leagueName ?? cached?.leagueName ?? null,
        leagueLevelUnitName:
          team.leagueLevelUnitName ?? cached?.leagueLevelUnitName ?? null,
        leagueLevelUnitId: cached?.leagueLevelUnitId ?? null,
        leaguePerformance: cached?.leaguePerformance,
      });
    });
    manualTeams.forEach((team) => {
      const cached = chronicleCache.teams[team.teamId];
      map.set(team.teamId, {
        teamId: team.teamId,
        teamName: team.teamName ?? cached?.teamName ?? "",
        leagueName: team.leagueName ?? cached?.leagueName ?? null,
        leagueLevelUnitName:
          team.leagueLevelUnitName ?? cached?.leagueLevelUnitName ?? null,
        leagueLevelUnitId:
          team.leagueLevelUnitId ?? cached?.leagueLevelUnitId ?? null,
        leaguePerformance: cached?.leaguePerformance,
      });
    });
    if (primaryTeam) {
      const cached = chronicleCache.teams[primaryTeam.teamId];
      const existing = map.get(primaryTeam.teamId);
      map.set(primaryTeam.teamId, {
        teamId: primaryTeam.teamId,
        teamName:
          primaryTeam.teamName ??
          existing?.teamName ??
          cached?.teamName ??
          "",
        leagueName:
          primaryTeam.leagueName ??
          existing?.leagueName ??
          cached?.leagueName ??
          null,
        leagueLevelUnitName:
          primaryTeam.leagueLevelUnitName ??
          existing?.leagueLevelUnitName ??
          cached?.leagueLevelUnitName ??
          null,
        leagueLevelUnitId:
          primaryTeam.leagueLevelUnitId ??
          existing?.leagueLevelUnitId ??
          cached?.leagueLevelUnitId ??
          null,
        leaguePerformance: cached?.leaguePerformance ?? existing?.leaguePerformance,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.teamName ?? "").localeCompare(b.teamName ?? "")
    );
  }, [supportedTeams, supportedSelections, manualTeams, chronicleCache, primaryTeam]);

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
        const normalizedManualTeams = (stored.manualTeams ?? []).map((item) => {
          if (typeof item === "number") {
            return { teamId: item };
          }
          return {
            teamId: Number(item.teamId),
            teamName: item.teamName ?? "",
            leagueName: item.leagueName ?? null,
            leagueLevelUnitName: item.leagueLevelUnitName ?? null,
            leagueLevelUnitId:
              item.leagueLevelUnitId !== undefined &&
              item.leagueLevelUnitId !== null
                ? Number(item.leagueLevelUnitId)
                : null,
          };
        });
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
    let active = true;
    const loadPrimaryTeam = async () => {
      try {
        const response = await fetch("/api/chpp/teamdetails", {
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
                    LeagueLevelUnitID?: number | string;
                    LeagueLevelUnit?: {
                      LeagueLevelUnitID?: number | string;
                      LeagueLevelUnitName?: string;
                      Name?: string;
                    };
                    League?: {
                      LeagueName?: string;
                      Name?: string;
                    };
                  };
                };
              };
              error?: string;
            }
          | null;
        if (!response.ok || payload?.error) return;
        const teamDetails = payload?.data?.HattrickData?.Team;
        const teamId = Number(teamDetails?.TeamID ?? 0);
        if (!Number.isFinite(teamId) || teamId <= 0) return;
        const meta = resolveTeamDetailsMeta(teamDetails);
        const teamName = teamDetails?.TeamName ?? "";
        if (!active) return;
        setPrimaryTeam({
          teamId,
          teamName,
          leagueName: meta.leagueName,
          leagueLevelUnitName: meta.leagueLevelUnitName,
          leagueLevelUnitId: meta.leagueLevelUnitId,
        });
        setChronicleCache((prev) => ({
          ...prev,
          teams: {
            ...prev.teams,
            [teamId]: {
              ...prev.teams[teamId],
              teamId,
              teamName: teamName || prev.teams[teamId]?.teamName,
              leagueName: meta.leagueName ?? prev.teams[teamId]?.leagueName ?? null,
              leagueLevelUnitName:
                meta.leagueLevelUnitName ??
                prev.teams[teamId]?.leagueLevelUnitName ??
                null,
              leagueLevelUnitId:
                meta.leagueLevelUnitId ??
                prev.teams[teamId]?.leagueLevelUnitId ??
                null,
              leaguePerformance: prev.teams[teamId]?.leaguePerformance,
            },
          },
        }));
      } catch {
        // ignore teamdetails failure for now
      }
    };
    void loadPrimaryTeam();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;
    writeStorage({ supportedSelections, manualTeams });
  }, [supportedSelections, manualTeams]);

  useEffect(() => {
    if (!primaryTeam) return;
    setSupportedTeams((prev) => {
      if (prev.some((team) => team.teamId === primaryTeam.teamId)) return prev;
      return [
        ...prev,
        {
          teamId: primaryTeam.teamId,
          teamName: primaryTeam.teamName ?? "",
          leagueName: primaryTeam.leagueName ?? null,
          leagueLevelUnitName: primaryTeam.leagueLevelUnitName ?? null,
        },
      ];
    });
    setSupportedSelections((prev) => {
      if (prev[primaryTeam.teamId] !== undefined) return prev;
      return { ...prev, [primaryTeam.teamId]: true };
    });
  }, [primaryTeam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setStalenessDays(readClubChronicleStalenessDays());
    const handle = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (
          event.key &&
          event.key !== CLUB_CHRONICLE_SETTINGS_STORAGE_KEY
        ) {
          return;
        }
      }
      if (event instanceof CustomEvent) {
        const detail = event.detail as { stalenessDays?: number } | null;
        if (typeof detail?.stalenessDays === "number") {
          setStalenessDays(detail.stalenessDays);
          return;
        }
      }
      setStalenessDays(readClubChronicleStalenessDays());
    };
    window.addEventListener("storage", handle);
    window.addEventListener(CLUB_CHRONICLE_SETTINGS_EVENT, handle);
    return () => {
      window.removeEventListener("storage", handle);
      window.removeEventListener(CLUB_CHRONICLE_SETTINGS_EVENT, handle);
    };
  }, []);

  useEffect(() => {
    if (trackedTeams.length === 0) return;
    const hasSnapshot = Object.values(chronicleCache.teams).some(
      (team) => team.leaguePerformance?.current
    );
    if (hasSnapshot) return;
    if (refreshing || initialFetchRef.current) return;
    initialFetchRef.current = true;
    void refreshLeaguePerformance("manual");
  }, [trackedTeams.length, chronicleCache, refreshing]);

  useEffect(() => {
    if (trackedTeams.length === 0) return;
    let lastRefresh = readLastRefresh();
    if (!lastRefresh) {
      const fallback = getLatestCacheTimestamp(chronicleCache);
      if (!fallback) return;
      lastRefresh = fallback;
      writeLastRefresh(fallback);
    }
    const maxAgeMs = stalenessDays * 24 * 60 * 60 * 1000;
    const isStale = Date.now() - lastRefresh >= maxAgeMs;
    if (!isStale) {
      staleRefreshRef.current = false;
      return;
    }
    if (staleRefreshRef.current || refreshing) return;
    staleRefreshRef.current = true;
    void refreshLeaguePerformance("stale");
  }, [trackedTeams.length, stalenessDays, refreshing, chronicleCache]);

  useEffect(() => {
    writeChronicleCache(chronicleCache);
  }, [chronicleCache]);

  useEffect(() => {
    writeChronicleUpdates(updates);
  }, [updates]);

  useEffect(() => {
    const normalized = [
      ...panelOrder.filter((id) => PANEL_IDS.includes(id as typeof PANEL_IDS[number])),
      ...PANEL_IDS.filter((id) => !panelOrder.includes(id)),
    ];
    if (normalized.length !== panelOrder.length) {
      setPanelOrder(normalized);
      return;
    }
    writePanelOrder(panelOrder);
  }, [panelOrder]);

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
          leagueLevelUnitId: meta.leagueLevelUnitId,
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

  const handleMovePanel = (panelId: string, direction: "up" | "down") => {
    setPanelOrder((prev) => {
      const index = prev.indexOf(panelId);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const handleOpenDetails = (teamId: number) => {
    setSelectedTeamId(teamId);
    setDetailsOpen(true);
  };

  const leagueFieldDefs = useMemo(
    () => [
      { key: "leagueId", label: messages.clubChronicleFieldLeagueId },
      { key: "leagueName", label: messages.clubChronicleFieldLeagueName },
      { key: "leagueLevel", label: messages.clubChronicleFieldLeagueLevel },
      { key: "maxLevel", label: messages.clubChronicleFieldMaxLevel },
      {
        key: "leagueLevelUnitId",
        label: messages.clubChronicleFieldLeagueLevelUnitId,
      },
      {
        key: "leagueLevelUnitName",
        label: messages.clubChronicleFieldLeagueLevelUnitName,
      },
      {
        key: "currentMatchRound",
        label: messages.clubChronicleFieldCurrentMatchRound,
      },
      { key: "rank", label: messages.clubChronicleFieldRank },
      { key: "userId", label: messages.clubChronicleFieldUserId },
      { key: "teamId", label: messages.clubChronicleFieldTeamId },
      { key: "position", label: messages.clubChronicleFieldPosition },
      {
        key: "positionChange",
        label: messages.clubChronicleFieldPositionChange,
      },
      { key: "teamName", label: messages.clubChronicleFieldTeamName },
      { key: "matches", label: messages.clubChronicleFieldMatches },
      { key: "goalsFor", label: messages.clubChronicleFieldGoalsFor },
      { key: "goalsAgainst", label: messages.clubChronicleFieldGoalsAgainst },
      { key: "points", label: messages.clubChronicleFieldPoints },
      { key: "won", label: messages.clubChronicleFieldWon },
      { key: "draws", label: messages.clubChronicleFieldDraws },
      { key: "lost", label: messages.clubChronicleFieldLost },
    ],
    [
      messages.clubChronicleFieldLeagueId,
      messages.clubChronicleFieldLeagueName,
      messages.clubChronicleFieldLeagueLevel,
      messages.clubChronicleFieldMaxLevel,
      messages.clubChronicleFieldLeagueLevelUnitId,
      messages.clubChronicleFieldLeagueLevelUnitName,
      messages.clubChronicleFieldCurrentMatchRound,
      messages.clubChronicleFieldRank,
      messages.clubChronicleFieldUserId,
      messages.clubChronicleFieldTeamId,
      messages.clubChronicleFieldPosition,
      messages.clubChronicleFieldPositionChange,
      messages.clubChronicleFieldTeamName,
      messages.clubChronicleFieldMatches,
      messages.clubChronicleFieldGoalsFor,
      messages.clubChronicleFieldGoalsAgainst,
      messages.clubChronicleFieldPoints,
      messages.clubChronicleFieldWon,
      messages.clubChronicleFieldDraws,
      messages.clubChronicleFieldLost,
    ]
  );

  const leagueTableColumns = useMemo<
    ChronicleTableColumn<LeagueTableRow, LeaguePerformanceSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (snapshot: LeaguePerformanceSnapshot | undefined, row) =>
          row?.teamName ?? snapshot?.teamName ?? null,
      },
      {
        key: "position",
        label: messages.clubChronicleColumnPosition,
        getValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot?.position ?? null,
      },
      {
        key: "points",
        label: messages.clubChronicleColumnPoints,
        getValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot?.points ?? null,
      },
      {
        key: "series",
        label: messages.clubChronicleColumnSeries,
        getValue: (
          snapshot: LeaguePerformanceSnapshot | undefined,
          row?: LeagueTableRow
        ) =>
          snapshot?.leagueLevelUnitName ?? row?.meta ?? null,
      },
      {
        key: "positionChange",
        label: messages.clubChronicleColumnPositionChange,
        getValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot?.positionChange ?? null,
      },
      {
        key: "goalsDelta",
        label: messages.clubChronicleColumnGoalsDelta,
        getValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot
            ? `${formatValue(snapshot.goalsFor)}-${formatValue(snapshot.goalsAgainst)}`
            : null,
      },
      {
        key: "record",
        label: messages.clubChronicleColumnRecord,
        getValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot
            ? `${formatValue(snapshot.won)}-${formatValue(snapshot.draws)}-${formatValue(snapshot.lost)}`
            : null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleColumnPosition,
      messages.clubChronicleColumnPoints,
      messages.clubChronicleColumnSeries,
      messages.clubChronicleColumnPositionChange,
      messages.clubChronicleColumnGoalsDelta,
      messages.clubChronicleColumnRecord,
    ]
  );

  const formatValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") {
      return messages.unknownShort;
    }
    return String(value);
  };

  const parseNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const buildChanges = (
    previous: LeaguePerformanceSnapshot | undefined,
    current: LeaguePerformanceSnapshot,
    columns: ChronicleTableColumn<LeagueTableRow, LeaguePerformanceSnapshot>[]
  ): ChronicleUpdateField[] => {
    if (!previous) {
      return [];
    }
    return columns
      .map((column) => {
        const prevValue = column.getValue(previous);
        const nextValue = column.getValue(current);
        if (prevValue === nextValue) return null;
        return {
          fieldKey: column.key,
          label: column.label,
          previous: formatValue(prevValue),
          current: formatValue(nextValue),
        };
      })
      .filter((item): item is ChronicleUpdateField => item !== null);
  };

  const refreshLeaguePerformance = async (reason: "stale" | "manual") => {
    if (refreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshing(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextUpdates: ChronicleUpdates = {
      generatedAt: Date.now(),
      teams: {},
    };
    const nextManualTeams = [...manualTeams];
    const leagueDetailsByUnit = new Map<number, any>();

    for (const team of trackedTeams) {
      if (team.leagueLevelUnitId) continue;
      try {
        const response = await fetch(
          `/api/chpp/teamdetails?teamId=${team.teamId}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              data?: {
                HattrickData?: {
                  Team?: {
                    TeamID?: number | string;
                    TeamName?: string;
                    LeagueName?: string;
                    LeagueLevelUnitName?: string;
                    LeagueLevelUnitID?: number | string;
                    LeagueLevelUnit?: {
                      LeagueLevelUnitID?: number | string;
                      LeagueLevelUnitName?: string;
                      Name?: string;
                    };
                    League?: {
                      LeagueName?: string;
                      Name?: string;
                    };
                  };
                };
              };
              error?: string;
            }
          | null;
        const teamDetails = payload?.data?.HattrickData?.Team;
        const meta = resolveTeamDetailsMeta(teamDetails);
        const nextTeamName = teamDetails?.TeamName ?? team.teamName ?? "";
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: nextTeamName,
          leagueName: meta.leagueName,
          leagueLevelUnitName: meta.leagueLevelUnitName,
          leagueLevelUnitId: meta.leagueLevelUnitId,
          leaguePerformance: nextCache.teams[team.teamId]?.leaguePerformance,
        };
        const manualIndex = nextManualTeams.findIndex(
          (item) => item.teamId === team.teamId
        );
        if (manualIndex >= 0) {
          nextManualTeams[manualIndex] = {
            ...nextManualTeams[manualIndex],
            teamName: nextTeamName,
            leagueName: meta.leagueName,
            leagueLevelUnitName: meta.leagueLevelUnitName,
            leagueLevelUnitId: meta.leagueLevelUnitId,
          };
        }
      } catch {
        // ignore teamdetails failure for now
      }
    }

    const teamsWithLeague = trackedTeams
      .map((team) => nextCache.teams[team.teamId] ?? team)
      .filter((team) => team.leagueLevelUnitId);

    for (const team of teamsWithLeague) {
      const leagueLevelUnitId = Number(team.leagueLevelUnitId);
      if (!Number.isFinite(leagueLevelUnitId)) continue;
      if (!leagueDetailsByUnit.has(leagueLevelUnitId)) {
        try {
          const response = await fetch(
            `/api/chpp/leaguedetails?leagueLevelUnitId=${leagueLevelUnitId}`,
            { cache: "no-store" }
          );
          const payload = (await response.json().catch(() => null)) as
            | {
                data?: {
                  HattrickData?: {
                    LeagueID?: number | string;
                    LeagueName?: string;
                    LeagueLevel?: number | string;
                    MaxLevel?: number | string;
                    LeagueLevelUnitID?: number | string;
                    LeagueLevelUnitName?: string;
                    CurrentMatchRound?: string;
                    Rank?: number | string;
                    Team?: unknown;
                  };
                };
                error?: string;
              }
            | null;
          if (!response.ok || payload?.error) {
            continue;
          }
          leagueDetailsByUnit.set(leagueLevelUnitId, payload?.data?.HattrickData);
        } catch {
          // ignore league failure
        }
      }
    }

    teamsWithLeague.forEach((team) => {
      const leagueLevelUnitId = Number(team.leagueLevelUnitId);
      const leagueData = leagueDetailsByUnit.get(leagueLevelUnitId);
      if (!leagueData) return;
      const rawTeams = leagueData.Team;
      const teamList = Array.isArray(rawTeams) ? rawTeams : rawTeams ? [rawTeams] : [];
      const match = teamList.find(
        (entry) => Number(entry.TeamID) === Number(team.teamId)
      );
      if (!match) return;
      const snapshot: LeaguePerformanceSnapshot = {
        leagueId: parseNumber(leagueData.LeagueID),
        leagueName: leagueData.LeagueName ?? null,
        leagueLevel: parseNumber(leagueData.LeagueLevel),
        maxLevel: parseNumber(leagueData.MaxLevel),
        leagueLevelUnitId:
          parseNumber(leagueData.LeagueLevelUnitID) ?? leagueLevelUnitId,
        leagueLevelUnitName: leagueData.LeagueLevelUnitName ?? null,
        currentMatchRound: leagueData.CurrentMatchRound ?? null,
        rank: parseNumber(leagueData.Rank),
        userId: parseNumber(match.UserId),
        teamId: parseNumber(match.TeamID) ?? Number(team.teamId),
        position: parseNumber(match.Position),
        positionChange: match.PositionChange ?? null,
        teamName: match.TeamName ?? team.teamName ?? null,
        matches: parseNumber(match.Matches),
        goalsFor: parseNumber(match.GoalsFor),
        goalsAgainst: parseNumber(match.GoalsAgainst),
        points: parseNumber(match.Points),
        won: parseNumber(match.Won),
        draws: parseNumber(match.Draws),
        lost: parseNumber(match.Lost),
        fetchedAt: Date.now(),
      };
      const previous = nextCache.teams[team.teamId]?.leaguePerformance?.current;
      nextCache.teams[team.teamId] = {
        ...nextCache.teams[team.teamId],
        teamId: team.teamId,
        teamName: team.teamName ?? snapshot.teamName ?? "",
        leagueName: team.leagueName ?? snapshot.leagueName ?? null,
        leagueLevelUnitName:
          team.leagueLevelUnitName ?? snapshot.leagueLevelUnitName ?? null,
        leagueLevelUnitId: leagueLevelUnitId,
        leaguePerformance: {
          current: snapshot,
          previous: previous,
        },
      };
      const changes = buildChanges(previous, snapshot, leagueTableColumns);
      nextUpdates.teams[team.teamId] = {
        teamId: team.teamId,
        teamName: team.teamName ?? snapshot.teamName ?? `${team.teamId}`,
        changes,
      };
    });

    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setUpdates(nextUpdates);
    setUpdatesOpen(true);
    writeLastRefresh(Date.now());
    if (reason === "stale") {
      addNotification(messages.notificationChronicleStaleRefresh);
    }
    setRefreshing(false);
  };

  const updatesByTeam = updates?.teams ?? {};

  const leagueRows: LeagueTableRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.leaguePerformance?.current,
      leaguePerformance: cached?.leaguePerformance,
      meta:
        team.leagueName || team.leagueLevelUnitName
          ? [team.leagueName, team.leagueLevelUnitName].filter(Boolean).join(" · ")
          : null,
    };
  });

  const selectedTeam = selectedTeamId
    ? leagueRows.find((team) => team.teamId === selectedTeamId) ?? null
    : null;
  const tableStyle = useMemo(() => {
    const remainingColumns = Math.max(leagueTableColumns.length - 1, 1);
    return {
      "--cc-columns": leagueTableColumns.length,
      "--cc-template": `minmax(160px, 1.2fr) repeat(${remainingColumns}, minmax(60px, 0.8fr))`,
    } as CSSProperties;
  }, [leagueTableColumns.length]);

  return (
    <div className={styles.clubChronicleStack}>
      <div className={styles.chronicleHeader}>
        <h2 className={styles.chronicleHeaderTitle}>
          {messages.clubChronicleTitle}
        </h2>
        <div className={styles.chronicleHeaderActions}>
          <Tooltip content={messages.clubChronicleRefreshTooltip}>
            <button
              type="button"
              className={styles.chronicleUpdatesButton}
              onClick={() => void refreshLeaguePerformance("manual")}
              disabled={refreshing}
              aria-label={messages.clubChronicleRefreshTooltip}
            >
              {messages.clubChronicleRefreshButton}
            </button>
          </Tooltip>
          <button
            type="button"
            className={styles.chronicleUpdatesButton}
            onClick={() => setUpdatesOpen(true)}
          >
            {messages.clubChronicleUpdatesButton}
          </button>
        </div>
      </div>

      <div className={styles.chroniclePanels}>
        {panelOrder.map((panelId) => {
          if (panelId !== "league-performance") return null;
          const canMoveUp = panelOrder.indexOf(panelId) > 0;
          const canMoveDown =
            panelOrder.indexOf(panelId) < panelOrder.length - 1;
          return (
            <div key={panelId} className={styles.chroniclePanel}>
              <div className={styles.chroniclePanelHeader}>
                <h3 className={styles.chroniclePanelTitle}>
                  {messages.clubChronicleLeaguePanelTitle}
                </h3>
                <div className={styles.chroniclePanelActions}>
                  <Tooltip content={messages.clubChronicleMoveUp}>
                    <button
                      type="button"
                      className={styles.chroniclePanelMove}
                      onClick={() => handleMovePanel(panelId, "up")}
                      disabled={!canMoveUp}
                      aria-label={messages.clubChronicleMoveUp}
                    >
                      ↑
                    </button>
                  </Tooltip>
                  <Tooltip content={messages.clubChronicleMoveDown}>
                    <button
                      type="button"
                      className={styles.chroniclePanelMove}
                      onClick={() => handleMovePanel(panelId, "down")}
                      disabled={!canMoveDown}
                      aria-label={messages.clubChronicleMoveDown}
                    >
                      ↓
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className={styles.chroniclePanelBody}>
                {trackedTeams.length === 0 ? (
                  <p className={styles.chronicleEmpty}>
                    {messages.clubChronicleNoTeams}
                  </p>
                ) : refreshing && leagueRows.every((row) => !row.snapshot) ? (
                  <p className={styles.chronicleEmpty}>
                    {messages.clubChronicleLoading}
                  </p>
                ) : (
                  <ChronicleTable
                    columns={leagueTableColumns}
                    rows={leagueRows}
                    getRowKey={(row) => row.teamId}
                    getSnapshot={(row) => row.snapshot ?? undefined}
                    onRowClick={(row) => handleOpenDetails(row.teamId)}
                    formatValue={formatValue}
                    style={tableStyle}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

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
                      {team.leagueName || team.leagueLevelUnitName ? (
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
                      {team.leagueName || team.leagueLevelUnitName ? (
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
        open={updatesOpen}
        title={messages.clubChronicleUpdatesTitle}
        body={
          updates && trackedTeams.length ? (
            <div className={styles.chronicleUpdatesList}>
              {trackedTeams.map((team) => {
                const teamUpdates = updatesByTeam[team.teamId];
                const changes = teamUpdates?.changes ?? [];
                return (
                  <div key={team.teamId} className={styles.chronicleUpdatesTeam}>
                    <h3 className={styles.chronicleUpdatesTeamTitle}>
                      {teamUpdates?.teamName ?? team.teamName ?? team.teamId}
                    </h3>
                    <div className={styles.chronicleUpdatesHeader}>
                      <span />
                      <span>{messages.clubChronicleDetailsPreviousLabel}</span>
                      <span>{messages.clubChronicleDetailsCurrentLabel}</span>
                    </div>
                    {changes.length === 0 ? (
                      <p className={styles.chronicleEmpty}>
                        {messages.clubChronicleUpdatesNoChanges}
                      </p>
                    ) : null}
                    {changes.map((change) => (
                      <div
                        key={`${team.teamId}-${change.fieldKey}`}
                        className={styles.chronicleUpdatesRow}
                      >
                        <span className={styles.chronicleUpdatesLabel}>
                          {change.label}
                        </span>
                        <span>{change.previous ?? messages.unknownShort}</span>
                        <span>{change.current ?? messages.unknownShort}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>
              {messages.clubChronicleUpdatesEmpty}
            </p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setUpdatesOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setUpdatesOpen(false)}
      />

      <Modal
        open={detailsOpen}
        title={messages.clubChronicleTeamDetailsTitle}
        body={
          selectedTeam?.leaguePerformance ? (
            <div className={styles.chronicleDetailsGrid}>
              <h3 className={styles.chronicleDetailsSectionTitle}>
                {messages.clubChronicleLeagueSectionTitle}
              </h3>
              <div className={styles.chronicleDetailsHeader}>
                <span />
                <span>{messages.clubChronicleDetailsPreviousLabel}</span>
                <span>{messages.clubChronicleDetailsCurrentLabel}</span>
              </div>
              {leagueTableColumns.map((column) => (
                  <div
                    key={`details-${column.key}`}
                    className={styles.chronicleDetailsRow}
                  >
                    <span className={styles.chronicleDetailsLabel}>
                      {column.label}
                    </span>
                    <span>
                      {formatValue(
                        column.getValue(
                          selectedTeam.leaguePerformance?.previous,
                          selectedTeam ? { teamName: selectedTeam.teamName, meta: selectedTeam.meta } : undefined
                        ) as string | number | null | undefined
                      )}
                    </span>
                    <span>
                      {formatValue(
                        column.getValue(
                          selectedTeam.leaguePerformance?.current,
                          selectedTeam ? { teamName: selectedTeam.teamName, meta: selectedTeam.meta } : undefined
                        ) as string | number | null | undefined
                      )}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>
              {messages.clubChronicleLeaguePanelEmpty}
            </p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setDetailsOpen(false)}
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
