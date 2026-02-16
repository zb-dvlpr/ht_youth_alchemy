"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { formatChppDateTime } from "@/lib/datetime";
import Tooltip from "./Tooltip";
import Modal from "./Modal";
import { useNotifications } from "./notifications/NotificationsProvider";
import {
  CLUB_CHRONICLE_DEBUG_EVENT,
  CLUB_CHRONICLE_SETTINGS_EVENT,
  CLUB_CHRONICLE_SETTINGS_STORAGE_KEY,
  DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS,
  DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT,
  readClubChronicleStalenessDays,
  readClubChronicleTransferHistoryCount,
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

type FinanceEstimateSnapshot = {
  totalBuysSek: number | null;
  totalSalesSek: number | null;
  numberOfBuys: number | null;
  numberOfSales: number | null;
  estimatedSek: number | null;
  estimatedEur: number | null;
  fetchedAt: number;
};

type FinanceEstimateData = {
  current: FinanceEstimateSnapshot;
  previous?: FinanceEstimateSnapshot;
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

type FinanceEstimateRow = {
  teamId: number;
  teamName: string;
  snapshot?: FinanceEstimateSnapshot | null;
};

type TransferListedPlayer = {
  playerId: number;
  playerName: string | null;
};

type TransferActivityEntry = {
  transferId: number | null;
  deadline: string | null;
  transferType: "B" | "S" | null;
  playerId: number | null;
  playerName: string | null;
  resolvedPlayerName?: string | null;
  priceSek: number | null;
};

type TransferActivitySnapshot = {
  transferListedCount: number;
  transferListedPlayers: TransferListedPlayer[];
  numberOfBuys: number | null;
  numberOfSales: number | null;
  latestTransfers: TransferActivityEntry[];
  fetchedAt: number;
};

type TransferActivityData = {
  current: TransferActivitySnapshot;
  previous?: TransferActivitySnapshot;
};

type TransferActivityRow = {
  teamId: number;
  teamName: string;
  snapshot?: TransferActivitySnapshot | null;
};

type FanclubSnapshot = {
  fanclubName: string | null;
  fanclubSize: number | null;
  fetchedAt: number;
};

type FanclubData = {
  current: FanclubSnapshot;
  previous?: FanclubSnapshot;
};

type FanclubRow = {
  teamId: number;
  teamName: string;
  snapshot?: FanclubSnapshot | null;
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
  fanclub?: FanclubData;
  financeEstimate?: FinanceEstimateData;
  transferActivity?: TransferActivityData;
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
type RawNode = Record<string, unknown>;
type UpdatePanel = "league" | "press" | "fanclub" | "finance" | "transfer";

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
  renderCell?: (
    snapshot: Snapshot | undefined,
    row: Row,
    formatValue: (value: string | number | null | undefined) => string
  ) => React.ReactNode;
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
  onRefresh?: () => void;
  panelId: string;
  onDragStart?: (event: React.DragEvent<HTMLSpanElement>, panelId: string) => void;
  onDragEnd?: () => void;
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
            <span key={`${rowKey}-${column.key}`} className={styles.chronicleTableCell}>
              {column.renderCell
                ? column.renderCell(snapshot, row, formatValue)
                : formatValue(column.getValue(snapshot, row))}
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
  onRefresh,
  panelId,
  onDragStart,
  onDragEnd,
  children,
}: ChroniclePanelProps) => (
  <div className={styles.chroniclePanel}>
    <div className={styles.chroniclePanelHeader}>
      <h3 className={styles.chroniclePanelTitle}>
        <span className={styles.chroniclePanelTitleRow}>
          <span
            className={styles.chroniclePanelDragHandle}
            draggable
            onDragStart={(event) => onDragStart?.(event, panelId)}
            onDragEnd={onDragEnd}
            aria-label={title}
          >
            ⋮⋮
          </span>
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
    </div>
    <div className={styles.chroniclePanelBody}>{children}</div>
  </div>
);

const STORAGE_KEY = "ya_club_chronicle_watchlist_v1";
const CACHE_KEY = "ya_cc_cache_v1";
const UPDATES_KEY = "ya_cc_updates_v1";
const PANEL_ORDER_KEY = "ya_cc_panel_order_v1";
const LAST_REFRESH_KEY = "ya_cc_last_refresh_ts_v1";
const PANEL_IDS = [
  "league-performance",
  "press-announcements",
  "fanclub",
  "finance-estimate",
  "transfer-market",
] as const;
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

const extractTeamDetailsNode = (
  payload: { data?: { HattrickData?: RawNode } } | null | undefined,
  teamId?: number
): RawNode | undefined => {
  const data = payload?.data?.HattrickData as RawNode | undefined;
  if (!data) return undefined;
  const direct = data.Team as RawNode | undefined;
  if (direct) return direct;
  const teamsContainer = data.Teams as RawNode | undefined;
  const teamsNode = teamsContainer?.Team;
  const teams = (Array.isArray(teamsNode)
    ? teamsNode
    : teamsNode
      ? [teamsNode]
      : []) as RawNode[];
  if (teams.length === 0) return undefined;
  if (teamId && Number.isFinite(teamId)) {
    const matched = teams.find((item) => Number(item.TeamID ?? 0) === teamId);
    if (matched) return matched;
  }
  const primary = teams.find((item) => String(item.IsPrimaryClub ?? "").toLowerCase() === "true");
  return primary ?? teams[0] ?? undefined;
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

const resolveFanclub = (
  team:
    | {
        Fanclub?: {
          FanclubName?: string;
          FanclubSize?: unknown;
        };
      }
    | undefined
): FanclubSnapshot | null => {
  const fanclub = team?.Fanclub;
  if (!fanclub) return null;
  const fanclubName = fanclub.FanclubName?.trim() ?? "";
  const rawSize =
    typeof fanclub.FanclubSize === "object" &&
    fanclub.FanclubSize !== null &&
    "#text" in (fanclub.FanclubSize as Record<string, unknown>)
      ? (fanclub.FanclubSize as Record<string, unknown>)["#text"]
      : fanclub.FanclubSize;
  const parsedSize =
    rawSize === null || rawSize === undefined || rawSize === ""
      ? null
      : Number(rawSize);
  const fanclubSize = Number.isFinite(parsedSize) ? parsedSize : null;
  if (!fanclubName && fanclubSize === null) return null;
  return {
    fanclubName: fanclubName || null,
    fanclubSize,
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
      fanclub: (() => {
        const fanclub = team.fanclub;
        if (!fanclub?.current) return fanclub;
        const currentAge = now - fanclub.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!fanclub.previous) return fanclub;
        const previousAge = now - fanclub.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...fanclub,
            previous: undefined,
          };
        }
        return fanclub;
      })(),
      financeEstimate: (() => {
        const financeEstimate = team.financeEstimate;
        if (!financeEstimate?.current) return financeEstimate;
        const currentAge = now - financeEstimate.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!financeEstimate.previous) return financeEstimate;
        const previousAge = now - financeEstimate.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...financeEstimate,
            previous: undefined,
          };
        }
        return financeEstimate;
      })(),
      transferActivity: (() => {
        const transferActivity = team.transferActivity;
        if (!transferActivity?.current) return transferActivity;
        const currentAge = now - transferActivity.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!transferActivity.previous) return transferActivity;
        const previousAge = now - transferActivity.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...transferActivity,
            previous: undefined,
          };
        }
        return transferActivity;
      })(),
    };
  });
  return { ...cache, teams: nextTeams };
};

