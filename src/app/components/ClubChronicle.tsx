"use client";
/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-unused-vars, jsx-a11y/role-supports-aria-props */

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
import { formatChppDateTime, formatDateTime } from "@/lib/datetime";
import { parseChppDate } from "@/lib/chpp/utils";
import Tooltip from "./Tooltip";
import Modal from "./Modal";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useNotifications } from "./notifications/NotificationsProvider";
import {
  CLUB_CHRONICLE_DEBUG_EVENT,
  CLUB_CHRONICLE_SETTINGS_EVENT,
  CLUB_CHRONICLE_SETTINGS_STORAGE_KEY,
  DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT,
  DEFAULT_CLUB_CHRONICLE_STALENESS_DAYS,
  DEFAULT_CLUB_CHRONICLE_TRANSFER_HISTORY_COUNT,
  readClubChronicleStalenessDays,
  readClubChronicleTransferHistoryCount,
  readClubChronicleUpdatesHistoryCount,
} from "@/lib/settings";
import {
  hattrickArticleUrl,
  hattrickMatchUrl,
  hattrickPlayerUrl,
  hattrickSeriesUrl,
  hattrickTeamUrl,
  hattrickTeamPlayersUrl,
  hattrickTeamTransfersUrl,
} from "@/lib/hattrick/urls";
import { ChppAuthRequiredError, fetchChppJson } from "@/lib/chpp/client";

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

const isChppAuthRequiredError = (error: unknown): error is ChppAuthRequiredError =>
  error instanceof ChppAuthRequiredError;

const getReadableErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || fallback;
  }
  if (typeof error === "string") {
    const message = error.trim();
    return message || fallback;
  }
  return fallback;
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
  age: number | null;
  ageDays: number | null;
  tsi: number | null;
  askingPriceSek: number | null;
};

type TransferActivityEntry = {
  transferId: number | null;
  deadline: string | null;
  transferType: "B" | "S" | null;
  playerId: number | null;
  playerName: string | null;
  resolvedPlayerName?: string | null;
  age: number | null;
  ageDays: number | null;
  tsi: number | null;
  priceSek: number | null;
};

type TransferUpdatePlayer = {
  playerId: number | null;
  playerName: string | null;
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

type TsiSnapshot = {
  totalTsi: number;
  top11Tsi: number;
  players: {
    playerId: number;
    playerName: string | null;
    playerNumber: number | null;
    age: number | null;
    ageDays: number | null;
    injuryLevel: number | null;
    tsi: number;
  }[];
  fetchedAt: number;
};

type TsiData = {
  current: TsiSnapshot;
  previous?: TsiSnapshot;
};

type TsiRow = {
  teamId: number;
  teamName: string;
  snapshot?: TsiSnapshot | null;
};

type TsiPlayerRow = {
  teamId: number;
  playerId: number;
  playerName: string | null;
  playerNumber: number | null;
  age: number | null;
  ageDays: number | null;
  injuryLevel: number | null;
  tsi: number;
};

type WagesSnapshot = {
  totalWagesSek: number;
  top11WagesSek: number;
  players: {
    playerId: number;
    playerName: string | null;
    playerNumber: number | null;
    age: number | null;
    ageDays: number | null;
    injuryLevel: number | null;
    salarySek: number;
  }[];
  fetchedAt: number;
};

type WagesData = {
  current: WagesSnapshot;
  previous?: WagesSnapshot;
};

type WagesRow = {
  teamId: number;
  teamName: string;
  snapshot?: WagesSnapshot | null;
};

type FormationTacticsDistribution = {
  key: string;
  label: string;
  count: number;
};

type FormationTacticsAnalyzedMatch = {
  matchId: number;
  matchType: number | null;
};

type LikelyTrainingKey =
  | "winger"
  | "playmaking"
  | "defending"
  | "passing"
  | "scoring"
  | "keepingOrSetPieces";

type FormationTacticsSnapshot = {
  topFormation: string | null;
  topTactic: string | null;
  likelyTrainingKey: LikelyTrainingKey | null;
  likelyTrainingTopKeys: LikelyTrainingKey[];
  likelyTrainingIsUnclear: boolean;
  likelyTrainingConfidencePct: number | null;
  likelyTrainingScores: { key: LikelyTrainingKey; confidencePct: number }[];
  formationDistribution: FormationTacticsDistribution[];
  tacticDistribution: FormationTacticsDistribution[];
  analyzedMatches: FormationTacticsAnalyzedMatch[];
  sampleSize: number;
  fetchedAt: number;
};

type FormationTacticsData = {
  current: FormationTacticsSnapshot;
  previous?: FormationTacticsSnapshot;
};

type FormationTacticsRow = {
  teamId: number;
  teamName: string;
  snapshot?: FormationTacticsSnapshot | null;
};

type LikelyTrainingRow = {
  teamId: number;
  teamName: string;
  snapshot?: FormationTacticsSnapshot | null;
};

type LastLoginEvent = {
  dateTime: string | null;
  ipAddress: string | null;
  raw: string;
};

type LastLoginSnapshot = {
  latestLoginDateTime: string | null;
  loginEvents: LastLoginEvent[];
  fetchedAt: number;
};

type LastLoginData = {
  current: LastLoginSnapshot;
  previous?: LastLoginSnapshot;
};

type LastLoginRow = {
  teamId: number;
  teamName: string;
  snapshot?: LastLoginSnapshot | null;
};

type CoachSnapshot = {
  trainerId: number | null;
  name: string | null;
  age: number | null;
  ageDays: number | null;
  contractDate: string | null;
  costSek: number | null;
  countryId: number | null;
  countryName: string | null;
  trainerType: number | null;
  leadership: number | null;
  trainerSkillLevel: number | null;
  trainerStatus: number | null;
  fetchedAt: number;
};

type CoachData = {
  current: CoachSnapshot;
  previous?: CoachSnapshot;
};

type CoachRow = {
  teamId: number;
  teamName: string;
  snapshot?: CoachSnapshot | null;
};

type WagesPlayerRow = {
  teamId: number;
  playerId: number;
  playerName: string | null;
  playerNumber: number | null;
  age: number | null;
  ageDays: number | null;
  injuryLevel: number | null;
  salarySek: number;
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
  fanclub?: FanclubData;
};

type FanclubDetailsSnapshot = {
  previousDate: number | null;
  previousSize: number | null;
  currentDate: number | null;
  currentSize: number | null;
  sizeDiff: number | null;
};

type ArenaSnapshot = {
  arenaName: string | null;
  currentTotalCapacity: number | null;
  rebuiltDate: string | null;
  currentAvailable: boolean | null;
  terraces: number | null;
  basic: number | null;
  roof: number | null;
  vip: number | null;
  expandedAvailable: boolean | null;
  expandedTotalCapacity: number | null;
  expansionDate: string | null;
  expandedTerraces: number | null;
  expandedBasic: number | null;
  expandedRoof: number | null;
  expandedVip: number | null;
  fetchedAt: number;
};

type ArenaData = {
  current: ArenaSnapshot;
  previous?: ArenaSnapshot;
};

type ArenaRow = {
  teamId: number;
  teamName: string;
  snapshot?: ArenaSnapshot | null;
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
  arenaId?: number | null;
  arenaName?: string | null;
  leaguePerformance?: LeaguePerformanceData;
  pressAnnouncement?: PressAnnouncementData;
  fanclub?: FanclubData;
  arena?: ArenaData;
  financeEstimate?: FinanceEstimateData;
  transferActivity?: TransferActivityData;
  tsi?: TsiData;
  wages?: WagesData;
  formationsTactics?: FormationTacticsData;
  lastLogin?: LastLoginData;
  coach?: CoachData;
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

type ChronicleGlobalUpdateEntry = {
  id: string;
  comparedAt: number;
  hasChanges: boolean;
  updates: ChronicleUpdates | null;
};

type SortValue = string | number | null | SortValue[];
type RawNode = Record<string, unknown>;
type UpdatePanel =
  | "league"
  | "press"
  | "fanclub"
  | "arena"
  | "finance"
  | "transfer"
  | "tsi"
  | "wages"
  | "formationsTactics"
  | "likelyTraining"
  | "lastLogin"
  | "coach";

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
  className?: string;
  getRowClassName?: (row: Row) => string | undefined;
  onRowClick?: (row: Row) => void;
  formatValue: (value: string | number | null | undefined) => string;
  style?: CSSProperties;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  maskedTeamId?: number | null;
  maskText?: string;
  isMaskActive?: boolean;
  onMaskedRowClick?: (row: Row) => void;
};

type ChroniclePanelProps = {
  title: string;
  headerAccessory?: React.ReactNode;
  refreshing?: boolean;
  progressPct?: number;
  refreshLabel: string;
  onRefresh?: () => void;
  panelId: string;
  onDragStart?: (event: React.DragEvent<HTMLElement>, panelId: string) => void;
  onDragEnd?: () => void;
  onPointerDown?: (panelId: string) => void;
  children: React.ReactNode;
};

const ChronicleTable = <Row, Snapshot>({
  columns,
  rows,
  getRowKey,
  getSnapshot,
  className,
  getRowClassName,
  onRowClick,
  formatValue,
  style,
  sortKey,
  sortDirection,
  onSort,
  maskedTeamId = null,
  maskText,
  isMaskActive = false,
  onMaskedRowClick,
}: ChronicleTableProps<Row, Snapshot>) => (
  <div
    className={`${styles.chronicleTable}${className ? ` ${className}` : ""}`}
    style={style}
  >
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
      const rowClassName = getRowClassName?.(row);
      const rowTeamId = (row as { teamId?: number }).teamId;
      const isMaskedRow =
        isMaskActive &&
        maskedTeamId !== null &&
        rowTeamId === maskedTeamId &&
        Boolean(maskText);
      return (
        <div
          key={rowKey}
          className={`${styles.chronicleTableRow}${rowClassName ? ` ${rowClassName}` : ""}${isMaskedRow ? ` ${styles.chronicleTableRowMasked}` : ""}`}
          role={onRowClick || isMaskedRow ? "button" : undefined}
          tabIndex={onRowClick || isMaskedRow ? 0 : undefined}
          onClick={
            isMaskedRow
              ? () => onMaskedRowClick?.(row)
              : onRowClick
                ? () => onRowClick(row)
                : undefined
          }
          onKeyDown={
            onRowClick || isMaskedRow
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (isMaskedRow) {
                      onMaskedRowClick?.(row);
                    } else {
                      onRowClick?.(row);
                    }
                  }
                }
              : undefined
          }
        >
          {isMaskedRow ? (
            <span
              className={`${styles.chronicleTableCell} ${styles.chronicleTableCellMaskedLead}`}
            >
              {maskText}
            </span>
          ) : (
            columns.map((column) => (
              <span key={`${rowKey}-${column.key}`} className={styles.chronicleTableCell}>
                {column.renderCell
                  ? column.renderCell(snapshot, row, formatValue)
                  : formatValue(column.getValue(snapshot, row))}
              </span>
            ))
          )}
        </div>
      );
    })}
  </div>
);

const ChroniclePanel = ({
  title,
  headerAccessory,
  refreshing,
  progressPct = 0,
  refreshLabel,
  onRefresh,
  panelId,
  onDragStart,
  onDragEnd,
  onPointerDown,
  children,
}: ChroniclePanelProps) => (
  <div className={styles.chroniclePanel}>
    <div
      className={styles.chroniclePanelHeader}
      draggable
      onPointerDown={() => onPointerDown?.(panelId)}
      onDragStart={(event) => onDragStart?.(event, panelId)}
      onDragEnd={onDragEnd}
    >
      <h3 className={styles.chroniclePanelTitle}>
        <span className={styles.chroniclePanelTitleRow}>
          <span className={styles.chroniclePanelTitleMain}>
            <span
              className={styles.chroniclePanelDragHandle}
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
                  draggable={false}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDragStart={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={onRefresh}
                  disabled={Boolean(refreshing)}
                  aria-label={refreshLabel}
                >
                  ↻
                </button>
              </Tooltip>
            ) : null}
            {(refreshing || progressPct > 0) && progressPct < 100 ? (
              <span className={styles.chroniclePanelMiniProgress} aria-hidden="true">
                <span
                  className={styles.chroniclePanelMiniProgressFill}
                  style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
                />
              </span>
            ) : null}
          </span>
          {headerAccessory ? (
            <span className={styles.chroniclePanelTitleAccessory}>
              {headerAccessory}
            </span>
          ) : null}
        </span>
      </h3>
    </div>
    <div className={styles.chroniclePanelBody} data-cc-scroll-key={panelId}>
      {children}
    </div>
  </div>
);

const STORAGE_KEY = "ya_club_chronicle_watchlist_v1";
const CACHE_KEY = "ya_cc_cache_v1";
const UPDATES_KEY = "ya_cc_updates_v1";
const GLOBAL_BASELINE_KEY = "ya_cc_global_baseline_v1";
const GLOBAL_UPDATES_HISTORY_KEY = "ya_cc_global_updates_history_v1";
const PANEL_ORDER_KEY = "ya_cc_panel_order_v1";
const LAST_REFRESH_KEY = "ya_cc_last_refresh_ts_v1";
const FORMATIONS_INCLUDE_FRIENDLIES_KEY =
  "ya_cc_formations_include_friendlies_v1";
const HELP_STORAGE_KEY = "ya_cc_help_dismissed_v1";
const FIRST_USE_KEY = "ya_cc_first_use_seen_v1";
const HELP_DISMISSED_TOKEN_KEY = "ya_cc_help_dismissed_token_v1";
const NO_DIVULGO_DISMISSED_KEY = "ya_cc_no_divulgo_dismissed_v1";
const NO_DIVULGO_TARGET_TEAM_ID = 524637;
const PANEL_IDS = [
  "league-performance",
  "press-announcements",
  "last-login",
  "coach",
  "fanclub",
  "arena",
  "finance-estimate",
  "transfer-market",
  "formations-tactics",
  "likely-training",
  "tsi",
  "wages",
] as const;
const SEASON_LENGTH_MS = 112 * 24 * 60 * 60 * 1000;
const CHPP_DAYS_PER_YEAR = 112;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_AGE_MS = SEASON_LENGTH_MS * 2;
const CHPP_SEK_PER_EUR = 10;
const ARCHIVE_MATCH_LIMIT = 30;
const TEAM_REFRESH_CONCURRENCY = 4;
const MATCH_DETAILS_FETCH_CONCURRENCY = 6;
const INCOMPLETE_TEAM_REFETCH_COOLDOWN_MS = 60 * 1000;
const COMPETITIVE_MATCH_TYPES = new Set([1, 2, 3, 7]);
const FRIENDLY_MATCH_TYPES = new Set([4, 5, 8, 9]);
const POSSIBLE_FORMATIONS = new Set([
  "2-5-3",
  "3-5-2",
  "4-5-1",
  "5-4-1",
  "4-4-2",
  "3-4-3",
  "5-3-2",
  "4-3-3",
  "5-2-3",
]);
const TACTIC_LABELS: Record<number, string> = {
  0: "Normal",
  1: "Pressing",
  2: "Counter-attacks",
  3: "Attack in the middle",
  4: "Attack in wings",
  7: "Play creatively",
  8: "Long shots",
};

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

const mapWithConcurrency = async <T, R>(
  list: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  if (list.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(list.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(list[index], index);
    }
  };

  const runners = Array.from(
    { length: Math.min(safeConcurrency, list.length) },
    () => runWorker()
  );
  await Promise.all(runners);
  return results;
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
        Arena?: {
          ArenaID?: number | string;
          ArenaName?: string;
        };
      }
    | undefined
) => {
  if (!team) {
    return {
      leagueName: null,
      leagueLevelUnitName: null,
      leagueLevelUnitId: null,
      arenaId: null,
      arenaName: null,
    };
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
  const arenaIdRaw = team.Arena?.ArenaID ?? null;
  const arenaId =
    arenaIdRaw !== null && arenaIdRaw !== undefined ? Number(arenaIdRaw) : null;
  const arenaName = team.Arena?.ArenaName ?? null;
  return { leagueName, leagueLevelUnitName, leagueLevelUnitId, arenaId, arenaName };
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toArray = <T,>(value: T | T[] | null | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const parseMatchDateValue = (value: unknown): number => {
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTacticLabel = (tacticType: number | null | undefined): string | null => {
  if (tacticType === null || tacticType === undefined) return null;
  return TACTIC_LABELS[tacticType] ?? `Tactic ${tacticType}`;
};

const buildDistribution = (counts: Map<string, number>): FormationTacticsDistribution[] =>
  Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));

const pickTopKey = (distribution: FormationTacticsDistribution[]): string | null =>
  distribution.length > 0 ? distribution[0].key : null;

type FormationSlots = {
  wbL: boolean;
  wbR: boolean;
  cdL: boolean;
  cdC: boolean;
  cdR: boolean;
  wL: boolean;
  wR: boolean;
  imL: boolean;
  imC: boolean;
  imR: boolean;
  fL: boolean;
  fC: boolean;
  fR: boolean;
};

const parseFormationLineCounts = (
  formation: string | null | undefined
): { defenders: number; midfielders: number; forwards: number } | null => {
  if (!formation) return null;
  const match = formation.trim().match(/^(\d+)-(\d+)-(\d+)$/);
  if (!match) return null;
  const defenders = Number(match[1]);
  const midfielders = Number(match[2]);
  const forwards = Number(match[3]);
  if (
    !Number.isFinite(defenders) ||
    !Number.isFinite(midfielders) ||
    !Number.isFinite(forwards)
  ) {
    return null;
  }
  return { defenders, midfielders, forwards };
};

const formationToOccupiedSlots = (
  formation: string | null | undefined
): FormationSlots | null => {
  const parsed = parseFormationLineCounts(formation);
  if (!parsed) return null;
  const wingBackCount = parsed.defenders >= 4 ? 2 : 0;
  const centralDefCount = Math.max(0, Math.min(3, parsed.defenders - wingBackCount));
  const wingerCount = parsed.midfielders >= 4 ? 2 : 0;
  const innerMidCount = Math.max(0, Math.min(3, parsed.midfielders - wingerCount));
  const forwardCount = Math.max(0, Math.min(3, parsed.forwards));
  return {
    wbL: wingBackCount >= 1,
    wbR: wingBackCount >= 2,
    cdL: centralDefCount >= 1,
    cdC: centralDefCount >= 2,
    cdR: centralDefCount >= 3,
    wL: wingerCount >= 1,
    wR: wingerCount >= 2,
    imL: innerMidCount >= 1,
    imC: innerMidCount >= 2,
    imR: innerMidCount >= 3,
    fL: forwardCount >= 1,
    fC: forwardCount >= 2,
    fR: forwardCount >= 3,
  };
};

const inferLikelyTrainingFromFormations = (
  formations: (string | null | undefined)[]
): {
  key: LikelyTrainingKey;
  topKeys: LikelyTrainingKey[];
  isUnclear: boolean;
  confidencePct: number | null;
  scores: { key: LikelyTrainingKey; confidencePct: number }[];
} => {
  const occupiedCounts: Record<keyof FormationSlots, number> = {
    wbL: 0,
    wbR: 0,
    cdL: 0,
    cdC: 0,
    cdR: 0,
    wL: 0,
    wR: 0,
    imL: 0,
    imC: 0,
    imR: 0,
    fL: 0,
    fC: 0,
    fR: 0,
  };
  let samples = 0;
  const seenFormations = new Set<string>();
  formations.forEach((formation) => {
    const occupied = formationToOccupiedSlots(formation);
    if (!occupied) return;
    samples += 1;
    const normalizedFormation = formation?.trim();
    if (normalizedFormation) seenFormations.add(normalizedFormation);
    (Object.keys(occupiedCounts) as (keyof FormationSlots)[]).forEach((slot) => {
      if (occupied[slot]) occupiedCounts[slot] += 1;
    });
  });
  if (samples === 0) {
    return {
      key: "keepingOrSetPieces",
      topKeys: ["keepingOrSetPieces"],
      isUnclear: false,
      confidencePct: null,
      scores: [
        { key: "winger", confidencePct: 0 },
        { key: "playmaking", confidencePct: 0 },
        { key: "defending", confidencePct: 0 },
        { key: "passing", confidencePct: 0 },
        { key: "scoring", confidencePct: 0 },
        { key: "keepingOrSetPieces", confidencePct: 0 },
      ],
    };
  }
  const occupancyPct = (slot: keyof FormationSlots) =>
    (occupiedCounts[slot] / samples) * 100;
  const candidates: Array<{ key: Exclude<LikelyTrainingKey, "keepingOrSetPieces">; slots: (keyof FormationSlots)[] }> = [
    { key: "winger", slots: ["wbL", "wbR", "wL", "wR"] },
    { key: "playmaking", slots: ["imL", "imC", "imR", "wL", "wR"] },
    { key: "defending", slots: ["cdL", "cdC", "cdR", "wbL", "wbR"] },
    { key: "passing", slots: ["fL", "fC", "fR", "imL", "imC", "imR", "wL", "wR"] },
    { key: "scoring", slots: ["fL", "fC", "fR"] },
  ];
  const scored = candidates
    .map((candidate) => ({
      key: candidate.key,
      score: Math.min(...candidate.slots.map((slot) => occupancyPct(slot))),
    }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  const second = scored[1];
  if (!best) {
    return {
      key: "keepingOrSetPieces",
      topKeys: ["keepingOrSetPieces"],
      isUnclear: false,
      confidencePct: null,
      scores: [
        { key: "winger", confidencePct: 0 },
        { key: "playmaking", confidencePct: 0 },
        { key: "defending", confidencePct: 0 },
        { key: "passing", confidencePct: 0 },
        { key: "scoring", confidencePct: 0 },
        { key: "keepingOrSetPieces", confidencePct: 0 },
      ],
    };
  }
  const rounded = Math.round(best.score);
  const coversAllFormations = Array.from(POSSIBLE_FORMATIONS).every((formation) =>
    seenFormations.has(formation)
  );
  const keepingConfidence = coversAllFormations ? 100 : 0;
  const scoreMap = new Map<LikelyTrainingKey, number>();
  scored.forEach((entry) => {
    scoreMap.set(entry.key, Math.round(entry.score));
  });
  scoreMap.set("keepingOrSetPieces", keepingConfidence);
  const trainingKeys: LikelyTrainingKey[] = [
    "winger",
    "playmaking",
    "defending",
    "passing",
    "scoring",
    "keepingOrSetPieces",
  ];
  const scores: { key: LikelyTrainingKey; confidencePct: number }[] = trainingKeys
    .map((key) => ({ key, confidencePct: scoreMap.get(key) ?? 0 }))
    .sort((left, right) => right.confidencePct - left.confidencePct);
  const highestConfidence = scores[0]?.confidencePct ?? 0;
  const topKeys = scores
    .filter((entry) => entry.confidencePct === highestConfidence)
    .map((entry) => entry.key);
  const isUnclear = topKeys.length > 1;

  if (!coversAllFormations) {
    return {
      key: best.key,
      topKeys: topKeys.length > 0 ? topKeys : [best.key],
      isUnclear,
      confidencePct: rounded,
      scores,
    };
  }
  const isClear = best.score >= 70 && (!second || best.score - second.score >= 10);
  if (!isClear) {
    return {
      key: "keepingOrSetPieces",
      topKeys: ["keepingOrSetPieces"],
      isUnclear: false,
      confidencePct: keepingConfidence,
      scores,
    };
  }
  return {
    key: best.key,
    topKeys: topKeys.length > 0 ? topKeys : [best.key],
    isUnclear,
    confidencePct: rounded,
    scores,
  };
};

const colorForSlice = (index: number): string => {
  const hue = (index * 61) % 360;
  return `hsl(${hue} 58% 52%)`;
};

const splitPieLabel = (label: string, maxCharsPerLine = 16): string[] => {
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [label];
};

type PieLabelRenderProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
};

const renderPieLabel = (props: PieLabelRenderProps) => {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    outerRadius = 0,
    percent = 0,
    name = "",
  } = props ?? {};
  const value = Math.round(Number(percent) * 100);
  const label = `${String(name)}: ${value}%`;
  const radians = (Math.PI / 180) * Number(midAngle);
  const x = Number(cx) + (Number(outerRadius) + 18) * Math.cos(-radians);
  const y = Number(cy) + (Number(outerRadius) + 18) * Math.sin(-radians);
  const lines = splitPieLabel(label, 16);
  const textAnchor = x >= Number(cx) ? "start" : "end";
  const lineOffset = ((lines.length - 1) * 12) / 2;
  return (
    <text
      x={x}
      y={y - lineOffset}
      fill="#111111"
      textAnchor={textAnchor}
      dominantBaseline="central"
      fontSize={12}
    >
      {lines.map((line, index) => (
        <tspan key={`${label}-${line}-${index}`} x={x} dy={index === 0 ? 0 : 12}>
          {line}
        </tspan>
      ))}
    </text>
  );
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
  const fanclubSize =
    fanclub.FanclubSize && typeof fanclub.FanclubSize === "object" && "#text" in (fanclub.FanclubSize as RawNode)
      ? parseOptionalNumber((fanclub.FanclubSize as RawNode)["#text"])
      : parseOptionalNumber(fanclub.FanclubSize);
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

const stripLikelyTrainingConfidenceFromUpdates = (
  updates: ChronicleUpdates
): { updates: ChronicleUpdates; didChange: boolean } => {
  let didChange = false;
  const nextTeams = Object.fromEntries(
    Object.entries(updates.teams).flatMap(([teamId, teamUpdate]) => {
      const nextChanges = teamUpdate.changes.filter(
        (change) => change.fieldKey !== "likelyTraining.confidence"
      );
      if (nextChanges.length === 0) {
        if (teamUpdate.changes.length > 0) {
          didChange = true;
        }
        return [];
      }
      if (nextChanges.length !== teamUpdate.changes.length) {
        didChange = true;
      }
      return [
        [
          teamId,
          nextChanges.length === teamUpdate.changes.length
            ? teamUpdate
            : { ...teamUpdate, changes: nextChanges },
        ],
      ];
    })
  ) as ChronicleUpdates["teams"];
  if (!didChange) {
    return { updates, didChange: false };
  }
  return {
    updates: {
      ...updates,
      teams: nextTeams,
    },
    didChange: true,
  };
};

const readChronicleUpdates = (): ChronicleUpdates | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UPDATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChronicleUpdates;
    if (!parsed || !parsed.teams) return null;
    const { updates, didChange } =
      stripLikelyTrainingConfidenceFromUpdates(parsed);
    if (didChange) {
      writeChronicleUpdates(updates);
    }
    return updates;
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

const readGlobalBaseline = (): ChronicleCache | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GLOBAL_BASELINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChronicleCache;
    return parsed && parsed.teams ? parsed : null;
  } catch {
    return null;
  }
};

const writeGlobalBaseline = (payload: ChronicleCache | null) => {
  if (typeof window === "undefined") return;
  try {
    if (!payload) {
      window.localStorage.removeItem(GLOBAL_BASELINE_KEY);
      return;
    }
    window.localStorage.setItem(GLOBAL_BASELINE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const parseInjurySummaryEntries = (value: string | null | undefined) => {
  if (!value) return [] as Array<{ label: string; status: string; raw: string }>;
  return value
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.*)\s+(🩹|(?:✚|\+).*)$/);
      if (!match) {
        const separatorIndex = entry.lastIndexOf(" ");
        if (separatorIndex <= 0 || separatorIndex >= entry.length - 1) {
          return null;
        }
        const label = entry.slice(0, separatorIndex).trim();
        const status = entry.slice(separatorIndex + 1).trim();
        if (!label || !status) return null;
        return {
          label,
          status,
          raw: entry,
        };
      }
      return {
        label: match[1].trim(),
        status: match[2].trim(),
        raw: entry,
      };
    })
    .filter(
      (entry): entry is { label: string; status: string; raw: string } =>
        Boolean(entry)
    );
};

