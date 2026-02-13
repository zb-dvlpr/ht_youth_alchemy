"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { formatChppDateTime } from "@/lib/datetime";
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

type PressAnnouncementSnapshot = {
  subject: string | null;
  body: string | null;
  sendDate: string | null;
  fetchedAt: number;
};

type PressAnnouncementData = {
  current: PressAnnouncementSnapshot;
  previous?: PressAnnouncementSnapshot;
};

type LeagueTableRow = {
  teamId: number;
  teamName: string;
  snapshot?: LeaguePerformanceSnapshot | null;
  leaguePerformance?: LeaguePerformanceData;
  meta?: string | null;
};

type PressAnnouncementRow = {
  teamId: number;
  teamName: string;
  snapshot?: PressAnnouncementSnapshot | null;
};

type PressToken =
  | { kind: "text"; value: string }
  | { kind: "player"; id: number }
  | { kind: "match"; id: number }
  | { kind: "team"; id: number }
  | { kind: "article"; id: number }
  | { kind: "link"; url: string };

type ChronicleTeamData = {
  teamId: number;
  teamName?: string;
  leagueName?: string | null;
  leagueLevelUnitName?: string | null;
  leagueLevelUnitId?: number | null;
  leaguePerformance?: LeaguePerformanceData;
  pressAnnouncement?: PressAnnouncementData;
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

type SortValue = string | number | null | SortValue[];

type ChronicleTableColumn<Row, Snapshot> = {
  key: string;
  label: string;
  sortable?: boolean;
  getValue: (
    snapshot: Snapshot | undefined,
    row?: Row
  ) => string | number | null | undefined;
  getSortValue?: (
    snapshot: Snapshot | undefined,
    row?: Row
  ) => SortValue | undefined;
};

type ChronicleTableProps<Row, Snapshot> = {
  columns: ChronicleTableColumn<Row, Snapshot>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  getSnapshot: (row: Row) => Snapshot | undefined;
  onRowClick?: (row: Row) => void;
  formatValue: (value: string | number | null | undefined) => string;
  style?: CSSProperties;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
};

type ChroniclePanelProps = {
  title: string;
  refreshing?: boolean;
  refreshLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  onRefresh?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
};

const ChronicleTable = <Row, Snapshot>({
  columns,
  rows,
  getRowKey,
  getSnapshot,
  onRowClick,
  formatValue,
  style,
  sortKey,
  sortDirection,
  onSort,
}: ChronicleTableProps<Row, Snapshot>) => (
  <div className={styles.chronicleTable} style={style}>
    <div className={styles.chronicleTableHeader}>
      {columns.map((column) => {
        const isSortable = Boolean(onSort) && column.sortable !== false;
        const isActive = sortKey === column.key;
        if (isSortable) {
          const icon = isActive
            ? sortDirection === "desc"
              ? "▼"
              : "▲"
            : "⇅";
          const ariaSort: "none" | "ascending" | "descending" =
            isActive
              ? sortDirection === "desc"
                ? "descending"
                : "ascending"
              : "none";
          return (
            <button
              key={`header-${column.key}`}
              type="button"
              className={styles.chronicleTableHeaderButton}
              onClick={() => onSort?.(column.key)}
              aria-sort={ariaSort}
            >
              {column.label}
              <span className={styles.chronicleTableSortIcon}>{icon}</span>
            </button>
          );
        }
        return <span key={`header-${column.key}`}>{column.label}</span>;
      })}
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

const ChroniclePanel = ({
  title,
  refreshing,
  refreshLabel,
  moveUpLabel,
  moveDownLabel,
  onRefresh,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  children,
}: ChroniclePanelProps) => (
  <div className={styles.chroniclePanel}>
    <div className={styles.chroniclePanelHeader}>
      <h3 className={styles.chroniclePanelTitle}>
        <span className={styles.chroniclePanelTitleRow}>
          {title}
          {onRefresh ? (
            <Tooltip content={refreshLabel}>
              <button
                type="button"
                className={styles.chroniclePanelRefresh}
                onClick={onRefresh}
                disabled={Boolean(refreshing)}
                aria-label={refreshLabel}
              >
                ↻
              </button>
            </Tooltip>
          ) : null}
          {refreshing ? (
            <span
              className={styles.chronicleRefreshSpinner}
              aria-label={refreshLabel}
            />
          ) : null}
        </span>
      </h3>
      <div className={styles.chroniclePanelActions}>
        <Tooltip content={moveUpLabel}>
          <button
            type="button"
            className={styles.chroniclePanelMove}
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={moveUpLabel}
          >
            ↑
          </button>
        </Tooltip>
        <Tooltip content={moveDownLabel}>
          <button
            type="button"
            className={styles.chroniclePanelMove}
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={moveDownLabel}
          >
            ↓
          </button>
        </Tooltip>
      </div>
    </div>
    <div className={styles.chroniclePanelBody}>{children}</div>
  </div>
);

const STORAGE_KEY = "ya_club_chronicle_watchlist_v1";
const CACHE_KEY = "ya_cc_cache_v1";
const UPDATES_KEY = "ya_cc_updates_v1";
const PANEL_ORDER_KEY = "ya_cc_panel_order_v1";
const LAST_REFRESH_KEY = "ya_cc_last_refresh_ts_v1";
const PANEL_IDS = ["league-performance", "press-announcements"] as const;
const SEASON_LENGTH_MS = 112 * 24 * 60 * 60 * 1000;
const MAX_CACHE_AGE_MS = SEASON_LENGTH_MS * 2;
const HT_BASE_URL = "https://www89.hattrick.org";

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

const resolvePressAnnouncement = (
  team:
    | {
        PressAnnouncement?: {
          Subject?: string;
          Body?: string;
          SendDate?: string;
        };
      }
    | undefined
): PressAnnouncementSnapshot | null => {
  const press = team?.PressAnnouncement;
  if (!press) return null;
  const subject = press.Subject?.trim() ?? "";
  const body = press.Body?.trim() ?? "";
  const sendDate = press.SendDate?.trim() ?? "";
  if (!subject && !body && !sendDate) return null;
  return {
    subject: subject || null,
    body: body || null,
    sendDate: sendDate || null,
    fetchedAt: Date.now(),
  };
};

const tokenizePressText = (text: string): PressToken[] => {
  const regex = /\[(playerid|matchid|teamid|articleid|link)=([^\]]+)\]/gi;
  const tokens: PressToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const [raw, type, valueRaw] = match;
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    const value = valueRaw.trim();
    if (type.toLowerCase() === "link" && value) {
      tokens.push({ kind: "link", url: value });
    } else {
      const id = Number(value);
      if (Number.isFinite(id) && id > 0) {
        if (type.toLowerCase() === "playerid") tokens.push({ kind: "player", id });
        if (type.toLowerCase() === "matchid") tokens.push({ kind: "match", id });
        if (type.toLowerCase() === "teamid") tokens.push({ kind: "team", id });
        if (type.toLowerCase() === "articleid") tokens.push({ kind: "article", id });
      } else {
        tokens.push({ kind: "text", value: raw });
      }
    }
    lastIndex = match.index + raw.length;
    match = regex.exec(text);
  }
  if (lastIndex < text.length) {
    tokens.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return tokens;
};

const extractPressReferenceIds = (text: string) => {
  const playerIds = new Set<number>();
  const matchIds = new Set<number>();
  const teamIds = new Set<number>();
  tokenizePressText(text).forEach((token) => {
    if (token.kind === "player") playerIds.add(token.id);
    if (token.kind === "match") matchIds.add(token.id);
    if (token.kind === "team") teamIds.add(token.id);
  });
  return {
    playerIds: Array.from(playerIds),
    matchIds: Array.from(matchIds),
    teamIds: Array.from(teamIds),
  };
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
      pressAnnouncement: (() => {
        const pressAnnouncement = team.pressAnnouncement;
        if (!pressAnnouncement?.current) return pressAnnouncement;
        const currentAge = now - pressAnnouncement.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!pressAnnouncement.previous) return pressAnnouncement;
        const previousAge = now - pressAnnouncement.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...pressAnnouncement,
            previous: undefined,
          };
        }
        return pressAnnouncement;
      })(),
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
  const [pressDetailsOpen, setPressDetailsOpen] = useState(false);
  const [selectedPressTeamId, setSelectedPressTeamId] = useState<number | null>(
    null
  );
  const [resolvedPlayers, setResolvedPlayers] = useState<Record<number, string>>(
    {}
  );
  const [resolvedMatches, setResolvedMatches] = useState<Record<number, string>>(
    {}
  );
  const [resolvedTeams, setResolvedTeams] = useState<Record<number, string>>({});
  const [stalenessDays, setStalenessDays] = useState(
    DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS
  );
  const [leagueSortState, setLeagueSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [pressSortState, setPressSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [refreshingGlobal, setRefreshingGlobal] = useState(false);
  const [refreshingLeague, setRefreshingLeague] = useState(false);
  const [refreshingPress, setRefreshingPress] = useState(false);
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
  const anyRefreshing = refreshingGlobal || refreshingLeague || refreshingPress;

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
    if (anyRefreshing || initialFetchRef.current) return;
    initialFetchRef.current = true;
    void refreshAllData("manual");
  }, [trackedTeams.length, chronicleCache, anyRefreshing]);

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
    if (staleRefreshRef.current || anyRefreshing) return;
    staleRefreshRef.current = true;
    void refreshAllData("stale");
  }, [trackedTeams.length, stalenessDays, anyRefreshing, chronicleCache]);

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

  const handleOpenPressDetails = (teamId: number) => {
    setSelectedPressTeamId(teamId);
    setPressDetailsOpen(true);
  };

  const handleLeagueSort = (key: string) => {
    setLeagueSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handlePressSort = (key: string) => {
    setPressSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
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
        getSortValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot && snapshot.goalsFor !== null && snapshot.goalsAgainst !== null
            ? snapshot.goalsFor - snapshot.goalsAgainst
            : null,
      },
      {
        key: "record",
        label: messages.clubChronicleColumnRecord,
        getValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot
            ? `${formatValue(snapshot.won)}-${formatValue(snapshot.draws)}-${formatValue(snapshot.lost)}`
            : null,
        getSortValue: (snapshot: LeaguePerformanceSnapshot | undefined) =>
          snapshot
            ? [
                snapshot.won ?? 0,
                snapshot.draws ?? 0,
                snapshot.lost ?? 0,
              ]
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

  const pressTableColumns = useMemo<
    ChronicleTableColumn<PressAnnouncementRow, PressAnnouncementSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "announcement",
        label: messages.clubChroniclePressColumnAnnouncement,
        getValue: (snapshot: PressAnnouncementSnapshot | undefined) =>
          snapshot?.subject ?? messages.clubChroniclePressNone,
      },
      {
        key: "publishedAt",
        label: messages.clubChroniclePressColumnPublishedAt,
        getValue: (snapshot: PressAnnouncementSnapshot | undefined) =>
          snapshot?.sendDate
            ? formatChppDateTime(snapshot.sendDate) ?? snapshot.sendDate
            : null,
        getSortValue: (snapshot: PressAnnouncementSnapshot | undefined) =>
          snapshot?.sendDate ?? null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChroniclePressColumnAnnouncement,
      messages.clubChroniclePressColumnPublishedAt,
      messages.clubChroniclePressNone,
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

  const normalizeSortValue = (value: unknown): SortValue => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeSortValue(entry));
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const asNumber = Number(value);
    if (typeof value !== "string" && Number.isFinite(asNumber)) {
      return asNumber;
    }
    return String(value);
  };

  const compareSortValues = (left: unknown, right: unknown): number => {
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    if (Array.isArray(left) && Array.isArray(right)) {
      const length = Math.max(left.length, right.length);
      for (let i = 0; i < length; i += 1) {
        const result = compareSortValues(left[i], right[i]);
        if (result !== 0) return result;
      }
      return 0;
    }
    if (typeof left === "number" && typeof right === "number") {
      return left === right ? 0 : left < right ? -1 : 1;
    }
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  };

  const buildChanges = (
    previous: LeaguePerformanceSnapshot | undefined,
    current: LeaguePerformanceSnapshot,
    columns: ChronicleTableColumn<LeagueTableRow, LeaguePerformanceSnapshot>[]
  ): ChronicleUpdateField[] => {
    if (!previous) {
      return [];
    }
    const changes: ChronicleUpdateField[] = [];
    columns.forEach((column) => {
      const prevValue = column.getValue(previous);
      const nextValue = column.getValue(current);
      if (prevValue === nextValue) return;
      changes.push({
        fieldKey: column.key,
        label: column.label,
        previous: formatValue(prevValue),
        current: formatValue(nextValue),
      });
    });
    return changes;
  };

  const refreshTeamDetails = async (
    nextCache: ChronicleCache,
    nextManualTeams: ManualTeam[],
    options: { updatePress: boolean }
  ) => {
    for (const team of trackedTeams) {
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
                    PressAnnouncement?: {
                      Subject?: string;
                      Body?: string;
                      SendDate?: string;
                    };
                  };
                };
              };
              error?: string;
            }
          | null;
        const teamDetails = payload?.data?.HattrickData?.Team;
        const meta = resolveTeamDetailsMeta(teamDetails);
        const pressSnapshot = resolvePressAnnouncement(teamDetails);
        const nextTeamName = teamDetails?.TeamName ?? team.teamName ?? "";
        const previousPress = nextCache.teams[team.teamId]?.pressAnnouncement?.current;
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: nextTeamName,
          leagueName: meta.leagueName,
          leagueLevelUnitName: meta.leagueLevelUnitName,
          leagueLevelUnitId: meta.leagueLevelUnitId,
          leaguePerformance: nextCache.teams[team.teamId]?.leaguePerformance,
          pressAnnouncement:
            options.updatePress && pressSnapshot
              ? {
                  current: pressSnapshot,
                  previous: previousPress,
                }
              : nextCache.teams[team.teamId]?.pressAnnouncement,
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
  };

  const refreshLeagueSnapshots = async (
    nextCache: ChronicleCache,
    nextUpdates: ChronicleUpdates
  ) => {
    const leagueDetailsByUnit = new Map<number, any>();
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
  };

  const refreshAllData = async (reason: "stale" | "manual") => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshingGlobal(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextUpdates: ChronicleUpdates = {
      generatedAt: Date.now(),
      teams: {},
    };
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: true });
    await refreshLeagueSnapshots(nextCache, nextUpdates);

    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setUpdates(nextUpdates);
    const hasUpdates = Object.values(nextUpdates.teams).some(
      (teamUpdate) => teamUpdate.changes.length > 0
    );
    setUpdatesOpen(hasUpdates);
    writeLastRefresh(Date.now());
    if (reason === "stale") {
      addNotification(messages.notificationChronicleStaleRefresh);
    }
    setRefreshingGlobal(false);
    addNotification(messages.notificationChronicleRefreshComplete);
  };

  const refreshLeagueOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshingLeague(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextUpdates: ChronicleUpdates = {
      generatedAt: Date.now(),
      teams: {},
    };
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
    await refreshLeagueSnapshots(nextCache, nextUpdates);

    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setUpdates(nextUpdates);
    const hasUpdates = Object.values(nextUpdates.teams).some(
      (teamUpdate) => teamUpdate.changes.length > 0
    );
    setUpdatesOpen(hasUpdates);
    setRefreshingLeague(false);
    addNotification(messages.notificationChronicleRefreshComplete);
  };

  const refreshPressOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshingPress(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: true });
    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setRefreshingPress(false);
    addNotification(messages.notificationChronicleRefreshComplete);
  };

  const updatesByTeam = updates?.teams ?? {};
  const hasAnyTeamUpdates = trackedTeams.some((team) => {
    const changes = updatesByTeam[team.teamId]?.changes ?? [];
    return changes.length > 0;
  });

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

  const pressRows: PressAnnouncementRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.pressAnnouncement?.current,
    };
  });

  const sortedLeagueRows = useMemo(() => {
    if (!leagueSortState.key) return leagueRows;
    const column = leagueTableColumns.find(
      (item) => item.key === leagueSortState.key
    );
    if (!column) return leagueRows;
    const direction = leagueSortState.direction === "desc" ? -1 : 1;
    return [...leagueRows]
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftValue = normalizeSortValue(
          column.getSortValue?.(left.row.snapshot ?? undefined, left.row) ??
            column.getValue(left.row.snapshot ?? undefined, left.row)
        );
        const rightValue = normalizeSortValue(
          column.getSortValue?.(right.row.snapshot ?? undefined, right.row) ??
            column.getValue(right.row.snapshot ?? undefined, right.row)
        );
        const result = compareSortValues(leftValue, rightValue);
        if (result !== 0) return result * direction;
        return left.index - right.index;
      })
      .map((item) => item.row);
  }, [leagueRows, leagueTableColumns, leagueSortState]);

  const sortedPressRows = useMemo(() => {
    if (!pressSortState.key) return pressRows;
    const column = pressTableColumns.find((item) => item.key === pressSortState.key);
    if (!column) return pressRows;
    const direction = pressSortState.direction === "desc" ? -1 : 1;
    return [...pressRows]
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftValue = normalizeSortValue(
          column.getSortValue?.(left.row.snapshot ?? undefined, left.row) ??
            column.getValue(left.row.snapshot ?? undefined, left.row)
        );
        const rightValue = normalizeSortValue(
          column.getSortValue?.(right.row.snapshot ?? undefined, right.row) ??
            column.getValue(right.row.snapshot ?? undefined, right.row)
        );
        const result = compareSortValues(leftValue, rightValue);
        if (result !== 0) return result * direction;
        return left.index - right.index;
      })
      .map((item) => item.row);
  }, [pressRows, pressTableColumns, pressSortState]);

  const selectedTeam = selectedTeamId
    ? leagueRows.find((team) => team.teamId === selectedTeamId) ?? null
    : null;
  const selectedPressTeam = selectedPressTeamId
    ? pressRows.find((team) => team.teamId === selectedPressTeamId) ?? null
    : null;

  useEffect(() => {
    if (!pressDetailsOpen || !selectedPressTeam?.snapshot) return;
    const combined = [
      selectedPressTeam.snapshot.subject ?? "",
      selectedPressTeam.snapshot.body ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    const { playerIds, matchIds, teamIds } = extractPressReferenceIds(combined);

    void Promise.all(
      playerIds
        .filter((id) => !resolvedPlayers[id])
        .map(async (id) => {
          try {
            const response = await fetch(`/api/chpp/playerdetails?playerId=${id}`, {
              cache: "no-store",
            });
            const payload = (await response.json().catch(() => null)) as
              | {
                  data?: {
                    HattrickData?: {
                      Player?: {
                        FirstName?: string;
                        NickName?: string;
                        LastName?: string;
                      };
                    };
                  };
                }
              | null;
            const player = payload?.data?.HattrickData?.Player;
            const name = [player?.FirstName, player?.NickName, player?.LastName]
              .filter(Boolean)
              .join(" ")
              .trim();
            if (!name) return;
            setResolvedPlayers((prev) => ({ ...prev, [id]: name }));
          } catch {
            // ignore resolve failures
          }
        })
    );

    void Promise.all(
      matchIds
        .filter((id) => !resolvedMatches[id])
        .map(async (id) => {
          try {
            const response = await fetch(
              `/api/chpp/matchdetails?matchId=${id}&sourceSystem=Hattrick`,
              { cache: "no-store" }
            );
            const payload = (await response.json().catch(() => null)) as
              | {
                  data?: {
                    HattrickData?: {
                      Match?: {
                        HomeTeam?: { HomeTeamName?: string };
                        AwayTeam?: { AwayTeamName?: string };
                      };
                    };
                  };
                }
              | null;
            const match = payload?.data?.HattrickData?.Match;
            const home = match?.HomeTeam?.HomeTeamName?.trim();
            const away = match?.AwayTeam?.AwayTeamName?.trim();
            if (!home || !away) return;
            setResolvedMatches((prev) => ({ ...prev, [id]: `${home} vs ${away}` }));
          } catch {
            // ignore resolve failures
          }
        })
    );

    void Promise.all(
      teamIds
        .filter((id) => !resolvedTeams[id])
        .map(async (id) => {
          try {
            const response = await fetch(`/api/chpp/teamdetails?teamId=${id}`, {
              cache: "no-store",
            });
            const payload = (await response.json().catch(() => null)) as
              | {
                  data?: {
                    HattrickData?: {
                      Team?: { TeamName?: string };
                    };
                  };
                }
              | null;
            const name = payload?.data?.HattrickData?.Team?.TeamName?.trim();
            if (!name) return;
            setResolvedTeams((prev) => ({ ...prev, [id]: name }));
          } catch {
            // ignore resolve failures
          }
        })
    );
  }, [
    pressDetailsOpen,
    selectedPressTeam,
    resolvedPlayers,
    resolvedMatches,
    resolvedTeams,
  ]);

  const renderPressText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, lineIndex) => {
      const tokens = tokenizePressText(line);
      return (
        <span key={`line-${lineIndex}`}>
          {tokens.map((token, tokenIndex) => {
            if (token.kind === "text") {
              return <span key={`t-${lineIndex}-${tokenIndex}`}>{token.value}</span>;
            }
            if (token.kind === "player") {
              const label =
                resolvedPlayers[token.id] ??
                `${messages.ratingsPlayerLabel} ${token.id}`;
              const href = `${HT_BASE_URL}/Club/Players/Player.aspx?playerId=${token.id}`;
              return (
                <a
                  key={`p-${lineIndex}-${tokenIndex}`}
                  className={styles.chroniclePressLink}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                </a>
              );
            }
            if (token.kind === "match") {
              const label =
                resolvedMatches[token.id] ??
                `${messages.matchesTitle} ${token.id}`;
              const href = `${HT_BASE_URL}/Club/Matches/Match.aspx?matchID=${token.id}`;
              return (
                <a
                  key={`m-${lineIndex}-${tokenIndex}`}
                  className={styles.chroniclePressLink}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                </a>
              );
            }
            if (token.kind === "team") {
              const label =
                resolvedTeams[token.id] ??
                `${messages.watchlistTeamLabel} ${token.id}`;
              const href = `${HT_BASE_URL}/Club/?TeamID=${token.id}`;
              return (
                <a
                  key={`team-${lineIndex}-${tokenIndex}`}
                  className={styles.chroniclePressLink}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                </a>
              );
            }
            if (token.kind === "article") {
              const label = `${messages.clubChroniclePressArticleLabel} ${token.id}`;
              const href = `${HT_BASE_URL}/Community/Press/?ArticleID=${token.id}`;
              return (
                <a
                  key={`article-${lineIndex}-${tokenIndex}`}
                  className={styles.chroniclePressLink}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                </a>
              );
            }
            return (
              <a
                key={`link-${lineIndex}-${tokenIndex}`}
                className={styles.chroniclePressLink}
                href={token.url}
                target="_blank"
                rel="noreferrer"
              >
                {token.url}
              </a>
            );
          })}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      );
    });
  };
  const tableStyle = useMemo(() => {
    const remainingColumns = Math.max(leagueTableColumns.length - 1, 1);
    return {
      "--cc-columns": leagueTableColumns.length,
      "--cc-template": `minmax(160px, 1.2fr) repeat(${remainingColumns}, minmax(60px, 0.8fr))`,
    } as CSSProperties;
  }, [leagueTableColumns.length]);

  const pressTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": pressTableColumns.length,
        "--cc-template": "minmax(140px, 1.1fr) minmax(220px, 2fr) minmax(140px, 1fr)",
      }) as CSSProperties,
    [pressTableColumns.length]
  );

  return (
    <div className={styles.clubChronicleStack}>
      <div className={styles.chronicleHeader}>
        <h2 className={styles.chronicleHeaderTitle}>
          {messages.clubChronicleTitle}
        </h2>
        <div className={styles.chronicleHeaderActions}>
          <Tooltip content={messages.clubChronicleRefreshAllTooltip}>
            <button
              type="button"
              className={styles.chronicleUpdatesButton}
              onClick={() => void refreshAllData("manual")}
              disabled={anyRefreshing}
              aria-label={messages.clubChronicleRefreshAllTooltip}
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
          const canMoveUp = panelOrder.indexOf(panelId) > 0;
          const canMoveDown =
            panelOrder.indexOf(panelId) < panelOrder.length - 1;
          if (panelId === "league-performance") {
            return (
              <ChroniclePanel
              key={panelId}
              title={messages.clubChronicleLeaguePanelTitle}
              refreshing={refreshingGlobal || refreshingLeague}
              refreshLabel={messages.clubChronicleRefreshTooltip}
              moveUpLabel={messages.clubChronicleMoveUp}
              moveDownLabel={messages.clubChronicleMoveDown}
              onRefresh={() => void refreshLeagueOnly()}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
                onMoveUp={() => handleMovePanel(panelId, "up")}
                onMoveDown={() => handleMovePanel(panelId, "down")}
              >
                {trackedTeams.length === 0 ? (
                  <p className={styles.chronicleEmpty}>
                    {messages.clubChronicleNoTeams}
                  </p>
              ) : (refreshingGlobal || refreshingLeague) &&
                leagueRows.every((row) => !row.snapshot) ? (
                <p className={styles.chronicleEmpty}>
                  {messages.clubChronicleLoading}
                </p>
                ) : (
                  <ChronicleTable
                    columns={leagueTableColumns}
                    rows={sortedLeagueRows}
                    getRowKey={(row) => row.teamId}
                    getSnapshot={(row) => row.snapshot ?? undefined}
                    onRowClick={(row) => handleOpenDetails(row.teamId)}
                    formatValue={formatValue}
                    style={tableStyle}
                    sortKey={leagueSortState.key}
                    sortDirection={leagueSortState.direction}
                    onSort={handleLeagueSort}
                  />
                )}
              </ChroniclePanel>
            );
          }
          if (panelId === "press-announcements") {
            return (
              <ChroniclePanel
              key={panelId}
              title={messages.clubChroniclePressPanelTitle}
              refreshing={refreshingGlobal || refreshingPress}
              refreshLabel={messages.clubChronicleRefreshPressTooltip}
              moveUpLabel={messages.clubChronicleMoveUp}
              moveDownLabel={messages.clubChronicleMoveDown}
              onRefresh={() => void refreshPressOnly()}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
                onMoveUp={() => handleMovePanel(panelId, "up")}
                onMoveDown={() => handleMovePanel(panelId, "down")}
              >
                {trackedTeams.length === 0 ? (
                  <p className={styles.chronicleEmpty}>
                    {messages.clubChronicleNoTeams}
                  </p>
                ) : (refreshingGlobal || refreshingPress) &&
                  pressRows.every((row) => !row.snapshot) ? (
                  <p className={styles.chronicleEmpty}>
                    {messages.clubChronicleLoading}
                  </p>
                ) : (
                  <ChronicleTable
                    columns={pressTableColumns}
                    rows={sortedPressRows}
                    getRowKey={(row) => row.teamId}
                    getSnapshot={(row) => row.snapshot ?? undefined}
                    onRowClick={(row) => handleOpenPressDetails(row.teamId)}
                    formatValue={formatValue}
                    style={pressTableStyle}
                    sortKey={pressSortState.key}
                    sortDirection={pressSortState.direction}
                    onSort={handlePressSort}
                  />
                )}
              </ChroniclePanel>
            );
          }
          return null;
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
            hasAnyTeamUpdates ? (
              <div className={styles.chronicleUpdatesList}>
                {trackedTeams.map((team) => {
                  const teamUpdates = updatesByTeam[team.teamId];
                  const changes = teamUpdates?.changes ?? [];
                  if (changes.length === 0) return null;
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
                {messages.clubChronicleUpdatesNoChangesGlobal}
              </p>
            )
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
                          selectedTeam
                        ) as string | number | null | undefined
                      )}
                    </span>
                    <span>
                      {formatValue(
                        column.getValue(
                          selectedTeam.leaguePerformance?.current,
                          selectedTeam
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
        open={pressDetailsOpen}
        title={messages.clubChroniclePressDetailsTitle}
        className={styles.chroniclePressModal}
        body={
          selectedPressTeam?.snapshot ? (
            <div className={styles.chroniclePressContent}>
              <h3 className={styles.chroniclePressTitle}>
                {selectedPressTeam.snapshot.subject
                  ? renderPressText(selectedPressTeam.snapshot.subject)
                  : messages.clubChroniclePressNone}
              </h3>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}: {selectedPressTeam.teamName}
              </p>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChroniclePressColumnPublishedAt}:{" "}
                {selectedPressTeam.snapshot.sendDate
                  ? formatChppDateTime(selectedPressTeam.snapshot.sendDate) ??
                    selectedPressTeam.snapshot.sendDate
                  : messages.unknownShort}
              </p>
              <div className={styles.chroniclePressBody}>
                {selectedPressTeam.snapshot.body
                  ? renderPressText(selectedPressTeam.snapshot.body)
                  : messages.clubChroniclePressNone}
              </div>
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.clubChroniclePressNone}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setPressDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setPressDetailsOpen(false)}
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
