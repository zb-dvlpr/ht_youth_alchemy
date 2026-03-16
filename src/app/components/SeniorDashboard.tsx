"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import {
  CSSProperties,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import {
  fetchChppJson,
  ChppAuthRequiredError,
  reconnectChppWithTokenReset,
} from "@/lib/chpp/client";
import { mapWithConcurrency } from "@/lib/async";
import { useNotifications } from "./notifications/NotificationsProvider";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { formatDateTime } from "@/lib/datetime";
import { parseChppDate } from "@/lib/chpp/utils";
import {
  hattrickForumThreadUrl,
  hattrickManagerUrl,
  hattrickMatchUrl,
  hattrickMatchUrlWithSourceSystem,
  hattrickPlayerUrl,
  hattrickTeamUrl,
} from "@/lib/hattrick/urls";
import {
  readSeniorDebugManagerUserId,
  SENIOR_DEBUG_MANAGER_USER_ID_EVENT,
  SENIOR_DEBUG_MANAGER_USER_ID_STORAGE_KEY,
  readSeniorStalenessDays,
  SENIOR_RATINGS_WIPE_EVENT,
  SENIOR_SETTINGS_EVENT,
  SENIOR_SETTINGS_STORAGE_KEY,
} from "@/lib/settings";
import Modal from "./Modal";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import PlayerDetailsPanel, { type PlayerDetailsPanelTab } from "./PlayerDetailsPanel";
import LineupField, { LineupAssignments, LineupBehaviors } from "./LineupField";
import UpcomingMatches, { Match, MatchesResponse } from "./UpcomingMatches";
import type { SetBestLineupMode } from "./UpcomingMatches";
import Tooltip from "./Tooltip";
import { setDragGhost } from "@/lib/drag";
import { positionLabel } from "@/lib/positions";
import {
  getMissingChppPermissions,
  parseExtendedPermissionsFromCheckToken,
  REQUIRED_CHPP_EXTENDED_PERMISSIONS,
} from "@/lib/chpp/permissions";
import { readGlobalSeason } from "@/lib/season";

type SeniorPlayer = {
  PlayerID: number;
  FirstName: string;
  NickName?: string;
  LastName: string;
  Age?: number;
  AgeDays?: number;
  ArrivalDate?: string;
  Specialty?: number;
  TSI?: number;
  Salary?: number;
  Form?: number;
  StaminaSkill?: number;
  InjuryLevel?: number;
  Cards?: number;
  PlayerSkills?: Record<string, SkillValue>;
};

type SeniorPlayerDetails = {
  PlayerID?: number;
  FirstName?: string;
  NickName?: string;
  LastName?: string;
  Age?: number;
  AgeDays?: number;
  ArrivalDate?: string;
  NativeCountryName?: string;
  Specialty?: number;
  Form?: number;
  StaminaSkill?: number;
  InjuryLevel?: number;
  Cards?: number;
  TSI?: number;
  Salary?: number;
  PersonalityStatement?: string;
  Experience?: number;
  Leadership?: number;
  Loyalty?: number;
  MotherClubBonus?: boolean;
  CareerGoals?: number;
  CareerHattricks?: number;
  LeagueGoals?: number;
  CupGoals?: number;
  FriendliesGoals?: number;
  GoalsCurrentTeam?: number;
  AssistsCurrentTeam?: number;
  CareerAssists?: number;
  MatchesCurrentTeam?: number;
  PlayerSkills?: Record<string, SkillValue>;
  LastMatch?: {
    Date?: string;
    PositionCode?: number;
    Rating?: number;
  };
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

type PlayerDetailCacheEntry = {
  data: SeniorPlayerDetails;
  fetchedAt: number;
};

type SeniorUpdatesGroupedEntry = {
  id: string;
  comparedAt: number;
  hasChanges: boolean;
  groupedByPlayerId: Record<
    number,
    {
      playerId: number;
      playerName: string;
      isNewPlayer: boolean;
      ratings: Array<{ position: number; previous: number | null; current: number | null }>;
      skills: Array<{ skillKey: string; previous: number | null; current: number | null }>;
      attributes: Array<{
        key:
          | "injury"
          | "cards"
          | "form"
          | "stamina"
          | "tsi"
          | "salary"
          | "specialty"
          | "experience"
          | "leadership"
          | "loyalty"
          | "motherClubBonus";
        previous: number | string | boolean | null;
        current: number | string | boolean | null;
      }>;
    }
  >;
};

type SeniorMatrixNewMarkers = {
  detectedAt: number | null;
  playerIds: number[];
  ratingsByPlayerId: Record<number, number[]>;
  skillsCurrentByPlayerId: Record<number, string[]>;
  skillsMaxByPlayerId: Record<number, string[]>;
};

type PersistedSeniorMarkersBaseline = {
  players: SeniorPlayer[];
  ratingsByPlayerId: Record<number, Record<string, number>>;
};

type SeniorDashboardProps = {
  messages: Messages;
  initialSeniorTeams?: Array<{
    teamId: number;
    teamName: string;
    teamGender: "male" | "female" | null;
  }>;
  initialSeniorTeamId?: number | null;
};

type SeniorTeamOption = {
  teamId: number;
  teamName: string;
  teamGender: "male" | "female" | null;
};

type ExtraTimeBTeamRecentMatchState = {
  status: "idle" | "loading" | "ready" | "error";
  recentMatch: {
    matchId: number;
    sourceSystem: string;
    matchDate: string;
  } | null;
  playerMinutesById: Record<number, number>;
};

type ManagerCompendiumTeam = {
  TeamId?: unknown;
  TeamName?: unknown;
  GenderID?: unknown;
  League?: {
    Season?: unknown;
  };
};

type ManagerCompendiumResponse = {
  season?: number | null;
  data?: {
    HattrickData?: {
      Manager?: {
        Teams?: {
          Team?: ManagerCompendiumTeam | ManagerCompendiumTeam[];
        };
      };
    };
  };
  error?: string;
  details?: string;
};

type SortKey =
  | "name"
  | "age"
  | "arrival"
  | "tsi"
  | "wage"
  | "form"
  | "stamina"
  | "experience"
  | "loyalty"
  | "injuries"
  | "cards"
  | "keeper"
  | "defender"
  | "playmaker"
  | "winger"
  | "passing"
  | "scorer"
  | "setpieces";

type SortDirection = "asc" | "desc";
type SeniorSortSelectKey = SortKey | "custom";

const SENIOR_REFRESH_REQUEST_EVENT = "ya:senior-refresh-request";
const SENIOR_REFRESH_STOP_EVENT = "ya:senior-refresh-stop";
const SENIOR_REFRESH_STATE_EVENT = "ya:senior-refresh-state";
const SENIOR_LATEST_UPDATES_OPEN_EVENT = "ya:senior-latest-updates-open";
const SENIOR_HELP_ANCHOR_UPDATES = "[data-help-anchor='senior-latest-updates']";
const SENIOR_HELP_ANCHOR_SET_LINEUP_AI = "[data-help-anchor='senior-set-lineup-ai']";
const SENIOR_HELP_ANCHOR_TRAINING_REGIMEN = `.${styles.lineupTrainingTypeControl}`;
const SENIOR_HELP_ANCHOR_ANALYZE_OPPONENT = `.${styles.matchAnalyzeOpponentWrap}`;

const STATE_STORAGE_KEY = "ya_senior_dashboard_state_v1";
const DATA_STORAGE_KEY = "ya_senior_dashboard_data_v1";
const LAST_REFRESH_STORAGE_KEY = "ya_senior_last_refresh_ts_v1";
const LIST_SORT_STORAGE_KEY = "ya_senior_player_list_sort_v1";
const SENIOR_HELP_STORAGE_KEY = "ya_senior_help_dismissed_v1";
const SENIOR_UPDATES_SCHEMA_VERSION = 3;
const DETAILS_TTL_MS = 60 * 60 * 1000;
const SENIOR_DETAILS_CONCURRENCY = 6;
const CHPP_SEK_PER_EUR = 10;
const I18N_TEMPLATE_TOKEN_PATTERN = /(\{\{[a-zA-Z0-9]+\}\})/g;
const SKILL_KEYS = [
  "KeeperSkill",
  "DefenderSkill",
  "PlaymakerSkill",
  "WingerSkill",
  "PassingSkill",
  "ScorerSkill",
  "SetPiecesSkill",
] as const;
const SENIOR_SKILL_EFFECT_CAP = 20;
const UPDATES_HISTORY_LIMIT = 20;
const FRIENDLY_MATCH_TYPES = new Set<number>([4, 5, 8, 9]);
const LEAGUE_CUP_QUALI_MATCH_TYPES = new Set<number>([1, 2, 3, 6]);
const TOURNAMENT_MATCH_TYPES = new Set<number>([50, 51]);
const OPPONENT_ARCHIVE_LIMIT = 20;
const OPPONENT_DETAILS_CONCURRENCY = 6;
const FORMATION_PREDICT_CONCURRENCY = 4;
const SENIOR_RATINGS_ALGO_VERSION = 4;
const NON_DEPRECATED_TRAINING_TYPES = [9, 3, 8, 5, 7, 4, 2, 11, 12, 10, 6] as const;
const EXTRA_TIME_B_TEAM_MATCH_TYPES = new Set<number>([1, 2, 4, 5, 8, 9]);
const EXTRA_TIME_B_TEAM_LOOKBACK_MS = 6 * 24 * 60 * 60 * 1000;
const EXTRA_TIME_B_TEAM_DEFAULT_THRESHOLD = 45;
const EXTRA_TIME_B_TEAM_MINIMUM_POOL_SIZE = 18;
const renderTemplateTokens = (
  template: string,
  replacements: Record<string, ReactNode>
): ReactNode[] =>
  template
    .split(I18N_TEMPLATE_TOKEN_PATTERN)
    .filter(Boolean)
    .map((part, index) => {
      const match = /^\{\{([a-zA-Z0-9]+)\}\}$/.exec(part);
      if (!match) {
        return <Fragment key={`text-${index}`}>{part}</Fragment>;
      }
      const replacement = replacements[match[1]];
      return <Fragment key={`token-${index}`}>{replacement ?? part}</Fragment>;
    });
const EXTRA_TIME_SORT_SKILL_BY_TRAINING_TYPE: Partial<
  Record<number, (typeof SKILL_KEYS)[number]>
> = {
  2: "SetPiecesSkill",
  3: "DefenderSkill",
  4: "ScorerSkill",
  5: "WingerSkill",
  6: "ScorerSkill",
  7: "PassingSkill",
  8: "PlaymakerSkill",
  9: "KeeperSkill",
  10: "PassingSkill",
  11: "DefenderSkill",
  12: "WingerSkill",
};
const FIELD_SLOT_ORDER = [
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
const BENCH_SLOT_ORDER = ["B_GK", "B_CD", "B_WB", "B_IM", "B_F", "B_W", "B_X"] as const;
const DEFENSE_SLOTS = ["WB_L", "CD_L", "CD_C", "CD_R", "WB_R"] as const;
const MIDFIELD_SLOTS = ["W_L", "IM_L", "IM_C", "IM_R", "W_R"] as const;
const ATTACK_SLOTS = ["F_L", "F_C", "F_R"] as const;
const DEFENSE_FORMATION_MAP: Record<number, string[]> = {
  2: ["CD_L", "CD_R"],
  3: ["CD_L", "CD_C", "CD_R"],
  4: ["WB_L", "CD_L", "CD_R", "WB_R"],
  5: [...DEFENSE_SLOTS],
};
const MIDFIELD_FORMATION_MAP: Record<number, string[]> = {
  2: ["IM_L", "IM_R"],
  3: ["IM_L", "IM_C", "IM_R"],
  4: ["W_L", "IM_L", "IM_R", "W_R"],
  5: [...MIDFIELD_SLOTS],
};
const ATTACK_FORMATION_MAP: Record<number, string[]> = {
  0: [],
  1: ["F_C"],
  2: ["F_L", "F_R"],
  3: [...ATTACK_SLOTS],
};
const SLOT_TO_RATING_CODE: Record<string, number> = {
  KP: 100,
  WB_L: 101,
  WB_R: 101,
  CD_L: 103,
  CD_C: 103,
  CD_R: 103,
  W_L: 106,
  W_R: 106,
  IM_L: 107,
  IM_C: 107,
  IM_R: 107,
  F_L: 111,
  F_C: 111,
  F_R: 111,
};

const sanitizeTrainingType = (value: number | null): number | null =>
  typeof value === "number" && NON_DEPRECATED_TRAINING_TYPES.includes(value as (typeof NON_DEPRECATED_TRAINING_TYPES)[number])
    ? value
    : null;
const resolveScopedStorageKey = (
  baseKey: string,
  teamId: number | null,
  multiTeamEnabled: boolean
) =>
  multiTeamEnabled && typeof teamId === "number" && teamId > 0
    ? `${baseKey}_${teamId}`
    : baseKey;
type PlayerSector = "keeper" | "defense" | "midfield" | "attack";
const SLOT_TO_SECTOR: Record<string, PlayerSector> = {
  KP: "keeper",
  WB_L: "defense",
  WB_R: "defense",
  CD_L: "defense",
  CD_C: "defense",
  CD_R: "defense",
  W_L: "midfield",
  W_R: "midfield",
  IM_L: "midfield",
  IM_C: "midfield",
  IM_R: "midfield",
  F_L: "attack",
  F_C: "attack",
  F_R: "attack",
};
const SECTOR_TO_RATING_CODES: Record<PlayerSector, number[]> = {
  keeper: [100],
  defense: [101, 103],
  midfield: [106, 107],
  attack: [111],
};

type PredictedRatings = {
  tacticType: number | null;
  tacticSkill: number | null;
  ratingMidfield: number | null;
  ratingRightDef: number | null;
  ratingMidDef: number | null;
  ratingLeftDef: number | null;
  ratingRightAtt: number | null;
  ratingMidAtt: number | null;
  ratingLeftAtt: number | null;
};

type GeneratedFormationRow = {
  formation: string;
  assignments: LineupAssignments;
  slotRatings: Record<string, number | null>;
  rejectedPlayerIds: number[];
  predicted: PredictedRatings | null;
  error: string | null;
};

type FixedFormationTacticRow = {
  tacticType: number;
  predicted: PredictedRatings | null;
  error: string | null;
};

type CollectiveRatings = {
  midfield: number;
  defense: number;
  attack: number;
  overall: number;
};

type OpponentFormationRow = {
  matchId: number;
  matchType: number | null;
  sourceSystem: string;
  formation: string | null;
  matchDate: string | null;
  againstMyTeam: boolean;
  tacticType: number | null;
  tacticSkill: number | null;
  ratingMidfield: number | null;
  ratingRightDef: number | null;
  ratingMidDef: number | null;
  ratingLeftDef: number | null;
  ratingRightAtt: number | null;
  ratingMidAtt: number | null;
  ratingLeftAtt: number | null;
};

const FIXED_FORMATION_OPTIONS = [
  "5-5-0",
  "5-4-1",
  "5-3-2",
  "5-2-3",
  "4-5-1",
  "4-4-2",
  "4-3-3",
  "3-5-2",
  "3-4-3",
  "2-5-3",
] as const;

const AI_TACTIC_OPTIONS = [0, 1, 2, 3, 4, 7, 8] as const;

type FormationTacticsDistribution = {
  key: string;
  label: string;
  count: number;
};

type OpponentFormationAverages = {
  sampleSize: number;
  ratingMidfield: number | null;
  ratingRightDef: number | null;
  ratingMidDef: number | null;
  ratingLeftDef: number | null;
  ratingRightAtt: number | null;
  ratingMidAtt: number | null;
  ratingLeftAtt: number | null;
};

type MatchOrderSubstitution = {
  playerin: number;
  playerout: number;
  orderType: number;
  min: number;
  pos: number;
  beh: number;
  card: number;
  standing: number;
};

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = record["#text"];
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeManagerCompendiumTeams = (
  input?: ManagerCompendiumTeam | ManagerCompendiumTeam[]
): ManagerCompendiumTeam[] => {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
};

const extractSeniorTeams = (
  payload: ManagerCompendiumResponse | null | undefined
): SeniorTeamOption[] =>
  normalizeManagerCompendiumTeams(payload?.data?.HattrickData?.Manager?.Teams?.Team).reduce<
    SeniorTeamOption[]
  >((teams, team) => {
    const teamId = parseNumber(team?.TeamId);
    if (!teamId || teamId <= 0) return teams;
    const teamName =
      typeof team?.TeamName === "string" ? team.TeamName : String(team?.TeamName ?? "");
    const genderId = parseNumber(team?.GenderID);
    teams.push({
      teamId,
      teamName,
      teamGender: genderId === 2 ? "female" : genderId === 1 ? "male" : null,
    });
    return teams;
  }, []);

const buildEmptySeniorMatrixNewMarkers = (): SeniorMatrixNewMarkers => ({
  detectedAt: null,
  playerIds: [],
  ratingsByPlayerId: {},
  skillsCurrentByPlayerId: {},
  skillsMaxByPlayerId: {},
});

const normalizeIdList = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<number>();
  value.forEach((entry) => {
    const numeric = Number(entry);
    if (Number.isFinite(numeric) && numeric > 0) {
      unique.add(numeric);
    }
  });
  return Array.from(unique);
};

const normalizeIdArrayRecord = <T extends number | string>(
  value: unknown
): Record<number, T[]> => {
  if (!value || typeof value !== "object") return {};
  const next: Record<number, T[]> = {};
  Object.entries(value as Record<string, unknown>).forEach(([id, entry]) => {
    const playerId = Number(id);
    if (!Number.isFinite(playerId) || playerId <= 0) return;
    if (!Array.isArray(entry)) return;
    const normalized = entry
      .map((item) => item as T)
      .filter(
        (item) =>
          (typeof item === "number" && Number.isFinite(item)) ||
          typeof item === "string"
      );
    if (normalized.length === 0) return;
    next[playerId] = Array.from(new Set(normalized));
  });
  return next;
};

const normalizeSeniorMatrixNewMarkers = (value: unknown): SeniorMatrixNewMarkers => {
  if (!value || typeof value !== "object") {
    return buildEmptySeniorMatrixNewMarkers();
  }
  const input = value as Partial<SeniorMatrixNewMarkers>;
  return {
    detectedAt:
      typeof input.detectedAt === "number" && Number.isFinite(input.detectedAt)
        ? input.detectedAt
        : null,
    playerIds: normalizeIdList(input.playerIds),
    ratingsByPlayerId: normalizeIdArrayRecord<number>(input.ratingsByPlayerId),
    skillsCurrentByPlayerId: normalizeIdArrayRecord<string>(
      input.skillsCurrentByPlayerId
    ),
    skillsMaxByPlayerId: normalizeIdArrayRecord<string>(input.skillsMaxByPlayerId),
  };
};

const normalizeSeniorUpdatesHistory = (value: unknown): SeniorUpdatesGroupedEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const node = entry as Partial<SeniorUpdatesGroupedEntry>;
      const groupedRaw =
        node.groupedByPlayerId && typeof node.groupedByPlayerId === "object"
          ? node.groupedByPlayerId
          : {};
      const groupedByPlayerId: SeniorUpdatesGroupedEntry["groupedByPlayerId"] = {};
      Object.entries(groupedRaw).forEach(([playerId, playerEntry]) => {
        if (!playerEntry || typeof playerEntry !== "object") return;
        const parsedPlayerId = Number(playerId);
        if (!Number.isFinite(parsedPlayerId) || parsedPlayerId <= 0) return;
        const row = playerEntry as SeniorUpdatesGroupedEntry["groupedByPlayerId"][number];
        groupedByPlayerId[parsedPlayerId] = {
          playerId: parsedPlayerId,
          playerName:
            typeof row.playerName === "string"
              ? row.playerName
              : String(parsedPlayerId),
          isNewPlayer: Boolean(row.isNewPlayer),
          ratings: Array.isArray(row.ratings) ? row.ratings : [],
          skills: Array.isArray(row.skills) ? row.skills : [],
          attributes: Array.isArray(row.attributes) ? row.attributes : [],
        };
      });
      return {
        id:
          typeof node.id === "string"
            ? node.id
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        comparedAt:
          typeof node.comparedAt === "number" && Number.isFinite(node.comparedAt)
            ? node.comparedAt
            : Date.now(),
        hasChanges: Boolean(node.hasChanges),
        groupedByPlayerId,
      } satisfies SeniorUpdatesGroupedEntry;
    })
    .filter((entry): entry is SeniorUpdatesGroupedEntry => Boolean(entry));
};

const buildSeniorMatrixMarkersFromUpdatesEntry = (
  entry: SeniorUpdatesGroupedEntry
): SeniorMatrixNewMarkers => {
  const next = buildEmptySeniorMatrixNewMarkers();
  next.detectedAt = entry.comparedAt;
  Object.values(entry.groupedByPlayerId).forEach((playerEntry) => {
    const playerId = Number(playerEntry.playerId);
    if (!Number.isFinite(playerId) || playerId <= 0) return;
    if (playerEntry.isNewPlayer) {
      next.playerIds.push(playerId);
    }
    if (playerEntry.ratings.length > 0) {
      next.ratingsByPlayerId[playerId] = Array.from(
        new Set(playerEntry.ratings.map((rating) => rating.position))
      );
    }
    if (playerEntry.skills.length > 0) {
      next.skillsCurrentByPlayerId[playerId] = Array.from(
        new Set(playerEntry.skills.map((skill) => skill.skillKey))
      );
    }
  });
  return next;
};

const buildRatingsByPlayerIdFromResponse = (
  ratings: RatingsMatrixResponse | null | undefined
): Record<number, Record<string, number>> => {
  const payload: Record<number, Record<string, number>> = {};
  (ratings?.players ?? []).forEach((row) => {
    payload[row.id] = { ...row.ratings };
  });
  return payload;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
};

const parseSkill = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = record["#text"];
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const computeSeniorSkillBonus = (
  baseSkill: number | null,
  details: SeniorPlayerDetails | null
) => {
  if (baseSkill === null) return null;
  if (baseSkill >= SENIOR_SKILL_EFFECT_CAP) return 0;
  const remaining = Math.max(0, SENIOR_SKILL_EFFECT_CAP - baseSkill);
  if (details?.MotherClubBonus) {
    return Math.min(1.5, remaining);
  }
  const loyaltyRaw = typeof details?.Loyalty === "number" ? details.Loyalty : 0;
  return Math.min(Math.max(0, loyaltyRaw) / 20, remaining);
};

const computeSeniorEffectiveSkill = (
  baseSkill: number | null,
  details: SeniorPlayerDetails | null
) => {
  if (baseSkill === null) return null;
  const bonus = computeSeniorSkillBonus(baseSkill, details);
  if (bonus === null) return null;
  return Math.min(SENIOR_SKILL_EFFECT_CAP, baseSkill + bonus);
};

// NEW/N detection must always be based on raw skill values from CHPP data only.
// Effective skill bonus layers (mother club / loyalty) are display-only and must
// never contribute to change detection.
const parseBaseSkillForNDetection = (value: unknown): number | null => parseSkill(value);

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

const toSubscript = (value: number) =>
  String(Math.max(0, Math.floor(value)))
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[digit] ?? digit)
    .join("");

const buildSeniorCardStatus = (cards: number | null, messages: Messages) => {
  if (typeof cards !== "number") return null;
  if (cards >= 3) {
    return { display: "🟥", label: messages.sortCards };
  }
  if (cards === 2) {
    return { display: "🟨🟨", label: messages.sortCards };
  }
  if (cards === 1) {
    return { display: "🟨", label: messages.sortCards };
  }
  return null;
};

const formatPlayerName = (player: {
  FirstName?: string;
  NickName?: string;
  LastName?: string;
}) => [player.FirstName, player.NickName ?? null, player.LastName].filter(Boolean).join(" ");

const normalizeSeniorPlayers = (input: unknown): SeniorPlayer[] => {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  return list
    .map((item) => {
      const node = (item ?? {}) as Record<string, unknown>;
      const playerId = parseNumber(node.PlayerID);
      if (!playerId || playerId <= 0) return null;
      const staminaFromSkills =
        node.PlayerSkills && typeof node.PlayerSkills === "object"
          ? parseSkill((node.PlayerSkills as Record<string, unknown>).StaminaSkill)
          : null;
      return {
        PlayerID: playerId,
        FirstName: String(node.FirstName ?? ""),
        NickName: node.NickName ? String(node.NickName) : undefined,
        LastName: String(node.LastName ?? ""),
        Age: parseNumber(node.Age) ?? undefined,
        AgeDays: parseNumber(node.AgeDays) ?? undefined,
        ArrivalDate:
          typeof node.ArrivalDate === "string" ? node.ArrivalDate : undefined,
        Specialty: parseNumber(node.Specialty) ?? undefined,
        TSI: parseNumber(node.TSI) ?? undefined,
        Salary: parseNumber(node.Salary) ?? undefined,
        Form: parseSkill(node.PlayerForm ?? node.Form) ?? undefined,
        StaminaSkill:
          parseSkill(node.StaminaSkill) ??
          parseNumber(node.StaminaSkill) ??
          staminaFromSkills ??
          undefined,
        InjuryLevel: parseNumber(node.InjuryLevel) ?? undefined,
        Cards:
          parseNumber(node.Cards) ??
          parseNumber(node.Bookings) ??
          parseNumber(node.YellowCard) ??
          undefined,
        PlayerSkills:
          node.PlayerSkills && typeof node.PlayerSkills === "object"
            ? (node.PlayerSkills as Record<string, SkillValue>)
            : undefined,
      } as SeniorPlayer;
    })
    .filter((player): player is SeniorPlayer => Boolean(player));
};

const normalizeSeniorPlayerDetails = (
  input: unknown,
  fallbackPlayerId?: number
): SeniorPlayerDetails | null => {
  if (!input || typeof input !== "object") return null;
  const node = input as Record<string, unknown>;
  const playerId = parseNumber(node.PlayerID) ?? fallbackPlayerId ?? null;
  if (!playerId || playerId <= 0) return null;
  const staminaFromSkills =
    node.PlayerSkills && typeof node.PlayerSkills === "object"
      ? parseSkill((node.PlayerSkills as Record<string, unknown>).StaminaSkill)
      : null;
  const trainerData =
    node.TrainerData && typeof node.TrainerData === "object"
      ? (node.TrainerData as Record<string, unknown>)
      : null;
  const agreeability = parseNumber(trainerData?.Agreeability ?? node.Agreeability);
  const aggressiveness = parseNumber(trainerData?.Aggressiveness ?? node.Aggressiveness);
  const honesty = parseNumber(trainerData?.Honesty ?? node.Honesty);
  const experience = parseNumber(trainerData?.Experience ?? node.Experience);
  const leadership = parseNumber(trainerData?.Leadership ?? node.Leadership);
  const loyalty = parseNumber(trainerData?.Loyalty ?? node.Loyalty);
  const motherClubBonus = parseBoolean(
    trainerData?.MotherClubBonus ?? node.MotherClubBonus
  );
  const agreeabilityText = (() => {
    switch (agreeability) {
      case 5:
        return "Beloved team member";
      case 4:
        return "Popular guy";
      case 3:
        return "Sympathetic guy";
      case 2:
        return "Pleasant guy";
      case 1:
        return "Controversial person";
      case 0:
        return "Nasty fellow";
      default:
        return null;
    }
  })();
  const aggressivenessText = (() => {
    switch (aggressiveness) {
      case 5:
        return "Unstable";
      case 4:
        return "Fiery";
      case 3:
        return "Temperamental";
      case 2:
        return "Balanced";
      case 1:
        return "Calm";
      case 0:
        return "Tranquil";
      default:
        return null;
    }
  })();
  const honestyText = (() => {
    switch (honesty) {
      case 5:
        return "Saintly";
      case 4:
        return "Righteous";
      case 3:
        return "Upright";
      case 2:
        return "Honest";
      case 1:
        return "Dishonest";
      case 0:
        return "Infamous";
      default:
        return null;
    }
  })();
  const personalityStatement =
    agreeabilityText && aggressivenessText && honestyText
      ? `${/^[AEIOU]/.test(agreeabilityText) ? "An" : "A"} ${agreeabilityText.toLowerCase()} (${agreeability}) who is ${aggressivenessText.toLowerCase()} (${aggressiveness}) and ${honestyText.toLowerCase()} (${honesty}).`
      : undefined;

  return {
    PlayerID: playerId,
    FirstName: node.FirstName ? String(node.FirstName) : undefined,
    NickName: node.NickName ? String(node.NickName) : undefined,
    LastName: node.LastName ? String(node.LastName) : undefined,
    Age: parseNumber(node.Age) ?? undefined,
    AgeDays: parseNumber(node.AgeDays) ?? undefined,
    ArrivalDate: typeof node.ArrivalDate === "string" ? node.ArrivalDate : undefined,
    NativeCountryName:
      typeof node.NativeCountryName === "string" ? node.NativeCountryName : undefined,
    Specialty: parseNumber(node.Specialty) ?? undefined,
    Form: parseSkill(node.PlayerForm ?? node.Form) ?? undefined,
    StaminaSkill:
      parseSkill(node.StaminaSkill) ?? parseNumber(node.StaminaSkill) ?? staminaFromSkills ?? undefined,
    InjuryLevel: parseNumber(node.InjuryLevel) ?? undefined,
    Cards: parseNumber(node.Cards) ?? undefined,
    TSI: parseNumber(node.TSI) ?? undefined,
    Salary: parseNumber(node.Salary) ?? undefined,
    PersonalityStatement: personalityStatement,
    Experience: experience ?? undefined,
    Leadership: leadership ?? undefined,
    Loyalty: loyalty ?? undefined,
    MotherClubBonus: motherClubBonus ?? undefined,
    CareerGoals: parseNumber(node.CareerGoals) ?? undefined,
    CareerHattricks: parseNumber(node.CareerHattricks) ?? undefined,
    LeagueGoals: parseNumber(node.LeagueGoals) ?? undefined,
    CupGoals: parseNumber(node.CupGoals) ?? undefined,
    FriendliesGoals: parseNumber(node.FriendliesGoals) ?? undefined,
    GoalsCurrentTeam: parseNumber(node.GoalsCurrentTeam) ?? undefined,
    AssistsCurrentTeam: parseNumber(node.AssistsCurrentTeam) ?? undefined,
    CareerAssists: parseNumber(node.CareerAssists) ?? undefined,
    MatchesCurrentTeam: parseNumber(node.MatchesCurrentTeam) ?? undefined,
    PlayerSkills:
      node.PlayerSkills && typeof node.PlayerSkills === "object"
        ? (node.PlayerSkills as Record<string, SkillValue>)
        : undefined,
    LastMatch:
      node.LastMatch && typeof node.LastMatch === "object"
        ? {
            Date:
              typeof (node.LastMatch as Record<string, unknown>).Date === "string"
                ? String((node.LastMatch as Record<string, unknown>).Date)
                : undefined,
            PositionCode:
              parseNumber((node.LastMatch as Record<string, unknown>).PositionCode) ??
              undefined,
            Rating:
              parseNumber((node.LastMatch as Record<string, unknown>).Rating) ?? undefined,
          }
        : undefined,
  };
};

const readStoredLastRefresh = (storageKey = LAST_REFRESH_STORAGE_KEY) => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(storageKey);
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const writeStoredLastRefresh = (
  value: number,
  storageKey = LAST_REFRESH_STORAGE_KEY
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, String(value));
};

const formatArchiveDateTimeParam = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const iso = new Date(timestamp).toISOString();
  if (!iso) return null;
  return iso.slice(0, 19).replace("T", " ");
};

const berlinWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "Europe/Berlin",
});

const isBerlinWeekend = (value: Date) => {
  const weekday = berlinWeekdayFormatter.format(value);
  return weekday === "Sat" || weekday === "Sun";
};

const hasCurrentSeniorRatingsAlgorithmVersion = (
  ratings: RatingsMatrixResponse | null | undefined
) =>
  typeof ratings?.ratingsAlgorithmVersion === "number" &&
  Number.isFinite(ratings.ratingsAlgorithmVersion) &&
  Math.floor(ratings.ratingsAlgorithmVersion) === SENIOR_RATINGS_ALGO_VERSION;

const isRatingsMatrixEmpty = (ratings: RatingsMatrixResponse | null | undefined) =>
  !ratings?.players?.some((row) => Object.keys(row.ratings ?? {}).length > 0);

const hasUsableSeniorRatingsMatrix = (
  ratings: RatingsMatrixResponse | null | undefined
) => hasCurrentSeniorRatingsAlgorithmVersion(ratings) && !isRatingsMatrixEmpty(ratings);

const stampSeniorRatingsAlgorithmVersion = (
  ratings: RatingsMatrixResponse
): RatingsMatrixResponse => ({
  ...ratings,
  ratingsAlgorithmVersion: SENIOR_RATINGS_ALGO_VERSION,
});

const mergeRatingsMatrices = (
  first: RatingsMatrixResponse,
  second: RatingsMatrixResponse
): RatingsMatrixResponse => {
  const mergedById = new Map<
    number,
    {
      id: number;
      name: string;
      ratings: Record<string, number>;
      ratingMatchIds: Record<string, number>;
      ratingMatchSourceSystems: Record<string, string>;
    }
  >();
  [first, second].forEach((source) => {
    source.players.forEach((row) => {
      if (!mergedById.has(row.id)) {
        mergedById.set(row.id, {
          id: row.id,
          name: row.name,
          ratings: {},
          ratingMatchIds: {},
          ratingMatchSourceSystems: {},
        });
      }
      const existing = mergedById.get(row.id);
      if (!existing) return;
      if (!existing.name && row.name) {
        existing.name = row.name;
      }
      Object.entries(row.ratings ?? {}).forEach(([position, rating]) => {
        if (typeof rating !== "number" || !Number.isFinite(rating)) return;
        existing.ratings[position] = rating;
      });
      Object.entries(row.ratingMatchIds ?? {}).forEach(([position, matchId]) => {
        if (typeof matchId !== "number" || !Number.isFinite(matchId)) return;
        existing.ratingMatchIds[position] = matchId;
      });
      Object.entries(row.ratingMatchSourceSystems ?? {}).forEach(
        ([position, sourceSystem]) => {
          if (typeof sourceSystem !== "string" || !sourceSystem) return;
          existing.ratingMatchSourceSystems[position] = sourceSystem;
        }
      );
    });
  });
  const resolvedLastAppliedMatchId =
    typeof second.lastAppliedMatchId === "number" && Number.isFinite(second.lastAppliedMatchId)
      ? second.lastAppliedMatchId
      : typeof first.lastAppliedMatchId === "number" && Number.isFinite(first.lastAppliedMatchId)
        ? first.lastAppliedMatchId
        : null;
  const resolvedLastAppliedMatchDateTime =
    typeof second.lastAppliedMatchDateTime === "number" &&
    Number.isFinite(second.lastAppliedMatchDateTime)
      ? second.lastAppliedMatchDateTime
      : typeof first.lastAppliedMatchDateTime === "number" &&
          Number.isFinite(first.lastAppliedMatchDateTime)
        ? first.lastAppliedMatchDateTime
        : null;
  const resolvedLastAppliedMatchSourceSystem =
    typeof second.lastAppliedMatchSourceSystem === "string" &&
    second.lastAppliedMatchSourceSystem
      ? second.lastAppliedMatchSourceSystem
      : typeof first.lastAppliedMatchSourceSystem === "string" &&
          first.lastAppliedMatchSourceSystem
        ? first.lastAppliedMatchSourceSystem
        : null;
  return {
    ratingsAlgorithmVersion: SENIOR_RATINGS_ALGO_VERSION,
    positions: Array.from(new Set([...(first.positions ?? []), ...(second.positions ?? [])])),
    players: Array.from(mergedById.values()).map((row) => ({
      ...row,
      ratingMatchIds: { ...row.ratingMatchIds },
      ratingMatchSourceSystems: { ...row.ratingMatchSourceSystems },
    })),
    matchesAnalyzed: (first.matchesAnalyzed ?? 0) + (second.matchesAnalyzed ?? 0),
    lastAppliedMatchId: resolvedLastAppliedMatchId,
    lastAppliedMatchDateTime: resolvedLastAppliedMatchDateTime,
    lastAppliedMatchSourceSystem: resolvedLastAppliedMatchSourceSystem,
  };
};

const applyRatingsDelta = (
  base: RatingsMatrixResponse,
  delta: RatingsMatrixResponse
): RatingsMatrixResponse => {
  const byId = new Map<
    number,
    {
      id: number;
      name: string;
      ratings: Record<string, number>;
      ratingMatchIds: Record<string, number>;
      ratingMatchSourceSystems: Record<string, string>;
    }
  >();
  (base.players ?? []).forEach((row) => {
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      ratings: { ...row.ratings },
      ratingMatchIds: { ...(row.ratingMatchIds ?? {}) },
      ratingMatchSourceSystems: { ...(row.ratingMatchSourceSystems ?? {}) },
    });
  });
  (delta.players ?? []).forEach((row) => {
    const existing = byId.get(row.id) ?? {
      id: row.id,
      name: row.name,
      ratings: {},
      ratingMatchIds: {},
      ratingMatchSourceSystems: {},
    };
    if (!existing.name && row.name) {
      existing.name = row.name;
    }
    Object.entries(row.ratings ?? {}).forEach(([position, rating]) => {
      if (typeof rating !== "number" || !Number.isFinite(rating)) return;
      existing.ratings[position] = rating;
    });
    Object.entries(row.ratingMatchIds ?? {}).forEach(([position, matchId]) => {
      if (typeof matchId !== "number" || !Number.isFinite(matchId)) return;
      existing.ratingMatchIds[position] = matchId;
    });
    Object.entries(row.ratingMatchSourceSystems ?? {}).forEach(
      ([position, sourceSystem]) => {
        if (typeof sourceSystem !== "string" || !sourceSystem) return;
        existing.ratingMatchSourceSystems[position] = sourceSystem;
      }
    );
    byId.set(row.id, existing);
  });
  return {
    ratingsAlgorithmVersion:
      typeof delta.ratingsAlgorithmVersion === "number" &&
      Number.isFinite(delta.ratingsAlgorithmVersion)
        ? Math.floor(delta.ratingsAlgorithmVersion)
        : typeof base.ratingsAlgorithmVersion === "number" &&
            Number.isFinite(base.ratingsAlgorithmVersion)
          ? Math.floor(base.ratingsAlgorithmVersion)
          : SENIOR_RATINGS_ALGO_VERSION,
    positions: Array.from(new Set([...(base.positions ?? []), ...(delta.positions ?? [])])),
    players: Array.from(byId.values()).map((row) => ({
      ...row,
      ratingMatchIds: { ...row.ratingMatchIds },
      ratingMatchSourceSystems: { ...row.ratingMatchSourceSystems },
    })),
    matchesAnalyzed: delta.matchesAnalyzed ?? 0,
    lastAppliedMatchId:
      typeof delta.lastAppliedMatchId === "number" && Number.isFinite(delta.lastAppliedMatchId)
        ? delta.lastAppliedMatchId
        : base.lastAppliedMatchId ?? null,
    lastAppliedMatchDateTime:
      typeof delta.lastAppliedMatchDateTime === "number" &&
      Number.isFinite(delta.lastAppliedMatchDateTime)
        ? delta.lastAppliedMatchDateTime
        : base.lastAppliedMatchDateTime ?? null,
    lastAppliedMatchSourceSystem:
      typeof delta.lastAppliedMatchSourceSystem === "string" &&
      delta.lastAppliedMatchSourceSystem
        ? delta.lastAppliedMatchSourceSystem
        : base.lastAppliedMatchSourceSystem ?? null,
  };
};

const sortLabel = (messages: Messages, key: SortKey) => {
  switch (key) {
    case "name":
      return messages.sortName;
    case "age":
      return messages.sortAge;
    case "arrival":
      return messages.sortArrival;
    case "tsi":
      return messages.sortTsi;
    case "wage":
      return messages.sortWage;
    case "form":
      return messages.sortForm;
    case "stamina":
      return messages.sortStamina;
    case "experience":
      return messages.sortExperience;
    case "loyalty":
      return messages.sortLoyalty;
    case "injuries":
      return messages.sortInjuries;
    case "cards":
      return messages.sortCards;
    case "keeper":
      return messages.sortKeeper;
    case "defender":
      return messages.sortDefender;
    case "playmaker":
      return messages.sortPlaymaker;
    case "winger":
      return messages.sortWinger;
    case "passing":
      return messages.sortPassing;
    case "scorer":
      return messages.sortScorer;
    case "setpieces":
      return messages.sortSetPieces;
    default:
      return messages.sortName;
  }
};

const compareNullable = (left: number | string | null, right: number | string | null) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }
  return Number(left) - Number(right);
};

const metricPillStyle = (
  value: number | null,
  minValue: number,
  maxValue: number,
  reverse = false
): CSSProperties | undefined => {
  if (value === null || value === undefined) return undefined;
  if (maxValue <= minValue) return undefined;
  const baseT = Math.min(1, Math.max((value - minValue) / (maxValue - minValue), 0));
  const t = reverse ? 1 - baseT : baseT;
  const hue = 5 + (130 - 5) * t;
  return {
    backgroundColor: `hsl(${Math.round(hue)} 72% 88%)`,
    borderColor: `hsl(${Math.round(hue)} 62% 45%)`,
    color: `hsl(${Math.round(hue)} 68% 24%)`,
  };
};

const formatEurFromSek = (valueSek: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(valueSek / CHPP_SEK_PER_EUR);

const generateFormationShapes = () => {
  const shapes: Array<{ defenders: number; midfielders: number; attackers: number }> = [];
  for (let defenders = 2; defenders <= 5; defenders += 1) {
    for (let midfielders = 2; midfielders <= 5; midfielders += 1) {
      for (let attackers = 0; attackers <= 3; attackers += 1) {
        if (defenders + midfielders + attackers !== 10) continue;
        shapes.push({ defenders, midfielders, attackers });
      }
    }
  }
  return shapes.sort(
    (left, right) =>
      left.defenders - right.defenders ||
      right.midfielders - left.midfielders ||
      right.attackers - left.attackers
  );
};

const parseFormationShape = (formation: string) => {
  const [defendersRaw, midfieldersRaw, attackersRaw] = formation
    .split("-")
    .map((value) => Number(value));
  if (
    !Number.isFinite(defendersRaw) ||
    !Number.isFinite(midfieldersRaw) ||
    !Number.isFinite(attackersRaw)
  ) {
    return null;
  }
  const defenders = Math.trunc(defendersRaw);
  const midfielders = Math.trunc(midfieldersRaw);
  const attackers = Math.trunc(attackersRaw);
  if (defenders + midfielders + attackers !== 10) return null;
  return { defenders, midfielders, attackers };
};

const occupiedSlotsForFormationShape = (shape: {
  defenders: number;
  midfielders: number;
  attackers: number;
}) => {
  const defenseSlots = DEFENSE_FORMATION_MAP[shape.defenders] ?? [];
  return [
    "KP",
    ...defenseSlots,
    ...(MIDFIELD_FORMATION_MAP[shape.midfielders] ?? []),
    ...(ATTACK_FORMATION_MAP[shape.attackers] ?? []),
  ];
};

const buildLineupPayload = (
  assignments: LineupAssignments,
  tacticType: number,
  options?: {
    behaviors?: Partial<Record<(typeof FIELD_SLOT_ORDER)[number], number>>;
    benchIds?: number[];
    kickerIds?: number[];
    captainId?: number | null;
    setPiecesId?: number | null;
    substitutions?: MatchOrderSubstitution[];
  }
) => {
  const toId = (value: number | null | undefined) => value ?? 0;
  return {
    positions: FIELD_SLOT_ORDER.map((slot) => ({
      id: toId(assignments[slot]),
      behaviour: options?.behaviors?.[slot] ?? 0,
    })),
    bench: [
      ...Array.from({ length: 7 }, (_, index) => ({
        id: Number(options?.benchIds?.[index] ?? 0) || toId(assignments[BENCH_SLOT_ORDER[index]]),
        behaviour: 0,
      })),
      ...Array.from({ length: 7 }, (_, index) => ({
        id: Number(options?.benchIds?.[index + 7] ?? 0) || 0,
        behaviour: 0,
      })),
    ],
    kickers: Array.from({ length: 11 }, (_, index) => ({
      id: Number(options?.kickerIds?.[index] ?? 0) || 0,
      behaviour: 0,
    })),
    captain: Number(options?.captainId ?? 0) || 0,
    setPieces: Number(options?.setPiecesId ?? 0) || 0,
    settings: {
      tactic: Number.isFinite(tacticType) ? tacticType : 0,
      speechLevel: 0,
      newLineup: "",
      coachModifier: 0,
      manMarkerPlayerId: 0,
      manMarkingPlayerId: 0,
    },
    substitutions: options?.substitutions ?? [],
  };
};

const toCollectiveRatings = (ratings: PredictedRatings): CollectiveRatings => {
  const midfield = ratings.ratingMidfield ?? 0;
  const defense =
    (ratings.ratingRightDef ?? 0) + (ratings.ratingMidDef ?? 0) + (ratings.ratingLeftDef ?? 0);
  const attack =
    (ratings.ratingRightAtt ?? 0) + (ratings.ratingMidAtt ?? 0) + (ratings.ratingLeftAtt ?? 0);
  return {
    midfield,
    defense,
    attack,
    overall: midfield + defense + attack,
  };
};

const fixedFormationTacticWeightedScore = (collective: CollectiveRatings) =>
  collective.overall +
  collective.attack / 100 +
  collective.defense / 10_000 +
  collective.midfield / 1_000_000;

const trainingAwareShapeAllowed = (
  shape: { defenders: number; midfielders: number; attackers: number },
  trainingType: number | null
) => {
  if (trainingType === null || trainingType === 0 || trainingType === 1) return true;
  if (trainingType === 2 || trainingType === 6 || trainingType === 9) return true;
  if (trainingType === 3) return shape.defenders === 5;
  if (trainingType === 4) return shape.attackers === 3;
  if (trainingType === 5) return shape.defenders >= 4 && shape.midfielders >= 4;
  if (trainingType === 7) return shape.defenders === 2 && shape.midfielders === 5 && shape.attackers === 3;
  if (trainingType === 8) return shape.midfielders === 5;
  if (trainingType === 10) return shape.defenders === 5 && shape.midfielders === 5 && shape.attackers === 0;
  if (trainingType === 11) return shape.defenders === 5 && shape.midfielders === 5 && shape.attackers === 0;
  if (trainingType === 12) return shape.midfielders >= 4 && shape.attackers === 3;
  return true;
};

const requiredTrainableSlots = (trainingType: number | null): string[] => {
  switch (trainingType) {
    case 3:
      return [...DEFENSE_SLOTS];
    case 4:
      return ["F_L", "F_C", "F_R"];
    case 5:
      return ["WB_L", "WB_R", "W_L", "W_R"];
    case 8:
      return ["W_L", "IM_L", "IM_C", "IM_R", "W_R"];
    case 10:
    case 11:
      return [...DEFENSE_SLOTS, ...MIDFIELD_SLOTS];
    case 12:
      return ["W_L", "W_R", "F_L", "F_C", "F_R"];
    default:
      return [];
  }
};

const orderFormationSlotsForTraining = (
  occupiedSlots: string[],
  trainingType: number | null
): string[] => {
  const defaultOrdered = FIELD_SLOT_ORDER.filter((slot) => occupiedSlots.includes(slot));
  if (trainingType === 8) {
    const priority = ["IM_L", "IM_C", "IM_R", "W_L", "W_R"];
    const prioritySet = new Set(priority);
    return [
      ...priority.filter((slot) => occupiedSlots.includes(slot)),
      ...defaultOrdered.filter((slot) => !prioritySet.has(slot)),
    ];
  }
  if (trainingType === 5) {
    const priority = ["W_L", "W_R", "WB_L", "WB_R"];
    const prioritySet = new Set(priority);
    return [
      ...priority.filter((slot) => occupiedSlots.includes(slot)),
      ...defaultOrdered.filter((slot) => !prioritySet.has(slot)),
    ];
  }
  return defaultOrdered;
};

const pickMostCommonFormation = (rows: OpponentFormationRow[]): string | null => {
  const rowsWithFormation = rows.filter(
    (row): row is OpponentFormationRow & { formation: string } =>
      typeof row.formation === "string" && row.formation.trim().length > 0
  );
  if (rowsWithFormation.length === 0) return null;
  const counts = new Map<string, number>();
  rowsWithFormation.forEach((row) => {
    counts.set(row.formation, (counts.get(row.formation) ?? 0) + 1);
  });
  const topCount = Math.max(...Array.from(counts.values()));
  const tied = Array.from(counts.entries())
    .filter(([, count]) => count === topCount)
    .map(([formation]) => formation);
  if (tied.length === 1) return tied[0] ?? null;
  const tiedRows = rowsWithFormation
    .filter((row) => tied.includes(row.formation))
    .sort(
      (left, right) =>
        (parseChppDate(right.matchDate)?.getTime() ?? 0) -
        (parseChppDate(left.matchDate)?.getTime() ?? 0)
    );
  return tiedRows[0]?.formation ?? null;
};

const chooseFormationByRules = (rows: OpponentFormationRow[]): string | null => {
  const rowsWithFormation = rows.filter(
    (row): row is OpponentFormationRow & { formation: string } =>
      typeof row.formation === "string" && row.formation.trim().length > 0
  );
  if (rowsWithFormation.length === 0) return null;
  const againstRows = rowsWithFormation.filter((row) => row.againstMyTeam);
  if (againstRows.length === 1) return againstRows[0]?.formation ?? null;
  if (againstRows.length > 1) {
    const counts = new Map<string, number>();
    againstRows.forEach((row) => {
      counts.set(row.formation, (counts.get(row.formation) ?? 0) + 1);
    });
    const topCount = Math.max(...Array.from(counts.values()));
    const winners = Array.from(counts.entries()).filter(([, count]) => count === topCount);
    const againstChoice = pickMostCommonFormation(againstRows);
    if (winners.length === 1) return againstChoice;
    const otherRows = rowsWithFormation.filter((row) => !row.againstMyTeam);
    return pickMostCommonFormation(otherRows) ?? againstChoice;
  }
  return pickMostCommonFormation(rowsWithFormation);
};

const computeAverageRating = (values: Array<number | null>): number | null => {
  const valid = values.filter((value): value is number => typeof value === "number");
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const computeChosenFormationAverages = (
  rows: OpponentFormationRow[],
  chosenFormation: string | null
): OpponentFormationAverages | null => {
  if (!chosenFormation) return null;
  const selected = rows.filter((row) => row.formation === chosenFormation);
  if (selected.length === 0) return null;
  return {
    sampleSize: selected.length,
    ratingMidfield: computeAverageRating(selected.map((row) => row.ratingMidfield)),
    ratingRightDef: computeAverageRating(selected.map((row) => row.ratingRightDef)),
    ratingMidDef: computeAverageRating(selected.map((row) => row.ratingMidDef)),
    ratingLeftDef: computeAverageRating(selected.map((row) => row.ratingLeftDef)),
    ratingRightAtt: computeAverageRating(selected.map((row) => row.ratingRightAtt)),
    ratingMidAtt: computeAverageRating(selected.map((row) => row.ratingMidAtt)),
    ratingLeftAtt: computeAverageRating(selected.map((row) => row.ratingLeftAtt)),
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

const buildDistribution = (counts: Map<string, number>): FormationTacticsDistribution[] =>
  Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));

export default function SeniorDashboard({
  messages,
  initialSeniorTeams = [],
  initialSeniorTeamId = null,
}: SeniorDashboardProps) {
  const showSetBestLineupDebugModal = process.env.NODE_ENV !== "production";
  const { addNotification } = useNotifications();
  const [seniorTeams, setSeniorTeams] = useState<SeniorTeamOption[]>(initialSeniorTeams);
  const [selectedSeniorTeamId, setSelectedSeniorTeamId] = useState<number | null>(
    initialSeniorTeamId
  );
  const [managerCompendiumUserIdOverride, setManagerCompendiumUserIdOverride] =
    useState<string | null>(null);
  const [players, setPlayers] = useState<SeniorPlayer[]>([]);
  const [matchesState, setMatchesState] = useState<MatchesResponse>({});
  const [ratingsResponse, setRatingsResponse] = useState<RatingsMatrixResponse | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<number, PlayerDetailCacheEntry>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<LineupAssignments>({});
  const [behaviors, setBehaviors] = useState<LineupBehaviors>({});
  const [loadedMatchId, setLoadedMatchId] = useState<number | null>(null);
  const [tacticType, setTacticType] = useState(0);
  const [trainingType, setTrainingType] = useState<number | null>(null);
  const [setBestLineupFixedFormation, setSetBestLineupFixedFormation] = useState<
    string | null
  >(null);
  const [trainingTypeSetPending, setTrainingTypeSetPending] = useState(false);
  const [trainingTypeSetPendingValue, setTrainingTypeSetPendingValue] = useState<number | null>(
    null
  );
  const [includeTournamentMatches, setIncludeTournamentMatches] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorDetails, setLoadErrorDetails] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [refreshProgressPct, setRefreshProgressPct] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [updatesHistory, setUpdatesHistory] = useState<SeniorUpdatesGroupedEntry[]>([]);
  const [matrixNewMarkers, setMatrixNewMarkers] = useState<SeniorMatrixNewMarkers>(
    buildEmptySeniorMatrixNewMarkers
  );
  const [selectedUpdatesId, setSelectedUpdatesId] = useState<string | null>(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<number[] | null>(null);
  const [orderSource, setOrderSource] = useState<"list" | "ratings" | "skills" | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] =
    useState<PlayerDetailsPanelTab>("details");
  const [showSeniorSkillBonusInMatrix, setShowSeniorSkillBonusInMatrix] =
    useState(true);
  const [extraTimeBTeamEnabled, setExtraTimeBTeamEnabled] = useState(false);
  const [extraTimeBTeamBerlinWeekend, setExtraTimeBTeamBerlinWeekend] = useState(() =>
    isBerlinWeekend(new Date())
  );
  const [extraTimeBTeamMinutesThreshold, setExtraTimeBTeamMinutesThreshold] = useState(
    EXTRA_TIME_B_TEAM_DEFAULT_THRESHOLD
  );
  const [extraTimeBTeamRecentMatchState, setExtraTimeBTeamRecentMatchState] =
    useState<ExtraTimeBTeamRecentMatchState>({
      status: "idle",
      recentMatch: null,
      playerMinutesById: {},
    });
  const [extraTimeSelectedPlayerIds, setExtraTimeSelectedPlayerIds] = useState<number[]>([]);
  const [extraTimeMatrixTrainingType, setExtraTimeMatrixTrainingType] =
    useState<number | null>(null);
  const [extraTimeMatrixTrainingTypeManual, setExtraTimeMatrixTrainingTypeManual] =
    useState(false);
  const [extraTimeMatchId, setExtraTimeMatchId] = useState<number | null>(null);
  const [extraTimePreparedSubmission, setExtraTimePreparedSubmission] = useState<{
    matchId: number;
    traineeIds: number[];
    trainingType: number | null;
    wingerRoleIds?: number[];
    wingerAttackerRoleIds?: number[];
    scoringRoleIds?: number[];
  } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [deferHelpUntilInitialRefresh, setDeferHelpUntilInitialRefresh] =
    useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [scopeReconnectModalOpen, setScopeReconnectModalOpen] = useState(false);
  const [helpCallouts, setHelpCallouts] = useState<
    {
      id: string;
      text: string;
      style: CSSProperties;
      hideIndex?: boolean;
      placement?:
        | "above-left"
        | "above-center"
        | "below-center"
        | "right-center"
        | "left-center";
    }[]
  >([]);
  const [stateRestored, setStateRestored] = useState(false);
  const [stalenessDays, setStalenessDays] = useState(1);
  const [dataRestored, setDataRestored] = useState(false);
  const [opponentFormationsModal, setOpponentFormationsModal] = useState<{
    title: string;
    mode: SetBestLineupMode;
    opponentRows: OpponentFormationRow[];
    chosenFormation: string | null;
    chosenFormationAverages: OpponentFormationAverages | null;
    generatedRows: GeneratedFormationRow[];
    fixedFormation: string | null;
    fixedFormationTacticRows: FixedFormationTacticRow[];
    selectedGeneratedFormation: string | null;
    selectedGeneratedTactic: number | null;
    selectedRejectedPlayerIds: number[];
    selectedIneligiblePlayerIds: number[];
    selectedComparison:
      | {
          ours: CollectiveRatings;
          opponent: CollectiveRatings;
        }
      | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [opponentAnalysisModal, setOpponentAnalysisModal] = useState<{
    title: string;
    opponentTeamId: number;
    opponentName: string;
    opponentRows: OpponentFormationRow[];
    preferredFormation: string | null;
    preferredTactic: number | null;
    versusFormation: string | null;
    versusTactic: number | null;
    formationDistribution: FormationTacticsDistribution[];
    tacticDistribution: FormationTacticsDistribution[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [submitDisclaimerOpen, setSubmitDisclaimerOpen] = useState(false);
  const [submitDisclaimerExtraTimeSummary, setSubmitDisclaimerExtraTimeSummary] = useState<{
    trainingLabel: string;
    trainees: Array<{ id: number; name: string }>;
  } | null>(null);
  const [extraTimeInfoOpen, setExtraTimeInfoOpen] = useState(false);
  const [extraTimeTrainingMenuOpen, setExtraTimeTrainingMenuOpen] = useState(false);

  const refreshRunSeqRef = useRef(0);
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const extraTimeTrainingButtonRef = useRef<HTMLButtonElement | null>(null);
  const extraTimeTrainingMenuRef = useRef<HTMLDivElement | null>(null);
  const extraTimeAutoSelectionOpenRef = useRef(false);
  const extraTimeAutoSelectionTrainingTypeRef = useRef<number | null>(null);
  const extraTimeLastAutoSelectedPlayerIdsRef = useRef<number[] | null>(null);
  const activeRefreshRunIdRef = useRef<number | null>(null);
  const stoppedRefreshRunIdsRef = useRef<Set<number>>(new Set());
  const staleRefreshAttemptedRef = useRef(false);
  const seniorHasDataRef = useRef(false);
  const persistedMarkersBaselineRef = useRef<PersistedSeniorMarkersBaseline | null>(
    null
  );
  const suppressNextUpdatesRecordingRef = useRef(false);
  const refreshAllRef = useRef<((reason: "manual" | "stale") => Promise<boolean>) | null>(
    null
  );
  const restoredStateStorageKeyRef = useRef<string | null>(null);
  const restoredDataStorageKeyRef = useRef<string | null>(null);

  const selectedPlayer =
    selectedId !== null
      ? players.find((player) => player.PlayerID === selectedId) ?? null
      : null;
  const selectedDetails =
    selectedId !== null ? detailsCache[selectedId]?.data ?? null : null;
  const multiTeamEnabled = seniorTeams.length > 1;
  const activeSeniorTeamId = multiTeamEnabled ? selectedSeniorTeamId : null;
  const activeSeniorTeamOption = useMemo(() => {
    if (seniorTeams.length === 0) return null;
    if (!multiTeamEnabled) return seniorTeams[0];
    if (!selectedSeniorTeamId) return seniorTeams[0];
    return (
      seniorTeams.find((team) => team.teamId === selectedSeniorTeamId) ??
      seniorTeams[0]
    );
  }, [multiTeamEnabled, selectedSeniorTeamId, seniorTeams]);
  const resolvedSeniorTeamId = useMemo(
    () => activeSeniorTeamId ?? activeSeniorTeamOption?.teamId ?? null,
    [activeSeniorTeamId, activeSeniorTeamOption]
  );
  const stateStorageKey = useMemo(
    () => resolveScopedStorageKey(STATE_STORAGE_KEY, activeSeniorTeamId, multiTeamEnabled),
    [activeSeniorTeamId, multiTeamEnabled]
  );
  const dataStorageKey = useMemo(
    () => resolveScopedStorageKey(DATA_STORAGE_KEY, activeSeniorTeamId, multiTeamEnabled),
    [activeSeniorTeamId, multiTeamEnabled]
  );
  const lastRefreshStorageKey = useMemo(
    () =>
      resolveScopedStorageKey(
        LAST_REFRESH_STORAGE_KEY,
        activeSeniorTeamId,
        multiTeamEnabled
      ),
    [activeSeniorTeamId, multiTeamEnabled]
  );
  const listSortStorageKey = useMemo(
    () =>
      resolveScopedStorageKey(
        LIST_SORT_STORAGE_KEY,
        activeSeniorTeamId,
        multiTeamEnabled
      ),
    [activeSeniorTeamId, multiTeamEnabled]
  );
  const extraTimeBTeamWeekendLocked =
    process.env.NODE_ENV === "production" && extraTimeBTeamBerlinWeekend;
  const effectiveExtraTimeBTeamEnabled =
    extraTimeBTeamEnabled && !extraTimeBTeamWeekendLocked;

  useEffect(() => {
    const updateWeekendLock = () => {
      setExtraTimeBTeamBerlinWeekend(isBerlinWeekend(new Date()));
    };
    updateWeekendLock();
    const intervalId = window.setInterval(updateWeekendLock, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!multiTeamEnabled) return;
    if (activeSeniorTeamId) return;
    const fallbackId = seniorTeams[0]?.teamId ?? null;
    if (fallbackId) {
      setSelectedSeniorTeamId(fallbackId);
    }
  }, [activeSeniorTeamId, multiTeamEnabled, seniorTeams]);

  const detailsById = useMemo(() => {
    const map = new Map<number, SeniorPlayerDetails>();
    Object.entries(detailsCache).forEach(([key, entry]) => {
      const id = Number(key);
      if (!Number.isFinite(id)) return;
      map.set(id, entry.data);
    });
    return map;
  }, [detailsCache]);
  const matrixNewPlayerIdSet = useMemo(
    () => new Set(matrixNewMarkers.playerIds),
    [matrixNewMarkers.playerIds]
  );

  const skillValueForPlayer = (player: SeniorPlayer, key: (typeof SKILL_KEYS)[number]) => {
    const detailsSkills = detailsById.get(player.PlayerID)?.PlayerSkills;
    const listSkills = player.PlayerSkills;
    return parseSkill(detailsSkills?.[key] ?? listSkills?.[key]);
  };

  const salaryValueForPlayer = (player: SeniorPlayer) => {
    const detailsSalary = detailsById.get(player.PlayerID)?.Salary;
    return typeof detailsSalary === "number" ? detailsSalary : player.Salary ?? null;
  };

  const obtainedTrainingRegimenLabel = (value: number | null) => {
    switch (value) {
      case 0:
        return messages.settingsGeneral;
      case 1:
        return messages.sortStamina;
      case 2:
        return messages.trainingSetPieces;
      case 3:
        return messages.trainingDefending;
      case 4:
        return messages.trainingScoring;
      case 5:
        return messages.trainingWinger;
      case 6:
        return `${messages.trainingScoring} + ${messages.trainingSetPieces}`;
      case 7:
        return messages.trainingPassing;
      case 8:
        return messages.trainingPlaymaking;
      case 9:
        return messages.trainingKeeper;
      case 10:
        return messages.trainingPassingDefendersMidfielders;
      case 11:
        return messages.trainingDefendingDefendersMidfielders;
      case 12:
        return messages.trainingWingerWingerAttackers;
      default:
        return messages.unknownShort;
    }
  };

  const trainingSectionTitleForValue = (value: number) => {
    if (value === 9) return messages.trainingSectionFocused;
    if (value === 11) return messages.trainingSectionExtended;
    if (value === 6) return messages.trainingSectionCombined;
    return null;
  };

  const traineesTargetForTrainingType = (value: number | null) => {
    switch (value) {
      case 9:
        return 2;
      case 3:
        return 7;
      case 8:
        return 8;
      case 5:
        return 6;
      case 7:
        return 13;
      case 4:
        return 4;
      case 2:
        return 13;
      case 11:
        return 14;
      case 12:
        return 7;
      case 10:
        return 13;
      case 6:
        return 14;
      default:
        return 0;
    }
  };

  const sortedPlayers = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...players]
      .map((player, index) => ({ player, index }))
      .sort((left, right) => {
        const getMetric = (player: SeniorPlayer): number | string | null => {
          const details = detailsById.get(player.PlayerID);
          switch (sortKey) {
            case "name":
              return formatPlayerName(player);
            case "age":
              return player.Age !== undefined && player.AgeDays !== undefined
                ? player.Age * 112 + player.AgeDays
                : null;
            case "arrival": {
              const time = Date.parse((player.ArrivalDate ?? "").replace(" ", "T"));
              return Number.isFinite(time) ? time : null;
            }
            case "tsi":
              return player.TSI ?? null;
            case "wage":
              return salaryValueForPlayer(player);
            case "form":
              return details?.Form ?? player.Form ?? null;
            case "stamina":
              return details?.StaminaSkill ?? player.StaminaSkill ?? null;
            case "experience":
              return details?.Experience ?? null;
            case "loyalty":
              return details?.Loyalty ?? null;
            case "injuries":
              return details?.InjuryLevel ?? player.InjuryLevel ?? null;
            case "cards":
              return details?.Cards ?? player.Cards ?? null;
            case "keeper":
              return skillValueForPlayer(player, "KeeperSkill");
            case "defender":
              return skillValueForPlayer(player, "DefenderSkill");
            case "playmaker":
              return skillValueForPlayer(player, "PlaymakerSkill");
            case "winger":
              return skillValueForPlayer(player, "WingerSkill");
            case "passing":
              return skillValueForPlayer(player, "PassingSkill");
            case "scorer":
              return skillValueForPlayer(player, "ScorerSkill");
            case "setpieces":
              return skillValueForPlayer(player, "SetPiecesSkill");
            default:
              return formatPlayerName(player);
          }
        };

        const leftMetric = getMetric(left.player);
        const rightMetric = getMetric(right.player);
        const result = compareNullable(leftMetric, rightMetric);
        if (result !== 0) return result * direction;
        return left.index - right.index;
      })
      .map((entry) => entry.player);
  }, [detailsById, players, sortDirection, sortKey]);

  const hasSeniorData = useMemo(() => {
    if (players.length > 0) return true;
    const list =
      matchesState.data?.HattrickData?.MatchList?.Match ??
      matchesState.data?.HattrickData?.Team?.MatchList?.Match;
    if (Array.isArray(list)) return list.length > 0;
    return Boolean(list);
  }, [matchesState, players.length]);

  useEffect(() => {
    seniorHasDataRef.current = hasSeniorData;
  }, [hasSeniorData]);

  const playerNavigationIds = useMemo(() => {
    if (orderedPlayerIds && orderedPlayerIds.length) {
      const validIds = new Set(players.map((player) => player.PlayerID));
      return orderedPlayerIds.filter((id) => validIds.has(id));
    }
    return sortedPlayers.map((player) => player.PlayerID);
  }, [orderedPlayerIds, players, sortedPlayers]);

  const selectedSortedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return playerNavigationIds.indexOf(selectedId);
  }, [playerNavigationIds, selectedId]);

  const previousPlayerId =
    selectedSortedIndex > 0 ? playerNavigationIds[selectedSortedIndex - 1] ?? null : null;
  const nextPlayerId =
    selectedSortedIndex >= 0 && selectedSortedIndex < playerNavigationIds.length - 1
      ? playerNavigationIds[selectedSortedIndex + 1] ?? null
      : null;

  const panelPlayers = useMemo(
    () =>
      players.map((player) => ({
        YouthPlayerID: player.PlayerID,
        FirstName: player.FirstName,
        NickName: player.NickName ?? "",
        LastName: player.LastName,
        Specialty: player.Specialty,
        InjuryLevel: player.InjuryLevel,
        PlayerSkills: player.PlayerSkills,
      })),
    [players]
  );

  const panelDetailsById = useMemo(() => {
    const map = new Map<
      number,
      {
        YouthPlayerID: number;
        FirstName: string;
        NickName?: string;
        LastName: string;
        Age?: number;
        AgeDays?: number;
        ArrivalDate?: string;
        Specialty?: number;
        InjuryLevel?: number;
        Form?: number;
        StaminaSkill?: number;
        PersonalityStatement?: string;
        Experience?: number;
        Leadership?: number;
        Loyalty?: number;
        MotherClubBonus?: boolean;
        CareerGoals?: number;
        CareerHattricks?: number;
        LeagueGoals?: number;
        CupGoals?: number;
        FriendliesGoals?: number;
        GoalsCurrentTeam?: number;
        AssistsCurrentTeam?: number;
        CareerAssists?: number;
        MatchesCurrentTeam?: number;
        PlayerSkills?: Record<string, SkillValue>;
        LastMatch?: {
          Date?: string;
          PositionCode?: number;
          Rating?: number;
        };
      }
    >();
    detailsById.forEach((detail, playerId) => {
      const fallback = players.find((player) => player.PlayerID === playerId);
      map.set(playerId, {
        YouthPlayerID: playerId,
        FirstName: detail.FirstName ?? fallback?.FirstName ?? "",
        NickName: detail.NickName ?? fallback?.NickName,
        LastName: detail.LastName ?? fallback?.LastName ?? "",
        Age: detail.Age ?? fallback?.Age,
        AgeDays: detail.AgeDays ?? fallback?.AgeDays,
        ArrivalDate: detail.ArrivalDate ?? fallback?.ArrivalDate,
        Specialty: detail.Specialty ?? fallback?.Specialty,
        InjuryLevel: detail.InjuryLevel ?? fallback?.InjuryLevel,
        Form: detail.Form ?? fallback?.Form,
        StaminaSkill: detail.StaminaSkill ?? fallback?.StaminaSkill,
        PersonalityStatement: detail.PersonalityStatement,
        Experience: detail.Experience,
        Leadership: detail.Leadership,
        Loyalty: detail.Loyalty,
        MotherClubBonus: detail.MotherClubBonus,
        CareerGoals: detail.CareerGoals,
        CareerHattricks: detail.CareerHattricks,
        LeagueGoals: detail.LeagueGoals,
        CupGoals: detail.CupGoals,
        FriendliesGoals: detail.FriendliesGoals,
        GoalsCurrentTeam: detail.GoalsCurrentTeam,
        AssistsCurrentTeam: detail.AssistsCurrentTeam,
        CareerAssists: detail.CareerAssists,
        MatchesCurrentTeam: detail.MatchesCurrentTeam,
        PlayerSkills: detail.PlayerSkills ?? fallback?.PlayerSkills,
        LastMatch: detail.LastMatch,
      });
    });
    return map;
  }, [detailsById, players]);

  const selectedPanelPlayer = useMemo(() => {
    if (!selectedPlayer) return null;
    return {
      YouthPlayerID: selectedPlayer.PlayerID,
      FirstName: selectedPlayer.FirstName,
      NickName: selectedPlayer.NickName ?? "",
      LastName: selectedPlayer.LastName,
      Specialty: selectedPlayer.Specialty,
      InjuryLevel: selectedDetails?.InjuryLevel ?? selectedPlayer.InjuryLevel,
      Form: selectedDetails?.Form ?? selectedPlayer.Form,
      StaminaSkill: selectedDetails?.StaminaSkill ?? selectedPlayer.StaminaSkill,
      PlayerSkills: selectedDetails?.PlayerSkills ?? selectedPlayer.PlayerSkills,
    };
  }, [
    selectedDetails?.Form,
    selectedDetails?.InjuryLevel,
    selectedDetails?.PlayerSkills,
    selectedDetails?.StaminaSkill,
    selectedPlayer,
  ]);

  const selectedPanelDetails = useMemo(() => {
    if (!selectedPlayer) return null;
    return (
      panelDetailsById.get(selectedPlayer.PlayerID) ?? {
        YouthPlayerID: selectedPlayer.PlayerID,
        FirstName: selectedPlayer.FirstName,
        NickName: selectedPlayer.NickName,
        LastName: selectedPlayer.LastName,
        Age: selectedPlayer.Age,
        AgeDays: selectedPlayer.AgeDays,
        ArrivalDate: selectedPlayer.ArrivalDate,
        Specialty: selectedPlayer.Specialty,
        InjuryLevel: selectedPlayer.InjuryLevel,
        Form: selectedPlayer.Form,
        StaminaSkill: selectedPlayer.StaminaSkill,
        PlayerSkills: selectedPlayer.PlayerSkills,
      }
    );
  }, [panelDetailsById, selectedPlayer]);

  const skillsMatrixRows = useMemo(
    () =>
      players.map((player) => ({
        id: player.PlayerID,
        name: formatPlayerName(player),
      })),
    [players]
  );
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.PlayerID, player])),
    [players]
  );
  const resolvedExtraTimeTrainingType =
    extraTimeMatrixTrainingTypeManual && extraTimeMatrixTrainingType !== null
      ? extraTimeMatrixTrainingType
      : trainingType;
  const extraTimeSortSkillKey = useMemo(
    () =>
      resolvedExtraTimeTrainingType !== null
        ? EXTRA_TIME_SORT_SKILL_BY_TRAINING_TYPE[resolvedExtraTimeTrainingType] ?? null
        : null,
    [resolvedExtraTimeTrainingType]
  );
  const extraTimeSkillsMatrixRows = useMemo(() => {
    if (!extraTimeSortSkillKey && resolvedExtraTimeTrainingType !== 6) return skillsMatrixRows;
    return [...skillsMatrixRows].sort((left, right) => {
      const leftPlayer = left.id !== null ? playersById.get(left.id) ?? null : null;
      const rightPlayer = right.id !== null ? playersById.get(right.id) ?? null : null;
      const leftDetails = left.id !== null ? detailsById.get(left.id) ?? null : null;
      const rightDetails = right.id !== null ? detailsById.get(right.id) ?? null : null;
      const resolveEffectiveSkill = (
        player: SeniorPlayer | null,
        details: (typeof leftDetails) | null,
        skillKey: (typeof SKILL_KEYS)[number]
      ) => {
        const baseSkill = parseSkill(
          details?.PlayerSkills?.[skillKey] ?? player?.PlayerSkills?.[skillKey]
        );
        return showSeniorSkillBonusInMatrix
          ? computeSeniorEffectiveSkill(baseSkill, details)
          : baseSkill;
      };
      const leftValue =
        resolvedExtraTimeTrainingType === 6
          ? (resolveEffectiveSkill(leftPlayer, leftDetails, "ScorerSkill") ?? 0) +
            (resolveEffectiveSkill(leftPlayer, leftDetails, "SetPiecesSkill") ?? 0)
          : extraTimeSortSkillKey
            ? resolveEffectiveSkill(leftPlayer, leftDetails, extraTimeSortSkillKey)
            : null;
      const rightValue =
        resolvedExtraTimeTrainingType === 6
          ? (resolveEffectiveSkill(rightPlayer, rightDetails, "ScorerSkill") ?? 0) +
            (resolveEffectiveSkill(rightPlayer, rightDetails, "SetPiecesSkill") ?? 0)
          : extraTimeSortSkillKey
            ? resolveEffectiveSkill(rightPlayer, rightDetails, extraTimeSortSkillKey)
            : null;
      if (leftValue === null && rightValue === null) {
        return left.name.localeCompare(right.name);
      }
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      if (leftValue !== rightValue) return rightValue - leftValue;
      return left.name.localeCompare(right.name);
    });
  }, [
    detailsById,
    extraTimeSortSkillKey,
    playersById,
    resolvedExtraTimeTrainingType,
    showSeniorSkillBonusInMatrix,
    skillsMatrixRows,
  ]);
  const extraTimePlayerDetailsById = useMemo(
    () =>
      new Map(
        Array.from(detailsById.entries()).flatMap(([id, detail]) => {
          const fallback = playersById.get(id);
          if (!fallback) return [];
          return [
            [
              id,
              {
                ...detail,
                YouthPlayerID: id,
                FirstName: detail.FirstName ?? fallback.FirstName,
                NickName: detail.NickName ?? fallback.NickName,
                LastName: detail.LastName ?? fallback.LastName,
              },
            ] as const,
          ];
        })
      ),
    [detailsById, playersById]
  );
  const extraTimeInjuredPlayerIdSet = useMemo(() => {
    const injuredIds = new Set<number>();
    skillsMatrixRows.forEach((row) => {
      if (typeof row.id !== "number") return;
      const details = detailsById.get(row.id);
      const player = playersById.get(row.id);
      const injuryLevel =
        typeof details?.InjuryLevel === "number"
          ? details.InjuryLevel
          : typeof player?.InjuryLevel === "number"
            ? player.InjuryLevel
            : null;
      if (typeof injuryLevel === "number" && injuryLevel >= 1) {
        injuredIds.add(row.id);
      }
    });
    return injuredIds;
  }, [detailsById, playersById, skillsMatrixRows]);
  const extraTimeHealthyPlayerIdSet = useMemo(
    () =>
      new Set(
        skillsMatrixRows
          .map((row) => row.id)
          .filter(
            (id): id is number =>
              typeof id === "number" && !extraTimeInjuredPlayerIdSet.has(id)
          )
      ),
    [extraTimeInjuredPlayerIdSet, skillsMatrixRows]
  );
  const extraTimeBTeamExcludedPlayerIds = useMemo(() => {
    if (!effectiveExtraTimeBTeamEnabled) return new Set<number>();
    if (
      extraTimeBTeamRecentMatchState.status !== "ready" ||
      !extraTimeBTeamRecentMatchState.recentMatch
    ) {
      return new Set<number>();
    }
    return new Set(
      Object.entries(extraTimeBTeamRecentMatchState.playerMinutesById)
        .filter(([, minutes]) => minutes > extraTimeBTeamMinutesThreshold)
        .map(([playerId]) => Number(playerId))
        .filter((playerId) => Number.isFinite(playerId))
    );
  }, [
    effectiveExtraTimeBTeamEnabled,
    extraTimeBTeamMinutesThreshold,
    extraTimeBTeamRecentMatchState,
  ]);
  const extraTimeFallbackBTeamPlayerIds = useMemo(() => {
    if (!effectiveExtraTimeBTeamEnabled) return new Set<number>();
    if (
      extraTimeBTeamRecentMatchState.status !== "ready" ||
      !extraTimeBTeamRecentMatchState.recentMatch
    ) {
      return new Set<number>();
    }
    const initialEligibleIds = Array.from(extraTimeHealthyPlayerIdSet).filter(
      (playerId) => !extraTimeBTeamExcludedPlayerIds.has(playerId)
    );
    if (initialEligibleIds.length >= EXTRA_TIME_B_TEAM_MINIMUM_POOL_SIZE) {
      return new Set<number>();
    }
    const needed =
      EXTRA_TIME_B_TEAM_MINIMUM_POOL_SIZE - initialEligibleIds.length;
    const fallbackIds = players
      .filter(
        (player) =>
          extraTimeHealthyPlayerIdSet.has(player.PlayerID) &&
          extraTimeBTeamExcludedPlayerIds.has(player.PlayerID)
      )
      .sort((left, right) => {
        const leftMinutes =
          extraTimeBTeamRecentMatchState.playerMinutesById[left.PlayerID] ?? Number.MAX_SAFE_INTEGER;
        const rightMinutes =
          extraTimeBTeamRecentMatchState.playerMinutesById[right.PlayerID] ?? Number.MAX_SAFE_INTEGER;
        if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })
      .slice(0, needed)
      .map((player) => player.PlayerID);
    return new Set(fallbackIds);
  }, [
    effectiveExtraTimeBTeamEnabled,
    extraTimeBTeamExcludedPlayerIds,
    extraTimeBTeamRecentMatchState,
    extraTimeHealthyPlayerIdSet,
    players,
  ]);
  const extraTimeAvailablePlayerIdSet = useMemo(() => {
    if (
      !effectiveExtraTimeBTeamEnabled ||
      extraTimeBTeamRecentMatchState.status !== "ready" ||
      !extraTimeBTeamRecentMatchState.recentMatch
    ) {
      return new Set(extraTimeHealthyPlayerIdSet);
    }
    return new Set(
      Array.from(extraTimeHealthyPlayerIdSet).filter(
        (playerId) =>
          !extraTimeBTeamExcludedPlayerIds.has(playerId) ||
          extraTimeFallbackBTeamPlayerIds.has(playerId)
      )
    );
  }, [
    effectiveExtraTimeBTeamEnabled,
    extraTimeBTeamExcludedPlayerIds,
    extraTimeBTeamRecentMatchState,
    extraTimeFallbackBTeamPlayerIds,
    extraTimeHealthyPlayerIdSet,
  ]);
  const extraTimeSelectablePlayerIds = useMemo(
    () =>
      extraTimeSkillsMatrixRows
        .map((row) => row.id)
        .filter(
          (id): id is number =>
            typeof id === "number" && extraTimeAvailablePlayerIdSet.has(id)
        ),
    [extraTimeAvailablePlayerIdSet, extraTimeSkillsMatrixRows]
  );
  const extraTimeDisregardedPlayerIds = useMemo(
    () =>
      new Set(
        Array.from(extraTimeBTeamExcludedPlayerIds).filter(
          (playerId) => !extraTimeFallbackBTeamPlayerIds.has(playerId)
        )
      ),
    [extraTimeBTeamExcludedPlayerIds, extraTimeFallbackBTeamPlayerIds]
  );
  const getExtraTimeDisregardedTooltip = useCallback(
    (playerId: number) =>
      messages.seniorExtraTimeModalBTeamDisregardedTooltip.replace(
        "{{minutes}}",
        String(extraTimeBTeamRecentMatchState.playerMinutesById[playerId] ?? 0)
      ),
    [
      extraTimeBTeamRecentMatchState.playerMinutesById,
      messages.seniorExtraTimeModalBTeamDisregardedTooltip,
    ]
  );
  const requiredExtraTimeTrainees = traineesTargetForTrainingType(
    resolvedExtraTimeTrainingType
  );
  const extraTimeAutoSelectedPlayerIds = useMemo(
    () => extraTimeSelectablePlayerIds.slice(0, requiredExtraTimeTrainees),
    [extraTimeSelectablePlayerIds, requiredExtraTimeTrainees]
  );
  const extraTimeSelectedCount = extraTimeSelectedPlayerIds.filter((playerId) =>
    extraTimeSelectablePlayerIds.includes(playerId)
  ).length;
  const extraTimeBTeamCanBeEnabled =
    extraTimeBTeamRecentMatchState.status === "ready" &&
    Boolean(extraTimeBTeamRecentMatchState.recentMatch);
  const extraTimeBTeamReferenceMatchHref =
    typeof extraTimeBTeamRecentMatchState.recentMatch?.matchId === "number" &&
    Number.isFinite(extraTimeBTeamRecentMatchState.recentMatch.matchId) &&
    extraTimeBTeamRecentMatchState.recentMatch.matchId > 0
      ? hattrickMatchUrlWithSourceSystem(
          extraTimeBTeamRecentMatchState.recentMatch.matchId,
          extraTimeBTeamRecentMatchState.recentMatch.sourceSystem
        )
      : null;
  const extraTimeBTeamStatusMessage = (() => {
    if (extraTimeBTeamWeekendLocked) {
      return null;
    }
    if (extraTimeBTeamRecentMatchState.status === "loading") {
      return messages.seniorExtraTimeModalBTeamLoading;
    }
    if (extraTimeBTeamRecentMatchState.status === "error") {
      return messages.seniorExtraTimeModalBTeamError;
    }
    if (!extraTimeBTeamRecentMatchState.recentMatch) {
      return messages.seniorExtraTimeModalBTeamNoRecentMatch;
    }
    return null;
  })();
  const setBestLineupBTeamMenuContent = (
    <div className={styles.seniorSetBestLineupBTeamMenuSection}>
      <div className={styles.seniorExtraTimeBTeamControls}>
        <Tooltip
          content={
            extraTimeBTeamWeekendLocked
              ? messages.seniorExtraTimeModalBTeamWeekendTooltip
              : null
          }
        >
          <label className={styles.matchesFilterToggle}>
            <input
              type="checkbox"
              className={styles.matchesFilterToggleInput}
              checked={effectiveExtraTimeBTeamEnabled}
              disabled={extraTimeBTeamWeekendLocked || !extraTimeBTeamCanBeEnabled}
              onChange={(event) => setExtraTimeBTeamEnabled(event.target.checked)}
            />
            <span className={styles.matchesFilterToggleTrack} aria-hidden="true" />
            <span className={styles.matchesFilterToggleLabel}>
              {messages.seniorExtraTimeModalBTeamToggleLabel}
            </span>
          </label>
        </Tooltip>
        {effectiveExtraTimeBTeamEnabled && extraTimeBTeamCanBeEnabled ? (
          <div className={styles.seniorExtraTimeBTeamThresholdLabel}>
            {renderTemplateTokens(messages.seniorExtraTimeModalBTeamThresholdText, {
              minutes: (
                <select
                  className={styles.seniorExtraTimeBTeamThresholdSelect}
                  aria-label={messages.seniorExtraTimeModalBTeamThresholdAriaLabel}
                  value={extraTimeBTeamMinutesThreshold}
                  onChange={(event) =>
                    setExtraTimeBTeamMinutesThreshold(
                      Math.min(90, Math.max(1, Number(event.target.value) || 1))
                    )
                  }
                >
                  {Array.from({ length: 90 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ),
              weekLink: extraTimeBTeamReferenceMatchHref ? (
                <a
                  className={styles.seniorExtraTimeInlineLink}
                  href={extraTimeBTeamReferenceMatchHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {messages.seniorExtraTimeModalBTeamThresholdWeekLinkLabel}
                </a>
              ) : (
                messages.seniorExtraTimeModalBTeamThresholdWeekLinkLabel
              ),
            })}
          </div>
        ) : extraTimeBTeamStatusMessage ? (
          <span className={styles.seniorExtraTimeBTeamStatus}>
            {extraTimeBTeamStatusMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
  const extraTimeSetLineupDisabled =
    extraTimeSelectedCount !== requiredExtraTimeTrainees;
  const allExtraTimePlayersSelected =
    extraTimeSelectablePlayerIds.length > 0 &&
    extraTimeSelectablePlayerIds.every((playerId) =>
      extraTimeSelectedPlayerIds.includes(playerId)
    );
  const someExtraTimePlayersSelected =
    !allExtraTimePlayersSelected &&
    extraTimeSelectablePlayerIds.some((playerId) =>
      extraTimeSelectedPlayerIds.includes(playerId)
    );

  useEffect(() => {
    setExtraTimeSelectedPlayerIds((prev) =>
      prev.filter((playerId) => playersById.has(playerId) && extraTimeAvailablePlayerIdSet.has(playerId))
    );
  }, [extraTimeAvailablePlayerIdSet, playersById]);

  useEffect(() => {
    if (resolvedSeniorTeamId === null) {
      setExtraTimeBTeamRecentMatchState({
        status: "idle",
        recentMatch: null,
        playerMinutesById: {},
      });
      return;
    }
    let cancelled = false;
    setExtraTimeBTeamRecentMatchState({
      status: "loading",
      recentMatch: null,
      playerMinutesById: {},
    });
    void fetchExtraTimeBTeamRecentMatchState(resolvedSeniorTeamId)
      .then((nextState) => {
        if (cancelled) return;
        setExtraTimeBTeamRecentMatchState(nextState);
      })
      .catch(() => {
        if (cancelled) return;
        setExtraTimeBTeamRecentMatchState({
          status: "error",
          recentMatch: null,
          playerMinutesById: {},
        });
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedSeniorTeamId]);

  useEffect(() => {
    if (extraTimeBTeamRecentMatchState.status === "error") {
      setExtraTimeBTeamEnabled(false);
      return;
    }
    if (extraTimeBTeamRecentMatchState.status !== "ready") return;
    if (extraTimeBTeamRecentMatchState.recentMatch) return;
    setExtraTimeBTeamEnabled(false);
  }, [extraTimeBTeamRecentMatchState]);

  useEffect(() => {
    if (!extraTimeInfoOpen) {
      extraTimeAutoSelectionOpenRef.current = false;
      extraTimeLastAutoSelectedPlayerIdsRef.current = null;
      return;
    }

    const lastAutoSelected = extraTimeLastAutoSelectedPlayerIdsRef.current;
    const matchesLastAutoSelected =
      Array.isArray(lastAutoSelected) &&
      lastAutoSelected.length === extraTimeSelectedPlayerIds.length &&
      lastAutoSelected.every(
        (playerId, index) => extraTimeSelectedPlayerIds[index] === playerId
      );
    const shouldApplyAutoSelection =
      !extraTimeAutoSelectionOpenRef.current ||
      extraTimeAutoSelectionTrainingTypeRef.current !== resolvedExtraTimeTrainingType ||
      matchesLastAutoSelected;

    if (!shouldApplyAutoSelection) {
      extraTimeAutoSelectionOpenRef.current = true;
      extraTimeAutoSelectionTrainingTypeRef.current = resolvedExtraTimeTrainingType;
      return;
    }

    setExtraTimeSelectedPlayerIds(extraTimeAutoSelectedPlayerIds);
    extraTimeAutoSelectionOpenRef.current = true;
    extraTimeAutoSelectionTrainingTypeRef.current = resolvedExtraTimeTrainingType;
    extraTimeLastAutoSelectedPlayerIdsRef.current = extraTimeAutoSelectedPlayerIds;
  }, [
    extraTimeAutoSelectedPlayerIds,
    extraTimeInfoOpen,
    extraTimeSelectedPlayerIds,
    resolvedExtraTimeTrainingType,
  ]);

  useEffect(() => {
    if (extraTimeMatrixTrainingTypeManual) return;
    setExtraTimeMatrixTrainingType(trainingType);
  }, [extraTimeMatrixTrainingTypeManual, trainingType]);

  useEffect(() => {
    if (!extraTimeTrainingMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (extraTimeTrainingButtonRef.current?.contains(target)) return;
      if (extraTimeTrainingMenuRef.current?.contains(target)) return;
      setExtraTimeTrainingMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExtraTimeTrainingMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [extraTimeTrainingMenuOpen]);

  const averageSkillLevelForPlayer = (player: SeniorPlayer) => {
    const values = SKILL_KEYS.map((key) => skillValueForPlayer(player, key)).filter(
      (value): value is number => typeof value === "number"
    );
    if (values.length === 0) return -1;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const comparePlayersBySetPiecesAscending = (left: SeniorPlayer, right: SeniorPlayer) => {
    const leftValue = skillValueForPlayer(left, "SetPiecesSkill") ?? -1;
    const rightValue = skillValueForPlayer(right, "SetPiecesSkill") ?? -1;
    if (leftValue !== rightValue) return leftValue - rightValue;
    return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
      formatPlayerName(right) || String(right.PlayerID)
    );
  };

  const comparePlayersBySetPiecesDescending = (left: SeniorPlayer, right: SeniorPlayer) =>
    comparePlayersBySetPiecesAscending(right, left);

  const compareKeeperTrainees = (left: SeniorPlayer, right: SeniorPlayer) => {
    const leftKeeping = skillValueForPlayer(left, "KeeperSkill") ?? -1;
    const rightKeeping = skillValueForPlayer(right, "KeeperSkill") ?? -1;
    if (rightKeeping !== leftKeeping) return rightKeeping - leftKeeping;
    const leftSetPieces = skillValueForPlayer(left, "SetPiecesSkill") ?? -1;
    const rightSetPieces = skillValueForPlayer(right, "SetPiecesSkill") ?? -1;
    if (rightSetPieces !== leftSetPieces) return rightSetPieces - leftSetPieces;
    const leftAverage = averageSkillLevelForPlayer(left);
    const rightAverage = averageSkillLevelForPlayer(right);
    if (rightAverage !== leftAverage) return rightAverage - leftAverage;
    return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
      formatPlayerName(right) || String(right.PlayerID)
    );
  };

  const comparePlayersBySkillDescending = (
    left: SeniorPlayer,
    right: SeniorPlayer,
    key: (typeof SKILL_KEYS)[number]
  ) => {
    const leftValue = skillValueForPlayer(left, key) ?? -1;
    const rightValue = skillValueForPlayer(right, key) ?? -1;
    if (rightValue !== leftValue) return rightValue - leftValue;
    const leftAverage = averageSkillLevelForPlayer(left);
    const rightAverage = averageSkillLevelForPlayer(right);
    if (rightAverage !== leftAverage) return rightAverage - leftAverage;
    return comparePlayersByExtraTimeMatrixOrder(left, right);
  };

  const comparePlayersByExtraTimeMatrixOrder = (left: SeniorPlayer, right: SeniorPlayer) => {
    const leftIndex = extraTimeSelectablePlayerIds.indexOf(left.PlayerID);
    const rightIndex = extraTimeSelectablePlayerIds.indexOf(right.PlayerID);
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
      formatPlayerName(right) || String(right.PlayerID)
    );
  };

  const buildExtraTimeSetPiecesSetup = (onFieldPlayers: SeniorPlayer[]) => {
    const setPiecesOrdered = [...onFieldPlayers].sort(comparePlayersBySetPiecesAscending);
    const setPiecesPlayer = setPiecesOrdered[0] ?? null;
    const kickerIds = [
      setPiecesPlayer?.PlayerID ?? 0,
      ...setPiecesOrdered
        .filter((player) => player.PlayerID !== setPiecesPlayer?.PlayerID)
        .sort((left, right) => comparePlayersBySetPiecesAscending(right, left))
        .map((player) => player.PlayerID),
    ].slice(0, 11);
    while (kickerIds.length < 11) kickerIds.push(0);
    return {
      kickerIds,
      setPiecesPlayerId: setPiecesPlayer?.PlayerID ?? 0,
    };
  };

  const buildSetPiecesExtraTimeSetup = (onFieldPlayers: SeniorPlayer[]) => {
    const setPiecesOrderedAscending = [...onFieldPlayers].sort(comparePlayersBySetPiecesAscending);
    const setPiecesOrderedDescending = [...onFieldPlayers].sort(comparePlayersBySetPiecesDescending);
    const worstSetPiecesPlayer = setPiecesOrderedAscending[0] ?? null;
    const bestSetPiecesPlayer = setPiecesOrderedDescending[0] ?? null;
    const kickerIds = [
      worstSetPiecesPlayer?.PlayerID ?? 0,
      ...setPiecesOrderedDescending
        .filter((player) => player.PlayerID !== worstSetPiecesPlayer?.PlayerID)
        .map((player) => player.PlayerID),
    ].slice(0, 11);
    while (kickerIds.length < 11) kickerIds.push(0);
    return {
      kickerIds,
      setPiecesPlayerId: bestSetPiecesPlayer?.PlayerID ?? 0,
    };
  };

  const buildExtraTimeSlotPicker = (ratingsById: Record<number, Record<string, number>>) => {
    const ratingForSlot = (playerId: number, slot: keyof LineupAssignments) =>
      typeof ratingsById[playerId]?.[String(SLOT_TO_RATING_CODE[slot])] === "number"
        ? (ratingsById[playerId]?.[String(SLOT_TO_RATING_CODE[slot])] as number)
        : -1;
    const overallFallback = (player: SeniorPlayer) => averageSkillLevelForPlayer(player);
    const pickBestForSlot = (candidates: SeniorPlayer[], slot: keyof LineupAssignments) => {
      const sorted = [...candidates].sort((left, right) => {
        const leftRating = ratingForSlot(left.PlayerID, slot);
        const rightRating = ratingForSlot(right.PlayerID, slot);
        if (rightRating !== leftRating) return rightRating - leftRating;
        const leftFallback = overallFallback(left);
        const rightFallback = overallFallback(right);
        if (rightFallback !== leftFallback) return rightFallback - leftFallback;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      });
      return sorted[0] ?? null;
    };
    return { ratingForSlot, overallFallback, pickBestForSlot };
  };

  const seniorAiInjuryLevelForPlayer = (player: SeniorPlayer) => {
    const details = detailsById.get(player.PlayerID);
    return typeof details?.InjuryLevel === "number"
      ? details.InjuryLevel
      : typeof player.InjuryLevel === "number"
        ? player.InjuryLevel
        : null;
  };

  const isSeniorAiEligiblePlayer = (player: SeniorPlayer) => {
    const injuryLevel = seniorAiInjuryLevelForPlayer(player);
    return typeof injuryLevel !== "number" || injuryLevel < 1;
  };

  const isSeniorExtraTimePoolEligiblePlayer = (player: SeniorPlayer) =>
    isSeniorAiEligiblePlayer(player) &&
    extraTimeAvailablePlayerIdSet.has(player.PlayerID);

  const getExtraTimeEligibleNonTrainees = (
    traineeIds: number[],
    options?: {
      excludedFieldPlayerIds?: Set<number>;
      excludeOnlyFromField?: boolean;
    }
  ) =>
    players
      .filter((player) => !traineeIds.includes(player.PlayerID))
      .filter((player) => {
        if (!isSeniorExtraTimePoolEligiblePlayer(player)) return false;
        if (
          !options?.excludeOnlyFromField &&
          options?.excludedFieldPlayerIds?.has(player.PlayerID)
        ) {
          return false;
        }
        return true;
      });

  const ensureExtraTimeRatingsById = async () => {
    let nextRatingsById = ratingsByPlayerId;
    if (!hasUsableSeniorRatingsMatrix(ratingsResponse)) {
      const currentSeason = await fetchCurrentSeason();
      const refreshedRatings = stampSeniorRatingsAlgorithmVersion(
        await bootstrapRatingsFromSeasons(resolvedSeniorTeamId, currentSeason)
      );
      setRatingsResponse(refreshedRatings);
      nextRatingsById = {};
      (refreshedRatings.players ?? []).forEach((row) => {
        nextRatingsById[row.id] = { ...row.ratings };
      });
    }
    return nextRatingsById;
  };

  const resolveExtraTimeMatchContext = async (matchId: number) => {
    const selectedMatch = allMatches.find((match) => match.MatchID === matchId);
    if (!selectedMatch) {
      throw new Error(messages.unableToLoadMatches);
    }
    const selectedMatchType = Number.isFinite(Number(selectedMatch.MatchType))
      ? Number(selectedMatch.MatchType)
      : null;
    return {
      selectedMatchType,
    };
  };

  const buildForcedKeeperExtraTimeResult = async (
    traineeIds: number[],
    options?: {
      selectedMatchType?: number | null;
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const trainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    if (trainees.length !== 2) {
      throw new Error(messages.submitOrdersError);
    }

    const ratingsById = await ensureExtraTimeRatingsById();

    const isLeagueCupTarget =
      typeof options?.selectedMatchType === "number" &&
      LEAGUE_CUP_QUALI_MATCH_TYPES.has(options.selectedMatchType);
    const orderedSlots = ["KP", ...DEFENSE_SLOTS, ...MIDFIELD_SLOTS];
    const playerPool = players
      .map((player) => {
        const details = detailsById.get(player.PlayerID);
        const cardsValue =
          typeof details?.Cards === "number"
            ? details.Cards
            : typeof player.Cards === "number"
              ? player.Cards
              : null;
        const injuryLevel =
          typeof details?.InjuryLevel === "number"
            ? details.InjuryLevel
            : typeof player.InjuryLevel === "number"
              ? player.InjuryLevel
              : null;
        return { player, cardsValue, injuryLevel };
      })
      .filter(({ player, cardsValue, injuryLevel }) => {
        if (
          !isSeniorExtraTimePoolEligiblePlayer(player) &&
          !traineeIds.includes(player.PlayerID)
        ) {
          return false;
        }
        if (typeof injuryLevel === "number" && injuryLevel >= 1) return false;
        if (
          options?.excludedFieldPlayerIds?.has(player.PlayerID) &&
          !traineeIds.includes(player.PlayerID)
        ) {
          return false;
        }
        if (
          isLeagueCupTarget &&
          typeof cardsValue === "number" &&
          cardsValue >= 3 &&
          !traineeIds.includes(player.PlayerID)
        ) {
          return false;
        }
        return true;
      })
      .map(({ player }) => ({
        id: player.PlayerID,
        name: formatPlayerName(player) || String(player.PlayerID),
      }));

    const keeperTrainee = [...trainees].sort(compareKeeperTrainees)[0] ?? null;
    const fieldTrainee =
      trainees.find((player) => player.PlayerID !== keeperTrainee?.PlayerID) ?? null;
    if (!keeperTrainee || !fieldTrainee) {
      throw new Error(messages.submitOrdersError);
    }

    const ratingFor = (playerId: number, code: number) =>
      typeof ratingsById[playerId]?.[String(code)] === "number"
        ? (ratingsById[playerId]?.[String(code)] as number)
        : -1;
    const bestInSector = (playerId: number, sector: PlayerSector) =>
      Math.max(...SECTOR_TO_RATING_CODES[sector].map((code) => ratingFor(playerId, code)));

    const assignmentsForFormation: LineupAssignments = { KP: keeperTrainee.PlayerID };
    const bestFieldSlot =
      orderedSlots
        .filter((slot) => slot !== "KP")
        .sort((left, right) => {
          const leftRating = ratingFor(fieldTrainee.PlayerID, SLOT_TO_RATING_CODE[left]);
          const rightRating = ratingFor(fieldTrainee.PlayerID, SLOT_TO_RATING_CODE[right]);
          if (rightRating !== leftRating) return rightRating - leftRating;
          return orderedSlots.indexOf(left) - orderedSlots.indexOf(right);
        })[0] ?? "CD_C";
    assignmentsForFormation[bestFieldSlot] = fieldTrainee.PlayerID;

    const availablePlayers = playerPool.filter(
      (candidate) =>
        candidate.id !== keeperTrainee.PlayerID && candidate.id !== fieldTrainee.PlayerID
    );

    orderedSlots.forEach((slot) => {
      if (assignmentsForFormation[slot]) return;
      const roleCode = SLOT_TO_RATING_CODE[slot];
      const slotSector = SLOT_TO_SECTOR[slot];
      availablePlayers.sort((left, right) => {
        const leftRating = ratingFor(left.id, roleCode);
        const rightRating = ratingFor(right.id, roleCode);
        if (rightRating !== leftRating) return rightRating - leftRating;
        return left.name.localeCompare(right.name);
      });
      const selectedIndex = availablePlayers.findIndex((candidate) => {
        const slotRating = ratingFor(candidate.id, roleCode);
        if (slotRating < 0) return false;
        const bestOtherSector = (Object.keys(SECTOR_TO_RATING_CODES) as PlayerSector[])
          .filter((sector) => sector !== slotSector)
          .reduce((best, sector) => Math.max(best, bestInSector(candidate.id, sector)), -1);
        return bestOtherSector < slotRating;
      });
      const selectedPlayer =
        selectedIndex >= 0 ? (availablePlayers.splice(selectedIndex, 1)[0] ?? null) : null;
      const fallbackPlayer = selectedPlayer ?? availablePlayers.shift() ?? null;
      if (!fallbackPlayer) return;
      assignmentsForFormation[slot] = fallbackPlayer.id;
    });

    if (orderedSlots.some((slot) => !assignmentsForFormation[slot])) {
      throw new Error(messages.submitOrdersMinPlayers);
    }

    const fieldPlayerIds = new Set<number>(
      orderedSlots
        .map((slot) => assignmentsForFormation[slot])
        .filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0)
    );
    const benchIds = playerPool
      .map((candidate) => candidate.id)
      .filter((playerId) => !fieldPlayerIds.has(playerId))
      .slice(0, BENCH_SLOT_ORDER.length);
    const resultAssignments: LineupAssignments = { ...assignmentsForFormation };
    BENCH_SLOT_ORDER.forEach((slot, index) => {
      resultAssignments[slot] = benchIds[index] ?? null;
    });

    return {
      assignments: resultAssignments,
      fieldPlayerIds,
      keeperTraineeId: keeperTrainee.PlayerID,
      fieldTraineeId: fieldTrainee.PlayerID,
    };
  };

  const buildPreparedExtraTimeSubmitPayload = (
    matchId: number,
    defaultPayload: ReturnType<typeof buildLineupPayload>
  ) => {
    if (!extraTimePreparedSubmission || extraTimePreparedSubmission.matchId !== matchId) {
      return defaultPayload;
    }
    const onFieldPlayerIds = FIELD_SLOT_ORDER.map((slot) => assignments[slot]).filter(
      (playerId): playerId is number => typeof playerId === "number" && playerId > 0
    );
    if (onFieldPlayerIds.length < 11) {
      throw new Error(messages.submitOrdersMinPlayers);
    }
    const requiredAssignedTraineeIds =
      extraTimePreparedSubmission.trainingType === 7
        ? [
            ...onFieldPlayerIds,
            assignments.B_IM,
            assignments.B_F,
          ].filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0)
        : extraTimePreparedSubmission.trainingType === 6
          ? [
              ...onFieldPlayerIds,
              assignments.B_GK,
              assignments.B_CD,
              assignments.B_WB,
              assignments.B_IM,
              assignments.B_W,
            ].filter(
              (playerId): playerId is number =>
                typeof playerId === "number" && playerId > 0
            )
        : extraTimePreparedSubmission.trainingType === 10
          ? [
              ...onFieldPlayerIds,
              assignments.B_CD,
              assignments.B_WB,
              assignments.B_IM,
            ].filter(
              (playerId): playerId is number =>
                typeof playerId === "number" && playerId > 0
            )
        : extraTimePreparedSubmission.trainingType === 2
          ? [...onFieldPlayerIds, assignments.B_GK, assignments.B_X].filter(
              (playerId): playerId is number =>
                typeof playerId === "number" && playerId > 0
            )
        : extraTimePreparedSubmission.trainingType === 4
          ? onFieldPlayerIds
        : extraTimePreparedSubmission.trainingType === 8
          ? [...onFieldPlayerIds, assignments.B_IM].filter(
              (playerId): playerId is number =>
                typeof playerId === "number" && playerId > 0
            )
        : extraTimePreparedSubmission.trainingType === 11
          ? [
              ...onFieldPlayerIds,
              assignments.B_GK,
              assignments.B_CD,
              assignments.B_WB,
            ].filter(
              (playerId): playerId is number =>
                typeof playerId === "number" && playerId > 0
            )
        : onFieldPlayerIds;
    if (
      extraTimePreparedSubmission.traineeIds.some(
        (playerId) => !requiredAssignedTraineeIds.includes(playerId)
      )
    ) {
      throw new Error(messages.submitOrdersError);
    }
    const onFieldPlayers = onFieldPlayerIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    const { kickerIds, setPiecesPlayerId } =
      extraTimePreparedSubmission.trainingType === 2
        ? buildSetPiecesExtraTimeSetup(onFieldPlayers)
        : buildExtraTimeSetPiecesSetup(onFieldPlayers);
    const benchIds = BENCH_SLOT_ORDER.map((slot) => {
      const playerId = assignments[slot];
      return typeof playerId === "number" ? playerId : 0;
    });
    const forcedBehaviors: Partial<Record<(typeof FIELD_SLOT_ORDER)[number], number>> =
      extraTimePreparedSubmission.trainingType === 7
        ? {
            ...behaviors,
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
            F_L: 2,
            F_C: 2,
            F_R: 2,
          }
        : extraTimePreparedSubmission.trainingType === 12
          ? {
              ...behaviors,
              WB_L: 2,
              WB_R: 2,
              W_L: 2,
              IM_L: 2,
              IM_C: 2,
              IM_R: 2,
              W_R: 2,
              F_L: 2,
              F_C: 2,
              F_R: 2,
            }
        : {
            ...behaviors,
            WB_L: 2,
            WB_R: 2,
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
          };
    const buildSevenTraineeRotationPayload = (orderedTraineeIds: number[]) => {
      const [
        trainee1Id,
        trainee2Id,
        trainee3Id,
        trainee4Id,
        trainee5Id,
        trainee6Id,
        trainee7Id,
      ] = orderedTraineeIds;
      if (
        [trainee1Id, trainee2Id, trainee3Id, trainee4Id, trainee5Id, trainee6Id, trainee7Id].some(
          (playerId) => typeof playerId !== "number" || playerId <= 0
        )
      ) {
        throw new Error(messages.submitOrdersError);
      }

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: trainee1Id as number,
            playerout: trainee6Id as number,
            orderType: 3,
            min: 30,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee1Id as number,
            playerout: trainee2Id as number,
            orderType: 3,
            min: 60,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee3Id as number,
            playerout: trainee7Id as number,
            orderType: 3,
            min: 60,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee4Id as number,
            playerout: trainee2Id as number,
            orderType: 3,
            min: 90,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee5Id as number,
            playerout: trainee3Id as number,
            orderType: 3,
            min: 90,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
        ],
      });
    };
    if (extraTimePreparedSubmission.trainingType === 7) {
      const keeperId = assignments.KP;
      const leftCenterBackId = assignments.CD_L;
      const rightCenterBackId = assignments.CD_R;
      const leftForwardId = assignments.F_L;
      const centerForwardId = assignments.F_C;
      const rightForwardId = assignments.F_R;
      const benchMidId = assignments.B_IM;
      const benchForwardId = assignments.B_F;
      const leftMidId = assignments.IM_L;
      const rightMidId = assignments.IM_R;
      const requiredIds = [
        keeperId,
        leftCenterBackId,
        rightCenterBackId,
        leftForwardId,
        centerForwardId,
        rightForwardId,
        benchMidId,
        benchForwardId,
        leftMidId,
        rightMidId,
      ];
      if (
        requiredIds.some((playerId) => typeof playerId !== "number" || playerId <= 0)
      ) {
        throw new Error(messages.submitOrdersError);
      }

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: keeperId as number,
            playerout: centerForwardId as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
          {
            playerin: leftCenterBackId as number,
            playerout: leftForwardId as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
          {
            playerin: rightCenterBackId as number,
            playerout: rightForwardId as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
          {
            playerin: benchMidId as number,
            playerout: leftMidId as number,
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
          {
            playerin: benchForwardId as number,
            playerout: rightMidId as number,
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
        ],
      });
    }
    if (extraTimePreparedSubmission.trainingType === 6) {
      const benchKeeperId = assignments.B_GK;
      const chooseSwapTarget = (
        incomingPlayerId: number,
        candidateSlots: Array<(typeof FIELD_SLOT_ORDER)[number]>
      ) => {
        const selectedSlot = [...candidateSlots].sort((left, right) => {
          const leftRating =
            typeof ratingsByPlayerId[incomingPlayerId]?.[String(SLOT_TO_RATING_CODE[left])] ===
            "number"
              ? (ratingsByPlayerId[incomingPlayerId]?.[
                  String(SLOT_TO_RATING_CODE[left])
                ] as number)
              : -1;
          const rightRating =
            typeof ratingsByPlayerId[incomingPlayerId]?.[String(SLOT_TO_RATING_CODE[right])] ===
            "number"
              ? (ratingsByPlayerId[incomingPlayerId]?.[
                  String(SLOT_TO_RATING_CODE[right])
                ] as number)
              : -1;
          if (rightRating !== leftRating) return rightRating - leftRating;
          return FIELD_SLOT_ORDER.indexOf(left) - FIELD_SLOT_ORDER.indexOf(right);
        })[0];
        const playerOutId = selectedSlot ? assignments[selectedSlot] : null;
        if (typeof playerOutId !== "number" || playerOutId <= 0) {
          throw new Error(messages.submitOrdersError);
        }
        return playerOutId;
      };
      const substitutions: MatchOrderSubstitution[] = [];
      if (typeof benchKeeperId === "number" && benchKeeperId > 0) {
        const keeperId = assignments.KP;
        if (typeof keeperId !== "number" || keeperId <= 0) {
          throw new Error(messages.submitOrdersError);
        }
        substitutions.push({
          playerin: benchKeeperId,
          playerout: keeperId,
          orderType: 1,
          min: 89,
          pos: -1,
          beh: -1,
          card: -1,
          standing: -1,
        });
      }
      const traineeBenchMappings = [
        {
          benchSlot: "B_CD",
          candidateSlots: ["CD_L", "CD_C", "CD_R"] as Array<(typeof FIELD_SLOT_ORDER)[number]>,
        },
        {
          benchSlot: "B_WB",
          candidateSlots: ["WB_L", "WB_R"] as Array<(typeof FIELD_SLOT_ORDER)[number]>,
        },
        {
          benchSlot: "B_IM",
          candidateSlots: ["IM_L", "IM_C", "IM_R"] as Array<(typeof FIELD_SLOT_ORDER)[number]>,
        },
        {
          benchSlot: "B_W",
          candidateSlots: ["W_L", "W_R"] as Array<(typeof FIELD_SLOT_ORDER)[number]>,
        },
      ] as const;
      traineeBenchMappings.forEach(({ benchSlot, candidateSlots }) => {
        const playerInId = assignments[benchSlot];
        if (
          typeof playerInId !== "number" ||
          playerInId <= 0 ||
          !extraTimePreparedSubmission.traineeIds.includes(playerInId)
        ) {
          return;
        }
        substitutions.push({
          playerin: playerInId,
          playerout: chooseSwapTarget(playerInId, candidateSlots),
          orderType: 1,
          min: 89,
          pos: -1,
          beh: -1,
          card: -1,
          standing: -1,
        });
      });
      if (substitutions.length !== 3) {
        throw new Error(messages.submitOrdersError);
      }

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions,
      });
    }
    if (extraTimePreparedSubmission.trainingType === 10) {
      const benchCenterDefenderId = assignments.B_CD;
      const benchWingBackId = assignments.B_WB;
      const benchMidId = assignments.B_IM;
      if (
        [benchCenterDefenderId, benchWingBackId, benchMidId].some(
          (playerId) => typeof playerId !== "number" || playerId <= 0
        )
      ) {
        throw new Error(messages.submitOrdersError);
      }

      const chooseSwapTarget = (
        incomingPlayerId: number,
        candidateSlots: Array<(typeof FIELD_SLOT_ORDER)[number]>
      ) => {
        const selectedSlot = [...candidateSlots].sort((left, right) => {
          const leftRating =
            typeof ratingsByPlayerId[incomingPlayerId]?.[String(SLOT_TO_RATING_CODE[left])] ===
            "number"
              ? (ratingsByPlayerId[incomingPlayerId]?.[
                  String(SLOT_TO_RATING_CODE[left])
                ] as number)
              : -1;
          const rightRating =
            typeof ratingsByPlayerId[incomingPlayerId]?.[String(SLOT_TO_RATING_CODE[right])] ===
            "number"
              ? (ratingsByPlayerId[incomingPlayerId]?.[
                  String(SLOT_TO_RATING_CODE[right])
                ] as number)
              : -1;
          if (rightRating !== leftRating) return rightRating - leftRating;
          return FIELD_SLOT_ORDER.indexOf(left) - FIELD_SLOT_ORDER.indexOf(right);
        })[0];
        const playerOutId = selectedSlot ? assignments[selectedSlot] : null;
        if (typeof playerOutId !== "number" || playerOutId <= 0) {
          throw new Error(messages.submitOrdersError);
        }
        return playerOutId;
      };

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: benchCenterDefenderId as number,
            playerout: chooseSwapTarget(benchCenterDefenderId as number, [
              "CD_L",
              "CD_C",
              "CD_R",
            ]),
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: benchMidId as number,
            playerout: chooseSwapTarget(benchMidId as number, ["IM_L", "IM_C", "IM_R"]),
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: benchWingBackId as number,
            playerout: chooseSwapTarget(benchWingBackId as number, ["WB_L", "WB_R"]),
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
        ],
      });
    }
    if (extraTimePreparedSubmission.trainingType === 2) {
      const keeperId = assignments.KP;
      const benchKeeperId = assignments.B_GK;
      const extraBenchSetPiecesId = assignments.B_X;
      if (
        [keeperId, benchKeeperId, extraBenchSetPiecesId, setPiecesPlayerId].some(
          (playerId) => typeof playerId !== "number" || playerId <= 0
        )
      ) {
        throw new Error(messages.submitOrdersError);
      }

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: benchKeeperId as number,
            playerout: keeperId as number,
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: extraBenchSetPiecesId as number,
            playerout: setPiecesPlayerId as number,
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
        ],
      });
    }
    if (extraTimePreparedSubmission.trainingType === 4) {
      const numberedTraineeIds = (
        extraTimePreparedSubmission.scoringRoleIds?.length === 4
          ? extraTimePreparedSubmission.scoringRoleIds
          : extraTimePreparedSubmission.traineeIds
      ).slice(0, 4);
      const [trainee1Id, trainee2Id, trainee3Id, trainee4Id] = numberedTraineeIds;
      if (
        [trainee1Id, trainee2Id, trainee3Id, trainee4Id].some(
          (playerId) => typeof playerId !== "number" || playerId <= 0
        )
      ) {
        throw new Error(messages.submitOrdersError);
      }

      return buildLineupPayload(assignments, 1, {
        behaviors: {
          ...forcedBehaviors,
          F_L: 2,
          F_C: 2,
          F_R: 2,
        },
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: trainee3Id as number,
            playerout: trainee4Id as number,
            orderType: 3,
            min: 30,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee2Id as number,
            playerout: trainee3Id as number,
            orderType: 3,
            min: 60,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee1Id as number,
            playerout: trainee2Id as number,
            orderType: 3,
            min: 90,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
        ],
      });
    }
    if (extraTimePreparedSubmission.trainingType === 3) {
      const orderedTraineeIds = extraTimePreparedSubmission.traineeIds
        .map((playerId) => playersById.get(playerId) ?? null)
        .filter((player): player is SeniorPlayer => Boolean(player))
        .sort(comparePlayersByExtraTimeMatrixOrder)
        .map((player) => player.PlayerID);
      return buildSevenTraineeRotationPayload(orderedTraineeIds);
    }
    if (extraTimePreparedSubmission.trainingType === 12) {
      const orderedTraineeIds = (
        extraTimePreparedSubmission.wingerAttackerRoleIds?.length === 7
          ? extraTimePreparedSubmission.wingerAttackerRoleIds
          : extraTimePreparedSubmission.traineeIds
              .map((playerId) => playersById.get(playerId) ?? null)
              .filter((player): player is SeniorPlayer => Boolean(player))
              .sort((left, right) =>
                comparePlayersBySkillDescending(left, right, "WingerSkill")
              )
              .map((player) => player.PlayerID)
      ).slice(0, 7);
      return buildSevenTraineeRotationPayload(orderedTraineeIds);
    }
    if (extraTimePreparedSubmission.trainingType === 8) {
      const orderedTraineeIds = extraTimePreparedSubmission.traineeIds
        .map((playerId) => playersById.get(playerId) ?? null)
        .filter((player): player is SeniorPlayer => Boolean(player))
        .sort(comparePlayersByExtraTimeMatrixOrder)
        .map((player) => player.PlayerID);
      const [
        trainee1Id,
        trainee2Id,
        trainee3Id,
        trainee4Id,
        trainee5Id,
        trainee6Id,
        trainee7Id,
        trainee8Id,
      ] = orderedTraineeIds;
      const benchMidId = assignments.B_IM;
      const centerMidId = assignments.IM_C;
      if (
        [
          trainee1Id,
          trainee2Id,
          trainee3Id,
          trainee4Id,
          trainee5Id,
          trainee6Id,
          trainee7Id,
          trainee8Id,
          benchMidId,
          centerMidId,
        ].some((playerId) => typeof playerId !== "number" || playerId <= 0)
      ) {
        throw new Error(messages.submitOrdersError);
      }

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: trainee1Id as number,
            playerout: trainee2Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee2Id as number,
            playerout: trainee6Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee5Id as number,
            playerout: trainee4Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee4Id as number,
            playerout: trainee7Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: benchMidId as number,
            playerout: centerMidId as number,
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
        ],
      });
    }
    if (extraTimePreparedSubmission.trainingType === 5) {
      const orderedTraineeIds = (
        extraTimePreparedSubmission.wingerRoleIds?.length === 6
          ? extraTimePreparedSubmission.wingerRoleIds
          : extraTimePreparedSubmission.traineeIds
              .map((playerId) => playersById.get(playerId) ?? null)
              .filter((player): player is SeniorPlayer => Boolean(player))
              .sort(comparePlayersByExtraTimeMatrixOrder)
              .map((player) => player.PlayerID)
      ).slice(0, 6);
      const [trainee1Id, trainee2Id, trainee3Id, trainee4Id, trainee5Id, trainee6Id] =
        orderedTraineeIds;
      if (
        [trainee1Id, trainee2Id, trainee3Id, trainee4Id, trainee5Id, trainee6Id].some(
          (playerId) => typeof playerId !== "number" || playerId <= 0
        )
      ) {
        throw new Error(messages.submitOrdersError);
      }

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: trainee1Id as number,
            playerout: trainee3Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
          {
            playerin: trainee2Id as number,
            playerout: trainee4Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
          {
            playerin: trainee1Id as number,
            playerout: trainee5Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
          {
            playerin: trainee2Id as number,
            playerout: trainee6Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: 0,
          },
        ],
      });
    }
    if (extraTimePreparedSubmission.trainingType === 11) {
      const benchCenterDefenderId = assignments.B_CD;
      const benchWingBackId = assignments.B_WB;
      if (
        [benchCenterDefenderId, benchWingBackId].some(
          (playerId) => typeof playerId !== "number" || playerId <= 0
        )
      ) {
        throw new Error(messages.submitOrdersError);
      }

      const chooseSwapTarget = (
        incomingPlayerId: number,
        candidateSlots: Array<(typeof FIELD_SLOT_ORDER)[number]>
      ) => {
        const selectedSlot = [...candidateSlots].sort((left, right) => {
          const leftRating =
            typeof ratingsByPlayerId[incomingPlayerId]?.[String(SLOT_TO_RATING_CODE[left])] ===
            "number"
              ? (ratingsByPlayerId[incomingPlayerId]?.[
                  String(SLOT_TO_RATING_CODE[left])
                ] as number)
              : -1;
          const rightRating =
            typeof ratingsByPlayerId[incomingPlayerId]?.[String(SLOT_TO_RATING_CODE[right])] ===
            "number"
              ? (ratingsByPlayerId[incomingPlayerId]?.[
                  String(SLOT_TO_RATING_CODE[right])
                ] as number)
              : -1;
          if (rightRating !== leftRating) return rightRating - leftRating;
          return FIELD_SLOT_ORDER.indexOf(left) - FIELD_SLOT_ORDER.indexOf(right);
        })[0];
        const playerOutId = selectedSlot ? assignments[selectedSlot] : null;
        if (typeof playerOutId !== "number" || playerOutId <= 0) {
          throw new Error(messages.submitOrdersError);
        }
        return playerOutId;
      };

      return buildLineupPayload(assignments, 1, {
        behaviors: forcedBehaviors,
        benchIds,
        kickerIds,
        captainId: 0,
        setPiecesId: setPiecesPlayerId,
        substitutions: [
          {
            playerin: benchCenterDefenderId as number,
            playerout: chooseSwapTarget(benchCenterDefenderId as number, [
              "CD_L",
              "CD_C",
              "CD_R",
            ]),
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: benchWingBackId as number,
            playerout: chooseSwapTarget(benchWingBackId as number, ["WB_L", "WB_R"]),
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
        ],
      });
    }
    return buildLineupPayload(assignments, 1, {
      behaviors: forcedBehaviors,
      benchIds,
      kickerIds,
      captainId: 0,
      setPiecesId: setPiecesPlayerId,
      substitutions: [
        {
          playerin: extraTimePreparedSubmission.traineeIds[0] ?? 0,
          playerout: extraTimePreparedSubmission.traineeIds[1] ?? 0,
          orderType: 3,
          min: 89,
          pos: -1,
          beh: -1,
          card: -1,
          standing: 0,
        },
      ],
    });
  };

  const buildPassingExtraTimeResult = async (traineeIds: number[]) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const orderedTrainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player))
      .sort(comparePlayersByExtraTimeMatrixOrder);
    if (orderedTrainees.length !== 13) {
      throw new Error(messages.submitOrdersError);
    }

    const rowTrainees = orderedTrainees.slice(0, 8);
    const defensiveTrainees = orderedTrainees.slice(8, 11);
    const benchTrainees = orderedTrainees.slice(11, 13);
    const assignmentsForFormation: LineupAssignments = {};
    const ratingForSlot = (playerId: number, slot: keyof LineupAssignments) =>
      typeof ratingsById[playerId]?.[String(SLOT_TO_RATING_CODE[slot])] === "number"
        ? (ratingsById[playerId]?.[String(SLOT_TO_RATING_CODE[slot])] as number)
        : -1;
    const overallFallback = (player: SeniorPlayer) => averageSkillLevelForPlayer(player);
    const pickBestForSlot = (
      candidates: SeniorPlayer[],
      slot: keyof LineupAssignments
    ) => {
      const sorted = [...candidates].sort((left, right) => {
        const leftRating = ratingForSlot(left.PlayerID, slot);
        const rightRating = ratingForSlot(right.PlayerID, slot);
        if (rightRating !== leftRating) return rightRating - leftRating;
        const leftFallback = overallFallback(left);
        const rightFallback = overallFallback(right);
        if (rightFallback !== leftFallback) return rightFallback - leftFallback;
        return comparePlayersByExtraTimeMatrixOrder(left, right);
      });
      return sorted[0] ?? null;
    };
    const assignSlotFromPool = (
      pool: SeniorPlayer[],
      slot: keyof LineupAssignments
    ) => {
      const selected = pickBestForSlot(pool, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      return pool.filter((player) => player.PlayerID !== selected.PlayerID);
    };

    let remainingRowTrainees = [...rowTrainees];
    const trainedSlots = [
      ...MIDFIELD_SLOTS,
      ...ATTACK_SLOTS,
    ] as Array<(typeof MIDFIELD_SLOTS)[number] | (typeof ATTACK_SLOTS)[number]>;
    trainedSlots.forEach((slot) => {
      remainingRowTrainees = assignSlotFromPool(remainingRowTrainees, slot);
    });

    let remainingDefensiveTrainees = [...defensiveTrainees];
    (["KP", "CD_L", "CD_R"] as const).forEach((slot) => {
      remainingDefensiveTrainees = assignSlotFromPool(remainingDefensiveTrainees, slot);
    });

    assignmentsForFormation.B_IM = benchTrainees[0]?.PlayerID ?? null;
    assignmentsForFormation.B_F = benchTrainees[1]?.PlayerID ?? null;
    if (!assignmentsForFormation.B_IM || !assignmentsForFormation.B_F) {
      throw new Error(messages.submitOrdersError);
    }

    let benchCandidatePool = players
      .filter((player) => !traineeIds.includes(player.PlayerID))
      .filter((player) => isSeniorExtraTimePoolEligiblePlayer(player));
    const benchSlotToFieldSlot = {
      B_GK: "KP",
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(benchCandidatePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        benchCandidatePool = benchCandidatePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });
    const extraBenchPlayer =
      [...benchCandidatePool].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
    };
  };

  const buildExtendedPassingExtraTimeResult = async (
    traineeIds: number[],
    options?: {
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const trainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    if (trainees.length !== 13) {
      throw new Error(messages.submitOrdersError);
    }

    const assignmentsForFormation: LineupAssignments = {};
    const { overallFallback, pickBestForSlot, ratingForSlot } =
      buildExtraTimeSlotPicker(ratingsById);
    const orderedByPassing = [...trainees].sort((left, right) =>
      comparePlayersBySkillDescending(left, right, "PassingSkill")
    );
    const fieldTrainees = orderedByPassing.slice(0, 10);
    const benchTrainees = orderedByPassing.slice(10, 13);
    if (fieldTrainees.length !== 10 || benchTrainees.length !== 3) {
      throw new Error(messages.submitOrdersError);
    }

    const solveBestAssignment = <
      Slot extends keyof LineupAssignments,
      Candidate extends SeniorPlayer,
    >(
      candidates: Candidate[],
      slots: readonly Slot[],
      slotRatingSlot: (slot: Slot) => keyof LineupAssignments
    ) => {
      if (candidates.length !== slots.length || candidates.length === 0) {
        throw new Error(messages.submitOrdersError);
      }
      const memo = new Map<number, { totalRating: number; slotByPlayerId: Map<number, Slot> }>();
      const solve = (slotIndex: number, usedMask: number) => {
        if (slotIndex >= slots.length) {
          return {
            totalRating: 0,
            slotByPlayerId: new Map<number, Slot>(),
          };
        }
        if (memo.has(usedMask)) {
          return memo.get(usedMask) as { totalRating: number; slotByPlayerId: Map<number, Slot> };
        }
        const slot = slots[slotIndex];
        let best:
          | {
              totalRating: number;
              slotByPlayerId: Map<number, Slot>;
            }
          | null = null;

        candidates.forEach((candidate, candidateIndex) => {
          if (usedMask & (1 << candidateIndex)) return;
          const next = solve(slotIndex + 1, usedMask | (1 << candidateIndex));
          const totalRating =
            ratingForSlot(candidate.PlayerID, slotRatingSlot(slot)) + next.totalRating;
          const slotByPlayerId = new Map(next.slotByPlayerId);
          slotByPlayerId.set(candidate.PlayerID, slot);
          const candidateResult = {
            totalRating,
            slotByPlayerId,
          };
          const currentBest = best;
          const bestSignature = currentBest
            ? slots
                .map((currentSlot) => {
                  const mappedPlayerId =
                    candidates.find(
                      (player) => currentBest.slotByPlayerId.get(player.PlayerID) === currentSlot
                    )?.PlayerID ?? 0;
                  return `${currentSlot}:${mappedPlayerId}`;
                })
                .join("|")
            : "";
          const candidateSignature = slots
            .map((currentSlot) => {
              const mappedPlayerId =
                candidates.find(
                  (player) => candidateResult.slotByPlayerId.get(player.PlayerID) === currentSlot
                )?.PlayerID ?? 0;
              return `${currentSlot}:${mappedPlayerId}`;
            })
            .join("|");
          if (
            !best ||
            candidateResult.totalRating > best.totalRating ||
            (candidateResult.totalRating === best.totalRating &&
              candidateSignature.localeCompare(bestSignature) < 0)
          ) {
            best = candidateResult;
          }
        });

        if (!best) {
          throw new Error(messages.submitOrdersError);
        }
        memo.set(usedMask, best);
        return best;
      };
      return solve(0, 0);
    };

    const fieldSlots = [
      "WB_L",
      "WB_R",
      "CD_L",
      "CD_C",
      "CD_R",
      "W_L",
      "W_R",
      "IM_L",
      "IM_C",
      "IM_R",
    ] as const;
    const fieldAssignments = solveBestAssignment(fieldTrainees, fieldSlots, (slot) => slot);
    fieldTrainees.forEach((player) => {
      const slot = fieldAssignments.slotByPlayerId.get(player.PlayerID);
      if (!slot) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = player.PlayerID;
    });

    const benchSlots = ["B_CD", "B_WB", "B_IM"] as const;
    const benchAssignments = solveBestAssignment(benchTrainees, benchSlots, (slot) =>
      slot === "B_CD" ? "CD_C" : slot === "B_WB" ? "WB_L" : "IM_C"
    );
    benchTrainees.forEach((player) => {
      const slot = benchAssignments.slotByPlayerId.get(player.PlayerID);
      if (!slot) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = player.PlayerID;
    });

    const fieldNonTraineePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
    const fieldKeeper = pickBestForSlot(fieldNonTraineePool, "KP");
    if (!fieldKeeper) {
      throw new Error(messages.submitOrdersMinPlayers);
    }
    assignmentsForFormation.KP = fieldKeeper.PlayerID;
    const fieldNonTraineeIds = new Set<number>([fieldKeeper.PlayerID]);

    const onFieldPlayerIds = new Set<number>(
      FIELD_SLOT_ORDER.map((slot) => assignmentsForFormation[slot]).filter(
        (playerId): playerId is number => typeof playerId === "number" && playerId > 0
      )
    );
    let benchCandidatePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
      excludeOnlyFromField: true,
    }).filter((player) => !onFieldPlayerIds.has(player.PlayerID));

    const benchKeeper = pickBestForSlot(benchCandidatePool, "KP");
    assignmentsForFormation.B_GK = benchKeeper?.PlayerID ?? null;
    if (benchKeeper) {
      benchCandidatePool = benchCandidatePool.filter(
        (player) => player.PlayerID !== benchKeeper.PlayerID
      );
    }

    const benchSlotToFieldSlot = {
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(benchCandidatePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        benchCandidatePool = benchCandidatePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });

    const extraBenchPlayer =
      [...benchCandidatePool].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
      fieldNonTraineeIds,
    };
  };

  const buildScoringSetPiecesExtraTimeResult = async (traineeIds: number[]) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const trainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    if (trainees.length !== 14) {
      throw new Error(messages.submitOrdersError);
    }

    const assignmentsForFormation: LineupAssignments = {};
    const { overallFallback, pickBestForSlot, ratingForSlot } =
      buildExtraTimeSlotPicker(ratingsById);
    const solveBestAssignment = <
      Slot extends keyof LineupAssignments,
      Candidate extends SeniorPlayer,
    >(
      candidates: Candidate[],
      slots: readonly Slot[],
      slotRatingSlot: (slot: Slot) => keyof LineupAssignments
    ) => {
      if (candidates.length !== slots.length || candidates.length === 0) {
        throw new Error(messages.submitOrdersError);
      }
      const memo = new Map<number, { totalRating: number; slotByPlayerId: Map<number, Slot> }>();
      const solve = (slotIndex: number, usedMask: number) => {
        if (slotIndex >= slots.length) {
          return {
            totalRating: 0,
            slotByPlayerId: new Map<number, Slot>(),
          };
        }
        if (memo.has(usedMask)) {
          return memo.get(usedMask) as { totalRating: number; slotByPlayerId: Map<number, Slot> };
        }
        const slot = slots[slotIndex];
        let best:
          | {
              totalRating: number;
              slotByPlayerId: Map<number, Slot>;
            }
          | null = null;

        candidates.forEach((candidate, candidateIndex) => {
          if (usedMask & (1 << candidateIndex)) return;
          const next = solve(slotIndex + 1, usedMask | (1 << candidateIndex));
          const totalRating =
            ratingForSlot(candidate.PlayerID, slotRatingSlot(slot)) + next.totalRating;
          const slotByPlayerId = new Map(next.slotByPlayerId);
          slotByPlayerId.set(candidate.PlayerID, slot);
          const candidateResult = {
            totalRating,
            slotByPlayerId,
          };
          const currentBest = best;
          const bestSignature = currentBest
            ? slots
                .map((currentSlot) => {
                  const mappedPlayerId =
                    candidates.find(
                      (player) => currentBest.slotByPlayerId.get(player.PlayerID) === currentSlot
                    )?.PlayerID ?? 0;
                  return `${currentSlot}:${mappedPlayerId}`;
                })
                .join("|")
            : "";
          const candidateSignature = slots
            .map((currentSlot) => {
              const mappedPlayerId =
                candidates.find(
                  (player) => candidateResult.slotByPlayerId.get(player.PlayerID) === currentSlot
                )?.PlayerID ?? 0;
              return `${currentSlot}:${mappedPlayerId}`;
            })
            .join("|");
          if (
            !best ||
            candidateResult.totalRating > best.totalRating ||
            (candidateResult.totalRating === best.totalRating &&
              candidateSignature.localeCompare(bestSignature) < 0)
          ) {
            best = candidateResult;
          }
        });

        if (!best) {
          throw new Error(messages.submitOrdersError);
        }
        memo.set(usedMask, best);
        return best;
      };
      return solve(0, 0);
    };

    const keeperCandidates = [...trainees].sort((left, right) => {
      const leftValue = ratingForSlot(left.PlayerID, "KP");
      const rightValue = ratingForSlot(right.PlayerID, "KP");
      if (rightValue !== leftValue) return rightValue - leftValue;
      return compareKeeperTrainees(left, right);
    });
    const startingKeeper = keeperCandidates[0] ?? null;
    const benchKeeper =
      keeperCandidates.find((player) => player.PlayerID !== startingKeeper?.PlayerID) ?? null;
    if (!startingKeeper || !benchKeeper) {
      throw new Error(messages.submitOrdersError);
    }
    assignmentsForFormation.KP = startingKeeper.PlayerID;
    assignmentsForFormation.B_GK = benchKeeper.PlayerID;

    const remainingAfterKeepers = trainees.filter(
      (player) =>
        player.PlayerID !== startingKeeper.PlayerID && player.PlayerID !== benchKeeper.PlayerID
    );
    const combinedScoringSetPieces = (player: SeniorPlayer) =>
      (skillValueForPlayer(player, "ScorerSkill") ?? -1) +
      (skillValueForPlayer(player, "SetPiecesSkill") ?? -1);
    const orderedByCombined = [...remainingAfterKeepers].sort((left, right) => {
      const leftValue = combinedScoringSetPieces(left);
      const rightValue = combinedScoringSetPieces(right);
      if (rightValue !== leftValue) return rightValue - leftValue;
      return comparePlayersByExtraTimeMatrixOrder(left, right);
    });

    const fieldTrainees = orderedByCombined.slice(0, 10);
    const benchTrainees = orderedByCombined.slice(10, 12);
    if (fieldTrainees.length !== 10 || benchTrainees.length !== 2) {
      throw new Error(messages.submitOrdersError);
    }

    const fieldSlots = [
      "WB_L",
      "WB_R",
      "CD_L",
      "CD_C",
      "CD_R",
      "W_L",
      "W_R",
      "IM_L",
      "IM_C",
      "IM_R",
    ] as const;
    const fieldAssignments = solveBestAssignment(fieldTrainees, fieldSlots, (slot) => slot);
    fieldTrainees.forEach((player) => {
      const slot = fieldAssignments.slotByPlayerId.get(player.PlayerID);
      if (!slot) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = player.PlayerID;
    });

    const traineeBenchSlots = ["B_CD", "B_WB", "B_IM", "B_W"] as const;
    let bestBenchAssignments:
      | {
          totalRating: number;
          slotByPlayerId: Map<number, (typeof traineeBenchSlots)[number]>;
        }
      | null = null;
    traineeBenchSlots.forEach((firstSlot) => {
      traineeBenchSlots.forEach((secondSlot) => {
        if (secondSlot === firstSlot) return;
        const slotByPlayerId = new Map<number, (typeof traineeBenchSlots)[number]>([
          [benchTrainees[0]?.PlayerID ?? 0, firstSlot],
          [benchTrainees[1]?.PlayerID ?? 0, secondSlot],
        ]);
        const totalRating =
          ratingForSlot(
            benchTrainees[0]?.PlayerID ?? 0,
            firstSlot === "B_CD"
              ? "CD_C"
              : firstSlot === "B_WB"
                ? "WB_L"
                : firstSlot === "B_IM"
                  ? "IM_C"
                  : "W_L"
          ) +
          ratingForSlot(
            benchTrainees[1]?.PlayerID ?? 0,
            secondSlot === "B_CD"
              ? "CD_C"
              : secondSlot === "B_WB"
                ? "WB_L"
                : secondSlot === "B_IM"
                  ? "IM_C"
                  : "W_L"
          );
        if (
          !bestBenchAssignments ||
          totalRating > bestBenchAssignments.totalRating ||
          (
            totalRating === bestBenchAssignments.totalRating &&
            `${firstSlot}-${secondSlot}` <
              Array.from(bestBenchAssignments.slotByPlayerId.values()).join("-")
          )
        ) {
          bestBenchAssignments = {
            totalRating,
            slotByPlayerId,
          };
        }
      });
    });
    if (!bestBenchAssignments) {
      throw new Error(messages.submitOrdersError);
    }
    const bestBenchSlotByPlayerId = (
      bestBenchAssignments as {
        totalRating: number;
        slotByPlayerId: Map<number, (typeof traineeBenchSlots)[number]>;
      }
    ).slotByPlayerId;
    benchTrainees.forEach((player) => {
      const slot = bestBenchSlotByPlayerId?.get(player.PlayerID) ?? null;
      if (!slot) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = player.PlayerID;
    });

    const onFieldPlayerIds = new Set<number>(
      FIELD_SLOT_ORDER.map((slot) => assignmentsForFormation[slot]).filter(
        (playerId): playerId is number => typeof playerId === "number" && playerId > 0
      )
    );
    let benchCandidatePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludeOnlyFromField: true,
    }).filter((player) => !onFieldPlayerIds.has(player.PlayerID));

    const benchSlotToFieldSlot = {
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_IM: "IM_C",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      if (assignmentsForFormation[benchSlot]) return;
      const selected = pickBestForSlot(benchCandidatePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        benchCandidatePool = benchCandidatePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });

    const extraBenchPlayer =
      [...benchCandidatePool].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
    };
  };

  const buildDefendingExtraTimeResult = async (
    traineeIds: number[],
    options?: {
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const orderedTrainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player))
      .sort(comparePlayersByExtraTimeMatrixOrder);
    if (orderedTrainees.length !== 7) {
      throw new Error(messages.submitOrdersError);
    }

    const assignmentsForFormation: LineupAssignments = {
      WB_L: orderedTrainees[0]?.PlayerID ?? null,
      CD_L: orderedTrainees[1]?.PlayerID ?? null,
      CD_C: orderedTrainees[2]?.PlayerID ?? null,
      CD_R: orderedTrainees[3]?.PlayerID ?? null,
      WB_R: orderedTrainees[4]?.PlayerID ?? null,
      W_L: orderedTrainees[5]?.PlayerID ?? null,
      W_R: orderedTrainees[6]?.PlayerID ?? null,
    };
    if (
      !assignmentsForFormation.WB_L ||
      !assignmentsForFormation.CD_L ||
      !assignmentsForFormation.CD_C ||
      !assignmentsForFormation.CD_R ||
      !assignmentsForFormation.WB_R ||
      !assignmentsForFormation.W_L ||
      !assignmentsForFormation.W_R
    ) {
      throw new Error(messages.submitOrdersError);
    }

    const { overallFallback, pickBestForSlot } = buildExtraTimeSlotPicker(ratingsById);
    const assignSlotFromPool = (pool: SeniorPlayer[], slot: keyof LineupAssignments) => {
      const selected = pickBestForSlot(pool, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      return {
        remainingPool: pool.filter((player) => player.PlayerID !== selected.PlayerID),
        selectedPlayerId: selected.PlayerID,
      };
    };

    let nonTraineePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
    const fieldNonTraineeIds = new Set<number>();

    const keeperAssignment = assignSlotFromPool(nonTraineePool, "KP");
    nonTraineePool = keeperAssignment.remainingPool;
    fieldNonTraineeIds.add(keeperAssignment.selectedPlayerId);
    (["IM_L", "IM_C", "IM_R"] as const).forEach((slot) => {
      const assignment = assignSlotFromPool(nonTraineePool, slot);
      nonTraineePool = assignment.remainingPool;
      fieldNonTraineeIds.add(assignment.selectedPlayerId);
    });

    const benchSlotToFieldSlot = {
      B_GK: "KP",
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_IM: "IM_C",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(nonTraineePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        nonTraineePool = nonTraineePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });
    const extraBenchPlayer =
      [...nonTraineePool].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
      fieldNonTraineeIds,
    };
  };

  const buildExtendedDefendingExtraTimeResult = async (traineeIds: number[]) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const trainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    if (trainees.length !== 14) {
      throw new Error(messages.submitOrdersError);
    }

    const orderedKeepers = [...trainees].sort(compareKeeperTrainees);
    const startingKeeper = orderedKeepers[0] ?? null;
    const benchKeeper = orderedKeepers[1] ?? null;
    if (!startingKeeper || !benchKeeper) {
      throw new Error(messages.submitOrdersError);
    }

    const remainingAfterKeepers = trainees.filter(
      (player) =>
        player.PlayerID !== startingKeeper.PlayerID && player.PlayerID !== benchKeeper.PlayerID
    );
    const orderedDefenders = [...remainingAfterKeepers].sort((left, right) =>
      comparePlayersBySkillDescending(left, right, "DefenderSkill")
    );
    const fieldTrainees = orderedDefenders.slice(0, 10);
    const benchTrainees = orderedDefenders.slice(10, 12);
    if (fieldTrainees.length !== 10 || benchTrainees.length !== 2) {
      throw new Error(messages.submitOrdersError);
    }

    const assignmentsForFormation: LineupAssignments = {
      KP: startingKeeper.PlayerID,
      B_GK: benchKeeper.PlayerID,
    };
    const { overallFallback, pickBestForSlot } = buildExtraTimeSlotPicker(ratingsById);

    const assignSlotFromPool = (pool: SeniorPlayer[], slot: keyof LineupAssignments) => {
      const selected = pickBestForSlot(pool, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      return pool.filter((player) => player.PlayerID !== selected.PlayerID);
    };

    let remainingFieldTrainees = [...fieldTrainees];
    [...DEFENSE_SLOTS, ...MIDFIELD_SLOTS].forEach((slot) => {
      remainingFieldTrainees = assignSlotFromPool(remainingFieldTrainees, slot);
    });

    let remainingBenchTrainees = [...benchTrainees];
    (["B_CD", "B_WB"] as const).forEach((slot) => {
      const fieldSlot = slot === "B_CD" ? "CD_C" : "WB_L";
      const selected = pickBestForSlot(remainingBenchTrainees, fieldSlot);
      if (!selected) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      remainingBenchTrainees = remainingBenchTrainees.filter(
        (player) => player.PlayerID !== selected.PlayerID
      );
    });

    let benchCandidatePool = getExtraTimeEligibleNonTrainees(traineeIds);
    const benchSlotToFieldSlot = {
      B_IM: "IM_C",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(benchCandidatePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        benchCandidatePool = benchCandidatePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });
    const extraBenchPlayer =
      [...benchCandidatePool].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
    };
  };

  const buildPlaymakingExtraTimeResult = async (
    traineeIds: number[],
    options?: {
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const orderedTrainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player))
      .sort(comparePlayersByExtraTimeMatrixOrder);
    if (orderedTrainees.length !== 8) {
      throw new Error(messages.submitOrdersError);
    }

    const assignmentsForFormation: LineupAssignments = {
      W_L: orderedTrainees[0]?.PlayerID ?? null,
      IM_L: orderedTrainees[1]?.PlayerID ?? null,
      IM_C: orderedTrainees[2]?.PlayerID ?? null,
      IM_R: orderedTrainees[3]?.PlayerID ?? null,
      W_R: orderedTrainees[4]?.PlayerID ?? null,
      WB_L: orderedTrainees[5]?.PlayerID ?? null,
      WB_R: orderedTrainees[6]?.PlayerID ?? null,
      B_IM: orderedTrainees[7]?.PlayerID ?? null,
    };
    if (
      !assignmentsForFormation.W_L ||
      !assignmentsForFormation.IM_L ||
      !assignmentsForFormation.IM_C ||
      !assignmentsForFormation.IM_R ||
      !assignmentsForFormation.W_R ||
      !assignmentsForFormation.WB_L ||
      !assignmentsForFormation.WB_R ||
      !assignmentsForFormation.B_IM
    ) {
      throw new Error(messages.submitOrdersError);
    }

    const { overallFallback, pickBestForSlot } = buildExtraTimeSlotPicker(ratingsById);
    const assignSlotFromPool = (pool: SeniorPlayer[], slot: keyof LineupAssignments) => {
      const selected = pickBestForSlot(pool, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      return {
        remainingPool: pool.filter((player) => player.PlayerID !== selected.PlayerID),
        selectedPlayerId: selected.PlayerID,
      };
    };

    let nonTraineePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
    const fieldNonTraineeIds = new Set<number>();

    const keeperAssignment = assignSlotFromPool(nonTraineePool, "KP");
    nonTraineePool = keeperAssignment.remainingPool;
    fieldNonTraineeIds.add(keeperAssignment.selectedPlayerId);
    (["CD_L", "CD_C", "CD_R"] as const).forEach((slot) => {
      const assignment = assignSlotFromPool(nonTraineePool, slot);
      nonTraineePool = assignment.remainingPool;
      fieldNonTraineeIds.add(assignment.selectedPlayerId);
    });

    const benchSlotToFieldSlot = {
      B_GK: "KP",
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(nonTraineePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        nonTraineePool = nonTraineePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });
    const extraBenchPlayer =
      [...nonTraineePool].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
      fieldNonTraineeIds,
    };
  };

  const buildSetPiecesExtraTimeResult = async (traineeIds: number[]) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const trainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    if (trainees.length !== 13) {
      throw new Error(messages.submitOrdersError);
    }

    const { pickBestForSlot } = buildExtraTimeSlotPicker(ratingsById);
    const assignmentsForFormation: LineupAssignments = {};

    const orderedKeepers = [...trainees].sort(compareKeeperTrainees);
    const startingKeeper = orderedKeepers[0] ?? null;
    const benchKeeper =
      orderedKeepers.find((player) => player.PlayerID !== startingKeeper?.PlayerID) ?? null;
    const orderedSetPieces = [...trainees].sort(comparePlayersBySetPiecesDescending);
    const extraBenchSetPiecesPlayer =
      orderedSetPieces.find(
        (player) =>
          player.PlayerID !== startingKeeper?.PlayerID &&
          player.PlayerID !== benchKeeper?.PlayerID
      ) ?? null;
    if (!startingKeeper || !benchKeeper || !extraBenchSetPiecesPlayer) {
      throw new Error(messages.submitOrdersError);
    }

    assignmentsForFormation.KP = startingKeeper.PlayerID;
    assignmentsForFormation.B_GK = benchKeeper.PlayerID;
    assignmentsForFormation.B_X = extraBenchSetPiecesPlayer.PlayerID;

    let remainingTrainees = trainees.filter(
      (player) =>
        player.PlayerID !== startingKeeper.PlayerID &&
        player.PlayerID !== benchKeeper.PlayerID &&
        player.PlayerID !== extraBenchSetPiecesPlayer.PlayerID
    );

    (
      ["WB_L", "CD_L", "CD_C", "CD_R", "WB_R", "W_L", "IM_L", "IM_C", "IM_R", "W_R"] as const
    ).forEach((slot) => {
      const selected = pickBestForSlot(remainingTrainees, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersError);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      remainingTrainees = remainingTrainees.filter(
        (player) => player.PlayerID !== selected.PlayerID
      );
    });

    if (remainingTrainees.length !== 0) {
      throw new Error(messages.submitOrdersError);
    }

    let benchCandidatePool = getExtraTimeEligibleNonTrainees(traineeIds);
    const benchSlotToFieldSlot = {
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_IM: "IM_C",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(benchCandidatePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        benchCandidatePool = benchCandidatePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });

    return {
      assignments: assignmentsForFormation,
    };
  };

  const buildScoringExtraTimeResult = async (
    traineeIds: number[],
    options?: {
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const orderedTrainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player))
      .sort(comparePlayersByExtraTimeMatrixOrder);
    if (orderedTrainees.length !== 4) {
      throw new Error(messages.submitOrdersError);
    }

    const { pickBestForSlot } = buildExtraTimeSlotPicker(ratingsById);
    const numberedTraineeIds = orderedTrainees.map((player) => player.PlayerID);
    const assignmentsForFormation: LineupAssignments = {
      F_L: numberedTraineeIds[0] ?? null,
      F_C: numberedTraineeIds[1] ?? null,
      F_R: numberedTraineeIds[2] ?? null,
      IM_L: numberedTraineeIds[3] ?? null,
    };
    if (
      !assignmentsForFormation.F_L ||
      !assignmentsForFormation.F_C ||
      !assignmentsForFormation.F_R ||
      !assignmentsForFormation.IM_L
    ) {
      throw new Error(messages.submitOrdersError);
    }

    let nonTraineePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
    const fieldNonTraineeIds = new Set<number>();
    const assignFieldNonTrainee = (slot: keyof LineupAssignments) => {
      const selected = pickBestForSlot(nonTraineePool, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersMinPlayers);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      fieldNonTraineeIds.add(selected.PlayerID);
      nonTraineePool = nonTraineePool.filter(
        (player) => player.PlayerID !== selected.PlayerID
      );
    };

    (["KP", "WB_L", "CD_L", "CD_C", "CD_R", "WB_R", "IM_R"] as const).forEach((slot) => {
      assignFieldNonTrainee(slot);
    });

    const benchSlotToFieldSlot = {
      B_GK: "KP",
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_IM: "IM_C",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(nonTraineePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        nonTraineePool = nonTraineePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });

    const extraBenchPlayer = nonTraineePool[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
      fieldNonTraineeIds,
      scoringRoleIds: numberedTraineeIds,
    };
  };

  const buildWingerExtraTimeResult = async (
    traineeIds: number[],
    options?: {
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const orderedTrainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player))
      .sort(comparePlayersByExtraTimeMatrixOrder);
    if (orderedTrainees.length !== 6) {
      throw new Error(messages.submitOrdersError);
    }

    const { overallFallback, pickBestForSlot, ratingForSlot } =
      buildExtraTimeSlotPicker(ratingsById);
    const numberedTraineeIds = orderedTrainees.map((player) => player.PlayerID);
    const assignmentsForFormation: LineupAssignments = {
      WB_L: numberedTraineeIds[2] ?? null,
      WB_R: numberedTraineeIds[3] ?? null,
      W_L: numberedTraineeIds[0] ?? null,
      W_R: numberedTraineeIds[1] ?? null,
    };
    if (
      !assignmentsForFormation.WB_L ||
      !assignmentsForFormation.WB_R ||
      !assignmentsForFormation.W_L ||
      !assignmentsForFormation.W_R
    ) {
      throw new Error(messages.submitOrdersError);
    }

    const freeTrainees = orderedTrainees.slice(4);
    const freeTraineeSlots = ["CD_L", "CD_C", "CD_R", "IM_L", "IM_C", "IM_R"] as const;
    let bestFreeAssignments:
      | {
          totalRating: number;
          slotByPlayerId: Map<number, (typeof freeTraineeSlots)[number]>;
        }
      | null = null;
    freeTraineeSlots.forEach((firstSlot) => {
      freeTraineeSlots.forEach((secondSlot) => {
        if (secondSlot === firstSlot) return;
        const slotByPlayerId = new Map<number, (typeof freeTraineeSlots)[number]>([
          [freeTrainees[0]?.PlayerID ?? 0, firstSlot],
          [freeTrainees[1]?.PlayerID ?? 0, secondSlot],
        ]);
        const totalRating =
          ratingForSlot(freeTrainees[0]?.PlayerID ?? 0, firstSlot) +
          ratingForSlot(freeTrainees[1]?.PlayerID ?? 0, secondSlot);
        if (
          !bestFreeAssignments ||
          totalRating > bestFreeAssignments.totalRating ||
          (
            totalRating === bestFreeAssignments.totalRating &&
            `${firstSlot}-${secondSlot}` <
              Array.from(bestFreeAssignments.slotByPlayerId.values()).join("-")
          )
        ) {
          bestFreeAssignments = {
            totalRating,
            slotByPlayerId,
          };
        }
      });
    });
    const trainee5Id = numberedTraineeIds[4] ?? null;
    const trainee6Id = numberedTraineeIds[5] ?? null;
    const bestFreeSlotByPlayerId =
      (
        bestFreeAssignments as
          | {
              totalRating: number;
              slotByPlayerId: Map<number, (typeof freeTraineeSlots)[number]>;
            }
          | null
      )?.slotByPlayerId ?? null;
    const trainee5Slot = trainee5Id
      ? bestFreeSlotByPlayerId?.get(trainee5Id) ?? null
      : null;
    const trainee6Slot = trainee6Id
      ? bestFreeSlotByPlayerId?.get(trainee6Id) ?? null
      : null;
    if (!trainee5Id || !trainee6Id || !trainee5Slot || !trainee6Slot) {
      throw new Error(messages.submitOrdersError);
    }
    assignmentsForFormation[trainee5Slot] = trainee5Id;
    assignmentsForFormation[trainee6Slot] = trainee6Id;

    const fieldNonTraineeIds = new Set<number>();
    let fieldNonTraineePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
    const assignFieldNonTrainee = (slot: keyof LineupAssignments) => {
      const selected = pickBestForSlot(fieldNonTraineePool, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersMinPlayers);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      fieldNonTraineeIds.add(selected.PlayerID);
      fieldNonTraineePool = fieldNonTraineePool.filter(
        (player) => player.PlayerID !== selected.PlayerID
      );
    };

    assignFieldNonTrainee("KP");
    (["CD_L", "CD_C", "CD_R", "IM_L", "IM_C", "IM_R"] as const).forEach((slot) => {
      if (assignmentsForFormation[slot]) return;
      assignFieldNonTrainee(slot);
    });

    const onFieldPlayerIds = new Set<number>(
      FIELD_SLOT_ORDER.map((slot) => assignmentsForFormation[slot]).filter(
        (playerId): playerId is number => typeof playerId === "number" && playerId > 0
      )
    );
    const benchCandidatePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
      excludeOnlyFromField: true,
    }).filter((player) => !onFieldPlayerIds.has(player.PlayerID));

    const benchSlotToFieldSlot = {
      B_GK: "KP",
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_IM: "IM_C",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    let remainingBenchCandidates = [...benchCandidatePool];
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(remainingBenchCandidates, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        remainingBenchCandidates = remainingBenchCandidates.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });
    const extraBenchPlayer =
      [...remainingBenchCandidates].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
      fieldNonTraineeIds,
      wingerRoleIds: numberedTraineeIds,
    };
  };

  const buildWingerAttackersExtraTimeResult = async (
    traineeIds: number[],
    options?: {
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const orderedTrainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player))
      .sort((left, right) => comparePlayersBySkillDescending(left, right, "WingerSkill"));
    if (orderedTrainees.length !== 7) {
      throw new Error(messages.submitOrdersError);
    }

    const { overallFallback, pickBestForSlot } = buildExtraTimeSlotPicker(ratingsById);
    const numberedTraineeIds = orderedTrainees.map((player) => player.PlayerID);
    const assignmentsForFormation: LineupAssignments = {
      W_L: numberedTraineeIds[0] ?? null,
      W_R: numberedTraineeIds[1] ?? null,
      F_L: numberedTraineeIds[2] ?? null,
      F_C: numberedTraineeIds[3] ?? null,
      F_R: numberedTraineeIds[4] ?? null,
      CD_L: numberedTraineeIds[5] ?? null,
      CD_R: numberedTraineeIds[6] ?? null,
    };
    if (
      !assignmentsForFormation.W_L ||
      !assignmentsForFormation.W_R ||
      !assignmentsForFormation.F_L ||
      !assignmentsForFormation.F_C ||
      !assignmentsForFormation.F_R ||
      !assignmentsForFormation.CD_L ||
      !assignmentsForFormation.CD_R
    ) {
      throw new Error(messages.submitOrdersError);
    }

    let fieldNonTraineePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
    const fieldNonTraineeIds = new Set<number>();
    (["KP", "WB_L", "CD_C", "WB_R"] as const).forEach((slot) => {
      const selected = pickBestForSlot(fieldNonTraineePool, slot);
      if (!selected) {
        throw new Error(messages.submitOrdersMinPlayers);
      }
      assignmentsForFormation[slot] = selected.PlayerID;
      fieldNonTraineeIds.add(selected.PlayerID);
      fieldNonTraineePool = fieldNonTraineePool.filter(
        (player) => player.PlayerID !== selected.PlayerID
      );
    });

    const onFieldPlayerIds = new Set<number>(
      FIELD_SLOT_ORDER.map((slot) => assignmentsForFormation[slot]).filter(
        (playerId): playerId is number => typeof playerId === "number" && playerId > 0
      )
    );
    let benchCandidatePool = getExtraTimeEligibleNonTrainees(traineeIds, {
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
      excludeOnlyFromField: true,
    }).filter((player) => !onFieldPlayerIds.has(player.PlayerID));

    const benchSlotToFieldSlot = {
      B_GK: "KP",
      B_CD: "CD_C",
      B_WB: "WB_L",
      B_IM: "IM_C",
      B_F: "F_C",
      B_W: "W_L",
    } as const;
    (
      Object.entries(benchSlotToFieldSlot) as Array<
        [
          keyof typeof benchSlotToFieldSlot,
          (typeof benchSlotToFieldSlot)[keyof typeof benchSlotToFieldSlot],
        ]
      >
    ).forEach(([benchSlot, fieldSlot]) => {
      const selected = pickBestForSlot(benchCandidatePool, fieldSlot);
      assignmentsForFormation[benchSlot] = selected?.PlayerID ?? null;
      if (selected) {
        benchCandidatePool = benchCandidatePool.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });
    const extraBenchPlayer =
      [...benchCandidatePool].sort((left, right) => {
        const leftValue = overallFallback(left);
        const rightValue = overallFallback(right);
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
          formatPlayerName(right) || String(right.PlayerID)
        );
      })[0] ?? null;
    assignmentsForFormation.B_X = extraBenchPlayer?.PlayerID ?? null;

    return {
      assignments: assignmentsForFormation,
      fieldNonTraineeIds,
      wingerAttackerRoleIds: numberedTraineeIds,
    };
  };

  const handleExtraTimeSetLineup = async () => {
    if (
      resolvedExtraTimeTrainingType !== 2 &&
      resolvedExtraTimeTrainingType !== 4 &&
      resolvedExtraTimeTrainingType !== 3 &&
      resolvedExtraTimeTrainingType !== 5 &&
      resolvedExtraTimeTrainingType !== 12 &&
      resolvedExtraTimeTrainingType !== 8 &&
      resolvedExtraTimeTrainingType !== 7 &&
      resolvedExtraTimeTrainingType !== 6 &&
      resolvedExtraTimeTrainingType !== 9 &&
      resolvedExtraTimeTrainingType !== 10 &&
      resolvedExtraTimeTrainingType !== 11
    ) {
      setExtraTimeInfoOpen(false);
      return;
    }
    if (extraTimeSelectedCount !== requiredExtraTimeTrainees) return;
    if (extraTimeMatchId === null) return;
    try {
      const selectedTraineeIds = extraTimeSelectedPlayerIds.filter((playerId) =>
        extraTimeSelectablePlayerIds.includes(playerId)
      );
      if (resolvedExtraTimeTrainingType === 2) {
        const result = await buildSetPiecesExtraTimeResult(selectedTraineeIds);
        setAssignments(result.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
          F_L: 2,
          F_C: 2,
          F_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 4) {
        const finalResult = await buildScoringExtraTimeResult(selectedTraineeIds);
        setAssignments(finalResult.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          IM_L: 2,
          IM_R: 2,
          F_L: 2,
          F_C: 2,
          F_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
          scoringRoleIds: finalResult.scoringRoleIds,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 6) {
        const result = await buildScoringSetPiecesExtraTimeResult(selectedTraineeIds);
        setAssignments(result.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
          F_L: 2,
          F_C: 2,
          F_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 7) {
        const result = await buildPassingExtraTimeResult(selectedTraineeIds);
        setAssignments(result.assignments);
        setBehaviors({
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
          F_L: 2,
          F_C: 2,
          F_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 10) {
        const finalResult = await buildExtendedPassingExtraTimeResult(selectedTraineeIds);
        setAssignments(finalResult.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 5) {
        const finalResult = await buildWingerExtraTimeResult(selectedTraineeIds);
        setAssignments(finalResult.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
          wingerRoleIds: finalResult.wingerRoleIds,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 12) {
        const finalResult = await buildWingerAttackersExtraTimeResult(selectedTraineeIds);
        setAssignments(finalResult.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
          F_L: 2,
          F_C: 2,
          F_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
          wingerAttackerRoleIds: finalResult.wingerAttackerRoleIds,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 3) {
        const finalResult = await buildDefendingExtraTimeResult(selectedTraineeIds);
        setAssignments(finalResult.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 8) {
        const finalResult = await buildPlaymakingExtraTimeResult(selectedTraineeIds);
        setAssignments(finalResult.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      if (resolvedExtraTimeTrainingType === 11) {
        const result = await buildExtendedDefendingExtraTimeResult(selectedTraineeIds);
        setAssignments(result.assignments);
        setBehaviors({
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
        });
        setTacticType(1);
        setLoadedMatchId(extraTimeMatchId);
        setExtraTimePreparedSubmission({
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        });
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
        return;
      }
      const { selectedMatchType } = await resolveExtraTimeMatchContext(extraTimeMatchId);
      const finalResult = await buildForcedKeeperExtraTimeResult(selectedTraineeIds, {
        selectedMatchType,
      });
      setAssignments(finalResult.assignments);
      setBehaviors({
        WB_L: 2,
        WB_R: 2,
        W_L: 2,
        IM_L: 2,
        IM_C: 2,
        IM_R: 2,
        W_R: 2,
      });
      setTacticType(1);
      setLoadedMatchId(extraTimeMatchId);
      setExtraTimePreparedSubmission({
        matchId: extraTimeMatchId,
        traineeIds: selectedTraineeIds,
        trainingType: resolvedExtraTimeTrainingType,
      });
      setExtraTimeInfoOpen(false);
      setExtraTimeMatchId(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : messages.submitOrdersError;
      addNotification(detail);
    }
  };

  const orderedListPlayers = useMemo(() => {
    if (orderedPlayerIds && orderSource && orderSource !== "list") {
      return orderedPlayerIds
        .map((id) => playersById.get(id))
        .filter((player): player is SeniorPlayer => Boolean(player));
    }
    return sortedPlayers;
  }, [orderSource, orderedPlayerIds, playersById, sortedPlayers]);
  const isMatrixSortActive = Boolean(
    orderSource &&
      orderSource !== "list" &&
      (orderSource === "ratings" || orderSource === "skills") &&
      orderedPlayerIds?.length
  );

  const tsiRange = useMemo(() => {
    const values = players
      .map((player) => player.TSI)
      .filter((value): value is number => typeof value === "number");
    if (!values.length) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [players]);

  const wageRange = useMemo(() => {
    const values = players
      .map((player) => salaryValueForPlayer(player))
      .filter((value): value is number => typeof value === "number");
    if (!values.length) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [players, detailsById]);

  const applyPlayerOrder = (ids: number[], source: "list" | "ratings" | "skills") => {
    setOrderedPlayerIds((prev) => {
      if (
        prev &&
        prev.length === ids.length &&
        prev.every((id, index) => id === ids[index])
      ) {
        return prev;
      }
      return ids;
    });
    setOrderSource((prev) => (prev === source ? prev : source));
  };

  const handleSeniorPlayerDragStart = (
    event: DragEvent<HTMLElement>,
    playerId: number,
    playerName: string
  ) => {
    setDragGhost(event, {
      label: playerName,
      className: styles.dragGhost,
      slotSelector: `.${styles.fieldSlot}`,
    });
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "player", playerId })
    );
    event.dataTransfer.setData("text/plain", String(playerId));
    event.dataTransfer.effectAllowed = "move";
  };

  const playersByIdForLineup = useMemo(() => {
    const map = new Map<
      number,
      {
        YouthPlayerID: number;
        FirstName: string;
        NickName?: string;
        LastName: string;
        Specialty?: number;
        InjuryLevel?: number;
        Cards?: number;
        Age?: number;
        AgeDays?: number;
        Form?: SkillValue | number | string | null;
        StaminaSkill?: SkillValue | number | string | null;
        PlayerSkills?: Record<string, SkillValue>;
      }
    >();
    players.forEach((player) => {
      map.set(player.PlayerID, {
        YouthPlayerID: player.PlayerID,
        FirstName: player.FirstName,
        NickName: player.NickName,
        LastName: player.LastName,
        Specialty: player.Specialty,
        Age: player.Age,
        AgeDays: player.AgeDays,
        Form:
          detailsById.get(player.PlayerID)?.Form ??
          (typeof player.Form === "number" ? player.Form : null),
        StaminaSkill:
          detailsById.get(player.PlayerID)?.StaminaSkill ??
          (typeof player.StaminaSkill === "number" ? player.StaminaSkill : null),
        PlayerSkills: detailsById.get(player.PlayerID)?.PlayerSkills ?? player.PlayerSkills,
        InjuryLevel: player.InjuryLevel,
        Cards:
          typeof detailsById.get(player.PlayerID)?.Cards === "number"
            ? detailsById.get(player.PlayerID)?.Cards
            : typeof player.Cards === "number"
              ? player.Cards
              : undefined,
      });
    });
    return map;
  }, [detailsById, players]);

  const seniorPenaltyKickerIds = useMemo(() => {
    if (extraTimePreparedSubmission) {
      const onFieldPlayers = FIELD_SLOT_ORDER.map((slot) => assignments[slot])
        .filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0)
        .map((playerId) => playersById.get(playerId) ?? null)
        .filter((player): player is SeniorPlayer => Boolean(player));
      return (
        extraTimePreparedSubmission.trainingType === 2
          ? buildSetPiecesExtraTimeSetup(onFieldPlayers)
          : buildExtraTimeSetPiecesSetup(onFieldPlayers)
      ).kickerIds;
    }
    const assignedPlayerIds = Array.from(
      new Set(
        Object.values(assignments).filter(
          (playerId): playerId is number =>
            typeof playerId === "number" && playerId > 0
        )
      )
    );
    const setPiecesByPlayerId = new Map<number, number>();
    const nameByPlayerId = new Map<number, string>();
    players.forEach((player) => {
      const value = skillValueForPlayer(player, "SetPiecesSkill");
      if (typeof value === "number") {
        setPiecesByPlayerId.set(player.PlayerID, value);
      }
      nameByPlayerId.set(player.PlayerID, formatPlayerName(player) || String(player.PlayerID));
    });
    return assignedPlayerIds
      .sort((leftId, rightId) => {
        const leftValue = setPiecesByPlayerId.get(leftId) ?? -1;
        const rightValue = setPiecesByPlayerId.get(rightId) ?? -1;
        if (rightValue !== leftValue) return rightValue - leftValue;
        return (nameByPlayerId.get(leftId) ?? String(leftId)).localeCompare(
          nameByPlayerId.get(rightId) ?? String(rightId)
        );
      })
      .slice(0, 11);
  }, [
    assignments,
    buildExtraTimeSetPiecesSetup,
    buildSetPiecesExtraTimeSetup,
    extraTimePreparedSubmission,
    players,
    playersById,
    skillValueForPlayer,
  ]);

  const seniorSetPiecesPlayerId = useMemo(() => {
    if (!extraTimePreparedSubmission) return 0;
    const onFieldPlayers = FIELD_SLOT_ORDER.map((slot) => assignments[slot])
      .filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0)
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    return (
      extraTimePreparedSubmission.trainingType === 2
        ? buildSetPiecesExtraTimeSetup(onFieldPlayers)
        : buildExtraTimeSetPiecesSetup(onFieldPlayers)
    ).setPiecesPlayerId;
  }, [
    assignments,
    buildExtraTimeSetPiecesSetup,
    buildSetPiecesExtraTimeSetup,
    extraTimePreparedSubmission,
    playersById,
  ]);

  const seniorCardStatusByPlayerId = useMemo(() => {
    const map: Record<number, { display: string; label: string }> = {};
    players.forEach((player) => {
      const details = detailsById.get(player.PlayerID);
      const cardsValue =
        typeof details?.Cards === "number"
          ? details.Cards
          : typeof player.Cards === "number"
            ? player.Cards
            : null;
      const status = buildSeniorCardStatus(cardsValue, messages);
      if (status) {
        map[player.PlayerID] = status;
      }
    });
    return map;
  }, [detailsById, messages, players]);

  const seniorCardStatusByName = useMemo(() => {
    const map: Record<string, { display: string; label: string }> = {};
    players.forEach((player) => {
      const status = seniorCardStatusByPlayerId[player.PlayerID];
      if (!status) return;
      map[formatPlayerName(player)] = status;
    });
    return map;
  }, [players, seniorCardStatusByPlayerId]);

  const selectedUpdatesEntry = useMemo(
    () =>
      selectedUpdatesId
        ? updatesHistory.find((entry) => entry.id === selectedUpdatesId) ?? null
        : updatesHistory[0] ?? null,
    [selectedUpdatesId, updatesHistory]
  );

  const seniorTrainedSlots = useMemo(() => {
    const primaryFull = new Set<string>();
    const primaryHalf = new Set<string>();

    switch (trainingType) {
      case 2: // Set pieces
      case 6: // Scoring + Set pieces
        FIELD_SLOT_ORDER.forEach((slot) => primaryFull.add(slot));
        break;
      case 3: // Defending
        DEFENSE_SLOTS.forEach((slot) => primaryFull.add(slot));
        break;
      case 4: // Scoring
        ATTACK_SLOTS.forEach((slot) => primaryFull.add(slot));
        break;
      case 5: // Winger
        primaryFull.add("W_L");
        primaryFull.add("W_R");
        primaryHalf.add("WB_L");
        primaryHalf.add("WB_R");
        break;
      case 7: // Passing
        MIDFIELD_SLOTS.forEach((slot) => primaryFull.add(slot));
        ATTACK_SLOTS.forEach((slot) => primaryFull.add(slot));
        break;
      case 8: // Playmaking
        primaryFull.add("IM_L");
        primaryFull.add("IM_C");
        primaryFull.add("IM_R");
        primaryHalf.add("W_L");
        primaryHalf.add("W_R");
        break;
      case 9: // Keeper
        primaryFull.add("KP");
        break;
      case 10: // Passing (Defenders + Midfielders)
        DEFENSE_SLOTS.forEach((slot) => primaryFull.add(slot));
        MIDFIELD_SLOTS.forEach((slot) => primaryFull.add(slot));
        break;
      case 11: // Defending (Defenders + Midfielders)
        primaryFull.add("KP");
        DEFENSE_SLOTS.forEach((slot) => primaryFull.add(slot));
        MIDFIELD_SLOTS.forEach((slot) => primaryFull.add(slot));
        break;
      case 12: // Winger (Wingers + Attackers)
        ATTACK_SLOTS.forEach((slot) => primaryFull.add(slot));
        primaryFull.add("W_L");
        primaryFull.add("W_R");
        break;
      default:
        break;
    }

    const all = new Set<string>([...primaryFull, ...primaryHalf]);
    return {
      primary: new Set(all),
      secondary: new Set<string>(),
      primaryFull,
      primaryHalf,
      secondaryFull: new Set<string>(),
      secondaryHalf: new Set<string>(),
      all,
    };
  }, [trainingType]);

  const notifyRefreshState = (
    nextRefreshing: boolean,
    nextStatus: string | null,
    nextProgress: number,
    nextLastRefreshAt: number | null
  ) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(SENIOR_REFRESH_STATE_EVENT, {
        detail: {
          refreshing: nextRefreshing,
          status: nextStatus,
          progressPct: nextProgress,
          lastRefreshAt: nextLastRefreshAt,
        },
      })
    );
  };

  useEffect(() => {
    notifyRefreshState(refreshing, refreshStatus, refreshProgressPct, lastRefreshAt);
  }, [lastRefreshAt, refreshProgressPct, refreshStatus, refreshing]);

  const formatSeniorTeamOptionLabel = useCallback(
    (team: { teamName: string; teamId: number; teamGender: "male" | "female" | null }) => {
      const baseName = team.teamName || `${messages.seniorTeamLabel} ${team.teamId}`;
      const genderLabel =
        team.teamGender === "female"
          ? messages.watchlistGenderFemale
          : team.teamGender === "male"
            ? messages.watchlistGenderMale
            : null;
      return genderLabel ? `${baseName} (${genderLabel})` : baseName;
    },
    [
      messages.seniorTeamLabel,
      messages.watchlistGenderFemale,
      messages.watchlistGenderMale,
    ]
  );

  const fetchPlayers = async (teamId?: number | null) => {
    const teamParam = teamId ? `&teamId=${teamId}` : "";
    const { response, payload } = await fetchChppJson<{
      data?: { HattrickData?: { Team?: { PlayerList?: { Player?: unknown } } } };
      error?: string;
      details?: string;
    }>(`/api/chpp/players?orderBy=PlayerNumber${teamParam}`, { cache: "no-store" });
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? messages.unableToLoadPlayers);
    }
    return normalizeSeniorPlayers(payload?.data?.HattrickData?.Team?.PlayerList?.Player);
  };

  const fetchMatches = async (teamId?: number | null) => {
    const teamParam = teamId ? `&teamID=${teamId}` : "";
    const { response, payload } = await fetchChppJson<MatchesResponse>(
      `/api/chpp/matches?isYouth=false${teamParam}`,
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? messages.unableToLoadMatches);
    }
    return payload as MatchesResponse;
  };

  const normalizeMatchList = (input?: Match[] | Match) => {
    if (!input) return [];
    return Array.isArray(input) ? input : [input];
  };

  const inferExtraTimeBTeamMatchMinutes = (
    matchDate: string | null,
    finishedDate: string | null,
    addedMinutes: number | null
  ) => {
    const added = Math.max(0, addedMinutes ?? 0);
    const baselineElapsedMinutes = 45 + 15 + 45 + added;
    const startedAt = matchDate ? parseChppDate(matchDate) : null;
    const finishedAt = finishedDate ? parseChppDate(finishedDate) : null;
    const elapsedMinutes =
      startedAt && finishedAt
        ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000))
        : baselineElapsedMinutes;
    const hadExtraTime = elapsedMinutes > baselineElapsedMinutes;
    return 90 + added + (hadExtraTime ? 30 : 0);
  };

  const fetchExtraTimeBTeamRecentMatchState = async (
    teamId?: number | null
  ): Promise<ExtraTimeBTeamRecentMatchState> => {
    const matchesPayload = await fetchMatches(teamId);
    const normalizedMatches = normalizeMatchList(
      matchesPayload?.data?.HattrickData?.Team?.MatchList?.Match ??
        matchesPayload?.data?.HattrickData?.MatchList?.Match
    );
    const now = Date.now();
    const recentMatch =
      [...normalizedMatches]
        .filter((match) => String(match.Status ?? "").toUpperCase() === "FINISHED")
        .filter((match) => EXTRA_TIME_B_TEAM_MATCH_TYPES.has(Number(match.MatchType)))
        .filter((match) => {
          const startedAt = parseChppDate(match.MatchDate)?.getTime() ?? null;
          return (
            typeof startedAt === "number" &&
            Number.isFinite(startedAt) &&
            now - startedAt >= 0 &&
            now - startedAt <= EXTRA_TIME_B_TEAM_LOOKBACK_MS
          );
        })
        .sort((left, right) => {
          const leftTime = parseChppDate(left.MatchDate)?.getTime() ?? 0;
          const rightTime = parseChppDate(right.MatchDate)?.getTime() ?? 0;
          return rightTime - leftTime;
        })[0] ?? null;

    if (!recentMatch) {
      return {
        status: "ready",
        recentMatch: null,
        playerMinutesById: {},
      };
    }

    const teamIdValue =
      typeof teamId === "number" && Number.isFinite(teamId) && teamId > 0
        ? Math.floor(teamId)
        : parseNumber(matchesPayload?.data?.HattrickData?.Team?.TeamID);
    if (!teamIdValue) {
      return {
        status: "error",
        recentMatch: null,
        playerMinutesById: {},
      };
    }

    const matchId = Number(recentMatch.MatchID);
    const sourceSystem =
      typeof recentMatch.SourceSystem === "string" && recentMatch.SourceSystem.trim().length > 0
        ? recentMatch.SourceSystem.trim()
        : "Hattrick";

    const [{ response: lineupResponse, payload: lineupPayload }, { response: detailsResponse, payload: detailsPayload }] =
      await Promise.all([
        fetchChppJson<{
          data?: {
            HattrickData?: {
              Team?: {
                StartingLineup?: { Player?: unknown };
                Substitutions?: { Substitution?: unknown };
              };
            };
          };
          error?: string;
          details?: string;
        }>(
          `/api/chpp/match-lineup?matchId=${matchId}&teamId=${teamIdValue}&sourceSystem=${encodeURIComponent(
            sourceSystem
          )}`,
          { cache: "no-store" }
        ),
        fetchChppJson<{
          data?: {
            HattrickData?: {
              Match?: {
                MatchDate?: unknown;
                FinishedDate?: unknown;
                AddedMinutes?: unknown;
                Bookings?: { Booking?: unknown };
              };
            };
          };
          error?: string;
          details?: string;
        }>(
          `/api/chpp/matchdetails?matchId=${matchId}&sourceSystem=${encodeURIComponent(
            sourceSystem
          )}&matchEvents=false`,
          { cache: "no-store" }
        ),
      ]);

    if (!lineupResponse.ok || lineupPayload?.error || !detailsResponse.ok || detailsPayload?.error) {
      return {
        status: "error",
        recentMatch: null,
        playerMinutesById: {},
      };
    }

    const matchData = detailsPayload?.data?.HattrickData?.Match;
    const totalMatchMinutes = inferExtraTimeBTeamMatchMinutes(
      typeof matchData?.MatchDate === "string" ? matchData.MatchDate : null,
      typeof matchData?.FinishedDate === "string" ? matchData.FinishedDate : null,
      parseNumber(matchData?.AddedMinutes)
    );
    const normalizeList = <T,>(value: T | T[] | null | undefined) =>
      !value ? [] : Array.isArray(value) ? value : [value];
    const startingLineupPlayers = normalizeList(
      lineupPayload?.data?.HattrickData?.Team?.StartingLineup?.Player as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | undefined
    );
    const substitutions = normalizeList(
      lineupPayload?.data?.HattrickData?.Team?.Substitutions?.Substitution as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | undefined
    );
    const bookings = normalizeList(
      matchData?.Bookings?.Booking as
        | Record<string, unknown>
        | Array<Record<string, unknown>>
        | undefined
    );

    const events: Array<
      | {
          type: "sub";
          minute: number;
          subjectPlayerId: number;
          objectPlayerId: number;
        }
      | {
          type: "red";
          minute: number;
          playerId: number;
        }
    > = [];

    substitutions.forEach((substitution) => {
      const orderType = parseNumber(substitution.OrderType);
      const subjectPlayerId = parseNumber(substitution.SubjectPlayerID);
      const objectPlayerId = parseNumber(substitution.ObjectPlayerID);
      const minute = Math.min(
        totalMatchMinutes,
        Math.max(0, parseNumber(substitution.MatchMinute) ?? totalMatchMinutes)
      );
      if (
        orderType === 1 &&
        typeof subjectPlayerId === "number" &&
        typeof objectPlayerId === "number" &&
        subjectPlayerId !== objectPlayerId
      ) {
        events.push({
          type: "sub",
          minute,
          subjectPlayerId,
          objectPlayerId,
        });
      }
    });

    bookings.forEach((booking) => {
      const bookingType = parseNumber(booking.BookingType);
      const bookingTeamId = parseNumber(booking.BookingTeamID);
      const bookingPlayerId = parseNumber(booking.BookingPlayerID);
      const minute = Math.min(
        totalMatchMinutes,
        Math.max(0, parseNumber(booking.BookingMinute) ?? totalMatchMinutes)
      );
      if (
        bookingType === 2 &&
        bookingTeamId === teamIdValue &&
        typeof bookingPlayerId === "number"
      ) {
        events.push({
          type: "red",
          minute,
          playerId: bookingPlayerId,
        });
      }
    });

    events.sort((left, right) => {
      if (left.minute !== right.minute) return left.minute - right.minute;
      return left.type.localeCompare(right.type);
    });

    const playedMinutesById = new Map<number, number>();
    const onFieldSince = new Map<number, number>();
    startingLineupPlayers.forEach((player) => {
      const playerId = parseNumber(player.PlayerID);
      const roleId = parseNumber(player.RoleID);
      if (
        typeof playerId !== "number" ||
        typeof roleId !== "number" ||
        roleId < 100 ||
        roleId > 113
      ) {
        return;
      }
      if (!onFieldSince.has(playerId)) {
        onFieldSince.set(playerId, 0);
      }
    });

    const closeInterval = (playerId: number, minute: number) => {
      const startedAt = onFieldSince.get(playerId);
      if (typeof startedAt !== "number") return;
      playedMinutesById.set(
        playerId,
        (playedMinutesById.get(playerId) ?? 0) + Math.max(0, minute - startedAt)
      );
      onFieldSince.delete(playerId);
    };

    events.forEach((event) => {
      if (event.type === "sub") {
        closeInterval(event.subjectPlayerId, event.minute);
        if (!onFieldSince.has(event.objectPlayerId)) {
          onFieldSince.set(event.objectPlayerId, event.minute);
        }
        return;
      }
      closeInterval(event.playerId, event.minute);
    });

    onFieldSince.forEach((startedAt, playerId) => {
      playedMinutesById.set(
        playerId,
        (playedMinutesById.get(playerId) ?? 0) + Math.max(0, totalMatchMinutes - startedAt)
      );
    });

    return {
      status: "ready",
      recentMatch: {
        matchId,
        sourceSystem,
        matchDate: recentMatch.MatchDate ?? "",
      },
      playerMinutesById: Object.fromEntries(playedMinutesById.entries()),
    };
  };

  const fetchRatings = async (
    teamId?: number | null,
    season?: number,
    fromTs?: number | null,
    fromMatchId?: number | null,
    firstMatchDate?: string | null,
    lastMatchDate?: string | null
  ) => {
    const query =
      new URLSearchParams(
        Object.fromEntries(
          [
            typeof teamId === "number" && Number.isFinite(teamId) && teamId > 0
              ? ["teamId", String(Math.floor(teamId))]
              : null,
            typeof season === "number" && Number.isFinite(season) && season > 0
              ? ["season", String(Math.floor(season))]
              : null,
            typeof fromTs === "number" && Number.isFinite(fromTs) && fromTs > 0
              ? ["fromTs", String(Math.floor(fromTs))]
              : null,
            typeof fromMatchId === "number" &&
            Number.isFinite(fromMatchId) &&
            fromMatchId > 0
              ? ["fromMatchId", String(Math.floor(fromMatchId))]
              : null,
            typeof firstMatchDate === "string" && firstMatchDate
              ? ["firstMatchDate", firstMatchDate]
              : null,
            typeof lastMatchDate === "string" && lastMatchDate
              ? ["lastMatchDate", lastMatchDate]
              : null,
          ].filter((entry): entry is [string, string] => Boolean(entry))
        )
      ).toString();
    const suffix = query ? `?${query}` : "";
    const { response, payload } = await fetchChppJson<
      RatingsMatrixResponse & { error?: string; details?: string }
    >(`/api/chpp/ratings${suffix}`, {
      cache: "no-store",
    });
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? messages.noMatchesReturned);
    }
    return payload as RatingsMatrixResponse;
  };

  const fetchManagerCompendium = async (
    userId?: string | null
  ): Promise<ManagerCompendiumResponse> => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const { response, payload } = await fetchChppJson<ManagerCompendiumResponse>(
      `/api/chpp/managercompendium${query}`,
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to fetch manager compendium");
    }
    return payload ?? {};
  };

  const applyManagerCompendiumTeams = useCallback(
    async (userId?: string | null) => {
      const payload = await fetchManagerCompendium(userId);
      const teams = extractSeniorTeams(payload);
      setSeniorTeams(teams);
      setSelectedSeniorTeamId((current) => {
        if (teams.length <= 1) return null;
        if (
          typeof current === "number" &&
          teams.some((team) => team.teamId === current)
        ) {
          return current;
        }
        return teams[0]?.teamId ?? null;
      });
      return teams;
    },
    []
  );

  const fetchCurrentSeason = async () => {
    const cached = readGlobalSeason();
    if (cached !== null) return cached;
    const payload = await fetchManagerCompendium(managerCompendiumUserIdOverride);
    const directSeason =
      typeof payload?.season === "number" && Number.isFinite(payload.season)
        ? Math.floor(payload.season)
        : null;
    if (directSeason && directSeason > 0) return directSeason;

    const teams = normalizeManagerCompendiumTeams(
      payload?.data?.HattrickData?.Manager?.Teams?.Team
    );
    for (const team of teams) {
      const maybeSeason = parseNumber(team?.League?.Season);
      if (typeof maybeSeason === "number" && Number.isFinite(maybeSeason) && maybeSeason > 0) {
        return Math.floor(maybeSeason);
      }
    }
    throw new Error(messages.noMatchesReturned);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyOverride = async (rawUserId?: string | null) => {
      const normalizedUserId = rawUserId?.trim() || "";
      setManagerCompendiumUserIdOverride(normalizedUserId || null);
      staleRefreshAttemptedRef.current = false;
      try {
        await applyManagerCompendiumTeams(normalizedUserId || null);
        addNotification(messages.notificationTeamsLoaded);
      } catch (error) {
        if (error instanceof ChppAuthRequiredError) return;
        addNotification(messages.notificationTeamsLoadFailed);
      }
    };

    const initialOverride = readSeniorDebugManagerUserId();
    if (initialOverride) {
      void applyOverride(initialOverride);
    }

    const handleOverrideEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string | null }>).detail;
      const nextUserId =
        typeof detail?.userId === "string" ? detail.userId : readSeniorDebugManagerUserId();
      void applyOverride(nextUserId);
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== SENIOR_DEBUG_MANAGER_USER_ID_STORAGE_KEY
      ) {
        return;
      }
      void applyOverride(readSeniorDebugManagerUserId());
    };

    window.addEventListener(SENIOR_DEBUG_MANAGER_USER_ID_EVENT, handleOverrideEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        SENIOR_DEBUG_MANAGER_USER_ID_EVENT,
        handleOverrideEvent
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [
    addNotification,
    applyManagerCompendiumTeams,
    messages.notificationTeamsLoadFailed,
    messages.notificationTeamsLoaded,
  ]);

  const fetchTrainingSnapshot = async (
    teamId?: number | null
  ): Promise<{
    trainingType: number | null;
    teamId: number | null;
  }> => {
    const { response, payload } = await fetchChppJson<{
      data?: {
        HattrickData?: {
          Team?: {
            TrainingType?: unknown;
            TeamID?: unknown;
          };
        };
      };
      error?: string;
      details?: string;
    }>(
      `/api/chpp/training?actionType=view${
        teamId ? `&teamId=${teamId}` : ""
      }`,
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to fetch training");
    }
    return {
      trainingType: parseNumber(payload?.data?.HattrickData?.Team?.TrainingType),
      teamId: parseNumber(payload?.data?.HattrickData?.Team?.TeamID),
    };
  };

  const fetchTrainingType = async (teamId?: number | null): Promise<number | null> => {
    const snapshot = await fetchTrainingSnapshot(teamId);
    return snapshot.trainingType;
  };

  const setSeniorTrainingRegimen = async (teamId: number, nextTrainingType: number) => {
    const { response, payload } = await fetchChppJson<{
      error?: string;
      details?: string;
    }>("/api/chpp/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        trainingType: nextTrainingType,
      }),
    });
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to set training");
    }
  };

  const handleSetTrainingType = async (nextTrainingType: number) => {
    if (trainingTypeSetPending) return;
    if (nextTrainingType === trainingType) return;
    const hasRequiredScopes = await ensureRequiredScopes();
    if (!hasRequiredScopes) return;

    setTrainingTypeSetPending(true);
    setTrainingTypeSetPendingValue(nextTrainingType);
    try {
      let teamId = resolvedSeniorTeamId;
      if (teamId === null) {
        teamId = parseNumber(matchesState?.data?.HattrickData?.Team?.TeamID);
      }
      if (teamId === null) {
        const snapshot = await fetchTrainingSnapshot(resolvedSeniorTeamId);
        teamId = snapshot.teamId;
      }
      if (teamId === null) {
        throw new Error("Missing senior team id for training update");
      }

      await setSeniorTrainingRegimen(teamId, nextTrainingType);
      const verifiedSnapshot = await fetchTrainingSnapshot(teamId);
      const verifiedTrainingType = sanitizeTrainingType(verifiedSnapshot.trainingType);
      if (verifiedTrainingType !== nextTrainingType) {
        throw new Error("Training update could not be verified");
      }
      setTrainingType(verifiedTrainingType);
      setExtraTimeMatrixTrainingType(verifiedTrainingType);
      setExtraTimeMatrixTrainingTypeManual(false);
      setExtraTimeTrainingMenuOpen(false);
      addNotification(
        messages.notificationSeniorTrainingRegimenChanged.replace(
          "{{training}}",
          obtainedTrainingRegimenLabel(nextTrainingType)
        )
      );
    } catch (error) {
      const fallback = messages.notificationMatchesRefreshFailed;
      const detail = error instanceof Error ? error.message : String(error);
      addNotification(detail || fallback);
    } finally {
      setTrainingTypeSetPending(false);
      setTrainingTypeSetPendingValue(null);
    }
  };

  const syncExtraTimeModalTrainingType = async () => {
    try {
      const currentTrainingType = sanitizeTrainingType(
        await fetchTrainingType(resolvedSeniorTeamId)
      );
      setTrainingType(currentTrainingType);
      setExtraTimeMatrixTrainingType(currentTrainingType);
    } finally {
      setExtraTimeMatrixTrainingTypeManual(false);
    }
  };

  const fetchPlayerDetailsById = async (playerId: number) => {
    const { response, payload } = await fetchChppJson<{
      data?: { HattrickData?: { Player?: SeniorPlayerDetails } };
      error?: string;
      details?: string;
    }>(`/api/chpp/playerdetails?playerId=${playerId}&includeMatchInfo=true`, {
      cache: "no-store",
    });
    if (!response.ok || payload?.error || !payload?.data?.HattrickData?.Player) {
      return null;
    }
    return normalizeSeniorPlayerDetails(payload.data.HattrickData.Player, playerId);
  };

  const bootstrapRatingsFromSeasons = async (teamId: number | null, season: number) => {
    const previousSeason = await fetchRatings(teamId, Math.max(1, season - 1));
    const currentSeason = await fetchRatings(teamId, season);
    return mergeRatingsMatrices(previousSeason, currentSeason);
  };

  const ensureDetails = async (playerId: number, forceRefresh = false) => {
    const cached = detailsCache[playerId];
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS) {
      return cached.data;
    }
    const resolved = await fetchPlayerDetailsById(playerId);
    if (!resolved) {
      return null;
    }
    setDetailsCache((prev) => ({
      ...prev,
      [playerId]: {
        data: resolved,
        fetchedAt: Date.now(),
      },
    }));
    return resolved;
  };

const refreshDetailsForPlayers = async (
    playersToRefresh: SeniorPlayer[],
    options?: {
      isStopped?: () => boolean;
      onProgress?: (completed: number, total: number) => void;
    }
  ) => {
    const total = Math.max(1, playersToRefresh.length);
    let completed = 0;
    const rows = await mapWithConcurrency(
      playersToRefresh,
      SENIOR_DETAILS_CONCURRENCY,
      async (player) => {
        const detail = await fetchPlayerDetailsById(player.PlayerID);
        completed += 1;
        options?.onProgress?.(completed, total);
        return {
          playerId: player.PlayerID,
          detail,
          fetchedAt: Date.now(),
        };
      }
    );
    if (options?.isStopped?.()) return null;
    const detailsPatch: Record<number, PlayerDetailCacheEntry> = {};
    const detailsDataPatch: Record<number, SeniorPlayerDetails> = {};
    rows.forEach((row) => {
      if (!row.detail) return;
      detailsPatch[row.playerId] = {
        data: row.detail,
        fetchedAt: row.fetchedAt,
      };
      detailsDataPatch[row.playerId] = row.detail;
    });
    if (Object.keys(detailsPatch).length > 0) {
      setDetailsCache((prev) => ({ ...prev, ...detailsPatch }));
    }
    return detailsDataPatch;
  };

  const ratingsByPlayerId = useMemo(() => {
    const payload: Record<number, Record<string, number>> = {};
    (ratingsResponse?.players ?? []).forEach((row) => {
      payload[row.id] = { ...row.ratings };
    });
    return payload;
  }, [ratingsResponse]);

  const playerNameById = useMemo(() => {
    const map = new Map<number, string>();
    players.forEach((player) => {
      map.set(player.PlayerID, formatPlayerName(player) || String(player.PlayerID));
    });
    return map;
  }, [players]);
  const motherClubBonusByName = useMemo(() => {
    const payload: Record<string, boolean> = {};
    players.forEach((player) => {
      const playerName = formatPlayerName(player);
      if (!playerName) return;
      payload[playerName] = Boolean(detailsById.get(player.PlayerID)?.MotherClubBonus);
    });
    return payload;
  }, [detailsById, players]);

  const buildUpdatesEntry = (
    prevPlayers: SeniorPlayer[],
    nextPlayers: SeniorPlayer[],
    prevDetailsById: Map<number, SeniorPlayerDetails>,
    nextDetailsById: Map<number, SeniorPlayerDetails>,
    prevRatingsById: Record<number, Record<string, number>>,
    nextRatingsById: Record<number, Record<string, number>>
  ): SeniorUpdatesGroupedEntry => {
    const prevById = new Map(prevPlayers.map((player) => [player.PlayerID, player]));
    const groupedByPlayerId: SeniorUpdatesGroupedEntry["groupedByPlayerId"] = {};

    const upsert = (playerId: number, playerName: string, isNewPlayer: boolean) => {
      if (!groupedByPlayerId[playerId]) {
        groupedByPlayerId[playerId] = {
          playerId,
          playerName,
          isNewPlayer,
          ratings: [],
          skills: [],
          attributes: [],
        };
      } else if (isNewPlayer) {
        groupedByPlayerId[playerId].isNewPlayer = true;
      }
      return groupedByPlayerId[playerId];
    };

    nextPlayers.forEach((player) => {
      const playerId = player.PlayerID;
      const previous = prevById.get(playerId);
      const previousDetails = prevDetailsById.get(playerId);
      const nextDetails = nextDetailsById.get(playerId);
      const playerName = formatPlayerName(player);
      const entry = upsert(playerId, playerName, !previous);

      SKILL_KEYS.forEach((skillKey) => {
        const prevValue = previous
          ? parseBaseSkillForNDetection(previous.PlayerSkills?.[skillKey])
          : null;
        const nextValue = parseBaseSkillForNDetection(player.PlayerSkills?.[skillKey]);
        if (nextValue !== null && nextValue !== prevValue) {
          entry.skills.push({
            skillKey,
            previous: prevValue,
            current: nextValue,
          });
        }
      });

      const previousRatings = prevRatingsById[playerId] ?? {};
      const nextRatings = nextRatingsById[playerId] ?? {};
      const positions = new Set([
        ...Object.keys(previousRatings),
        ...Object.keys(nextRatings),
      ]);
      positions.forEach((positionKey) => {
        const position = Number(positionKey);
        if (!Number.isFinite(position)) return;
        const prevValue =
          typeof previousRatings[positionKey] === "number"
            ? previousRatings[positionKey]
            : null;
        const nextValue =
          typeof nextRatings[positionKey] === "number" ? nextRatings[positionKey] : null;
        if (nextValue !== null && nextValue !== prevValue) {
          entry.ratings.push({
            position,
            previous: prevValue,
            current: nextValue,
          });
        }
      });

      const pushAttributeChange = (
        key:
          | "injury"
          | "cards"
          | "form"
          | "stamina"
          | "tsi"
          | "salary"
          | "specialty"
          | "experience"
          | "leadership"
          | "loyalty"
          | "motherClubBonus",
        previousValue: number | string | boolean | null,
        currentValue: number | string | boolean | null
      ) => {
        if (currentValue === null || currentValue === undefined) return;
        if (previousValue === currentValue) return;
        entry.attributes.push({
          key,
          previous: previousValue,
          current: currentValue,
        });
      };

      const prevForm =
        typeof previousDetails?.Form === "number"
          ? previousDetails.Form
          : typeof previous?.Form === "number"
            ? previous.Form
            : null;
      const nextForm =
        typeof nextDetails?.Form === "number"
          ? nextDetails.Form
          : typeof player.Form === "number"
            ? player.Form
            : null;
      pushAttributeChange("form", prevForm, nextForm);

      const prevStamina =
        typeof previousDetails?.StaminaSkill === "number"
          ? previousDetails.StaminaSkill
          : typeof previous?.StaminaSkill === "number"
            ? previous.StaminaSkill
            : null;
      const nextStamina =
        typeof nextDetails?.StaminaSkill === "number"
          ? nextDetails.StaminaSkill
          : typeof player.StaminaSkill === "number"
            ? player.StaminaSkill
            : null;
      pushAttributeChange("stamina", prevStamina, nextStamina);

      const prevInjury =
        typeof previousDetails?.InjuryLevel === "number"
          ? previousDetails.InjuryLevel
          : typeof previous?.InjuryLevel === "number"
            ? previous.InjuryLevel
            : null;
      const nextInjury =
        typeof nextDetails?.InjuryLevel === "number"
          ? nextDetails.InjuryLevel
          : typeof player.InjuryLevel === "number"
            ? player.InjuryLevel
            : null;
      pushAttributeChange("injury", prevInjury, nextInjury);

      const prevCards =
        typeof previousDetails?.Cards === "number"
          ? previousDetails.Cards
          : typeof previous?.Cards === "number"
            ? previous.Cards
            : null;
      const nextCards =
        typeof nextDetails?.Cards === "number"
          ? nextDetails.Cards
          : typeof player.Cards === "number"
            ? player.Cards
            : null;
      pushAttributeChange("cards", prevCards, nextCards);

      pushAttributeChange(
        "tsi",
        typeof previousDetails?.TSI === "number"
          ? previousDetails.TSI
          : typeof previous?.TSI === "number"
            ? previous.TSI
            : null,
        typeof nextDetails?.TSI === "number"
          ? nextDetails.TSI
          : typeof player.TSI === "number"
            ? player.TSI
            : null
      );

      pushAttributeChange(
        "salary",
        typeof previousDetails?.Salary === "number"
          ? previousDetails.Salary
          : typeof previous?.Salary === "number"
            ? previous.Salary
            : null,
        typeof nextDetails?.Salary === "number"
          ? nextDetails.Salary
          : typeof player.Salary === "number"
            ? player.Salary
            : null
      );

      pushAttributeChange(
        "specialty",
        typeof previousDetails?.Specialty === "number"
          ? previousDetails.Specialty
          : typeof previous?.Specialty === "number"
            ? previous.Specialty
            : null,
        typeof nextDetails?.Specialty === "number"
          ? nextDetails.Specialty
          : typeof player.Specialty === "number"
            ? player.Specialty
            : null
      );

      pushAttributeChange(
        "experience",
        typeof previousDetails?.Experience === "number" ? previousDetails.Experience : null,
        typeof nextDetails?.Experience === "number" ? nextDetails.Experience : null
      );
      pushAttributeChange(
        "leadership",
        typeof previousDetails?.Leadership === "number" ? previousDetails.Leadership : null,
        typeof nextDetails?.Leadership === "number" ? nextDetails.Leadership : null
      );
      pushAttributeChange(
        "loyalty",
        typeof previousDetails?.Loyalty === "number" ? previousDetails.Loyalty : null,
        typeof nextDetails?.Loyalty === "number" ? nextDetails.Loyalty : null
      );
      pushAttributeChange(
        "motherClubBonus",
        typeof previousDetails?.MotherClubBonus === "boolean"
          ? previousDetails.MotherClubBonus
          : null,
        typeof nextDetails?.MotherClubBonus === "boolean" ? nextDetails.MotherClubBonus : null
      );
    });

    const hasChanges = Object.values(groupedByPlayerId).some(
      (entry) =>
        entry.isNewPlayer ||
        entry.skills.length > 0 ||
        entry.ratings.length > 0 ||
        entry.attributes.length > 0
    );
    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      comparedAt: Date.now(),
      hasChanges,
      groupedByPlayerId,
    };
  };

  const refreshAll = async (reason: "manual" | "stale") => {
    if (refreshing) return false;
    const refreshRunId = ++refreshRunSeqRef.current;
    activeRefreshRunIdRef.current = refreshRunId;
    stoppedRefreshRunIdsRef.current.delete(refreshRunId);
    const isStopped = () =>
      stoppedRefreshRunIdsRef.current.has(refreshRunId) ||
      activeRefreshRunIdRef.current !== refreshRunId;
    const forceResetRatingsAlgorithm =
      !hasCurrentSeniorRatingsAlgorithmVersion(ratingsResponse);
    const effectiveRatingsResponse = forceResetRatingsAlgorithm ? null : ratingsResponse;

    if (forceResetRatingsAlgorithm) {
      suppressNextUpdatesRecordingRef.current = true;
      persistedMarkersBaselineRef.current = {
        players,
        ratingsByPlayerId: {},
      };
      setRatingsResponse(null);
      setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
      setUpdatesHistory([]);
      setSelectedUpdatesId(null);
    }

    const persistedMarkersBaseline = persistedMarkersBaselineRef.current;
    const usePersistedMarkersBaseline = Boolean(persistedMarkersBaseline);
    const previousPlayers =
      usePersistedMarkersBaseline && persistedMarkersBaseline
        ? persistedMarkersBaseline.players
        : players;
    const previousRatings =
      forceResetRatingsAlgorithm
        ? {}
        : usePersistedMarkersBaseline && persistedMarkersBaseline
        ? persistedMarkersBaseline.ratingsByPlayerId
        : ratingsByPlayerId;
    const previousDetailsById = new Map(detailsById);

    setRefreshing(true);
    setRefreshStatus(messages.refreshStatusFetchingPlayers);
    setRefreshProgressPct(10);
    setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
    let didBootstrapRatings = false;

    try {
      const nextPlayers = await fetchPlayers(resolvedSeniorTeamId);
      if (isStopped()) return false;

      setRefreshStatus(messages.refreshStatusFetchingPlayerDetails);
      setRefreshProgressPct(30);
      const detailsRefreshed = await refreshDetailsForPlayers(
        nextPlayers,
        {
          isStopped,
          onProgress: (detailsCompleted, totalPlayers) => {
            if (!isStopped()) {
              const pct = Math.round((detailsCompleted / Math.max(1, totalPlayers)) * 15);
              setRefreshProgressPct(30 + pct);
            }
          },
        }
      );
      if (!detailsRefreshed || isStopped()) return false;
      const nextDetailsById = new Map(detailsById);
      Object.entries(detailsRefreshed).forEach(([id, detail]) => {
        const parsedId = Number(id);
        if (!Number.isFinite(parsedId)) return;
        nextDetailsById.set(parsedId, detail);
      });

      setRefreshStatus(messages.refreshStatusFetchingMatches);
      setRefreshProgressPct(45);
      const nextMatches = await fetchMatches(resolvedSeniorTeamId);
      if (isStopped()) return false;

      setRefreshStatus(messages.refreshStatusFetchingRatings);
      setRefreshProgressPct(60);
      const shouldBootstrapRatings = !hasUsableSeniorRatingsMatrix(effectiveRatingsResponse);
      didBootstrapRatings = shouldBootstrapRatings;
      const nextRatings = shouldBootstrapRatings
        ? await (async () => {
            const currentSeason = await fetchCurrentSeason();
            if (isStopped()) return null;
            setRefreshProgressPct(72);
            const previousSeasonRatings = await fetchRatings(
              resolvedSeniorTeamId,
              Math.max(1, currentSeason - 1)
            );
            if (isStopped()) return null;
            setRefreshProgressPct(84);
            const currentSeasonRatings = await fetchRatings(
              resolvedSeniorTeamId,
              currentSeason
            );
            if (isStopped()) return null;
            setRefreshProgressPct(90);
            return stampSeniorRatingsAlgorithmVersion(
              mergeRatingsMatrices(previousSeasonRatings, currentSeasonRatings)
            );
          })()
        : await (async () => {
            const fromTs =
              typeof effectiveRatingsResponse?.lastAppliedMatchDateTime === "number" &&
              Number.isFinite(effectiveRatingsResponse.lastAppliedMatchDateTime) &&
              effectiveRatingsResponse.lastAppliedMatchDateTime > 0
                ? Math.floor(effectiveRatingsResponse.lastAppliedMatchDateTime)
                : null;
            const fromMatchId =
              typeof effectiveRatingsResponse?.lastAppliedMatchId === "number" &&
              Number.isFinite(effectiveRatingsResponse.lastAppliedMatchId) &&
              effectiveRatingsResponse.lastAppliedMatchId > 0
                ? Math.floor(effectiveRatingsResponse.lastAppliedMatchId)
                : null;
            const firstMatchDate =
              fromTs !== null ? formatArchiveDateTimeParam(fromTs) : null;
            const lastMatchDate = formatArchiveDateTimeParam(Date.now());
            setRefreshProgressPct(72);
            const incrementalRatings = await fetchRatings(
              resolvedSeniorTeamId,
              undefined,
              fromTs,
              fromMatchId,
              firstMatchDate,
              lastMatchDate
            );
            if (isStopped()) return null;
            setRefreshProgressPct(90);
            return stampSeniorRatingsAlgorithmVersion(
              applyRatingsDelta(
                effectiveRatingsResponse ?? {
                  ratingsAlgorithmVersion: SENIOR_RATINGS_ALGO_VERSION,
                  positions: [],
                  players: [],
                  matchesAnalyzed: 0,
                  lastAppliedMatchId: null,
                  lastAppliedMatchDateTime: null,
                },
                incrementalRatings
              )
            );
          })();
      if (!nextRatings) return false;
      if (isStopped()) return false;
      let nextTrainingType: number | null | undefined = undefined;
      try {
        nextTrainingType = await fetchTrainingType(resolvedSeniorTeamId);
      } catch {
        // Keep refresh flow intact even if training endpoint fails.
      }

      setPlayers(nextPlayers);
      setMatchesState(nextMatches);
      setRatingsResponse(nextRatings);
      if (nextTrainingType !== undefined) {
        setTrainingType(sanitizeTrainingType(nextTrainingType));
      }
      setLoadError(null);
      setLoadErrorDetails(null);

      if (selectedId && !nextPlayers.some((player) => player.PlayerID === selectedId)) {
        setSelectedId(null);
      }

      const nextRatingsById: Record<number, Record<string, number>> = {};
      nextRatings.players.forEach((row) => {
        nextRatingsById[row.id] = { ...row.ratings };
      });

      const updatesEntry = buildUpdatesEntry(
        previousPlayers,
        nextPlayers,
        previousDetailsById,
        nextDetailsById,
        previousRatings,
        nextRatingsById
      );
      if (suppressNextUpdatesRecordingRef.current) {
        suppressNextUpdatesRecordingRef.current = false;
        setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
        setUpdatesHistory([]);
        setSelectedUpdatesId(null);
      } else if (didBootstrapRatings) {
        setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
      } else if (updatesEntry.hasChanges) {
        setMatrixNewMarkers(buildSeniorMatrixMarkersFromUpdatesEntry(updatesEntry));
        setUpdatesHistory((prev) => [updatesEntry, ...prev].slice(0, UPDATES_HISTORY_LIMIT));
        setSelectedUpdatesId(updatesEntry.id);
      }
      if (usePersistedMarkersBaseline) {
        persistedMarkersBaselineRef.current = null;
      }

      const refreshedAt = Date.now();
      writeStoredLastRefresh(refreshedAt, lastRefreshStorageKey);
      setLastRefreshAt(refreshedAt);
      setRefreshStatus(null);
      setRefreshProgressPct(100);
      setRefreshProgressPct(0);
      if (didBootstrapRatings) {
        addNotification(messages.notificationSeniorRatingsBootstrapComplete);
      }
      addNotification(
        reason === "stale"
          ? messages.notificationStaleRefresh
          : messages.notificationPlayersRefreshed
      );
      return true;
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) {
        return false;
      }
      const details =
        error instanceof Error ? error.message : String(error ?? messages.unableToLoadPlayers);
      setLoadError(messages.unableToLoadPlayers);
      setLoadErrorDetails(details);
      addNotification(messages.unableToLoadPlayers);
      return false;
    } finally {
      if (activeRefreshRunIdRef.current === refreshRunId) {
        activeRefreshRunIdRef.current = null;
      }
      stoppedRefreshRunIdsRef.current.delete(refreshRunId);
      setRefreshing(false);
      setRefreshStatus(null);
      setRefreshProgressPct(0);
    }
  };

  const onRefreshMatchesOnly = async () => {
    const hasRequiredScopes = await ensureRequiredScopes();
    if (!hasRequiredScopes) return false;
    try {
      const nextMatches = await fetchMatches(resolvedSeniorTeamId);
      setMatchesState(nextMatches);
      return true;
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return false;
      return false;
    }
  };

  const handleSeniorTeamChange = (nextTeamId: number | null) => {
    if (nextTeamId === selectedSeniorTeamId) return;
    staleRefreshAttemptedRef.current = false;
    setSelectedId(null);
    setAssignments({});
    setBehaviors({});
    setLoadedMatchId(null);
    setPlayers([]);
    setMatchesState({});
    setRatingsResponse(null);
    setDetailsCache({});
    setUpdatesHistory([]);
    setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
    setSelectedUpdatesId(null);
    setOrderedPlayerIds(null);
    setOrderSource(null);
    setLoadError(null);
    setLoadErrorDetails(null);
    setSelectedSeniorTeamId(nextTeamId);
    if (nextTeamId) {
      const teamName =
        seniorTeams.find((team) => team.teamId === nextTeamId)?.teamName ?? nextTeamId;
      addNotification(`${messages.notificationTeamSwitched} ${teamName}`);
    }
  };

  const ensureRequiredScopes = async () => {
    try {
      const response = await fetch("/api/chpp/oauth/check-token", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            permissions?: string[];
            raw?: string;
          }
        | null;
      if (!response.ok) {
        setScopeReconnectModalOpen(true);
        return false;
      }
      const grantedPermissions = Array.isArray(payload?.permissions)
        ? payload.permissions
        : [];
      const missingPermissions = getMissingChppPermissions(
        grantedPermissions,
        REQUIRED_CHPP_EXTENDED_PERMISSIONS
      );
      const rawTokenCheck = typeof payload?.raw === "string" ? payload.raw : "";
      const hasScopeTag = /<Scope>/i.test(rawTokenCheck);
      const scopeTokens = hasScopeTag
        ? parseExtendedPermissionsFromCheckToken(rawTokenCheck)
        : [];
      const missingDefaultScope = hasScopeTag && !scopeTokens.includes("default");
      if (missingPermissions.length > 0 || missingDefaultScope) {
        setScopeReconnectModalOpen(true);
        return false;
      }
    } catch {
      setScopeReconnectModalOpen(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    refreshAllRef.current = refreshAll;
  }, [refreshAll]);

  const allMatches = useMemo<Match[]>(
    () => {
      const list =
        matchesState.data?.HattrickData?.MatchList?.Match ??
        matchesState.data?.HattrickData?.Team?.MatchList?.Match;
      if (!list) return [];
      return Array.isArray(list) ? list : [list];
    },
    [matchesState]
  );

  const matchTypeLabel = (matchType: number | null) => {
    if (matchType === null) return messages.matchTypeUnknown;
    switch (matchType) {
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
        return `${messages.matchTypeUnknown} ${matchType}`;
    }
  };

  const classifyRequestedTypes = (selectedMatchType: number | null) => {
    if (selectedMatchType !== null && FRIENDLY_MATCH_TYPES.has(selectedMatchType)) {
      return FRIENDLY_MATCH_TYPES;
    }
    if (selectedMatchType !== null && TOURNAMENT_MATCH_TYPES.has(selectedMatchType)) {
      return TOURNAMENT_MATCH_TYPES;
    }
    return LEAGUE_CUP_QUALI_MATCH_TYPES;
  };

  const tacticTypeLabel = (tacticType: number | null) => {
    if (tacticType === null) return messages.unknownShort;
    switch (tacticType) {
      case 0:
        return messages.tacticNormal;
      case 1:
        return messages.tacticPressing;
      case 2:
        return messages.tacticCounterAttacks;
      case 3:
        return messages.tacticAttackMiddle;
      case 4:
        return messages.tacticAttackWings;
      case 7:
        return messages.tacticPlayCreatively;
      case 8:
        return messages.tacticLongShots;
      default:
        return `${messages.tacticLabel} ${tacticType}`;
    }
  };

  const pickMostCommonTactic = (rows: OpponentFormationRow[]): number | null => {
    const rowsWithTactic = rows.filter(
      (row): row is OpponentFormationRow & { tacticType: number } =>
        typeof row.tacticType === "number"
    );
    if (!rowsWithTactic.length) return null;
    const counts = new Map<number, number>();
    rowsWithTactic.forEach((row) => {
      counts.set(row.tacticType, (counts.get(row.tacticType) ?? 0) + 1);
    });
    const topCount = Math.max(...Array.from(counts.values()));
    const tied = Array.from(counts.entries())
      .filter(([, count]) => count === topCount)
      .map(([tactic]) => tactic);
    if (tied.length === 1) return tied[0] ?? null;
    const tiedRows = rowsWithTactic
      .filter((row) => tied.includes(row.tacticType))
      .sort(
        (left, right) =>
          (parseChppDate(right.matchDate)?.getTime() ?? 0) -
          (parseChppDate(left.matchDate)?.getTime() ?? 0)
      );
    return tiedRows[0]?.tacticType ?? null;
  };

  const fetchOpponentFormationRowsForMatch = async (matchId: number) => {
    const teamIdValue = Number(matchesState?.data?.HattrickData?.Team?.TeamID ?? 0);
    if (!Number.isFinite(teamIdValue) || teamIdValue <= 0) return null;
    const selectedMatch = allMatches.find((match) => Number(match.MatchID) === matchId);
    if (!selectedMatch) return null;
    const homeTeamId = Number(selectedMatch.HomeTeam?.HomeTeamID ?? 0);
    const awayTeamId = Number(selectedMatch.AwayTeam?.AwayTeamID ?? 0);
    const opponentTeamId =
      homeTeamId === teamIdValue
        ? awayTeamId
        : awayTeamId === teamIdValue
          ? homeTeamId
          : 0;
    if (!opponentTeamId) return null;
    const opponentName =
      homeTeamId === teamIdValue
        ? selectedMatch.AwayTeam?.AwayTeamName
        : selectedMatch.HomeTeam?.HomeTeamName;
    const selectedMatchType = Number.isFinite(Number(selectedMatch.MatchType))
      ? Number(selectedMatch.MatchType)
      : null;
    const requestedTypes = classifyRequestedTypes(selectedMatchType);
    const includeHtoArchive =
      selectedMatchType !== null && TOURNAMENT_MATCH_TYPES.has(selectedMatchType);
    const selectedMatchSourceSystem =
      typeof (selectedMatch as Record<string, unknown>).SourceSystem === "string" &&
      String((selectedMatch as Record<string, unknown>).SourceSystem).trim().length > 0
        ? String((selectedMatch as Record<string, unknown>).SourceSystem)
        : selectedMatchType !== null && TOURNAMENT_MATCH_TYPES.has(selectedMatchType)
          ? "htointegrated"
          : "Hattrick";
    const { response: archiveResponse, payload: archivePayload } = await fetchChppJson<{
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
      details?: string;
    }>(
      `/api/chpp/matchesarchive?teamId=${opponentTeamId}${
        includeHtoArchive ? "&includeHTO=true" : ""
      }`,
      { cache: "no-store" }
    );
    if (!archiveResponse.ok || archivePayload?.error) {
      throw new Error(
        archivePayload?.details ?? archivePayload?.error ?? messages.unableToLoadMatches
      );
    }
    const archiveRaw = archivePayload?.data?.HattrickData?.Team?.MatchList?.Match;
    const archiveMatches = Array.isArray(archiveRaw) ? archiveRaw : archiveRaw ? [archiveRaw] : [];
    const scopedMatches = archiveMatches
      .map((item) => {
        const match = (item ?? {}) as Record<string, unknown>;
        const candidateMatchId = parseNumber(match.MatchID);
        if (!candidateMatchId || candidateMatchId <= 0) return null;
        const candidateMatchType = parseNumber(match.MatchType);
        if (candidateMatchType === null || !requestedTypes.has(candidateMatchType)) {
          return null;
        }
        return {
          matchId: candidateMatchId,
          matchType: candidateMatchType,
          matchDate: typeof match.MatchDate === "string" ? String(match.MatchDate) : null,
          sourceSystem:
            typeof match.SourceSystem === "string" && match.SourceSystem
              ? String(match.SourceSystem)
              : "Hattrick",
        };
      })
      .filter(
        (
          entry
        ): entry is {
          matchId: number;
          matchType: number;
          matchDate: string | null;
          sourceSystem: string;
        } => Boolean(entry)
      )
      .sort(
        (left, right) =>
          (parseChppDate(right.matchDate)?.getTime() ?? 0) -
          (parseChppDate(left.matchDate)?.getTime() ?? 0)
      )
      .slice(0, OPPONENT_ARCHIVE_LIMIT);
    const rows = await mapWithConcurrency(
      scopedMatches,
      OPPONENT_DETAILS_CONCURRENCY,
      async (entry) => {
        const { response: detailsResponse, payload: detailsPayload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              Match?: {
                HomeTeam?: Record<string, unknown>;
                AwayTeam?: Record<string, unknown>;
              };
            };
          };
          error?: string;
        }>(
          `/api/chpp/matchdetails?matchId=${entry.matchId}&sourceSystem=${encodeURIComponent(
            entry.sourceSystem
          )}`,
          { cache: "no-store" }
        );
        if (!detailsResponse.ok || detailsPayload?.error) {
          return {
            ...entry,
            againstMyTeam: false,
            formation: null,
            tacticType: null,
            tacticSkill: null,
            ratingMidfield: null,
            ratingRightDef: null,
            ratingMidDef: null,
            ratingLeftDef: null,
            ratingRightAtt: null,
            ratingMidAtt: null,
            ratingLeftAtt: null,
          } as OpponentFormationRow;
        }
        const match = detailsPayload?.data?.HattrickData?.Match;
        const home = match?.HomeTeam;
        const away = match?.AwayTeam;
        const homeId = parseNumber(home?.HomeTeamID);
        const awayId = parseNumber(away?.AwayTeamID);
        const againstMyTeam = homeId === teamIdValue || awayId === teamIdValue;
        const isOpponentHome = homeId === opponentTeamId;
        return {
          ...entry,
          againstMyTeam,
          formation: isOpponentHome
            ? typeof home?.Formation === "string"
              ? String(home.Formation)
              : null
            : awayId === opponentTeamId
              ? typeof away?.Formation === "string"
                ? String(away.Formation)
                : null
              : null,
          tacticType: isOpponentHome
            ? parseNumber(home?.TacticType)
            : parseNumber(away?.TacticType),
          tacticSkill: isOpponentHome
            ? parseNumber(home?.TacticSkill)
            : parseNumber(away?.TacticSkill),
          ratingMidfield: isOpponentHome
            ? parseNumber(home?.RatingMidfield)
            : parseNumber(away?.RatingMidfield),
          ratingRightDef: isOpponentHome
            ? parseNumber(home?.RatingRightDef)
            : parseNumber(away?.RatingRightDef),
          ratingMidDef: isOpponentHome
            ? parseNumber(home?.RatingMidDef)
            : parseNumber(away?.RatingMidDef),
          ratingLeftDef: isOpponentHome
            ? parseNumber(home?.RatingLeftDef)
            : parseNumber(away?.RatingLeftDef),
          ratingRightAtt: isOpponentHome
            ? parseNumber(home?.RatingRightAtt)
            : parseNumber(away?.RatingRightAtt),
          ratingMidAtt: isOpponentHome
            ? parseNumber(home?.RatingMidAtt)
            : parseNumber(away?.RatingMidAtt),
          ratingLeftAtt: isOpponentHome
            ? parseNumber(home?.RatingLeftAtt)
            : parseNumber(away?.RatingLeftAtt),
        } as OpponentFormationRow;
      }
    );
    return {
      teamIdValue,
      opponentTeamId,
      opponentName: opponentName ?? messages.unknownLabel,
      selectedMatchType,
      selectedMatchSourceSystem,
      rows,
    };
  };

  const runSetBestLineupPredictRatings = async (
    matchId: number,
    mode: SetBestLineupMode,
    fixedFormationOverride?: string | null
  ) => {
    try {
      const opponentContext = await fetchOpponentFormationRowsForMatch(matchId);
      if (!opponentContext) return;
      const { opponentName, selectedMatchType, teamIdValue, selectedMatchSourceSystem } =
        opponentContext;
      if (showSetBestLineupDebugModal) {
        setOpponentFormationsModal({
          title: `${messages.setBestLineup} · ${opponentName}`,
          mode,
          opponentRows: [],
          chosenFormation: null,
          chosenFormationAverages: null,
          generatedRows: [],
          fixedFormation: fixedFormationOverride ?? null,
          fixedFormationTacticRows: [],
          selectedGeneratedFormation: null,
          selectedGeneratedTactic: null,
          selectedRejectedPlayerIds: [],
          selectedIneligiblePlayerIds: [],
          selectedComparison: null,
          loading: true,
          error: null,
        });
      }

      let activeTrainingType = trainingType;
      try {
        activeTrainingType = sanitizeTrainingType(await fetchTrainingType());
        setTrainingType(activeTrainingType);
      } catch {
        // Keep best-lineup flow intact even if training endpoint fails.
      }

      const opponentRows = opponentContext.rows;
      const chosenFormation = chooseFormationByRules(opponentRows);
      const chosenFormationAverages = computeChosenFormationAverages(
        opponentRows,
        chosenFormation
      );

      let ratingsById = ratingsByPlayerId;
      if (!hasUsableSeniorRatingsMatrix(ratingsResponse)) {
        const currentSeason = await fetchCurrentSeason();
        const refreshedRatings = stampSeniorRatingsAlgorithmVersion(
          await bootstrapRatingsFromSeasons(resolvedSeniorTeamId, currentSeason)
        );
        setRatingsResponse(refreshedRatings);
        ratingsById = {};
        (refreshedRatings.players ?? []).forEach((row) => {
          ratingsById[row.id] = { ...row.ratings };
        });
      }

      const playerPool = players
        .map((player) => {
          const details = detailsById.get(player.PlayerID);
          const cardsValue =
            typeof details?.Cards === "number"
              ? details.Cards
              : typeof player.Cards === "number"
                ? player.Cards
                : null;
          return {
            player,
            details,
            cardsValue,
          };
        })
        .map((player) => {
          const details = player.details;
          const injuryLevel =
            typeof details?.InjuryLevel === "number"
              ? details.InjuryLevel
              : typeof player.player.InjuryLevel === "number"
                ? player.player.InjuryLevel
                : null;
          return {
            id: player.player.PlayerID,
            name: formatPlayerName(player.player) || String(player.player.PlayerID),
            injuryLevel,
            cardsValue: player.cardsValue,
          };
        })
        .filter((player) => {
          if (typeof player.injuryLevel === "number" && player.injuryLevel >= 1) {
            return false;
          }
          const isLeagueCupTarget =
            selectedMatchType !== null &&
            LEAGUE_CUP_QUALI_MATCH_TYPES.has(selectedMatchType);
          if (isLeagueCupTarget && typeof player.cardsValue === "number" && player.cardsValue >= 3) {
            return false;
          }
          if (
            effectiveExtraTimeBTeamEnabled &&
            extraTimeDisregardedPlayerIds.has(player.id)
          ) {
            return false;
          }
          return true;
        })
        .map(({ id, name }) => ({ id, name }));
      if (playerPool.length < 11) {
        throw new Error(messages.submitOrdersMinPlayers);
      }
      const buildAssignmentsForOrderedSlots = (orderedSlots: string[]) => {
        const availablePlayers = [...playerPool];
        const assignmentsForFormation: LineupAssignments = {};
        const slotRatingsForFormation: Record<string, number | null> = {};
        const usedPlayerIds = new Set<number>();
        const ratingFor = (playerId: number, code: number) =>
          typeof ratingsById[playerId]?.[String(code)] === "number"
            ? (ratingsById[playerId]?.[String(code)] as number)
            : -1;
        const bestInSector = (playerId: number, sector: PlayerSector) =>
          Math.max(
            ...SECTOR_TO_RATING_CODES[sector].map((code) => ratingFor(playerId, code))
          );

        orderedSlots.forEach((slot) => {
          const roleCode = SLOT_TO_RATING_CODE[slot];
          const slotSector = SLOT_TO_SECTOR[slot];
          availablePlayers.sort((left, right) => {
            const leftRating = ratingFor(left.id, roleCode);
            const rightRating = ratingFor(right.id, roleCode);
            if (rightRating !== leftRating) {
              return rightRating - leftRating;
            }
            return left.name.localeCompare(right.name);
          });
          const selectedIndex = availablePlayers.findIndex((candidate) => {
            const slotRating = ratingFor(candidate.id, roleCode);
            if (slotRating < 0) return false;
            const bestOtherSector = (Object.keys(SECTOR_TO_RATING_CODES) as PlayerSector[])
              .filter((sector) => sector !== slotSector)
              .reduce(
                (best, sector) => Math.max(best, bestInSector(candidate.id, sector)),
                -1
              );
            return bestOtherSector < slotRating;
          });
          const selectedPlayer =
            selectedIndex >= 0
              ? (availablePlayers.splice(selectedIndex, 1)[0] ?? null)
              : null;
          if (!selectedPlayer) return;
          assignmentsForFormation[slot] = selectedPlayer.id;
          slotRatingsForFormation[slot] =
            typeof ratingsById[selectedPlayer.id]?.[String(roleCode)] === "number"
              ? ratingsById[selectedPlayer.id]?.[String(roleCode)]
              : null;
          usedPlayerIds.add(selectedPlayer.id);
        });

        return {
          assignments: assignmentsForFormation,
          slotRatings: slotRatingsForFormation,
          usedPlayerIds,
        };
      };
      const assignmentCount = (assignmentsForFormation: LineupAssignments) =>
        Object.values(assignmentsForFormation).filter(
          (id): id is number => typeof id === "number" && id > 0
        ).length;
      const buildBaseRowForShape = (shape: {
        defenders: number;
        midfielders: number;
        attackers: number;
      }) => {
        if (
          mode === "trainingAware" &&
          !trainingAwareShapeAllowed(shape, activeTrainingType)
        ) {
          return null;
        }
        const occupiedSlots = occupiedSlotsForFormationShape(shape);
        if (mode === "trainingAware") {
          const requiredSlots = requiredTrainableSlots(activeTrainingType);
          if (requiredSlots.some((slot) => !occupiedSlots.includes(slot))) {
            return null;
          }
        }
        const orderedSlots = orderFormationSlotsForTraining(
          occupiedSlots,
          mode === "trainingAware" ? activeTrainingType : null
        );
        const resolvedPass = buildAssignmentsForOrderedSlots(orderedSlots);
        if (assignmentCount(resolvedPass.assignments) < 11) {
          return null;
        }
        return {
          formation: `${shape.defenders}-${shape.midfielders}-${shape.attackers}`,
          assignments: resolvedPass.assignments,
          slotRatings: resolvedPass.slotRatings,
          rejectedPlayerIds: [],
          predicted: null,
          error: null,
        } as GeneratedFormationRow;
      };

      const predictRatingsForLineup = async (
        assignmentsForFormation: LineupAssignments,
        nextTacticType: number
      ) => {
        const lineup = buildLineupPayload(assignmentsForFormation, nextTacticType);
        const { response, payload } = await fetchChppJson<{
          data?: { HattrickData?: { MatchData?: Record<string, unknown> } };
          error?: string;
          details?: string;
        }>("/api/chpp/matchorders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId,
            teamId: teamIdValue,
            sourceSystem: selectedMatchSourceSystem,
            actionType: "predictratings",
            lineup,
          }),
        });
        if (!response.ok || payload?.error) {
          throw new Error(payload?.details ?? payload?.error ?? messages.submitOrdersError);
        }
        const matchData = payload?.data?.HattrickData?.MatchData ?? {};
        return {
          tacticType: parseNumber(matchData.TacticType),
          tacticSkill: parseNumber(matchData.TacticSkill),
          ratingMidfield: parseNumber(matchData.RatingMidfield),
          ratingRightDef: parseNumber(matchData.RatingRightDef),
          ratingMidDef: parseNumber(matchData.RatingMidDef),
          ratingLeftDef: parseNumber(matchData.RatingLeftDef),
          ratingRightAtt: parseNumber(matchData.RatingRightAtt),
          ratingMidAtt: parseNumber(matchData.RatingMidAtt),
          ratingLeftAtt: parseNumber(matchData.RatingLeftAtt),
        } satisfies PredictedRatings;
      };

      const baseRows =
        mode === "fixedFormation"
          ? (() => {
              const targetFormation =
                typeof fixedFormationOverride === "string" ? fixedFormationOverride : null;
              const targetShape =
                targetFormation && FIXED_FORMATION_OPTIONS.includes(
                  targetFormation as (typeof FIXED_FORMATION_OPTIONS)[number]
                )
                  ? parseFormationShape(targetFormation)
                  : null;
              if (!targetFormation || !targetShape) {
                throw new Error(messages.setBestLineupOptimizeByFormationDisabledTooltip);
              }
              const row = buildBaseRowForShape(targetShape);
              if (!row) {
                throw new Error(messages.setBestLineupOptimizeByFormationUnavailable);
              }
              return [row];
            })()
          : generateFormationShapes()
              .map((shape) => buildBaseRowForShape(shape))
              .filter((row): row is GeneratedFormationRow => Boolean(row));

      const rows =
        mode === "fixedFormation"
          ? baseRows
          : await mapWithConcurrency(
              baseRows,
              FORMATION_PREDICT_CONCURRENCY,
              async (row) => {
                try {
                  return {
                    ...row,
                    predicted: await predictRatingsForLineup(row.assignments, tacticType),
                    rejectedPlayerIds: row.rejectedPlayerIds,
                    error: null,
                  } as GeneratedFormationRow;
                } catch (error) {
                  const details =
                    error instanceof Error ? error.message : messages.submitOrdersError;
                  return {
                    ...row,
                    predicted: null,
                    rejectedPlayerIds: row.rejectedPlayerIds,
                    error: details,
                  } as GeneratedFormationRow;
                }
              }
            );

      let selectedGeneratedFormation: string | null = null;
      let selectedGeneratedTactic: number | null = null;
      let selectedRejectedPlayerIds: number[] = [];
      let selectedComparison:
        | {
            ours: CollectiveRatings;
            opponent: CollectiveRatings;
          }
        | null = null;
      let fixedFormationTacticRows: FixedFormationTacticRow[] = [];

      const applyChosenAssignments = (
        chosenAssignmentsBase: LineupAssignments,
        chosenTactic: number
      ) => {
        const chosenAssignments: LineupAssignments = { ...chosenAssignmentsBase };
        const used = new Set<number>(
          Object.values(chosenAssignments).filter(
            (id): id is number => typeof id === "number" && id > 0
          )
        );
        const remaining = players
          .filter(
            (player) =>
              !used.has(player.PlayerID) &&
              isSeniorAiEligiblePlayer(player) &&
              (!effectiveExtraTimeBTeamEnabled ||
                !extraTimeDisregardedPlayerIds.has(player.PlayerID))
          )
          .map((player) => ({
            id: player.PlayerID,
            name: formatPlayerName(player) || String(player.PlayerID),
          }));
        const pickBestForCode = (code: number) => {
          if (remaining.length === 0) return null;
          remaining.sort((left, right) => {
            const leftValue =
              typeof ratingsById[left.id]?.[String(code)] === "number"
                ? ratingsById[left.id]?.[String(code)]
                : -1;
            const rightValue =
              typeof ratingsById[right.id]?.[String(code)] === "number"
                ? ratingsById[right.id]?.[String(code)]
                : -1;
            if (rightValue !== leftValue) return rightValue - leftValue;
            return left.name.localeCompare(right.name);
          });
          return remaining.shift() ?? null;
        };
        const pickBestAny = () => {
          if (remaining.length === 0) return null;
          remaining.sort((left, right) => {
            const score = (id: number) =>
              [100, 101, 103, 106, 107, 111].reduce((sum, code) => {
                const value = ratingsById[id]?.[String(code)];
                return sum + (typeof value === "number" ? value : 0);
              }, 0);
            return score(right.id) - score(left.id) || left.name.localeCompare(right.name);
          });
          return remaining.shift() ?? null;
        };
        const benchPlan: Array<{ slot: string; code: number | null }> = [
          { slot: "B_GK", code: 100 },
          { slot: "B_CD", code: 103 },
          { slot: "B_WB", code: 101 },
          { slot: "B_IM", code: 107 },
          { slot: "B_F", code: 111 },
          { slot: "B_W", code: 106 },
          { slot: "B_X", code: null },
        ];
        benchPlan.forEach((entry) => {
          const picked = entry.code === null ? pickBestAny() : pickBestForCode(entry.code);
          if (picked) {
            chosenAssignments[entry.slot] = picked.id;
          }
        });

        setAssignments(chosenAssignments);
        setBehaviors({});
        setTacticType(chosenTactic);
        setLoadedMatchId(matchId);
      };

      if (mode === "fixedFormation") {
        const fixedRow = baseRows[0] ?? null;
        if (fixedRow) {
          fixedFormationTacticRows = await mapWithConcurrency(
            [...AI_TACTIC_OPTIONS],
            FORMATION_PREDICT_CONCURRENCY,
            async (nextTacticType) => {
              try {
                const predicted = await predictRatingsForLineup(
                  fixedRow.assignments,
                  nextTacticType
                );
                return {
                  tacticType:
                    typeof predicted.tacticType === "number"
                      ? predicted.tacticType
                      : nextTacticType,
                  predicted,
                  error: null,
                } satisfies FixedFormationTacticRow;
              } catch (error) {
                return {
                  tacticType: nextTacticType,
                  predicted: null,
                  error:
                    error instanceof Error ? error.message : messages.submitOrdersError,
                } satisfies FixedFormationTacticRow;
              }
            }
          );

          const bestTacticRow =
            fixedFormationTacticRows
              .filter(
                (row): row is FixedFormationTacticRow & { predicted: PredictedRatings } =>
                  Boolean(row.predicted) && !row.error
              )
              .sort(
                (left, right) =>
                  fixedFormationTacticWeightedScore(
                    toCollectiveRatings(right.predicted)
                  ) -
                    fixedFormationTacticWeightedScore(
                      toCollectiveRatings(left.predicted)
                    ) ||
                  toCollectiveRatings(right.predicted).overall -
                    toCollectiveRatings(left.predicted).overall ||
                  toCollectiveRatings(right.predicted).attack -
                    toCollectiveRatings(left.predicted).attack ||
                  toCollectiveRatings(right.predicted).defense -
                    toCollectiveRatings(left.predicted).defense ||
                  toCollectiveRatings(right.predicted).midfield -
                    toCollectiveRatings(left.predicted).midfield
              )[0] ?? null;

          if (bestTacticRow?.predicted) {
            selectedGeneratedFormation = fixedRow.formation;
            selectedGeneratedTactic = bestTacticRow.tacticType;
            selectedRejectedPlayerIds = fixedRow.rejectedPlayerIds ?? [];
            applyChosenAssignments(fixedRow.assignments, bestTacticRow.tacticType);
          }
        }
      } else if (chosenFormationAverages) {
        const opponentCollective: CollectiveRatings = {
          midfield: chosenFormationAverages.ratingMidfield ?? 0,
          defense:
            (chosenFormationAverages.ratingRightDef ?? 0) +
            (chosenFormationAverages.ratingMidDef ?? 0) +
            (chosenFormationAverages.ratingLeftDef ?? 0),
          attack:
            (chosenFormationAverages.ratingRightAtt ?? 0) +
            (chosenFormationAverages.ratingMidAtt ?? 0) +
            (chosenFormationAverages.ratingLeftAtt ?? 0),
          overall: 0,
        };
        opponentCollective.overall =
          opponentCollective.midfield + opponentCollective.defense + opponentCollective.attack;

        const candidates = rows
          .filter((row) => row.predicted && !row.error)
          .map((row) => ({
            row,
            collective: toCollectiveRatings(row.predicted as PredictedRatings),
          }));

        const pickBest = (
          filterFn: (item: { row: GeneratedFormationRow; collective: CollectiveRatings }) => boolean
        ) =>
          candidates
            .filter(filterFn)
            .sort(
              (left, right) =>
                right.collective.overall - left.collective.overall ||
                right.collective.attack - left.collective.attack ||
                right.collective.defense - left.collective.defense ||
                right.collective.midfield - left.collective.midfield
            )[0] ?? null;

        const allSectorsWinner = pickBest(
          (item) =>
            item.collective.midfield > opponentCollective.midfield &&
            item.collective.defense > opponentCollective.defense &&
            item.collective.attack > opponentCollective.attack
        );
        const attackDefenseWinner = pickBest(
          (item) =>
            item.collective.attack > opponentCollective.attack &&
            item.collective.defense > opponentCollective.defense &&
            item.collective.midfield < opponentCollective.midfield
        );
        const defenseWinner = pickBest(
          (item) => item.collective.defense > opponentCollective.defense
        );
        const attackWinner = pickBest(
          (item) => item.collective.attack > opponentCollective.attack
        );
        const fallback = [...candidates].sort(
          (left, right) => right.collective.overall - left.collective.overall
        )[0];

        const chosenItem =
          allSectorsWinner ??
          attackDefenseWinner ??
          defenseWinner ??
          attackWinner ??
          fallback ??
          null;
        if (chosenItem) {
          const chosenTactic =
            allSectorsWinner && chosenItem.row.formation === allSectorsWinner.row.formation
              ? 0
              : attackDefenseWinner &&
                  chosenItem.row.formation === attackDefenseWinner.row.formation
                ? 2
                : 1;
          selectedGeneratedFormation = chosenItem.row.formation;
          selectedGeneratedTactic = chosenTactic;
          selectedRejectedPlayerIds = chosenItem.row.rejectedPlayerIds ?? [];
          selectedComparison = {
            ours: chosenItem.collective,
            opponent: opponentCollective,
          };
          applyChosenAssignments(chosenItem.row.assignments, chosenTactic);
        }
      }

      if (showSetBestLineupDebugModal) {
        setOpponentFormationsModal((prev) =>
          prev
            ? {
                ...prev,
                mode,
                opponentRows,
                chosenFormation,
                chosenFormationAverages,
                generatedRows: rows,
                fixedFormation: fixedFormationOverride ?? null,
                fixedFormationTacticRows,
                selectedGeneratedFormation,
                selectedGeneratedTactic,
                selectedRejectedPlayerIds,
                selectedIneligiblePlayerIds:
                  mode === "trainingAware" || mode === "ignoreTraining"
                    ? Array.from(extraTimeDisregardedPlayerIds)
                    : [],
                selectedComparison,
                loading: false,
                error: null,
              }
            : null
        );
      }
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
      const details = error instanceof Error ? error.message : messages.unableToLoadMatches;
      if (showSetBestLineupDebugModal) {
        setOpponentFormationsModal((prev) =>
          prev
            ? {
                ...prev,
                mode,
                opponentRows: [],
                chosenFormation: null,
                chosenFormationAverages: null,
                generatedRows: [],
                fixedFormation: fixedFormationOverride ?? null,
                fixedFormationTacticRows: [],
                selectedGeneratedFormation: null,
                selectedGeneratedTactic: null,
                selectedRejectedPlayerIds: [],
                selectedIneligiblePlayerIds: [],
                selectedComparison: null,
                loading: false,
                error: details,
              }
            : null
        );
      }
      addNotification(details);
    }
  };

  const handleAnalyzeOpponent = async (matchId: number) => {
    try {
      const opponentContext = await fetchOpponentFormationRowsForMatch(matchId);
      if (!opponentContext) return;
      const { opponentTeamId, opponentName } = opponentContext;
      setOpponentAnalysisModal({
        title: `${messages.analyzeOpponent} · ${opponentName}`,
        opponentTeamId,
        opponentName,
        opponentRows: [],
        preferredFormation: null,
        preferredTactic: null,
        versusFormation: null,
        versusTactic: null,
        formationDistribution: [],
        tacticDistribution: [],
        loading: true,
        error: null,
      });
      const opponentRows = opponentContext.rows;
      const preferredFormation = pickMostCommonFormation(opponentRows);
      const preferredTactic = preferredFormation
        ? pickMostCommonTactic(
            opponentRows.filter((row) => row.formation === preferredFormation)
          )
        : pickMostCommonTactic(opponentRows);
      const versusRows = opponentRows.filter((row) => row.againstMyTeam);
      const versusFormation = pickMostCommonFormation(versusRows);
      const versusTactic = versusFormation
        ? pickMostCommonTactic(versusRows.filter((row) => row.formation === versusFormation))
        : pickMostCommonTactic(versusRows);
      const formationCounts = new Map<string, number>();
      const tacticCounts = new Map<string, number>();
      opponentRows.forEach((row) => {
        const formationKey = row.formation ?? messages.unknownShort;
        formationCounts.set(formationKey, (formationCounts.get(formationKey) ?? 0) + 1);
        const tacticKey = tacticTypeLabel(row.tacticType);
        tacticCounts.set(tacticKey, (tacticCounts.get(tacticKey) ?? 0) + 1);
      });
      setOpponentAnalysisModal((current) =>
        current
          ? {
              ...current,
              opponentRows,
              preferredFormation,
              preferredTactic,
              versusFormation,
              versusTactic,
              formationDistribution: buildDistribution(formationCounts),
              tacticDistribution: buildDistribution(tacticCounts),
              loading: false,
              error: null,
            }
          : null
      );
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
      const details = error instanceof Error ? error.message : messages.unableToLoadMatches;
      setOpponentAnalysisModal((current) =>
        current
          ? {
              ...current,
              loading: false,
              error: details,
            }
          : null
      );
      addNotification(details);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    restoredStateStorageKeyRef.current = null;
    restoredDataStorageKeyRef.current = null;
    setStateRestored(false);
    setDataRestored(false);
    setSelectedId(null);
    setAssignments({});
    setBehaviors({});
    setLoadedMatchId(null);
    setTacticType(0);
    setTrainingType(null);
    setIncludeTournamentMatches(false);
    setUpdatesHistory([]);
    setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
    setSelectedUpdatesId(null);
    setActiveDetailsTab("details");
    setShowSeniorSkillBonusInMatrix(true);
    setExtraTimeBTeamEnabled(false);
    setExtraTimeBTeamMinutesThreshold(EXTRA_TIME_B_TEAM_DEFAULT_THRESHOLD);
    setExtraTimeBTeamRecentMatchState({
      status: "idle",
      recentMatch: null,
      playerMinutesById: {},
    });
    setExtraTimeSelectedPlayerIds([]);
    setExtraTimeMatrixTrainingType(null);
    setExtraTimeMatrixTrainingTypeManual(false);
    setOrderedPlayerIds(null);
    setOrderSource(null);
    setPlayers([]);
    setMatchesState({});
    setRatingsResponse(null);
    setDetailsCache({});
    setLoadError(null);
    setLoadErrorDetails(null);
    setLastRefreshAt(null);
    persistedMarkersBaselineRef.current = null;
    try {
      const rawSort = window.localStorage.getItem(listSortStorageKey);
      if (rawSort) {
        try {
          const parsed = JSON.parse(rawSort) as {
            sortKey?: SortKey;
            sortDirection?: SortDirection;
          };
          if (parsed.sortKey) setSortKey(parsed.sortKey);
          if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") {
            setSortDirection(parsed.sortDirection);
          }
        } catch {
          // ignore parse errors
        }
      }

      const rawState = window.localStorage.getItem(stateStorageKey);
      let forceWipeLegacyUpdatesState = false;
      const forceResetRatingsAlgorithm = false;
      if (forceResetRatingsAlgorithm) {
        suppressNextUpdatesRecordingRef.current = true;
      }
      if (rawState) {
        try {
          const parsed = JSON.parse(rawState) as {
            updatesSchemaVersion?: number;
            selectedId?: number | null;
            assignments?: LineupAssignments;
            behaviors?: LineupBehaviors;
            loadedMatchId?: number | null;
            tacticType?: number;
            trainingType?: number | null;
            setBestLineupFixedFormation?: string | null;
            includeTournamentMatches?: boolean;
            updatesHistory?: SeniorUpdatesGroupedEntry[];
            matrixNewMarkers?: SeniorMatrixNewMarkers;
            selectedUpdatesId?: string | null;
            activeDetailsTab?: PlayerDetailsPanelTab;
            showSeniorSkillBonusInMatrix?: boolean;
            extraTimeBTeamEnabled?: boolean;
            extraTimeBTeamMinutesThreshold?: number;
            extraTimeSelectedPlayerIds?: number[];
            extraTimeMatrixTrainingType?: number | null;
            extraTimeMatrixTrainingTypeManual?: boolean;
            orderedPlayerIds?: number[] | null;
            orderSource?: "list" | "ratings" | "skills" | null;
          };
          forceWipeLegacyUpdatesState =
            typeof parsed.updatesSchemaVersion !== "number" ||
            parsed.updatesSchemaVersion < SENIOR_UPDATES_SCHEMA_VERSION;
          if (forceWipeLegacyUpdatesState) {
            suppressNextUpdatesRecordingRef.current = true;
          }
          setSelectedId(typeof parsed.selectedId === "number" ? parsed.selectedId : null);
          setAssignments(parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {});
          setBehaviors(parsed.behaviors && typeof parsed.behaviors === "object" ? parsed.behaviors : {});
          setLoadedMatchId(typeof parsed.loadedMatchId === "number" ? parsed.loadedMatchId : null);
          setTacticType(typeof parsed.tacticType === "number" ? parsed.tacticType : 0);
          setTrainingType(
            sanitizeTrainingType(
              typeof parsed.trainingType === "number" ? parsed.trainingType : null
            )
          );
          setSetBestLineupFixedFormation(
            typeof parsed.setBestLineupFixedFormation === "string" &&
              FIXED_FORMATION_OPTIONS.includes(
                parsed.setBestLineupFixedFormation as (typeof FIXED_FORMATION_OPTIONS)[number]
              )
              ? parsed.setBestLineupFixedFormation
              : null
          );
          setIncludeTournamentMatches(Boolean(parsed.includeTournamentMatches));
          if (forceWipeLegacyUpdatesState) {
            setUpdatesHistory([]);
            setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
            setSelectedUpdatesId(null);
          } else {
            setUpdatesHistory(normalizeSeniorUpdatesHistory(parsed.updatesHistory));
            if (parsed.matrixNewMarkers) {
              setMatrixNewMarkers(normalizeSeniorMatrixNewMarkers(parsed.matrixNewMarkers));
            }
            setSelectedUpdatesId(
              typeof parsed.selectedUpdatesId === "string" ? parsed.selectedUpdatesId : null
            );
          }
          if (
            parsed.activeDetailsTab === "details" ||
            parsed.activeDetailsTab === "skillsMatrix" ||
            parsed.activeDetailsTab === "ratingsMatrix"
          ) {
            setActiveDetailsTab(parsed.activeDetailsTab);
          }
          if (typeof parsed.showSeniorSkillBonusInMatrix === "boolean") {
            setShowSeniorSkillBonusInMatrix(parsed.showSeniorSkillBonusInMatrix);
          }
          if (typeof parsed.extraTimeBTeamEnabled === "boolean") {
            setExtraTimeBTeamEnabled(parsed.extraTimeBTeamEnabled);
          }
          if (
            typeof parsed.extraTimeBTeamMinutesThreshold === "number" &&
            Number.isFinite(parsed.extraTimeBTeamMinutesThreshold)
          ) {
            setExtraTimeBTeamMinutesThreshold(
              Math.min(90, Math.max(1, Math.round(parsed.extraTimeBTeamMinutesThreshold)))
            );
          }
          if (Array.isArray(parsed.extraTimeSelectedPlayerIds)) {
            setExtraTimeSelectedPlayerIds(
              parsed.extraTimeSelectedPlayerIds.filter(
                (id): id is number => Number.isFinite(id)
              )
            );
          }
          const parsedTrainingType = sanitizeTrainingType(
            typeof parsed.trainingType === "number" ? parsed.trainingType : null
          );
          const parsedExtraTimeTrainingType = sanitizeTrainingType(
            typeof parsed.extraTimeMatrixTrainingType === "number"
              ? parsed.extraTimeMatrixTrainingType
              : null
          );
          const parsedExtraTimeManual =
            typeof parsed.extraTimeMatrixTrainingTypeManual === "boolean"
              ? parsed.extraTimeMatrixTrainingTypeManual
              : parsedExtraTimeTrainingType !== null &&
                parsedExtraTimeTrainingType !== parsedTrainingType;
          setExtraTimeMatrixTrainingType(parsedExtraTimeTrainingType);
          setExtraTimeMatrixTrainingTypeManual(parsedExtraTimeManual);
          if (Array.isArray(parsed.orderedPlayerIds)) {
            setOrderedPlayerIds(
              parsed.orderedPlayerIds.filter((id): id is number => Number.isFinite(id))
            );
          }
          if (
            parsed.orderSource === "list" ||
            parsed.orderSource === "ratings" ||
            parsed.orderSource === "skills"
          ) {
            setOrderSource(parsed.orderSource);
          }
        } catch {
          // ignore parse errors
        }
      }

      const rawData = window.localStorage.getItem(dataStorageKey);
      let restoredPlayersCount = 0;
      if (rawData) {
        try {
          const parsed = JSON.parse(rawData) as {
            players?: unknown;
            matchesState?: MatchesResponse;
            ratingsResponse?: RatingsMatrixResponse | null;
            detailsCache?: Record<number, PlayerDetailCacheEntry>;
          };
          const restoredPlayers = normalizeSeniorPlayers(parsed.players);
          restoredPlayersCount = restoredPlayers.length;
          if (restoredPlayers.length > 0) {
            setPlayers(restoredPlayers);
          }
          if (parsed.matchesState && typeof parsed.matchesState === "object") {
            setMatchesState(parsed.matchesState);
          }
          if (
            parsed.ratingsResponse &&
            typeof parsed.ratingsResponse === "object" &&
            hasCurrentSeniorRatingsAlgorithmVersion(parsed.ratingsResponse)
          ) {
            setRatingsResponse(parsed.ratingsResponse);
          }
          if (parsed.detailsCache && typeof parsed.detailsCache === "object") {
            setDetailsCache(parsed.detailsCache);
          }
          const persistedRatingsByPlayerId = buildRatingsByPlayerIdFromResponse(
            hasCurrentSeniorRatingsAlgorithmVersion(parsed.ratingsResponse)
              ? parsed.ratingsResponse
              : null
          );
          if (
            !forceWipeLegacyUpdatesState &&
            restoredPlayers.length > 0 ||
            (!forceWipeLegacyUpdatesState &&
              Object.keys(persistedRatingsByPlayerId).length > 0)
          ) {
            persistedMarkersBaselineRef.current = {
              players: restoredPlayers,
              ratingsByPlayerId: persistedRatingsByPlayerId,
            };
          }
        } catch {
          // ignore parse errors
        }
      }
      setLastRefreshAt(readStoredLastRefresh(lastRefreshStorageKey));
      setStalenessDays(readSeniorStalenessDays());
      const lastRefresh = readStoredLastRefresh(lastRefreshStorageKey);
      const shouldRefresh =
        !lastRefresh || Date.now() - lastRefresh >= readSeniorStalenessDays() * 24 * 60 * 60 * 1000;
      const shouldBootstrap = restoredPlayersCount === 0;
      if (shouldBootstrap) {
        suppressNextUpdatesRecordingRef.current = true;
      }
      if (shouldRefresh || shouldBootstrap) {
        void refreshAll(shouldRefresh && lastRefresh ? "stale" : "manual");
      }
    } finally {
      restoredStateStorageKeyRef.current = stateStorageKey;
      restoredDataStorageKeyRef.current = dataStorageKey;
      setStateRestored(true);
      setDataRestored(true);
    }
  }, [dataStorageKey, lastRefreshStorageKey, listSortStorageKey, stateStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (
          event.key &&
          event.key !== SENIOR_SETTINGS_STORAGE_KEY &&
          event.key !== lastRefreshStorageKey
        ) {
          return;
        }
      }
      if (event instanceof CustomEvent) {
        const detail = event.detail as { stalenessDays?: number } | null;
        if (typeof detail?.stalenessDays === "number") {
          setStalenessDays(Math.min(7, Math.max(1, Math.round(detail.stalenessDays))));
          return;
        }
      }
      setStalenessDays(readSeniorStalenessDays());
    };
    const handleWipeRatingsMatrix = () => {
      setRatingsResponse(null);
      setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
      setUpdatesHistory([]);
      setSelectedUpdatesId(null);
      const currentPlayers = players;
      persistedMarkersBaselineRef.current = {
        players: currentPlayers,
        ratingsByPlayerId: {},
      };
    };
    window.addEventListener("storage", handle);
    window.addEventListener(SENIOR_SETTINGS_EVENT, handle);
    window.addEventListener(SENIOR_RATINGS_WIPE_EVENT, handleWipeRatingsMatrix);
    return () => {
      window.removeEventListener("storage", handle);
      window.removeEventListener(SENIOR_SETTINGS_EVENT, handle);
      window.removeEventListener(SENIOR_RATINGS_WIPE_EVENT, handleWipeRatingsMatrix);
    };
  }, [lastRefreshStorageKey, players]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!lastRefreshAt) return;
    const maxAgeMs = stalenessDays * 24 * 60 * 60 * 1000;
    const isStale = Date.now() - lastRefreshAt >= maxAgeMs;
    if (!isStale) {
      staleRefreshAttemptedRef.current = false;
      return;
    }
    if (refreshing) return;
    if (staleRefreshAttemptedRef.current) return;
    staleRefreshAttemptedRef.current = true;
    void refreshAll("stale");
  }, [lastRefreshAt, refreshing, stalenessDays]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const maybeRunStaleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      const lastRefresh = readStoredLastRefresh(lastRefreshStorageKey);
      if (!lastRefresh) return;
      const maxAgeMs = stalenessDays * 24 * 60 * 60 * 1000;
      const isStale = Date.now() - lastRefresh >= maxAgeMs;
      if (!isStale) {
        staleRefreshAttemptedRef.current = false;
        return;
      }
      if (refreshing) return;
      if (staleRefreshAttemptedRef.current) return;
      staleRefreshAttemptedRef.current = true;
      void refreshAll("stale");
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
  }, [lastRefreshStorageKey, refreshing, stalenessDays]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!stateRestored) return;
    if (restoredStateStorageKeyRef.current !== stateStorageKey) return;
    const payload = {
      updatesSchemaVersion: SENIOR_UPDATES_SCHEMA_VERSION,
      selectedId,
      assignments,
      behaviors,
      loadedMatchId,
      tacticType,
      trainingType,
      setBestLineupFixedFormation,
      includeTournamentMatches,
      updatesHistory,
      matrixNewMarkers,
      selectedUpdatesId,
      activeDetailsTab,
      showSeniorSkillBonusInMatrix,
      extraTimeBTeamEnabled,
      extraTimeBTeamMinutesThreshold,
      extraTimeSelectedPlayerIds,
      extraTimeMatrixTrainingType,
      extraTimeMatrixTrainingTypeManual,
      orderedPlayerIds,
      orderSource,
    };
    try {
      window.localStorage.setItem(stateStorageKey, JSON.stringify(payload));
    } catch {
      // ignore persist errors
    }
  }, [
    stateRestored,
    assignments,
    behaviors,
    includeTournamentMatches,
    loadedMatchId,
    selectedId,
    selectedUpdatesId,
    tacticType,
    trainingType,
    setBestLineupFixedFormation,
    updatesHistory,
    matrixNewMarkers,
    activeDetailsTab,
    showSeniorSkillBonusInMatrix,
    extraTimeBTeamEnabled,
    extraTimeBTeamMinutesThreshold,
    extraTimeSelectedPlayerIds,
    extraTimeMatrixTrainingType,
    extraTimeMatrixTrainingTypeManual,
    orderedPlayerIds,
    orderSource,
    stateStorageKey,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!stateRestored) return;
    if (restoredStateStorageKeyRef.current !== stateStorageKey) return;
    window.localStorage.setItem(
      listSortStorageKey,
      JSON.stringify({ sortKey, sortDirection })
    );
  }, [listSortStorageKey, sortDirection, sortKey, stateRestored, stateStorageKey]);

  useEffect(() => {
    const nextOrder = sortedPlayers.map((player) => player.PlayerID);
    if (nextOrder.length === 0) return;
    if (orderSource && orderSource !== "list") return;
    setOrderedPlayerIds((prev) => {
      if (
        prev &&
        prev.length === nextOrder.length &&
        prev.every((id, index) => id === nextOrder[index])
      ) {
        return prev;
      }
      return nextOrder;
    });
    setOrderSource("list");
  }, [orderSource, sortedPlayers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!dataRestored) return;
    if (restoredDataStorageKeyRef.current !== dataStorageKey) return;
    const payload = {
      players,
      matchesState,
      ratingsResponse,
      detailsCache,
    };
    try {
      window.localStorage.setItem(dataStorageKey, JSON.stringify(payload));
    } catch {
      // ignore persist errors
    }
  }, [dataRestored, dataStorageKey, detailsCache, matchesState, players, ratingsResponse]);

  useEffect(() => {
    if (!selectedId) return;
    void ensureDetails(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => {
      void refreshAllRef.current?.("manual");
    };
    const handleStop = () => {
      const active = activeRefreshRunIdRef.current;
      if (!active) return;
      stoppedRefreshRunIdsRef.current.add(active);
      setRefreshing(false);
      setRefreshStatus(null);
      setRefreshProgressPct(0);
      addNotification(messages.notificationRefreshStoppedManual);
    };
    const handleUpdatesOpen = () => setUpdatesOpen(true);
    const handleHelpOpen = () => setShowHelp(true);

    window.addEventListener(SENIOR_REFRESH_REQUEST_EVENT, handleRefresh);
    window.addEventListener(SENIOR_REFRESH_STOP_EVENT, handleStop);
    window.addEventListener(SENIOR_LATEST_UPDATES_OPEN_EVENT, handleUpdatesOpen);
    window.addEventListener("ya:help-open", handleHelpOpen);
    return () => {
      window.removeEventListener(SENIOR_REFRESH_REQUEST_EVENT, handleRefresh);
      window.removeEventListener(SENIOR_REFRESH_STOP_EVENT, handleStop);
      window.removeEventListener(SENIOR_LATEST_UPDATES_OPEN_EVENT, handleUpdatesOpen);
      window.removeEventListener("ya:help-open", handleHelpOpen);
    };
  }, [addNotification, messages.notificationRefreshStoppedManual]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const checkHelpVisibilityFromToken = async () => {
      try {
        const { payload } = await fetchChppJson<{ raw?: string }>("/api/chpp/oauth/check-token", {
          cache: "no-store",
        });
        const raw = payload?.raw ?? "";
        const match = raw.match(/<Token>(.*?)<\/Token>/);
        const token = match?.[1]?.trim() ?? null;
        if (cancelled) return;
        setCurrentToken(token);
        if (!token) {
          setShowHelp(false);
          return;
        }
        const dismissedToken = window.localStorage.getItem(SENIOR_HELP_STORAGE_KEY);
        if (dismissedToken !== token) {
          if (!seniorHasDataRef.current) {
            setShowHelp(false);
            setDeferHelpUntilInitialRefresh(true);
          } else {
            setShowHelp(true);
            setDeferHelpUntilInitialRefresh(false);
          }
        } else {
          setDeferHelpUntilInitialRefresh(false);
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ChppAuthRequiredError) {
          setCurrentToken(null);
          setShowHelp(false);
        }
      }
    };

    void checkHelpVisibilityFromToken();
    const handleFocus = () => {
      void checkHelpVisibilityFromToken();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!deferHelpUntilInitialRefresh) return;
    if (refreshing) return;
    if (!hasSeniorData) return;
    setShowHelp(true);
    setDeferHelpUntilInitialRefresh(false);
  }, [deferHelpUntilInitialRefresh, hasSeniorData, refreshing]);

  useEffect(() => {
    if (!showHelp) {
      setHelpCallouts([]);
      return;
    }
    const CALL_OUT_MAX_WIDTH = 240;
    const targets: Array<{
      id: string;
      selector: string;
      text: string;
      placement:
        | "above-left"
        | "above-center"
        | "below-center"
        | "right-center"
        | "left-center";
      hideIndex?: boolean;
      offsetX?: number;
      offsetY?: number;
      pointerOffsetX?: number;
      maxWidth?: number;
    }> = [
      {
        id: "updates",
        selector: SENIOR_HELP_ANCHOR_UPDATES,
        text: messages.seniorHelpCalloutUpdates,
        placement: "below-center",
      },
      {
        id: "set-lineup-ai",
        selector: SENIOR_HELP_ANCHOR_SET_LINEUP_AI,
        text: messages.seniorHelpCalloutSetLineupAi,
        placement: "left-center",
        maxWidth: 300,
      },
      {
        id: "training-regimen",
        selector: SENIOR_HELP_ANCHOR_TRAINING_REGIMEN,
        text: messages.seniorHelpCalloutTrainingRegimen,
        placement: "below-center",
        pointerOffsetX: -28,
      },
      {
        id: "analyze-opponent",
        selector: SENIOR_HELP_ANCHOR_ANALYZE_OPPONENT,
        text: messages.seniorHelpCalloutAnalyzeOpponent,
        placement: "below-center",
        pointerOffsetX: -36,
      },
    ];
    const measureWidth = (text: string, hideIndex: boolean, maxWidth: number) => {
      const probe = document.createElement("div");
      probe.className = styles.helpCallout;
      probe.style.position = "fixed";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.maxWidth = `${maxWidth}px`;
      if (!hideIndex) {
        const badge = document.createElement("span");
        badge.className = styles.helpCalloutIndex;
        badge.textContent = "1";
        probe.appendChild(badge);
      }
      const textSpan = document.createElement("span");
      textSpan.className = styles.helpCalloutText;
      textSpan.textContent = text;
      probe.appendChild(textSpan);
      document.body.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return Math.min(width, maxWidth);
    };

    const computeCallouts = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const next = targets.flatMap((target) => {
        const el = document.querySelector(target.selector) as HTMLElement | null;
        if (!el) return [];
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let left = centerX;
        let top = centerY;
        let transform = "translate(-50%, -50%)";
        const offsetX = target.offsetX ?? 0;
        const offsetY = target.offsetY ?? 0;
        switch (target.placement) {
          case "above-left":
            left = rect.left + 10;
            top = rect.top - 8;
            transform = "translate(0, -100%)";
            break;
          case "above-center":
            left = centerX;
            top = rect.top - 10;
            transform = "translate(-50%, -100%)";
            break;
          case "below-center":
            left = centerX;
            top = rect.top + rect.height + 10;
            transform = "translate(-50%, 0)";
            break;
          case "right-center":
            left = rect.left + rect.width + 10;
            top = centerY;
            transform = "translate(0, -50%)";
            break;
          case "left-center":
            left = rect.left - 10;
            top = centerY;
            transform = "translate(-100%, -50%)";
            break;
          default:
            break;
        }
        left += offsetX;
        top += offsetY;
        const targetMaxWidth = target.maxWidth ?? CALL_OUT_MAX_WIDTH;
        const calloutWidth = measureWidth(
          target.text,
          target.hideIndex ?? false,
          targetMaxWidth
        );
        const clampedLeft = Math.min(Math.max(left, 12), viewportWidth - 12);
        const maxLeft = viewportWidth - 12;
        const minLeft = 12;
        const needsCenterClamp = transform.includes("-50%");
        const clampedLeftAdjusted = needsCenterClamp
          ? Math.min(
              Math.max(clampedLeft, minLeft + calloutWidth / 2),
              maxLeft - calloutWidth / 2
            )
          : clampedLeft;
        const pointerXRaw =
          target.placement === "above-center" || target.placement === "below-center"
            ? centerX - clampedLeftAdjusted + calloutWidth / 2
            : centerX - clampedLeftAdjusted;
        const pointerX = Math.min(
          Math.max(pointerXRaw + (target.pointerOffsetX ?? 0), 24),
          calloutWidth - 24
        );
        const clampedTop = Math.min(Math.max(top, 12), viewportHeight - 12);
        return [
          {
            id: target.id,
            text: target.text,
            style: {
              left: clampedLeftAdjusted,
              top: clampedTop,
              maxWidth: `${targetMaxWidth}px`,
              transform,
              "--callout-pointer-x": `${pointerX}px`,
            } as CSSProperties,
            hideIndex: target.hideIndex ?? false,
            placement: target.placement,
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
    messages.seniorHelpCalloutAnalyzeOpponent,
    messages.seniorHelpCalloutSetLineupAi,
    messages.seniorHelpCalloutTrainingRegimen,
    messages.seniorHelpCalloutUpdates,
    showHelp,
  ]);

  const specialtyByName = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    players.forEach((player) => {
      map[formatPlayerName(player)] = player.Specialty;
    });
    return map;
  }, [players]);

  const selectedUpdatesRows = useMemo(() => {
    if (!selectedUpdatesEntry) return [];
    return Object.values(selectedUpdatesEntry.groupedByPlayerId)
      .filter(
        (entry) =>
          entry.isNewPlayer ||
          entry.skills.length > 0 ||
          entry.ratings.length > 0 ||
          entry.attributes.length > 0
      )
      .sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [selectedUpdatesEntry]);

  const skillLabelByKey = (skillKey: string) => {
    switch (skillKey) {
      case "KeeperSkill":
        return messages.skillKeeperShort;
      case "DefenderSkill":
        return messages.skillDefendingShort;
      case "PlaymakerSkill":
        return messages.skillPlaymakingShort;
      case "WingerSkill":
        return messages.skillWingerShort;
      case "PassingSkill":
        return messages.skillPassingShort;
      case "ScorerSkill":
        return messages.skillScoringShort;
      case "SetPiecesSkill":
        return messages.skillSetPiecesShort;
      default:
        return skillKey;
    }
  };

  const updatesAttributeLabel = (
    key:
      | "injury"
      | "cards"
      | "form"
      | "stamina"
      | "tsi"
      | "salary"
      | "specialty"
      | "experience"
      | "leadership"
      | "loyalty"
      | "motherClubBonus"
  ) => {
    switch (key) {
      case "injury":
        return messages.sortInjuries;
      case "cards":
        return messages.sortCards;
      case "form":
        return messages.sortForm;
      case "stamina":
        return messages.sortStamina;
      case "tsi":
        return messages.sortTsi;
      case "salary":
        return messages.sortWage;
      case "specialty":
        return messages.specialtyLabel;
      case "experience":
        return messages.sortExperience;
      case "leadership":
        return messages.clubChronicleCoachColumnLeadership;
      case "loyalty":
        return messages.sortLoyalty;
      case "motherClubBonus":
        return messages.motherClubBonusTooltip;
      default:
        return key;
    }
  };

  const formatUpdatesAttributeValue = (
    key:
      | "injury"
      | "cards"
      | "form"
      | "stamina"
      | "tsi"
      | "salary"
      | "specialty"
      | "experience"
      | "leadership"
      | "loyalty"
      | "motherClubBonus",
    value: number | string | boolean | null
  ) => {
    if (value === null || value === undefined) return messages.unknownShort;
    if (key === "salary" && typeof value === "number") return formatEurFromSek(value);
    if (key === "motherClubBonus" && typeof value === "boolean") {
      return value ? "✓" : "—";
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
    return String(value);
  };
  const seniorTrainingLabel =
    messages.trainingRegimenLabel.split(/\s+/).find(Boolean) ??
    messages.trainingRegimenLabel;

  return (
    <div className={styles.dashboardStack} ref={dashboardRef}>
      {loadError ? (
        <div className={styles.errorBox}>
          <h2 className={styles.sectionTitle}>{messages.unableToLoadPlayers}</h2>
          <p className={styles.errorText}>{loadError}</p>
          {loadErrorDetails ? (
            <p className={styles.errorDetails}>{loadErrorDetails}</p>
          ) : null}
        </div>
      ) : null}

      <Modal
        open={scopeReconnectModalOpen}
        title={messages.scopeReconnectTitle}
        movable={false}
        body={<p>{messages.scopeReconnectBody}</p>}
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => {
              void reconnectChppWithTokenReset();
            }}
          >
            {messages.scopeReconnectAction}
          </button>
        }
      />
      <Modal
        open={updatesOpen}
        title={messages.clubChronicleUpdatesTitle}
        className={styles.seniorUpdatesModal}
        movable={false}
        body={
          updatesHistory.length > 0 ? (
            <div className={styles.seniorUpdatesShell}>
              <div className={styles.seniorUpdatesTopBar}>
                {selectedUpdatesEntry ? (
                  <span className={styles.seniorUpdatesComparedAt}>
                    {messages.clubChronicleUpdatesComparedAt}:{" "}
                    {formatDateTime(selectedUpdatesEntry.comparedAt)}
                  </span>
                ) : null}
              </div>
              <div className={styles.seniorUpdatesGrid}>
                <aside className={styles.seniorUpdatesHistoryPane}>
                  <div className={styles.seniorUpdatesHistoryHeader}>
                    {messages.clubChronicleUpdatesHistoryTitle}
                  </div>
                  <div className={styles.seniorUpdatesHistoryList}>
                    {updatesHistory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`${styles.seniorUpdatesHistoryItem}${
                          selectedUpdatesEntry?.id === entry.id
                            ? ` ${styles.seniorUpdatesHistoryItemActive}`
                            : ""
                        }`}
                        onClick={() => setSelectedUpdatesId(entry.id)}
                      >
                        <span className={styles.seniorUpdatesHistoryDate}>
                          {formatDateTime(entry.comparedAt)}
                        </span>
                        <span className={styles.seniorUpdatesHistoryState}>
                          {entry.hasChanges
                            ? messages.clubChronicleUpdatesHistoryChanged
                            : messages.clubChronicleUpdatesHistoryNoChanges}
                        </span>
                      </button>
                    ))}
                  </div>
                </aside>
                <section className={styles.seniorUpdatesDetailsPane}>
                  {selectedUpdatesRows.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleUpdatesHistoryNoChanges}
                    </p>
                  ) : null}
                  {selectedUpdatesRows.map((entry) => (
                    <article key={entry.playerId} className={styles.seniorUpdatesPlayerCard}>
                      <div className={styles.seniorUpdatesPlayerHeader}>
                        <h4 className={styles.seniorUpdatesPlayerName}>{entry.playerName}</h4>
                        {entry.isNewPlayer ? (
                          <span className={styles.matrixNewPill}>
                            {messages.youthUpdatesNewPlayerLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.seniorUpdatesPlayerBody}>
                        {entry.skills.length > 0 ? (
                          <div className={styles.seniorUpdatesSection}>
                            <h5 className={styles.seniorUpdatesSectionTitle}>
                              {messages.skillsLabel}
                            </h5>
                            <ul className={styles.seniorUpdatesChangeList}>
                              {entry.skills.map((change) => (
                                <li key={`${entry.playerId}-skill-${change.skillKey}`}>
                                  {skillLabelByKey(change.skillKey)}:{" "}
                                  {change.previous ?? messages.unknownShort} →{" "}
                                  {change.current ?? messages.unknownShort}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {entry.ratings.length > 0 ? (
                          <div className={styles.seniorUpdatesSection}>
                            <h5 className={styles.seniorUpdatesSectionTitle}>
                              {messages.ratingsTitle}
                            </h5>
                            <ul className={styles.seniorUpdatesChangeList}>
                              {entry.ratings.map((change) => (
                                <li key={`${entry.playerId}-rating-${change.position}`}>
                                  {positionLabel(change.position, messages)}:{" "}
                                  {change.previous?.toFixed(1) ?? messages.unknownShort} →{" "}
                                  {change.current?.toFixed(1) ?? messages.unknownShort}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {entry.attributes.length > 0 ? (
                          <div className={styles.seniorUpdatesSection}>
                            <h5 className={styles.seniorUpdatesSectionTitle}>
                              {messages.clubChronicleUpdatesHistoryChanged}
                            </h5>
                            <ul className={styles.seniorUpdatesChangeList}>
                              {entry.attributes.map((change, idx) => (
                                <li key={`${entry.playerId}-attr-${change.key}-${idx}`}>
                                  {updatesAttributeLabel(change.key)}:{" "}
                                  {formatUpdatesAttributeValue(change.key, change.previous)} →{" "}
                                  {formatUpdatesAttributeValue(change.key, change.current)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </section>
                </div>
            </div>
          ) : (
            <p className={styles.chronicleEmpty}>{messages.clubChronicleUpdatesEmpty}</p>
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
        open={submitDisclaimerOpen}
        className={styles.chronicleTransferHistoryModal}
        body={
          submitDisclaimerExtraTimeSummary ? (
            <div className={styles.seniorDisclaimerBody}>
              <div className={styles.seniorDisclaimerBadgeRow}>
                <span className={styles.seniorDisclaimerBadgeIcon} aria-hidden="true">
                  ⚠️
                </span>
                <p className={styles.seniorDisclaimerIntro}>
                  {messages.seniorExtraTimeSubmitDisclaimerIntro
                    .replace("{{training}}", submitDisclaimerExtraTimeSummary.trainingLabel)}
                </p>
              </div>
              <ul className={styles.seniorDisclaimerList}>
                <li>
                  {messages.seniorExtraTimeSubmitDisclaimerSwap.split("{{trainees}}")[0]}
                  {submitDisclaimerExtraTimeSummary.trainees.length > 0
                    ? submitDisclaimerExtraTimeSummary.trainees.map((trainee, index) => (
                        <span key={trainee.id}>
                          {index === 0
                            ? null
                            : index === submitDisclaimerExtraTimeSummary.trainees.length - 1
                              ? submitDisclaimerExtraTimeSummary.trainees.length === 2
                                ? " and "
                                : ", and "
                              : ", "}
                          <a
                            className={styles.chroniclePressLink}
                            href={hattrickPlayerUrl(trainee.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {trainee.name}
                          </a>
                        </span>
                      ))
                    : messages.unknownLabel}
                  {messages.seniorExtraTimeSubmitDisclaimerSwap.split("{{trainees}}")[1] ?? ""}
                </li>
                <li>{messages.seniorExtraTimeSubmitDisclaimerPressing}</li>
                <li>{messages.seniorExtraTimeSubmitDisclaimerSetPieces}</li>
                <li>{messages.seniorExtraTimeSubmitDisclaimerPenalties}</li>
                <li>{messages.seniorExtraTimeSubmitDisclaimerBehaviors}</li>
                <li>{messages.seniorSubmitDisclaimerBulletNoResponsibility}</li>
                <li>{messages.seniorSubmitDisclaimerBulletFineTune}</li>
              </ul>
            </div>
          ) : (
            <div className={styles.seniorDisclaimerBody}>
              <div className={styles.seniorDisclaimerBadgeRow}>
                <span className={styles.seniorDisclaimerBadgeIcon} aria-hidden="true">
                  ⚠️
                </span>
                <p className={styles.seniorDisclaimerIntro}>
                  {messages.seniorSubmitDisclaimerIntro}
                </p>
              </div>
              <ul className={styles.seniorDisclaimerList}>
                <li>{messages.seniorSubmitDisclaimerBulletBestEffort}</li>
                <li>{messages.seniorSubmitDisclaimerBulletNoResponsibility}</li>
                <li>{messages.seniorSubmitDisclaimerBulletFineTune}</li>
                <li>{messages.seniorSubmitDisclaimerBulletResubmit}</li>
                <li>{messages.seniorSubmitDisclaimerBulletKickers}</li>
                <li>{messages.seniorSubmitDisclaimerBulletOrdersInHattrick}</li>
                <li>{messages.seniorSubmitDisclaimerBulletVerify}</li>
              </ul>
            </div>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => {
              setSubmitDisclaimerOpen(false);
              setSubmitDisclaimerExtraTimeSummary(null);
            }}
          >
            {messages.closeLabel}
          </button>
        }
        onClose={() => {
          setSubmitDisclaimerOpen(false);
          setSubmitDisclaimerExtraTimeSummary(null);
        }}
      />
      <Modal
        open={extraTimeInfoOpen}
        title={messages.seniorExtraTimeModalTitle}
        className={`${styles.chronicleTransferHistoryModal} ${styles.seniorExtraTimeModal}`}
        body={
          <div className={styles.seniorExtraTimeModalBody}>
            <p className={styles.seniorExtraTimeModalLead}>
              {messages.seniorExtraTimeModalLead}
            </p>
            <p>{messages.seniorExtraTimeModalTrainingLimit}</p>
            <p>{messages.seniorExtraTimeModalRotation}</p>
            <p>
              {messages.seniorExtraTimeModal120CupPrefix}{" "}
              <a
                className={styles.chroniclePressLink}
                href={hattrickForumThreadUrl(17665764, 2)}
                target="_blank"
                rel="noreferrer"
              >
                {messages.seniorExtraTimeModal120CupLinkLabel}
              </a>{" "}
              {messages.seniorExtraTimeModal120CupMiddle}{" "}
              <a
                className={styles.chroniclePressLink}
                href={hattrickManagerUrl(4419616)}
                target="_blank"
                rel="noreferrer"
              >
                {messages.seniorExtraTimeModalMonomorphLinkLabel}
              </a>
              .
            </p>
            <p>{messages.seniorExtraTimeModalWorkflow}</p>
            <p className={styles.seniorExtraTimeModalChooseTrainees}>
              {messages.seniorExtraTimeModalChooseTrainees.replace(
                "{{count}}",
                String(traineesTargetForTrainingType(resolvedExtraTimeTrainingType))
              )}
            </p>
            <PlayerDetailsPanel
              selectedPlayer={null}
              detailsData={null}
              loading={false}
              error={null}
              lastUpdated={null}
              unlockStatus={null}
              onRefresh={() => {
                void 0;
              }}
              players={panelPlayers}
              playerDetailsById={extraTimePlayerDetailsById}
              skillsMatrixRows={extraTimeSkillsMatrixRows}
              ratingsMatrixResponse={null}
              ratingsMatrixSelectedName={null}
              ratingsMatrixSpecialtyByName={specialtyByName}
              ratingsMatrixMotherClubBonusByName={motherClubBonusByName}
              ratingsMatrixCardStatusByName={seniorCardStatusByName}
              cardStatusByPlayerId={seniorCardStatusByPlayerId}
              matrixNewPlayerIds={matrixNewMarkers.playerIds}
              matrixNewRatingsByPlayerId={matrixNewMarkers.ratingsByPlayerId}
              matrixNewSkillsCurrentByPlayerId={matrixNewMarkers.skillsCurrentByPlayerId}
              matrixNewSkillsMaxByPlayerId={matrixNewMarkers.skillsMaxByPlayerId}
              onSelectRatingsPlayer={() => {
                void 0;
              }}
              onMatrixPlayerDragStart={handleSeniorPlayerDragStart}
              playerKind="senior"
              skillMode="single"
              maxSkillLevel={20}
              activeTab="skillsMatrix"
              showTabs={false}
              showSeniorSkillBonusInMatrix={showSeniorSkillBonusInMatrix}
              onShowSeniorSkillBonusInMatrixChange={setShowSeniorSkillBonusInMatrix}
              skillsMatrixHeaderAux={
                <div className={styles.seniorExtraTimeTrainingControl}>
                  <span className={styles.trainingLabel}>
                    {messages.trainingRegimenLabel.split(/\s+/).find(Boolean) ??
                      messages.trainingRegimenLabel}
                  </span>
                  <div className={styles.feedbackWrap}>
                    <button
                      type="button"
                      className={styles.lineupTrainingTypeTrigger}
                      onClick={() => setExtraTimeTrainingMenuOpen((prev) => !prev)}
                      ref={extraTimeTrainingButtonRef}
                      aria-haspopup="menu"
                      aria-expanded={extraTimeTrainingMenuOpen}
                    >
                      <span className={styles.lineupTrainingTypeValue}>
                        {obtainedTrainingRegimenLabel(
                          resolvedExtraTimeTrainingType ?? NON_DEPRECATED_TRAINING_TYPES[0]
                        )}
                      </span>
                    </button>
                    {extraTimeTrainingMenuOpen ? (
                      <div
                        className={`${styles.feedbackMenu} ${styles.lineupTrainingTypeMenu}`}
                        ref={extraTimeTrainingMenuRef}
                        role="menu"
                      >
                        {NON_DEPRECATED_TRAINING_TYPES.map((value) => {
                          const isActive =
                            value ===
                            (resolvedExtraTimeTrainingType ?? NON_DEPRECATED_TRAINING_TYPES[0]);
                          const sectionTitle = trainingSectionTitleForValue(value) ?? null;
                          return (
                            <div key={value}>
                              {sectionTitle ? (
                                <div className={styles.lineupTrainingTypeSectionHeader}>
                                  {sectionTitle}
                                </div>
                              ) : null}
                              <div className={styles.lineupTrainingTypeOptionRow}>
                                <button
                                  type="button"
                                  className={`${styles.feedbackLink} ${styles.lineupTrainingTypeOption} ${
                                    isActive ? styles.lineupTrainingTypeOptionActive : ""
                                  }`}
                                  onClick={() => {
                                    setExtraTimeMatrixTrainingType(value);
                                    setExtraTimeMatrixTrainingTypeManual(value !== trainingType);
                                    setExtraTimeTrainingMenuOpen(false);
                                  }}
                                >
                                  {obtainedTrainingRegimenLabel(value)}
                                </button>
                                {!isActive ? (
                                  <Tooltip content={messages.trainingSetButtonTooltip}>
                                    <button
                                      type="button"
                                      className={styles.lineupTrainingTypeSetButton}
                                      disabled={trainingTypeSetPending}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (trainingTypeSetPending) return;
                                        void handleSetTrainingType(value);
                                      }}
                                    >
                                      {trainingTypeSetPending &&
                                      trainingTypeSetPendingValue === value ? (
                                        <span className={styles.spinner} aria-hidden="true" />
                                      ) : (
                                        messages.trainingSetButtonLabel
                                      )}
                                    </button>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              }
              skillsMatrixLeadingHeader={
                <label className={styles.seniorMatrixCheckboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.seniorMatrixCheckboxInput}
                    checked={allExtraTimePlayersSelected}
                    disabled={extraTimeSelectablePlayerIds.length === 0}
                    aria-label={messages.seniorExtraTimeModalChooseTrainees.replace(
                      "{{count}}",
                      String(traineesTargetForTrainingType(resolvedExtraTimeTrainingType))
                    )}
                    ref={(node) => {
                      if (!node) return;
                      node.indeterminate = someExtraTimePlayersSelected;
                    }}
                    onChange={(event) => {
                      setExtraTimeSelectedPlayerIds(
                        event.target.checked ? extraTimeSelectablePlayerIds : []
                      );
                    }}
                  />
                  <span
                    className={styles.seniorMatrixCheckboxBox}
                    aria-hidden="true"
                  />
                </label>
              }
              renderSkillsMatrixLeadingCell={(row) => {
                const rowId = typeof row.id === "number" ? row.id : null;
                const isChecked =
                  typeof rowId === "number" &&
                  extraTimeSelectedPlayerIds.includes(rowId);
                const isInjured =
                  typeof rowId === "number" && extraTimeInjuredPlayerIdSet.has(rowId);
                const isDisregarded =
                  typeof rowId === "number" && extraTimeDisregardedPlayerIds.has(rowId);
                const checkbox = (
                  <label className={styles.seniorMatrixCheckboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.seniorMatrixCheckboxInput}
                      checked={Boolean(isChecked)}
                      disabled={typeof rowId !== "number" || isInjured || isDisregarded}
                      aria-label={row.name}
                      onChange={(event) => {
                        if (typeof rowId !== "number" || isInjured || isDisregarded) {
                          return;
                        }
                        setExtraTimeSelectedPlayerIds((prev) => {
                          if (event.target.checked) {
                            if (prev.includes(rowId)) return prev;
                            return [...prev, rowId];
                          }
                          return prev.filter((playerId) => playerId !== rowId);
                        });
                      }}
                    />
                    <span
                      className={styles.seniorMatrixCheckboxBox}
                      aria-hidden="true"
                    />
                  </label>
                );
                if (isInjured) {
                  return (
                    <Tooltip content={messages.seniorExtraTimeModalInjuredCheckboxTooltip}>
                      <span className={styles.seniorExtraTimeDisabledCheckboxWrap}>
                        {checkbox}
                      </span>
                    </Tooltip>
                  );
                }
                if (isDisregarded) {
                  return (
                    <Tooltip content={getExtraTimeDisregardedTooltip(rowId)}>
                      <span className={styles.seniorExtraTimeDisabledCheckboxWrap}>
                        {checkbox}
                      </span>
                    </Tooltip>
                  );
                }
                return checkbox;
              }}
              skillsMatrixRowClassName={(row) => {
                if (
                  !effectiveExtraTimeBTeamEnabled ||
                  typeof row.id !== "number" ||
                  !extraTimeDisregardedPlayerIds.has(row.id)
                ) {
                  return null;
                }
                return styles.matrixRowDisregarded;
              }}
              skillsMatrixRowTooltip={(row) => {
                if (
                  !effectiveExtraTimeBTeamEnabled ||
                  typeof row.id !== "number" ||
                  !extraTimeDisregardedPlayerIds.has(row.id)
                ) {
                  return null;
                }
                return getExtraTimeDisregardedTooltip(row.id);
              }}
              messages={messages}
            />
          </div>
        }
        actions={
          <Tooltip
            content={
              extraTimeSetLineupDisabled
                ? messages.seniorExtraTimeModalSetLineupDisabledTooltip
                : messages.seniorExtraTimeModalSetLineupReadyTooltip
            }
          >
            <span>
              <button
                type="button"
                className={styles.confirmSubmit}
                disabled={extraTimeSetLineupDisabled}
                onClick={() => {
                  void handleExtraTimeSetLineup();
                }}
              >
                {messages.seniorExtraTimeModalSetLineupButton}
              </button>
            </span>
          </Tooltip>
        }
        closeOnBackdrop
        onClose={() => {
          setExtraTimeInfoOpen(false);
          setExtraTimeMatchId(null);
        }}
      />
      <Modal
        open={!!opponentAnalysisModal}
        title={opponentAnalysisModal?.title ?? messages.analyzeOpponent}
        className={styles.chronicleTransferHistoryModal}
        body={
          opponentAnalysisModal ? (
            opponentAnalysisModal.loading ? (
              <p className={styles.chronicleEmpty}>{messages.loadingDetails}</p>
            ) : opponentAnalysisModal.error ? (
              <p className={styles.errorDetails}>{opponentAnalysisModal.error}</p>
            ) : (
              <>
                <div className={styles.opponentFormationsTableWrap}>
                  <table className={styles.opponentFormationsTable}>
                    <thead>
                      <tr>
                        <th>{messages.analyzeOpponentMatchId}</th>
                        <th>{messages.clubChronicleTransferHistoryDateColumn}</th>
                        <th>{messages.analyzeOpponentMatchType}</th>
                        <th>{messages.analyzeOpponentFormationColumn}</th>
                        <th>{messages.analyzeOpponentTacticColumn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opponentAnalysisModal.opponentRows.map((row) => (
                        <tr key={row.matchId}>
                          <td className={styles.opponentFormationsMatchIdCell}>
                            <a
                              className={styles.chroniclePressLink}
                              href={hattrickMatchUrl(row.matchId)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.matchId}
                              {row.againstMyTeam ? "*" : ""}
                            </a>
                          </td>
                          <td>
                            {(() => {
                              const parsedDate = parseChppDate(row.matchDate);
                              return parsedDate
                                ? formatDateTime(parsedDate)
                                : messages.unknownDate;
                            })()}
                          </td>
                          <td>{matchTypeLabel(row.matchType)}</td>
                          <td>{row.formation ?? messages.unknownShort}</td>
                          <td>{tacticTypeLabel(row.tacticType)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.chroniclePressMeta}>{messages.analyzeOpponentAgainstYouMark}</p>
                <p className={styles.chroniclePressMeta}>
                  <a className={styles.chroniclePressLink} href={hattrickTeamUrl(opponentAnalysisModal.opponentTeamId)} target="_blank" rel="noreferrer">
                    {`${opponentAnalysisModal.opponentName}'s`}
                  </a>{" "}
                  {messages.analyzeOpponentSummaryPreferredFormation}{" "}
                  <strong>
                    {opponentAnalysisModal.preferredFormation ?? messages.unknownShort}
                  </strong>
                  .
                </p>
                <p className={styles.chroniclePressMeta}>
                  {messages.analyzeOpponentSummaryPreferredTactic}{" "}
                  <strong>{tacticTypeLabel(opponentAnalysisModal.preferredTactic)}</strong>.
                </p>
                {opponentAnalysisModal.opponentRows.some((row) => row.againstMyTeam) ? (
                  <p className={styles.chroniclePressMeta}>
                    {messages.analyzeOpponentSummaryVsYou}{" "}
                    <strong>
                      {opponentAnalysisModal.versusFormation ?? messages.unknownShort}
                    </strong>{" "}
                    {messages.analyzeOpponentSummaryWith}{" "}
                    <strong>{tacticTypeLabel(opponentAnalysisModal.versusTactic)}</strong>.
                  </p>
                ) : (
                  <p className={styles.chroniclePressMeta}>
                    {messages.analyzeOpponentNeverPlayedUs}
                  </p>
                )}
                <div className={styles.chronicleDistributionGrid}>
                  <div className={styles.chronicleDistributionCard}>
                    <h3 className={styles.chronicleDetailsSectionTitle}>
                      {messages.analyzeOpponentFormationColumn}
                    </h3>
                    <div className={styles.chroniclePieChartWrap}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 24, right: 64, left: 64, bottom: 24 }}>
                          <Pie
                            data={opponentAnalysisModal.formationDistribution}
                            dataKey="count"
                            nameKey="label"
                            outerRadius={90}
                            label={renderPieLabel}
                            labelLine
                          >
                            {opponentAnalysisModal.formationDistribution.map((entry, index) => (
                              <Cell key={`analyze-formation-${entry.key}`} fill={colorForSlice(index)} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {opponentAnalysisModal.formationDistribution.length > 0 ? null : (
                      <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
                    )}
                  </div>
                  <div className={styles.chronicleDistributionCard}>
                    <h3 className={styles.chronicleDetailsSectionTitle}>
                      {messages.analyzeOpponentTacticColumn}
                    </h3>
                    <div className={styles.chroniclePieChartWrap}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 24, right: 64, left: 64, bottom: 24 }}>
                          <Pie
                            data={opponentAnalysisModal.tacticDistribution}
                            dataKey="count"
                            nameKey="label"
                            outerRadius={90}
                            label={renderPieLabel}
                            labelLine
                          >
                            {opponentAnalysisModal.tacticDistribution.map((entry, index) => (
                              <Cell key={`analyze-tactic-${entry.key}`} fill={colorForSlice(index)} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {opponentAnalysisModal.tacticDistribution.length > 0 ? null : (
                      <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
                    )}
                  </div>
                </div>
              </>
            )
          ) : null
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setOpponentAnalysisModal(null)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setOpponentAnalysisModal(null)}
      />
      <Modal
        open={showSetBestLineupDebugModal && !!opponentFormationsModal}
        title={opponentFormationsModal?.title ?? messages.setBestLineup}
        className={styles.chronicleUpdatesModal}
        body={
          opponentFormationsModal ? (
            opponentFormationsModal.loading ? (
              <p className={styles.chronicleEmpty}>{messages.loadingDetails}</p>
            ) : opponentFormationsModal.error ? (
              <p className={styles.errorDetails}>{opponentFormationsModal.error}</p>
            ) : opponentFormationsModal.generatedRows.length > 0 ||
              opponentFormationsModal.opponentRows.length > 0 ? (
              <>
                <p className={styles.chroniclePressMeta}>
                  {messages.trainingTitle}:{" "}
                  <strong>
                    {obtainedTrainingRegimenLabel(trainingType)}
                    {typeof trainingType === "number" ? ` (#${trainingType})` : ""}
                  </strong>
                </p>
                {opponentFormationsModal.opponentRows.length > 0 ? (
                  <>
                    <p className={styles.chroniclePressMeta}>
                      {messages.analyzeOpponentFormationColumn}:{" "}
                      <strong>
                        {opponentFormationsModal.chosenFormation ?? messages.unknownShort}
                      </strong>
                    </p>
                    <div className={styles.opponentFormationsTableWrap}>
                      <table className={styles.opponentFormationsTable}>
                        <thead>
                          <tr>
                            <th>{messages.matchesTitle}</th>
                            <th>{messages.clubChronicleTransferHistoryDateColumn}</th>
                            <th>{messages.analyzeOpponentMatchType}</th>
                            <th>{messages.analyzeOpponentFormationColumn}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorMidfieldShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorRightDefShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorMidDefShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorLeftDefShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorRightAttShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorMidAttShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorLeftAttShort}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opponentFormationsModal.opponentRows.map((row) => (
                            <tr key={row.matchId}>
                              <td className={styles.opponentFormationsMatchIdCell}>
                                <a
                                  className={styles.chroniclePressLink}
                                  href={hattrickMatchUrl(row.matchId)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {row.matchId}
                                  {row.againstMyTeam ? "*" : ""}
                                </a>
                              </td>
                              <td>
                                {(() => {
                                  const parsedDate = parseChppDate(row.matchDate);
                                  return parsedDate ? formatDateTime(parsedDate) : messages.unknownDate;
                                })()}
                              </td>
                              <td>{matchTypeLabel(row.matchType)}</td>
                              <td>{row.formation ?? messages.unknownShort}</td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.formation === opponentFormationsModal.chosenFormation
                                  ? row.ratingMidfield ?? messages.unknownShort
                                  : "—"}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.formation === opponentFormationsModal.chosenFormation
                                  ? row.ratingRightDef ?? messages.unknownShort
                                  : "—"}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.formation === opponentFormationsModal.chosenFormation
                                  ? row.ratingMidDef ?? messages.unknownShort
                                  : "—"}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.formation === opponentFormationsModal.chosenFormation
                                  ? row.ratingLeftDef ?? messages.unknownShort
                                  : "—"}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.formation === opponentFormationsModal.chosenFormation
                                  ? row.ratingRightAtt ?? messages.unknownShort
                                  : "—"}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.formation === opponentFormationsModal.chosenFormation
                                  ? row.ratingMidAtt ?? messages.unknownShort
                                  : "—"}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.formation === opponentFormationsModal.chosenFormation
                                  ? row.ratingLeftAtt ?? messages.unknownShort
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                          {opponentFormationsModal.chosenFormationAverages ? (
                            <tr className={styles.opponentFormationsAverageRow}>
                              <td colSpan={4}>
                                <strong>
                                  {messages.averageLabel} (
                                  {opponentFormationsModal.chosenFormationAverages.sampleSize})
                                </strong>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                <strong>
                                  {opponentFormationsModal.chosenFormationAverages.ratingMidfield?.toFixed(
                                    1
                                  ) ?? messages.unknownShort}
                                </strong>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                <strong>
                                  {opponentFormationsModal.chosenFormationAverages.ratingRightDef?.toFixed(
                                    1
                                  ) ?? messages.unknownShort}
                                </strong>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                <strong>
                                  {opponentFormationsModal.chosenFormationAverages.ratingMidDef?.toFixed(
                                    1
                                  ) ?? messages.unknownShort}
                                </strong>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                <strong>
                                  {opponentFormationsModal.chosenFormationAverages.ratingLeftDef?.toFixed(
                                    1
                                  ) ?? messages.unknownShort}
                                </strong>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                <strong>
                                  {opponentFormationsModal.chosenFormationAverages.ratingRightAtt?.toFixed(
                                    1
                                  ) ?? messages.unknownShort}
                                </strong>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                <strong>
                                  {opponentFormationsModal.chosenFormationAverages.ratingMidAtt?.toFixed(
                                    1
                                  ) ?? messages.unknownShort}
                                </strong>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                <strong>
                                  {opponentFormationsModal.chosenFormationAverages.ratingLeftAtt?.toFixed(
                                    1
                                  ) ?? messages.unknownShort}
                                </strong>
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
                <p className={styles.chroniclePressMeta}>
                  {messages.lineupTitle} · {messages.ratingsTitle}
                </p>
                {opponentFormationsModal.mode === "fixedFormation" ? (
                  <>
                    {(() => {
                      const selectedFixedTacticRow =
                        opponentFormationsModal.fixedFormationTacticRows.find(
                          (row) =>
                            row.tacticType === opponentFormationsModal.selectedGeneratedTactic
                        ) ?? null;
                      const selectedCollective = selectedFixedTacticRow?.predicted
                        ? toCollectiveRatings(selectedFixedTacticRow.predicted)
                        : null;
                      const selectedGeneratedRow =
                        opponentFormationsModal.generatedRows[0] ?? null;
                      return (
                        <>
                          {opponentFormationsModal.selectedGeneratedFormation &&
                          selectedCollective ? (
                            <p className={styles.chroniclePressMeta}>
                              <strong>
                                {opponentFormationsModal.selectedGeneratedFormation}
                              </strong>{" "}
                              · {tacticTypeLabel(opponentFormationsModal.selectedGeneratedTactic)}
                              {" · "}
                              MID {selectedCollective.midfield.toFixed(1)}
                              {" · "}
                              DEF {selectedCollective.defense.toFixed(1)}
                              {" · "}
                              ATT {selectedCollective.attack.toFixed(1)}
                            </p>
                          ) : null}
                          {opponentFormationsModal.selectedRejectedPlayerIds.length > 0 ? (
                            <p className={styles.chroniclePressMeta}>
                              {messages.setBestLineupRejectedPlayersLabel}:{" "}
                              {opponentFormationsModal.selectedRejectedPlayerIds
                                .map(
                                  (playerId) =>
                                    playerNameById.get(playerId) ?? String(playerId)
                                )
                                .join(", ")}
                            </p>
                          ) : null}
                          {selectedGeneratedRow ? (
                            <div className={styles.opponentFormationsTableWrap}>
                              <table className={styles.opponentFormationsTable}>
                                <thead>
                                  <tr>
                                    <th>{messages.analyzeOpponentFormationColumn}</th>
                                    <th>{messages.lineupTitle}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className={styles.opponentFormationsSelectedRow}>
                                    <td className={styles.opponentFormationsMatchIdCell}>
                                      {selectedGeneratedRow.formation}
                                    </td>
                                    <td className={styles.generatedLineupCell}>
                                      <div className={styles.generatedLineupBlock}>
                                        {[
                                          { label: messages.posKeeper, slots: ["KP"] },
                                          {
                                            label: messages.skillDefending,
                                            slots: [...DEFENSE_SLOTS],
                                          },
                                          {
                                            label: messages.skillPlaymaking,
                                            slots: [...MIDFIELD_SLOTS],
                                          },
                                          {
                                            label: messages.skillScoring,
                                            slots: [...ATTACK_SLOTS],
                                          },
                                        ].map((line) => (
                                          <div
                                            key={`${selectedGeneratedRow.formation}-${line.label}`}
                                            className={styles.generatedLineupRow}
                                          >
                                            <span className={styles.generatedLineupRowLabel}>
                                              {line.label}
                                            </span>
                                            <div className={styles.generatedLineupSlots}>
                                              {line.slots.map((slot) => {
                                                const playerId = Number(
                                                  selectedGeneratedRow.assignments[slot] ?? 0
                                                );
                                                const playerName =
                                                  playerId > 0
                                                    ? playerNameById.get(playerId) ??
                                                      String(playerId)
                                                    : "—";
                                                const slotRating =
                                                  selectedGeneratedRow.slotRatings[slot];
                                                const text =
                                                  playerId > 0
                                                    ? `${slot}: ${playerName} (${slotRating?.toFixed(1) ?? messages.unknownShort})`
                                                    : `${slot}: —`;
                                                return (
                                                  <span
                                                    key={`${selectedGeneratedRow.formation}-${slot}`}
                                                    className={`${styles.generatedLineupSlot} ${
                                                      playerId > 0
                                                        ? ""
                                                        : styles.generatedLineupSlotEmpty
                                                    }`}
                                                  >
                                                    {text}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                    <p className={styles.chroniclePressMeta}>
                      {messages.tacticLabel} · {messages.ratingsTitle}
                    </p>
                    <div className={styles.opponentFormationsTableWrap}>
                      <table className={styles.opponentFormationsTable}>
                        <thead>
                          <tr>
                            <th>{messages.tacticLabel}</th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.ratingSectorMidfieldShort}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.ratingSectorRightDefShort}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.ratingSectorMidDefShort}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.ratingSectorLeftDefShort}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.ratingSectorRightAttShort}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.ratingSectorMidAttShort}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.ratingSectorLeftAttShort}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.seniorFixedFormationTotalRatingsLabel}
                            </th>
                            <th className={styles.opponentFormationsNumberHeader}>
                              {messages.seniorFixedFormationWeightedSumLabel}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {opponentFormationsModal.fixedFormationTacticRows.map((row) => {
                            const collective = row.predicted
                              ? toCollectiveRatings(row.predicted)
                              : null;
                            return (
                              <tr
                                key={`${opponentFormationsModal.fixedFormation ?? "fixed"}-${row.tacticType}`}
                                className={
                                  row.tacticType === opponentFormationsModal.selectedGeneratedTactic
                                    ? styles.opponentFormationsSelectedRow
                                    : undefined
                                }
                              >
                                <td className={styles.opponentFormationsMatchIdCell}>
                                  {tacticTypeLabel(row.tacticType)}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {row.predicted?.ratingMidfield?.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {row.predicted?.ratingRightDef?.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {row.predicted?.ratingMidDef?.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {row.predicted?.ratingLeftDef?.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {row.predicted?.ratingRightAtt?.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {row.predicted?.ratingMidAtt?.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {row.predicted?.ratingLeftAtt?.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {collective?.overall.toFixed(1) ?? messages.unknownShort}
                                </td>
                                <td className={styles.opponentFormationsNumberCell}>
                                  {collective
                                    ? fixedFormationTacticWeightedScore(collective).toFixed(6)
                                    : messages.unknownShort}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    {opponentFormationsModal.selectedGeneratedFormation &&
                    opponentFormationsModal.selectedComparison ? (
                      <>
                        <p className={styles.chroniclePressMeta}>
                          <strong>{opponentFormationsModal.selectedGeneratedFormation}</strong> ·{" "}
                          {tacticTypeLabel(opponentFormationsModal.selectedGeneratedTactic)}
                          {" · "}
                          MID {opponentFormationsModal.selectedComparison.ours.midfield.toFixed(1)} /{" "}
                          {opponentFormationsModal.selectedComparison.opponent.midfield.toFixed(1)}
                          {" · "}
                          DEF {opponentFormationsModal.selectedComparison.ours.defense.toFixed(1)} /{" "}
                          {opponentFormationsModal.selectedComparison.opponent.defense.toFixed(1)}
                          {" · "}
                          ATT {opponentFormationsModal.selectedComparison.ours.attack.toFixed(1)} /{" "}
                          {opponentFormationsModal.selectedComparison.opponent.attack.toFixed(1)}
                        </p>
                        {opponentFormationsModal.selectedRejectedPlayerIds.length > 0 ? (
                          <p className={styles.chroniclePressMeta}>
                            {messages.setBestLineupRejectedPlayersLabel}:{" "}
                            {opponentFormationsModal.selectedRejectedPlayerIds
                              .map((playerId) => playerNameById.get(playerId) ?? String(playerId))
                              .join(", ")}
                          </p>
                        ) : null}
                        {opponentFormationsModal.selectedIneligiblePlayerIds.length > 0 ? (
                          <p className={styles.chroniclePressMeta}>
                            {messages.setBestLineupIneligiblePlayersLabel}:{" "}
                            {opponentFormationsModal.selectedIneligiblePlayerIds
                              .map((playerId) => playerNameById.get(playerId) ?? String(playerId))
                              .join(", ")}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    <div className={styles.opponentFormationsTableWrap}>
                      <table className={styles.opponentFormationsTable}>
                        <thead>
                          <tr>
                            <th>{messages.analyzeOpponentFormationColumn}</th>
                            <th>{messages.lineupTitle}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorMidfieldShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorRightDefShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorMidDefShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorLeftDefShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorRightAttShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorMidAttShort}</th>
                            <th className={styles.opponentFormationsNumberHeader}>{messages.ratingSectorLeftAttShort}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opponentFormationsModal.generatedRows.map((row) => (
                            <tr
                              key={row.formation}
                              className={
                                row.formation === opponentFormationsModal.selectedGeneratedFormation
                                  ? styles.opponentFormationsSelectedRow
                                  : undefined
                              }
                            >
                              <td className={styles.opponentFormationsMatchIdCell}>{row.formation}</td>
                              <td className={styles.generatedLineupCell}>
                                <div className={styles.generatedLineupBlock}>
                                  {[
                                    { label: messages.posKeeper, slots: ["KP"] },
                                    { label: messages.skillDefending, slots: [...DEFENSE_SLOTS] },
                                    { label: messages.skillPlaymaking, slots: [...MIDFIELD_SLOTS] },
                                    { label: messages.skillScoring, slots: [...ATTACK_SLOTS] },
                                  ].map((line) => (
                                    <div key={`${row.formation}-${line.label}`} className={styles.generatedLineupRow}>
                                      <span className={styles.generatedLineupRowLabel}>{line.label}</span>
                                      <div className={styles.generatedLineupSlots}>
                                        {line.slots.map((slot) => {
                                          const playerId = Number(row.assignments[slot] ?? 0);
                                          const playerName =
                                            playerId > 0
                                              ? playerNameById.get(playerId) ?? String(playerId)
                                              : "—";
                                          const slotRating = row.slotRatings[slot];
                                          const text =
                                            playerId > 0
                                              ? `${slot}: ${playerName} (${slotRating?.toFixed(1) ?? messages.unknownShort})`
                                              : `${slot}: —`;
                                          return (
                                            <span
                                              key={`${row.formation}-${slot}`}
                                              className={`${styles.generatedLineupSlot} ${
                                                playerId > 0 ? "" : styles.generatedLineupSlotEmpty
                                              }`}
                                            >
                                              {text}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                  {row.error ? (
                                    <p className={styles.errorDetails}>{row.error}</p>
                                  ) : null}
                                </div>
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.predicted?.ratingMidfield?.toFixed(1) ?? messages.unknownShort}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.predicted?.ratingRightDef?.toFixed(1) ?? messages.unknownShort}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.predicted?.ratingMidDef?.toFixed(1) ?? messages.unknownShort}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.predicted?.ratingLeftDef?.toFixed(1) ?? messages.unknownShort}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.predicted?.ratingRightAtt?.toFixed(1) ?? messages.unknownShort}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.predicted?.ratingMidAtt?.toFixed(1) ?? messages.unknownShort}
                              </td>
                              <td className={styles.opponentFormationsNumberCell}>
                                {row.predicted?.ratingLeftAtt?.toFixed(1) ?? messages.unknownShort}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className={styles.chronicleEmpty}>{messages.noMatchesReturned}</p>
            )
          ) : null
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setOpponentFormationsModal(null)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setOpponentFormationsModal(null)}
      />

      {showHelp ? (
        <div className={styles.helpOverlay} aria-hidden="true" style={{ position: "fixed" }}>
          <div className={styles.helpCallouts}>
            {helpCallouts.map((callout, index) => (
              <div
                key={callout.id}
                className={styles.helpCallout}
                style={callout.style}
                data-pointer={callout.hideIndex ? "left" : "right"}
                data-placement={callout.placement}
              >
                {!callout.hideIndex ? (
                  <span className={styles.helpCalloutIndex}>{index + 1}</span>
                ) : null}
                <span className={styles.helpCalloutText}>{callout.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className={styles.dashboardGrid}>
        <div
          className={`${styles.card}${showHelp ? ` ${styles.helpDisabledColumn}` : ""}`}
          aria-hidden={showHelp ? "true" : undefined}
        >
          <div className={styles.listHeader}>
            <h2 className={`${styles.sectionTitle} ${styles.listHeaderTitle}`}>
              {messages.seniorPlayerListTitle}
            </h2>
            <div className={styles.listHeaderControls}>
              {seniorTeams.length > 1 ? (
                <label className={styles.sortControl}>
                  <span className={styles.sortLabel}>{messages.seniorTeamLabel}</span>
                  <select
                    className={styles.sortSelect}
                    value={selectedSeniorTeamId ?? ""}
                    onChange={(event) => {
                      const nextId = Number(event.target.value);
                      if (Number.isNaN(nextId)) return;
                      handleSeniorTeamChange(nextId);
                    }}
                  >
                    {seniorTeams.map((team) => (
                      <option key={team.teamId} value={team.teamId}>
                        {formatSeniorTeamOptionLabel(team)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={styles.sortControl}>
                <span className={styles.sortLabel}>{messages.sortLabel}</span>
                <select
                  className={styles.sortSelect}
                  value={isMatrixSortActive ? "custom" : sortKey}
                  onChange={(event) => {
                    const nextKey = event.target.value as SeniorSortSelectKey;
                    if (nextKey === "custom") return;
                    setSortKey(nextKey);
                    setOrderSource("list");
                    setOrderedPlayerIds(null);
                    addNotification(`${messages.notificationSortBy} ${sortLabel(messages, nextKey)}`);
                  }}
                >
                  {isMatrixSortActive ? (
                    <option value="custom" hidden>
                      {messages.sortCustom}
                    </option>
                  ) : null}
                  <option value="name">{messages.sortName}</option>
                  <option value="age">{messages.sortAge}</option>
                  <option value="arrival">{messages.sortArrival}</option>
                  <option value="tsi">{messages.sortTsi}</option>
                  <option value="wage">{messages.sortWage}</option>
                  <option value="form">{messages.sortForm}</option>
                  <option value="stamina">{messages.sortStamina}</option>
                  <option value="experience">{messages.sortExperience}</option>
                  <option value="loyalty">{messages.sortLoyalty}</option>
                  <option value="injuries">{messages.sortInjuries}</option>
                  <option value="cards">{messages.sortCards}</option>
                  <option value="keeper">{messages.sortKeeper}</option>
                  <option value="defender">{messages.sortDefender}</option>
                  <option value="playmaker">{messages.sortPlaymaker}</option>
                  <option value="winger">{messages.sortWinger}</option>
                  <option value="passing">{messages.sortPassing}</option>
                  <option value="scorer">{messages.sortScorer}</option>
                  <option value="setpieces">{messages.sortSetPieces}</option>
                </select>
              </label>
              <button
                type="button"
                className={styles.sortToggle}
                aria-label={messages.sortToggleAria}
                onClick={() => {
                  const next = sortDirection === "asc" ? "desc" : "asc";
                  setSortDirection(next);
                  setOrderSource("list");
                  setOrderedPlayerIds(null);
                  addNotification(
                    `${messages.notificationSortDirection} ${
                      next === "asc" ? messages.sortAscLabel : messages.sortDescLabel
                    }`
                  );
                }}
              >
                ↕️
              </button>
            </div>
          </div>
          {orderedListPlayers.length === 0 ? (
            <p className={styles.muted}>{messages.unableToLoadPlayers}</p>
          ) : (
            <ul className={styles.list}>
              {orderedListPlayers.map((player) => {
                const playerDetails = detailsById.get(player.PlayerID);
                const playerName = formatPlayerName(player);
                const hasMotherClubBonus = Boolean(playerDetails?.MotherClubBonus);
                const isSelected = selectedId === player.PlayerID;
                const specialty = player.Specialty ?? null;
                const isNameSort = sortKey === "name";
                const ageYears = typeof player.Age === "number" ? player.Age : null;
                const ageDays = typeof player.AgeDays === "number" ? player.AgeDays : null;
                const ageLabel =
                  ageYears !== null && ageDays !== null
                    ? `${ageYears}${messages.ageYearsShort} ${ageDays}${messages.ageDaysShort}`
                    : ageYears !== null
                    ? `${ageYears}${messages.ageYearsShort}`
                    : null;
                const agePillClassName =
                  ageYears === null
                    ? null
                    : ageYears > 35
                    ? styles.playerAgePillDarkRed
                    : ageYears > 30
                    ? styles.playerAgePillFadedRed
                    : ageYears >= 20
                    ? styles.playerAgePillYellow
                    : styles.playerAgePillGreen;
                const injuryLevel =
                  typeof playerDetails?.InjuryLevel === "number"
                    ? playerDetails.InjuryLevel
                    : typeof player.InjuryLevel === "number"
                    ? player.InjuryLevel
                    : null;
                const isBruised = injuryLevel !== null && injuryLevel > 0 && injuryLevel < 1;
                const injuryWeeks = injuryLevel !== null && injuryLevel >= 1 ? Math.ceil(injuryLevel) : null;
                const injuryLabel = isBruised
                  ? messages.seniorListInjuryBruised
                  : injuryWeeks !== null
                  ? messages.seniorListInjuryWeeks.replace("{weeks}", String(injuryWeeks))
                  : null;
                const formValue =
                  typeof playerDetails?.Form === "number"
                    ? playerDetails.Form
                    : typeof player.Form === "number"
                    ? player.Form
                    : null;
                const staminaValue =
                  typeof playerDetails?.StaminaSkill === "number"
                    ? playerDetails.StaminaSkill
                    : typeof player.StaminaSkill === "number"
                    ? player.StaminaSkill
                    : null;
                const experienceValue =
                  typeof playerDetails?.Experience === "number"
                    ? playerDetails.Experience
                    : null;
                const loyaltyValue =
                  typeof playerDetails?.Loyalty === "number"
                    ? playerDetails.Loyalty
                    : null;
                const cardsValue =
                  typeof playerDetails?.Cards === "number"
                    ? playerDetails.Cards
                    : typeof player.Cards === "number"
                    ? player.Cards
                    : null;
                const playerCardStatus = buildSeniorCardStatus(cardsValue, messages);
                const wageValue =
                  typeof playerDetails?.Salary === "number"
                    ? playerDetails.Salary
                    : typeof player.Salary === "number"
                    ? player.Salary
                    : null;
                const arrivalMetric = player.ArrivalDate
                  ? formatDateTime(Date.parse(player.ArrivalDate.replace(" ", "T")))
                  : messages.unknownShort;
                const cardsMetric = (() => {
                  if (typeof cardsValue !== "number") {
                    return (
                      <span
                        className={`${styles.playerMetricPill} ${styles.playerMetricPillNeutral}`}
                      >
                        {messages.seniorCardsMatchRunning}
                      </span>
                    );
                  }
                  if (cardsValue >= 3) {
                    return (
                      <span className={styles.playerMetricPill}>
                        <span className={styles.playerCardIcon}>🟥</span>
                      </span>
                    );
                  }
                  if (cardsValue === 2) {
                    return (
                      <span className={styles.playerMetricPill}>
                        <span className={styles.playerCardIcon}>🟨</span>
                        <span className={styles.playerCardIcon}>🟨</span>
                      </span>
                    );
                  }
                  if (cardsValue === 1) {
                    return (
                      <span className={styles.playerMetricPill}>
                        <span className={styles.playerCardIcon}>🟨</span>
                      </span>
                    );
                  }
                  return null;
                })();
                const metricNode: ReactNode = (() => {
                  switch (sortKey) {
                    case "age":
                      return ageLabel && agePillClassName ? (
                        <span className={`${styles.playerAgePill} ${agePillClassName}`}>
                          {ageLabel}
                        </span>
                      ) : (
                        <span
                          className={`${styles.playerMetricPill} ${styles.playerMetricPillNeutral}`}
                        >
                          {messages.unknownShort}
                        </span>
                      );
                    case "arrival":
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            player.ArrivalDate ? "" : styles.playerMetricPillNeutral
                          }`}
                        >
                          {arrivalMetric}
                        </span>
                      );
                    case "tsi":
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof player.TSI === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(player.TSI ?? null, tsiRange.min, tsiRange.max)}
                        >
                          {player.TSI ?? messages.unknownShort}
                        </span>
                      );
                    case "wage":
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof wageValue === "number"
                              ? ""
                              : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(
                            wageValue,
                            wageRange.min,
                            wageRange.max,
                            true
                          )}
                        >
                          {wageValue !== null ? formatEurFromSek(wageValue) : messages.unknownShort}
                        </span>
                      );
                    case "form":
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof formValue === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(formValue, 0, 8)}
                        >
                          {formValue ?? messages.unknownShort}
                        </span>
                      );
                    case "stamina":
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof staminaValue === "number"
                              ? ""
                              : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(staminaValue, 0, 9)}
                        >
                          {staminaValue ?? messages.unknownShort}
                        </span>
                      );
                    case "experience":
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof experienceValue === "number"
                              ? ""
                              : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(experienceValue, 0, 20)}
                        >
                          {experienceValue ?? messages.unknownShort}
                        </span>
                      );
                    case "loyalty":
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof loyaltyValue === "number"
                              ? ""
                              : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(loyaltyValue, 0, 20)}
                        >
                          {loyaltyValue ?? messages.unknownShort}
                        </span>
                      );
                    case "injuries":
                      if (isBruised) {
                        return (
                          <span className={styles.playerMetricPill} title={messages.sortInjuries}>
                            🩹
                          </span>
                        );
                      }
                      if (injuryWeeks !== null) {
                        return (
                          <span className={styles.playerMetricPill} title={messages.sortInjuries}>
                            {`✚${toSubscript(injuryWeeks)}`}
                          </span>
                        );
                      }
                      return null;
                    case "cards":
                      return cardsMetric;
                    case "keeper": {
                      const value = skillValueForPlayer(player, "KeeperSkill");
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof value === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(value, 0, 20)}
                        >
                          {value ?? messages.unknownShort}
                        </span>
                      );
                    }
                    case "defender": {
                      const value = skillValueForPlayer(player, "DefenderSkill");
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof value === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(value, 0, 20)}
                        >
                          {value ?? messages.unknownShort}
                        </span>
                      );
                    }
                    case "playmaker": {
                      const value = skillValueForPlayer(player, "PlaymakerSkill");
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof value === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(value, 0, 20)}
                        >
                          {value ?? messages.unknownShort}
                        </span>
                      );
                    }
                    case "winger": {
                      const value = skillValueForPlayer(player, "WingerSkill");
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof value === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(value, 0, 20)}
                        >
                          {value ?? messages.unknownShort}
                        </span>
                      );
                    }
                    case "passing": {
                      const value = skillValueForPlayer(player, "PassingSkill");
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof value === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(value, 0, 20)}
                        >
                          {value ?? messages.unknownShort}
                        </span>
                      );
                    }
                    case "scorer": {
                      const value = skillValueForPlayer(player, "ScorerSkill");
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof value === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(value, 0, 20)}
                        >
                          {value ?? messages.unknownShort}
                        </span>
                      );
                    }
                    case "setpieces": {
                      const value = skillValueForPlayer(player, "SetPiecesSkill");
                      return (
                        <span
                          className={`${styles.playerMetricPill} ${
                            typeof value === "number" ? "" : styles.playerMetricPillNeutral
                          }`}
                          style={metricPillStyle(value, 0, 20)}
                        >
                          {value ?? messages.unknownShort}
                        </span>
                      );
                    }
                    default:
                      return null;
                  }
                })();

                return (
                  <li key={player.PlayerID} className={styles.listItem}>
                    <div className={styles.playerRow}>
                      <Tooltip content={messages.youthDragToLineupHint} fullWidth>
                        <button
                          type="button"
                          className={styles.playerButton}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setActiveDetailsTab("details");
                            setSelectedId(player.PlayerID);
                            addNotification(
                              `${messages.notificationPlayerSelected} ${playerName}`
                            );
                          }}
                          draggable
                          onDragStart={(event) =>
                            handleSeniorPlayerDragStart(
                              event,
                              player.PlayerID,
                              playerName
                            )
                          }
                        >
                        {!isNameSort ? (
                          <span
                            className={`${styles.playerSortMetric} ${
                              sortKey === "age" ? styles.playerSortMetricPill : ""
                            }`}
                          >
                            {metricNode}
                          </span>
                        ) : null}
                        <span
                          className={`${styles.playerNameRow} ${
                            isNameSort ? styles.playerNameRowTruncate : ""
                          }`}
                        >
                          <span className={styles.playerName}>{playerName}</span>
                          {injuryLabel ? (
                            <span
                              className={styles.playerInjuryInline}
                              title={injuryLabel}
                              aria-label={injuryLabel}
                            >
                              {isBruised ? "🩹" : `✚${toSubscript(injuryWeeks ?? 0)}`}
                            </span>
                          ) : null}
                          {playerCardStatus ? (
                            <span
                              className={styles.playerCardStatusInline}
                              title={playerCardStatus.label}
                              aria-label={playerCardStatus.label}
                            >
                              {playerCardStatus.display}
                            </span>
                          ) : null}
                          {matrixNewPlayerIdSet.has(player.PlayerID) ? (
                            <span className={styles.matrixNewPill}>
                              {messages.matrixNewPillLabel}
                            </span>
                          ) : null}
                          {hasMotherClubBonus ? (
                            <Tooltip content={messages.motherClubBonusTooltip}>
                              <span
                                className={styles.seniorMotherClubHeart}
                                aria-label={messages.motherClubBonusTooltip}
                              >
                                ❤
                              </span>
                            </Tooltip>
                          ) : null}
                          {specialty && SPECIALTY_EMOJI[specialty] ? (
                            <span className={styles.playerSpecialty}>
                              {SPECIALTY_EMOJI[specialty]}
                            </span>
                          ) : null}
                        </span>
                        {isNameSort ? (
                          <span className={styles.playerIndicators}>
                            {ageLabel && agePillClassName ? (
                              <span className={`${styles.playerAgePill} ${agePillClassName}`}>
                                {ageLabel}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        </button>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={styles.columnStack}>
          {showHelp ? (
            <div className={styles.helpCard}>
              <h2 className={styles.helpTitle}>{messages.seniorHelpTitle}</h2>
              <p className={styles.helpIntro}>{messages.seniorHelpIntro}</p>
              <ul className={styles.helpList}>
                <li>{messages.seniorHelpBulletLatestUpdates}</li>
                <li>{messages.seniorHelpBulletAiOverview}</li>
                <li>{messages.seniorHelpBulletAiTrainingAware}</li>
                <li>{messages.seniorHelpBulletAiIgnoreTraining}</li>
                <li>{messages.seniorHelpBulletAiMatchTypes}</li>
                <li>{messages.seniorHelpBulletTrainingRegimen}</li>
                <li>{messages.seniorHelpBulletAnalyzeOpponent}</li>
              </ul>
              <button
                type="button"
                className={styles.helpDismiss}
                onClick={() => {
                  setShowHelp(false);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(SENIOR_HELP_STORAGE_KEY, currentToken ?? "1");
                  }
                }}
              >
                {messages.helpDismissLabel}
              </button>
            </div>
          ) : (
            <PlayerDetailsPanel
            selectedPlayer={selectedPanelPlayer}
            detailsData={selectedPanelDetails}
            loading={false}
            error={null}
            lastUpdated={selectedId ? (detailsCache[selectedId]?.fetchedAt ?? null) : null}
            unlockStatus={null}
            onRefresh={() => {
              if (refreshing || players.length === 0) return;
              void refreshDetailsForPlayers(players);
            }}
            players={panelPlayers}
            playerDetailsById={panelDetailsById}
            skillsMatrixRows={skillsMatrixRows}
            ratingsMatrixResponse={ratingsResponse}
            ratingsMatrixSelectedName={selectedPlayer ? formatPlayerName(selectedPlayer) : null}
            ratingsMatrixSpecialtyByName={specialtyByName}
            ratingsMatrixMotherClubBonusByName={motherClubBonusByName}
            ratingsMatrixCardStatusByName={seniorCardStatusByName}
            cardStatusByPlayerId={seniorCardStatusByPlayerId}
            matrixNewPlayerIds={matrixNewMarkers.playerIds}
            matrixNewRatingsByPlayerId={matrixNewMarkers.ratingsByPlayerId}
            matrixNewSkillsCurrentByPlayerId={matrixNewMarkers.skillsCurrentByPlayerId}
            matrixNewSkillsMaxByPlayerId={matrixNewMarkers.skillsMaxByPlayerId}
            onSelectRatingsPlayer={(playerName) => {
              const player = players.find((item) => formatPlayerName(item) === playerName);
              if (!player) return;
              setActiveDetailsTab("details");
              setSelectedId(player.PlayerID);
            }}
            onMatrixPlayerDragStart={handleSeniorPlayerDragStart}
            orderedPlayerIds={orderedPlayerIds}
            orderSource={orderSource}
            onRatingsOrderChange={(ids) => applyPlayerOrder(ids, "ratings")}
            onSkillsOrderChange={(ids) => applyPlayerOrder(ids, "skills")}
            onRatingsSortStart={() => {
              setOrderSource("ratings");
              setOrderedPlayerIds(null);
            }}
            onSkillsSortStart={() => {
              setOrderSource("skills");
              setOrderedPlayerIds(null);
            }}
            hasPreviousPlayer={Boolean(previousPlayerId)}
            hasNextPlayer={Boolean(nextPlayerId)}
            onPreviousPlayer={() => {
              if (!previousPlayerId) return;
              setActiveDetailsTab("details");
              setSelectedId(previousPlayerId);
            }}
            onNextPlayer={() => {
              if (!nextPlayerId) return;
              setActiveDetailsTab("details");
              setSelectedId(nextPlayerId);
            }}
            playerKind="senior"
            skillMode="single"
            maxSkillLevel={20}
            activeTab={activeDetailsTab}
            onActiveTabChange={setActiveDetailsTab}
            showSeniorSkillBonusInMatrix={showSeniorSkillBonusInMatrix}
            onShowSeniorSkillBonusInMatrixChange={setShowSeniorSkillBonusInMatrix}
            messages={messages}
          />
          )}
        </div>

        <div
          className={`${styles.columnStack}${showHelp ? ` ${styles.helpDisabledColumn}` : ""}`}
          aria-hidden={showHelp ? "true" : undefined}
        >
          <div className={styles.seniorLineupFieldCompact}>
            <LineupField
              assignments={assignments}
              behaviors={behaviors}
              playersById={playersByIdForLineup}
              playerDetailsById={new Map(
                Array.from(detailsById.entries()).map(([id, detail]) => [
                  id,
                  {
                    PlayerSkills: detail.PlayerSkills,
                    InjuryLevel: detail.InjuryLevel,
                    Cards: detail.Cards,
                    Form: detail.Form,
                    StaminaSkill: detail.StaminaSkill,
                  },
                ])
              )}
              onAssign={(slotId, playerId) => {
                setAssignments((prev) => {
                  const next = { ...prev };
                  Object.keys(next).forEach((key) => {
                    if (next[key] === playerId) {
                      next[key] = null;
                    }
                  });
                  next[slotId] = playerId;
                  return next;
                });
                setLoadedMatchId(null);
              }}
              onClear={(slotId) => {
                setAssignments((prev) => ({ ...prev, [slotId]: null }));
                setLoadedMatchId(null);
              }}
              onMove={(fromSlot, toSlot) => {
                setAssignments((prev) => ({
                  ...prev,
                  [toSlot]: prev[fromSlot] ?? null,
                  [fromSlot]: prev[toSlot] ?? null,
                }));
                setLoadedMatchId(null);
              }}
              onChangeBehavior={(slotId, behavior) => {
                setBehaviors((prev) => {
                  const next = { ...prev };
                  if (behavior) next[slotId] = behavior;
                  else delete next[slotId];
                  return next;
                });
                setLoadedMatchId(null);
              }}
              onReset={() => {
                setAssignments({});
                setBehaviors({});
                setLoadedMatchId(null);
                setExtraTimePreparedSubmission(null);
                addNotification(messages.notificationLineupReset);
              }}
              tacticType={tacticType}
              onTacticChange={setTacticType}
              tacticPlacement="headerRight"
              trainingType={trainingType}
              onTrainingTypeChange={setTrainingType}
              onTrainingTypeSet={handleSetTrainingType}
              trainingTypeSetPending={trainingTypeSetPending}
              trainingTypeSetPendingValue={trainingTypeSetPendingValue}
              trainingTypePlacement="fieldTopLeft"
              trainingTypeOptions={[...NON_DEPRECATED_TRAINING_TYPES]}
              trainingTypeLabelForValue={obtainedTrainingRegimenLabel}
              trainingTypeSectionTitleForValue={trainingSectionTitleForValue}
              trainingTypeAriaLabel={seniorTrainingLabel}
              trainedSlots={seniorTrainedSlots}
              onHoverPlayer={(playerId) => {
                void ensureDetails(playerId);
              }}
              onSelectPlayer={(playerId) => {
                setSelectedId(playerId);
                void ensureDetails(playerId);
              }}
              skillMode="single"
              maxSkillLevel={20}
              messages={messages}
            />
          </div>
          <UpcomingMatches
            response={matchesState}
            messages={messages}
            assignments={assignments}
            behaviors={behaviors}
            penaltyKickerIds={seniorPenaltyKickerIds}
            setPiecesId={seniorSetPiecesPlayerId}
            tacticType={tacticType}
            sourceSystem="Hattrick"
            includeTournamentMatches={includeTournamentMatches}
            onIncludeTournamentMatchesChange={setIncludeTournamentMatches}
            setBestLineupHelpAnchor="senior-set-lineup-ai"
            showExtraTimeSetBestLineupMode
            keepBestLineupMenuTopmost
            fixedFormationOptions={[...FIXED_FORMATION_OPTIONS]}
            selectedFixedFormation={setBestLineupFixedFormation}
            onSelectedFixedFormationChange={setSetBestLineupFixedFormation}
            setBestLineupCustomContent={setBestLineupBTeamMenuContent}
            onRefresh={onRefreshMatchesOnly}
            onSetBestLineupMode={async (matchId, mode, fixedFormation) => {
              if (mode === "extraTime") {
                setExtraTimeMatchId(matchId);
                await syncExtraTimeModalTrainingType().catch(() => {
                  // Fall back to the last known senior training if the live fetch fails.
                });
                setExtraTimeInfoOpen(true);
                return;
              }
              setExtraTimePreparedSubmission(null);
              return runSetBestLineupPredictRatings(matchId, mode, fixedFormation);
            }}
            onAnalyzeOpponent={(matchId) => {
              return handleAnalyzeOpponent(matchId);
            }}
            onSetBestLineup={(matchId) => {
              void matchId;
            }}
            onLoadLineup={(
              nextAssignments,
              nextBehaviors,
              matchId,
              loadedTacticType
            ) => {
              setExtraTimePreparedSubmission(null);
              setAssignments(nextAssignments);
              setBehaviors(nextBehaviors);
              if (typeof loadedTacticType === "number") {
                setTacticType(loadedTacticType);
              }
              setLoadedMatchId(matchId);
            }}
            loadedMatchId={loadedMatchId}
            onSubmitSuccess={() => {
              if (extraTimePreparedSubmission) {
                setSubmitDisclaimerExtraTimeSummary({
                  trainingLabel: obtainedTrainingRegimenLabel(
                    extraTimePreparedSubmission.trainingType
                  ),
                  trainees: extraTimePreparedSubmission.traineeIds.map((playerId) => {
                    const player = playersById.get(playerId);
                    return {
                      id: playerId,
                      name: player ? formatPlayerName(player) : String(playerId),
                    };
                  }),
                });
              } else {
                setSubmitDisclaimerExtraTimeSummary(null);
              }
              setExtraTimePreparedSubmission(null);
              setSubmitDisclaimerOpen(true);
              void onRefreshMatchesOnly();
            }}
            buildSubmitLineupPayload={(matchId, defaultPayload) =>
              buildPreparedExtraTimeSubmitPayload(matchId, defaultPayload)
            }
          />
        </div>
      </div>
    </div>
  );
}
