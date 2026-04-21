"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import styles from "../page.module.css";
import YouthPlayerList from "./YouthPlayerList";
import PlayerDetailsPanel, {
  type PlayerDetailsPanelTab,
  YouthPlayerDetails,
} from "./PlayerDetailsPanel";
import LineupField, {
  LineupAssignments,
  LineupBehaviors,
  OptimizeMode,
} from "./LineupField";
import UpcomingMatches, { type MatchesResponse } from "./UpcomingMatches";
import MobileToolMenu, { type MobileToolView as YouthMobileView } from "./MobileToolMenu";
import type { YouthTeamOption } from "../page";
import { Messages } from "@/lib/i18n";
import { getChangelogEntries } from "@/lib/changelog";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import Tooltip from "./Tooltip";
import Modal from "./Modal";
import TransferSearchModal, {
  ageToTotalDays,
  buildTransferSearchMinimumBidEur,
  buildTransferSearchParams,
  CHPP_SEK_PER_EUR,
  clampTransferSkillValue,
  eurToSek,
  formatTransferSearchBidDraftEur,
  formatTransferSearchPlayerName,
  normalizeTransferSearchFilters,
  normalizeTransferSearchResults,
  totalDaysToAge,
  TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS,
  TRANSFER_SEARCH_SKILLS,
  type TransferSearchBidDraft,
  type TransferSearchFilters,
  type TransferSearchResult,
  type TransferSearchSkillFilter,
  type TransferSearchSkillKey,
} from "./TransferSearchModal";
import SeniorFoxtrickMetrics from "./SeniorFoxtrickMetrics";
import {
  POSITION_COLUMNS,
  normalizeMatchRoleId,
  positionLabel,
} from "@/lib/positions";
import { parseChppDate } from "@/lib/chpp/utils";
import { formatDateTime } from "@/lib/datetime";
import {
  getAutoSelection,
  getTrainingForStar,
  getTrainingSlots,
  optimizeLineupForStar,
  optimizeByRatings,
  optimizeRevealPrimaryCurrent,
  optimizeRevealSecondaryMax,
  optimizeRevealPrimaryCurrentAndSecondaryMax,
  buildSkillRanking,
  type OptimizerPlayer,
  type OptimizerDebug,
  type SkillKey,
  type TrainingSkillKey,
} from "@/lib/optimizer";
import {
  ALGORITHM_SETTINGS_EVENT,
  ALGORITHM_SETTINGS_STORAGE_KEY,
  DEFAULT_YOUTH_STALENESS_DAYS,
  LAST_REFRESH_STORAGE_KEY,
  readAllowTrainingUntilMaxedOut,
  readLastRefreshTimestamp,
  readYouthStalenessDays,
  writeLastRefreshTimestamp,
  YOUTH_SETTINGS_EVENT,
  YOUTH_SETTINGS_STORAGE_KEY,
  YOUTH_NEW_MARKERS_DEBUG_EVENT,
  YOUTH_DEBUG_SE_FETCH_EVENT,
} from "@/lib/settings";
import { useNotifications } from "./notifications/NotificationsProvider";
import {
  CHPP_AUTH_REQUIRED_EVENT,
  type ChppDebugOauthErrorMode,
  ChppAuthRequiredError,
  fetchChppJson,
  reconnectChppWithTokenReset,
  readChppDebugOauthErrorMode,
  writeChppDebugOauthErrorMode,
} from "@/lib/chpp/client";
import { mapWithConcurrency } from "@/lib/async";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  hattrickPlayerUrl,
  hattrickTeamUrl,
  hattrickYouthMatchUrl,
} from "@/lib/hattrick/urls";
import { setDragGhost } from "@/lib/drag";
import {
  getMissingChppPermissions,
  parseExtendedPermissionsFromCheckToken,
  REQUIRED_CHPP_EXTENDED_PERMISSIONS,
} from "@/lib/chpp/permissions";

const YOUTH_REFRESH_REQUEST_EVENT = "ya:youth-refresh-request";
const YOUTH_REFRESH_STOP_EVENT = "ya:youth-refresh-stop";
const YOUTH_REFRESH_STATE_EVENT = "ya:youth-refresh-state";
const YOUTH_LATEST_UPDATES_OPEN_EVENT = "ya:youth-latest-updates-open";
const MOBILE_LAUNCHER_REQUEST_EVENT = "ya:mobile-launcher-request";
const MOBILE_NAV_TRAIL_STATE_EVENT = "ya:mobile-nav-trail-state";
const MOBILE_NAV_TRAIL_JUMP_EVENT = "ya:mobile-nav-trail-jump";
const MOBILE_YOUTH_MEDIA_QUERY = "(max-width: 900px)";
const YOUTH_UPDATES_HISTORY_LIMIT = 20;
const YOUTH_UPDATES_SCHEMA_VERSION = 3;
const YOUTH_UPDATES_GLOBAL_MIGRATION_KEY = "ya_youth_updates_schema_v2_migrated";
const VALID_LINEUP_SLOT_IDS = new Set([
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
  "B_GK",
  "B_CD",
  "B_WB",
  "B_IM",
  "B_F",
  "B_W",
  "B_X",
]);

const parseSeniorMetricSkill = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parsed = Number(record["#text"]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const BASE_TRAINING_SKILLS: SkillKey[] = [
  "keeper",
  "defending",
  "playmaking",
  "winger",
  "passing",
  "scoring",
  "setpieces",
];
const TRAINING_BASE_SKILL_MAP: Record<TrainingSkillKey, SkillKey> = {
  keeper: "keeper",
  defending: "defending",
  playmaking: "playmaking",
  winger: "winger",
  passing: "passing",
  scoring: "scoring",
  setpieces: "setpieces",
  defending_defenders_midfielders: "defending",
  winger_winger_attackers: "winger",
  passing_defenders_midfielders: "passing",
};

const formatPlayerName = (player: YouthPlayer) =>
  [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");

const sanitizeLineupAssignments = (
  assignments: LineupAssignments
): LineupAssignments =>
  Object.fromEntries(
    Object.entries(assignments).filter(([slotId]) => VALID_LINEUP_SLOT_IDS.has(slotId))
  );

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
  InjuryLevel?: number;
  Age?: number;
  AgeDays?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  PlayerSkills?: Record<string, SkillValue>;
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

type MatrixNewMarkers = {
  detectedAt: number | null;
  playerIds: number[];
  ratingsByPlayerId: Record<number, number[]>;
  skillsCurrentByPlayerId: Record<number, string[]>;
  skillsMaxByPlayerId: Record<number, string[]>;
};

type YouthUpdatesGroupedEntry = {
  id: string;
  comparedAt: number;
  source: "refresh" | "debug";
  hasChanges: boolean;
  groupedByPlayerId: Record<
    number,
    {
      playerId: number;
      playerName: string;
      isNewPlayer: boolean;
      ratings: Array<{ position: number; previous: number | null; current: number | null }>;
      skillsCurrent: Array<{
        skillKey: string;
        previous: number | null;
        current: number | null;
      }>;
      skillsMax: Array<{
        skillKey: string;
        previous: number | null;
        current: number | null;
      }>;
      attributes: Array<{
        key: "hiddenSpecialtyDiscovered" | "injuryStatus";
        previous: number | string | boolean | null;
        current: number | string | boolean | null;
      }>;
    }
  >;
};

type YouthAttributeChange = {
  key: "hiddenSpecialtyDiscovered" | "injuryStatus";
  previous: number | string | boolean | null;
  current: number | string | boolean | null;
};

type YouthUpdatesBuildContext = {
  previousRatingsByPlayerId?: Record<number, Record<string, number>>;
  currentRatingsByPlayerId?: Record<number, Record<string, number>>;
  previousSkillsByPlayerId?: Map<
    number,
    Record<string, SkillValue | number | string> | null
  >;
  currentSkillsByPlayerId?: Map<
    number,
    Record<string, SkillValue | number | string> | null
  >;
  attributeChangesByPlayerId?: Record<number, YouthAttributeChange[]>;
};

type PersistedYouthMarkersBaseline = {
  players: YouthPlayer[];
  detailsById: Map<number, YouthPlayerDetails>;
  ratingsByPlayerId: Record<number, Record<string, number>>;
  ratingsPositions: number[];
};

type PlayerDetailsResponse = {
  data?: Record<string, unknown>;
  unlockStatus?: "success" | "denied";
  error?: string;
  details?: string;
  statusCode?: number;
  code?: string;
};

type YouthPlayerDetailRefreshResult = {
  id: number;
  detailRaw: Record<string, unknown> | null;
  resolved: YouthPlayerDetails | null;
  ok: boolean;
  error: string | null;
};

type DashboardProps = {
  players: YouthPlayer[];
  matchesResponse: MatchesResponse;
  ratingsResponse: RatingsMatrixResponse | null;
  initialYouthTeams?: YouthTeamOption[];
  initialYouthTeamId?: number | null;
  appVersion: string;
  messages: Messages;
  isConnected: boolean;
  initialLoadError?: string | null;
  initialLoadDetails?: string | null;
  initialAuthError?: boolean;
};

type ManagerCompendiumResponse = {
  data?: {
    HattrickData?: {
      Manager?: {
        Teams?: {
          Team?: ManagerTeam | ManagerTeam[];
        };
      };
    };
  };
  error?: string;
  details?: string;
  code?: string;
  statusCode?: number;
};

type ManagerTeam = {
  TeamId?: number | string;
  TeamName?: string;
  YouthTeam?: {
    YouthTeamId?: number | string;
    YouthTeamName?: string;
    YouthLeague?: {
      YouthLeagueName?: string;
    };
  };
};

type SupporterStatus = "unknown" | "supporter" | "nonSupporter";

const normalizeTeams = (input?: ManagerTeam | ManagerTeam[]) => {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
};

const extractYouthTeams = (response: ManagerCompendiumResponse): YouthTeamOption[] => {
  const teams = normalizeTeams(
    response.data?.HattrickData?.Manager?.Teams?.Team
  );
  return teams.reduce<YouthTeamOption[]>((acc, team) => {
    const youthTeamId = Number(team.YouthTeam?.YouthTeamId ?? 0);
    if (!youthTeamId) return acc;
    acc.push({
      teamId: Number(team.TeamId ?? 0),
      teamName: team.TeamName ?? "",
      youthTeamId,
      youthTeamName: team.YouthTeam?.YouthTeamName ?? "",
      youthLeagueName: team.YouthTeam?.YouthLeague?.YouthLeagueName ?? null,
    });
    return acc;
  }, []);
};

const isSupporterTierValue = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return Boolean(
      normalized &&
        normalized !== "0" &&
        normalized !== "none" &&
        normalized !== "false" &&
        normalized !== "no"
    );
  }
  return false;
};

type CachedDetails = {
  data: Record<string, unknown>;
  fetchedAt: number;
};

type MobileYouthPlayerScreen = "root" | "list" | "detail";

type MobileYouthHistoryState = {
  appShell?: "launcher" | "tool";
  tool?: "youth" | "senior" | "chronicle";
  youthView?: YouthMobileView;
  youthScreen?: MobileYouthPlayerScreen;
};

type MatchSummary = {
  MatchDate?: string;
  MatchID?: number | string;
  SourceSystem?: string;
};

type MatchLineupPlayer = {
  RoleID?: number | string;
  RatingStars?: number | string;
  PlayerID?: number | string;
  FirstName?: string;
  NickName?: string;
  LastName?: string;
};

type MatchLineupResponse = {
  data?: {
    HattrickData?: {
      Team?: {
        Lineup?: {
          Player?: MatchLineupPlayer | MatchLineupPlayer[];
        };
      };
    };
  };
  error?: string;
  details?: string;
  statusCode?: number;
  code?: string;
};

type MatchesArchiveResponse = {
  data?: {
    HattrickData?: {
      Team?: {
        TeamID?: number | string;
        MatchList?: {
          Match?: MatchSummary | MatchSummary[];
        };
      };
    };
  };
  error?: string;
  details?: string;
  statusCode?: number;
  code?: string;
};

type MatchDetailsEvent = {
  EventTypeID?: number | string;
  SubjectPlayerID?: number | string;
  ObjectPlayerID?: number | string;
  SubjectPlayerName?: string;
  ObjectPlayerName?: string;
  EventText?: string;
  EventDescription?: string;
  EventComment?: string;
  EventCommentary?: string;
};

type MatchDetailsEventsResponse = {
  data?: {
    HattrickData?: {
      Match?: {
        EventList?: {
          Event?: MatchDetailsEvent | MatchDetailsEvent[];
        };
      };
    };
  };
  error?: string;
  details?: string;
  statusCode?: number;
  code?: string;
};

type RefreshRatingsResult = {
  ok: boolean;
  ratingsByPlayerId: Record<number, Record<string, number>> | null;
  positions: number[] | null;
  hiddenSpecialtyScanOk: boolean;
  discoveredHiddenSpecialtyByPlayerId: Record<number, number>;
  hiddenSpecialtyDiscoveredMatchByPlayerId: Record<number, number>;
};

type EventPlayerRef = "subject" | "object";

type SpecialEventRule = {
  specialty: number;
  players: EventPlayerRef[];
};

const SPECIAL_EVENT_SPECIALTY_RULES: Record<number, SpecialEventRule> = {
  105: { specialty: 4, players: ["object"] },
  106: { specialty: 4, players: ["subject"] },
  108: { specialty: 4, players: ["subject"] },
  109: { specialty: 4, players: ["subject"] },
  115: { specialty: 2, players: ["subject"] },
  116: { specialty: 2, players: ["object"] },
  119: { specialty: 5, players: ["object"] },
  125: { specialty: 4, players: ["subject"] },
  137: { specialty: 5, players: ["object"] },
  139: { specialty: 1, players: ["subject", "object"] },
  190: { specialty: 3, players: ["subject"] },
  205: { specialty: 4, players: ["object"] },
  206: { specialty: 4, players: ["subject"] },
  208: { specialty: 4, players: ["subject"] },
  209: { specialty: 4, players: ["object"] },
  215: { specialty: 2, players: ["subject"] },
  216: { specialty: 2, players: ["object"] },
  219: { specialty: 5, players: ["object"] },
  225: { specialty: 4, players: ["object"] },
  239: { specialty: 1, players: ["subject"] },
  289: { specialty: 2, players: ["subject", "object"] },
  290: { specialty: 3, players: ["subject"] },
  301: { specialty: 1, players: ["subject"] },
  302: { specialty: 3, players: ["subject"] },
  303: { specialty: 1, players: ["subject"] },
  304: { specialty: 3, players: ["subject"] },
  305: { specialty: 2, players: ["subject"] },
  306: { specialty: 2, players: ["subject"] },
  307: { specialty: 8, players: ["subject"] },
  308: { specialty: 8, players: ["subject"] },
  309: { specialty: 8, players: ["subject"] },
  310: { specialty: 3, players: ["subject"] },
};

const DETAILS_TTL_MS = 5 * 60 * 1000;
const YOUTH_REFRESH_CONCURRENCY = 4;
const TRAINING_SKILLS: TrainingSkillKey[] = [
  "keeper",
  "defending",
  "playmaking",
  "winger",
  "passing",
  "scoring",
  "setpieces",
  "defending_defenders_midfielders",
  "winger_winger_attackers",
  "passing_defenders_midfielders",
];
const TRAINING_SKILL_SECTIONS: Array<{
  title: "focused" | "extended";
  options: TrainingSkillKey[];
}> = [
  {
    title: "focused",
    options: [
      "keeper",
      "defending",
      "playmaking",
      "winger",
      "passing",
      "scoring",
      "setpieces",
    ],
  },
  {
    title: "extended",
    options: [
      "defending_defenders_midfielders",
      "winger_winger_attackers",
      "passing_defenders_midfielders",
    ],
  },
];
const DEFAULT_PRIMARY_TRAINING: TrainingSkillKey = "keeper";
const DEFAULT_SECONDARY_TRAINING: TrainingSkillKey = "defending";
const TRAINING_SKILL_VALUE_KEYS: Record<
  TrainingSkillKey,
  { current: string; max: string }
> = {
  keeper: { current: "KeeperSkill", max: "KeeperSkillMax" },
  defending: { current: "DefenderSkill", max: "DefenderSkillMax" },
  playmaking: { current: "PlaymakerSkill", max: "PlaymakerSkillMax" },
  winger: { current: "WingerSkill", max: "WingerSkillMax" },
  passing: { current: "PassingSkill", max: "PassingSkillMax" },
  scoring: { current: "ScorerSkill", max: "ScorerSkillMax" },
  setpieces: { current: "SetPiecesSkill", max: "SetPiecesSkillMax" },
  defending_defenders_midfielders: {
    current: "DefenderSkill",
    max: "DefenderSkillMax",
  },
  winger_winger_attackers: { current: "WingerSkill", max: "WingerSkillMax" },
  passing_defenders_midfielders: {
    current: "PassingSkill",
    max: "PassingSkillMax",
  },
};

const SCOUT_COMMENT_SKILL_KEY_BY_TYPE: Record<number, string> = {
  1: "KeeperSkill",
  3: "DefenderSkill",
  4: "PlaymakerSkill",
  5: "WingerSkill",
  6: "ScorerSkill",
  7: "SetPiecesSkill",
  8: "PassingSkill",
};

const isTrainingSkill = (
  value: string | null | undefined
): value is TrainingSkillKey => TRAINING_SKILLS.includes(value as TrainingSkillKey);

const toBaseTrainingSkill = (value: TrainingSkillKey): SkillKey =>
  TRAINING_BASE_SKILL_MAP[value];

const buildEmptyMatrixNewMarkers = (): MatrixNewMarkers => ({
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

const normalizeMatrixNewMarkers = (value: unknown): MatrixNewMarkers => {
  if (!value || typeof value !== "object") {
    return buildEmptyMatrixNewMarkers();
  }
  const input = value as Partial<MatrixNewMarkers>;
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
    skillsMaxByPlayerId: normalizeIdArrayRecord<string>(
      input.skillsMaxByPlayerId
    ),
  };
};

const normalizeTransferSearchBidDrafts = (
  value: unknown
): Record<number, TransferSearchBidDraft> => {
  if (!value || typeof value !== "object") return {};
  const next: Record<number, TransferSearchBidDraft> = {};
  Object.entries(value as Record<string, unknown>).forEach(([playerId, draft]) => {
    const parsedPlayerId = Number(playerId);
    if (!Number.isFinite(parsedPlayerId) || parsedPlayerId <= 0) return;
    if (!draft || typeof draft !== "object") return;
    const node = draft as Record<string, unknown>;
    next[parsedPlayerId] = {
      bidEur: typeof node.bidEur === "string" ? node.bidEur : "",
      maxBidEur: typeof node.maxBidEur === "string" ? node.maxBidEur : "",
    };
  });
  return next;
};

const hasNonEmptyMarkerRecord = <T extends number | string>(
  value: Record<number, T[]>
) => Object.values(value).some((entries) => entries.length > 0);

const getKnownSkillValue = (skill?: SkillValue | number | string | null) => {
  if (!skill) return null;
  if (typeof skill === "number") return Number.isNaN(skill) ? null : skill;
  if (typeof skill === "string") {
    const numeric = Number(skill);
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
};

const mergedSkills = (
  detailsSkills?: Record<string, SkillValue> | null,
  playerSkills?: Record<string, SkillValue | number | string> | null
) => {
  if (!detailsSkills && !playerSkills) return null;
  return {
    ...(playerSkills ?? {}),
    ...(detailsSkills ?? {}),
  };
};

const hasAnyMatrixNewMarkers = (markers: MatrixNewMarkers) =>
  markers.playerIds.length > 0 ||
  hasNonEmptyMarkerRecord(markers.ratingsByPlayerId) ||
  hasNonEmptyMarkerRecord(markers.skillsCurrentByPlayerId) ||
  hasNonEmptyMarkerRecord(markers.skillsMaxByPlayerId);

const shouldKeepYouthUpdatesHistoryEntry = (entry: YouthUpdatesGroupedEntry) =>
  entry.hasChanges;

const migrateYouthUpdatesStateIfNeeded = () => {
  if (typeof window === "undefined") return false;
  const alreadyMigrated = window.localStorage.getItem(
    YOUTH_UPDATES_GLOBAL_MIGRATION_KEY
  );
  if (alreadyMigrated === String(YOUTH_UPDATES_SCHEMA_VERSION)) {
    return false;
  }
  const keysToMigrate: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (key === "ya_dashboard_state_v2" || key.startsWith("ya_dashboard_state_v2_")) {
      keysToMigrate.push(key);
    }
  }
  keysToMigrate.forEach((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next = {
        ...parsed,
        updatesSchemaVersion: YOUTH_UPDATES_SCHEMA_VERSION,
        matrixNewMarkers: buildEmptyMatrixNewMarkers(),
        youthUpdatesHistory: [],
      };
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore malformed legacy payloads
    }
  });
  window.localStorage.setItem(
    YOUTH_UPDATES_GLOBAL_MIGRATION_KEY,
    String(YOUTH_UPDATES_SCHEMA_VERSION)
  );
  return true;
};

const cloneRatingsRecord = (
  ratings?: Record<string, number> | null
): Record<string, number> => {
  if (!ratings) return {};
  return Object.fromEntries(
    Object.entries(ratings).filter(
      ([, value]) => typeof value === "number" && Number.isFinite(value)
    )
  );
};

const buildRatingsBaselineByPlayerId = ({
  players,
  ratingsResponseState,
  ratingsCache,
}: {
  players: YouthPlayer[];
  ratingsResponseState: RatingsMatrixResponse | null;
  ratingsCache: Record<number, Record<string, number>>;
}): Record<number, Record<string, number>> => {
  const responseRatingsById = new Map<number, Record<string, number>>(
    (ratingsResponseState?.players ?? []).map((row) => [
      row.id,
      cloneRatingsRecord(row.ratings),
    ])
  );
  return players.reduce<Record<number, Record<string, number>>>((acc, player) => {
    const playerId = player.YouthPlayerID;
    acc[playerId] =
      responseRatingsById.get(playerId) ?? cloneRatingsRecord(ratingsCache[playerId]);
    return acc;
  }, {});
};

const normalizeInjuryLevel = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isUnavailableForYouthOptimization = (injuryLevel: number | null) =>
  injuryLevel !== null && injuryLevel >= 1;

const buildYouthUpdatesHistoryEntry = (
  markers: MatrixNewMarkers,
  players: YouthPlayer[],
  comparedAt: number,
  source: "refresh" | "debug" = "refresh",
  context?: YouthUpdatesBuildContext
): YouthUpdatesGroupedEntry => {
  const playersById = new Map(
    players.map((player) => [player.YouthPlayerID, formatPlayerName(player)])
  );
  const groupedByPlayerId: YouthUpdatesGroupedEntry["groupedByPlayerId"] = {};
  const ensurePlayer = (playerId: number) => {
    const existing = groupedByPlayerId[playerId];
    if (existing) return existing;
    const next = {
      playerId,
      playerName: playersById.get(playerId) ?? String(playerId),
      isNewPlayer: false,
      ratings: [] as Array<{
        position: number;
        previous: number | null;
        current: number | null;
      }>,
      skillsCurrent: [] as Array<{
        skillKey: string;
        previous: number | null;
        current: number | null;
      }>,
      skillsMax: [] as Array<{
        skillKey: string;
        previous: number | null;
        current: number | null;
      }>,
      attributes: [] as YouthAttributeChange[],
    };
    groupedByPlayerId[playerId] = next;
    return next;
  };
  markers.playerIds.forEach((playerId) => {
    ensurePlayer(playerId).isNewPlayer = true;
  });
  Object.entries(markers.ratingsByPlayerId).forEach(([playerId, positions]) => {
    const numericPlayerId = Number(playerId);
    if (!Number.isFinite(numericPlayerId)) return;
    const previousRatings = context?.previousRatingsByPlayerId?.[numericPlayerId] ?? {};
    const currentRatings = context?.currentRatingsByPlayerId?.[numericPlayerId] ?? {};
    ensurePlayer(numericPlayerId).ratings = positions.map((position) => {
      const previousRaw = previousRatings[String(position)];
      const currentRaw = currentRatings[String(position)];
      return {
        position,
        previous: typeof previousRaw === "number" ? previousRaw : null,
        current: typeof currentRaw === "number" ? currentRaw : null,
      };
    });
  });
  Object.entries(markers.skillsCurrentByPlayerId).forEach(([playerId, skills]) => {
    const numericPlayerId = Number(playerId);
    if (!Number.isFinite(numericPlayerId)) return;
    const previousSkills = context?.previousSkillsByPlayerId?.get(numericPlayerId) ?? null;
    const currentSkills = context?.currentSkillsByPlayerId?.get(numericPlayerId) ?? null;
    ensurePlayer(numericPlayerId).skillsCurrent = skills.map((skillKey) => ({
      skillKey,
      previous: getKnownSkillValue(previousSkills?.[skillKey] ?? null),
      current: getKnownSkillValue(currentSkills?.[skillKey] ?? null),
    }));
  });
  Object.entries(markers.skillsMaxByPlayerId).forEach(([playerId, skills]) => {
    const numericPlayerId = Number(playerId);
    if (!Number.isFinite(numericPlayerId)) return;
    const previousSkills = context?.previousSkillsByPlayerId?.get(numericPlayerId) ?? null;
    const currentSkills = context?.currentSkillsByPlayerId?.get(numericPlayerId) ?? null;
    ensurePlayer(numericPlayerId).skillsMax = skills.map((skillKey) => ({
      skillKey,
      previous: getKnownSkillValue(previousSkills?.[`${skillKey}Max`] ?? null),
      current: getKnownSkillValue(currentSkills?.[`${skillKey}Max`] ?? null),
    }));
  });
  Object.entries(context?.attributeChangesByPlayerId ?? {}).forEach(
    ([playerId, changes]) => {
      const numericPlayerId = Number(playerId);
      if (!Number.isFinite(numericPlayerId) || !Array.isArray(changes)) return;
      ensurePlayer(numericPlayerId).attributes = changes;
    }
  );
  const hasChanges =
    hasAnyMatrixNewMarkers(markers) ||
    Object.values(groupedByPlayerId).some(
      (entry) => entry.attributes && entry.attributes.length > 0
    );
  return {
    id: `${comparedAt}-${Math.random().toString(36).slice(2, 8)}`,
    comparedAt,
    source,
    hasChanges,
    groupedByPlayerId,
  };
};

function resolveDetails(data: Record<string, unknown> | null) {
  if (!data) return null;
  const hattrickData = data.HattrickData as Record<string, unknown> | undefined;
  if (!hattrickData) return null;
  return (hattrickData.YouthPlayer as YouthPlayerDetails) ?? null;
}