const getLatestCacheTimestamp = (cache: ChronicleCache): number | null => {
  let latest = 0;
  Object.values(cache.teams).forEach((team) => {
    latest = Math.max(
      latest,
      team.leaguePerformance?.current?.fetchedAt ?? 0,
      team.leaguePerformance?.previous?.fetchedAt ?? 0,
      team.pressAnnouncement?.current?.fetchedAt ?? 0,
      team.pressAnnouncement?.previous?.fetchedAt ?? 0,
      team.fanclub?.current?.fetchedAt ?? 0,
      team.fanclub?.previous?.fetchedAt ?? 0,
      team.financeEstimate?.current?.fetchedAt ?? 0,
      team.financeEstimate?.previous?.fetchedAt ?? 0,
      team.transferActivity?.current?.fetchedAt ?? 0,
      team.transferActivity?.previous?.fetchedAt ?? 0
    );
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
  const [financeDetailsOpen, setFinanceDetailsOpen] = useState(false);
  const [selectedFinanceTeamId, setSelectedFinanceTeamId] = useState<number | null>(
    null
  );
  const [transferListedDetailsOpen, setTransferListedDetailsOpen] = useState(false);
  const [transferHistoryOpen, setTransferHistoryOpen] = useState(false);
  const [selectedTransferTeamId, setSelectedTransferTeamId] = useState<number | null>(
    null
  );
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
  const [transferHistoryCount, setTransferHistoryCount] = useState(
    DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT
  );
  const [leagueSortState, setLeagueSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [pressSortState, setPressSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [financeSortState, setFinanceSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [fanclubSortState, setFanclubSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [transferSortState, setTransferSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [refreshingGlobal, setRefreshingGlobal] = useState(false);
  const [refreshingLeague, setRefreshingLeague] = useState(false);
  const [refreshingPress, setRefreshingPress] = useState(false);
  const [refreshingFanclub, setRefreshingFanclub] = useState(false);
  const [refreshingFinance, setRefreshingFinance] = useState(false);
  const [refreshingTransfer, setRefreshingTransfer] = useState(false);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null);
  const [loadingTransferHistoryModal, setLoadingTransferHistoryModal] =
    useState(false);
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
  const anyRefreshing =
    refreshingGlobal ||
    refreshingLeague ||
    refreshingPress ||
    refreshingFanclub ||
    refreshingFinance ||
    refreshingTransfer;

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

  const openDummyUpdates = useCallback(() => {
    if (trackedTeams.length === 0) return;
    const dummyUpdates: ChronicleUpdates = {
      generatedAt: Date.now(),
      teams: Object.fromEntries(
        trackedTeams.map((team) => [
          team.teamId,
          {
            teamId: team.teamId,
            teamName: team.teamName ?? `${team.teamId}`,
            changes: [
              {
                fieldKey: "league.position",
                label: messages.clubChronicleColumnPosition,
                previous: "5",
                current: "4",
              },
              {
                fieldKey: "league.points",
                label: messages.clubChronicleColumnPoints,
                previous: "18",
                current: "21",
              },
              {
                fieldKey: "press.announcement",
                label: messages.clubChroniclePressColumnAnnouncement,
                previous: messages.clubChroniclePressNone,
                current: messages.clubChroniclePressArticleLabel,
              },
              {
                fieldKey: "fanclub.name",
                label: messages.clubChronicleFanclubColumnName,
                previous: `${team.teamName ?? team.teamId} A`,
                current: `${team.teamName ?? team.teamId} B`,
              },
              {
                fieldKey: "fanclub.size",
                label: messages.clubChronicleFanclubColumnSize,
                previous: "980",
                current: "1004",
              },
              {
                fieldKey: "finance.estimate",
                label: messages.clubChronicleFinanceColumnEstimate,
                previous: "€120,000*",
                current: "€95,000*",
              },
              {
                fieldKey: "transfer.listed",
                label: messages.clubChronicleTransferColumnActive,
                previous: "0",
                current: "1",
              },
              {
                fieldKey: "transfer.history",
                label: messages.clubChronicleTransferColumnHistory,
                previous: "2/1",
                current: "2/2",
              },
            ],
          },
        ])
      ),
    };
    setUpdates(dummyUpdates);
    setUpdatesOpen(true);
  }, [trackedTeams, messages]);

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
          | undefined;
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
          | undefined;
        if (!response.ok || payload?.error) return;
        const teamDetails = extractTeamDetailsNode(payload) as
          | {
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
            }
          | undefined;
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
    setTransferHistoryCount(readClubChronicleTransferHistoryCount());
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
        const detail = event.detail as
          | { stalenessDays?: number; transferHistoryCount?: number }
          | undefined;
        if (typeof detail?.stalenessDays === "number") {
          setStalenessDays(detail.stalenessDays);
        }
        if (typeof detail?.transferHistoryCount === "number") {
          setTransferHistoryCount(detail.transferHistoryCount);
        }
        if (
          typeof detail?.stalenessDays === "number" ||
          typeof detail?.transferHistoryCount === "number"
        ) {
          return;
        }
      }
      setStalenessDays(readClubChronicleStalenessDays());
      setTransferHistoryCount(readClubChronicleTransferHistoryCount());
    };
    window.addEventListener("storage", handle);
    window.addEventListener(CLUB_CHRONICLE_SETTINGS_EVENT, handle);
    return () => {
      window.removeEventListener("storage", handle);
      window.removeEventListener(CLUB_CHRONICLE_SETTINGS_EVENT, handle);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    const handleDebugUpdates = () => {
      openDummyUpdates();
    };
    window.addEventListener(CLUB_CHRONICLE_DEBUG_EVENT, handleDebugUpdates);
    return () => {
      window.removeEventListener(CLUB_CHRONICLE_DEBUG_EVENT, handleDebugUpdates);
    };
  }, [openDummyUpdates]);

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
        | undefined;
      const team = extractTeamDetailsNode(payload, parsed) as
        | {
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
          }
        | undefined;
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

  const handlePanelDragStart = (
    event: React.DragEvent<HTMLSpanElement>,
    panelId: string
  ) => {
    setDraggedPanelId(panelId);
    setDropTargetPanelId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", panelId);
  };

  const handlePanelDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    panelId: string
  ) => {
    event.preventDefault();
    if (!draggedPanelId || draggedPanelId === panelId) return;
    setDropTargetPanelId(panelId);
  };

  const handlePanelDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetPanelId: string
  ) => {
    event.preventDefault();
    const sourcePanelId =
      draggedPanelId || event.dataTransfer.getData("text/plain");
    if (!sourcePanelId || sourcePanelId === targetPanelId) {
      setDraggedPanelId(null);
      setDropTargetPanelId(null);
      return;
    }
    setPanelOrder((prev) => {
      const sourceIndex = prev.indexOf(sourcePanelId);
      const targetIndex = prev.indexOf(targetPanelId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      next.splice(adjustedTarget, 0, moved);
      return next;
    });
    setDraggedPanelId(null);
    setDropTargetPanelId(null);
  };

  const handlePanelDragEnd = () => {
    setDraggedPanelId(null);
    setDropTargetPanelId(null);
  };

  const handleOpenDetails = (teamId: number) => {
    setSelectedTeamId(teamId);
    setDetailsOpen(true);
  };

  const handleOpenPressDetails = (teamId: number) => {
    setSelectedPressTeamId(teamId);
    setPressDetailsOpen(true);
  };

  const handleOpenFinanceDetails = (teamId: number) => {
    setSelectedFinanceTeamId(teamId);
    setFinanceDetailsOpen(true);
  };

  const handleOpenTransferListedDetails = useCallback((teamId: number) => {
    setSelectedTransferTeamId(teamId);
    setTransferListedDetailsOpen(true);
  }, []);

  const handleOpenTransferHistory = useCallback((teamId: number) => {
    setSelectedTransferTeamId(teamId);
    setTransferHistoryOpen(true);
    void (async () => {
      setLoadingTransferHistoryModal(true);
      try {
        const latestTransfers = await fetchLatestTransfers(teamId, transferHistoryCount);
        setChronicleCache((prev) => {
          const teamCache = prev.teams[teamId];
          if (!teamCache) return prev;
          const current = teamCache.transferActivity?.current;
          if (!current) return prev;
          return {
            ...prev,
            teams: {
              ...prev.teams,
              [teamId]: {
                ...teamCache,
                transferActivity: {
                  current: {
                    ...current,
                    numberOfBuys: latestTransfers.numberOfBuys ?? current.numberOfBuys,
                    numberOfSales:
                      latestTransfers.numberOfSales ?? current.numberOfSales,
                    latestTransfers: latestTransfers.transfers,
                    fetchedAt: Date.now(),
                  },
                  previous: teamCache.transferActivity?.previous,
                },
              },
            },
          };
        });
      } finally {
        setLoadingTransferHistoryModal(false);
      }
    })();
  }, [transferHistoryCount]);

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

  const handleFinanceSort = (key: string) => {
    setFinanceSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleFanclubSort = (key: string) => {
    setFanclubSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleTransferSort = (key: string) => {
    setTransferSortState((prev) => ({
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

  const financeTableColumns = useMemo<
    ChronicleTableColumn<FinanceEstimateRow, FinanceEstimateSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "estimate",
        label: messages.clubChronicleFinanceColumnEstimate,
        getValue: (snapshot: FinanceEstimateSnapshot | undefined) =>
          snapshot ? `${formatEuro(snapshot.estimatedEur)}*` : null,
        getSortValue: (snapshot: FinanceEstimateSnapshot | undefined) =>
          snapshot?.estimatedSek ?? null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleFinanceColumnEstimate,
    ]
  );

  const fanclubTableColumns = useMemo<
    ChronicleTableColumn<FanclubRow, FanclubSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "fanclubName",
        label: messages.clubChronicleFanclubColumnName,
        getValue: (snapshot: FanclubSnapshot | undefined) =>
          snapshot?.fanclubName ?? null,
      },
      {
        key: "fanclubSize",
        label: messages.clubChronicleFanclubColumnSize,
        getValue: (snapshot: FanclubSnapshot | undefined) =>
          snapshot?.fanclubSize ?? null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleFanclubColumnName,
      messages.clubChronicleFanclubColumnSize,
    ]
  );

  const transferTableColumns = useMemo<
    ChronicleTableColumn<TransferActivityRow, TransferActivitySnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "activeListings",
        label: messages.clubChronicleTransferColumnActive,
        getValue: (snapshot: TransferActivitySnapshot | undefined) =>
          snapshot?.transferListedCount ?? 0,
        renderCell: (
          snapshot: TransferActivitySnapshot | undefined,
          row: TransferActivityRow
        ) => (
          <button
            type="button"
            className={styles.chronicleCellButton}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenTransferListedDetails(row.teamId);
            }}
          >
            {formatValue(snapshot?.transferListedCount ?? 0)}
          </button>
        ),
      },
      {
        key: "history",
        label: messages.clubChronicleTransferColumnHistory,
        getValue: (snapshot: TransferActivitySnapshot | undefined) =>
          `${formatValue(snapshot?.numberOfSales ?? 0)}/${formatValue(snapshot?.numberOfBuys ?? 0)}`,
        getSortValue: (snapshot: TransferActivitySnapshot | undefined) => [
          snapshot?.numberOfSales ?? 0,
          snapshot?.numberOfBuys ?? 0,
        ],
        renderCell: (
          snapshot: TransferActivitySnapshot | undefined,
          row: TransferActivityRow
        ) => (
          <button
            type="button"
            className={styles.chronicleCellButton}
            onClick={(event) => {
              event.stopPropagation();
              handleOpenTransferHistory(row.teamId);
            }}
          >
            {`${formatValue(snapshot?.numberOfSales ?? 0)}/${formatValue(snapshot?.numberOfBuys ?? 0)}`}
          </button>
        ),
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleTransferColumnActive,
      messages.clubChronicleTransferColumnHistory,
      handleOpenTransferListedDetails,
      handleOpenTransferHistory,
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

  const parseMoneySek = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const normalized = String(value).replace(/[^0-9-]/g, "");
    if (!normalized) return null;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
  };

  const formatEuro = (value: number | null | undefined) => {
    if (value === null || value === undefined) return messages.unknownShort;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const hashText = (input: string): string => {
    let hash = 5381;
    for (let index = 0; index < input.length; index += 1) {
      hash = (hash * 33) ^ input.charCodeAt(index);
    }
    return (hash >>> 0).toString(16);
  };

  const getPressFingerprint = (
    snapshot: PressAnnouncementSnapshot | undefined
  ): string | null => {
    if (!snapshot) return null;
    const normalized = [
      snapshot.subject ?? "",
      snapshot.body ?? "",
      snapshot.sendDate ?? "",
    ].join("|");
    if (!normalized.trim()) return null;
    return hashText(normalized);
  };

  const formatPressSummary = (
    snapshot: PressAnnouncementSnapshot | undefined
  ): string | null => {
    if (!snapshot) return null;
    const subject = (snapshot.subject ?? "").trim();
    const date = snapshot.sendDate
      ? formatChppDateTime(snapshot.sendDate) ?? snapshot.sendDate
      : "";
    if (subject && date) return `${date} · ${subject}`;
    if (subject) return subject;
    if (date) return date;
    return messages.clubChroniclePressNone;
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

  const appendTeamChanges = (
    updatesMap: ChronicleUpdates["teams"],
    teamId: number,
    teamName: string,
    additions: ChronicleUpdateField[]
  ) => {
    if (additions.length === 0) return;
    const existing = updatesMap[teamId];
    updatesMap[teamId] = {
      teamId,
      teamName,
      changes: [...(existing?.changes ?? []), ...additions],
    };
  };

  const collectTeamChanges = (
    nextCache: ChronicleCache,
    panels: UpdatePanel[]
  ): ChronicleUpdates => {
    const updatesMap: ChronicleUpdates["teams"] = {};
    trackedTeams.forEach((team) => {
      const teamId = team.teamId;
      const cached = nextCache.teams[teamId];
      if (!cached) return;
      const teamName = team.teamName ?? cached.teamName ?? `${teamId}`;
      const rowContext: LeagueTableRow = {
        teamId,
        teamName,
        snapshot: cached.leaguePerformance?.current,
        leaguePerformance: cached.leaguePerformance,
        meta: [cached.leagueName, cached.leagueLevelUnitName]
          .filter(Boolean)
          .join(" · "),
      };

      if (panels.includes("league")) {
        const previous = cached.leaguePerformance?.previous;
        const current = cached.leaguePerformance?.current;
        if (previous && current) {
          const changes = leagueTableColumns
            .filter((column) => column.key !== "team")
            .flatMap((column) => {
              const prevValue = column.getValue(previous, rowContext);
              const nextValue = column.getValue(current, rowContext);
              if (prevValue === nextValue) return [];
              return [
                {
                  fieldKey: `league.${column.key}`,
                  label: column.label,
                  previous: formatValue(prevValue),
                  current: formatValue(nextValue),
                },
              ];
            });
          appendTeamChanges(updatesMap, teamId, teamName, changes);
        }
      }

      if (panels.includes("press")) {
        const previous = cached.pressAnnouncement?.previous;
        const current = cached.pressAnnouncement?.current;
        if (current && previous) {
          const previousHash = getPressFingerprint(previous);
          const currentHash = getPressFingerprint(current);
          if (previousHash !== currentHash) {
            appendTeamChanges(updatesMap, teamId, teamName, [
              {
                fieldKey: "press.announcement",
                label: messages.clubChroniclePressColumnAnnouncement,
                previous: formatValue(formatPressSummary(previous)),
                current: formatValue(formatPressSummary(current)),
              },
            ]);
          }
        }
      }

      if (panels.includes("fanclub")) {
        const previous = cached.fanclub?.previous;
        const current = cached.fanclub?.current;
        if (current && previous) {
          const fanclubChanges: ChronicleUpdateField[] = [];
          if (previous.fanclubName !== current.fanclubName) {
            fanclubChanges.push({
              fieldKey: "fanclub.name",
              label: messages.clubChronicleFanclubColumnName,
              previous: formatValue(previous.fanclubName),
              current: formatValue(current.fanclubName),
            });
          }
          if (previous.fanclubSize !== current.fanclubSize) {
            fanclubChanges.push({
              fieldKey: "fanclub.size",
              label: messages.clubChronicleFanclubColumnSize,
              previous: formatValue(previous.fanclubSize),
              current: formatValue(current.fanclubSize),
            });
          }
          appendTeamChanges(updatesMap, teamId, teamName, fanclubChanges);
        }
      }

      if (panels.includes("finance")) {
        const previous = cached.financeEstimate?.previous;
        const current = cached.financeEstimate?.current;
        if (current && previous && previous.estimatedSek !== current.estimatedSek) {
          appendTeamChanges(updatesMap, teamId, teamName, [
            {
              fieldKey: "finance.estimate",
              label: messages.clubChronicleFinanceColumnEstimate,
              previous: `${formatEuro(previous.estimatedEur)}*`,
              current: `${formatEuro(current.estimatedEur)}*`,
            },
          ]);
        }
      }

      if (panels.includes("transfer")) {
        const previous = cached.transferActivity?.previous;
        const current = cached.transferActivity?.current;
        if (current && previous) {
          const transferChanges: ChronicleUpdateField[] = [];
          if (previous.transferListedCount !== current.transferListedCount) {
            transferChanges.push({
              fieldKey: "transfer.active",
              label: messages.clubChronicleTransferColumnActive,
              previous: formatValue(previous.transferListedCount),
              current: formatValue(current.transferListedCount),
            });
          }
          const previousSales = previous.numberOfSales ?? 0;
          const previousBuys = previous.numberOfBuys ?? 0;
          const currentSales = current.numberOfSales ?? 0;
          const currentBuys = current.numberOfBuys ?? 0;
          if (previousSales !== currentSales || previousBuys !== currentBuys) {
            transferChanges.push({
              fieldKey: "transfer.history",
              label: messages.clubChronicleTransferColumnHistory,
              previous: `${formatValue(previousSales)}/${formatValue(previousBuys)}`,
              current: `${formatValue(currentSales)}/${formatValue(currentBuys)}`,
            });
          }
          appendTeamChanges(updatesMap, teamId, teamName, transferChanges);
        }
      }
    });
    return {
      generatedAt: Date.now(),
      teams: updatesMap,
    };
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
                    Fanclub?: {
                      FanclubName?: string;
                      FanclubSize?: unknown;
                    };
                  };
                };
              };
              error?: string;
            }
          | undefined;
        const teamDetails = extractTeamDetailsNode(payload, team.teamId) as
          | {
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
              Fanclub?: {
                FanclubName?: string;
                FanclubSize?: unknown;
              };
            }
          | undefined;
        const meta = resolveTeamDetailsMeta(teamDetails);
        const pressSnapshot = resolvePressAnnouncement(teamDetails);
        const fanclubSnapshot = resolveFanclub(teamDetails);
        const nextTeamName = teamDetails?.TeamName ?? team.teamName ?? "";
        const previousPress = nextCache.teams[team.teamId]?.pressAnnouncement?.current;
        const previousFanclub = nextCache.teams[team.teamId]?.fanclub?.current;
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
          fanclub: fanclubSnapshot
            ? {
                current: fanclubSnapshot,
                previous: previousFanclub,
              }
            : nextCache.teams[team.teamId]?.fanclub,
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

  const refreshLeagueSnapshots = async (nextCache: ChronicleCache) => {
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
    });
  };

  const refreshFinanceSnapshots = async (nextCache: ChronicleCache) => {
    for (const team of trackedTeams) {
      try {
        const response = await fetch(
          `/api/chpp/transfersteam?teamId=${team.teamId}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              data?: {
                HattrickData?: {
                  Stats?: {
                    TotalSumOfBuys?: unknown;
                    TotalSumOfSales?: unknown;
                    NumberOfBuys?: unknown;
                    NumberOfSales?: unknown;
                  };
                };
              };
              error?: string;
            }
          | null;
        if (!response.ok || payload?.error) {
          continue;
        }
        const stats = payload?.data?.HattrickData?.Stats;
        const totalBuysSek = parseMoneySek(stats?.TotalSumOfBuys);
        const totalSalesSek = parseMoneySek(stats?.TotalSumOfSales);
        const numberOfBuys = parseNumber(stats?.NumberOfBuys);
        const numberOfSales = parseNumber(stats?.NumberOfSales);
        const estimatedSek =
          totalSalesSek !== null && totalBuysSek !== null
            ? totalSalesSek - totalBuysSek
            : null;
        const snapshot: FinanceEstimateSnapshot = {
          totalBuysSek,
          totalSalesSek,
          numberOfBuys,
          numberOfSales,
          estimatedSek,
          estimatedEur: estimatedSek !== null ? estimatedSek / 10 : null,
          fetchedAt: Date.now(),
        };
        const previous = nextCache.teams[team.teamId]?.financeEstimate?.current;
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
          financeEstimate: {
            current: snapshot,
            previous,
          },
        };
      } catch {
        // ignore finance failure
      }
    }
  };

  const parseBool = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    return normalized === "true" || normalized === "1";
  };

  const resolvePlayerNameById = async (
    playerId: number
  ): Promise<string | null> => {
    try {
      const response = await fetch(`/api/chpp/playerdetails?playerId=${playerId}`, {
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
      return name || null;
    } catch {
      return null;
    }
  };

  const fetchLatestTransfers = async (
    teamId: number,
    limit: number
  ): Promise<{
    totalBuysSek: number | null;
    totalSalesSek: number | null;
    numberOfBuys: number | null;
    numberOfSales: number | null;
    transfers: TransferActivityEntry[];
  }> => {
    const target = Math.max(1, limit);
    const transfers: TransferActivityEntry[] = [];
    let totalBuysSek: number | null = null;
    let totalSalesSek: number | null = null;
    let numberOfBuys: number | null = null;
    let numberOfSales: number | null = null;
    let pageIndex = 1;
    let totalPages = 1;

    while (pageIndex <= totalPages && transfers.length < target) {
      const response = await fetch(
        `/api/chpp/transfersteam?teamId=${teamId}&pageIndex=${pageIndex}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: {
              HattrickData?: {
                Stats?: {
                  TotalSumOfBuys?: unknown;
                  TotalSumOfSales?: unknown;
                  NumberOfBuys?: unknown;
                  NumberOfSales?: unknown;
                };
                Transfers?: {
                  Pages?: unknown;
                  Transfer?: unknown;
                };
              };
            };
            error?: string;
          }
        | null;
      if (!response.ok || payload?.error) {
        break;
      }
      const stats = payload?.data?.HattrickData?.Stats;
      totalBuysSek = parseMoneySek(stats?.TotalSumOfBuys);
      totalSalesSek = parseMoneySek(stats?.TotalSumOfSales);
      numberOfBuys = parseNumber(stats?.NumberOfBuys);
      numberOfSales = parseNumber(stats?.NumberOfSales);
      const transfersNode = payload?.data?.HattrickData?.Transfers;
      totalPages = parseNumber(transfersNode?.Pages) ?? 1;
      const raw = transfersNode?.Transfer;
      const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as RawNode[];
      list.forEach((entry) => {
        if (transfers.length >= target) return;
        const player = (entry?.Player ?? {}) as RawNode;
        const playerId = parseNumber(player?.PlayerID);
        const rawType = String(
          player?.TransferType ?? entry?.TransferType ?? ""
        )
          .trim()
          .toUpperCase();
        const sellerTeamId = parseNumber(
          (entry?.Seller as RawNode | undefined)?.SellerTeamID
        );
        const buyerTeamId = parseNumber(
          (entry?.Buyer as RawNode | undefined)?.BuyerTeamID
        );
        const resolvedType: "B" | "S" | null =
          rawType === "B" || rawType === "S"
            ? rawType
            : sellerTeamId === teamId
              ? "S"
              : buyerTeamId === teamId
                ? "B"
                : null;
        transfers.push({
          transferId: parseNumber(entry?.TransferID),
          deadline: (entry?.Deadline as string | undefined) ?? null,
          transferType: resolvedType,
          playerId,
          playerName: (player?.PlayerName as string | undefined) ?? null,
          priceSek: parseMoneySek(entry?.Price),
        });
      });
      pageIndex += 1;
    }

    const resolutions = await Promise.all(
      transfers.map(async (entry) => {
        if (!entry.playerId || entry.playerId <= 0) return null;
        const resolved = await resolvePlayerNameById(entry.playerId);
        return { playerId: entry.playerId, resolved };
      })
    );
    const resolvedById = new Map<number, string>();
    resolutions.forEach((item) => {
      if (!item?.resolved) return;
      resolvedById.set(item.playerId, item.resolved);
    });

    return {
      totalBuysSek,
      totalSalesSek,
      numberOfBuys,
      numberOfSales,
      transfers: transfers.map((entry) => ({
        ...entry,
        resolvedPlayerName:
          entry.playerId && resolvedById.has(entry.playerId)
            ? resolvedById.get(entry.playerId) ?? null
            : null,
      })),
    };
  };

  const fetchTransferListedPlayers = async (
    teamId: number
  ): Promise<{ playerId: number; playerName: string | null }[]> => {
    const playersResponse = await fetch(`/api/chpp/players?teamId=${teamId}`, {
      cache: "no-store",
    });
    const playersPayload = (await playersResponse.json().catch(() => null)) as
      | {
          data?: {
            HattrickData?: {
              Team?: {
                PlayerList?: {
                  Player?: unknown;
                };
              };
            };
          };
          error?: string;
        }
      | null;
    if (!playersResponse.ok || playersPayload?.error) {
      return [];
    }
    const rawPlayers = playersPayload?.data?.HattrickData?.Team?.PlayerList?.Player;
    const playerList = (Array.isArray(rawPlayers)
      ? rawPlayers
      : rawPlayers
        ? [rawPlayers]
        : []) as RawNode[];
    return playerList
      .filter((player) => parseBool(player?.TransferListed))
      .map((player) => {
        const playerId = parseNumber(player?.PlayerID);
        const playerName = [player?.FirstName, player?.NickName, player?.LastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        return {
          playerId: playerId ?? 0,
          playerName: playerName || null,
        };
      })
      .filter((player) => player.playerId > 0);
  };

  const refreshTransferSnapshots = async (
    nextCache: ChronicleCache,
    historyCount: number
  ) => {
    for (const team of trackedTeams) {
      try {
        const transferListedPlayers = await fetchTransferListedPlayers(team.teamId);
        const latestTransfers = await fetchLatestTransfers(team.teamId, historyCount);
        const snapshot: TransferActivitySnapshot = {
          transferListedCount: transferListedPlayers.length,
          transferListedPlayers,
          numberOfBuys: latestTransfers.numberOfBuys,
          numberOfSales: latestTransfers.numberOfSales,
          latestTransfers: latestTransfers.transfers,
          fetchedAt: Date.now(),
        };

        const previous = nextCache.teams[team.teamId]?.transferActivity?.current;
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
          transferActivity: {
            current: snapshot,
            previous,
          },
        };
      } catch {
        // ignore transfer activity failures
      }
    }
  };

  const refreshFinanceAndTransferSnapshots = async (
    nextCache: ChronicleCache,
    historyCount: number
  ) => {
    for (const team of trackedTeams) {
      try {
        const [transferListedPlayers, latestTransfers] = await Promise.all([
          fetchTransferListedPlayers(team.teamId),
          fetchLatestTransfers(team.teamId, historyCount),
        ]);
        const estimatedSek =
          latestTransfers.totalSalesSek !== null &&
          latestTransfers.totalBuysSek !== null
            ? latestTransfers.totalSalesSek - latestTransfers.totalBuysSek
            : null;
        const financeSnapshot: FinanceEstimateSnapshot = {
          totalBuysSek: latestTransfers.totalBuysSek,
          totalSalesSek: latestTransfers.totalSalesSek,
          numberOfBuys: latestTransfers.numberOfBuys,
          numberOfSales: latestTransfers.numberOfSales,
          estimatedSek,
          estimatedEur: estimatedSek !== null ? estimatedSek / 10 : null,
          fetchedAt: Date.now(),
        };
        const previousFinance = nextCache.teams[team.teamId]?.financeEstimate?.current;
        const transferSnapshot: TransferActivitySnapshot = {
          transferListedCount: transferListedPlayers.length,
          transferListedPlayers,
          numberOfBuys: latestTransfers.numberOfBuys,
          numberOfSales: latestTransfers.numberOfSales,
          latestTransfers: latestTransfers.transfers,
          fetchedAt: Date.now(),
        };
        const previousTransfer = nextCache.teams[team.teamId]?.transferActivity?.current;
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
          financeEstimate: {
            current: financeSnapshot,
            previous: previousFinance,
          },
          transferActivity: {
            current: transferSnapshot,
            previous: previousTransfer,
          },
        };
      } catch {
        // ignore combined transfer/finance failures
      }
    }
  };

  const refreshAllData = async (reason: "stale" | "manual") => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshingGlobal(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: true });
    await refreshLeagueSnapshots(nextCache);
    await refreshFinanceAndTransferSnapshots(nextCache, transferHistoryCount);
    const nextUpdates = collectTeamChanges(nextCache, [
      "league",
      "press",
      "fanclub",
      "finance",
      "transfer",
    ]);

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
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
    await refreshLeagueSnapshots(nextCache);
    const nextUpdates = collectTeamChanges(nextCache, ["league"]);

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
    const nextUpdates = collectTeamChanges(nextCache, ["press"]);
    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setUpdates(nextUpdates);
    const hasUpdates = Object.values(nextUpdates.teams).some(
      (teamUpdate) => teamUpdate.changes.length > 0
    );
    setUpdatesOpen(hasUpdates);
    setRefreshingPress(false);
    addNotification(messages.notificationChronicleRefreshComplete);
  };

  const refreshFinanceOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshingFinance(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
    await refreshFinanceSnapshots(nextCache);
    const nextUpdates = collectTeamChanges(nextCache, ["finance"]);
    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setUpdates(nextUpdates);
    const hasUpdates = Object.values(nextUpdates.teams).some(
      (teamUpdate) => teamUpdate.changes.length > 0
    );
    setUpdatesOpen(hasUpdates);
    setRefreshingFinance(false);
    addNotification(messages.notificationChronicleRefreshComplete);
  };

  const refreshFanclubOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshingFanclub(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
    const nextUpdates = collectTeamChanges(nextCache, ["fanclub"]);
    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setUpdates(nextUpdates);
    const hasUpdates = Object.values(nextUpdates.teams).some(
      (teamUpdate) => teamUpdate.changes.length > 0
    );
    setUpdatesOpen(hasUpdates);
    setRefreshingFanclub(false);
    addNotification(messages.notificationChronicleRefreshComplete);
  };

  const refreshTransferOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    setRefreshingTransfer(true);
    const nextCache = pruneChronicleCache(readChronicleCache());
    const nextManualTeams = [...manualTeams];
    await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
    await refreshTransferSnapshots(nextCache, transferHistoryCount);
    const nextUpdates = collectTeamChanges(nextCache, ["transfer"]);
    setManualTeams(nextManualTeams);
    setChronicleCache(nextCache);
    setUpdates(nextUpdates);
    const hasUpdates = Object.values(nextUpdates.teams).some(
      (teamUpdate) => teamUpdate.changes.length > 0
    );
    setUpdatesOpen(hasUpdates);
    setRefreshingTransfer(false);
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

  const financeRows: FinanceEstimateRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.financeEstimate?.current,
    };
  });

  const fanclubRows: FanclubRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.fanclub?.current,
    };
  });

  const transferRows: TransferActivityRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.transferActivity?.current,
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

  const sortedFinanceRows = useMemo(() => {
    if (!financeSortState.key) return financeRows;
    const column = financeTableColumns.find(
      (item) => item.key === financeSortState.key
    );
    if (!column) return financeRows;
    const direction = financeSortState.direction === "desc" ? -1 : 1;
    return [...financeRows]
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
  }, [financeRows, financeTableColumns, financeSortState]);

  const sortedFanclubRows = useMemo(() => {
    if (!fanclubSortState.key) return fanclubRows;
    const column = fanclubTableColumns.find(
      (item) => item.key === fanclubSortState.key
    );
    if (!column) return fanclubRows;
    const direction = fanclubSortState.direction === "desc" ? -1 : 1;
    return [...fanclubRows]
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
  }, [fanclubRows, fanclubTableColumns, fanclubSortState]);

  const sortedTransferRows = useMemo(() => {
    if (!transferSortState.key) return transferRows;
    const column = transferTableColumns.find(
      (item) => item.key === transferSortState.key
    );
    if (!column) return transferRows;
    const direction = transferSortState.direction === "desc" ? -1 : 1;
    return [...transferRows]
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
  }, [transferRows, transferTableColumns, transferSortState]);

  const selectedTeam = selectedTeamId
    ? leagueRows.find((team) => team.teamId === selectedTeamId) ?? null
    : null;
  const selectedPressTeam = selectedPressTeamId
    ? pressRows.find((team) => team.teamId === selectedPressTeamId) ?? null
    : null;
  const selectedFinanceTeam = selectedFinanceTeamId
    ? financeRows.find((team) => team.teamId === selectedFinanceTeamId) ?? null
    : null;
  const selectedTransferTeam = selectedTransferTeamId
    ? transferRows.find((team) => team.teamId === selectedTransferTeamId) ?? null
    : null;
  const transferListedRows = useMemo(
    () => selectedTransferTeam?.snapshot?.transferListedPlayers ?? [],
    [selectedTransferTeam]
  );
  const transferHistoryRows = useMemo(
    () => selectedTransferTeam?.snapshot?.latestTransfers ?? [],
    [selectedTransferTeam]
  );

  const transferListedColumns = useMemo<
    ChronicleTableColumn<TransferListedPlayer, TransferListedPlayer>[]
  >(
    () => [
      {
        key: "player",
        label: messages.clubChronicleTransferListedPlayerColumn,
        getValue: (snapshot) => snapshot?.playerName ?? null,
        renderCell: (snapshot) => {
          const playerId = snapshot?.playerId ?? 0;
          const playerName = snapshot?.playerName ?? `${playerId}`;
          if (!playerId) return playerName;
          return (
            <a
              className={styles.chroniclePressLink}
              href={`${HT_BASE_URL}/Club/Players/Player.aspx?playerId=${playerId}`}
              target="_blank"
              rel="noreferrer"
            >
              {playerName}
            </a>
          );
        },
      },
    ],
    [messages.clubChronicleTransferListedPlayerColumn]
  );

  const transferHistoryColumns = useMemo<
    ChronicleTableColumn<TransferActivityEntry, TransferActivityEntry>[]
  >(
    () => [
      {
        key: "date",
        label: messages.clubChronicleTransferHistoryDateColumn,
        getValue: (snapshot) =>
          snapshot?.deadline
            ? formatChppDateTime(snapshot.deadline) ?? snapshot.deadline
            : null,
      },
      {
        key: "type",
        label: messages.clubChronicleTransferHistoryTypeColumn,
        getValue: (snapshot) =>
          snapshot?.transferType === "S"
            ? messages.clubChronicleTransferTypeSale
            : snapshot?.transferType === "B"
              ? messages.clubChronicleTransferTypeBuy
              : null,
      },
      {
        key: "player",
        label: messages.clubChronicleTransferHistoryPlayerColumn,
        getValue: (snapshot) =>
          snapshot?.resolvedPlayerName ?? snapshot?.playerName ?? null,
        renderCell: (snapshot, _row, fallbackFormat) => {
          const playerId = snapshot?.playerId ?? 0;
          if (!playerId || !snapshot?.resolvedPlayerName) {
            return fallbackFormat(snapshot?.playerName);
          }
          return (
            <a
              className={styles.chroniclePressLink}
              href={`${HT_BASE_URL}/Club/Players/Player.aspx?playerId=${playerId}`}
              target="_blank"
              rel="noreferrer"
            >
              {snapshot.resolvedPlayerName}
            </a>
          );
        },
      },
      {
        key: "price",
        label: messages.clubChronicleTransferHistoryPriceColumn,
        getValue: (snapshot) =>
          snapshot?.priceSek !== null && snapshot?.priceSek !== undefined
            ? formatEuro(snapshot.priceSek / 10)
            : null,
      },
    ],
    [
      messages.clubChronicleTransferHistoryDateColumn,
      messages.clubChronicleTransferHistoryTypeColumn,
      messages.clubChronicleTransferTypeSale,
      messages.clubChronicleTransferTypeBuy,
      messages.clubChronicleTransferHistoryPlayerColumn,
      messages.clubChronicleTransferHistoryPriceColumn,
    ]
  );

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
              | undefined;
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
            const teamNode = extractTeamDetailsNode(payload, id) as
              | { TeamName?: string }
              | null;
            const name = teamNode?.TeamName?.trim();
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

  const financeTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": financeTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(140px, 1fr)",
      }) as CSSProperties,
    [financeTableColumns.length]
  );

  const fanclubTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": fanclubTableColumns.length,
        "--cc-template": "minmax(170px, 1.4fr) minmax(160px, 1.2fr) minmax(100px, 0.8fr)",
      }) as CSSProperties,
    [fanclubTableColumns.length]
  );

  const transferTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": transferTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(90px, 0.7fr) minmax(130px, 0.9fr)",
      }) as CSSProperties,
    [transferTableColumns.length]
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
          if (panelId === "league-performance") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleLeaguePanelTitle}
                  refreshing={refreshingGlobal || refreshingLeague}
                  refreshLabel={messages.clubChronicleRefreshTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshLeagueOnly()}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
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
              </div>
            );
          }
          if (panelId === "press-announcements") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChroniclePressPanelTitle}
                  refreshing={refreshingGlobal || refreshingPress}
                  refreshLabel={messages.clubChronicleRefreshPressTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshPressOnly()}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
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
              </div>
            );
          }
          if (panelId === "finance-estimate") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleFinancePanelTitle}
                  refreshing={refreshingGlobal || refreshingFinance}
                  refreshLabel={messages.clubChronicleRefreshFinanceTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshFinanceOnly()}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingFinance) &&
                    financeRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <>
                      <ChronicleTable
                        columns={financeTableColumns}
                        rows={sortedFinanceRows}
                        getRowKey={(row) => row.teamId}
                        getSnapshot={(row) => row.snapshot ?? undefined}
                        onRowClick={(row) => handleOpenFinanceDetails(row.teamId)}
                        formatValue={formatValue}
                        style={financeTableStyle}
                        sortKey={financeSortState.key}
                        sortDirection={financeSortState.direction}
                        onSort={handleFinanceSort}
                      />
                      <p className={styles.chronicleFinanceDisclaimer}>
                        {messages.clubChronicleFinanceDisclaimer}
                      </p>
                    </>
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "fanclub") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleFanclubPanelTitle}
                  refreshing={refreshingGlobal || refreshingFanclub}
                  refreshLabel={messages.clubChronicleRefreshTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshFanclubOnly()}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingFanclub) &&
                    fanclubRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={fanclubTableColumns}
                      rows={sortedFanclubRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      formatValue={formatValue}
                      style={fanclubTableStyle}
                      sortKey={fanclubSortState.key}
                      sortDirection={fanclubSortState.direction}
                      onSort={handleFanclubSort}
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "transfer-market") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleTransferPanelTitle}
                  refreshing={refreshingGlobal || refreshingTransfer}
                  refreshLabel={messages.clubChronicleRefreshTransferTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshTransferOnly()}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingTransfer) &&
                    transferRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={transferTableColumns}
                      rows={sortedTransferRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      formatValue={formatValue}
                      style={transferTableStyle}
                      sortKey={transferSortState.key}
                      sortDirection={transferSortState.direction}
                      onSort={handleTransferSort}
                    />
                  )}
                </ChroniclePanel>
              </div>
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
        className={styles.chronicleUpdatesModal}
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
        open={financeDetailsOpen}
        title={messages.clubChronicleFinancePanelTitle}
        body={
          selectedFinanceTeam?.snapshot ? (
            <div className={styles.chronicleDetailsGrid}>
              <h3 className={styles.chronicleDetailsSectionTitle}>
                {selectedFinanceTeam.teamName}
              </h3>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleFinanceColumnBuys}
                </span>
                <span />
                <span>
                  {formatEuro(
                    selectedFinanceTeam.snapshot.totalBuysSek !== null
                      ? selectedFinanceTeam.snapshot.totalBuysSek / 10
                      : null
                  )}
                </span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleFinanceColumnSales}
                </span>
                <span />
                <span>
                  {formatEuro(
                    selectedFinanceTeam.snapshot.totalSalesSek !== null
                      ? selectedFinanceTeam.snapshot.totalSalesSek / 10
                      : null
                  )}
                </span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleFinanceColumnEstimate}
                </span>
                <span />
                <span>{`${formatEuro(selectedFinanceTeam.snapshot.estimatedEur)}*`}</span>
              </div>
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setFinanceDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setFinanceDetailsOpen(false)}
      />

      <Modal
        open={transferListedDetailsOpen}
        title={messages.clubChronicleTransferListedModalTitle}
        body={
          selectedTransferTeam ? (
            <>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}: {selectedTransferTeam.teamName}
              </p>
              {transferListedRows.length > 0 ? (
                <ChronicleTable
                  columns={transferListedColumns}
                  rows={transferListedRows}
                  getRowKey={(row) => row.playerId}
                  getSnapshot={(row) => row}
                  formatValue={formatValue}
                  style={
                    {
                      "--cc-columns": transferListedColumns.length,
                      "--cc-template": "minmax(240px, 1fr)",
                    } as CSSProperties
                  }
                />
              ) : (
                <p className={styles.chronicleEmpty}>
                  {messages.clubChronicleTransferListedEmpty}
                </p>
              )}
            </>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setTransferListedDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setTransferListedDetailsOpen(false)}
      />

      <Modal
        open={transferHistoryOpen}
        title={messages.clubChronicleTransferHistoryModalTitle}
        className={styles.chronicleTransferHistoryModal}
        body={
          selectedTransferTeam ? (
            <>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}: {selectedTransferTeam.teamName}
              </p>
              {loadingTransferHistoryModal ? (
                <p className={styles.chronicleEmpty}>{messages.clubChronicleLoading}</p>
              ) : transferHistoryRows.length > 0 ? (
                <div className={styles.chronicleTransferHistoryTableWrap}>
                  <ChronicleTable
                    columns={transferHistoryColumns}
                    rows={transferHistoryRows}
                    getRowKey={(row) =>
                      `${row.transferId ?? "unknown"}-${row.playerId ?? "0"}-${row.deadline ?? "na"}`
                    }
                    getSnapshot={(row) => row}
                    formatValue={formatValue}
                    style={
                      {
                        "--cc-columns": transferHistoryColumns.length,
                        "--cc-template":
                          "minmax(150px, 1fr) minmax(90px, 0.6fr) minmax(260px, 1.8fr) minmax(130px, 0.8fr)",
                      } as CSSProperties
                    }
                  />
                </div>
              ) : (
                <p className={styles.chronicleEmpty}>
                  {messages.clubChronicleTransferHistoryEmpty}
                </p>
              )}
            </>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setTransferHistoryOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setTransferHistoryOpen(false)}
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