const migrateInjuryHistoryEntry = (
  historyEntry: ChronicleGlobalUpdateEntry,
  healthyLabel: string
): ChronicleGlobalUpdateEntry => {
  if (!historyEntry.updates) return historyEntry;
  let didChange = false;
  const migratedTeams = Object.fromEntries(
    Object.entries(historyEntry.updates.teams).map(([teamId, teamUpdate]) => {
      const nextChanges = teamUpdate.changes.map((change) => {
        if (change.fieldKey !== "wages.injury") return change;
        const previousParsed = parseInjurySummaryEntries(change.previous);
        const currentParsed = parseInjurySummaryEntries(change.current);
        if (previousParsed.length === 0 && currentParsed.length === 0) {
          return change;
        }
        const previousMap = new Map(
          previousParsed.map((entry) => [entry.label, entry.status])
        );
        const currentMap = new Map(
          currentParsed.map((entry) => [entry.label, entry.status])
        );
        const orderedLabels = Array.from(
          new Set([
            ...previousParsed.map((entry) => entry.label),
            ...currentParsed.map((entry) => entry.label),
          ])
        );
        const changedLabels = orderedLabels.filter(
          (label) => previousMap.get(label) !== currentMap.get(label)
        );
        if (changedLabels.length === 0) {
          return change;
        }
        const nextPrevious = changedLabels
          .map((label) => `${label} ${previousMap.get(label) ?? healthyLabel}`)
          .join(", ");
        const nextCurrent = changedLabels
          .map((label) => `${label} ${currentMap.get(label) ?? healthyLabel}`)
          .join(", ");
        const migratedChange: ChronicleUpdateField = {
          ...change,
          previous: nextPrevious || healthyLabel,
          current: nextCurrent || healthyLabel,
        };
        if (
          migratedChange.previous !== change.previous ||
          migratedChange.current !== change.current
        ) {
          didChange = true;
        }
        return migratedChange;
      });
      return [teamId, { ...teamUpdate, changes: nextChanges }];
    })
  ) as ChronicleUpdates["teams"];
  if (!didChange) return historyEntry;
  return {
    ...historyEntry,
    updates: {
      ...historyEntry.updates,
      teams: migratedTeams,
    },
  };
};

const readGlobalUpdatesHistory = (
  healthyLabel = "Healthy"
): ChronicleGlobalUpdateEntry[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GLOBAL_UPDATES_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChronicleGlobalUpdateEntry[];
    if (!Array.isArray(parsed)) return [];
    let didChange = false;
    const migrated = parsed
      .filter((entry) => entry?.hasChanges && !!entry?.updates)
      .map((entry) => {
        const nextEntry = migrateInjuryHistoryEntry(entry, healthyLabel);
        if (nextEntry !== entry) {
          didChange = true;
        }
        if (!nextEntry.updates) return nextEntry;
        const { updates, didChange: stripped } =
          stripLikelyTrainingConfidenceFromUpdates(nextEntry.updates);
        if (!stripped) return nextEntry;
        didChange = true;
        const hasChanges = Object.keys(updates.teams).length > 0;
        return {
          ...nextEntry,
          hasChanges,
          updates,
        };
      })
      .filter(
        (entry) =>
          entry.hasChanges &&
          !!entry.updates &&
          Object.keys(entry.updates.teams).length > 0
      );
    if (didChange) {
      writeGlobalUpdatesHistory(migrated);
    }
    return migrated;
  } catch {
    return [];
  }
};

const writeGlobalUpdatesHistory = (payload: ChronicleGlobalUpdateEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GLOBAL_UPDATES_HISTORY_KEY,
      JSON.stringify(payload)
    );
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

const readFormationsIncludeFriendlies = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FORMATIONS_INCLUDE_FRIENDLIES_KEY) === "1";
  } catch {
    return false;
  }
};

const writeFormationsIncludeFriendlies = (value: boolean) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FORMATIONS_INCLUDE_FRIENDLIES_KEY,
      value ? "1" : "0"
    );
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
      arena: (() => {
        const arena = team.arena;
        if (!arena?.current) return arena;
        const currentAge = now - arena.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!arena.previous) return arena;
        const previousAge = now - arena.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...arena,
            previous: undefined,
          };
        }
        return arena;
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
      tsi: (() => {
        const tsi = team.tsi;
        if (!tsi?.current) return tsi;
        const currentAge = now - tsi.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!tsi.previous) return tsi;
        const previousAge = now - tsi.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...tsi,
            previous: undefined,
          };
        }
        return tsi;
      })(),
      wages: (() => {
        const wages = team.wages;
        if (!wages?.current) return wages;
        const currentAge = now - wages.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!wages.previous) return wages;
        const previousAge = now - wages.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...wages,
            previous: undefined,
          };
        }
        return wages;
      })(),
      formationsTactics: (() => {
        const formationsTactics = team.formationsTactics;
        if (!formationsTactics?.current) return formationsTactics;
        const currentAge = now - formationsTactics.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!formationsTactics.previous) return formationsTactics;
        const previousAge = now - formationsTactics.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...formationsTactics,
            previous: undefined,
          };
        }
        return formationsTactics;
      })(),
      lastLogin: (() => {
        const lastLogin = team.lastLogin;
        if (!lastLogin?.current) return lastLogin;
        const currentAge = now - lastLogin.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!lastLogin.previous) return lastLogin;
        const previousAge = now - lastLogin.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...lastLogin,
            previous: undefined,
          };
        }
        return lastLogin;
      })(),
      coach: (() => {
        const coach = team.coach;
        if (!coach?.current) return coach;
        const currentAge = now - coach.current.fetchedAt;
        if (currentAge > MAX_CACHE_AGE_MS) return undefined;
        if (!coach.previous) return coach;
        const previousAge = now - coach.previous.fetchedAt;
        if (previousAge > MAX_CACHE_AGE_MS) {
          return {
            ...coach,
            previous: undefined,
          };
        }
        return coach;
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
      team.arena?.current?.fetchedAt ?? 0,
      team.arena?.previous?.fetchedAt ?? 0,
      team.financeEstimate?.current?.fetchedAt ?? 0,
      team.financeEstimate?.previous?.fetchedAt ?? 0,
      team.transferActivity?.current?.fetchedAt ?? 0,
      team.transferActivity?.previous?.fetchedAt ?? 0,
      team.tsi?.current?.fetchedAt ?? 0,
      team.tsi?.previous?.fetchedAt ?? 0,
      team.wages?.current?.fetchedAt ?? 0,
      team.wages?.previous?.fetchedAt ?? 0,
      team.formationsTactics?.current?.fetchedAt ?? 0,
      team.formationsTactics?.previous?.fetchedAt ?? 0,
      team.lastLogin?.current?.fetchedAt ?? 0,
      team.lastLogin?.previous?.fetchedAt ?? 0,
      team.coach?.current?.fetchedAt ?? 0,
      team.coach?.previous?.fetchedAt ?? 0
    );
  });
  return latest > 0 ? latest : null;
};