export default function Dashboard({
  players,
  matchesResponse,
  ratingsResponse,
  initialYouthTeams = [],
  initialYouthTeamId = null,
  messages,
  isConnected,
  initialLoadError = null,
  initialLoadDetails = null,
  initialAuthError = false,
}: DashboardProps) {
  const [playerList, setPlayerList] = useState<YouthPlayer[]>(players);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playerRefreshStatus, setPlayerRefreshStatus] = useState<string | null>(
    null
  );
  const [playerRefreshProgressPct, setPlayerRefreshProgressPct] = useState(0);
  const [hiddenSpecialtyByPlayerId, setHiddenSpecialtyByPlayerId] = useState<
    Record<number, number>
  >({});
  const [
    hiddenSpecialtyDiscoveredMatchByPlayerId,
    setHiddenSpecialtyDiscoveredMatchByPlayerId,
  ] = useState<Record<number, number>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mobileYouthActive, setMobileYouthActive] = useState(false);
  const [mobileYouthView, setMobileYouthView] =
    useState<YouthMobileView>("playerDetails");
  const [mobileYouthPlayerScreen, setMobileYouthPlayerScreen] =
    useState<MobileYouthPlayerScreen>("root");
  const [mobileYouthMenuPosition, setMobileYouthMenuPosition] = useState({
    x: 16,
    y: 108,
  });
  const [mobileYouthLandscapeActive, setMobileYouthLandscapeActive] =
    useState(false);
  const [mobileYouthLineupPickerSlotId, setMobileYouthLineupPickerSlotId] =
    useState<string | null>(null);
  const [mobileYouthRefreshFeedbackVisible, setMobileYouthRefreshFeedbackVisible] =
    useState(false);
  const [activeDetailsTab, setActiveDetailsTab] =
    useState<PlayerDetailsPanelTab>("details");
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [cache, setCache] = useState<Record<number, CachedDetails>>({});
  const [unlockStatus, setUnlockStatus] = useState<"success" | "denied" | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(initialAuthError);
  const [authErrorDetails, setAuthErrorDetails] = useState<string | null>(null);
  const [authErrorDebugDetails, setAuthErrorDebugDetails] = useState<string | null>(
    null
  );
  const [scopeReconnectModalOpen, setScopeReconnectModalOpen] = useState(false);
  const [transferSearchModalOpen, setTransferSearchModalOpen] = useState(false);
  const [transferSearchSourcePlayerId, setTransferSearchSourcePlayerId] =
    useState<number | null>(null);
  const [transferSearchFilters, setTransferSearchFilters] =
    useState<TransferSearchFilters | null>(null);
  const [transferSearchResults, setTransferSearchResults] = useState<
    TransferSearchResult[]
  >([]);
  const [transferSearchItemCount, setTransferSearchItemCount] =
    useState<number | null>(null);
  const [transferSearchLoading, setTransferSearchLoading] = useState(false);
  const [transferSearchError, setTransferSearchError] = useState<string | null>(null);
  const [transferSearchExactEmpty, setTransferSearchExactEmpty] = useState(false);
  const [transferSearchDetailsById, setTransferSearchDetailsById] = useState<
    Record<number, YouthPlayerDetails>
  >({});
  const [transferSearchBidDrafts, setTransferSearchBidDrafts] = useState<
    Record<number, TransferSearchBidDraft>
  >({});
  const [transferSearchBidPendingPlayerId, setTransferSearchBidPendingPlayerId] =
    useState<number | null>(null);
  const [supporterStatus, setSupporterStatus] =
    useState<SupporterStatus>("unknown");
  const transferSearchRequestIdRef = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [loadErrorDetails, setLoadErrorDetails] = useState<string | null>(
    initialLoadDetails
  );
  const [serviceErrorModal, setServiceErrorModal] = useState<{
    title: string;
    details: string | null;
    statusCode: number | null;
  } | null>(null);

  const [assignments, setAssignments] = useState<LineupAssignments>({});
  const [behaviors, setBehaviors] = useState<LineupBehaviors>({});
  const [matchesState, setMatchesState] =
    useState<MatchesResponse>(matchesResponse);
  const [ratingsResponseState, setRatingsResponseState] =
    useState<RatingsMatrixResponse | null>(ratingsResponse);
  const [youthTeams, setYouthTeams] =
    useState<YouthTeamOption[]>(initialYouthTeams);
  const [selectedYouthTeamId, setSelectedYouthTeamId] = useState<number | null>(
    initialYouthTeamId
  );
  const [devManagerUserId, setDevManagerUserId] = useState("");
  const [debugOauthErrorMode, setDebugOauthErrorMode] =
    useState<ChppDebugOauthErrorMode>("off");
  const [loadedMatchId, setLoadedMatchId] = useState<number | null>(null);
  const [starPlayerId, setStarPlayerId] = useState<number | null>(null);
  const [revealSecondaryTargetPlayerId, setRevealSecondaryTargetPlayerId] =
    useState<number | null>(null);
  const [revealSecondaryTargetMenuOpen, setRevealSecondaryTargetMenuOpen] =
    useState(false);
  const [primaryTraining, setPrimaryTraining] = useState<TrainingSkillKey>(
    DEFAULT_PRIMARY_TRAINING
  );
  const [secondaryTraining, setSecondaryTraining] = useState<TrainingSkillKey>(
    DEFAULT_SECONDARY_TRAINING
  );
  const [optimizerDebug, setOptimizerDebug] = useState<OptimizerDebug | null>(
    null
  );
  const [showOptimizerDebug, setShowOptimizerDebug] = useState(false);
  const [primaryTrainingMenuOpen, setPrimaryTrainingMenuOpen] = useState(false);
  const [secondaryTrainingMenuOpen, setSecondaryTrainingMenuOpen] = useState(false);
  const primaryTrainingButtonRef = useRef<HTMLButtonElement | null>(null);
  const primaryTrainingMenuRef = useRef<HTMLDivElement | null>(null);
  const secondaryTrainingButtonRef = useRef<HTMLButtonElement | null>(null);
  const secondaryTrainingMenuRef = useRef<HTMLDivElement | null>(null);
  const revealSecondaryTargetButtonRef = useRef<HTMLButtonElement | null>(null);
  const revealSecondaryTargetMenuRef = useRef<HTMLDivElement | null>(null);
  const [optimizerDragOffset, setOptimizerDragOffset] = useState({
    x: 0,
    y: 0,
  });
  const [optimizerDragging, setOptimizerDragging] = useState(false);
  const optimizerDragStart = useRef<{
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const optimizerModalRef = useRef<HTMLDivElement | null>(null);
  const [autoSelectionApplied, setAutoSelectionApplied] = useState(false);
  const [highlightMissingStarControls, setHighlightMissingStarControls] =
    useState(false);
  const [showTrainingReminder, setShowTrainingReminder] = useState(false);
  const [optimizeErrorMessage, setOptimizeErrorMessage] = useState<string | null>(
    null
  );
  const { addNotification } = useNotifications();
  const isDev = process.env.NODE_ENV !== "production";
  const helpStorageKey = "ya_help_dismissed_v1";
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingAutoHelpOpen, setPendingAutoHelpOpen] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogPage, setChangelogPage] = useState(0);
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
  const [helpCardTopOffset, setHelpCardTopOffset] = useState(0);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const youthAutoHelpReady =
    !mobileYouthActive && !playersLoading && !playerRefreshStatus;
  const [ratingsCache, setRatingsCache] = useState<
    Record<number, Record<string, number>>
  >({});
  const [ratingsPositions, setRatingsPositions] = useState<number[]>([]);
  const [analyzedRatingsMatchIds, setAnalyzedRatingsMatchIds] = useState<
    number[]
  >([]);
  const [matrixNewMarkers, setMatrixNewMarkers] = useState<MatrixNewMarkers>(
    buildEmptyMatrixNewMarkers
  );
  const [youthUpdatesHistory, setYouthUpdatesHistory] = useState<
    YouthUpdatesGroupedEntry[]
  >([]);
  const [selectedYouthUpdatesId, setSelectedYouthUpdatesId] = useState<
    string | null
  >(null);
  const [youthUpdatesOpen, setYouthUpdatesOpen] = useState(false);
  const [debugMatrixNewMarkersActive, setDebugMatrixNewMarkersActive] =
    useState(false);
  const [debugMatrixNewMarkers, setDebugMatrixNewMarkers] =
    useState<MatrixNewMarkers>(buildEmptyMatrixNewMarkers);
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<number[] | null>(
    null
  );
  const [orderSource, setOrderSource] = useState<
    "list" | "ratings" | "skills" | null
  >(null);
  const [allowTrainingUntilMaxedOut, setAllowTrainingUntilMaxedOut] =
    useState(true);
  const [stalenessDays, setStalenessDays] = useState(
    DEFAULT_YOUTH_STALENESS_DAYS
  );
  const [lastGlobalRefreshAt, setLastGlobalRefreshAt] = useState<number | null>(
    null
  );
  const previousPlayersLoadingRef = useRef(playersLoading);
  const previousLastGlobalRefreshAtRef = useRef(lastGlobalRefreshAt);
  const [tacticType, setTacticType] = useState(7);
  const [restoredStorageKey, setRestoredStorageKey] = useState<string | null>(
    null
  );
  const staleRefreshAttemptedRef = useRef(false);
  const lastAuthNotificationAtRef = useRef(0);
  const persistedMarkersBaselineRef = useRef<PersistedYouthMarkersBaseline | null>(
    null
  );
  const suppressNextUpdatesRecordingRef = useRef(false);
  const refreshRunSeqRef = useRef(0);
  const activeRefreshRunIdRef = useRef<number | null>(null);
  const stoppedRefreshRunIdsRef = useRef<Set<number>>(new Set());
  const setYouthRefreshStatus = (status: string, progressPct?: number) => {
    setPlayerRefreshStatus(status);
    if (typeof progressPct === "number") {
      setPlayerRefreshProgressPct(Math.max(0, Math.min(100, progressPct)));
    }
  };
  useEffect(() => {
    if (
      !primaryTrainingMenuOpen &&
      !secondaryTrainingMenuOpen &&
      !revealSecondaryTargetMenuOpen
    ) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (primaryTrainingMenuOpen) {
        if (primaryTrainingButtonRef.current?.contains(target ?? null)) return;
        if (primaryTrainingMenuRef.current?.contains(target ?? null)) return;
      }
      if (secondaryTrainingMenuOpen) {
        if (secondaryTrainingButtonRef.current?.contains(target ?? null)) return;
        if (secondaryTrainingMenuRef.current?.contains(target ?? null)) return;
      }
      if (revealSecondaryTargetMenuOpen) {
        if (revealSecondaryTargetButtonRef.current?.contains(target ?? null)) return;
        if (revealSecondaryTargetMenuRef.current?.contains(target ?? null)) return;
      }
      if (primaryTrainingMenuOpen) setPrimaryTrainingMenuOpen(false);
      if (secondaryTrainingMenuOpen) setSecondaryTrainingMenuOpen(false);
      if (revealSecondaryTargetMenuOpen) setRevealSecondaryTargetMenuOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [
    primaryTrainingMenuOpen,
    revealSecondaryTargetMenuOpen,
    secondaryTrainingMenuOpen,
  ]);
  const youthUpdatesHistoryWithChanges = useMemo(
    () => youthUpdatesHistory.filter(shouldKeepYouthUpdatesHistoryEntry),
    [youthUpdatesHistory]
  );
  const applyRandomDebugNewMarkers = (mode: "toggle" | "on" | "off" = "toggle") => {
    const removeDebugUpdatesHistoryEntries = () => {
      setYouthUpdatesHistory((prev) =>
        prev.filter(
          (entry) =>
            shouldKeepYouthUpdatesHistoryEntry(entry) && entry.source !== "debug"
        )
      );
      setSelectedYouthUpdatesId((prevSelectedId) => {
        if (!prevSelectedId) return prevSelectedId;
        const selectedEntry = youthUpdatesHistory.find(
          (entry) => entry.id === prevSelectedId
        );
        if (!selectedEntry || selectedEntry.source !== "debug") {
          return prevSelectedId;
        }
        const fallback = youthUpdatesHistory.find(
          (entry) => entry.source !== "debug"
        );
        return fallback?.id ?? null;
      });
    };
    const clearDebugMarkers = () => {
      setDebugMatrixNewMarkers(buildEmptyMatrixNewMarkers());
      setDebugMatrixNewMarkersActive(false);
      removeDebugUpdatesHistoryEntries();
    };
    if (mode === "off") {
      clearDebugMarkers();
      return;
    }
    if (mode === "toggle" && debugMatrixNewMarkersActive) {
      clearDebugMarkers();
      return;
    }
    if (!playerList.length) return;
    const pickRandom = <T,>(items: T[]): T | null => {
      if (!items.length) return null;
      const index = Math.floor(Math.random() * items.length);
      return items[index] ?? null;
    };

    const ratingPositions = (
      ratingsMatrixData?.response.positions.length
        ? ratingsMatrixData.response.positions
        : POSITION_COLUMNS
    ).map((position) => Number(position));
    const playerIds = playerList.map((player) => player.YouthPlayerID);
    const currentSkillCandidates: Array<{ playerId: number; skillKey: string }> = [];
    const maxSkillCandidates: Array<{ playerId: number; skillKey: string }> = [];
    const ratingCandidates: Array<{ playerId: number; position: number }> = [];

    playerList.forEach((player) => {
      const playerId = player.YouthPlayerID;
      const merged = mergedSkills(
        playerDetailsById.get(playerId)?.PlayerSkills,
        player.PlayerSkills
      );
      TRAINING_SKILLS.map(
        (trainingSkill) => TRAINING_SKILL_VALUE_KEYS[trainingSkill]
      ).forEach((keys) => {
        if (getKnownSkillValue(merged?.[keys.current]) !== null) {
          currentSkillCandidates.push({ playerId, skillKey: keys.current });
        }
        if (getKnownSkillValue(merged?.[keys.max]) !== null) {
          maxSkillCandidates.push({ playerId, skillKey: keys.current });
        }
      });
      const ratingsForPlayer = ratingsCache[playerId] ?? {};
      ratingPositions.forEach((position) => {
        if (typeof ratingsForPlayer[String(position)] === "number") {
          ratingCandidates.push({ playerId, position });
        }
      });
    });

    const selectedNewPlayerId = pickRandom(playerIds);
    const selectedCurrentSkill = pickRandom(currentSkillCandidates);
    const selectedMaxSkill = pickRandom(maxSkillCandidates);
    const selectedRating = pickRandom(ratingCandidates);
    if (
      selectedNewPlayerId === null ||
      !selectedCurrentSkill ||
      !selectedMaxSkill ||
      !selectedRating
    ) {
      clearDebugMarkers();
      return;
    }
    const nextMarkers: MatrixNewMarkers = {
      detectedAt: Date.now(),
      playerIds: [selectedNewPlayerId],
      ratingsByPlayerId: {},
      skillsCurrentByPlayerId: {},
      skillsMaxByPlayerId: {},
    };
    nextMarkers.skillsCurrentByPlayerId[selectedCurrentSkill.playerId] = [
      selectedCurrentSkill.skillKey,
    ];
    nextMarkers.skillsMaxByPlayerId[selectedMaxSkill.playerId] = [
      selectedMaxSkill.skillKey,
    ];
    nextMarkers.ratingsByPlayerId[selectedRating.playerId] = [
      selectedRating.position,
    ];
    const currentSkillsByPlayerId = new Map<
      number,
      Record<string, SkillValue | number | string> | null
    >();
    playerList.forEach((player) => {
      const playerId = player.YouthPlayerID;
      const merged = mergedSkills(
        playerDetailsById.get(playerId)?.PlayerSkills,
        player.PlayerSkills
      );
      currentSkillsByPlayerId.set(playerId, merged);
    });
    setDebugMatrixNewMarkers(nextMarkers);
    setDebugMatrixNewMarkersActive(true);
    const debugEntry = buildYouthUpdatesHistoryEntry(
      nextMarkers,
      playerList,
      Date.now(),
      "debug",
      {
        previousRatingsByPlayerId: {},
        currentRatingsByPlayerId: ratingsCache,
        previousSkillsByPlayerId: new Map(),
        currentSkillsByPlayerId,
      }
    );
    setYouthUpdatesHistory((prev) =>
      [
        debugEntry,
        ...prev.filter(
          (entry) =>
            shouldKeepYouthUpdatesHistoryEntry(entry) && entry.source !== "debug"
        ),
      ].slice(0, YOUTH_UPDATES_HISTORY_LIMIT)
    );
    setSelectedYouthUpdatesId(debugEntry.id);
    addNotification(messages.notificationDebugNewMarkers);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(YOUTH_REFRESH_STATE_EVENT, {
        detail: {
          refreshing: playersLoading,
          status: playerRefreshStatus,
          progressPct: playerRefreshProgressPct,
          lastRefreshAt: lastGlobalRefreshAt,
        },
      })
    );
  }, [
    playersLoading,
    playerRefreshProgressPct,
    playerRefreshStatus,
    lastGlobalRefreshAt,
  ]);

  useEffect(() => {
    if (!mobileYouthActive) {
      previousPlayersLoadingRef.current = playersLoading;
      previousLastGlobalRefreshAtRef.current = lastGlobalRefreshAt;
      setMobileYouthRefreshFeedbackVisible(false);
      return;
    }

    let timeoutId: number | null = null;
    const refreshJustCompleted =
      previousPlayersLoadingRef.current &&
      !playersLoading &&
      lastGlobalRefreshAt !== null &&
      lastGlobalRefreshAt !== previousLastGlobalRefreshAtRef.current;

    if (playersLoading || playerRefreshStatus) {
      setMobileYouthRefreshFeedbackVisible(true);
    } else if (refreshJustCompleted) {
      setMobileYouthRefreshFeedbackVisible(true);
      timeoutId = window.setTimeout(() => {
        setMobileYouthRefreshFeedbackVisible(false);
      }, 5000);
    }

    previousPlayersLoadingRef.current = playersLoading;
    previousLastGlobalRefreshAtRef.current = lastGlobalRefreshAt;

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    lastGlobalRefreshAt,
    mobileYouthActive,
    playerRefreshStatus,
    playersLoading,
  ]);

  const playersById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    playerList.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [playerList]);

  const multiTeamEnabled = youthTeams.length > 1;
  const activeYouthTeamId = multiTeamEnabled ? selectedYouthTeamId : null;
  const activeYouthTeamOption = useMemo(() => {
    if (youthTeams.length === 0) return null;
    if (!multiTeamEnabled) return youthTeams[0];
    if (!selectedYouthTeamId) return youthTeams[0];
    return (
      youthTeams.find((team) => team.youthTeamId === selectedYouthTeamId) ??
      youthTeams[0]
    );
  }, [multiTeamEnabled, selectedYouthTeamId, youthTeams]);
  const resolvedYouthTeamId = useMemo(
    () => activeYouthTeamId ?? activeYouthTeamOption?.youthTeamId ?? null,
    [activeYouthTeamId, activeYouthTeamOption]
  );
  const resolvedSeniorTeamId = activeYouthTeamOption?.teamId ?? null;
  const ratingsMatrixMatchHrefBuilder = useMemo(() => {
    const teamId = activeYouthTeamOption?.teamId;
    const youthTeamId = activeYouthTeamOption?.youthTeamId;
    if (!teamId || !youthTeamId) return undefined;
    return (matchId: number) => hattrickYouthMatchUrl(matchId, teamId, youthTeamId);
  }, [activeYouthTeamOption?.teamId, activeYouthTeamOption?.youthTeamId]);
  useEffect(() => {
    if (!isConnected || !resolvedSeniorTeamId) {
      setSupporterStatus("unknown");
      return;
    }
    let cancelled = false;
    setSupporterStatus("unknown");
    const fetchSupporterStatus = async () => {
      try {
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              UserSupporterTier?: unknown;
            };
          };
          error?: string;
        }>(
          `/api/chpp/training?actionType=view&teamId=${resolvedSeniorTeamId}`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (!response.ok || payload?.error) {
          setSupporterStatus("unknown");
          return;
        }
        setSupporterStatus(
          isSupporterTierValue(payload?.data?.HattrickData?.UserSupporterTier)
            ? "supporter"
            : "nonSupporter"
        );
      } catch (error) {
        if (!cancelled && !(error instanceof ChppAuthRequiredError)) {
          setSupporterStatus("unknown");
        }
      }
    };
    void fetchSupporterStatus();
    return () => {
      cancelled = true;
    };
  }, [isConnected, resolvedSeniorTeamId]);
  const hiddenSpecialtyMatchHrefByPlayerId = useMemo(() => {
    if (!ratingsMatrixMatchHrefBuilder) return {} as Record<number, string>;
    return Object.fromEntries(
      Object.entries(hiddenSpecialtyDiscoveredMatchByPlayerId)
        .map(([playerId, matchId]) => [Number(playerId), Number(matchId)])
        .filter(
          ([playerId, matchId]) =>
            Number.isFinite(playerId) && Number.isFinite(matchId) && matchId > 0
        )
        .map(([playerId, matchId]) => [playerId, ratingsMatrixMatchHrefBuilder(matchId)])
    ) as Record<number, string>;
  }, [hiddenSpecialtyDiscoveredMatchByPlayerId, ratingsMatrixMatchHrefBuilder]);
  const ratingsMatrixHiddenSpecialtyMatchHrefByName = useMemo(() => {
    return Object.fromEntries(
      playerList.map((player) => {
        const hiddenSpecialty =
          Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0 &&
          Number(player.Specialty ?? 0) <= 0;
        const discoveredMatchId = Number(
          hiddenSpecialtyDiscoveredMatchByPlayerId[player.YouthPlayerID] ?? 0
        );
        const href =
          hiddenSpecialty && discoveredMatchId > 0 && ratingsMatrixMatchHrefBuilder
            ? ratingsMatrixMatchHrefBuilder(discoveredMatchId)
            : undefined;
        return [
          [player.FirstName, player.NickName || null, player.LastName]
            .filter(Boolean)
            .join(" "),
          href,
        ] as const;
      })
    );
  }, [
    hiddenSpecialtyByPlayerId,
    hiddenSpecialtyDiscoveredMatchByPlayerId,
    playerList,
    ratingsMatrixMatchHrefBuilder,
  ]);
  const storageKey = useMemo(() => {
    if (multiTeamEnabled && activeYouthTeamId) {
      return `ya_dashboard_state_v2_${activeYouthTeamId}`;
    }
    return "ya_dashboard_state_v2";
  }, [activeYouthTeamId, multiTeamEnabled]);


  const playerDetailsById = useMemo(() => {
    const map = new Map<number, YouthPlayerDetails>();
    Object.entries(cache).forEach(([id, entry]) => {
      const resolved = resolveDetails(entry.data);
      if (resolved) {
        map.set(Number(id), resolved);
      }
    });
    return map;
  }, [cache]);

  const scoutImportantSkillsByPlayerId = useMemo(() => {
    const payload: Record<number, string[]> = {};
    playerDetailsById.forEach((details, playerId) => {
      const rawComments = details.ScoutCall?.ScoutComments?.ScoutComment;
      const comments = Array.isArray(rawComments)
        ? rawComments
        : rawComments
        ? [rawComments]
        : [];
      const importantSkills = new Set<string>();
      comments.forEach((comment) => {
        const commentType = Number(comment?.CommentType);
        const commentSkillType = Number(comment?.CommentSkillType);
        if (commentType !== 4 && commentType !== 5) return;
        const skillKey = SCOUT_COMMENT_SKILL_KEY_BY_TYPE[commentSkillType];
        if (!skillKey) return;
        importantSkills.add(skillKey);
      });
      if (importantSkills.size > 0) {
        payload[playerId] = Array.from(importantSkills.values());
      }
    });
    return payload;
  }, [playerDetailsById]);

  const scoutOverallSkillLevelByPlayerId = useMemo(() => {
    const payload: Record<number, number> = {};
    playerDetailsById.forEach((details, playerId) => {
      const rawComments = details.ScoutCall?.ScoutComments?.ScoutComment;
      const comments = Array.isArray(rawComments)
        ? rawComments
        : rawComments
        ? [rawComments]
        : [];
      const overallComment = comments.find(
        (comment) => Number(comment?.CommentType) === 6
      );
      const overallValue = Number(overallComment?.CommentSkillType);
      if (!Number.isFinite(overallValue)) return;
      payload[playerId] = overallValue;
    });
    return payload;
  }, [playerDetailsById]);

  const changelogEntries = useMemo(() => getChangelogEntries(messages), [messages]);

  const changelogRows = useMemo(
    () =>
      changelogEntries.flatMap((entry) =>
        entry.entries.map((item) => ({
          version: entry.version,
          text: item,
        }))
      ),
    [changelogEntries]
  );

  const changelogPageSize = 10;
  const changelogTotalPages = Math.max(
    1,
    Math.ceil(changelogRows.length / changelogPageSize)
  );
  const changelogPageIndex = Math.min(changelogPage, changelogTotalPages - 1);
  const changelogPageStart = changelogPageIndex * changelogPageSize;
  const changelogPageRows = changelogRows.slice(
    changelogPageStart,
    changelogPageStart + changelogPageSize
  );

  const trainingPreferences = useMemo(
    () => ({ allowTrainingUntilMaxedOut }),
    [allowTrainingUntilMaxedOut]
  );

  useEffect(() => {
    if (!showChangelog) return;
    setChangelogPage(0);
  }, [showChangelog]);

  const getPlayerAgeScore = (player: YouthPlayer | null | undefined) => {
    if (!player) return null;
    const detailsAge = playerDetailsById.get(player.YouthPlayerID);
    const age =
      player.Age ??
      (detailsAge && "Age" in detailsAge ? (detailsAge.Age as number) : null);
    const ageDays =
      player.AgeDays ??
      (detailsAge && "AgeDays" in detailsAge
        ? (detailsAge.AgeDays as number)
        : null);
    if (age === null || age === undefined) return null;
    return age * 1000 + (ageDays ?? 0);
  };

  const assignedIds = useMemo(
    () =>
      new Set(
        Object.entries(assignments)
          .filter(([slotId]) => VALID_LINEUP_SLOT_IDS.has(slotId))
          .map(([, playerId]) => playerId)
          .filter(Boolean) as number[]
      ),
    [assignments]
  );

  const captainId = useMemo(() => {
    const fieldSlots = [
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
    let bestId: number | null = null;
    let bestScore = -1;
    fieldSlots.forEach((slot) => {
      const playerId = assignments[slot];
      if (!playerId) return;
      const player = playersById.get(playerId) ?? null;
      const score = getPlayerAgeScore(player);
      if (score === null) return;
      if (score > bestScore) {
        bestScore = score;
        bestId = playerId;
      }
    });
    return bestId;
  }, [assignments, playersById, playerDetailsById]);

  const selectedPlayer = useMemo(
    () =>
      playerList.find((player) => player.YouthPlayerID === selectedId) ?? null,
    [playerList, selectedId]
  );

  const transferSearchSourcePlayer = useMemo(
    () =>
      transferSearchSourcePlayerId
        ? playerList.find(
            (player) => player.YouthPlayerID === transferSearchSourcePlayerId
          ) ?? null
        : null,
    [playerList, transferSearchSourcePlayerId]
  );

  const selectedTransferSearchPlayerName =
    transferSearchSourcePlayer
      ? formatPlayerName(transferSearchSourcePlayer)
      : selectedPlayer
        ? formatPlayerName(selectedPlayer)
        : null;

  const formatEurFromSek = (valueSek: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(valueSek / CHPP_SEK_PER_EUR);

  const transferSearchBarGradient = (
    value: number | null,
    minSkillLevel: number,
    maxSkillLevel: number
  ) => {
    if (value === null || value === undefined) return undefined;
    if (maxSkillLevel <= minSkillLevel) return undefined;
    const t = Math.min(
      1,
      Math.max((value - minSkillLevel) / (maxSkillLevel - minSkillLevel), 0)
    );
    if (t >= 1) return "linear-gradient(90deg, #2f9f5b, #1f6f3f)";
    if (t <= 0) return "linear-gradient(90deg, #cf3f3a, #8b241f)";
    const startHue = 6 + (136 - 6) * t;
    const startSat = 72 - 8 * t;
    const startLight = 49 - 9 * t;
    const endHue = 2 + (145 - 2) * t;
    const endSat = 66 - 10 * t;
    const endLight = 33 - 5 * t;
    return `linear-gradient(90deg, hsl(${Math.round(startHue)} ${Math.round(startSat)}% ${Math.round(startLight)}%), hsl(${Math.round(endHue)} ${Math.round(endSat)}% ${Math.round(endLight)}%))`;
  };

  const youthPromotionAgeTotalDays = (
    player: YouthPlayer | null,
    details: YouthPlayerDetails | null
  ) => {
    const years = details?.Age ?? player?.Age ?? null;
    const days = details?.AgeDays ?? player?.AgeDays ?? null;
    const canBePromotedIn = details?.CanBePromotedIn ?? player?.CanBePromotedIn ?? null;
    if (years === null || days === null || canBePromotedIn === null) return null;
    return ageToTotalDays(years, days) + Math.max(0, canBePromotedIn);
  };

  const buildYouthEstimateValueSkillFilters = (
    player: YouthPlayer,
    details: YouthPlayerDetails | null
  ): TransferSearchSkillFilter[] => {
    const skills = mergedSkills(details?.PlayerSkills, player.PlayerSkills);
    if (!skills) return [];
    const skillDefinitions: Array<{
      skillKey: TransferSearchSkillKey;
      maxKey: string;
      skillType: number;
    }> = [
      { skillKey: "KeeperSkill", maxKey: "KeeperSkillMax", skillType: 1 },
      { skillKey: "DefenderSkill", maxKey: "DefenderSkillMax", skillType: 4 },
      { skillKey: "PlaymakerSkill", maxKey: "PlaymakerSkillMax", skillType: 8 },
      { skillKey: "WingerSkill", maxKey: "WingerSkillMax", skillType: 6 },
      { skillKey: "PassingSkill", maxKey: "PassingSkillMax", skillType: 7 },
      { skillKey: "ScorerSkill", maxKey: "ScorerSkillMax", skillType: 5 },
      { skillKey: "SetPiecesSkill", maxKey: "SetPiecesSkillMax", skillType: 3 },
    ];
    return skillDefinitions
      .map((definition) => {
        const value = getKnownSkillValue(skills[definition.maxKey]);
        if (value === null) return null;
        const clamped = clampTransferSkillValue(definition.skillKey, value);
        return {
          skillKey: definition.skillKey,
          min: clamped,
          max: clamped,
          skillType: definition.skillType,
        };
      })
      .filter(
        (
          entry
        ): entry is TransferSearchSkillFilter & { skillType: number } => entry !== null
      )
      .sort((left, right) => right.max - left.max || left.skillType - right.skillType)
      .slice(0, 4)
      .map(({ skillKey, min, max }) => ({ skillKey, min, max }))
      .sort(
        (left, right) =>
          TRANSFER_SEARCH_SKILLS.findIndex((entry) => entry.key === left.skillKey) -
          TRANSFER_SEARCH_SKILLS.findIndex((entry) => entry.key === right.skillKey)
      );
  };

  const buildYouthEstimateValueFilters = (
    player: YouthPlayer,
    details: YouthPlayerDetails | null,
    fallback: boolean
  ): TransferSearchFilters | null => {
    const skillFilters = buildYouthEstimateValueSkillFilters(player, details);
    if (skillFilters.length === 0) return null;
    const promotionAge = youthPromotionAgeTotalDays(player, details);
    if (promotionAge === null) return null;
    const ageWindow = fallback ? 50 : 20;
    const ageMin = totalDaysToAge(
      Math.max(TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS, promotionAge - ageWindow)
    );
    const ageMax = totalDaysToAge(
      Math.max(TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS, promotionAge + ageWindow)
    );
    const visibleSpecialty = Number(details?.Specialty ?? player.Specialty ?? 0);
    const discoveredSpecialty = Number(
      hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0
    );
    const specialty =
      !fallback && visibleSpecialty > 0
        ? visibleSpecialty
        : !fallback && discoveredSpecialty > 0
          ? discoveredSpecialty
          : null;
    return normalizeTransferSearchFilters({
      skillFilters,
      specialty,
      ageMinYears: ageMin.years,
      ageMinDays: ageMin.days,
      ageMaxYears: ageMax.years,
      ageMaxDays: ageMax.days,
      tsiMin: "",
      tsiMax: "",
      priceMinEur: "",
      priceMaxEur: "",
    });
  };

  const selectedYouthEstimateValueDetails = selectedPlayer
    ? playerDetailsById.get(selectedPlayer.YouthPlayerID) ?? null
    : null;
  const selectedYouthEstimateValueSkillCount =
    selectedPlayer
      ? buildYouthEstimateValueSkillFilters(
          selectedPlayer,
          selectedYouthEstimateValueDetails
        ).length
      : 0;
  const selectedYouthEstimateValueAgeReady =
    selectedPlayer
      ? youthPromotionAgeTotalDays(selectedPlayer, selectedYouthEstimateValueDetails) !== null
      : false;
  const selectedTransferSearchPlayerDetailPills = useMemo(() => {
    const sourcePlayer = transferSearchSourcePlayer ?? selectedPlayer;
    if (!sourcePlayer) return [];
    const sourceDetails = playerDetailsById.get(sourcePlayer.YouthPlayerID) ?? null;
    const promotionAgeTotalDays = youthPromotionAgeTotalDays(
      sourcePlayer,
      sourceDetails
    );
    if (promotionAgeTotalDays === null) return [];
    const promotionAge = totalDaysToAge(promotionAgeTotalDays);
    return [
      `${messages.ageAtPromotionLabel}: ${promotionAge.years}${messages.ageYearsShort} ${promotionAge.days}${messages.ageDaysShort}`,
    ];
  }, [
    messages,
    playerDetailsById,
    selectedPlayer,
    transferSearchSourcePlayer,
  ]);
  const youthEstimateValueDisabled =
    !selectedPlayer ||
    selectedYouthEstimateValueSkillCount === 0 ||
    !selectedYouthEstimateValueAgeReady;

  const pushMobileYouthState = useCallback(
    (
      view: YouthMobileView,
      screen: MobileYouthPlayerScreen,
      mode: "push" | "replace" = "push"
    ) => {
      setMobileYouthView(view);
      setMobileYouthPlayerScreen(screen);
      if (typeof window === "undefined" || !mobileYouthActive) return;
      const nextState: MobileYouthHistoryState = {
        appShell: "tool",
        tool: "youth",
        youthView: view,
        youthScreen: screen,
      };
      if (mode === "replace") {
        window.history.replaceState(nextState, "", window.location.href);
      } else {
        window.history.pushState(nextState, "", window.location.href);
      }
    },
    [mobileYouthActive]
  );

  const openMobileYouthHome = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(MOBILE_LAUNCHER_REQUEST_EVENT));
  }, []);

  const handleMobileYouthViewSelect = useCallback(
    (view: YouthMobileView) => {
      if (view === "playerDetails") {
        pushMobileYouthState("playerDetails", selectedPlayer ? "detail" : "list");
        return;
      }
      pushMobileYouthState(view, "root");
    },
    [pushMobileYouthState, selectedPlayer]
  );

  useEffect(() => {
    if (!mobileYouthActive) return;
    if (mobileYouthPlayerScreen !== "detail") return;
    if (selectedPlayer) return;
    pushMobileYouthState("playerDetails", "list", "replace");
  }, [
    mobileYouthActive,
    mobileYouthPlayerScreen,
    pushMobileYouthState,
    selectedPlayer,
  ]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileYouthActive) return;
    const segments =
      mobileYouthView === "playerDetails"
        ? mobileYouthPlayerScreen === "detail"
          ? [
              { id: "player-list", label: messages.youthPlayerList },
              { id: "player-details", label: messages.detailsTabLabel },
            ]
          : mobileYouthPlayerScreen === "list"
            ? [{ id: "player-list", label: messages.youthPlayerList }]
            : []
        : mobileYouthView === "skillsMatrix"
          ? [{ id: "skills-matrix", label: messages.skillsMatrixTabLabel }]
        : mobileYouthView === "ratingsMatrix"
            ? [{ id: "ratings-matrix", label: messages.ratingsMatrixTabLabel }]
            : mobileYouthView === "lineupOptimizer"
              ? [{ id: "lineup-optimizer", label: messages.lineupTitle }]
              : mobileYouthView === "help"
                ? [{ id: "help", label: messages.mobileHelpLabel }]
              : [];
    window.dispatchEvent(
      new CustomEvent(MOBILE_NAV_TRAIL_STATE_EVENT, {
        detail: {
          tool: "youth",
          segments,
        },
      })
    );
  }, [
    messages.detailsTabLabel,
    messages.lineupTitle,
    messages.mobileHelpLabel,
    messages.ratingsMatrixTabLabel,
    messages.skillsMatrixTabLabel,
    messages.youthPlayerList,
    mobileYouthActive,
    mobileYouthPlayerScreen,
    mobileYouthView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { tool?: string; target?: string } | undefined;
      if (!detail || detail.tool !== "youth") return;
      switch (detail.target) {
        case "tool-root":
          pushMobileYouthState("playerDetails", "root");
          return;
        case "player-list":
          pushMobileYouthState("playerDetails", "list");
          return;
        case "player-details":
          pushMobileYouthState(
            "playerDetails",
            selectedPlayer ? "detail" : "list"
          );
          return;
        case "help":
          pushMobileYouthState("help", "root");
          return;
        case "skills-matrix":
          pushMobileYouthState("skillsMatrix", "root");
          return;
        case "ratings-matrix":
          pushMobileYouthState("ratingsMatrix", "root");
          return;
        case "lineup-optimizer":
          pushMobileYouthState("lineupOptimizer", "root");
          return;
        default:
          return;
      }
    };
    window.addEventListener(MOBILE_NAV_TRAIL_JUMP_EVENT, handle);
    return () => window.removeEventListener(MOBILE_NAV_TRAIL_JUMP_EVENT, handle);
  }, [pushMobileYouthState, selectedPlayer]);

  const playerNavigationIds = useMemo(() => {
    if (orderedPlayerIds && orderedPlayerIds.length) {
      const validIds = new Set(playerList.map((player) => player.YouthPlayerID));
      return orderedPlayerIds.filter((id) => validIds.has(id));
    }
    return playerList.map((player) => player.YouthPlayerID);
  }, [orderedPlayerIds, playerList]);
  const selectedPlayerIndex = useMemo(() => {
    if (!selectedId) return -1;
    return playerNavigationIds.indexOf(selectedId);
  }, [playerNavigationIds, selectedId]);
  const previousPlayerId =
    selectedPlayerIndex > 0 ? playerNavigationIds[selectedPlayerIndex - 1] : null;
  const nextPlayerId =
    selectedPlayerIndex >= 0 && selectedPlayerIndex < playerNavigationIds.length - 1
      ? playerNavigationIds[selectedPlayerIndex + 1]
      : null;

  const ratingsMatrixData = useMemo(() => {
    if (playerList.length === 0) return null;
    const positions =
      ratingsResponseState?.positions ?? ratingsPositions ?? [];
    const ratingsByPlayerIdFromResponse = new Map<number, Record<string, number>>(
      (ratingsResponseState?.players ?? []).map((row) => [row.id, row.ratings ?? {}])
    );
    const ratingMatchIdsByPlayerId = new Map(
      (ratingsResponseState?.players ?? []).map((row) => [row.id, row.ratingMatchIds ?? {}])
    );
    const players = playerList.map((player) => ({
      id: player.YouthPlayerID,
      name: formatPlayerName(player),
      ratings:
        ratingsByPlayerIdFromResponse.get(player.YouthPlayerID) ??
        ratingsCache[player.YouthPlayerID] ??
        {},
      ratingMatchIds: ratingMatchIdsByPlayerId.get(player.YouthPlayerID) ?? {},
    }));
    if (
      !ratingsResponseState &&
      players.every((player) => !Object.keys(player.ratings).length)
    ) {
      return null;
    }
    return {
      response: {
        positions,
        players,
        matchesAnalyzed: ratingsResponseState?.matchesAnalyzed,
      },
    };
  }, [playerList, ratingsCache, ratingsPositions, ratingsResponseState]);

  const activeMatrixNewMarkers = useMemo(
    () => (debugMatrixNewMarkersActive ? debugMatrixNewMarkers : matrixNewMarkers),
    [debugMatrixNewMarkersActive, debugMatrixNewMarkers, matrixNewMarkers]
  );

  const newPlayerNameMarkerIds = useMemo(() => {
    const validIds = new Set(playerList.map((player) => player.YouthPlayerID));
    const source = debugMatrixNewMarkersActive
      ? debugMatrixNewMarkers
      : matrixNewMarkers;
    return source.playerIds.filter((id) => validIds.has(id));
  }, [
    debugMatrixNewMarkers,
    debugMatrixNewMarkersActive,
    matrixNewMarkers,
    playerList,
  ]);

  const listNewMarkerPlayerIds = useMemo(() => {
    return newPlayerNameMarkerIds;
  }, [newPlayerNameMarkerIds]);

  const skillsMatrixRows = useMemo(
    () =>
      playerList.map((player) => ({
        id: player.YouthPlayerID,
        name: formatPlayerName(player),
      })),
    [playerList]
  );

  const applyPlayerOrder = (
    ids: number[],
    source: "list" | "ratings" | "skills"
  ) => {
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

  const handleMatrixPlayerDragStart = (
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(MOBILE_YOUTH_MEDIA_QUERY);
    const apply = (matches: boolean) => setMobileYouthActive(matches);
    apply(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => apply(event.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const migratedThisRun = migrateYouthUpdatesStateIfNeeded();
      if (migratedThisRun) {
        setMatrixNewMarkers(buildEmptyMatrixNewMarkers());
        setYouthUpdatesHistory([]);
        setSelectedYouthUpdatesId(null);
        suppressNextUpdatesRecordingRef.current = true;
      }
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        suppressNextUpdatesRecordingRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as {
        updatesSchemaVersion?: number;
        assignments?: LineupAssignments;
        behaviors?: LineupBehaviors;
        selectedId?: number | null;
        starPlayerId?: number | null;
        primaryTraining?: string;
        secondaryTraining?: string;
        tacticType?: number;
        loadedMatchId?: number | null;
        cache?: Record<number, CachedDetails>;
        ratingsCache?: Record<number, Record<string, number>>;
        ratingsPositions?: number[];
        playerList?: YouthPlayer[];
        matchesState?: MatchesResponse;
        hiddenSpecialtyByPlayerId?: Record<number, number>;
        hiddenSpecialtyDiscoveredMatchByPlayerId?: Record<number, number>;
        analyzedRatingsMatchIds?: number[];
        matrixNewMarkers?: MatrixNewMarkers;
        youthUpdatesHistory?: YouthUpdatesGroupedEntry[];
        activeDetailsTab?: PlayerDetailsPanelTab;
        revealSecondaryTargetPlayerId?: number | null;
        mobileYouthView?: YouthMobileView;
        mobileYouthPlayerScreen?: MobileYouthPlayerScreen;
        mobileYouthMenuPosition?: { x?: number; y?: number } | null;
        transferSearchModalOpen?: boolean;
        transferSearchSourcePlayerId?: number | null;
        transferSearchFilters?: TransferSearchFilters | null;
        transferSearchResults?: TransferSearchResult[];
        transferSearchItemCount?: number | null;
        transferSearchExactEmpty?: boolean;
        transferSearchBidDrafts?: Record<number, TransferSearchBidDraft>;
        supporterStatus?: SupporterStatus;
      };
      const forceWipeLegacyUpdatesState =
        typeof parsed.updatesSchemaVersion !== "number" ||
        parsed.updatesSchemaVersion < YOUTH_UPDATES_SCHEMA_VERSION;
      if (forceWipeLegacyUpdatesState) {
        suppressNextUpdatesRecordingRef.current = true;
      }
      if (parsed.assignments) setAssignments(parsed.assignments);
      if (parsed.behaviors) setBehaviors(parsed.behaviors);
      if (parsed.selectedId !== undefined) setSelectedId(parsed.selectedId);
      if (
        parsed.mobileYouthView === "playerDetails" ||
        parsed.mobileYouthView === "skillsMatrix" ||
        parsed.mobileYouthView === "ratingsMatrix" ||
        parsed.mobileYouthView === "lineupOptimizer" ||
        parsed.mobileYouthView === "help"
      ) {
        setMobileYouthView(parsed.mobileYouthView);
      }
      if (
        parsed.mobileYouthPlayerScreen === "root" ||
        parsed.mobileYouthPlayerScreen === "list" ||
        parsed.mobileYouthPlayerScreen === "detail"
      ) {
        setMobileYouthPlayerScreen(parsed.mobileYouthPlayerScreen);
      }
      if (parsed.mobileYouthMenuPosition) {
        const nextX = Number(parsed.mobileYouthMenuPosition.x);
        const nextY = Number(parsed.mobileYouthMenuPosition.y);
        if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
          setMobileYouthMenuPosition({ x: nextX, y: nextY });
        }
      }
      if (
        parsed.activeDetailsTab === "details" ||
        parsed.activeDetailsTab === "skillsMatrix" ||
        parsed.activeDetailsTab === "ratingsMatrix"
      ) {
        setActiveDetailsTab(parsed.activeDetailsTab);
      }
      if (parsed.starPlayerId !== undefined) setStarPlayerId(parsed.starPlayerId);
      if (parsed.revealSecondaryTargetPlayerId !== undefined) {
        setRevealSecondaryTargetPlayerId(parsed.revealSecondaryTargetPlayerId);
      }
      if (parsed.primaryTraining !== undefined)
        setPrimaryTraining(
          isTrainingSkill(parsed.primaryTraining)
            ? parsed.primaryTraining
            : DEFAULT_PRIMARY_TRAINING
        );
      if (parsed.secondaryTraining !== undefined)
        setSecondaryTraining(
          isTrainingSkill(parsed.secondaryTraining)
            ? parsed.secondaryTraining
            : DEFAULT_SECONDARY_TRAINING
        );
      if (parsed.tacticType !== undefined && Number.isFinite(parsed.tacticType)) {
        setTacticType(parsed.tacticType);
      }
      if (parsed.loadedMatchId !== undefined)
        setLoadedMatchId(parsed.loadedMatchId);
      if (typeof parsed.transferSearchModalOpen === "boolean") {
        setTransferSearchModalOpen(parsed.transferSearchModalOpen);
      }
      setTransferSearchSourcePlayerId(
        typeof parsed.transferSearchSourcePlayerId === "number"
          ? parsed.transferSearchSourcePlayerId
          : null
      );
      setTransferSearchFilters(
        parsed.transferSearchFilters
          ? normalizeTransferSearchFilters(parsed.transferSearchFilters)
          : null
      );
      setTransferSearchResults(
        Array.isArray(parsed.transferSearchResults) ? parsed.transferSearchResults : []
      );
      setTransferSearchItemCount(
        typeof parsed.transferSearchItemCount === "number"
          ? parsed.transferSearchItemCount
          : null
      );
      setTransferSearchExactEmpty(Boolean(parsed.transferSearchExactEmpty));
      setTransferSearchBidDrafts(
        normalizeTransferSearchBidDrafts(parsed.transferSearchBidDrafts)
      );
      if (
        parsed.supporterStatus === "unknown" ||
        parsed.supporterStatus === "supporter" ||
        parsed.supporterStatus === "nonSupporter"
      ) {
        setSupporterStatus(parsed.supporterStatus);
      }
      if (parsed.cache) {
        setCache(parsed.cache);
        if (parsed.selectedId && parsed.cache[parsed.selectedId]) {
          setDetails(parsed.cache[parsed.selectedId].data);
        }
      }
      if (parsed.ratingsCache) setRatingsCache(parsed.ratingsCache);
      if (parsed.ratingsPositions) setRatingsPositions(parsed.ratingsPositions);
      if (parsed.playerList && (players.length === 0 || initialAuthError)) {
        setPlayerList(parsed.playerList);
      }
      if (parsed.matchesState && initialAuthError) {
        setMatchesState(parsed.matchesState);
      }
      if (parsed.hiddenSpecialtyByPlayerId) {
        setHiddenSpecialtyByPlayerId(parsed.hiddenSpecialtyByPlayerId);
      }
      if (parsed.hiddenSpecialtyDiscoveredMatchByPlayerId) {
        setHiddenSpecialtyDiscoveredMatchByPlayerId(
          parsed.hiddenSpecialtyDiscoveredMatchByPlayerId
        );
      }
      if (parsed.analyzedRatingsMatchIds !== undefined) {
        setAnalyzedRatingsMatchIds(parsed.analyzedRatingsMatchIds);
      }
      if (parsed.matrixNewMarkers) {
        if (forceWipeLegacyUpdatesState) {
          setMatrixNewMarkers(buildEmptyMatrixNewMarkers());
        } else {
          setMatrixNewMarkers(normalizeMatrixNewMarkers(parsed.matrixNewMarkers));
        }
      }
      if (Array.isArray(parsed.youthUpdatesHistory)) {
        const normalized = forceWipeLegacyUpdatesState
          ? []
          : parsed.youthUpdatesHistory
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const maybeEntry = entry as Partial<YouthUpdatesGroupedEntry>;
            if (
              typeof maybeEntry.id !== "string" ||
              typeof maybeEntry.comparedAt !== "number" ||
              !Number.isFinite(maybeEntry.comparedAt)
            ) {
              return null;
            }
            const groupedByPlayerId =
              maybeEntry.groupedByPlayerId &&
              typeof maybeEntry.groupedByPlayerId === "object"
                ? (maybeEntry.groupedByPlayerId as YouthUpdatesGroupedEntry["groupedByPlayerId"])
                : {};
            const normalizedGroupedByPlayerId: YouthUpdatesGroupedEntry["groupedByPlayerId"] =
              Object.fromEntries(
                Object.entries(groupedByPlayerId).map(([playerId, groupedEntry]) => {
                  const fallback = groupedEntry as {
                    playerId?: number;
                    playerName?: string;
                    isNewPlayer?: boolean;
                    ratings?: unknown;
                    skillsCurrent?: unknown;
                    skillsMax?: unknown;
                  };
                  const normalizedRatings = Array.isArray(fallback.ratings)
                    ? fallback.ratings
                        .map((rating) => {
                          if (typeof rating === "number") {
                            return {
                              position: rating,
                              previous: null,
                              current: null,
                            };
                          }
                          if (!rating || typeof rating !== "object") return null;
                          const maybeRating = rating as {
                            position?: unknown;
                            previous?: unknown;
                            current?: unknown;
                          };
                          const position = Number(maybeRating.position);
                          if (!Number.isFinite(position)) return null;
                          return {
                            position,
                            previous:
                              typeof maybeRating.previous === "number"
                                ? maybeRating.previous
                                : null,
                            current:
                              typeof maybeRating.current === "number"
                                ? maybeRating.current
                                : null,
                          };
                        })
                        .filter(
                          (rating): rating is {
                            position: number;
                            previous: number | null;
                            current: number | null;
                          } => Boolean(rating)
                        )
                    : [];
                  const normalizeSkillChanges = (input: unknown) =>
                    Array.isArray(input)
                      ? input
                          .map((skill) => {
                            if (typeof skill === "string") {
                              return {
                                skillKey: skill,
                                previous: null,
                                current: null,
                              };
                            }
                            if (!skill || typeof skill !== "object") return null;
                            const maybeSkill = skill as {
                              skillKey?: unknown;
                              previous?: unknown;
                              current?: unknown;
                            };
                            if (typeof maybeSkill.skillKey !== "string") return null;
                            return {
                              skillKey: maybeSkill.skillKey,
                              previous:
                                typeof maybeSkill.previous === "number"
                                  ? maybeSkill.previous
                                  : null,
                              current:
                                typeof maybeSkill.current === "number"
                                  ? maybeSkill.current
                                  : null,
                            };
                          })
                          .filter(
                            (skill): skill is {
                              skillKey: string;
                              previous: number | null;
                              current: number | null;
                            } => Boolean(skill)
                          )
                      : [];
                  return [
                    playerId,
                    {
                      playerId: Number(fallback.playerId ?? playerId),
                      playerName: String(fallback.playerName ?? playerId),
                      isNewPlayer: Boolean(fallback.isNewPlayer),
                      ratings: normalizedRatings,
                      skillsCurrent: normalizeSkillChanges(fallback.skillsCurrent),
                      skillsMax: normalizeSkillChanges(fallback.skillsMax),
                      attributes: Array.isArray(
                        (fallback as { attributes?: unknown }).attributes
                      )
                        ? ((fallback as { attributes?: unknown }).attributes as YouthAttributeChange[])
                        : [],
                    },
                  ];
                })
              );
            return {
              id: maybeEntry.id,
              comparedAt: maybeEntry.comparedAt,
              source:
                maybeEntry.source === "debug" ? "debug" : "refresh",
              hasChanges: Boolean(maybeEntry.hasChanges),
              groupedByPlayerId: normalizedGroupedByPlayerId,
            } satisfies YouthUpdatesGroupedEntry;
          })
          .filter((entry): entry is YouthUpdatesGroupedEntry => Boolean(entry))
          .filter(shouldKeepYouthUpdatesHistoryEntry)
          .slice(0, YOUTH_UPDATES_HISTORY_LIMIT);
        setYouthUpdatesHistory(normalized);
        setSelectedYouthUpdatesId(normalized[0]?.id ?? null);
      } else if (forceWipeLegacyUpdatesState) {
        setYouthUpdatesHistory([]);
        setSelectedYouthUpdatesId(null);
      }

      const persistedPlayers = Array.isArray(parsed.playerList)
        ? parsed.playerList
        : [];
      const persistedDetailsById = new Map<number, YouthPlayerDetails>();
      if (parsed.cache && typeof parsed.cache === "object") {
        Object.entries(parsed.cache).forEach(([id, entry]) => {
          const playerId = Number(id);
          if (!Number.isFinite(playerId) || playerId <= 0) return;
          if (!entry || typeof entry !== "object") return;
          const detailNode =
            (entry as { data?: unknown }).data &&
            typeof (entry as { data?: unknown }).data === "object"
              ? ((entry as { data: Record<string, unknown> }).data as Record<
                  string,
                  unknown
                >)
              : null;
          if (!detailNode) return;
          const resolved = resolveDetails(detailNode);
          if (!resolved) return;
          persistedDetailsById.set(playerId, resolved);
        });
      }
      const persistedRatingsByPlayerId: Record<number, Record<string, number>> =
        {};
      if (parsed.ratingsCache && typeof parsed.ratingsCache === "object") {
        Object.entries(parsed.ratingsCache).forEach(([id, ratings]) => {
          const playerId = Number(id);
          if (!Number.isFinite(playerId) || playerId <= 0) return;
          persistedRatingsByPlayerId[playerId] = cloneRatingsRecord(
            ratings && typeof ratings === "object"
              ? (ratings as Record<string, number>)
              : null
          );
        });
      }
      const persistedRatingsPositions = Array.isArray(parsed.ratingsPositions)
        ? parsed.ratingsPositions
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
        : [];
      if (
        !forceWipeLegacyUpdatesState &&
        persistedPlayers.length > 0 ||
        (!forceWipeLegacyUpdatesState && persistedDetailsById.size > 0) ||
        (!forceWipeLegacyUpdatesState &&
          Object.keys(persistedRatingsByPlayerId).length > 0)
      ) {
        persistedMarkersBaselineRef.current = {
          players: persistedPlayers,
          detailsById: persistedDetailsById,
          ratingsByPlayerId: persistedRatingsByPlayerId,
          ratingsPositions: persistedRatingsPositions,
        };
      }
    } catch {
      // ignore restore errors
    } finally {
      setRestoredStorageKey(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (restoredStorageKey !== storageKey) return;
    const payload = {
      updatesSchemaVersion: YOUTH_UPDATES_SCHEMA_VERSION,
      assignments,
      behaviors,
      selectedId,
      mobileYouthView,
      mobileYouthPlayerScreen,
      mobileYouthMenuPosition,
      activeDetailsTab,
      starPlayerId,
      revealSecondaryTargetPlayerId,
      primaryTraining,
      secondaryTraining,
      tacticType,
      loadedMatchId,
      cache,
      ratingsCache,
      ratingsPositions,
      playerList,
      matchesState,
      hiddenSpecialtyByPlayerId,
      hiddenSpecialtyDiscoveredMatchByPlayerId,
      analyzedRatingsMatchIds,
      matrixNewMarkers,
      youthUpdatesHistory: youthUpdatesHistoryWithChanges,
      transferSearchModalOpen,
      transferSearchSourcePlayerId,
      transferSearchFilters,
      transferSearchResults,
      transferSearchItemCount,
      transferSearchExactEmpty,
      transferSearchBidDrafts,
      supporterStatus,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore persist errors
    }
  }, [
    assignments,
    cache,
    loadedMatchId,
    primaryTraining,
    ratingsCache,
    ratingsPositions,
    secondaryTraining,
    tacticType,
      selectedId,
      mobileYouthView,
      mobileYouthPlayerScreen,
      mobileYouthMenuPosition,
      activeDetailsTab,
    starPlayerId,
    revealSecondaryTargetPlayerId,
    behaviors,
    playerList,
    matchesState,
    hiddenSpecialtyByPlayerId,
    hiddenSpecialtyDiscoveredMatchByPlayerId,
    analyzedRatingsMatchIds,
    matrixNewMarkers,
    youthUpdatesHistoryWithChanges,
    transferSearchModalOpen,
    transferSearchSourcePlayerId,
    transferSearchFilters,
    transferSearchResults,
    transferSearchItemCount,
    transferSearchExactEmpty,
    transferSearchBidDrafts,
    supporterStatus,
    storageKey,
    restoredStorageKey,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileYouthActive) return;
    const currentState = window.history.state as MobileYouthHistoryState | null;
    if (currentState?.appShell !== "tool" || currentState.tool !== "youth") {
      return;
    }
    if (currentState.youthView && currentState.youthScreen) {
      return;
    }
    if (mobileYouthPlayerScreen === "detail") {
      window.history.replaceState(
        {
          appShell: "tool",
          tool: "youth",
          youthView: "playerDetails",
          youthScreen: "root",
        } satisfies MobileYouthHistoryState,
        "",
        window.location.href
      );
      window.history.pushState(
        {
          appShell: "tool",
          tool: "youth",
          youthView: "playerDetails",
          youthScreen: "list",
        } satisfies MobileYouthHistoryState,
        "",
        window.location.href
      );
      window.history.pushState(
        {
          appShell: "tool",
          tool: "youth",
          youthView: "playerDetails",
          youthScreen: "detail",
        } satisfies MobileYouthHistoryState,
        "",
        window.location.href
      );
      return;
    }
    if (mobileYouthPlayerScreen === "list") {
      window.history.replaceState(
        {
          appShell: "tool",
          tool: "youth",
          youthView: "playerDetails",
          youthScreen: "root",
        } satisfies MobileYouthHistoryState,
        "",
        window.location.href
      );
      window.history.pushState(
        {
          appShell: "tool",
          tool: "youth",
          youthView: "playerDetails",
          youthScreen: "list",
        } satisfies MobileYouthHistoryState,
        "",
        window.location.href
      );
      return;
    }
    window.history.replaceState(
      {
        appShell: "tool",
        tool: "youth",
        youthView: mobileYouthView,
        youthScreen: "root",
      } satisfies MobileYouthHistoryState,
      "",
      window.location.href
    );
  }, [mobileYouthActive, mobileYouthPlayerScreen, mobileYouthView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileYouthActive) return;
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as MobileYouthHistoryState | null;
      if (state?.appShell !== "tool" || state.tool !== "youth") return;
      const nextView =
        state.youthView === "skillsMatrix" ||
        state.youthView === "ratingsMatrix" ||
        state.youthView === "lineupOptimizer" ||
        state.youthView === "playerDetails"
          ? state.youthView
          : "playerDetails";
      const nextScreen =
        state.youthScreen === "detail" ||
        state.youthScreen === "list" ||
        state.youthScreen === "root"
          ? state.youthScreen
          : "root";
      setMobileYouthView(nextView);
      setMobileYouthPlayerScreen(nextScreen);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [mobileYouthActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldUseLandscapeMatrixMode =
      mobileYouthActive &&
      (mobileYouthView === "skillsMatrix" || mobileYouthView === "ratingsMatrix");
    if (!shouldUseLandscapeMatrixMode) {
      setMobileYouthLandscapeActive(false);
      return;
    }

    const mediaQuery = window.matchMedia("(orientation: landscape)");
    const syncLandscapeState = () => setMobileYouthLandscapeActive(mediaQuery.matches);
    syncLandscapeState();

    const orientationApi = window.screen?.orientation as
      | (ScreenOrientation & {
          lock?: (orientation: "landscape") => Promise<void>;
        })
      | undefined;
    if (orientationApi && typeof orientationApi.lock === "function") {
      orientationApi.lock("landscape").catch(() => {
        // Some mobile browsers require fullscreen or reject orientation locks.
      });
    }

    const handleChange = (event: MediaQueryListEvent) =>
      setMobileYouthLandscapeActive(event.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
      if (orientationApi && typeof orientationApi.unlock === "function") {
        orientationApi.unlock();
      }
    };
  }, [mobileYouthActive, mobileYouthView]);

  useEffect(() => {
    if (mobileYouthView === "lineupOptimizer") return;
    setMobileYouthLineupPickerSlotId(null);
  }, [mobileYouthView]);

  useEffect(() => {
    if (!ratingsResponseState) return;
    setRatingsPositions(ratingsResponseState.positions ?? []);
    setRatingsCache((prev) => {
      const next: Record<number, Record<string, number>> = { ...prev };
      const validIds = new Set(playerList.map((player) => player.YouthPlayerID));
      Object.keys(next).forEach((id) => {
        if (!validIds.has(Number(id))) delete next[Number(id)];
      });
      const byId = new Map(
        ratingsResponseState.players.map((row) => [row.id, row.ratings])
      );
      playerList.forEach((player) => {
        const rowRatings = byId.get(player.YouthPlayerID);
        if (!rowRatings) {
          if (!next[player.YouthPlayerID]) {
            next[player.YouthPlayerID] = {};
          }
          return;
        }
        next[player.YouthPlayerID] = { ...rowRatings };
      });
      return next;
    });
  }, [playerList, ratingsResponseState]);

  useEffect(() => {
    setRatingsCache((prev) => {
      const validIds = new Set(playerList.map((player) => player.YouthPlayerID));
      const next: Record<number, Record<string, number>> = {};
      let changed = false;
      Object.entries(prev).forEach(([id, ratings]) => {
        const numericId = Number(id);
        if (!validIds.has(numericId)) {
          changed = true;
          return;
        }
        next[numericId] = ratings;
      });
      return changed ? next : prev;
    });
  }, [playerList]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAllowTrainingUntilMaxedOut(readAllowTrainingUntilMaxedOut());
    setStalenessDays(readYouthStalenessDays());
    setLastGlobalRefreshAt(readLastRefreshTimestamp());
    const handle = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (
          event.key &&
          event.key !== ALGORITHM_SETTINGS_STORAGE_KEY &&
          event.key !== YOUTH_SETTINGS_STORAGE_KEY &&
          event.key !== LAST_REFRESH_STORAGE_KEY
        ) {
          return;
        }
      }
      if (event instanceof CustomEvent) {
        const detail =
          event.detail as { allowTrainingUntilMaxedOut?: boolean; stalenessDays?: number } | null;
        if (typeof detail?.allowTrainingUntilMaxedOut === "boolean") {
          setAllowTrainingUntilMaxedOut(detail.allowTrainingUntilMaxedOut);
        }
        if (typeof detail?.stalenessDays === "number") {
          setStalenessDays(detail.stalenessDays);
        }
      }
      setAllowTrainingUntilMaxedOut(readAllowTrainingUntilMaxedOut());
      setStalenessDays(readYouthStalenessDays());
      setLastGlobalRefreshAt(readLastRefreshTimestamp());
    };
    window.addEventListener("storage", handle);
    window.addEventListener(ALGORITHM_SETTINGS_EVENT, handle);
    window.addEventListener(YOUTH_SETTINGS_EVENT, handle);
    return () => {
      window.removeEventListener("storage", handle);
      window.removeEventListener(ALGORITHM_SETTINGS_EVENT, handle);
      window.removeEventListener(YOUTH_SETTINGS_EVENT, handle);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isConnected) return;
    const lastRefresh = readLastRefreshTimestamp();
    if (!lastRefresh) {
      if (playerList.length > 0) {
        const fallback = Date.now();
        writeLastRefreshTimestamp(fallback);
        setLastGlobalRefreshAt(fallback);
      }
      return;
    }
    const maxAgeMs = stalenessDays * 24 * 60 * 60 * 1000;
    const isStale = Date.now() - lastRefresh >= maxAgeMs;
    if (!isStale) {
      staleRefreshAttemptedRef.current = false;
      return;
    }
    if (playersLoading) return;
    if (staleRefreshAttemptedRef.current) return;
    staleRefreshAttemptedRef.current = true;
    void refreshPlayers(undefined, { refreshAll: true, reason: "stale" });
  }, [playerList.length, stalenessDays, activeYouthTeamId, isConnected, playersLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isConnected) return;

    const maybeRunStaleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      const lastRefresh = readLastRefreshTimestamp();
      if (!lastRefresh) {
        if (playerList.length > 0) {
          const fallback = Date.now();
          writeLastRefreshTimestamp(fallback);
          setLastGlobalRefreshAt(fallback);
        }
        return;
      }
      const maxAgeMs = stalenessDays * 24 * 60 * 60 * 1000;
      const isStale = Date.now() - lastRefresh >= maxAgeMs;
      if (!isStale) {
        staleRefreshAttemptedRef.current = false;
        return;
      }
      if (playersLoading) return;
      if (staleRefreshAttemptedRef.current) return;
      staleRefreshAttemptedRef.current = true;
      void refreshPlayers(undefined, { refreshAll: true, reason: "stale" });
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
  }, [playerList.length, stalenessDays, activeYouthTeamId, isConnected, playersLoading]);

  useEffect(() => {
    if (!initialAuthError) return;
    setAuthError(true);
    setAuthErrorDetails(initialLoadDetails ?? null);
  }, [initialAuthError, initialLoadDetails]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleAuthRequired = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { details?: string; debugDetails?: string } | undefined)
          : undefined;
      setAuthError(true);
      setAuthErrorDetails(detail?.details ?? messages.connectHint);
      setAuthErrorDebugDetails(
        process.env.NODE_ENV !== "production" ? detail?.debugDetails ?? null : null
      );
      const now = Date.now();
      if (now - lastAuthNotificationAtRef.current > 3000) {
        addNotification(messages.notificationReauthRequired);
        lastAuthNotificationAtRef.current = now;
      }
    };
    window.addEventListener(CHPP_AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () =>
      window.removeEventListener(CHPP_AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [addNotification, messages.connectHint, messages.notificationReauthRequired]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isConnected) {
      setCurrentToken(null);
      setShowHelp(false);
      setPendingAutoHelpOpen(false);
      return;
    }
    const fetchToken = async () => {
      try {
        const { payload } = await fetchChppJson<{ raw?: string; details?: string }>(
          "/api/chpp/oauth/check-token",
          {
            cache: "no-store",
          }
        );
        const raw = payload?.raw ?? "";
        const match = raw.match(/<Token>(.*?)<\/Token>/);
        const token = match?.[1]?.trim() ?? null;
        if (!token) return;
        setCurrentToken(token);
        if (mobileYouthActive) return;
        const storedToken = window.localStorage.getItem(helpStorageKey);
        if (storedToken !== token) {
          if (youthAutoHelpReady) {
            setShowHelp(true);
            setPendingAutoHelpOpen(false);
          } else {
            setShowHelp(false);
            setPendingAutoHelpOpen(true);
          }
        } else {
          setPendingAutoHelpOpen(false);
        }
      } catch (error) {
        if (error instanceof ChppAuthRequiredError) return;
        // ignore token check errors
      }
    };
    fetchToken();
  }, [isConnected, mobileYouthActive, youthAutoHelpReady]);

  useEffect(() => {
    if (!pendingAutoHelpOpen) return;
    if (!youthAutoHelpReady) return;
    setShowHelp(true);
    setPendingAutoHelpOpen(false);
  }, [pendingAutoHelpOpen, youthAutoHelpReady]);

  useEffect(() => {
    if (!isDev) return;
    setDebugOauthErrorMode(readChppDebugOauthErrorMode());
  }, [isDev]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (mobileYouthActive) return;
      setShowHelp(true);
    };
    window.addEventListener("ya:help-open", handler);
    return () => window.removeEventListener("ya:help-open", handler);
  }, [mobileYouthActive]);

  useEffect(() => {
    if (!mobileYouthActive) return;
    setShowHelp(false);
    setPendingAutoHelpOpen(false);
  }, [mobileYouthActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setShowChangelog(true);
    window.addEventListener("ya:changelog-open", handler);
    return () => window.removeEventListener("ya:changelog-open", handler);
  }, []);

  useEffect(() => {
    if (!isDev) return;
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { mode?: "toggle" | "on" | "off" } | undefined)
          : undefined;
      applyRandomDebugNewMarkers(detail?.mode ?? "toggle");
    };
    window.addEventListener(YOUTH_NEW_MARKERS_DEBUG_EVENT, handler);
    return () => window.removeEventListener(YOUTH_NEW_MARKERS_DEBUG_EVENT, handler);
  }, [
    isDev,
    debugMatrixNewMarkersActive,
    playerList,
    ratingsMatrixData,
    messages.notificationDebugNewMarkers,
  ]);

  useEffect(() => {
    if (!isDev) return;
    if (typeof window === "undefined") return;

    const resolveEventPlayerName = async (
      playerIdRaw: unknown,
      fallbackNameRaw?: unknown
    ) => {
      const playerId = Number(playerIdRaw);
      const fallbackName =
        typeof fallbackNameRaw === "string" ? fallbackNameRaw.trim() : "";
      if (!Number.isFinite(playerId) || playerId <= 0) {
        return fallbackName || "unknown";
      }
      const rosterPlayer = playerList.find(
        (player) => player.YouthPlayerID === playerId
      );
      if (rosterPlayer) return formatPlayerName(rosterPlayer);
      if (fallbackName) return fallbackName;
      try {
        const detailRaw = await ensureDetails(playerId);
        const resolved = resolveDetails(detailRaw);
        if (resolved) {
          const detailName = [
            resolved.FirstName,
            resolved.NickName || null,
            resolved.LastName,
          ]
            .filter(Boolean)
            .join(" ");
          if (detailName) return detailName;
        }
      } catch {
        // try generic playerdetails as fallback below
      }
      try {
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              Player?: {
                FirstName?: string;
                NickName?: string;
                LastName?: string;
              };
            };
          };
          error?: string;
        }>(`/api/chpp/playerdetails?playerId=${playerId}`, { cache: "no-store" });
        if (response.ok && !payload?.error) {
          const fallbackPlayer = payload?.data?.HattrickData?.Player;
          if (fallbackPlayer) {
            const fallbackResolvedName = [
              fallbackPlayer.FirstName,
              fallbackPlayer.NickName || null,
              fallbackPlayer.LastName,
            ]
              .filter(Boolean)
              .join(" ");
            if (fallbackResolvedName) return fallbackResolvedName;
          }
        }
      } catch {
        // ignore fallback lookup errors
      }
      return `unknown#${playerId}`;
    };

    const handler = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as { matchId?: unknown } | undefined)
          : undefined;
      const matchId = Number(detail?.matchId);
      if (!Number.isFinite(matchId) || matchId <= 0) return;
      void (async () => {
        try {
          const matchIdInt = Math.floor(matchId);
          const { response, payload } = await fetchChppJson<MatchDetailsEventsResponse>(
            `/api/chpp/matchdetails?matchId=${matchIdInt}&sourceSystem=${encodeURIComponent(
              "youth"
            )}&matchEvents=true`,
            { cache: "no-store" }
          );
          if (!response.ok || payload?.error) {
            console.log(`[hidden-spec-debug] Failed to fetch match ${matchIdInt}`);
            return;
          }
          const events = normalizeArray<MatchDetailsEvent>(
            payload?.data?.HattrickData?.Match?.EventList?.Event
          );
          const matchUrl =
            (ratingsMatrixMatchHrefBuilder
              ? ratingsMatrixMatchHrefBuilder(matchIdInt)
              : null) ??
            (resolvedYouthTeamId && resolvedYouthTeamId > 0
              ? hattrickYouthMatchUrl(matchIdInt, resolvedYouthTeamId, resolvedYouthTeamId)
              : `match:${matchIdInt}`);
          for (const matchEvent of events) {
            const eventTypeId = Number(matchEvent.EventTypeID);
            if (!SPECIAL_EVENT_SPECIALTY_RULES[eventTypeId]) continue;
            const objectName = await resolveEventPlayerName(
              matchEvent.ObjectPlayerID,
              matchEvent.ObjectPlayerName
            );
            const subjectName = await resolveEventPlayerName(
              matchEvent.SubjectPlayerID,
              matchEvent.SubjectPlayerName
            );
            const eventText = [
              matchEvent.EventText,
              matchEvent.EventDescription,
              matchEvent.EventComment,
              matchEvent.EventCommentary,
            ]
              .find(
                (value): value is string =>
                  typeof value === "string" && value.trim().length > 0
              )
              ?.trim();
            console.log(
              `${eventTypeId}: ${objectName} (object); ${subjectName} (subject); ${matchUrl}${
                eventText ? `; ${eventText}` : ""
              }`
            );
          }
        } catch {
          console.log(`[hidden-spec-debug] Failed to process match ${matchId}`);
        }
      })();
    };

    window.addEventListener(YOUTH_DEBUG_SE_FETCH_EVENT, handler);
    return () => window.removeEventListener(YOUTH_DEBUG_SE_FETCH_EVENT, handler);
  }, [isDev, playerList, ratingsMatrixMatchHrefBuilder, resolvedYouthTeamId]);

  useEffect(() => {
    if (!showOptimizerDebug) return;
    setOptimizerDragOffset({ x: 0, y: 0 });
  }, [showOptimizerDebug]);

  useEffect(() => {
    if (!optimizerDragging) return;

    const handleMove = (event: PointerEvent) => {
      const start = optimizerDragStart.current;
      if (!start) return;
      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      let nextX = start.offsetX + deltaX;
      let nextY = start.offsetY + deltaY;
      const rect = optimizerModalRef.current?.getBoundingClientRect();
      if (rect) {
        const maxX = Math.max(0, window.innerWidth / 2 - rect.width / 2 - 16);
        const maxY = Math.max(0, window.innerHeight / 2 - rect.height / 2 - 16);
        nextX = Math.max(-maxX, Math.min(maxX, nextX));
        nextY = Math.max(-maxY, Math.min(maxY, nextY));
      }
      setOptimizerDragOffset({ x: nextX, y: nextY });
    };

    const handleUp = () => {
      setOptimizerDragging(false);
      optimizerDragStart.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [optimizerDragging]);

  useEffect(() => {
    if (!showHelp) {
      setHelpCallouts([]);
      return;
    }
    const CALL_OUT_MAX_WIDTH = 240;
    const computeCallouts = () => {
      const root = dashboardRef.current;
      if (!root) return;
      const scaleValue =
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--ui-scale"
          )
        ) || 1;
      const rootRect = root.getBoundingClientRect();
      const rootWidth = rootRect.width / scaleValue;
      const rootHeight = rootRect.height / scaleValue;
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
      }> = [
        {
          id: "star",
          selector: "[data-help-anchor='star-first']",
          text: messages.helpCalloutStar,
          placement: "above-center",
          offsetY: 6,
        },
        {
          id: "training",
          selector: "[data-help-anchor='training-dropdowns']",
          text: messages.helpCalloutTraining,
          placement: "below-center",
          offsetY: 6,
        },
        {
          id: "optimize",
          selector: "[data-help-anchor='optimize-menu']",
          text: messages.helpCalloutOptimize,
          placement: "left-center",
        },
        {
          id: "auto",
          selector: "[data-help-anchor='auto-select']",
          text: messages.helpCalloutAuto,
          placement: "above-center",
          hideIndex: true,
        },
      ];
      const measureWidth = (text: string, hideIndex: boolean) => {
        const probe = document.createElement("div");
        probe.className = styles.helpCallout;
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        probe.style.pointerEvents = "none";
        probe.style.maxWidth = `${CALL_OUT_MAX_WIDTH}px`;
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
        root.appendChild(probe);
        const width = probe.getBoundingClientRect().width / scaleValue;
        probe.remove();
        return Math.min(width, CALL_OUT_MAX_WIDTH);
      };

      const next = targets.flatMap((target) => {
        const el = root.querySelector(target.selector) as HTMLElement | null;
        if (!el) return [];
        const rect = el.getBoundingClientRect();
        const rectLeft = (rect.left - rootRect.left) / scaleValue;
        const rectTop = (rect.top - rootRect.top) / scaleValue;
        const rectWidth = rect.width / scaleValue;
        const rectHeight = rect.height / scaleValue;
        const centerX = rectLeft + rectWidth / 2;
        const centerY = rectTop + rectHeight / 2;
        let left = centerX;
        let top = centerY;
        let transform = "translate(-50%, -50%)";
        const offsetX = target.offsetX ?? 0;
        const offsetY = target.offsetY ?? 0;
        switch (target.placement) {
          case "above-left":
            left = rectLeft + 10;
            top = rectTop - 8;
            transform = "translate(0, -100%)";
            break;
          case "above-center":
            left = centerX;
            top = rectTop - 10;
            transform = "translate(-50%, -100%)";
            break;
          case "below-center":
            left = centerX;
            top = rectTop + rectHeight + 10;
            transform = "translate(-50%, 0)";
            break;
          case "right-center":
            left = rectLeft + rectWidth + 10;
            top = centerY;
            transform = "translate(0, -50%)";
            break;
          case "left-center":
            left = rectLeft - 10;
            top = centerY;
            transform = "translate(-100%, -50%)";
            break;
          default:
            break;
        }
        left += offsetX;
        top += offsetY;
        const calloutWidth = measureWidth(
          target.text,
          target.hideIndex ?? false
        );
        const clampedLeft = Math.min(
          Math.max(left, 12),
          rootWidth - 12
        );
        const maxLeft = rootWidth - 12;
        const minLeft = 12;
        const needsCenterClamp = transform.includes("-50%");
        const clampedLeftAdjusted = needsCenterClamp
          ? Math.min(
              Math.max(clampedLeft, minLeft + calloutWidth / 2),
              maxLeft - calloutWidth / 2
            )
          : clampedLeft;
        const pointerXRaw =
          target.placement === "above-center" ||
          target.placement === "below-center"
            ? centerX - clampedLeftAdjusted + calloutWidth / 2
            : centerX - clampedLeftAdjusted;
        const pointerX = Math.min(
          Math.max(pointerXRaw, 18),
          calloutWidth - 18
        );
        const clampedTop = Math.min(
          Math.max(top, 12),
          rootHeight - 12
        );
        return [
          {
            id: target.id,
            text: target.text,
            style: {
              left: clampedLeftAdjusted,
              top: clampedTop,
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
    return () => window.removeEventListener("resize", schedule);
  }, [showHelp, messages]);

  useEffect(() => {
    if (!showHelp) {
      setHelpCardTopOffset(0);
      return;
    }
    const updateHelpCardOffset = () => {
      const root = dashboardRef.current;
      if (!root) return;
      const rootRect = root.getBoundingClientRect();
      const calloutNodes = Array.from(
        root.querySelectorAll<HTMLElement>(`.${styles.helpCallout}`)
      );
      if (calloutNodes.length === 0) {
        setHelpCardTopOffset(0);
        return;
      }
      const maxBottom = calloutNodes.reduce(
        (acc, node) => Math.max(acc, node.getBoundingClientRect().bottom),
        rootRect.top
      );
      setHelpCardTopOffset(Math.max(0, maxBottom - rootRect.top + 16));
    };
    const frame = window.requestAnimationFrame(updateHelpCardOffset);
    window.addEventListener("resize", updateHelpCardOffset);
    window.addEventListener("scroll", updateHelpCardOffset, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateHelpCardOffset);
      window.removeEventListener("scroll", updateHelpCardOffset, true);
    };
  }, [showHelp, helpCallouts]);

  const loadDetails = async (playerId: number, forceRefresh = false) => {
    const cached = cache[playerId];
    const isFresh =
      cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS;

    if (!forceRefresh && cached && isFresh) {
      setDetails(cached.data);
      setError(null);
      return;
    }

    const previousDetails = details;
    setLoading(true);
    setError(null);
    setUnlockStatus(null);

    try {
      const { response, payload } = await fetchChppJson<PlayerDetailsResponse>(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&showScoutCall=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        const detailsText = payload?.details ?? payload?.error ?? null;
        const statusCode =
          typeof payload?.statusCode === "number"
            ? payload.statusCode
            : response.status;
        const errorWithStatus = new Error(
          detailsText ?? "Failed to fetch player details"
        ) as Error & { statusCode?: number; detailsText?: string | null };
        errorWithStatus.statusCode = statusCode;
        errorWithStatus.detailsText = detailsText;
        throw errorWithStatus;
      }

      const resolved = payload?.data ?? null;
      if (resolved) {
        setCache((prev) => ({
          ...prev,
          [playerId]: {
            data: resolved,
            fetchedAt: Date.now(),
          },
        }));
      }
      setDetails(resolved);
      if (payload?.unlockStatus) {
        setUnlockStatus(payload.unlockStatus);
      }
    } catch (err) {
      if (err instanceof ChppAuthRequiredError) {
        setDetails(previousDetails);
        return;
      }
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode?: unknown }).statusCode) || null
          : null;
      const detailsText =
        err &&
        typeof err === "object" &&
        "detailsText" in err &&
        typeof (err as { detailsText?: unknown }).detailsText === "string"
          ? ((err as { detailsText?: string }).detailsText ?? null)
          : err instanceof Error
            ? err.message
            : String(err);
      setServiceErrorModal({
        title: messages.unableToLoadPlayers,
        details: detailsText,
        statusCode,
      });
      setError(null);
      setDetails(previousDetails);
    } finally {
      setLoading(false);
    }
  };

  const ensureDetails = async (playerId: number, forceRefresh = false) => {
    const cached = cache[playerId];
    const isFresh =
      cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS;
    if (!forceRefresh && cached && isFresh) return cached.data;

    try {
      const { response, payload } = await fetchChppJson<PlayerDetailsResponse>(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&showScoutCall=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        return null;
      }
      const resolved = payload?.data ?? null;
      if (resolved) {
        setCache((prev) => ({
          ...prev,
          [playerId]: {
            data: resolved,
            fetchedAt: Date.now(),
          },
        }));
      }
      if (payload?.unlockStatus) {
        setUnlockStatus(payload.unlockStatus);
      }
      return resolved;
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return null;
      // ignore hover failures
      return null;
    }
  };

  const refreshYouthPlayerDetailsForGlobalRefresh = async (
    playerId: number
  ): Promise<YouthPlayerDetailRefreshResult> => {
    try {
      const { response, payload } = await fetchChppJson<PlayerDetailsResponse>(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&showScoutCall=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        return {
          id: playerId,
          detailRaw: null,
          resolved: null,
          ok: false,
          error: payload?.details ?? payload?.error ?? "Failed to fetch player details",
        };
      }
      const detailRaw = payload?.data ?? null;
      const resolved = resolveDetails(detailRaw);
      if (!detailRaw || !resolved) {
        return {
          id: playerId,
          detailRaw: null,
          resolved: null,
          ok: false,
          error: "Player details response did not include usable player data",
        };
      }
      if (payload?.unlockStatus) {
        setUnlockStatus(payload.unlockStatus);
      }
      return {
        id: playerId,
        detailRaw,
        resolved,
        ok: true,
        error: null,
      };
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) {
        throw error;
      }
      return {
        id: playerId,
        detailRaw: null,
        resolved: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const fetchTransferSearchPlayerDetails = async (playerId: number) => {
    const { response, payload } = await fetchChppJson<{
      data?: { HattrickData?: { Player?: YouthPlayerDetails } };
      error?: string;
    }>(`/api/chpp/playerdetails?playerId=${playerId}&includeMatchInfo=true`, {
      cache: "no-store",
    });
    if (!response.ok || payload?.error || !payload?.data?.HattrickData?.Player) {
      return null;
    }
    return payload.data.HattrickData.Player;
  };

  const hydrateTransferSearchDetails = async (results: TransferSearchResult[]) => {
    void mapWithConcurrency(results, 4, async (result) => {
      const detail = await fetchTransferSearchPlayerDetails(result.playerId);
      if (detail) {
        setTransferSearchDetailsById((prev) => ({
          ...prev,
          [result.playerId]: detail,
        }));
      }
      return null;
    });
  };

  const runTransferSearch = async (
    filters: TransferSearchFilters,
    options?: {
      allowAutoFallback?: boolean;
      sourcePlayer?: YouthPlayer | null;
      sourceDetails?: YouthPlayerDetails | null;
    }
  ) => {
    const requestId = transferSearchRequestIdRef.current + 1;
    transferSearchRequestIdRef.current = requestId;
    const isCurrentSearch = () => transferSearchRequestIdRef.current === requestId;
    const normalizedFilters = normalizeTransferSearchFilters(filters);
    setTransferSearchFilters(normalizedFilters);
    setTransferSearchLoading(true);
    setTransferSearchError(null);
    setTransferSearchExactEmpty(false);
    setTransferSearchResults([]);
    setTransferSearchItemCount(null);

    const execute = async (filtersToRun: TransferSearchFilters) => {
      const params = buildTransferSearchParams(filtersToRun);
      const { response, payload } = await fetchChppJson<{
        data?: {
          HattrickData?: {
            TransferSearch?: {
              ItemCount?: unknown;
              TransferResults?: {
                TransferResult?: unknown;
              };
            };
          };
        };
        error?: string;
        details?: string;
      }>(`/api/chpp/transfersearch?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok || payload?.error) {
        throw new Error(payload?.details ?? payload?.error ?? "Failed to search transfers");
      }
      const transferSearch = payload?.data?.HattrickData?.TransferSearch;
      return {
        itemCount:
          transferSearch?.ItemCount === undefined || transferSearch.ItemCount === null
            ? null
            : Number(transferSearch.ItemCount),
        results: normalizeTransferSearchResults(
          transferSearch?.TransferResults?.TransferResult
        ),
      };
    };

    try {
      const exact = await execute(normalizedFilters);
      if (!isCurrentSearch()) return;
      const fallbackSourcePlayer = options?.sourcePlayer ?? selectedPlayer;
      const fallbackSourceDetails =
        options?.sourceDetails ??
        (fallbackSourcePlayer
          ? playerDetailsById.get(fallbackSourcePlayer.YouthPlayerID) ?? null
          : null);
      if (
        options?.allowAutoFallback &&
        exact.results.length === 0 &&
        fallbackSourcePlayer
      ) {
        const fallbackFilters = buildYouthEstimateValueFilters(
          fallbackSourcePlayer,
          fallbackSourceDetails,
          true
        );
        if (fallbackFilters) {
          const fallback = await execute(fallbackFilters);
          if (!isCurrentSearch()) return;
          setTransferSearchFilters(fallbackFilters);
          setTransferSearchResults(fallback.results);
          setTransferSearchItemCount(fallback.itemCount);
          setTransferSearchExactEmpty(true);
          await hydrateTransferSearchDetails(fallback.results);
          return;
        }
      }
      setTransferSearchResults(exact.results);
      setTransferSearchItemCount(exact.itemCount);
      await hydrateTransferSearchDetails(exact.results);
    } catch (error) {
      if (!isCurrentSearch()) return;
      setTransferSearchResults([]);
      setTransferSearchItemCount(null);
      setTransferSearchError(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      if (isCurrentSearch()) {
        setTransferSearchLoading(false);
      }
    }
  };

  const openYouthEstimateValueSearch = async () => {
    if (!selectedPlayer) return;
    const ensuredDetails = playerDetailsById.has(selectedPlayer.YouthPlayerID)
      ? null
      : await ensureDetails(selectedPlayer.YouthPlayerID);
    const detail =
      playerDetailsById.get(selectedPlayer.YouthPlayerID) ??
      resolveDetails(ensuredDetails);
    const initialFilters = buildYouthEstimateValueFilters(
      selectedPlayer,
      detail,
      false
    );
    if (!initialFilters) return;
    setTransferSearchSourcePlayerId(selectedPlayer.YouthPlayerID);
    setTransferSearchModalOpen(true);
    void runTransferSearch(initialFilters, {
      allowAutoFallback: true,
      sourcePlayer: selectedPlayer,
      sourceDetails: detail,
    });
  };

  const updateTransferSearchSkillFilter = useCallback((
    index: number,
    patch: Partial<TransferSearchSkillFilter>
  ) => {
    setTransferSearchFilters((prev) => {
      if (!prev) return prev;
      const nextSkillFilters = prev.skillFilters.map((filter, filterIndex) =>
        filterIndex === index ? { ...filter, ...patch } : filter
      );
      return normalizeTransferSearchFilters({
        ...prev,
        skillFilters: nextSkillFilters,
      });
    });
  }, []);

  const addTransferSearchSkillFilter = useCallback((
    skillKey: TransferSearchSkillKey
  ) => {
    setTransferSearchFilters((prev) => {
      if (!prev || prev.skillFilters.length >= 4) return prev;
      if (prev.skillFilters.some((filter) => filter.skillKey === skillKey)) {
        return prev;
      }
      const definition = TRANSFER_SEARCH_SKILLS.find(
        (entry) => entry.key === skillKey
      );
      if (!definition) return prev;
      return normalizeTransferSearchFilters({
        ...prev,
        skillFilters: [
          ...prev.skillFilters,
          {
            skillKey,
            min: definition.min,
            max: Math.min(definition.max, definition.min + 4),
          },
        ],
      });
    });
  }, []);

  const updateTransferSearchFilterField = useCallback(<
    K extends Exclude<keyof TransferSearchFilters, "skillFilters">
  >(
    key: K,
    value: TransferSearchFilters[K]
  ) => {
    setTransferSearchFilters((prev) =>
      prev ? normalizeTransferSearchFilters({ ...prev, [key]: value }) : prev
    );
  }, []);

  const updateTransferSearchBidDraft = useCallback((
    playerId: number,
    key: keyof TransferSearchBidDraft,
    value: string
  ) => {
    setTransferSearchBidDrafts((prev) => ({
      ...prev,
      [playerId]: {
        bidEur: prev[playerId]?.bidEur ?? "",
        maxBidEur: prev[playerId]?.maxBidEur ?? "",
        [key]: value,
      },
    }));
  }, []);

  const submitTransferBid = useCallback(async (
    result: TransferSearchResult,
    bidKind: keyof TransferSearchBidDraft
  ) => {
    if (!resolvedSeniorTeamId) return;
    const draft = transferSearchBidDrafts[result.playerId] ?? {
      bidEur: "",
      maxBidEur: "",
    };
    const amountSek = eurToSek(draft[bidKind]);
    if (!amountSek) {
      addNotification(messages.seniorTransferSearchBidMissingAmount);
      return;
    }

    setTransferSearchBidPendingPlayerId(result.playerId);
    try {
      const requestBody =
        bidKind === "bidEur"
          ? {
              playerId: result.playerId,
              teamId: resolvedSeniorTeamId,
              bidAmount: amountSek,
            }
          : {
              playerId: result.playerId,
              teamId: resolvedSeniorTeamId,
              maxBidAmount: amountSek,
            };
      const { response, payload } = await fetchChppJson<{
        error?: string;
        details?: string;
      }>("/api/chpp/playerdetails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok || payload?.error) {
        throw new Error(payload?.details ?? payload?.error ?? "Failed to place bid");
      }
      addNotification(
        messages.seniorTransferSearchBidPlaced.replace(
          "{{player}}",
          formatTransferSearchPlayerName(result)
        )
      );
    } catch (error) {
      addNotification(
        messages.seniorTransferSearchBidFailed.replace(
          "{{details}}",
          error instanceof Error ? error.message : String(error)
        )
      );
    } finally {
      setTransferSearchBidPendingPlayerId(null);
    }
  }, [
    addNotification,
    messages.seniorTransferSearchBidFailed,
    messages.seniorTransferSearchBidMissingAmount,
    messages.seniorTransferSearchBidPlaced,
    resolvedSeniorTeamId,
    transferSearchBidDrafts,
  ]);

  const transferSearchResultCountLabel =
    transferSearchItemCount === null || Number.isNaN(transferSearchItemCount)
      ? null
      : transferSearchItemCount === -1
        ? messages.seniorTransferSearchResultsMany
        : messages.seniorTransferSearchResultsCount.replace(
            "{{count}}",
            String(transferSearchItemCount)
          );

  useEffect(() => {
    setTransferSearchBidDrafts((prev) => {
      const next = { ...prev };
      transferSearchResults.forEach((result) => {
        const existing = next[result.playerId] ?? { bidEur: "", maxBidEur: "" };
        next[result.playerId] = {
          bidEur: formatTransferSearchBidDraftEur(
            buildTransferSearchMinimumBidEur(result)
          ),
          maxBidEur: existing.maxBidEur,
        };
      });
      return next;
    });
  }, [transferSearchResults]);

  const specialtyName = useCallback((value?: number | null) => {
    switch (value) {
      case 0:
        return messages.specialtyNone;
      case 1:
        return messages.specialtyTechnical;
      case 2:
        return messages.specialtyQuick;
      case 3:
        return messages.specialtyPowerful;
      case 4:
        return messages.specialtyUnpredictable;
      case 5:
        return messages.specialtyHeadSpecialist;
      case 6:
        return messages.specialtyResilient;
      case 8:
        return messages.specialtySupport;
      default:
        return null;
    }
  }, [
    messages.specialtyHeadSpecialist,
    messages.specialtyNone,
    messages.specialtyPowerful,
    messages.specialtyQuick,
    messages.specialtyResilient,
    messages.specialtySupport,
    messages.specialtyTechnical,
    messages.specialtyUnpredictable,
  ]);
  const transferSearchCanBid =
    supporterStatus === "supporter" && Boolean(resolvedSeniorTeamId);

  const renderTransferSearchResultCard = useCallback((result: TransferSearchResult) => {
    const resultDetails = transferSearchDetailsById[result.playerId] ?? null;
    const draft = transferSearchBidDrafts[result.playerId] ?? { bidEur: "", maxBidEur: "" };
    const pending = transferSearchBidPendingPlayerId === result.playerId;
    const playerName = formatTransferSearchPlayerName(result);
    const displayPriceSek =
      typeof result.highestBidSek === "number" && result.highestBidSek > 0
        ? result.highestBidSek
        : result.askingPriceSek;
    const displayPriceLabel =
      typeof result.highestBidSek === "number" && result.highestBidSek > 0
        ? messages.seniorTransferSearchHighestBidLabel
        : messages.clubChronicleTransferListedAskingPriceColumn;
    const deadlineDate = parseChppDate(result.deadline ?? undefined);
    const resultSpecialty = resultDetails?.Specialty ?? result.specialty;
    const resultSpecialtyName =
      resultSpecialty !== null && resultSpecialty !== undefined
        ? resultSpecialty === 0
          ? messages.specialtyNone
          : specialtyName(resultSpecialty)
        : null;
    const resolvedForm = resultDetails?.Form ?? result.form;
    const resolvedStamina = resultDetails?.StaminaSkill ?? result.staminaSkill;
    const seniorMetricInput = {
      ageYears:
        typeof resultDetails?.Age === "number" ? resultDetails.Age : result.age,
      ageDays:
        typeof resultDetails?.AgeDays === "number" ? resultDetails.AgeDays : result.ageDays,
      tsi: typeof resultDetails?.TSI === "number" ? resultDetails.TSI : result.tsi,
      salarySek:
        typeof resultDetails?.Salary === "number" ? resultDetails.Salary : result.salarySek,
      isAbroad:
        typeof resultDetails?.IsAbroad === "boolean"
          ? resultDetails.IsAbroad
          : typeof result.isAbroad === "boolean"
            ? result.isAbroad
            : undefined,
      form: resolvedForm,
      stamina: resolvedStamina,
      keeper:
        parseSeniorMetricSkill(resultDetails?.PlayerSkills?.KeeperSkill) ??
        result.keeperSkill,
      defending:
        parseSeniorMetricSkill(resultDetails?.PlayerSkills?.DefenderSkill) ??
        result.defenderSkill,
      playmaking:
        parseSeniorMetricSkill(resultDetails?.PlayerSkills?.PlaymakerSkill) ??
        result.playmakerSkill,
      winger:
        parseSeniorMetricSkill(resultDetails?.PlayerSkills?.WingerSkill) ??
        result.wingerSkill,
      passing:
        parseSeniorMetricSkill(resultDetails?.PlayerSkills?.PassingSkill) ??
        result.passingSkill,
      scoring:
        parseSeniorMetricSkill(resultDetails?.PlayerSkills?.ScorerSkill) ??
        result.scorerSkill,
      setPieces:
        parseSeniorMetricSkill(resultDetails?.PlayerSkills?.SetPiecesSkill) ??
        result.setPiecesSkill,
    };
    return (
      <article key={result.playerId} className={styles.transferSearchResultCard}>
        <div className={styles.transferSearchResultHeader}>
          <div>
            <h4 className={styles.profileName}>
              <a
                className={styles.profileNameLink}
                href={hattrickPlayerUrl(result.playerId)}
                target="_blank"
                rel="noreferrer"
                aria-label={messages.playerLinkLabel}
              >
                {playerName}
              </a>
            </h4>
            <p className={styles.profileMeta}>
              {result.age !== null ? (
                <span className={styles.metaItem}>
                  {result.age} {messages.yearsLabel} {result.ageDays ?? 0} {messages.daysLabel}
                </span>
              ) : null}
              {result.tsi !== null ? (
                <span className={styles.metaItem}>
                  {messages.sortTsi}: {result.tsi}
                </span>
              ) : null}
            </p>
          </div>
          <div className={styles.transferSearchPriceBlock}>
            <div className={styles.infoLabel}>{displayPriceLabel}</div>
            <div className={`${styles.infoValue} ${styles.transferSearchPriceValue}`}>
              {displayPriceSek !== null
                ? formatEurFromSek(displayPriceSek)
                : messages.unknownShort}
            </div>
          </div>
        </div>

        <div className={styles.profileInfoRow}>
          <div>
            <div className={styles.infoLabel}>{messages.playerIdLabel}</div>
            <div className={styles.infoValue}>
              {result.playerId}
              <Tooltip content={messages.copyPlayerIdLabel}>
                <button
                  type="button"
                  className={`${styles.infoLinkIcon} ${styles.copyPlayerIdButton}`}
                  onClick={() => {
                    void copyTextToClipboard(String(result.playerId)).then((copied) => {
                      if (copied) addNotification(messages.notificationPlayerIdCopied);
                    });
                  }}
                  aria-label={messages.copyPlayerIdLabel}
                >
                  ⧉
                </button>
              </Tooltip>
            </div>
          </div>
          {resultSpecialtyName ? (
            <div>
              <div className={styles.infoLabel}>{messages.specialtyLabel}</div>
              <div className={styles.infoValue}>{resultSpecialtyName}</div>
            </div>
          ) : null}
          <div>
            <div className={styles.infoLabel}>{messages.seniorTransferSearchDeadlineLabel}</div>
            <div className={styles.infoValue}>
              {deadlineDate ? formatDateTime(deadlineDate) : messages.unknownShort}
            </div>
          </div>
          {result.sellerTeamName ? (
            <div>
              <div className={styles.infoLabel}>{messages.seniorTransferSearchSellerLabel}</div>
              <div className={styles.infoValue}>
                {result.sellerTeamId ? (
                  <a
                    className={styles.chroniclePressLink}
                    href={hattrickTeamUrl(result.sellerTeamId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {result.sellerTeamName}
                  </a>
                ) : (
                  result.sellerTeamName
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.sectionDivider} />

        <div className={styles.skillsGrid}>
          {[
            [messages.sortForm, resolvedForm, 1, 8],
            [messages.sortStamina, resolvedStamina, 1, 9],
          ].map(([label, value, min, max]) => {
            const normalizedValue = typeof value === "number" ? value : null;
            return (
              <div key={`${result.playerId}-${label}`} className={styles.skillRow}>
                <div className={styles.skillLabel}>{label}</div>
                <div className={styles.skillBar}>
                  {normalizedValue !== null ? (
                    <div
                      className={styles.skillFillCurrent}
                      style={{
                        width: `${Math.min(100, (normalizedValue / Number(max)) * 100)}%`,
                        background: transferSearchBarGradient(
                          normalizedValue,
                          Number(min),
                          Number(max)
                        ),
                      }}
                    />
                  ) : null}
                </div>
                <div className={styles.skillValue}>
                  <span className={styles.skillValuePartWithFlag}>
                    <span>{normalizedValue ?? messages.unknownShort}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.sectionDivider} />

        <div>
          <div className={styles.sectionHeadingRow}>
            <h5 className={styles.sectionHeading}>{messages.skillsLabel}</h5>
          </div>
          <div className={styles.skillsGrid}>
            {[
              ["KeeperSkill", result.keeperSkill],
              ["DefenderSkill", result.defenderSkill],
              ["PlaymakerSkill", result.playmakerSkill],
              ["WingerSkill", result.wingerSkill],
              ["PassingSkill", result.passingSkill],
              ["ScorerSkill", result.scorerSkill],
              ["SetPiecesSkill", result.setPiecesSkill],
            ].map(([skillKey, value]) => {
              const definition = TRANSFER_SEARCH_SKILLS.find((entry) => entry.key === skillKey);
              if (!definition) return null;
              const normalizedValue = typeof value === "number" ? value : null;
              const currentPct =
                normalizedValue !== null ? Math.min(100, (normalizedValue / 20) * 100) : null;
              return (
                <div key={`${result.playerId}-${skillKey}`} className={styles.skillRow}>
                  <div className={styles.skillLabel}>
                    {messages[definition.labelKey as keyof Messages]}
                  </div>
                  <div className={styles.skillBar}>
                    {currentPct !== null ? (
                      <div
                        className={styles.skillFillCurrent}
                        style={{
                          width: `${currentPct}%`,
                          background: transferSearchBarGradient(normalizedValue, 0, 20),
                        }}
                      />
                    ) : null}
                  </div>
                  <div className={styles.skillValue}>
                    <span className={styles.skillValuePartWithFlag}>
                      <span>{normalizedValue ?? messages.unknownShort}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.sectionDivider} />

        <SeniorFoxtrickMetrics input={seniorMetricInput} messages={messages} />

        <div className={styles.transferSearchBidGrid}>
          <div className={styles.transferSearchBidField}>
            <label className={styles.infoLabel} htmlFor={`youth-bid-${result.playerId}`}>
              {messages.seniorTransferSearchBidAmountLabel}
            </label>
            <input
              id={`youth-bid-${result.playerId}`}
              className={styles.transferSearchInput}
              type="number"
              min="0"
              step="1"
              value={draft.bidEur}
              onChange={(event) =>
                updateTransferSearchBidDraft(result.playerId, "bidEur", event.target.value)
              }
              disabled={!transferSearchCanBid || pending}
            />
          </div>
          <Tooltip
            content={messages.seniorTransferSearchSupporterOnlyTooltip}
            disabled={transferSearchCanBid}
          >
            <button
              type="button"
              className={`${styles.confirmSubmit} ${styles.transferSearchBidAction}`}
              onClick={() => {
                void submitTransferBid(result, "bidEur");
              }}
              disabled={!transferSearchCanBid || pending}
            >
              {messages.seniorTransferSearchPlaceBidButton}
            </button>
          </Tooltip>
          <div className={styles.transferSearchBidField}>
            <label className={styles.infoLabel} htmlFor={`youth-max-bid-${result.playerId}`}>
              {messages.seniorTransferSearchMaxBidAmountLabel}
            </label>
            <input
              id={`youth-max-bid-${result.playerId}`}
              className={styles.transferSearchInput}
              type="number"
              min="0"
              step="1"
              value={draft.maxBidEur}
              onChange={(event) =>
                updateTransferSearchBidDraft(result.playerId, "maxBidEur", event.target.value)
              }
              disabled={!transferSearchCanBid || pending}
            />
          </div>
          <Tooltip
            content={messages.seniorTransferSearchSupporterOnlyTooltip}
            disabled={transferSearchCanBid}
          >
            <button
              type="button"
              className={`${styles.confirmSubmit} ${styles.transferSearchBidAction}`}
              onClick={() => {
                void submitTransferBid(result, "maxBidEur");
              }}
              disabled={!transferSearchCanBid || pending}
            >
              {messages.seniorTransferSearchPlaceMaxBidButton}
            </button>
          </Tooltip>
        </div>
      </article>
    );
  }, [
    formatEurFromSek,
    messages,
    specialtyName,
    submitTransferBid,
    transferSearchBidDrafts,
    transferSearchCanBid,
    transferSearchBidPendingPlayerId,
    transferSearchDetailsById,
    updateTransferSearchBidDraft,
  ]);

  const handleSelect = async (playerId: number) => {
    setActiveDetailsTab("details");
    setSelectedId(playerId);
    await loadDetails(playerId);
  };

  const handleMobilePlayerSelect = (playerId: number) => {
    pushMobileYouthState("playerDetails", "detail");
    void handleSelect(playerId);
  };

  const refreshRatingsMatrixFromServer = async (teamIdOverride?: number | null) => {
    const youthTeamId =
      typeof teamIdOverride === "number" ? teamIdOverride : resolvedYouthTeamId;
    const teamId = youthTeamId;
    const ratingsParam = teamId ? `?teamID=${teamId}` : "";
    const { response, payload } = await fetchChppJson<
      RatingsMatrixResponse & { error?: string }
    >(`/api/chpp/youth/ratings${ratingsParam}`, {
      cache: "no-store",
    });
    if (!response.ok || payload?.error) return false;
    const positions =
      Array.isArray(payload?.positions) && payload.positions.length > 0
        ? payload.positions
        : POSITION_COLUMNS;
    const players = Array.isArray(payload?.players) ? payload.players : [];
    setRatingsResponseState({
      positions,
      players,
      matchesAnalyzed:
        typeof payload?.matchesAnalyzed === "number"
          ? payload.matchesAnalyzed
          : undefined,
    });
    return true;
  };

  const handlePlayerDetailsRefresh = async () => {
    if (!selectedId) return;
    await loadDetails(selectedId, true);
    await refreshRatingsMatrixFromServer();
  };

  const assignPlayer = (slotId: string, playerId: number) => {
    const clearedSlots = Object.entries(assignments)
      .filter(([, value]) => value === playerId)
      .map(([key]) => key);
    setAssignments((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(next)) {
        if (value === playerId) {
          next[key] = null;
        }
      }
      next[slotId] = playerId;
      return next;
    });
    setBehaviors((prev) => {
      const next = { ...prev };
      clearedSlots.forEach((slot) => {
        delete next[slot];
      });
      delete next[slotId];
      return next;
    });
    setLoadedMatchId(null);
  };

  const clearSlot = (slotId: string) => {
    setAssignments((prev) => ({ ...prev, [slotId]: null }));
    setBehaviors((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
    setLoadedMatchId(null);
  };

  const moveSlot = (fromSlot: string, toSlot: string) => {
    if (fromSlot === toSlot) return;
    setAssignments((prev) => {
      const next = { ...prev };
      const movingPlayer = next[fromSlot];
      if (!movingPlayer) return prev;
      const targetPlayer = next[toSlot] ?? null;
      next[toSlot] = movingPlayer;
      next[fromSlot] = targetPlayer;
      return next;
    });
    setBehaviors((prev) => {
      const next = { ...prev };
      delete next[fromSlot];
      delete next[toSlot];
      return next;
    });
    setLoadedMatchId(null);
  };

  const randomizeLineup = () => {
    if (!playerList.length) return;
    const outfieldSlots = [
      "WB_R",
      "CD_R",
      "CD_C",
      "CD_L",
      "WB_L",
      "W_R",
      "IM_R",
      "IM_C",
      "IM_L",
      "W_L",
      "F_R",
      "F_C",
      "F_L",
    ];
    const ids = playerList.map((player) => player.YouthPlayerID);
    const shuffledIds = [...ids].sort(() => Math.random() - 0.5);
    const keeperId = shuffledIds.shift() ?? null;
    const outfieldIds = shuffledIds.slice(0, 10);
    const shuffledSlots = [...outfieldSlots].sort(() => Math.random() - 0.5);

    const next: LineupAssignments = {
      KP: keeperId,
    };
    shuffledSlots.slice(0, outfieldIds.length).forEach((slot, index) => {
      next[slot] = outfieldIds[index] ?? null;
    });
    setAssignments(next);
    setBehaviors({});
    setLoadedMatchId(null);
    addNotification(messages.notificationLineupRandomized);
  };

  const resetLineup = () => {
    setAssignments({});
    setBehaviors({});
    setLoadedMatchId(null);
    addNotification(messages.notificationLineupReset);
  };

  const handleOptimize = () => {
    if (
      !starPlayerId ||
      !isTrainingSkill(primaryTraining) ||
      !isTrainingSkill(secondaryTraining)
    ) {
      setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentUnavailable);
      return;
    }
    if (!optimizerPlayers.some((player) => player.id === starPlayerId)) {
      setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentUnavailable);
      return;
    }

    const result = optimizeLineupForStar(
      optimizerPlayers,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelectionApplied,
      trainingPreferences
    );

    const nextAssignments: LineupAssignments = sanitizeLineupAssignments(result.lineup);
    const usedPlayers = new Set<number>(
      Object.values(nextAssignments).filter(Boolean) as number[]
    );
    const rankingBySkill = new Map<SkillKey, number[]>();
    BASE_TRAINING_SKILLS.forEach(
      (skill) => {
        rankingBySkill.set(
          skill,
          buildSkillRanking(optimizerPlayers, skill, trainingPreferences).ordered.map(
            (entry) => entry.playerId
          )
        );
      }
    );

    const pickNextFrom = (list: number[] | undefined) => {
      if (!list) return null;
      for (const playerId of list) {
        if (!usedPlayers.has(playerId)) {
          usedPlayers.add(playerId);
          return playerId;
        }
      }
      return null;
    };

    const benchSlots: Array<{ id: string; skill?: SkillKey }> = [
      { id: "B_GK", skill: "keeper" },
      { id: "B_CD", skill: "defending" },
      { id: "B_WB", skill: "defending" },
      { id: "B_IM", skill: "playmaking" },
      { id: "B_F", skill: "scoring" },
      { id: "B_W", skill: "winger" },
    ];

    benchSlots.forEach((slot) => {
      const nextId = pickNextFrom(
        slot.skill ? rankingBySkill.get(slot.skill) : undefined
      );
      nextAssignments[slot.id] = nextId ?? null;
    });

    const combinedExtra: number[] = [];
    const pushUnique = (id: number) => {
      if (!combinedExtra.includes(id)) combinedExtra.push(id);
    };
    if (isTrainingSkill(primaryTraining)) {
      rankingBySkill.get(toBaseTrainingSkill(primaryTraining))?.forEach(pushUnique);
    }
    if (isTrainingSkill(secondaryTraining)) {
      rankingBySkill
        .get(toBaseTrainingSkill(secondaryTraining))
        ?.forEach(pushUnique);
    }
    optimizerPlayers.forEach((player) => pushUnique(player.id));
    const extraId = pickNextFrom(combinedExtra);
    nextAssignments.B_X = extraId ?? null;

    setAssignments(nextAssignments);
    setBehaviors({});
    setOptimizerDebug(result.debug ?? null);
    setLoadedMatchId(null);
    if (Object.keys(result.lineup).length) {
      addNotification(messages.notificationOptimizeApplied);
    }
  };

  const handleOptimizeSelect = (mode: OptimizeMode) => {
    if (mode === "star") {
      handleOptimize();
      return;
    }
    if (mode === "ratings") {
      if (
        !starPlayerId ||
        !isTrainingSkill(primaryTraining) ||
        !isTrainingSkill(secondaryTraining)
      ) {
        setOptimizeErrorMessage(messages.optimizeRatingsUnavailable);
        return;
      }
      if (!optimizerPlayers.some((player) => player.id === starPlayerId)) {
        setOptimizeErrorMessage(messages.optimizeRatingsUnavailable);
        return;
      }

      const result = optimizeByRatings(
        optimizerPlayers,
        ratingsCache,
        starPlayerId,
        toBaseTrainingSkill(primaryTraining),
        toBaseTrainingSkill(secondaryTraining),
        autoSelectionApplied,
        trainingPreferences
      );

      if (result.error === "star_maxed") {
        setOptimizeErrorMessage(messages.optimizeRatingsStarMaxed);
        return;
      }

      if (result.error) {
        setOptimizeErrorMessage(messages.optimizeRatingsUnavailable);
        return;
      }

      const nextAssignments: LineupAssignments = sanitizeLineupAssignments(result.lineup);
      const usedPlayers = new Set<number>(
        Object.values(nextAssignments).filter(Boolean) as number[]
      );
      const ROLE_RATING_CODE: Record<
        "GK" | "WB" | "DEF" | "W" | "IM" | "F",
        number
      > = {
        GK: 100,
        WB: 101,
        DEF: 103,
        W: 106,
        IM: 107,
        F: 111,
      };

      const ratingForRole = (playerId: number, role: keyof typeof ROLE_RATING_CODE) => {
        const value = ratingsCache?.[playerId]?.[String(ROLE_RATING_CODE[role])];
        return typeof value === "number" ? value : null;
      };

      const pickBestByRole = (role: keyof typeof ROLE_RATING_CODE) => {
        const candidates = optimizerPlayers.filter(
          (player) => !usedPlayers.has(player.id)
        );
        candidates.sort((a, b) => {
          const aRating = ratingForRole(a.id, role);
          const bRating = ratingForRole(b.id, role);
          if (aRating === null && bRating === null) return 0;
          if (aRating === null) return 1;
          if (bRating === null) return -1;
          return bRating - aRating;
        });
        return candidates[0]?.id ?? null;
      };

      const pickBestOverall = () => {
        const candidates = optimizerPlayers.filter(
          (player) => !usedPlayers.has(player.id)
        );
        candidates.sort((a, b) => {
          const aBest =
            Math.max(
              ratingForRole(a.id, "GK") ?? 0,
              ratingForRole(a.id, "WB") ?? 0,
              ratingForRole(a.id, "DEF") ?? 0,
              ratingForRole(a.id, "W") ?? 0,
              ratingForRole(a.id, "IM") ?? 0,
              ratingForRole(a.id, "F") ?? 0
            ) || 0;
          const bBest =
            Math.max(
              ratingForRole(b.id, "GK") ?? 0,
              ratingForRole(b.id, "WB") ?? 0,
              ratingForRole(b.id, "DEF") ?? 0,
              ratingForRole(b.id, "W") ?? 0,
              ratingForRole(b.id, "IM") ?? 0,
              ratingForRole(b.id, "F") ?? 0
            ) || 0;
          return bBest - aBest;
        });
        return candidates[0]?.id ?? null;
      };

      const benchOrder = [
        { id: "B_GK", role: "GK" as const },
        { id: "B_CD", role: "DEF" as const },
        { id: "B_WB", role: "WB" as const },
        { id: "B_IM", role: "IM" as const },
        { id: "B_F", role: "F" as const },
        { id: "B_W", role: "W" as const },
        { id: "B_X", role: "EX" as const },
      ];

      benchOrder.forEach((slot) => {
        if (nextAssignments[slot.id]) return;
        const nextId =
          slot.role === "EX" ? pickBestOverall() : pickBestByRole(slot.role);
        nextAssignments[slot.id] = nextId ?? null;
        if (nextId) usedPlayers.add(nextId);
      });

      setAssignments(nextAssignments);
      setBehaviors({});
      setOptimizerDebug(result.debug ?? null);
      setLoadedMatchId(null);
      if (Object.keys(result.lineup).length) {
        addNotification(messages.notificationOptimizeApplied);
      }
      return;
    }
    if (
      mode !== "revealPrimaryCurrent" &&
      mode !== "revealSecondaryMax" &&
      mode !== "revealPrimaryCurrentAndSecondaryMax"
    ) {
      return;
    }
    if (
      !starPlayerId ||
      !isTrainingSkill(primaryTraining) ||
      !isTrainingSkill(secondaryTraining)
    ) {
      if (mode === "revealSecondaryMax") {
        setOptimizeErrorMessage(messages.optimizeRevealSecondaryMaxUnavailable);
      } else if (mode === "revealPrimaryCurrentAndSecondaryMax") {
        setOptimizeErrorMessage(
          messages.optimizeRevealPrimaryCurrentAndSecondaryMaxUnavailable
        );
      } else {
        setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentUnavailable);
      }
      return;
    }
    if (
      mode === "revealPrimaryCurrentAndSecondaryMax" &&
      !revealSecondaryTargetPlayerId
    ) {
      setOptimizeErrorMessage(
        messages.optimizeRevealPrimaryCurrentAndSecondaryMaxUnavailable
      );
      return;
    }
    if (!optimizerPlayers.some((player) => player.id === starPlayerId)) {
      if (mode === "revealSecondaryMax") {
        setOptimizeErrorMessage(messages.optimizeRevealSecondaryMaxUnavailable);
      } else if (mode === "revealPrimaryCurrentAndSecondaryMax") {
        setOptimizeErrorMessage(
          messages.optimizeRevealPrimaryCurrentAndSecondaryMaxUnavailable
        );
      } else {
        setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentUnavailable);
      }
      return;
    }

    const result =
      mode === "revealSecondaryMax"
        ? optimizeRevealSecondaryMax(
            optimizerPlayers,
            starPlayerId,
            primaryTraining,
            secondaryTraining,
            autoSelectionApplied,
            trainingPreferences
          )
        : mode === "revealPrimaryCurrentAndSecondaryMax"
          ? optimizeRevealPrimaryCurrentAndSecondaryMax(
              optimizerPlayers,
              starPlayerId,
              revealSecondaryTargetPlayerId,
              primaryTraining,
              secondaryTraining,
              autoSelectionApplied,
              trainingPreferences
            )
        : optimizeRevealPrimaryCurrent(
            optimizerPlayers,
            starPlayerId,
            primaryTraining,
            secondaryTraining,
            autoSelectionApplied,
            trainingPreferences
          );

    if (result.error === "primary_current_known") {
      setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentKnown);
      return;
    }

    if (result.error === "secondary_max_known") {
      setOptimizeErrorMessage(messages.optimizeRevealSecondaryMaxKnown);
      return;
    }

    if (result.error) {
      if (mode === "revealSecondaryMax") {
        setOptimizeErrorMessage(messages.optimizeRevealSecondaryMaxUnavailable);
      } else if (mode === "revealPrimaryCurrentAndSecondaryMax") {
        setOptimizeErrorMessage(
          messages.optimizeRevealPrimaryCurrentAndSecondaryMaxUnavailable
        );
      } else {
        setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentUnavailable);
      }
      return;
    }

    const nextAssignments: LineupAssignments = sanitizeLineupAssignments(result.lineup);
    const usedPlayers = new Set<number>(
      Object.values(nextAssignments).filter(Boolean) as number[]
    );
    const rankingBySkill = new Map<SkillKey, number[]>();
    BASE_TRAINING_SKILLS.forEach((skill) => {
      rankingBySkill.set(
        skill,
        buildSkillRanking(optimizerPlayers, skill, trainingPreferences).ordered.map(
          (entry) => entry.playerId
        )
      );
    });

    const pickNextFrom = (list: number[] | undefined) => {
      if (!list) return null;
      for (const id of list) {
        if (!usedPlayers.has(id)) return id;
      }
      return null;
    };

    const benchOrder = [
      { id: "B_GK", skill: "keeper" as const },
      { id: "B_CD", skill: "defending" as const },
      { id: "B_WB", skill: "defending" as const },
      { id: "B_IM", skill: "playmaking" as const },
      { id: "B_F", skill: "scoring" as const },
      { id: "B_W", skill: "winger" as const },
      { id: "B_X", skill: toBaseTrainingSkill(primaryTraining) },
    ];

    benchOrder.forEach((slot) => {
      if (nextAssignments[slot.id]) return;
      const nextId = pickNextFrom(
        slot.skill ? rankingBySkill.get(slot.skill) : undefined
      );
      nextAssignments[slot.id] = nextId ?? null;
      if (nextId) usedPlayers.add(nextId);
    });

    setAssignments(nextAssignments);
    setBehaviors({});
    setOptimizerDebug(result.debug ?? null);
    setLoadedMatchId(null);
    if (Object.keys(result.lineup).length) {
      addNotification(messages.notificationOptimizeApplied);
    }
  };

  const normalizeArray = <T,>(input?: T | T[]) => {
    if (!input) return [];
    return Array.isArray(input) ? input : [input];
  };

  const formatStatusTemplate = (
    template: string,
    replacements: Record<string, string | number>
  ) => {
    return Object.entries(replacements).reduce(
      (result, [key, value]) =>
        result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
      template
    );
  };

  const fetchMatchesResponse = async (teamIdOverride?: number | null) => {
    const youthTeamId =
      typeof teamIdOverride === "number" ? teamIdOverride : resolvedYouthTeamId;
    const teamId = youthTeamId;
    try {
      const teamParam = teamId ? `&teamID=${teamId}` : "";
      const { response, payload } = await fetchChppJson<
        MatchesResponse & {
          code?: string;
          statusCode?: number;
          details?: string;
          error?: string;
        }
      >(`/api/chpp/matches?isYouth=true${teamParam}`, {
        cache: "no-store",
      });
      const typedPayload = payload as MatchesResponse & {
        code?: string;
        statusCode?: number;
        details?: string;
        error?: string;
      };
      if (!response.ok || typedPayload.error) {
        setServiceErrorModal({
          title: messages.unableToLoadMatches,
          details: typedPayload.details ?? typedPayload.error ?? null,
          statusCode:
            typeof typedPayload.statusCode === "number"
              ? typedPayload.statusCode
              : response.status,
        });
        return {
          ok: false,
          payload: typedPayload,
        };
      }
      return {
        ok: true,
        payload: typedPayload,
      };
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) {
        return {
          ok: false,
          payload: null,
        };
      }
      setServiceErrorModal({
        title: messages.unableToLoadMatches,
        details: null,
        statusCode: null,
      });
      // keep existing data
      return {
        ok: false,
        payload: null,
      };
    }
  };

  const refreshMatches = async (teamIdOverride?: number | null) => {
    const result = await fetchMatchesResponse(teamIdOverride);
    if (result.ok && result.payload) {
      setMatchesState(result.payload);
    }
    return result.ok;
  };

  const ensureRefreshScopes = async () => {
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
      return true;
    } catch {
      setScopeReconnectModalOpen(true);
      return false;
    }
  };

  const refreshMatchesWithScopeGuard = async (teamIdOverride?: number | null) => {
    const hasRequiredScopes = await ensureRefreshScopes();
    if (!hasRequiredScopes) return false;
    return refreshMatches(teamIdOverride);
  };

  const refreshRatings = async (
    teamIdOverride?: number | null,
    matchesPayload?: MatchesResponse | null,
    options?: {
      playersChanged?: boolean;
      playersOverride?: YouthPlayer[];
      forceTraversal?: boolean;
    }
  ): Promise<RefreshRatingsResult> => {
    const youthTeamId =
      typeof teamIdOverride === "number" ? teamIdOverride : resolvedYouthTeamId;
    const teamId = youthTeamId;
      const nextPlayers = options?.playersOverride ?? playerList;
    try {
      setYouthRefreshStatus(messages.refreshStatusFetchingMatches, 70);
      const formatArchiveDate = (date: Date) => date.toISOString().slice(0, 10);
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const firstDate = new Date(today.getTime() - 220 * 24 * 60 * 60 * 1000);
      const archiveParams = new URLSearchParams({
        isYouth: "true",
        FirstMatchDate: formatArchiveDate(firstDate),
        // Include today's completed matches (date-only CHPP window upper-bound).
        LastMatchDate: formatArchiveDate(tomorrow),
      });
      if (teamId) {
        archiveParams.set("teamId", String(teamId));
      }
      const { response: archiveResponse, payload: archivePayload } =
        await fetchChppJson<MatchesArchiveResponse>(
          `/api/chpp/matchesarchive?${archiveParams.toString()}`,
          { cache: "no-store" }
        );
      if (!archiveResponse.ok || archivePayload?.error) {
        setRatingsResponseState(null);
        return {
          ok: false,
          ratingsByPlayerId: null,
          positions: null,
          hiddenSpecialtyScanOk: false,
          discoveredHiddenSpecialtyByPlayerId: {},
          hiddenSpecialtyDiscoveredMatchByPlayerId: {},
        };
      }

      setYouthRefreshStatus(messages.refreshStatusFetchingRatings, 78);

      const archiveTeam = archivePayload?.data?.HattrickData?.Team;
      const teamIdValue = Number(
        archiveTeam?.TeamID ??
          matchesPayload?.data?.HattrickData?.Team?.TeamID ??
          teamId ??
          0
      );
      const allFinishedMatches = normalizeArray<MatchSummary>(
        archiveTeam?.MatchList?.Match
      )
        .map((match) => ({
          ...match,
          _date: parseChppDate(match.MatchDate)?.getTime() ?? 0,
          _matchId: Number(match.MatchID),
          _sourceSystem:
            typeof match.SourceSystem === "string" && match.SourceSystem
              ? match.SourceSystem
              : "youth",
        }))
        .filter((match) => Number.isFinite(match._matchId))
        .sort((a, b) => b._date - a._date);
      const finishedMatches = allFinishedMatches.slice(0, 50);

      const ratingsParam = teamId ? `?teamID=${teamId}` : "";
      const { response: ratingsResponse, payload: ratingsPayload } =
        await fetchChppJson<
          RatingsMatrixResponse & { error?: string; details?: string }
        >(`/api/chpp/youth/ratings${ratingsParam}`, {
          cache: "no-store",
        });
      if (!ratingsResponse.ok || ratingsPayload?.error) {
        setRatingsResponseState(null);
        return {
          ok: false,
          ratingsByPlayerId: null,
          positions: null,
          hiddenSpecialtyScanOk: false,
          discoveredHiddenSpecialtyByPlayerId: {},
          hiddenSpecialtyDiscoveredMatchByPlayerId: {},
        };
      }
      const ratingsPositions =
        Array.isArray(ratingsPayload?.positions) && ratingsPayload.positions.length > 0
          ? ratingsPayload.positions
          : POSITION_COLUMNS;
      const ratingsPlayers = Array.isArray(ratingsPayload?.players)
        ? ratingsPayload.players
        : [];
      setRatingsResponseState({
        positions: ratingsPositions,
        players: ratingsPlayers,
        matchesAnalyzed:
          typeof ratingsPayload?.matchesAnalyzed === "number"
            ? ratingsPayload.matchesAnalyzed
            : undefined,
      });
      const ratingsById = new Map<number, Record<string, number>>(
        ratingsPlayers.map((entry) => [entry.id, entry.ratings ?? {}])
      );
      const ratingsByPlayerId = nextPlayers.reduce<
        Record<number, Record<string, number>>
      >((acc, player) => {
        const playerId = player.YouthPlayerID;
        if (ratingsById.has(playerId)) {
          acc[playerId] = cloneRatingsRecord(ratingsById.get(playerId));
        } else {
          acc[playerId] = cloneRatingsRecord(ratingsCache[playerId]);
        }
        return acc;
      }, {});
      // Immediately hydrate matrix source state from latest fetched ratings.
      setRatingsPositions(ratingsPositions);
      setRatingsCache(ratingsByPlayerId);
      const analyzedRatingsMatchIdsSet = new Set(analyzedRatingsMatchIds);
      const matchesNeedingRatingsTraversal = finishedMatches.filter(
        (match) => !analyzedRatingsMatchIdsSet.has(match._matchId)
      );
      const shouldTraverseRatings =
        Boolean(options?.forceTraversal) ||
        Boolean(options?.playersChanged) ||
        matchesNeedingRatingsTraversal.length > 0;

      if (!teamIdValue || finishedMatches.length === 0) {
        // Keep the freshly fetched ratings payload; skip only traversal-dependent steps.
        return {
          ok: true,
          ratingsByPlayerId,
          positions: ratingsPositions,
          hiddenSpecialtyScanOk: true,
          discoveredHiddenSpecialtyByPlayerId: {},
          hiddenSpecialtyDiscoveredMatchByPlayerId: {},
        };
      }

      if (!shouldTraverseRatings) {
        return {
          ok: true,
          ratingsByPlayerId,
          positions: ratingsPositions,
          hiddenSpecialtyScanOk: true,
          discoveredHiddenSpecialtyByPlayerId: {},
          hiddenSpecialtyDiscoveredMatchByPlayerId: {},
        };
      }

      let hiddenSpecialtyScanOk = true;
      const matchPlayerIdsByMatch = new Map<number, Set<number>>();
      const ratingsTraversedMatchIds = new Set<number>();

      let lineupCompleted = 0;
      const lineupResults = await mapWithConcurrency(
        finishedMatches,
        YOUTH_REFRESH_CONCURRENCY,
        async (match) => {
          try {
            const { response, payload } = await fetchChppJson<MatchLineupResponse>(
              `/api/chpp/youth/match-lineup?matchId=${match._matchId}&teamId=${teamIdValue}&sourceSystem=youth`,
              { cache: "no-store" }
            );
            if (!response.ok || payload?.error) {
              return {
                matchId: match._matchId,
                traversed: false,
                lineupPlayers: [] as MatchLineupPlayer[],
              };
            }
            return {
              matchId: match._matchId,
              traversed: true,
              lineupPlayers: normalizeArray<MatchLineupPlayer>(
                payload?.data?.HattrickData?.Team?.Lineup?.Player
              ),
            };
          } finally {
            lineupCompleted += 1;
            const lineupRatio =
              finishedMatches.length > 0
                ? lineupCompleted / finishedMatches.length
                : 1;
            setYouthRefreshStatus(
              formatStatusTemplate(messages.refreshStatusFetchingPastMatchesProgress, {
                completed: lineupCompleted,
                total: finishedMatches.length,
              }),
              Math.round(78 + lineupRatio * 10)
            );
          }
        }
      );

      lineupResults.forEach((result) => {
        const matchPlayers = new Set<number>();
        result.lineupPlayers.forEach((player) => {
          const roleId = Number(player.RoleID);
          const column = normalizeMatchRoleId(roleId);
          if (!column) return;
          const rating = Number(player.RatingStars);
          if (Number.isNaN(rating)) return;
          const playerId = Number(player.PlayerID);
          if (Number.isNaN(playerId)) return;
          matchPlayers.add(playerId);
        });
        // Only consider a match analyzed when it yielded at least one usable rating.
        if (result.traversed && matchPlayers.size > 0) {
          ratingsTraversedMatchIds.add(result.matchId);
        }
        matchPlayerIdsByMatch.set(result.matchId, matchPlayers);
      });

      if (ratingsTraversedMatchIds.size > 0) {
        setAnalyzedRatingsMatchIds((prev) => {
          const merged = new Set<number>(prev);
          ratingsTraversedMatchIds.forEach((matchId) => merged.add(matchId));
          return Array.from(merged.values()).sort((a, b) => b - a);
        });
      }

      try {
        setYouthRefreshStatus(messages.refreshStatusFetchingHiddenSpecialties, 89);
        const knownSpecialties = new Map<number, number>();
        nextPlayers.forEach((player) => {
          const specialty = Number(player.Specialty ?? 0);
          if (Number.isFinite(specialty) && specialty > 0) {
            knownSpecialties.set(player.YouthPlayerID, specialty);
          }
        });
        playerDetailsById.forEach((detailsNode, playerId) => {
          const specialty = Number(detailsNode.Specialty ?? 0);
          if (Number.isFinite(specialty) && specialty > 0) {
            knownSpecialties.set(playerId, specialty);
          }
        });
        const youthPlayerIds = new Set(
          nextPlayers.map((player) => player.YouthPlayerID)
        );
        const discoveredThisRefresh: Record<number, number> = {};
        const discoveryMatchByPlayerIdThisRefresh: Record<number, number> = {};
        const matchesToAnalyze = allFinishedMatches;

        let hiddenCompleted = 0;
        const hiddenResults = await mapWithConcurrency(
          matchesToAnalyze,
          YOUTH_REFRESH_CONCURRENCY,
          async (match) => {
            try {
              const { response, payload } =
                await fetchChppJson<MatchDetailsEventsResponse>(
                  `/api/chpp/matchdetails?matchId=${match._matchId}&sourceSystem=${encodeURIComponent(
                    "youth"
                  )}&matchEvents=true`,
                  { cache: "no-store" }
                );
              if (!response.ok || payload?.error) {
                return {
                  matchId: match._matchId,
                  analyzed: false,
                  candidates: [] as Array<{ playerId: number; specialty: number }>,
                };
              }
              const events = normalizeArray<MatchDetailsEvent>(
                payload?.data?.HattrickData?.Match?.EventList?.Event
              );
              const candidates: Array<{ playerId: number; specialty: number }> = [];
              for (const event of events) {
                const eventTypeId = Number(event.EventTypeID);
                const rule = SPECIAL_EVENT_SPECIALTY_RULES[eventTypeId];
                if (!rule) continue;
                const candidateIds = rule.players.map((ref) =>
                  Number(
                    ref === "subject" ? event.SubjectPlayerID : event.ObjectPlayerID
                  )
                );
                candidateIds.forEach((candidateId) => {
                  if (!Number.isFinite(candidateId) || candidateId <= 0) return;
                  if (!youthPlayerIds.has(candidateId)) return;
                  candidates.push({
                    playerId: candidateId,
                    specialty: rule.specialty,
                  });
                });
              }
              return {
                matchId: match._matchId,
                analyzed: true,
                candidates,
              };
            } catch {
              return {
                matchId: match._matchId,
                analyzed: false,
                candidates: [] as Array<{ playerId: number; specialty: number }>,
              };
            } finally {
              hiddenCompleted += 1;
              const hiddenRatio =
                matchesToAnalyze.length > 0
                  ? hiddenCompleted / matchesToAnalyze.length
                  : 1;
              setYouthRefreshStatus(
                formatStatusTemplate(
                  messages.refreshStatusFetchingHiddenSpecialtiesProgress,
                  {
                    completed: hiddenCompleted,
                    total: matchesToAnalyze.length,
                  }
                ),
                Math.round(89 + hiddenRatio * 10)
              );
            }
          }
        );

        hiddenResults.forEach((result) => {
          if (!result.analyzed) return;
          result.candidates.forEach((candidate) => {
            const known = knownSpecialties.get(candidate.playerId);
            if (!(known && known > 0)) {
              knownSpecialties.set(candidate.playerId, candidate.specialty);
              discoveredThisRefresh[candidate.playerId] = candidate.specialty;
            }
            if (
              !Object.prototype.hasOwnProperty.call(
                discoveryMatchByPlayerIdThisRefresh,
                candidate.playerId
              )
            ) {
              discoveryMatchByPlayerIdThisRefresh[candidate.playerId] =
                result.matchId;
            }
          });
        });

        setHiddenSpecialtyByPlayerId(discoveredThisRefresh);
        setHiddenSpecialtyDiscoveredMatchByPlayerId(
          discoveryMatchByPlayerIdThisRefresh
        );
        return {
          ok: true,
          ratingsByPlayerId,
          positions: ratingsPositions,
          hiddenSpecialtyScanOk,
          discoveredHiddenSpecialtyByPlayerId: discoveredThisRefresh,
          hiddenSpecialtyDiscoveredMatchByPlayerId:
            discoveryMatchByPlayerIdThisRefresh,
        };
      } catch {
        // Keep refreshed ratings even if hidden-specialty enrichment fails.
        hiddenSpecialtyScanOk = false;
        return {
          ok: true,
          ratingsByPlayerId,
          positions: ratingsPositions,
          hiddenSpecialtyScanOk,
          discoveredHiddenSpecialtyByPlayerId: {},
          hiddenSpecialtyDiscoveredMatchByPlayerId: {},
        };
      }
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) {
        return {
          ok: false,
          ratingsByPlayerId: null,
          positions: null,
          hiddenSpecialtyScanOk: false,
          discoveredHiddenSpecialtyByPlayerId: {},
          hiddenSpecialtyDiscoveredMatchByPlayerId: {},
        };
      }
      setRatingsResponseState(null);
      return {
        ok: false,
        ratingsByPlayerId: null,
        positions: null,
        hiddenSpecialtyScanOk: false,
        discoveredHiddenSpecialtyByPlayerId: {},
        hiddenSpecialtyDiscoveredMatchByPlayerId: {},
      };
    }
  };

  const refreshPlayers = async (
    teamIdOverride?: number | null,
    options?: {
      refreshAll?: boolean;
      reason?: "stale" | "manual";
      recordRefresh?: boolean;
    }
  ) => {
    if (playersLoading) return;
    const refreshRunId = ++refreshRunSeqRef.current;
    activeRefreshRunIdRef.current = refreshRunId;
    stoppedRefreshRunIdsRef.current.delete(refreshRunId);
    const isRunStopped = () =>
      stoppedRefreshRunIdsRef.current.has(refreshRunId) ||
      activeRefreshRunIdRef.current !== refreshRunId;
    const snapshot = {
      playerList,
      loadError,
      loadErrorDetails,
      selectedId,
      details,
      error,
      serviceErrorModal,
      matchesState,
      ratingsResponseState,
      ratingsCache,
      ratingsPositions,
      hiddenSpecialtyByPlayerId,
      hiddenSpecialtyDiscoveredMatchByPlayerId,
      analyzedRatingsMatchIds,
      matrixNewMarkers,
      youthUpdatesHistory,
      selectedYouthUpdatesId,
      lastGlobalRefreshAt,
    };
    setPlayersLoading(true);
    setYouthRefreshStatus(messages.refreshStatusFetchingPlayers, 8);
    const refreshAll = options?.refreshAll ?? false;
    const youthTeamId =
      typeof teamIdOverride === "number" || teamIdOverride === null
        ? teamIdOverride ?? resolvedYouthTeamId
        : resolvedYouthTeamId;
    const persistedMarkersBaseline = persistedMarkersBaselineRef.current;
    const usePersistedMarkersBaseline =
      Boolean(persistedMarkersBaseline) && refreshAll;
    const previousPlayersSnapshot =
      usePersistedMarkersBaseline && persistedMarkersBaseline
        ? persistedMarkersBaseline.players
        : playerList;
    const previousDetailsByIdSnapshot =
      usePersistedMarkersBaseline && persistedMarkersBaseline
        ? new Map<number, YouthPlayerDetails>(persistedMarkersBaseline.detailsById)
        : new Map<number, YouthPlayerDetails>(playerDetailsById);
    const previousRatingsBaselineSnapshot =
      usePersistedMarkersBaseline && persistedMarkersBaseline
        ? persistedMarkersBaseline.ratingsByPlayerId
        : buildRatingsBaselineByPlayerId({
            players: previousPlayersSnapshot,
            ratingsResponseState,
            ratingsCache,
          });
    const previousRatingsPositionsSnapshot =
      usePersistedMarkersBaseline &&
      persistedMarkersBaseline &&
      persistedMarkersBaseline.ratingsPositions.length > 0
        ? persistedMarkersBaseline.ratingsPositions
        : ratingsResponseState?.positions ?? ratingsPositions;
    const previousHiddenSpecialtyByPlayerIdSnapshot = {
      ...hiddenSpecialtyByPlayerId,
    };
    let playersUpdated = false;
    let playerIdsChanged = false;
    let nextSelectedId = selectedId;
    let nextSelectedDetails: Record<string, unknown> | null = null;
    let nextPlayersSnapshot: YouthPlayer[] = playerList;
    let detailRefreshFailureCount = 0;
    let detailRefreshTotal = 0;
    const nextDetailsByPlayerId = new Map<number, YouthPlayerDetails>(
      previousDetailsByIdSnapshot
    );
    let ratingsResult: RefreshRatingsResult = {
      ok: true,
      ratingsByPlayerId: null,
      positions: null,
      hiddenSpecialtyScanOk: true,
      discoveredHiddenSpecialtyByPlayerId: {},
      hiddenSpecialtyDiscoveredMatchByPlayerId: {},
    };
    try {
      const teamParam = youthTeamId ? `&youthTeamID=${youthTeamId}` : "";
      const { response, payload } = await fetchChppJson<{
        data?: {
          HattrickData?: {
            PlayerList?: { YouthPlayer?: YouthPlayer[] | YouthPlayer };
          };
        };
        error?: string;
        details?: string;
        statusCode?: number;
        code?: string;
      }>(
        `/api/chpp/youth/players?actionType=details${teamParam}`,
        {
          cache: "no-store",
        }
      );
      if (!response.ok || payload?.error) {
        const errorWithStatus = new Error(
          payload?.details ?? payload?.error ?? "Failed to fetch youth players"
        ) as Error & { statusCode?: number };
        errorWithStatus.statusCode =
          typeof payload?.statusCode === "number"
            ? payload.statusCode
            : response.status;
        throw errorWithStatus;
      }
      const raw = payload?.data?.HattrickData?.PlayerList?.YouthPlayer;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      nextPlayersSnapshot = list;
      const previousPlayerIds = new Set(
        playerList.map((player) => player.YouthPlayerID)
      );
      const nextPlayerIds = new Set(list.map((player) => player.YouthPlayerID));
      playerIdsChanged =
        previousPlayerIds.size !== nextPlayerIds.size ||
        Array.from(nextPlayerIds).some((id) => !previousPlayerIds.has(id));
      playersUpdated = true;
      if (
        selectedId &&
        !list.some((player) => player.YouthPlayerID === selectedId)
      ) {
        nextSelectedId = null;
      }
      if (refreshAll) {
        setYouthRefreshStatus(messages.refreshStatusFetchingPlayerDetails, 42);
        const ids = list.map((player) => player.YouthPlayerID);
        detailRefreshTotal = ids.length;
        const detailResponses = await mapWithConcurrency(
          ids,
          4,
          async (id) => refreshYouthPlayerDetailsForGlobalRefresh(id)
        );
        detailRefreshFailureCount = detailResponses.filter(
          (entry) => !entry.ok
        ).length;
        const resolvedDetailsEntries: Array<[number, CachedDetails]> = [];
        detailResponses.forEach(({ id, detailRaw, resolved }) => {
          if (detailRaw && resolved) {
            nextDetailsByPlayerId.set(id, resolved);
            resolvedDetailsEntries.push([
              id,
              {
                data: detailRaw as Record<string, unknown>,
                fetchedAt: Date.now(),
              },
            ]);
          }
        });
        if (resolvedDetailsEntries.length > 0) {
          setCache((prev) => ({
            ...prev,
            ...Object.fromEntries(resolvedDetailsEntries),
          }));
        }
        if (nextSelectedId) {
          const selectedRaw = detailResponses.find(
            (entry) => entry.id === nextSelectedId
          )?.detailRaw;
          if (selectedRaw) {
            nextSelectedDetails = selectedRaw;
          }
        }
      }
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
      if (isRunStopped()) return;
      const details =
        error instanceof Error && error.message
          ? error.message
          : messages.unableToLoadPlayers;
      addNotification(messages.unableToLoadPlayers);
      setServiceErrorModal({
        title: messages.unableToLoadPlayers,
        details,
        statusCode:
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode) || null
            : null,
      });
    } finally {
      let matchesOk = true;
      let ratingsOk = true;
      let nextMatchesState = matchesState;
      if (refreshAll && !isRunStopped()) {
        setYouthRefreshStatus(messages.refreshStatusFetchingMatches, 60);
        const matchesResult = await fetchMatchesResponse(youthTeamId);
        if (matchesResult.ok && matchesResult.payload) {
          nextMatchesState = matchesResult.payload;
        }
        matchesOk = matchesResult.ok;
        ratingsResult = await refreshRatings(youthTeamId, matchesResult.payload ?? null, {
          forceTraversal: true,
          playersChanged: playerIdsChanged,
          playersOverride: nextPlayersSnapshot,
        });
        ratingsOk = ratingsResult.ok;
      }
      if (
        activeRefreshRunIdRef.current === refreshRunId &&
        isRunStopped()
      ) {
        setPlayerList(snapshot.playerList);
        setLoadError(snapshot.loadError);
        setLoadErrorDetails(snapshot.loadErrorDetails);
        setSelectedId(snapshot.selectedId);
        setDetails(snapshot.details);
        setError(snapshot.error);
        setServiceErrorModal(snapshot.serviceErrorModal);
        setMatchesState(snapshot.matchesState);
        setRatingsResponseState(snapshot.ratingsResponseState);
        setRatingsCache(snapshot.ratingsCache);
        setRatingsPositions(snapshot.ratingsPositions);
        setHiddenSpecialtyByPlayerId(snapshot.hiddenSpecialtyByPlayerId);
        setHiddenSpecialtyDiscoveredMatchByPlayerId(
          snapshot.hiddenSpecialtyDiscoveredMatchByPlayerId
        );
        setAnalyzedRatingsMatchIds(snapshot.analyzedRatingsMatchIds);
        setMatrixNewMarkers(snapshot.matrixNewMarkers);
        setYouthUpdatesHistory(snapshot.youthUpdatesHistory);
        setSelectedYouthUpdatesId(snapshot.selectedYouthUpdatesId);
        setLastGlobalRefreshAt(snapshot.lastGlobalRefreshAt);
        setPlayerRefreshStatus(null);
        setPlayerRefreshProgressPct(0);
      }
      if (activeRefreshRunIdRef.current !== refreshRunId || isRunStopped()) {
        stoppedRefreshRunIdsRef.current.delete(refreshRunId);
        if (activeRefreshRunIdRef.current === refreshRunId) {
          activeRefreshRunIdRef.current = null;
        }
        return;
      }
      if (playersUpdated) {
        setPlayerList(nextPlayersSnapshot);
        setLoadError(null);
        setLoadErrorDetails(null);
        setSelectedId(nextSelectedId);
        if (nextSelectedDetails) {
          setDetails(nextSelectedDetails);
          setError(null);
        }
      }
      if (refreshAll) {
        setMatchesState(nextMatchesState);
      }
      if (playersUpdated && refreshAll) {
        const nextMarkers = buildEmptyMatrixNewMarkers();
        const previousPlayersById = new Map(
          previousPlayersSnapshot.map((player) => [player.YouthPlayerID, player])
        );
        const nextRatingsByPlayerId =
          ratingsResult.ratingsByPlayerId ??
          nextPlayersSnapshot.reduce<Record<number, Record<string, number>>>(
            (acc, player) => {
              acc[player.YouthPlayerID] = {
                ...(previousRatingsBaselineSnapshot[player.YouthPlayerID] ?? {}),
              };
              return acc;
            },
            {}
          );
        const positionsToCompare = Array.from(
          new Set<number>([
            ...POSITION_COLUMNS,
            ...previousRatingsPositionsSnapshot,
            ...(ratingsResult.positions ?? []),
          ])
        );
        const addSkillMarker = (
          target: Record<number, string[]>,
          playerId: number,
          skillKey: string
        ) => {
          const existing = target[playerId] ?? [];
          if (existing.includes(skillKey)) return;
          target[playerId] = [...existing, skillKey];
        };
        const addRatingMarker = (playerId: number, position: number) => {
          const existing = nextMarkers.ratingsByPlayerId[playerId] ?? [];
          if (existing.includes(position)) return;
          nextMarkers.ratingsByPlayerId[playerId] = [...existing, position];
        };
        const previousSkillsByPlayerId = new Map<
          number,
          Record<string, SkillValue | number | string> | null
        >();
        const currentSkillsByPlayerId = new Map<
          number,
          Record<string, SkillValue | number | string> | null
        >();
        const attributeChangesByPlayerId: Record<number, YouthAttributeChange[]> = {};
        const addAttributeChange = (
          playerId: number,
          change: YouthAttributeChange
        ) => {
          const existing = attributeChangesByPlayerId[playerId] ?? [];
          attributeChangesByPlayerId[playerId] = [...existing, change];
        };

        nextPlayersSnapshot.forEach((player) => {
          const playerId = player.YouthPlayerID;
          const previousPlayer = previousPlayersById.get(playerId) ?? null;
          if (!previousPlayer) {
            nextMarkers.playerIds.push(playerId);
          }
          const previousMerged = mergedSkills(
            previousDetailsByIdSnapshot.get(playerId)?.PlayerSkills,
            previousPlayer?.PlayerSkills
          );
          const nextMerged = mergedSkills(
            nextDetailsByPlayerId.get(playerId)?.PlayerSkills,
            player.PlayerSkills
          );
          previousSkillsByPlayerId.set(playerId, previousMerged);
          currentSkillsByPlayerId.set(playerId, nextMerged);

          TRAINING_SKILLS.forEach((trainingSkill) => {
            const keys = TRAINING_SKILL_VALUE_KEYS[trainingSkill];
            const previousCurrent = getKnownSkillValue(previousMerged?.[keys.current]);
            const nextCurrent = getKnownSkillValue(nextMerged?.[keys.current]);
            if (
              nextCurrent !== null &&
              (previousCurrent === null || previousCurrent !== nextCurrent)
            ) {
              addSkillMarker(nextMarkers.skillsCurrentByPlayerId, playerId, keys.current);
            }

            const previousMax = getKnownSkillValue(previousMerged?.[keys.max]);
            const nextMax = getKnownSkillValue(nextMerged?.[keys.max]);
            if (nextMax !== null && (previousMax === null || previousMax !== nextMax)) {
              addSkillMarker(nextMarkers.skillsMaxByPlayerId, playerId, keys.current);
            }
          });

          const previousRatings = previousRatingsBaselineSnapshot[playerId] ?? {};
          const nextRatings = nextRatingsByPlayerId[playerId] ?? {};
          positionsToCompare.forEach((position) => {
            const previousValueRaw = previousRatings[String(position)];
            const nextValueRaw = nextRatings[String(position)];
            const previousValue =
              typeof previousValueRaw === "number" ? previousValueRaw : null;
            const nextValue = typeof nextValueRaw === "number" ? nextValueRaw : null;
            if (nextValue !== null && (previousValue === null || previousValue !== nextValue)) {
              addRatingMarker(playerId, position);
            }
          });

          const previousInjury = normalizeInjuryLevel(
            previousDetailsByIdSnapshot.get(playerId)?.InjuryLevel ??
              previousPlayer?.InjuryLevel
          );
          const nextInjury = normalizeInjuryLevel(
            nextDetailsByPlayerId.get(playerId)?.InjuryLevel ?? player.InjuryLevel
          );
          if (nextInjury !== null && previousInjury !== nextInjury) {
            addAttributeChange(playerId, {
              key: "injuryStatus",
              previous: previousInjury,
              current: nextInjury,
            });
          }
        });

        Object.entries(ratingsResult.discoveredHiddenSpecialtyByPlayerId).forEach(
          ([playerId, specialty]) => {
            const numericPlayerId = Number(playerId);
            if (!Number.isFinite(numericPlayerId) || numericPlayerId <= 0) return;
            const previousHidden = Number(
              previousHiddenSpecialtyByPlayerIdSnapshot[numericPlayerId] ?? 0
            );
            const nextHidden = Number(specialty ?? 0);
            if (nextHidden > 0 && previousHidden !== nextHidden) {
              addAttributeChange(numericPlayerId, {
                key: "hiddenSpecialtyDiscovered",
                previous: previousHidden > 0 ? previousHidden : null,
                current: nextHidden,
              });
            }
          }
        );

        const comparedAt = Date.now();
        const updatesEntry = buildYouthUpdatesHistoryEntry(
          nextMarkers,
          nextPlayersSnapshot,
          comparedAt,
          "refresh",
          {
            previousRatingsByPlayerId: previousRatingsBaselineSnapshot,
            currentRatingsByPlayerId: nextRatingsByPlayerId,
            previousSkillsByPlayerId,
            currentSkillsByPlayerId,
            attributeChangesByPlayerId,
          }
        );
        if (suppressNextUpdatesRecordingRef.current) {
          suppressNextUpdatesRecordingRef.current = false;
          setMatrixNewMarkers(buildEmptyMatrixNewMarkers());
          setYouthUpdatesHistory([]);
          setSelectedYouthUpdatesId(null);
        } else if (updatesEntry.hasChanges) {
          setMatrixNewMarkers(
            hasAnyMatrixNewMarkers(nextMarkers)
              ? {
                  ...nextMarkers,
                  detectedAt: comparedAt,
                }
              : buildEmptyMatrixNewMarkers()
          );
          setYouthUpdatesHistory((prev) =>
            [updatesEntry, ...prev].slice(0, YOUTH_UPDATES_HISTORY_LIMIT)
          );
          setSelectedYouthUpdatesId(updatesEntry.id);
        }
      }
      if (
        playersUpdated &&
        (refreshAll ? matchesOk && ratingsOk : options?.recordRefresh)
      ) {
        const refreshedAt = Date.now();
        writeLastRefreshTimestamp(refreshedAt);
        setLastGlobalRefreshAt(refreshedAt);
      }
      if (playersUpdated) {
        if (options?.reason === "stale") {
          addNotification(messages.notificationStaleRefresh);
        }
        addNotification(messages.notificationPlayersRefreshed);
        if (refreshAll && detailRefreshFailureCount > 0) {
          addNotification(
            messages.notificationYouthPlayerDetailsPartialRefresh
              .replace("{{count}}", String(detailRefreshFailureCount))
              .replace("{{total}}", String(detailRefreshTotal))
          );
        }
      }
      if (usePersistedMarkersBaseline && playersUpdated) {
        persistedMarkersBaselineRef.current = null;
      }
      setPlayerRefreshProgressPct(100);
      setPlayerRefreshStatus(null);
      setPlayerRefreshProgressPct(0);
      setPlayersLoading(false);
      stoppedRefreshRunIdsRef.current.delete(refreshRunId);
      if (activeRefreshRunIdRef.current === refreshRunId) {
        activeRefreshRunIdRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleYouthRefreshRequest = () => {
      void refreshPlayers(undefined, { refreshAll: true, reason: "manual" });
    };
    window.addEventListener(YOUTH_REFRESH_REQUEST_EVENT, handleYouthRefreshRequest);
    return () =>
      window.removeEventListener(
        YOUTH_REFRESH_REQUEST_EVENT,
        handleYouthRefreshRequest
      );
  }, [refreshPlayers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleYouthRefreshStop = () => {
      const activeRunId = activeRefreshRunIdRef.current;
      if (!activeRunId) return;
      if (stoppedRefreshRunIdsRef.current.has(activeRunId)) return;
      stoppedRefreshRunIdsRef.current.add(activeRunId);
      setPlayersLoading(false);
      setPlayerRefreshStatus(null);
      setPlayerRefreshProgressPct(0);
      addNotification(messages.notificationRefreshStoppedManual);
    };
    window.addEventListener(YOUTH_REFRESH_STOP_EVENT, handleYouthRefreshStop);
    return () =>
      window.removeEventListener(YOUTH_REFRESH_STOP_EVENT, handleYouthRefreshStop);
  }, [addNotification, messages.notificationRefreshStoppedManual]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOpenYouthLatestUpdates = () => setYouthUpdatesOpen(true);
    window.addEventListener(
      YOUTH_LATEST_UPDATES_OPEN_EVENT,
      handleOpenYouthLatestUpdates
    );
    return () =>
      window.removeEventListener(
        YOUTH_LATEST_UPDATES_OPEN_EVENT,
        handleOpenYouthLatestUpdates
      );
  }, []);

  useEffect(() => {
    if (!youthUpdatesHistoryWithChanges.length) {
      setSelectedYouthUpdatesId(null);
      return;
    }
    if (!selectedYouthUpdatesId) {
      setSelectedYouthUpdatesId(youthUpdatesHistoryWithChanges[0]?.id ?? null);
      return;
    }
    const exists = youthUpdatesHistoryWithChanges.some(
      (entry) => entry.id === selectedYouthUpdatesId
    );
    if (!exists) {
      setSelectedYouthUpdatesId(youthUpdatesHistoryWithChanges[0]?.id ?? null);
    }
  }, [selectedYouthUpdatesId, youthUpdatesHistoryWithChanges]);

  const handleTeamChange = (nextTeamId: number | null) => {
    if (nextTeamId === selectedYouthTeamId) return;
    setSelectedYouthTeamId(nextTeamId);
    setAssignments({});
    setBehaviors({});
    setLoadedMatchId(null);
    setOptimizerDebug(null);
    setShowOptimizerDebug(false);
    setSelectedId(null);
    pushMobileYouthState(
      mobileYouthView,
      mobileYouthView === "playerDetails" ? "list" : "root",
      "replace"
    );
    setPlayerList([]);
    setCache({});
    setDetails(null);
    setOrderSource(null);
    setOrderedPlayerIds(null);
    setStarPlayerId(null);
    setPrimaryTraining(DEFAULT_PRIMARY_TRAINING);
    setSecondaryTraining(DEFAULT_SECONDARY_TRAINING);
    setAutoSelectionApplied(false);
    setTransferSearchModalOpen(false);
    setTransferSearchSourcePlayerId(null);
    setTransferSearchFilters(null);
    setTransferSearchResults([]);
    setTransferSearchItemCount(null);
    setTransferSearchLoading(false);
    setTransferSearchError(null);
    setTransferSearchExactEmpty(false);
    setTransferSearchDetailsById({});
    setTransferSearchBidDrafts({});
    setTransferSearchBidPendingPlayerId(null);
    setHiddenSpecialtyByPlayerId({});
    setHiddenSpecialtyDiscoveredMatchByPlayerId({});
    setAnalyzedRatingsMatchIds([]);
    if (nextTeamId) {
      refreshPlayers(nextTeamId, { recordRefresh: true });
      refreshMatches(nextTeamId);
      const teamName =
        youthTeams.find((team) => team.youthTeamId === nextTeamId)
          ?.youthTeamName ?? nextTeamId;
      addNotification(`${messages.notificationTeamSwitched} ${teamName}`);
    }
  };

  const fetchManagerCompendium = async (userId?: string) => {
    try {
      const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const { response, payload } = await fetchChppJson<ManagerCompendiumResponse>(
        `/api/chpp/managercompendium${query}`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error ?? "Failed to fetch manager compendium");
      }
      if (!payload) throw new Error("Failed to fetch manager compendium");
      const teams = extractYouthTeams(payload);
      setYouthTeams(teams);
      if (teams.length > 1) {
        handleTeamChange(teams[0]?.youthTeamId ?? null);
      } else {
        setSelectedYouthTeamId(null);
      }
      addNotification(messages.notificationTeamsLoaded);
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
      addNotification(messages.notificationTeamsLoadFailed);
    }
  };

  useEffect(() => {
    if (!multiTeamEnabled) return;
    if (activeYouthTeamId) return;
    const fallbackId = youthTeams[0]?.youthTeamId ?? null;
    if (fallbackId) {
      handleTeamChange(fallbackId);
    }
  }, [activeYouthTeamId, multiTeamEnabled, youthTeams]);

  const loadLineup = (
    nextAssignments: LineupAssignments,
    nextBehaviors: LineupBehaviors,
    matchId: number
  ) => {
    setAssignments(nextAssignments);
    setBehaviors(nextBehaviors);
    setLoadedMatchId(matchId);
  };

  const handleBehaviorChange = (slotId: string, behavior: number) => {
    setBehaviors((prev) => {
      const next = { ...prev };
      if (behavior) {
        next[slotId] = behavior;
      } else {
        delete next[slotId];
      }
      return next;
    });
    setLoadedMatchId(null);
  };

  const detailsData = resolveDetails(details);
  const lastUpdated = selectedId ? cache[selectedId]?.fetchedAt ?? null : null;
  const optimizerPlayers = useMemo<OptimizerPlayer[]>(
    () =>
      playerList
        .filter((player) => {
          const details = playerDetailsById.get(player.YouthPlayerID);
          const injuryLevel = normalizeInjuryLevel(
            details?.InjuryLevel ?? player.InjuryLevel
          );
          return !isUnavailableForYouthOptimization(injuryLevel);
        })
        .map((player) => ({
          id: player.YouthPlayerID,
          name: [player.FirstName, player.NickName || null, player.LastName]
            .filter(Boolean)
            .join(" "),
          age:
            player.Age ??
            playerDetailsById.get(player.YouthPlayerID)?.Age ??
            null,
          ageDays:
            player.AgeDays ??
            playerDetailsById.get(player.YouthPlayerID)?.AgeDays ??
            null,
          canBePromotedIn:
            player.CanBePromotedIn ??
            playerDetailsById.get(player.YouthPlayerID)?.CanBePromotedIn ??
            null,
          specialty:
            Number(player.Specialty ?? 0) > 0
              ? Number(player.Specialty)
              : Number(playerDetailsById.get(player.YouthPlayerID)?.Specialty ?? 0) > 0
                ? Number(playerDetailsById.get(player.YouthPlayerID)?.Specialty)
                : Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0
                  ? Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID])
                  : null,
          skills:
            playerDetailsById.get(player.YouthPlayerID)?.PlayerSkills ??
            (player.PlayerSkills as OptimizerPlayer["skills"]) ??
            null,
        })),
    [hiddenSpecialtyByPlayerId, playerList, playerDetailsById]
  );

  const autoSelection = useMemo(
    () => getAutoSelection(optimizerPlayers, trainingPreferences),
    [optimizerPlayers, trainingPreferences]
  );

  useEffect(() => {
    if (starPlayerId || primaryTraining || secondaryTraining) return;
    if (!autoSelection) return;
    setStarPlayerId(autoSelection.starPlayerId);
    setPrimaryTraining(autoSelection.primarySkill);
    setSecondaryTraining(
      autoSelection.secondarySkill ?? DEFAULT_SECONDARY_TRAINING
    );
    setAutoSelectionApplied(true);
    const playerName =
      optimizerPlayers.find(
        (player) => player.id === autoSelection.starPlayerId
      )?.name ?? autoSelection.starPlayerId;
    const primaryLabel = trainingLabel(autoSelection.primarySkill);
    const secondaryLabel = trainingLabel(autoSelection.secondarySkill);
    addNotification(
      `${messages.notificationAutoSelection} ${playerName} · ${primaryLabel} / ${secondaryLabel}`
    );
  }, [
    addNotification,
    autoSelection,
    messages.notificationAutoSelection,
    optimizerPlayers,
    primaryTraining,
    secondaryTraining,
    starPlayerId,
  ]);

  useEffect(() => {
    if (!isDev) return;
    if (
      !starPlayerId ||
      !isTrainingSkill(primaryTraining) ||
      !isTrainingSkill(secondaryTraining)
    ) {
      setOptimizerDebug(null);
      return;
    }
    const result = optimizeLineupForStar(
      optimizerPlayers,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelectionApplied,
      trainingPreferences
    );
    setOptimizerDebug(result.debug ?? null);
  }, [
    autoSelectionApplied,
    isDev,
    optimizerPlayers,
    primaryTraining,
    secondaryTraining,
    starPlayerId,
    trainingPreferences,
  ]);

  const manualReady = Boolean(
    starPlayerId &&
      primaryTraining &&
      secondaryTraining &&
      optimizerPlayers.some((player) => player.id === starPlayerId)
  );

  const optimizeDisabledReason = !starPlayerId
    ? messages.optimizeLineupNeedsStar
    : !primaryTraining || !secondaryTraining
    ? messages.optimizeLineupNeedsTraining
    : messages.optimizeLineupTitle;
  const optimizeDisabledForMissingStar = !starPlayerId;
  const highlightMissingStarSelection =
    highlightMissingStarControls && optimizeDisabledForMissingStar;

  const optimizerCategoryLabel = (category: OptimizerDebug["primary"]["list"][number]["category"]) => {
    switch (category) {
      case "cat1":
        return messages.optimizerCat1;
      case "cat2":
        return messages.optimizerCat2;
      case "cat3":
        return messages.optimizerCat3;
      case "cat4":
        return messages.optimizerCat4;
      case "maxed":
        return messages.optimizerCatMaxed;
      case "dontCare":
      default:
        return messages.optimizerCatDontCare;
    }
  };

  const trainingLabel = (skill: TrainingSkillKey | "" | null) => {
    switch (skill) {
      case "keeper":
        return messages.trainingKeeper;
      case "defending":
        return messages.trainingDefending;
      case "playmaking":
        return messages.trainingPlaymaking;
      case "winger":
        return messages.trainingWinger;
      case "passing":
        return messages.trainingPassing;
      case "scoring":
        return messages.trainingScoring;
      case "setpieces":
        return messages.trainingSetPieces;
      case "defending_defenders_midfielders":
        return messages.trainingDefendingDefendersMidfielders;
      case "winger_winger_attackers":
        return messages.trainingWingerWingerAttackers;
      case "passing_defenders_midfielders":
        return messages.trainingPassingDefendersMidfielders;
      default:
        return messages.unknownShort;
    }
  };
  const optimizeTrainingLabel = (skill: TrainingSkillKey | "" | null) => {
    switch (skill) {
      case "defending_defenders_midfielders":
        return messages.trainingDefending;
      case "winger_winger_attackers":
        return messages.trainingWinger;
      case "passing_defenders_midfielders":
        return messages.trainingPassing;
      default:
        return trainingLabel(skill);
    }
  };

  const tacticLabelForValue = (value: number) => {
    switch (value) {
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
        return messages.unknownShort;
    }
  };
  const captainName = captainId
    ? formatPlayerName(playersById.get(captainId) ?? ({} as YouthPlayer))
    : messages.unknownShort;
  const trainingReminderText = messages.trainingReminderBody
    .replace("{{primary}}", trainingLabel(primaryTraining))
    .replace("{{secondary}}", trainingLabel(secondaryTraining))
    .replace("{{captain}}", captainName)
    .replace("{{tactic}}", tacticLabelForValue(tacticType));
  const optimizeStarPlayerName = starPlayerId
    ? formatPlayerName(playersById.get(starPlayerId) ?? ({} as YouthPlayer))
    : messages.unknownShort;
  const optimizePrimaryTrainingName = isTrainingSkill(primaryTraining)
    ? optimizeTrainingLabel(primaryTraining)
    : messages.trainingUnset;
  const optimizeSecondaryTrainingName = isTrainingSkill(secondaryTraining)
    ? optimizeTrainingLabel(secondaryTraining)
    : messages.trainingUnset;
  const combinedRevealAllowsSamePlayerTarget = useMemo(() => {
    if (!isTrainingSkill(primaryTraining) || !isTrainingSkill(secondaryTraining)) {
      return false;
    }
    const slots = getTrainingSlots(primaryTraining, secondaryTraining);
    return Array.from(slots.primarySlots).some((slot) => slots.secondarySlots.has(slot));
  }, [primaryTraining, secondaryTraining]);
  const eligibleRevealSecondaryTargetOptions = useMemo(() => {
    if (!isTrainingSkill(secondaryTraining)) return [];
    const secondaryMaxKey = TRAINING_SKILL_VALUE_KEYS[secondaryTraining].max;
    return optimizerPlayers
      .filter((player) => {
        if (
          player.id === starPlayerId &&
          !combinedRevealAllowsSamePlayerTarget
        ) {
          return false;
        }
        const sourceSkills =
          playerDetailsById.get(player.id)?.PlayerSkills ??
          playerList.find((entry) => entry.YouthPlayerID === player.id)?.PlayerSkills ??
          null;
        return getKnownSkillValue(sourceSkills?.[secondaryMaxKey]) === null;
      })
      .map((player) => ({
        playerId: player.id,
        label: player.name ?? String(player.id),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [
    combinedRevealAllowsSamePlayerTarget,
    optimizerPlayers,
    playerDetailsById,
    playerList,
    secondaryTraining,
    starPlayerId,
  ]);
  const selectedRevealSecondaryTargetOption =
    eligibleRevealSecondaryTargetOptions.find(
      (option) => option.playerId === revealSecondaryTargetPlayerId
    ) ?? null;
  const optimizeRevealComboTargetName =
    selectedRevealSecondaryTargetOption?.label ?? messages.optimizeRevealTargetPlaceholder;
  const optimizeRevealInlineTargetName = selectedRevealSecondaryTargetOption?.label ?? "?";
  const optimizePrimaryTrainingNameLower =
    optimizePrimaryTrainingName.toLocaleLowerCase();
  const optimizeSecondaryTrainingNameLower =
    optimizeSecondaryTrainingName.toLocaleLowerCase();
  const optimizeRevealPrimaryCurrentAndSecondaryMaxLabel =
    messages.optimizeMenuRevealPrimaryCurrentAndSecondaryMax
      .replace("{{player}}", optimizeStarPlayerName)
      .replace("{{training}}", optimizePrimaryTrainingName)
      .replace("{{trainingLower}}", optimizePrimaryTrainingNameLower)
      .replace("{{secondaryPlayer}}", optimizeRevealComboTargetName)
      .replace("{{secondaryTraining}}", optimizeSecondaryTrainingName)
      .replace("{{secondaryTrainingLower}}", optimizeSecondaryTrainingNameLower);
  const optimizeRevealInlineTemplate =
    messages.optimizeMenuRevealPrimaryCurrentAndSecondaryMax
      .replace("{{player}}", optimizeStarPlayerName)
      .replace("{{training}}", optimizePrimaryTrainingName)
      .replace("{{trainingLower}}", optimizePrimaryTrainingNameLower)
      .replace("{{secondaryPlayer}}", "__SECONDARY_PLAYER__")
      .replace("{{secondaryTraining}}", optimizeSecondaryTrainingName)
      .replace("{{secondaryTrainingLower}}", optimizeSecondaryTrainingNameLower);
  const [
    optimizeRevealInlinePrefix,
    optimizeRevealInlineSuffix = "",
  ] = optimizeRevealInlineTemplate.split("__SECONDARY_PLAYER__");
  const optimizeRevealInlinePickerSuffixMatch =
    optimizeRevealInlineSuffix.match(/^(['\u2019]s\b\s*)/);
  const optimizeRevealInlinePickerSuffix =
    optimizeRevealInlinePickerSuffixMatch?.[0] ?? "";
  const optimizeRevealInlineSuffixRemainder = optimizeRevealInlineSuffix.slice(
    optimizeRevealInlinePickerSuffix.length
  );
  const optimizeModeDisabledReasons = useMemo(() => {
    const reasons: {
      revealPrimaryCurrent?: string;
      revealSecondaryMax?: string;
      revealPrimaryCurrentAndSecondaryMax?: string;
    } = {};
    if (
      !starPlayerId ||
      !isTrainingSkill(primaryTraining) ||
      !isTrainingSkill(secondaryTraining)
    ) {
      return reasons;
    }
    const starPlayer =
      playerList.find((player) => player.YouthPlayerID === starPlayerId) ?? null;
    const starSkills =
      playerDetailsById.get(starPlayerId)?.PlayerSkills ??
      starPlayer?.PlayerSkills ??
      null;
    if (!starSkills) return reasons;

    const primaryCurrentKey = TRAINING_SKILL_VALUE_KEYS[primaryTraining].current;
    const secondaryMaxKey = TRAINING_SKILL_VALUE_KEYS[secondaryTraining].max;
    const starName =
      [starPlayer?.FirstName, starPlayer?.NickName || null, starPlayer?.LastName]
        .filter(Boolean)
        .join(" ") || messages.unknownShort;
    const primaryTrainingName = optimizeTrainingLabel(primaryTraining).toLocaleLowerCase();
    const secondaryTrainingName =
      optimizeTrainingLabel(secondaryTraining).toLocaleLowerCase();

    if (getKnownSkillValue(starSkills[primaryCurrentKey]) !== null) {
      reasons.revealPrimaryCurrent = messages.optimizeRevealPrimaryCurrentKnownTooltip
        .replace("{{player}}", starName)
        .replace("{{training}}", primaryTrainingName);
      reasons.revealPrimaryCurrentAndSecondaryMax = reasons.revealPrimaryCurrent;
    }
    if (getKnownSkillValue(starSkills[secondaryMaxKey]) !== null) {
      reasons.revealSecondaryMax = messages.optimizeRevealSecondaryMaxKnownTooltip
        .replace("{{player}}", starName)
        .replace("{{training}}", secondaryTrainingName);
    }
    if (!reasons.revealPrimaryCurrentAndSecondaryMax) {
      if (!eligibleRevealSecondaryTargetOptions.length) {
        reasons.revealPrimaryCurrentAndSecondaryMax =
          messages.optimizeRevealPrimaryCurrentAndSecondaryMaxUnavailable;
      } else if (!selectedRevealSecondaryTargetOption) {
        reasons.revealPrimaryCurrentAndSecondaryMax =
          messages.optimizeRevealTargetPlaceholder;
      } else {
        const targetSkills =
          playerDetailsById.get(selectedRevealSecondaryTargetOption.playerId)?.PlayerSkills ??
          playerList.find(
            (player) => player.YouthPlayerID === selectedRevealSecondaryTargetOption.playerId
          )?.PlayerSkills ??
          null;
        if (getKnownSkillValue(targetSkills?.[secondaryMaxKey]) !== null) {
          reasons.revealPrimaryCurrentAndSecondaryMax =
            messages.optimizeRevealSecondaryMaxKnownTooltip
              .replace("{{player}}", selectedRevealSecondaryTargetOption.label)
              .replace("{{training}}", secondaryTrainingName);
        }
      }
    }
    return reasons;
  }, [
    eligibleRevealSecondaryTargetOptions.length,
    messages.optimizeRevealPrimaryCurrentKnownTooltip,
    messages.optimizeRevealPrimaryCurrentAndSecondaryMaxUnavailable,
    messages.optimizeRevealSecondaryMaxKnownTooltip,
    messages.optimizeRevealTargetPlaceholder,
    messages.unknownShort,
    playerDetailsById,
    playerList,
    primaryTraining,
    selectedRevealSecondaryTargetOption,
    secondaryTraining,
    starPlayerId,
  ]);
  useEffect(() => {
    if (!eligibleRevealSecondaryTargetOptions.length) {
      if (revealSecondaryTargetPlayerId !== null) {
        setRevealSecondaryTargetPlayerId(null);
      }
      if (revealSecondaryTargetMenuOpen) {
        setRevealSecondaryTargetMenuOpen(false);
      }
      return;
    }
    const currentStillEligible = eligibleRevealSecondaryTargetOptions.some(
      (option) => option.playerId === revealSecondaryTargetPlayerId
    );
    if (!currentStillEligible && revealSecondaryTargetPlayerId !== null) {
      setRevealSecondaryTargetPlayerId(null);
    }
  }, [
    eligibleRevealSecondaryTargetOptions,
    revealSecondaryTargetMenuOpen,
    revealSecondaryTargetPlayerId,
  ]);
  const optimizeCustomMenuContent = (
    <span className={styles.optimizeMenuCustomWrap}>
      <span className={styles.optimizeMenuCustomLabel}>
        {optimizeRevealInlinePrefix}
        <span className={styles.optimizeMenuInlinePickerWrap}>
          <button
            ref={revealSecondaryTargetButtonRef}
            type="button"
            className={styles.optimizeMenuInlinePicker}
            onClick={(event) => {
              event.stopPropagation();
              setRevealSecondaryTargetMenuOpen((current) => !current);
            }}
            aria-haspopup="menu"
            aria-expanded={revealSecondaryTargetMenuOpen}
            disabled={!eligibleRevealSecondaryTargetOptions.length}
          >
            <span className={styles.optimizeMenuInlinePickerText}>
              {optimizeRevealInlineTargetName}
              {optimizeRevealInlinePickerSuffix}
            </span>
            <span className={styles.optimizeMenuInlinePickerChevron}>⌄</span>
          </button>
          {revealSecondaryTargetMenuOpen &&
          eligibleRevealSecondaryTargetOptions.length ? (
            <div
              ref={revealSecondaryTargetMenuRef}
              className={`${styles.feedbackMenu} ${styles.optimizeMenuInlinePickerMenu}`}
              role="menu"
            >
              {eligibleRevealSecondaryTargetOptions.map((option) => (
                <button
                  key={option.playerId}
                  type="button"
                  role="menuitem"
                  className={`${styles.feedbackLink} ${styles.optimizeMenuItem} ${
                    revealSecondaryTargetPlayerId === option.playerId
                      ? styles.optimizeMenuInlinePickerOptionActive
                      : ""
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setRevealSecondaryTargetPlayerId(option.playerId);
                    setRevealSecondaryTargetMenuOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </span>
        {optimizeRevealInlineSuffixRemainder}
      </span>
      <div className={styles.optimizeMenuCustomControls}>
        <Tooltip
          content={optimizeModeDisabledReasons.revealPrimaryCurrentAndSecondaryMax ?? ""}
          disabled={!optimizeModeDisabledReasons.revealPrimaryCurrentAndSecondaryMax}
        >
          <span>
            <button
              type="button"
              className={`${styles.feedbackLink} ${styles.optimizeMenuActionButton} ${
                optimizeModeDisabledReasons.revealPrimaryCurrentAndSecondaryMax
                  ? styles.optimizeMenuItemDisabled
                  : ""
              }`}
              onClick={() => handleOptimizeSelect("revealPrimaryCurrentAndSecondaryMax")}
              disabled={Boolean(
                optimizeModeDisabledReasons.revealPrimaryCurrentAndSecondaryMax
              )}
              aria-label={
                optimizeModeDisabledReasons.revealPrimaryCurrentAndSecondaryMax ??
                optimizeRevealPrimaryCurrentAndSecondaryMaxLabel
              }
            >
              {messages.optimizeRevealCombinedButton}
            </button>
          </span>
        </Tooltip>
      </div>
    </span>
  );
  const trainingSlots = useMemo(() => {
    if (!isTrainingSkill(primaryTraining) || !isTrainingSkill(secondaryTraining)) {
      return {
        primary: new Set<string>(),
        secondary: new Set<string>(),
        primaryFull: new Set<string>(),
        primaryHalf: new Set<string>(),
        secondaryFull: new Set<string>(),
        secondaryHalf: new Set<string>(),
        all: new Set<string>(),
      };
    }
    const slots = getTrainingSlots(primaryTraining, secondaryTraining);
    return {
      primary: slots.primarySlots,
      secondary: slots.secondarySlots,
      primaryFull: slots.primaryFullSlots,
      primaryHalf: slots.primaryHalfSlots,
      secondaryFull: slots.secondaryFullSlots,
      secondaryHalf: slots.secondaryHalfSlots,
      all: slots.allSlots,
    };
  }, [primaryTraining, secondaryTraining]);

  const selectedYouthUpdatesEntry = useMemo(
    () =>
      selectedYouthUpdatesId
        ? youthUpdatesHistoryWithChanges.find(
            (entry) => entry.id === selectedYouthUpdatesId
          ) ??
          null
        : youthUpdatesHistoryWithChanges[0] ?? null,
    [selectedYouthUpdatesId, youthUpdatesHistoryWithChanges]
  );

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

  const youthUpdatesRows = useMemo(() => {
    if (!selectedYouthUpdatesEntry) return [];
    return Object.values(selectedYouthUpdatesEntry.groupedByPlayerId)
      .sort((left, right) => left.playerName.localeCompare(right.playerName))
      .map((entry) => ({
        ...entry,
        ratings: [...entry.ratings].sort((left, right) => left.position - right.position),
        skillsCurrent: [...entry.skillsCurrent],
        skillsMax: [...entry.skillsMax],
        attributes: [...entry.attributes],
      }));
  }, [selectedYouthUpdatesEntry]);

  const formatUpdatesValue = (value: number | null, type: "skill" | "rating") => {
    if (value === null) return messages.unknownShort;
    if (type === "rating") return value.toFixed(1);
    return String(value);
  };

  const youthUpdatesAttributeLabel = (
    key: "hiddenSpecialtyDiscovered" | "injuryStatus"
  ) => {
    switch (key) {
      case "hiddenSpecialtyDiscovered":
        return messages.hiddenSpecialtyTooltip;
      case "injuryStatus":
        return messages.sortInjuries;
      default:
        return key;
    }
  };

  const formatYouthUpdatesAttributeValue = (
    key: "hiddenSpecialtyDiscovered" | "injuryStatus",
    value: number | string | boolean | null
  ) => {
    if (value === null || value === undefined) return messages.unknownShort;
    if (key === "injuryStatus" && typeof value === "number") {
      if (value < 0) return messages.clubChronicleInjuryHealthy;
      if (value === 0) return messages.seniorListInjuryBruised;
      return value.toFixed(1);
    }
    return String(value);
  };

  const youthTrainingControls = (
    <div
      className={`${styles.lineupTrainingControlStack} ${styles.youthLineupTrainingControlStack}`}
      data-help-anchor="training-dropdowns"
    >
      <div className={styles.trainingRow}>
        <span className={styles.trainingLabel}>
          {(messages.primaryTrainingLabel || "Pri").slice(0, 3).toUpperCase()}
        </span>
        <div className={styles.feedbackWrap}>
          <button
            type="button"
            className={styles.trainingSelectTrigger}
            onClick={() => {
              setPrimaryTrainingMenuOpen((prev) => !prev);
              setSecondaryTrainingMenuOpen(false);
            }}
            ref={primaryTrainingButtonRef}
            aria-haspopup="menu"
            aria-expanded={primaryTrainingMenuOpen}
          >
            {trainingLabel(primaryTraining)}
          </button>
          {primaryTrainingMenuOpen ? (
            <div
              className={`${styles.feedbackMenu} ${styles.trainingSelectMenu}`}
              ref={primaryTrainingMenuRef}
              role="menu"
            >
              {TRAINING_SKILL_SECTIONS.map((section) => (
                <div key={`primary-section-${section.title}`}>
                  <div className={styles.trainingSelectSectionHeader}>
                    {section.title === "focused"
                      ? messages.trainingSectionFocused
                      : messages.trainingSectionExtended}
                  </div>
                  <div className={styles.trainingSelectSectionOptions}>
                    {section.options.map((value) => (
                      <button
                        key={`primary-${value}`}
                        type="button"
                        className={`${styles.feedbackLink} ${styles.trainingSelectOption} ${
                          value === primaryTraining
                            ? styles.trainingSelectOptionActive
                            : ""
                        }`}
                        onClick={() => {
                          setPrimaryTraining(value);
                          setPrimaryTrainingMenuOpen(false);
                          setAutoSelectionApplied(false);
                          addNotification(
                            `${messages.notificationPrimaryTrainingSet} ${trainingLabel(
                              value
                            )}`
                          );
                        }}
                      >
                        {trainingLabel(value)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.trainingRow}>
        <span className={styles.trainingLabel}>
          {(messages.secondaryTrainingLabel || "Sec").slice(0, 3).toUpperCase()}
        </span>
        <div className={styles.feedbackWrap}>
          <button
            type="button"
            className={styles.trainingSelectTrigger}
            onClick={() => {
              setSecondaryTrainingMenuOpen((prev) => !prev);
              setPrimaryTrainingMenuOpen(false);
            }}
            ref={secondaryTrainingButtonRef}
            aria-haspopup="menu"
            aria-expanded={secondaryTrainingMenuOpen}
          >
            {trainingLabel(secondaryTraining)}
          </button>
          {secondaryTrainingMenuOpen ? (
            <div
              className={`${styles.feedbackMenu} ${styles.trainingSelectMenu}`}
              ref={secondaryTrainingMenuRef}
              role="menu"
            >
              {TRAINING_SKILL_SECTIONS.map((section) => (
                <div key={`secondary-section-${section.title}`}>
                  <div className={styles.trainingSelectSectionHeader}>
                    {section.title === "focused"
                      ? messages.trainingSectionFocused
                      : messages.trainingSectionExtended}
                  </div>
                  <div className={styles.trainingSelectSectionOptions}>
                    {section.options.map((value) => (
                      <button
                        key={`secondary-${value}`}
                        type="button"
                        className={`${styles.feedbackLink} ${styles.trainingSelectOption} ${
                          value === secondaryTraining
                            ? styles.trainingSelectOptionActive
                            : ""
                        }`}
                        onClick={() => {
                          setSecondaryTraining(value);
                          setSecondaryTrainingMenuOpen(false);
                          setAutoSelectionApplied(false);
                          addNotification(
                            `${messages.notificationSecondaryTrainingSet} ${trainingLabel(
                              value
                            )}`
                          );
                        }}
                      >
                        {trainingLabel(value)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  const mobileYouthViewLabel = useMemo(() => {
    switch (mobileYouthView) {
      case "help":
        return messages.mobileHelpLabel;
      case "skillsMatrix":
        return messages.skillsMatrixTabLabel;
      case "ratingsMatrix":
        return messages.ratingsMatrixTabLabel;
      case "lineupOptimizer":
        return messages.lineupTitle;
      case "playerDetails":
      default:
        return messages.detailsTabLabel;
    }
  }, [
    messages.detailsTabLabel,
    messages.lineupTitle,
    messages.mobileHelpLabel,
    messages.ratingsMatrixTabLabel,
    messages.skillsMatrixTabLabel,
    mobileYouthView,
  ]);

  const mobileYouthMatrixHint = !mobileYouthLandscapeActive ? (
    <span className={styles.mobileYouthLandscapeHint}>
      {messages.mobileYouthLandscapeHint}
    </span>
  ) : null;

  const mobileYouthLineupPickerPlayers = useMemo(
    () =>
      [...optimizerPlayers].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
      ),
    [optimizerPlayers]
  );

  const mobileYouthRefreshStatus = playersLoading
    ? playerRefreshStatus ?? messages.refreshingLabel
    : lastGlobalRefreshAt
    ? `${messages.youthLastGlobalRefresh}: ${formatDateTime(lastGlobalRefreshAt)}`
    : null;

  const youthEstimateValueTooltip = youthEstimateValueDisabled
    ? selectedYouthEstimateValueSkillCount === 0
      ? messages.youthEstimateValueDisabledTooltip
      : messages.youthEstimateValueAgeMissingTooltip
    : messages.youthEstimateValueTooltip;
  const youthDetailsHeaderActions = selectedPlayer ? (
    <Tooltip content={youthEstimateValueTooltip}>
      <span>
        <button
          type="button"
          className={`${styles.confirmSubmit} ${styles.youthEstimateValueButton}`}
          onClick={() => {
            void openYouthEstimateValueSearch();
          }}
          disabled={youthEstimateValueDisabled}
        >
          {messages.youthEstimateValueButton}
        </button>
      </span>
    </Tooltip>
  ) : null;

  const mobileYouthContent =
    mobileYouthPlayerScreen === "detail" ? (
      <div className={styles.mobileYouthContent}>
        <PlayerDetailsPanel
          selectedPlayer={selectedPlayer}
          detailsData={detailsData}
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          unlockStatus={unlockStatus}
          onRefresh={() =>
            selectedId ? handlePlayerDetailsRefresh() : undefined
          }
          players={playerList}
          playerDetailsById={playerDetailsById}
          skillsMatrixRows={skillsMatrixRows}
          ratingsMatrixResponse={ratingsMatrixData?.response ?? null}
          ratingsMatrixMatchHrefBuilder={ratingsMatrixMatchHrefBuilder}
          ratingsMatrixSelectedName={
            selectedPlayer ? formatPlayerName(selectedPlayer) : null
          }
          ratingsMatrixSpecialtyByName={Object.fromEntries(
            playerList.map((player) => [
              [player.FirstName, player.NickName || null, player.LastName]
                .filter(Boolean)
                .join(" "),
              Number(player.Specialty ?? 0) > 0
                ? player.Specialty
                : hiddenSpecialtyByPlayerId[player.YouthPlayerID],
            ])
          )}
          ratingsMatrixHiddenSpecialtyByName={Object.fromEntries(
            playerList.map((player) => [
              [player.FirstName, player.NickName || null, player.LastName]
                .filter(Boolean)
                .join(" "),
              Number(player.Specialty ?? 0) <= 0 &&
                Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0,
            ])
          )}
          matrixNewPlayerIds={newPlayerNameMarkerIds}
          matrixNewRatingsByPlayerId={activeMatrixNewMarkers.ratingsByPlayerId}
          matrixNewSkillsCurrentByPlayerId={
            activeMatrixNewMarkers.skillsCurrentByPlayerId
          }
          matrixNewSkillsMaxByPlayerId={activeMatrixNewMarkers.skillsMaxByPlayerId}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
          hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
          onSelectRatingsPlayer={(playerName) => {
            const match = playerList.find(
              (entry) => formatPlayerName(entry) === playerName
            );
            if (!match) return;
            handleMobilePlayerSelect(match.YouthPlayerID);
          }}
          onMatrixPlayerDragStart={handleMatrixPlayerDragStart}
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
            handleMobilePlayerSelect(previousPlayerId);
          }}
          onNextPlayer={() => {
            if (!nextPlayerId) return;
            handleMobilePlayerSelect(nextPlayerId);
          }}
          detailsHeaderActions={youthDetailsHeaderActions}
          activeTab="details"
          showTabs={false}
          messages={messages}
        />
      </div>
    ) : mobileYouthPlayerScreen === "list" ? (
      <div className={styles.mobileYouthContent}>
        <YouthPlayerList
          players={playerList}
          playerDetailsById={playerDetailsById}
          orderedPlayerIds={orderedPlayerIds}
          orderSource={orderSource}
          youthTeams={youthTeams}
          selectedYouthTeamId={selectedYouthTeamId}
          showTeamSelector={false}
          onTeamChange={handleTeamChange}
          assignedIds={assignedIds}
          selectedId={selectedId}
          starPlayerId={starPlayerId}
          onSortStart={() => {
            setOrderSource("list");
            setOrderedPlayerIds(null);
          }}
          onToggleStar={(playerId) => {
            const nextIsClear = starPlayerId === playerId;
            setStarPlayerId((prev) => (prev === playerId ? null : playerId));
            setAutoSelectionApplied(false);
            if (nextIsClear) {
              addNotification(messages.notificationStarCleared);
              return;
            }
            void handleSelect(playerId);
            const training = getTrainingForStar(
              optimizerPlayers,
              playerId,
              trainingPreferences
            );
            if (!training) {
              setPrimaryTraining(DEFAULT_PRIMARY_TRAINING);
              setSecondaryTraining(DEFAULT_SECONDARY_TRAINING);
              return;
            }
            setPrimaryTraining(training.primarySkill);
            setSecondaryTraining(
              training.secondarySkill ?? DEFAULT_SECONDARY_TRAINING
            );
            const playerName =
              optimizerPlayers.find((player) => player.id === playerId)?.name ??
              playerId;
            const primaryLabel = trainingLabel(training.primarySkill);
            const secondaryLabel = trainingLabel(training.secondarySkill);
            addNotification(
              `${messages.notificationStarSet} ${playerName} · ${primaryLabel} / ${secondaryLabel}`
            );
          }}
          onSelect={handleMobilePlayerSelect}
          onAutoSelect={() => {
            if (!autoSelection) return;
            setStarPlayerId(autoSelection.starPlayerId);
            setPrimaryTraining(autoSelection.primarySkill);
            setSecondaryTraining(
              autoSelection.secondarySkill ?? DEFAULT_SECONDARY_TRAINING
            );
            setAutoSelectionApplied(true);
            const playerName =
              optimizerPlayers.find(
                (player) => player.id === autoSelection.starPlayerId
              )?.name ?? autoSelection.starPlayerId;
            const primaryLabel = trainingLabel(autoSelection.primarySkill);
            const secondaryLabel = trainingLabel(autoSelection.secondarySkill);
            addNotification(
              `${messages.notificationAutoSelection} ${playerName} · ${primaryLabel} / ${secondaryLabel}`
            );
          }}
          onOrderChange={(ids) => applyPlayerOrder(ids, "list")}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
          hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
          newMarkerPlayerIds={listNewMarkerPlayerIds}
          messages={messages}
        />
      </div>
    ) : mobileYouthView === "help" ? (
      <div className={styles.mobileYouthContent}>
        <div className={styles.helpCard}>
          <h2 className={styles.helpTitle}>{messages.helpTitle}</h2>
          <p className={styles.helpIntro}>{messages.helpIntro}</p>
          <ul className={styles.helpList}>
            <li>{messages.helpBulletOverview}</li>
            <li>{messages.helpBulletWorkflow}</li>
            <li>{messages.helpBulletMatches}</li>
            <li>{messages.helpBulletAdjust}</li>
            <li>{messages.helpBulletOptimizerModes}</li>
            <li>{messages.helpBulletTraining}</li>
          </ul>
          <div className={styles.helpOptimizerSection}>
            <h3 className={styles.helpOptimizerTitle}>
              {messages.helpOptimizerLocationTitle}
            </h3>
            <p className={styles.helpOptimizerLead}>
              {messages.helpOptimizerLocationYouth}
            </p>
            <div className={styles.helpOptimizerMockSurface}>
              <div className={styles.helpOptimizerMockHeader}>
                <span className={styles.helpOptimizerMockLabel}>
                  {messages.lineupTitle}
                </span>
                <button
                  type="button"
                  className={styles.optimizeButton}
                  aria-label={messages.setBestLineupTooltip}
                  tabIndex={-1}
                >
                  ✨
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className={styles.helpDismiss}
            onClick={() => pushMobileYouthState("playerDetails", "root", "replace")}
          >
            {messages.closeLabel}
          </button>
        </div>
      </div>
    ) : mobileYouthView === "skillsMatrix" ? (
      <div className={styles.mobileYouthContent}>
        <PlayerDetailsPanel
          selectedPlayer={selectedPlayer}
          detailsData={detailsData}
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          unlockStatus={unlockStatus}
          onRefresh={() =>
            selectedId ? handlePlayerDetailsRefresh() : undefined
          }
          players={playerList}
          playerDetailsById={playerDetailsById}
          skillsMatrixRows={skillsMatrixRows}
          ratingsMatrixResponse={ratingsMatrixData?.response ?? null}
          ratingsMatrixMatchHrefBuilder={ratingsMatrixMatchHrefBuilder}
          ratingsMatrixSelectedName={
            selectedPlayer ? formatPlayerName(selectedPlayer) : null
          }
          ratingsMatrixSpecialtyByName={Object.fromEntries(
            playerList.map((player) => [
              [player.FirstName, player.NickName || null, player.LastName]
                .filter(Boolean)
                .join(" "),
              Number(player.Specialty ?? 0) > 0
                ? player.Specialty
                : hiddenSpecialtyByPlayerId[player.YouthPlayerID],
            ])
          )}
          ratingsMatrixHiddenSpecialtyByName={Object.fromEntries(
            playerList.map((player) => [
              [player.FirstName, player.NickName || null, player.LastName]
                .filter(Boolean)
                .join(" "),
              Number(player.Specialty ?? 0) <= 0 &&
                Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0,
            ])
          )}
          matrixNewPlayerIds={newPlayerNameMarkerIds}
          matrixNewRatingsByPlayerId={activeMatrixNewMarkers.ratingsByPlayerId}
          matrixNewSkillsCurrentByPlayerId={
            activeMatrixNewMarkers.skillsCurrentByPlayerId
          }
          matrixNewSkillsMaxByPlayerId={activeMatrixNewMarkers.skillsMaxByPlayerId}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
          hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
          onSelectRatingsPlayer={(playerName) => {
            const match = playerList.find(
              (entry) => formatPlayerName(entry) === playerName
            );
            if (!match) return;
            handleMobilePlayerSelect(match.YouthPlayerID);
          }}
          onMatrixPlayerDragStart={handleMatrixPlayerDragStart}
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
          activeTab="skillsMatrix"
          showTabs={false}
          extraSkillsMatrixHeaderAux={mobileYouthMatrixHint}
          messages={messages}
        />
      </div>
    ) : mobileYouthView === "ratingsMatrix" ? (
      <div className={styles.mobileYouthContent}>
        <PlayerDetailsPanel
          selectedPlayer={selectedPlayer}
          detailsData={detailsData}
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          unlockStatus={unlockStatus}
          onRefresh={() =>
            selectedId ? handlePlayerDetailsRefresh() : undefined
          }
          players={playerList}
          playerDetailsById={playerDetailsById}
          skillsMatrixRows={skillsMatrixRows}
          ratingsMatrixResponse={ratingsMatrixData?.response ?? null}
          ratingsMatrixMatchHrefBuilder={ratingsMatrixMatchHrefBuilder}
          ratingsMatrixSelectedName={
            selectedPlayer ? formatPlayerName(selectedPlayer) : null
          }
          ratingsMatrixSpecialtyByName={Object.fromEntries(
            playerList.map((player) => [
              [player.FirstName, player.NickName || null, player.LastName]
                .filter(Boolean)
                .join(" "),
              Number(player.Specialty ?? 0) > 0
                ? player.Specialty
                : hiddenSpecialtyByPlayerId[player.YouthPlayerID],
            ])
          )}
          ratingsMatrixHiddenSpecialtyByName={Object.fromEntries(
            playerList.map((player) => [
              [player.FirstName, player.NickName || null, player.LastName]
                .filter(Boolean)
                .join(" "),
              Number(player.Specialty ?? 0) <= 0 &&
                Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0,
            ])
          )}
          matrixNewPlayerIds={newPlayerNameMarkerIds}
          matrixNewRatingsByPlayerId={activeMatrixNewMarkers.ratingsByPlayerId}
          matrixNewSkillsCurrentByPlayerId={
            activeMatrixNewMarkers.skillsCurrentByPlayerId
          }
          matrixNewSkillsMaxByPlayerId={activeMatrixNewMarkers.skillsMaxByPlayerId}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
          hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
          onSelectRatingsPlayer={(playerName) => {
            const match = playerList.find(
              (entry) => formatPlayerName(entry) === playerName
            );
            if (!match) return;
            handleMobilePlayerSelect(match.YouthPlayerID);
          }}
          onMatrixPlayerDragStart={handleMatrixPlayerDragStart}
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
          activeTab="ratingsMatrix"
          showTabs={false}
          extraSkillsMatrixHeaderAux={mobileYouthMatrixHint}
          messages={messages}
        />
      </div>
    ) : mobileYouthView === "lineupOptimizer" ? (
      <div className={styles.mobileYouthContent}>
        <LineupField
          assignments={assignments}
          behaviors={behaviors}
          playersById={playersById}
          playerDetailsById={playerDetailsById}
          onAssign={assignPlayer}
          onClear={clearSlot}
          onMove={moveSlot}
          onChangeBehavior={handleBehaviorChange}
          onRandomize={randomizeLineup}
          onReset={resetLineup}
          onOptimizeSelect={handleOptimizeSelect}
          tacticType={tacticType}
          onTacticChange={setTacticType}
          topLeftOverlayContent={youthTrainingControls}
          optimizeDisabled={!manualReady}
          optimizeDisabledReason={optimizeDisabledReason}
          optimizeStarPlayerName={optimizeStarPlayerName}
          optimizePrimaryTrainingName={optimizePrimaryTrainingName}
          optimizeSecondaryTrainingName={optimizeSecondaryTrainingName}
          optimizeModeDisabledReasons={optimizeModeDisabledReasons}
          optimizeCustomMenuContent={optimizeCustomMenuContent}
          trainedSlots={trainingSlots}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
          hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
          onHoverPlayer={ensureDetails}
          onSelectPlayer={(playerId) => {
            setSelectedId(playerId);
            void ensureDetails(playerId);
          }}
          onEmptySlotSelect={setMobileYouthLineupPickerSlotId}
          allowExternalPlayerDrop={false}
          messages={messages}
        />
        <UpcomingMatches
          response={matchesState}
          messages={messages}
          assignments={assignments}
          behaviors={behaviors}
          captainId={null}
          penaltyKickerIds={[]}
          setPiecesId={null}
          tacticType={tacticType}
          onRefresh={async () => {
            try {
              await refreshMatches();
              return true;
            } catch {
              return false;
            }
          }}
          onLoadLineup={loadLineup}
          loadedMatchId={loadedMatchId}
          onSubmitSuccess={() => setShowTrainingReminder(true)}
        />
      </div>
    ) : mobileYouthView === "playerDetails" ? (
      <div className={styles.mobileYouthContent}>
        <div className={`${styles.card} ${styles.mobileYouthPlaceholderCard}`}>
          <h2 className={styles.sectionTitle}>{messages.mobileYouthRootTitle}</h2>
          <p className={styles.muted}>{messages.mobileYouthRootPrompt}</p>
        </div>
      </div>
    ) : (
      <div className={styles.mobileYouthContent}>
        <div className={`${styles.card} ${styles.mobileYouthPlaceholderCard}`}>
          <h2 className={styles.sectionTitle}>{mobileYouthViewLabel}</h2>
          <p className={styles.muted}>{messages.mobileYouthViewComingSoon}</p>
        </div>
      </div>
    );

  return (
    <div className={styles.dashboardStack}>
      {loadError && !authError ? (
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
      <TransferSearchModal
        open={transferSearchModalOpen}
        messages={messages}
        selectedPlayerName={selectedTransferSearchPlayerName}
        selectedPlayerDetailPills={selectedTransferSearchPlayerDetailPills}
        selectedPlayerDetailPillsInline
        filters={transferSearchFilters}
        skillSlotCount={4}
        loading={transferSearchLoading}
        onUpdateSkillFilter={updateTransferSearchSkillFilter}
        onAddSkillFilter={addTransferSearchSkillFilter}
        onUpdateFilterField={updateTransferSearchFilterField}
        onSearch={(filters) => {
          void runTransferSearch(filters);
        }}
        resultCountLabel={transferSearchResultCountLabel}
        exactEmpty={transferSearchExactEmpty}
        fallbackNotice={messages.youthEstimateValueFallbackNotice}
        error={transferSearchError}
        results={transferSearchResults}
        renderResultCard={renderTransferSearchResultCard}
        onClose={() => setTransferSearchModalOpen(false)}
      />
      <Modal
        open={authError}
        title={messages.authExpiredTitle}
        body={
          <div>
            <p>{messages.authExpiredBody}</p>
            {authErrorDetails ? (
              <p className={styles.errorDetails}>{authErrorDetails}</p>
            ) : null}
            {process.env.NODE_ENV !== "production" && authErrorDebugDetails ? (
              <pre className={styles.errorDetails}>{authErrorDebugDetails}</pre>
            ) : null}
          </div>
        }
        actions={
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={() => setAuthError(false)}
            >
              {messages.authExpiredDismiss}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={() => {
                void reconnectChppWithTokenReset();
              }}
            >
              {messages.authExpiredAction}
            </button>
          </div>
        }
      />
      <Modal
        open={Boolean(serviceErrorModal)}
        title={serviceErrorModal?.title ?? messages.unableToLoadPlayers}
        body={
          <div>
            <p>
              {serviceErrorModal?.statusCode !== null &&
              serviceErrorModal?.statusCode !== undefined
                ? serviceErrorModal.statusCode >= 500
                  ? messages.oauthErrorServerExplanation
                  : serviceErrorModal.statusCode >= 400
                    ? messages.oauthErrorClientExplanation
                    : messages.oauthErrorUnknownExplanation
                : messages.oauthErrorUnknownExplanation}
            </p>
            {serviceErrorModal?.details ? (
              <p className={styles.errorDetails}>{serviceErrorModal.details}</p>
            ) : null}
            <p className={styles.errorDetails}>{messages.oauthErrorRecoveryHint}</p>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setServiceErrorModal(null)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setServiceErrorModal(null)}
      />
      <div
        className={mobileYouthActive ? styles.mobileYouthShell : styles.dashboardGrid}
        ref={dashboardRef}
      >
        <Modal
        open={showTrainingReminder}
        title={messages.trainingReminderTitle}
        body={trainingReminderText}
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setShowTrainingReminder(false)}
          >
            {messages.trainingReminderConfirm}
          </button>
        }
      />
      <Modal
        open={!!optimizeErrorMessage}
        title={messages.optimizeMenuRevealPrimaryCurrent}
        body={optimizeErrorMessage ?? ""}
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setOptimizeErrorMessage(null)}
          >
            {messages.trainingReminderConfirm}
          </button>
        }
      />
      <Modal
        open={showChangelog}
        title={messages.changelogTitle}
        movable={false}
        body={
          <div className={styles.changelogBody}>
            <div className={styles.changelogTable}>
              <div className={styles.changelogRowHeader}>
                <span>{messages.changelogVersionLabel}</span>
                <span>{messages.changelogEntryLabel}</span>
              </div>
              {changelogPageRows.map((row, index) => (
                <div
                  key={`${row.version}-${changelogPageStart + index}`}
                  className={styles.changelogRow}
                >
                  <span className={styles.changelogVersion}>v{row.version}</span>
                  <span className={styles.changelogText}>{row.text}</span>
                </div>
              ))}
            </div>
            <div className={styles.changelogPagination}>
              <span className={styles.changelogPageLabel}>
                {messages.changelogPageLabel
                  .replace("{{current}}", String(changelogPageIndex + 1))
                  .replace("{{total}}", String(changelogTotalPages))}
              </span>
              <div className={styles.changelogPageButtons}>
                <button
                  type="button"
                  className={styles.confirmCancel}
                  onClick={() =>
                    setChangelogPage((prev) => Math.max(0, prev - 1))
                  }
                  disabled={changelogPageIndex === 0}
                >
                  {messages.changelogNewer}
                </button>
                <button
                  type="button"
                  className={styles.confirmSubmit}
                  onClick={() =>
                    setChangelogPage((prev) =>
                      Math.min(changelogTotalPages - 1, prev + 1)
                    )
                  }
                  disabled={changelogPageIndex >= changelogTotalPages - 1}
                >
                  {messages.changelogOlder}
                </button>
              </div>
            </div>
          </div>
        }
        closeOnBackdrop
        onClose={() => setShowChangelog(false)}
      />
      <Modal
        open={youthUpdatesOpen}
        title={messages.clubChronicleUpdatesTitle}
        className={styles.seniorUpdatesModal}
        movable={false}
        body={
          youthUpdatesHistoryWithChanges.length > 0 ? (
            <div className={styles.seniorUpdatesShell}>
              <div className={styles.seniorUpdatesTopBar}>
                {selectedYouthUpdatesEntry ? (
                  <span className={styles.seniorUpdatesComparedAt}>
                    {messages.clubChronicleUpdatesComparedAt}:{" "}
                    {formatDateTime(selectedYouthUpdatesEntry.comparedAt)}
                  </span>
                ) : null}
              </div>
              <div className={styles.seniorUpdatesGrid}>
                <aside className={styles.seniorUpdatesHistoryPane}>
                  <div className={styles.seniorUpdatesHistoryHeader}>
                    {messages.clubChronicleUpdatesHistoryTitle}
                  </div>
                  <div className={styles.seniorUpdatesHistoryList}>
                    {youthUpdatesHistoryWithChanges.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`${styles.seniorUpdatesHistoryItem}${
                          selectedYouthUpdatesEntry?.id === entry.id
                            ? ` ${styles.seniorUpdatesHistoryItemActive}`
                            : ""
                        }`}
                        onClick={() => setSelectedYouthUpdatesId(entry.id)}
                        aria-pressed={selectedYouthUpdatesEntry?.id === entry.id}
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
                  {selectedYouthUpdatesEntry && youthUpdatesRows.length ? (
                    <>
                      {youthUpdatesRows.map((entry) => (
                        <article
                          key={entry.playerId}
                          className={styles.seniorUpdatesPlayerCard}
                        >
                          <div className={styles.seniorUpdatesPlayerHeader}>
                            <h4 className={styles.seniorUpdatesPlayerName}>
                              {entry.playerName}
                            </h4>
                            {entry.isNewPlayer ? (
                              <span className={styles.matrixNewPill}>
                                {messages.youthUpdatesNewPlayerLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className={styles.seniorUpdatesPlayerBody}>
                            {entry.skillsCurrent.length > 0 ? (
                              <div className={styles.seniorUpdatesSection}>
                                <h5 className={styles.seniorUpdatesSectionTitle}>
                                  {messages.skillsLabel}
                                </h5>
                                <ul className={styles.seniorUpdatesChangeList}>
                                  {entry.skillsCurrent.map((change) => (
                                    <li
                                      key={`${entry.playerId}-current-${change.skillKey}`}
                                    >
                                      {skillLabelByKey(change.skillKey)} (
                                      {messages.youthUpdatesSkillCurrentTag}):{" "}
                                      {formatUpdatesValue(change.previous, "skill")} →{" "}
                                      {formatUpdatesValue(change.current, "skill")}
                                    </li>
                                  ))}
                                  {entry.skillsMax.map((change) => (
                                    <li key={`${entry.playerId}-max-${change.skillKey}`}>
                                      {skillLabelByKey(change.skillKey)} (
                                      {messages.youthUpdatesSkillMaxTag}):{" "}
                                      {formatUpdatesValue(change.previous, "skill")} →{" "}
                                      {formatUpdatesValue(change.current, "skill")}
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
                                      {formatUpdatesValue(change.previous, "rating")} →{" "}
                                      {formatUpdatesValue(change.current, "rating")}
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
                                      {youthUpdatesAttributeLabel(change.key)}:{" "}
                                      {formatYouthUpdatesAttributeValue(
                                        change.key,
                                        change.previous
                                      )}{" "}
                                      →{" "}
                                      {formatYouthUpdatesAttributeValue(
                                        change.key,
                                        change.current
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </>
                  ) : (
                    <p className={styles.chronicleEmpty}>
                      {messages.clubChronicleUpdatesNoChangesGlobal}
                    </p>
                  )}
                </section>
              </div>
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
            onClick={() => setYouthUpdatesOpen(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setYouthUpdatesOpen(false)}
      />
      <Modal
        open={Boolean(mobileYouthLineupPickerSlotId)}
        title={messages.mobileYouthLineupPickerTitle}
        movable={false}
        body={
          mobileYouthLineupPickerPlayers.length > 0 ? (
            <div className={styles.mobileYouthLineupPickerList}>
              {mobileYouthLineupPickerPlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={styles.mobileYouthLineupPickerOption}
                  onClick={() => {
                    if (!mobileYouthLineupPickerSlotId) return;
                    assignPlayer(mobileYouthLineupPickerSlotId, player.id);
                    setMobileYouthLineupPickerSlotId(null);
                  }}
                >
                  <span className={styles.mobileYouthLineupPickerName}>
                    {player.name}
                  </span>
                  <span className={styles.mobileYouthLineupPickerMeta}>
                    {player.age !== null
                      ? `${player.age}${messages.ageYearsShort}`
                      : messages.unknownShort}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.muted}>{messages.mobileYouthLineupPickerEmpty}</p>
          )
        }
        actions={
          <button
            type="button"
            className={styles.confirmCancel}
            onClick={() => setMobileYouthLineupPickerSlotId(null)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setMobileYouthLineupPickerSlotId(null)}
      />
      {mobileYouthActive ? (
        <>
          <MobileToolMenu
            messages={messages}
            toggleLabel={messages.mobileYouthMenuToggleLabel}
            teamLabel={messages.youthTeamLabel}
            teamOptions={youthTeams.map((team) => ({
              id: team.youthTeamId,
              label: team.youthTeamName,
            }))}
            selectedTeamId={selectedYouthTeamId}
            onHome={openMobileYouthHome}
            onOpenHelp={() => pushMobileYouthState("help", "root")}
            onOpenPlayerList={() => pushMobileYouthState("playerDetails", "list")}
            onTeamChange={handleTeamChange}
            onRefresh={() => {
              void refreshPlayers(undefined, { refreshAll: true, reason: "manual" });
            }}
            onOpenUpdates={() => setYouthUpdatesOpen(true)}
            activeView={mobileYouthView}
            playerListActive={
              mobileYouthView === "playerDetails" && mobileYouthPlayerScreen === "list"
            }
            onSelectView={handleMobileYouthViewSelect}
            position={mobileYouthMenuPosition}
            onPositionChange={setMobileYouthMenuPosition}
          />
          {mobileYouthRefreshFeedbackVisible && mobileYouthRefreshStatus ? (
            <div className={styles.mobileYouthRefreshStatus} aria-live="polite">
              <span className={styles.mobileYouthRefreshStatusText}>
                {mobileYouthRefreshStatus}
              </span>
              {playersLoading ? (
                <span className={styles.mobileYouthRefreshProgressTrack} aria-hidden="true">
                  <span
                    className={styles.mobileYouthRefreshProgressFill}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, playerRefreshProgressPct || 0)
                      )}%`,
                    }}
                  />
                </span>
              ) : null}
            </div>
          ) : null}
          {mobileYouthContent}
        </>
      ) : (
        <>
      {showHelp ? (
        <div className={styles.helpOverlay} aria-hidden="true">
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
      <div
        className={showHelp ? styles.helpDisabledColumn : undefined}
        aria-hidden={showHelp ? "true" : undefined}
      >
        <YouthPlayerList
          dataHelpAnchor="player-list"
          players={playerList}
          playerDetailsById={playerDetailsById}
          orderedPlayerIds={orderedPlayerIds}
          orderSource={orderSource}
          youthTeams={youthTeams}
          selectedYouthTeamId={selectedYouthTeamId}
          onTeamChange={handleTeamChange}
          assignedIds={assignedIds}
          selectedId={selectedId}
          starPlayerId={starPlayerId}
          highlightStarSelection={highlightMissingStarSelection}
          onSortStart={() => {
            setOrderSource("list");
            setOrderedPlayerIds(null);
          }}
          onToggleStar={(playerId) => {
            const nextIsClear = starPlayerId === playerId;
            setStarPlayerId((prev) => (prev === playerId ? null : playerId));
            setAutoSelectionApplied(false);
            if (nextIsClear) {
              addNotification(messages.notificationStarCleared);
              return;
            }
            void handleSelect(playerId);
            const training = getTrainingForStar(
              optimizerPlayers,
              playerId,
              trainingPreferences
            );
            if (!training) {
              setPrimaryTraining(DEFAULT_PRIMARY_TRAINING);
              setSecondaryTraining(DEFAULT_SECONDARY_TRAINING);
              return;
            }
            setPrimaryTraining(training.primarySkill);
            setSecondaryTraining(
              training.secondarySkill ?? DEFAULT_SECONDARY_TRAINING
            );
            const playerName =
              optimizerPlayers.find((player) => player.id === playerId)?.name ??
              playerId;
            const primaryLabel = trainingLabel(training.primarySkill);
            const secondaryLabel = trainingLabel(training.secondarySkill);
            addNotification(
              `${messages.notificationStarSet} ${playerName} · ${primaryLabel} / ${secondaryLabel}`
            );
          }}
          onSelect={handleSelect}
          onAutoSelect={() => {
            if (!autoSelection) return;
            setStarPlayerId(autoSelection.starPlayerId);
            setPrimaryTraining(autoSelection.primarySkill);
            setSecondaryTraining(
              autoSelection.secondarySkill ?? DEFAULT_SECONDARY_TRAINING
            );
            setAutoSelectionApplied(true);
            const playerName =
              optimizerPlayers.find(
                (player) => player.id === autoSelection.starPlayerId
              )?.name ?? autoSelection.starPlayerId;
            const primaryLabel = trainingLabel(autoSelection.primarySkill);
            const secondaryLabel = trainingLabel(autoSelection.secondarySkill);
            addNotification(
              `${messages.notificationAutoSelection} ${playerName} · ${primaryLabel} / ${secondaryLabel}`
            );
          }}
          onOrderChange={(ids) => applyPlayerOrder(ids, "list")}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
          hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
          newMarkerPlayerIds={listNewMarkerPlayerIds}
          messages={messages}
        />
      </div>
      <div className={styles.columnStack}>
        {showHelp ? (
          <div
            className={styles.helpCard}
            style={{ marginTop: `${helpCardTopOffset}px` }}
          >
            <h2 className={styles.helpTitle}>{messages.helpTitle}</h2>
            <p className={styles.helpIntro}>{messages.helpIntro}</p>
            <ul className={styles.helpList}>
              <li>{messages.helpBulletOverview}</li>
              <li>{messages.helpBulletWorkflow}</li>
              <li>{messages.helpBulletMatches}</li>
              <li>{messages.helpBulletAdjust}</li>
              <li>{messages.helpBulletOptimizerModes}</li>
              <li>{messages.helpBulletTraining}</li>
            </ul>
            <button
              type="button"
              className={styles.helpDismiss}
              onClick={() => {
                setShowHelp(false);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(
                    helpStorageKey,
                    currentToken ?? "1"
                  );
                }
              }}
            >
              {messages.helpDismissLabel}
            </button>
          </div>
        ) : (
          <>
            <PlayerDetailsPanel
              selectedPlayer={selectedPlayer}
              detailsData={detailsData}
              loading={loading}
              error={error}
              lastUpdated={lastUpdated}
              unlockStatus={unlockStatus}
              onRefresh={() =>
                selectedId ? handlePlayerDetailsRefresh() : undefined
              }
              players={playerList}
              playerDetailsById={playerDetailsById}
              skillsMatrixRows={skillsMatrixRows}
              ratingsMatrixResponse={ratingsMatrixData?.response ?? null}
              ratingsMatrixMatchHrefBuilder={ratingsMatrixMatchHrefBuilder}
              ratingsMatrixSelectedName={
                selectedPlayer ? formatPlayerName(selectedPlayer) : null
              }
              ratingsMatrixSpecialtyByName={Object.fromEntries(
                playerList.map((player) => [
                  [player.FirstName, player.NickName || null, player.LastName]
                    .filter(Boolean)
                    .join(" "),
                  Number(player.Specialty ?? 0) > 0
                    ? player.Specialty
                    : hiddenSpecialtyByPlayerId[player.YouthPlayerID],
                ])
              )}
              ratingsMatrixHiddenSpecialtyByName={Object.fromEntries(
                playerList.map((player) => [
                  [player.FirstName, player.NickName || null, player.LastName]
                    .filter(Boolean)
                    .join(" "),
                  Number(player.Specialty ?? 0) <= 0 &&
                    Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0,
                ])
              )}
              matrixNewPlayerIds={newPlayerNameMarkerIds}
              matrixNewRatingsByPlayerId={activeMatrixNewMarkers.ratingsByPlayerId}
              matrixNewSkillsCurrentByPlayerId={
                activeMatrixNewMarkers.skillsCurrentByPlayerId
              }
              matrixNewSkillsMaxByPlayerId={
                activeMatrixNewMarkers.skillsMaxByPlayerId
              }
              scoutImportantSkillsByPlayerId={scoutImportantSkillsByPlayerId}
              scoutOverallSkillLevelByPlayerId={scoutOverallSkillLevelByPlayerId}
              hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
              hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
              ratingsMatrixHiddenSpecialtyMatchHrefByName={
                ratingsMatrixHiddenSpecialtyMatchHrefByName
              }
              onSelectRatingsPlayer={(playerName) => {
                const match = playerList.find(
                  (player) => formatPlayerName(player) === playerName
                );
                if (!match) return;
                if (selectedId === match.YouthPlayerID) return;
                handleSelect(match.YouthPlayerID);
                addNotification(
                  `${messages.notificationPlayerSelected} ${playerName}`
                );
              }}
              onMatrixPlayerDragStart={handleMatrixPlayerDragStart}
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
                void handleSelect(previousPlayerId);
              }}
              onNextPlayer={() => {
                if (!nextPlayerId) return;
                void handleSelect(nextPlayerId);
              }}
              detailsHeaderActions={youthDetailsHeaderActions}
              activeTab={activeDetailsTab}
              onActiveTabChange={setActiveDetailsTab}
              messages={messages}
            />
          </>
        )}
      </div>
      <div
        className={`${styles.columnStack} ${
          showHelp ? styles.helpDisabledColumn : ""
        }`}
        aria-hidden={showHelp ? "true" : undefined}
      >
        <LineupField
          assignments={assignments}
          behaviors={behaviors}
          playersById={playersById}
          playerDetailsById={playerDetailsById}
          onAssign={assignPlayer}
          onClear={clearSlot}
          onMove={moveSlot}
          onChangeBehavior={handleBehaviorChange}
          onRandomize={randomizeLineup}
          onReset={resetLineup}
          onOptimizeSelect={handleOptimizeSelect}
          tacticType={tacticType}
          onTacticChange={setTacticType}
          topLeftOverlayContent={youthTrainingControls}
          optimizeDisabled={!manualReady}
          optimizeDisabledReason={optimizeDisabledReason}
          forceOptimizeOpen={showHelp}
          optimizeStarPlayerName={optimizeStarPlayerName}
          optimizePrimaryTrainingName={optimizePrimaryTrainingName}
          optimizeSecondaryTrainingName={optimizeSecondaryTrainingName}
          optimizeModeDisabledReasons={optimizeModeDisabledReasons}
          optimizeCustomMenuContent={optimizeCustomMenuContent}
          onOptimizeDisabledHoverChange={(hovering) => {
            setHighlightMissingStarControls(
              hovering && optimizeDisabledForMissingStar
            );
          }}
          trainedSlots={trainingSlots}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
          hiddenSpecialtyMatchHrefByPlayerId={hiddenSpecialtyMatchHrefByPlayerId}
          onHoverPlayer={ensureDetails}
          onSelectPlayer={(playerId) => {
            if (activeDetailsTab === "details") {
              void handleSelect(playerId);
              return;
            }
            setSelectedId(playerId);
            void ensureDetails(playerId);
          }}
          messages={messages}
        />
        {isDev ? (
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>{messages.optimizerDebugTitle}</h2>
            <div className={styles.devTeamRow}>
              <label className={styles.devTeamLabel}>
                {messages.devManagerUserIdLabel}
              </label>
              <div className={styles.devTeamControls}>
                <input
                  type="text"
                  className={styles.devTeamInput}
                  placeholder={messages.devManagerUserIdPlaceholder}
                  value={devManagerUserId}
                  onChange={(event) => setDevManagerUserId(event.target.value)}
                />
                <button
                  type="button"
                  className={styles.devTeamButton}
                  onClick={() =>
                    fetchManagerCompendium(devManagerUserId.trim() || undefined)
                  }
                >
                  {messages.devManagerLoadTeams}
                </button>
              </div>
            </div>
            <div className={styles.devTeamRow}>
              <label className={styles.devTeamLabel}>
                {messages.devOauthErrorSimLabel}
              </label>
              <div className={styles.devTeamControls}>
                <select
                  className={styles.sortSelect}
                  value={debugOauthErrorMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as ChppDebugOauthErrorMode;
                    setDebugOauthErrorMode(nextMode);
                    writeChppDebugOauthErrorMode(nextMode);
                    addNotification(
                      `${messages.notificationDebugOauthMode} ${
                        nextMode === "4xx"
                          ? messages.devOauthErrorSim4xx
                          : nextMode === "5xx"
                            ? messages.devOauthErrorSim5xx
                            : messages.devOauthErrorSimOff
                      }`
                    );
                  }}
                >
                  <option value="off">{messages.devOauthErrorSimOff}</option>
                  <option value="4xx">{messages.devOauthErrorSim4xx}</option>
                  <option value="5xx">{messages.devOauthErrorSim5xx}</option>
                </select>
              </div>
            </div>
            <p className={styles.muted}>{messages.devOauthErrorSimHint}</p>
            <Tooltip
              content={
                optimizerDebug
                  ? messages.optimizerDebugOpen
                  : messages.optimizerDebugUnavailable
              }
            >
              <button
                type="button"
                className={styles.optimizerOpen}
                onClick={() => setShowOptimizerDebug(true)}
                disabled={!optimizerDebug}
                aria-label={
                  optimizerDebug
                    ? messages.optimizerDebugOpen
                    : messages.optimizerDebugUnavailable
                }
              >
                {messages.optimizerDebugOpen}
              </button>
            </Tooltip>
          </div>
        ) : null}
        {isDev && optimizerDebug && showOptimizerDebug ? (
          <div
            className={styles.optimizerOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={messages.optimizerDebugTitle}
          >
            <div
              className={styles.optimizerModal}
              ref={optimizerModalRef}
              style={{
                transform: `translate(calc(-50% + ${optimizerDragOffset.x}px), calc(-50% + ${optimizerDragOffset.y}px))`,
              }}
            >
              <div
                className={styles.optimizerModalHeader}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  const target = event.target as HTMLElement;
                  if (target.closest("button")) return;
                  optimizerDragStart.current = {
                    x: event.clientX,
                    y: event.clientY,
                    offsetX: optimizerDragOffset.x,
                    offsetY: optimizerDragOffset.y,
                  };
                  setOptimizerDragging(true);
                }}
              >
                <h3 className={styles.optimizerModalTitle}>
                  {messages.optimizerDebugTitle}
                </h3>
                <button
                  type="button"
                  className={styles.optimizerClose}
                  onClick={() => setShowOptimizerDebug(false)}
                >
                  {messages.closeLabel}
                </button>
              </div>
              <div className={styles.optimizerModalBody}>
                <div className={styles.optimizerSection}>
                  <h4 className={styles.optimizerHeading}>
                    {messages.optimizerSelectionLabel}
                  </h4>
                  <table className={styles.optimizerTable}>
                    <tbody>
                      <tr>
                        <th>{messages.optimizerSelectionStar}</th>
                        <td>
                          {optimizerDebug.primary.list.find(
                            (entry) =>
                              entry.playerId === optimizerDebug.selection.starPlayerId
                          )?.name ?? optimizerDebug.selection.starPlayerId}
                        </td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSelectionPrimary}</th>
                        <td>{trainingLabel(optimizerDebug.selection.primarySkill)}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSelectionSecondary}</th>
                        <td>
                          {trainingLabel(optimizerDebug.selection.secondarySkill)}
                        </td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSelectionAuto}</th>
                        <td>
                          {optimizerDebug.selection.autoSelected
                            ? messages.yesLabel
                            : messages.noLabel}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {optimizerDebug.starSelectionRanks ? (
                  <div className={styles.optimizerSection}>
                    <h4 className={styles.optimizerHeading}>
                      {messages.optimizerStarRanksLabel}
                    </h4>
                    <table className={styles.optimizerTable}>
                      <thead>
                        <tr>
                          <th>{messages.optimizerColumnPlayer}</th>
                          <th>{messages.optimizerColumnCategory}</th>
                          <th>{messages.optimizerColumnValue}</th>
                          <th>{messages.optimizerColumnRank}</th>
                          <th>{messages.optimizerColumnAge}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...optimizerDebug.starSelectionRanks]
                          .sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            if (a.age === null || a.age === undefined) return 1;
                            if (b.age === null || b.age === undefined) return -1;
                            return a.age - b.age;
                          })
                          .map((entry) => (
                            <tr key={`${entry.playerId}-${entry.skill}`}>
                              <td>{entry.name ?? entry.playerId}</td>
                              <td>{trainingLabel(entry.skill)}</td>
                              <td>
                                {(entry.current ?? messages.unknownShort).toString()}/
                                {(entry.max ?? messages.unknownShort).toString()}
                              </td>
                              <td>{entry.score}</td>
                              <td>{entry.age ?? messages.unknownShort}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className={styles.optimizerSection}>
                  <h4 className={styles.optimizerHeading}>
                    {messages.optimizerPrimaryLabel}
                  </h4>
                  <table className={styles.optimizerTable}>
                    <thead>
                      <tr>
                        <th>{messages.optimizerColumnPlayer}</th>
                        <th>{messages.optimizerColumnCategory}</th>
                        <th>{messages.optimizerColumnCurrent}</th>
                        <th>{messages.optimizerColumnMax}</th>
                        <th>{messages.optimizerColumnRank}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optimizerDebug.primary.list.map((entry) => (
                        <tr key={entry.playerId}>
                          <td>{entry.name ?? entry.playerId}</td>
                          <td>{optimizerCategoryLabel(entry.category)}</td>
                          <td>{entry.current ?? messages.unknownShort}</td>
                          <td>{entry.max ?? messages.unknownShort}</td>
                          <td>{entry.rankValue ?? messages.unknownShort}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {optimizerDebug.secondary ? (
                  <div className={styles.optimizerSection}>
                    <h4 className={styles.optimizerHeading}>
                      {messages.optimizerSecondaryLabel}
                    </h4>
                    <table className={styles.optimizerTable}>
                      <thead>
                        <tr>
                          <th>{messages.optimizerColumnPlayer}</th>
                          <th>{messages.optimizerColumnCategory}</th>
                          <th>{messages.optimizerColumnCurrent}</th>
                          <th>{messages.optimizerColumnMax}</th>
                          <th>{messages.optimizerColumnRank}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizerDebug.secondary.list.map((entry) => (
                          <tr key={entry.playerId}>
                            <td>{entry.name ?? entry.playerId}</td>
                            <td>{optimizerCategoryLabel(entry.category)}</td>
                            <td>{entry.current ?? messages.unknownShort}</td>
                            <td>{entry.max ?? messages.unknownShort}</td>
                            <td>{entry.rankValue ?? messages.unknownShort}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className={styles.optimizerSection}>
                  <h4 className={styles.optimizerHeading}>
                    {messages.optimizerSlotsLabel}
                  </h4>
                  <table className={styles.optimizerTable}>
                    <tbody>
                      <tr>
                        <th>{messages.optimizerSlotsPrimary}</th>
                        <td>{optimizerDebug.trainingSlots.primary.join(", ")}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSlotsSecondary}</th>
                        <td>{optimizerDebug.trainingSlots.secondary.join(", ")}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSlotsAll}</th>
                        <td>{optimizerDebug.trainingSlots.all.join(", ")}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSlotsStar}</th>
                        <td>{optimizerDebug.trainingSlots.starSlot}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <UpcomingMatches
          response={matchesState}
          messages={messages}
          assignments={assignments}
          behaviors={behaviors}
          captainId={captainId}
          tacticType={tacticType}
          onRefresh={refreshMatchesWithScopeGuard}
          onLoadLineup={loadLineup}
          loadedMatchId={loadedMatchId}
          onSubmitSuccess={() => setShowTrainingReminder(true)}
        />
      </div>
      </>
      )}
    </div>
    </div>
  );
}