export default function ClubChronicle({ messages }: ClubChronicleProps) {
  const initialGlobalUpdatesHistory = useMemo(
    () => readGlobalUpdatesHistory(messages.clubChronicleInjuryHealthy),
    [messages.clubChronicleInjuryHealthy]
  );
  const chronicleRootRef = useRef<HTMLDivElement | null>(null);
  const [supportedTeams, setSupportedTeams] = useState<SupportedTeam[]>([]);
  const [supportedSelections, setSupportedSelections] = useState<
    Record<number, boolean>
  >({});
  const [manualTeams, setManualTeams] = useState<ManualTeam[]>([]);
  const [primaryTeam, setPrimaryTeam] = useState<ChronicleTeamData | null>(null);
  const [chronicleCache, setChronicleCache] = useState<ChronicleCache>(() =>
    pruneChronicleCache(readChronicleCache())
  );
  const [globalBaselineCache, setGlobalBaselineCache] = useState<ChronicleCache | null>(
    () => {
      const baseline = readGlobalBaseline();
      return baseline ? pruneChronicleCache(baseline) : null;
    }
  );
  const [panelOrder, setPanelOrder] = useState<string[]>(() =>
    readPanelOrder()
  );
  const [updates, setUpdates] = useState<ChronicleUpdates | null>(() =>
    readChronicleUpdates()
  );
  const [globalUpdatesHistory, setGlobalUpdatesHistory] = useState<
    ChronicleGlobalUpdateEntry[]
  >(() =>
    initialGlobalUpdatesHistory.slice(
      0,
      DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT
    )
  );
  const [lastGlobalRefreshAt, setLastGlobalRefreshAt] = useState<number | null>(() =>
    readLastRefresh()
  );
  const [lastGlobalComparedAt, setLastGlobalComparedAt] = useState<number | null>(
    () => initialGlobalUpdatesHistory[0]?.comparedAt ?? null
  );
  const [lastGlobalHadChanges, setLastGlobalHadChanges] = useState<boolean>(() => {
    const latest = initialGlobalUpdatesHistory[0];
    return latest ? latest.hasChanges : true;
  });
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
  const [fanclubDetailsOpen, setFanclubDetailsOpen] = useState(false);
  const [selectedFanclubTeamId, setSelectedFanclubTeamId] = useState<
    number | null
  >(null);
  const [arenaDetailsOpen, setArenaDetailsOpen] = useState(false);
  const [selectedArenaTeamId, setSelectedArenaTeamId] = useState<number | null>(
    null
  );
  const [formationsTacticsDetailsOpen, setFormationsTacticsDetailsOpen] =
    useState(false);
  const [formationsTacticsMatchesOpen, setFormationsTacticsMatchesOpen] =
    useState(false);
  const [selectedFormationsTacticsTeamId, setSelectedFormationsTacticsTeamId] =
    useState<number | null>(null);
  const [likelyTrainingDetailsOpen, setLikelyTrainingDetailsOpen] =
    useState(false);
  const [selectedLikelyTrainingTeamId, setSelectedLikelyTrainingTeamId] =
    useState<number | null>(null);
  const [tsiDetailsOpen, setTsiDetailsOpen] = useState(false);
  const [selectedTsiTeamId, setSelectedTsiTeamId] = useState<number | null>(null);
  const [wagesDetailsOpen, setWagesDetailsOpen] = useState(false);
  const [selectedWagesTeamId, setSelectedWagesTeamId] = useState<number | null>(
    null
  );
  const [lastLoginDetailsOpen, setLastLoginDetailsOpen] = useState(false);
  const [selectedLastLoginTeamId, setSelectedLastLoginTeamId] = useState<
    number | null
  >(null);
  const [coachDetailsOpen, setCoachDetailsOpen] = useState(false);
  const [selectedCoachTeamId, setSelectedCoachTeamId] = useState<number | null>(
    null
  );
  const [tsiDetailsSortState, setTsiDetailsSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "playerNumber", direction: "asc" });
  const [wagesDetailsSortState, setWagesDetailsSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "playerNumber", direction: "asc" });
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
  const [updatesHistoryCount, setUpdatesHistoryCount] = useState(
    DEFAULT_CLUB_CHRONICLE_UPDATES_HISTORY_COUNT
  );
  const [formationsIncludeFriendlies, setFormationsIncludeFriendlies] =
    useState(() => readFormationsIncludeFriendlies());
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
  const [arenaSortState, setArenaSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [formationsTacticsSortState, setFormationsTacticsSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [likelyTrainingSortState, setLikelyTrainingSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [transferSortState, setTransferSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [tsiSortState, setTsiSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [wagesSortState, setWagesSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [lastLoginSortState, setLastLoginSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [coachSortState, setCoachSortState] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "team", direction: "asc" });
  const [refreshingGlobal, setRefreshingGlobal] = useState(false);
  const [refreshingLeague, setRefreshingLeague] = useState(false);
  const [refreshingPress, setRefreshingPress] = useState(false);
  const [refreshingFanclub, setRefreshingFanclub] = useState(false);
  const [refreshingArena, setRefreshingArena] = useState(false);
  const [refreshingFormationsTactics, setRefreshingFormationsTactics] =
    useState(false);
  const [refreshingFinance, setRefreshingFinance] = useState(false);
  const [refreshingTransfer, setRefreshingTransfer] = useState(false);
  const [refreshingTsi, setRefreshingTsi] = useState(false);
  const [refreshingWages, setRefreshingWages] = useState(false);
  const [refreshingLastLogin, setRefreshingLastLogin] = useState(false);
  const [refreshingCoach, setRefreshingCoach] = useState(false);
  const [globalRefreshProgressPct, setGlobalRefreshProgressPct] = useState(0);
  const [globalRefreshStatus, setGlobalRefreshStatus] = useState<string | null>(null);
  const [panelRefreshProgressPct, setPanelRefreshProgressPct] = useState<
    Record<string, number>
  >({});
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null);
  const [pointerDraggingPanel, setPointerDraggingPanel] = useState(false);
  const [loadingTransferHistoryModal, setLoadingTransferHistoryModal] =
    useState(false);
  const [loadingTransferListedModal, setLoadingTransferListedModal] =
    useState(false);
  const [teamIdInput, setTeamIdInput] = useState("");
  const [watchlistReloadNonce, setWatchlistReloadNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [noDivulgoActive, setNoDivulgoActive] = useState(false);
  const [pendingNoDivulgoFetchTeamId, setPendingNoDivulgoFetchTeamId] = useState<
    number | null
  >(null);
  const [pendingWatchlistFetchTeamIds, setPendingWatchlistFetchTeamIds] = useState<
    number[]
  >([]);
  const [helpCallouts, setHelpCallouts] = useState<
    {
      id: string;
      text: string;
      style: CSSProperties;
      placement:
        | "above-center"
        | "below-center"
        | "left-center"
        | "right-center";
    }[]
  >([]);
  const [helpCardTop, setHelpCardTop] = useState(84);
  const initializedRef = useRef(false);
  const initialFetchRef = useRef(false);
  const staleRefreshRef = useRef(false);
  const chronicleStopRequestedRef = useRef(false);
  const trackedTeamsRef = useRef<ChronicleTeamData[]>([]);
  const refreshAllDataRef = useRef<((reason: "stale" | "manual") => Promise<void>) | null>(
    null
  );
  const refreshNoDivulgoTeamRef = useRef<((teamId: number) => Promise<void>) | null>(
    null
  );
  const refreshTeamsRef = useRef<((teams: ChronicleTeamData[]) => Promise<void>) | null>(
    null
  );
  const incompleteTeamRefetchAtRef = useRef<Record<number, number>>({});
  const coachCountryNameCacheRef = useRef<Map<number, string>>(new Map());
  const coachCountryNamePendingRef = useRef<Map<number, Promise<string | null>>>(new Map());
  const { addNotification } = useNotifications();
  const anyRefreshing =
    refreshingGlobal ||
    refreshingLeague ||
    refreshingPress ||
    refreshingFanclub ||
    refreshingArena ||
    refreshingFormationsTactics ||
    refreshingFinance ||
    refreshingTransfer ||
    refreshingTsi ||
    refreshingWages ||
    refreshingLastLogin ||
    refreshingCoach;
  const getPanelRefreshProgress = useCallback(
    (panelId: string) => panelRefreshProgressPct[panelId] ?? 0,
    [panelRefreshProgressPct]
  );

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
        arenaId: cached?.arenaId ?? null,
        arenaName: cached?.arenaName ?? null,
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
        arenaId: cached?.arenaId ?? null,
        arenaName: cached?.arenaName ?? null,
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
        arenaId: existing?.arenaId ?? cached?.arenaId ?? null,
        arenaName: existing?.arenaName ?? cached?.arenaName ?? null,
        leaguePerformance: cached?.leaguePerformance ?? existing?.leaguePerformance,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.teamName ?? "").localeCompare(b.teamName ?? "")
    );
  }, [supportedTeams, supportedSelections, manualTeams, chronicleCache, primaryTeam]);

  const isNoDivulgoTracked = useMemo(
    () => trackedTeams.some((team) => team.teamId === NO_DIVULGO_TARGET_TEAM_ID),
    [trackedTeams]
  );
  const trackedTeamIdsKey = useMemo(
    () => trackedTeams.map((team) => team.teamId).sort((a, b) => a - b).join(","),
    [trackedTeams]
  );
  const incompleteTrackedTeamIds = useMemo(() => {
    return trackedTeams
      .filter((team) => {
        const cached = chronicleCache.teams[team.teamId];
        if (!cached) return true;
        return !(
          cached.leaguePerformance?.current &&
          cached.pressAnnouncement?.current &&
          cached.fanclub?.current &&
          cached.arena?.current &&
          cached.financeEstimate?.current &&
          cached.transferActivity?.current &&
          cached.tsi?.current &&
          cached.wages?.current &&
          cached.formationsTactics?.current &&
          cached.lastLogin?.current &&
          cached.coach?.current
        );
      })
      .map((team) => team.teamId);
  }, [chronicleCache.teams, trackedTeams]);

  useEffect(() => {
    trackedTeamsRef.current = trackedTeams;
  }, [trackedTeams]);

  useEffect(() => {
    // Team scope changed; allow stale refresh checks to run again for the new full set.
    staleRefreshRef.current = false;
  }, [trackedTeamIdsKey]);

  const handleNoDivulgoDismiss = useCallback((teamId: number) => {
    if (typeof window === "undefined") return;
    if (teamId !== NO_DIVULGO_TARGET_TEAM_ID || !noDivulgoActive) return;
    window.localStorage.setItem(NO_DIVULGO_DISMISSED_KEY, "1");
    setNoDivulgoActive(false);
    setPendingNoDivulgoFetchTeamId(teamId);
  }, [noDivulgoActive]);

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
                fieldKey: "arena.capacity",
                label: messages.clubChronicleArenaColumnCapacity,
                previous: "25000",
                current: "26000",
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
              {
                fieldKey: "formationsTactics.formation",
                label: messages.clubChronicleFormationsColumnFormation,
                previous: "3-5-2",
                current: "4-5-1",
              },
              {
                fieldKey: "formationsTactics.tactic",
                label: messages.clubChronicleFormationsColumnTactic,
                previous: "Pressing",
                current: "Counter-attacks",
              },
              {
                fieldKey: "likelyTraining.regimen",
                label: messages.clubChronicleLikelyTrainingColumnRegimen,
                previous: messages.clubChronicleLikelyTrainingPlaymaking,
                current: messages.clubChronicleLikelyTrainingPassing,
              },
              {
                fieldKey: "tsi.total",
                label: messages.clubChronicleTsiColumnTotal,
                previous: "745000",
                current: "752000",
              },
              {
                fieldKey: "tsi.top11",
                label: messages.clubChronicleTsiColumnTop11,
                previous: "512000",
                current: "519000",
              },
              {
                fieldKey: "wages.total",
                label: messages.clubChronicleWagesColumnTotal,
                previous: "420000",
                current: "432000",
              },
              {
                fieldKey: "wages.top11",
                label: messages.clubChronicleWagesColumnTop11,
                previous: "301000",
                current: "308000",
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
    const fetchToken = async () => {
      try {
        const { response, payload } = await fetchChppJson<{ raw?: string }>(
          "/api/chpp/oauth/check-token",
          { cache: "no-store" }
        );
        if (!response.ok || !payload?.raw) return;
        const match = payload.raw.match(/<Token>(.*?)<\/Token>/);
        const token = match?.[1]?.trim() ?? null;
        if (token) setCurrentToken(token);
      } catch {
        // ignore token check errors
      } finally {
        setTokenChecked(true);
      }
    };
    void fetchToken();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isNoDivulgoTracked) {
      setNoDivulgoActive(false);
      return;
    }
    const dismissed = window.localStorage.getItem(NO_DIVULGO_DISMISSED_KEY);
    setNoDivulgoActive(dismissed !== "1");
  }, [isNoDivulgoTracked]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const firstUseSeen = window.localStorage.getItem(FIRST_USE_KEY) === "1";
    if (!firstUseSeen) {
      setShowHelp(true);
      window.localStorage.setItem(FIRST_USE_KEY, "1");
    }
    const dismissed = window.localStorage.getItem(HELP_STORAGE_KEY);
    if (firstUseSeen && !dismissed) {
      setShowHelp(true);
    }
    const handler = () => setShowHelp(true);
    window.addEventListener("ya:help-open", handler);
    return () => window.removeEventListener("ya:help-open", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!tokenChecked || !currentToken) return;
    const dismissedToken = window.localStorage.getItem(HELP_DISMISSED_TOKEN_KEY);
    if (dismissedToken !== currentToken) {
      setShowHelp(true);
    }
  }, [tokenChecked, currentToken]);

  useEffect(() => {
    if (!showHelp) {
      setHelpCallouts([]);
      return;
    }
    const GAP = 12;
    const EDGE = 12;
    const targets: Array<{
      id: string;
      selector: string;
      text: string;
      placement: "above-center" | "below-center" | "left-center";
    }> = [
      {
        id: "refresh-all",
        selector: "[data-help-anchor='cc-refresh-all']",
        text: messages.clubChronicleHelpCalloutRefresh,
        placement: "above-center",
      },
      {
        id: "latest-updates",
        selector: "[data-help-anchor='cc-latest-updates']",
        text: messages.clubChronicleHelpCalloutUpdates,
        placement: "below-center",
      },
      {
        id: "watchlist",
        selector: "[data-help-anchor='cc-watchlist']",
        text: messages.clubChronicleHelpCalloutWatchlist,
        placement: "left-center",
      },
    ];

    const measureSize = (text: string, width: number) => {
      const probe = document.createElement("div");
      probe.className = styles.helpCallout;
      probe.classList.add(styles.clubChronicleHelpCallout);
      probe.style.position = "fixed";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.width = `${width}px`;
      const badge = document.createElement("span");
      badge.className = styles.helpCalloutIndex;
      badge.textContent = "1";
      probe.appendChild(badge);
      const textSpan = document.createElement("span");
      textSpan.className = styles.helpCalloutText;
      textSpan.textContent = text;
      probe.appendChild(textSpan);
      document.body.appendChild(probe);
      const rect = probe.getBoundingClientRect();
      probe.remove();
      return { width: rect.width, height: rect.height };
    };

    const computeCallouts = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredWidth = Math.min(
        320,
        Math.max(220, Math.floor(viewportWidth * 0.28))
      );
      const finalWidth = Math.min(preferredWidth, viewportWidth - EDGE * 2);
      const next = targets.flatMap((target) => {
        const el = document.querySelector(target.selector) as HTMLElement | null;
        if (!el) return [];
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const measured = measureSize(target.text, finalWidth);
        let placement:
          | "above-center"
          | "below-center"
          | "left-center"
          | "right-center" = target.placement;
        let left = EDGE;
        let top = EDGE;
        if (placement === "above-center") {
          left = centerX - measured.width / 2;
          top = rect.top - measured.height - GAP;
        } else if (placement === "below-center") {
          left = centerX - measured.width / 2;
          top = rect.bottom + GAP;
        } else if (placement === "left-center") {
          left = rect.left - measured.width - GAP;
          top = centerY - measured.height / 2;
          if (left < EDGE) {
            placement = "right-center";
            left = rect.right + GAP;
          }
        } else {
          left = rect.right + GAP;
          top = centerY - measured.height / 2;
        }

        const clampedLeft = Math.min(
          Math.max(left, EDGE),
          viewportWidth - measured.width - EDGE
        );
        const clampedTop = Math.min(
          Math.max(top, EDGE),
          viewportHeight - measured.height - EDGE
        );
        const pointerX =
          placement === "above-center" || placement === "below-center"
            ? Math.min(
                Math.max(centerX - clampedLeft, 18),
                measured.width - 18
              )
            : 18;
        return [
          {
            id: target.id,
            text: target.text,
            placement,
            style: {
              left: clampedLeft,
              top: clampedTop,
              "--callout-pointer-x": `${pointerX}px`,
              width: `${measured.width}px`,
            } as CSSProperties,
          },
        ];
      });
      setHelpCallouts(next);
    };

    const schedule = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(computeCallouts);
      });
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [
    showHelp,
    messages.clubChronicleHelpCalloutRefresh,
    messages.clubChronicleHelpCalloutUpdates,
    messages.clubChronicleHelpCalloutWatchlist,
  ]);

  useEffect(() => {
    if (!showHelp) return;
    const updateHelpCardTop = () => {
      const calloutNodes = Array.from(
        document.querySelectorAll<HTMLElement>(`.${styles.clubChronicleHelpCallout}`)
      );
      const minTop = 84;
      const margin = 16;
      const maxBottom = calloutNodes.reduce(
        (acc, node) => Math.max(acc, node.getBoundingClientRect().bottom),
        minTop
      );
      const maxTop = Math.max(minTop, window.innerHeight - 240);
      setHelpCardTop(Math.min(Math.max(minTop, maxBottom + margin), maxTop));
    };
    const frame = window.requestAnimationFrame(updateHelpCardTop);
    window.addEventListener("resize", updateHelpCardTop);
    window.addEventListener("scroll", updateHelpCardTop, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateHelpCardTop);
      window.removeEventListener("scroll", updateHelpCardTop, true);
    };
  }, [showHelp, helpCallouts]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { response, payload } = await fetchChppJson<{
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
        }>("/api/chpp/supporters", {
          cache: "no-store",
        });
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
      } catch (error) {
        if (isChppAuthRequiredError(error)) return;
        if (active) {
          setError(getReadableErrorMessage(error, messages.watchlistError));
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
  }, [messages.watchlistError, watchlistOpen, watchlistReloadNonce]);

  useEffect(() => {
    let active = true;
    const loadPrimaryTeam = async () => {
      try {
        const { response, payload } = await fetchChppJson<{
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
        }>("/api/chpp/teamdetails", {
          cache: "no-store",
        });
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
          arenaId: meta.arenaId,
          arenaName: meta.arenaName,
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
              arenaId: meta.arenaId ?? prev.teams[teamId]?.arenaId ?? null,
              arenaName: meta.arenaName ?? prev.teams[teamId]?.arenaName ?? null,
              leaguePerformance: prev.teams[teamId]?.leaguePerformance,
            },
          },
        }));
      } catch (error) {
        if (isChppAuthRequiredError(error)) return;
        // ignore teamdetails failure for now
      }
    };
    void loadPrimaryTeam();
    return () => {
      active = false;
    };
  }, [watchlistReloadNonce]);

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
    setUpdatesHistoryCount(readClubChronicleUpdatesHistoryCount());
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
          | {
              stalenessDays?: number;
              transferHistoryCount?: number;
              updatesHistoryCount?: number;
            }
          | undefined;
        if (typeof detail?.stalenessDays === "number") {
          setStalenessDays(detail.stalenessDays);
        }
        if (typeof detail?.transferHistoryCount === "number") {
          setTransferHistoryCount(detail.transferHistoryCount);
        }
        if (typeof detail?.updatesHistoryCount === "number") {
          setUpdatesHistoryCount(detail.updatesHistoryCount);
        }
        if (
          typeof detail?.stalenessDays === "number" ||
          typeof detail?.transferHistoryCount === "number" ||
          typeof detail?.updatesHistoryCount === "number"
        ) {
          return;
        }
      }
      setStalenessDays(readClubChronicleStalenessDays());
      setTransferHistoryCount(readClubChronicleTransferHistoryCount());
      setUpdatesHistoryCount(readClubChronicleUpdatesHistoryCount());
    };
    window.addEventListener("storage", handle);
    window.addEventListener(CLUB_CHRONICLE_SETTINGS_EVENT, handle);
    return () => {
      window.removeEventListener("storage", handle);
      window.removeEventListener(CLUB_CHRONICLE_SETTINGS_EVENT, handle);
    };
  }, []);

  useEffect(() => {
    setGlobalUpdatesHistory((prev) => prev.slice(0, updatesHistoryCount));
  }, [updatesHistoryCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    const handleDebugUpdates = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      if (
        detail &&
        typeof detail === "object" &&
        "type" in detail &&
        detail.type === "oauth-mode-changed"
      ) {
        setWatchlistReloadNonce((prev) => prev + 1);
        return;
      }
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
    if (loading || isValidating) return;
    if (incompleteTrackedTeamIds.length === 0) return;
    const now = Date.now();
    const eligibleTeamIds = incompleteTrackedTeamIds.filter((teamId) => {
      const lastAttempt = incompleteTeamRefetchAtRef.current[teamId] ?? 0;
      return now - lastAttempt >= INCOMPLETE_TEAM_REFETCH_COOLDOWN_MS;
    });
    if (eligibleTeamIds.length === 0) return;
    eligibleTeamIds.forEach((teamId) => {
      incompleteTeamRefetchAtRef.current[teamId] = now;
    });
    setPendingWatchlistFetchTeamIds((prev) => {
      const pending = new Set(prev);
      eligibleTeamIds.forEach((teamId) => {
        pending.add(teamId);
      });
      return Array.from(pending);
    });
  }, [loading, isValidating, incompleteTrackedTeamIds]);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (loading || isValidating) return;
    if (trackedTeams.length === 0) return;
    let lastRefresh = readLastRefresh();
    if (!lastRefresh) {
      const fallback = getLatestCacheTimestamp(chronicleCache);
      if (!fallback) return;
      lastRefresh = fallback;
      writeLastRefresh(fallback);
      setLastGlobalRefreshAt(fallback);
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
  }, [
    trackedTeams.length,
    stalenessDays,
    anyRefreshing,
    chronicleCache,
    loading,
    isValidating,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!initializedRef.current) return;
    if (loading || isValidating) return;
    if (trackedTeams.length === 0) return;

    const maybeRunStaleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      let lastRefresh = readLastRefresh();
      if (!lastRefresh) {
        const fallback = getLatestCacheTimestamp(chronicleCache);
        if (!fallback) return;
        lastRefresh = fallback;
        writeLastRefresh(fallback);
        setLastGlobalRefreshAt(fallback);
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
    };

    const handleFocus = () => maybeRunStaleRefresh();
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      maybeRunStaleRefresh();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    trackedTeams.length,
    stalenessDays,
    anyRefreshing,
    chronicleCache,
    loading,
    isValidating,
  ]);

  useEffect(() => {
    writeChronicleCache(chronicleCache);
  }, [chronicleCache]);

  useEffect(() => {
    writeChronicleUpdates(updates);
  }, [updates]);

  useEffect(() => {
    writeGlobalBaseline(globalBaselineCache);
  }, [globalBaselineCache]);

  useEffect(() => {
    writeGlobalUpdatesHistory(globalUpdatesHistory);
  }, [globalUpdatesHistory]);

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
      const { response, payload } = await fetchChppJson<{
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
      }>(`/api/chpp/teamdetails?teamId=${parsed}`, {
        cache: "no-store",
      });
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
      if (!response.ok || payload?.error) {
        setError(payload?.details || payload?.error || messages.watchlistError);
        setErrorOpen(true);
        return;
      }
      if (!teamId) {
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
    } catch (error) {
      if (isChppAuthRequiredError(error)) return;
      setError(getReadableErrorMessage(error, messages.watchlistError));
      setErrorOpen(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleToggleSupported = (teamId: number) => {
    const nextEnabled = !(supportedSelections[teamId] ?? false);
    setSupportedSelections((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
    if (nextEnabled) {
      setPendingWatchlistFetchTeamIds((prev) =>
        prev.includes(teamId) ? prev : [...prev, teamId]
      );
    }
  };

  const handleRemoveManual = (teamId: number) => {
    setManualTeams((prev) => prev.filter((team) => team.teamId !== teamId));
  };

  const movePanel = useCallback((sourcePanelId: string, targetPanelId: string) => {
    if (!sourcePanelId || sourcePanelId === targetPanelId) return;
    setPanelOrder((prev) => {
      const sourceIndex = prev.indexOf(sourcePanelId);
      const targetIndex = prev.indexOf(targetPanelId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      const adjustedTarget = Math.min(Math.max(targetIndex, 0), next.length);
      next.splice(adjustedTarget, 0, moved);
      return next;
    });
  }, []);

  const finishPanelDrag = useCallback(() => {
    setDraggedPanelId(null);
    setDropTargetPanelId(null);
    setPointerDraggingPanel(false);
  }, []);

  const handlePanelDragStart = (
    event: React.DragEvent<HTMLElement>,
    panelId: string
  ) => {
    setDraggedPanelId(panelId);
    setDropTargetPanelId(null);
    setPointerDraggingPanel(false);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", panelId);
  };

  const handlePanelPointerDown = (panelId: string) => {
    setDraggedPanelId(panelId);
    setDropTargetPanelId(null);
    setPointerDraggingPanel(true);
  };

  const handlePanelPointerEnter = (panelId: string) => {
    if (!pointerDraggingPanel || !draggedPanelId || draggedPanelId === panelId) return;
    setDropTargetPanelId(panelId);
  };

  const handlePanelPointerUp = (panelId: string) => {
    if (!pointerDraggingPanel || !draggedPanelId) return;
    movePanel(draggedPanelId, panelId);
    finishPanelDrag();
  };

  const handlePanelDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    panelId: string
  ) => {
    event.preventDefault();
    if (!draggedPanelId || draggedPanelId === panelId) return;
    event.dataTransfer.dropEffect = "move";
  };

  const handlePanelDragEnter = (
    event: React.DragEvent<HTMLDivElement>,
    panelId: string
  ) => {
    event.preventDefault();
    if (!draggedPanelId || draggedPanelId === panelId) return;
    setDropTargetPanelId(panelId);
  };

  const handlePanelDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
    panelId: string
  ) => {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
    setDropTargetPanelId((prev) => (prev === panelId ? null : prev));
  };

  const handlePanelDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetPanelId: string
  ) => {
    event.preventDefault();
    const sourcePanelId =
      draggedPanelId || event.dataTransfer.getData("text/plain");
    if (!sourcePanelId || sourcePanelId === targetPanelId) {
      finishPanelDrag();
      return;
    }
    movePanel(sourcePanelId, targetPanelId);
    finishPanelDrag();
  };

  const handlePanelDragEnd = () => {
    finishPanelDrag();
  };

  useEffect(() => {
    if (!pointerDraggingPanel) return;
    const handlePointerUpWindow = () => {
      finishPanelDrag();
    };
    window.addEventListener("pointerup", handlePointerUpWindow);
    return () => {
      window.removeEventListener("pointerup", handlePointerUpWindow);
    };
  }, [pointerDraggingPanel, finishPanelDrag]);

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

  const handleOpenFanclubDetails = (teamId: number) => {
    setSelectedFanclubTeamId(teamId);
    setFanclubDetailsOpen(true);
  };

  const handleOpenArenaDetails = (teamId: number) => {
    setSelectedArenaTeamId(teamId);
    setArenaDetailsOpen(true);
  };

  const handleOpenFormationsTacticsDetails = (teamId: number) => {
    setSelectedFormationsTacticsTeamId(teamId);
    setFormationsTacticsDetailsOpen(true);
  };

  const handleOpenLikelyTrainingDetails = (teamId: number) => {
    setSelectedLikelyTrainingTeamId(teamId);
    setLikelyTrainingDetailsOpen(true);
  };

  const handleOpenWagesDetails = (teamId: number) => {
    setSelectedWagesTeamId(teamId);
    setWagesDetailsOpen(true);
  };

  const handleOpenTsiDetails = (teamId: number) => {
    setSelectedTsiTeamId(teamId);
    setTsiDetailsOpen(true);
  };

  const handleOpenLastLoginDetails = (teamId: number) => {
    setSelectedLastLoginTeamId(teamId);
    setLastLoginDetailsOpen(true);
  };

  const handleOpenCoachDetails = (teamId: number) => {
    setSelectedCoachTeamId(teamId);
    setCoachDetailsOpen(true);
  };

  const handleOpenTransferListedDetails = useCallback((teamId: number) => {
    setSelectedTransferTeamId(teamId);
    setTransferListedDetailsOpen(true);
    void (async () => {
      setLoadingTransferListedModal(true);
      try {
        const listedPlayers =
          chronicleCache.teams[teamId]?.transferActivity?.current?.transferListedPlayers ??
          [];
        if (listedPlayers.length === 0) return;
        const playersToResolve = listedPlayers.filter(
          (player) =>
            player.age == null ||
            player.ageDays == null ||
            player.tsi == null ||
            player.askingPriceSek == null
        );
        if (playersToResolve.length === 0) return;
        const resolved = await Promise.all(
          playersToResolve.map(async (player) => ({
            playerId: player.playerId,
            details: await fetchTransferPlayerDetails(player.playerId),
          }))
        );
        const detailsById = new Map(
          resolved
            .filter((entry) => entry.details !== null)
            .map((entry) => [entry.playerId, entry.details!])
        );
        if (detailsById.size === 0) return;
        setChronicleCache((prev) => {
          const teamCache = prev.teams[teamId];
          const current = teamCache?.transferActivity?.current;
          if (!teamCache || !current) return prev;
          return {
            ...prev,
            teams: {
              ...prev.teams,
              [teamId]: {
                ...teamCache,
                transferActivity: {
                  current: {
                    ...current,
                    transferListedPlayers: current.transferListedPlayers.map(
                      (player) => {
                        const details = detailsById.get(player.playerId);
                        if (!details) return player;
                        return {
                          ...player,
                          age: details.age,
                          ageDays: details.ageDays,
                          tsi: details.tsi,
                          askingPriceSek: details.askingPriceSek,
                        };
                      }
                    ),
                    fetchedAt: Date.now(),
                  },
                  previous: teamCache.transferActivity?.previous,
                },
              },
            },
          };
        });
      } finally {
        setLoadingTransferListedModal(false);
      }
    })();
  }, [chronicleCache]);

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

  const handleArenaSort = (key: string) => {
    setArenaSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleFormationsTacticsSort = (key: string) => {
    setFormationsTacticsSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleLikelyTrainingSort = (key: string) => {
    setLikelyTrainingSortState((prev) => ({
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

  const handleTsiSort = (key: string) => {
    setTsiSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleWagesSort = (key: string) => {
    setWagesSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleLastLoginSort = (key: string) => {
    setLastLoginSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleCoachSort = (key: string) => {
    setCoachSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleWagesDetailsSort = (key: string) => {
    setWagesDetailsSortState((prev) => ({
      key,
      direction:
        prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const handleTsiDetailsSort = (key: string) => {
    setTsiDetailsSortState((prev) => ({
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
          snapshot ? `${formatChppCurrencyFromSek(snapshot.estimatedSek)}*` : null,
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

  const arenaTableColumns = useMemo<
    ChronicleTableColumn<ArenaRow, ArenaSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "arenaName",
        label: messages.clubChronicleArenaColumnName,
        getValue: (snapshot: ArenaSnapshot | undefined) => snapshot?.arenaName ?? null,
      },
      {
        key: "capacity",
        label: messages.clubChronicleArenaColumnCapacity,
        getValue: (snapshot: ArenaSnapshot | undefined) =>
          snapshot?.currentTotalCapacity ?? null,
        renderCell: (
          snapshot: ArenaSnapshot | undefined,
          _row: ArenaRow,
          formatValue
        ) => {
          const isUnderConstruction = snapshot?.expandedAvailable === true;
          return (
            <span className={styles.chronicleArenaCapacityCell}>
              <span>{formatValue(snapshot?.currentTotalCapacity ?? null)}</span>
              {isUnderConstruction ? (
                <Tooltip content={messages.clubChronicleArenaConstructionTooltip}>
                  <span
                    className={styles.chronicleArenaConstructionBadge}
                    aria-label={messages.clubChronicleArenaConstructionTooltip}
                  >
                    🚧
                  </span>
                </Tooltip>
              ) : null}
            </span>
          );
        },
      },
      {
        key: "rebuiltDate",
        label: messages.clubChronicleArenaColumnRebuiltDate,
        getValue: (snapshot: ArenaSnapshot | undefined) =>
          snapshot?.rebuiltDate
            ? formatChppDateTime(snapshot.rebuiltDate) ?? snapshot.rebuiltDate
            : null,
        getSortValue: (snapshot: ArenaSnapshot | undefined) =>
          snapshot?.rebuiltDate ?? null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleArenaColumnName,
      messages.clubChronicleArenaColumnCapacity,
      messages.clubChronicleArenaColumnRebuiltDate,
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

  const formationsTacticsTableColumns = useMemo<
    ChronicleTableColumn<FormationTacticsRow, FormationTacticsSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "formation",
        label: messages.clubChronicleFormationsColumnFormation,
        getValue: (snapshot: FormationTacticsSnapshot | undefined) =>
          snapshot?.topFormation ?? null,
      },
      {
        key: "tactic",
        label: messages.clubChronicleFormationsColumnTactic,
        getValue: (snapshot: FormationTacticsSnapshot | undefined) =>
          snapshot?.topTactic ?? null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleFormationsColumnFormation,
      messages.clubChronicleFormationsColumnTactic,
    ]
  );

  const tsiTableColumns = useMemo<ChronicleTableColumn<TsiRow, TsiSnapshot>[]>(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "totalTsi",
        label: messages.clubChronicleTsiColumnTotal,
        getValue: (snapshot: TsiSnapshot | undefined) => snapshot?.totalTsi ?? null,
      },
      {
        key: "top11Tsi",
        label: messages.clubChronicleTsiColumnTop11,
        getValue: (snapshot: TsiSnapshot | undefined) => snapshot?.top11Tsi ?? null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleTsiColumnTotal,
      messages.clubChronicleTsiColumnTop11,
    ]
  );

  const wagesTableColumns = useMemo<
    ChronicleTableColumn<WagesRow, WagesSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "totalWages",
        label: messages.clubChronicleWagesColumnTotal,
        getValue: (snapshot: WagesSnapshot | undefined) =>
          snapshot ? formatChppCurrencyFromSek(snapshot.totalWagesSek) : null,
        getSortValue: (snapshot: WagesSnapshot | undefined) =>
          snapshot?.totalWagesSek ?? null,
      },
      {
        key: "top11Wages",
        label: messages.clubChronicleWagesColumnTop11,
        getValue: (snapshot: WagesSnapshot | undefined) =>
          snapshot ? formatChppCurrencyFromSek(snapshot.top11WagesSek) : null,
        getSortValue: (snapshot: WagesSnapshot | undefined) =>
          snapshot?.top11WagesSek ?? null,
      },
    ],
    [
      messages.clubChronicleColumnTeam,
      messages.clubChronicleWagesColumnTotal,
      messages.clubChronicleWagesColumnTop11,
    ]
  );

  const formatValue = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") {
      return messages.unknownShort;
    }
    return String(value);
  };
  const normalizeInjuryLevel = useCallback((value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }
    return Math.trunc(value);
  }, []);
  const formatInjuryWeeksValue = useCallback((value: number) => {
    return value === 999 ? "∞" : String(value);
  }, []);

  const formatLikelyTrainingLabel = (key: LikelyTrainingKey | null | undefined) => {
    if (!key) return messages.unknownShort;
    const labels: Record<LikelyTrainingKey, string> = {
      winger: messages.clubChronicleLikelyTrainingWinger,
      playmaking: messages.clubChronicleLikelyTrainingPlaymaking,
      defending: messages.clubChronicleLikelyTrainingDefending,
      passing: messages.clubChronicleLikelyTrainingPassing,
      scoring: messages.clubChronicleLikelyTrainingScoring,
      keepingOrSetPieces: messages.clubChronicleLikelyTrainingKeepingOrSetPieces,
    };
    return labels[key];
  };
  const formatLikelyTrainingSummary = (
    snapshot: FormationTacticsSnapshot | null | undefined
  ) => {
    if (!snapshot) return messages.unknownShort;
    const keys =
      snapshot.likelyTrainingTopKeys && snapshot.likelyTrainingTopKeys.length > 0
        ? snapshot.likelyTrainingTopKeys
        : snapshot.likelyTrainingKey
          ? [snapshot.likelyTrainingKey]
          : [];
    if (keys.length === 0) return messages.unknownShort;
    const label = keys.map((key) => formatLikelyTrainingLabel(key)).join(" / ");
    if (snapshot.likelyTrainingIsUnclear) {
      return `${label} (${messages.clubChronicleLikelyTrainingUnclearTag})`;
    }
    return label;
  };
  const formatStatusTemplate = useCallback(
    (template: string, replacements: Record<string, string | number>) => {
      return Object.entries(replacements).reduce(
        (result, [key, value]) =>
          result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
        template
      );
    },
    []
  );
  const formatInjuryStatusSymbol = useCallback(
    (value: number | null | undefined) => {
      const injuryLevel = normalizeInjuryLevel(value);
      if (injuryLevel === null) return messages.unknownShort;
      if (injuryLevel < 0) return messages.clubChronicleInjuryHealthy;
      if (injuryLevel === 0) return "🩹";
      return `✚[${formatInjuryWeeksValue(injuryLevel)}]`;
    },
    [
      formatInjuryWeeksValue,
      messages.clubChronicleInjuryHealthy,
      messages.unknownShort,
      normalizeInjuryLevel,
    ]
  );
  const formatUpdatesInjuryValue = useCallback(
    (fieldKey: string, value: string | null | undefined) => {
      if (fieldKey !== "wages.injury" || value === null || value === undefined) {
        return value;
      }
      const subscriptToNormal: Record<string, string> = {
        "₀": "0",
        "₁": "1",
        "₂": "2",
        "₃": "3",
        "₄": "4",
        "₅": "5",
        "₆": "6",
        "₇": "7",
        "₈": "8",
        "₉": "9",
        "₋": "-",
      };
      const normalizeWeeks = (weeksRaw: string) => {
        const normalized = weeksRaw
          .split("")
          .map((char) => subscriptToNormal[char] ?? char)
          .join("");
        return normalized === "999" ? "∞" : normalized;
      };
      return value
        .replace(/(?:✚|\+)\s*([₀₁₂₃₄₅₆₇₈₉₋]+)/g, (_match, weeksRaw: string) => {
          return `✚(${normalizeWeeks(weeksRaw)})`;
        })
        .replace(/(?:✚|\+)\s*(\d+)/g, (_match, weeksRaw: string) => {
          return `✚(${normalizeWeeks(weeksRaw)})`;
        })
        .replace(/(?:✚|\+)\[(\d+)\]/g, (_match, weeksRaw: string) => {
          return `✚(${normalizeWeeks(weeksRaw)})`;
        })
        .replace(/(?:✚|\+)\((\d+|∞)\)/g, (_match, weeksRaw: string) => {
          return `✚(${normalizeWeeks(weeksRaw)})`;
        });
    },
    []
  );
  const serializeTransferUpdatePlayers = useCallback(
    (players: TransferUpdatePlayer[]): string => {
      if (players.length === 0) return "-";
      return players
        .map((player) => {
          const rawPlayerId = Number(player.playerId ?? 0);
          const playerId =
            Number.isFinite(rawPlayerId) && rawPlayerId > 0 ? rawPlayerId : 0;
          const label = encodeURIComponent(
            (player.playerName ?? "").trim() || String(playerId)
          );
          return `${playerId}:${label}`;
        })
        .join(",");
    },
    []
  );
  const parseTransferUpdatePlayers = useCallback((value: string) => {
    if (!value || value === "-") return [] as TransferUpdatePlayer[];
    return value
      .split(",")
      .map((entry) => {
        const [idRaw, labelRaw] = entry.split(":");
        const parsedId = Number(idRaw);
        const playerId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
        const playerName = decodeURIComponent(labelRaw ?? "").trim();
        return {
          playerId,
          playerName: playerName || (playerId !== null ? String(playerId) : null),
        } as TransferUpdatePlayer;
      })
      .filter((entry) => entry.playerName !== null);
  }, []);
  const getTransferEntryKey = useCallback((entry: TransferActivityEntry) => {
    if (entry.transferId && Number.isFinite(entry.transferId)) {
      return `id:${entry.transferId}`;
    }
    const playerId = entry.playerId ?? 0;
    const transferType = entry.transferType ?? "?";
    const deadline = entry.deadline ?? "";
    const priceSek = entry.priceSek ?? "";
    return `fallback:${transferType}:${playerId}:${deadline}:${priceSek}`;
  }, []);
  const renderUpdateValue = useCallback(
    (
      fieldKey: string,
      value: string | null | undefined,
      teamId: number | null | undefined,
      leagueLevelUnitId: number | null | undefined
    ) => {
      const formatted = formatUpdatesInjuryValue(fieldKey, value);
      if (formatted === null || formatted === undefined || formatted === "") {
        return messages.unknownShort;
      }
      if (!teamId) {
        return formatted;
      }
      if (
        fieldKey === "transfer.playersSold" ||
        fieldKey === "transfer.playersBought"
      ) {
        const entries = parseTransferUpdatePlayers(formatted);
        if (entries.length === 0) {
          return formatted;
        }
        return entries.map((entry, index) => (
          <span key={`${fieldKey}-${entry.playerId ?? entry.playerName ?? index}-${index}`}>
            {index > 0 ? ", " : ""}
            {entry.playerId ? (
              <a
                className={styles.chroniclePressLink}
                href={hattrickPlayerUrl(entry.playerId)}
                target="_blank"
                rel="noreferrer"
              >
                {entry.playerName}
              </a>
            ) : (
              entry.playerName
            )}
          </span>
        ));
      }
      if (fieldKey === "wages.injury") {
        const teamWages = chronicleCache.teams[teamId]?.wages;
        const playerIdByName = new Map<string, number>();
        const ingestPlayers = (
          players:
            | { playerId: number; playerName: string | null }[]
            | undefined
            | null
        ) => {
          players?.forEach((player) => {
            if (
              player &&
              Number.isFinite(player.playerId) &&
              player.playerName &&
              !playerIdByName.has(player.playerName)
            ) {
              playerIdByName.set(player.playerName, player.playerId);
            }
          });
        };
        ingestPlayers(teamWages?.current?.players);
        ingestPlayers(teamWages?.previous?.players);
        const entries = formatted.split(/\s*,\s*/).filter(Boolean);
        if (entries.length > 0) {
          return entries.map((entry, index) => {
            const match = entry.match(/^(.*)\s+(🩹|✚\([^)]+\))$/);
            if (!match) {
              return (
                <span key={`injury-raw-${index}`}>
                  {index > 0 ? ", " : ""}
                  {entry}
                </span>
              );
            }
            const label = match[1].trim();
            const status = match[2];
            let playerId = playerIdByName.get(label);
            if (!playerId) {
              const numericLabel = Number(label);
              if (Number.isFinite(numericLabel) && numericLabel > 0) {
                playerId = numericLabel;
              }
            }
            return (
              <span key={`injury-entry-${index}`}>
                {index > 0 ? ", " : ""}
                {playerId ? (
                  <a
                    className={styles.chroniclePressLink}
                    href={hattrickPlayerUrl(playerId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {label}
                  </a>
                ) : (
                  label
                )}{" "}
                {status}
              </span>
            );
          });
        }
      }
      let href: string | null = null;
      if (
        fieldKey === "press.announcement" ||
        fieldKey.startsWith("fanclub.") ||
        fieldKey.startsWith("lastLogin.") ||
        fieldKey.startsWith("coach.")
      ) {
        href = hattrickTeamUrl(teamId);
      } else if (
        fieldKey.startsWith("wages.") ||
        fieldKey.startsWith("tsi.") ||
        fieldKey === "team.playerCount" ||
        fieldKey === "transfer.active" ||
        fieldKey === "transfer.listed"
      ) {
        href = hattrickTeamPlayersUrl(teamId);
      } else if (fieldKey === "transfer.history") {
        href = hattrickTeamTransfersUrl(teamId);
      } else if (
        fieldKey === "league.goalsDelta" ||
        fieldKey === "league.record" ||
        fieldKey === "league.series"
      ) {
        if (leagueLevelUnitId) {
          href = hattrickSeriesUrl(leagueLevelUnitId, teamId);
        }
      }
      if (!href) {
        return formatted;
      }
      return (
        <a
          className={styles.chroniclePressLink}
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {formatted}
        </a>
      );
    },
    [
      chronicleCache.teams,
      formatUpdatesInjuryValue,
      messages.unknownShort,
      parseTransferUpdatePlayers,
    ]
  );
  const renderInjuryStatusInline = useCallback(
    (value: number | null | undefined) => {
      const injuryLevel = normalizeInjuryLevel(value);
      if (injuryLevel === null || injuryLevel < 0) return null;
      if (injuryLevel === 0) {
        return (
          <span
            className={`${styles.chronicleInjuryBruised} ${styles.chronicleInjuryInline}`}
            title={messages.clubChronicleInjuryBruised}
            aria-label={messages.clubChronicleInjuryBruised}
          >
            🩹
          </span>
        );
      }
      const injuryWeeks = formatInjuryWeeksValue(injuryLevel);
      const injuryLabel = formatStatusTemplate(messages.clubChronicleInjuryInjuredWeeks, {
        weeks: injuryWeeks,
      });
      return (
        <span
          className={`${styles.chronicleInjuryInjured} ${styles.chronicleInjuryInline}`}
          title={injuryLabel}
          aria-label={injuryLabel}
        >
          <span className={styles.chronicleInjuryCross}>✚</span>
          <sub className={styles.chronicleInjuryWeeks}>{injuryWeeks}</sub>
        </span>
      );
    },
    [
      formatInjuryWeeksValue,
      formatStatusTemplate,
      messages.clubChronicleInjuryBruised,
      messages.clubChronicleInjuryInjuredWeeks,
      normalizeInjuryLevel,
    ]
  );
  const buildInjurySummary = useCallback(
    (
      snapshot: WagesSnapshot | null | undefined,
      playerIdFilter?: Set<number> | null
    ) => {
      if (!snapshot) return messages.unknownShort;
      const knownPlayers = snapshot.players.filter(
        (player) => normalizeInjuryLevel(player.injuryLevel) !== null
      );
      if (knownPlayers.length === 0) return messages.unknownShort;
      const scopedPlayers =
        playerIdFilter && playerIdFilter.size > 0
          ? knownPlayers.filter((player) => playerIdFilter.has(player.playerId))
          : knownPlayers;
      if (scopedPlayers.length === 0) return messages.unknownShort;
      const injuredOrBruisedPlayers = scopedPlayers
        .filter((player) => {
          const injuryLevel = normalizeInjuryLevel(player.injuryLevel);
          return injuryLevel !== null && injuryLevel >= 0;
        })
        .sort((left, right) => left.playerId - right.playerId);
      if (injuredOrBruisedPlayers.length === 0) {
        return messages.clubChronicleInjuryHealthy;
      }
      return injuredOrBruisedPlayers
        .map((player) => {
          const label = player.playerName ?? `${player.playerId}`;
          return `${label} ${formatInjuryStatusSymbol(player.injuryLevel)}`;
        })
        .join(", ");
    },
    [
      formatInjuryStatusSymbol,
      messages.clubChronicleInjuryHealthy,
      messages.unknownShort,
      normalizeInjuryLevel,
    ]
  );
  const renderTeamNameLink = useCallback(
    (teamId: number | null | undefined, teamName: string | null | undefined) => {
      const label = teamName ?? messages.unknownShort;
      if (!teamId) return label;
      return (
        <a
          className={styles.chroniclePressLink}
          href={hattrickTeamUrl(teamId)}
          target="_blank"
          rel="noreferrer"
        >
          {label}
        </a>
      );
    },
    [messages.unknownShort]
  );

  const formatMatchTypeLabel = useCallback(
    (matchType: number | null | undefined) => {
      switch (matchType) {
        case 1:
          return messages.clubChronicleMatchTypeLeague;
        case 2:
          return messages.clubChronicleMatchTypeQualification;
        case 3:
          return messages.clubChronicleMatchTypeCup;
        case 4:
          return messages.clubChronicleMatchTypeFriendlyNormal;
        case 5:
          return messages.clubChronicleMatchTypeFriendlyCup;
        case 7:
          return messages.clubChronicleMatchTypeMasters;
        case 8:
          return messages.clubChronicleMatchTypeInternationalFriendlyNormal;
        case 9:
          return messages.clubChronicleMatchTypeInternationalFriendlyCup;
        default:
          return messages.clubChronicleMatchTypeUnknown;
      }
    },
    [
      messages.clubChronicleMatchTypeCup,
      messages.clubChronicleMatchTypeFriendlyCup,
      messages.clubChronicleMatchTypeFriendlyNormal,
      messages.clubChronicleMatchTypeInternationalFriendlyCup,
      messages.clubChronicleMatchTypeInternationalFriendlyNormal,
      messages.clubChronicleMatchTypeLeague,
      messages.clubChronicleMatchTypeMasters,
      messages.clubChronicleMatchTypeQualification,
      messages.clubChronicleMatchTypeUnknown,
    ]
  );

  const getUpdateFieldLabel = (fieldKey: string, fallbackLabel: string) => {
    switch (fieldKey) {
      case "league.position":
        return messages.clubChronicleColumnPosition;
      case "league.points":
        return messages.clubChronicleColumnPoints;
      case "press.announcement":
        return messages.clubChroniclePressColumnAnnouncement;
      case "fanclub.name":
        return messages.clubChronicleFanclubColumnName;
      case "fanclub.size":
        return messages.clubChronicleFanclubColumnSize;
      case "arena.name":
        return messages.clubChronicleArenaColumnName;
      case "arena.capacity":
        return messages.clubChronicleArenaColumnCapacity;
      case "arena.rebuiltDate":
        return messages.clubChronicleArenaColumnRebuiltDate;
      case "finance.estimate":
        return messages.clubChronicleFinanceColumnEstimate;
      case "transfer.listed":
      case "transfer.active":
        return messages.clubChronicleTransferColumnActive;
      case "transfer.history":
        return messages.clubChronicleTransferColumnHistory;
      case "transfer.playersSold":
        return messages.clubChronicleTransferPlayersSold;
      case "transfer.playersBought":
        return messages.clubChronicleTransferPlayersBought;
      case "formationsTactics.formation":
        return messages.clubChronicleFormationsColumnFormation;
      case "formationsTactics.tactic":
        return messages.clubChronicleFormationsColumnTactic;
      case "likelyTraining.regimen":
        return messages.clubChronicleLikelyTrainingColumnRegimen;
      case "lastLogin.latest":
        return messages.clubChronicleLastLoginColumnLatest;
      case "coach.name":
        return messages.clubChronicleCoachColumnName;
      case "coach.leadership":
        return messages.clubChronicleCoachColumnLeadership;
      case "coach.trainerLevel":
        return messages.clubChronicleCoachColumnTrainerLevel;
      case "coach.status":
        return messages.clubChronicleCoachColumnStatus;
      case "tsi.total":
        return messages.clubChronicleTsiColumnTotal;
      case "tsi.top11":
        return messages.clubChronicleTsiColumnTop11;
      case "wages.total":
        return messages.clubChronicleWagesColumnTotal;
      case "wages.top11":
        return messages.clubChronicleWagesColumnTop11;
      case "wages.injury":
        return messages.clubChronicleWagesInjuryColumn;
      case "team.playerCount":
        return messages.clubChroniclePlayersCount;
      default:
        return fallbackLabel;
    }
  };

  const likelyTrainingTableColumns = useMemo<
    ChronicleTableColumn<LikelyTrainingRow, FormationTacticsSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "likelyTraining",
        label: messages.clubChronicleLikelyTrainingColumnRegimen,
        getValue: (snapshot: FormationTacticsSnapshot | undefined) =>
          formatLikelyTrainingSummary(snapshot),
      },
    ],
    [
      formatLikelyTrainingSummary,
      messages.clubChronicleColumnTeam,
      messages.clubChronicleLikelyTrainingColumnRegimen,
    ]
  );

  const lastLoginTableColumns = useMemo<
    ChronicleTableColumn<LastLoginRow, LastLoginSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "latestLogin",
        label: messages.clubChronicleLastLoginColumnLatest,
        getValue: (snapshot: LastLoginSnapshot | undefined) => {
          const dateTime = formatLastLoginDateTime(snapshot?.latestLoginDateTime);
          const age = formatLastLoginAge(
            parseLoginTimeToTimestamp(snapshot?.latestLoginDateTime)
          );
          if (dateTime && age) return `${dateTime} (${age})`;
          return dateTime;
        },
        getSortValue: (snapshot: LastLoginSnapshot | undefined) =>
          parseLoginTimeToTimestamp(snapshot?.latestLoginDateTime),
      },
    ],
    [
      formatLastLoginAge,
      formatLastLoginDateTime,
      messages.clubChronicleColumnTeam,
      messages.clubChronicleLastLoginColumnLatest,
      parseLoginTimeToTimestamp,
    ]
  );

  const formatCoachMindset = useCallback(
    (trainerType: number | null | undefined) => {
      switch (trainerType) {
        case 0:
          return messages.clubChronicleCoachMindsetDefensive;
        case 1:
          return messages.clubChronicleCoachMindsetOffensive;
        case 2:
          return messages.clubChronicleCoachMindsetBalanced;
        default:
          return messages.unknownShort;
      }
    },
    [
      messages.clubChronicleCoachMindsetBalanced,
      messages.clubChronicleCoachMindsetDefensive,
      messages.clubChronicleCoachMindsetOffensive,
      messages.unknownShort,
    ]
  );

  const formatCoachStatus = useCallback(
    (trainerStatus: number | null | undefined) => {
      switch (trainerStatus) {
        case 1:
          return messages.clubChronicleCoachStatusPlayingTrainer;
        case 2:
          return messages.clubChronicleCoachStatusOnlyTrainer;
        case 3:
          return messages.clubChronicleCoachStatusHofTrainer;
        default:
          return messages.unknownShort;
      }
    },
    [
      messages.clubChronicleCoachStatusHofTrainer,
      messages.clubChronicleCoachStatusOnlyTrainer,
      messages.clubChronicleCoachStatusPlayingTrainer,
      messages.unknownShort,
    ]
  );

  const formatSkillLevelLabel = useCallback(
    (value: number | null | undefined) => {
      if (value === null || value === undefined || !Number.isFinite(value)) {
        return messages.unknownShort;
      }
      const normalized = Math.trunc(value);
      const labels = [
        messages.skillLevel0,
        messages.skillLevel1,
        messages.skillLevel2,
        messages.skillLevel3,
        messages.skillLevel4,
        messages.skillLevel5,
        messages.skillLevel6,
        messages.skillLevel7,
        messages.skillLevel8,
        messages.skillLevel9,
        messages.skillLevel10,
        messages.skillLevel11,
        messages.skillLevel12,
        messages.skillLevel13,
        messages.skillLevel14,
        messages.skillLevel15,
        messages.skillLevel16,
        messages.skillLevel17,
        messages.skillLevel18,
        messages.skillLevel19,
        messages.skillLevel20,
      ];
      if (normalized < 0 || normalized >= labels.length) {
        return String(normalized);
      }
      return labels[normalized];
    },
    [
      messages.skillLevel0,
      messages.skillLevel1,
      messages.skillLevel2,
      messages.skillLevel3,
      messages.skillLevel4,
      messages.skillLevel5,
      messages.skillLevel6,
      messages.skillLevel7,
      messages.skillLevel8,
      messages.skillLevel9,
      messages.skillLevel10,
      messages.skillLevel11,
      messages.skillLevel12,
      messages.skillLevel13,
      messages.skillLevel14,
      messages.skillLevel15,
      messages.skillLevel16,
      messages.skillLevel17,
      messages.skillLevel18,
      messages.skillLevel19,
      messages.skillLevel20,
      messages.unknownShort,
    ]
  );

  const coachTableColumns = useMemo<
    ChronicleTableColumn<CoachRow, CoachSnapshot>[]
  >(
    () => [
      {
        key: "team",
        label: messages.clubChronicleColumnTeam,
        getValue: (_snapshot, row) => row?.teamName ?? null,
      },
      {
        key: "coachName",
        label: messages.clubChronicleCoachColumnName,
        getValue: (snapshot: CoachSnapshot | undefined) => snapshot?.name ?? null,
      },
      {
        key: "leadership",
        label: messages.clubChronicleCoachColumnLeadership,
        getValue: (snapshot: CoachSnapshot | undefined) =>
          formatSkillLevelLabel(snapshot?.leadership),
        getSortValue: (snapshot: CoachSnapshot | undefined) =>
          snapshot?.leadership ?? null,
      },
      {
        key: "trainerLevel",
        label: messages.clubChronicleCoachColumnTrainerLevel,
        getValue: (snapshot: CoachSnapshot | undefined) =>
          snapshot?.trainerSkillLevel ?? null,
      },
    ],
    [
      formatSkillLevelLabel,
      messages.clubChronicleCoachColumnLeadership,
      messages.clubChronicleCoachColumnName,
      messages.clubChronicleCoachColumnTrainerLevel,
      messages.clubChronicleColumnTeam,
    ]
  );

  const parseNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const parseNumberNode = (value: unknown): number | null => {
    if (value && typeof value === "object" && "#text" in (value as RawNode)) {
      return parseNumber((value as RawNode)["#text"]);
    }
    return parseNumber(value);
  };

  const parseStringNode = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === "object" && "#text" in (value as RawNode)) {
      const text = (value as RawNode)["#text"];
      if (typeof text !== "string") return null;
      const trimmed = text.trim();
      return trimmed ? trimmed : null;
    }
    return null;
  };

  const parsePositionChangeNode = (value: unknown): string | null => {
    const numericValue = parseNumberNode(value);
    if (numericValue === 0) return "-";
    if (numericValue === 1) return "↑";
    if (numericValue === 2) return "↓";

    const stringValue = parseStringNode(value);
    if (!stringValue) return null;
    const normalized = stringValue.trim().toLowerCase();
    if (normalized === "up" || normalized === "uparrow") return "↑";
    if (normalized === "down" || normalized === "downarrow") return "↓";
    if (normalized === "none" || normalized === "no change") return "-";
    return stringValue;
  };

  const resolveCoachCountryName = useCallback(
    async (countryId: number | null | undefined) => {
      if (!countryId || !Number.isFinite(countryId) || countryId <= 0) {
        return null;
      }
      const cached = coachCountryNameCacheRef.current.get(countryId);
      if (cached) return cached;
      const pending = coachCountryNamePendingRef.current.get(countryId);
      if (pending) return pending;

      const request = (async (): Promise<string | null> => {
        try {
          const { response, payload } = await fetchChppJson<{
            data?: {
              HattrickData?: {
                LeagueList?: {
                  League?: RawNode | RawNode[];
                };
              };
            };
            error?: string;
          }>(`/api/chpp/worlddetails?countryId=${countryId}`, { cache: "no-store" });
          if (!response.ok || payload?.error) return null;

          const leagues = toArray(
            payload?.data?.HattrickData?.LeagueList?.League as
              | RawNode
              | RawNode[]
              | undefined
          );

          for (const league of leagues) {
            const country = league.Country as RawNode | undefined;
            if (!country) continue;
            const resolvedId = parseNumberNode(country.CountryID);
            const resolvedName = parseStringNode(country.CountryName);
            if (
              resolvedId &&
              resolvedName &&
              Number.isFinite(resolvedId) &&
              resolvedId > 0
            ) {
              coachCountryNameCacheRef.current.set(resolvedId, resolvedName);
            }
          }

          return coachCountryNameCacheRef.current.get(countryId) ?? null;
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          return null;
        } finally {
          coachCountryNamePendingRef.current.delete(countryId);
        }
      })();

      coachCountryNamePendingRef.current.set(countryId, request);
      return request;
    },
    []
  );

  const parseBooleanNode = (value: unknown): boolean | null => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return null;
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
      return null;
    }
    if (typeof value === "object" && "#text" in (value as RawNode)) {
      return parseBooleanNode((value as RawNode)["#text"]);
    }
    return null;
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

  const convertSekToEur = (valueSek: number | null | undefined) => {
    if (valueSek === null || valueSek === undefined) return null;
    return valueSek / CHPP_SEK_PER_EUR;
  };

  const formatChppCurrencyFromSek = (valueSek: number | null | undefined) =>
    formatEuro(convertSekToEur(valueSek));

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

  function parseLoginTimeToTimestamp(loginTime: string | null | undefined) {
    if (!loginTime) return null;
    const parsedEntry = parseLastLoginEntry(loginTime);
    if (!parsedEntry.dateTime) return null;
    const parsed = parseChppDate(parsedEntry.dateTime)?.getTime();
    if (parsed && Number.isFinite(parsed)) return parsed;
    const fallback = Date.parse(parsedEntry.dateTime.replace(" ", "T"));
    return Number.isFinite(fallback) ? fallback : null;
  }

  function parseLastLoginEntry(entry: string): LastLoginEvent {
    const trimmed = entry.trim();
    const match = trimmed.match(
      /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(?:\s+(.+))?$/
    );
    if (!match) {
      return {
        dateTime: parseStringNode(trimmed),
        ipAddress: null,
        raw: trimmed,
      };
    }
    const normalizedIp = normalizeLastLoginIpAddress(match[2] ?? "");
    return {
      dateTime: match[1] ?? null,
      ipAddress: normalizedIp || null,
      raw: trimmed,
    };
  }

  function normalizeLastLoginIpAddress(value: string | null | undefined) {
    if (!value) return null;
    const normalized = value
      .replace(/^[^0-9a-fA-F*]+/, "")
      .replace(/[^0-9a-fA-F*.:]+$/, "")
      .trim();
    return normalized || null;
  }

  function formatLastLoginDateTime(dateTime: string | null | undefined) {
    if (!dateTime) return null;
    const timestamp = parseLoginTimeToTimestamp(dateTime);
    if (timestamp !== null) {
      return formatDateTime(timestamp);
    }
    return formatChppDateTime(dateTime) ?? dateTime;
  }

  function formatLastLoginAge(timestamp: number | null) {
    if (timestamp === null) return null;
    const diff = Math.max(0, Date.now() - timestamp);
    const totalHours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return formatStatusTemplate(messages.clubChronicleLastLoginAgeFormat, {
      days,
      hours,
    });
  }

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
    panels: UpdatePanel[],
    options?: { baselineCache?: ChronicleCache | null; teamIds?: number[] }
  ): ChronicleUpdates => {
    const updatesMap: ChronicleUpdates["teams"] = {};
    const baselineCache = options?.baselineCache ?? null;
    const teamScope = options?.teamIds
      ? new Set(options.teamIds.map((teamId) => Number(teamId)))
      : null;
    trackedTeams.forEach((team) => {
      const teamId = team.teamId;
      if (teamScope && !teamScope.has(teamId)) return;
      const cached = nextCache.teams[teamId];
      if (!cached) return;
      const baselineTeam = baselineCache?.teams[teamId];
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
        const previous = baselineCache
          ? baselineTeam?.leaguePerformance?.current
          : cached.leaguePerformance?.previous;
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
        const previous = baselineCache
          ? baselineTeam?.pressAnnouncement?.current
          : cached.pressAnnouncement?.previous;
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
        const previous = baselineCache
          ? baselineTeam?.fanclub?.current
          : cached.fanclub?.previous;
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

      if (panels.includes("arena")) {
        const previous = baselineCache
          ? baselineTeam?.arena?.current
          : cached.arena?.previous;
        const current = cached.arena?.current;
        if (current && previous) {
          const arenaChanges: ChronicleUpdateField[] = [];
          if (previous.arenaName !== current.arenaName) {
            arenaChanges.push({
              fieldKey: "arena.name",
              label: messages.clubChronicleArenaColumnName,
              previous: formatValue(previous.arenaName),
              current: formatValue(current.arenaName),
            });
          }
          if (previous.currentTotalCapacity !== current.currentTotalCapacity) {
            arenaChanges.push({
              fieldKey: "arena.capacity",
              label: messages.clubChronicleArenaColumnCapacity,
              previous: formatValue(previous.currentTotalCapacity),
              current: formatValue(current.currentTotalCapacity),
            });
          }
          if (previous.rebuiltDate !== current.rebuiltDate) {
            arenaChanges.push({
              fieldKey: "arena.rebuiltDate",
              label: messages.clubChronicleArenaColumnRebuiltDate,
              previous: formatValue(
                previous.rebuiltDate
                  ? formatChppDateTime(previous.rebuiltDate) ?? previous.rebuiltDate
                  : null
              ),
              current: formatValue(
                current.rebuiltDate
                  ? formatChppDateTime(current.rebuiltDate) ?? current.rebuiltDate
                  : null
              ),
            });
          }
          appendTeamChanges(updatesMap, teamId, teamName, arenaChanges);
        }
      }

      if (panels.includes("finance")) {
        const previous = baselineCache
          ? baselineTeam?.financeEstimate?.current
          : cached.financeEstimate?.previous;
        const current = cached.financeEstimate?.current;
        if (current && previous && previous.estimatedSek !== current.estimatedSek) {
          appendTeamChanges(updatesMap, teamId, teamName, [
            {
              fieldKey: "finance.estimate",
              label: messages.clubChronicleFinanceColumnEstimate,
              previous: `${formatChppCurrencyFromSek(previous.estimatedSek)}*`,
              current: `${formatChppCurrencyFromSek(current.estimatedSek)}*`,
            },
          ]);
        }
      }

      if (panels.includes("transfer")) {
        const previous = baselineCache
          ? baselineTeam?.transferActivity?.current
          : cached.transferActivity?.previous;
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

            const previousTransfers = previous.latestTransfers ?? [];
            const currentTransfers = current.latestTransfers ?? [];
            const previousTransferKeys = new Set(
              previousTransfers.map((entry) => getTransferEntryKey(entry))
            );
            const newlyObservedTransfers = currentTransfers.filter(
              (entry) => !previousTransferKeys.has(getTransferEntryKey(entry))
            );

            const salesDelta = Math.max(0, currentSales - previousSales);
            if (salesDelta > 0) {
              const soldPlayers = newlyObservedTransfers
                .filter((entry) => entry.transferType === "S")
                .slice(0, salesDelta)
                .map((entry) => ({
                  playerId: entry.playerId,
                  playerName: entry.resolvedPlayerName ?? entry.playerName,
                }));
              if (soldPlayers.length > 0) {
                transferChanges.push({
                  fieldKey: "transfer.playersSold",
                  label: messages.clubChronicleTransferPlayersSold,
                  previous: "-",
                  current: serializeTransferUpdatePlayers(soldPlayers),
                });
              }
            }

            const buysDelta = Math.max(0, currentBuys - previousBuys);
            if (buysDelta > 0) {
              const boughtPlayers = newlyObservedTransfers
                .filter((entry) => entry.transferType === "B")
                .slice(0, buysDelta)
                .map((entry) => ({
                  playerId: entry.playerId,
                  playerName: entry.resolvedPlayerName ?? entry.playerName,
                }));
              if (boughtPlayers.length > 0) {
                transferChanges.push({
                  fieldKey: "transfer.playersBought",
                  label: messages.clubChronicleTransferPlayersBought,
                  previous: "-",
                  current: serializeTransferUpdatePlayers(boughtPlayers),
                });
              }
            }
          }
          appendTeamChanges(updatesMap, teamId, teamName, transferChanges);
        }
      }

      if (panels.includes("formationsTactics")) {
        const previous = baselineCache
          ? baselineTeam?.formationsTactics?.current
          : cached.formationsTactics?.previous;
        const current = cached.formationsTactics?.current;
        if (current && previous) {
          const formationTacticsChanges: ChronicleUpdateField[] = [];
          if (previous.topFormation !== current.topFormation) {
            formationTacticsChanges.push({
              fieldKey: "formationsTactics.formation",
              label: messages.clubChronicleFormationsColumnFormation,
              previous: formatValue(previous.topFormation),
              current: formatValue(current.topFormation),
            });
          }
          if (previous.topTactic !== current.topTactic) {
            formationTacticsChanges.push({
              fieldKey: "formationsTactics.tactic",
              label: messages.clubChronicleFormationsColumnTactic,
              previous: formatValue(previous.topTactic),
              current: formatValue(current.topTactic),
            });
          }
          appendTeamChanges(
            updatesMap,
            teamId,
            teamName,
            formationTacticsChanges
          );
        }
      }

      if (panels.includes("likelyTraining")) {
        const previous = baselineCache
          ? baselineTeam?.formationsTactics?.current
          : cached.formationsTactics?.previous;
        const current = cached.formationsTactics?.current;
        if (current && previous) {
          const likelyTrainingChanges: ChronicleUpdateField[] = [];
          const previousRegimenLabel = formatLikelyTrainingSummary(previous);
          const currentRegimenLabel = formatLikelyTrainingSummary(current);
          if (previousRegimenLabel !== currentRegimenLabel) {
            likelyTrainingChanges.push({
              fieldKey: "likelyTraining.regimen",
              label: messages.clubChronicleLikelyTrainingColumnRegimen,
              previous: previousRegimenLabel,
              current: currentRegimenLabel,
            });
          }
          appendTeamChanges(updatesMap, teamId, teamName, likelyTrainingChanges);
        }
      }

      if (panels.includes("lastLogin")) {
        const previous = baselineCache
          ? baselineTeam?.lastLogin?.current
          : cached.lastLogin?.previous;
        const current = cached.lastLogin?.current;
        if (
          current &&
          previous &&
          previous.latestLoginDateTime !== current.latestLoginDateTime
        ) {
          appendTeamChanges(updatesMap, teamId, teamName, [
            {
              fieldKey: "lastLogin.latest",
              label: messages.clubChronicleLastLoginColumnLatest,
              previous: formatValue(
                formatLastLoginDateTime(previous.latestLoginDateTime)
              ),
              current: formatValue(
                formatLastLoginDateTime(current.latestLoginDateTime)
              ),
            },
          ]);
        }
      }

      if (panels.includes("coach")) {
        const previous = baselineCache ? baselineTeam?.coach?.current : cached.coach?.previous;
        const current = cached.coach?.current;
        if (current && previous) {
          const coachChanges: ChronicleUpdateField[] = [];
          if (previous.name !== current.name) {
            coachChanges.push({
              fieldKey: "coach.name",
              label: messages.clubChronicleCoachColumnName,
              previous: formatValue(previous.name),
              current: formatValue(current.name),
            });
          }
          if (previous.leadership !== current.leadership) {
            coachChanges.push({
              fieldKey: "coach.leadership",
              label: messages.clubChronicleCoachColumnLeadership,
              previous: formatSkillLevelLabel(previous.leadership),
              current: formatSkillLevelLabel(current.leadership),
            });
          }
          if (previous.trainerSkillLevel !== current.trainerSkillLevel) {
            coachChanges.push({
              fieldKey: "coach.trainerLevel",
              label: messages.clubChronicleCoachColumnTrainerLevel,
              previous: formatValue(previous.trainerSkillLevel),
              current: formatValue(current.trainerSkillLevel),
            });
          }
          if (previous.trainerStatus !== current.trainerStatus) {
            coachChanges.push({
              fieldKey: "coach.status",
              label: messages.clubChronicleCoachColumnStatus,
              previous: formatCoachStatus(previous.trainerStatus),
              current: formatCoachStatus(current.trainerStatus),
            });
          }
          appendTeamChanges(updatesMap, teamId, teamName, coachChanges);
        }
      }

      if (panels.includes("tsi")) {
        const previous = baselineCache
          ? baselineTeam?.tsi?.current
          : cached.tsi?.previous;
        const current = cached.tsi?.current;
        if (current && previous) {
          const tsiChanges: ChronicleUpdateField[] = [];
          if (previous.totalTsi !== current.totalTsi) {
            tsiChanges.push({
              fieldKey: "tsi.total",
              label: messages.clubChronicleTsiColumnTotal,
              previous: formatValue(previous.totalTsi),
              current: formatValue(current.totalTsi),
            });
          }
          if (previous.top11Tsi !== current.top11Tsi) {
            tsiChanges.push({
              fieldKey: "tsi.top11",
              label: messages.clubChronicleTsiColumnTop11,
              previous: formatValue(previous.top11Tsi),
              current: formatValue(current.top11Tsi),
            });
          }
          if (previous.players.length !== current.players.length) {
            tsiChanges.push({
              fieldKey: "team.playerCount",
              label: messages.clubChroniclePlayersCount,
              previous: formatValue(previous.players.length),
              current: formatValue(current.players.length),
            });
          }
          appendTeamChanges(updatesMap, teamId, teamName, tsiChanges);
        }
      }

      if (panels.includes("wages")) {
        const previous = baselineCache
          ? baselineTeam?.wages?.current
          : cached.wages?.previous;
        const current = cached.wages?.current;
        if (current && previous) {
          const wageChanges: ChronicleUpdateField[] = [];
          if (previous.totalWagesSek !== current.totalWagesSek) {
            wageChanges.push({
              fieldKey: "wages.total",
              label: messages.clubChronicleWagesColumnTotal,
              previous: formatChppCurrencyFromSek(previous.totalWagesSek),
              current: formatChppCurrencyFromSek(current.totalWagesSek),
            });
          }
          if (previous.top11WagesSek !== current.top11WagesSek) {
            wageChanges.push({
              fieldKey: "wages.top11",
              label: messages.clubChronicleWagesColumnTop11,
              previous: formatChppCurrencyFromSek(previous.top11WagesSek),
              current: formatChppCurrencyFromSek(current.top11WagesSek),
            });
          }
          const previousInjuryByPlayerId = new Map<number, number | null>(
            (previous?.players ?? []).map((player) => [
              player.playerId,
              normalizeInjuryLevel(player.injuryLevel),
            ])
          );
          const currentInjuryByPlayerId = new Map<number, number | null>(
            (current?.players ?? []).map((player) => [
              player.playerId,
              normalizeInjuryLevel(player.injuryLevel),
            ])
          );
          const changedInjuryPlayerIds = new Set<number>();
          const mergedInjuryPlayerIds = new Set<number>([
            ...previousInjuryByPlayerId.keys(),
            ...currentInjuryByPlayerId.keys(),
          ]);
          mergedInjuryPlayerIds.forEach((playerId) => {
            if (
              previousInjuryByPlayerId.get(playerId) !==
              currentInjuryByPlayerId.get(playerId)
            ) {
              changedInjuryPlayerIds.add(playerId);
            }
          });
          if (changedInjuryPlayerIds.size > 0) {
            const previousInjury = buildInjurySummary(
              previous,
              changedInjuryPlayerIds
            );
            const currentInjury = buildInjurySummary(
              current,
              changedInjuryPlayerIds
            );
            wageChanges.push({
              fieldKey: "wages.injury",
              label: messages.clubChronicleWagesInjuryColumn,
              previous: previousInjury,
              current: currentInjury,
            });
          }
          appendTeamChanges(updatesMap, teamId, teamName, wageChanges);
        }
      }
    });
    return {
      generatedAt: Date.now(),
      teams: updatesMap,
    };
  };

  const hasAnyChanges = (nextUpdates: ChronicleUpdates) =>
    Object.values(nextUpdates.teams).some(
      (teamUpdate) => teamUpdate.changes.length > 0
    );

  const pushGlobalUpdateHistory = useCallback(
    (entry: ChronicleGlobalUpdateEntry) => {
      setGlobalUpdatesHistory((prev) =>
        [entry, ...prev].slice(0, updatesHistoryCount)
      );
      setLastGlobalComparedAt(entry.comparedAt);
      setLastGlobalHadChanges(entry.hasChanges);
    },
    [updatesHistoryCount]
  );

  const refreshTeamDetails = async (
    nextCache: ChronicleCache,
    nextManualTeams: ManualTeam[],
    options: { updatePress: boolean; teams?: ChronicleTeamData[] }
  ) => {
    const teams = options.teams ?? trackedTeams;
    await mapWithConcurrency(
      teams,
      TEAM_REFRESH_CONCURRENCY,
      async (team) => {
        try {
          const { response, payload } = await fetchChppJson<{
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
                Arena?: {
                  ArenaID?: number | string;
                  ArenaName?: string;
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
        }>(
          `/api/chpp/teamdetails?teamId=${team.teamId}`,
          { cache: "no-store" }
        );
        if (!response.ok || payload?.error) return;
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
        if (!teamDetails) return;
        const meta = resolveTeamDetailsMeta(teamDetails);
        const pressSnapshot = resolvePressAnnouncement(teamDetails) ?? {
          subject: null,
          body: null,
          sendDate: null,
          fetchedAt: Date.now(),
        };
        const fanclubSnapshot = resolveFanclub(teamDetails) ?? {
          fanclubName: null,
          fanclubSize: null,
          fetchedAt: Date.now(),
        };
        const nextTeamName = teamDetails?.TeamName ?? team.teamName ?? "";
        const previousPress = nextCache.teams[team.teamId]?.pressAnnouncement?.current;
        const existingFanclub = nextCache.teams[team.teamId]?.fanclub;
        const previousFanclubCurrent = existingFanclub?.current;
        const fanclubChanged = previousFanclubCurrent
          ? previousFanclubCurrent.fanclubName !== fanclubSnapshot.fanclubName ||
            previousFanclubCurrent.fanclubSize !== fanclubSnapshot.fanclubSize
          : true;
        const nextFanclubPrevious =
          fanclubChanged ? previousFanclubCurrent : existingFanclub?.previous;
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: nextTeamName,
          leagueName: meta.leagueName,
          leagueLevelUnitName: meta.leagueLevelUnitName,
          leagueLevelUnitId: meta.leagueLevelUnitId,
          arenaId: meta.arenaId,
          arenaName: meta.arenaName,
          leaguePerformance: nextCache.teams[team.teamId]?.leaguePerformance,
          pressAnnouncement:
            options.updatePress
              ? {
                  current: pressSnapshot,
                  previous: previousPress,
                }
              : nextCache.teams[team.teamId]?.pressAnnouncement,
          fanclub: {
            current: fanclubSnapshot,
            previous: nextFanclubPrevious,
          },
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
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          // ignore teamdetails failure for now
        }
      }
    );
  };

  const refreshLeagueSnapshots = async (
    nextCache: ChronicleCache,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    const leagueDetailsByUnit = new Map<number, RawNode>();
    const teamsWithLeague = teams
      .map((team) => nextCache.teams[team.teamId] ?? team)
      .filter((team) => team.leagueLevelUnitId);
    const leagueUnitIds = Array.from(
      new Set(
        teamsWithLeague
          .map((team) => Number(team.leagueLevelUnitId))
          .filter((leagueLevelUnitId) => Number.isFinite(leagueLevelUnitId))
      )
    );
    await mapWithConcurrency(
      leagueUnitIds,
      TEAM_REFRESH_CONCURRENCY,
      async (leagueLevelUnitId) => {
        try {
          const { response, payload } = await fetchChppJson<{
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
          }>(
            `/api/chpp/leaguedetails?leagueLevelUnitId=${leagueLevelUnitId}`,
            { cache: "no-store" }
          );
          if (!response.ok || payload?.error) return;
          const leagueData = payload?.data?.HattrickData as RawNode | undefined;
          if (!leagueData) return;
          leagueDetailsByUnit.set(leagueLevelUnitId, leagueData);
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          // ignore league failure
        }
      }
    );

    teamsWithLeague.forEach((team) => {
      const leagueLevelUnitId = Number(team.leagueLevelUnitId);
      const leagueData = leagueDetailsByUnit.get(leagueLevelUnitId);
      if (!leagueData) return;
      const rawTeams = leagueData.Team as RawNode | RawNode[] | null | undefined;
      const teamList = Array.isArray(rawTeams) ? rawTeams : rawTeams ? [rawTeams] : [];
      const match = teamList.find(
        (entry) => Number(entry.TeamID) === Number(team.teamId)
      );
      if (!match) return;
      const snapshot: LeaguePerformanceSnapshot = {
        leagueId: parseNumber(leagueData.LeagueID),
        leagueName: parseStringNode(leagueData.LeagueName),
        leagueLevel: parseNumber(leagueData.LeagueLevel),
        maxLevel: parseNumber(leagueData.MaxLevel),
        leagueLevelUnitId:
          parseNumber(leagueData.LeagueLevelUnitID) ?? leagueLevelUnitId,
        leagueLevelUnitName: parseStringNode(leagueData.LeagueLevelUnitName),
        currentMatchRound: parseStringNode(leagueData.CurrentMatchRound),
        rank: parseNumber(leagueData.Rank),
        userId: parseNumber(match.UserId),
        teamId: parseNumber(match.TeamID) ?? Number(team.teamId),
        position: parseNumber(match.Position),
        positionChange: parsePositionChangeNode(match.PositionChange),
        teamName: parseStringNode(match.TeamName) ?? team.teamName ?? null,
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

  const refreshLastLoginSnapshots = async (
    nextCache: ChronicleCache,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    const teamIdsByUserId = new Map<number, number[]>();
    teams.forEach((team) => {
      const cachedTeam = nextCache.teams[team.teamId] ?? team;
      const userId = cachedTeam.leaguePerformance?.current?.userId ?? null;
      if (!userId || !Number.isFinite(userId) || userId <= 0) return;
      const existing = teamIdsByUserId.get(userId) ?? [];
      if (!existing.includes(team.teamId)) {
        existing.push(team.teamId);
      }
      teamIdsByUserId.set(userId, existing);
    });
    if (teamIdsByUserId.size === 0) return;

    await mapWithConcurrency(
      Array.from(teamIdsByUserId.entries()),
      TEAM_REFRESH_CONCURRENCY,
      async ([userId, teamIds]) => {
        try {
          const { response, payload } = await fetchChppJson<{
            data?: {
              HattrickData?: {
                Manager?: {
                  LastLogins?: {
                    LoginTime?: unknown;
                  };
                  Teams?: {
                    Team?: unknown;
                  };
                };
              };
            };
            error?: string;
            details?: string;
          }>(
            `/api/chpp/managercompendium?version=1.6&userId=${userId}`,
            {
              cache: "no-store",
            }
          );
          if (!response.ok || payload?.error) return;
          const manager = payload?.data?.HattrickData?.Manager as RawNode | undefined;
          if (!manager) return;
          const loginEvents = toArray(
            manager.LastLogins as RawNode | RawNode[] | undefined
          )
            .flatMap((entry) =>
              toArray(
                (entry as RawNode | undefined)?.LoginTime as
                  | string
                  | RawNode
                  | Array<string | RawNode>
                  | undefined
              )
            )
            .map((entry) => parseStringNode(entry))
            .filter((entry): entry is string => Boolean(entry))
            .map((entry) => parseLastLoginEntry(entry))
            .sort((left, right) => {
              const leftTs = parseLoginTimeToTimestamp(left.dateTime) ?? 0;
              const rightTs = parseLoginTimeToTimestamp(right.dateTime) ?? 0;
              return rightTs - leftTs;
            });
          const latestLoginDateTime = loginEvents[0]?.dateTime ?? null;

          const managerTeamsContainer = Array.isArray(manager.Teams)
            ? undefined
            : (manager.Teams as RawNode | undefined);
          const managerTeamIds = toArray(
            managerTeamsContainer?.Team as RawNode | RawNode[] | undefined
          )
            .map((teamNode) => parseNumberNode(teamNode.TeamId ?? teamNode.TeamID))
            .filter((teamId): teamId is number => Boolean(teamId && teamId > 0));
          const eligibleTeamIds =
            managerTeamIds.length > 0
              ? teamIds.filter((teamId) => managerTeamIds.includes(teamId))
              : teamIds;
          if (eligibleTeamIds.length === 0) return;

          const snapshot: LastLoginSnapshot = {
            latestLoginDateTime,
            loginEvents,
            fetchedAt: Date.now(),
          };
          eligibleTeamIds.forEach((teamId) => {
            const previous = nextCache.teams[teamId]?.lastLogin?.current;
            nextCache.teams[teamId] = {
              ...nextCache.teams[teamId],
              teamId,
              teamName:
                nextCache.teams[teamId]?.teamName ??
                teams.find((entry) => entry.teamId === teamId)?.teamName ??
                "",
              lastLogin: {
                current: snapshot,
                previous,
              },
            };
          });
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          // ignore manager compendium failures
        }
      }
    );
  };

  const refreshCoachSnapshots = async (
    nextCache: ChronicleCache,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    await mapWithConcurrency(
      teams,
      TEAM_REFRESH_CONCURRENCY,
      async (team) => {
        try {
          const { response, payload } = await fetchChppJson<{
            data?: {
              HattrickData?: {
                StaffList?: {
                  Trainer?: RawNode;
                };
              };
            };
            error?: string;
          }>(`/api/chpp/stafflist?teamId=${team.teamId}`, { cache: "no-store" });
          if (!response.ok || payload?.error) return;

          const trainer = payload?.data?.HattrickData?.StaffList?.Trainer;
          if (!trainer) return;
          const countryId = parseNumberNode(trainer.CountryID);
          const countryName = await resolveCoachCountryName(countryId);
          const snapshot: CoachSnapshot = {
            trainerId: parseNumberNode(trainer.TrainerId),
            name: parseStringNode(trainer.Name),
            age: parseNumberNode(trainer.Age),
            ageDays: parseNumberNode(trainer.AgeDays),
            contractDate: parseStringNode(trainer.ContractDate),
            costSek: parseMoneySek(trainer.Cost),
            countryId,
            countryName,
            trainerType: parseNumberNode(trainer.TrainerType),
            leadership: parseNumberNode(trainer.Leadership),
            trainerSkillLevel: parseNumberNode(trainer.TrainerSkillLevel),
            trainerStatus: parseNumberNode(trainer.TrainerStatus),
            fetchedAt: Date.now(),
          };

          const previous = nextCache.teams[team.teamId]?.coach?.current;
          nextCache.teams[team.teamId] = {
            ...nextCache.teams[team.teamId],
            teamId: team.teamId,
            teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
            coach: {
              current: snapshot,
              previous,
            },
          };
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          // ignore coach failures
        }
      }
    );
  };

  const refreshArenaSnapshots = async (
    nextCache: ChronicleCache,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    const arenaById = new Map<number, ArenaSnapshot>();
    const teamsWithArena = teams
      .map((team) => nextCache.teams[team.teamId] ?? team)
      .filter((team) => team.arenaId);
    const arenaIds = Array.from(
      new Set(
        teamsWithArena
          .map((team) => Number(team.arenaId))
          .filter((arenaId) => Number.isFinite(arenaId) && arenaId > 0)
      )
    );
    await mapWithConcurrency(
      arenaIds,
      TEAM_REFRESH_CONCURRENCY,
      async (arenaId) => {
        try {
          const { response, payload } = await fetchChppJson<{
            data?: {
              HattrickData?: RawNode;
            };
            error?: string;
          }>(`/api/chpp/arenadetails?arenaId=${arenaId}`, {
            cache: "no-store",
          });
          if (!response.ok || payload?.error) return;
          const root = payload?.data?.HattrickData as RawNode | undefined;
          const arenaNode = (root?.Arena ?? {}) as RawNode;
          const currentCapacity = (arenaNode?.CurrentCapacity ?? {}) as RawNode;
          const expandedCapacity = (arenaNode?.ExpandedCapacity ?? {}) as RawNode;
          const snapshot: ArenaSnapshot = {
            arenaName: (arenaNode?.ArenaName as string | null | undefined) ?? null,
            currentTotalCapacity: parseNumberNode(currentCapacity.Total),
            rebuiltDate: parseStringNode(currentCapacity.RebuiltDate),
            currentAvailable: parseBooleanNode(currentCapacity["@_Available"]),
            terraces: parseNumberNode(currentCapacity.Terraces),
            basic: parseNumberNode(currentCapacity.Basic),
            roof: parseNumberNode(currentCapacity.Roof),
            vip: parseNumberNode(currentCapacity.VIP),
            expandedAvailable: parseBooleanNode(expandedCapacity["@_Available"]),
            expandedTotalCapacity: parseNumberNode(expandedCapacity.Total),
            expansionDate: parseStringNode(expandedCapacity.ExpansionDate),
            expandedTerraces: parseNumberNode(expandedCapacity.Terraces),
            expandedBasic: parseNumberNode(expandedCapacity.Basic),
            expandedRoof: parseNumberNode(expandedCapacity.Roof),
            expandedVip: parseNumberNode(expandedCapacity.VIP),
            fetchedAt: Date.now(),
          };
          arenaById.set(arenaId, snapshot);
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          // ignore arena failure
        }
      }
    );

    teamsWithArena.forEach((team) => {
      const arenaId = Number(team.arenaId);
      const snapshot = arenaById.get(arenaId);
      if (!snapshot) return;
      const previous = nextCache.teams[team.teamId]?.arena?.current;
      nextCache.teams[team.teamId] = {
        ...nextCache.teams[team.teamId],
        teamId: team.teamId,
        teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
        arenaName:
          snapshot.arenaName ??
          team.arenaName ??
          nextCache.teams[team.teamId]?.arenaName ??
          null,
        arena: {
          current: snapshot,
          previous,
        },
      };
    });
  };

  const refreshFinanceSnapshots = async (
    nextCache: ChronicleCache,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    for (const team of teams) {
      try {
        const { response, payload } = await fetchChppJson<{
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
        }>(
          `/api/chpp/transfersteam?teamId=${team.teamId}`,
          { cache: "no-store" }
        );
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
      } catch (error) {
        if (isChppAuthRequiredError(error)) throw error;
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

  const computeAgeAtDeadline = (
    currentAge: number | null,
    currentAgeDays: number | null,
    deadline: string | null
  ): { age: number | null; ageDays: number | null } => {
    if (
      currentAge === null ||
      currentAgeDays === null ||
      deadline === null ||
      deadline.trim() === ""
    ) {
      return { age: null, ageDays: null };
    }
    const deadlineDate = parseChppDate(deadline);
    if (!deadlineDate) return { age: null, ageDays: null };
    const elapsedDays = Math.max(0, Math.floor((Date.now() - deadlineDate.getTime()) / DAY_MS));
    const totalCurrentDays = currentAge * CHPP_DAYS_PER_YEAR + currentAgeDays;
    const totalDeadlineDays = totalCurrentDays - elapsedDays;
    if (totalDeadlineDays < 0) return { age: null, ageDays: null };
    return {
      age: Math.floor(totalDeadlineDays / CHPP_DAYS_PER_YEAR),
      ageDays: totalDeadlineDays % CHPP_DAYS_PER_YEAR,
    };
  };

  type TeamPlayerSnapshot = {
    playerId: number;
    playerName: string | null;
    playerNumber: number | null;
    age: number | null;
    ageDays: number | null;
    injuryLevel: number | null;
    transferListed: boolean;
    tsi: number;
    salarySek: number;
  };

  const fetchTeamPlayers = async (teamId: number): Promise<TeamPlayerSnapshot[]> => {
    const { response: playersResponse, payload: playersPayload } = await fetchChppJson<{
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
    }>(`/api/chpp/players?teamId=${teamId}`, {
      cache: "no-store",
    });
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
      .map((player) => {
        const playerId = parseNumber(player?.PlayerID) ?? 0;
        if (playerId <= 0) return null;
        const playerName = [player?.FirstName, player?.NickName, player?.LastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        return {
          playerId,
          playerName: playerName || null,
          playerNumber: parseNumberNode(player?.PlayerNumber),
          age: parseNumberNode(player?.Age),
          ageDays: parseNumberNode(player?.AgeDays),
          injuryLevel: parseNumberNode(player?.InjuryLevel),
          transferListed: parseBool(player?.TransferListed),
          tsi: parseNumber(player?.TSI) ?? 0,
          salarySek: parseMoneySek(player?.Salary) ?? 0,
        };
      })
      .filter((player): player is TeamPlayerSnapshot => Boolean(player));
  };

  const buildTransferListedPlayers = (
    players: TeamPlayerSnapshot[]
  ): TransferListedPlayer[] =>
    players
      .filter((player) => player.transferListed)
      .map((player) => ({
        playerId: player.playerId,
        playerName: player.playerName,
        age: null,
        ageDays: null,
        tsi: player.tsi,
        askingPriceSek: null,
      }));

  const fetchTransferPlayerDetails = async (
    playerId: number
  ): Promise<{
    playerName: string | null;
    age: number | null;
    ageDays: number | null;
    tsi: number | null;
    askingPriceSek: number | null;
  } | null> => {
    try {
      const { response, payload } = await fetchChppJson<{
        data?: {
          HattrickData?: {
            Player?: RawNode;
          };
        };
      }>(`/api/chpp/playerdetails?playerId=${playerId}`, {
        cache: "no-store",
      });
      if (!response.ok) return null;
      const playerNode = payload?.data?.HattrickData?.Player as RawNode | undefined;
      const transferDetails = (playerNode?.TransferDetails ?? {}) as RawNode;
      const playerName = [
        parseStringNode(playerNode?.FirstName),
        parseStringNode(playerNode?.NickName),
        parseStringNode(playerNode?.LastName),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        playerName: playerName || null,
        age: parseNumberNode(playerNode?.Age),
        ageDays: parseNumberNode(playerNode?.AgeDays),
        tsi: parseNumberNode(playerNode?.TSI),
        askingPriceSek: parseMoneySek(transferDetails?.AskingPrice),
      };
    } catch (error) {
      if (isChppAuthRequiredError(error)) throw error;
      return null;
    }
  };

  const buildTsiSnapshot = (players: TeamPlayerSnapshot[]): TsiSnapshot => {
    const normalizedPlayers = players.map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      playerNumber: player.playerNumber,
      age: player.age,
      ageDays: player.ageDays,
      injuryLevel: player.injuryLevel,
      tsi: Number.isFinite(player.tsi) ? player.tsi : 0,
    }));
    const tsiValues = normalizedPlayers
      .map((player) => player.tsi)
      .sort((a, b) => b - a);
    const totalTsi = tsiValues.reduce((sum, value) => sum + value, 0);
    const top11Tsi = tsiValues.slice(0, 11).reduce((sum, value) => sum + value, 0);
    return {
      totalTsi,
      top11Tsi,
      players: normalizedPlayers.sort((a, b) => b.tsi - a.tsi),
      fetchedAt: Date.now(),
    };
  };

  const buildWagesSnapshot = (players: TeamPlayerSnapshot[]): WagesSnapshot => {
    const normalizedPlayers = players.map((player) => ({
      playerId: player.playerId,
      playerName: player.playerName,
      playerNumber: player.playerNumber,
      age: player.age,
      ageDays: player.ageDays,
      injuryLevel: player.injuryLevel,
      salarySek: Number.isFinite(player.salarySek) ? player.salarySek : 0,
    }));
    const wages = normalizedPlayers
      .map((player) => player.salarySek)
      .sort((a, b) => b - a);
    const totalWagesSek = wages.reduce((sum, value) => sum + value, 0);
    const top11WagesSek = wages.slice(0, 11).reduce((sum, value) => sum + value, 0);
    return {
      totalWagesSek,
      top11WagesSek,
      players: normalizedPlayers.sort((a, b) => b.salarySek - a.salarySek),
      fetchedAt: Date.now(),
    };
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
      const { response, payload } = await fetchChppJson<{
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
      }>(
        `/api/chpp/transfersteam?teamId=${teamId}&pageIndex=${pageIndex}`,
        { cache: "no-store" }
      );
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
          age: null,
          ageDays: null,
          tsi: parseNumber(player?.TSI),
          priceSek: parseMoneySek(entry?.Price),
        });
      });
      pageIndex += 1;
    }

    const uniquePlayerIds = Array.from(
      new Set(
        transfers
          .map((entry) => entry.playerId)
          .filter((playerId): playerId is number => Boolean(playerId && playerId > 0))
      )
    );
    const resolutions = await Promise.all(
      uniquePlayerIds.map(async (playerId) => ({
        playerId,
        details: await fetchTransferPlayerDetails(playerId),
      }))
    );
    const resolvedById = new Map<
      number,
      { playerName: string | null; age: number | null; ageDays: number | null; tsi: number | null }
    >();
    resolutions.forEach((item) => {
      if (!item?.details) return;
      resolvedById.set(item.playerId, {
        playerName: item.details.playerName,
        age: item.details.age,
        ageDays: item.details.ageDays,
        tsi: item.details.tsi,
      });
    });

    return {
      totalBuysSek,
      totalSalesSek,
      numberOfBuys,
      numberOfSales,
      transfers: transfers.map((entry) => {
        const resolved =
          entry.playerId && resolvedById.has(entry.playerId)
            ? resolvedById.get(entry.playerId) ?? null
            : null;
        const ageAtDeadline = computeAgeAtDeadline(
          resolved?.age ?? null,
          resolved?.ageDays ?? null,
          entry.deadline
        );
        return {
          ...entry,
          resolvedPlayerName: resolved?.playerName ?? entry.playerName ?? null,
          age: ageAtDeadline.age,
          ageDays: ageAtDeadline.ageDays,
          tsi: entry.tsi ?? resolved?.tsi ?? null,
        };
      }),
    };
  };

  type TeamMatchArchiveEntry = {
    matchId: number;
    matchType: number | null;
    matchDate: string | null;
    sourceSystem: string;
  };

  type MatchFormationTacticDetails = {
    homeTeamId: number | null;
    awayTeamId: number | null;
    homeFormation: string | null;
    awayFormation: string | null;
    homeTacticType: number | null;
    awayTacticType: number | null;
  };

  const fetchTeamRecentRelevantMatches = async (
    teamId: number,
    includeFriendlies: boolean
  ): Promise<TeamMatchArchiveEntry[]> => {
    const { response, payload } = await fetchChppJson<{
      data?: {
        HattrickData?: {
          Team?: {
            MatchList?: {
              Match?: unknown;
            };
          };
        };
      };
      error?: string;
    }>(`/api/chpp/matchesarchive?teamId=${teamId}`, {
      cache: "no-store",
    });
    if (!response.ok || payload?.error) return [];

    const rawMatches = payload?.data?.HattrickData?.Team?.MatchList?.Match;
    const matchList = toArray(rawMatches as RawNode | RawNode[] | null | undefined);
    const relevantMatchTypes = includeFriendlies
      ? new Set<number>([...COMPETITIVE_MATCH_TYPES, ...FRIENDLY_MATCH_TYPES])
      : COMPETITIVE_MATCH_TYPES;
    const relevant = matchList
      .map((match) => {
        const matchId = parseNumberNode(match?.MatchID) ?? 0;
        if (matchId <= 0) return null;
        const matchType = parseNumberNode(match?.MatchType);
        if (matchType === null || !relevantMatchTypes.has(matchType)) return null;
        return {
          matchId,
          matchType,
          matchDate:
            typeof match?.MatchDate === "string" ? String(match.MatchDate) : null,
          sourceSystem:
            typeof match?.SourceSystem === "string" && match.SourceSystem
              ? String(match.SourceSystem)
              : "Hattrick",
        } as TeamMatchArchiveEntry;
      })
      .filter((entry): entry is TeamMatchArchiveEntry => Boolean(entry));

    return relevant
      .sort(
        (left, right) =>
          parseMatchDateValue(right.matchDate) - parseMatchDateValue(left.matchDate)
      )
      .slice(0, ARCHIVE_MATCH_LIMIT);
  };

  const fetchMatchFormationTacticDetails = async (
    matchId: number,
    sourceSystem: string,
    cache: Map<number, MatchFormationTacticDetails>
  ): Promise<MatchFormationTacticDetails | null> => {
    if (cache.has(matchId)) return cache.get(matchId) ?? null;
    try {
      const { response, payload } = await fetchChppJson<{
        data?: {
          HattrickData?: {
            Match?: {
              HomeTeam?: RawNode;
              AwayTeam?: RawNode;
            };
          };
        };
      }>(
        `/api/chpp/matchdetails?matchId=${matchId}&sourceSystem=${encodeURIComponent(
          sourceSystem
        )}`,
        { cache: "no-store" }
      );
      if (!response.ok) return null;
      const match = payload?.data?.HattrickData?.Match;
      const home = (match?.HomeTeam ?? {}) as RawNode;
      const away = (match?.AwayTeam ?? {}) as RawNode;
      const details: MatchFormationTacticDetails = {
        homeTeamId: parseNumber(home?.HomeTeamID),
        awayTeamId: parseNumber(away?.AwayTeamID),
        homeFormation:
          typeof home?.Formation === "string" ? String(home.Formation) : null,
        awayFormation:
          typeof away?.Formation === "string" ? String(away.Formation) : null,
        homeTacticType: parseNumber(home?.TacticType),
        awayTacticType: parseNumber(away?.TacticType),
      };
      cache.set(matchId, details);
      return details;
    } catch (error) {
      if (isChppAuthRequiredError(error)) throw error;
      return null;
    }
  };

  const buildFormationTacticsSnapshotFromMatches = async (
    teamId: number,
    teamName: string,
    matches: TeamMatchArchiveEntry[],
    includeFriendlies: boolean,
    detailCache: Map<number, MatchFormationTacticDetails>,
    onMatchProcessed?: () => void
  ): Promise<FormationTacticsSnapshot> => {
    const teamFormations: (string | null)[] = [];
    const formationCounts = new Map<string, number>();
    const tacticCounts = new Map<string, number>();
    let sampleSize = 0;
    const analyzedMatches: { matchId: number; matchType: number | null }[] = [];

    const resolvedMatches = await mapWithConcurrency(
      matches,
      MATCH_DETAILS_FETCH_CONCURRENCY,
      async (match) => {
        const details = await fetchMatchFormationTacticDetails(
          match.matchId,
          match.sourceSystem,
          detailCache
        );
        onMatchProcessed?.();
        return { match, details };
      }
    );

    for (const { match, details } of resolvedMatches) {
      if (!details) continue;
      const isHome = details.homeTeamId === teamId;
      const isAway = details.awayTeamId === teamId;
      if (!isHome && !isAway) continue;
      sampleSize += 1;
      analyzedMatches.push({
        matchId: match.matchId,
        matchType: match.matchType,
      });
      const formation = isHome ? details.homeFormation : details.awayFormation;
      const tacticLabel = formatTacticLabel(
        isHome ? details.homeTacticType : details.awayTacticType
      );
      if (formation) {
        teamFormations.push(formation);
        formationCounts.set(formation, (formationCounts.get(formation) ?? 0) + 1);
      }
      if (tacticLabel) {
        tacticCounts.set(tacticLabel, (tacticCounts.get(tacticLabel) ?? 0) + 1);
      }
    }

    const formationDistribution = buildDistribution(formationCounts);
    const tacticDistribution = buildDistribution(tacticCounts);
    const likelyTraining = inferLikelyTrainingFromFormations(teamFormations);
    if (process.env.NODE_ENV !== "production") {
      console.info("[CC formations debug] analyzed matches", {
        teamId,
        teamName,
        includeFriendlies,
        sampleSize,
        analyzedMatches,
      });
    }
    return {
      topFormation: pickTopKey(formationDistribution),
      topTactic: pickTopKey(tacticDistribution),
      likelyTrainingKey: likelyTraining.key,
      likelyTrainingTopKeys: likelyTraining.topKeys,
      likelyTrainingIsUnclear: likelyTraining.isUnclear,
      likelyTrainingConfidencePct: likelyTraining.confidencePct,
      likelyTrainingScores: likelyTraining.scores,
      formationDistribution,
      tacticDistribution,
      analyzedMatches,
      sampleSize,
      fetchedAt: Date.now(),
    };
  };

  const refreshFormationsTacticsSnapshots = async (
    nextCache: ChronicleCache,
    options?: {
      teams?: ChronicleTeamData[];
      includeFriendlies?: boolean;
      onMatchesArchiveProgress?: (
        completedTeams: number,
        totalTeams: number,
        teamName: string
      ) => void;
      onMatchDetailsProgress?: (
        completedMatches: number,
        totalMatches: number,
        teamName: string
      ) => void;
    }
  ) => {
    const teams = options?.teams ?? trackedTeams;
    const includeFriendlies = options?.includeFriendlies ?? formationsIncludeFriendlies;
    const detailCache = new Map<number, MatchFormationTacticDetails>();
    const teamEntries: Array<{
      teamId: number;
      teamName: string;
      matches: TeamMatchArchiveEntry[];
    }> = [];
    let completedTeams = 0;
    const resolvedTeamEntries = await mapWithConcurrency(
      teams,
      TEAM_REFRESH_CONCURRENCY,
      async (team) => {
        try {
          const matches = await fetchTeamRecentRelevantMatches(
            team.teamId,
            includeFriendlies
          );
          return {
            teamId: team.teamId,
            teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
            matches,
          };
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          return {
            teamId: team.teamId,
            teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
            matches: [],
          };
        } finally {
          completedTeams += 1;
          options?.onMatchesArchiveProgress?.(
            completedTeams,
            teams.length,
            team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? messages.unknownShort
          );
        }
      }
    );
    teamEntries.push(...resolvedTeamEntries);

    const totalMatches = teamEntries.reduce(
      (sum, teamEntry) => sum + teamEntry.matches.length,
      0
    );
    let completedMatches = 0;

    for (const teamEntry of teamEntries) {
      const onTeamMatchProcessed = () => {
        completedMatches += 1;
        options?.onMatchDetailsProgress?.(
          completedMatches,
          totalMatches,
          teamEntry.teamName
        );
      };
      try {
        const snapshot = await buildFormationTacticsSnapshotFromMatches(
          teamEntry.teamId,
          teamEntry.teamName,
          teamEntry.matches,
          includeFriendlies,
          detailCache,
          onTeamMatchProcessed
        );
        const previous =
          nextCache.teams[teamEntry.teamId]?.formationsTactics?.current;
        nextCache.teams[teamEntry.teamId] = {
          ...nextCache.teams[teamEntry.teamId],
          teamId: teamEntry.teamId,
          teamName: teamEntry.teamName,
          formationsTactics: {
            current: snapshot,
            previous,
          },
        };
      } catch (error) {
        if (isChppAuthRequiredError(error)) throw error;
        for (let i = 0; i < teamEntry.matches.length; i += 1) {
          onTeamMatchProcessed();
        }
        // ignore formations/tactics failures
      }
    }
  };

  const refreshTransferSnapshots = async (
    nextCache: ChronicleCache,
    historyCount: number,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    for (const team of teams) {
      try {
        const teamPlayers = await fetchTeamPlayers(team.teamId);
        const transferListedPlayers = buildTransferListedPlayers(teamPlayers);
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
      } catch (error) {
        if (isChppAuthRequiredError(error)) throw error;
        // ignore transfer activity failures
      }
    }
  };

  const refreshTsiSnapshots = async (
    nextCache: ChronicleCache,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    for (const team of teams) {
      try {
        const teamPlayers = await fetchTeamPlayers(team.teamId);
        const snapshot = buildTsiSnapshot(teamPlayers);
        const previous = nextCache.teams[team.teamId]?.tsi?.current;
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
          tsi: {
            current: snapshot,
            previous,
          },
        };
      } catch (error) {
        if (isChppAuthRequiredError(error)) throw error;
        // ignore tsi failures
      }
    }
  };

  const refreshWagesSnapshots = async (
    nextCache: ChronicleCache,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    for (const team of teams) {
      try {
        const teamPlayers = await fetchTeamPlayers(team.teamId);
        const snapshot = buildWagesSnapshot(teamPlayers);
        const previous = nextCache.teams[team.teamId]?.wages?.current;
        nextCache.teams[team.teamId] = {
          ...nextCache.teams[team.teamId],
          teamId: team.teamId,
          teamName: team.teamName ?? nextCache.teams[team.teamId]?.teamName ?? "",
          wages: {
            current: snapshot,
            previous,
          },
        };
      } catch (error) {
        if (isChppAuthRequiredError(error)) throw error;
        // ignore wages failures
      }
    }
  };

  const refreshFinanceAndTransferSnapshots = async (
    nextCache: ChronicleCache,
    historyCount: number,
    teams: ChronicleTeamData[] = trackedTeams
  ) => {
    await mapWithConcurrency(
      teams,
      TEAM_REFRESH_CONCURRENCY,
      async (team) => {
        try {
          const [teamPlayers, latestTransfers] = await Promise.all([
            fetchTeamPlayers(team.teamId),
            fetchLatestTransfers(team.teamId, historyCount),
          ]);
          const transferListedPlayers = buildTransferListedPlayers(teamPlayers);
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
          const previousTransfer =
            nextCache.teams[team.teamId]?.transferActivity?.current;
          const tsiSnapshot = buildTsiSnapshot(teamPlayers);
          const previousTsi = nextCache.teams[team.teamId]?.tsi?.current;
          const wagesSnapshot = buildWagesSnapshot(teamPlayers);
          const previousWages = nextCache.teams[team.teamId]?.wages?.current;
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
            tsi: {
              current: tsiSnapshot,
              previous: previousTsi,
            },
            wages: {
              current: wagesSnapshot,
              previous: previousWages,
            },
          };
        } catch (error) {
          if (isChppAuthRequiredError(error)) throw error;
          // ignore combined transfer/finance failures
        }
      }
    );
  };

  const setPanelProgress = useCallback((panelIds: string[], value: number) => {
    const normalized = Math.max(0, Math.min(100, value));
    setPanelRefreshProgressPct((prev) => {
      const next = { ...prev };
      panelIds.forEach((panelId) => {
        next[panelId] = normalized;
      });
      return next;
    });
  }, []);

  const clearProgressIndicators = useCallback(() => {
    setGlobalRefreshProgressPct(0);
    setGlobalRefreshStatus(null);
    setPanelRefreshProgressPct({});
  }, []);

  const clearRefreshingFlags = useCallback(() => {
    setRefreshingGlobal(false);
    setRefreshingLeague(false);
    setRefreshingPress(false);
    setRefreshingFanclub(false);
    setRefreshingArena(false);
    setRefreshingFormationsTactics(false);
    setRefreshingFinance(false);
    setRefreshingTransfer(false);
    setRefreshingTsi(false);
    setRefreshingWages(false);
    setRefreshingLastLogin(false);
    setRefreshingCoach(false);
  }, []);

  const requestStopRefresh = useCallback(() => {
    if (!anyRefreshing) return;
    chronicleStopRequestedRef.current = true;
    clearRefreshingFlags();
    clearProgressIndicators();
    addNotification(messages.notificationRefreshStoppedManual);
  }, [
    addNotification,
    anyRefreshing,
    clearProgressIndicators,
    clearRefreshingFlags,
    messages.notificationRefreshStoppedManual,
  ]);

  const refreshDataForTeams = async (
    reason: "stale" | "manual",
    teamsToRefresh: ChronicleTeamData[],
    options?: { isGlobalRefresh?: boolean }
  ) => {
    if (anyRefreshing) return;
    if (teamsToRefresh.length === 0) return;
    const isGlobalRefresh = options?.isGlobalRefresh ?? true;
    chronicleStopRequestedRef.current = false;
    setRefreshingGlobal(true);
    try {
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      const stageCount = 7;
      const setStage = (
        stageIndex: number,
        status: string,
        panelIds: string[]
      ) => {
        const progress = Math.round((stageIndex / stageCount) * 100);
        setGlobalRefreshProgressPct(progress);
        setGlobalRefreshStatus(status);
        if (panelIds.length > 0) {
          setPanelProgress(panelIds, progress);
        }
      };

      setStage(
        0,
        messages.clubChronicleRefreshStatusTeamDetails,
        ["press-announcements", "fanclub", "arena"]
      );
      await refreshTeamDetails(nextCache, nextManualTeams, {
        updatePress: true,
        teams: teamsToRefresh,
      });
      if (chronicleStopRequestedRef.current) return;

      setStage(
        1,
        messages.clubChronicleRefreshStatusLeague,
        ["league-performance"]
      );
      await refreshLeagueSnapshots(nextCache, teamsToRefresh);
      if (chronicleStopRequestedRef.current) return;

      setStage(2, messages.clubChronicleRefreshStatusLastLogin, ["last-login"]);
      await refreshLastLoginSnapshots(nextCache, teamsToRefresh);
      if (chronicleStopRequestedRef.current) return;

      setStage(3, messages.clubChronicleRefreshStatusArena, ["arena"]);
      await refreshArenaSnapshots(nextCache, teamsToRefresh);
      if (chronicleStopRequestedRef.current) return;

      setStage(
        4,
        messages.clubChronicleRefreshStatusTransferFinance,
        ["finance-estimate", "transfer-market", "tsi", "wages", "coach"]
      );
      await Promise.all([
        refreshFinanceAndTransferSnapshots(
          nextCache,
          transferHistoryCount,
          teamsToRefresh
        ),
        refreshCoachSnapshots(nextCache, teamsToRefresh),
      ]);
      if (chronicleStopRequestedRef.current) return;

      setStage(
        5,
        messages.clubChronicleRefreshStatusFormations,
        ["formations-tactics", "likely-training"]
      );
      await refreshFormationsTacticsSnapshots(nextCache, {
        teams: teamsToRefresh,
        onMatchesArchiveProgress: (completedTeams, totalTeams, teamName) => {
          if (chronicleStopRequestedRef.current) return;
          const ratio = totalTeams > 0 ? completedTeams / totalTeams : 1;
          const progress = Math.round(75 + ratio * 8);
          setGlobalRefreshProgressPct(progress);
          setGlobalRefreshStatus(
            formatStatusTemplate(
              messages.clubChronicleRefreshStatusMatchesArchiveProgress,
              {
                completed: completedTeams,
                total: totalTeams,
                team: teamName,
              }
            )
          );
          setPanelProgress(["formations-tactics", "likely-training"], progress);
        },
        onMatchDetailsProgress: (completedMatches, totalMatches, teamName) => {
          if (chronicleStopRequestedRef.current) return;
          const ratio = totalMatches > 0 ? completedMatches / totalMatches : 1;
          const progress = Math.round(83 + ratio * 12);
          setGlobalRefreshProgressPct(progress);
          setGlobalRefreshStatus(
            formatStatusTemplate(
              messages.clubChronicleRefreshStatusMatchDetailsProgress,
              {
                completed: completedMatches,
                total: totalMatches,
                team: teamName,
              }
            )
          );
          setPanelProgress(["formations-tactics", "likely-training"], progress);
        },
      });
      if (chronicleStopRequestedRef.current) return;

      setStage(6, messages.clubChronicleRefreshStatusFinalizing, [...PANEL_IDS]);
      const baselineForDiff =
        globalBaselineCache ?? pruneChronicleCache(readChronicleCache());
      const nextUpdates = collectTeamChanges(
        nextCache,
        [
          "league",
          "press",
          "fanclub",
          "arena",
          "finance",
          "transfer",
          "formationsTactics",
          "likelyTraining",
          "lastLogin",
          "coach",
          "tsi",
          "wages",
        ],
        {
          baselineCache: baselineForDiff,
          teamIds: teamsToRefresh.map((team) => team.teamId),
        }
      );
      const hasUpdates = hasAnyChanges(nextUpdates);
      if (chronicleStopRequestedRef.current) return;
      const comparedAt = Date.now();
      if (hasUpdates) {
        pushGlobalUpdateHistory({
          id: `${comparedAt}`,
          comparedAt,
          hasChanges: true,
          updates: nextUpdates,
        });
      } else {
        setLastGlobalComparedAt(comparedAt);
        setLastGlobalHadChanges(false);
      }

      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalBaselineCache(nextCache);
      if (hasUpdates) {
        setUpdates(nextUpdates);
      }
      setUpdatesOpen(hasUpdates);
      if (isGlobalRefresh) {
        const refreshCompletedAt = Date.now();
        writeLastRefresh(refreshCompletedAt);
        setLastGlobalRefreshAt(refreshCompletedAt);
      }
      if (chronicleStopRequestedRef.current) return;
      if (reason === "stale") {
        addNotification(messages.notificationChronicleStaleRefresh);
      }
      setGlobalRefreshProgressPct(100);
      setPanelProgress([...PANEL_IDS], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingGlobal(false);
      clearProgressIndicators();
    }
  };
  const refreshAllData = async (reason: "stale" | "manual") => {
    await refreshDataForTeams(reason, trackedTeamsRef.current);
  };
  const refreshNoDivulgoTeam = async (teamId: number) => {
    const targetTeam = trackedTeams.find((team) => team.teamId === teamId);
    if (!targetTeam) return;
    await refreshDataForTeams("manual", [targetTeam], { isGlobalRefresh: false });
  };
  refreshAllDataRef.current = refreshAllData;
  refreshNoDivulgoTeamRef.current = refreshNoDivulgoTeam;
  refreshTeamsRef.current = async (teams: ChronicleTeamData[]) => {
    await refreshDataForTeams("manual", teams, { isGlobalRefresh: false });
  };

  useEffect(() => {
    if (pendingNoDivulgoFetchTeamId === null) return;
    if (anyRefreshing) return;
    const shouldRefresh = trackedTeams.some(
      (team) => team.teamId === pendingNoDivulgoFetchTeamId
    );
    const teamId = pendingNoDivulgoFetchTeamId;
    setPendingNoDivulgoFetchTeamId(null);
    if (!shouldRefresh || teamId === null) return;
    void refreshNoDivulgoTeamRef.current?.(teamId);
  }, [anyRefreshing, pendingNoDivulgoFetchTeamId, trackedTeams]);

  useEffect(() => {
    if (pendingWatchlistFetchTeamIds.length === 0) return;
    if (anyRefreshing) return;
    const teamsToRefresh = pendingWatchlistFetchTeamIds
      .map((teamId) => trackedTeams.find((team) => team.teamId === teamId))
      .filter((team): team is ChronicleTeamData => Boolean(team));
    setPendingWatchlistFetchTeamIds([]);
    if (teamsToRefresh.length === 0) return;
    void refreshTeamsRef.current?.(teamsToRefresh);
  }, [anyRefreshing, pendingWatchlistFetchTeamIds, trackedTeams]);

  const refreshLeagueOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingLeague(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusLeague);
      setGlobalRefreshProgressPct(15);
      setPanelProgress(["league-performance"], 15);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["league-performance"], 55);
      await refreshLeagueSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;

      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["league-performance"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingLeague(false);
      clearProgressIndicators();
    }
  };

  const refreshPressOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingPress(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusTeamDetails);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["press-announcements"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: true });
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["press-announcements"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingPress(false);
      clearProgressIndicators();
    }
  };

  const refreshLastLoginOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingLastLogin(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusLastLogin);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["last-login"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(50);
      setPanelProgress(["last-login"], 50);
      await refreshLeagueSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(80);
      setPanelProgress(["last-login"], 80);
      await refreshLastLoginSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["last-login"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingLastLogin(false);
      clearProgressIndicators();
    }
  };

  const refreshCoachOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingCoach(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusTransferFinance);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["coach"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["coach"], 55);
      await refreshCoachSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["coach"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingCoach(false);
      clearProgressIndicators();
    }
  };

  const refreshFinanceOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingFinance(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusTransferFinance);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["finance-estimate"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["finance-estimate"], 55);
      await refreshFinanceSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["finance-estimate"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingFinance(false);
      clearProgressIndicators();
    }
  };

  const refreshFanclubOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingFanclub(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusTeamDetails);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["fanclub"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["fanclub"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingFanclub(false);
      clearProgressIndicators();
    }
  };

  const refreshArenaOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingArena(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusArena);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["arena"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["arena"], 55);
      await refreshArenaSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["arena"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingArena(false);
      clearProgressIndicators();
    }
  };

  const refreshTransferOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingTransfer(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusTransferFinance);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["transfer-market"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["transfer-market"], 55);
      await refreshTransferSnapshots(nextCache, transferHistoryCount);
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["transfer-market"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingTransfer(false);
      clearProgressIndicators();
    }
  };

  const refreshTsiOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingTsi(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusTransferFinance);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["tsi"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["tsi"], 55);
      await refreshTsiSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["tsi"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingTsi(false);
      clearProgressIndicators();
    }
  };

  const refreshWagesOnly = async () => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingWages(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusTransferFinance);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["wages"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["wages"], 55);
      await refreshWagesSnapshots(nextCache);
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["wages"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingWages(false);
      clearProgressIndicators();
    }
  };

  const refreshFormationsTacticsOnly = async (
    includeFriendliesOverride?: boolean
  ) => {
    if (anyRefreshing) return;
    if (trackedTeams.length === 0) return;
    chronicleStopRequestedRef.current = false;
    setRefreshingFormationsTactics(true);
    try {
      setGlobalRefreshStatus(messages.clubChronicleRefreshStatusFormations);
      setGlobalRefreshProgressPct(20);
      setPanelProgress(["formations-tactics", "likely-training"], 20);
      const nextCache = pruneChronicleCache(readChronicleCache());
      const nextManualTeams = [...manualTeams];
      await refreshTeamDetails(nextCache, nextManualTeams, { updatePress: false });
      if (chronicleStopRequestedRef.current) return;
      setGlobalRefreshProgressPct(55);
      setPanelProgress(["formations-tactics", "likely-training"], 55);
      await refreshFormationsTacticsSnapshots(nextCache, {
        includeFriendlies: includeFriendliesOverride,
        onMatchesArchiveProgress: (completedTeams, totalTeams, teamName) => {
          if (chronicleStopRequestedRef.current) return;
          const ratio = totalTeams > 0 ? completedTeams / totalTeams : 1;
          const progress = Math.round(58 + ratio * 12);
          setGlobalRefreshProgressPct(progress);
          setGlobalRefreshStatus(
            formatStatusTemplate(
              messages.clubChronicleRefreshStatusMatchesArchiveProgress,
              {
                completed: completedTeams,
                total: totalTeams,
                team: teamName,
              }
            )
          );
          setPanelProgress(["formations-tactics", "likely-training"], progress);
        },
        onMatchDetailsProgress: (completedMatches, totalMatches, teamName) => {
          if (chronicleStopRequestedRef.current) return;
          const ratio = totalMatches > 0 ? completedMatches / totalMatches : 1;
          const progress = Math.round(70 + ratio * 28);
          setGlobalRefreshProgressPct(progress);
          setGlobalRefreshStatus(
            formatStatusTemplate(
              messages.clubChronicleRefreshStatusMatchDetailsProgress,
              {
                completed: completedMatches,
                total: totalMatches,
                team: teamName,
              }
            )
          );
          setPanelProgress(["formations-tactics", "likely-training"], progress);
        },
      });
      if (chronicleStopRequestedRef.current) return;
      if (chronicleStopRequestedRef.current) return;
      setManualTeams(nextManualTeams);
      setChronicleCache(nextCache);
      setGlobalRefreshProgressPct(100);
      setPanelProgress(["formations-tactics", "likely-training"], 100);
      addNotification(messages.notificationChronicleRefreshComplete);
    } catch (error) {
      if (!isChppAuthRequiredError(error)) {
        throw error;
      }
    } finally {
      setRefreshingFormationsTactics(false);
      clearProgressIndicators();
    }
  };

  const refreshLatestUpdatesFromGlobalBaseline = useCallback(() => {
    if (!globalBaselineCache) {
      setUpdates(null);
      setLastGlobalComparedAt(null);
      setLastGlobalHadChanges(true);
      return;
    }
    const comparedAt = Date.now();
    const nextUpdates = collectTeamChanges(
      chronicleCache,
      [
        "league",
        "press",
        "fanclub",
        "arena",
        "finance",
        "transfer",
        "formationsTactics",
        "likelyTraining",
        "lastLogin",
        "coach",
        "tsi",
        "wages",
      ],
      { baselineCache: globalBaselineCache }
    );
    const hasUpdates = hasAnyChanges(nextUpdates);
    setLastGlobalComparedAt(comparedAt);
    setLastGlobalHadChanges(hasUpdates);
    if (hasUpdates) {
      setUpdates(stripLikelyTrainingConfidenceFromUpdates(nextUpdates).updates);
      return;
    }

    const latestWithChanges = globalUpdatesHistory.find((entry) => entry.updates);
    if (latestWithChanges?.updates) {
      setUpdates(
        stripLikelyTrainingConfidenceFromUpdates(latestWithChanges.updates).updates
      );
      return;
    }

    setUpdates(stripLikelyTrainingConfidenceFromUpdates(nextUpdates).updates);
  }, [chronicleCache, globalBaselineCache, globalUpdatesHistory]);

  const handleLoadHistoryEntry = (entry: ChronicleGlobalUpdateEntry) => {
    if (!entry.updates) return;
    setLastGlobalComparedAt(entry.comparedAt);
    setLastGlobalHadChanges(entry.hasChanges);
    setUpdates(stripLikelyTrainingConfidenceFromUpdates(entry.updates).updates);
  };

  const updatesByTeam = updates?.teams ?? {};
  const hasAnyTeamUpdates = trackedTeams.some((team) => {
    const changes = (updatesByTeam[team.teamId]?.changes ?? []).filter(
      (change) => change.fieldKey !== "likelyTraining.confidence"
    );
    return changes.length > 0;
  });
  const latestHistoryWithChanges = globalUpdatesHistory.find((entry) => entry.updates);
  const showingPreviousSnapshot =
    !lastGlobalHadChanges && hasAnyTeamUpdates && !!latestHistoryWithChanges;
  const selectedHistoryComparedAt = useMemo(() => {
    if (
      lastGlobalComparedAt &&
      globalUpdatesHistory.some((entry) => entry.comparedAt === lastGlobalComparedAt)
    ) {
      return lastGlobalComparedAt;
    }
    return latestHistoryWithChanges?.comparedAt ?? null;
  }, [globalUpdatesHistory, lastGlobalComparedAt, latestHistoryWithChanges]);

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
      fanclub: cached?.fanclub,
    };
  });

  const arenaRows: ArenaRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    const snapshot = cached?.arena?.current ?? {
      arenaName: cached?.arenaName ?? null,
      currentTotalCapacity: null,
      rebuiltDate: null,
      currentAvailable: null,
      terraces: null,
      basic: null,
      roof: null,
      vip: null,
      expandedAvailable: null,
      expandedTotalCapacity: null,
      expansionDate: null,
      expandedTerraces: null,
      expandedBasic: null,
      expandedRoof: null,
      expandedVip: null,
      fetchedAt: 0,
    };
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot,
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

  const formationsTacticsRows: FormationTacticsRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.formationsTactics?.current,
    };
  });

  const likelyTrainingRows: LikelyTrainingRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.formationsTactics?.current,
    };
  });

  const tsiRows: TsiRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.tsi?.current,
    };
  });

  const wagesRows: WagesRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.wages?.current,
    };
  });

  const lastLoginRows: LastLoginRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.lastLogin?.current,
    };
  });
  const coachRows: CoachRow[] = trackedTeams.map((team) => {
    const cached = chronicleCache.teams[team.teamId];
    return {
      teamId: team.teamId,
      teamName: team.teamName ?? cached?.teamName ?? `${team.teamId}`,
      snapshot: cached?.coach?.current,
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

  const sortedArenaRows = useMemo(() => {
    if (!arenaSortState.key) return arenaRows;
    const column = arenaTableColumns.find((item) => item.key === arenaSortState.key);
    if (!column) return arenaRows;
    const direction = arenaSortState.direction === "desc" ? -1 : 1;
    return [...arenaRows]
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
  }, [arenaRows, arenaTableColumns, arenaSortState]);

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

  const sortedFormationsTacticsRows = useMemo(() => {
    if (!formationsTacticsSortState.key) return formationsTacticsRows;
    const column = formationsTacticsTableColumns.find(
      (item) => item.key === formationsTacticsSortState.key
    );
    if (!column) return formationsTacticsRows;
    const direction = formationsTacticsSortState.direction === "desc" ? -1 : 1;
    return [...formationsTacticsRows]
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
  }, [
    formationsTacticsRows,
    formationsTacticsTableColumns,
    formationsTacticsSortState,
  ]);

  const sortedLikelyTrainingRows = useMemo(() => {
    if (!likelyTrainingSortState.key) return likelyTrainingRows;
    const column = likelyTrainingTableColumns.find(
      (item) => item.key === likelyTrainingSortState.key
    );
    if (!column) return likelyTrainingRows;
    const direction = likelyTrainingSortState.direction === "desc" ? -1 : 1;
    return [...likelyTrainingRows]
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
  }, [likelyTrainingRows, likelyTrainingTableColumns, likelyTrainingSortState]);

  const sortedTsiRows = useMemo(() => {
    if (!tsiSortState.key) return tsiRows;
    const column = tsiTableColumns.find((item) => item.key === tsiSortState.key);
    if (!column) return tsiRows;
    const direction = tsiSortState.direction === "desc" ? -1 : 1;
    return [...tsiRows]
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
  }, [tsiRows, tsiTableColumns, tsiSortState]);

  const sortedWagesRows = useMemo(() => {
    if (!wagesSortState.key) return wagesRows;
    const column = wagesTableColumns.find((item) => item.key === wagesSortState.key);
    if (!column) return wagesRows;
    const direction = wagesSortState.direction === "desc" ? -1 : 1;
    return [...wagesRows]
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
  }, [wagesRows, wagesTableColumns, wagesSortState]);

  const sortedLastLoginRows = useMemo(() => {
    if (!lastLoginSortState.key) return lastLoginRows;
    const column = lastLoginTableColumns.find(
      (item) => item.key === lastLoginSortState.key
    );
    if (!column) return lastLoginRows;
    const direction = lastLoginSortState.direction === "desc" ? -1 : 1;
    return [...lastLoginRows]
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
  }, [lastLoginRows, lastLoginTableColumns, lastLoginSortState]);
  const sortedCoachRows = useMemo(() => {
    if (!coachSortState.key) return coachRows;
    const column = coachTableColumns.find((item) => item.key === coachSortState.key);
    if (!column) return coachRows;
    const direction = coachSortState.direction === "desc" ? -1 : 1;
    return [...coachRows]
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
  }, [coachRows, coachTableColumns, coachSortState]);

  const selectedTeam = selectedTeamId
    ? leagueRows.find((team) => team.teamId === selectedTeamId) ?? null
    : null;
  const selectedPressTeam = selectedPressTeamId
    ? pressRows.find((team) => team.teamId === selectedPressTeamId) ?? null
    : null;
  const selectedFanclubTeam = selectedFanclubTeamId
    ? fanclubRows.find((team) => team.teamId === selectedFanclubTeamId) ?? null
    : null;
  const selectedFinanceTeam = selectedFinanceTeamId
    ? financeRows.find((team) => team.teamId === selectedFinanceTeamId) ?? null
    : null;
  const selectedArenaTeam = selectedArenaTeamId
    ? arenaRows.find((team) => team.teamId === selectedArenaTeamId) ?? null
    : null;
  const selectedTransferTeam = selectedTransferTeamId
    ? transferRows.find((team) => team.teamId === selectedTransferTeamId) ?? null
    : null;
  const selectedFormationsTacticsTeam = selectedFormationsTacticsTeamId
    ? formationsTacticsRows.find(
        (team) => team.teamId === selectedFormationsTacticsTeamId
      ) ?? null
    : null;
  const selectedLikelyTrainingTeam = selectedLikelyTrainingTeamId
    ? likelyTrainingRows.find((team) => team.teamId === selectedLikelyTrainingTeamId) ??
      null
    : null;
  const selectedTsiTeam = selectedTsiTeamId
    ? tsiRows.find((team) => team.teamId === selectedTsiTeamId) ?? null
    : null;
  const selectedWagesTeam = selectedWagesTeamId
    ? wagesRows.find((team) => team.teamId === selectedWagesTeamId) ?? null
    : null;
  const selectedLastLoginTeam = selectedLastLoginTeamId
    ? lastLoginRows.find((team) => team.teamId === selectedLastLoginTeamId) ?? null
    : null;
  const selectedCoachTeam = selectedCoachTeamId
    ? coachRows.find((team) => team.teamId === selectedCoachTeamId) ?? null
    : null;
  const lastLoginDetailRows = useMemo(
    () => {
      const selectedTeamId = selectedLastLoginTeam?.teamId ?? 0;
      return (selectedLastLoginTeam?.snapshot?.loginEvents ?? []).map((event, index) => {
        const timestamp = parseLoginTimeToTimestamp(event.dateTime);
        const formattedDateTime = formatLastLoginDateTime(event.dateTime);
        const formattedAge = formatLastLoginAge(timestamp);
        return {
          id: `${selectedTeamId}-${event.raw}-${index}`,
          dateTimeLabel:
            formattedDateTime && formattedAge
              ? `${formattedDateTime} (${formattedAge})`
              : formattedDateTime ?? messages.unknownShort,
          ipAddress: normalizeLastLoginIpAddress(event.ipAddress),
          timestamp,
        };
      });
    },
    [
      formatLastLoginAge,
      formatLastLoginDateTime,
      messages.unknownShort,
      selectedLastLoginTeam,
    ]
  );
  const lastLoginDetailsColumns = useMemo<
    ChronicleTableColumn<
      {
        id: string;
        dateTimeLabel: string;
        ipAddress: string | null;
        timestamp: number | null;
      },
      {
        id: string;
        dateTimeLabel: string;
        ipAddress: string | null;
        timestamp: number | null;
      }
    >[]
  >(
    () => [
      {
        key: "dateTime",
        label: messages.clubChronicleLastLoginColumnLatest,
        getValue: (snapshot) => snapshot?.dateTimeLabel ?? null,
        getSortValue: (snapshot) => snapshot?.timestamp ?? null,
      },
      {
        key: "ipAddress",
        label: messages.clubChronicleLastLoginColumnIpAddress,
        getValue: (snapshot) => snapshot?.ipAddress ?? null,
      },
    ],
    [
      messages.clubChronicleLastLoginColumnIpAddress,
      messages.clubChronicleLastLoginColumnLatest,
    ]
  );
  const fanclubDetailsSnapshot = useMemo<FanclubDetailsSnapshot | null>(() => {
    const fanclub = selectedFanclubTeam?.fanclub;
    if (!fanclub) return null;
    const previousSize = fanclub.previous?.fanclubSize ?? null;
    const currentSize = fanclub.current.fanclubSize ?? null;
    return {
      previousDate: fanclub.previous?.fetchedAt ?? null,
      previousSize,
      currentDate: fanclub.current.fetchedAt ?? null,
      currentSize,
      sizeDiff:
        previousSize !== null && currentSize !== null ? currentSize - previousSize : null,
    };
  }, [selectedFanclubTeam]);
  const formationDistributionTotal = useMemo(
    () =>
      (selectedFormationsTacticsTeam?.snapshot?.formationDistribution ?? []).reduce(
        (sum, entry) => sum + entry.count,
        0
      ),
    [selectedFormationsTacticsTeam]
  );
  const tacticDistributionTotal = useMemo(
    () =>
      (selectedFormationsTacticsTeam?.snapshot?.tacticDistribution ?? []).reduce(
        (sum, entry) => sum + entry.count,
        0
      ),
    [selectedFormationsTacticsTeam]
  );
  const formationChartData = useMemo(
    () => selectedFormationsTacticsTeam?.snapshot?.formationDistribution ?? [],
    [selectedFormationsTacticsTeam]
  );
  const tacticChartData = useMemo(
    () => selectedFormationsTacticsTeam?.snapshot?.tacticDistribution ?? [],
    [selectedFormationsTacticsTeam]
  );
  const likelyTrainingDetailRows = useMemo(
    () =>
      (selectedLikelyTrainingTeam?.snapshot?.likelyTrainingScores ?? []).map(
        (entry) => ({
          key: entry.key,
          regimen: formatLikelyTrainingLabel(entry.key),
          confidence:
            entry.confidencePct !== null
              ? `${formatValue(entry.confidencePct)}%`
              : messages.unknownShort,
          confidenceRaw: entry.confidencePct ?? -1,
        })
      ),
    [formatLikelyTrainingLabel, selectedLikelyTrainingTeam, messages.unknownShort]
  );
  const likelyTrainingDetailsColumns = useMemo<
    ChronicleTableColumn<
      {
        key: string;
        regimen: string;
        confidence: string;
        confidenceRaw: number;
      },
      {
        key: string;
        regimen: string;
        confidence: string;
        confidenceRaw: number;
      }
    >[]
  >(
    () => [
      {
        key: "regimen",
        label: messages.clubChronicleLikelyTrainingColumnRegimen,
        getValue: (snapshot) => snapshot?.regimen ?? null,
      },
      {
        key: "confidence",
        label: messages.clubChronicleLikelyTrainingConfidenceLabel,
        getValue: (snapshot) => snapshot?.confidence ?? null,
        getSortValue: (snapshot) => snapshot?.confidenceRaw ?? null,
      },
    ],
    [
      messages.clubChronicleLikelyTrainingColumnRegimen,
      messages.clubChronicleLikelyTrainingConfidenceLabel,
    ]
  );
  const fanclubDetailsPreviousHeader = useMemo(() => {
    if (!fanclubDetailsSnapshot?.previousDate) {
      return messages.clubChronicleDetailsPreviousLabel;
    }
    return `${messages.clubChronicleDetailsPreviousLabel} (${formatDateTime(
      fanclubDetailsSnapshot.previousDate
    )})`;
  }, [fanclubDetailsSnapshot?.previousDate, messages.clubChronicleDetailsPreviousLabel]);
  const fanclubDetailsCurrentHeader = useMemo(() => {
    if (!fanclubDetailsSnapshot?.currentDate) {
      return messages.clubChronicleDetailsCurrentLabel;
    }
    return `${messages.clubChronicleDetailsCurrentLabel} (${formatDateTime(
      fanclubDetailsSnapshot.currentDate
    )})`;
  }, [fanclubDetailsSnapshot?.currentDate, messages.clubChronicleDetailsCurrentLabel]);
  const fanclubDetailsColumns = useMemo<
    ChronicleTableColumn<{ id: string }, FanclubDetailsSnapshot>[]
  >(
    () => [
      {
        key: "previousSize",
        label: fanclubDetailsPreviousHeader,
        getValue: (snapshot: FanclubDetailsSnapshot | undefined) =>
          snapshot?.previousSize ?? null,
      },
      {
        key: "currentSize",
        label: fanclubDetailsCurrentHeader,
        getValue: (snapshot: FanclubDetailsSnapshot | undefined) =>
          snapshot?.currentSize ?? null,
      },
      {
        key: "sizeDiff",
        label: messages.clubChronicleFanclubSizeDiff,
        getValue: (snapshot: FanclubDetailsSnapshot | undefined) => {
          const diff = snapshot?.sizeDiff;
          if (diff === null || diff === undefined) return null;
          const formatted = Math.abs(diff);
          if (diff > 0) return `+${formatted}`;
          if (diff < 0) return `-${formatted}`;
          return formatted;
        },
      },
    ],
    [
      fanclubDetailsPreviousHeader,
      fanclubDetailsCurrentHeader,
      messages.clubChronicleFanclubSizeDiff,
    ]
  );
  const transferListedRows = useMemo(
    () => selectedTransferTeam?.snapshot?.transferListedPlayers ?? [],
    [selectedTransferTeam]
  );
  const transferHistoryRows = useMemo(
    () => selectedTransferTeam?.snapshot?.latestTransfers ?? [],
    [selectedTransferTeam]
  );
  const formatAgeWithDays = useCallback(
    (age: number | null | undefined, ageDays: number | null | undefined) => {
      if (age === null || age === undefined) return null;
      if (ageDays === null || ageDays === undefined) return `${age}`;
      return `${age}${messages.ageYearsShort} ${ageDays}${messages.ageDaysShort}`;
    },
    [messages.ageDaysShort, messages.ageYearsShort]
  );
  const coachDetailsRows = useMemo(
    () =>
      selectedCoachTeam?.snapshot
        ? [
            {
              id: `${selectedCoachTeam.teamId}-coach`,
              name: selectedCoachTeam.snapshot.name ?? null,
              age: formatAgeWithDays(
                selectedCoachTeam.snapshot.age,
                selectedCoachTeam.snapshot.ageDays
              ),
              country:
                selectedCoachTeam.snapshot.countryName ??
                (selectedCoachTeam.snapshot.countryId !== null
                  ? String(selectedCoachTeam.snapshot.countryId)
                  : null),
              hiringDate: selectedCoachTeam.snapshot.contractDate
                ? formatChppDateTime(selectedCoachTeam.snapshot.contractDate) ??
                  selectedCoachTeam.snapshot.contractDate
                : null,
              costPerWeek: formatChppCurrencyFromSek(selectedCoachTeam.snapshot.costSek),
              mindset: formatCoachMindset(selectedCoachTeam.snapshot.trainerType),
              leadership: selectedCoachTeam.snapshot.leadership,
              trainerLevel: selectedCoachTeam.snapshot.trainerSkillLevel,
              status: formatCoachStatus(selectedCoachTeam.snapshot.trainerStatus),
            },
          ]
        : [],
    [formatAgeWithDays, formatCoachMindset, formatCoachStatus, selectedCoachTeam]
  );
  const coachDetailsColumns = useMemo<
    ChronicleTableColumn<
      {
        id: string;
        name: string | null;
        age: string | null;
        country: string | null;
        hiringDate: string | null;
        costPerWeek: string;
        mindset: string;
        leadership: number | null;
        trainerLevel: number | null;
        status: string;
      },
      {
        id: string;
        name: string | null;
        age: string | null;
        country: string | null;
        hiringDate: string | null;
        costPerWeek: string;
        mindset: string;
        leadership: number | null;
        trainerLevel: number | null;
        status: string;
      }
    >[]
  >(
    () => [
      {
        key: "name",
        label: messages.clubChronicleCoachColumnName,
        getValue: (snapshot) => snapshot?.name ?? null,
      },
      {
        key: "age",
        label: messages.clubChronicleCoachColumnAge,
        getValue: (snapshot) => snapshot?.age ?? null,
      },
      {
        key: "country",
        label: messages.clubChronicleCoachColumnCountry,
        getValue: (snapshot) => snapshot?.country ?? null,
      },
      {
        key: "hiringDate",
        label: messages.clubChronicleCoachColumnHiringDate,
        getValue: (snapshot) => snapshot?.hiringDate ?? null,
      },
      {
        key: "costPerWeek",
        label: messages.clubChronicleCoachColumnCostPerWeek,
        getValue: (snapshot) => snapshot?.costPerWeek ?? null,
      },
      {
        key: "mindset",
        label: messages.clubChronicleCoachColumnMindset,
        getValue: (snapshot) => snapshot?.mindset ?? null,
      },
      {
        key: "leadership",
        label: messages.clubChronicleCoachColumnLeadership,
        getValue: (snapshot) => formatSkillLevelLabel(snapshot?.leadership),
      },
      {
        key: "trainerLevel",
        label: messages.clubChronicleCoachColumnTrainerLevel,
        getValue: (snapshot) => snapshot?.trainerLevel ?? null,
      },
      {
        key: "status",
        label: messages.clubChronicleCoachColumnStatus,
        getValue: (snapshot) => snapshot?.status ?? null,
      },
    ],
    [
      formatSkillLevelLabel,
      messages.clubChronicleCoachColumnAge,
      messages.clubChronicleCoachColumnCostPerWeek,
      messages.clubChronicleCoachColumnCountry,
      messages.clubChronicleCoachColumnHiringDate,
      messages.clubChronicleCoachColumnLeadership,
      messages.clubChronicleCoachColumnMindset,
      messages.clubChronicleCoachColumnName,
      messages.clubChronicleCoachColumnStatus,
      messages.clubChronicleCoachColumnTrainerLevel,
    ]
  );
  const wagesPlayerRows = useMemo<WagesPlayerRow[]>(
    () =>
      (selectedWagesTeam?.snapshot?.players ?? []).map((row, index) => ({
        teamId: selectedWagesTeam?.teamId ?? 0,
        ...row,
        playerNumber: index + 1,
      })),
    [selectedWagesTeam]
  );
  const tsiPlayerRows = useMemo<TsiPlayerRow[]>(
    () =>
      (selectedTsiTeam?.snapshot?.players ?? []).map((row, index) => ({
        teamId: selectedTsiTeam?.teamId ?? 0,
        ...row,
        playerNumber: index + 1,
      })),
    [selectedTsiTeam]
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
              href={hattrickPlayerUrl(playerId)}
              target="_blank"
              rel="noreferrer"
            >
              {playerName}
            </a>
          );
        },
      },
      {
        key: "age",
        label: messages.clubChronicleTransferListedAgeColumn,
        getValue: (snapshot) => formatAgeWithDays(snapshot?.age, snapshot?.ageDays),
        getSortValue: (snapshot) => {
          const age = snapshot?.age;
          if (age === null || age === undefined) return null;
          return age * CHPP_DAYS_PER_YEAR + (snapshot?.ageDays ?? 0);
        },
      },
      {
        key: "tsi",
        label: messages.clubChronicleTransferListedTsiColumn,
        getValue: (snapshot) => snapshot?.tsi ?? null,
      },
      {
        key: "askingPrice",
        label: messages.clubChronicleTransferListedAskingPriceColumn,
        getValue: (snapshot) =>
          snapshot ? formatChppCurrencyFromSek(snapshot.askingPriceSek) : null,
        getSortValue: (snapshot) => snapshot?.askingPriceSek ?? null,
      },
    ],
    [
      messages.clubChronicleTransferListedAgeColumn,
      messages.clubChronicleTransferListedAskingPriceColumn,
      messages.clubChronicleTransferListedPlayerColumn,
      messages.clubChronicleTransferListedTsiColumn,
      formatAgeWithDays,
    ]
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
              href={hattrickPlayerUrl(playerId)}
              target="_blank"
              rel="noreferrer"
            >
              {snapshot.resolvedPlayerName}
            </a>
          );
        },
      },
      {
        key: "age",
        label: messages.clubChronicleTransferHistoryAgeAtTransferColumn,
        getValue: (snapshot) => formatAgeWithDays(snapshot?.age, snapshot?.ageDays),
        getSortValue: (snapshot) => {
          const age = snapshot?.age;
          if (age === null || age === undefined) return null;
          return age * CHPP_DAYS_PER_YEAR + (snapshot?.ageDays ?? 0);
        },
      },
      {
        key: "tsi",
        label: messages.clubChronicleTransferListedTsiColumn,
        getValue: (snapshot) => snapshot?.tsi ?? null,
      },
      {
        key: "price",
        label: messages.clubChronicleTransferHistoryPriceColumn,
        getValue: (snapshot) =>
          snapshot?.priceSek !== null && snapshot?.priceSek !== undefined
            ? formatChppCurrencyFromSek(snapshot.priceSek)
            : null,
      },
    ],
    [
      messages.clubChronicleTransferHistoryDateColumn,
      messages.clubChronicleTransferHistoryTypeColumn,
      messages.clubChronicleTransferTypeSale,
      messages.clubChronicleTransferTypeBuy,
      messages.clubChronicleTransferHistoryAgeAtTransferColumn,
      messages.clubChronicleTransferHistoryPlayerColumn,
      messages.clubChronicleTransferHistoryPriceColumn,
      messages.clubChronicleTransferListedTsiColumn,
      formatAgeWithDays,
    ]
  );

  const tsiPlayerColumns = useMemo<
    ChronicleTableColumn<TsiPlayerRow, TsiPlayerRow>[]
  >(
    () => [
      {
        key: "playerNumber",
        label: messages.clubChronicleTsiPlayerIndexColumn,
        getValue: (snapshot) => snapshot?.playerNumber ?? null,
      },
      {
        key: "player",
        label: messages.clubChronicleTsiPlayerColumn,
        getValue: (snapshot) => snapshot?.playerName ?? null,
        renderCell: (snapshot, _row, fallbackFormat) => {
          const playerId = snapshot?.playerId ?? 0;
          const playerName = snapshot?.playerName ?? null;
          const injuryIndicator = renderInjuryStatusInline(snapshot?.injuryLevel);
          if (!playerId) return fallbackFormat(playerName);
          return (
            <a
              className={styles.chroniclePressLink}
              href={hattrickPlayerUrl(playerId)}
              target="_blank"
              rel="noreferrer"
            >
              {playerName ?? `${playerId}`}
              {injuryIndicator}
            </a>
          );
        },
      },
      {
        key: "age",
        label: messages.clubChronicleTransferListedAgeColumn,
        getValue: (snapshot) => formatAgeWithDays(snapshot?.age, snapshot?.ageDays),
        getSortValue: (snapshot) => {
          const age = snapshot?.age;
          if (age === null || age === undefined) return null;
          return age * CHPP_DAYS_PER_YEAR + (snapshot?.ageDays ?? 0);
        },
      },
      {
        key: "tsi",
        label: messages.clubChronicleTsiValueColumn,
        getValue: (snapshot) => snapshot?.tsi ?? null,
      },
    ],
    [
      messages.clubChronicleTsiPlayerIndexColumn,
      messages.clubChronicleTsiPlayerColumn,
      messages.clubChronicleTransferListedAgeColumn,
      messages.clubChronicleTsiValueColumn,
      formatAgeWithDays,
      renderInjuryStatusInline,
    ]
  );

  const sortedTsiPlayerRows = useMemo(() => {
    if (!tsiDetailsSortState.key) return tsiPlayerRows;
    const column = tsiPlayerColumns.find(
      (item) => item.key === tsiDetailsSortState.key
    );
    if (!column) return tsiPlayerRows;
    const direction = tsiDetailsSortState.direction === "desc" ? -1 : 1;
    return [...tsiPlayerRows]
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftValue = normalizeSortValue(
          column.getSortValue?.(left.row, left.row) ??
            column.getValue(left.row, left.row)
        );
        const rightValue = normalizeSortValue(
          column.getSortValue?.(right.row, right.row) ??
            column.getValue(right.row, right.row)
        );
        const result = compareSortValues(leftValue, rightValue);
        if (result !== 0) return result * direction;
        return left.index - right.index;
      })
      .map((item) => item.row);
  }, [tsiPlayerRows, tsiPlayerColumns, tsiDetailsSortState]);

  const wagesPlayerColumns = useMemo<
    ChronicleTableColumn<WagesPlayerRow, WagesPlayerRow>[]
  >(
    () => [
      {
        key: "playerNumber",
        label: messages.clubChronicleWagesPlayerIndexColumn,
        getValue: (snapshot) => snapshot?.playerNumber ?? null,
      },
      {
        key: "player",
        label: messages.clubChronicleWagesPlayerColumn,
        getValue: (snapshot) => snapshot?.playerName ?? null,
        renderCell: (snapshot, _row, fallbackFormat) => {
          const playerId = snapshot?.playerId ?? 0;
          const playerName = snapshot?.playerName ?? null;
          const injuryIndicator = renderInjuryStatusInline(snapshot?.injuryLevel);
          if (!playerId) return fallbackFormat(playerName);
          return (
            <a
              className={styles.chroniclePressLink}
              href={hattrickPlayerUrl(playerId)}
              target="_blank"
              rel="noreferrer"
            >
              {playerName ?? `${playerId}`}
              {injuryIndicator}
            </a>
          );
        },
      },
      {
        key: "age",
        label: messages.clubChronicleTransferListedAgeColumn,
        getValue: (snapshot) => formatAgeWithDays(snapshot?.age, snapshot?.ageDays),
        getSortValue: (snapshot) => {
          const age = snapshot?.age;
          if (age === null || age === undefined) return null;
          return age * CHPP_DAYS_PER_YEAR + (snapshot?.ageDays ?? 0);
        },
      },
      {
        key: "wage",
        label: messages.clubChronicleWagesValueColumn,
        getValue: (snapshot) => formatChppCurrencyFromSek(snapshot?.salarySek ?? null),
        getSortValue: (snapshot) => snapshot?.salarySek ?? null,
      },
    ],
    [
      messages.clubChronicleWagesPlayerIndexColumn,
      messages.clubChronicleWagesPlayerColumn,
      messages.clubChronicleTransferListedAgeColumn,
      messages.clubChronicleWagesValueColumn,
      formatAgeWithDays,
      renderInjuryStatusInline,
    ]
  );

  const sortedWagesPlayerRows = useMemo(() => {
    if (!wagesDetailsSortState.key) return wagesPlayerRows;
    const column = wagesPlayerColumns.find(
      (item) => item.key === wagesDetailsSortState.key
    );
    if (!column) return wagesPlayerRows;
    const direction = wagesDetailsSortState.direction === "desc" ? -1 : 1;
    return [...wagesPlayerRows]
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftValue = normalizeSortValue(
          column.getSortValue?.(left.row, left.row) ??
            column.getValue(left.row, left.row)
        );
        const rightValue = normalizeSortValue(
          column.getSortValue?.(right.row, right.row) ??
            column.getValue(right.row, right.row)
        );
        const result = compareSortValues(leftValue, rightValue);
        if (result !== 0) return result * direction;
        return left.index - right.index;
      })
      .map((item) => item.row);
  }, [wagesPlayerRows, wagesPlayerColumns, wagesDetailsSortState]);

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
            const { payload } = await fetchChppJson<{
              data?: {
                HattrickData?: {
                  Player?: {
                    FirstName?: string;
                    NickName?: string;
                    LastName?: string;
                  };
                };
              };
            }>(`/api/chpp/playerdetails?playerId=${id}`, {
              cache: "no-store",
            });
            const player = payload?.data?.HattrickData?.Player;
            const name = [player?.FirstName, player?.NickName, player?.LastName]
              .filter(Boolean)
              .join(" ")
              .trim();
            if (!name) return;
            setResolvedPlayers((prev) => ({ ...prev, [id]: name }));
          } catch (error) {
            if (isChppAuthRequiredError(error)) return;
            // ignore resolve failures
          }
        })
    );

    void Promise.all(
      matchIds
        .filter((id) => !resolvedMatches[id])
        .map(async (id) => {
          try {
            const { payload } = await fetchChppJson<{
              data?: {
                HattrickData?: {
                  Match?: {
                    HomeTeam?: { HomeTeamName?: string };
                    AwayTeam?: { AwayTeamName?: string };
                  };
                };
              };
            }>(
              `/api/chpp/matchdetails?matchId=${id}&sourceSystem=Hattrick`,
              { cache: "no-store" }
            );
            const match = payload?.data?.HattrickData?.Match;
            const home = match?.HomeTeam?.HomeTeamName?.trim();
            const away = match?.AwayTeam?.AwayTeamName?.trim();
            if (!home || !away) return;
            setResolvedMatches((prev) => ({ ...prev, [id]: `${home} vs ${away}` }));
          } catch (error) {
            if (isChppAuthRequiredError(error)) return;
            // ignore resolve failures
          }
        })
    );

    void Promise.all(
      teamIds
        .filter((id) => !resolvedTeams[id])
        .map(async (id) => {
          try {
            const { payload } = await fetchChppJson<{
              data?: {
                HattrickData?: {
                  Team?: { TeamName?: string };
                };
              };
            }>(`/api/chpp/teamdetails?teamId=${id}`, {
              cache: "no-store",
            });
            const teamNode = extractTeamDetailsNode(payload, id) as
              | { TeamName?: string }
              | null;
            const name = teamNode?.TeamName?.trim();
            if (!name) return;
            setResolvedTeams((prev) => ({ ...prev, [id]: name }));
          } catch (error) {
            if (isChppAuthRequiredError(error)) return;
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
              const href = hattrickPlayerUrl(token.id);
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
              const href = hattrickMatchUrl(token.id);
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
              const href = hattrickTeamUrl(token.id);
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
              const href = hattrickArticleUrl(token.id);
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
  const fanclubDetailsTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": fanclubDetailsColumns.length,
        "--cc-template":
          "minmax(220px, 1fr) minmax(220px, 1fr) minmax(140px, 0.8fr)",
      }) as CSSProperties,
    [fanclubDetailsColumns.length]
  );

  const arenaTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": arenaTableColumns.length,
        "--cc-template":
          "minmax(150px, 1.2fr) minmax(180px, 1.4fr) minmax(120px, 0.9fr) minmax(150px, 1fr)",
      }) as CSSProperties,
    [arenaTableColumns.length]
  );

  const transferTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": transferTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(90px, 0.7fr) minmax(130px, 0.9fr)",
      }) as CSSProperties,
    [transferTableColumns.length]
  );

  const formationsTacticsTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": formationsTacticsTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(130px, 0.9fr) minmax(170px, 1fr)",
      }) as CSSProperties,
    [formationsTacticsTableColumns.length]
  );

  const likelyTrainingTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": likelyTrainingTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(220px, 1.2fr)",
      }) as CSSProperties,
    [likelyTrainingTableColumns.length]
  );

  const likelyTrainingDetailsTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": likelyTrainingDetailsColumns.length,
        "--cc-template": "minmax(240px, 1.4fr) minmax(140px, 0.9fr)",
      }) as CSSProperties,
    [likelyTrainingDetailsColumns.length]
  );

  const tsiTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": tsiTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr)",
      }) as CSSProperties,
    [tsiTableColumns.length]
  );

  const wagesTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": wagesTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr)",
      }) as CSSProperties,
    [wagesTableColumns.length]
  );

  const lastLoginTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": lastLoginTableColumns.length,
        "--cc-template": "minmax(180px, 1.4fr) minmax(180px, 1.1fr)",
      }) as CSSProperties,
    [lastLoginTableColumns.length]
  );
  const lastLoginDetailsTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": lastLoginDetailsColumns.length,
        "--cc-template": "minmax(0, 2.4fr) minmax(0, 0.6fr)",
      }) as CSSProperties,
    [lastLoginDetailsColumns.length]
  );
  const coachTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": coachTableColumns.length,
        "--cc-template":
          "minmax(180px, 1.3fr) minmax(200px, 1.5fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr)",
      }) as CSSProperties,
    [coachTableColumns.length]
  );
  const coachDetailsTableStyle = useMemo(
    () =>
      ({
        "--cc-columns": coachDetailsColumns.length,
        "--cc-template":
          "minmax(180px, 1.2fr) minmax(100px, 0.8fr) minmax(100px, 0.7fr) minmax(180px, 1fr) minmax(150px, 0.9fr) minmax(140px, 0.9fr) minmax(120px, 0.8fr) minmax(120px, 0.8fr) minmax(140px, 0.9fr)",
      }) as CSSProperties,
    [coachDetailsColumns.length]
  );

  const primaryChronicleTeamId = primaryTeam?.teamId ?? null;
  const getTeamRowClassName = useCallback(
    (row: { teamId: number }) =>
      primaryChronicleTeamId !== null && row.teamId === primaryChronicleTeamId
        ? styles.chronicleTableRowPrimary
        : undefined,
    [primaryChronicleTeamId]
  );

  return (
    <div className={styles.clubChronicleStack} ref={chronicleRootRef}>
      {showHelp ? (
        <div className={styles.clubChronicleHelpOverlay}>
          <div className={styles.helpCallouts}>
            {helpCallouts.map((callout, index) => (
              <div
                key={callout.id}
                className={`${styles.helpCallout} ${styles.clubChronicleHelpCallout}`}
                style={callout.style}
                data-placement={callout.placement}
              >
                <span className={styles.helpCalloutIndex}>{index + 1}</span>
                <span className={styles.helpCalloutText}>{callout.text}</span>
              </div>
            ))}
          </div>
          <div className={styles.clubChronicleHelpCard} style={{ top: `${helpCardTop}px` }}>
            <h2 className={styles.helpTitle}>{messages.clubChronicleHelpTitle}</h2>
            <p className={styles.helpIntro}>{messages.clubChronicleHelpIntro}</p>
            <ul className={styles.helpList}>
              <li>{messages.clubChronicleHelpBulletControls}</li>
              <li>{messages.clubChronicleHelpBulletLeague}</li>
              <li>{messages.clubChronicleHelpBulletPress}</li>
              <li>{messages.clubChronicleHelpBulletFinance}</li>
              <li>{messages.clubChronicleHelpBulletFanclub}</li>
              <li>{messages.clubChronicleHelpBulletArena}</li>
              <li>{messages.clubChronicleHelpBulletTransfer}</li>
              <li>{messages.clubChronicleHelpBulletFormations}</li>
              <li>{messages.clubChronicleHelpBulletLikelyTraining}</li>
              <li>{messages.clubChronicleHelpBulletTsi}</li>
              <li>{messages.clubChronicleHelpBulletWages}</li>
              <li>{messages.clubChronicleHelpBulletLatestUpdates}</li>
            </ul>
            <button
              type="button"
              className={styles.helpDismiss}
              onClick={() => {
                setShowHelp(false);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(HELP_STORAGE_KEY, "1");
                  window.localStorage.setItem(
                    HELP_DISMISSED_TOKEN_KEY,
                    currentToken ?? "__unknown__"
                  );
                }
              }}
            >
              {messages.helpDismissLabel}
            </button>
          </div>
        </div>
      ) : null}
      <div className={styles.chronicleHeader}>
        <div className={styles.chronicleHeaderActions}>
          <Tooltip content={messages.clubChronicleRefreshAllTooltip}>
            <button
              type="button"
              className={styles.chronicleUpdatesButton}
              data-help-anchor="cc-refresh-all"
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
            data-help-anchor="cc-latest-updates"
            onClick={() => {
              refreshLatestUpdatesFromGlobalBaseline();
              setUpdatesOpen(true);
            }}
          >
            {messages.clubChronicleUpdatesButton}
          </button>
        </div>
        {globalRefreshStatus || anyRefreshing ? (
          <div className={styles.chronicleRefreshStatusWrap} aria-live="polite">
            <span className={styles.chronicleRefreshStatusText}>
              {globalRefreshStatus ?? messages.refreshingLabel}
            </span>
            <span className={styles.chronicleRefreshProgressRow}>
              <span className={styles.chronicleRefreshProgressTrack} aria-hidden="true">
                <span
                  className={styles.chronicleRefreshProgressFill}
                  style={{
                    width: `${Math.max(0, Math.min(100, globalRefreshProgressPct))}%`,
                  }}
                />
              </span>
              {anyRefreshing ? (
                <Tooltip content={messages.refreshStopTooltip}>
                  <button
                    type="button"
                    className={`${styles.chronicleUpdatesButton} ${styles.chronicleRefreshStopButton}`}
                    onClick={requestStopRefresh}
                    aria-label={messages.refreshStopTooltip}
                  >
                    ■
                  </button>
                </Tooltip>
              ) : null}
            </span>
          </div>
        ) : null}
        {lastGlobalRefreshAt ? (
          <span className={styles.chronicleRefreshStatusText}>
            {messages.clubChronicleLastGlobalRefresh}:{" "}
            {formatDateTime(lastGlobalRefreshAt)}
          </span>
        ) : null}
        <div className={styles.watchlistFabWrap}>
          <Tooltip content={messages.watchlistTitle}>
            <button
              type="button"
              className={styles.watchlistFab}
              data-help-anchor="cc-watchlist"
              onClick={() => setWatchlistOpen(true)}
              aria-label={messages.watchlistTitle}
            >
              ☰
            </button>
          </Tooltip>
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
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleLeaguePanelTitle}
                  refreshing={refreshingGlobal || refreshingLeague}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshLeagueOnly()}
                  onPointerDown={handlePanelPointerDown}
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
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenDetails(row.teamId)}
                      formatValue={formatValue}
                      style={tableStyle}
                      sortKey={leagueSortState.key}
                      sortDirection={leagueSortState.direction}
                      onSort={handleLeagueSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
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
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChroniclePressPanelTitle}
                  refreshing={refreshingGlobal || refreshingPress}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshPressTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshPressOnly()}
                  onPointerDown={handlePanelPointerDown}
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
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenPressDetails(row.teamId)}
                      formatValue={formatValue}
                      style={pressTableStyle}
                      sortKey={pressSortState.key}
                      sortDirection={pressSortState.direction}
                      onSort={handlePressSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
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
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleFinancePanelTitle}
                  refreshing={refreshingGlobal || refreshingFinance}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshFinanceTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshFinanceOnly()}
                  onPointerDown={handlePanelPointerDown}
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
                        getRowClassName={getTeamRowClassName}
                        onRowClick={(row) => handleOpenFinanceDetails(row.teamId)}
                        formatValue={formatValue}
                        style={financeTableStyle}
                        sortKey={financeSortState.key}
                        sortDirection={financeSortState.direction}
                        onSort={handleFinanceSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
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
          if (panelId === "last-login") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleLastLoginPanelTitle}
                  refreshing={refreshingGlobal || refreshingLastLogin}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshLastLoginTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshLastLoginOnly()}
                  onPointerDown={handlePanelPointerDown}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingLastLogin) &&
                    lastLoginRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={lastLoginTableColumns}
                      rows={sortedLastLoginRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenLastLoginDetails(row.teamId)}
                      formatValue={formatValue}
                      style={lastLoginTableStyle}
                      sortKey={lastLoginSortState.key}
                      sortDirection={lastLoginSortState.direction}
                      onSort={handleLastLoginSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "coach") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleCoachPanelTitle}
                  refreshing={refreshingGlobal || refreshingCoach}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshCoachTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshCoachOnly()}
                  onPointerDown={handlePanelPointerDown}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingCoach) &&
                    coachRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={coachTableColumns}
                      rows={sortedCoachRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenCoachDetails(row.teamId)}
                      formatValue={formatValue}
                      style={coachTableStyle}
                      sortKey={coachSortState.key}
                      sortDirection={coachSortState.direction}
                      onSort={handleCoachSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
                    />
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
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleFanclubPanelTitle}
                  refreshing={refreshingGlobal || refreshingFanclub}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshFanclubOnly()}
                  onPointerDown={handlePanelPointerDown}
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
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenFanclubDetails(row.teamId)}
                      formatValue={formatValue}
                      style={fanclubTableStyle}
                      sortKey={fanclubSortState.key}
                      sortDirection={fanclubSortState.direction}
                      onSort={handleFanclubSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "arena") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleArenaPanelTitle}
                  refreshing={refreshingGlobal || refreshingArena}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshArenaTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshArenaOnly()}
                  onPointerDown={handlePanelPointerDown}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingArena) &&
                    arenaRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={arenaTableColumns}
                      rows={sortedArenaRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenArenaDetails(row.teamId)}
                      formatValue={formatValue}
                      style={arenaTableStyle}
                      sortKey={arenaSortState.key}
                      sortDirection={arenaSortState.direction}
                      onSort={handleArenaSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
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
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleTransferPanelTitle}
                  refreshing={refreshingGlobal || refreshingTransfer}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshTransferTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshTransferOnly()}
                  onPointerDown={handlePanelPointerDown}
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
                      getRowClassName={getTeamRowClassName}
                      formatValue={formatValue}
                      style={transferTableStyle}
                      sortKey={transferSortState.key}
                      sortDirection={transferSortState.direction}
                      onSort={handleTransferSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "formations-tactics") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleFormationsPanelTitle}
                  headerAccessory={
                    <label
                      className={styles.chroniclePanelHeaderToggle}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <span className={styles.chroniclePanelHeaderToggleText}>
                        {messages.clubChronicleFormationsIncludeFriendliesLabel}
                      </span>
                      <input
                        type="checkbox"
                        className={styles.chroniclePanelHeaderToggleInput}
                        checked={formationsIncludeFriendlies}
                        onChange={(event) => {
                          const nextValue = event.target.checked;
                          setFormationsIncludeFriendlies(nextValue);
                          writeFormationsIncludeFriendlies(nextValue);
                          void refreshFormationsTacticsOnly(nextValue);
                        }}
                      />
                      <span
                        className={styles.chroniclePanelHeaderToggleSwitch}
                        aria-hidden="true"
                      />
                    </label>
                  }
                  refreshing={refreshingGlobal || refreshingFormationsTactics}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshFormationsTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshFormationsTacticsOnly()}
                  onPointerDown={handlePanelPointerDown}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingFormationsTactics) &&
                    formationsTacticsRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={formationsTacticsTableColumns}
                      rows={sortedFormationsTacticsRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) =>
                        handleOpenFormationsTacticsDetails(row.teamId)
                      }
                      formatValue={formatValue}
                      style={formationsTacticsTableStyle}
                      sortKey={formationsTacticsSortState.key}
                      sortDirection={formationsTacticsSortState.direction}
                      onSort={handleFormationsTacticsSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "likely-training") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleLikelyTrainingPanelTitle}
                  refreshing={refreshingGlobal || refreshingFormationsTactics}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshLikelyTrainingTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshFormationsTacticsOnly()}
                  onPointerDown={handlePanelPointerDown}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingFormationsTactics) &&
                    likelyTrainingRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={likelyTrainingTableColumns}
                      rows={sortedLikelyTrainingRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenLikelyTrainingDetails(row.teamId)}
                      formatValue={formatValue}
                      style={likelyTrainingTableStyle}
                      sortKey={likelyTrainingSortState.key}
                      sortDirection={likelyTrainingSortState.direction}
                      onSort={handleLikelyTrainingSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) =>
                        handleNoDivulgoDismiss(row.teamId)
                      }
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "tsi") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleTsiPanelTitle}
                  refreshing={refreshingGlobal || refreshingTsi}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshTsiTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshTsiOnly()}
                  onPointerDown={handlePanelPointerDown}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingTsi) &&
                    tsiRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={tsiTableColumns}
                      rows={sortedTsiRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenTsiDetails(row.teamId)}
                      formatValue={formatValue}
                      style={tsiTableStyle}
                      sortKey={tsiSortState.key}
                      sortDirection={tsiSortState.direction}
                      onSort={handleTsiSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) => handleNoDivulgoDismiss((row as { teamId: number }).teamId)}
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          if (panelId === "wages") {
            return (
              <div
                key={panelId}
                className={`${styles.chroniclePanelDragWrap}${dropTargetPanelId === panelId ? ` ${styles.chroniclePanelDragOver}` : ""}`}
                onDragOver={(event) => handlePanelDragOver(event, panelId)}
                onDragEnter={(event) => handlePanelDragEnter(event, panelId)}
                onDragLeave={(event) => handlePanelDragLeave(event, panelId)}
                onDrop={(event) => handlePanelDrop(event, panelId)}
                onPointerEnter={() => handlePanelPointerEnter(panelId)}
                onPointerUp={() => handlePanelPointerUp(panelId)}
                onDragEnd={handlePanelDragEnd}
              >
                <ChroniclePanel
                  title={messages.clubChronicleWagesPanelTitle}
                  refreshing={refreshingGlobal || refreshingWages}
                  progressPct={getPanelRefreshProgress(panelId)}
                  refreshLabel={messages.clubChronicleRefreshWagesTooltip}
                  panelId={panelId}
                  onRefresh={() => void refreshWagesOnly()}
                  onPointerDown={handlePanelPointerDown}
                  onDragStart={handlePanelDragStart}
                  onDragEnd={handlePanelDragEnd}
                >
                  {trackedTeams.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleNoTeams}
                    </p>
                  ) : (refreshingGlobal || refreshingWages) &&
                    wagesRows.every((row) => !row.snapshot) ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : (
                    <ChronicleTable
                      columns={wagesTableColumns}
                      rows={sortedWagesRows}
                      getRowKey={(row) => row.teamId}
                      getSnapshot={(row) => row.snapshot ?? undefined}
                      getRowClassName={getTeamRowClassName}
                      onRowClick={(row) => handleOpenWagesDetails(row.teamId)}
                      formatValue={formatValue}
                      style={wagesTableStyle}
                      sortKey={wagesSortState.key}
                      sortDirection={wagesSortState.direction}
                      onSort={handleWagesSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) => handleNoDivulgoDismiss((row as { teamId: number }).teamId)}
                    />
                  )}
                </ChroniclePanel>
              </div>
            );
          }
          return null;
        })}
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
            <>
              <div className={styles.chronicleUpdatesMetaBlock}>
                <p className={styles.chroniclePressMeta}>
                  {messages.clubChronicleUpdatesSinceGlobal}
                </p>
                {lastGlobalComparedAt ? (
                  <p className={styles.chroniclePressMeta}>
                    {messages.clubChronicleUpdatesComparedAt}:{" "}
                    {formatDateTime(lastGlobalComparedAt)}
                  </p>
                ) : null}
                {!lastGlobalHadChanges ? (
                  <p className={styles.chroniclePressMeta}>
                    {messages.clubChronicleUpdatesNoChangesGlobal}
                  </p>
                ) : null}
                {showingPreviousSnapshot && latestHistoryWithChanges ? (
                  <p className={styles.chroniclePressMeta}>
                    {messages.clubChronicleUpdatesShowingFrom}:{" "}
                    {formatDateTime(latestHistoryWithChanges.comparedAt)}
                  </p>
                ) : null}
              </div>

              {globalUpdatesHistory.length > 0 ? (
                <div className={styles.chronicleUpdatesHistoryWrap}>
                  <div className={styles.chronicleUpdatesHistoryHeader}>
                    {messages.clubChronicleUpdatesHistoryTitle}
                  </div>
                  <div className={styles.chronicleUpdatesHistoryList}>
                    {globalUpdatesHistory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`${styles.chronicleUpdatesHistoryItem}${selectedHistoryComparedAt === entry.comparedAt ? ` ${styles.chronicleUpdatesHistoryItemActive}` : ""}`}
                        onClick={() => handleLoadHistoryEntry(entry)}
                        disabled={!entry.updates}
                        aria-pressed={selectedHistoryComparedAt === entry.comparedAt}
                      >
                        <span>{formatDateTime(entry.comparedAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasAnyTeamUpdates ? (
                <div className={styles.chronicleUpdatesList}>
                  {trackedTeams.map((team) => {
                    const teamUpdates = updatesByTeam[team.teamId];
                    const changes = (teamUpdates?.changes ?? []).filter(
                      (change) => change.fieldKey !== "likelyTraining.confidence"
                    );
                    if (changes.length === 0) return null;
                    const teamLeagueLevelUnitId =
                      chronicleCache.teams[team.teamId]?.leagueLevelUnitId ?? null;
                    const isPrimaryTeam =
                      primaryChronicleTeamId !== null &&
                      team.teamId === primaryChronicleTeamId;
                    return (
                      <div
                        key={team.teamId}
                        className={`${styles.chronicleUpdatesTeam}${isPrimaryTeam ? ` ${styles.chronicleUpdatesTeamPrimary}` : ""}`}
                      >
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
                              {getUpdateFieldLabel(change.fieldKey, change.label)}
                            </span>
                            <span>
                              {renderUpdateValue(
                                change.fieldKey,
                                change.previous,
                                team.teamId,
                                teamLeagueLevelUnitId
                              )}
                            </span>
                            <span>
                              {renderUpdateValue(
                                change.fieldKey,
                                change.current,
                                team.teamId,
                                teamLeagueLevelUnitId
                              )}
                            </span>
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
              )}
            </>
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
                {messages.clubChronicleColumnTeam}:{" "}
                {renderTeamNameLink(selectedPressTeam.teamId, selectedPressTeam.teamName)}
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
        open={fanclubDetailsOpen}
        title={messages.clubChronicleFanclubDetailsTitle}
        className={styles.chronicleFanclubDetailsModal}
        body={
          fanclubDetailsSnapshot ? (
            <div className={styles.chronicleDetailsGrid}>
              <h3 className={styles.chronicleDetailsSectionTitle}>
                {renderTeamNameLink(
                  selectedFanclubTeam?.teamId,
                  selectedFanclubTeam?.teamName ?? null
                )}
              </h3>
              <ChronicleTable
                columns={fanclubDetailsColumns}
                rows={[
                  {
                    id: `${selectedFanclubTeam?.teamId ?? "fanclub"}-fanclub-details`,
                  },
                ]}
                getRowKey={(row) => row.id}
                getSnapshot={() => fanclubDetailsSnapshot}
                className={styles.chronicleFanclubDetailsTable}
                formatValue={formatValue}
                style={fanclubDetailsTableStyle}
              />
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setFanclubDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setFanclubDetailsOpen(false)}
      />

      <Modal
        open={lastLoginDetailsOpen}
        title={messages.clubChronicleLastLoginDetailsTitle}
        className={styles.chronicleLastLoginModal}
        body={
          selectedLastLoginTeam ? (
            <div className={styles.chroniclePressContent}>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}:{" "}
                {renderTeamNameLink(
                  selectedLastLoginTeam.teamId,
                  selectedLastLoginTeam.teamName
                )}
              </p>
              {lastLoginDetailRows.length ? (
                <ChronicleTable
                  columns={lastLoginDetailsColumns}
                  rows={lastLoginDetailRows}
                  getRowKey={(row) => row.id}
                  getSnapshot={(row) => row}
                  className={styles.chronicleLastLoginDetailsTable}
                  formatValue={formatValue}
                  style={lastLoginDetailsTableStyle}
                />
              ) : (
                <p className={styles.chronicleEmpty}>
                  {messages.clubChronicleLastLoginNoData}
                </p>
              )}
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>
              {messages.clubChronicleLastLoginNoData}
            </p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setLastLoginDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setLastLoginDetailsOpen(false)}
      />

      <Modal
        open={coachDetailsOpen}
        title={messages.clubChronicleCoachDetailsTitle}
        className={styles.chronicleCoachModal}
        body={
          selectedCoachTeam ? (
            <div className={styles.chroniclePressContent}>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}:{" "}
                {renderTeamNameLink(selectedCoachTeam.teamId, selectedCoachTeam.teamName)}
              </p>
              {coachDetailsRows.length > 0 ? (
                <div className={styles.chronicleTransferHistoryTableWrap}>
                  <ChronicleTable
                    columns={coachDetailsColumns}
                    rows={coachDetailsRows}
                    getRowKey={(row) => row.id}
                    getSnapshot={(row) => row}
                    formatValue={formatValue}
                    style={coachDetailsTableStyle}
                  />
                </div>
              ) : (
                <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
              )}
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setCoachDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setCoachDetailsOpen(false)}
      />

      <Modal
        open={financeDetailsOpen}
        title={messages.clubChronicleFinancePanelTitle}
        body={
          selectedFinanceTeam?.snapshot ? (
            <div className={styles.chronicleDetailsGrid}>
              <h3 className={styles.chronicleDetailsSectionTitle}>
                {renderTeamNameLink(selectedFinanceTeam.teamId, selectedFinanceTeam.teamName)}
              </h3>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleFinanceColumnBuys}
                </span>
                <span />
                <span>
                  {formatChppCurrencyFromSek(selectedFinanceTeam.snapshot.totalBuysSek)}
                </span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleFinanceColumnSales}
                </span>
                <span />
                <span>
                  {formatChppCurrencyFromSek(selectedFinanceTeam.snapshot.totalSalesSek)}
                </span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleFinanceColumnEstimate}
                </span>
                <span />
                <span>{`${formatChppCurrencyFromSek(selectedFinanceTeam.snapshot.estimatedSek)}*`}</span>
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
        open={arenaDetailsOpen}
        title={messages.clubChronicleArenaDetailsTitle}
        body={
          selectedArenaTeam?.snapshot ? (
            <div className={styles.chronicleDetailsGrid}>
              <h3 className={styles.chronicleDetailsSectionTitle}>
                {renderTeamNameLink(selectedArenaTeam.teamId, selectedArenaTeam.teamName)}
              </h3>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaDetailsMetric}
                </span>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleDetailsCurrentLabel}
                </span>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaDetailsExpandedColumn}
                </span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaSeatTerraces}
                </span>
                <span>{formatValue(selectedArenaTeam.snapshot.terraces)}</span>
                <span>{formatValue(selectedArenaTeam.snapshot.expandedTerraces)}</span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaSeatBasic}
                </span>
                <span>{formatValue(selectedArenaTeam.snapshot.basic)}</span>
                <span>{formatValue(selectedArenaTeam.snapshot.expandedBasic)}</span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaSeatRoof}
                </span>
                <span>{formatValue(selectedArenaTeam.snapshot.roof)}</span>
                <span>{formatValue(selectedArenaTeam.snapshot.expandedRoof)}</span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaSeatVip}
                </span>
                <span>{formatValue(selectedArenaTeam.snapshot.vip)}</span>
                <span>{formatValue(selectedArenaTeam.snapshot.expandedVip)}</span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaDetailsCurrentCapacity}
                </span>
                <span>{formatValue(selectedArenaTeam.snapshot.currentTotalCapacity)}</span>
                <span>{formatValue(selectedArenaTeam.snapshot.expandedTotalCapacity)}</span>
              </div>
              <div className={styles.chronicleDetailsRow}>
                <span className={styles.chronicleDetailsLabel}>
                  {messages.clubChronicleArenaDetailsExpectedFinish}
                </span>
                <span>{messages.unknownShort}</span>
                <span>
                  {formatValue(
                    selectedArenaTeam.snapshot.expansionDate
                      ? formatChppDateTime(selectedArenaTeam.snapshot.expansionDate) ??
                          selectedArenaTeam.snapshot.expansionDate
                      : null
                  )}
                </span>
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
            onClick={() => setArenaDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setArenaDetailsOpen(false)}
      />

      <Modal
        open={transferListedDetailsOpen}
        title={messages.clubChronicleTransferListedModalTitle}
        className={styles.chronicleTransferListedModal}
        body={
          selectedTransferTeam ? (
            <>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}:{" "}
                {renderTeamNameLink(selectedTransferTeam.teamId, selectedTransferTeam.teamName)}
              </p>
              {transferListedRows.length > 0 ? (
                <>
                  {loadingTransferListedModal ? (
                    <p className={styles.chroniclePressMeta}>
                      {messages.clubChronicleLoading}
                    </p>
                  ) : null}
                  <div className={styles.chronicleTransferListedTableWrap}>
                    <ChronicleTable
                      columns={transferListedColumns}
                      rows={transferListedRows}
                      getRowKey={(row) => row.playerId}
                      getSnapshot={(row) => row}
                      formatValue={formatValue}
                      style={
                        {
                          "--cc-columns": transferListedColumns.length,
                          "--cc-template":
                            "minmax(150px, 1.6fr) minmax(100px, 0.8fr) minmax(86px, 0.7fr) minmax(120px, 0.9fr)",
                        } as CSSProperties
                      }
                    />
                  </div>
                </>
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
                {messages.clubChronicleColumnTeam}:{" "}
                {renderTeamNameLink(selectedTransferTeam.teamId, selectedTransferTeam.teamName)}
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
                          "minmax(138px, 1fr) minmax(84px, 0.7fr) minmax(220px, 1.7fr) minmax(96px, 0.8fr) minmax(96px, 0.8fr) minmax(122px, 0.9fr)",
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
        open={formationsTacticsDetailsOpen}
        title={messages.clubChronicleFormationsDetailsTitle}
        className={styles.chronicleTransferHistoryModal}
        body={
          selectedFormationsTacticsTeam?.snapshot ? (
            <>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}:{" "}
                <span className={styles.chronicleDistributionTeamName}>
                  {renderTeamNameLink(
                    selectedFormationsTacticsTeam.teamId,
                    selectedFormationsTacticsTeam.teamName
                  )}
                </span>
              </p>
              <p className={styles.chroniclePressMeta}>
                <button
                  type="button"
                  className={styles.chronicleInlineLinkButton}
                  onClick={() => setFormationsTacticsMatchesOpen(true)}
                >
                  {messages.clubChronicleFormationsSampleLabel}:{" "}
                  {formatValue(selectedFormationsTacticsTeam.snapshot.sampleSize)}
                </button>
              </p>
              <div className={styles.chronicleDistributionGrid}>
                <div className={styles.chronicleDistributionCard}>
                  <h3 className={styles.chronicleDetailsSectionTitle}>
                    {messages.clubChronicleFormationsColumnFormation}
                  </h3>
                  <div className={styles.chroniclePieChartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 24, right: 64, left: 64, bottom: 24 }}>
                        <Pie
                          data={formationChartData}
                          dataKey="count"
                          nameKey="label"
                          outerRadius={90}
                          label={renderPieLabel}
                          labelLine
                        >
                          {formationChartData.map((entry, index) => (
                            <Cell
                              key={`formation-cell-${entry.key}`}
                              fill={colorForSlice(index)}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {selectedFormationsTacticsTeam.snapshot.formationDistribution.length >
                  0 ? null : (
                    <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
                  )}
                </div>
                <div className={styles.chronicleDistributionCard}>
                  <h3 className={styles.chronicleDetailsSectionTitle}>
                    {messages.clubChronicleFormationsColumnTactic}
                  </h3>
                  <div className={styles.chroniclePieChartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 24, right: 64, left: 64, bottom: 24 }}>
                        <Pie
                          data={tacticChartData}
                          dataKey="count"
                          nameKey="label"
                          outerRadius={90}
                          label={renderPieLabel}
                          labelLine
                        >
                          {tacticChartData.map((entry, index) => (
                            <Cell
                              key={`tactic-cell-${entry.key}`}
                              fill={colorForSlice(index)}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {selectedFormationsTacticsTeam.snapshot.tacticDistribution.length >
                  0 ? null : (
                    <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => {
              setFormationsTacticsDetailsOpen(false);
              setFormationsTacticsMatchesOpen(false);
            }}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => {
          setFormationsTacticsDetailsOpen(false);
          setFormationsTacticsMatchesOpen(false);
        }}
      />

      <Modal
        open={formationsTacticsMatchesOpen}
        title={messages.clubChronicleFormationsMatchesListTitle}
        className={styles.chronicleTransferHistoryModal}
        body={
          selectedFormationsTacticsTeam?.snapshot?.analyzedMatches?.length ? (
            <ul className={styles.chronicleMatchList}>
              {selectedFormationsTacticsTeam.snapshot.analyzedMatches.map((match) => (
                <li
                  key={`${match.matchId}-${match.matchType ?? "na"}`}
                  className={styles.chronicleMatchListItem}
                >
                  <a
                    className={styles.chroniclePressLink}
                    href={hattrickMatchUrl(match.matchId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {match.matchId}
                  </a>
                  <span className={styles.chroniclePressMeta}>
                    {formatMatchTypeLabel(match.matchType)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.chronicleEmpty}>
              {messages.clubChronicleFormationsMatchesListEmpty}
            </p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setFormationsTacticsMatchesOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setFormationsTacticsMatchesOpen(false)}
      />

      <Modal
        open={likelyTrainingDetailsOpen}
        title={messages.clubChronicleLikelyTrainingDetailsTitle}
        body={
          selectedLikelyTrainingTeam?.snapshot ? (
            <>
              <div className={styles.chronicleLikelyTrainingMeta}>
                <p className={styles.chroniclePressMeta}>
                  {messages.clubChronicleColumnTeam}:{" "}
                  {renderTeamNameLink(
                    selectedLikelyTrainingTeam.teamId,
                    selectedLikelyTrainingTeam.teamName
                  )}
                </p>
                <p className={styles.chroniclePressMeta}>
                  {messages.clubChronicleLikelyTrainingColumnRegimen}:{" "}
                  {formatLikelyTrainingSummary(selectedLikelyTrainingTeam.snapshot)}
                </p>
                {selectedLikelyTrainingTeam.snapshot.likelyTrainingIsUnclear ? (
                  <p className={styles.chroniclePressMeta}>
                    {messages.clubChronicleLikelyTrainingUnclearDisclaimer}
                  </p>
                ) : null}
                <p className={styles.chroniclePressMeta}>
                  {messages.clubChronicleLikelyTrainingConfidenceLabel}:{" "}
                  {selectedLikelyTrainingTeam.snapshot.likelyTrainingConfidencePct !== null
                    ? `${formatValue(
                        selectedLikelyTrainingTeam.snapshot.likelyTrainingConfidencePct
                      )}%`
                    : messages.unknownShort}
                </p>
                <p className={styles.chroniclePressMeta}>
                  {messages.clubChronicleLikelyTrainingMatchesLabel}:{" "}
                  {formatValue(selectedLikelyTrainingTeam.snapshot.sampleSize)}
                </p>
              </div>
              {likelyTrainingDetailRows.length > 0 ? (
                <div className={styles.chronicleTransferHistoryTableWrap}>
                  <ChronicleTable
                    columns={likelyTrainingDetailsColumns}
                    rows={likelyTrainingDetailRows}
                    getRowKey={(row) => row.key}
                    getSnapshot={(row) => row}
                    formatValue={formatValue}
                    style={likelyTrainingDetailsTableStyle}
                    sortKey="confidence"
                    sortDirection="desc"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.clubChronicleNoTeams}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setLikelyTrainingDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setLikelyTrainingDetailsOpen(false)}
      />

      <Modal
        open={tsiDetailsOpen}
        title={messages.clubChronicleTsiDetailsTitle}
        className={styles.chronicleTransferHistoryModal}
        body={
          selectedTsiTeam ? (
            <>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}:{" "}
                {renderTeamNameLink(selectedTsiTeam.teamId, selectedTsiTeam.teamName)}
              </p>
              {tsiPlayerRows.length > 0 ? (
                <div className={styles.chronicleTransferHistoryTableWrap}>
                  <ChronicleTable
                    columns={tsiPlayerColumns}
                    rows={sortedTsiPlayerRows}
                    getRowKey={(row) => row.playerId}
                    getSnapshot={(row) => row}
                    formatValue={formatValue}
                    style={
                      {
                        "--cc-columns": tsiPlayerColumns.length,
                        "--cc-template":
                          "minmax(90px, 0.5fr) minmax(240px, 1.5fr) minmax(120px, 0.9fr) minmax(130px, 0.8fr)",
                      } as CSSProperties
                    }
                    sortKey={tsiDetailsSortState.key}
                    sortDirection={tsiDetailsSortState.direction}
                    onSort={handleTsiDetailsSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) => handleNoDivulgoDismiss((row as { teamId: number }).teamId)}
                  />
                </div>
              ) : (
                <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
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
            onClick={() => setTsiDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setTsiDetailsOpen(false)}
      />

      <Modal
        open={wagesDetailsOpen}
        title={messages.clubChronicleWagesDetailsTitle}
        className={styles.chronicleTransferHistoryModal}
        body={
          selectedWagesTeam ? (
            <>
              <p className={styles.chroniclePressMeta}>
                {messages.clubChronicleColumnTeam}:{" "}
                {renderTeamNameLink(selectedWagesTeam.teamId, selectedWagesTeam.teamName)}
              </p>
              {wagesPlayerRows.length > 0 ? (
                <div className={styles.chronicleTransferHistoryTableWrap}>
                  <ChronicleTable
                    columns={wagesPlayerColumns}
                    rows={sortedWagesPlayerRows}
                    getRowKey={(row) => row.playerId}
                    getSnapshot={(row) => row}
                    formatValue={formatValue}
                    style={
                      {
                        "--cc-columns": wagesPlayerColumns.length,
                        "--cc-template":
                          "minmax(90px, 0.5fr) minmax(240px, 1.5fr) minmax(120px, 0.9fr) minmax(150px, 0.8fr)",
                      } as CSSProperties
                    }
                    sortKey={wagesDetailsSortState.key}
                    sortDirection={wagesDetailsSortState.direction}
                    onSort={handleWagesDetailsSort}
                      maskedTeamId={NO_DIVULGO_TARGET_TEAM_ID}
                      maskText={messages.clubChronicleNoDivulgoMask}
                      isMaskActive={noDivulgoActive}
                      onMaskedRowClick={(row) => handleNoDivulgoDismiss((row as { teamId: number }).teamId)}
                  />
                </div>
              ) : (
                <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
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
            onClick={() => setWagesDetailsOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setWagesDetailsOpen(false)}
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
