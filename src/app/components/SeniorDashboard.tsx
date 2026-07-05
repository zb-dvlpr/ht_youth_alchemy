"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import {
  CSSProperties,
  Fragment,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
  hattrickMatchUrlWithSourceSystem,
  hattrickPlayerUrl,
  hattrickTeamUrl,
} from "@/lib/hattrick/urls";
import { extractManagerIdentityFromManagerCompendium } from "@/lib/hattrick/managerIdentity";
import { computeFoxtrickHatstats } from "@/lib/hattrick/hatstats";
import {
  readSeniorLineupAlgorithm,
  readSeniorDebugManagerUserId,
  SENIOR_DEBUG_MANAGER_USER_ID_EVENT,
  SENIOR_DEBUG_MANAGER_USER_ID_STORAGE_KEY,
  readSeniorStalenessDays,
  SENIOR_RATINGS_WIPE_EVENT,
  SENIOR_SETTINGS_EVENT,
  SENIOR_SETTINGS_STORAGE_KEY,
  writeSeniorLineupAlgorithm,
  type SeniorLineupAlgorithm,
} from "@/lib/settings";
import {
  SENIOR_OPEN_FIND_SIMILAR_PLAYERS_EVENT,
  SENIOR_REMINDER_CONTEXT_EVENT,
  type SeniorFindSimilarPlayersEventDetail,
  type SeniorReminderContextEventDetail,
} from "@/lib/reminders/senior";
import {
  updateSeniorSalaryBaseline,
  type SeniorSalaryIncreaseEvent,
} from "@/lib/reminders/seniorSalaryBaseline";
import { readReminderStorageState } from "@/lib/reminders/storage";
import Modal from "./Modal";
import AppLicenseModal, { type AppLicenseModalContext } from "./AppLicenseModal";
import { useSupporterStatus } from "./SupporterStatusProvider";
import { useChppPermissions } from "./ChppPermissionsProvider";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import StartupLoadingExperience from "./StartupLoadingExperience";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import MobileToolMenu, { type MobileToolView as SeniorMobileView } from "./MobileToolMenu";
import PlayerDetailsPanel, {
  type PlayerDetailsPanelTab,
} from "./PlayerDetailsPanel";
import OriginFlag from "./OriginFlag";
import {
  isOriginFlagDisplay,
  resolveLeagueOriginFlagDisplay,
  type OriginFlagDisplay,
} from "@/lib/originFlag";
import LineupField, { LineupAssignments, LineupBehaviors } from "./LineupField";
import {
  type LoadedLineupOrders,
  type IgnoreTrainingFormationPolicy,
  Match,
  MatchOrdersLineupPayload,
  MatchesResponse,
} from "./UpcomingMatches";
import type { SetBestLineupMode } from "./UpcomingMatches";
import SeniorMatchesPanel from "./SeniorMatchesPanel";
import Tooltip from "./Tooltip";
import TransferSearchModal, {
  calculateTransferSearchSkillTradingScore,
  resolveTransferSearchMinimumBidSek,
  toHattrickTransferSearchPriceFilterParam,
  type TransferSearchResolvedCountryMeta,
  type TransferSearchSortKey,
  type TransferSearchResultsViewMode,
  type TransferSearchHtmsPotentialFilter,
  type TransferSearchTableRowData,
} from "./TransferSearchModal";
import {
  displayAmountToSek,
  formatSekCurrency,
  sekToDisplayAmount,
  type DisplayCurrency,
} from "@/lib/currency";
import { useDisplayCurrency } from "./DisplayCurrencyProvider";
import TransferSearchResultCard from "./TransferSearchResultCard";
import TeamScoutDetailTable, {
  type TeamScoutDetailSortState,
  type TeamScoutLikelyTrainingInfo,
  type TeamScoutPlayerRow,
} from "./TeamScoutDetailTable";
import { loadTeamScoutDerivedData } from "@/lib/clubChronicle/teamScoutDetailData";
import { buildTeamScoutPlayerRows } from "@/lib/clubChronicle/teamScoutDetailRows";
import type { TeamScoutBasePlayer } from "@/lib/clubChronicle/teamScoutDetailRows";
import { useTransferMarketProfileSave } from "./useTransferMarketProfileSave";
import SeniorTransferListedIndicator, {
  type SeniorTransferListing,
} from "./SeniorTransferListedIndicator";
import { setDragGhost } from "@/lib/drag";
import {
  POSITION_COLUMNS,
  matchRoleIdToPositionKey,
  positionLabel,
} from "@/lib/positions";
import { readGlobalSeason, writeGlobalSeason } from "@/lib/season";
import type { CoachLeadership } from "@/lib/teamSpirit";
import { parseCoachLeadership } from "@/lib/clubChronicle/coach";
import {
  captureSeniorEncounteredPlayer,
  type SeniorEncounterSource,
} from "@/lib/seniorEncounteredPlayerModel";
import {
  calculateHtmsMetrics,
  calculatePsicoTsiMetrics,
  type SeniorPlayerMetricInput,
} from "@/lib/seniorPlayerMetrics";
import { calculateEffectiveSkill } from "@/lib/seniorEffectiveSkill";
import {
  APP_LICENSE_EVENT,
  APP_LICENSE_STORAGE_KEY,
  hasUnlockedPremiumAccess,
  readAppLicenseState,
} from "@/lib/license";
import { trackAnalyticsEvent } from "@/lib/analytics";
import LineupExcludeButton from "./LineupExcludeButton";
import {
  isPlayerExcluded,
  pruneSeniorLineupExcludedPlayers,
  readSeniorLineupExcludedPlayers,
  setSeniorLineupExcludedPlayer,
  type ExcludedPlayersState,
} from "@/lib/lineupExclusions";
import {
  resolveMatchSourceSystem,
  resolveOpponentTeam,
} from "@/lib/matches/visibility";
import { buildTransferMarketScopeKey } from "@/lib/transferMarketStorage";

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
  IsAbroad?: boolean;
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
  NativeLeagueID?: number;
  Specialty?: number;
  Form?: number;
  StaminaSkill?: number;
  InjuryLevel?: number;
  Cards?: number;
  TSI?: number;
  Salary?: number;
  IsAbroad?: boolean;
  OwningTeam?: {
    LeagueID?: number;
  };
  PersonalityStatement?: string;
  Statement?: string;
  Agreeability?: number;
  Aggressiveness?: number;
  Honesty?: number;
  Experience?: number;
  Leadership?: number;
  Loyalty?: number;
  MotherClubBonus?: boolean;
  CareerGoals?: number;
  CareerHattricks?: number;
  LeagueGoals?: number;
  CupGoals?: number;
  FriendliesGoals?: number;
  Caps?: number;
  CapsU20?: number;
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
  TransferListed?: boolean;
  TransferDetails?: {
    AskingPrice?: number;
    Deadline?: string;
    HighestBid?: number;
    BidderTeam?: {
      TeamID?: number;
      TeamName?: string;
    };
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

type ObservedSeniorSelectionSnapshot = {
  selectedId: number | null;
  activeDetailsTab: PlayerDetailsPanelTab;
};

type ObservedSeniorPlayerState = {
  player: SeniorPlayer;
  details: SeniorPlayerDetails;
  fetchedAt: number;
  restore: ObservedSeniorSelectionSnapshot;
};

type SeniorLeagueOrigin = {
  leagueId: number;
  leagueName: string;
  trainingDate: string;
  countryCode?: string;
  flagDisplay?: OriginFlagDisplay;
};

type SeniorLeagueOriginsCache = {
  schemaVersion: number;
  fetchedAt: number;
  originsByLeagueId: Record<number, SeniorLeagueOrigin>;
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

type SeniorManualRatingsEdits = Record<number, Record<string, number>>;

type SeniorFeatureAnalyticsName =
  | "player_selected"
  | "find_similar_players_clicked"
  | "lineup_b_team_toggled"
  | "lineup_man_marking_toggled"
  | "lineup_training_aware_submitted"
  | "lineup_ignore_training_all_formations_submitted"
  | "lineup_ignore_training_trained_formations_submitted"
  | "lineup_aim_for_extra_time_submitted"
  | "lineup_apply_formation_optimization_submitted"
  | "lineup_load_lineup_clicked"
  | "edit_skills_age_wage_tsi_toggled"
  | "ratings_manual_edit_toggled"
  | "ratings_manual_value_edited";

type SeniorSubmittedLineupVariantFeature = Extract<
  SeniorFeatureAnalyticsName,
  | "lineup_training_aware_submitted"
  | "lineup_ignore_training_all_formations_submitted"
  | "lineup_ignore_training_trained_formations_submitted"
  | "lineup_aim_for_extra_time_submitted"
  | "lineup_apply_formation_optimization_submitted"
>;

type SeniorFeatureAnalyticsSource = "desktop" | "mobile";

const seniorMatchesStateHasMatches = (
  state: MatchesResponse | null | undefined
) => {
  const list =
    state?.data?.HattrickData?.MatchList?.Match ??
    state?.data?.HattrickData?.Team?.MatchList?.Match;

  if (Array.isArray(list)) return list.length > 0;
  return Boolean(list);
};

const seniorRatingsHasCells = (
  ratings: RatingsMatrixResponse | null | undefined
) =>
  Boolean(
    ratings &&
      Array.isArray(ratings.players) &&
      ratings.players.some((row) => Object.keys(row.ratings ?? {}).length > 0)
  );

const seniorDataSnapshotHasUsefulData = (snapshot: {
  players?: SeniorPlayer[];
  matchesState?: MatchesResponse;
  ratingsResponse?: RatingsMatrixResponse | null;
  latestFetchedRatingsResponse?: RatingsMatrixResponse | null;
  fetchedRatingsResponse?: RatingsMatrixResponse | null;
  detailsCache?: Record<number, PlayerDetailCacheEntry>;
}) => {
  const playersCount = Array.isArray(snapshot.players) ? snapshot.players.length : 0;

  const detailsCacheCount =
    snapshot.detailsCache && typeof snapshot.detailsCache === "object"
      ? Object.keys(snapshot.detailsCache).length
      : 0;

  return (
    playersCount > 0 ||
    seniorMatchesStateHasMatches(snapshot.matchesState) ||
    seniorRatingsHasCells(snapshot.ratingsResponse) ||
    seniorRatingsHasCells(snapshot.latestFetchedRatingsResponse) ||
    seniorRatingsHasCells(snapshot.fetchedRatingsResponse) ||
    detailsCacheCount > 0
  );
};

type SeniorDashboardProps = {
  messages: Messages;
  initialSeniorTeams?: Array<{
    teamId: number;
    teamName: string;
    leagueId?: number | null;
    countryId?: number | null;
    isPrimaryClub?: boolean;
    teamGender: "male" | "female" | null;
  }>;
  initialSeniorTeamId?: number | null;
  managerScopeId?: string | null;
};

type MobileSeniorPlayerScreen = "root" | "list" | "detail";

type MobileSeniorHistoryState = {
  appShell?: "launcher" | "tool";
  tool?: "youth" | "senior" | "chronicle";
  seniorView?: SeniorMobileView;
  seniorScreen?: MobileSeniorPlayerScreen;
};

type SeniorTeamOption = {
  teamId: number;
  teamName: string;
  leagueId?: number | null;
  countryId?: number | null;
  isPrimaryClub?: boolean;
  teamGender: "male" | "female" | null;
};

type ExtraTimeBTeamRecentMatchState = {
  status: "idle" | "loading" | "ready" | "error";
  recentMatch: {
    matchId: number;
    sourceSystem: string;
    matchDate: string;
  } | null;
  availabilityReason: "missingATeamMatch" | "bTeamAlreadyPlayed" | null;
  availabilityMatch: {
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
  LeagueID?: unknown;
  League?: {
    LeagueID?: unknown;
    LeagueId?: unknown;
    Season?: unknown;
  };
};

type ManagerCompendiumResponse = {
  season?: number | null;
  data?: {
    HattrickData?: {
      Manager?: {
        UserId?: number | string;
        UserID?: number | string;
        Loginname?: string;
        Teams?: {
          Team?: ManagerCompendiumTeam | ManagerCompendiumTeam[];
        };
      };
    };
  };
  error?: string;
  details?: string;
};

type StafflistStaff = {
  StaffType?: unknown;
  StaffLevel?: unknown;
};

type StafflistResponse = {
  data?: {
    HattrickData?: {
      StaffList?: {
        Trainer?: {
          TrainerType?: unknown;
          Leadership?: unknown;
        };
        StaffMembers?: {
          Staff?: StafflistStaff | StafflistStaff[];
        };
      };
    };
  };
  error?: string;
  details?: string;
};

type SeniorTeamGeneralInfo = {
  schemaVersion: 1;
  teamId: number;
  fetchedAt: number;
  hasTacticalAssistant: boolean;
  tacticalAssistantStaffLevel: number | null;
  trainerType: 0 | 1 | 2 | null;
  trainerLeadership: CoachLeadership | null;
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
const MOBILE_LAUNCHER_REQUEST_EVENT = "ya:mobile-launcher-request";
const MOBILE_NAV_TRAIL_STATE_EVENT = "ya:mobile-nav-trail-state";
const MOBILE_NAV_TRAIL_JUMP_EVENT = "ya:mobile-nav-trail-jump";
const MOBILE_SENIOR_MEDIA_QUERY = "(max-width: 900px)";
const SENIOR_HELP_ANCHOR_UPDATES = "[data-help-anchor='senior-latest-updates']";
const SENIOR_HELP_ANCHOR_SET_LINEUP_AI = "[data-help-anchor='senior-set-lineup-ai']";
const SENIOR_HELP_ANCHOR_TRAINING_REGIMEN = `.${styles.lineupTrainingTypeControl}`;
const SENIOR_HELP_ANCHOR_ANALYZE_OPPONENT = `.${styles.matchAnalyzeOpponentWrap}`;

const STATE_STORAGE_KEY = "ya_senior_dashboard_state_v1";
const DATA_STORAGE_KEY = "ya_senior_dashboard_data_v1";
const SENIOR_TEAM_GENERAL_INFO_SCHEMA_VERSION = 1;
const LEAGUE_ORIGINS_STORAGE_KEY = "ya_senior_worlddetails_league_origins_v1";
const LEAGUE_ORIGINS_CACHE_SCHEMA_VERSION = 3;
const LAST_REFRESH_STORAGE_KEY = "ya_senior_last_refresh_ts_v1";
const LIST_SORT_STORAGE_KEY = "ya_senior_player_list_sort_v1";
const SENIOR_HELP_STORAGE_KEY = "ya_senior_help_dismissed_v1";
const SENIOR_UPDATES_SCHEMA_VERSION = 3;
const DETAILS_TTL_MS = 60 * 60 * 1000;
const WORLDDETAILS_TTL_MS = 16 * 7 * 24 * 60 * 60 * 1000;
const SENIOR_DETAILS_CONCURRENCY = 6;
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
const UPDATES_HISTORY_LIMIT = 20;
const FRIENDLY_MATCH_TYPES = new Set<number>([4, 5, 8, 9]);
const LEAGUE_QUALI_MATCH_TYPES = new Set<number>([1, 2]);
const CUP_MATCH_TYPES = new Set<number>([3]);
const LEAGUE_CUP_QUALI_MATCH_TYPES = new Set<number>([1, 2, 3, 6]);
const TOURNAMENT_MATCH_TYPES = new Set<number>([50, 51]);
const SENIOR_ORDER_DEFAULT_MINUTE = -1;
const SENIOR_ORDER_DEFAULT_CONDITION = -1;
const SENIOR_ORDER_DEFAULT_POSITION = -1;
const SENIOR_ORDER_DEFAULT_BEHAVIOUR = -1;
const SENIOR_PLAYER_ORDER_BASE_LIMIT = 5;
const SENIOR_PLAYER_ORDER_MAX_LIMIT = 10;
const SENIOR_BENCH_SUBSTITUTION_LIMIT = 3;
const SENIOR_OTHER_ORDERS_DEFAULT_DEV_TACTICAL_ASSISTANT_LEVEL = 5;
const OPPONENT_ARCHIVE_LIMIT = 20;
const OPPONENT_DETAILS_CONCURRENCY = 6;
const FORMATION_PREDICT_CONCURRENCY = 4;
const SENIOR_AI_MAN_MARKING_SUPPORTED_MODES = new Set<
  Exclude<SetBestLineupMode, "extraTime">
>(["trainingAware", "ignoreTraining", "fixedFormation"]);
const SENIOR_RATINGS_ALGO_VERSION = 7;
const NON_DEPRECATED_TRAINING_TYPES = [9, 3, 8, 5, 7, 4, 2, 11, 12, 10, 6] as const;
const EXTRA_TIME_B_TEAM_MATCH_TYPES = new Set<number>([1, 2, 4, 5, 8, 9]);
const EXTRA_TIME_B_TEAM_PLAYED_MATCH_TYPES = new Set<number>([4, 5, 8, 9]);
const EXTRA_TIME_B_TEAM_DEFAULT_THRESHOLD = 45;
const EXTRA_TIME_B_TEAM_MINIMUM_POOL_SIZE = 18;
const SENIOR_AI_LAST_MATCH_WEEKS_DEFAULT = 3;
const SENIOR_AI_LAST_MATCH_WEEKS_DISABLED = 0;
const SENIOR_AI_LAST_MATCH_WEEKS_MIN = 2;
const SENIOR_AI_LAST_MATCH_WEEKS_MAX = 16;
const SENIOR_AI_MAN_MARKING_FUZZINESS_DEFAULT = 75;
const SENIOR_AI_MAN_MARKING_FUZZINESS_MIN = 30;
const SENIOR_AI_MAN_MARKING_FUZZINESS_MAX = 100;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const HATTRICK_AGE_DAYS_PER_YEAR = 112;
const TRANSFER_SEARCH_MIN_AGE_YEARS = 17;
const TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS =
  TRANSFER_SEARCH_MIN_AGE_YEARS * HATTRICK_AGE_DAYS_PER_YEAR;
const TRANSFER_SEARCH_PAGE_SIZE = 100;
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
const TRANSFER_SEARCH_SKILLS = [
  { key: "KeeperSkill", skillType: 1, labelKey: "skillKeeper", min: 0, max: 20 },
  { key: "DefenderSkill", skillType: 4, labelKey: "skillDefending", min: 0, max: 20 },
  { key: "PlaymakerSkill", skillType: 8, labelKey: "skillPlaymaking", min: 0, max: 20 },
  { key: "WingerSkill", skillType: 6, labelKey: "skillWinger", min: 0, max: 20 },
  { key: "PassingSkill", skillType: 7, labelKey: "skillPassing", min: 0, max: 20 },
  { key: "ScorerSkill", skillType: 5, labelKey: "skillScoring", min: 0, max: 20 },
  { key: "SetPiecesSkill", skillType: 3, labelKey: "skillSetPieces", min: 0, max: 20 },
  { key: "StaminaSkill", skillType: 2, labelKey: "sortStamina", min: 0, max: 9 },
  { key: "Leadership", skillType: 10, labelKey: "clubChronicleCoachColumnLeadership", min: 0, max: 7 },
  { key: "Experience", skillType: 11, labelKey: "sortExperience", min: 0, max: 20 },
] as const;
const TRANSFER_SEARCH_AUTO_SKILL_KEYS = new Set<TransferSearchSkillKey>([
  "KeeperSkill",
  "DefenderSkill",
  "WingerSkill",
  "PlaymakerSkill",
  "ScorerSkill",
  "PassingSkill",
]);

type TransferSearchSkillKey = (typeof TRANSFER_SEARCH_SKILLS)[number]["key"];

type TransferSearchSkillFilter = {
  skillKey: TransferSearchSkillKey | null;
  min: number;
  max: number;
};

type TransferSearchFilters = {
  skillFilters: TransferSearchSkillFilter[];
  specialty: number | null;
  nativeCountryId: number | null;
  ageMinYears: string;
  ageMinDays: string;
  ageMaxYears: string;
  ageMaxDays: string;
  tsiMin: string;
  tsiMax: string;
  priceMinDisplay: string;
  priceMaxDisplay: string;
};

type TransferSearchResult = {
  playerId: number;
  firstName: string;
  nickName: string;
  lastName: string;
  nativeCountryId: number | null;
  specialty: number | null;
  age: number | null;
  ageDays: number | null;
  salarySek: number | null;
  isAbroad: boolean | null;
  tsi: number | null;
  form: number | null;
  experience: number | null;
  leadership: number | null;
  cards: number | null;
  injuryLevel: number | null;
  staminaSkill: number | null;
  keeperSkill: number | null;
  playmakerSkill: number | null;
  scorerSkill: number | null;
  passingSkill: number | null;
  wingerSkill: number | null;
  defenderSkill: number | null;
  setPiecesSkill: number | null;
  askingPriceSek: number | null;
  highestBidSek: number | null;
  deadline: string | null;
  sellerTeamId: number | null;
  sellerTeamName: string | null;
};

type TransferSearchBidDraft = {
  bidDisplay: string;
  maxBidDisplay: string;
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

type SeniorRatingsPredictionMatchContext = {
  matchId: number;
  teamId: number;
  sourceSystem: string;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  opponentName?: string | null;
  matchDate?: string | null;
  displayTitle: string;
  displaySubtitle?: string | null;
};

type GeneratedFormationRow = {
  formation: string;
  assignments: LineupAssignments;
  slotRatings: Record<string, number | null>;
  rejectedPlayerIds: number[];
  nonTraineeAssignmentTrace: NonTraineeAssignmentTraceEntry[];
  predicted: PredictedRatings | null;
  error: string | null;
};

type FixedFormationSlotDiagnostic = {
  slot: string;
  assignedPlayerId: number | null;
  noSlotRatingPlayerIds: number[];
  betterOtherSectorPlayerIds: number[];
  tiedOtherSectorPlayerIds: number[];
  alreadyUsedPlayerIds: number[];
};

type NonTraineeAssignmentRankingEntry = {
  playerId: number;
  slotRating: number | null;
  skillCombo: number;
  form: number;
  stamina: number;
  overall: number;
  ageDays: number;
  bestOtherRowRating: number | null;
  passesRowFit: boolean;
};

type NonTraineeAssignmentTraceEntry = {
  slot: keyof LineupAssignments;
  selectedPlayerId: number | null;
  selectedReason: string;
  ranking: NonTraineeAssignmentRankingEntry[];
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
  trackedPlayers: OpponentTrackedLineupPlayer[];
};

type OpponentTrackedRole = "KP" | "WB" | "CD" | "W" | "IM" | "F";

type OpponentTrackedLineupPlayer = {
  playerId: number;
  role: OpponentTrackedRole;
  name: string;
};

type OpponentTargetPlayer = {
  playerId: number;
  role: OpponentTrackedRole;
  name: string;
  tsi: number;
  stamina: number;
  ageDays: number;
};

type OpponentPotentialTargetPlayer = {
  playerId: number;
  role: OpponentTrackedRole;
  name: string;
  count: number;
  tsi: number | null;
  stamina: number | null;
  ageDays: number | null;
};

type SeniorAiManMarkingRole = "WB" | "IM" | "CD";

type SeniorAiManMarkingMarker = {
  playerId: number;
  role: SeniorAiManMarkingRole;
  name: string;
  tsi: number;
};

type OpponentFormationContext = {
  teamIdValue: number;
  opponentTeamId: number;
  opponentName: string;
  selectedMatchType: number | null;
  selectedMatchSourceSystem: string;
  rows: OpponentFormationRow[];
  manMarkingFuzziness: number;
  potentialManMarkingTargets: OpponentPotentialTargetPlayer[];
  manMarkingTarget: OpponentTargetPlayer | null;
};

type SeniorAiManMarkingSelection = {
  marker: SeniorAiManMarkingMarker;
  target: OpponentTargetPlayer;
};

type SeniorSubmitDisclaimerManMarkingSummary = {
  marker: { id: number; name: string } | null;
  target: { id: number; name: string } | null;
  missingMarker: boolean;
  missingTarget: boolean;
};

type SeniorOtherOrdersSummaryPlayer = {
  id: number;
  name: string;
  setPiecesSkill: number | null;
};

type SeniorOtherOrdersSummarySubstitution = {
  minute: number;
  type: "replace" | "swap" | "reposition" | "special" | "unknown";
  playerIn: SeniorOtherOrdersSummaryPlayer | null;
  playerOut: SeniorOtherOrdersSummaryPlayer | null;
  newPositionId?: number | null;
  newPositionBehaviour?: number | null;
  card?: number | null;
  standing?: number | null;
};

type SeniorOtherOrdersSummaryManMarking = {
  marker: SeniorOtherOrdersSummaryPlayer | null;
  target: SeniorOtherOrdersSummaryPlayer | null;
  missingMarker?: boolean;
  missingTarget?: boolean;
};

type SeniorOtherOrdersSummary = {
  matchId: number;
  source: "generated" | "loaded" | "manual" | "mixed";
  manMarking: SeniorOtherOrdersSummaryManMarking | null;
  substitutions: SeniorOtherOrdersSummarySubstitution[];
  penaltyTakers: SeniorOtherOrdersSummaryPlayer[];
  captain: SeniorOtherOrdersSummaryPlayer | null;
  setPiecesTaker: SeniorOtherOrdersSummaryPlayer | null;
};

type SeniorEditablePlayerOrder = {
  id: string;
  orderType: 1 | 3 | 4;
  minute: number;
  standing: number;
  card: number;
  subjectPlayerId: number | null;
  objectPlayerId: number | null;
  newPositionId: number;
  newPositionBehaviour: number;
};

type SeniorEditableOrdersState = {
  matchId: number | null;
  source: "generated" | "loaded" | "manual" | "mixed";
  matchAttitude: number | null;
  coachModifier: number | null;
  playerOrders: SeniorEditablePlayerOrder[];
  manMarkingOrder: SeniorEditablePlayerOrder | null;
  penaltyTakerIds: number[];
  captainPlayerId: number | null;
  setPiecesPlayerId: number | null;
};

type SeniorOrderPlayerOption = {
  id: number;
  name: string;
  setPiecesSkill: number | null;
};

type SeniorOpponentManMarkingPlayer = {
  playerId: number;
  name: string;
};

type SeniorOpponentPlayersResponse = {
  data?: { HattrickData?: { Team?: { PlayerList?: { Player?: unknown } } } };
  error?: string;
  details?: string;
};

type SeniorSubmitDisclaimerOrderSubstitution = SeniorOtherOrdersSummarySubstitution & {
  type: "replace" | "swap";
  playerIn: SeniorOtherOrdersSummaryPlayer;
  playerOut: SeniorOtherOrdersSummaryPlayer;
};

type SeniorSubmitDisclaimerOrdersSummary = {
  substitutions: SeniorSubmitDisclaimerOrderSubstitution[];
  penaltyTakers: SeniorOtherOrdersSummaryPlayer[];
  setPiecesTaker: SeniorOtherOrdersSummaryPlayer | null;
};

type SeniorAiManMarkingReadyContext = {
  signature: string;
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
const TRAINED_IGNORE_TRAINING_MIN_EXPERIENCE = 3;
const TRAINING_EXPERIENCE_FIELDS = [
  { formation: "4-4-2", field: "Experience442" },
  { formation: "4-3-3", field: "Experience433" },
  { formation: "4-5-1", field: "Experience451" },
  { formation: "3-5-2", field: "Experience352" },
  { formation: "5-3-2", field: "Experience532" },
  { formation: "3-4-3", field: "Experience343" },
  { formation: "5-4-1", field: "Experience541" },
  { formation: "5-2-3", field: "Experience523" },
  { formation: "5-5-0", field: "Experience550" },
  { formation: "2-5-3", field: "Experience253" },
] as const;

type FormationTacticsDistribution = {
  key: string;
  label: string;
  count: number;
};

type OpponentAnalysisTab = "matches" | "scoutTeam";

type OpponentScoutTeamData = {
  teamId: number;
  teamName: string;
  rows: TeamScoutPlayerRow[];
  likelyTraining: TeamScoutLikelyTrainingInfo;
  matchCount: number;
};

type OpponentScoutTeamState =
  | { status: "idle"; teamId: null; data: null; error: null }
  | { status: "loading"; teamId: number; data: null; error: null }
  | { status: "success"; teamId: number; data: OpponentScoutTeamData; error: null }
  | { status: "error"; teamId: number; data: null; error: string };

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

type ExtraTimeSubmitDisclaimerSubstitution = {
  minute: number;
  type: "swap" | "replace";
  playerIn: { id: number; name: string };
  playerOut: { id: number; name: string };
};

type ExtraTimeSubmitDisclaimerTrainingRow = {
  number: number;
  id: number;
  name: string;
  scenario90: number;
  scenario120: number;
};

type ExtraTimeSubmitDisclaimerSummary = {
  trainingLabel: string;
  trainees: Array<{ id: number; name: string }>;
  substitutions: ExtraTimeSubmitDisclaimerSubstitution[];
  trainingRows: ExtraTimeSubmitDisclaimerTrainingRow[];
  penaltyTakers: Array<{ id: number; name: string; setPiecesSkill: number | null }>;
  setPiecesTaker: { id: number; name: string; setPiecesSkill: number | null } | null;
};

type StartupLoadingPhase =
  | "teamContext"
  | "players"
  | "matches"
  | "ratings"
  | "finalize";

const clampSeniorAiManMarkingFuzziness = (value: number) =>
  Math.min(
    SENIOR_AI_MAN_MARKING_FUZZINESS_MAX,
    Math.max(
      SENIOR_AI_MAN_MARKING_FUZZINESS_MIN,
      Number.isFinite(value) ? Math.round(value) : SENIOR_AI_MAN_MARKING_FUZZINESS_DEFAULT
    )
  );

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

const normalizeUnknownList = <T,>(value: T | T[] | null | undefined): T[] =>
  !value ? [] : Array.isArray(value) ? value : [value];

const normalizeStaffMembers = (
  input: StafflistStaff | StafflistStaff[] | null | undefined
): StafflistStaff[] => (!input ? [] : Array.isArray(input) ? input : [input]);

const normalizeTrainerType = (value: unknown): 0 | 1 | 2 | null => {
  const parsed = parseNumber(value);
  return parsed === 0 || parsed === 1 || parsed === 2 ? parsed : null;
};

const buildSeniorTeamGeneralInfoFromStafflist = (
  payload: StafflistResponse | null | undefined,
  teamId: number
): SeniorTeamGeneralInfo => {
  const staffMembers = normalizeStaffMembers(
    payload?.data?.HattrickData?.StaffList?.StaffMembers?.Staff
  );
  const tacticalAssistant =
    staffMembers.find((staff) => parseNumber(staff?.StaffType) === 7) ?? null;
  return {
    schemaVersion: SENIOR_TEAM_GENERAL_INFO_SCHEMA_VERSION,
    teamId,
    fetchedAt: Date.now(),
    hasTacticalAssistant: tacticalAssistant !== null,
    tacticalAssistantStaffLevel: tacticalAssistant
      ? parseNumber(tacticalAssistant.StaffLevel)
      : null,
    trainerType: normalizeTrainerType(
      payload?.data?.HattrickData?.StaffList?.Trainer?.TrainerType
    ),
    trainerLeadership: parseCoachLeadership(
      payload?.data?.HattrickData?.StaffList?.Trainer?.Leadership
    ),
  };
};

const isSeniorTeamGeneralInfo = (
  value: unknown,
  expectedTeamId?: number | null
): value is SeniorTeamGeneralInfo => {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<SeniorTeamGeneralInfo>;
  if (input.schemaVersion !== SENIOR_TEAM_GENERAL_INFO_SCHEMA_VERSION) return false;
  if (
    typeof input.teamId !== "number" ||
    !Number.isFinite(input.teamId) ||
    input.teamId <= 0
  ) {
    return false;
  }
  if (
    typeof expectedTeamId === "number" &&
    expectedTeamId > 0 &&
    input.teamId !== expectedTeamId
  ) {
    return false;
  }
  if (typeof input.fetchedAt !== "number" || !Number.isFinite(input.fetchedAt)) {
    return false;
  }
  if (typeof input.hasTacticalAssistant !== "boolean") return false;
  if (
    input.tacticalAssistantStaffLevel !== null &&
    typeof input.tacticalAssistantStaffLevel !== "number"
  ) {
    return false;
  }
  if (
    input.tacticalAssistantStaffLevel !== null &&
    !Number.isFinite(input.tacticalAssistantStaffLevel)
  ) {
    return false;
  }
  if (
    input.trainerType !== null &&
    input.trainerType !== 0 &&
    input.trainerType !== 1 &&
    input.trainerType !== 2
  ) {
    return false;
  }
  if (
    input.trainerLeadership !== undefined &&
    input.trainerLeadership !== null &&
    input.trainerLeadership !== "solid" &&
    input.trainerLeadership !== "passable" &&
    input.trainerLeadership !== "inadequate" &&
    input.trainerLeadership !== "weak" &&
    input.trainerLeadership !== "poor" &&
    input.trainerLeadership !== "wretched" &&
    input.trainerLeadership !== "disastrous" &&
    input.trainerLeadership !== "non-existent"
  ) {
    return false;
  }
  return true;
};

const normalizeOpponentTrackedRole = (
  role: string | null | undefined
): OpponentTrackedRole | null => {
  switch (role) {
    case "KP":
    case "WB":
    case "CD":
    case "W":
    case "IM":
    case "F":
      return role;
    default:
      return null;
  }
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
      leagueId:
        parseNumber(team?.LeagueID ?? team?.League?.LeagueID ?? team?.League?.LeagueId) ??
        null,
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

const parseWorlddetailsDateTime = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (value && typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    if (typeof text === "string") {
      const trimmed = text.trim();
      return trimmed ? trimmed : null;
    }
  }
  return null;
};

const normalizeWorlddetailsLeagues = (input: unknown): SeniorLeagueOrigin[] => {
  if (!input || typeof input !== "object") return [];
  const root = input as Record<string, unknown>;
  const leagueList = root.LeagueList;
  if (!leagueList || typeof leagueList !== "object") return [];
  const rawLeagues = (leagueList as Record<string, unknown>).League;
  const leagues = Array.isArray(rawLeagues) ? rawLeagues : rawLeagues ? [rawLeagues] : [];
  const origins: SeniorLeagueOrigin[] = [];
  leagues.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const league = item as Record<string, unknown>;
    const leagueId = parseNumber(league.LeagueID);
    const leagueName = typeof league.LeagueName === "string" ? league.LeagueName.trim() : "";
    const trainingDate = parseWorlddetailsDateTime(league.TrainingDate);
    if (!leagueId || !leagueName || !trainingDate) return;
    const country =
      league.Country && typeof league.Country === "object"
        ? (league.Country as Record<string, unknown>)
        : null;
    const countryCode =
      typeof country?.CountryCode === "string" ? country.CountryCode.trim() : undefined;
    const flagDisplay = resolveLeagueOriginFlagDisplay(
      leagueId,
      leagueName,
      countryCode
    );
    origins.push({
      leagueId,
      leagueName,
      trainingDate,
      ...(countryCode ? { countryCode } : {}),
      ...(flagDisplay ? { flagDisplay } : {}),
    });
  });
  return origins;
};

const isSeniorLeagueOrigin = (value: unknown): value is SeniorLeagueOrigin => {
  if (!value || typeof value !== "object") return false;
  const origin = value as Record<string, unknown>;
  return (
    typeof origin.leagueId === "number" &&
    Number.isFinite(origin.leagueId) &&
    typeof origin.leagueName === "string" &&
    origin.leagueName.trim().length > 0 &&
    typeof origin.trainingDate === "string" &&
    origin.trainingDate.trim().length > 0 &&
    (origin.countryCode === undefined ||
      (typeof origin.countryCode === "string" &&
        origin.countryCode.trim().length > 0)) &&
    (origin.flagDisplay === undefined || isOriginFlagDisplay(origin.flagDisplay))
  );
};

const readSeniorLeagueOriginsCache = (): SeniorLeagueOriginsCache | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEAGUE_ORIGINS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SeniorLeagueOriginsCache;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.schemaVersion !== LEAGUE_ORIGINS_CACHE_SCHEMA_VERSION) return null;
    if (!Number.isFinite(parsed.fetchedAt)) return null;
    if (!parsed.originsByLeagueId || typeof parsed.originsByLeagueId !== "object") {
      return null;
    }
    if (!Object.values(parsed.originsByLeagueId).every(isSeniorLeagueOrigin)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const writeSeniorLeagueOriginsCache = (
  originsByLeagueId: Record<number, SeniorLeagueOrigin>
) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LEAGUE_ORIGINS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: LEAGUE_ORIGINS_CACHE_SCHEMA_VERSION,
        fetchedAt: Date.now(),
        originsByLeagueId,
      } satisfies SeniorLeagueOriginsCache)
    );
  } catch {
    // ignore storage errors
  }
};

const buildSeniorLeagueOriginsById = (
  origins: SeniorLeagueOrigin[]
): Record<number, SeniorLeagueOrigin> => {
  const next: Record<number, SeniorLeagueOrigin> = {};
  origins.forEach((origin) => {
    next[origin.leagueId] = origin;
  });
  return next;
};

const SeniorAiManMarkingFuzzinessSlider = memo(function SeniorAiManMarkingFuzzinessSlider({
  value,
  label,
  ariaLabel,
  disabled,
  blocked,
  onBlockedInteraction,
  onCommit,
}: {
  value: number;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  blocked?: boolean;
  onBlockedInteraction?: () => void;
  onCommit: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const commitDraftValue = useCallback(() => {
    const nextValue = clampSeniorAiManMarkingFuzziness(draftValue);
    if (nextValue !== draftValue) {
      setDraftValue(nextValue);
    }
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  }, [draftValue, onCommit, value]);

  return (
    <label className={styles.seniorAiManMarkingFuzzinessControl}>
      <span className={styles.seniorAiManMarkingFuzzinessLabel}>{label}</span>
      <div className={styles.seniorAiManMarkingFuzzinessSliderRow}>
        <input
          type="range"
          min={SENIOR_AI_MAN_MARKING_FUZZINESS_MIN}
          max={SENIOR_AI_MAN_MARKING_FUZZINESS_MAX}
          step={1}
          value={draftValue}
          className={styles.seniorAiManMarkingFuzzinessSlider}
          aria-label={ariaLabel}
          disabled={disabled}
          onPointerDown={(event) => {
            if (!blocked) return;
            event.preventDefault();
            onBlockedInteraction?.();
          }}
          onMouseDown={(event) => {
            if (!blocked) return;
            event.preventDefault();
            onBlockedInteraction?.();
          }}
          onTouchStart={(event) => {
            if (!blocked) return;
            event.preventDefault();
            onBlockedInteraction?.();
          }}
          onFocus={() => {
            if (!blocked) return;
            onBlockedInteraction?.();
          }}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (blocked) return;
            setDraftValue(clampSeniorAiManMarkingFuzziness(Number(event.target.value)));
          }}
          onPointerUp={commitDraftValue}
          onBlur={commitDraftValue}
          onKeyUp={(event) => {
            if (blocked) return;
            if (
              event.key === "ArrowLeft" ||
              event.key === "ArrowRight" ||
              event.key === "ArrowUp" ||
              event.key === "ArrowDown" ||
              event.key === "Home" ||
              event.key === "End" ||
              event.key === "PageUp" ||
              event.key === "PageDown"
            ) {
              commitDraftValue();
            }
          }}
        />
      </div>
    </label>
  );
});

const ageToTotalDays = (years: number, days: number) =>
  Math.max(0, years) * HATTRICK_AGE_DAYS_PER_YEAR + Math.max(0, days);

const totalDaysToAge = (totalDays: number) => {
  const clamped = Math.max(0, Math.round(totalDays));
  return {
    years: Math.floor(clamped / HATTRICK_AGE_DAYS_PER_YEAR),
    days: clamped % HATTRICK_AGE_DAYS_PER_YEAR,
  };
};

const resolveTransferSearchSkillLevel = (
  skillKey: TransferSearchSkillKey,
  player: SeniorPlayer | null,
  details: SeniorPlayerDetails | null
) => {
  switch (skillKey) {
    case "Experience":
      return typeof details?.Experience === "number" ? details.Experience : 0;
    case "Leadership":
      return typeof details?.Leadership === "number" ? details.Leadership : 0;
    case "StaminaSkill":
      return typeof details?.StaminaSkill === "number"
        ? details.StaminaSkill
        : typeof player?.StaminaSkill === "number"
          ? player.StaminaSkill
          : 0;
    default:
      return parseSkill(
        details?.PlayerSkills?.[skillKey] ?? player?.PlayerSkills?.[skillKey]
      ) ?? 0;
  }
};

const clampTransferSkillValue = (skillKey: TransferSearchSkillKey, value: number) => {
  const definition =
    TRANSFER_SEARCH_SKILLS.find((entry) => entry.key === skillKey) ??
    TRANSFER_SEARCH_SKILLS[0];
  return Math.min(definition.max, Math.max(definition.min, Math.round(value)));
};

const buildInitialTransferSearchFilters = (
  player: SeniorPlayer,
  details: SeniorPlayerDetails | null
): TransferSearchFilters => {
  const topSkillFilters = TRANSFER_SEARCH_SKILLS.filter((entry) =>
    TRANSFER_SEARCH_AUTO_SKILL_KEYS.has(entry.key)
  )
    .sort((left, right) => {
      const leftValue = resolveTransferSearchSkillLevel(left.key, player, details);
      const rightValue = resolveTransferSearchSkillLevel(right.key, player, details);
      return rightValue - leftValue || left.skillType - right.skillType;
    })
    .slice(0, 4)
    .map((entry) => {
      const value = resolveTransferSearchSkillLevel(entry.key, player, details);
      return {
        skillKey: entry.key,
        min: value,
        max: value,
      };
    })
    .sort(
      (left, right) =>
        TRANSFER_SEARCH_SKILLS.findIndex((entry) => entry.key === left.skillKey) -
        TRANSFER_SEARCH_SKILLS.findIndex((entry) => entry.key === right.skillKey)
    );

  const totalAgeDays = ageToTotalDays(player.Age ?? details?.Age ?? 0, player.AgeDays ?? details?.AgeDays ?? 0);
  const ageMin = totalDaysToAge(Math.max(0, totalAgeDays - 20));
  const ageMax = totalDaysToAge(totalAgeDays + 20);

  return {
    skillFilters: topSkillFilters,
    specialty:
      typeof details?.Specialty === "number"
        ? details.Specialty
        : typeof player.Specialty === "number"
        ? player.Specialty
        : 0,
    nativeCountryId: null,
    ageMinYears: String(ageMin.years),
    ageMinDays: String(ageMin.days),
    ageMaxYears: String(ageMax.years),
    ageMaxDays: String(ageMax.days),
    tsiMin: "",
    tsiMax: "",
    priceMinDisplay: "",
    priceMaxDisplay: "",
  };
};

const buildEditedTransferSearchSourceDetails = (
  details: SeniorPlayerDetails | null,
  metricInput: SeniorPlayerMetricInput
): SeniorPlayerDetails | null => {
  if (!details) return null;
  const skillValue = (value: number | null | undefined, fallback?: SkillValue) =>
    typeof value === "number" ? ({ "#text": value } as SkillValue) : fallback;
  const editedPlayerSkills: Record<string, SkillValue> = {
    ...(details.PlayerSkills ?? {}),
    ...(skillValue(metricInput.keeper, details.PlayerSkills?.KeeperSkill)
      ? { KeeperSkill: skillValue(metricInput.keeper, details.PlayerSkills?.KeeperSkill)! }
      : {}),
    ...(skillValue(metricInput.defending, details.PlayerSkills?.DefenderSkill)
      ? {
          DefenderSkill: skillValue(
            metricInput.defending,
            details.PlayerSkills?.DefenderSkill
          )!,
        }
      : {}),
    ...(skillValue(metricInput.playmaking, details.PlayerSkills?.PlaymakerSkill)
      ? {
          PlaymakerSkill: skillValue(
            metricInput.playmaking,
            details.PlayerSkills?.PlaymakerSkill
          )!,
        }
      : {}),
    ...(skillValue(metricInput.winger, details.PlayerSkills?.WingerSkill)
      ? {
          WingerSkill: skillValue(metricInput.winger, details.PlayerSkills?.WingerSkill)!,
        }
      : {}),
    ...(skillValue(metricInput.passing, details.PlayerSkills?.PassingSkill)
      ? {
          PassingSkill: skillValue(metricInput.passing, details.PlayerSkills?.PassingSkill)!,
        }
      : {}),
    ...(skillValue(metricInput.scoring, details.PlayerSkills?.ScorerSkill)
      ? {
          ScorerSkill: skillValue(metricInput.scoring, details.PlayerSkills?.ScorerSkill)!,
        }
      : {}),
    ...(skillValue(metricInput.setPieces, details.PlayerSkills?.SetPiecesSkill)
      ? {
          SetPiecesSkill: skillValue(
            metricInput.setPieces,
            details.PlayerSkills?.SetPiecesSkill
          )!,
        }
      : {}),
  };
  return {
    ...details,
    Age:
      typeof metricInput.ageYears === "number" ? metricInput.ageYears : details.Age,
    AgeDays:
      typeof metricInput.ageDays === "number" ? metricInput.ageDays : details.AgeDays,
    TSI: typeof metricInput.tsi === "number" ? metricInput.tsi : details.TSI,
    Salary:
      typeof metricInput.salarySek === "number"
        ? metricInput.salarySek
        : details.Salary,
    Form: typeof metricInput.form === "number" ? metricInput.form : details.Form,
    StaminaSkill:
      typeof metricInput.stamina === "number"
        ? metricInput.stamina
        : details.StaminaSkill,
    PlayerSkills: editedPlayerSkills,
  };
};

const seniorMetricInputMatches = (
  left: SeniorPlayerMetricInput | null,
  right: SeniorPlayerMetricInput | null
) => {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.ageYears === right.ageYears &&
    left.ageDays === right.ageDays &&
    left.tsi === right.tsi &&
    left.salarySek === right.salarySek &&
    left.isAbroad === right.isAbroad &&
    left.specialty === right.specialty &&
    left.form === right.form &&
    left.stamina === right.stamina &&
    left.keeper === right.keeper &&
    left.defending === right.defending &&
    left.playmaking === right.playmaking &&
    left.winger === right.winger &&
    left.passing === right.passing &&
    left.scoring === right.scoring &&
    left.setPieces === right.setPieces
  );
};

const buildFallbackTransferSearchFilters = (
  player: SeniorPlayer,
  details: SeniorPlayerDetails | null
): TransferSearchFilters => {
  const exact = buildInitialTransferSearchFilters(player, details);
  const totalAgeDays = ageToTotalDays(player.Age ?? details?.Age ?? 0, player.AgeDays ?? details?.AgeDays ?? 0);
  const ageMin = totalDaysToAge(Math.max(0, totalAgeDays - 50));
  const ageMax = totalDaysToAge(totalAgeDays + 50);
  return {
    ...exact,
    skillFilters: exact.skillFilters.map((filter) => ({
      ...filter,
      min: filter.skillKey
        ? clampTransferSkillValue(filter.skillKey, Math.max(0, filter.min - 1))
        : filter.min,
    })),
    specialty: null,
    ageMinYears: String(ageMin.years),
    ageMinDays: String(ageMin.days),
    ageMaxYears: String(ageMax.years),
    ageMaxDays: String(ageMax.days),
  };
};

const normalizeTransferSearchFilters = (filters: TransferSearchFilters): TransferSearchFilters => {
  const parseAgeInteger = (value: unknown, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const ageMinYears = Math.max(
    0,
    Math.round(parseAgeInteger(filters.ageMinYears, TRANSFER_SEARCH_MIN_AGE_YEARS))
  );
  const ageMinDays = Math.min(
    HATTRICK_AGE_DAYS_PER_YEAR - 1,
    Math.max(0, Math.round(parseAgeInteger(filters.ageMinDays, 0)))
  );
  const ageMaxYears = Math.max(
    0,
    Math.round(parseAgeInteger(filters.ageMaxYears, TRANSFER_SEARCH_MIN_AGE_YEARS))
  );
  const ageMaxDays = Math.min(
    HATTRICK_AGE_DAYS_PER_YEAR - 1,
    Math.max(0, Math.round(parseAgeInteger(filters.ageMaxDays, 0)))
  );
  const minAgeTotal = Math.max(
    TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS,
    ageToTotalDays(ageMinYears, ageMinDays)
  );
  const maxAgeTotal = Math.max(
    TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS,
    ageToTotalDays(ageMaxYears, ageMaxDays)
  );
  const normalizedMinAge = totalDaysToAge(Math.min(minAgeTotal, maxAgeTotal));
  const normalizedMaxAge = totalDaysToAge(Math.max(minAgeTotal, maxAgeTotal));
  const nativeCountryId = Number(filters.nativeCountryId);
  return {
    ...filters,
    skillFilters: filters.skillFilters.map((filter) => {
      if (!filter.skillKey) {
        return {
          ...filter,
          skillKey: null,
        };
      }
      const clampedMin = clampTransferSkillValue(filter.skillKey, filter.min);
      const clampedMax = clampTransferSkillValue(filter.skillKey, filter.max);
      return {
        ...filter,
        min: clampedMin,
        max: clampedMax,
      };
    }),
    ageMinYears: String(normalizedMinAge.years),
    ageMinDays: String(normalizedMinAge.days),
    ageMaxYears: String(normalizedMaxAge.years),
    ageMaxDays: String(normalizedMaxAge.days),
    nativeCountryId:
      Number.isFinite(nativeCountryId) && nativeCountryId > 0
        ? Math.round(nativeCountryId)
        : null,
    tsiMin: String(filters.tsiMin ?? "").trim(),
    tsiMax: String(filters.tsiMax ?? "").trim(),
    priceMinDisplay: String(filters.priceMinDisplay ?? "").trim(),
    priceMaxDisplay: String(filters.priceMaxDisplay ?? "").trim(),
  };
};

const parseOptionalTransferSearchNonNegativeInteger = (
  value: string | null | undefined
): number | null => {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const buildTransferSearchParams = (
  filters: TransferSearchFilters,
  displayCurrency: DisplayCurrency
) => {
  const normalized = normalizeTransferSearchFilters(filters);
  const params = new URLSearchParams({
    ageMin: normalized.ageMinYears,
    ageDaysMin: normalized.ageMinDays,
    ageMax: normalized.ageMaxYears,
    ageDaysMax: normalized.ageMaxDays,
    pageSize: String(TRANSFER_SEARCH_PAGE_SIZE),
    pageIndex: "0",
  });

  normalized.skillFilters
    .filter((filter): filter is TransferSearchSkillFilter & { skillKey: TransferSearchSkillKey } => Boolean(filter.skillKey))
    .forEach((filter, index) => {
    const slot = index + 1;
    const definition = TRANSFER_SEARCH_SKILLS.find((entry) => entry.key === filter.skillKey);
    if (!definition) return;
    params.set(`skillType${slot}`, String(definition.skillType));
    params.set(`minSkillValue${slot}`, String(filter.min));
    params.set(`maxSkillValue${slot}`, String(filter.max));
  });

  if (normalized.specialty !== null) {
    params.set("specialty", String(normalized.specialty));
  }
  if (normalized.nativeCountryId !== null) {
    params.set("nativeCountryId", String(normalized.nativeCountryId));
  }

  const tsiMin = parseOptionalTransferSearchNonNegativeInteger(normalized.tsiMin);
  const tsiMax = parseOptionalTransferSearchNonNegativeInteger(normalized.tsiMax);
  if (tsiMin !== null) {
    params.set("tsiMin", String(tsiMin));
  }
  if (tsiMax !== null) {
    params.set("tsiMax", String(tsiMax));
  }

  const priceMinDisplay = parseOptionalTransferSearchNonNegativeInteger(
    normalized.priceMinDisplay
  );
  const priceMaxDisplay = parseOptionalTransferSearchNonNegativeInteger(
    normalized.priceMaxDisplay
  );
  if (priceMinDisplay !== null) {
    const priceMinSek = displayAmountToSek(priceMinDisplay, displayCurrency);
    const chppPriceMin =
      priceMinSek !== null
        ? toHattrickTransferSearchPriceFilterParam(priceMinSek, "min")
        : null;
    if (chppPriceMin !== null) params.set("priceMin", String(chppPriceMin));
  }
  if (priceMaxDisplay !== null) {
    const priceMaxSek = displayAmountToSek(priceMaxDisplay, displayCurrency);
    const chppPriceMax =
      priceMaxSek !== null
        ? toHattrickTransferSearchPriceFilterParam(priceMaxSek, "max")
        : null;
    if (chppPriceMax !== null) params.set("priceMax", String(chppPriceMax));
  }

  return params;
};

const normalizeTransferSearchResults = (input: unknown): TransferSearchResult[] => {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  return list
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const node = entry as Record<string, unknown>;
      const details =
        node.Details && typeof node.Details === "object"
          ? (node.Details as Record<string, unknown>)
          : null;
      const seller =
        details?.SellerTeam && typeof details.SellerTeam === "object"
          ? (details.SellerTeam as Record<string, unknown>)
          : null;
      const playerId = parseNumber(node.PlayerId);
      if (!playerId || playerId <= 0) return null;
      return {
        playerId,
        firstName: typeof node.FirstName === "string" ? node.FirstName : "",
        nickName: typeof node.NickName === "string" ? node.NickName : "",
        lastName: typeof node.LastName === "string" ? node.LastName : "",
        nativeCountryId: parseNumber(node.NativeCountryID),
        specialty: parseNumber(details?.Specialty),
        age: parseNumber(details?.Age),
        ageDays: parseNumber(details?.AgeDays),
        salarySek: parseNumber(details?.Salary),
        isAbroad: parseBoolean(details?.IsAbroad),
        tsi: parseNumber(details?.TSI),
        form: parseNumber(details?.PlayerForm),
        experience: parseNumber(details?.Experience),
        leadership: parseNumber(details?.Leadership),
        cards: parseNumber(details?.Cards),
        injuryLevel: parseNumber(details?.InjuryLevel),
        staminaSkill: parseNumber(details?.StaminaSkill),
        keeperSkill: parseNumber(details?.KeeperSkill),
        playmakerSkill: parseNumber(details?.PlaymakerSkill),
        scorerSkill: parseNumber(details?.ScorerSkill),
        passingSkill: parseNumber(details?.PassingSkill),
        wingerSkill: parseNumber(details?.WingerSkill),
        defenderSkill: parseNumber(details?.DefenderSkill),
        setPiecesSkill: parseNumber(details?.SetPiecesSkill),
        askingPriceSek: parseNumber(node.AskingPrice),
        highestBidSek: parseNumber(node.HighestBid),
        deadline: typeof node.Deadline === "string" ? node.Deadline : null,
        sellerTeamId: parseNumber(seller?.TeamID),
        sellerTeamName:
          typeof seller?.TeamName === "string" ? String(seller.TeamName) : null,
      } satisfies TransferSearchResult;
    })
    .filter((entry): entry is TransferSearchResult => Boolean(entry));
};

const normalizeTransferSearchBidDrafts = (value: unknown): Record<number, TransferSearchBidDraft> => {
  if (!value || typeof value !== "object") return {};
  const next: Record<number, TransferSearchBidDraft> = {};
  Object.entries(value as Record<string, unknown>).forEach(([playerId, draft]) => {
    const parsedPlayerId = Number(playerId);
    if (!Number.isFinite(parsedPlayerId) || parsedPlayerId <= 0) return;
    if (!draft || typeof draft !== "object") return;
    const node = draft as Record<string, unknown>;
    next[parsedPlayerId] = {
      bidDisplay: typeof node.bidDisplay === "string" ? node.bidDisplay : "",
      maxBidDisplay: typeof node.maxBidDisplay === "string" ? node.maxBidDisplay : "",
    };
  });
  return next;
};

const formatTransferSearchPlayerName = (player: TransferSearchResult) =>
  [player.firstName, player.nickName, player.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

const displayToSek = (value: string, displayCurrency: DisplayCurrency) =>
  displayAmountToSek(value.replace(",", ".").trim(), displayCurrency);

const formatTransferSearchBidDraftDisplay = (
  valueSek: number | string | null,
  displayCurrency: DisplayCurrency
) => {
  if (valueSek === null) return "";
  if (typeof valueSek === "string") return valueSek;
  const displayAmount = sekToDisplayAmount(valueSek, displayCurrency);
  return displayAmount === null ? "" : String(Math.ceil(displayAmount));
};

const computeSeniorEffectiveSkill = (
  baseSkill: number | null,
  player: SeniorPlayer | null,
  details: SeniorPlayerDetails | null
) => {
  return calculateEffectiveSkill({
    rawSkill: baseSkill,
    loyalty: details?.Loyalty,
    motherClubBonus: details?.MotherClubBonus,
    form: details?.Form ?? player?.Form,
    stamina: details?.StaminaSkill ?? player?.StaminaSkill,
  });
};

// NEW/N detection must always be based on raw skill values from CHPP data only.
// Effective skill adjustments are display-only and must never contribute to
// change detection.
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

const normalizeSeniorManualRatingsEdits = (input: unknown): SeniorManualRatingsEdits => {
  if (!input || typeof input !== "object") return {};
  const payload: SeniorManualRatingsEdits = {};
  Object.entries(input as Record<string, unknown>).forEach(([playerIdKey, positionsValue]) => {
    const playerId = Number(playerIdKey);
    if (!Number.isFinite(playerId) || playerId <= 0) return;
    if (!positionsValue || typeof positionsValue !== "object") return;
    const nextPositions: Record<string, number> = {};
    Object.entries(positionsValue as Record<string, unknown>).forEach(([positionKey, value]) => {
      const parsed = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(parsed)) return;
      const clamped = Math.min(25, Math.max(0, Math.round(parsed * 10) / 10));
      nextPositions[positionKey] = clamped;
    });
    if (Object.keys(nextPositions).length > 0) {
      payload[playerId] = nextPositions;
    }
  });
  return payload;
};

const hasSeniorManualRatingsEdits = (input: SeniorManualRatingsEdits) =>
  Object.values(input).some((positions) => Object.keys(positions).length > 0);

const dropOverwrittenSeniorManualRatingsEdits = (
  manualEdits: SeniorManualRatingsEdits,
  incomingRatings: RatingsMatrixResponse | null | undefined
): SeniorManualRatingsEdits => {
  if (!hasSeniorManualRatingsEdits(manualEdits) || !incomingRatings) {
    return manualEdits;
  }
  const next: SeniorManualRatingsEdits = {};
  Object.entries(manualEdits).forEach(([playerIdKey, positions]) => {
    const row = incomingRatings.players.find((candidate) => candidate.id === Number(playerIdKey));
    if (!row) {
      next[Number(playerIdKey)] = { ...positions };
      return;
    }
    const remaining: Record<string, number> = {};
    Object.entries(positions).forEach(([positionKey, value]) => {
      const incoming = row.ratings?.[positionKey];
      if (typeof incoming === "number" && Number.isFinite(incoming)) {
        return;
      }
      remaining[positionKey] = value;
    });
    if (Object.keys(remaining).length > 0) {
      next[Number(playerIdKey)] = remaining;
    }
  });
  return next;
};

const buildEffectiveSeniorRatingsResponse = (
  fetchedRatings: RatingsMatrixResponse | null | undefined,
  manualEdits: SeniorManualRatingsEdits,
  players: SeniorPlayer[]
): RatingsMatrixResponse | null => {
  const hasManualEdits = hasSeniorManualRatingsEdits(manualEdits);
  if (!fetchedRatings && players.length === 0 && !hasManualEdits) {
    return null;
  }
  const rowsById = new Map<
    number,
    {
      id: number;
      name: string;
      ratings: Record<string, number>;
      ratingMatchIds: Record<string, number>;
      ratingMatchSourceSystems: Record<string, string>;
    }
  >();
  const displayOrder: number[] = [];
  const pushOrder = (playerId: number) => {
    if (!displayOrder.includes(playerId)) {
      displayOrder.push(playerId);
    }
  };

  (fetchedRatings?.players ?? []).forEach((row) => {
    rowsById.set(row.id, {
      id: row.id,
      name: row.name,
      ratings: { ...row.ratings },
      ratingMatchIds: { ...(row.ratingMatchIds ?? {}) },
      ratingMatchSourceSystems: { ...(row.ratingMatchSourceSystems ?? {}) },
    });
    pushOrder(row.id);
  });

  players.forEach((player) => {
    const playerId = player.PlayerID;
    const playerName = formatPlayerName(player) || String(playerId);
    if (!rowsById.has(playerId)) {
      rowsById.set(playerId, {
        id: playerId,
        name: playerName,
        ratings: {},
        ratingMatchIds: {},
        ratingMatchSourceSystems: {},
      });
    } else if (!rowsById.get(playerId)?.name) {
      rowsById.get(playerId)!.name = playerName;
    }
    pushOrder(playerId);
  });

  Object.entries(manualEdits).forEach(([playerIdKey, positions]) => {
    const playerId = Number(playerIdKey);
    if (!Number.isFinite(playerId) || playerId <= 0) return;
    const existing =
      rowsById.get(playerId) ??
      ({
        id: playerId,
        name:
          formatPlayerName(players.find((player) => player.PlayerID === playerId) ?? {}) ||
          String(playerId),
        ratings: {},
        ratingMatchIds: {},
        ratingMatchSourceSystems: {},
      } as const);
    const nextRow = {
      id: existing.id,
      name: existing.name,
      ratings: { ...existing.ratings },
      ratingMatchIds: { ...existing.ratingMatchIds },
      ratingMatchSourceSystems: { ...existing.ratingMatchSourceSystems },
    };
    Object.entries(positions).forEach(([positionKey, value]) => {
      nextRow.ratings[positionKey] = value;
      delete nextRow.ratingMatchIds[positionKey];
      delete nextRow.ratingMatchSourceSystems[positionKey];
    });
    rowsById.set(playerId, nextRow);
    pushOrder(playerId);
  });

  const positions = Array.from(
    new Set<number>([
      ...(fetchedRatings?.positions ?? []),
      ...POSITION_COLUMNS,
      ...Object.values(manualEdits).flatMap((positionsMap) =>
        Object.keys(positionsMap)
          .map((key) => Number(key))
          .filter((value): value is number => Number.isFinite(value))
      ),
    ])
  );

  return {
    ratingsAlgorithmVersion:
      fetchedRatings?.ratingsAlgorithmVersion ?? SENIOR_RATINGS_ALGO_VERSION,
    positions,
    players: displayOrder
      .map((playerId) => rowsById.get(playerId))
      .filter(
        (
          row
        ): row is {
          id: number;
          name: string;
          ratings: Record<string, number>;
          ratingMatchIds: Record<string, number>;
          ratingMatchSourceSystems: Record<string, string>;
        } => Boolean(row)
      )
      .map((row) => ({
        ...row,
        ratingMatchIds: { ...row.ratingMatchIds },
        ratingMatchSourceSystems: { ...row.ratingMatchSourceSystems },
      })),
    matchesAnalyzed: fetchedRatings?.matchesAnalyzed ?? 0,
    lastAppliedMatchId: fetchedRatings?.lastAppliedMatchId ?? null,
    lastAppliedMatchDateTime: fetchedRatings?.lastAppliedMatchDateTime ?? null,
    lastAppliedMatchSourceSystem: fetchedRatings?.lastAppliedMatchSourceSystem ?? null,
  };
};

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
        IsAbroad: parseBoolean(node.IsAbroad) ?? undefined,
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
  const owningTeam =
    node.OwningTeam && typeof node.OwningTeam === "object"
      ? (node.OwningTeam as Record<string, unknown>)
      : null;
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
    NativeLeagueID: parseNumber(node.NativeLeagueID) ?? undefined,
    Specialty: parseNumber(node.Specialty) ?? undefined,
    Form: parseSkill(node.PlayerForm ?? node.Form) ?? undefined,
    StaminaSkill:
      parseSkill(node.StaminaSkill) ?? parseNumber(node.StaminaSkill) ?? staminaFromSkills ?? undefined,
    InjuryLevel: parseNumber(node.InjuryLevel) ?? undefined,
    Cards: parseNumber(node.Cards) ?? undefined,
    TSI: parseNumber(node.TSI) ?? undefined,
    Salary: parseNumber(node.Salary) ?? undefined,
    IsAbroad: parseBoolean(node.IsAbroad) ?? undefined,
    OwningTeam: owningTeam
      ? {
          LeagueID: parseNumber(owningTeam.LeagueID) ?? undefined,
        }
      : undefined,
    Statement:
      typeof node.Statement === "string" && node.Statement.trim()
        ? node.Statement
        : undefined,
    Agreeability: agreeability ?? undefined,
    Aggressiveness: aggressiveness ?? undefined,
    Honesty: honesty ?? undefined,
    Experience: experience ?? undefined,
    Leadership: leadership ?? undefined,
    Loyalty: loyalty ?? undefined,
    MotherClubBonus: motherClubBonus ?? undefined,
    CareerGoals: parseNumber(node.CareerGoals) ?? undefined,
    CareerHattricks: parseNumber(node.CareerHattricks) ?? undefined,
    LeagueGoals: parseNumber(node.LeagueGoals) ?? undefined,
    CupGoals: parseNumber(node.CupGoals) ?? undefined,
    FriendliesGoals: parseNumber(node.FriendliesGoals) ?? undefined,
    Caps: parseNumber(node.Caps) ?? undefined,
    CapsU20: parseNumber(node.CapsU20) ?? undefined,
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
    TransferListed: parseBoolean(node.TransferListed) ?? undefined,
    TransferDetails:
      node.TransferDetails && typeof node.TransferDetails === "object"
        ? {
            AskingPrice:
              parseNumber((node.TransferDetails as Record<string, unknown>).AskingPrice) ??
              undefined,
            Deadline:
              typeof (node.TransferDetails as Record<string, unknown>).Deadline === "string"
                ? String((node.TransferDetails as Record<string, unknown>).Deadline)
                : undefined,
            HighestBid:
              parseNumber((node.TransferDetails as Record<string, unknown>).HighestBid) ??
              undefined,
            BidderTeam:
              (node.TransferDetails as Record<string, unknown>).BidderTeam &&
              typeof (node.TransferDetails as Record<string, unknown>).BidderTeam === "object"
                ? {
                    TeamID:
                      parseNumber(
                        (
                          (node.TransferDetails as Record<string, unknown>).BidderTeam as Record<
                            string,
                            unknown
                          >
                        ).TeamID
                      ) ?? undefined,
                    TeamName:
                      typeof (
                        (node.TransferDetails as Record<string, unknown>).BidderTeam as Record<
                          string,
                          unknown
                        >
                      ).TeamName === "string"
                        ? String(
                            (
                              (node.TransferDetails as Record<string, unknown>).BidderTeam as Record<
                                string,
                                unknown
                              >
                            ).TeamName
                          )
                        : undefined,
                  }
                : undefined,
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

const BERLIN_TIME_ZONE = "Europe/Berlin";
const berlinCalendarFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  timeZone: BERLIN_TIME_ZONE,
});
const berlinDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: BERLIN_TIME_ZONE,
});

type BerlinCalendarDay = {
  year: number;
  month: number;
  day: number;
  weekday: string;
};

const formatBerlinDateTimeParam = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const parts = berlinDateTimeFormatter.formatToParts(new Date(timestamp));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  if (!year || !month || !day || !hour || !minute || !second) return null;
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const getBerlinCalendarDay = (value: Date): BerlinCalendarDay => {
  const parts = berlinCalendarFormatter.formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday"),
  };
};

const addBerlinCalendarDays = (value: BerlinCalendarDay, days: number): BerlinCalendarDay => {
  const shifted = new Date(Date.UTC(value.year, value.month - 1, value.day, 12, 0, 0));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return getBerlinCalendarDay(shifted);
};

const formatBerlinCalendarDateTime = (
  value: BerlinCalendarDay,
  hour: number,
  minute: number,
  second = 0
) =>
  `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(
    value.day
  ).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(
    second
  ).padStart(2, "0")}`;

const normalizeChppDateTime = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace("T", " ").slice(0, 19);
  return normalized.length === 19 ? normalized : null;
};

const isChppDateTimeWithinWindow = (
  value: string | null,
  windowStart: string,
  windowEnd: string
) => Boolean(value && value >= windowStart && value <= windowEnd);

const resolveCurrentHattrickWeekWindows = (value: Date) => {
  const berlinNow = formatBerlinDateTimeParam(value.getTime());
  const berlinDay = getBerlinCalendarDay(value);
  const daysSinceSaturdayByWeekday: Record<string, number> = {
    Sat: 0,
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
  };
  const daysSinceSaturday = daysSinceSaturdayByWeekday[berlinDay.weekday] ?? 0;
  const weekSaturday = addBerlinCalendarDays(berlinDay, -daysSinceSaturday);

  const aTeamWindowStart = formatBerlinCalendarDateTime(
    addBerlinCalendarDays(weekSaturday, -1),
    21,
    0
  );
  const aTeamWindowEnd = formatBerlinCalendarDateTime(
    addBerlinCalendarDays(weekSaturday, 2),
    3,
    0
  );
  const bTeamWindowStart = formatBerlinCalendarDateTime(
    addBerlinCalendarDays(weekSaturday, 2),
    21,
    0
  );
  const bTeamWindowEnd = formatBerlinCalendarDateTime(
    addBerlinCalendarDays(weekSaturday, 6),
    3,
    0
  );

  return {
    now: berlinNow,
    aTeamWindowStart,
    aTeamWindowEnd,
    bTeamWindowStart,
    bTeamWindowEnd,
    isBTeamWindowOpen: Boolean(berlinNow && berlinNow >= bTeamWindowStart),
  };
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

const defaultSortDirectionForKey = (key: SortKey): SortDirection => {
  switch (key) {
    case "age":
    case "name":
      return "asc";
    case "arrival":
    case "tsi":
    case "wage":
    case "form":
    case "stamina":
    case "experience":
    case "loyalty":
    case "injuries":
    case "cards":
    case "keeper":
    case "defender":
    case "playmaker":
    case "winger":
    case "passing":
    case "scorer":
    case "setpieces":
      return "desc";
    default:
      return "asc";
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

const resolveTransferSearchSalaryForSelectedTeam = (
  salarySek: number | null | undefined,
  currentForeign: boolean | null | undefined,
  foreignForSelectedTeam: boolean | null | undefined
) => {
  if (typeof salarySek !== "number" || !Number.isFinite(salarySek) || salarySek <= 0) {
    return null;
  }
  const baseSalary =
    currentForeign === true ? Math.round(salarySek / 1.2) : Math.round(salarySek);
  return foreignForSelectedTeam === true
    ? Math.round(baseSalary * 1.2)
    : baseSalary;
};

const isForeignForSelectedLeague = (
  nativeLeagueId: number | null | undefined,
  selectedLeagueId: number | null | undefined
) => {
  if (
    typeof nativeLeagueId !== "number" ||
    !Number.isFinite(nativeLeagueId) ||
    nativeLeagueId <= 0 ||
    typeof selectedLeagueId !== "number" ||
    !Number.isFinite(selectedLeagueId) ||
    selectedLeagueId <= 0
  ) {
    return null;
  }
  return nativeLeagueId !== selectedLeagueId;
};

const parseTeamdetailsLeagueId = (payload: unknown): number | null => {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    data?: {
      HattrickData?: {
        Team?: {
          LeagueID?: unknown;
          LeagueId?: unknown;
          League?: {
            LeagueID?: unknown;
            LeagueId?: unknown;
          };
        };
      };
    };
  };
  return (
    parseNumber(data.data?.HattrickData?.Team?.LeagueID) ??
    parseNumber(data.data?.HattrickData?.Team?.LeagueId) ??
    parseNumber(data.data?.HattrickData?.Team?.League?.LeagueID) ??
    parseNumber(data.data?.HattrickData?.Team?.League?.LeagueId) ??
    null
  );
};

const extractTeamdetailsTeamNode = (
  payload: unknown,
  requestedTeamId?: number | null
): Record<string, unknown> | null => {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as {
    data?: {
      HattrickData?: {
        Team?: unknown;
        Teams?: {
          Team?: unknown;
        };
      };
    };
  };
  const directTeam = data.data?.HattrickData?.Team;
  if (directTeam && typeof directTeam === "object") {
    return directTeam as Record<string, unknown>;
  }
  const rawTeams = data.data?.HattrickData?.Teams?.Team;
  const teams = Array.isArray(rawTeams) ? rawTeams : rawTeams ? [rawTeams] : [];
  if (typeof requestedTeamId === "number" && Number.isFinite(requestedTeamId) && requestedTeamId > 0) {
    const matched = teams.find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const team = entry as Record<string, unknown>;
      return parseNumber(team.TeamID ?? team.TeamId) === requestedTeamId;
    });
    if (matched && typeof matched === "object") {
      return matched as Record<string, unknown>;
    }
  }
  const primary = teams.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return String((entry as Record<string, unknown>).IsPrimaryClub ?? "").toLowerCase() === "true";
  });
  if (primary && typeof primary === "object") {
    return primary as Record<string, unknown>;
  }
  return teams[0] && typeof teams[0] === "object"
    ? (teams[0] as Record<string, unknown>)
    : null;
};

const parseTeamdetailsStillInCup = (
  payload: unknown,
  requestedTeamId?: number | null
): boolean | null => {
  const team = extractTeamdetailsTeamNode(payload, requestedTeamId);
  if (!team) return null;
  const cup =
    team.Cup && typeof team.Cup === "object"
      ? (team.Cup as Record<string, unknown>)
      : null;
  if (!cup) return false;
  const raw = cup.StillInCup;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0" || normalized === "") return false;
  }
  return null;
};

const resolveSeniorIsAbroad = (details: SeniorPlayerDetails | null | undefined) => {
  if (!details) return undefined;
  if (typeof details.IsAbroad === "boolean") return details.IsAbroad;
  if (
    typeof details.NativeLeagueID === "number" &&
    typeof details.OwningTeam?.LeagueID === "number"
  ) {
    return details.NativeLeagueID !== details.OwningTeam.LeagueID;
  }
  return undefined;
};

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

const normalizeSeniorEditableOrderType = (
  value: number
): SeniorEditablePlayerOrder["orderType"] => {
  if (value === 3 || value === 4) return value;
  return 1;
};

const seniorEditableOrderId = (
  matchId: number | null,
  order: MatchOrderSubstitution,
  index: number
) =>
  [
    "order",
    matchId ?? "draft",
    index,
    order.orderType,
    order.min,
    order.playerout,
    order.playerin,
    order.pos,
    order.beh,
  ].join("-");

const buildSeniorEditableOrderFromSubstitution = (
  matchId: number | null,
  order: MatchOrderSubstitution,
  index: number
): SeniorEditablePlayerOrder => ({
  id: seniorEditableOrderId(matchId, order, index),
  orderType: normalizeSeniorEditableOrderType(order.orderType),
  minute: Number.isFinite(order.min) ? order.min : SENIOR_ORDER_DEFAULT_MINUTE,
  standing: Number.isFinite(order.standing)
    ? order.standing
    : SENIOR_ORDER_DEFAULT_CONDITION,
  card: Number.isFinite(order.card) ? order.card : SENIOR_ORDER_DEFAULT_CONDITION,
  subjectPlayerId:
    Number.isFinite(order.playerout) && order.playerout > 0 ? order.playerout : null,
  objectPlayerId:
    Number.isFinite(order.playerin) && order.playerin > 0 ? order.playerin : null,
  newPositionId: Number.isFinite(order.pos) ? order.pos : SENIOR_ORDER_DEFAULT_POSITION,
  newPositionBehaviour: Number.isFinite(order.beh)
    ? order.beh
    : SENIOR_ORDER_DEFAULT_BEHAVIOUR,
});

const buildSeniorEditableOrdersFromPayload = (
  matchId: number | null,
  payload: MatchOrdersLineupPayload,
  source: SeniorEditableOrdersState["source"]
): SeniorEditableOrdersState => {
  const editableOrders = (payload.substitutions ?? []).map((order, index) =>
    buildSeniorEditableOrderFromSubstitution(matchId, order, index)
  );
  const loadedManMarkingOrder =
    editableOrders.find((order) => order.orderType === 4) ??
    (payload.settings.manMarkerPlayerId > 0 || payload.settings.manMarkingPlayerId > 0
      ? {
          id: `man-marking-${matchId ?? "draft"}`,
          orderType: 4,
          minute: SENIOR_ORDER_DEFAULT_MINUTE,
          standing: SENIOR_ORDER_DEFAULT_CONDITION,
          card: SENIOR_ORDER_DEFAULT_CONDITION,
          subjectPlayerId:
            payload.settings.manMarkerPlayerId > 0
              ? payload.settings.manMarkerPlayerId
              : null,
          objectPlayerId:
            payload.settings.manMarkingPlayerId > 0
              ? payload.settings.manMarkingPlayerId
              : null,
          newPositionId: SENIOR_ORDER_DEFAULT_POSITION,
          newPositionBehaviour: SENIOR_ORDER_DEFAULT_BEHAVIOUR,
        }
      : null);
  return {
    matchId,
    source,
    matchAttitude:
      typeof payload.settings?.speechLevel === "number" ? payload.settings.speechLevel : null,
    coachModifier:
      typeof payload.settings?.coachModifier === "number"
        ? payload.settings.coachModifier
        : null,
    playerOrders: editableOrders.filter((order) => order.orderType !== 4),
    manMarkingOrder: loadedManMarkingOrder,
    penaltyTakerIds: (payload.kickers ?? [])
      .map((kicker) => Number(kicker.id) || 0)
      .slice(0, 11),
    captainPlayerId: payload.captain > 0 ? payload.captain : null,
    setPiecesPlayerId: payload.setPieces > 0 ? payload.setPieces : null,
  };
};

const serializeSeniorEditableOrdersToPayload = (
  payload: MatchOrdersLineupPayload,
  orders: SeniorEditableOrdersState,
  options: {
    includeMatchAttitude: boolean;
    includeCoachModifier: boolean;
  }
): MatchOrdersLineupPayload => {
  const serializeEditableOrder = (order: SeniorEditablePlayerOrder) => ({
    playerin: Number(order.objectPlayerId ?? 0) || 0,
    playerout: Number(order.subjectPlayerId ?? 0) || 0,
    orderType: order.orderType,
    min: Number.isFinite(order.minute) ? order.minute : SENIOR_ORDER_DEFAULT_MINUTE,
    pos: Number.isFinite(order.newPositionId)
      ? order.newPositionId
      : SENIOR_ORDER_DEFAULT_POSITION,
    beh: Number.isFinite(order.newPositionBehaviour)
      ? order.newPositionBehaviour
      : SENIOR_ORDER_DEFAULT_BEHAVIOUR,
    card: Number.isFinite(order.card) ? order.card : SENIOR_ORDER_DEFAULT_CONDITION,
    standing: Number.isFinite(order.standing)
      ? order.standing
      : SENIOR_ORDER_DEFAULT_CONDITION,
  });
  return {
    ...payload,
    kickers: Array.from({ length: 11 }, (_, index) => ({
      id: Number(orders.penaltyTakerIds[index] ?? 0) || 0,
      behaviour: 0,
    })),
    captain: Number(orders.captainPlayerId ?? 0) || 0,
    setPieces: Number(orders.setPiecesPlayerId ?? 0) || 0,
    settings: {
      ...payload.settings,
      speechLevel: options.includeMatchAttitude
        ? Number(orders.matchAttitude ?? 0) || 0
        : payload.settings.speechLevel,
      coachModifier: options.includeCoachModifier
        ? Number(orders.coachModifier ?? 0) || 0
        : payload.settings.coachModifier,
      manMarkerPlayerId: Number(orders.manMarkingOrder?.subjectPlayerId ?? 0) || 0,
      manMarkingPlayerId: Number(orders.manMarkingOrder?.objectPlayerId ?? 0) || 0,
    },
    substitutions: [
      ...orders.playerOrders.map(serializeEditableOrder),
      ...(orders.manMarkingOrder
        ? [serializeEditableOrder(orders.manMarkingOrder)]
        : []),
    ],
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

const trainingWeightBySlot = (trainingType: number | null) => {
  const weights = new Map<string, number>();
  const setWeight = (slots: string[], value: number) => {
    slots.forEach((slot) => weights.set(slot, value));
  };

  switch (trainingType) {
    case 2:
    case 6:
      setWeight([...FIELD_SLOT_ORDER], 1);
      break;
    case 3:
      setWeight([...DEFENSE_SLOTS], 1);
      break;
    case 4:
      setWeight([...ATTACK_SLOTS], 1);
      break;
    case 5:
      setWeight(["W_L", "W_R"], 1);
      setWeight(["WB_L", "WB_R"], 0.5);
      break;
    case 7:
      setWeight([...MIDFIELD_SLOTS, ...ATTACK_SLOTS], 1);
      break;
    case 8:
      setWeight(["IM_L", "IM_C", "IM_R"], 1);
      setWeight(["W_L", "W_R"], 0.5);
      break;
    case 9:
      setWeight(["KP"], 1);
      break;
    case 10:
    case 11:
      setWeight([...DEFENSE_SLOTS, ...MIDFIELD_SLOTS], 1);
      if (trainingType === 11) {
        setWeight(["KP"], 1);
      }
      break;
    case 12:
      setWeight(["W_L", "W_R", ...ATTACK_SLOTS], 1);
      break;
    default:
      break;
  }

  return weights;
};

const calculateTrainingMinutesForScenario = (
  assignments: LineupAssignments,
  substitutions: MatchOrderSubstitution[],
  traineeIds: number[],
  trainingType: number | null,
  totalMinutes: number
) => {
  const weights = trainingWeightBySlot(trainingType);
  const currentSlotByPlayerId = new Map<number, string | null>();
  const accumulatedByPlayerId = new Map<number, number>();
  traineeIds.forEach((playerId) => accumulatedByPlayerId.set(playerId, 0));
  FIELD_SLOT_ORDER.forEach((slot) => {
    const playerId = assignments[slot];
    if (typeof playerId === "number" && playerId > 0) {
      currentSlotByPlayerId.set(playerId, slot);
    }
  });

  const sortedSubstitutions = [...substitutions].sort(
    (left, right) => left.min - right.min || left.orderType - right.orderType
  );
  let intervalStart = 0;

  const applyInterval = (intervalEnd: number) => {
    const duration = Math.max(0, intervalEnd - intervalStart);
    if (duration <= 0) {
      intervalStart = intervalEnd;
      return;
    }
    traineeIds.forEach((playerId) => {
      const slot = currentSlotByPlayerId.get(playerId) ?? null;
      const weight = slot ? (weights.get(slot) ?? 0) : 0;
      accumulatedByPlayerId.set(
        playerId,
        (accumulatedByPlayerId.get(playerId) ?? 0) + duration * weight
      );
    });
    intervalStart = intervalEnd;
  };

  sortedSubstitutions.forEach((substitution) => {
    const minute = Math.min(totalMinutes, Math.max(0, substitution.min));
    applyInterval(minute);
    if (minute >= totalMinutes) return;

    if (substitution.orderType === 3) {
      const playerInSlot = currentSlotByPlayerId.get(substitution.playerin) ?? null;
      const playerOutSlot = currentSlotByPlayerId.get(substitution.playerout) ?? null;
      if (!playerInSlot || !playerOutSlot) return;
      currentSlotByPlayerId.set(substitution.playerin, playerOutSlot);
      currentSlotByPlayerId.set(substitution.playerout, playerInSlot);
      return;
    }

    if (substitution.orderType === 1) {
      const playerOutSlot = currentSlotByPlayerId.get(substitution.playerout) ?? null;
      if (!playerOutSlot) return;
      currentSlotByPlayerId.set(substitution.playerout, null);
      currentSlotByPlayerId.set(substitution.playerin, playerOutSlot);
    }
  });

  applyInterval(totalMinutes);

  return accumulatedByPlayerId;
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

const normalizeOpponentMatchRating = (value: number | null) =>
  typeof value === "number" ? value / 4 + 0.75 : null;

const computeOpponentSectorAverage = (
  values: Array<number | null>
): number | null => {
  if (values.some((value) => typeof value !== "number")) return null;
  const normalized = values.map((value) => normalizeOpponentMatchRating(value));
  if (normalized.some((value) => typeof value !== "number")) return null;
  return computeAverageRating(normalized);
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
  managerScopeId = null,
}: SeniorDashboardProps) {
  const isDevBuild = process.env.NODE_ENV !== "production";
  const showSetBestLineupDebugModal = isDevBuild;
  const { addNotification } = useNotifications();
  const { countryOptions: transferSearchCountryOptions, resolveForCountry } =
    useDisplayCurrency();
  const [seniorTeams, setSeniorTeams] = useState<SeniorTeamOption[]>(initialSeniorTeams);
  const [selectedSeniorTeamId, setSelectedSeniorTeamId] = useState<number | null>(
    initialSeniorTeamId
  );
  const [managerCompendiumUserIdOverride, setManagerCompendiumUserIdOverride] =
    useState<string | null>(null);
  const [currentSeason, setCurrentSeason] = useState<number | null>(() => readGlobalSeason());
  const [players, setPlayers] = useState<SeniorPlayer[]>([]);
  const [matchesState, setMatchesState] = useState<MatchesResponse>({});
  const [latestFetchedRatingsResponse, setLatestFetchedRatingsResponse] =
    useState<RatingsMatrixResponse | null>(null);
  const [seniorTeamGeneralInfo, setSeniorTeamGeneralInfo] =
    useState<SeniorTeamGeneralInfo | null>(null);
  const [ratingsResponse, setRatingsResponse] = useState<RatingsMatrixResponse | null>(null);
  const [ratingsManualOverrideEnabled, setRatingsManualOverrideEnabled] = useState(false);
  const [ratingsOverwriteManualEditsEnabled, setRatingsOverwriteManualEditsEnabled] =
    useState(false);
  const [ratingsManualEditsByPlayerId, setRatingsManualEditsByPlayerId] =
    useState<SeniorManualRatingsEdits>({});
  const [premiumUnlocked, setPremiumUnlocked] = useState(() =>
    hasUnlockedPremiumAccess(readAppLicenseState())
  );
  const [premiumLicenseModalOpen, setPremiumLicenseModalOpen] = useState(false);
  const [premiumLicenseModalNonce, setPremiumLicenseModalNonce] = useState(0);
  const [premiumLicenseModalContext, setPremiumLicenseModalContext] =
    useState<AppLicenseModalContext | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<number, PlayerDetailCacheEntry>>({});
  const [leagueOriginsById, setLeagueOriginsById] = useState<
    Record<number, SeniorLeagueOrigin>
  >({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [observedSeniorPlayer, setObservedSeniorPlayer] =
    useState<ObservedSeniorPlayerState | null>(null);
  const [enterSeniorPlayerIdOpen, setEnterSeniorPlayerIdOpen] = useState(false);
  const [enterSeniorPlayerIdValue, setEnterSeniorPlayerIdValue] = useState("");
  const [enterSeniorPlayerIdLoading, setEnterSeniorPlayerIdLoading] = useState(false);
  const [selectedPlayerSimulationState, setSelectedPlayerSimulationState] = useState<{
    dirty: boolean;
    metricInput: SeniorPlayerMetricInput | null;
  }>({
    dirty: false,
    metricInput: null,
  });
  const effectiveSelectedPlayerSimulationState = premiumUnlocked
    ? selectedPlayerSimulationState
    : { dirty: false, metricInput: null };
  const [mobileSeniorActive, setMobileSeniorActive] = useState(false);
  const seniorAnalyticsSource: SeniorFeatureAnalyticsSource = mobileSeniorActive
    ? "mobile"
    : "desktop";
  const trackSeniorFeatureUsed = useCallback(
    (feature: SeniorFeatureAnalyticsName, source?: SeniorFeatureAnalyticsSource) => {
      trackAnalyticsEvent("senior_feature_used", {
        feature,
        app_source: source ?? (mobileSeniorActive ? "mobile" : "desktop"),
      });
    },
    [mobileSeniorActive]
  );
  const [mobileSeniorView, setMobileSeniorView] =
    useState<SeniorMobileView>("playerDetails");
  const [mobileSeniorPlayerScreen, setMobileSeniorPlayerScreen] =
    useState<MobileSeniorPlayerScreen>("root");
  const [mobileSeniorMenuPosition, setMobileSeniorMenuPosition] = useState({
    x: 16,
    y: 108,
  });
  const openPremiumLicenseModal = useCallback(
    (context?: AppLicenseModalContext | null) => {
      setPremiumLicenseModalContext(context ?? null);
      setPremiumLicenseModalNonce((prev) => prev + 1);
      setPremiumLicenseModalOpen(true);
    },
    []
  );
  const [mobileSeniorLandscapeActive, setMobileSeniorLandscapeActive] =
    useState(false);
  const [mobileSeniorRefreshFeedbackVisible, setMobileSeniorRefreshFeedbackVisible] =
    useState(false);
  const [assignments, setAssignments] = useState<LineupAssignments>({});
  const [behaviors, setBehaviors] = useState<LineupBehaviors>({});
  const [excludedPlayers, setExcludedPlayers] = useState<ExcludedPlayersState>({});
  const [lineupExclusionsUserKey, setLineupExclusionsUserKey] =
    useState<string>("default");
  const excludedPlayersRef = useRef<ExcludedPlayersState>({});
  useEffect(() => {
    excludedPlayersRef.current = excludedPlayers;
  }, [excludedPlayers]);
  const [opponentCupStatusByTeamId, setOpponentCupStatusByTeamId] = useState<
    Record<number, boolean>
  >({});
  const [loadedMatchId, setLoadedMatchId] = useState<number | null>(null);
  const [seniorRatingsMatchContext, setSeniorRatingsMatchContext] =
    useState<SeniorRatingsPredictionMatchContext | null>(null);
  const [liveSeniorPredictedRatings, setLiveSeniorPredictedRatings] =
    useState<PredictedRatings | null>(null);
  const [liveSeniorPredictedRatingsStatus, setLiveSeniorPredictedRatingsStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle");
  const liveSeniorPredictedRatingsRequestRef = useRef(0);
  const [loadedLineupOrdersByMatchId, setLoadedLineupOrdersByMatchId] = useState<
    Record<number, LoadedLineupOrders>
  >({});
  const [seniorEditableOrdersState, setSeniorEditableOrdersState] =
    useState<SeniorEditableOrdersState | null>(null);
  const [otherOrdersEditorOpen, setOtherOrdersEditorOpen] = useState(false);
  const [otherOrdersModalMatchId, setOtherOrdersModalMatchId] = useState<number | null>(
    null
  );
  const [otherOrdersDraft, setOtherOrdersDraft] =
    useState<SeniorEditableOrdersState | null>(null);
  const [otherOrdersValidationError, setOtherOrdersValidationError] = useState<
    string | null
  >(null);
  const [otherOrdersFlashActive, setOtherOrdersFlashActive] = useState(false);
  const [lineupMutationEpoch, setLineupMutationEpoch] = useState(0);
  const [otherOrdersOpponentTargetNamesById, setOtherOrdersOpponentTargetNamesById] =
    useState<Record<number, string>>({});
  const [opponentPlayersForSession, setOpponentPlayersForSession] = useState<
    SeniorOpponentManMarkingPlayer[] | null
  >(null);
  const [opponentPlayersLoading, setOpponentPlayersLoading] = useState(false);
  const [opponentPlayersError, setOpponentPlayersError] = useState<string | null>(
    null
  );
  const [manMarkingTargetDropdownOpen, setManMarkingTargetDropdownOpen] =
    useState(false);
  const [devSimulateTacticalAssistant, setDevSimulateTacticalAssistant] =
    useState(false);
  const [devSimulatedTacticalAssistantLevel, setDevSimulatedTacticalAssistantLevel] =
    useState(SENIOR_OTHER_ORDERS_DEFAULT_DEV_TACTICAL_ASSISTANT_LEVEL);
  const [seniorAiSubmitLockActive, setSeniorAiSubmitLockActive] = useState(false);
  const [seniorAiSubmitEnabledMatchId, setSeniorAiSubmitEnabledMatchId] = useState<
    number | null
  >(null);
  const [seniorAiPreparedSubmissionMode, setSeniorAiPreparedSubmissionMode] = useState<
    Exclude<SetBestLineupMode, "extraTime"> | null
  >(null);
  const [seniorAiManMarkingReadyContext, setSeniorAiManMarkingReadyContext] =
    useState<SeniorAiManMarkingReadyContext | null>(null);
  const [tacticType, setTacticType] = useState(0);
  const [trainingType, setTrainingType] = useState<number | null>(null);
  const [setBestLineupFixedFormation, setSetBestLineupFixedFormation] = useState<
    string | null
  >(null);
  const [ignoreTrainingFormationPolicy, setIgnoreTrainingFormationPolicy] =
    useState<IgnoreTrainingFormationPolicy>("allFormations");
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
  const [startupLoadingPhase, setStartupLoadingPhase] =
    useState<StartupLoadingPhase>("teamContext");
  const [startupLoadingProgressPct, setStartupLoadingProgressPct] = useState(8);
  const [startupBootstrapActive, setStartupBootstrapActive] = useState(false);
  const [startupOverlayMounted, setStartupOverlayMounted] = useState(true);
  const [startupOverlayFading, setStartupOverlayFading] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [updatesHistory, setUpdatesHistory] = useState<SeniorUpdatesGroupedEntry[]>([]);
  const [matrixNewMarkers, setMatrixNewMarkers] = useState<SeniorMatrixNewMarkers>(
    buildEmptySeniorMatrixNewMarkers
  );
  const [selectedUpdatesId, setSelectedUpdatesId] = useState<string | null>(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSortDirectionForKey("name")
  );
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<number[] | null>(null);
  const [orderSource, setOrderSource] = useState<"list" | "ratings" | "skills" | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] =
    useState<PlayerDetailsPanelTab>("details");
  const [showSeniorSkillBonusInMatrix, setShowSeniorSkillBonusInMatrix] =
    useState(true);
  const [seniorLineupAlgorithm, setSeniorLineupAlgorithm] =
    useState<SeniorLineupAlgorithm>(() => readSeniorLineupAlgorithm());
  const [extraTimeBTeamEnabled, setExtraTimeBTeamEnabled] = useState(false);
  const [extraTimeBTeamMinutesThreshold, setExtraTimeBTeamMinutesThreshold] = useState(
    EXTRA_TIME_B_TEAM_DEFAULT_THRESHOLD
  );
  const [seniorAiLastMatchWeeksThreshold, setSeniorAiLastMatchWeeksThreshold] = useState(
    SENIOR_AI_LAST_MATCH_WEEKS_DEFAULT
  );
  const [seniorAiManMarkingFuzziness, setSeniorAiManMarkingFuzziness] = useState(
    SENIOR_AI_MAN_MARKING_FUZZINESS_DEFAULT
  );
  const [seniorAiManMarkingEnabled, setSeniorAiManMarkingEnabled] = useState(false);
  const [seniorAiManMarkingTarget, setSeniorAiManMarkingTarget] =
    useState<OpponentTargetPlayer | null>(null);
  const [extraTimeBTeamRecentMatchState, setExtraTimeBTeamRecentMatchState] =
    useState<ExtraTimeBTeamRecentMatchState>({
      status: "idle",
      recentMatch: null,
      availabilityReason: null,
      availabilityMatch: null,
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
  const [trainingAwareInfoOpen, setTrainingAwareInfoOpen] = useState(false);
  const [trainingAwareSelectedPlayerIds, setTrainingAwareSelectedPlayerIds] = useState<
    number[]
  >([]);
  const [trainingAwarePreparedTraineeIds, setTrainingAwarePreparedTraineeIds] =
    useState<number[]>([]);
  const [trainingAwareMatrixTrainingType, setTrainingAwareMatrixTrainingType] =
    useState<number | null>(null);
  const [trainingAwareMatrixTrainingTypeManual, setTrainingAwareMatrixTrainingTypeManual] =
    useState(false);
  const [trainingAwareMatchId, setTrainingAwareMatchId] = useState<number | null>(null);
  const [trainingAwareTrainingMenuOpen, setTrainingAwareTrainingMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingAutoHelpOpen, setPendingAutoHelpOpen] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [scopeReconnectModalOpen, setScopeReconnectModalOpen] = useState(false);
  const { isSupporter } = useSupporterStatus();
  const { loading: permissionsLoading, hasPermission } = useChppPermissions();
  const canPlaceBid = !permissionsLoading && hasPermission("place_bid");
  const canSetTraining = !permissionsLoading && hasPermission("set_training");
  const [transferSearchModalOpen, setTransferSearchModalOpen] = useState(false);
  const [transferSearchSourcePlayerId, setTransferSearchSourcePlayerId] = useState<number | null>(
    null
  );
  const [transferSearchFilters, setTransferSearchFilters] = useState<TransferSearchFilters | null>(
    null
  );
  const [transferSearchResults, setTransferSearchResults] = useState<TransferSearchResult[]>([]);
  const [transferSearchItemCount, setTransferSearchItemCount] = useState<number | null>(null);
  const [transferSearchSortKey, setTransferSearchSortKey] =
    useState<TransferSearchSortKey>("default");
  const [transferSearchResultsViewMode, setTransferSearchResultsViewMode] =
    useState<TransferSearchResultsViewMode>("cards");
  const [transferSearchHtmsPotentialFilter, setTransferSearchHtmsPotentialFilter] =
    useState<TransferSearchHtmsPotentialFilter>({ min: "", max: "" });
  const [transferSearchLoading, setTransferSearchLoading] = useState(false);
  const [transferSearchError, setTransferSearchError] = useState<string | null>(null);
  const [transferSearchUsedFallback, setTransferSearchUsedFallback] = useState(false);
  const [transferSearchExactEmpty, setTransferSearchExactEmpty] = useState(false);
  const [transferSearchBidDrafts, setTransferSearchBidDrafts] = useState<
    Record<number, TransferSearchBidDraft>
  >({});
  const [transferSearchBidPendingPlayerId, setTransferSearchBidPendingPlayerId] = useState<
    number | null
  >(null);
  const transferSearchRequestIdRef = useRef(0);
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
    matchId: number | null;
    title: string;
    mode: SetBestLineupMode;
    opponentRows: OpponentFormationRow[];
    potentialManMarkingTargets: OpponentPotentialTargetPlayer[];
    manMarkingTarget: OpponentTargetPlayer | null;
    manMarkingMarker: SeniorAiManMarkingMarker | null;
    chosenFormation: string | null;
    chosenFormationAverages: OpponentFormationAverages | null;
    generatedRows: GeneratedFormationRow[];
    fixedFormation: string | null;
    fixedFormationTacticRows: FixedFormationTacticRow[];
    selectedGeneratedFormation: string | null;
    selectedGeneratedTactic: number | null;
    selectedRejectedPlayerIds: number[];
    selectedIneligiblePlayerIds: number[];
    fixedFormationFailureEligiblePlayerIds: number[];
    fixedFormationFailureSlotDiagnostics: FixedFormationSlotDiagnostic[];
    selectedComparison:
      | {
          ours: CollectiveRatings;
          opponent: CollectiveRatings;
        }
      | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const clearSeniorAiSubmitLock = () => {
    setSeniorAiSubmitLockActive(false);
    setSeniorAiSubmitEnabledMatchId(null);
    setSeniorAiPreparedSubmissionMode(null);
    setSeniorAiManMarkingReadyContext(null);
    setTrainingAwarePreparedTraineeIds([]);
    setExtraTimePreparedSubmission(null);
    seededSeniorEditableOrdersContextRef.current = null;
  };

  const lockSeniorAiSubmitToMatch = (
    matchId: number,
    mode: Exclude<SetBestLineupMode, "extraTime"> | null
  ) => {
    seededSeniorEditableOrdersContextRef.current = null;
    setSeniorAiSubmitLockActive(true);
    setSeniorAiSubmitEnabledMatchId(matchId);
    setSeniorAiPreparedSubmissionMode(mode);
  };

  const preparedSeniorAiLineupActive =
    seniorAiSubmitLockActive &&
    seniorAiSubmitEnabledMatchId !== null &&
    (extraTimePreparedSubmission !== null ||
      seniorAiPreparedSubmissionMode === "trainingAware" ||
      seniorAiPreparedSubmissionMode === "ignoreTraining" ||
      seniorAiPreparedSubmissionMode === "fixedFormation");

  const pendingSeniorSubmittedLineupVariantFeature =
    useMemo<SeniorSubmittedLineupVariantFeature | null>(() => {
      if (!seniorAiSubmitLockActive || seniorAiSubmitEnabledMatchId === null) {
        return null;
      }

      if (extraTimePreparedSubmission !== null) {
        return "lineup_aim_for_extra_time_submitted";
      }

      if (seniorAiPreparedSubmissionMode === "trainingAware") {
        return "lineup_training_aware_submitted";
      }

      if (seniorAiPreparedSubmissionMode === "ignoreTraining") {
        return ignoreTrainingFormationPolicy === "trainedFormations"
          ? "lineup_ignore_training_trained_formations_submitted"
          : "lineup_ignore_training_all_formations_submitted";
      }

      if (seniorAiPreparedSubmissionMode === "fixedFormation") {
        return "lineup_apply_formation_optimization_submitted";
      }

      return null;
    }, [
      seniorAiSubmitLockActive,
      seniorAiSubmitEnabledMatchId,
      seniorAiPreparedSubmissionMode,
      extraTimePreparedSubmission,
      ignoreTrainingFormationPolicy,
    ]);

  const preservePreparedSeniorAiContextAfterManualEdit = (
    nextAssignments: LineupAssignments,
    nextBehaviors: LineupBehaviors,
    nextTacticType: number
  ) => {
    if (!preparedSeniorAiLineupActive) {
      setLoadedMatchId(null);
      clearSeniorAiSubmitLock();
      return;
    }
    const lockedMatchId = seniorAiSubmitEnabledMatchId;
    if (typeof lockedMatchId === "number" && lockedMatchId > 0) {
      setLoadedMatchId(lockedMatchId);
    }
    if (
      seniorAiPreparedSubmissionMode === "trainingAware" ||
      seniorAiPreparedSubmissionMode === "ignoreTraining" ||
      seniorAiPreparedSubmissionMode === "fixedFormation"
    ) {
      setSeniorAiManMarkingReadyContext({
        signature:
          buildSeniorAiManMarkingReadySignature({
            matchId: lockedMatchId,
            mode: seniorAiPreparedSubmissionMode,
            tacticType: nextTacticType,
            assignments: nextAssignments,
            behaviors: nextBehaviors,
          }) ?? "",
      });
    }
  };
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
    manMarkingTarget: OpponentTargetPlayer | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [opponentAnalysisActiveTab, setOpponentAnalysisActiveTab] =
    useState<OpponentAnalysisTab>("matches");
  const [opponentScoutTeamState, setOpponentScoutTeamState] =
    useState<OpponentScoutTeamState>({
      status: "idle",
      teamId: null,
      data: null,
      error: null,
    });
  const [opponentScoutTeamSortState, setOpponentScoutTeamSortState] =
    useState<TeamScoutDetailSortState>({
      key: "playerNumber",
      direction: "asc",
    });
  const [
    showOpponentScoutEffectiveMainSkillEstimation,
    setShowOpponentScoutEffectiveMainSkillEstimation,
  ] = useState(false);
  const [nonTraineeAssignmentModal, setNonTraineeAssignmentModal] = useState<{
    title: string;
    entries: NonTraineeAssignmentTraceEntry[];
  } | null>(null);
  const [submitDisclaimerOpen, setSubmitDisclaimerOpen] = useState(false);
  const [submitDisclaimerExtraTimeSummary, setSubmitDisclaimerExtraTimeSummary] =
    useState<ExtraTimeSubmitDisclaimerSummary | null>(null);
  const [submitDisclaimerManMarkingSummary, setSubmitDisclaimerManMarkingSummary] =
    useState<SeniorSubmitDisclaimerManMarkingSummary | null>(null);
  const [submitDisclaimerSeniorOrdersSummary, setSubmitDisclaimerSeniorOrdersSummary] =
    useState<SeniorSubmitDisclaimerOrdersSummary | null>(null);
  const [extraTimeInfoOpen, setExtraTimeInfoOpen] = useState(false);
  const [extraTimeTrainingMenuOpen, setExtraTimeTrainingMenuOpen] = useState(false);

  const refreshRunSeqRef = useRef(0);
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const extraTimeTrainingButtonRef = useRef<HTMLButtonElement | null>(null);
  const extraTimeTrainingMenuRef = useRef<HTMLDivElement | null>(null);
  const extraTimeAutoSelectionOpenRef = useRef(false);
  const extraTimeAutoSelectionTrainingTypeRef = useRef<number | null>(null);
  const extraTimeLastAutoSelectedPlayerIdsRef = useRef<number[] | null>(null);
  const trainingAwareTrainingButtonRef = useRef<HTMLButtonElement | null>(null);
  const trainingAwareTrainingMenuRef = useRef<HTMLDivElement | null>(null);
  const trainingAwareAutoSelectionOpenRef = useRef(false);
  const trainingAwareAutoSelectionTrainingTypeRef = useRef<number | null>(null);
  const trainingAwareLastAutoSelectedPlayerIdsRef = useRef<number[] | null>(null);
  const trainedIgnoreTrainingFormationsCacheRef = useRef<Map<number, string[]>>(new Map());
  const activeRefreshRunIdRef = useRef<number | null>(null);
  const stoppedRefreshRunIdsRef = useRef<Set<number>>(new Set());
  const staleRefreshAttemptedRef = useRef(false);
  const previousRefreshingRef = useRef(refreshing);
  const previousLastRefreshAtRef = useRef(lastRefreshAt);
  const persistedMarkersBaselineRef = useRef<PersistedSeniorMarkersBaseline | null>(
    null
  );
  const opponentFormationContextCacheRef = useRef<Map<number, OpponentFormationContext>>(
    new Map()
  );
  const opponentCupStatusCacheRef = useRef<Map<number, boolean>>(new Map());
  const opponentTargetPlayerCacheRef = useRef<
    Map<
      number,
      {
        playerId: number;
        name: string;
        tsi: number | null;
        stamina: number | null;
        ageDays: number | null;
      } | null
    >
  >(
    new Map()
  );
  const opponentPlayersSessionRequestIdRef = useRef(0);
  const opponentScoutTeamRequestIdRef = useRef(0);
  const manMarkingTargetDropdownRef = useRef<HTMLDivElement | null>(null);
  const otherOrdersFlashArmedRef = useRef(false);
  const previousStartingXiCompleteRef = useRef(false);
  const startingXiCompleteRef = useRef(false);
  const previousOtherOrdersLineupSignatureRef = useRef<string | null>(null);
  const otherOrdersLineupSignatureRef = useRef("");
  const otherOrdersFlashTimeoutRef = useRef<number | null>(null);
  const seededSeniorEditableOrdersContextRef = useRef<string | null>(null);
  const suppressNextUpdatesRecordingRef = useRef(false);
  const refreshAllRef = useRef<
    ((
      reason: "manual" | "stale",
      options?: { startup?: boolean }
    ) => Promise<boolean>) | null
  >(null);
  const restoredStateStorageKeyRef = useRef<string | null>(null);
  const restoredDataStorageKeyRef = useRef<string | null>(null);
  const seniorTeamHydratingRef = useRef(false);
  const seniorTeamHydrationKeyRef = useRef<string | null>(null);
  const seniorTeamHydrationReleaseTimeoutRef = useRef<number | null>(null);
  const pendingFindSimilarReminderRef =
    useRef<SeniorFindSimilarPlayersEventDetail | null>(null);
  const [salaryIncreaseReminderEvents, setSalaryIncreaseReminderEvents] = useState<
    SeniorSalaryIncreaseEvent[]
  >([]);

  const selectedOwnPlayer =
    selectedId !== null
      ? players.find((player) => player.PlayerID === selectedId) ?? null
      : null;
  const observedSeniorPlayerActive =
    selectedOwnPlayer === null &&
    selectedId !== null &&
    observedSeniorPlayer?.player.PlayerID === selectedId;
  const selectedPlayer =
    selectedOwnPlayer ??
    (observedSeniorPlayerActive ? observedSeniorPlayer.player : null);
  const selectedDetails =
    selectedOwnPlayer && selectedId !== null
      ? detailsCache[selectedId]?.data ?? null
      : observedSeniorPlayerActive
        ? observedSeniorPlayer.details
        : null;
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
  const resolvedSeniorTeamIdRef = useRef<number | null>(resolvedSeniorTeamId);
  useEffect(() => {
    resolvedSeniorTeamIdRef.current = resolvedSeniorTeamId;
  }, [resolvedSeniorTeamId]);
  const displayCurrency = resolveForCountry(activeSeniorTeamOption?.countryId ?? null);
  const transferMarketScopeKey = useMemo(
    () =>
      buildTransferMarketScopeKey({
        managerId: managerScopeId ?? lineupExclusionsUserKey,
        teamId: resolvedSeniorTeamId,
      }),
    [lineupExclusionsUserKey, managerScopeId, resolvedSeniorTeamId]
  );
  const { openSaveProfile: openTransferSearchSaveProfile, saveProfileModal } =
    useTransferMarketProfileSave({
      messages,
      scopeKey: transferMarketScopeKey,
      displayCurrency,
      htmsPotentialFilter: transferSearchHtmsPotentialFilter,
    });
  const formatDisplayCurrencyFromSek = useCallback(
    (valueSek: number) => formatSekCurrency(valueSek, displayCurrency),
    [displayCurrency]
  );
  const ownSeniorTeamGeneralInfo = isSeniorTeamGeneralInfo(
    seniorTeamGeneralInfo,
    resolvedSeniorTeamId
  )
    ? seniorTeamGeneralInfo
    : null;
  const ownSeniorTeamHasTacticalAssistant =
    ownSeniorTeamGeneralInfo?.hasTacticalAssistant ?? null;
  const ownSeniorTeamTacticalAssistantStaffLevel =
    ownSeniorTeamGeneralInfo?.tacticalAssistantStaffLevel ?? null;
  const ownSeniorTeamTrainerType = ownSeniorTeamGeneralInfo?.trainerType ?? null;
  const ownSeniorTeamTrainerLeadership =
    ownSeniorTeamGeneralInfo?.trainerLeadership ?? null;
  const effectiveOtherOrdersTacticalAssistantContext = useMemo(() => {
    if (isDevBuild) {
      if (!devSimulateTacticalAssistant) {
        return {
          hasTacticalAssistant: false,
          tacticalAssistantStaffLevel: null,
          trainerType: ownSeniorTeamTrainerType ?? null,
          simulated: false,
        };
      }

      return {
        hasTacticalAssistant: true,
        tacticalAssistantStaffLevel: devSimulatedTacticalAssistantLevel,
        trainerType: ownSeniorTeamTrainerType ?? 2,
        simulated: true,
      };
    }

    return {
      hasTacticalAssistant: ownSeniorTeamHasTacticalAssistant === true,
      tacticalAssistantStaffLevel: ownSeniorTeamTacticalAssistantStaffLevel,
      trainerType: ownSeniorTeamTrainerType,
      simulated: false,
    };
  }, [
    isDevBuild,
    devSimulateTacticalAssistant,
    devSimulatedTacticalAssistantLevel,
    ownSeniorTeamHasTacticalAssistant,
    ownSeniorTeamTacticalAssistantStaffLevel,
    ownSeniorTeamTrainerType,
  ]);
  const effectiveOtherOrdersHasTacticalAssistant =
    effectiveOtherOrdersTacticalAssistantContext.hasTacticalAssistant;
  const effectiveOtherOrdersTacticalAssistantStaffLevel =
    effectiveOtherOrdersTacticalAssistantContext.tacticalAssistantStaffLevel;
  const effectiveOtherOrdersTrainerType =
    effectiveOtherOrdersTacticalAssistantContext.trainerType;
  const effectiveOtherOrdersTacticalAssistantLevelIsValid =
    typeof effectiveOtherOrdersTacticalAssistantStaffLevel === "number" &&
    Number.isFinite(effectiveOtherOrdersTacticalAssistantStaffLevel) &&
    effectiveOtherOrdersTacticalAssistantStaffLevel >= 1 &&
    effectiveOtherOrdersTacticalAssistantStaffLevel <= 5;
  const seniorOtherOrdersTacticalAssistantStatus = useMemo(() => {
    if (
      effectiveOtherOrdersHasTacticalAssistant &&
      effectiveOtherOrdersTacticalAssistantLevelIsValid
    ) {
      const levelText = String(effectiveOtherOrdersTacticalAssistantStaffLevel);
      return {
        className: effectiveOtherOrdersTacticalAssistantContext.simulated
          ? styles.seniorOtherOrdersAssistantStatusDev
          : styles.seniorOtherOrdersAssistantStatusActive,
        text: (
          effectiveOtherOrdersTacticalAssistantContext.simulated
            ? messages.seniorOtherOrdersTacticalAssistantSimulated
            : messages.seniorOtherOrdersTacticalAssistantDetected
        ).replace("{{level}}", levelText),
      };
    }
    if (effectiveOtherOrdersHasTacticalAssistant) {
      return {
        className: styles.seniorOtherOrdersAssistantStatusInactive,
        text: messages.seniorOtherOrdersTacticalAssistantUnknownLevel,
      };
    }
    return {
      className: styles.seniorOtherOrdersAssistantStatusInactive,
      text: messages.seniorOtherOrdersTacticalAssistantNone,
    };
  }, [
    effectiveOtherOrdersHasTacticalAssistant,
    effectiveOtherOrdersTacticalAssistantContext.simulated,
    effectiveOtherOrdersTacticalAssistantLevelIsValid,
    effectiveOtherOrdersTacticalAssistantStaffLevel,
    messages,
  ]);
  const seniorOtherOrdersMaxPlayerOrders = effectiveOtherOrdersHasTacticalAssistant
    ? Math.min(
        SENIOR_PLAYER_ORDER_MAX_LIMIT,
        SENIOR_PLAYER_ORDER_BASE_LIMIT +
          Math.max(0, effectiveOtherOrdersTacticalAssistantStaffLevel ?? 0)
      )
    : SENIOR_PLAYER_ORDER_BASE_LIMIT;
  const [selectedSeniorLeagueIdFallback, setSelectedSeniorLeagueIdFallback] = useState<
    number | null
  >(null);
  const selectedSeniorLeagueId =
    activeSeniorTeamOption?.leagueId ?? selectedSeniorLeagueIdFallback;
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
  const persistedSeniorSelectedId =
    observedSeniorPlayerActive && observedSeniorPlayer
      ? observedSeniorPlayer.restore.selectedId !== null &&
        players.some((player) => player.PlayerID === observedSeniorPlayer.restore.selectedId)
        ? observedSeniorPlayer.restore.selectedId
        : null
      : selectedId;
  const persistedSeniorActiveDetailsTab =
    observedSeniorPlayerActive && observedSeniorPlayer
      ? observedSeniorPlayer.restore.activeDetailsTab
      : activeDetailsTab;
  const transferSearchStateUsesObservedSeniorPlayer =
    observedSeniorPlayer !== null &&
    transferSearchSourcePlayerId === observedSeniorPlayer.player.PlayerID;

  const buildSeniorStatePersistPayload = () => ({
    updatesSchemaVersion: SENIOR_UPDATES_SCHEMA_VERSION,
    selectedId: persistedSeniorSelectedId,
    assignments,
    behaviors,
    loadedMatchId,
    seniorAiSubmitLockActive,
    seniorAiSubmitEnabledMatchId,
    seniorAiPreparedSubmissionMode,
    seniorAiManMarkingReadyContext,
    tacticType,
    trainingType,
    setBestLineupFixedFormation,
    ignoreTrainingFormationPolicy,
    includeTournamentMatches,
    updatesHistory,
    matrixNewMarkers,
    selectedUpdatesId,
    activeDetailsTab: persistedSeniorActiveDetailsTab,
    mobileSeniorView,
    mobileSeniorPlayerScreen,
    mobileSeniorMenuPosition,
    showSeniorSkillBonusInMatrix,
    extraTimeBTeamEnabled,
    extraTimeBTeamMinutesThreshold,
    seniorAiLastMatchWeeksThreshold,
    seniorAiManMarkingFuzziness,
    seniorAiManMarkingEnabled,
    seniorAiManMarkingTarget,
    extraTimeSelectedPlayerIds,
    extraTimeMatrixTrainingType,
    extraTimeMatrixTrainingTypeManual,
    trainingAwareSelectedPlayerIds,
    trainingAwarePreparedTraineeIds,
    trainingAwareMatrixTrainingType,
    trainingAwareMatrixTrainingTypeManual,
    orderedPlayerIds,
    orderSource,
    ratingsManualOverrideEnabled,
    ratingsOverwriteManualEditsEnabled,
    ratingsManualEditsByPlayerId,
    transferSearchModalOpen: transferSearchStateUsesObservedSeniorPlayer
      ? false
      : transferSearchModalOpen,
    transferSearchSourcePlayerId: transferSearchStateUsesObservedSeniorPlayer
      ? null
      : transferSearchSourcePlayerId,
    transferSearchFilters: transferSearchStateUsesObservedSeniorPlayer
      ? null
      : transferSearchFilters,
    transferSearchResults: transferSearchStateUsesObservedSeniorPlayer
      ? []
      : transferSearchResults,
    transferSearchItemCount: transferSearchStateUsesObservedSeniorPlayer
      ? null
      : transferSearchItemCount,
    transferSearchSortKey,
    transferSearchResultsViewMode,
    transferSearchUsedFallback: transferSearchStateUsesObservedSeniorPlayer
      ? false
      : transferSearchUsedFallback,
    transferSearchExactEmpty: transferSearchStateUsesObservedSeniorPlayer
      ? false
      : transferSearchExactEmpty,
    transferSearchBidDrafts: transferSearchStateUsesObservedSeniorPlayer
      ? {}
      : transferSearchBidDrafts,
  });

  const buildSeniorDataPersistencePayload = useCallback(
    () => ({
      players,
      matchesState,
      ratingsResponse,
      latestFetchedRatingsResponse,
      detailsCache,
      seniorTeamGeneralInfo,
    }),
    [
      players,
      matchesState,
      ratingsResponse,
      latestFetchedRatingsResponse,
      detailsCache,
      seniorTeamGeneralInfo,
    ]
  );

  const persistSeniorDataSnapshot = useCallback(
    (
      reason: string,
      options?: {
        allowEmpty?: boolean;
        keyOverride?: string;
        payloadOverride?: ReturnType<typeof buildSeniorDataPersistencePayload>;
      }
    ) => {
      if (typeof window === "undefined") return false;

      const targetKey = options?.keyOverride ?? dataStorageKey;
      const payload =
        options?.payloadOverride ?? buildSeniorDataPersistencePayload();

      if (!options?.allowEmpty && !seniorDataSnapshotHasUsefulData(payload)) {
        return false;
      }

      try {
        window.localStorage.setItem(targetKey, JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    },
    [dataStorageKey, buildSeniorDataPersistencePayload]
  );

  const startingXiComplete = useMemo(() => {
    const startingPlayerIds = FIELD_SLOT_ORDER.map((slot) => assignments[slot]).filter(
      (playerId): playerId is number =>
        typeof playerId === "number" && Number.isFinite(playerId) && playerId > 0
    );
    return new Set(startingPlayerIds).size === 11;
  }, [assignments]);

  const otherOrdersLineupSignature = useMemo(
    () =>
      [...FIELD_SLOT_ORDER, ...BENCH_SLOT_ORDER]
        .map((slot) => {
          const playerId = assignments[slot];
          const normalizedPlayerId =
            typeof playerId === "number" && Number.isFinite(playerId) && playerId > 0
              ? String(playerId)
              : "";
          return `${slot}:${normalizedPlayerId}`;
        })
        .join("|"),
    [assignments]
  );

  useEffect(() => {
    startingXiCompleteRef.current = startingXiComplete;
    otherOrdersLineupSignatureRef.current = otherOrdersLineupSignature;
  }, [otherOrdersLineupSignature, startingXiComplete]);

  const markSeniorLineupMutated = useCallback(() => {
    setLineupMutationEpoch((value) => value + 1);
  }, []);

  const seedOtherOrdersFlashBaseline = useCallback(() => {
    previousStartingXiCompleteRef.current = startingXiCompleteRef.current;
    previousOtherOrdersLineupSignatureRef.current =
      otherOrdersLineupSignatureRef.current;
    otherOrdersFlashArmedRef.current = true;
  }, []);

  useEffect(() => {
    if (!stateRestored || !dataRestored) return;
    if (seniorTeamHydratingRef.current) return;
    if (otherOrdersFlashArmedRef.current) return;
    seedOtherOrdersFlashBaseline();
  }, [dataRestored, seedOtherOrdersFlashBaseline, stateRestored, startingXiComplete]);

  useEffect(() => {
    if (!otherOrdersFlashArmedRef.current) return;
    if (!stateRestored || !dataRestored) return;
    if (seniorTeamHydratingRef.current) return;
    if (lineupMutationEpoch === 0) return;

    const wasComplete = previousStartingXiCompleteRef.current;
    const previousSignature = previousOtherOrdersLineupSignatureRef.current;
    const signatureChanged =
      previousSignature !== null &&
      previousSignature !== otherOrdersLineupSignature;
    const becameComplete = !wasComplete && startingXiComplete;
    const changedWhileComplete = startingXiComplete && signatureChanged;

    if (becameComplete || changedWhileComplete) {
      setOtherOrdersFlashActive(true);

      if (otherOrdersFlashTimeoutRef.current !== null) {
        window.clearTimeout(otherOrdersFlashTimeoutRef.current);
      }

      otherOrdersFlashTimeoutRef.current = window.setTimeout(() => {
        setOtherOrdersFlashActive(false);
        otherOrdersFlashTimeoutRef.current = null;
      }, 5000);
    }

    previousStartingXiCompleteRef.current = startingXiComplete;
    previousOtherOrdersLineupSignatureRef.current = otherOrdersLineupSignature;
  }, [
    dataRestored,
    lineupMutationEpoch,
    otherOrdersLineupSignature,
    stateRestored,
    startingXiComplete,
  ]);

  useEffect(
    () => () => {
      if (otherOrdersFlashTimeoutRef.current !== null) {
        window.clearTimeout(otherOrdersFlashTimeoutRef.current);
        otherOrdersFlashTimeoutRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;
    const cached = readSeniorLeagueOriginsCache();
    if (cached) {
      setLeagueOriginsById(cached.originsByLeagueId);
    }
    const isFresh =
      cached !== null && Date.now() - cached.fetchedAt < WORLDDETAILS_TTL_MS;
    if (isFresh) return;

    const loadLeagueOrigins = async () => {
      try {
        const { payload } = await fetchChppJson<{
          data?: { HattrickData?: unknown };
        }>("/api/chpp/worlddetails", { cache: "no-store" });
        const origins = normalizeWorlddetailsLeagues(payload?.data?.HattrickData);
        const originsByLeagueId = buildSeniorLeagueOriginsById(origins);
        if (Object.keys(originsByLeagueId).length === 0) return;
        writeSeniorLeagueOriginsCache(originsByLeagueId);
        if (active) {
          setLeagueOriginsById(originsByLeagueId);
        }
      } catch {
        if (active && cached) {
          setLeagueOriginsById(cached.originsByLeagueId);
        }
      }
    };

    void loadLeagueOrigins();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const directLeagueId = activeSeniorTeamOption?.leagueId ?? null;
    if (directLeagueId !== null) {
      setSelectedSeniorLeagueIdFallback(directLeagueId);
      return;
    }
    if (!resolvedSeniorTeamId) {
      setSelectedSeniorLeagueIdFallback(null);
      return;
    }
    let cancelled = false;
    const loadSelectedTeamLeague = async () => {
      try {
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              Team?: {
                LeagueID?: unknown;
                League?: {
                  LeagueID?: unknown;
                };
              };
            };
          };
          error?: string;
        }>(`/api/chpp/teamdetails?teamId=${resolvedSeniorTeamId}`, {
          cache: "no-store",
        });
        if (!response.ok || payload?.error) return;
        const leagueId = parseTeamdetailsLeagueId(payload);
        if (!cancelled) {
          setSelectedSeniorLeagueIdFallback(leagueId);
        }
      } catch {
        if (!cancelled) {
          setSelectedSeniorLeagueIdFallback(null);
        }
      }
    };
    void loadSelectedTeamLeague();
    return () => {
      cancelled = true;
    };
  }, [activeSeniorTeamOption?.leagueId, resolvedSeniorTeamId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(MOBILE_SENIOR_MEDIA_QUERY);
    const sync = () => setMobileSeniorActive(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  const pushMobileSeniorState = useCallback(
    (
      view: SeniorMobileView,
      screen: MobileSeniorPlayerScreen,
      mode: "push" | "replace" = "push"
    ) => {
      setMobileSeniorView(view);
      setMobileSeniorPlayerScreen(screen);
      if (typeof window === "undefined" || !mobileSeniorActive) return;
      const nextState: MobileSeniorHistoryState = {
        appShell: "tool",
        tool: "senior",
        seniorView: view,
        seniorScreen: screen,
      };
      if (mode === "replace") {
        window.history.replaceState(nextState, "", window.location.href);
      } else {
        window.history.pushState(nextState, "", window.location.href);
      }
    },
    [mobileSeniorActive]
  );

  const openMobileSeniorHome = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(MOBILE_LAUNCHER_REQUEST_EVENT));
  }, []);

  const handleMobileSeniorViewSelect = useCallback(
    (view: SeniorMobileView) => {
      if (view === "playerDetails") {
        pushMobileSeniorState("playerDetails", selectedPlayer ? "detail" : "list");
        return;
      }
      pushMobileSeniorState(view, "root");
    },
    [pushMobileSeniorState, selectedPlayer]
  );
  const effectiveExtraTimeBTeamEnabled =
    extraTimeBTeamEnabled &&
    extraTimeBTeamRecentMatchState.status === "ready" &&
    extraTimeBTeamRecentMatchState.availabilityReason === null &&
    Boolean(extraTimeBTeamRecentMatchState.recentMatch);

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

  useEffect(() => {
    if (!resolvedSeniorTeamId || !players.length) return;
    const remindersEnabled = readReminderStorageState().preferences.enabled;
    const events = updateSeniorSalaryBaseline({
      teamId: resolvedSeniorTeamId,
      players: players.map((player) => ({
        playerId: player.PlayerID,
        playerName: formatPlayerName(player),
        salarySek: salaryValueForPlayer(player),
      })),
      createReminderEvents: remindersEnabled,
    });
    setSalaryIncreaseReminderEvents(events);
  }, [detailsById, players, resolvedSeniorTeamId]);

  const seniorTransferListingForDetails = useCallback(
    (details: SeniorPlayerDetails | null | undefined): SeniorTransferListing | null => {
      if (!details?.TransferListed) return null;
      return {
        askingPrice: details.TransferDetails?.AskingPrice,
        deadline: details.TransferDetails?.Deadline,
        highestBid: details.TransferDetails?.HighestBid,
        bidderTeamId: details.TransferDetails?.BidderTeam?.TeamID,
        bidderTeamName: details.TransferDetails?.BidderTeam?.TeamName,
      };
    },
    []
  );

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

  const trainingAwareTraineesTargetForTrainingType = (value: number | null) => {
    switch (value) {
      case 9:
        return 2;
      case 3:
        return 7;
      case 8:
        return 7;
      case 5:
        return 6;
      case 7:
        return 11;
      case 4:
        return 4;
      case 2:
        return 18;
      case 11:
        return 16;
      case 12:
        return 7;
      case 10:
        return 14;
      case 6:
        return 18;
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

  const seniorAutoHelpReady =
    !mobileSeniorActive &&
    hasSeniorData &&
    stateRestored &&
    dataRestored &&
    !startupBootstrapActive &&
    !refreshing &&
    !refreshStatus;

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

  const handleSeniorListPlayerSelect = useCallback(
    (playerId: number, playerName: string) => {
      trackSeniorFeatureUsed("player_selected", seniorAnalyticsSource);
      setActiveDetailsTab("details");
      setSelectedId(playerId);
      addNotification(`${messages.notificationPlayerSelected} ${playerName}`);
      if (mobileSeniorActive) {
        pushMobileSeniorState("playerDetails", "detail");
      }
    },
    [
      addNotification,
      messages.notificationPlayerSelected,
      mobileSeniorActive,
      pushMobileSeniorState,
      seniorAnalyticsSource,
      trackSeniorFeatureUsed,
    ]
  );

  const panelPlayers = useMemo(
    () =>
      players.map((player) => ({
        YouthPlayerID: player.PlayerID,
        FirstName: player.FirstName,
        NickName: player.NickName ?? "",
        LastName: player.LastName,
        Age: player.Age,
        AgeDays: player.AgeDays,
        TSI: player.TSI,
        Salary: player.Salary,
        IsAbroad: player.IsAbroad,
        Specialty: player.Specialty,
        InjuryLevel: player.InjuryLevel,
        Form: player.Form,
        StaminaSkill: player.StaminaSkill,
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
        TSI?: number;
        Salary?: number;
        IsAbroad?: boolean;
        OwningTeam?: {
          LeagueID?: number;
        };
        ArrivalDate?: string;
        NativeLeagueID?: number;
        OriginName?: string;
        OriginFlagDisplay?: OriginFlagDisplay;
        Specialty?: number;
        InjuryLevel?: number;
        Form?: number;
        StaminaSkill?: number;
        PersonalityStatement?: string;
        Statement?: string;
        Agreeability?: number;
        Aggressiveness?: number;
        Honesty?: number;
        Experience?: number;
        Leadership?: number;
        Loyalty?: number;
        MotherClubBonus?: boolean;
        CareerGoals?: number;
        CareerHattricks?: number;
        LeagueGoals?: number;
        CupGoals?: number;
        FriendliesGoals?: number;
        Caps?: number;
        CapsU20?: number;
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
        TransferListed?: boolean;
        TransferDetails?: {
          AskingPrice?: number;
          Deadline?: string;
          HighestBid?: number;
          BidderTeam?: {
            TeamID?: number;
            TeamName?: string;
          };
        };
      }
    >();
    detailsById.forEach((detail, playerId) => {
      const fallback = players.find((player) => player.PlayerID === playerId);
      const origin =
        typeof detail.NativeLeagueID === "number"
          ? leagueOriginsById[detail.NativeLeagueID]
          : undefined;
      map.set(playerId, {
        YouthPlayerID: playerId,
        FirstName: detail.FirstName ?? fallback?.FirstName ?? "",
        NickName: detail.NickName ?? fallback?.NickName,
        LastName: detail.LastName ?? fallback?.LastName ?? "",
        Age: detail.Age ?? fallback?.Age,
        AgeDays: detail.AgeDays ?? fallback?.AgeDays,
        TSI: detail.TSI ?? fallback?.TSI,
        Salary: detail.Salary ?? fallback?.Salary,
        IsAbroad: detail.IsAbroad ?? fallback?.IsAbroad,
        OwningTeam: detail.OwningTeam,
        ArrivalDate: detail.ArrivalDate ?? fallback?.ArrivalDate,
        NativeLeagueID: detail.NativeLeagueID,
        OriginName: origin?.leagueName,
        OriginFlagDisplay: origin?.flagDisplay,
        Specialty: detail.Specialty ?? fallback?.Specialty,
        InjuryLevel: detail.InjuryLevel ?? fallback?.InjuryLevel,
        Form: detail.Form ?? fallback?.Form,
        StaminaSkill: detail.StaminaSkill ?? fallback?.StaminaSkill,
        PersonalityStatement: detail.PersonalityStatement,
        Statement: detail.Statement,
        Agreeability: detail.Agreeability,
        Aggressiveness: detail.Aggressiveness,
        Honesty: detail.Honesty,
        Experience: detail.Experience,
        Leadership: detail.Leadership,
        Loyalty: detail.Loyalty,
        MotherClubBonus: detail.MotherClubBonus,
        CareerGoals: detail.CareerGoals,
        CareerHattricks: detail.CareerHattricks,
        LeagueGoals: detail.LeagueGoals,
        CupGoals: detail.CupGoals,
        FriendliesGoals: detail.FriendliesGoals,
        Caps: detail.Caps,
        CapsU20: detail.CapsU20,
        GoalsCurrentTeam: detail.GoalsCurrentTeam,
        AssistsCurrentTeam: detail.AssistsCurrentTeam,
        CareerAssists: detail.CareerAssists,
        MatchesCurrentTeam: detail.MatchesCurrentTeam,
        PlayerSkills: detail.PlayerSkills ?? fallback?.PlayerSkills,
        LastMatch: detail.LastMatch,
        TransferListed: detail.TransferListed,
        TransferDetails: detail.TransferDetails,
      });
    });
    return map;
  }, [detailsById, leagueOriginsById, players]);

  const selectedPanelPlayer = useMemo(() => {
    if (!selectedPlayer) return null;
    return {
      YouthPlayerID: selectedPlayer.PlayerID,
      FirstName: selectedPlayer.FirstName,
      NickName: selectedPlayer.NickName ?? "",
      LastName: selectedPlayer.LastName,
      Age: selectedDetails?.Age ?? selectedPlayer.Age,
      AgeDays: selectedDetails?.AgeDays ?? selectedPlayer.AgeDays,
      TSI: selectedDetails?.TSI ?? selectedPlayer.TSI,
      Salary: selectedDetails?.Salary ?? selectedPlayer.Salary,
      IsAbroad: selectedDetails?.IsAbroad ?? selectedPlayer.IsAbroad,
      Specialty: selectedPlayer.Specialty,
      InjuryLevel: selectedDetails?.InjuryLevel ?? selectedPlayer.InjuryLevel,
      Form: selectedDetails?.Form ?? selectedPlayer.Form,
      StaminaSkill: selectedDetails?.StaminaSkill ?? selectedPlayer.StaminaSkill,
      PlayerSkills: selectedDetails?.PlayerSkills ?? selectedPlayer.PlayerSkills,
      TransferListed: selectedDetails?.TransferListed,
      TransferDetails: selectedDetails?.TransferDetails,
    };
  }, [
    selectedDetails?.Form,
    selectedDetails?.InjuryLevel,
    selectedDetails?.PlayerSkills,
    selectedDetails?.StaminaSkill,
    selectedDetails?.TSI,
    selectedDetails?.TransferDetails,
    selectedDetails?.TransferListed,
    selectedPlayer,
  ]);

  const transferListingByName = useMemo(
    () =>
      Object.fromEntries(
        players.map((player) => [
          formatPlayerName(player),
          seniorTransferListingForDetails(detailsById.get(player.PlayerID)),
        ])
      ) as Record<string, SeniorTransferListing | null>,
    [detailsById, players, seniorTransferListingForDetails]
  );

  const selectedPanelDetails = useMemo(() => {
    if (!selectedPlayer) return null;
    if (selectedDetails) {
      const origin =
        typeof selectedDetails.NativeLeagueID === "number"
          ? leagueOriginsById[selectedDetails.NativeLeagueID]
          : undefined;
      return {
        YouthPlayerID: selectedPlayer.PlayerID,
        FirstName: selectedDetails.FirstName ?? selectedPlayer.FirstName,
        NickName: selectedDetails.NickName ?? selectedPlayer.NickName,
        LastName: selectedDetails.LastName ?? selectedPlayer.LastName,
        Age: selectedDetails.Age ?? selectedPlayer.Age,
        AgeDays: selectedDetails.AgeDays ?? selectedPlayer.AgeDays,
        TSI: selectedDetails.TSI ?? selectedPlayer.TSI,
        Salary: selectedDetails.Salary ?? selectedPlayer.Salary,
        IsAbroad: selectedDetails.IsAbroad ?? selectedPlayer.IsAbroad,
        OwningTeam: selectedDetails.OwningTeam,
        ArrivalDate: selectedDetails.ArrivalDate ?? selectedPlayer.ArrivalDate,
        NativeLeagueID: selectedDetails.NativeLeagueID,
        OriginName: origin?.leagueName,
        OriginFlagDisplay: origin?.flagDisplay,
        Specialty: selectedDetails.Specialty ?? selectedPlayer.Specialty,
        InjuryLevel: selectedDetails.InjuryLevel ?? selectedPlayer.InjuryLevel,
        Form: selectedDetails.Form ?? selectedPlayer.Form,
        StaminaSkill: selectedDetails.StaminaSkill ?? selectedPlayer.StaminaSkill,
        PersonalityStatement: selectedDetails.PersonalityStatement,
        Statement: selectedDetails.Statement,
        Agreeability: selectedDetails.Agreeability,
        Aggressiveness: selectedDetails.Aggressiveness,
        Honesty: selectedDetails.Honesty,
        Experience: selectedDetails.Experience,
        Leadership: selectedDetails.Leadership,
        Loyalty: selectedDetails.Loyalty,
        MotherClubBonus: selectedDetails.MotherClubBonus,
        CareerGoals: selectedDetails.CareerGoals,
        CareerHattricks: selectedDetails.CareerHattricks,
        LeagueGoals: selectedDetails.LeagueGoals,
        CupGoals: selectedDetails.CupGoals,
        FriendliesGoals: selectedDetails.FriendliesGoals,
        Caps: selectedDetails.Caps,
        CapsU20: selectedDetails.CapsU20,
        GoalsCurrentTeam: selectedDetails.GoalsCurrentTeam,
        AssistsCurrentTeam: selectedDetails.AssistsCurrentTeam,
        CareerAssists: selectedDetails.CareerAssists,
        MatchesCurrentTeam: selectedDetails.MatchesCurrentTeam,
        PlayerSkills: selectedDetails.PlayerSkills ?? selectedPlayer.PlayerSkills,
        LastMatch: selectedDetails.LastMatch,
        TransferListed: selectedDetails.TransferListed,
        TransferDetails: selectedDetails.TransferDetails,
      };
    }
    return (
      panelDetailsById.get(selectedPlayer.PlayerID) ?? {
        YouthPlayerID: selectedPlayer.PlayerID,
        FirstName: selectedPlayer.FirstName,
        NickName: selectedPlayer.NickName,
        LastName: selectedPlayer.LastName,
        Age: selectedPlayer.Age,
        AgeDays: selectedPlayer.AgeDays,
        TSI: selectedPlayer.TSI,
        Salary: selectedPlayer.Salary,
        IsAbroad: selectedPlayer.IsAbroad,
        ArrivalDate: selectedPlayer.ArrivalDate,
        Specialty: selectedPlayer.Specialty,
        InjuryLevel: selectedPlayer.InjuryLevel,
        Form: selectedPlayer.Form,
        StaminaSkill: selectedPlayer.StaminaSkill,
        PlayerSkills: selectedPlayer.PlayerSkills,
      }
    );
  }, [leagueOriginsById, panelDetailsById, selectedDetails, selectedPlayer]);

  const seniorSimulationLicenseContext = useMemo<AppLicenseModalContext>(
    () => ({
      featureTitle: messages.appLicenseFeatureSeniorSimulationTitle,
      featureDescription: messages.appLicenseFeatureSeniorSimulationDescription,
    }),
    [
      messages.appLicenseFeatureSeniorSimulationDescription,
      messages.appLicenseFeatureSeniorSimulationTitle,
    ]
  );

  const seniorRatingsLicenseContext = useMemo<AppLicenseModalContext>(
    () => ({
      featureTitle: messages.appLicenseFeatureSeniorRatingsTitle,
      featureDescription: messages.appLicenseFeatureSeniorRatingsDescription,
    }),
    [
      messages.appLicenseFeatureSeniorRatingsDescription,
      messages.appLicenseFeatureSeniorRatingsTitle,
    ]
  );

  const seniorManMarkingLicenseContext = useMemo<AppLicenseModalContext>(
    () => ({
      featureTitle: messages.appLicenseFeatureSeniorManMarkingTitle,
      featureDescription: messages.appLicenseFeatureSeniorManMarkingDescription,
    }),
    [
      messages.appLicenseFeatureSeniorManMarkingDescription,
      messages.appLicenseFeatureSeniorManMarkingTitle,
    ]
  );

  const seniorFixedFormationLicenseContext = useMemo<AppLicenseModalContext>(
    () => ({
      featureTitle: messages.appLicenseFeatureSeniorFixedFormationTitle,
      featureDescription: messages.appLicenseFeatureSeniorFixedFormationDescription,
    }),
    [
      messages.appLicenseFeatureSeniorFixedFormationDescription,
      messages.appLicenseFeatureSeniorFixedFormationTitle,
    ]
  );

  const transferSearchSourcePlayer = useMemo(() => {
    if (transferSearchSourcePlayerId === null) return null;
    return (
      players.find((player) => player.PlayerID === transferSearchSourcePlayerId) ??
      (observedSeniorPlayer?.player.PlayerID === transferSearchSourcePlayerId
        ? observedSeniorPlayer.player
        : null)
    );
  }, [observedSeniorPlayer, players, transferSearchSourcePlayerId]);

  const transferSearchSourceDetails = useMemo(() => {
    if (transferSearchSourcePlayerId === null) return null;
    return (
      detailsById.get(transferSearchSourcePlayerId) ??
      (observedSeniorPlayer?.player.PlayerID === transferSearchSourcePlayerId
        ? observedSeniorPlayer.details
        : null)
    );
  }, [detailsById, observedSeniorPlayer, transferSearchSourcePlayerId]);

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

  useEffect(() => {
    if (!resolvedSeniorTeamId) {
      setExcludedPlayers({});
      return;
    }
    let cancelled = false;
    void readSeniorLineupExcludedPlayers({
      teamId: resolvedSeniorTeamId,
      userKey: lineupExclusionsUserKey,
    }).then((next) => {
      if (cancelled) return;
      setExcludedPlayers(next);
    });
    return () => {
      cancelled = true;
    };
  }, [lineupExclusionsUserKey, resolvedSeniorTeamId]);

  const removeSeniorPlayerFromLineup = useCallback((playerId: number) => {
    setAssignments((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(next).forEach(([slot, assignedId]) => {
        if (Number(assignedId) === playerId) {
          next[slot] = null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setBehaviors((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.entries(assignments).forEach(([slot, assignedId]) => {
        if (Number(assignedId) === playerId && slot in next) {
          delete next[slot];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [assignments]);

  const handleToggleSeniorExcludedPlayer = useCallback((playerId: number) => {
    const teamId = resolvedSeniorTeamId;
    if (!teamId) return;
    const playerExcluded = !isPlayerExcluded(excludedPlayersRef.current, playerId);
    const optimisticNext = { ...excludedPlayersRef.current };
    if (playerExcluded) {
      optimisticNext[playerId] = true;
    } else {
      delete optimisticNext[playerId];
    }
    excludedPlayersRef.current = optimisticNext;
    setExcludedPlayers(optimisticNext);
    void setSeniorLineupExcludedPlayer({
      teamId,
      userKey: lineupExclusionsUserKey,
      playerId,
      excluded: playerExcluded,
    }).then((next) => {
      if (resolvedSeniorTeamIdRef.current !== teamId) return;
      setExcludedPlayers(next);
    });
    if (playerExcluded) {
      removeSeniorPlayerFromLineup(playerId);
      markSeniorLineupMutated();
      clearSeniorAiSubmitLock();
    }
  }, [
    clearSeniorAiSubmitLock,
    lineupExclusionsUserKey,
    markSeniorLineupMutated,
    removeSeniorPlayerFromLineup,
    resolvedSeniorTeamId,
  ]);
  useEffect(() => {
    const detail: SeniorReminderContextEventDetail = {
      context: {
        messages,
        teamId: resolvedSeniorTeamId,
        players,
        detailsCache,
        salaryIncreaseEvents: salaryIncreaseReminderEvents,
      },
    };
    window.dispatchEvent(
      new CustomEvent(SENIOR_REMINDER_CONTEXT_EVENT, { detail })
    );
  }, [
    detailsCache,
    messages,
    players,
    resolvedSeniorTeamId,
    salaryIncreaseReminderEvents,
  ]);
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
          ? computeSeniorEffectiveSkill(baseSkill, player, details)
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
  const resolvedTrainingAwareTrainingType =
    trainingAwareMatrixTrainingTypeManual && trainingAwareMatrixTrainingType !== null
      ? trainingAwareMatrixTrainingType
      : trainingType;
  const trainingAwareSortSkillKey = useMemo(
    () =>
      resolvedTrainingAwareTrainingType !== null
        ? EXTRA_TIME_SORT_SKILL_BY_TRAINING_TYPE[resolvedTrainingAwareTrainingType] ?? null
        : null,
    [resolvedTrainingAwareTrainingType]
  );
  const trainingAwareSkillsMatrixRows = useMemo(() => {
    if (!trainingAwareSortSkillKey && resolvedTrainingAwareTrainingType !== 6) {
      return skillsMatrixRows;
    }
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
          ? computeSeniorEffectiveSkill(baseSkill, player, details)
          : baseSkill;
      };
      const leftValue =
        resolvedTrainingAwareTrainingType === 6
          ? (resolveEffectiveSkill(leftPlayer, leftDetails, "ScorerSkill") ?? 0) +
            (resolveEffectiveSkill(leftPlayer, leftDetails, "SetPiecesSkill") ?? 0)
          : trainingAwareSortSkillKey
            ? resolveEffectiveSkill(leftPlayer, leftDetails, trainingAwareSortSkillKey)
            : null;
      const rightValue =
        resolvedTrainingAwareTrainingType === 6
          ? (resolveEffectiveSkill(rightPlayer, rightDetails, "ScorerSkill") ?? 0) +
            (resolveEffectiveSkill(rightPlayer, rightDetails, "SetPiecesSkill") ?? 0)
          : trainingAwareSortSkillKey
            ? resolveEffectiveSkill(rightPlayer, rightDetails, trainingAwareSortSkillKey)
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
    playersById,
    resolvedTrainingAwareTrainingType,
    showSeniorSkillBonusInMatrix,
    skillsMatrixRows,
    trainingAwareSortSkillKey,
  ]);
  const trainingAwareSelectedMatchType = useMemo(() => {
    if (trainingAwareMatchId === null) return null;
    const rawMatches =
      matchesState.data?.HattrickData?.MatchList?.Match ??
      matchesState.data?.HattrickData?.Team?.MatchList?.Match;
    const matchList = rawMatches
      ? Array.isArray(rawMatches)
        ? rawMatches
        : [rawMatches]
      : [];
    const selectedMatch = matchList.find((match) => match.MatchID === trainingAwareMatchId);
    if (!selectedMatch) return null;
    return Number.isFinite(Number(selectedMatch.MatchType))
      ? Number(selectedMatch.MatchType)
      : null;
  }, [matchesState, trainingAwareMatchId]);
  const extraTimeSelectedMatchType = useMemo(() => {
    if (extraTimeMatchId === null) return null;
    const rawMatches =
      matchesState.data?.HattrickData?.MatchList?.Match ??
      matchesState.data?.HattrickData?.Team?.MatchList?.Match;
    const matchList = rawMatches
      ? Array.isArray(rawMatches)
        ? rawMatches
        : [rawMatches]
      : [];
    const selectedMatch = matchList.find((match) => match.MatchID === extraTimeMatchId);
    if (!selectedMatch) return null;
    return Number.isFinite(Number(selectedMatch.MatchType))
      ? Number(selectedMatch.MatchType)
      : null;
  }, [extraTimeMatchId, matchesState]);
  const getSeniorAiCardsValueForPlayer = useCallback(
    (player: SeniorPlayer) => {
      const details = detailsById.get(player.PlayerID);
      return typeof details?.Cards === "number"
        ? details.Cards
        : typeof player.Cards === "number"
          ? player.Cards
          : null;
    },
    [detailsById]
  );
  const getSeniorAiRedCardedPlayerIdsForMatch = useCallback(
    (selectedMatchType: number | null) => {
      if (
        selectedMatchType === null ||
        !LEAGUE_CUP_QUALI_MATCH_TYPES.has(selectedMatchType)
      ) {
        return new Set<number>();
      }
      return new Set(
        players
          .filter((player) => {
            const cardsValue = getSeniorAiCardsValueForPlayer(player);
            return typeof cardsValue === "number" && cardsValue >= 3;
          })
          .map((player) => player.PlayerID)
      );
    },
    [getSeniorAiCardsValueForPlayer, players]
  );
  const trainingAwareRedCardedPlayerIds = useMemo(
    () => getSeniorAiRedCardedPlayerIdsForMatch(trainingAwareSelectedMatchType),
    [getSeniorAiRedCardedPlayerIdsForMatch, trainingAwareSelectedMatchType]
  );
  const extraTimeRedCardedPlayerIds = useMemo(
    () => getSeniorAiRedCardedPlayerIdsForMatch(extraTimeSelectedMatchType),
    [extraTimeSelectedMatchType, getSeniorAiRedCardedPlayerIdsForMatch]
  );
  const getSeniorAiLastMatchAgeDays = useCallback(
    (playerId: number) => {
      const lastMatchDate = detailsById.get(playerId)?.LastMatch?.Date;
      if (!lastMatchDate) return null;
      const parsedDate = parseChppDate(lastMatchDate);
      if (!parsedDate) return null;
      const ageMs = Date.now() - parsedDate.getTime();
      if (!Number.isFinite(ageMs) || ageMs < 0) return null;
      return Math.floor(ageMs / ONE_DAY_MS);
    },
    [detailsById]
  );
  const seniorAiLastMatchIneligiblePlayerIds = useMemo(() => {
    if (seniorAiLastMatchWeeksThreshold === SENIOR_AI_LAST_MATCH_WEEKS_DISABLED) {
      return new Set<number>();
    }
    const cutoffDays = seniorAiLastMatchWeeksThreshold * 7;
    return new Set(
      players
        .map((player) => player.PlayerID)
        .filter((playerId) => {
          const ageDays = getSeniorAiLastMatchAgeDays(playerId);
          return typeof ageDays === "number" && ageDays > cutoffDays;
        })
    );
  }, [getSeniorAiLastMatchAgeDays, players, seniorAiLastMatchWeeksThreshold]);
  const getSeniorAiLastMatchIneligibleTooltip = useCallback(
    (playerId: number) => {
      const ageDays = getSeniorAiLastMatchAgeDays(playerId);
      const weeksAgo =
        typeof ageDays === "number" ? Math.max(1, Math.floor(ageDays / 7)) : 0;
      return messages.seniorAiLastMatchDisregardedTooltip.replace(
        "{{weeks}}",
        String(weeksAgo)
      );
    },
    [getSeniorAiLastMatchAgeDays, messages.seniorAiLastMatchDisregardedTooltip]
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
              typeof id === "number" &&
              !extraTimeInjuredPlayerIdSet.has(id) &&
              !extraTimeRedCardedPlayerIds.has(id) &&
              !seniorAiLastMatchIneligiblePlayerIds.has(id)
          )
      ),
    [
      extraTimeInjuredPlayerIdSet,
      extraTimeRedCardedPlayerIds,
      seniorAiLastMatchIneligiblePlayerIds,
      skillsMatrixRows,
    ]
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
  const extraTimeAvailablePlayerIdSet = useMemo(() => {
    if (
      !effectiveExtraTimeBTeamEnabled ||
      extraTimeBTeamRecentMatchState.status !== "ready" ||
      !extraTimeBTeamRecentMatchState.recentMatch
    ) {
      return new Set(
        Array.from(extraTimeHealthyPlayerIdSet).filter(
          (playerId) => !isPlayerExcluded(excludedPlayers, playerId)
        )
      );
    }
    return new Set(
      Array.from(extraTimeHealthyPlayerIdSet).filter(
        (playerId) =>
          !extraTimeBTeamExcludedPlayerIds.has(playerId) &&
          !isPlayerExcluded(excludedPlayers, playerId)
      )
    );
  }, [
    effectiveExtraTimeBTeamEnabled,
    excludedPlayers,
    extraTimeBTeamExcludedPlayerIds,
    extraTimeBTeamRecentMatchState,
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
        [
          ...Array.from(extraTimeRedCardedPlayerIds),
          ...Array.from(seniorAiLastMatchIneligiblePlayerIds),
          ...Array.from(extraTimeBTeamExcludedPlayerIds),
        ]
      ),
    [
      extraTimeBTeamExcludedPlayerIds,
      extraTimeRedCardedPlayerIds,
      seniorAiLastMatchIneligiblePlayerIds,
    ]
  );
  const getExtraTimeDisregardedTooltip = useCallback(
    (playerId: number) => {
      if (extraTimeRedCardedPlayerIds.has(playerId)) {
        return messages.seniorAiRedCardedDisregardedTooltip;
      }
      if (seniorAiLastMatchIneligiblePlayerIds.has(playerId)) {
        return getSeniorAiLastMatchIneligibleTooltip(playerId);
      }
      return messages.seniorExtraTimeModalBTeamDisregardedTooltip.replace(
        "{{minutes}}",
        String(extraTimeBTeamRecentMatchState.playerMinutesById[playerId] ?? 0)
      );
    },
    [
      extraTimeRedCardedPlayerIds,
      extraTimeBTeamRecentMatchState.playerMinutesById,
      getSeniorAiLastMatchIneligibleTooltip,
      messages.seniorAiRedCardedDisregardedTooltip,
      messages.seniorExtraTimeModalBTeamDisregardedTooltip,
      seniorAiLastMatchIneligiblePlayerIds,
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
    extraTimeBTeamRecentMatchState.availabilityReason === null &&
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
  const extraTimeBTeamAvailabilityMatchHref =
    typeof extraTimeBTeamRecentMatchState.availabilityMatch?.matchId === "number" &&
    Number.isFinite(extraTimeBTeamRecentMatchState.availabilityMatch.matchId) &&
    extraTimeBTeamRecentMatchState.availabilityMatch.matchId > 0
      ? hattrickMatchUrlWithSourceSystem(
          extraTimeBTeamRecentMatchState.availabilityMatch.matchId,
          extraTimeBTeamRecentMatchState.availabilityMatch.sourceSystem
        )
      : null;
  const extraTimeBTeamAlreadyPlayedMessage =
    extraTimeBTeamRecentMatchState.availabilityReason === "bTeamAlreadyPlayed"
      ? renderTemplateTokens(messages.seniorExtraTimeModalBTeamAlreadyPlayedTooltip, {
          matchLink: extraTimeBTeamAvailabilityMatchHref ? (
            <a
              className={styles.seniorExtraTimeInlineLink}
              href={extraTimeBTeamAvailabilityMatchHref}
              target="_blank"
              rel="noreferrer"
            >
              {messages.seniorExtraTimeModalBTeamAlreadyPlayedLinkLabel}
            </a>
          ) : (
            messages.seniorExtraTimeModalBTeamAlreadyPlayedLinkLabel
          ),
        })
      : null;
  const extraTimeBTeamStatusMessage: ReactNode = (() => {
    if (extraTimeBTeamRecentMatchState.status === "loading") {
      return messages.seniorExtraTimeModalBTeamLoading;
    }
    if (extraTimeBTeamRecentMatchState.status === "error") {
      return messages.seniorExtraTimeModalBTeamError;
    }
    if (extraTimeBTeamRecentMatchState.availabilityReason === "missingATeamMatch") {
      return messages.seniorExtraTimeModalBTeamNoATeamMatchTooltip;
    }
    if (extraTimeBTeamAlreadyPlayedMessage) {
      return extraTimeBTeamAlreadyPlayedMessage;
    }
    if (!extraTimeBTeamRecentMatchState.recentMatch) {
      return messages.seniorExtraTimeModalBTeamNoRecentMatch;
    }
    return null;
  })();
  const extraTimeBTeamDisabledTooltip: ReactNode = (() => {
    if (extraTimeBTeamCanBeEnabled) return null;
    if (extraTimeBTeamRecentMatchState.status === "loading") {
      return messages.seniorExtraTimeModalBTeamLoading;
    }
    if (extraTimeBTeamRecentMatchState.status === "error") {
      return messages.seniorExtraTimeModalBTeamError;
    }
    if (extraTimeBTeamRecentMatchState.availabilityReason === "missingATeamMatch") {
      return messages.seniorExtraTimeModalBTeamNoATeamMatchTooltip;
    }
    if (extraTimeBTeamAlreadyPlayedMessage) {
      return messages.seniorExtraTimeModalBTeamAlreadyPlayedDisabledTooltip;
    }
    return null;
  })();
  const extraTimeBTeamToggleTooltip = extraTimeBTeamCanBeEnabled
    ? messages.seniorExtraTimeModalBTeamEnabledTooltip
    : extraTimeBTeamDisabledTooltip;
  const effectiveSeniorAiManMarkingEnabled =
    premiumUnlocked && seniorAiManMarkingEnabled;
  const seniorAiManMarkingSupported =
    seniorAiPreparedSubmissionMode !== null &&
    SENIOR_AI_MAN_MARKING_SUPPORTED_MODES.has(seniorAiPreparedSubmissionMode);
  const seniorAiManMarkingCurrentSignature = buildSeniorAiManMarkingReadySignature({
    matchId: loadedMatchId,
    mode: seniorAiPreparedSubmissionMode,
    tacticType,
    assignments,
    behaviors,
  });
  const seniorAiManMarkingReady =
    seniorAiSubmitLockActive &&
    seniorAiManMarkingSupported &&
    loadedMatchId !== null &&
    seniorAiSubmitEnabledMatchId === loadedMatchId &&
    seniorAiManMarkingReadyContext?.signature === seniorAiManMarkingCurrentSignature;
  const seniorAiManMarkingCandidates = useMemo(() => {
    const bestByRole: Record<SeniorAiManMarkingRole, SeniorAiManMarkingMarker | null> = {
      WB: null,
      IM: null,
      CD: null,
    };
    if (!seniorAiManMarkingSupported || !effectiveSeniorAiManMarkingEnabled) {
      return bestByRole;
    }
    (Object.entries(assignments) as Array<[keyof LineupAssignments, number | null | undefined]>)
      .forEach(([slot, playerId]) => {
        if (typeof playerId !== "number" || playerId <= 0) return;
        const role = manMarkingRoleForSlot(slot);
        if (!role) return;
        const player = playersById.get(playerId);
        if (!player) return;
        if (specialtyValueForPlayer(player) !== 3) return;
        const tsi = tsiValueForPlayer(player);
        const candidate = {
          playerId,
          role,
          name: formatPlayerName(player) || String(playerId),
          tsi,
        } satisfies SeniorAiManMarkingMarker;
        const current = bestByRole[role];
        if (
          !current ||
          candidate.tsi > current.tsi ||
          (candidate.tsi === current.tsi && candidate.playerId < current.playerId)
        ) {
          bestByRole[role] = candidate;
        }
      });
    return bestByRole;
  }, [
    assignments,
    playersById,
    seniorAiManMarkingSupported,
    detailsById,
    effectiveSeniorAiManMarkingEnabled,
  ]);
  const seniorAiManMarkingSelection = useMemo(() => {
    if (
      !seniorAiManMarkingSupported ||
      !effectiveSeniorAiManMarkingEnabled ||
      !seniorAiManMarkingTarget
    ) {
      return null;
    }
    const requiredRole: SeniorAiManMarkingRole =
      seniorAiManMarkingTarget.role === "F"
        ? "CD"
        : seniorAiManMarkingTarget.role === "IM"
          ? "IM"
          : "WB";
    const marker = seniorAiManMarkingCandidates[requiredRole];
    if (!marker || marker.tsi <= seniorAiManMarkingTarget.tsi) {
      return null;
    }
    return {
      marker,
      target: seniorAiManMarkingTarget,
    } satisfies SeniorAiManMarkingSelection;
  }, [
    seniorAiManMarkingCandidates,
    effectiveSeniorAiManMarkingEnabled,
    seniorAiManMarkingSupported,
    seniorAiManMarkingTarget,
  ]);
  const seniorAiManMarkingToggleTooltip: ReactNode = premiumUnlocked
    ? messages.seniorAiManMarkingToggleTooltip
    : messages.seniorAiManMarkingPremiumTooltip;
  const seniorAiManMarkingFuzzinessTooltip: ReactNode = premiumUnlocked
    ? messages.seniorAiManMarkingFuzzinessTooltip
    : messages.seniorAiManMarkingFuzzinessPremiumTooltip;
  const buildSetBestLineupBTeamMenuContent = (
    source: SeniorFeatureAnalyticsSource
  ) => (
    <div className={styles.seniorSetBestLineupBTeamMenuSection}>
      <label className={styles.seniorLineupAlgorithmControl}>
        <span>{messages.seniorLineupAlgorithmLabel}</span>
        <select
          className={styles.seniorExtraTimeBTeamThresholdSelect}
          aria-label={messages.seniorLineupAlgorithmAriaLabel}
          value={seniorLineupAlgorithm}
          onChange={(event) => {
            const nextAlgorithm: SeniorLineupAlgorithm =
              event.target.value === "ratings" ? "ratings" : "skills";
            setSeniorLineupAlgorithm(nextAlgorithm);
            writeSeniorLineupAlgorithm(nextAlgorithm);
          }}
        >
          <option value="skills">{messages.seniorLineupAlgorithmSkills}</option>
          <option value="ratings">{messages.seniorLineupAlgorithmRatings}</option>
        </select>
      </label>
      <div className={styles.seniorSetBestLineupMenuDivider} aria-hidden="true" />
      <div className={styles.seniorExtraTimeBTeamControls}>
        <Tooltip content={extraTimeBTeamToggleTooltip}>
          <label className={styles.matchesFilterToggle}>
            <input
              type="checkbox"
              className={styles.matchesFilterToggleInput}
              checked={effectiveExtraTimeBTeamEnabled}
              disabled={!extraTimeBTeamCanBeEnabled}
              onChange={(event) => {
                trackSeniorFeatureUsed("lineup_b_team_toggled", source);
                setExtraTimeBTeamEnabled(event.target.checked);
              }}
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
      <div className={styles.seniorSetBestLineupMenuDivider} aria-hidden="true" />
      <div className={styles.seniorExtraTimeBTeamThresholdLabel}>
        {renderTemplateTokens(
          seniorAiLastMatchWeeksThreshold === SENIOR_AI_LAST_MATCH_WEEKS_DISABLED
            ? messages.seniorAiLastMatchThresholdDisabledText
            : messages.seniorAiLastMatchThresholdText,
          {
            weeks: (
              <select
                className={styles.seniorExtraTimeBTeamThresholdSelect}
                aria-label={messages.seniorAiLastMatchThresholdAriaLabel}
                value={seniorAiLastMatchWeeksThreshold}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  if (nextValue === SENIOR_AI_LAST_MATCH_WEEKS_DISABLED) {
                    setSeniorAiLastMatchWeeksThreshold(
                      SENIOR_AI_LAST_MATCH_WEEKS_DISABLED
                    );
                    return;
                  }
                  setSeniorAiLastMatchWeeksThreshold(
                    Math.min(
                      SENIOR_AI_LAST_MATCH_WEEKS_MAX,
                      Math.max(
                        SENIOR_AI_LAST_MATCH_WEEKS_MIN,
                        nextValue || SENIOR_AI_LAST_MATCH_WEEKS_DEFAULT
                      )
                    )
                  );
                }}
              >
                <option value={SENIOR_AI_LAST_MATCH_WEEKS_DISABLED}>∞</option>
                {Array.from(
                  {
                    length:
                      SENIOR_AI_LAST_MATCH_WEEKS_MAX -
                      SENIOR_AI_LAST_MATCH_WEEKS_MIN +
                      1,
                  },
                  (_, index) => SENIOR_AI_LAST_MATCH_WEEKS_MIN + index
                ).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ),
          }
        )}
      </div>
      <div className={styles.seniorSetBestLineupMenuDivider} aria-hidden="true" />
      <div className={styles.seniorExtraTimeBTeamControls}>
        <Tooltip content={seniorAiManMarkingToggleTooltip}>
          <label className={styles.matchesFilterToggle}>
            <input
              type="checkbox"
              className={styles.matchesFilterToggleInput}
              checked={effectiveSeniorAiManMarkingEnabled}
              onChange={(event) => {
                trackSeniorFeatureUsed("lineup_man_marking_toggled", source);
                if (!premiumUnlocked) {
                  openPremiumLicenseModal(seniorManMarkingLicenseContext);
                  return;
                }
                setSeniorAiManMarkingEnabled(event.target.checked);
              }}
            />
            <span className={styles.matchesFilterToggleTrack} aria-hidden="true" />
            <span className={styles.matchesFilterToggleLabel}>
              {messages.seniorAiManMarkingToggleLabel}
            </span>
          </label>
        </Tooltip>
        <Tooltip content={seniorAiManMarkingFuzzinessTooltip}>
          <SeniorAiManMarkingFuzzinessSlider
            value={seniorAiManMarkingFuzziness}
            label={messages.seniorAiManMarkingFuzzinessLabel}
            ariaLabel={messages.seniorAiManMarkingFuzzinessAriaLabel}
            blocked={!premiumUnlocked}
            onBlockedInteraction={() =>
              openPremiumLicenseModal(seniorManMarkingLicenseContext)
            }
            disabled={premiumUnlocked ? !effectiveSeniorAiManMarkingEnabled : false}
            onCommit={setSeniorAiManMarkingFuzziness}
          />
        </Tooltip>
      </div>
      <div
        className={`${styles.seniorSetBestLineupMenuDivider} ${styles.seniorSetBestLineupMenuDividerStrong}`}
        aria-hidden="true"
      />
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
    if (
      !effectiveSeniorAiManMarkingEnabled ||
      !seniorAiManMarkingSupported ||
      loadedMatchId === null
    ) {
      setSeniorAiManMarkingTarget(null);
      setOpponentFormationsModal((prev) =>
        prev
          ? {
              ...prev,
              potentialManMarkingTargets: [],
              manMarkingTarget: null,
              manMarkingMarker: null,
            }
          : null
      );
      return;
    }
    let cancelled = false;
    void (async () => {
      const context = await fetchOpponentFormationRowsForMatch(loadedMatchId);
      if (!context || cancelled) return;
      setSeniorAiManMarkingTarget(context.manMarkingTarget);
      setOpponentFormationsModal((prev) =>
        prev && prev.matchId === loadedMatchId
          ? {
              ...prev,
              potentialManMarkingTargets: context.potentialManMarkingTargets,
              manMarkingTarget: context.manMarkingTarget,
            }
          : prev
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [
    loadedMatchId,
    effectiveSeniorAiManMarkingEnabled,
    seniorAiManMarkingFuzziness,
    seniorAiManMarkingSupported,
  ]);

  useEffect(() => {
    if (resolvedSeniorTeamId === null) {
      setExtraTimeBTeamRecentMatchState({
        status: "idle",
        recentMatch: null,
        availabilityReason: null,
        availabilityMatch: null,
        playerMinutesById: {},
      });
      return;
    }
    let cancelled = false;
    setExtraTimeBTeamRecentMatchState({
      status: "loading",
      recentMatch: null,
      availabilityReason: null,
      availabilityMatch: null,
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
          availabilityReason: null,
          availabilityMatch: null,
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
    if (
      extraTimeBTeamRecentMatchState.recentMatch &&
      extraTimeBTeamRecentMatchState.availabilityReason === null
    ) {
      return;
    }
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
    if (trainingAwareMatrixTrainingTypeManual) return;
    setTrainingAwareMatrixTrainingType(trainingType);
  }, [trainingAwareMatrixTrainingTypeManual, trainingType]);

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

  useEffect(() => {
    if (!trainingAwareTrainingMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (trainingAwareTrainingButtonRef.current?.contains(target)) return;
      if (trainingAwareTrainingMenuRef.current?.contains(target)) return;
      setTrainingAwareTrainingMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTrainingAwareTrainingMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [trainingAwareTrainingMenuOpen]);

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

  const comparePlayersBySeniorAiSetPiecesPreference = (
    left: SeniorPlayer,
    right: SeniorPlayer
  ) => {
    const leftSetPieces = skillValueForPlayer(left, "SetPiecesSkill") ?? -1;
    const rightSetPieces = skillValueForPlayer(right, "SetPiecesSkill") ?? -1;
    if (rightSetPieces !== leftSetPieces) return rightSetPieces - leftSetPieces;

    const leftStamina = parseSkill(
      detailsById.get(left.PlayerID)?.StaminaSkill ?? left.StaminaSkill
    ) ?? -1;
    const rightStamina = parseSkill(
      detailsById.get(right.PlayerID)?.StaminaSkill ?? right.StaminaSkill
    ) ?? -1;
    if (rightStamina !== leftStamina) return rightStamina - leftStamina;

    const leftForm = parseSkill(detailsById.get(left.PlayerID)?.Form ?? left.Form) ?? -1;
    const rightForm = parseSkill(detailsById.get(right.PlayerID)?.Form ?? right.Form) ?? -1;
    if (rightForm !== leftForm) return rightForm - leftForm;

    const leftAge = ageToTotalDays(left.Age ?? Number.MAX_SAFE_INTEGER, left.AgeDays ?? 0);
    const rightAge = ageToTotalDays(right.Age ?? Number.MAX_SAFE_INTEGER, right.AgeDays ?? 0);
    if (leftAge !== rightAge) return leftAge - rightAge;

    return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
      formatPlayerName(right) || String(right.PlayerID)
    );
  };

  const selectSeniorAiSetPiecesPlayerId = (
    mode: Exclude<SetBestLineupMode, "extraTime"> | null
  ) => {
    if (
      mode !== "trainingAware" &&
      mode !== "ignoreTraining" &&
      mode !== "fixedFormation"
    ) {
      return 0;
    }
    const onFieldPlayers = FIELD_SLOT_ORDER.map((slot) => assignments[slot])
      .filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0)
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    if (!onFieldPlayers.length) return 0;

    const orderedPlayers = [...onFieldPlayers].sort(comparePlayersBySeniorAiSetPiecesPreference);
    const initialSetPiecesPlayer = orderedPlayers[0] ?? null;
    const keeperId =
      typeof assignments.KP === "number" && assignments.KP > 0 ? assignments.KP : null;

    if (!initialSetPiecesPlayer) return 0;
    if (initialSetPiecesPlayer.PlayerID !== keeperId) {
      return initialSetPiecesPlayer.PlayerID;
    }

    const nextBestOutfieldPlayer =
      orderedPlayers.find((player) => player.PlayerID !== keeperId) ?? null;
    return nextBestOutfieldPlayer?.PlayerID ?? 0;
  };

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
    const keeperId =
      typeof assignments.KP === "number" && assignments.KP > 0 ? assignments.KP : null;
    const worstOutfieldSetPiecesPlayer =
      setPiecesOrderedAscending.find((player) => player.PlayerID !== keeperId) ?? null;
    const kickerIds = [
      worstSetPiecesPlayer?.PlayerID ?? 0,
      ...setPiecesOrderedDescending
        .filter((player) => player.PlayerID !== worstSetPiecesPlayer?.PlayerID)
        .map((player) => player.PlayerID),
    ].slice(0, 11);
    while (kickerIds.length < 11) kickerIds.push(0);
    return {
      kickerIds,
      setPiecesPlayerId:
        worstOutfieldSetPiecesPlayer?.PlayerID ?? worstSetPiecesPlayer?.PlayerID ?? 0,
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

  const fillExtraTimeNonTraineeRemainder = (
    assignmentsForFormation: LineupAssignments,
    traineeIds: number[],
    ratingsById: Record<number, Record<string, number>>,
    options: {
      fieldSlots: Array<keyof LineupAssignments>;
      excludedFieldPlayerIds?: Set<number>;
    }
  ) => {
    const fieldSlotsToFill = options.fieldSlots.filter(
      (slot) =>
        typeof assignmentsForFormation[slot] !== "number" ||
        (assignmentsForFormation[slot] ?? 0) <= 0
    );
    const fieldAssigned = assignPlayersWithReusableSlotAlgorithm(
      getExtraTimeEligibleNonTrainees(traineeIds, {
        excludedFieldPlayerIds: options.excludedFieldPlayerIds,
      }),
      fieldSlotsToFill,
      ratingsById,
      { collectTrace: true }
    );
    Object.entries(fieldAssigned.assignments).forEach(([slot, playerId]) => {
      assignmentsForFormation[slot] = playerId ?? null;
    });

    const fieldNonTraineeIds = new Set<number>(
      Object.values(fieldAssigned.assignments).filter(
        (playerId): playerId is number => typeof playerId === "number" && playerId > 0
      )
    );
    const usedPlayerIds = new Set<number>(
      [...FIELD_SLOT_ORDER, ...BENCH_SLOT_ORDER]
        .map((slot) => assignmentsForFormation[slot])
        .filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0)
    );
    const benchSlotsToFill = [...BENCH_SLOT_ORDER].filter(
      (slot) =>
        typeof assignmentsForFormation[slot] !== "number" ||
        (assignmentsForFormation[slot] ?? 0) <= 0
    ) as Array<keyof LineupAssignments>;
    const benchAssigned = assignPlayersWithReusableSlotAlgorithm(
      getExtraTimeEligibleNonTrainees(traineeIds, {
        excludedFieldPlayerIds: options.excludedFieldPlayerIds,
        excludeOnlyFromField: true,
      }).filter((player) => !usedPlayerIds.has(player.PlayerID)),
      benchSlotsToFill,
      ratingsById,
      { collectTrace: true }
    );
    Object.entries(benchAssigned.assignments).forEach(([slot, playerId]) => {
      assignmentsForFormation[slot] = playerId ?? null;
    });

    if (
      fieldSlotsToFill.some((slot) => {
        const playerId = assignmentsForFormation[slot];
        return typeof playerId !== "number" || playerId <= 0;
      })
    ) {
      throw new Error(messages.submitOrdersMinPlayers);
    }

    return {
      assignments: assignmentsForFormation,
      fieldNonTraineeIds,
      nonTraineeAssignmentTrace: [
        ...fieldAssigned.nonTraineeAssignmentTrace,
        ...benchAssigned.nonTraineeAssignmentTrace,
      ],
    };
  };

  const totalSkillLevelForPlayer = (player: SeniorPlayer) =>
    SKILL_KEYS.reduce((sum, key) => sum + (skillValueForPlayer(player, key) ?? 0), 0);

  const effectiveSkillValueForPlayer = (
    player: SeniorPlayer,
    key: (typeof SKILL_KEYS)[number]
  ) => {
    const details = detailsById.get(player.PlayerID);
    return calculateEffectiveSkill({
      rawSkill: skillValueForPlayer(player, key),
      loyalty: details?.Loyalty,
      motherClubBonus: details?.MotherClubBonus,
      form: details?.Form ?? player.Form,
      stamina: details?.StaminaSkill ?? player.StaminaSkill,
    });
  };

  const totalEffectiveSkillLevelForPlayer = (player: SeniorPlayer) =>
    SKILL_KEYS.reduce(
      (sum, key) => sum + (effectiveSkillValueForPlayer(player, key) ?? 0),
      0
    );

  const formValueForPlayer = (player: SeniorPlayer) => {
    const details = detailsById.get(player.PlayerID);
    return typeof details?.Form === "number"
      ? details.Form
      : typeof player.Form === "number"
        ? player.Form
        : -1;
  };

  const staminaValueForPlayer = (player: SeniorPlayer) => {
    const details = detailsById.get(player.PlayerID);
    return typeof details?.StaminaSkill === "number"
      ? details.StaminaSkill
      : typeof player.StaminaSkill === "number"
        ? player.StaminaSkill
        : -1;
  };

  const ageDaysValueForPlayer = (player: SeniorPlayer) =>
    typeof player.Age === "number" && typeof player.AgeDays === "number"
      ? player.Age * 112 + player.AgeDays
      : Number.MAX_SAFE_INTEGER;

  function specialtyValueForPlayer(player: SeniorPlayer) {
    const details = detailsById.get(player.PlayerID);
    return typeof details?.Specialty === "number"
      ? details.Specialty
      : typeof player.Specialty === "number"
        ? player.Specialty
        : null;
  }

  function tsiValueForPlayer(player: SeniorPlayer) {
    const details = detailsById.get(player.PlayerID);
    return typeof details?.TSI === "number"
      ? details.TSI
      : typeof player.TSI === "number"
        ? player.TSI
        : -1;
  }

function manMarkingRoleForSlot(
  slot: keyof LineupAssignments
): SeniorAiManMarkingRole | null {
    if (slot === "WB_L" || slot === "WB_R") return "WB";
    if (slot === "IM_L" || slot === "IM_C" || slot === "IM_R") return "IM";
    if (slot === "CD_L" || slot === "CD_C" || slot === "CD_R") return "CD";
  return null;
}

function buildSeniorAiManMarkingReadySignature(params: {
  matchId: number | null;
  mode: Exclude<SetBestLineupMode, "extraTime"> | null;
  tacticType: number;
  assignments: LineupAssignments;
  behaviors: LineupBehaviors;
}): string | null {
  const { matchId, mode, tacticType, assignments, behaviors } = params;
  if (
    typeof matchId !== "number" ||
    matchId <= 0 ||
    (mode !== "trainingAware" && mode !== "ignoreTraining" && mode !== "fixedFormation")
  ) {
    return null;
  }
  const assignmentEntries = (Object.entries(assignments) as Array<
    [keyof LineupAssignments, number | null | undefined]
  >)
    .filter(([, playerId]) => typeof playerId === "number" && playerId > 0)
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  const behaviorEntries = (Object.entries(behaviors) as Array<
    [keyof LineupBehaviors, number | null | undefined]
  >)
    .filter(([, behavior]) => typeof behavior === "number")
    .sort(([left], [right]) => String(left).localeCompare(String(right)));
  return JSON.stringify({
    matchId,
    mode,
    tacticType,
    assignments: assignmentEntries,
    behaviors: behaviorEntries,
  });
}

  const chooseRandomPlayer = <T,>(pool: T[]) =>
    pool[Math.floor(Math.random() * Math.max(1, pool.length))] ?? null;

  const pickBestPlayerWithRandomTie = (
    pool: SeniorPlayer[],
    comparator: (left: SeniorPlayer, right: SeniorPlayer) => number
  ) => {
    if (pool.length === 0) return null;
    const ordered = [...pool].sort(comparator);
    const best = ordered[0] ?? null;
    if (!best) return null;
    const tied = ordered.filter(
      (player) => comparator(best, player) === 0 && comparator(player, best) === 0
    );
    return chooseRandomPlayer(tied) ?? best;
  };

  const comparePlayersBySkillForTrainingAware = (
    left: SeniorPlayer,
    right: SeniorPlayer,
    key: (typeof SKILL_KEYS)[number]
  ) => {
    const leftValue = skillValueForPlayer(left, key) ?? -1;
    const rightValue = skillValueForPlayer(right, key) ?? -1;
    if (rightValue !== leftValue) return rightValue - leftValue;
    const leftOverall = totalSkillLevelForPlayer(left);
    const rightOverall = totalSkillLevelForPlayer(right);
    if (rightOverall !== leftOverall) return rightOverall - leftOverall;
    return (formatPlayerName(left) || String(left.PlayerID)).localeCompare(
      formatPlayerName(right) || String(right.PlayerID)
    );
  };

  const removePlayersFromPool = (pool: SeniorPlayer[], playerIds: number[]) => {
    const blocked = new Set(playerIds);
    return pool.filter((player) => !blocked.has(player.PlayerID));
  };

  const takePlayersByComparator = (
    pool: SeniorPlayer[],
    count: number,
    comparator: (left: SeniorPlayer, right: SeniorPlayer) => number
  ) => {
    const ordered = [...pool].sort(comparator);
    const selected = ordered.slice(0, count);
    return {
      selected,
      remaining: removePlayersFromPool(
        pool,
        selected.map((player) => player.PlayerID)
      ),
    };
  };

  const representativeSlotForAssignment = (
    slot: keyof LineupAssignments
  ): keyof LineupAssignments | null => {
    switch (slot) {
      case "B_GK":
        return "KP";
      case "B_CD":
        return "CD_C";
      case "B_WB":
        return "WB_L";
      case "B_IM":
        return "IM_C";
      case "B_F":
        return "F_C";
      case "B_W":
        return "W_L";
      case "B_X":
        return null;
      default:
        return slot;
    }
  };

  const assignmentRowForSlot = (slot: keyof LineupAssignments) => {
    const representative = representativeSlotForAssignment(slot);
    if (representative === "KP") return "keeper";
    if (
      representative === "WB_L" ||
      representative === "WB_R" ||
      representative === "CD_L" ||
      representative === "CD_C" ||
      representative === "CD_R"
    ) {
      return "defense";
    }
    if (
      representative === "W_L" ||
      representative === "W_R" ||
      representative === "IM_L" ||
      representative === "IM_C" ||
      representative === "IM_R"
    ) {
      return "midfield";
    }
    if (
      representative === "F_L" ||
      representative === "F_C" ||
      representative === "F_R"
    ) {
      return "attack";
    }
    return null;
  };

  const buildSeniorAiStaminaSubstitutions = () => {
    if (
      seniorAiPreparedSubmissionMode !== "trainingAware" &&
      seniorAiPreparedSubmissionMode !== "ignoreTraining" &&
      seniorAiPreparedSubmissionMode !== "fixedFormation"
    ) {
      return [] as MatchOrderSubstitution[];
    }

    const protectedTrainingAwareFieldTraineeIds =
      seniorAiPreparedSubmissionMode === "trainingAware"
        ? new Set(
            FIELD_SLOT_ORDER.map((slot) => assignments[slot]).filter(
              (playerId): playerId is number =>
                typeof playerId === "number" &&
                playerId > 0 &&
                trainingAwarePreparedTraineeIds.includes(playerId)
            )
          )
        : new Set<number>();

    const eligibleEntries = FIELD_SLOT_ORDER.map((slot) => {
      const playerId = assignments[slot];
      if (typeof playerId !== "number" || playerId <= 0) return null;
      if (protectedTrainingAwareFieldTraineeIds.has(playerId)) return null;
      const player = playersById.get(playerId);
      if (!player) return null;

      let positionGroup: "KP" | "CD" | "WB" | "IM" | "W" | "F" | null = null;
      let benchSlot: keyof LineupAssignments | null = null;
      switch (slot) {
        case "KP":
          positionGroup = "KP";
          benchSlot = "B_GK";
          break;
        case "CD_L":
        case "CD_C":
        case "CD_R":
          positionGroup = "CD";
          benchSlot = "B_CD";
          break;
        case "WB_L":
        case "WB_R":
          positionGroup = "WB";
          benchSlot = "B_WB";
          break;
        case "IM_L":
        case "IM_C":
        case "IM_R":
          positionGroup = "IM";
          benchSlot = "B_IM";
          break;
        case "W_L":
        case "W_R":
          positionGroup = "W";
          benchSlot = "B_W";
          break;
        case "F_L":
        case "F_C":
        case "F_R":
          positionGroup = "F";
          benchSlot = "B_F";
          break;
        default:
          return null;
      }

      const benchPlayerId = assignments[benchSlot];
      if (typeof benchPlayerId !== "number" || benchPlayerId <= 0) return null;

      const stamina = staminaValueForPlayer(player);
      if (stamina < 0 || stamina > 5) return null;

      return {
        playerId,
        benchPlayerId,
        positionGroup,
        stamina,
        slotIndex: FIELD_SLOT_ORDER.indexOf(slot),
      };
    }).filter(
      (
        entry
      ): entry is {
        playerId: number;
        benchPlayerId: number;
        positionGroup: "KP" | "CD" | "WB" | "IM" | "W" | "F";
        stamina: number;
        slotIndex: number;
      } => Boolean(entry)
    );

    const selectedEntries: typeof eligibleEntries = [];
    const seenGroups = new Set<string>();
    [...eligibleEntries]
      .sort(
        (left, right) =>
          left.stamina - right.stamina ||
          left.slotIndex - right.slotIndex ||
          left.playerId - right.playerId
      )
      .forEach((entry) => {
        if (selectedEntries.length >= 3 || seenGroups.has(entry.positionGroup)) return;
        seenGroups.add(entry.positionGroup);
        selectedEntries.push(entry);
      });

    return selectedEntries
      .map((entry) => {
        const minute = entry.stamina <= 3 ? 45 : entry.stamina === 4 ? 60 : 70;
        return {
          playerin: entry.benchPlayerId,
          playerout: entry.playerId,
          orderType: 1,
          min: minute,
          pos: -1,
          beh: -1,
          card: -1,
          standing: -1,
        } satisfies MatchOrderSubstitution;
      })
      .filter(
        (entry): entry is MatchOrderSubstitution =>
          Boolean(entry) &&
          !protectedTrainingAwareFieldTraineeIds.has(entry.playerin) &&
          !protectedTrainingAwareFieldTraineeIds.has(entry.playerout)
      );
  };

  const skillComboValueForAssignmentSlot = (
    player: SeniorPlayer,
    slot: keyof LineupAssignments
  ) => {
    const representative = representativeSlotForAssignment(slot);
    switch (representative) {
      case "KP":
        return (
          (skillValueForPlayer(player, "KeeperSkill") ?? 0) +
          (skillValueForPlayer(player, "DefenderSkill") ?? 0) +
          (skillValueForPlayer(player, "SetPiecesSkill") ?? 0)
        );
      case "WB_L":
      case "WB_R":
        return (
          (skillValueForPlayer(player, "DefenderSkill") ?? 0) +
          (skillValueForPlayer(player, "WingerSkill") ?? 0) +
          (skillValueForPlayer(player, "PlaymakerSkill") ?? 0)
        );
      case "CD_L":
      case "CD_C":
      case "CD_R":
        return (
          (skillValueForPlayer(player, "DefenderSkill") ?? 0) +
          (skillValueForPlayer(player, "PlaymakerSkill") ?? 0)
        );
      case "W_L":
      case "W_R":
        return (
          (skillValueForPlayer(player, "WingerSkill") ?? 0) +
          (skillValueForPlayer(player, "PlaymakerSkill") ?? 0) +
          (skillValueForPlayer(player, "DefenderSkill") ?? 0) +
          (skillValueForPlayer(player, "PassingSkill") ?? 0)
        );
      case "IM_L":
      case "IM_C":
      case "IM_R":
        return (
          (skillValueForPlayer(player, "PlaymakerSkill") ?? 0) +
          (skillValueForPlayer(player, "DefenderSkill") ?? 0) +
          (skillValueForPlayer(player, "PassingSkill") ?? 0) +
          (skillValueForPlayer(player, "ScorerSkill") ?? 0)
        );
      case "F_L":
      case "F_C":
      case "F_R":
        return (
          (skillValueForPlayer(player, "ScorerSkill") ?? 0) +
          (skillValueForPlayer(player, "PassingSkill") ?? 0) +
          (skillValueForPlayer(player, "WingerSkill") ?? 0) +
          (skillValueForPlayer(player, "PlaymakerSkill") ?? 0)
        );
      default:
        return totalSkillLevelForPlayer(player);
    }
  };

  const effectiveSkillSuitabilityForAssignmentSlot = (
    player: SeniorPlayer,
    slot: keyof LineupAssignments
  ) => {
    const effective = (key: (typeof SKILL_KEYS)[number]) =>
      effectiveSkillValueForPlayer(player, key) ?? 0;
    const representative = representativeSlotForAssignment(slot);
    switch (representative) {
      case "KP":
        return effective("KeeperSkill");
      case "WB_L":
      case "WB_R":
        return (
          3 * effective("DefenderSkill") +
          2 * effective("WingerSkill") +
          effective("PlaymakerSkill")
        );
      case "CD_L":
      case "CD_C":
      case "CD_R":
        return 2 * effective("DefenderSkill") + effective("PlaymakerSkill");
      case "W_L":
      case "W_R":
        return (
          4 * effective("WingerSkill") +
          3 * effective("PlaymakerSkill") +
          2 * effective("DefenderSkill") +
          effective("PassingSkill")
        );
      case "IM_L":
      case "IM_C":
      case "IM_R":
        return (
          4 * effective("PlaymakerSkill") +
          3 * effective("DefenderSkill") +
          2 * effective("PassingSkill") +
          effective("ScorerSkill")
        );
      case "F_L":
      case "F_C":
      case "F_R":
        return (
          4 * effective("ScorerSkill") +
          3 * effective("PassingSkill") +
          2 * effective("WingerSkill") +
          effective("PlaymakerSkill")
        );
      default:
        return totalEffectiveSkillLevelForPlayer(player);
    }
  };

  const comparePlayersForSkillsAssignment = (
    left: SeniorPlayer,
    right: SeniorPlayer,
    slot: keyof LineupAssignments
  ) => {
    const leftSuitability = effectiveSkillSuitabilityForAssignmentSlot(left, slot);
    const rightSuitability = effectiveSkillSuitabilityForAssignmentSlot(right, slot);
    if (rightSuitability !== leftSuitability) {
      return rightSuitability - leftSuitability;
    }
    const leftStamina = staminaValueForPlayer(left);
    const rightStamina = staminaValueForPlayer(right);
    if (rightStamina !== leftStamina) return rightStamina - leftStamina;
    const leftForm = formValueForPlayer(left);
    const rightForm = formValueForPlayer(right);
    if (rightForm !== leftForm) return rightForm - leftForm;
    const leftOverall = totalEffectiveSkillLevelForPlayer(left);
    const rightOverall = totalEffectiveSkillLevelForPlayer(right);
    if (rightOverall !== leftOverall) return rightOverall - leftOverall;
    return 0;
  };

  const comparePlayersForReusableAssignment = (
    left: SeniorPlayer,
    right: SeniorPlayer,
    slot: keyof LineupAssignments,
    ratingsById: Record<number, Record<string, number>>
  ) => {
    const representative = representativeSlotForAssignment(slot);
    const leftRating =
      representative && typeof ratingsById[left.PlayerID]?.[String(SLOT_TO_RATING_CODE[representative])] === "number"
        ? (ratingsById[left.PlayerID]?.[String(SLOT_TO_RATING_CODE[representative])] as number)
        : -1;
    const rightRating =
      representative && typeof ratingsById[right.PlayerID]?.[String(SLOT_TO_RATING_CODE[representative])] === "number"
        ? (ratingsById[right.PlayerID]?.[String(SLOT_TO_RATING_CODE[representative])] as number)
        : -1;
    if (rightRating !== leftRating) return rightRating - leftRating;
    const leftCombo = skillComboValueForAssignmentSlot(left, slot);
    const rightCombo = skillComboValueForAssignmentSlot(right, slot);
    if (rightCombo !== leftCombo) return rightCombo - leftCombo;
    const leftForm = formValueForPlayer(left);
    const rightForm = formValueForPlayer(right);
    if (rightForm !== leftForm) return rightForm - leftForm;
    const leftStamina = staminaValueForPlayer(left);
    const rightStamina = staminaValueForPlayer(right);
    if (rightStamina !== leftStamina) return rightStamina - leftStamina;
    const leftOverall = totalSkillLevelForPlayer(left);
    const rightOverall = totalSkillLevelForPlayer(right);
    if (rightOverall !== leftOverall) return rightOverall - leftOverall;
    const leftAgeDays = ageDaysValueForPlayer(left);
    const rightAgeDays = ageDaysValueForPlayer(right);
    if (leftAgeDays !== rightAgeDays) return leftAgeDays - rightAgeDays;
    return 0;
  };

  const bestOtherRowRatingForPlayer = (
    playerId: number,
    slot: keyof LineupAssignments,
    ratingsById: Record<number, Record<string, number>>
  ) => {
    const currentRow = assignmentRowForSlot(slot);
    const rowToCodes: Record<"keeper" | "defense" | "midfield" | "attack", number[]> = {
      keeper: [100],
      defense: [101, 103],
      midfield: [106, 107],
      attack: [111],
    };
    return (Object.entries(rowToCodes) as Array<
      ["keeper" | "defense" | "midfield" | "attack", number[]]
    >)
      .filter(([row]) => row !== currentRow)
      .reduce((best, [, codes]) => {
        const nextBest = codes.reduce((codeBest, code) => {
          const value = ratingsById[playerId]?.[String(code)];
          return Math.max(codeBest, typeof value === "number" ? value : -1);
        }, -1);
        return Math.max(best, nextBest);
      }, -1);
  };

  const playerHasNoRatingsForAnyPosition = (
    playerId: number,
    ratingsById: Record<number, Record<string, number>>
  ) =>
    Array.from(new Set(Object.values(SLOT_TO_RATING_CODE))).every(
      (ratingCode) =>
        typeof ratingsById[playerId]?.[String(ratingCode)] !== "number"
    );

  const selectUnratedPriorityCandidateForSlot = (
    candidates: SeniorPlayer[],
    slot: keyof LineupAssignments,
    ratingsById: Record<number, Record<string, number>>
  ) => {
    const unratedCandidates = candidates.filter((player) =>
      playerHasNoRatingsForAnyPosition(player.PlayerID, ratingsById)
    );
    if (unratedCandidates.length === 0) return null;

    const bestUnratedCandidate =
      [...unratedCandidates].sort((left, right) =>
        comparePlayersForReusableAssignment(left, right, slot, ratingsById)
      )[0] ?? null;
    if (!bestUnratedCandidate) return null;

    const bestAvailableSkillCombo = candidates.reduce(
      (best, player) => Math.max(best, skillComboValueForAssignmentSlot(player, slot)),
      -1
    );
    const bestUnratedSkillCombo = skillComboValueForAssignmentSlot(
      bestUnratedCandidate,
      slot
    );

    return bestUnratedSkillCombo >= bestAvailableSkillCombo ? bestUnratedCandidate : null;
  };

  const buildOrderedCandidatesForReusableAssignment = (
    candidates: SeniorPlayer[],
    slot: keyof LineupAssignments,
    ratingsById: Record<number, Record<string, number>>
  ) => {
    const selectedUnratedCandidate = selectUnratedPriorityCandidateForSlot(
      candidates,
      slot,
      ratingsById
    );
    const orderedCandidates = [...candidates].sort((left, right) =>
      comparePlayersForReusableAssignment(left, right, slot, ratingsById)
    );
    if (!selectedUnratedCandidate) return orderedCandidates;
    return [
      selectedUnratedCandidate,
      ...orderedCandidates.filter(
        (player) => player.PlayerID !== selectedUnratedCandidate.PlayerID
      ),
    ];
  };

  const buildNonTraineeRankingEntries = (
    candidates: SeniorPlayer[],
    slot: keyof LineupAssignments,
    ratingsById: Record<number, Record<string, number>>
  ): NonTraineeAssignmentRankingEntry[] => {
    const representative = representativeSlotForAssignment(slot);
    return buildOrderedCandidatesForReusableAssignment(candidates, slot, ratingsById)
      .map((player) => {
        const slotRating =
          representative &&
          typeof ratingsById[player.PlayerID]?.[String(SLOT_TO_RATING_CODE[representative])] ===
            "number"
            ? (ratingsById[player.PlayerID]?.[String(SLOT_TO_RATING_CODE[representative])] as number)
            : null;
        const bestOtherRowRating = representative
          ? bestOtherRowRatingForPlayer(player.PlayerID, slot, ratingsById)
          : null;
        const resolvedSlotRating = typeof slotRating === "number" ? slotRating : -1;
        return {
          playerId: player.PlayerID,
          slotRating,
          skillCombo: skillComboValueForAssignmentSlot(player, slot),
          form: formValueForPlayer(player),
          stamina: staminaValueForPlayer(player),
          overall: totalSkillLevelForPlayer(player),
          ageDays: ageDaysValueForPlayer(player),
          bestOtherRowRating,
          passesRowFit:
            representative !== null && typeof bestOtherRowRating === "number"
              ? bestOtherRowRating <= resolvedSlotRating
              : false,
        };
      });
  };

  const reasonMetricForReusableOrder = (
    ranking: NonTraineeAssignmentRankingEntry[],
    selectedPlayerId: number | null
  ) => {
    const selected = ranking.find((entry) => entry.playerId === selectedPlayerId) ?? null;
    const comparator =
      ranking.find((entry) => entry.playerId !== selectedPlayerId) ?? null;
    if (!selected || !comparator) return "rowFit";
    if ((selected.slotRating ?? -1) !== (comparator.slotRating ?? -1)) return "slotRating";
    if (selected.skillCombo !== comparator.skillCombo) return "skillCombo";
    if (selected.form !== comparator.form) return "form";
    if (selected.stamina !== comparator.stamina) return "stamina";
    if (selected.overall !== comparator.overall) return "overall";
    if (selected.ageDays !== comparator.ageDays) return "age";
    return "rowFit";
  };

  const labelForNonTraineeReason = (
    reason:
      | "slotRating"
      | "skillCombo"
      | "form"
      | "stamina"
      | "overall"
      | "age"
      | "rowFit"
      | "randomFallback"
      | "tiedOtherSectorFallback"
      | "betterOtherSectorFallback"
      | "formFallback"
      | "aggregate"
      | "alphabetical"
  ) => {
    switch (reason) {
      case "slotRating":
        return messages.setBestLineupDevReasonBestSlotRating;
      case "skillCombo":
        return messages.setBestLineupDevReasonBestSkillCombo;
      case "form":
        return messages.setBestLineupDevReasonBestForm;
      case "stamina":
        return messages.setBestLineupDevReasonBestStamina;
      case "overall":
        return messages.setBestLineupDevReasonBestOverall;
      case "age":
        return messages.setBestLineupDevReasonYoungestTieBreak;
      case "randomFallback":
        return messages.setBestLineupDevReasonRandomFallback;
      case "tiedOtherSectorFallback":
        return messages.setBestLineupDevReasonTiedOtherSectorFallback;
      case "betterOtherSectorFallback":
        return messages.setBestLineupDevReasonBetterOtherSectorFallback;
      case "formFallback":
        return messages.setBestLineupDevReasonFormFallback;
      case "aggregate":
        return messages.setBestLineupDevReasonBestAggregate;
      case "alphabetical":
        return messages.setBestLineupDevReasonAlphabeticalTieBreak;
      case "rowFit":
      default:
        return messages.setBestLineupDevReasonFirstRowFit;
    }
  };

  const assignPlayersWithRatingsSlotAlgorithm = (
    pool: SeniorPlayer[],
    slots: Array<keyof LineupAssignments>,
    ratingsById: Record<number, Record<string, number>>,
    options?: {
      collectTrace?: boolean;
    }
  ) => {
    let available = [...pool];
    const assignments: Partial<LineupAssignments> = {};
    const unresolvedSlots: Array<keyof LineupAssignments> = [];
    const nonTraineeAssignmentTrace: NonTraineeAssignmentTraceEntry[] = [];

    slots.forEach((slot) => {
      const representative = representativeSlotForAssignment(slot);
      const selectedUnratedCandidate = selectUnratedPriorityCandidateForSlot(
        available,
        slot,
        ratingsById
      );
      if (!representative) {
        if (selectedUnratedCandidate) {
          assignments[slot] = selectedUnratedCandidate.PlayerID;
          if (options?.collectTrace) {
            const ranking = buildNonTraineeRankingEntries(available, slot, ratingsById);
            nonTraineeAssignmentTrace.push({
              slot,
              selectedPlayerId: selectedUnratedCandidate.PlayerID,
              selectedReason: labelForNonTraineeReason("skillCombo"),
              ranking,
            });
          }
          available = available.filter(
            (player) => player.PlayerID !== selectedUnratedCandidate.PlayerID
          );
          return;
        }
        unresolvedSlots.push(slot);
        return;
      }
      const orderedCandidates = buildOrderedCandidatesForReusableAssignment(
        available,
        slot,
        ratingsById
      );
      const selected =
        selectedUnratedCandidate ??
        orderedCandidates.find((candidate) => {
          const slotRating = ratingsById[candidate.PlayerID]?.[
            String(SLOT_TO_RATING_CODE[representative])
          ];
          const resolvedSlotRating = typeof slotRating === "number" ? slotRating : -1;
          return (
            bestOtherRowRatingForPlayer(candidate.PlayerID, slot, ratingsById) <=
            resolvedSlotRating
          );
        }) ??
        null;
      if (!selected) {
        unresolvedSlots.push(slot);
        return;
      }
      assignments[slot] = selected.PlayerID;
      if (options?.collectTrace) {
        const ranking = buildNonTraineeRankingEntries(available, slot, ratingsById);
        nonTraineeAssignmentTrace.push({
          slot,
          selectedPlayerId: selected.PlayerID,
          selectedReason: labelForNonTraineeReason(
            selectedUnratedCandidate ? "skillCombo" : reasonMetricForReusableOrder(ranking, selected.PlayerID)
          ),
          ranking,
        });
      }
      available = available.filter((player) => player.PlayerID !== selected.PlayerID);
    });

    unresolvedSlots.forEach((slot) => {
      const ranking = options?.collectTrace
        ? buildNonTraineeRankingEntries(available, slot, ratingsById)
        : [];
      const selected =
        selectUnratedPriorityCandidateForSlot(available, slot, ratingsById) ??
        chooseRandomPlayer(available);
      assignments[slot] = selected?.PlayerID ?? null;
      if (options?.collectTrace) {
        nonTraineeAssignmentTrace.push({
          slot,
          selectedPlayerId: selected?.PlayerID ?? null,
          selectedReason: labelForNonTraineeReason(
            selected &&
              playerHasNoRatingsForAnyPosition(selected.PlayerID, ratingsById)
              ? "skillCombo"
              : "randomFallback"
          ),
          ranking,
        });
      }
      if (selected) {
        available = available.filter((player) => player.PlayerID !== selected.PlayerID);
      }
    });

    return {
      assignments,
      remaining: available,
      nonTraineeAssignmentTrace,
    };
  };

  const assignPlayersWithSkillsSlotAlgorithm = (
    pool: SeniorPlayer[],
    slots: Array<keyof LineupAssignments>,
    options?: {
      collectTrace?: boolean;
    }
  ) => {
    let available = [...pool];
    const assignments: Partial<LineupAssignments> = {};
    const nonTraineeAssignmentTrace: NonTraineeAssignmentTraceEntry[] = [];

    slots.forEach((slot) => {
      const comparator = (left: SeniorPlayer, right: SeniorPlayer) =>
        comparePlayersForSkillsAssignment(left, right, slot);
      const ranking = [...available]
        .sort(comparator)
        .map(
          (player) =>
            ({
              playerId: player.PlayerID,
              slotRating: null,
              skillCombo: effectiveSkillSuitabilityForAssignmentSlot(player, slot),
              form: formValueForPlayer(player),
              stamina: staminaValueForPlayer(player),
              overall: totalEffectiveSkillLevelForPlayer(player),
              ageDays: ageDaysValueForPlayer(player),
              bestOtherRowRating: null,
              passesRowFit: false,
            }) satisfies NonTraineeAssignmentRankingEntry
        );
      const selected = pickBestPlayerWithRandomTie(available, comparator);
      assignments[slot] = selected?.PlayerID ?? null;

      if (options?.collectTrace) {
        const comparison = ranking.find(
          (entry) => entry.playerId !== selected?.PlayerID
        );
        let reason:
          | "skillCombo"
          | "stamina"
          | "form"
          | "overall"
          | "randomFallback" = "randomFallback";
        const selectedRanking = ranking.find(
          (entry) => entry.playerId === selected?.PlayerID
        );
        if (selectedRanking && comparison) {
          if (selectedRanking.skillCombo !== comparison.skillCombo) {
            reason = "skillCombo";
          } else if (selectedRanking.stamina !== comparison.stamina) {
            reason = "stamina";
          } else if (selectedRanking.form !== comparison.form) {
            reason = "form";
          } else if (selectedRanking.overall !== comparison.overall) {
            reason = "overall";
          }
        } else if (selectedRanking) {
          reason = "skillCombo";
        }
        nonTraineeAssignmentTrace.push({
          slot,
          selectedPlayerId: selected?.PlayerID ?? null,
          selectedReason: labelForNonTraineeReason(reason),
          ranking,
        });
      }

      if (selected) {
        available = available.filter(
          (player) => player.PlayerID !== selected.PlayerID
        );
      }
    });

    return {
      assignments,
      remaining: available,
      nonTraineeAssignmentTrace,
    };
  };

  const assignPlayersWithReusableSlotAlgorithm = (
    pool: SeniorPlayer[],
    slots: Array<keyof LineupAssignments>,
    ratingsById: Record<number, Record<string, number>>,
    options?: {
      collectTrace?: boolean;
    }
  ) =>
    seniorLineupAlgorithm === "skills"
      ? assignPlayersWithSkillsSlotAlgorithm(pool, slots, options)
      : assignPlayersWithRatingsSlotAlgorithm(pool, slots, ratingsById, options);

  const buildTrainingAwareAssignmentsForShape = async (
    occupiedSlots: string[],
    activeTrainingType: number | null,
    traineeIds: number[],
    selectedMatchType: number | null
  ) => {
    const ratingsById = await ensureExtraTimeRatingsById();
    const traineeCountTarget = trainingAwareTraineesTargetForTrainingType(activeTrainingType);
    const trainees = traineeIds
      .map((playerId) => playersById.get(playerId) ?? null)
      .filter((player): player is SeniorPlayer => Boolean(player));
    if (trainees.length !== traineeCountTarget) {
      throw new Error(messages.submitOrdersError);
    }

    const allEligiblePlayers = players.filter((player) =>
      isSeniorAiEligibleForMatch(player, selectedMatchType)
    );
    const traineeIdSet = new Set(traineeIds);
    const assignments: LineupAssignments = {};
    let remainingTrainees = [...trainees];

    const assignPlayersToSlots = (
      slots: Array<keyof LineupAssignments>,
      selectedPlayers: SeniorPlayer[]
    ) => {
      if (slots.length !== selectedPlayers.length) {
        throw new Error(messages.submitOrdersError);
      }
      slots.forEach((slot, index) => {
        assignments[slot] = selectedPlayers[index]?.PlayerID ?? null;
      });
    };

    const assignTopPlayersBySkill = (
      pool: SeniorPlayer[],
      count: number,
      key: (typeof SKILL_KEYS)[number]
    ) => takePlayersByComparator(pool, count, (left, right) =>
      comparePlayersBySkillForTrainingAware(left, right, key)
    );

    const resolveBenchPair = (
      playersForPair: SeniorPlayer[],
      options: {
        preferredWideSlot: keyof LineupAssignments;
        preferredCoreSlot: keyof LineupAssignments;
        coreSkillKey: (typeof SKILL_KEYS)[number];
        tertiarySkillKey: (typeof SKILL_KEYS)[number];
      }
    ) => {
      const [first, second] = playersForPair;
      if (!first || !second) {
        throw new Error(messages.submitOrdersError);
      }
      const firstWinger = skillValueForPlayer(first, "WingerSkill") ?? -1;
      const secondWinger = skillValueForPlayer(second, "WingerSkill") ?? -1;
      if (firstWinger !== secondWinger) {
        if (firstWinger > secondWinger) {
          assignments[options.preferredWideSlot] = first.PlayerID;
          assignments[options.preferredCoreSlot] = second.PlayerID;
        } else {
          assignments[options.preferredWideSlot] = second.PlayerID;
          assignments[options.preferredCoreSlot] = first.PlayerID;
        }
        return;
      }
      const firstCore = skillValueForPlayer(first, options.coreSkillKey) ?? -1;
      const secondCore = skillValueForPlayer(second, options.coreSkillKey) ?? -1;
      if (firstCore !== secondCore) {
        if (firstCore > secondCore) {
          assignments[options.preferredCoreSlot] = first.PlayerID;
          assignments[options.preferredWideSlot] = second.PlayerID;
        } else {
          assignments[options.preferredCoreSlot] = second.PlayerID;
          assignments[options.preferredWideSlot] = first.PlayerID;
        }
        return;
      }
      const firstTertiary = skillValueForPlayer(first, options.tertiarySkillKey) ?? -1;
      const secondTertiary = skillValueForPlayer(second, options.tertiarySkillKey) ?? -1;
      if (firstTertiary !== secondTertiary) {
        if (firstTertiary > secondTertiary) {
          assignments[options.preferredCoreSlot] = first.PlayerID;
          assignments[options.preferredWideSlot] = second.PlayerID;
        } else {
          assignments[options.preferredCoreSlot] = second.PlayerID;
          assignments[options.preferredWideSlot] = first.PlayerID;
        }
        return;
      }
      const firstOverall = totalSkillLevelForPlayer(first);
      const secondOverall = totalSkillLevelForPlayer(second);
      if (firstOverall !== secondOverall) {
        if (firstOverall > secondOverall) {
          assignments[options.preferredCoreSlot] = first.PlayerID;
          assignments[options.preferredWideSlot] = second.PlayerID;
        } else {
          assignments[options.preferredCoreSlot] = second.PlayerID;
          assignments[options.preferredWideSlot] = first.PlayerID;
        }
        return;
      }
      const randomCore = chooseRandomPlayer(playersForPair);
      assignments[options.preferredCoreSlot] = randomCore?.PlayerID ?? null;
      assignments[options.preferredWideSlot] =
        playersForPair.find((player) => player.PlayerID !== randomCore?.PlayerID)?.PlayerID ??
        null;
    };

    switch (activeTrainingType) {
      case 9: {
        const keeperComparator = (left: SeniorPlayer, right: SeniorPlayer) => {
          const leftKeeping = skillValueForPlayer(left, "KeeperSkill") ?? -1;
          const rightKeeping = skillValueForPlayer(right, "KeeperSkill") ?? -1;
          if (rightKeeping !== leftKeeping) return rightKeeping - leftKeeping;
          const leftSetPieces = skillValueForPlayer(left, "SetPiecesSkill") ?? -1;
          const rightSetPieces = skillValueForPlayer(right, "SetPiecesSkill") ?? -1;
          if (rightSetPieces !== leftSetPieces) return rightSetPieces - leftSetPieces;
          const leftAverage = averageSkillLevelForPlayer(left);
          const rightAverage = averageSkillLevelForPlayer(right);
          if (rightAverage !== leftAverage) return rightAverage - leftAverage;
          return 0;
        };
        const startingKeeper = pickBestPlayerWithRandomTie(remainingTrainees, keeperComparator);
        if (!startingKeeper) {
          throw new Error(messages.submitOrdersError);
        }
        assignments.KP = startingKeeper.PlayerID;
        remainingTrainees = removePlayersFromPool(remainingTrainees, [startingKeeper.PlayerID]);
        const benchKeeper = remainingTrainees[0] ?? null;
        assignments.B_GK = benchKeeper?.PlayerID ?? null;
        remainingTrainees = [];
        break;
      }
      case 3: {
        const wide = assignTopPlayersBySkill(remainingTrainees, 2, "WingerSkill");
        assignPlayersToSlots(["WB_L", "WB_R"], wide.selected);
        const central = assignTopPlayersBySkill(wide.remaining, 3, "DefenderSkill");
        assignPlayersToSlots(["CD_L", "CD_C", "CD_R"], central.selected);
        resolveBenchPair(central.remaining, {
          preferredWideSlot: "B_WB",
          preferredCoreSlot: "B_CD",
          coreSkillKey: "DefenderSkill",
          tertiarySkillKey: "PlaymakerSkill",
        });
        remainingTrainees = [];
        break;
      }
      case 8: {
        const wide = assignTopPlayersBySkill(remainingTrainees, 2, "WingerSkill");
        assignPlayersToSlots(["W_L", "W_R"], wide.selected);
        const midfield = assignTopPlayersBySkill(wide.remaining, 3, "PlaymakerSkill");
        assignPlayersToSlots(["IM_L", "IM_C", "IM_R"], midfield.selected);
        resolveBenchPair(midfield.remaining, {
          preferredWideSlot: "B_W",
          preferredCoreSlot: "B_IM",
          coreSkillKey: "PlaymakerSkill",
          tertiarySkillKey: "DefenderSkill",
        });
        remainingTrainees = [];
        break;
      }
      case 5: {
        const ordered = assignTopPlayersBySkill(remainingTrainees, remainingTrainees.length, "WingerSkill").selected;
        assignPlayersToSlots(["W_L", "W_R"], ordered.slice(0, 2));
        assignPlayersToSlots(["WB_L", "WB_R"], ordered.slice(2, 4));
        const benchPair = ordered.slice(4, 6);
        const [first, second] = benchPair;
        if (!first || !second) {
          throw new Error(messages.submitOrdersError);
        }
        const firstWinger = skillValueForPlayer(first, "WingerSkill") ?? -1;
        const secondWinger = skillValueForPlayer(second, "WingerSkill") ?? -1;
        if (firstWinger !== secondWinger) {
          assignments.B_W = firstWinger > secondWinger ? first.PlayerID : second.PlayerID;
          assignments.B_WB = firstWinger > secondWinger ? second.PlayerID : first.PlayerID;
        } else {
          const firstOverall = totalSkillLevelForPlayer(first);
          const secondOverall = totalSkillLevelForPlayer(second);
          if (firstOverall !== secondOverall) {
            assignments.B_W = firstOverall > secondOverall ? first.PlayerID : second.PlayerID;
            assignments.B_WB = firstOverall > secondOverall ? second.PlayerID : first.PlayerID;
          } else {
            const randomWide = chooseRandomPlayer(benchPair);
            assignments.B_W = randomWide?.PlayerID ?? null;
            assignments.B_WB =
              benchPair.find((player) => player.PlayerID !== randomWide?.PlayerID)?.PlayerID ??
              null;
          }
        }
        remainingTrainees = [];
        break;
      }
      case 7: {
        const forwards = assignTopPlayersBySkill(remainingTrainees, 3, "ScorerSkill");
        assignPlayersToSlots(["F_L", "F_C", "F_R"], forwards.selected);
        const wingers = assignTopPlayersBySkill(forwards.remaining, 2, "WingerSkill");
        assignPlayersToSlots(["W_L", "W_R"], wingers.selected);
        const mids = assignTopPlayersBySkill(wingers.remaining, 3, "PlaymakerSkill");
        assignPlayersToSlots(["IM_L", "IM_C", "IM_R"], mids.selected);
        let benchPool = mids.remaining;
        const forwardComparator = (left: SeniorPlayer, right: SeniorPlayer) => {
          const leftScoring = skillValueForPlayer(left, "ScorerSkill") ?? -1;
          const rightScoring = skillValueForPlayer(right, "ScorerSkill") ?? -1;
          if (rightScoring !== leftScoring) return rightScoring - leftScoring;
          return 0;
        };
        const wingComparator = (left: SeniorPlayer, right: SeniorPlayer) => {
          const leftWinger = skillValueForPlayer(left, "WingerSkill") ?? -1;
          const rightWinger = skillValueForPlayer(right, "WingerSkill") ?? -1;
          if (rightWinger !== leftWinger) return rightWinger - leftWinger;
          return 0;
        };
        const midfieldComparator = (left: SeniorPlayer, right: SeniorPlayer) => {
          const leftPm = skillValueForPlayer(left, "PlaymakerSkill") ?? -1;
          const rightPm = skillValueForPlayer(right, "PlaymakerSkill") ?? -1;
          if (rightPm !== leftPm) return rightPm - leftPm;
          return 0;
        };
        const benchForward = pickBestPlayerWithRandomTie(benchPool, forwardComparator);
        if (!benchForward) {
          throw new Error(messages.submitOrdersError);
        }
        assignments.B_F = benchForward.PlayerID;
        benchPool = removePlayersFromPool(benchPool, [benchForward.PlayerID]);
        const benchWing = pickBestPlayerWithRandomTie(benchPool, wingComparator);
        if (!benchWing) {
          throw new Error(messages.submitOrdersError);
        }
        assignments.B_W = benchWing.PlayerID;
        benchPool = removePlayersFromPool(benchPool, [benchWing.PlayerID]);
        const benchMid = pickBestPlayerWithRandomTie(benchPool, midfieldComparator);
        assignments.B_IM = benchMid?.PlayerID ?? null;
        remainingTrainees = [];
        break;
      }
      case 4: {
        const forwards = assignTopPlayersBySkill(remainingTrainees, 4, "ScorerSkill").selected;
        assignPlayersToSlots(["F_L", "F_C", "F_R"], forwards.slice(0, 3));
        assignments.B_F = forwards[3]?.PlayerID ?? null;
        remainingTrainees = [];
        break;
      }
      case 2:
      case 6: {
        const orderedBySetPieces = [...remainingTrainees].sort(comparePlayersBySetPiecesDescending);
        const fieldTrainees = orderedBySetPieces.slice(0, occupiedSlots.length);
        const benchTrainees = orderedBySetPieces.slice(occupiedSlots.length);
        const fieldAssigned = assignPlayersWithReusableSlotAlgorithm(
          fieldTrainees,
          occupiedSlots as Array<keyof LineupAssignments>,
          ratingsById
        );
        Object.assign(assignments, fieldAssigned.assignments);
        const benchAssigned = assignPlayersWithReusableSlotAlgorithm(
          benchTrainees,
          [...BENCH_SLOT_ORDER],
          ratingsById
        );
        Object.assign(assignments, benchAssigned.assignments);
        remainingTrainees = [];
        break;
      }
      case 11: {
        const keepers = takePlayersByComparator(remainingTrainees, 2, compareKeeperTrainees);
        assignments.KP = keepers.selected[0]?.PlayerID ?? null;
        assignments.B_GK = keepers.selected[1]?.PlayerID ?? null;
        const wide = assignTopPlayersBySkill(keepers.remaining, 6, "WingerSkill").selected;
        assignPlayersToSlots(["W_L", "W_R", "WB_L", "WB_R", "B_W", "B_WB"], wide);
        const afterWide = removePlayersFromPool(
          keepers.remaining,
          wide.map((player) => player.PlayerID)
        );
        const midfield = assignTopPlayersBySkill(afterWide, 4, "PlaymakerSkill").selected;
        assignPlayersToSlots(["IM_L", "IM_C", "IM_R", "B_IM"], midfield);
        const afterMid = removePlayersFromPool(
          afterWide,
          midfield.map((player) => player.PlayerID)
        );
        const defenders = assignTopPlayersBySkill(afterMid, 4, "DefenderSkill").selected;
        assignPlayersToSlots(["CD_L", "CD_C", "CD_R", "B_CD"], defenders);
        remainingTrainees = [];
        break;
      }
      case 12: {
        const forwards = assignTopPlayersBySkill(remainingTrainees, 4, "ScorerSkill");
        assignPlayersToSlots(["F_L", "F_C", "F_R", "B_F"], forwards.selected);
        const wingers = assignTopPlayersBySkill(forwards.remaining, 3, "WingerSkill").selected;
        assignPlayersToSlots(["W_L", "W_R", "B_W"], wingers);
        remainingTrainees = [];
        break;
      }
      case 10: {
        const wide = assignTopPlayersBySkill(remainingTrainees, 6, "WingerSkill").selected;
        assignPlayersToSlots(["W_L", "W_R", "WB_L", "WB_R", "B_W", "B_WB"], wide);
        const afterWide = removePlayersFromPool(
          remainingTrainees,
          wide.map((player) => player.PlayerID)
        );
        const midfield = assignTopPlayersBySkill(afterWide, 4, "PlaymakerSkill").selected;
        assignPlayersToSlots(["IM_L", "IM_C", "IM_R", "B_IM"], midfield);
        const afterMid = removePlayersFromPool(
          afterWide,
          midfield.map((player) => player.PlayerID)
        );
        const defenders = assignTopPlayersBySkill(afterMid, 4, "DefenderSkill").selected;
        assignPlayersToSlots(["CD_L", "CD_C", "CD_R", "B_CD"], defenders);
        remainingTrainees = [];
        break;
      }
      default:
        break;
    }

    const nonTraineePool = allEligiblePlayers.filter(
      (player) => !traineeIdSet.has(player.PlayerID)
    );
    const remainingFieldSlots = occupiedSlots.filter(
      (slot) => typeof assignments[slot] !== "number" || (assignments[slot] ?? 0) <= 0
    ) as Array<keyof LineupAssignments>;
    const fieldAssigned = assignPlayersWithReusableSlotAlgorithm(
      nonTraineePool,
      remainingFieldSlots,
      ratingsById,
      { collectTrace: true }
    );
    Object.entries(fieldAssigned.assignments).forEach(([slot, playerId]) => {
      assignments[slot] = playerId ?? null;
    });
    const remainingBenchSlots = [...BENCH_SLOT_ORDER].filter(
      (slot) => typeof assignments[slot] !== "number" || (assignments[slot] ?? 0) <= 0
    ) as Array<keyof LineupAssignments>;
    const benchAssigned = assignPlayersWithReusableSlotAlgorithm(
      fieldAssigned.remaining,
      remainingBenchSlots,
      ratingsById,
      { collectTrace: true }
    );
    Object.entries(benchAssigned.assignments).forEach(([slot, playerId]) => {
      assignments[slot] = playerId ?? null;
    });

    if (
      occupiedSlots.some(
        (slot) => typeof assignments[slot as keyof LineupAssignments] !== "number"
      )
    ) {
      throw new Error(messages.submitOrdersMinPlayers);
    }

    return {
      assignments,
      nonTraineeAssignmentTrace: [
        ...fieldAssigned.nonTraineeAssignmentTrace,
        ...benchAssigned.nonTraineeAssignmentTrace,
      ],
    };
  };

  const handleTrainingAwareSetLineup = async () => {
    if (!NON_DEPRECATED_TRAINING_TYPES.includes((resolvedTrainingAwareTrainingType ?? -1) as (typeof NON_DEPRECATED_TRAINING_TYPES)[number])) {
      setTrainingAwareInfoOpen(false);
      clearSeniorAiSubmitLock();
      return;
    }
    if (trainingAwareSetLineupDisabled) return;
    if (trainingAwareMatchId === null) return;
    const selectedTraineeIds = trainingAwareSelectedPlayerIds.filter((playerId) =>
      trainingAwareSelectablePlayerIds.includes(playerId)
    );
    setTrainingAwareInfoOpen(false);
    setTrainingAwarePreparedTraineeIds(selectedTraineeIds);
    setExtraTimePreparedSubmission(null);
    await runSetBestLineupPredictRatings(trainingAwareMatchId, "trainingAware", null, {
      trainingAwareTraineeIds: selectedTraineeIds,
      trainingAwareTrainingType: resolvedTrainingAwareTrainingType,
    });
    setTrainingAwareMatchId(null);
  };

  const seniorAiInjuryLevelForPlayer = (player: SeniorPlayer) => {
    const details = detailsById.get(player.PlayerID);
    return typeof details?.InjuryLevel === "number"
      ? details.InjuryLevel
      : typeof player.InjuryLevel === "number"
        ? player.InjuryLevel
        : null;
  };

  const isSeniorAiBaselineEligibleForMatch = (
    player: SeniorPlayer,
    selectedMatchType: number | null
  ) => {
    if (isPlayerExcluded(excludedPlayers, player.PlayerID)) return false;
    const injuryLevel = seniorAiInjuryLevelForPlayer(player);
    if (typeof injuryLevel === "number" && injuryLevel >= 1) return false;
    const isLeagueCupTarget =
      selectedMatchType !== null &&
      LEAGUE_CUP_QUALI_MATCH_TYPES.has(selectedMatchType);
    if (!isLeagueCupTarget) return true;
    const cardsValue = getSeniorAiCardsValueForPlayer(player);
    return typeof cardsValue !== "number" || cardsValue < 3;
  };

  const isSeniorAiEligiblePlayer = (player: SeniorPlayer) => {
    if (isPlayerExcluded(excludedPlayers, player.PlayerID)) return false;
    const injuryLevel = seniorAiInjuryLevelForPlayer(player);
    return (
      (typeof injuryLevel !== "number" || injuryLevel < 1) &&
      !seniorAiLastMatchIneligiblePlayerIds.has(player.PlayerID)
    );
  };

  const isSeniorAiEligibleForMatch = (
    player: SeniorPlayer,
    selectedMatchType: number | null
  ) => {
    if (!isSeniorAiEligiblePlayer(player)) return false;
    if (
      effectiveExtraTimeBTeamEnabled &&
      extraTimeDisregardedPlayerIds.has(player.PlayerID)
    ) {
      return false;
    }
    const isLeagueCupTarget =
      selectedMatchType !== null &&
      LEAGUE_CUP_QUALI_MATCH_TYPES.has(selectedMatchType);
    if (!isLeagueCupTarget) return true;
    const cardsValue = getSeniorAiCardsValueForPlayer(player);
    return typeof cardsValue !== "number" || cardsValue < 3;
  };

  const getSetBestLineupDisabledTooltip = useCallback(
    (match: Match) => {
      const matchTypeRaw = Number(match.MatchType);
      const selectedMatchType = Number.isFinite(matchTypeRaw) ? matchTypeRaw : null;
      const baselineEligiblePlayers = players.filter((player) =>
        isSeniorAiBaselineEligibleForMatch(player, selectedMatchType)
      );
      if (baselineEligiblePlayers.length < EXTRA_TIME_B_TEAM_MINIMUM_POOL_SIZE) {
        return messages.seniorLineupAiEligibilityNeed18Tooltip;
      }
      const lastMatchExcludedCount = baselineEligiblePlayers.filter((player) =>
        seniorAiLastMatchIneligiblePlayerIds.has(player.PlayerID)
      ).length;
      const alreadyPlayedExcludedCount =
        effectiveExtraTimeBTeamEnabled &&
        extraTimeBTeamRecentMatchState.status === "ready" &&
        Boolean(extraTimeBTeamRecentMatchState.recentMatch)
          ? baselineEligiblePlayers.filter((player) =>
              extraTimeBTeamExcludedPlayerIds.has(player.PlayerID)
            ).length
          : 0;
      const filteredEligibleCount = baselineEligiblePlayers.filter(
        (player) =>
          !seniorAiLastMatchIneligiblePlayerIds.has(player.PlayerID) &&
          !(
            alreadyPlayedExcludedCount > 0 &&
            extraTimeBTeamExcludedPlayerIds.has(player.PlayerID)
          )
      ).length;
      if (filteredEligibleCount >= EXTRA_TIME_B_TEAM_MINIMUM_POOL_SIZE) {
        return null;
      }
      if (alreadyPlayedExcludedCount > 0 && lastMatchExcludedCount > 0) {
        return messages.seniorLineupAiEligibilityRelaxBothTooltip;
      }
      if (alreadyPlayedExcludedCount > 0) {
        return messages.seniorLineupAiEligibilityRelaxAlreadyPlayedTooltip;
      }
      if (lastMatchExcludedCount > 0) {
        return messages.seniorLineupAiEligibilityRelaxLastMatchTooltip;
      }
      return messages.seniorLineupAiEligibilityNeed18Tooltip;
    },
    [
      effectiveExtraTimeBTeamEnabled,
      extraTimeBTeamExcludedPlayerIds,
      extraTimeBTeamRecentMatchState,
      getSeniorAiCardsValueForPlayer,
      messages.seniorLineupAiEligibilityNeed18Tooltip,
      messages.seniorLineupAiEligibilityRelaxAlreadyPlayedTooltip,
      messages.seniorLineupAiEligibilityRelaxBothTooltip,
      messages.seniorLineupAiEligibilityRelaxLastMatchTooltip,
      players,
      seniorAiLastMatchIneligiblePlayerIds,
    ]
  );

  const isSeniorExtraTimePoolEligiblePlayer = (player: SeniorPlayer) =>
    isSeniorAiEligiblePlayer(player) &&
    extraTimeAvailablePlayerIdSet.has(player.PlayerID);

  const trainingAwareSelectablePlayerIds = useMemo(
    () =>
      trainingAwareSkillsMatrixRows
        .map((row) => row.id)
        .filter((id): id is number => {
          if (typeof id !== "number") return false;
          const player = playersById.get(id);
          return player
            ? isSeniorAiEligibleForMatch(player, trainingAwareSelectedMatchType)
            : false;
        }),
    [
      playersById,
      trainingAwareSelectedMatchType,
      trainingAwareSkillsMatrixRows,
    ]
  );
  const requiredTrainingAwareTrainees = trainingAwareTraineesTargetForTrainingType(
    resolvedTrainingAwareTrainingType
  );
  const trainingAwareAutoSelectedPlayerIds = useMemo(
    () => trainingAwareSelectablePlayerIds.slice(0, requiredTrainingAwareTrainees),
    [requiredTrainingAwareTrainees, trainingAwareSelectablePlayerIds]
  );
  const trainingAwareSelectedCount = trainingAwareSelectedPlayerIds.filter((playerId) =>
    trainingAwareSelectablePlayerIds.includes(playerId)
  ).length;
  const trainingAwareSetLineupDisabled =
    trainingAwareSelectedCount !== requiredTrainingAwareTrainees;
  const allTrainingAwarePlayersSelected =
    trainingAwareSelectablePlayerIds.length > 0 &&
    trainingAwareSelectablePlayerIds.every((playerId) =>
      trainingAwareSelectedPlayerIds.includes(playerId)
    );
  const someTrainingAwarePlayersSelected =
    !allTrainingAwarePlayersSelected &&
    trainingAwareSelectablePlayerIds.some((playerId) =>
      trainingAwareSelectedPlayerIds.includes(playerId)
    );

  useEffect(() => {
    setTrainingAwareSelectedPlayerIds((prev) =>
      prev.filter(
        (playerId) => playersById.has(playerId) && trainingAwareSelectablePlayerIds.includes(playerId)
      )
    );
  }, [playersById, trainingAwareSelectablePlayerIds]);

  useEffect(() => {
    if (!trainingAwareInfoOpen) {
      trainingAwareAutoSelectionOpenRef.current = false;
      trainingAwareLastAutoSelectedPlayerIdsRef.current = null;
      return;
    }

    const lastAutoSelected = trainingAwareLastAutoSelectedPlayerIdsRef.current;
    const matchesLastAutoSelected =
      Array.isArray(lastAutoSelected) &&
      lastAutoSelected.length === trainingAwareSelectedPlayerIds.length &&
      lastAutoSelected.every(
        (playerId, index) => trainingAwareSelectedPlayerIds[index] === playerId
      );
    const shouldApplyAutoSelection =
      !trainingAwareAutoSelectionOpenRef.current ||
      trainingAwareAutoSelectionTrainingTypeRef.current !==
        resolvedTrainingAwareTrainingType ||
      matchesLastAutoSelected;

    if (!shouldApplyAutoSelection) {
      trainingAwareAutoSelectionOpenRef.current = true;
      trainingAwareAutoSelectionTrainingTypeRef.current = resolvedTrainingAwareTrainingType;
      return;
    }

    setTrainingAwareSelectedPlayerIds(trainingAwareAutoSelectedPlayerIds);
    trainingAwareAutoSelectionOpenRef.current = true;
    trainingAwareAutoSelectionTrainingTypeRef.current = resolvedTrainingAwareTrainingType;
    trainingAwareLastAutoSelectedPlayerIdsRef.current = trainingAwareAutoSelectedPlayerIds;
  }, [
    resolvedTrainingAwareTrainingType,
    trainingAwareAutoSelectedPlayerIds,
    trainingAwareInfoOpen,
    trainingAwareSelectedPlayerIds,
  ]);

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
    if (!hasUsableSeniorRatingsMatrix(latestFetchedRatingsResponse)) {
      const currentSeason = await fetchCurrentSeason();
      const refreshedRatings = stampSeniorRatingsAlgorithmVersion(
        await bootstrapRatingsFromSeasons(resolvedSeniorTeamId, currentSeason)
      );
      setLatestFetchedRatingsResponse(refreshedRatings);
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

    const orderedSlots = ["KP", ...DEFENSE_SLOTS, ...MIDFIELD_SLOTS];

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

    const remainder = fillExtraTimeNonTraineeRemainder(
      assignmentsForFormation,
      traineeIds,
      ratingsById,
      {
        fieldSlots: orderedSlots,
        excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
      }
    );
    const fieldPlayerIds = new Set<number>(
      orderedSlots
        .map((slot) => remainder.assignments[slot])
        .filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0)
    );

    return {
      assignments: remainder.assignments,
      fieldPlayerIds,
      keeperTraineeId: keeperTrainee.PlayerID,
      fieldTraineeId: fieldTrainee.PlayerID,
      nonTraineeAssignmentTrace: remainder.nonTraineeAssignmentTrace,
    };
  };

  const buildPreparedExtraTimeSubmitPayload = (
    matchId: number,
    defaultPayload: ReturnType<typeof buildLineupPayload>
  ) => {
    if (!extraTimePreparedSubmission || extraTimePreparedSubmission.matchId !== matchId) {
      const staminaSubstitutions = buildSeniorAiStaminaSubstitutions();
      if (!staminaSubstitutions.length) {
        return defaultPayload;
      }
      return {
        ...defaultPayload,
        substitutions: staminaSubstitutions,
      };
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
            standing: -1,
          },
          {
            playerin: leftCenterBackId as number,
            playerout: leftForwardId as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: rightCenterBackId as number,
            playerout: rightForwardId as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: benchMidId as number,
            playerout: leftMidId as number,
            orderType: 1,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: benchForwardId as number,
            playerout: rightMidId as number,
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
            standing: -1,
          },
          {
            playerin: trainee2Id as number,
            playerout: trainee4Id as number,
            orderType: 3,
            min: 89,
            pos: -1,
            beh: -1,
            card: -1,
            standing: -1,
          },
          {
            playerin: trainee1Id as number,
            playerout: trainee5Id as number,
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
        ],
      });
    }
    if (extraTimePreparedSubmission.trainingType === 11) {
      const benchCenterDefenderId = assignments.B_CD;
      const benchWingBackId = assignments.B_WB;
      const benchMidId = assignments.B_IM;
      const centerMidId = assignments.IM_C;
      if (
        [benchCenterDefenderId, benchWingBackId, benchMidId, centerMidId].some(
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
          standing: -1,
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

    return fillExtraTimeNonTraineeRemainder(assignmentsForFormation, traineeIds, ratingsById, {
      fieldSlots: [],
    });
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
    const { ratingForSlot } = buildExtraTimeSlotPicker(ratingsById);
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

    return fillExtraTimeNonTraineeRemainder(assignmentsForFormation, traineeIds, ratingsById, {
      fieldSlots: ["KP"],
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
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
    const { ratingForSlot } = buildExtraTimeSlotPicker(ratingsById);
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

    return fillExtraTimeNonTraineeRemainder(assignmentsForFormation, traineeIds, ratingsById, {
      fieldSlots: [],
    });
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

    return fillExtraTimeNonTraineeRemainder(assignmentsForFormation, traineeIds, ratingsById, {
      fieldSlots: ["KP", "IM_L", "IM_C", "IM_R"],
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
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
    const { pickBestForSlot } = buildExtraTimeSlotPicker(ratingsById);

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

    return fillExtraTimeNonTraineeRemainder(assignmentsForFormation, traineeIds, ratingsById, {
      fieldSlots: [],
    });
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

    return fillExtraTimeNonTraineeRemainder(assignmentsForFormation, traineeIds, ratingsById, {
      fieldSlots: ["KP", "CD_L", "CD_C", "CD_R"],
      excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
    });
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

    return fillExtraTimeNonTraineeRemainder(assignmentsForFormation, traineeIds, ratingsById, {
      fieldSlots: [],
    });
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

    const remainder = fillExtraTimeNonTraineeRemainder(
      assignmentsForFormation,
      traineeIds,
      ratingsById,
      {
        fieldSlots: ["KP", "WB_L", "CD_L", "CD_C", "CD_R", "WB_R", "IM_R"],
        excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
      }
    );

    return {
      ...remainder,
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

    const { ratingForSlot } = buildExtraTimeSlotPicker(ratingsById);
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

    const remainder = fillExtraTimeNonTraineeRemainder(
      assignmentsForFormation,
      traineeIds,
      ratingsById,
      {
        fieldSlots: ["KP", "CD_L", "CD_C", "CD_R", "IM_L", "IM_C", "IM_R"],
        excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
      }
    );

    return {
      ...remainder,
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

    const remainder = fillExtraTimeNonTraineeRemainder(
      assignmentsForFormation,
      traineeIds,
      ratingsById,
      {
        fieldSlots: ["KP", "WB_L", "CD_C", "WB_R"],
        excludedFieldPlayerIds: options?.excludedFieldPlayerIds,
      }
    );

    return {
      ...remainder,
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
      clearSeniorAiSubmitLock();
      return;
    }
    if (extraTimeSelectedCount !== requiredExtraTimeTrainees) return;
    if (extraTimeMatchId === null) return;
    try {
      const selectedTraineeIds = extraTimeSelectedPlayerIds.filter((playerId) =>
        extraTimeSelectablePlayerIds.includes(playerId)
      );
      const openExtraTimeNonTraineeDebugModal = (entries: NonTraineeAssignmentTraceEntry[]) => {
        if (!showSetBestLineupDebugModal) return;
        setNonTraineeAssignmentModal({
          title: messages.setBestLineupAimForExtraTime,
          entries,
        });
      };
      const applyExtraTimePreparedLineup = (
        matchId: number,
        nextAssignments: LineupAssignments,
        nextBehaviors: LineupBehaviors,
        preparedSubmission: NonNullable<typeof extraTimePreparedSubmission>,
        nonTraineeAssignmentTrace: NonTraineeAssignmentTraceEntry[]
      ) => {
        setAssignments(nextAssignments);
        markSeniorLineupMutated();
        setBehaviors(nextBehaviors);
        setTacticType(1);
        setLoadedMatchId(matchId);
        setExtraTimePreparedSubmission(preparedSubmission);
        lockSeniorAiSubmitToMatch(matchId, null);
        openExtraTimeNonTraineeDebugModal(nonTraineeAssignmentTrace);
        setExtraTimeInfoOpen(false);
        setExtraTimeMatchId(null);
      };
      setSeniorAiPreparedSubmissionMode(null);
      if (resolvedExtraTimeTrainingType === 2) {
        const result = await buildSetPiecesExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          result.assignments,
          {
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
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
          },
          result.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 4) {
        const finalResult = await buildScoringExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          finalResult.assignments,
          {
            WB_L: 2,
            WB_R: 2,
            IM_L: 2,
            IM_R: 2,
            F_L: 2,
            F_C: 2,
            F_R: 2,
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
            scoringRoleIds: finalResult.scoringRoleIds,
          },
          finalResult.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 6) {
        const result = await buildScoringSetPiecesExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          result.assignments,
          {
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
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
          },
          result.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 7) {
        const result = await buildPassingExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          result.assignments,
          {
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
            F_L: 2,
            F_C: 2,
            F_R: 2,
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
          },
          result.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 10) {
        const finalResult = await buildExtendedPassingExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          finalResult.assignments,
          {
            WB_L: 2,
            WB_R: 2,
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
          },
          finalResult.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 5) {
        const finalResult = await buildWingerExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          finalResult.assignments,
          {
            WB_L: 2,
            WB_R: 2,
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
            wingerRoleIds: finalResult.wingerRoleIds,
          },
          finalResult.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 12) {
        const finalResult = await buildWingerAttackersExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          finalResult.assignments,
          {
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
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
            wingerAttackerRoleIds: finalResult.wingerAttackerRoleIds,
          },
          finalResult.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 3) {
        const finalResult = await buildDefendingExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          finalResult.assignments,
          {
            WB_L: 2,
            WB_R: 2,
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
          },
          finalResult.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 8) {
        const finalResult = await buildPlaymakingExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          finalResult.assignments,
          {
            WB_L: 2,
            WB_R: 2,
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
          },
          finalResult.nonTraineeAssignmentTrace
        );
        return;
      }
      if (resolvedExtraTimeTrainingType === 11) {
        const result = await buildExtendedDefendingExtraTimeResult(selectedTraineeIds);
        applyExtraTimePreparedLineup(
          extraTimeMatchId,
          result.assignments,
          {
            WB_L: 2,
            WB_R: 2,
            W_L: 2,
            IM_L: 2,
            IM_C: 2,
            IM_R: 2,
            W_R: 2,
          },
          {
            matchId: extraTimeMatchId,
            traineeIds: selectedTraineeIds,
            trainingType: resolvedExtraTimeTrainingType,
          },
          result.nonTraineeAssignmentTrace
        );
        return;
      }
      const { selectedMatchType } = await resolveExtraTimeMatchContext(extraTimeMatchId);
      const finalResult = await buildForcedKeeperExtraTimeResult(selectedTraineeIds, {
        selectedMatchType,
      });
      applyExtraTimePreparedLineup(
        extraTimeMatchId,
        finalResult.assignments,
        {
          WB_L: 2,
          WB_R: 2,
          W_L: 2,
          IM_L: 2,
          IM_C: 2,
          IM_R: 2,
          W_R: 2,
        },
        {
          matchId: extraTimeMatchId,
          traineeIds: selectedTraineeIds,
          trainingType: resolvedExtraTimeTrainingType,
        },
        finalResult.nonTraineeAssignmentTrace
      );
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
    if (isPlayerExcluded(excludedPlayers, playerId)) {
      event.preventDefault();
      return;
    }
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
      if (isPlayerExcluded(excludedPlayers, player.PlayerID)) return;
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
  }, [detailsById, excludedPlayers, players]);

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
    const keeperId =
      typeof assignments.KP === "number" && assignments.KP > 0 ? assignments.KP : null;
    const assignedPlayerIds = Array.from(
      new Set(
        FIELD_SLOT_ORDER.map((slot) => assignments[slot]).filter(
          (playerId): playerId is number => typeof playerId === "number" && playerId > 0
        )
      )
    );
    const penaltyRankingByPlayerId = new Map<number, number>();
    const nameByPlayerId = new Map<number, string>();
    players.forEach((player) => {
      const isKeeper = keeperId !== null && player.PlayerID === keeperId;
      const specialty = specialtyValueForPlayer(player);
      const value = isKeeper
        ? specialty === 2
          ? skillValueForPlayer(player, "KeeperSkill")
          : null
        : skillValueForPlayer(player, "SetPiecesSkill");
      if (typeof value === "number") {
        penaltyRankingByPlayerId.set(player.PlayerID, value);
      }
      nameByPlayerId.set(player.PlayerID, formatPlayerName(player) || String(player.PlayerID));
    });
    return assignedPlayerIds
      .filter((playerId) => penaltyRankingByPlayerId.has(playerId))
      .sort((leftId, rightId) => {
        const leftValue = penaltyRankingByPlayerId.get(leftId) ?? -1;
        const rightValue = penaltyRankingByPlayerId.get(rightId) ?? -1;
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
    specialtyValueForPlayer,
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

  const activeLoadedLineupOrders =
    typeof loadedMatchId === "number" && loadedMatchId > 0
      ? loadedLineupOrdersByMatchId[loadedMatchId] ?? null
      : null;
  const effectiveSeniorPenaltyKickerIds =
    activeLoadedLineupOrders && activeLoadedLineupOrders.penaltyKickerIds.length > 0
      ? activeLoadedLineupOrders.penaltyKickerIds
      : seniorPenaltyKickerIds;
  const effectiveSeniorSetPiecesPlayerId =
    activeLoadedLineupOrders && typeof activeLoadedLineupOrders.setPiecesId === "number"
      ? activeLoadedLineupOrders.setPiecesId
      : seniorSetPiecesPlayerId;
  const effectiveSeniorCaptainId =
    activeLoadedLineupOrders && typeof activeLoadedLineupOrders.captainId === "number"
      ? activeLoadedLineupOrders.captainId
      : 0;
  const activeOtherOrdersMatchId =
    typeof loadedMatchId === "number" && loadedMatchId > 0
      ? loadedMatchId
      : typeof seniorAiSubmitEnabledMatchId === "number" &&
          seniorAiSubmitEnabledMatchId > 0
        ? seniorAiSubmitEnabledMatchId
        : typeof extraTimePreparedSubmission?.matchId === "number" &&
            extraTimePreparedSubmission.matchId > 0
          ? extraTimePreparedSubmission.matchId
          : null;
  const otherOrdersButtonDisabled = false;
  const seniorMatchesList = useMemo(() => {
    const matchNode =
      matchesState.data?.HattrickData?.Team?.MatchList?.Match ??
      matchesState.data?.HattrickData?.MatchList?.Match;
    if (!matchNode) return [] as Match[];
    return Array.isArray(matchNode) ? matchNode : [matchNode];
  }, [matchesState]);
  const findSeniorMatchById = useCallback(
    (matchId: number | null) =>
      typeof matchId === "number"
        ? seniorMatchesList.find((match) => Number(match.MatchID) === matchId) ?? null
        : null,
    [seniorMatchesList]
  );
  const clearSeniorRatingsPrediction = useCallback(() => {
    liveSeniorPredictedRatingsRequestRef.current += 1;
    setSeniorRatingsMatchContext(null);
    setLiveSeniorPredictedRatings(null);
    setLiveSeniorPredictedRatingsStatus("idle");
  }, []);
  const buildSeniorRatingsMatchContext = useCallback(
    (matchId: number): SeniorRatingsPredictionMatchContext | null => {
      if (
        typeof resolvedSeniorTeamId !== "number" ||
        !Number.isFinite(resolvedSeniorTeamId) ||
        resolvedSeniorTeamId <= 0
      ) {
        return null;
      }
      const match = findSeniorMatchById(matchId);
      if (!match) return null;
      const homeTeamId = Number(match.HomeTeam?.HomeTeamID ?? 0);
      const awayTeamId = Number(match.AwayTeam?.AwayTeamID ?? 0);
      const isHome = homeTeamId === resolvedSeniorTeamId;
      const isAway = awayTeamId === resolvedSeniorTeamId;
      if (!isHome && !isAway) return null;
      const homeTeamName = match.HomeTeam?.HomeTeamName?.trim() || null;
      const awayTeamName = match.AwayTeam?.AwayTeamName?.trim() || null;
      const opponentName = isHome ? awayTeamName : homeTeamName;
      if (!opponentName) return null;
      const parsedDate = parseChppDate(match.MatchDate);
      return {
        matchId,
        teamId: resolvedSeniorTeamId,
        sourceSystem: resolveMatchSourceSystem(match, "Hattrick"),
        homeTeamName,
        awayTeamName,
        opponentName,
        matchDate: match.MatchDate ?? null,
        displayTitle: `${messages.vsLabel} ${opponentName}`,
        displaySubtitle: parsedDate ? formatDateTime(parsedDate) : null,
      };
    },
    [findSeniorMatchById, messages.vsLabel, resolvedSeniorTeamId]
  );
  const startingXiPlayerIds = useMemo(
    () =>
      FIELD_SLOT_ORDER.map((slot) => assignments[slot]).filter(
        (playerId): playerId is number =>
          typeof playerId === "number" && Number.isFinite(playerId) && playerId > 0
      ),
    [assignments]
  );
  const hasCompleteSeniorStartingXi = useMemo(
    () =>
      startingXiPlayerIds.length === 11 &&
      new Set(startingXiPlayerIds).size === 11,
    [startingXiPlayerIds]
  );
  const predictSeniorRatingsForLineup = useCallback(
    async ({
      matchId,
      teamId,
      sourceSystem,
      lineup,
    }: {
      matchId: number;
      teamId: number;
      sourceSystem: string;
      lineup: ReturnType<typeof buildLineupPayload>;
    }): Promise<PredictedRatings> => {
      const { response, payload } = await fetchChppJson<{
        data?: { HattrickData?: { MatchData?: Record<string, unknown> } };
        error?: string;
        details?: string;
      }>("/api/chpp/matchorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          teamId,
          sourceSystem,
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
      };
    },
    [messages.submitOrdersError]
  );
  const activeOtherOrdersMatch = findSeniorMatchById(otherOrdersModalMatchId);
  const activeOtherOrdersOpponentTeam = resolveOpponentTeam(
    activeOtherOrdersMatch ?? undefined,
    resolvedSeniorTeamId
  );

  useEffect(() => {
    if (!seniorRatingsMatchContext) {
      liveSeniorPredictedRatingsRequestRef.current += 1;
      setLiveSeniorPredictedRatings(null);
      setLiveSeniorPredictedRatingsStatus("idle");
      return;
    }
    if (
      typeof resolvedSeniorTeamId !== "number" ||
      !Number.isFinite(resolvedSeniorTeamId) ||
      resolvedSeniorTeamId <= 0 ||
      seniorRatingsMatchContext.teamId !== resolvedSeniorTeamId
    ) {
      clearSeniorRatingsPrediction();
      return;
    }
    const resolvedContext = buildSeniorRatingsMatchContext(
      seniorRatingsMatchContext.matchId
    );
    if (
      !resolvedContext ||
      resolvedContext.teamId !== seniorRatingsMatchContext.teamId ||
      resolvedContext.sourceSystem !== seniorRatingsMatchContext.sourceSystem
    ) {
      clearSeniorRatingsPrediction();
      return;
    }
    if (!hasCompleteSeniorStartingXi) {
      liveSeniorPredictedRatingsRequestRef.current += 1;
      setLiveSeniorPredictedRatings(null);
      setLiveSeniorPredictedRatingsStatus("idle");
      return;
    }

    const requestId = ++liveSeniorPredictedRatingsRequestRef.current;
    setLiveSeniorPredictedRatings(null);
    setLiveSeniorPredictedRatingsStatus("loading");
    const timeoutId = window.setTimeout(() => {
      const lineup = buildLineupPayload(assignments, tacticType, { behaviors });
      void predictSeniorRatingsForLineup({
        matchId: seniorRatingsMatchContext.matchId,
        teamId: seniorRatingsMatchContext.teamId,
        sourceSystem: seniorRatingsMatchContext.sourceSystem,
        lineup,
      })
        .then((predicted) => {
          if (liveSeniorPredictedRatingsRequestRef.current !== requestId) return;
          setLiveSeniorPredictedRatings(predicted);
          setLiveSeniorPredictedRatingsStatus("ready");
        })
        .catch(() => {
          if (liveSeniorPredictedRatingsRequestRef.current !== requestId) return;
          setLiveSeniorPredictedRatings(null);
          setLiveSeniorPredictedRatingsStatus("error");
        });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    assignments,
    behaviors,
    tacticType,
    seniorRatingsMatchContext,
    resolvedSeniorTeamId,
    hasCompleteSeniorStartingXi,
    buildSeniorRatingsMatchContext,
    clearSeniorRatingsPrediction,
    predictSeniorRatingsForLineup,
  ]);

  const formatSeniorPredictedRating = (value: number | null) =>
    typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(1)
      : messages.unknownShort;
  const seniorPredictedRatingsOverlay = useMemo(() => {
    if (!seniorRatingsMatchContext || !hasCompleteSeniorStartingXi) return null;
    if (
      typeof resolvedSeniorTeamId !== "number" ||
      seniorRatingsMatchContext.teamId !== resolvedSeniorTeamId
    ) {
      return null;
    }
    const renderCell = (
      label: string,
      value: number | null,
      className?: string
    ) => (
      <div
        aria-label={label}
        className={
          className
            ? `${styles.seniorPredictedRatingsCell} ${className}`
            : styles.seniorPredictedRatingsCell
        }
        title={label}
      >
        {formatSeniorPredictedRating(value)}
      </div>
    );

    return (
      <div className={styles.seniorPredictedRatingsCard}>
        <div className={styles.seniorPredictedRatingsHeader}>
          <div className={styles.seniorPredictedRatingsMatchTitle}>
            {seniorRatingsMatchContext.displayTitle}
          </div>
          {seniorRatingsMatchContext.displaySubtitle ? (
            <div className={styles.seniorPredictedRatingsMatchSubtitle}>
              {seniorRatingsMatchContext.displaySubtitle}
            </div>
          ) : null}
        </div>
        {liveSeniorPredictedRatingsStatus === "loading" ? (
          <div className={styles.seniorPredictedRatingsState}>
            {messages.seniorPredictedRatingsUpdating}
          </div>
        ) : liveSeniorPredictedRatingsStatus === "error" ? (
          <div className={styles.seniorPredictedRatingsState}>
            {messages.seniorPredictedRatingsUnavailable}
          </div>
        ) : liveSeniorPredictedRatingsStatus === "ready" && liveSeniorPredictedRatings ? (
          <div className={styles.seniorPredictedRatingsGrid}>
            {renderCell(
              messages.seniorPredictedRatingsRightDef,
              liveSeniorPredictedRatings.ratingRightDef
            )}
            {renderCell(
              messages.seniorPredictedRatingsMidDef,
              liveSeniorPredictedRatings.ratingMidDef
            )}
            {renderCell(
              messages.seniorPredictedRatingsLeftDef,
              liveSeniorPredictedRatings.ratingLeftDef
            )}
            {renderCell(
              messages.seniorPredictedRatingsMidfield,
              liveSeniorPredictedRatings.ratingMidfield,
              styles.seniorPredictedRatingsMidfield
            )}
            {renderCell(
              messages.seniorPredictedRatingsRightOff,
              liveSeniorPredictedRatings.ratingRightAtt
            )}
            {renderCell(
              messages.seniorPredictedRatingsMidOff,
              liveSeniorPredictedRatings.ratingMidAtt
            )}
            {renderCell(
              messages.seniorPredictedRatingsLeftOff,
              liveSeniorPredictedRatings.ratingLeftAtt
            )}
          </div>
        ) : null}
      </div>
    );
  }, [
    seniorRatingsMatchContext,
    hasCompleteSeniorStartingXi,
    resolvedSeniorTeamId,
    liveSeniorPredictedRatingsStatus,
    liveSeniorPredictedRatings,
    messages,
  ]);

  const isSeniorOtherOrdersMatchAttitudeEligible = (matchId: number | null) => {
    if (typeof matchId !== "number") return false;
    const match = findSeniorMatchById(matchId);
    const matchType = parseNumber(match?.MatchType);
    if (matchType !== null && LEAGUE_QUALI_MATCH_TYPES.has(matchType)) return true;
    if (matchType !== null && CUP_MATCH_TYPES.has(matchType)) {
      const cupLevel = parseNumber(match?.CupLevel);
      return cupLevel === null || cupLevel === 1;
    }
    return false;
  };
  const seniorOtherOrdersCoachModifierRange = useMemo(() => {
    if (!effectiveOtherOrdersHasTacticalAssistant) return null;
    if (effectiveOtherOrdersTacticalAssistantStaffLevel === null) return null;
    const level = Math.max(0, effectiveOtherOrdersTacticalAssistantStaffLevel);
    if (effectiveOtherOrdersTrainerType === 0) {
      return { min: -10, max: -10 + 2 * level };
    }
    if (effectiveOtherOrdersTrainerType === 1) {
      return { min: 10 - 2 * level, max: 10 };
    }
    if (effectiveOtherOrdersTrainerType === 2) {
      return { min: -level, max: level };
    }
    return null;
  }, [
    effectiveOtherOrdersHasTacticalAssistant,
    effectiveOtherOrdersTacticalAssistantStaffLevel,
    effectiveOtherOrdersTrainerType,
  ]);
  const availableOrderPlayerOptions = useMemo<SeniorOrderPlayerOption[]>(() => {
    const ids = [
      ...FIELD_SLOT_ORDER.map((slot) => assignments[slot]),
      ...BENCH_SLOT_ORDER.map((slot) => assignments[slot]),
    ].filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0);
    const seen = new Set<number>();
    return ids
      .filter((playerId) => {
        if (seen.has(playerId)) return false;
        seen.add(playerId);
        return true;
      })
      .map((playerId) => {
        const player = playersById.get(playerId);
        return {
          id: playerId,
          name: player ? formatPlayerName(player) : String(playerId),
          setPiecesSkill: player ? skillValueForPlayer(player, "SetPiecesSkill") : null,
        };
      });
  }, [assignments, playersById, skillValueForPlayer]);
  const startingXiOrderPlayerOptions = useMemo<SeniorOrderPlayerOption[]>(() => {
    const seen = new Set<number>();
    return FIELD_SLOT_ORDER.map((slot) => assignments[slot])
      .filter((playerId): playerId is number => {
        if (typeof playerId !== "number" || playerId <= 0 || seen.has(playerId)) {
          return false;
        }
        seen.add(playerId);
        return true;
      })
      .map((playerId) => {
        const player = playersById.get(playerId);
        return {
          id: playerId,
          name: player ? formatPlayerName(player) : String(playerId),
          setPiecesSkill: player ? skillValueForPlayer(player, "SetPiecesSkill") : null,
        };
      });
  }, [assignments, playersById, skillValueForPlayer]);
  const benchOrderPlayerOptions = useMemo<SeniorOrderPlayerOption[]>(() => {
    const seen = new Set<number>();
    return BENCH_SLOT_ORDER.map((slot) => assignments[slot])
      .filter((playerId): playerId is number => {
        if (typeof playerId !== "number" || playerId <= 0 || seen.has(playerId)) {
          return false;
        }
        seen.add(playerId);
        return true;
      })
      .map((playerId) => {
        const player = playersById.get(playerId);
        return {
          id: playerId,
          name: player ? formatPlayerName(player) : String(playerId),
          setPiecesSkill: player ? skillValueForPlayer(player, "SetPiecesSkill") : null,
        };
      });
  }, [assignments, playersById, skillValueForPlayer]);
  const sortSeniorOrderPlayersBySetPieces = (
    left: SeniorOrderPlayerOption,
    right: SeniorOrderPlayerOption
  ) => {
    const rightSetPieces = right.setPiecesSkill ?? -1;
    const leftSetPieces = left.setPiecesSkill ?? -1;
    if (rightSetPieces !== leftSetPieces) return rightSetPieces - leftSetPieces;
    return left.name.localeCompare(right.name);
  };
  const seniorOtherOrdersKeeperPlayerId =
    typeof assignments.KP === "number" && Number.isFinite(assignments.KP) && assignments.KP > 0
      ? assignments.KP
      : null;
  const setPiecesOrderPlayerOptions = useMemo(
    () =>
      availableOrderPlayerOptions.filter(
        (player) => player.id !== seniorOtherOrdersKeeperPlayerId
      ),
    [availableOrderPlayerOptions, seniorOtherOrdersKeeperPlayerId]
  );
  const startingXiSetPiecesOrderPlayerOptions = useMemo(
    () =>
      startingXiOrderPlayerOptions.filter(
        (player) => player.id !== seniorOtherOrdersKeeperPlayerId
      ),
    [seniorOtherOrdersKeeperPlayerId, startingXiOrderPlayerOptions]
  );
  const buildDefaultPenaltyTakerIds = () => [
    ...[...availableOrderPlayerOptions]
      .sort(sortSeniorOrderPlayersBySetPieces)
      .slice(0, 11)
      .map((player) => player.id),
    ...Array(11).fill(0),
  ].slice(0, 11);
  const buildDefaultSetPiecesPlayerId = () =>
    [...startingXiSetPiecesOrderPlayerOptions]
      .filter(
        (player) =>
          typeof player.setPiecesSkill === "number" &&
          Number.isFinite(player.setPiecesSkill)
      )
      .sort(sortSeniorOrderPlayersBySetPieces)[0]?.id ?? null;
  const sanitizeSeniorEditableOrdersSetPieces = (
    orders: SeniorEditableOrdersState
  ): SeniorEditableOrdersState => {
    if (
      seniorOtherOrdersKeeperPlayerId === null ||
      orders.setPiecesPlayerId !== seniorOtherOrdersKeeperPlayerId
    ) {
      return orders;
    }
    return {
      ...orders,
      setPiecesPlayerId: buildDefaultSetPiecesPlayerId(),
    };
  };
  const availableOrderPlayerIdSet = useMemo(
    () => new Set(availableOrderPlayerOptions.map((player) => player.id)),
    [availableOrderPlayerOptions]
  );
  const startingXiOrderPlayerIdSet = useMemo(
    () => new Set(startingXiOrderPlayerOptions.map((player) => player.id)),
    [startingXiOrderPlayerOptions]
  );
  const benchOrderPlayerIdSet = useMemo(
    () => new Set(benchOrderPlayerOptions.map((player) => player.id)),
    [benchOrderPlayerOptions]
  );
  const isSeniorOtherOrdersBenchSubstitution = (
    order: SeniorEditablePlayerOrder
  ) => {
    if (order.orderType !== 1) return false;
    const playerOut = Number(order.subjectPlayerId ?? 0);
    const playerIn = Number(order.objectPlayerId ?? 0);
    return (
      playerOut > 0 &&
      playerIn > 0 &&
      startingXiOrderPlayerIdSet.has(playerOut) &&
      benchOrderPlayerIdSet.has(playerIn)
    );
  };
  const countSeniorOtherOrdersBenchSubstitutions = (
    orders: SeniorEditablePlayerOrder[]
  ) => orders.filter(isSeniorOtherOrdersBenchSubstitution).length;

  const buildSeniorOtherOrdersSummaryPlayer = (
    playerId: number,
    nameOverride?: string | null
  ): SeniorOtherOrdersSummaryPlayer | null => {
    if (!Number.isFinite(playerId) || playerId <= 0) return null;
    const player = playersById.get(playerId);
    return {
      id: playerId,
      name: player ? formatPlayerName(player) : nameOverride || String(playerId),
      setPiecesSkill: player ? skillValueForPlayer(player, "SetPiecesSkill") : null,
    };
  };

  const orderTypeToSeniorOtherOrdersType = (
    orderType: number
  ): SeniorOtherOrdersSummarySubstitution["type"] => {
    if (orderType === 1) return "replace";
    if (orderType === 2) return "reposition";
    if (orderType === 3) return "swap";
    if (orderType === 4) return "special";
    return "unknown";
  };

  const buildSeniorOtherOrdersSummaryFromPayload = (
    matchId: number,
    lineupPayload: MatchOrdersLineupPayload,
    options?: {
      source?: SeniorOtherOrdersSummary["source"];
      manMarking?: SeniorOtherOrdersSummaryManMarking | null;
    }
  ): SeniorOtherOrdersSummary => ({
    matchId,
    source: options?.source ?? "generated",
    manMarking: options?.manMarking ?? null,
    substitutions: (lineupPayload.substitutions ?? [])
      .filter((substitution) => substitution.orderType !== 4)
      .sort((left, right) => left.min - right.min || left.orderType - right.orderType)
      .map((substitution) => ({
        minute: substitution.min,
        type: orderTypeToSeniorOtherOrdersType(substitution.orderType),
        playerIn: buildSeniorOtherOrdersSummaryPlayer(substitution.playerin),
        playerOut: buildSeniorOtherOrdersSummaryPlayer(substitution.playerout),
        newPositionId:
          typeof substitution.pos === "number" && substitution.pos >= 0
            ? substitution.pos
            : null,
        newPositionBehaviour:
          typeof substitution.beh === "number" && substitution.beh >= 0
            ? substitution.beh
            : null,
        card:
          typeof substitution.card === "number" && substitution.card !== 0
            ? substitution.card
            : null,
        standing:
          typeof substitution.standing === "number" && substitution.standing !== 0
            ? substitution.standing
            : null,
      })),
    penaltyTakers: (lineupPayload.kickers ?? [])
      .map((entry) => entry.id)
      .filter((playerId, index, list): playerId is number => playerId > 0 && list.indexOf(playerId) === index)
      .map((playerId) => buildSeniorOtherOrdersSummaryPlayer(playerId))
      .filter((player): player is SeniorOtherOrdersSummaryPlayer => Boolean(player)),
    captain: buildSeniorOtherOrdersSummaryPlayer(lineupPayload.captain),
    setPiecesTaker: buildSeniorOtherOrdersSummaryPlayer(lineupPayload.setPieces),
  });

  const buildManualSeniorEditableOrdersDraft = (): SeniorEditableOrdersState =>
    sanitizeSeniorEditableOrdersSetPieces(
      buildSeniorEditableOrdersFromPayload(
        null,
        buildLineupPayload(assignments, tacticType, {
          behaviors,
          kickerIds: buildDefaultPenaltyTakerIds(),
          captainId: 0,
          setPiecesId: buildDefaultSetPiecesPlayerId() ?? 0,
          substitutions: [],
        }),
        "manual"
      )
    );

  const buildSeniorEditableOrdersForContext = (
    matchId: number | null
  ): SeniorEditableOrdersState | null => {
    const savedOrders =
      seniorEditableOrdersState &&
      (seniorEditableOrdersState.matchId === matchId ||
        (seniorEditableOrdersState.matchId === null && matchId === null))
        ? seniorEditableOrdersState
        : null;
    if (savedOrders) return sanitizeSeniorEditableOrdersSetPieces(savedOrders);
    if (matchId === null) return buildManualSeniorEditableOrdersDraft();
    const loadedOrders = loadedLineupOrdersByMatchId[matchId] ?? null;
    if (loadedOrders && loadedMatchId === matchId) {
      const payload = buildLineupPayload(assignments, tacticType, {
        behaviors,
        kickerIds: loadedOrders.penaltyKickerIds,
        captainId: loadedOrders.captainId ?? 0,
        setPiecesId: loadedOrders.setPiecesId ?? 0,
        substitutions: loadedOrders.substitutions,
      });
      payload.settings.speechLevel = loadedOrders.matchAttitude ?? 0;
      payload.settings.coachModifier = loadedOrders.coachModifier ?? 0;
      payload.settings.manMarkerPlayerId = loadedOrders.manMarkerPlayerId ?? 0;
      payload.settings.manMarkingPlayerId = loadedOrders.manMarkingPlayerId ?? 0;
      return sanitizeSeniorEditableOrdersSetPieces(
        buildSeniorEditableOrdersFromPayload(matchId, payload, "loaded")
      );
    }
    const defaultPayload = buildLineupPayload(assignments, tacticType, {
      behaviors,
      kickerIds: buildDefaultPenaltyTakerIds(),
      captainId: effectiveSeniorCaptainId,
      setPiecesId: buildDefaultSetPiecesPlayerId() ?? 0,
    });
    return sanitizeSeniorEditableOrdersSetPieces(
      buildSeniorEditableOrdersFromPayload(
        matchId,
        buildSeniorGeneratedLineupPayload(matchId, defaultPayload),
        "generated"
      )
    );
  };

  const formatEffectiveTrainingMinutes = (value: number) => {
    const capped = Math.min(90, Math.max(0, value));
    return Number.isInteger(capped) ? String(capped) : capped.toFixed(1).replace(/\.0$/, "");
  };

  const buildExtraTimeSubmitDisclaimerSummary = (): ExtraTimeSubmitDisclaimerSummary | null => {
    if (!extraTimePreparedSubmission) return null;
    const submitPayload = buildPreparedExtraTimeSubmitPayload(
      extraTimePreparedSubmission.matchId,
      buildLineupPayload(assignments, 1)
    );
    const otherOrdersSummary = buildSeniorOtherOrdersSummaryFromPayload(
      extraTimePreparedSubmission.matchId,
      submitPayload
    );
    const substitutions = otherOrdersSummary.substitutions
      .filter(
        (
          substitution
        ): substitution is SeniorOtherOrdersSummarySubstitution & {
          type: "replace" | "swap";
          playerIn: SeniorOtherOrdersSummaryPlayer;
          playerOut: SeniorOtherOrdersSummaryPlayer;
        } =>
          (substitution.type === "replace" || substitution.type === "swap") &&
          Boolean(substitution.playerIn) &&
          Boolean(substitution.playerOut)
      )
      .map((substitution) => {
        return {
          minute: substitution.minute,
          type: substitution.type,
          playerIn: substitution.playerIn,
          playerOut: substitution.playerOut,
        } satisfies ExtraTimeSubmitDisclaimerSubstitution;
      });
    const candidateTrainingPlayerIds = Array.from(
      new Set<number>([
        ...extraTimePreparedSubmission.traineeIds,
        ...BENCH_SLOT_ORDER.map((slot) => assignments[slot]).filter(
          (playerId): playerId is number => typeof playerId === "number" && playerId > 0
        ),
      ])
    );
    const training90 = calculateTrainingMinutesForScenario(
      assignments,
      submitPayload.substitutions ?? [],
      candidateTrainingPlayerIds,
      extraTimePreparedSubmission.trainingType,
      90
    );
    const training120 = calculateTrainingMinutesForScenario(
      assignments,
      submitPayload.substitutions ?? [],
      candidateTrainingPlayerIds,
      extraTimePreparedSubmission.trainingType,
      120
    );
    const trainees = candidateTrainingPlayerIds.map((playerId) => {
      const player = playersById.get(playerId);
      return {
        id: playerId,
        name: player ? formatPlayerName(player) : String(playerId),
      };
    });
    const trainingRows = trainees
      .map((trainee) => ({
        id: trainee.id,
        name: trainee.name,
        scenario90: Math.min(90, training90.get(trainee.id) ?? 0),
        scenario120: Math.min(90, training120.get(trainee.id) ?? 0),
      }))
      .filter((row) => row.scenario90 > 0 || row.scenario120 > 0)
      .map((row, index) => ({
        number: index + 1,
        ...row,
      }));
    return {
      trainingLabel: obtainedTrainingRegimenLabel(extraTimePreparedSubmission.trainingType),
      trainees,
      substitutions,
      trainingRows,
      penaltyTakers: otherOrdersSummary.penaltyTakers,
      setPiecesTaker: otherOrdersSummary.setPiecesTaker,
    };
  };

  const buildSeniorSubmitDisclaimerOrdersSummary = (
    lineupPayload: MatchOrdersLineupPayload
  ): SeniorSubmitDisclaimerOrdersSummary => {
    const summary = buildSeniorOtherOrdersSummaryFromPayload(0, lineupPayload);
    return {
      substitutions: summary.substitutions.filter(
        (substitution): substitution is SeniorSubmitDisclaimerOrderSubstitution =>
          (substitution.type === "replace" || substitution.type === "swap") &&
          Boolean(substitution.playerIn) &&
          Boolean(substitution.playerOut)
      ),
      penaltyTakers: summary.penaltyTakers,
      setPiecesTaker: summary.setPiecesTaker,
    };
  };

  const buildSeniorSubmitDisclaimerManMarkingSummary = (
    submittedMatchId: number
  ): SeniorSubmitDisclaimerManMarkingSummary | null => {
    if (
      !effectiveSeniorAiManMarkingEnabled ||
      !seniorAiManMarkingSupported ||
      seniorAiSubmitEnabledMatchId !== submittedMatchId
    ) {
      return null;
    }
    const submittedSelection = seniorAiManMarkingReady ? seniorAiManMarkingSelection : null;
    const target = submittedSelection?.target ?? seniorAiManMarkingTarget;
    const marker = submittedSelection?.marker ?? null;
    const hasAnyMarkerCandidate = Object.values(seniorAiManMarkingCandidates).some(Boolean);
    return {
      marker: marker
        ? {
            id: marker.playerId,
            name: marker.name,
          }
        : null,
      target: target
        ? {
            id: target.playerId,
            name: target.name,
          }
        : null,
      missingMarker: !marker && (Boolean(target) || !hasAnyMarkerCandidate),
      missingTarget: !target,
    };
  };

  const buildSeniorGeneratedLineupPayload = (
    matchId: number,
    defaultPayload: ReturnType<typeof buildLineupPayload>
  ) => {
    const basePayload = buildPreparedExtraTimeSubmitPayload(matchId, defaultPayload);
    const seniorAiSetPiecesPlayerId = selectSeniorAiSetPiecesPlayerId(
      seniorAiPreparedSubmissionMode
    );
    const payloadWithSeniorAiSetPieces =
      seniorAiSetPiecesPlayerId > 0 && seniorAiSubmitEnabledMatchId === matchId
        ? {
            ...basePayload,
            setPieces: seniorAiSetPiecesPlayerId,
          }
        : basePayload;
    if (
      !effectiveSeniorAiManMarkingEnabled ||
      !seniorAiManMarkingSelection ||
      !seniorAiManMarkingReady ||
      !seniorAiManMarkingSupported ||
      seniorAiSubmitEnabledMatchId !== matchId
    ) {
      return payloadWithSeniorAiSetPieces;
    }
    return {
      ...payloadWithSeniorAiSetPieces,
      settings: {
        ...payloadWithSeniorAiSetPieces.settings,
        manMarkerPlayerId: seniorAiManMarkingSelection.marker.playerId,
        manMarkingPlayerId: seniorAiManMarkingSelection.target.playerId,
      },
    };
  };

  const validateSeniorEditableOrders = (
    orders: SeniorEditableOrdersState
  ): string | null => {
    if (orders.playerOrders.length > seniorOtherOrdersMaxPlayerOrders) {
      return messages.seniorOtherOrdersOrderLimitReached;
    }
    if (
      countSeniorOtherOrdersBenchSubstitutions(orders.playerOrders) >
      SENIOR_BENCH_SUBSTITUTION_LIMIT
    ) {
      return messages.seniorOtherOrdersBenchSubstitutionLimitReached;
    }
    const range = seniorOtherOrdersCoachModifierRange;
    if (
      effectiveOtherOrdersHasTacticalAssistant &&
      range &&
      orders.coachModifier !== null &&
      (orders.coachModifier < range.min || orders.coachModifier > range.max)
    ) {
      return messages.seniorOtherOrdersInvalidCoachModifier;
    }
    if (
      !isSeniorOtherOrdersMatchAttitudeEligible(orders.matchId) &&
      orders.matchAttitude !== null &&
      orders.matchAttitude !== 0
    ) {
      return messages.seniorOtherOrdersMatchAttitudeUnavailable;
    }
    if (
      seniorOtherOrdersKeeperPlayerId !== null &&
      orders.setPiecesPlayerId === seniorOtherOrdersKeeperPlayerId
    ) {
      return messages.seniorOtherOrdersSetPiecesKeeperInvalid;
    }
    const selectedOrderPlayerIds = [
      orders.captainPlayerId,
      orders.setPiecesPlayerId,
      orders.manMarkingOrder?.subjectPlayerId,
      ...orders.penaltyTakerIds.filter((playerId) => playerId > 0),
    ].filter((playerId): playerId is number => typeof playerId === "number" && playerId > 0);
    if (
      selectedOrderPlayerIds.some(
        (playerId) => !availableOrderPlayerIdSet.has(playerId)
      )
    ) {
      return messages.seniorOtherOrdersInvalidOwnPlayer;
    }
    if (orders.manMarkingOrder) {
      if (typeof orders.matchId !== "number") {
        return messages.seniorOtherOrdersManMarkingNoOpponent;
      }
      if (
        typeof orders.manMarkingOrder.subjectPlayerId !== "number" ||
        !startingXiOrderPlayerIdSet.has(orders.manMarkingOrder.subjectPlayerId)
      ) {
        return messages.seniorOtherOrdersInvalidOwnPlayer;
      }
      if (
        typeof orders.manMarkingOrder.objectPlayerId !== "number" ||
        orders.manMarkingOrder.objectPlayerId <= 0
      ) {
        return messages.seniorOtherOrdersInvalidManMarkingTarget;
      }
    }
    for (const order of orders.playerOrders) {
      if (
        typeof order.subjectPlayerId !== "number" ||
        !availableOrderPlayerIdSet.has(order.subjectPlayerId)
      ) {
        return messages.seniorOtherOrdersInvalidOwnPlayer;
      }
      if (order.orderType === 4) {
        return messages.seniorOtherOrdersInvalidManMarkingTarget;
      }
      if (order.orderType === 3) {
        if (
          !startingXiOrderPlayerIdSet.has(order.subjectPlayerId) ||
          typeof order.objectPlayerId !== "number" ||
          !startingXiOrderPlayerIdSet.has(order.objectPlayerId)
        ) {
          return messages.seniorOtherOrdersInvalidOwnPlayer;
        }
      } else if (
        typeof order.objectPlayerId !== "number" ||
        !availableOrderPlayerIdSet.has(order.objectPlayerId) ||
        (order.subjectPlayerId !== order.objectPlayerId &&
          (!startingXiOrderPlayerIdSet.has(order.subjectPlayerId) ||
            !benchOrderPlayerIdSet.has(order.objectPlayerId)))
      ) {
        return messages.seniorOtherOrdersInvalidOwnPlayer;
      }
    }
    return null;
  };

  const applySeniorEditableOrdersToPayload = (
    matchId: number,
    payload: MatchOrdersLineupPayload
  ): MatchOrdersLineupPayload => {
    const payloadWithEligibleSetPieces =
      seniorOtherOrdersKeeperPlayerId !== null &&
      payload.setPieces === seniorOtherOrdersKeeperPlayerId
        ? {
            ...payload,
            setPieces: buildDefaultSetPiecesPlayerId() ?? 0,
          }
        : payload;
    const savedOrders = seniorEditableOrdersState;
    if (!savedOrders) return payloadWithEligibleSetPieces;
    if (savedOrders.matchId === null) return payloadWithEligibleSetPieces;
    if (
      typeof savedOrders.matchId === "number" &&
      savedOrders.matchId > 0 &&
      savedOrders.matchId !== matchId
    ) {
      const validationError = messages.seniorOtherOrdersWrongMatchContext;
      setOtherOrdersModalMatchId(savedOrders.matchId);
      setOtherOrdersEditorOpen(true);
      setOtherOrdersDraft(savedOrders);
      setOtherOrdersValidationError(validationError);
      throw new Error(validationError);
    }
    const validationError = validateSeniorEditableOrders(savedOrders);
    if (validationError) {
      setOtherOrdersModalMatchId(savedOrders.matchId ?? matchId);
      setOtherOrdersEditorOpen(true);
      setOtherOrdersDraft(savedOrders);
      setOtherOrdersValidationError(validationError);
      throw new Error(validationError);
    }
    return serializeSeniorEditableOrdersToPayload(payloadWithEligibleSetPieces, savedOrders, {
      includeMatchAttitude: isSeniorOtherOrdersMatchAttitudeEligible(matchId),
      includeCoachModifier:
        effectiveOtherOrdersHasTacticalAssistant &&
        Boolean(seniorOtherOrdersCoachModifierRange),
    });
  };

  const buildSeniorSubmitLineupPayload = (
    matchId: number,
    defaultPayload: ReturnType<typeof buildLineupPayload>
  ) =>
    applySeniorEditableOrdersToPayload(
      matchId,
      buildSeniorGeneratedLineupPayload(matchId, defaultPayload)
    );

  useEffect(() => {
    const generatedMatchId =
      typeof seniorAiSubmitEnabledMatchId === "number" &&
      seniorAiSubmitEnabledMatchId > 0
        ? seniorAiSubmitEnabledMatchId
        : typeof extraTimePreparedSubmission?.matchId === "number" &&
            extraTimePreparedSubmission.matchId > 0
          ? extraTimePreparedSubmission.matchId
          : null;
    if (generatedMatchId === null) return;
    const seedKey = `${generatedMatchId}:${seniorAiPreparedSubmissionMode ?? "extraTime"}`;
    if (seededSeniorEditableOrdersContextRef.current === seedKey) return;
    const defaultPayload = buildLineupPayload(assignments, tacticType, {
      behaviors,
      kickerIds: buildDefaultPenaltyTakerIds(),
      captainId: effectiveSeniorCaptainId,
      setPiecesId: buildDefaultSetPiecesPlayerId() ?? 0,
    });
    setSeniorEditableOrdersState(
      sanitizeSeniorEditableOrdersSetPieces(
        buildSeniorEditableOrdersFromPayload(
          generatedMatchId,
          buildSeniorGeneratedLineupPayload(generatedMatchId, defaultPayload),
          "generated"
        )
      )
    );
    seededSeniorEditableOrdersContextRef.current = seedKey;
  }, [
    seniorAiSubmitEnabledMatchId,
    seniorAiPreparedSubmissionMode,
    extraTimePreparedSubmission?.matchId,
  ]);

  const updateOtherOrdersDraft = (
    updater: (draft: SeniorEditableOrdersState) => SeniorEditableOrdersState
  ) => {
    setOtherOrdersValidationError(null);
    setOtherOrdersDraft((current) => (current ? updater(current) : current));
  };
  const closeOtherOrdersEditor = () => {
    setOtherOrdersEditorOpen(false);
    setOtherOrdersModalMatchId(null);
    setOtherOrdersDraft(null);
    setOtherOrdersValidationError(null);
    opponentPlayersSessionRequestIdRef.current += 1;
    setOpponentPlayersForSession(null);
    setOpponentPlayersLoading(false);
    setOpponentPlayersError(null);
    setManMarkingTargetDropdownOpen(false);
  };
  const saveOtherOrdersEditor = () => {
    if (!otherOrdersDraft) return;
    const validationError = validateSeniorEditableOrders(otherOrdersDraft);
    if (validationError) {
      setOtherOrdersValidationError(validationError);
      return;
    }
    setSeniorEditableOrdersState({
      ...otherOrdersDraft,
      source:
        otherOrdersDraft.source === "generated" || otherOrdersDraft.source === "loaded"
          ? "mixed"
          : otherOrdersDraft.source,
    });
    closeOtherOrdersEditor();
  };

  useEffect(() => {
    opponentPlayersSessionRequestIdRef.current += 1;
    setOpponentPlayersForSession(null);
    setOpponentPlayersLoading(false);
    setOpponentPlayersError(null);
    setManMarkingTargetDropdownOpen(false);
  }, [otherOrdersEditorOpen]);

  useEffect(() => {
    if (!manMarkingTargetDropdownOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        manMarkingTargetDropdownRef.current?.contains(target)
      ) {
        return;
      }
      setManMarkingTargetDropdownOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [manMarkingTargetDropdownOpen]);

  useEffect(() => {
    if (!otherOrdersEditorOpen) {
      setOtherOrdersDraft(null);
      setOtherOrdersValidationError(null);
      return;
    }
    setOtherOrdersDraft(buildSeniorEditableOrdersForContext(otherOrdersModalMatchId));
    setOtherOrdersValidationError(null);
  }, [otherOrdersEditorOpen, otherOrdersModalMatchId]);

  useEffect(() => {
    if (!otherOrdersEditorOpen) return;
    setOtherOrdersDraft((current) => {
      if (!current) return current;
      if (!effectiveOtherOrdersHasTacticalAssistant || !seniorOtherOrdersCoachModifierRange) {
        if (current.coachModifier === null) return current;
        return { ...current, source: "mixed", coachModifier: null };
      }
      if (current.coachModifier === null) return current;
      const nextCoachModifier = Math.min(
        seniorOtherOrdersCoachModifierRange.max,
        Math.max(seniorOtherOrdersCoachModifierRange.min, current.coachModifier)
      );
      if (nextCoachModifier === current.coachModifier) return current;
      return { ...current, source: "mixed", coachModifier: nextCoachModifier };
    });
    setOtherOrdersValidationError(null);
  }, [
    effectiveOtherOrdersHasTacticalAssistant,
    otherOrdersDraft?.coachModifier,
    otherOrdersEditorOpen,
    seniorOtherOrdersCoachModifierRange,
  ]);

  const renderSeniorOtherOrdersButton = () => (
    <Tooltip
      content={
        otherOrdersButtonDisabled
          ? messages.seniorOtherOrdersDisabledTooltip
          : messages.seniorOtherOrdersTooltip
      }
    >
      <span>
        <button
          type="button"
          className={`${styles.lineupButtonSecondary} ${
            otherOrdersFlashActive ? styles.otherOrdersFlash : ""
          }`}
          disabled={otherOrdersButtonDisabled}
          onClick={() => {
            setOtherOrdersModalMatchId(activeOtherOrdersMatchId);
            setOtherOrdersEditorOpen(true);
          }}
        >
          {messages.seniorOtherOrdersButton}
        </button>
      </span>
    </Tooltip>
  );

  const seniorOtherOrdersMinuteOptions = [
    { key: "any", value: -1, label: messages.seniorOtherOrdersAnyMinute },
    { key: "halftime", value: 46, label: messages.seniorOtherOrdersHalftime },
    { key: "before-extra-time", value: 91, label: messages.seniorOtherOrdersBeforeExtraTime },
    ...Array.from({ length: 120 }, (_, minute) => ({
      key: `minute-${minute}`,
      value: minute,
      label: messages.seniorOtherOrdersMinuteAfter.replace("{{minute}}", String(minute)),
    })),
  ];
  const seniorOtherOrdersStandingOptions = [
    { value: -1, label: messages.seniorOtherOrdersStandingAny },
    { value: 0, label: messages.seniorOtherOrdersStandingTied },
    { value: 1, label: messages.seniorOtherOrdersStandingLead },
    { value: 2, label: messages.seniorOtherOrdersStandingDown },
    { value: 3, label: messages.seniorOtherOrdersStandingLeadMoreThanOne },
    { value: 4, label: messages.seniorOtherOrdersStandingDownMoreThanOne },
    { value: 5, label: messages.seniorOtherOrdersStandingNotDown },
    { value: 6, label: messages.seniorOtherOrdersStandingNotLead },
    { value: 7, label: messages.seniorOtherOrdersStandingLeadMoreThanTwo },
    { value: 8, label: messages.seniorOtherOrdersStandingDownMoreThanTwo },
    { value: 9, label: messages.seniorOtherOrdersStandingNotTied },
  ];
  const seniorOtherOrdersRedCardOptions = [
    { value: -1, label: messages.seniorOtherOrdersRedCardIgnore },
    { value: 1, label: messages.seniorOtherOrdersRedCardMyPlayer },
    { value: 2, label: messages.seniorOtherOrdersRedCardOpponent },
    { value: 11, label: messages.seniorOtherOrdersRedCardMyCentralDefender },
    { value: 12, label: messages.seniorOtherOrdersRedCardMyMidfielder },
    { value: 13, label: messages.seniorOtherOrdersRedCardMyForward },
    { value: 14, label: messages.seniorOtherOrdersRedCardMyWingBack },
    { value: 15, label: messages.seniorOtherOrdersRedCardMyWinger },
    { value: 21, label: messages.seniorOtherOrdersRedCardOpponentCentralDefender },
    { value: 22, label: messages.seniorOtherOrdersRedCardOpponentMidfielder },
    { value: 23, label: messages.seniorOtherOrdersRedCardOpponentForward },
    { value: 24, label: messages.seniorOtherOrdersRedCardOpponentWingBack },
    { value: 25, label: messages.seniorOtherOrdersRedCardOpponentWinger },
  ];
  const seniorOtherOrdersNewPositionOptions = [
    { value: -1, label: messages.seniorOtherOrdersNoPositionChange },
    { value: 0, label: messages.posKeeperFull },
    { value: 1, label: messages.lineupSlotRightWingBack },
    { value: 2, label: messages.lineupSlotRightCentralDefender },
    { value: 3, label: messages.lineupSlotCentralDefender },
    { value: 4, label: messages.lineupSlotLeftCentralDefender },
    { value: 5, label: messages.lineupSlotLeftWingBack },
    { value: 6, label: messages.lineupSlotRightWinger },
    { value: 7, label: messages.lineupSlotRightInnerMidfield },
    { value: 8, label: messages.lineupSlotCentralInnerMidfield },
    { value: 9, label: messages.lineupSlotLeftInnerMidfield },
    { value: 10, label: messages.lineupSlotLeftWinger },
    { value: 11, label: messages.lineupSlotRightForward },
    { value: 12, label: messages.lineupSlotCentralForward },
    { value: 13, label: messages.lineupSlotLeftForward },
  ];
  const seniorOtherOrdersNewBehaviourOptions = [
    { value: -1, label: messages.seniorOtherOrdersNoBehaviourChange },
    { value: 0, label: messages.seniorOtherOrdersBehaviourNormal },
    { value: 1, label: messages.seniorOtherOrdersBehaviourOffensive },
    { value: 2, label: messages.seniorOtherOrdersBehaviourDefensive },
    { value: 3, label: messages.seniorOtherOrdersBehaviourTowardsMiddle },
    { value: 4, label: messages.seniorOtherOrdersBehaviourTowardsWing },
    { value: 5, label: messages.seniorOtherOrdersBehaviourExtraForward },
    { value: 6, label: messages.seniorOtherOrdersBehaviourExtraInnerMidfield },
    { value: 7, label: messages.seniorOtherOrdersBehaviourExtraDefender },
  ];
  const seniorOtherOrdersPlayerSetPiecesLabel = (player: SeniorOrderPlayerOption) =>
    Number.isFinite(player.setPiecesSkill)
      ? `${player.name} (${player.setPiecesSkill})`
      : player.name;
  const seniorOtherOrdersPlayerNameLabel = (player: SeniorOrderPlayerOption) =>
    player.name;
  const seniorOtherOrdersUnknownOpponentPlayerLabel = (playerId: number) =>
    messages.seniorOtherOrdersUnknownOpponentPlayer.replace(
      "{{playerId}}",
      String(playerId)
    );
  const seniorOtherOrdersOpponentPlayerName = (playerId: number | null) => {
    if (typeof playerId !== "number" || playerId <= 0) return messages.unknownShort;
    return (
      opponentPlayersForSession?.find((player) => player.playerId === playerId)?.name ??
      otherOrdersOpponentTargetNamesById[playerId] ??
      seniorOtherOrdersUnknownOpponentPlayerLabel(playerId)
    );
  };
  const normalizeOpponentPlayersForManMarking = (
    payload: SeniorOpponentPlayersResponse | null | undefined
  ): SeniorOpponentManMarkingPlayer[] => {
    const raw = payload?.data?.HattrickData?.Team?.PlayerList?.Player;
    const rawPlayers = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return rawPlayers
      .map((player) => {
        if (!player || typeof player !== "object") return null;
        const playerNode = player as Record<string, unknown>;
        const playerId = parseNumber(playerNode.PlayerID);
        if (!playerId || playerId <= 0) return null;
        const name =
          formatPlayerName({
            FirstName:
              typeof playerNode.FirstName === "string" ? playerNode.FirstName : "",
            NickName:
              typeof playerNode.NickName === "string" && playerNode.NickName
                ? playerNode.NickName
                : undefined,
            LastName:
              typeof playerNode.LastName === "string" ? playerNode.LastName : "",
          }) || seniorOtherOrdersUnknownOpponentPlayerLabel(playerId);
        return { playerId, name };
      })
      .filter(
        (player): player is SeniorOpponentManMarkingPlayer => Boolean(player)
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  };
  const ensureOpponentPlayersForManMarking = async (force = false) => {
    if (!force && (opponentPlayersForSession || opponentPlayersLoading)) return;
    if (!activeOtherOrdersOpponentTeam) {
      setOpponentPlayersError(messages.seniorOtherOrdersManMarkingNoOpponent);
      return;
    }

    setOpponentPlayersLoading(true);
    setOpponentPlayersError(null);
    const requestId = opponentPlayersSessionRequestIdRef.current;
    try {
      const { response, payload } = await fetchChppJson<SeniorOpponentPlayersResponse>(
        `/api/chpp/players?teamId=${activeOtherOrdersOpponentTeam.teamId}`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        throw new Error(
          payload?.details ??
            payload?.error ??
            messages.seniorOtherOrdersOpponentPlayersLoadError
        );
      }
      const normalized = normalizeOpponentPlayersForManMarking(payload);
      if (opponentPlayersSessionRequestIdRef.current !== requestId) return;
      setOpponentPlayersForSession(normalized);
      setOtherOrdersOpponentTargetNamesById((prev) => {
        const next = { ...prev };
        normalized.forEach((player) => {
          next[player.playerId] = player.name;
        });
        return next;
      });
    } catch (error) {
      if (opponentPlayersSessionRequestIdRef.current !== requestId) return;
      setOpponentPlayersError(
        error instanceof Error
          ? error.message
          : messages.seniorOtherOrdersOpponentPlayersLoadError
      );
    } finally {
      if (opponentPlayersSessionRequestIdRef.current === requestId) {
        setOpponentPlayersLoading(false);
      }
    }
  };
  const seniorOtherOrdersOpponentTargetOptions = (selectedPlayerId: number | null) => {
    const options = [...(opponentPlayersForSession ?? [])];
    if (
      typeof selectedPlayerId === "number" &&
      selectedPlayerId > 0 &&
      !options.some((player) => player.playerId === selectedPlayerId)
    ) {
      options.unshift({
        playerId: selectedPlayerId,
        name:
          otherOrdersOpponentTargetNamesById[selectedPlayerId] ??
          seniorOtherOrdersUnknownOpponentPlayerLabel(selectedPlayerId),
      });
    }
    return options;
  };
  const updateSeniorOtherOrdersManMarkingTarget = (nextTargetId: number | null) => {
    updateOtherOrdersDraft((draft) => ({
      ...draft,
      source: "mixed",
      manMarkingOrder:
        nextTargetId === null && !draft.manMarkingOrder?.subjectPlayerId
          ? null
          : {
              id:
                draft.manMarkingOrder?.id ??
                `man-marking-${draft.matchId ?? "draft"}-${Date.now()}`,
              orderType: 4,
              minute: draft.manMarkingOrder?.minute ?? SENIOR_ORDER_DEFAULT_MINUTE,
              standing:
                draft.manMarkingOrder?.standing ?? SENIOR_ORDER_DEFAULT_CONDITION,
              card: draft.manMarkingOrder?.card ?? SENIOR_ORDER_DEFAULT_CONDITION,
              subjectPlayerId: draft.manMarkingOrder?.subjectPlayerId ?? null,
              objectPlayerId: nextTargetId,
              newPositionId: SENIOR_ORDER_DEFAULT_POSITION,
              newPositionBehaviour: SENIOR_ORDER_DEFAULT_BEHAVIOUR,
            },
    }));
  };
  const openSeniorOtherOrdersManMarkingTargetDropdown = () => {
    setManMarkingTargetDropdownOpen(true);
    if (activeOtherOrdersOpponentTeam) {
      void ensureOpponentPlayersForManMarking();
    }
  };
  const seniorOtherOrdersDraftOrderKind = (order: SeniorEditablePlayerOrder) => {
    if (order.orderType === 3) return "swap";
    return order.subjectPlayerId && order.subjectPlayerId === order.objectPlayerId
      ? "behaviour"
      : "substitution";
  };
  const seniorOtherOrdersOrderKindLabel = (kind: string) => {
    if (kind === "behaviour") return messages.seniorOtherOrdersBehaviourChangeLabel;
    if (kind === "swap") return messages.seniorOtherOrdersPositionSwapLabel;
    return messages.seniorOtherOrdersSubstitutionLabel;
  };
  const addSeniorOtherOrdersDraftOrder = () => {
    updateOtherOrdersDraft((draft) => {
      if (draft.playerOrders.length >= seniorOtherOrdersMaxPlayerOrders) return draft;
      const benchSubstitutionCount = countSeniorOtherOrdersBenchSubstitutions(
        draft.playerOrders
      );
      const canAddSubstitution =
        benchSubstitutionCount < SENIOR_BENCH_SUBSTITUTION_LIMIT &&
        startingXiOrderPlayerOptions.length > 0 &&
        benchOrderPlayerOptions.length > 0;
      const canAddSwap = startingXiOrderPlayerOptions.length >= 2;
      const orderType = canAddSubstitution ? 1 : 3;
      return {
        ...draft,
        source: "mixed",
        playerOrders: [
          ...draft.playerOrders,
          {
            id: `manual-${draft.matchId}-${Date.now()}`,
            orderType,
            minute: 70,
            standing: SENIOR_ORDER_DEFAULT_CONDITION,
            card: SENIOR_ORDER_DEFAULT_CONDITION,
            subjectPlayerId: startingXiOrderPlayerOptions[0]?.id ?? null,
            objectPlayerId: canAddSubstitution
              ? benchOrderPlayerOptions[0]?.id ?? null
              : canAddSwap
                ? startingXiOrderPlayerOptions[1]?.id ?? null
                : null,
            newPositionId: SENIOR_ORDER_DEFAULT_POSITION,
            newPositionBehaviour: SENIOR_ORDER_DEFAULT_BEHAVIOUR,
          },
        ],
      };
    });
  };

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

  const fetchSeniorTeamGeneralInfo = async (
    teamId: number | null
  ): Promise<SeniorTeamGeneralInfo | null> => {
    if (typeof teamId !== "number" || !Number.isFinite(teamId) || teamId <= 0) {
      return null;
    }
    const { response, payload } = await fetchChppJson<StafflistResponse>(
      `/api/chpp/stafflist?teamId=${teamId}`,
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to fetch staff list");
    }
    return buildSeniorTeamGeneralInfoFromStafflist(payload, teamId);
  };

  const fetchMatches = async (teamId?: number | null, lastMatchDate?: string | null) => {
    const teamParam = teamId ? `&teamID=${teamId}` : "";
    const lastMatchDateParam = lastMatchDate
      ? `&LastMatchDate=${encodeURIComponent(lastMatchDate)}`
      : "";
    const { response, payload } = await fetchChppJson<MatchesResponse>(
      `/api/chpp/matches?isYouth=false${teamParam}${lastMatchDateParam}`,
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
    const windows = resolveCurrentHattrickWeekWindows(new Date());
    const lastMatchDate = windows.isBTeamWindowOpen
      ? windows.bTeamWindowEnd
      : windows.aTeamWindowEnd;
    const matchesPayload = await fetchMatches(teamId, lastMatchDate);
    const normalizedMatches = normalizeMatchList(
      matchesPayload?.data?.HattrickData?.Team?.MatchList?.Match ??
        matchesPayload?.data?.HattrickData?.MatchList?.Match
    );
    const finishedMatches = normalizedMatches.filter(
      (match) => String(match.Status ?? "").toUpperCase() === "FINISHED"
    );
    const sortDescendingByMatchDate = (left: Match, right: Match) => {
      const leftValue = normalizeChppDateTime(left.MatchDate) ?? "";
      const rightValue = normalizeChppDateTime(right.MatchDate) ?? "";
      return rightValue.localeCompare(leftValue);
    };
    const recentMatch =
      [...finishedMatches]
        .filter((match) => EXTRA_TIME_B_TEAM_MATCH_TYPES.has(Number(match.MatchType)))
        .filter((match) => {
          return isChppDateTimeWithinWindow(
            normalizeChppDateTime(match.MatchDate),
            windows.aTeamWindowStart,
            windows.aTeamWindowEnd
          );
        })
        .sort(sortDescendingByMatchDate)[0] ?? null;
    const playedBTeamMatch =
      windows.isBTeamWindowOpen
        ? [...finishedMatches]
            .filter((match) =>
              EXTRA_TIME_B_TEAM_PLAYED_MATCH_TYPES.has(Number(match.MatchType))
            )
            .filter((match) =>
              isChppDateTimeWithinWindow(
                normalizeChppDateTime(match.MatchDate),
                windows.bTeamWindowStart,
                windows.bTeamWindowEnd
              )
            )
            .sort(sortDescendingByMatchDate)[0] ?? null
        : null;

    if (!recentMatch) {
      return {
        status: "ready",
        recentMatch: null,
        availabilityReason: "missingATeamMatch",
        availabilityMatch: null,
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
        availabilityReason: null,
        availabilityMatch: null,
        playerMinutesById: {},
      };
    }

    const matchId = Number(recentMatch.MatchID);
    const sourceSystem =
      typeof recentMatch.SourceSystem === "string" && recentMatch.SourceSystem.trim().length > 0
        ? recentMatch.SourceSystem.trim()
        : "Hattrick";
    if (playedBTeamMatch) {
      const playedMatchId = Number(playedBTeamMatch.MatchID);
      const playedSourceSystem =
        typeof playedBTeamMatch.SourceSystem === "string" &&
        playedBTeamMatch.SourceSystem.trim().length > 0
          ? playedBTeamMatch.SourceSystem.trim()
          : "Hattrick";
      return {
        status: "ready",
        recentMatch: {
          matchId,
          sourceSystem,
          matchDate: recentMatch.MatchDate ?? "",
        },
        availabilityReason: "bTeamAlreadyPlayed",
        availabilityMatch:
          Number.isFinite(playedMatchId) && playedMatchId > 0
            ? {
                matchId: playedMatchId,
                sourceSystem: playedSourceSystem,
                matchDate: playedBTeamMatch.MatchDate ?? "",
              }
            : null,
        playerMinutesById: {},
      };
    }

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
        availabilityReason: null,
        availabilityMatch: null,
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
      availabilityReason: null,
      availabilityMatch: null,
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
      if (typeof payload.season === "number" && Number.isFinite(payload.season) && payload.season > 0) {
        const normalizedSeason = Math.floor(payload.season);
        setCurrentSeason(normalizedSeason);
        writeGlobalSeason(normalizedSeason);
      }
      const managerIdentity = extractManagerIdentityFromManagerCompendium(payload.data);
      setLineupExclusionsUserKey(managerIdentity?.userId ?? "default");
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
    if (cached !== null) {
      setCurrentSeason(cached);
      return cached;
    }
    const payload = await fetchManagerCompendium(managerCompendiumUserIdOverride);
    const directSeason =
      typeof payload?.season === "number" && Number.isFinite(payload.season)
        ? Math.floor(payload.season)
        : null;
    if (directSeason && directSeason > 0) {
      setCurrentSeason(directSeason);
      writeGlobalSeason(directSeason);
      return directSeason;
    }

    const teams = normalizeManagerCompendiumTeams(
      payload?.data?.HattrickData?.Manager?.Teams?.Team
    );
    for (const team of teams) {
      const maybeSeason = parseNumber(team?.League?.Season);
      if (typeof maybeSeason === "number" && Number.isFinite(maybeSeason) && maybeSeason > 0) {
        const normalizedSeason = Math.floor(maybeSeason);
        setCurrentSeason(normalizedSeason);
        writeGlobalSeason(normalizedSeason);
        return normalizedSeason;
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

  const fetchTrainedIgnoreTrainingFormations = async (teamId?: number | null) => {
    const cachedTeamId =
      typeof teamId === "number" && Number.isFinite(teamId) && teamId > 0 ? teamId : null;
    if (cachedTeamId !== null) {
      const cached = trainedIgnoreTrainingFormationsCacheRef.current.get(cachedTeamId);
      if (cached) {
        return {
          teamId: cachedTeamId,
          formations: [...cached],
        };
      }
    }
    const { response, payload } = await fetchChppJson<{
      data?: {
        HattrickData?: {
          Team?: {
            TeamID?: unknown;
          } & Partial<Record<(typeof TRAINING_EXPERIENCE_FIELDS)[number]["field"], unknown>>;
        };
      };
      error?: string;
      details?: string;
    }>(
      `/api/chpp/training?actionType=view${
        cachedTeamId ? `&teamId=${cachedTeamId}` : ""
      }`,
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to fetch training");
    }
    const team = payload?.data?.HattrickData?.Team;
    const resolvedTeamId = parseNumber(team?.TeamID);
    const formations = TRAINING_EXPERIENCE_FIELDS.filter(
      ({ field }) =>
        (parseNumber(team?.[field]) ?? 0) > TRAINED_IGNORE_TRAINING_MIN_EXPERIENCE
    ).map(({ formation }) => formation);
    if (resolvedTeamId !== null) {
      trainedIgnoreTrainingFormationsCacheRef.current.set(resolvedTeamId, formations);
    }
    return {
      teamId: resolvedTeamId,
      formations,
    };
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
    if (trainingTypeSetPending || !canSetTraining) return;
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
      setTrainingAwareMatrixTrainingType(verifiedTrainingType);
      setTrainingAwareMatrixTrainingTypeManual(false);
      setTrainingAwareTrainingMenuOpen(false);
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

  const syncTrainingAwareModalTrainingType = async () => {
    try {
      const currentTrainingType = sanitizeTrainingType(
        await fetchTrainingType(resolvedSeniorTeamId)
      );
      setTrainingType(currentTrainingType);
      setTrainingAwareMatrixTrainingType(currentTrainingType);
    } finally {
      setTrainingAwareMatrixTrainingTypeManual(false);
    }
  };

  type FetchSeniorPlayerDetailsOptions = {
    encounterSource?: SeniorEncounterSource;
    captureEncounter?: boolean;
  };

  const fetchPlayerDetailsById = async (
    playerId: number,
    optionsOrEncounterSource: SeniorEncounterSource | FetchSeniorPlayerDetailsOptions = "ownSenior"
  ) => {
    const options =
      typeof optionsOrEncounterSource === "string"
        ? { encounterSource: optionsOrEncounterSource, captureEncounter: true }
        : {
            encounterSource: optionsOrEncounterSource.encounterSource ?? "ownSenior",
            captureEncounter: optionsOrEncounterSource.captureEncounter ?? true,
          };
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
    const rawPlayer = payload.data.HattrickData.Player;
    const normalized = normalizeSeniorPlayerDetails(
      rawPlayer,
      playerId
    );
    if (options.captureEncounter) {
      await captureSeniorEncounteredPlayer(rawPlayer, options.encounterSource);
    }
    return normalized;
  };

  const ensureDetailsWithEncounterStatus = async (
    playerId: number,
    encounterSource: SeniorEncounterSource
  ) => {
    const cached = detailsCache[playerId];
    if (!cached || Date.now() - cached.fetchedAt >= DETAILS_TTL_MS) {
      try {
        const { response, payload } = await fetchChppJson<{
          data?: { HattrickData?: { Player?: SeniorPlayerDetails } };
          error?: string;
          details?: string;
        }>(`/api/chpp/playerdetails?playerId=${playerId}&includeMatchInfo=true`, {
          cache: "no-store",
        });
        if (!response.ok || payload?.error || !payload?.data?.HattrickData?.Player) {
          return { resolved: false, added: false };
        }
        const rawPlayer = payload.data.HattrickData.Player;
        const normalized = normalizeSeniorPlayerDetails(rawPlayer, playerId);
        if (!normalized) {
          return { resolved: false, added: false };
        }
        const captureStatus = await captureSeniorEncounteredPlayer(
          rawPlayer,
          encounterSource
        );
        setDetailsCache((prev) => ({
          ...prev,
          [playerId]: {
            data: normalized,
            fetchedAt: Date.now(),
          },
        }));
        return {
          resolved: true,
          detail: normalized,
          added: captureStatus === "added",
          deduped: captureStatus === "deduped",
          failed: captureStatus === "failed",
        };
      } catch (error) {
        if (error instanceof ChppAuthRequiredError) {
          return { resolved: false, added: false, deduped: false, failed: true };
        }
        throw error;
      }
    }
    const captureStatus = await captureSeniorEncounteredPlayer(
      cached.data,
      encounterSource
    );
    return {
      resolved: true,
      detail: cached.data,
      added: captureStatus === "added",
      deduped: captureStatus === "deduped",
      failed: captureStatus === "failed",
    };
  };

  const bootstrapRatingsFromSeasons = async (teamId: number | null, season: number) => {
    const previousSeason = await fetchRatings(teamId, Math.max(1, season - 1));
    const currentSeason = await fetchRatings(teamId, season);
    return mergeRatingsMatrices(previousSeason, currentSeason);
  };

  const ensureDetails = async (
    playerId: number,
    forceRefresh = false,
    encounterSource: SeniorEncounterSource = "ownSenior"
  ) => {
    const cached = detailsCache[playerId];
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS) {
      await captureSeniorEncounteredPlayer(cached.data, encounterSource);
      return cached.data;
    }
    let resolved: SeniorPlayerDetails | null;
    try {
      resolved = await fetchPlayerDetailsById(playerId, encounterSource);
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return null;
      throw error;
    }
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

  const hydrateTransferSearchDetails = async (results: TransferSearchResult[]) => {
    const encounterCount = results.length;
    if (process.env.NODE_ENV !== "production") {
      addNotification(
        messages.notificationDebugSeniorMlEncountered.replace(
          "{{count}}",
          String(encounterCount)
        )
      );
    }
    const outcomes = await mapWithConcurrency(
      results,
      4,
      async (result) => {
        return ensureDetailsWithEncounterStatus(
          result.playerId,
          "seniorTransferMarket"
        );
      }
    );
    if (process.env.NODE_ENV !== "production") {
      const addedCount = outcomes.filter((outcome) => outcome?.added).length;
      const dedupedCount = outcomes.filter((outcome) => outcome?.deduped).length;
      const failedCount = outcomes.filter((outcome) => outcome?.failed).length;
      addNotification(
        messages.notificationDebugSeniorMlDedup.replace(
          "{{added}}",
          String(addedCount)
        )
          .replace("{{deduped}}", String(dedupedCount))
          .replace("{{failed}}", String(failedCount))
      );
      const firstResult = results[0];
      const firstDetails =
        outcomes[0]?.detail ?? (firstResult ? detailsCache[firstResult.playerId]?.data : null);
      if (firstResult) {
        const resolvedSalary =
          typeof firstDetails?.Salary === "number" ? firstDetails.Salary : firstResult.salarySek;
        const resolvedIsAbroad =
          resolveSeniorIsAbroad(firstDetails) ?? firstResult.isAbroad ?? null;
        const foreignForSelectedTeam = isForeignForSelectedLeague(
          firstDetails?.NativeLeagueID,
          selectedSeniorLeagueId
        );
        resolveTransferSearchSalaryForSelectedTeam(
          resolvedSalary,
          resolvedIsAbroad,
          foreignForSelectedTeam
        );
      }
    }
  };

  const runTransferSearch = async (
    filters: TransferSearchFilters,
    options?: {
      allowAutoFallback?: boolean;
      sourcePlayer?: SeniorPlayer | null;
      sourceDetails?: SeniorPlayerDetails | null;
    }
  ) => {
    const requestId = transferSearchRequestIdRef.current + 1;
    transferSearchRequestIdRef.current = requestId;
    const isCurrentSearch = () => transferSearchRequestIdRef.current === requestId;
    const normalizedFilters = normalizeTransferSearchFilters(filters);
    setTransferSearchFilters(normalizedFilters);
    setTransferSearchLoading(true);
    setTransferSearchError(null);
    setTransferSearchUsedFallback(false);
    setTransferSearchExactEmpty(false);
    setTransferSearchResults([]);
    setTransferSearchItemCount(null);

    const execute = async (filtersToRun: TransferSearchFilters) => {
      const params = buildTransferSearchParams(filtersToRun, displayCurrency);
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
        itemCount: parseNumber(transferSearch?.ItemCount),
        results: normalizeTransferSearchResults(transferSearch?.TransferResults?.TransferResult),
      };
    };

    try {
      const exact = await execute(normalizedFilters);
      if (!isCurrentSearch()) return;
      const fallbackSourcePlayer = options?.sourcePlayer ?? transferSearchSourcePlayer;
      const fallbackSourceDetails = options?.sourceDetails ?? transferSearchSourceDetails;
      if (options?.allowAutoFallback && exact.results.length === 0 && fallbackSourcePlayer) {
        const fallbackFilters = buildFallbackTransferSearchFilters(
          fallbackSourcePlayer,
          fallbackSourceDetails
        );
        const normalizedFallback = normalizeTransferSearchFilters(fallbackFilters);
        const fallback = await execute(normalizedFallback);
        if (!isCurrentSearch()) return;
        setTransferSearchFilters(normalizedFallback);
        setTransferSearchResults(fallback.results);
        setTransferSearchItemCount(fallback.results.length);
        setTransferSearchUsedFallback(true);
        setTransferSearchExactEmpty(true);
        await hydrateTransferSearchDetails(fallback.results);
      } else {
        setTransferSearchResults(exact.results);
        setTransferSearchItemCount(exact.results.length);
        await hydrateTransferSearchDetails(exact.results);
      }
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

  const openTransferSearchForPlayer = async (
    player: SeniorPlayer,
    options?: {
      sourceDetailsOverride?: SeniorPlayerDetails | null;
    }
  ) => {
    if (!isSupporter) return false;
    trackSeniorFeatureUsed("find_similar_players_clicked", seniorAnalyticsSource);
    const hasRequiredScopes = await ensureRequiredScopes();
    if (!hasRequiredScopes) return false;
    const detail =
      options?.sourceDetailsOverride !== undefined
        ? options.sourceDetailsOverride
        : await ensureDetails(player.PlayerID, false, "ownSenior");
    const editedSourceDetails =
      options?.sourceDetailsOverride === undefined &&
      effectiveSelectedPlayerSimulationState.dirty &&
      selectedId === player.PlayerID &&
      effectiveSelectedPlayerSimulationState.metricInput
        ? buildEditedTransferSearchSourceDetails(
            detail,
            effectiveSelectedPlayerSimulationState.metricInput
          )
        : null;
    const sourceDetails = editedSourceDetails ?? detail;
    const initialFilters = buildInitialTransferSearchFilters(player, sourceDetails);
    setTransferSearchSourcePlayerId(player.PlayerID);
    setTransferSearchResultsViewMode("cards");
    setTransferSearchModalOpen(true);
    void runTransferSearch(initialFilters, {
      allowAutoFallback: true,
      sourcePlayer: player,
      sourceDetails,
    });
    return true;
  };

  const updateTransferSearchSkillFilter = useCallback((
    index: number,
    patch: Partial<TransferSearchSkillFilter>
  ) => {
    setTransferSearchFilters((prev) => {
      if (!prev) return prev;
      const nextSkillFilters = [...prev.skillFilters];
      while (nextSkillFilters.length <= index) {
        nextSkillFilters.push({ skillKey: null, min: 0, max: 0 });
      }
      const currentFilter = nextSkillFilters[index] ?? {
        skillKey: null,
        min: 0,
        max: 0,
      };
      nextSkillFilters[index] = { ...currentFilter, ...patch };
      return normalizeTransferSearchFilters({
        ...prev,
        skillFilters: nextSkillFilters,
      });
    });
  }, []);

  const updateTransferSearchFilterField = useCallback(<
    K extends Exclude<keyof TransferSearchFilters, "skillFilters">
  >(
    key: K,
    value: TransferSearchFilters[K]
  ) => {
    setTransferSearchFilters((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const updateTransferSearchBidDraft = useCallback((
    playerId: number,
    key: keyof TransferSearchBidDraft,
    value: string
  ) => {
    setTransferSearchBidDrafts((prev) => ({
      ...prev,
      [playerId]: {
        bidDisplay: prev[playerId]?.bidDisplay ?? "",
        maxBidDisplay: prev[playerId]?.maxBidDisplay ?? "",
        [key]: value,
      },
    }));
  }, []);

  const submitTransferBid = useCallback(async (
    result: TransferSearchResult,
    bidKind: keyof TransferSearchBidDraft
  ) => {
    if (!resolvedSeniorTeamId || !canPlaceBid) return;
    const draft = transferSearchBidDrafts[result.playerId] ?? { bidDisplay: "", maxBidDisplay: "" };
    const amountSek = displayToSek(draft[bidKind], displayCurrency);
    if (!amountSek) {
      addNotification(messages.seniorTransferSearchBidMissingAmount);
      return;
    }

    setTransferSearchBidPendingPlayerId(result.playerId);
    try {
      const requestBody =
        bidKind === "bidDisplay"
          ? { playerId: result.playerId, teamId: resolvedSeniorTeamId, bidAmount: amountSek }
          : { playerId: result.playerId, teamId: resolvedSeniorTeamId, maxBidAmount: amountSek };
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
      const refreshedDetail = await fetchPlayerDetailsById(
        result.playerId,
        "seniorTransferMarket"
      );
      if (refreshedDetail) {
        setDetailsCache((prev) => ({
          ...prev,
          [result.playerId]: {
            data: refreshedDetail,
            fetchedAt: Date.now(),
          },
        }));
      }
      if (transferSearchFilters) {
        await runTransferSearch(transferSearchFilters);
      }
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
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
    canPlaceBid,
    displayCurrency,
    fetchPlayerDetailsById,
    messages.seniorTransferSearchBidFailed,
    messages.seniorTransferSearchBidMissingAmount,
    messages.seniorTransferSearchBidPlaced,
    resolvedSeniorTeamId,
    transferSearchBidDrafts,
    transferSearchFilters,
    runTransferSearch,
  ]);

  const placeTransferQuickBid = useCallback(
    async (result: TransferSearchResult) => {
      if (!resolvedSeniorTeamId || !canPlaceBid) return;
      const minimumBidSek = resolveTransferSearchMinimumBidSek(result, displayCurrency);
      if (typeof minimumBidSek !== "number") {
        addNotification(messages.seniorTransferSearchBidMissingAmount);
        return;
      }
      updateTransferSearchBidDraft(
        result.playerId,
        "bidDisplay",
        formatTransferSearchBidDraftDisplay(minimumBidSek, displayCurrency)
      );
      setTransferSearchBidPendingPlayerId(result.playerId);
      try {
        const { response, payload } = await fetchChppJson<{
          error?: string;
          details?: string;
        }>("/api/chpp/playerdetails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: result.playerId,
            teamId: resolvedSeniorTeamId,
            bidAmount: minimumBidSek,
          }),
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
        const refreshedDetail = await fetchPlayerDetailsById(
          result.playerId,
          "seniorTransferMarket"
        );
        if (refreshedDetail) {
          setDetailsCache((prev) => ({
            ...prev,
            [result.playerId]: {
              data: refreshedDetail,
              fetchedAt: Date.now(),
            },
          }));
        }
        if (transferSearchFilters) {
          await runTransferSearch(transferSearchFilters);
        }
      } catch (error) {
        if (error instanceof ChppAuthRequiredError) return;
        addNotification(
          messages.seniorTransferSearchBidFailed.replace(
            "{{details}}",
            error instanceof Error ? error.message : String(error)
          )
        );
      } finally {
        setTransferSearchBidPendingPlayerId(null);
      }
    },
    [
      addNotification,
      canPlaceBid,
      displayCurrency,
      fetchPlayerDetailsById,
      messages.seniorTransferSearchBidFailed,
      messages.seniorTransferSearchBidMissingAmount,
      messages.seniorTransferSearchBidPlaced,
      resolvedSeniorTeamId,
      runTransferSearch,
      transferSearchFilters,
      updateTransferSearchBidDraft,
    ]
  );

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
        const detail = await fetchPlayerDetailsById(player.PlayerID, "ownSenior");
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

  const hasManualRatingsEdits = useMemo(
    () => hasSeniorManualRatingsEdits(ratingsManualEditsByPlayerId),
    [ratingsManualEditsByPlayerId]
  );
  const effectiveRatingsManualOverrideEnabled =
    premiumUnlocked && ratingsManualOverrideEnabled;

  useEffect(() => {
    const nextRatingsResponse = buildEffectiveSeniorRatingsResponse(
      latestFetchedRatingsResponse,
      ratingsManualEditsByPlayerId,
      players
    );
    setRatingsResponse(nextRatingsResponse);
  }, [latestFetchedRatingsResponse, players, ratingsManualEditsByPlayerId]);

  const playerNameById = useMemo(() => {
    const map = new Map<number, string>();
    players.forEach((player) => {
      map.set(player.PlayerID, formatPlayerName(player) || String(player.PlayerID));
    });
    return map;
  }, [players]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncPremiumState = () => {
      setPremiumUnlocked(hasUnlockedPremiumAccess(readAppLicenseState()));
    };
    syncPremiumState();
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== APP_LICENSE_STORAGE_KEY) return;
      syncPremiumState();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(APP_LICENSE_EVENT, syncPremiumState);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(APP_LICENSE_EVENT, syncPremiumState);
    };
  }, []);
  useEffect(() => {
    if (hasManualRatingsEdits) return;
    setRatingsOverwriteManualEditsEnabled(false);
  }, [hasManualRatingsEdits]);
  const handleRatingsManualOverrideEnabledChange = useCallback((enabled: boolean) => {
    if (enabled && !premiumUnlocked) {
      openPremiumLicenseModal(seniorRatingsLicenseContext);
      return;
    }
    setRatingsManualOverrideEnabled(enabled);
  }, [openPremiumLicenseModal, premiumUnlocked, seniorRatingsLicenseContext]);
  const handleRatingsOverwriteManualEditsEnabledChange = useCallback(
    (enabled: boolean) => {
      setRatingsOverwriteManualEditsEnabled(enabled);
    },
    []
  );
  const handleRatingsManualCellChange = useCallback(
    (playerId: number, position: number, value: number | null) => {
      trackSeniorFeatureUsed("ratings_manual_value_edited", seniorAnalyticsSource);
      const positionKey = String(position);
      setRatingsManualEditsByPlayerId((prev) => {
        const next: SeniorManualRatingsEdits = { ...prev };
        const existingByPosition = { ...(next[playerId] ?? {}) };
        const latestFetchedValue =
          latestFetchedRatingsResponse?.players.find((row) => row.id === playerId)?.ratings?.[
            positionKey
          ] ?? null;
        const normalizedLatestFetchedValue =
          typeof latestFetchedValue === "number" && Number.isFinite(latestFetchedValue)
            ? Math.round(latestFetchedValue * 10) / 10
            : null;
        if (value === null) {
          delete existingByPosition[positionKey];
        } else if (normalizedLatestFetchedValue !== null && value === normalizedLatestFetchedValue) {
          delete existingByPosition[positionKey];
        } else {
          existingByPosition[positionKey] = value;
        }
        if (Object.keys(existingByPosition).length > 0) {
          next[playerId] = existingByPosition;
        } else {
          delete next[playerId];
        }
        return next;
      });
    },
    [latestFetchedRatingsResponse, seniorAnalyticsSource, trackSeniorFeatureUsed]
  );
  const handleDiscardRatingsManualEdits = useCallback(() => {
    setRatingsManualEditsByPlayerId({});
  }, []);
  const seniorEmptySlotPickerOptions = useCallback(
    (slotId: string) => {
      const lineupSlot = slotId as keyof LineupAssignments;
      const assignedPlayerIds = new Set(
        Object.values(assignments).filter(
          (playerId): playerId is number => typeof playerId === "number" && playerId > 0
        )
      );
      const eligiblePlayers = players
        .filter((player) => {
          if (isPlayerExcluded(excludedPlayers, player.PlayerID)) return false;
          if (assignedPlayerIds.has(player.PlayerID)) return false;
          const injuryLevel = seniorAiInjuryLevelForPlayer(player);
          return typeof injuryLevel !== "number" || injuryLevel < 1;
        })
      return buildOrderedCandidatesForReusableAssignment(
        eligiblePlayers,
        lineupSlot,
        ratingsByPlayerId
      ).map((player) => ({
          playerId: player.PlayerID,
          label: formatPlayerName(player) || String(player.PlayerID),
          meta:
            typeof player.Age === "number"
              ? `${player.Age}${messages.ageYearsShort}`
              : messages.unknownShort,
        }));
    },
    [
      assignments,
      excludedPlayers,
      messages.ageYearsShort,
      messages.unknownShort,
      players,
      ratingsByPlayerId,
    ]
  );
  const formatDebugPlayerNames = (playerIds: number[]) =>
    playerIds.map((playerId) => playerNameById.get(playerId) ?? String(playerId)).join(", ");
  const opponentTrackedRoleLabel = (role: OpponentTrackedRole) =>
    role === "F" ? "FW" : role;
  const opponentScoutLikelyTrainingLabel = (
    rows: OpponentFormationRow[]
  ): TeamScoutLikelyTrainingInfo => {
    const formationCounts = new Map<string, number>();
    rows.forEach((row) => {
      if (!row.formation) return;
      formationCounts.set(row.formation, (formationCounts.get(row.formation) ?? 0) + 1);
    });
    const topFormation = Array.from(formationCounts.entries()).sort(
      (left, right) => right[1] - left[1]
    )[0]?.[0];
    if (!topFormation) {
      return { likelyTrainingKey: null, label: messages.unknownShort };
    }
    const parts = topFormation.split("-").map((value) => Number(value));
    if (parts.length !== 3 || parts.some((value) => !Number.isFinite(value))) {
      return { likelyTrainingKey: null, label: messages.unknownShort };
    }
    const [defenders, midfielders, forwards] = parts;
    if (forwards >= 3) {
      return {
        likelyTrainingKey: "scoring",
        label: messages.clubChronicleLikelyTrainingScoring,
      };
    }
    if (midfielders >= 5) {
      return {
        likelyTrainingKey: "playmaking",
        label: messages.clubChronicleLikelyTrainingPlaymaking,
      };
    }
    if (defenders >= 5) {
      return {
        likelyTrainingKey: "defending",
        label: messages.clubChronicleLikelyTrainingDefending,
      };
    }
    if (midfielders >= 4 && forwards >= 2) {
      return {
        likelyTrainingKey: "passing",
        label: messages.clubChronicleLikelyTrainingPassing,
      };
    }
    return {
      likelyTrainingKey: "keepingOrSetPieces",
      label: messages.clubChronicleLikelyTrainingKeepingOrSetPieces,
    };
  };
  const formatOpponentPotentialTargetDetails = (
    target: OpponentPotentialTargetPlayer
  ) => {
    const parts = [
      `matches=${target.count}`,
      `tsi=${target.tsi ?? "?"}`,
      `stam=${target.stamina ?? "?"}`,
      `ageDays=${target.ageDays ?? "?"}`,
    ];
    return `(${parts.join(", ")})`;
  };
  const renderOpponentTrackedPlayer = (
    player: OpponentTrackedLineupPlayer,
    potentialTargets: OpponentPotentialTargetPlayer[],
    selectedTarget: OpponentTargetPlayer | null
  ) => {
    const potentialTarget = potentialTargets.find(
      (entry) => entry.playerId === player.playerId && entry.role === player.role
    );
    const isPotential = Boolean(potentialTarget);
    const isSelected =
      selectedTarget?.playerId === player.playerId && selectedTarget.role === player.role;
    return (
      <span key={`${player.playerId}-${player.role}`}>
        {player.name}
        {isPotential && potentialTarget
          ? ` ${formatOpponentPotentialTargetDetails(potentialTarget)}`
          : null}
        {isSelected ? ` (${messages.setBestLineupDevSelectedTargetBadge})` : null}
        {!isSelected && isPotential
          ? ` (${messages.setBestLineupDevPotentialTargetBadge})`
          : null}
      </span>
    );
  };
  const renderOpponentTrackedLineup = (
    row: OpponentFormationRow,
    potentialTargets: OpponentPotentialTargetPlayer[],
    selectedTarget: OpponentTargetPlayer | null
  ) => {
    if (!row.trackedPlayers.length) return messages.unknownShort;
    const grouped = (["W", "IM", "F"] as OpponentTrackedRole[])
      .map((role) => ({
        role,
        players: row.trackedPlayers.filter((player) => player.role === role),
      }))
      .filter((entry) => entry.players.length > 0);
    return grouped.map((entry, index) => (
      <div key={`${row.matchId}-${entry.role}`}>
        {index > 0 ? <span aria-hidden="true"> </span> : null}
        <strong>{opponentTrackedRoleLabel(entry.role)}:</strong>{" "}
        {entry.players.map((player, playerIndex) => (
          <Fragment key={`${player.playerId}-${entry.role}`}>
            {playerIndex > 0 ? ", " : null}
            {renderOpponentTrackedPlayer(player, potentialTargets, selectedTarget)}
          </Fragment>
        ))}
      </div>
    ));
  };
  const renderOpponentTargetSummary = (
    targets: OpponentPotentialTargetPlayer[],
    selectedTarget: OpponentTargetPlayer | null
  ) => {
    if (!targets.length) {
      return messages.setBestLineupDevPotentialTargetsNone;
    }
    return targets.map((target, index) => (
      <Fragment key={`${target.playerId}-${target.role}`}>
        {index > 0 ? ", " : null}
        {target.name} ({opponentTrackedRoleLabel(target.role)})
        {" "}
        {formatOpponentPotentialTargetDetails(target)}
        {selectedTarget?.playerId === target.playerId && selectedTarget.role === target.role
          ? ` - ${messages.setBestLineupDevSelectedTargetBadge}`
          : null}
      </Fragment>
    ));
  };
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

  const refreshAll = async (
    reason: "manual" | "stale",
    options?: { startup?: boolean }
  ) => {
    if (refreshing) return false;
    const isStartup = options?.startup ?? false;
    const refreshRunId = ++refreshRunSeqRef.current;
    activeRefreshRunIdRef.current = refreshRunId;
    stoppedRefreshRunIdsRef.current.delete(refreshRunId);
    const isStopped = () =>
      stoppedRefreshRunIdsRef.current.has(refreshRunId) ||
      activeRefreshRunIdRef.current !== refreshRunId;
    const forceResetRatingsAlgorithm =
      !hasCurrentSeniorRatingsAlgorithmVersion(latestFetchedRatingsResponse);
    const effectiveRatingsResponse = forceResetRatingsAlgorithm
      ? null
      : latestFetchedRatingsResponse;

    if (forceResetRatingsAlgorithm) {
      suppressNextUpdatesRecordingRef.current = true;
      persistedMarkersBaselineRef.current = {
        players,
        ratingsByPlayerId: {},
      };
      setLatestFetchedRatingsResponse(null);
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
        : buildRatingsByPlayerIdFromResponse(latestFetchedRatingsResponse);
    const previousDetailsById = new Map(detailsById);

    setRefreshing(true);
    if (isStartup) {
      setStartupBootstrapActive(true);
      setStartupLoadingPhase("teamContext");
      setStartupLoadingProgressPct(8);
    }
    setRefreshStatus(messages.startupLoadingTeamContext);
    setRefreshProgressPct(5);
    setMatrixNewMarkers(buildEmptySeniorMatrixNewMarkers());
    let didBootstrapRatings = false;
    let effectiveTeamId = resolvedSeniorTeamId;
    let nextSeniorTeamGeneralInfo: SeniorTeamGeneralInfo | null = null;

    try {
      try {
        const trainingSnapshot = await fetchTrainingSnapshot(resolvedSeniorTeamId);
        if (isStopped()) return false;
        effectiveTeamId = trainingSnapshot.teamId ?? effectiveTeamId;
        setTrainingType(sanitizeTrainingType(trainingSnapshot.trainingType));
        if (isStartup) {
          setStartupLoadingProgressPct(16);
        }
      } catch {
        // Keep refresh flow intact even if team context fails.
      }

      try {
        nextSeniorTeamGeneralInfo = await fetchSeniorTeamGeneralInfo(effectiveTeamId);
        if (isStopped()) return false;
      } catch {
        // Staff data is advisory; preserve the rest of the refresh if it fails.
      }

      if (isStartup) {
        setStartupLoadingPhase("players");
        setStartupLoadingProgressPct(24);
      }
      setRefreshStatus(messages.refreshStatusFetchingPlayers);
      setRefreshProgressPct(10);
      const nextPlayers = await fetchPlayers(effectiveTeamId);
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
              if (isStartup) {
                setStartupLoadingProgressPct(24 + pct);
              }
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
      const nextDetailsCache: Record<number, PlayerDetailCacheEntry> = {
        ...detailsCache,
      };
      Object.entries(detailsRefreshed).forEach(([id, detail]) => {
        const parsedId = Number(id);
        if (!Number.isFinite(parsedId)) return;
        nextDetailsCache[parsedId] = {
          data: detail,
          fetchedAt: Date.now(),
        };
      });

      if (isStartup) {
        setStartupLoadingPhase("matches");
        setStartupLoadingProgressPct(55);
      }
      setRefreshStatus(messages.refreshStatusFetchingMatches);
      setRefreshProgressPct(45);
      const nextMatches = await fetchMatches(effectiveTeamId);
      if (isStopped()) return false;

      if (isStartup) {
        setStartupLoadingPhase("ratings");
        setStartupLoadingProgressPct(68);
      }
      setRefreshStatus(messages.refreshStatusFetchingRatings);
      setRefreshProgressPct(60);
      const shouldBootstrapRatings = !hasUsableSeniorRatingsMatrix(effectiveRatingsResponse);
      didBootstrapRatings = shouldBootstrapRatings;
      let incomingRatingsForOverwrite: RatingsMatrixResponse | null = null;
      const nextRatings = shouldBootstrapRatings
        ? await (async () => {
            const currentSeason = await fetchCurrentSeason();
            if (isStopped()) return null;
            setRefreshProgressPct(72);
            if (isStartup) {
              setStartupLoadingProgressPct(76);
            }
            const previousSeasonRatings = await fetchRatings(
              effectiveTeamId,
              Math.max(1, currentSeason - 1)
            );
            if (isStopped()) return null;
            setRefreshProgressPct(84);
            if (isStartup) {
              setStartupLoadingProgressPct(84);
            }
            const currentSeasonRatings = await fetchRatings(
              effectiveTeamId,
              currentSeason
            );
            if (isStopped()) return null;
            setRefreshProgressPct(90);
            if (isStartup) {
              setStartupLoadingProgressPct(92);
            }
            const mergedBootstrapRatings = stampSeniorRatingsAlgorithmVersion(
              mergeRatingsMatrices(previousSeasonRatings, currentSeasonRatings)
            );
            incomingRatingsForOverwrite = mergedBootstrapRatings;
            return mergedBootstrapRatings;
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
            if (isStartup) {
              setStartupLoadingProgressPct(76);
            }
            const incrementalRatings = await fetchRatings(
              effectiveTeamId,
              undefined,
              fromTs,
              fromMatchId,
              firstMatchDate,
              lastMatchDate
            );
            if (isStopped()) return null;
            setRefreshProgressPct(90);
            if (isStartup) {
              setStartupLoadingProgressPct(92);
            }
            incomingRatingsForOverwrite = incrementalRatings;
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
      if (isStartup) {
        setStartupLoadingPhase("finalize");
        setStartupLoadingProgressPct(96);
      }

      setPlayers(nextPlayers);
      if (effectiveTeamId) {
        void pruneSeniorLineupExcludedPlayers({
          teamId: effectiveTeamId,
          userKey: lineupExclusionsUserKey,
          currentPlayerIds: nextPlayers.map((player) => player.PlayerID),
        }).then((next) => {
          if (resolvedSeniorTeamIdRef.current !== effectiveTeamId) return;
          setExcludedPlayers(next);
        });
      }
      setMatchesState(nextMatches);
      setLatestFetchedRatingsResponse(nextRatings);
      if (ratingsOverwriteManualEditsEnabled) {
        setRatingsManualEditsByPlayerId((prev) =>
          dropOverwrittenSeniorManualRatingsEdits(prev, incomingRatingsForOverwrite)
        );
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

      const refreshedRatingsResponse = buildEffectiveSeniorRatingsResponse(
        nextRatings,
        ratingsManualEditsByPlayerId,
        nextPlayers
      );
      const refreshedSeniorTeamGeneralInfo =
        nextSeniorTeamGeneralInfo ??
        (isSeniorTeamGeneralInfo(seniorTeamGeneralInfo, effectiveTeamId)
          ? seniorTeamGeneralInfo
          : null);
      setSeniorTeamGeneralInfo(refreshedSeniorTeamGeneralInfo);
      const refreshedDataPayload = {
        players: nextPlayers,
        matchesState: nextMatches,
        ratingsResponse: refreshedRatingsResponse,
        latestFetchedRatingsResponse: nextRatings,
        detailsCache: nextDetailsCache,
        seniorTeamGeneralInfo: refreshedSeniorTeamGeneralInfo,
      };
      persistSeniorDataSnapshot("refresh-success", {
        payloadOverride: refreshedDataPayload,
      });

      const refreshedAt = Date.now();
      writeStoredLastRefresh(refreshedAt, lastRefreshStorageKey);
      setLastRefreshAt(refreshedAt);
      setRefreshStatus(null);
      setRefreshProgressPct(100);
      if (isStartup) {
        setStartupLoadingProgressPct(100);
      }
      setRefreshProgressPct(0);
      if (didBootstrapRatings) {
        addNotification(messages.notificationSeniorRatingsBootstrapComplete);
      }
      addNotification(
        reason === "stale"
          ? messages.notificationStaleRefresh
          : messages.notificationSeniorPlayersRefreshed
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
      if (isStartup) {
        setStartupBootstrapActive(false);
      }
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
    persistSeniorDataSnapshot("before-team-switch");
    staleRefreshAttemptedRef.current = false;
    otherOrdersFlashArmedRef.current = false;
    previousStartingXiCompleteRef.current = false;
    previousOtherOrdersLineupSignatureRef.current = null;
    setOtherOrdersFlashActive(false);
    if (otherOrdersFlashTimeoutRef.current !== null) {
      window.clearTimeout(otherOrdersFlashTimeoutRef.current);
      otherOrdersFlashTimeoutRef.current = null;
    }
    setSelectedId(null);
    setAssignments({});
    setBehaviors({});
    setLoadedMatchId(null);
    setPlayers([]);
    setMatchesState({});
    setLatestFetchedRatingsResponse(null);
    setSeniorTeamGeneralInfo(null);
    setRatingsResponse(null);
    setRatingsManualOverrideEnabled(false);
    setRatingsOverwriteManualEditsEnabled(false);
    setRatingsManualEditsByPlayerId({});
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

  const openFindSimilarPlayersFromReminder = useCallback(
    async (detail: SeniorFindSimilarPlayersEventDetail) => {
      const player = playersById.get(detail.playerId);
      if (!player) return false;
      if (detail.teamId && resolvedSeniorTeamId !== detail.teamId) return false;
      setSelectedId(player.PlayerID);
      return openTransferSearchForPlayer(player);
    },
    [openTransferSearchForPlayer, playersById, resolvedSeniorTeamId]
  );

  useEffect(() => {
    const handleFindSimilarPlayersReminder = (event: Event) => {
      const detail = (event as CustomEvent<SeniorFindSimilarPlayersEventDetail>)
        .detail;
      if (!detail || !Number.isFinite(detail.playerId)) return;
      if (detail.teamId && resolvedSeniorTeamId !== detail.teamId) {
        pendingFindSimilarReminderRef.current = detail;
        handleSeniorTeamChange(detail.teamId);
        return;
      }
      void openFindSimilarPlayersFromReminder(detail).then((opened) => {
        detail.onHandled?.(opened);
      });
    };
    window.addEventListener(
      SENIOR_OPEN_FIND_SIMILAR_PLAYERS_EVENT,
      handleFindSimilarPlayersReminder
    );
    return () => {
      window.removeEventListener(
        SENIOR_OPEN_FIND_SIMILAR_PLAYERS_EVENT,
        handleFindSimilarPlayersReminder
      );
    };
  }, [
    handleSeniorTeamChange,
    openFindSimilarPlayersFromReminder,
    resolvedSeniorTeamId,
  ]);

  useEffect(() => {
    const pending = pendingFindSimilarReminderRef.current;
    if (!pending) return;
    if (pending.teamId && resolvedSeniorTeamId !== pending.teamId) return;
    if (!playersById.has(pending.playerId)) {
      if (players.length > 0) {
        pendingFindSimilarReminderRef.current = null;
        pending.onHandled?.(false);
      }
      return;
    }
    pendingFindSimilarReminderRef.current = null;
    void openFindSimilarPlayersFromReminder(pending).then((opened) => {
      pending.onHandled?.(opened);
    });
  }, [openFindSimilarPlayersFromReminder, players.length, playersById, resolvedSeniorTeamId]);

  const ensureRequiredScopes = async () => {
    try {
      const { response } = await fetchChppJson<{
        permissions?: string[];
        raw?: string;
      }>("/api/chpp/oauth/check-token", {
        cache: "no-store",
      });
      if (!response.ok) {
        setScopeReconnectModalOpen(true);
        return false;
      }
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return false;
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
    if (selectedMatchType !== null && LEAGUE_QUALI_MATCH_TYPES.has(selectedMatchType)) {
      return LEAGUE_QUALI_MATCH_TYPES;
    }
    if (selectedMatchType !== null && CUP_MATCH_TYPES.has(selectedMatchType)) {
      return CUP_MATCH_TYPES;
    }
    if (selectedMatchType !== null && TOURNAMENT_MATCH_TYPES.has(selectedMatchType)) {
      return TOURNAMENT_MATCH_TYPES;
    }
    return LEAGUE_QUALI_MATCH_TYPES;
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
  const opponentSectorRatings = (row: OpponentFormationRow) => ({
    defense: computeOpponentSectorAverage([
      row.ratingRightDef,
      row.ratingMidDef,
      row.ratingLeftDef,
    ]),
    midfield: normalizeOpponentMatchRating(row.ratingMidfield),
    attack: computeOpponentSectorAverage([
      row.ratingRightAtt,
      row.ratingMidAtt,
      row.ratingLeftAtt,
    ]),
  });
  const formatOpponentSectorRating = (value: number | null) =>
    typeof value === "number" ? value.toFixed(2) : messages.unknownShort;

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

  const fetchOpponentTargetPlayer = async (
    playerId: number,
    fallbackName: string
  ): Promise<{
    playerId: number;
    name: string;
    tsi: number | null;
    stamina: number | null;
    ageDays: number | null;
  } | null> => {
    const cached = opponentTargetPlayerCacheRef.current.get(playerId);
    if (
      cached !== undefined &&
      cached !== null &&
      typeof cached.tsi === "number" &&
      typeof cached.stamina === "number" &&
      typeof cached.ageDays === "number"
    ) {
      return cached;
    }
    try {
      const { response, payload } = await fetchChppJson<{
        data?: {
          HattrickData?: {
            Player?: Record<string, unknown>;
          };
        };
        error?: string;
        details?: string;
      }>(`/api/chpp/playerdetails?playerId=${playerId}`, {
        cache: "no-store",
      });
      if (!response.ok || payload?.error) {
        opponentTargetPlayerCacheRef.current.set(playerId, null);
        return null;
      }
      const player = payload?.data?.HattrickData?.Player;
      if (!player || typeof player !== "object") {
        opponentTargetPlayerCacheRef.current.set(playerId, null);
        return null;
      }
      const playerNode = player as Record<string, unknown>;
      const playerSkills =
        playerNode.PlayerSkills && typeof playerNode.PlayerSkills === "object"
          ? (playerNode.PlayerSkills as Record<string, unknown>)
          : null;
      const age = parseNumber(playerNode.Age);
      const ageDays = parseNumber(playerNode.AgeDays);
      const snapshot = {
        playerId,
        name:
          formatPlayerName({
            FirstName:
              typeof playerNode.FirstName === "string"
                ? playerNode.FirstName
                : fallbackName,
            NickName:
              typeof playerNode.NickName === "string" && playerNode.NickName
                ? playerNode.NickName
                : undefined,
            LastName:
              typeof playerNode.LastName === "string" ? playerNode.LastName : "",
          }) || fallbackName,
        tsi: parseNumber(playerNode.TSI),
        stamina: playerSkills ? parseNumber(playerSkills.StaminaSkill) : null,
        ageDays:
          typeof age === "number" && typeof ageDays === "number"
            ? age * HATTRICK_AGE_DAYS_PER_YEAR + ageDays
            : null,
      };
      opponentTargetPlayerCacheRef.current.set(playerId, snapshot);
      return snapshot;
    } catch {
      opponentTargetPlayerCacheRef.current.set(playerId, null);
      return null;
    }
  };

  useEffect(() => {
    if (typeof otherOrdersModalMatchId !== "number") return;
    const loadedOrders = loadedLineupOrdersByMatchId[otherOrdersModalMatchId] ?? null;
    const targetId = loadedOrders?.manMarkingPlayerId ?? null;
    if (typeof targetId !== "number" || targetId <= 0) return;
    const ownPlayer = playersById.get(targetId);
    if (ownPlayer) return;
    const currentName =
      otherOrdersOpponentTargetNamesById[targetId] ??
      opponentTargetPlayerCacheRef.current.get(targetId)?.name ??
      null;
    if (currentName && currentName !== String(targetId)) {
      if (otherOrdersOpponentTargetNamesById[targetId] !== currentName) {
        setOtherOrdersOpponentTargetNamesById((prev) => ({
          ...prev,
          [targetId]: currentName,
        }));
      }
      return;
    }

    let cancelled = false;
    void fetchOpponentTargetPlayer(targetId, String(targetId)).then((snapshot) => {
      if (cancelled || !snapshot?.name || snapshot.name === String(targetId)) return;
      setOtherOrdersOpponentTargetNamesById((prev) => ({
        ...prev,
        [targetId]: snapshot.name,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [
    otherOrdersModalMatchId,
    loadedLineupOrdersByMatchId,
    playersById,
    otherOrdersOpponentTargetNamesById,
  ]);

  const determineOpponentManMarkingCandidates = async (
    rows: OpponentFormationRow[],
    consistencyThresholdPct: number
  ): Promise<{
    potentialTargets: OpponentPotentialTargetPlayer[];
    resolvedTargets: OpponentTargetPlayer[];
  }> => {
    if (!rows.length) {
      return {
        potentialTargets: [],
        resolvedTargets: [],
      };
    }
    const clampedThreshold = Math.min(
      SENIOR_AI_MAN_MARKING_FUZZINESS_MAX,
      Math.max(SENIOR_AI_MAN_MARKING_FUZZINESS_MIN, Math.round(consistencyThresholdPct))
    );
    const counts = new Map<string, { playerId: number; role: OpponentTrackedRole; name: string; count: number }>();
    const manMarkingRoles = new Set<OpponentTrackedRole>(["W", "IM", "F"]);
    rows.forEach((row) => {
      const uniqueEntries = new Map<string, OpponentTrackedLineupPlayer>();
      row.trackedPlayers.forEach((player) => {
        if (!manMarkingRoles.has(player.role)) return;
        uniqueEntries.set(`${player.playerId}:${player.role}`, player);
      });
      uniqueEntries.forEach((player) => {
        const key = `${player.playerId}:${player.role}`;
        const current = counts.get(key);
        counts.set(key, {
          playerId: player.playerId,
          role: player.role,
          name: player.name,
          count: (current?.count ?? 0) + 1,
        });
      });
    });
    const consistentPlayers = Array.from(counts.values()).filter((entry) =>
      entry.count * 100 >= rows.length * clampedThreshold
    );
    if (!consistentPlayers.length) {
      return {
        potentialTargets: [],
        resolvedTargets: [],
      };
    }
    const enrichedCandidates = (
      await mapWithConcurrency(
        consistentPlayers,
        OPPONENT_DETAILS_CONCURRENCY,
        async (entry) => {
          const snapshot = await fetchOpponentTargetPlayer(entry.playerId, entry.name);
          return {
            playerId: entry.playerId,
            role: entry.role,
            name: snapshot?.name || entry.name,
            count: entry.count,
            tsi: snapshot?.tsi ?? null,
            stamina: snapshot?.stamina ?? null,
            ageDays: snapshot?.ageDays ?? null,
          } satisfies OpponentPotentialTargetPlayer;
        }
      )
    ).filter((entry): entry is OpponentPotentialTargetPlayer => Boolean(entry));
    const resolvedCandidates = enrichedCandidates
      .filter(
        (
          entry
        ): entry is OpponentPotentialTargetPlayer & {
          tsi: number;
          stamina: number;
          ageDays: number;
        } =>
          typeof entry.tsi === "number" &&
          typeof entry.stamina === "number" &&
          typeof entry.ageDays === "number"
      )
      .map(
        (entry) =>
          ({
            playerId: entry.playerId,
            role: entry.role,
            name: entry.name,
            tsi: entry.tsi,
            stamina: entry.stamina,
            ageDays: entry.ageDays,
          }) satisfies OpponentTargetPlayer
      );
    return {
      potentialTargets: enrichedCandidates,
      resolvedTargets: [...resolvedCandidates].sort((left, right) => {
      if (left.tsi !== right.tsi) return left.tsi - right.tsi;
      if (left.stamina !== right.stamina) return left.stamina - right.stamina;
      if (left.ageDays !== right.ageDays) return right.ageDays - left.ageDays;
      return 0;
      }),
    };
  };

  const determineOpponentManMarkingTarget = async (
    rows: OpponentFormationRow[],
    consistencyThresholdPct: number
  ): Promise<{
    potentialTargets: OpponentPotentialTargetPlayer[];
    target: OpponentTargetPlayer | null;
  }> => {
    const { potentialTargets, resolvedTargets } = await determineOpponentManMarkingCandidates(
      rows,
      consistencyThresholdPct
    );
    if (!resolvedTargets.length) {
      return { potentialTargets, target: null };
    }
    const best = resolvedTargets[0] ?? null;
    if (!best) {
      return { potentialTargets, target: null };
    }
    const tied = resolvedTargets.filter(
      (entry) =>
        entry.tsi === best.tsi &&
        entry.stamina === best.stamina &&
        entry.ageDays === best.ageDays
    );
    return {
      potentialTargets,
      target: chooseRandomPlayer(tied) ?? best,
    };
  };

  const fetchOpponentFormationRowsForMatch = async (matchId: number) => {
    const cachedContext = opponentFormationContextCacheRef.current.get(matchId);
    if (cachedContext) {
      const cachedContextHasStaleTargets =
        cachedContext.potentialManMarkingTargets.some(
          (target) =>
            typeof target.tsi !== "number" ||
            typeof target.stamina !== "number" ||
            typeof target.ageDays !== "number"
        ) ||
        (cachedContext.potentialManMarkingTargets.length > 0 &&
          cachedContext.manMarkingTarget === null);
      if (
        cachedContext.manMarkingFuzziness === seniorAiManMarkingFuzziness &&
        !cachedContextHasStaleTargets
      ) {
        return cachedContext;
      }
      const updatedManMarking = await determineOpponentManMarkingTarget(
        cachedContext.rows,
        seniorAiManMarkingFuzziness
      );
      const updatedContext = {
        ...cachedContext,
        manMarkingFuzziness: seniorAiManMarkingFuzziness,
        potentialManMarkingTargets: updatedManMarking.potentialTargets,
        manMarkingTarget: updatedManMarking.target,
      } satisfies OpponentFormationContext;
      opponentFormationContextCacheRef.current.set(matchId, updatedContext);
      return updatedContext;
    }
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
        const [{ response: detailsResponse, payload: detailsPayload }, { response: lineupResponse, payload: lineupPayload }] =
          await Promise.all([
            fetchChppJson<{
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
            ),
            fetchChppJson<{
              data?: {
                HattrickData?: {
                  Team?: {
                    StartingLineup?: {
                      Player?: Record<string, unknown> | Array<Record<string, unknown>>;
                    };
                  };
                };
              };
              error?: string;
            }>(
              `/api/chpp/match-lineup?matchId=${entry.matchId}&teamId=${opponentTeamId}&sourceSystem=${encodeURIComponent(
                entry.sourceSystem
              )}`,
              { cache: "no-store" }
            ),
          ]);
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
            trackedPlayers: [],
          } as OpponentFormationRow;
        }
        const match = detailsPayload?.data?.HattrickData?.Match;
        const home = match?.HomeTeam;
        const away = match?.AwayTeam;
        const homeId = parseNumber(home?.HomeTeamID);
        const awayId = parseNumber(away?.AwayTeamID);
        const againstMyTeam = homeId === teamIdValue || awayId === teamIdValue;
        const isOpponentHome = homeId === opponentTeamId;
        const trackedPlayers = lineupResponse.ok && !lineupPayload?.error
          ? normalizeUnknownList(
              lineupPayload?.data?.HattrickData?.Team?.StartingLineup?.Player as
                | Record<string, unknown>
                | Array<Record<string, unknown>>
                | undefined
            )
              .map((playerNode) => {
                const player = (playerNode ?? {}) as Record<string, unknown>;
                const playerId = parseNumber(player.PlayerID);
                const position = normalizeOpponentTrackedRole(
                  matchRoleIdToPositionKey(parseNumber(player.RoleID))
                );
                if (!playerId || !position) return null;
                return {
                  playerId,
                  role: position,
                  name:
                    formatPlayerName({
                      FirstName:
                        typeof player.FirstName === "string"
                          ? player.FirstName
                          : "",
                      NickName:
                        typeof player.NickName === "string"
                          ? player.NickName
                          : undefined,
                      LastName:
                        typeof player.LastName === "string"
                          ? player.LastName
                          : "",
                    }) || String(playerId),
                } satisfies OpponentTrackedLineupPlayer;
              })
              .filter((player): player is OpponentTrackedLineupPlayer => Boolean(player))
          : [];
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
          trackedPlayers,
        } as OpponentFormationRow;
      }
    );
    const manMarking = await determineOpponentManMarkingTarget(
      rows,
      seniorAiManMarkingFuzziness
    );
    const context = {
      teamIdValue,
      opponentTeamId,
      opponentName: opponentName ?? messages.unknownLabel,
      selectedMatchType,
      selectedMatchSourceSystem,
      rows,
      manMarkingFuzziness: seniorAiManMarkingFuzziness,
      potentialManMarkingTargets: manMarking.potentialTargets,
      manMarkingTarget: manMarking.target,
    } satisfies OpponentFormationContext;
    opponentFormationContextCacheRef.current.set(matchId, context);
    return context;
  };

  const fetchOpponentCupStatus = useCallback(
    async (teamId: number): Promise<boolean | null> => {
      const cached = opponentCupStatusCacheRef.current.get(teamId);
      if (typeof cached === "boolean") return cached;
      try {
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              Team?: unknown;
              Teams?: {
                Team?: unknown;
              };
            };
          };
          error?: string;
          details?: string;
        }>(`/api/chpp/teamdetails?teamId=${teamId}`, {
          cache: "no-store",
        });
        if (!response.ok || payload?.error) return null;
        const stillInCup = parseTeamdetailsStillInCup(payload, teamId);
        if (typeof stillInCup === "boolean") {
          opponentCupStatusCacheRef.current.set(teamId, stillInCup);
          setOpponentCupStatusByTeamId((current) =>
            current[teamId] === stillInCup ? current : { ...current, [teamId]: stillInCup }
          );
        }
        return stillInCup;
      } catch {
        return null;
      }
    },
    []
  );

  const getOpponentCupStatus = useCallback(
    (teamId: number): boolean | null => {
      const stateValue = opponentCupStatusByTeamId[teamId];
      if (typeof stateValue === "boolean") return stateValue;
      const cached = opponentCupStatusCacheRef.current.get(teamId);
      return typeof cached === "boolean" ? cached : null;
    },
    [opponentCupStatusByTeamId]
  );

  const runSetBestLineupPredictRatings = async (
    matchId: number,
    mode: SetBestLineupMode,
    fixedFormationOverride?: string | null,
    options?: {
      trainingAwareTraineeIds?: number[];
      trainingAwareTrainingType?: number | null;
      ignoreTrainingFormationPolicy?: IgnoreTrainingFormationPolicy;
    }
  ) => {
    let fixedFormationFailureSlotDiagnostics: FixedFormationSlotDiagnostic[] = [];
    let fixedFormationFailureEligiblePlayerIds: number[] = [];
    setSeniorAiManMarkingTarget(null);
    try {
      const opponentContext = await fetchOpponentFormationRowsForMatch(matchId);
      if (!opponentContext) {
        setSeniorAiManMarkingTarget(null);
        return;
      }
      const { opponentName, selectedMatchType, teamIdValue, selectedMatchSourceSystem } =
        opponentContext;
      if (showSetBestLineupDebugModal) {
        setOpponentFormationsModal({
          matchId,
          title: `${messages.setBestLineup} · ${opponentName}`,
          mode,
          opponentRows: [],
          potentialManMarkingTargets: [],
          manMarkingTarget: null,
          manMarkingMarker: null,
          chosenFormation: null,
          chosenFormationAverages: null,
          generatedRows: [],
          fixedFormation: fixedFormationOverride ?? null,
          fixedFormationTacticRows: [],
          selectedGeneratedFormation: null,
          selectedGeneratedTactic: null,
          selectedRejectedPlayerIds: [],
          selectedIneligiblePlayerIds: [],
          fixedFormationFailureEligiblePlayerIds: [],
          fixedFormationFailureSlotDiagnostics: [],
          selectedComparison: null,
          loading: true,
          error: null,
        });
      }

      let activeTrainingType = trainingType;
      let allowedIgnoreTrainingFormations: Set<string> | null = null;
      if (
        mode === "trainingAware" &&
        typeof options?.trainingAwareTrainingType === "number"
      ) {
        activeTrainingType = sanitizeTrainingType(options.trainingAwareTrainingType);
      } else {
        try {
          activeTrainingType = sanitizeTrainingType(await fetchTrainingType());
          setTrainingType(activeTrainingType);
        } catch {
          // Keep best-lineup flow intact even if training endpoint fails.
        }
      }
      if (
        mode === "ignoreTraining" &&
        options?.ignoreTrainingFormationPolicy === "trainedFormations"
      ) {
        try {
          const trainedFormationsSnapshot =
            await fetchTrainedIgnoreTrainingFormations(teamIdValue);
          if (trainedFormationsSnapshot.formations.length > 0) {
            allowedIgnoreTrainingFormations = new Set(trainedFormationsSnapshot.formations);
          } else {
            addNotification(messages.notificationSeniorIgnoreTrainingNoTrainedFormations);
          }
        } catch (error) {
          const details =
            error instanceof Error ? error.message : messages.unableToLoadMatches;
          addNotification(details);
        }
      }

      const opponentRows = opponentContext.rows;
      const chosenFormation = chooseFormationByRules(opponentRows);
      const chosenFormationAverages = computeChosenFormationAverages(
        opponentRows,
        chosenFormation
      );

      let ratingsById = ratingsByPlayerId;
      if (!hasUsableSeniorRatingsMatrix(latestFetchedRatingsResponse)) {
        const currentSeason = await fetchCurrentSeason();
        const refreshedRatings = stampSeniorRatingsAlgorithmVersion(
          await bootstrapRatingsFromSeasons(resolvedSeniorTeamId, currentSeason)
        );
        setLatestFetchedRatingsResponse(refreshedRatings);
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
          const formValue =
            typeof details?.Form === "number"
              ? details.Form
              : typeof player.player.Form === "number"
                ? player.player.Form
                : -1;
          return {
            id: player.player.PlayerID,
            name: formatPlayerName(player.player) || String(player.player.PlayerID),
            injuryLevel,
            cardsValue: player.cardsValue,
            formValue,
          };
        })
        .filter((player) => {
          const candidatePlayer = playersById.get(player.id);
          return candidatePlayer
            ? isSeniorAiEligibleForMatch(candidatePlayer, selectedMatchType)
            : false;
        })
        .map(({ id, name, formValue }) => ({ id, name, formValue }));
      const eligiblePoolPlayers = playerPool
        .map((player) => playersById.get(player.id) ?? null)
        .filter((player): player is SeniorPlayer => Boolean(player));
      const playerPoolIds = playerPool.map((player) => player.id);
      if (playerPool.length < 11) {
        throw new Error(messages.submitOrdersMinPlayers);
      }
      const buildAssignmentsWithReusableAlgorithm = (
        orderedSlots: string[]
      ) => {
        const resolvedPass = assignPlayersWithReusableSlotAlgorithm(
          eligiblePoolPlayers,
          orderedSlots as Array<keyof LineupAssignments>,
          ratingsById,
          { collectTrace: true }
        );
        const slotRatingsForFormation: Record<string, number | null> = {};
        Object.entries(resolvedPass.assignments).forEach(([slot, playerId]) => {
          if (typeof playerId !== "number" || playerId <= 0) {
            slotRatingsForFormation[slot] = null;
            return;
          }
          const roleCode = SLOT_TO_RATING_CODE[slot];
          slotRatingsForFormation[slot] =
            typeof roleCode === "number" &&
            typeof ratingsById[playerId]?.[String(roleCode)] === "number"
              ? (ratingsById[playerId]?.[String(roleCode)] as number)
              : null;
        });
        return {
          assignments: resolvedPass.assignments,
          slotRatings: slotRatingsForFormation,
          usedPlayerIds: new Set<number>(
            Object.values(resolvedPass.assignments).filter(
              (playerId): playerId is number => typeof playerId === "number" && playerId > 0
            )
          ),
          slotDiagnostics: [] as FixedFormationSlotDiagnostic[],
          nonTraineeAssignmentTrace: resolvedPass.nonTraineeAssignmentTrace,
        };
      };
      const buildAssignmentsForOrderedSlots = (orderedSlots: string[]) => {
        const availablePlayers = [...playerPool];
        const assignmentsForFormation: LineupAssignments = {};
        const slotRatingsForFormation: Record<string, number | null> = {};
        const usedPlayerIds = new Set<number>();
        const slotDiagnostics: FixedFormationSlotDiagnostic[] = [];
        const nonTraineeAssignmentTrace: NonTraineeAssignmentTraceEntry[] = [];
        const ratingFor = (playerId: number, code: number) =>
          typeof ratingsById[playerId]?.[String(code)] === "number"
            ? (ratingsById[playerId]?.[String(code)] as number)
            : -1;
        const bestInSector = (playerId: number, sector: PlayerSector) =>
          Math.max(
            ...SECTOR_TO_RATING_CODES[sector].map((code) => ratingFor(playerId, code))
          );
        const evaluateSlotCandidates = (slot: string) => {
          const roleCode = SLOT_TO_RATING_CODE[slot];
          const slotSector = SLOT_TO_SECTOR[slot];
          const sortedBySlot = [...availablePlayers].sort((left, right) => {
            const leftRating = ratingFor(left.id, roleCode);
            const rightRating = ratingFor(right.id, roleCode);
            if (rightRating !== leftRating) {
              return rightRating - leftRating;
            }
            return left.name.localeCompare(right.name);
          });
          const noSlotRatingPlayerIds: number[] = [];
          const betterOtherSectorPlayerIds: number[] = [];
          const tiedOtherSectorPlayerIds: number[] = [];
          let strictCandidateId: number | null = null;
          let tiedCandidateId: number | null = null;
          let betterOtherCandidateId: number | null = null;
          sortedBySlot.forEach((candidate) => {
            const slotRating = ratingFor(candidate.id, roleCode);
            if (slotRating < 0) {
              noSlotRatingPlayerIds.push(candidate.id);
              return;
            }
            const bestOtherSector = (Object.keys(SECTOR_TO_RATING_CODES) as PlayerSector[])
              .filter((sector) => sector !== slotSector)
              .reduce(
                (best, sector) => Math.max(best, bestInSector(candidate.id, sector)),
                -1
              );
            if (bestOtherSector > slotRating) {
              betterOtherSectorPlayerIds.push(candidate.id);
              if (betterOtherCandidateId === null) {
                betterOtherCandidateId = candidate.id;
              }
              return;
            }
            if (bestOtherSector === slotRating) {
              tiedOtherSectorPlayerIds.push(candidate.id);
              if (tiedCandidateId === null) {
                tiedCandidateId = candidate.id;
              }
              return;
            }
            if (strictCandidateId === null) {
              strictCandidateId = candidate.id;
            }
          });
          const formFallbackCandidateId =
            [...availablePlayers]
              .sort((left, right) => {
                if (right.formValue !== left.formValue) {
                  return right.formValue - left.formValue;
                }
                return left.name.localeCompare(right.name);
              })[0]?.id ?? null;
          return {
            roleCode,
            noSlotRatingPlayerIds,
            betterOtherSectorPlayerIds,
            tiedOtherSectorPlayerIds,
            strictCandidateId,
            tiedCandidateId,
            betterOtherCandidateId,
            formFallbackCandidateId,
          };
        };
        const assignPlayerToSlot = (
          slot: string,
          roleCode: number,
          playerId: number | null,
          diagnostics: {
            noSlotRatingPlayerIds: number[];
            betterOtherSectorPlayerIds: number[];
            tiedOtherSectorPlayerIds: number[];
          },
          reason:
            | "slotRating"
            | "tiedOtherSectorFallback"
            | "betterOtherSectorFallback"
            | "formFallback"
        ) => {
          const ranking = [...availablePlayers]
            .sort((left, right) => {
              const leftRating = ratingFor(left.id, roleCode);
              const rightRating = ratingFor(right.id, roleCode);
              if (rightRating !== leftRating) {
                return rightRating - leftRating;
              }
              return left.name.localeCompare(right.name);
            })
            .map((candidate) => {
              const player = playersById.get(candidate.id);
              const slotKey = slot as keyof LineupAssignments;
              const slotRating =
                typeof ratingsById[candidate.id]?.[String(roleCode)] === "number"
                  ? (ratingsById[candidate.id]?.[String(roleCode)] as number)
                  : null;
              const bestOtherRowRating = assignmentRowForSlot(slotKey)
                ? bestOtherRowRatingForPlayer(candidate.id, slotKey, ratingsById)
                : null;
              return {
                playerId: candidate.id,
                slotRating,
                skillCombo: player ? skillComboValueForAssignmentSlot(player, slotKey) : 0,
                form: candidate.formValue,
                stamina: player ? staminaValueForPlayer(player) : -1,
                overall: player ? totalSkillLevelForPlayer(player) : 0,
                ageDays: player ? ageDaysValueForPlayer(player) : Number.MAX_SAFE_INTEGER,
                bestOtherRowRating,
                passesRowFit:
                  typeof slotRating === "number" &&
                  typeof bestOtherRowRating === "number"
                    ? bestOtherRowRating < slotRating
                    : false,
              } satisfies NonTraineeAssignmentRankingEntry;
            });
          const selectedIndex =
            playerId === null
              ? -1
              : availablePlayers.findIndex((candidate) => candidate.id === playerId);
          const selectedPlayer =
            selectedIndex >= 0
              ? (availablePlayers.splice(selectedIndex, 1)[0] ?? null)
              : null;
          slotDiagnostics.push({
            slot,
            assignedPlayerId: selectedPlayer?.id ?? null,
            noSlotRatingPlayerIds: diagnostics.noSlotRatingPlayerIds,
            betterOtherSectorPlayerIds: diagnostics.betterOtherSectorPlayerIds,
            tiedOtherSectorPlayerIds: diagnostics.tiedOtherSectorPlayerIds,
            alreadyUsedPlayerIds: Array.from(usedPlayerIds),
          });
          nonTraineeAssignmentTrace.push({
            slot: slot as keyof LineupAssignments,
            selectedPlayerId: selectedPlayer?.id ?? null,
            selectedReason: labelForNonTraineeReason(reason),
            ranking,
          });
          if (!selectedPlayer) return;
          assignmentsForFormation[slot] = selectedPlayer.id;
          slotRatingsForFormation[slot] =
            typeof ratingsById[selectedPlayer.id]?.[String(roleCode)] === "number"
              ? ratingsById[selectedPlayer.id]?.[String(roleCode)]
              : null;
          usedPlayerIds.add(selectedPlayer.id);
        };
        const unresolvedSlots: string[] = [];

        orderedSlots.forEach((slot) => {
          const evaluation = evaluateSlotCandidates(slot);
          if (evaluation.strictCandidateId === null) {
            unresolvedSlots.push(slot);
            return;
          }
          assignPlayerToSlot(
            slot,
            evaluation.roleCode,
            evaluation.strictCandidateId,
            evaluation,
            "slotRating"
          );
        });

        unresolvedSlots.forEach((slot) => {
          const evaluation = evaluateSlotCandidates(slot);
          const fallbackCandidateId =
            evaluation.tiedCandidateId ??
            evaluation.betterOtherCandidateId ??
            evaluation.formFallbackCandidateId;
          assignPlayerToSlot(
            slot,
            evaluation.roleCode,
            fallbackCandidateId,
            evaluation,
            evaluation.tiedCandidateId !== null
              ? "tiedOtherSectorFallback"
              : evaluation.betterOtherCandidateId !== null
                ? "betterOtherSectorFallback"
                : "formFallback"
          );
        });

        return {
          assignments: assignmentsForFormation,
          slotRatings: slotRatingsForFormation,
          usedPlayerIds,
          slotDiagnostics,
          nonTraineeAssignmentTrace,
        };
      };
      const buildBaseRowForShape = (shape: {
        defenders: number;
        midfielders: number;
        attackers: number;
      }) => {
        const formation = `${shape.defenders}-${shape.midfielders}-${shape.attackers}`;
        if (
          mode === "ignoreTraining" &&
          allowedIgnoreTrainingFormations &&
          !allowedIgnoreTrainingFormations.has(formation)
        ) {
          return null;
        }
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
        const useReusableAssignment =
          seniorLineupAlgorithm === "skills" ||
          mode === "ignoreTraining" ||
          mode === "fixedFormation";
        const resolvedPass =
          mode === "trainingAware"
            ? null
            : useReusableAssignment
              ? buildAssignmentsWithReusableAlgorithm(orderedSlots)
              : buildAssignmentsForOrderedSlots(orderedSlots);
        const trainingAwareAssignments =
          mode === "trainingAware"
            ? buildTrainingAwareAssignmentsForShape(
                occupiedSlots,
                activeTrainingType,
                options?.trainingAwareTraineeIds ?? [],
                selectedMatchType
              )
            : null;
        if (mode !== "trainingAware" && resolvedPass && occupiedSlots.some((slot) => !resolvedPass.assignments[slot])) {
          return {
            row: null,
            slotDiagnostics: resolvedPass.slotDiagnostics,
          };
        }
        if (mode === "trainingAware") {
          return {
            row: null,
            slotDiagnostics: [],
            trainingAwareAssignments,
          };
        }
        return {
          row: {
            formation,
            assignments: resolvedPass?.assignments ?? {},
            slotRatings: resolvedPass?.slotRatings ?? {},
            rejectedPlayerIds: [],
            nonTraineeAssignmentTrace: resolvedPass?.nonTraineeAssignmentTrace ?? [],
            predicted: null,
            error: null,
          } as GeneratedFormationRow,
          slotDiagnostics: resolvedPass?.slotDiagnostics ?? [],
          trainingAwareAssignments: null,
        };
      };
      const predictRatingsForLineup = async (
        assignmentsForFormation: LineupAssignments,
        nextTacticType: number
      ) => {
        const lineup = buildLineupPayload(assignmentsForFormation, nextTacticType);
        return predictSeniorRatingsForLineup({
          matchId,
          teamId: teamIdValue,
          sourceSystem: selectedMatchSourceSystem,
          lineup,
        });
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
              const result = buildBaseRowForShape(targetShape);
              if (!result || !result.row) {
                fixedFormationFailureSlotDiagnostics = result?.slotDiagnostics ?? [];
                fixedFormationFailureEligiblePlayerIds = playerPoolIds;
                throw new Error(messages.setBestLineupOptimizeByFormationUnavailable);
              }
              return [result.row];
            })()
          : generateFormationShapes()
              .map((shape) => buildBaseRowForShape(shape))
              .map((result) => result?.row ?? null)
              .filter((row): row is GeneratedFormationRow => Boolean(row));

      const trainingAwareBaseRows =
        mode === "trainingAware"
          ? await Promise.all(
              generateFormationShapes().map(
                async (shape): Promise<GeneratedFormationRow | null> => {
                const result = buildBaseRowForShape(shape);
                if (!result) return null;
                const resolvedAssignments = await result.trainingAwareAssignments;
                if (!resolvedAssignments) return null;
                return {
                  formation: `${shape.defenders}-${shape.midfielders}-${shape.attackers}`,
                  assignments: resolvedAssignments.assignments,
                  slotRatings: {},
                  rejectedPlayerIds: [],
                  nonTraineeAssignmentTrace: resolvedAssignments.nonTraineeAssignmentTrace,
                  predicted: null,
                  error: null,
                } satisfies GeneratedFormationRow;
                }
              )
            ).then((rows) => rows.filter((row): row is GeneratedFormationRow => Boolean(row)))
          : [];

      const rows =
        mode === "fixedFormation"
          ? baseRows
          : mode === "trainingAware"
            ? await mapWithConcurrency(
                trainingAwareBaseRows,
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
              )
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
      let selectedManMarkingMarker: SeniorAiManMarkingMarker | null = null;
      const selectManMarkingMarkerForAssignments = (
        chosenAssignments: LineupAssignments,
        target: OpponentTargetPlayer | null
      ) => {
        if (
          !seniorAiManMarkingSupported ||
          !effectiveSeniorAiManMarkingEnabled ||
          !target
        ) {
          return null;
        }
        const requiredRole: SeniorAiManMarkingRole =
          target.role === "F" ? "CD" : target.role === "IM" ? "IM" : "WB";
        let bestMarker: SeniorAiManMarkingMarker | null = null;
        const assignmentEntries = Object.entries(chosenAssignments) as Array<
          [keyof LineupAssignments, number | null | undefined]
        >;
        for (const [slot, playerId] of assignmentEntries) {
          if (typeof playerId !== "number" || playerId <= 0) continue;
          const role = manMarkingRoleForSlot(slot);
          if (role !== requiredRole) continue;
          const player = playersById.get(playerId);
          if (!player || specialtyValueForPlayer(player) !== 3) continue;
          const tsi = tsiValueForPlayer(player);
          const marker = {
            playerId,
            role,
            name: formatPlayerName(player) || String(playerId),
            tsi,
          } satisfies SeniorAiManMarkingMarker;
          if (
            !bestMarker ||
            marker.tsi > bestMarker.tsi ||
            (marker.tsi === bestMarker.tsi && marker.playerId < bestMarker.playerId)
          ) {
            bestMarker = marker;
          }
        }
        return bestMarker && bestMarker.tsi > target.tsi ? bestMarker : null;
      };

      const applyChosenAssignments = (
        chosenAssignmentsBase: LineupAssignments,
        chosenTactic: number,
        chosenNonTraineeAssignmentTrace: NonTraineeAssignmentTraceEntry[] = []
      ) => {
        const chosenAssignments: LineupAssignments = { ...chosenAssignmentsBase };
        const nonTraineeAssignmentTrace = [...chosenNonTraineeAssignmentTrace];
        const used = new Set<number>(
          Object.values(chosenAssignments).filter(
            (id): id is number => typeof id === "number" && id > 0
          )
        );
        const remainingEligiblePlayers = players.filter(
          (player) =>
            !used.has(player.PlayerID) &&
            isSeniorAiEligibleForMatch(player, selectedMatchType)
        );
        const remaining = remainingEligiblePlayers.map((player) => ({
          id: player.PlayerID,
          name: formatPlayerName(player) || String(player.PlayerID),
        }));
        const pickBestForCode = (slot: keyof LineupAssignments, code: number) => {
          if (remaining.length === 0) return null;
          const ranking = [...remaining]
            .sort((left, right) => {
              const leftValue =
                typeof ratingsById[left.id]?.[String(code)] === "number"
                  ? (ratingsById[left.id]?.[String(code)] as number)
                  : -1;
              const rightValue =
                typeof ratingsById[right.id]?.[String(code)] === "number"
                  ? (ratingsById[right.id]?.[String(code)] as number)
                  : -1;
              if (rightValue !== leftValue) return rightValue - leftValue;
              return left.name.localeCompare(right.name);
            })
            .map((candidate) => {
              const player = playersById.get(candidate.id);
              return {
                playerId: candidate.id,
                slotRating:
                  typeof ratingsById[candidate.id]?.[String(code)] === "number"
                    ? (ratingsById[candidate.id]?.[String(code)] as number)
                    : null,
                skillCombo: player ? totalSkillLevelForPlayer(player) : 0,
                form: player ? formValueForPlayer(player) : -1,
                stamina: player ? staminaValueForPlayer(player) : -1,
                overall: player ? totalSkillLevelForPlayer(player) : 0,
                ageDays: player ? ageDaysValueForPlayer(player) : Number.MAX_SAFE_INTEGER,
                bestOtherRowRating: null,
                passesRowFit: false,
              } satisfies NonTraineeAssignmentRankingEntry;
            });
          const selected = ranking[0] ?? null;
          if (!selected) return null;
          const selectedIndex = remaining.findIndex((candidate) => candidate.id === selected.playerId);
          const picked = selectedIndex >= 0 ? (remaining.splice(selectedIndex, 1)[0] ?? null) : null;
          nonTraineeAssignmentTrace.push({
            slot,
            selectedPlayerId: picked?.id ?? null,
            selectedReason: labelForNonTraineeReason(
              ranking.length > 1 && (ranking[0]?.slotRating ?? -1) === (ranking[1]?.slotRating ?? -1)
                ? "alphabetical"
                : "slotRating"
            ),
            ranking,
          });
          return picked;
        };
        const pickBestAny = (slot: keyof LineupAssignments) => {
          if (remaining.length === 0) return null;
          const ranking = [...remaining]
            .sort((left, right) => {
              const score = (id: number) =>
                [100, 101, 103, 106, 107, 111].reduce((sum, code) => {
                  const value = ratingsById[id]?.[String(code)];
                  return sum + (typeof value === "number" ? value : 0);
                }, 0);
              return score(right.id) - score(left.id) || left.name.localeCompare(right.name);
            })
            .map((candidate) => {
              const player = playersById.get(candidate.id);
              const aggregateScore = [100, 101, 103, 106, 107, 111].reduce((sum, code) => {
                const value = ratingsById[candidate.id]?.[String(code)];
                return sum + (typeof value === "number" ? value : 0);
              }, 0);
              return {
                playerId: candidate.id,
                slotRating: aggregateScore,
                skillCombo: player ? totalSkillLevelForPlayer(player) : 0,
                form: player ? formValueForPlayer(player) : -1,
                stamina: player ? staminaValueForPlayer(player) : -1,
                overall: player ? totalSkillLevelForPlayer(player) : 0,
                ageDays: player ? ageDaysValueForPlayer(player) : Number.MAX_SAFE_INTEGER,
                bestOtherRowRating: null,
                passesRowFit: false,
              } satisfies NonTraineeAssignmentRankingEntry;
            });
          const selected = ranking[0] ?? null;
          if (!selected) return null;
          const selectedIndex = remaining.findIndex((candidate) => candidate.id === selected.playerId);
          const picked = selectedIndex >= 0 ? (remaining.splice(selectedIndex, 1)[0] ?? null) : null;
          nonTraineeAssignmentTrace.push({
            slot,
            selectedPlayerId: picked?.id ?? null,
            selectedReason: labelForNonTraineeReason(
              ranking.length > 1 && (ranking[0]?.slotRating ?? -1) === (ranking[1]?.slotRating ?? -1)
                ? "alphabetical"
                : "aggregate"
            ),
            ranking,
          });
          return picked;
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
        if (
          seniorLineupAlgorithm === "skills" ||
          mode === "ignoreTraining" ||
          mode === "fixedFormation"
        ) {
          const emptyBenchSlots = benchPlan
            .map((entry) => entry.slot)
            .filter(
              (slot) =>
                typeof chosenAssignments[slot] !== "number" ||
                (chosenAssignments[slot] ?? 0) <= 0
            ) as Array<keyof LineupAssignments>;
          const benchAssigned = assignPlayersWithReusableSlotAlgorithm(
            remainingEligiblePlayers,
            emptyBenchSlots,
            ratingsById,
            { collectTrace: true }
          );
          Object.entries(benchAssigned.assignments).forEach(([slot, playerId]) => {
            chosenAssignments[slot] = playerId ?? null;
          });
          nonTraineeAssignmentTrace.push(...benchAssigned.nonTraineeAssignmentTrace);
        } else {
          benchPlan.forEach((entry) => {
            if (typeof chosenAssignments[entry.slot] === "number" && (chosenAssignments[entry.slot] ?? 0) > 0) {
              return;
            }
            const picked =
              entry.code === null
                ? pickBestAny(entry.slot as keyof LineupAssignments)
                : pickBestForCode(entry.slot as keyof LineupAssignments, entry.code);
            if (picked) {
              chosenAssignments[entry.slot] = picked.id;
            }
          });
        }

        setAssignments(chosenAssignments);
        markSeniorLineupMutated();
        selectedManMarkingMarker = selectManMarkingMarkerForAssignments(
          chosenAssignments,
          opponentContext.manMarkingTarget
        );
        setBehaviors({});
        setTacticType(chosenTactic);
        setLoadedMatchId(matchId);
        setSeniorRatingsMatchContext(buildSeniorRatingsMatchContext(matchId));
        setSeniorAiManMarkingTarget(opponentContext.manMarkingTarget);
        setSeniorAiManMarkingReadyContext({
          signature:
            buildSeniorAiManMarkingReadySignature({
              matchId,
              mode:
                mode === "trainingAware" || mode === "ignoreTraining" || mode === "fixedFormation"
                  ? mode
                  : null,
              tacticType: chosenTactic,
              assignments: chosenAssignments,
              behaviors: {},
            }) ?? "",
        });
        setExtraTimePreparedSubmission(null);
        lockSeniorAiSubmitToMatch(
          matchId,
          mode === "trainingAware" || mode === "ignoreTraining" || mode === "fixedFormation"
            ? mode
            : null
        );
        if (showSetBestLineupDebugModal) {
          setNonTraineeAssignmentModal({
            title: `${messages.setBestLineup} · ${opponentName}`,
            entries: nonTraineeAssignmentTrace,
          });
        }
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
            applyChosenAssignments(
              fixedRow.assignments,
              bestTacticRow.tacticType,
              fixedRow.nonTraineeAssignmentTrace
            );
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
          applyChosenAssignments(
            chosenItem.row.assignments,
            chosenTactic,
            chosenItem.row.nonTraineeAssignmentTrace
          );
        }
      }

      if (showSetBestLineupDebugModal) {
        setOpponentFormationsModal((prev) =>
          prev
            ? {
                ...prev,
                mode,
                opponentRows,
                potentialManMarkingTargets: opponentContext.potentialManMarkingTargets,
                manMarkingTarget: opponentContext.manMarkingTarget,
                manMarkingMarker: selectedManMarkingMarker,
                chosenFormation,
                chosenFormationAverages,
                generatedRows: rows,
                fixedFormation: fixedFormationOverride ?? null,
                fixedFormationTacticRows,
                selectedGeneratedFormation,
                selectedGeneratedTactic,
                selectedRejectedPlayerIds,
                selectedIneligiblePlayerIds: Array.from(extraTimeDisregardedPlayerIds),
                fixedFormationFailureEligiblePlayerIds: [],
                fixedFormationFailureSlotDiagnostics: [],
                selectedComparison,
                loading: false,
                error: null,
              }
            : null
        );
      }
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
      setSeniorAiManMarkingTarget(null);
      const details = error instanceof Error ? error.message : messages.unableToLoadMatches;
      if (showSetBestLineupDebugModal) {
        setOpponentFormationsModal((prev) =>
          prev
            ? {
                ...prev,
                mode,
                opponentRows: [],
                potentialManMarkingTargets: [],
                manMarkingTarget: null,
                manMarkingMarker: null,
                chosenFormation: null,
                chosenFormationAverages: null,
                generatedRows: [],
                fixedFormation: fixedFormationOverride ?? null,
                fixedFormationTacticRows: [],
                selectedGeneratedFormation: null,
                selectedGeneratedTactic: null,
                selectedRejectedPlayerIds: [],
                selectedIneligiblePlayerIds: [],
                fixedFormationFailureEligiblePlayerIds,
                fixedFormationFailureSlotDiagnostics,
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
      opponentScoutTeamRequestIdRef.current += 1;
      setOpponentAnalysisActiveTab("matches");
      setOpponentScoutTeamState({
        status: "idle",
        teamId: null,
        data: null,
        error: null,
      });
      setOpponentScoutTeamSortState({ key: "playerNumber", direction: "asc" });
      setShowOpponentScoutEffectiveMainSkillEstimation(false);
      const opponentContext = await fetchOpponentFormationRowsForMatch(matchId);
      if (!opponentContext) return;
      const { opponentTeamId, opponentName } = opponentContext;
      const stillInCup = await fetchOpponentCupStatus(opponentTeamId);
      const cupSuffix =
        typeof stillInCup === "boolean"
          ? ` (${stillInCup ? messages.analyzeOpponentStillInCup : messages.analyzeOpponentNotInCup})`
          : "";
      setOpponentAnalysisModal({
        title: `${messages.analyzeOpponent} · ${opponentName}${cupSuffix}`,
        opponentTeamId,
        opponentName,
        opponentRows: [],
        preferredFormation: null,
        preferredTactic: null,
        versusFormation: null,
        versusTactic: null,
        formationDistribution: [],
        tacticDistribution: [],
        manMarkingTarget: opponentContext.manMarkingTarget,
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
              manMarkingTarget: opponentContext.manMarkingTarget,
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

  const loadOpponentScoutTeam = useCallback(
    async (force = false) => {
      const currentModal = opponentAnalysisModal;
      if (!currentModal || currentModal.loading || currentModal.error) return;
      const teamId = currentModal.opponentTeamId;
      if (
        !force &&
        opponentScoutTeamState.status === "success" &&
        opponentScoutTeamState.teamId === teamId
      ) {
        return;
      }
      if (
        !force &&
        opponentScoutTeamState.status === "loading" &&
        opponentScoutTeamState.teamId === teamId
      ) {
        return;
      }
      const requestId = opponentScoutTeamRequestIdRef.current + 1;
      opponentScoutTeamRequestIdRef.current = requestId;
      setOpponentScoutTeamState({
        status: "loading",
        teamId,
        data: null,
        error: null,
      });
      try {
        const { response, payload } = await fetchChppJson<{
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
          details?: string;
        }>(`/api/chpp/players?orderBy=PlayerNumber&teamId=${teamId}`, {
          cache: "no-store",
        });
        if (!response.ok || payload?.error) {
          throw new Error(
            payload?.details ??
              payload?.error ??
              messages.seniorOpponentScoutTeamError
          );
        }
        const raw = payload?.data?.HattrickData?.Team?.PlayerList?.Player;
        const rawPlayers = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const playerIds = rawPlayers
          .map((player) =>
            player && typeof player === "object"
              ? parseNumber((player as Record<string, unknown>).PlayerID)
              : null
          )
          .filter((playerId): playerId is number => Boolean(playerId && playerId > 0));
        const playerDetailsEntries = await mapWithConcurrency(
          playerIds,
          4,
          async (playerId) => ({
            playerId,
            details: await fetchPlayerDetailsById(playerId, {
              captureEncounter: false,
            }),
          })
        );
        const detailsByPlayerId = new Map(
          playerDetailsEntries.map((entry) => [entry.playerId, entry.details])
        );
        const likelyTraining = opponentScoutLikelyTrainingLabel(
          currentModal.opponentRows
        );
        const basePlayers = rawPlayers
          .map((player): TeamScoutBasePlayer | null => {
            if (!player || typeof player !== "object") return null;
            const playerNode = player as Record<string, unknown>;
            const playerId = parseNumber(playerNode.PlayerID);
            if (!playerId || playerId <= 0) return null;
            const details = detailsByPlayerId.get(playerId) ?? null;
            const skills =
              playerNode.PlayerSkills && typeof playerNode.PlayerSkills === "object"
                ? (playerNode.PlayerSkills as Record<string, unknown>)
                : null;
            const originInfo =
              typeof details?.NativeLeagueID === "number"
                ? leagueOriginsById[details.NativeLeagueID] ?? null
                : null;
            const wageIncludesForeignBonus =
              resolveSeniorIsAbroad(details) ??
              (typeof details?.NativeLeagueID === "number" &&
              typeof details?.OwningTeam?.LeagueID === "number"
                ? details.NativeLeagueID !== details.OwningTeam.LeagueID
                : null);
            const playerName =
              formatPlayerName({
                FirstName:
                  details?.FirstName ??
                  (typeof playerNode.FirstName === "string" ? playerNode.FirstName : ""),
                NickName:
                  details?.NickName ??
                  (typeof playerNode.NickName === "string" && playerNode.NickName
                    ? playerNode.NickName
                    : undefined),
                LastName:
                  details?.LastName ??
                  (typeof playerNode.LastName === "string" ? playerNode.LastName : ""),
              }) || String(playerId);
            return {
              playerId,
              playerName,
              originFlagDisplay: originInfo?.flagDisplay ?? null,
              playerNumber: parseNumber(playerNode.PlayerNumber),
              age: details?.Age ?? parseNumber(playerNode.Age),
              ageDays: details?.AgeDays ?? parseNumber(playerNode.AgeDays),
              injuryLevel: details?.InjuryLevel ?? parseNumber(playerNode.InjuryLevel),
              specialty: details?.Specialty ?? parseNumber(playerNode.Specialty),
              cards:
                parseNumber(playerNode.Cards) ??
                parseNumber(playerNode.Bookings) ??
                parseNumber(playerNode.YellowCard),
              form:
                details?.Form ?? parseNumber(playerNode.PlayerForm ?? playerNode.Form),
              stamina: parseNumber(
                details?.StaminaSkill ?? playerNode.StaminaSkill ?? skills?.StaminaSkill
              ),
              experience: details?.Experience ?? parseNumber(playerNode.Experience),
              leadership: details?.Leadership ?? parseNumber(playerNode.Leadership),
              loyalty: details?.Loyalty ?? parseNumber(playerNode.Loyalty),
              motherClubBonus: details?.MotherClubBonus ?? null,
              tsi: details?.TSI ?? parseNumber(playerNode.TSI),
              salarySek: details?.Salary ?? parseNumber(playerNode.Salary),
              wageIncludesForeignBonus,
            } satisfies TeamScoutBasePlayer;
          })
          .filter((row): row is TeamScoutBasePlayer => Boolean(row))
          .sort((left, right) => (right.tsi ?? 0) - (left.tsi ?? 0));
        const derivedData = await loadTeamScoutDerivedData({
          teamId,
          players: basePlayers.map((player) => ({
            playerId: player.playerId,
            playerName: player.playerName,
            form: player.form,
          })),
          messages,
        });
        const rows = buildTeamScoutPlayerRows({
          teamId,
          players: basePlayers,
          derivedData,
          likelyTrainingKey: likelyTraining?.likelyTrainingKey,
        });
        if (opponentScoutTeamRequestIdRef.current !== requestId) return;
        setOpponentScoutTeamState({
          status: "success",
          teamId,
          data: {
            teamId,
            teamName: currentModal.opponentName,
            rows,
            likelyTraining,
            matchCount: derivedData.matchSampleSize,
          },
          error: null,
        });
      } catch (error) {
        if (error instanceof ChppAuthRequiredError) return;
        if (opponentScoutTeamRequestIdRef.current !== requestId) return;
        setOpponentScoutTeamState({
          status: "error",
          teamId,
          data: null,
          error:
            error instanceof Error
              ? error.message
              : messages.seniorOpponentScoutTeamError,
        });
      }
    },
    [
      fetchPlayerDetailsById,
      leagueOriginsById,
      messages,
      messages.seniorOpponentScoutTeamError,
      opponentAnalysisModal,
      opponentScoutLikelyTrainingLabel,
      opponentScoutTeamState,
    ]
  );

  const closeOpponentAnalysisModal = useCallback(() => {
    opponentScoutTeamRequestIdRef.current += 1;
    setOpponentAnalysisModal(null);
    setOpponentAnalysisActiveTab("matches");
    setOpponentScoutTeamState({
      status: "idle",
      teamId: null,
      data: null,
      error: null,
    });
    setOpponentScoutTeamSortState({ key: "playerNumber", direction: "asc" });
    setShowOpponentScoutEffectiveMainSkillEstimation(false);
  }, []);

  const handleOpponentScoutTeamSort = useCallback(
    (key: TeamScoutDetailSortState["key"]) => {
      if (!key) return;
      setOpponentScoutTeamSortState((current) =>
        current.key === key
          ? {
              key,
              direction: current.direction === "asc" ? "desc" : "asc",
            }
          : { key, direction: "asc" }
      );
    },
    []
  );

  useEffect(() => {
    if (opponentAnalysisActiveTab !== "scoutTeam") return;
    if (
      !opponentAnalysisModal ||
      opponentAnalysisModal.loading ||
      opponentAnalysisModal.error
    ) {
      return;
    }
    if (
      opponentScoutTeamState.status === "success" &&
      opponentScoutTeamState.teamId === opponentAnalysisModal.opponentTeamId
    ) {
      return;
    }
    if (
      opponentScoutTeamState.status === "loading" &&
      opponentScoutTeamState.teamId === opponentAnalysisModal.opponentTeamId
    ) {
      return;
    }
    void loadOpponentScoutTeam();
  }, [
    loadOpponentScoutTeam,
    opponentAnalysisActiveTab,
    opponentAnalysisModal,
    opponentScoutTeamState.status,
    opponentScoutTeamState.teamId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    seniorTeamHydratingRef.current = true;
    seniorTeamHydrationKeyRef.current = dataStorageKey;
    if (seniorTeamHydrationReleaseTimeoutRef.current !== null) {
      window.clearTimeout(seniorTeamHydrationReleaseTimeoutRef.current);
      seniorTeamHydrationReleaseTimeoutRef.current = null;
    }
    otherOrdersFlashArmedRef.current = false;
    previousStartingXiCompleteRef.current = false;
    previousOtherOrdersLineupSignatureRef.current = null;
    setOtherOrdersFlashActive(false);
    if (otherOrdersFlashTimeoutRef.current !== null) {
      window.clearTimeout(otherOrdersFlashTimeoutRef.current);
      otherOrdersFlashTimeoutRef.current = null;
    }
    restoredStateStorageKeyRef.current = null;
    restoredDataStorageKeyRef.current = null;
    setStateRestored(false);
    setDataRestored(false);
    setSelectedId(null);
    setAssignments({});
    setBehaviors({});
    setLoadedMatchId(null);
    setSeniorAiSubmitLockActive(false);
    setSeniorAiSubmitEnabledMatchId(null);
    setSeniorAiPreparedSubmissionMode(null);
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
    setSeniorAiLastMatchWeeksThreshold(SENIOR_AI_LAST_MATCH_WEEKS_DEFAULT);
    setSeniorAiManMarkingFuzziness(SENIOR_AI_MAN_MARKING_FUZZINESS_DEFAULT);
    setSeniorAiManMarkingEnabled(false);
    setSeniorAiManMarkingTarget(null);
    setExtraTimeBTeamRecentMatchState({
      status: "idle",
      recentMatch: null,
      availabilityReason: null,
      availabilityMatch: null,
      playerMinutesById: {},
    });
    setExtraTimeSelectedPlayerIds([]);
    setExtraTimeMatrixTrainingType(null);
    setExtraTimeMatrixTrainingTypeManual(false);
    setTrainingAwareSelectedPlayerIds([]);
    setTrainingAwarePreparedTraineeIds([]);
    setTrainingAwareMatrixTrainingType(null);
    setTrainingAwareMatrixTrainingTypeManual(false);
    setOrderedPlayerIds(null);
    setOrderSource(null);
    setTransferSearchModalOpen(false);
    setTransferSearchSourcePlayerId(null);
    setTransferSearchFilters(null);
    setTransferSearchResults([]);
    setTransferSearchItemCount(null);
    setTransferSearchLoading(false);
    setTransferSearchError(null);
    setTransferSearchUsedFallback(false);
    setTransferSearchExactEmpty(false);
    setTransferSearchBidDrafts({});
    setTransferSearchBidPendingPlayerId(null);
    setPlayers([]);
    setMatchesState({});
    setLatestFetchedRatingsResponse(null);
    setSeniorTeamGeneralInfo(null);
    setRatingsResponse(null);
    setRatingsManualOverrideEnabled(false);
    setRatingsOverwriteManualEditsEnabled(false);
    setRatingsManualEditsByPlayerId({});
    setDetailsCache({});
    setLoadError(null);
    setLoadErrorDetails(null);
    setLastRefreshAt(null);
    persistedMarkersBaselineRef.current = null;
    opponentFormationContextCacheRef.current = new Map();
    opponentTargetPlayerCacheRef.current = new Map();
    try {
      const rawSort = window.localStorage.getItem(listSortStorageKey);
      if (rawSort) {
        try {
          const parsed = JSON.parse(rawSort) as {
            sortKey?: SortKey;
            sortDirection?: SortDirection;
          };
          if (parsed.sortKey) {
            setSortKey(parsed.sortKey);
            if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") {
              setSortDirection(parsed.sortDirection);
            } else {
              setSortDirection(defaultSortDirectionForKey(parsed.sortKey));
            }
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
            seniorAiSubmitLockActive?: boolean;
            seniorAiSubmitEnabledMatchId?: number | null;
            seniorAiPreparedSubmissionMode?: Exclude<SetBestLineupMode, "extraTime"> | null;
            seniorAiManMarkingReadyContext?: SeniorAiManMarkingReadyContext | null;
            tacticType?: number;
            trainingType?: number | null;
            setBestLineupFixedFormation?: string | null;
            ignoreTrainingFormationPolicy?: IgnoreTrainingFormationPolicy;
            includeTournamentMatches?: boolean;
            updatesHistory?: SeniorUpdatesGroupedEntry[];
            matrixNewMarkers?: SeniorMatrixNewMarkers;
            selectedUpdatesId?: string | null;
            activeDetailsTab?: PlayerDetailsPanelTab;
            mobileSeniorView?: SeniorMobileView;
            mobileSeniorPlayerScreen?: MobileSeniorPlayerScreen;
            mobileSeniorMenuPosition?: { x?: number; y?: number } | null;
            showSeniorSkillBonusInMatrix?: boolean;
            extraTimeBTeamEnabled?: boolean;
            extraTimeBTeamMinutesThreshold?: number;
            seniorAiLastMatchWeeksThreshold?: number;
            seniorAiManMarkingFuzziness?: number;
            seniorAiManMarkingEnabled?: boolean;
            seniorAiManMarkingTarget?: OpponentTargetPlayer | null;
            extraTimeSelectedPlayerIds?: number[];
            extraTimeMatrixTrainingType?: number | null;
            extraTimeMatrixTrainingTypeManual?: boolean;
            trainingAwareSelectedPlayerIds?: number[];
            trainingAwarePreparedTraineeIds?: number[];
            trainingAwareMatrixTrainingType?: number | null;
            trainingAwareMatrixTrainingTypeManual?: boolean;
            orderedPlayerIds?: number[] | null;
            orderSource?: "list" | "ratings" | "skills" | null;
            ratingsManualOverrideEnabled?: boolean;
            ratingsOverwriteManualEditsEnabled?: boolean;
            ratingsManualEditsByPlayerId?: SeniorManualRatingsEdits;
            transferSearchModalOpen?: boolean;
            transferSearchSourcePlayerId?: number | null;
            transferSearchFilters?: TransferSearchFilters | null;
            transferSearchResults?: TransferSearchResult[];
            transferSearchItemCount?: number | null;
            transferSearchSortKey?: TransferSearchSortKey;
            transferSearchResultsViewMode?: TransferSearchResultsViewMode;
            transferSearchUsedFallback?: boolean;
            transferSearchExactEmpty?: boolean;
            transferSearchBidDrafts?: Record<number, TransferSearchBidDraft>;
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
          setSeniorAiSubmitLockActive(Boolean(parsed.seniorAiSubmitLockActive));
          setSeniorAiSubmitEnabledMatchId(
            typeof parsed.seniorAiSubmitEnabledMatchId === "number"
              ? parsed.seniorAiSubmitEnabledMatchId
              : null
          );
          setSeniorAiPreparedSubmissionMode(
            parsed.seniorAiPreparedSubmissionMode === "trainingAware" ||
              parsed.seniorAiPreparedSubmissionMode === "ignoreTraining" ||
              parsed.seniorAiPreparedSubmissionMode === "fixedFormation"
              ? parsed.seniorAiPreparedSubmissionMode
              : null
          );
          setSeniorAiManMarkingReadyContext(
            parsed.seniorAiManMarkingReadyContext &&
              typeof parsed.seniorAiManMarkingReadyContext === "object" &&
              typeof parsed.seniorAiManMarkingReadyContext.signature === "string"
              ? { signature: parsed.seniorAiManMarkingReadyContext.signature }
              : null
          );
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
          setIgnoreTrainingFormationPolicy(
            parsed.ignoreTrainingFormationPolicy === "trainedFormations"
              ? "trainedFormations"
              : "allFormations"
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
          if (
            parsed.mobileSeniorView === "playerDetails" ||
            parsed.mobileSeniorView === "skillsMatrix" ||
            parsed.mobileSeniorView === "ratingsMatrix" ||
            parsed.mobileSeniorView === "lineupOptimizer" ||
            parsed.mobileSeniorView === "help"
          ) {
            setMobileSeniorView(parsed.mobileSeniorView);
          }
          if (
            parsed.mobileSeniorPlayerScreen === "root" ||
            parsed.mobileSeniorPlayerScreen === "list" ||
            parsed.mobileSeniorPlayerScreen === "detail"
          ) {
            setMobileSeniorPlayerScreen(parsed.mobileSeniorPlayerScreen);
          }
          if (parsed.mobileSeniorMenuPosition) {
            const nextX = Number(parsed.mobileSeniorMenuPosition.x);
            const nextY = Number(parsed.mobileSeniorMenuPosition.y);
            if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
              setMobileSeniorMenuPosition({ x: nextX, y: nextY });
            }
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
          if (
            typeof parsed.seniorAiLastMatchWeeksThreshold === "number" &&
            Number.isFinite(parsed.seniorAiLastMatchWeeksThreshold)
          ) {
            const roundedLastMatchThreshold = Math.round(
              parsed.seniorAiLastMatchWeeksThreshold
            );
            setSeniorAiLastMatchWeeksThreshold(
              roundedLastMatchThreshold === SENIOR_AI_LAST_MATCH_WEEKS_DISABLED
                ? SENIOR_AI_LAST_MATCH_WEEKS_DISABLED
                : Math.min(
                    SENIOR_AI_LAST_MATCH_WEEKS_MAX,
                    Math.max(
                      SENIOR_AI_LAST_MATCH_WEEKS_MIN,
                      roundedLastMatchThreshold
                    )
                )
            );
          }
          if (
            typeof parsed.seniorAiManMarkingFuzziness === "number" &&
            Number.isFinite(parsed.seniorAiManMarkingFuzziness)
          ) {
            setSeniorAiManMarkingFuzziness(
              Math.min(
                SENIOR_AI_MAN_MARKING_FUZZINESS_MAX,
                Math.max(
                  SENIOR_AI_MAN_MARKING_FUZZINESS_MIN,
                  Math.round(parsed.seniorAiManMarkingFuzziness)
                )
              )
            );
          }
          if (typeof parsed.seniorAiManMarkingEnabled === "boolean") {
            setSeniorAiManMarkingEnabled(parsed.seniorAiManMarkingEnabled);
          }
          if (
            parsed.seniorAiManMarkingTarget &&
            typeof parsed.seniorAiManMarkingTarget === "object"
          ) {
            const target = parsed.seniorAiManMarkingTarget as OpponentTargetPlayer;
            if (
              typeof target.playerId === "number" &&
              typeof target.name === "string" &&
              typeof target.tsi === "number" &&
              typeof target.stamina === "number" &&
              typeof target.ageDays === "number" &&
              (target.role === "W" || target.role === "IM" || target.role === "F")
            ) {
              setSeniorAiManMarkingTarget(target);
            }
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
          if (Array.isArray(parsed.trainingAwareSelectedPlayerIds)) {
            setTrainingAwareSelectedPlayerIds(
              parsed.trainingAwareSelectedPlayerIds.filter(
                (id): id is number => Number.isFinite(id)
              )
            );
          }
          if (Array.isArray(parsed.trainingAwarePreparedTraineeIds)) {
            setTrainingAwarePreparedTraineeIds(
              parsed.trainingAwarePreparedTraineeIds.filter(
                (id): id is number => Number.isFinite(id)
              )
            );
          }
          const parsedTrainingAwareTrainingType = sanitizeTrainingType(
            typeof parsed.trainingAwareMatrixTrainingType === "number"
              ? parsed.trainingAwareMatrixTrainingType
              : null
          );
          const parsedTrainingAwareManual =
            typeof parsed.trainingAwareMatrixTrainingTypeManual === "boolean"
              ? parsed.trainingAwareMatrixTrainingTypeManual
              : parsedTrainingAwareTrainingType !== null &&
                parsedTrainingAwareTrainingType !== parsedTrainingType;
          setTrainingAwareMatrixTrainingType(parsedTrainingAwareTrainingType);
          setTrainingAwareMatrixTrainingTypeManual(parsedTrainingAwareManual);
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
          const parsedRatingsManualOverrideEnabled = Boolean(
            parsed.ratingsManualOverrideEnabled
          );
          setRatingsManualOverrideEnabled(parsedRatingsManualOverrideEnabled);
          setRatingsOverwriteManualEditsEnabled(
            parsedRatingsManualOverrideEnabled && Boolean(parsed.ratingsOverwriteManualEditsEnabled)
          );
          setRatingsManualEditsByPlayerId(
            normalizeSeniorManualRatingsEdits(parsed.ratingsManualEditsByPlayerId)
          );
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
              : parsed.transferSearchItemCount === null
              ? null
              : null
          );
          setTransferSearchSortKey(
            parsed.transferSearchSortKey === "htmsPotential" ||
              parsed.transferSearchSortKey === "psicoTsiAvg" ||
              parsed.transferSearchSortKey === "psicoWageAvg" ||
              parsed.transferSearchSortKey === "keeper" ||
              parsed.transferSearchSortKey === "defending" ||
              parsed.transferSearchSortKey === "playmaking" ||
              parsed.transferSearchSortKey === "winger" ||
              parsed.transferSearchSortKey === "passing" ||
              parsed.transferSearchSortKey === "scoring" ||
              parsed.transferSearchSortKey === "setPieces" ||
              parsed.transferSearchSortKey === "default"
              ? parsed.transferSearchSortKey
              : "default"
          );
          setTransferSearchResultsViewMode("cards");
          setTransferSearchUsedFallback(Boolean(parsed.transferSearchUsedFallback));
          setTransferSearchExactEmpty(Boolean(parsed.transferSearchExactEmpty));
          setTransferSearchBidDrafts(
            normalizeTransferSearchBidDrafts(parsed.transferSearchBidDrafts)
          );
        } catch {
          // ignore parse errors
        }
      }

      const rawData = window.localStorage.getItem(dataStorageKey);
      let restoredPlayersCount = 0;
      let restoredRatings: RatingsMatrixResponse | null = null;
      if (rawData) {
        try {
          const parsed = JSON.parse(rawData) as {
            players?: unknown;
            matchesState?: MatchesResponse;
            fetchedRatingsResponse?: RatingsMatrixResponse | null;
            ratingsResponse?: RatingsMatrixResponse | null;
            latestFetchedRatingsResponse?: RatingsMatrixResponse | null;
            detailsCache?: Record<number, PlayerDetailCacheEntry>;
            seniorTeamGeneralInfo?: unknown;
          };
          const restoredPlayers = normalizeSeniorPlayers(parsed.players);
          restoredPlayersCount = restoredPlayers.length;
          if (restoredPlayers.length > 0) {
            setPlayers(restoredPlayers);
          }
          if (parsed.matchesState && typeof parsed.matchesState === "object") {
            setMatchesState(parsed.matchesState);
          }
          const parsedLatestFetchedRatings =
            parsed.fetchedRatingsResponse &&
            typeof parsed.fetchedRatingsResponse === "object" &&
            hasCurrentSeniorRatingsAlgorithmVersion(parsed.fetchedRatingsResponse)
              ? parsed.fetchedRatingsResponse
              : parsed.latestFetchedRatingsResponse &&
                  typeof parsed.latestFetchedRatingsResponse === "object" &&
                  hasCurrentSeniorRatingsAlgorithmVersion(parsed.latestFetchedRatingsResponse)
                ? parsed.latestFetchedRatingsResponse
                : parsed.ratingsResponse &&
                    typeof parsed.ratingsResponse === "object" &&
                    hasCurrentSeniorRatingsAlgorithmVersion(parsed.ratingsResponse)
                  ? parsed.ratingsResponse
                  : null;
          restoredRatings = parsedLatestFetchedRatings;
          if (parsedLatestFetchedRatings) {
            setLatestFetchedRatingsResponse(parsedLatestFetchedRatings);
          }
          if (parsed.detailsCache && typeof parsed.detailsCache === "object") {
            setDetailsCache(parsed.detailsCache);
          }
          setSeniorTeamGeneralInfo(
            isSeniorTeamGeneralInfo(parsed.seniorTeamGeneralInfo, activeSeniorTeamId)
              ? parsed.seniorTeamGeneralInfo
              : null
          );
          const persistedRatingsByPlayerId = buildRatingsByPlayerIdFromResponse(
            parsedLatestFetchedRatings
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
      const restoredRatingsUsable = seniorRatingsHasCells(restoredRatings);
      const shouldRefresh =
        !restoredRatingsUsable ||
        !lastRefresh ||
        Date.now() - lastRefresh >= readSeniorStalenessDays() * 24 * 60 * 60 * 1000;
      const shouldBootstrap = restoredPlayersCount === 0 || !restoredRatingsUsable;
      if (shouldBootstrap) {
        suppressNextUpdatesRecordingRef.current = true;
      }
      if (shouldRefresh || shouldBootstrap) {
        void refreshAll(shouldRefresh && lastRefresh ? "stale" : "manual", {
          startup: true,
        });
      }
    } finally {
      restoredStateStorageKeyRef.current = stateStorageKey;
      restoredDataStorageKeyRef.current = dataStorageKey;
      setStateRestored(true);
      setDataRestored(true);
    }
  }, [
    activeSeniorTeamId,
    dataStorageKey,
    lastRefreshStorageKey,
    listSortStorageKey,
    stateStorageKey,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!seniorTeamHydratingRef.current) return;
    if (seniorTeamHydrationKeyRef.current !== dataStorageKey) return;
    if (!dataRestored || !stateRestored) return;

    if (seniorTeamHydrationReleaseTimeoutRef.current !== null) {
      window.clearTimeout(seniorTeamHydrationReleaseTimeoutRef.current);
    }

    seniorTeamHydrationReleaseTimeoutRef.current = window.setTimeout(() => {
      seniorTeamHydratingRef.current = false;
      seniorTeamHydrationKeyRef.current = null;
      seniorTeamHydrationReleaseTimeoutRef.current = null;
      seedOtherOrdersFlashBaseline();
    }, 0);

    return () => {
      if (seniorTeamHydrationReleaseTimeoutRef.current !== null) {
        window.clearTimeout(seniorTeamHydrationReleaseTimeoutRef.current);
        seniorTeamHydrationReleaseTimeoutRef.current = null;
      }
    };
  }, [
    dataStorageKey,
    dataRestored,
    seedOtherOrdersFlashBaseline,
    stateRestored,
    players,
    matchesState,
    ratingsResponse,
    latestFetchedRatingsResponse,
    seniorTeamGeneralInfo,
    detailsCache,
  ]);

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
      setLatestFetchedRatingsResponse(null);
      setRatingsResponse(null);
      setRatingsManualEditsByPlayerId({});
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
  }, [
    activeSeniorTeamId,
    dataStorageKey,
    lastRefreshStorageKey,
    latestFetchedRatingsResponse,
    players,
    ratingsManualEditsByPlayerId,
    ratingsResponse,
    stateStorageKey,
  ]);

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
    const payload = buildSeniorStatePersistPayload();
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
    seniorAiSubmitLockActive,
    seniorAiSubmitEnabledMatchId,
    seniorAiPreparedSubmissionMode,
    seniorAiManMarkingReadyContext,
    selectedId,
    selectedUpdatesId,
    tacticType,
    trainingType,
    setBestLineupFixedFormation,
    ignoreTrainingFormationPolicy,
    ratingsManualOverrideEnabled,
    ratingsOverwriteManualEditsEnabled,
    ratingsManualEditsByPlayerId,
    updatesHistory,
    matrixNewMarkers,
    activeDetailsTab,
    mobileSeniorView,
    mobileSeniorPlayerScreen,
    mobileSeniorMenuPosition,
    showSeniorSkillBonusInMatrix,
    extraTimeBTeamEnabled,
    extraTimeBTeamMinutesThreshold,
    seniorAiLastMatchWeeksThreshold,
    seniorAiManMarkingFuzziness,
    seniorAiManMarkingEnabled,
    seniorAiManMarkingTarget,
    extraTimeSelectedPlayerIds,
    extraTimeMatrixTrainingType,
    extraTimeMatrixTrainingTypeManual,
    trainingAwareSelectedPlayerIds,
    trainingAwarePreparedTraineeIds,
    trainingAwareMatrixTrainingType,
    trainingAwareMatrixTrainingTypeManual,
    orderedPlayerIds,
    orderSource,
    transferSearchModalOpen,
    transferSearchSourcePlayerId,
    transferSearchFilters,
    transferSearchResults,
    transferSearchItemCount,
    transferSearchSortKey,
    transferSearchResultsViewMode,
    transferSearchUsedFallback,
    transferSearchExactEmpty,
    transferSearchBidDrafts,
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
    if (seniorTeamHydratingRef.current) return;
    if (seniorTeamHydrationKeyRef.current === dataStorageKey) return;
    const payload = buildSeniorDataPersistencePayload();
    persistSeniorDataSnapshot("data-persistence-effect", {
      payloadOverride: payload,
    });
  }, [
    dataRestored,
    dataStorageKey,
    detailsCache,
    latestFetchedRatingsResponse,
    seniorTeamGeneralInfo,
    matchesState,
    players,
    ratingsResponse,
    persistSeniorDataSnapshot,
    buildSeniorDataPersistencePayload,
  ]);

  useEffect(() => {
    if (!selectedId) return;
    void ensureDetails(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!mobileSeniorActive) {
      previousRefreshingRef.current = refreshing;
      previousLastRefreshAtRef.current = lastRefreshAt;
      setMobileSeniorRefreshFeedbackVisible(false);
      return;
    }

    let timeoutId: number | null = null;
    const refreshJustCompleted =
      previousRefreshingRef.current &&
      !refreshing &&
      lastRefreshAt !== null &&
      lastRefreshAt !== previousLastRefreshAtRef.current;

    if (refreshing || refreshStatus) {
      setMobileSeniorRefreshFeedbackVisible(true);
    } else if (refreshJustCompleted) {
      setMobileSeniorRefreshFeedbackVisible(true);
      timeoutId = window.setTimeout(() => {
        setMobileSeniorRefreshFeedbackVisible(false);
      }, 5000);
    }

    previousRefreshingRef.current = refreshing;
    previousLastRefreshAtRef.current = lastRefreshAt;

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [lastRefreshAt, mobileSeniorActive, refreshStatus, refreshing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileSeniorActive) return;
    const segments =
      mobileSeniorView === "playerDetails"
        ? mobileSeniorPlayerScreen === "detail"
          ? [
              { id: "player-list", label: messages.seniorPlayerListTitle },
              { id: "player-details", label: messages.detailsTabLabel },
            ]
          : mobileSeniorPlayerScreen === "list"
            ? [{ id: "player-list", label: messages.seniorPlayerListTitle }]
            : []
        : mobileSeniorView === "skillsMatrix"
          ? [{ id: "skills-matrix", label: messages.skillsMatrixTabLabel }]
        : mobileSeniorView === "ratingsMatrix"
            ? [{ id: "ratings-matrix", label: messages.ratingsMatrixTabLabel }]
            : mobileSeniorView === "lineupOptimizer"
              ? [{ id: "lineup-optimizer", label: messages.lineupTitle }]
              : mobileSeniorView === "help"
                ? [{ id: "help", label: messages.mobileHelpLabel }]
              : [];
    window.dispatchEvent(
      new CustomEvent(MOBILE_NAV_TRAIL_STATE_EVENT, {
        detail: {
          tool: "senior",
          segments,
        },
      })
    );
  }, [
    messages.detailsTabLabel,
    messages.lineupTitle,
    messages.mobileHelpLabel,
    messages.ratingsMatrixTabLabel,
    messages.seniorPlayerListTitle,
    messages.skillsMatrixTabLabel,
    mobileSeniorActive,
    mobileSeniorPlayerScreen,
    mobileSeniorView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { tool?: string; target?: string } | undefined;
      if (!detail || detail.tool !== "senior") return;
      switch (detail.target) {
        case "tool-root":
          pushMobileSeniorState("playerDetails", "root");
          return;
        case "player-list":
          pushMobileSeniorState("playerDetails", "list");
          return;
        case "player-details":
          pushMobileSeniorState("playerDetails", selectedPlayer ? "detail" : "list");
          return;
        case "help":
          pushMobileSeniorState("help", "root");
          return;
        case "skills-matrix":
          pushMobileSeniorState("skillsMatrix", "root");
          return;
        case "ratings-matrix":
          pushMobileSeniorState("ratingsMatrix", "root");
          return;
        case "lineup-optimizer":
          pushMobileSeniorState("lineupOptimizer", "root");
          return;
        default:
          return;
      }
    };
    window.addEventListener(MOBILE_NAV_TRAIL_JUMP_EVENT, handle);
    return () => window.removeEventListener(MOBILE_NAV_TRAIL_JUMP_EVENT, handle);
  }, [pushMobileSeniorState, selectedPlayer]);

  useEffect(() => {
    if (!mobileSeniorActive) return;
    if (mobileSeniorPlayerScreen !== "detail") return;
    if (selectedPlayer) return;
    pushMobileSeniorState("playerDetails", "list", "replace");
  }, [
    mobileSeniorActive,
    mobileSeniorPlayerScreen,
    pushMobileSeniorState,
    selectedPlayer,
  ]);

  useEffect(() => {
    if (!mobileSeniorActive) return;
    if (mobileSeniorView !== "playerDetails") return;
    if (mobileSeniorPlayerScreen !== "root") return;
    pushMobileSeniorState("playerDetails", "list", "replace");
  }, [
    mobileSeniorActive,
    mobileSeniorPlayerScreen,
    mobileSeniorView,
    pushMobileSeniorState,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileSeniorActive) return;
    const currentState = window.history.state as MobileSeniorHistoryState | null;
    if (currentState?.appShell !== "tool" || currentState.tool !== "senior") {
      return;
    }
    if (currentState.seniorView && currentState.seniorScreen) {
      return;
    }
    if (mobileSeniorPlayerScreen === "detail") {
      window.history.replaceState(
        {
          appShell: "tool",
          tool: "senior",
          seniorView: "playerDetails",
          seniorScreen: "root",
        } satisfies MobileSeniorHistoryState,
        "",
        window.location.href
      );
      window.history.pushState(
        {
          appShell: "tool",
          tool: "senior",
          seniorView: "playerDetails",
          seniorScreen: "list",
        } satisfies MobileSeniorHistoryState,
        "",
        window.location.href
      );
      window.history.pushState(
        {
          appShell: "tool",
          tool: "senior",
          seniorView: "playerDetails",
          seniorScreen: "detail",
        } satisfies MobileSeniorHistoryState,
        "",
        window.location.href
      );
      return;
    }
    if (mobileSeniorPlayerScreen === "list") {
      window.history.replaceState(
        {
          appShell: "tool",
          tool: "senior",
          seniorView: "playerDetails",
          seniorScreen: "root",
        } satisfies MobileSeniorHistoryState,
        "",
        window.location.href
      );
      window.history.pushState(
        {
          appShell: "tool",
          tool: "senior",
          seniorView: "playerDetails",
          seniorScreen: "list",
        } satisfies MobileSeniorHistoryState,
        "",
        window.location.href
      );
      return;
    }
    window.history.replaceState(
      {
        appShell: "tool",
        tool: "senior",
        seniorView: mobileSeniorView,
        seniorScreen: "root",
      } satisfies MobileSeniorHistoryState,
      "",
      window.location.href
    );
  }, [mobileSeniorActive, mobileSeniorPlayerScreen, mobileSeniorView]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileSeniorActive) return;
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as MobileSeniorHistoryState | null;
      if (state?.appShell !== "tool" || state.tool !== "senior") return;
      const nextView =
        state.seniorView === "skillsMatrix" ||
        state.seniorView === "ratingsMatrix" ||
        state.seniorView === "lineupOptimizer" ||
        state.seniorView === "playerDetails"
          ? state.seniorView
          : "playerDetails";
      const nextScreen =
        state.seniorScreen === "detail" ||
        state.seniorScreen === "list" ||
        state.seniorScreen === "root"
          ? state.seniorScreen
          : "root";
      setMobileSeniorView(nextView);
      setMobileSeniorPlayerScreen(nextScreen);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [mobileSeniorActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldUseLandscapeMatrixMode =
      mobileSeniorActive &&
      (mobileSeniorView === "skillsMatrix" || mobileSeniorView === "ratingsMatrix");
    if (!shouldUseLandscapeMatrixMode) {
      setMobileSeniorLandscapeActive(false);
      return;
    }

    const mediaQuery = window.matchMedia("(orientation: landscape)");
    const syncLandscapeState = () => setMobileSeniorLandscapeActive(mediaQuery.matches);
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

    mediaQuery.addEventListener("change", syncLandscapeState);
    return () => mediaQuery.removeEventListener("change", syncLandscapeState);
  }, [mobileSeniorActive, mobileSeniorView]);

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
    const handleHelpOpen = () => {
      if (mobileSeniorActive) return;
      setShowHelp(true);
    };

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
  }, [addNotification, messages.notificationRefreshStoppedManual, mobileSeniorActive]);

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
          setPendingAutoHelpOpen(false);
          return;
        }
        if (mobileSeniorActive) {
          setShowHelp(false);
          setPendingAutoHelpOpen(false);
          return;
        }
        const dismissedToken = window.localStorage.getItem(SENIOR_HELP_STORAGE_KEY);
        if (dismissedToken !== token) {
          if (seniorAutoHelpReady) {
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
        if (cancelled) return;
        if (error instanceof ChppAuthRequiredError) {
          setCurrentToken(null);
          setShowHelp(false);
          setPendingAutoHelpOpen(false);
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
  }, [mobileSeniorActive, seniorAutoHelpReady]);

  useEffect(() => {
    if (!resolvedSeniorTeamId) return;
    void ensureRequiredScopes();
  }, [resolvedSeniorTeamId]);

  useEffect(() => {
    if (mobileSeniorActive) {
      setShowHelp(false);
      setPendingAutoHelpOpen(false);
      return;
    }
    if (!pendingAutoHelpOpen) return;
    if (!seniorAutoHelpReady) return;
    setShowHelp(true);
    setPendingAutoHelpOpen(false);
  }, [mobileSeniorActive, pendingAutoHelpOpen, seniorAutoHelpReady]);

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
    if (key === "salary" && typeof value === "number") return formatDisplayCurrencyFromSek(value);
    if (key === "motherClubBonus" && typeof value === "boolean") {
      return value ? "✓" : "—";
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
    return String(value);
  };
  const transferSearchCanBid = isSupporter && canPlaceBid;
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
  const transferSearchResultCountLabel =
    transferSearchItemCount === null
      ? null
      : messages.seniorTransferSearchResultsCount.replace(
          "{{count}}",
          String(transferSearchResults.length)
        );
  const transferSearchSelectedPlayerName = transferSearchSourcePlayer
    ? formatPlayerName(transferSearchSourcePlayer)
    : null;
  const transferSearchSelectedPlayerDetailPills = useMemo(() => {
    if (!transferSearchSourcePlayer) return [];
    const ageYears =
      typeof transferSearchSourceDetails?.Age === "number"
        ? transferSearchSourceDetails.Age
        : typeof transferSearchSourcePlayer.Age === "number"
          ? transferSearchSourcePlayer.Age
          : null;
    const ageDays =
      typeof transferSearchSourceDetails?.AgeDays === "number"
        ? transferSearchSourceDetails.AgeDays
        : typeof transferSearchSourcePlayer.AgeDays === "number"
          ? transferSearchSourcePlayer.AgeDays
          : null;
    const tsi =
      typeof transferSearchSourceDetails?.TSI === "number"
        ? transferSearchSourceDetails.TSI
        : typeof transferSearchSourcePlayer.TSI === "number"
          ? transferSearchSourcePlayer.TSI
          : null;
    const pills: string[] = [];
    if (ageYears !== null && ageDays !== null) {
      pills.push(
        `${ageYears}${messages.ageYearsShort} ${ageDays}${messages.ageDaysShort}`
      );
    }
    if (tsi !== null) {
      pills.push(`${messages.sortTsi}: ${tsi.toLocaleString()}`);
    }
    return pills;
  }, [messages, transferSearchSourceDetails, transferSearchSourcePlayer]);

  const getTransferSearchSortMetricInput = useCallback(
    (result: TransferSearchResult) => {
      const resultDetails = detailsById.get(result.playerId) ?? null;
      const resolvedForm = resultDetails?.Form ?? result.form;
      const resolvedStamina = resultDetails?.StaminaSkill ?? result.staminaSkill;
      const resolvedSalary =
        typeof resultDetails?.Salary === "number" ? resultDetails.Salary : result.salarySek;
      const resolvedIsAbroad = resolveSeniorIsAbroad(resultDetails) ?? result.isAbroad;
      return {
        ageYears:
          typeof resultDetails?.Age === "number" ? resultDetails.Age : result.age,
        ageDays:
          typeof resultDetails?.AgeDays === "number" ? resultDetails.AgeDays : result.ageDays,
        tsi: typeof resultDetails?.TSI === "number" ? resultDetails.TSI : result.tsi,
        salarySek: resolvedSalary,
        isAbroad: resolvedIsAbroad ?? undefined,
        specialty: resultDetails?.Specialty ?? result.specialty,
        form: resolvedForm,
        stamina: resolvedStamina,
        keeper: parseSkill(resultDetails?.PlayerSkills?.KeeperSkill) ?? result.keeperSkill,
        defending:
          parseSkill(resultDetails?.PlayerSkills?.DefenderSkill) ?? result.defenderSkill,
        playmaking:
          parseSkill(resultDetails?.PlayerSkills?.PlaymakerSkill) ?? result.playmakerSkill,
        winger: parseSkill(resultDetails?.PlayerSkills?.WingerSkill) ?? result.wingerSkill,
        passing: parseSkill(resultDetails?.PlayerSkills?.PassingSkill) ?? result.passingSkill,
        scoring: parseSkill(resultDetails?.PlayerSkills?.ScorerSkill) ?? result.scorerSkill,
        setPieces:
          parseSkill(resultDetails?.PlayerSkills?.SetPiecesSkill) ?? result.setPiecesSkill,
      };
    },
    [detailsById]
  );

  const getTransferSearchTableRowData = useCallback(
    (result: TransferSearchResult): TransferSearchTableRowData => {
      const resultDetails = detailsById.get(result.playerId) ?? null;
      const metricInput = getTransferSearchSortMetricInput(result);
      const specialtyValue = resultDetails?.Specialty ?? result.specialty;
      const specialty =
        specialtyValue === null || specialtyValue === undefined
          ? "—"
          : specialtyValue === 0
            ? messages.specialtyNone
            : specialtyName(specialtyValue) ?? messages.unknownShort;
      const minimumBidSek = resolveTransferSearchMinimumBidSek(result, displayCurrency);
      const nationalityText =
        typeof resultDetails?.NativeCountryName === "string" && resultDetails.NativeCountryName.trim()
          ? resultDetails.NativeCountryName.trim()
          : messages.unknownShort;
      const resolvedSalary =
        typeof resultDetails?.Salary === "number" ? resultDetails.Salary : result.salarySek;
      const resolvedIsAbroad = resolveSeniorIsAbroad(resultDetails) ?? result.isAbroad;
      const foreignForSelectedTeam = isForeignForSelectedLeague(
        resultDetails?.NativeLeagueID,
        selectedSeniorLeagueId
      );
      const adjustedSalary = resolveTransferSearchSalaryForSelectedTeam(
        resolvedSalary,
        resolvedIsAbroad,
        foreignForSelectedTeam
      );
      const priceSek =
        typeof result.highestBidSek === "number" && result.highestBidSek > 0
          ? result.highestBidSek
          : result.askingPriceSek;
      const psico = calculatePsicoTsiMetrics(metricInput);
      return {
        nationality: nationalityText,
        originFlagDisplay:
          typeof resultDetails?.NativeLeagueID === "number"
            ? leagueOriginsById[resultDetails.NativeLeagueID]?.flagDisplay ?? null
            : null,
        nationalityTitle: nationalityText,
        name: formatTransferSearchPlayerName(result),
        specialty,
        specialtyEmoji:
          specialtyValue !== null && specialtyValue !== undefined
            ? (SPECIALTY_EMOJI[specialtyValue] ?? null)
            : null,
        specialtyTitle: specialty,
        injury:
          typeof result.injuryLevel === "number" && result.injuryLevel > 0
            ? String(result.injuryLevel)
            : "—",
        ageYears: metricInput.ageYears ?? null,
        ageDays: metricInput.ageDays ?? null,
        ageTotalDays:
          metricInput.ageYears !== null &&
          metricInput.ageYears !== undefined &&
          metricInput.ageDays !== null &&
          metricInput.ageDays !== undefined
            ? ageToTotalDays(metricInput.ageYears, metricInput.ageDays)
            : null,
        priceKind:
          typeof result.highestBidSek === "number" && result.highestBidSek > 0
            ? "HB"
            : typeof result.askingPriceSek === "number" && result.askingPriceSek >= 0
              ? "AP"
              : null,
        priceDisplay:
          typeof priceSek === "number" && priceSek >= 0
            ? formatDisplayCurrencyFromSek(priceSek)
            : messages.unknownShort,
        priceValueSek:
          typeof priceSek === "number" && priceSek >= 0
            ? priceSek
            : null,
        tsi: metricInput.tsi ?? null,
        leadership: result.leadership,
        experience: result.experience,
        form: metricInput.form ?? null,
        stamina: metricInput.stamina ?? null,
        keeper: metricInput.keeper ?? null,
        defending: metricInput.defending ?? null,
        playmaking: metricInput.playmaking ?? null,
        winger: metricInput.winger ?? null,
        passing: metricInput.passing ?? null,
        scoring: metricInput.scoring ?? null,
        setPieces: metricInput.setPieces ?? null,
        htmsPotential: calculateHtmsMetrics(metricInput)?.potential ?? null,
        skillTradingScore: calculateTransferSearchSkillTradingScore(metricInput),
        avgPsicoTsi: psico
          ? [
              Number.parseFloat(psico.formHigh),
              Number.parseFloat(psico.formAvg),
              Number.parseFloat(psico.formLow),
            ].reduce((sum, value) => sum + value, 0) / 3
          : null,
        avgPsicoWage: psico
          ? [
              Number.parseFloat(psico.wageHigh),
              Number.parseFloat(psico.wageAvg),
              Number.parseFloat(psico.wageLow),
            ].reduce((sum, value) => sum + value, 0) / 3
          : null,
        wageDisplay:
          adjustedSalary === null || adjustedSalary === undefined
            ? messages.unknownShort
            : formatDisplayCurrencyFromSek(adjustedSalary),
        wageValueSek:
          adjustedSalary === null || adjustedSalary === undefined
            ? null
            : adjustedSalary,
        wageIncludesForeignBonus: foreignForSelectedTeam === true,
        deadline: result.deadline,
        deadlineTimestamp: parseChppDate(result.deadline ?? undefined)?.getTime() ?? null,
        minBidSek: typeof minimumBidSek === "number" ? minimumBidSek : null,
      };
    },
    [
      detailsById,
      formatDisplayCurrencyFromSek,
      getTransferSearchSortMetricInput,
      leagueOriginsById,
      messages,
      selectedSeniorLeagueId,
      specialtyName,
    ]
  );

  useEffect(() => {
    setTransferSearchBidDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      transferSearchResults.forEach((result) => {
        const existing = next[result.playerId] ?? { bidDisplay: "", maxBidDisplay: "" };
        const bidDisplay = formatTransferSearchBidDraftDisplay(
          resolveTransferSearchMinimumBidSek(result, displayCurrency),
          displayCurrency
        );
        if (
          existing.bidDisplay === bidDisplay &&
          next[result.playerId]?.maxBidDisplay === existing.maxBidDisplay
        ) {
          return;
        }
        changed = true;
        next[result.playerId] = {
          bidDisplay,
          maxBidDisplay: existing.maxBidDisplay,
        };
      });
      return changed ? next : prev;
    });
  }, [displayCurrency, transferSearchResults]);
  const renderTransferSearchResultCard = useCallback((
    result: TransferSearchResult,
    countryMeta: TransferSearchResolvedCountryMeta | null
  ) => (
    <TransferSearchResultCard
      result={result}
      countryMeta={countryMeta}
      resultDetails={detailsById.get(result.playerId) ?? null}
      messages={messages}
      displayCurrency={displayCurrency}
      selectedSeniorLeagueId={selectedSeniorLeagueId}
      bidDraft={transferSearchBidDrafts[result.playerId] ?? { bidDisplay: "", maxBidDisplay: "" }}
      pending={transferSearchBidPendingPlayerId === result.playerId}
      canBid={transferSearchCanBid}
      canPlaceBid={canPlaceBid}
      onBidDraftChange={updateTransferSearchBidDraft}
      onSubmitBid={(nextResult, bidKind) => {
        void submitTransferBid(nextResult, bidKind);
      }}
    />
  ), [
    canPlaceBid,
    detailsById,
    displayCurrency,
    messages,
    selectedSeniorLeagueId,
    submitTransferBid,
    transferSearchBidDrafts,
    transferSearchBidPendingPlayerId,
    transferSearchCanBid,
    updateTransferSearchBidDraft,
  ]);
  const handleTransferSearchClose = useCallback(() => {
    setTransferSearchModalOpen(false);
  }, []);
  const handleTransferSearchSearch = useCallback((filters: TransferSearchFilters) => {
    void runTransferSearch(filters);
  }, [runTransferSearch]);
  const seniorTrainingLabel =
    messages.trainingRegimenLabel.split(/\s+/).find(Boolean) ??
    messages.trainingRegimenLabel;
  const startupLoadingStatus =
    startupLoadingPhase === "teamContext"
      ? messages.startupLoadingTeamContext
      : startupLoadingPhase === "players"
        ? messages.startupLoadingPlayers
        : startupLoadingPhase === "matches"
          ? messages.startupLoadingMatches
          : startupLoadingPhase === "ratings"
            ? messages.startupLoadingRatings
            : messages.startupLoadingFinalize;
  const startupOverlayStatus =
    startupBootstrapActive && refreshStatus ? refreshStatus : startupLoadingStatus;
  const startupOverlayProgressPct =
    startupBootstrapActive && refreshProgressPct > 0
      ? Math.max(startupLoadingProgressPct, refreshProgressPct)
      : startupLoadingProgressPct;
  const startupOverlayShouldShow = !stateRestored || !dataRestored || startupBootstrapActive;
  const seniorAiSubmitTargetMatchId = seniorAiSubmitLockActive
    ? seniorAiSubmitEnabledMatchId ?? extraTimePreparedSubmission?.matchId ?? loadedMatchId
    : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (startupOverlayShouldShow) {
      setStartupOverlayMounted(true);
      setStartupOverlayFading(false);
      return;
    }
    if (!startupOverlayMounted) return;
    setStartupOverlayFading(true);
    const timeoutId = window.setTimeout(() => {
      setStartupOverlayMounted(false);
      setStartupOverlayFading(false);
    }, 240);
    return () => window.clearTimeout(timeoutId);
  }, [startupOverlayMounted, startupOverlayShouldShow]);

  const mobileSeniorRefreshStatus = refreshing
    ? refreshStatus ?? messages.refreshingLabel
    : lastRefreshAt
    ? `${messages.youthLastGlobalRefresh}: ${formatDateTime(lastRefreshAt)}`
    : null;

  const mobileSeniorViewLabel =
    mobileSeniorView === "help"
      ? messages.mobileHelpLabel
      : mobileSeniorView === "skillsMatrix"
      ? messages.skillsMatrixTabLabel
      : mobileSeniorView === "ratingsMatrix"
        ? messages.ratingsMatrixTabLabel
        : mobileSeniorView === "lineupOptimizer"
          ? messages.lineupTitle
        : messages.detailsTabLabel;

  const handleSelectedPlayerSimulationStateChange = useCallback(
    (state: {
      editing: boolean;
      dirty: boolean;
      metricInput: SeniorPlayerMetricInput;
    }) => {
      const nextMetricInput = state.dirty ? state.metricInput : null;
      setSelectedPlayerSimulationState((prev) => {
        if (
          prev.dirty === state.dirty &&
          seniorMetricInputMatches(prev.metricInput, nextMetricInput)
        ) {
          return prev;
        }
        return {
          dirty: state.dirty,
          metricInput: nextMetricInput,
        };
      });
    },
    []
  );

  useEffect(() => {
    setSelectedPlayerSimulationState({
      dirty: false,
      metricInput: null,
    });
  }, [selectedId]);

  const buildObservedSeniorPlayerFromDetails = (
    details: SeniorPlayerDetails,
    fallbackPlayerId: number
  ): SeniorPlayer => ({
    PlayerID: details.PlayerID ?? fallbackPlayerId,
    FirstName: details.FirstName ?? "",
    NickName: details.NickName,
    LastName: details.LastName ?? "",
    Age: details.Age,
    AgeDays: details.AgeDays,
    ArrivalDate: details.ArrivalDate,
    Specialty: details.Specialty,
    TSI: details.TSI,
    Salary: details.Salary,
    IsAbroad: details.IsAbroad,
    Form: details.Form,
    StaminaSkill: details.StaminaSkill,
    InjuryLevel: details.InjuryLevel,
    Cards: details.Cards,
    PlayerSkills: details.PlayerSkills,
  });

  const clearObservedSeniorPlayer = useCallback(() => {
    const restore = observedSeniorPlayer?.restore ?? null;
    const observedPlayerId = observedSeniorPlayer?.player.PlayerID ?? null;
    if (observedPlayerId !== null && transferSearchSourcePlayerId === observedPlayerId) {
      setTransferSearchModalOpen(false);
      setTransferSearchSourcePlayerId(null);
      setTransferSearchFilters(null);
      setTransferSearchResults([]);
      setTransferSearchItemCount(null);
      setTransferSearchUsedFallback(false);
      setTransferSearchExactEmpty(false);
      setTransferSearchBidDrafts({});
    }
    setObservedSeniorPlayer(null);
    setEnterSeniorPlayerIdOpen(false);
    setEnterSeniorPlayerIdValue("");

    if (!restore) return;
    const restoreSelectedId =
      restore.selectedId !== null &&
      players.some((player) => player.PlayerID === restore.selectedId)
        ? restore.selectedId
        : null;
    setSelectedId(restoreSelectedId);
    setActiveDetailsTab(restore.activeDetailsTab);
  }, [observedSeniorPlayer, players, transferSearchSourcePlayerId]);

  const refreshObservedSeniorPlayer = useCallback(async () => {
    if (!observedSeniorPlayerActive || !observedSeniorPlayer) return;
    const playerId = observedSeniorPlayer.player.PlayerID;
    try {
      const refreshed = await fetchPlayerDetailsById(playerId, {
        captureEncounter: false,
      });
      if (!refreshed) {
        addNotification(
          messages.seniorEnterPlayerIdNotFound.replace("{{playerId}}", String(playerId))
        );
        return;
      }
      setObservedSeniorPlayer((current) =>
        current?.player.PlayerID === playerId
          ? {
              ...current,
              player: buildObservedSeniorPlayerFromDetails(refreshed, playerId),
              details: refreshed,
              fetchedAt: Date.now(),
            }
          : current
      );
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) {
        addNotification(messages.authExpiredTitle);
        return;
      }
      addNotification(
        error instanceof Error ? error.message : messages.seniorEnterPlayerIdNotFound
      );
    }
  }, [
    addNotification,
    fetchPlayerDetailsById,
    messages.authExpiredTitle,
    messages.seniorEnterPlayerIdNotFound,
    observedSeniorPlayer,
    observedSeniorPlayerActive,
  ]);

  const handleEnterSeniorPlayerIdSubmit = useCallback(async () => {
    const trimmed = enterSeniorPlayerIdValue.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) {
      addNotification(messages.seniorEnterPlayerIdInvalid);
      return;
    }
    const playerId = Number(trimmed);
    if (!Number.isSafeInteger(playerId) || playerId <= 0) {
      addNotification(messages.seniorEnterPlayerIdInvalid);
      return;
    }

    const ownPlayer = players.find((player) => player.PlayerID === playerId) ?? null;
    if (ownPlayer) {
      const observedPlayerId = observedSeniorPlayer?.player.PlayerID ?? null;
      if (observedPlayerId !== null && transferSearchSourcePlayerId === observedPlayerId) {
        setTransferSearchModalOpen(false);
        setTransferSearchSourcePlayerId(null);
        setTransferSearchFilters(null);
        setTransferSearchResults([]);
        setTransferSearchItemCount(null);
        setTransferSearchUsedFallback(false);
        setTransferSearchExactEmpty(false);
        setTransferSearchBidDrafts({});
      }
      setObservedSeniorPlayer(null);
      setSelectedId(ownPlayer.PlayerID);
      setActiveDetailsTab("details");
      setEnterSeniorPlayerIdOpen(false);
      setEnterSeniorPlayerIdValue("");
      return;
    }

    setEnterSeniorPlayerIdLoading(true);
    try {
      const details = await fetchPlayerDetailsById(playerId, {
        captureEncounter: false,
      });
      if (!details) {
        addNotification(
          messages.seniorEnterPlayerIdNotFound.replace("{{playerId}}", String(playerId))
        );
        return;
      }
      const observedPlayer = buildObservedSeniorPlayerFromDetails(details, playerId);
      setObservedSeniorPlayer({
        player: observedPlayer,
        details,
        fetchedAt: Date.now(),
        restore:
          observedSeniorPlayerActive && observedSeniorPlayer
            ? observedSeniorPlayer.restore
            : {
                selectedId,
                activeDetailsTab,
              },
      });
      setSelectedId(observedPlayer.PlayerID);
      setActiveDetailsTab("details");
      setEnterSeniorPlayerIdOpen(false);
      setEnterSeniorPlayerIdValue("");
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) {
        addNotification(messages.authExpiredTitle);
        return;
      }
      addNotification(
        error instanceof Error ? error.message : messages.seniorEnterPlayerIdNotFound
      );
    } finally {
      setEnterSeniorPlayerIdLoading(false);
    }
  }, [
    activeDetailsTab,
    addNotification,
    enterSeniorPlayerIdValue,
    fetchPlayerDetailsById,
    messages.authExpiredTitle,
    messages.seniorEnterPlayerIdInvalid,
    messages.seniorEnterPlayerIdNotFound,
    observedSeniorPlayer,
    observedSeniorPlayerActive,
    players,
    selectedId,
    transferSearchSourcePlayerId,
  ]);

  const handleSeniorDetailsRefresh = useCallback(() => {
    if (refreshing) return;
    if (observedSeniorPlayerActive) {
      void refreshObservedSeniorPlayer();
      return;
    }
    if (players.length === 0) return;
    void refreshDetailsForPlayers(players);
  }, [
    observedSeniorPlayerActive,
    players,
    refreshObservedSeniorPlayer,
    refreshing,
    refreshDetailsForPlayers,
  ]);

  const seniorTransferSearchBlockedByFemaleTeam =
    activeSeniorTeamOption?.teamGender === "female";
  const seniorTransferSearchBlockedBySupporter = !isSupporter;
  const seniorTransferSearchDisabled =
    seniorTransferSearchBlockedByFemaleTeam ||
    seniorTransferSearchBlockedBySupporter;
  const seniorTransferSearchTooltip = seniorTransferSearchBlockedByFemaleTeam
    ? messages.seniorTransferSearchFemaleTeamTooltip
    : seniorTransferSearchBlockedBySupporter
      ? messages.hattrickSupporterActionRequiredTooltip
      : null;

  const seniorDetailsHeaderActions =
    selectedPlayer ? (
      <div className={styles.seniorDetailsActionGroup}>
        <Tooltip
          content={seniorTransferSearchTooltip}
          disabled={!seniorTransferSearchTooltip}
        >
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => {
              void openTransferSearchForPlayer(selectedPlayer, {
                sourceDetailsOverride: observedSeniorPlayerActive
                  ? selectedDetails
                  : undefined,
              });
            }}
            disabled={seniorTransferSearchDisabled}
          >
            {effectiveSelectedPlayerSimulationState.dirty
              ? messages.seniorTransferSearchEditedButtonLabel
              : messages.seniorTransferSearchButtonLabel}
          </button>
        </Tooltip>
        <Tooltip content={messages.seniorEnterPlayerIdTooltip}>
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => {
              setEnterSeniorPlayerIdValue("");
              setEnterSeniorPlayerIdOpen(true);
            }}
          >
            {messages.seniorEnterPlayerIdButtonLabel}
          </button>
        </Tooltip>
        {observedSeniorPlayerActive ? (
          <Tooltip content={messages.seniorObservedExternalPlayerClearLabel}>
            <button
              type="button"
              className={`${styles.sortToggle} ${styles.observedSeniorPlayerClearButton}`}
              onClick={clearObservedSeniorPlayer}
              aria-label={messages.seniorObservedExternalPlayerClearLabel}
            >
              🗑
            </button>
          </Tooltip>
        ) : null}
      </div>
    ) : null;

  const mobileSeniorMatrixHint = !mobileSeniorLandscapeActive ? (
    <span className={styles.mobileYouthLandscapeHint}>
      {messages.mobileYouthLandscapeHint}
    </span>
  ) : null;

  const seniorMobileDetailsPanel = (
    <PlayerDetailsPanel
      selectedPlayer={selectedPanelPlayer}
      detailsData={selectedPanelDetails}
      loading={false}
      error={null}
      lastUpdated={
        observedSeniorPlayerActive
          ? observedSeniorPlayer?.fetchedAt ?? null
          : selectedId
            ? detailsCache[selectedId]?.fetchedAt ?? null
            : null
      }
      unlockStatus={null}
      onRefresh={handleSeniorDetailsRefresh}
      players={panelPlayers}
      playerDetailsById={panelDetailsById}
      skillsMatrixRows={skillsMatrixRows}
      ratingsMatrixResponse={ratingsResponse}
      ratingsManualOverrideEnabled={effectiveRatingsManualOverrideEnabled}
      onRatingsManualOverrideEnabledChange={handleRatingsManualOverrideEnabledChange}
      ratingsManualOverrideTooltip={
        premiumUnlocked
          ? messages.ratingsManualOverrideTooltip
          : messages.ratingsManualOverridePremiumTooltip
      }
      onRatingsManualEditingToggleInteraction={() =>
        trackSeniorFeatureUsed("ratings_manual_edit_toggled")
      }
      ratingsOverwriteManualEditsEnabled={ratingsOverwriteManualEditsEnabled}
      onRatingsOverwriteManualEditsEnabledChange={
        handleRatingsOverwriteManualEditsEnabledChange
      }
      onRatingsDiscardManualEdits={handleDiscardRatingsManualEdits}
      ratingsHasManualEdits={hasManualRatingsEdits}
      onRatingsManualCellChange={handleRatingsManualCellChange}
      ratingsManualEditsByPlayerId={ratingsManualEditsByPlayerId}
      ratingsMatrixSelectedName={
        observedSeniorPlayerActive || !selectedOwnPlayer
          ? null
          : formatPlayerName(selectedOwnPlayer)
      }
      ratingsMatrixSpecialtyByName={specialtyByName}
      ratingsMatrixMotherClubBonusByName={motherClubBonusByName}
      ratingsMatrixCardStatusByName={seniorCardStatusByName}
      ratingsMatrixTransferListingByName={transferListingByName}
      cardStatusByPlayerId={seniorCardStatusByPlayerId}
      matrixNewPlayerIds={matrixNewMarkers.playerIds}
      matrixNewRatingsByPlayerId={matrixNewMarkers.ratingsByPlayerId}
      matrixNewSkillsCurrentByPlayerId={matrixNewMarkers.skillsCurrentByPlayerId}
      matrixNewSkillsMaxByPlayerId={matrixNewMarkers.skillsMaxByPlayerId}
      onSelectRatingsPlayer={(playerName) => {
        const player = players.find((item) => formatPlayerName(item) === playerName);
        if (!player) return;
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
      hasPreviousPlayer={!observedSeniorPlayerActive && Boolean(previousPlayerId)}
      hasNextPlayer={!observedSeniorPlayerActive && Boolean(nextPlayerId)}
      onPreviousPlayer={() => {
        if (observedSeniorPlayerActive) return;
        if (!previousPlayerId) return;
        setSelectedId(previousPlayerId);
      }}
      onNextPlayer={() => {
        if (observedSeniorPlayerActive) return;
        if (!nextPlayerId) return;
        setSelectedId(nextPlayerId);
      }}
      playerKind="senior"
      skillMode="single"
      maxSkillLevel={20}
      activeTab="details"
      showTabs={false}
      detailsHeaderActions={seniorDetailsHeaderActions}
      detailsNotice={
        observedSeniorPlayerActive ? messages.seniorObservedExternalPlayerNotice : null
      }
      onSeniorSimulationStateChange={handleSelectedPlayerSimulationStateChange}
      seniorSimulationEditingBlocked={!premiumUnlocked}
      onSeniorSimulationBlockedInteraction={() =>
        openPremiumLicenseModal(seniorSimulationLicenseContext)
      }
      onSeniorSimulationEditingToggleInteraction={() =>
        trackSeniorFeatureUsed("edit_skills_age_wage_tsi_toggled")
      }
      messages={messages}
          displayCurrency={displayCurrency}
    />
  );

  const mobileSeniorListCard = (
    <div className={styles.card}>
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
                setSortDirection(defaultSortDirectionForKey(nextKey));
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
              <optgroup label={messages.skillsLabel}>
                <option value="keeper">{messages.sortKeeper}</option>
                <option value="defender">{messages.sortDefender}</option>
                <option value="playmaker">{messages.sortPlaymaker}</option>
                <option value="winger">{messages.sortWinger}</option>
                <option value="passing">{messages.sortPassing}</option>
                <option value="scorer">{messages.sortScorer}</option>
                <option value="setpieces">{messages.sortSetPieces}</option>
              </optgroup>
            </select>
          </label>
          <Tooltip content={messages.sortToggleAria}>
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
          </Tooltip>
        </div>
      </div>
      {orderedListPlayers.length === 0 ? (
        <p className={styles.muted}>{messages.unableToLoadPlayers}</p>
      ) : (
        <ul className={styles.list}>
          {orderedListPlayers.map((player) => {
            const playerDetails = detailsById.get(player.PlayerID);
            const originFlagDisplay =
              panelDetailsById.get(player.PlayerID)?.OriginFlagDisplay ?? null;
            const playerName = formatPlayerName(player);
            const isExcluded = isPlayerExcluded(excludedPlayers, player.PlayerID);
            const hasMotherClubBonus = Boolean(playerDetails?.MotherClubBonus);
            const transferListing = seniorTransferListingForDetails(playerDetails);
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
            const isBruised =
              injuryLevel !== null && (injuryLevel === 0 || (injuryLevel > 0 && injuryLevel < 1));
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
              typeof playerDetails?.Experience === "number" ? playerDetails.Experience : null;
            const loyaltyValue =
              typeof playerDetails?.Loyalty === "number" ? playerDetails.Loyalty : null;
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
                    <span className={`${styles.playerMetricPill} ${styles.playerMetricPillNeutral}`}>
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
                        typeof wageValue === "number" ? "" : styles.playerMetricPillNeutral
                      }`}
                      style={metricPillStyle(wageValue, wageRange.min, wageRange.max, true)}
                    >
                      {wageValue !== null ? formatDisplayCurrencyFromSek(wageValue) : messages.unknownShort}
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
                        typeof staminaValue === "number" ? "" : styles.playerMetricPillNeutral
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
                        typeof experienceValue === "number" ? "" : styles.playerMetricPillNeutral
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
                        typeof loyaltyValue === "number" ? "" : styles.playerMetricPillNeutral
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
                  <LineupExcludeButton
                    playerName={playerName}
                    excluded={isExcluded}
                    onToggle={() => handleToggleSeniorExcludedPlayer(player.PlayerID)}
                    messages={messages}
                  />
                  <Tooltip content={messages.youthDragToLineupHint} fullWidth>
                    <button
                      type="button"
                      className={`${styles.playerButton} ${
                        isExcluded ? styles.lineupExcludedPlayerButton : ""
                      }`}
                      aria-pressed={isSelected}
                      onClick={() => handleSeniorListPlayerSelect(player.PlayerID, playerName)}
                    >
                      <span
                        className={`${styles.playerNameRow} ${styles.seniorPlayerNameRow} ${
                          isNameSort ? styles.playerNameRowTruncate : ""
                        }`}
                      >
                        <span
                          className={`${styles.playerName} ${styles.seniorPlayerName}`}
                          title={playerName}
                        >
                          {playerName}
                        </span>
                        {originFlagDisplay ? (
                          <OriginFlag
                            display={originFlagDisplay}
                            className={styles.transferSearchCardNationality}
                          />
                        ) : null}
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
                        {transferListing ? (
                          <SeniorTransferListedIndicator
                            listing={transferListing}
                            messages={messages}
                            formatSekValue={formatDisplayCurrencyFromSek}
                            compact
                            nested
                          />
                        ) : null}
                        {specialty && SPECIALTY_EMOJI[specialty] ? (
                          <span className={styles.playerSpecialty}>
                            {SPECIALTY_EMOJI[specialty]}
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.playerIndicators}>
                        {isNameSort ? (
                          ageLabel && agePillClassName ? (
                            <span className={`${styles.playerAgePill} ${agePillClassName}`}>
                              {ageLabel}
                            </span>
                          ) : null
                        ) : (
                          metricNode
                        )}
                      </span>
                    </button>
                  </Tooltip>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const mobileSeniorContent =
    mobileSeniorPlayerScreen === "detail" ? (
      <div className={styles.mobileYouthContent}>{seniorMobileDetailsPanel}</div>
    ) : mobileSeniorPlayerScreen === "list" ? (
      <div className={styles.mobileYouthContent}>{mobileSeniorListCard}</div>
    ) : mobileSeniorView === "help" ? (
      <div className={styles.mobileYouthContent}>
        <div className={styles.helpCard}>
          <h2 className={styles.helpTitle}>{messages.seniorHelpTitle}</h2>
          <p className={styles.helpIntro}>{messages.seniorHelpIntro}</p>
          <ul className={styles.helpList}>
            <li>{messages.seniorHelpBulletLatestUpdates}</li>
            <li>{messages.seniorHelpBulletAiOverview}</li>
            <li>{messages.seniorHelpBulletPredictedRatings}</li>
            <li>{messages.seniorHelpBulletAiTrainingAware}</li>
            <li>{messages.seniorHelpBulletAiIgnoreTraining}</li>
            <li>{messages.seniorHelpBulletAiMatchTypes}</li>
            <li>{messages.seniorHelpBulletTrainingRegimen}</li>
            <li>{messages.seniorHelpBulletAnalyzeOpponent}</li>
          </ul>
          <div className={styles.helpOptimizerSection}>
            <h3 className={styles.helpOptimizerTitle}>
              {messages.helpOptimizerLocationTitle}
            </h3>
            <p className={styles.helpOptimizerLead}>
              {messages.seniorHelpOptimizerLocation}
            </p>
            <div className={styles.helpOptimizerMatchCard}>
              <div className={styles.helpOptimizerMatchCardHeader}>
                <span className={styles.helpOptimizerMockLabel}>
                  {messages.matchesTitle}
                </span>
                <button
                  type="button"
                  className={`${styles.optimizeButton} ${styles.matchBestLineupDazzleButton}`}
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
            onClick={() => pushMobileSeniorState("playerDetails", "root", "replace")}
          >
            {messages.closeLabel}
          </button>
        </div>
      </div>
    ) : mobileSeniorView === "skillsMatrix" ? (
      <div className={styles.mobileYouthContent}>
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
          ratingsManualOverrideEnabled={effectiveRatingsManualOverrideEnabled}
          onRatingsManualOverrideEnabledChange={handleRatingsManualOverrideEnabledChange}
          ratingsManualOverrideTooltip={
            premiumUnlocked
              ? messages.ratingsManualOverrideTooltip
              : messages.ratingsManualOverridePremiumTooltip
          }
          onRatingsManualEditingToggleInteraction={() =>
            trackSeniorFeatureUsed("ratings_manual_edit_toggled")
          }
          ratingsOverwriteManualEditsEnabled={ratingsOverwriteManualEditsEnabled}
          onRatingsOverwriteManualEditsEnabledChange={
            handleRatingsOverwriteManualEditsEnabledChange
          }
          onRatingsDiscardManualEdits={handleDiscardRatingsManualEdits}
          ratingsHasManualEdits={hasManualRatingsEdits}
          onRatingsManualCellChange={handleRatingsManualCellChange}
          ratingsManualEditsByPlayerId={ratingsManualEditsByPlayerId}
          ratingsMatrixSelectedName={
            observedSeniorPlayerActive || !selectedOwnPlayer
              ? null
              : formatPlayerName(selectedOwnPlayer)
          }
          ratingsMatrixSpecialtyByName={specialtyByName}
          ratingsMatrixMotherClubBonusByName={motherClubBonusByName}
          ratingsMatrixCardStatusByName={seniorCardStatusByName}
          ratingsMatrixTransferListingByName={transferListingByName}
          cardStatusByPlayerId={seniorCardStatusByPlayerId}
          matrixNewPlayerIds={matrixNewMarkers.playerIds}
          matrixNewRatingsByPlayerId={matrixNewMarkers.ratingsByPlayerId}
          matrixNewSkillsCurrentByPlayerId={matrixNewMarkers.skillsCurrentByPlayerId}
          matrixNewSkillsMaxByPlayerId={matrixNewMarkers.skillsMaxByPlayerId}
          onSelectRatingsPlayer={(playerName) => {
            const player = players.find((item) => formatPlayerName(item) === playerName);
            if (!player) return;
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
          playerKind="senior"
          skillMode="single"
          maxSkillLevel={20}
          activeTab="skillsMatrix"
          showTabs={false}
          extraSkillsMatrixHeaderAux={mobileSeniorMatrixHint}
          showSeniorSkillBonusInMatrix={showSeniorSkillBonusInMatrix}
          onShowSeniorSkillBonusInMatrixChange={setShowSeniorSkillBonusInMatrix}
          messages={messages}
          displayCurrency={displayCurrency}
        />
      </div>
    ) : mobileSeniorView === "ratingsMatrix" ? (
      <div className={styles.mobileYouthContent}>
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
          ratingsManualOverrideEnabled={effectiveRatingsManualOverrideEnabled}
          onRatingsManualOverrideEnabledChange={handleRatingsManualOverrideEnabledChange}
          ratingsManualOverrideTooltip={
            premiumUnlocked
              ? messages.ratingsManualOverrideTooltip
              : messages.ratingsManualOverridePremiumTooltip
          }
          onRatingsManualEditingToggleInteraction={() =>
            trackSeniorFeatureUsed("ratings_manual_edit_toggled")
          }
          ratingsOverwriteManualEditsEnabled={ratingsOverwriteManualEditsEnabled}
          onRatingsOverwriteManualEditsEnabledChange={
            handleRatingsOverwriteManualEditsEnabledChange
          }
          onRatingsDiscardManualEdits={handleDiscardRatingsManualEdits}
          ratingsHasManualEdits={hasManualRatingsEdits}
          onRatingsManualCellChange={handleRatingsManualCellChange}
          ratingsManualEditsByPlayerId={ratingsManualEditsByPlayerId}
          ratingsMatrixSelectedName={
            observedSeniorPlayerActive || !selectedOwnPlayer
              ? null
              : formatPlayerName(selectedOwnPlayer)
          }
          ratingsMatrixSpecialtyByName={specialtyByName}
          ratingsMatrixMotherClubBonusByName={motherClubBonusByName}
          ratingsMatrixCardStatusByName={seniorCardStatusByName}
          ratingsMatrixTransferListingByName={transferListingByName}
          cardStatusByPlayerId={seniorCardStatusByPlayerId}
          matrixNewPlayerIds={matrixNewMarkers.playerIds}
          matrixNewRatingsByPlayerId={matrixNewMarkers.ratingsByPlayerId}
          matrixNewSkillsCurrentByPlayerId={matrixNewMarkers.skillsCurrentByPlayerId}
          matrixNewSkillsMaxByPlayerId={matrixNewMarkers.skillsMaxByPlayerId}
          onSelectRatingsPlayer={(playerName) => {
            const player = players.find((item) => formatPlayerName(item) === playerName);
            if (!player) return;
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
          playerKind="senior"
          skillMode="single"
          maxSkillLevel={20}
          activeTab="ratingsMatrix"
          showTabs={false}
          extraSkillsMatrixHeaderAux={mobileSeniorMatrixHint}
          showSeniorSkillBonusInMatrix={showSeniorSkillBonusInMatrix}
          onShowSeniorSkillBonusInMatrixChange={setShowSeniorSkillBonusInMatrix}
          messages={messages}
          displayCurrency={displayCurrency}
        />
      </div>
    ) : mobileSeniorView === "lineupOptimizer" ? (
      <div className={styles.mobileYouthContent}>
        <LineupField
          assignments={assignments}
          behaviors={behaviors}
          playersById={playersByIdForLineup}
          excludedPlayers={excludedPlayers}
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
            if (isPlayerExcluded(excludedPlayers, playerId)) return;
            const nextAssignments = { ...assignments };
            Object.keys(nextAssignments).forEach((key) => {
              if (nextAssignments[key] === playerId) {
                nextAssignments[key] = null;
              }
            });
            nextAssignments[slotId] = playerId;
            setAssignments(nextAssignments);
            markSeniorLineupMutated();
            preservePreparedSeniorAiContextAfterManualEdit(
              nextAssignments,
              behaviors,
              tacticType
            );
          }}
          onClear={(slotId) => {
            const nextAssignments = { ...assignments, [slotId]: null };
            setAssignments(nextAssignments);
            markSeniorLineupMutated();
            preservePreparedSeniorAiContextAfterManualEdit(
              nextAssignments,
              behaviors,
              tacticType
            );
          }}
          onMove={(fromSlot, toSlot) => {
            const movingPlayerId = assignments[fromSlot] ?? null;
            if (isPlayerExcluded(excludedPlayers, movingPlayerId)) return;
            const nextAssignments = {
              ...assignments,
              [toSlot]: assignments[fromSlot] ?? null,
              [fromSlot]: assignments[toSlot] ?? null,
            };
            setAssignments(nextAssignments);
            markSeniorLineupMutated();
            preservePreparedSeniorAiContextAfterManualEdit(
              nextAssignments,
              behaviors,
              tacticType
            );
          }}
          onChangeBehavior={(slotId, behavior) => {
            const nextBehaviors = { ...behaviors };
            if (behavior) nextBehaviors[slotId] = behavior;
            else delete nextBehaviors[slotId];
            setBehaviors(nextBehaviors);
            preservePreparedSeniorAiContextAfterManualEdit(
              assignments,
              nextBehaviors,
              tacticType
            );
          }}
          onReset={() => {
            setAssignments({});
            markSeniorLineupMutated();
            setBehaviors({});
            setLoadedMatchId(null);
            clearSeniorRatingsPrediction();
            clearSeniorAiSubmitLock();
            addNotification(messages.notificationLineupReset);
          }}
          tacticType={tacticType}
          onTacticChange={(nextTacticType) => {
            setTacticType(nextTacticType);
            preservePreparedSeniorAiContextAfterManualEdit(
              assignments,
              behaviors,
              nextTacticType
            );
          }}
          tacticPlacement="headerRight"
          trainingType={trainingType}
          onTrainingTypeChange={setTrainingType}
          onTrainingTypeSet={handleSetTrainingType}
          trainingTypeSetPending={trainingTypeSetPending}
          trainingTypeSetPendingValue={trainingTypeSetPendingValue}
          trainingTypePlacement="fieldTopLeft"
          topRightOverlayContent={seniorPredictedRatingsOverlay}
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
          emptySlotPickerOptions={seniorEmptySlotPickerOptions}
          skillMode="single"
          maxSkillLevel={20}
          allowExternalPlayerDrop={false}
          lineupActionsRightContent={renderSeniorOtherOrdersButton()}
          messages={messages}
        />
        <SeniorMatchesPanel
          response={matchesState}
          messages={messages}
          currentSeason={currentSeason}
          selectedSeniorTeamId={resolvedSeniorTeamId}
          defaultCoachLeadership={ownSeniorTeamTrainerLeadership}
          assignments={assignments}
          behaviors={behaviors}
          captainId={effectiveSeniorCaptainId}
          penaltyKickerIds={effectiveSeniorPenaltyKickerIds}
          setPiecesId={effectiveSeniorSetPiecesPlayerId}
          tacticType={tacticType}
          sourceSystem="Hattrick"
          includeTournamentMatches={includeTournamentMatches}
          onIncludeTournamentMatchesChange={setIncludeTournamentMatches}
          getOpponentCupStatus={getOpponentCupStatus}
          ensureOpponentCupStatus={fetchOpponentCupStatus}
          setBestLineupHelpAnchor="senior-set-lineup-ai"
          showExtraTimeSetBestLineupMode
          keepBestLineupMenuTopmost
          fixedFormationOptions={[...FIXED_FORMATION_OPTIONS]}
          selectedFixedFormation={setBestLineupFixedFormation}
          onSelectedFixedFormationChange={setSetBestLineupFixedFormation}
          fixedFormationBlocked={!premiumUnlocked}
          onBlockedFixedFormationInteraction={() =>
            openPremiumLicenseModal(seniorFixedFormationLicenseContext)
          }
            selectedIgnoreTrainingFormationPolicy={ignoreTrainingFormationPolicy}
            onSelectedIgnoreTrainingFormationPolicyChange={
              setIgnoreTrainingFormationPolicy
            }
            analyticsSource="desktop"
            seniorSubmittedLineupVariantFeature={
              pendingSeniorSubmittedLineupVariantFeature
            }
            onAnalyticsFeature={(feature, source) => trackSeniorFeatureUsed(feature, source)}
            setBestLineupCustomContent={buildSetBestLineupBTeamMenuContent("desktop")}
            setBestLineupDisabledTooltipBuilder={getSetBestLineupDisabledTooltip}
          onRefresh={onRefreshMatchesOnly}
          onSetBestLineupMode={async (matchId, mode, fixedFormation, options) => {
            clearSeniorAiSubmitLock();
            if (mode === "extraTime") {
              setExtraTimeMatchId(matchId);
              await syncExtraTimeModalTrainingType().catch(() => {
                // Fall back to the last known senior training if the live fetch fails.
              });
              setExtraTimeInfoOpen(true);
              return;
            }
            if (mode === "trainingAware") {
              setTrainingAwareMatchId(matchId);
              await syncTrainingAwareModalTrainingType().catch(() => {
                // Fall back to the last known senior training if the live fetch fails.
              });
              setTrainingAwareInfoOpen(true);
              return;
            }
            return runSetBestLineupPredictRatings(
              matchId,
              mode,
              fixedFormation,
              options
            );
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
            loadedTacticType,
            loadedOrders
          ) => {
            clearSeniorAiSubmitLock();
            setAssignments(nextAssignments);
            markSeniorLineupMutated();
            setBehaviors(nextBehaviors);
            if (typeof loadedTacticType === "number") {
              setTacticType(loadedTacticType);
            }
            if (loadedOrders) {
              setLoadedLineupOrdersByMatchId((prev) => ({
                ...prev,
                [matchId]: loadedOrders,
              }));
              const loadedPayload = buildLineupPayload(
                nextAssignments,
                loadedTacticType ?? tacticType,
                {
                  behaviors: nextBehaviors,
                  kickerIds: loadedOrders.penaltyKickerIds,
                  captainId: loadedOrders.captainId ?? 0,
                  setPiecesId: loadedOrders.setPiecesId ?? 0,
                  substitutions: loadedOrders.substitutions,
                }
              );
              loadedPayload.settings.speechLevel = loadedOrders.matchAttitude ?? 0;
              loadedPayload.settings.coachModifier = loadedOrders.coachModifier ?? 0;
              loadedPayload.settings.manMarkerPlayerId =
                loadedOrders.manMarkerPlayerId ?? 0;
              loadedPayload.settings.manMarkingPlayerId =
                loadedOrders.manMarkingPlayerId ?? 0;
              setSeniorEditableOrdersState(
                sanitizeSeniorEditableOrdersSetPieces(
                  buildSeniorEditableOrdersFromPayload(matchId, loadedPayload, "loaded")
                )
              );
            }
            setLoadedMatchId(matchId);
            setSeniorRatingsMatchContext(buildSeniorRatingsMatchContext(matchId));
            setOtherOrdersModalMatchId(matchId);
            setOtherOrdersEditorOpen(true);
          }}
          loadedMatchId={loadedMatchId}
          onSubmitSuccess={(submittedMatchId, submittedLineupPayload) => {
            if (extraTimePreparedSubmission) {
              try {
                setSubmitDisclaimerExtraTimeSummary(buildExtraTimeSubmitDisclaimerSummary());
              } catch {
                setSubmitDisclaimerExtraTimeSummary(null);
              }
              setSubmitDisclaimerManMarkingSummary(null);
              setSubmitDisclaimerSeniorOrdersSummary(null);
            } else {
              setSubmitDisclaimerExtraTimeSummary(null);
              setSubmitDisclaimerSeniorOrdersSummary(
                seniorAiPreparedSubmissionMode === "trainingAware" ||
                  seniorAiPreparedSubmissionMode === "ignoreTraining" ||
                  seniorAiPreparedSubmissionMode === "fixedFormation"
                  ? buildSeniorSubmitDisclaimerOrdersSummary(submittedLineupPayload)
                  : null
              );
              setSubmitDisclaimerManMarkingSummary(
                buildSeniorSubmitDisclaimerManMarkingSummary(submittedMatchId)
              );
            }
            clearSeniorAiSubmitLock();
            setSubmitDisclaimerOpen(true);
            void onRefreshMatchesOnly();
          }}
          submitEnabledMatchId={seniorAiSubmitTargetMatchId}
          canSubmitToHattrick={isSupporter}
          submitUnavailableTooltip={messages.hattrickSupporterActionRequiredTooltip}
          submitRestrictedTooltipBuilder={(targetMatch) => {
            if (!targetMatch) return messages.submitOrdersTooltip;
            const home = targetMatch.HomeTeam?.HomeTeamName ?? messages.homeLabel;
            const away = targetMatch.AwayTeam?.AwayTeamName ?? messages.awayLabel;
            const parsedMatchDate = parseChppDate(targetMatch.MatchDate);
            const datetime = parsedMatchDate
              ? formatDateTime(parsedMatchDate)
              : messages.unknownDate;
            return messages.seniorSubmitOrdersOtherMatchTooltip
              .replace("{{home}}", home)
              .replace("{{away}}", away)
              .replace("{{datetime}}", datetime);
          }}
          buildSubmitLineupPayload={(matchId, defaultPayload) =>
            buildSeniorSubmitLineupPayload(matchId, defaultPayload)
          }
        />
      </div>
    ) : mobileSeniorView === "playerDetails" ? (
      <div className={styles.mobileYouthContent}>
        <div className={`${styles.card} ${styles.mobileYouthPlaceholderCard}`}>
          <h2 className={styles.sectionTitle}>{messages.toolSeniorOptimization}</h2>
          <p className={styles.muted}>{messages.mobileYouthRootPrompt}</p>
        </div>
      </div>
    ) : (
      <div className={styles.mobileYouthContent}>
        <div className={`${styles.card} ${styles.mobileYouthPlaceholderCard}`}>
          <h2 className={styles.sectionTitle}>{mobileSeniorViewLabel}</h2>
          <p className={styles.muted}>{messages.mobileSeniorViewComingSoon}</p>
        </div>
      </div>
    );

  return (
    <div
      className={styles.dashboardStack}
      data-tactical-assistant-status={
        ownSeniorTeamHasTacticalAssistant === null
          ? "unknown"
          : ownSeniorTeamHasTacticalAssistant
            ? "available"
            : "unavailable"
      }
      data-tactical-assistant-staff-level={
        ownSeniorTeamTacticalAssistantStaffLevel === null
          ? "unknown"
          : ownSeniorTeamTacticalAssistantStaffLevel
      }
      data-senior-trainer-type={
        ownSeniorTeamTrainerType === null ? "unknown" : ownSeniorTeamTrainerType
      }
      ref={dashboardRef}
    >
      {startupOverlayMounted ? (
        <StartupLoadingExperience
          title={messages.startupLoadingTitle}
          subtitle={messages.startupLoadingSubtitle}
          status={startupOverlayStatus}
          progressPct={startupOverlayProgressPct}
          overlay
          fading={startupOverlayFading}
        />
      ) : null}
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
        open={enterSeniorPlayerIdOpen}
        title={messages.seniorEnterPlayerIdModalTitle}
        movable={false}
        onClose={() => {
          if (enterSeniorPlayerIdLoading) return;
          setEnterSeniorPlayerIdOpen(false);
        }}
        body={
          <form
            id="senior-enter-player-id-form"
            className={styles.observedSeniorPlayerForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handleEnterSeniorPlayerIdSubmit();
            }}
          >
            <label className={styles.infoLabel} htmlFor="senior-enter-player-id">
              {messages.seniorEnterPlayerIdInputLabel}
            </label>
            <input
              id="senior-enter-player-id"
              className={styles.transferSearchInput}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={enterSeniorPlayerIdValue}
              placeholder={messages.seniorEnterPlayerIdPlaceholder}
              disabled={enterSeniorPlayerIdLoading}
              onChange={(event) => {
                setEnterSeniorPlayerIdValue(event.target.value.replace(/\D/g, ""));
              }}
            />
          </form>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.sortToggle}
              onClick={() => setEnterSeniorPlayerIdOpen(false)}
              disabled={enterSeniorPlayerIdLoading}
            >
              {messages.confirmCancel}
            </button>
            <button
              type="submit"
              form="senior-enter-player-id-form"
              className={styles.confirmSubmit}
              disabled={enterSeniorPlayerIdLoading}
            >
              {enterSeniorPlayerIdLoading
                ? messages.seniorEnterPlayerIdLoadingLabel
                : messages.seniorEnterPlayerIdSubmitLabel}
            </button>
          </>
        }
      />
      <TransferSearchModal
        open={transferSearchModalOpen}
        messages={messages}
        selectedPlayerName={transferSearchSelectedPlayerName}
        selectedPlayerDetailPills={transferSearchSelectedPlayerDetailPills}
        filters={transferSearchFilters}
        displayCurrency={displayCurrency}
        countryOptions={transferSearchCountryOptions}
        loading={transferSearchLoading}
        onUpdateSkillFilter={updateTransferSearchSkillFilter}
        onUpdateFilterField={updateTransferSearchFilterField}
        onSearch={handleTransferSearchSearch}
        resultCountLabel={transferSearchResultCountLabel}
        exactEmpty={transferSearchExactEmpty}
        error={transferSearchError}
        results={transferSearchResults}
        sortKey={transferSearchSortKey}
        onSortKeyChange={setTransferSearchSortKey}
        resultsViewMode={transferSearchResultsViewMode}
        onResultsViewModeChange={setTransferSearchResultsViewMode}
        getSortMetricInput={getTransferSearchSortMetricInput}
        getTableRowData={getTransferSearchTableRowData}
        getNativeLeagueId={(result) =>
          detailsById.get(result.playerId)?.NativeLeagueID
        }
        canQuickBid={transferSearchCanBid}
        quickBidUnavailableTooltip={
          !canPlaceBid
            ? messages.chppMissingPlaceBidTooltip
            : messages.seniorTransferSearchSupporterOnlyTooltip
        }
        quickBidPendingPlayerId={transferSearchBidPendingPlayerId}
        onQuickBid={(result) => {
          void placeTransferQuickBid(result);
        }}
        htmsPotentialFilter={transferSearchHtmsPotentialFilter}
        onHtmsPotentialFilterChange={setTransferSearchHtmsPotentialFilter}
        onSaveAsProfile={openTransferSearchSaveProfile}
        saveAsProfileLabel={messages.transferMarketSaveAsProfileButton}
        canSaveAsProfile={isSupporter}
        saveAsProfileUnavailableTooltip={
          messages.hattrickSupporterActionRequiredTooltip
        }
        renderResultCard={renderTransferSearchResultCard}
        onClose={handleTransferSearchClose}
      />
      {saveProfileModal}
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
        open={otherOrdersEditorOpen}
        title={messages.seniorOtherOrdersTitle}
        className={styles.seniorOtherOrdersModal}
        autoPosition={false}
        movable={false}
        body={
          otherOrdersDraft ? (
            <div className={styles.seniorOtherOrdersEditor}>
              {otherOrdersValidationError ? (
                <p className={styles.seniorOtherOrdersError}>
                  {otherOrdersValidationError}
                </p>
              ) : null}
              {isDevBuild ? (
                <section className={styles.seniorOtherOrdersDevPanel}>
                  <label className={styles.algorithmsToggle}>
                    <span className={styles.algorithmsToggleText}>
                      {messages.seniorOtherOrdersDevSimulateTacticalAssistant}
                    </span>
                    <input
                      type="checkbox"
                      className={styles.algorithmsToggleInput}
                      checked={devSimulateTacticalAssistant}
                      onChange={(event) => {
                        setDevSimulateTacticalAssistant(event.target.checked);
                        setOtherOrdersValidationError(null);
                      }}
                    />
                    <span
                      className={styles.algorithmsToggleSwitch}
                      aria-hidden="true"
                    />
                  </label>
                  {devSimulateTacticalAssistant ? (
                    <label className={styles.seniorOtherOrdersDevSlider}>
                      <span>
                        {messages.seniorOtherOrdersDevTacticalAssistantLevel.replace(
                          "{{level}}",
                          String(devSimulatedTacticalAssistantLevel)
                        )}
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={devSimulatedTacticalAssistantLevel}
                        onChange={(event) => {
                          setDevSimulatedTacticalAssistantLevel(
                            Math.min(
                              5,
                              Math.max(1, Math.round(Number(event.target.value)))
                            )
                          );
                          setOtherOrdersValidationError(null);
                        }}
                      />
                    </label>
                  ) : null}
                </section>
              ) : null}
              <p
                className={`${styles.seniorOtherOrdersAssistantStatus} ${seniorOtherOrdersTacticalAssistantStatus.className}`}
              >
                {seniorOtherOrdersTacticalAssistantStatus.text}
              </p>
              <section
                className={`${styles.seniorOtherOrdersSection} ${styles.seniorOtherOrdersSectionWide}`}
              >
                <h3>{messages.seniorOtherOrdersMatchAttitudeTitle}</h3>
                {isSeniorOtherOrdersMatchAttitudeEligible(otherOrdersDraft.matchId) ? (
                  <select
                    className={styles.seniorOtherOrdersSelect}
                    value={otherOrdersDraft.matchAttitude ?? 0}
                    onChange={(event) =>
                      updateOtherOrdersDraft((draft) => ({
                        ...draft,
                        matchAttitude: Number(event.target.value),
                      }))
                    }
                  >
                    <option value={0}>{messages.seniorOtherOrdersAttitudeNormal}</option>
                    <option value={-1}>
                      {messages.seniorOtherOrdersAttitudePlayItCool}
                    </option>
                    <option value={1}>
                      {messages.seniorOtherOrdersAttitudeMatchOfSeason}
                    </option>
                  </select>
                ) : (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersMatchAttitudeUnavailable}
                  </p>
                )}
              </section>
              {effectiveOtherOrdersHasTacticalAssistant ? (
                <section
                  className={`${styles.seniorOtherOrdersSection} ${styles.seniorOtherOrdersSectionWide}`}
                >
                  <h3>{messages.seniorOtherOrdersStyleOfPlayTitle}</h3>
                  {seniorOtherOrdersCoachModifierRange ? (
                    <>
                      <input
                        className={styles.seniorOtherOrdersRange}
                        type="range"
                        min={seniorOtherOrdersCoachModifierRange.min}
                        max={seniorOtherOrdersCoachModifierRange.max}
                        value={otherOrdersDraft.coachModifier ?? 0}
                        onChange={(event) =>
                          updateOtherOrdersDraft((draft) => ({
                            ...draft,
                            coachModifier: Number(event.target.value),
                          }))
                        }
                      />
                      <div className={styles.seniorOtherOrdersRangeLabels}>
                        <span>{messages.seniorOtherOrdersStyleDefensive}</span>
                        <strong>{otherOrdersDraft.coachModifier ?? 0}</strong>
                        <span>{messages.seniorOtherOrdersStyleOffensive}</span>
                      </div>
                      <p className={styles.seniorOtherOrdersEmpty}>
                        {messages.seniorOtherOrdersTacticalAssistantLevel.replace(
                          "{{level}}",
                          String(effectiveOtherOrdersTacticalAssistantStaffLevel)
                        )}
                      </p>
                    </>
                  ) : (
                    <p className={styles.seniorOtherOrdersEmpty}>
                      {messages.seniorOtherOrdersStyleUnavailable}
                    </p>
                  )}
                </section>
              ) : null}
              <section
                className={`${styles.seniorOtherOrdersSection} ${styles.seniorOtherOrdersSectionWide}`}
              >
                <div className={styles.seniorOtherOrdersSectionHeader}>
                  <h3>{messages.seniorOtherOrdersPlayerOrdersTitle}</h3>
                  <div className={styles.seniorOtherOrdersSectionCounters}>
                    <span>
                      {messages.seniorOtherOrdersPlayerOrdersCounter
                        .replace("{{count}}", String(otherOrdersDraft.playerOrders.length))
                        .replace("{{max}}", String(seniorOtherOrdersMaxPlayerOrders))}
                    </span>
                    <span>
                      {messages.seniorOtherOrdersBenchSubstitutionsCount
                        .replace(
                          "{{count}}",
                          String(
                            countSeniorOtherOrdersBenchSubstitutions(
                              otherOrdersDraft.playerOrders
                            )
                          )
                        )
                        .replace("{{limit}}", String(SENIOR_BENCH_SUBSTITUTION_LIMIT))}
                    </span>
                  </div>
                </div>
                <div className={styles.seniorOtherOrdersSectionActions}>
                  <button
                    type="button"
                    className={`${styles.lineupButtonSecondary} ${styles.seniorOtherOrdersAddOrderButton}`}
                    disabled={
                      startingXiOrderPlayerOptions.length === 0 ||
                      otherOrdersDraft.playerOrders.length >= seniorOtherOrdersMaxPlayerOrders
                    }
                    onClick={addSeniorOtherOrdersDraftOrder}
                  >
                    {messages.seniorOtherOrdersAddOrder}
                  </button>
                </div>
                {startingXiOrderPlayerOptions.length === 0 ? (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersNoLineupPlayers}
                  </p>
                ) : null}
                {otherOrdersDraft.playerOrders.length >= seniorOtherOrdersMaxPlayerOrders ? (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersOrderLimitReached}
                  </p>
                ) : null}
                <div className={styles.seniorOtherOrdersCardListEditable}>
                  {otherOrdersDraft.playerOrders.map((order, index) => {
                    const kind = seniorOtherOrdersDraftOrderKind(order);
                    const subjectPlayerOptions =
                      kind === "substitution" ||
                      kind === "swap" ||
                      kind === "behaviour"
                        ? startingXiOrderPlayerOptions
                        : availableOrderPlayerOptions;
                    const objectPlayerOptions =
                      kind === "substitution"
                        ? benchOrderPlayerOptions
                        : kind === "swap"
                          ? startingXiOrderPlayerOptions
                          : availableOrderPlayerOptions;
                    const subjectEmptyLabel =
                      subjectPlayerOptions.length === 0
                        ? messages.seniorOtherOrdersNoStartingXiPlayers
                        : messages.unknownShort;
                    const objectEmptyLabel =
                      kind === "substitution" && objectPlayerOptions.length === 0
                        ? messages.seniorOtherOrdersNoBenchPlayers
                        : kind === "swap" && objectPlayerOptions.length === 0
                          ? messages.seniorOtherOrdersNoStartingXiPlayers
                          : messages.unknownShort;
                    return (
                      <article key={order.id} className={styles.seniorOtherOrdersCard}>
                        <div className={styles.seniorOtherOrdersOrderHeader}>
                          <strong>
                            {seniorOtherOrdersOrderKindLabel(kind)} #{index + 1}
                          </strong>
                          <button
                            type="button"
                            className={`${styles.lineupButtonSecondary} ${styles.seniorOtherOrdersDeleteOrderButton}`}
                            onClick={() =>
                              updateOtherOrdersDraft((draft) => ({
                                ...draft,
                                source: "mixed",
                                playerOrders: draft.playerOrders.filter(
                                  (candidate) => candidate.id !== order.id
                                ),
                              }))
                            }
                          >
                            {messages.seniorOtherOrdersDeleteOrder}
                          </button>
                        </div>
                        <div className={styles.seniorOtherOrdersFormGrid}>
                          <label>
                            <span>{messages.seniorOtherOrdersOrderTypeLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={kind}
                              onChange={(event) => {
                                const nextKind = event.target.value;
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) => {
                                    if (candidate.id !== order.id) return candidate;
                                    if (nextKind === "swap") {
                                      return {
                                        ...candidate,
                                        orderType: 3,
                                        subjectPlayerId:
                                          candidate.subjectPlayerId !== null &&
                                          startingXiOrderPlayerIdSet.has(
                                            candidate.subjectPlayerId
                                          )
                                            ? candidate.subjectPlayerId
                                            : null,
                                        objectPlayerId:
                                          candidate.objectPlayerId !== null &&
                                          startingXiOrderPlayerIdSet.has(
                                            candidate.objectPlayerId
                                          )
                                            ? candidate.objectPlayerId
                                            : null,
                                        newPositionId: SENIOR_ORDER_DEFAULT_POSITION,
                                        newPositionBehaviour:
                                          SENIOR_ORDER_DEFAULT_BEHAVIOUR,
                                      };
                                    }
                                    if (nextKind === "behaviour") {
                                      const nextSubjectPlayerId =
                                        candidate.subjectPlayerId !== null &&
                                        startingXiOrderPlayerIdSet.has(
                                          candidate.subjectPlayerId
                                        )
                                          ? candidate.subjectPlayerId
                                          : null;
                                      return {
                                        ...candidate,
                                        orderType: 1,
                                        subjectPlayerId: nextSubjectPlayerId,
                                        objectPlayerId: nextSubjectPlayerId,
                                      };
                                    }
                                    return {
                                      ...candidate,
                                      orderType: 1,
                                      subjectPlayerId:
                                        candidate.subjectPlayerId !== null &&
                                        startingXiOrderPlayerIdSet.has(
                                          candidate.subjectPlayerId
                                        )
                                          ? candidate.subjectPlayerId
                                          : null,
                                      objectPlayerId:
                                        candidate.objectPlayerId !== null &&
                                        benchOrderPlayerIdSet.has(candidate.objectPlayerId)
                                          ? candidate.objectPlayerId
                                          : null,
                                    };
                                  }),
                                }));
                              }}
                            >
                              <option value="substitution">
                                {messages.seniorOtherOrdersSubstitutionLabel}
                              </option>
                              <option value="behaviour">
                                {messages.seniorOtherOrdersBehaviourChangeLabel}
                              </option>
                              <option value="swap">
                                {messages.seniorOtherOrdersPositionSwapLabel}
                              </option>
                            </select>
                          </label>
                          <label>
                            <span>{messages.seniorOtherOrdersMinuteLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={order.minute}
                              onChange={(event) =>
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) =>
                                    candidate.id === order.id
                                      ? {
                                          ...candidate,
                                          minute: Number(event.target.value),
                                        }
                                      : candidate
                                  ),
                                }))
                              }
                            >
                              {seniorOtherOrdersMinuteOptions.map((option) => (
                                <option key={option.key} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{messages.seniorOtherOrdersPlayerOutLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={order.subjectPlayerId ?? 0}
                              onChange={(event) =>
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) =>
                                    candidate.id === order.id
                                      ? {
                                          ...candidate,
                                          subjectPlayerId:
                                            Number(event.target.value) || null,
                                          objectPlayerId:
                                            kind === "behaviour"
                                              ? Number(event.target.value) || null
                                              : candidate.objectPlayerId,
                                        }
                                      : candidate
                                  ),
                                }))
                              }
                            >
                              <option value={0}>{subjectEmptyLabel}</option>
                              {subjectPlayerOptions.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {seniorOtherOrdersPlayerNameLabel(player)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{messages.seniorOtherOrdersPlayerInLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={order.objectPlayerId ?? 0}
                              disabled={kind === "behaviour"}
                              onChange={(event) =>
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) =>
                                    candidate.id === order.id
                                      ? {
                                          ...candidate,
                                          objectPlayerId:
                                            Number(event.target.value) || null,
                                        }
                                      : candidate
                                  ),
                                }))
                              }
                            >
                              <option value={0}>{objectEmptyLabel}</option>
                              {objectPlayerOptions.map((player) => (
                                <option key={player.id} value={player.id}>
                                  {seniorOtherOrdersPlayerNameLabel(player)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{messages.seniorOtherOrdersStandingLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={order.standing}
                              onChange={(event) =>
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) =>
                                    candidate.id === order.id
                                      ? {
                                          ...candidate,
                                          standing: Number(event.target.value),
                                        }
                                      : candidate
                                  ),
                                }))
                              }
                            >
                              {seniorOtherOrdersStandingOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{messages.seniorOtherOrdersCardLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={order.card}
                              onChange={(event) =>
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) =>
                                    candidate.id === order.id
                                      ? { ...candidate, card: Number(event.target.value) }
                                      : candidate
                                  ),
                                }))
                              }
                            >
                              {seniorOtherOrdersRedCardOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                              {!seniorOtherOrdersRedCardOptions.some(
                                (option) => option.value === order.card
                              ) ? (
                                <option value={order.card}>
                                  {messages.seniorOtherOrdersDeprecatedRedCardCriterion}
                                </option>
                              ) : null}
                            </select>
                          </label>
                          <label>
                            <span>{messages.seniorOtherOrdersNewPositionLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={order.newPositionId}
                              onChange={(event) =>
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) =>
                                    candidate.id === order.id
                                      ? {
                                          ...candidate,
                                          newPositionId: Number(event.target.value),
                                        }
                                      : candidate
                                  ),
                                }))
                              }
                            >
                              {seniorOtherOrdersNewPositionOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>{messages.seniorOtherOrdersNewBehaviourLabel}</span>
                            <select
                              className={styles.seniorOtherOrdersSelect}
                              value={order.newPositionBehaviour}
                              onChange={(event) =>
                                updateOtherOrdersDraft((draft) => ({
                                  ...draft,
                                  source: "mixed",
                                  playerOrders: draft.playerOrders.map((candidate) =>
                                    candidate.id === order.id
                                      ? {
                                          ...candidate,
                                          newPositionBehaviour: Number(event.target.value),
                                        }
                                      : candidate
                                  ),
                                }))
                              }
                            >
                              {seniorOtherOrdersNewBehaviourOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {otherOrdersDraft.playerOrders.length === 0 ? (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersPlayerOrdersNone}
                  </p>
                ) : null}
              </section>
              <section
                className={`${styles.seniorOtherOrdersSection} ${styles.seniorOtherOrdersSectionWide}`}
              >
                <div className={styles.seniorOtherOrdersSectionHeader}>
                  <h3>{messages.seniorOtherOrdersManMarkingTitle}</h3>
                  {otherOrdersDraft.manMarkingOrder ? (
                    <button
                      type="button"
                      className={`${styles.lineupButtonSecondary} ${styles.seniorOtherOrdersDeleteOrderButton}`}
                      onClick={() =>
                        updateOtherOrdersDraft((draft) => ({
                          ...draft,
                          source: "mixed",
                          manMarkingOrder: null,
                        }))
                      }
                      onPointerDown={() => setManMarkingTargetDropdownOpen(false)}
                    >
                      {messages.seniorOtherOrdersClear}
                    </button>
                  ) : null}
                </div>
                {!otherOrdersDraft.manMarkingOrder ? (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersManMarkingNone}
                  </p>
                ) : null}
                <div className={styles.seniorOtherOrdersFormGrid}>
                  <label>
                    <span>{messages.seniorOtherOrdersMarkerLabel}</span>
                    <select
                      className={styles.seniorOtherOrdersSelect}
                      value={otherOrdersDraft.manMarkingOrder?.subjectPlayerId ?? 0}
                      onChange={(event) => {
                        const nextMarkerId = Number(event.target.value) || null;
                        updateOtherOrdersDraft((draft) => ({
                          ...draft,
                          source: "mixed",
                          manMarkingOrder:
                            nextMarkerId === null && !draft.manMarkingOrder?.objectPlayerId
                              ? null
                              : {
                                  id:
                                    draft.manMarkingOrder?.id ??
                                    `man-marking-${draft.matchId ?? "draft"}-${Date.now()}`,
                                  orderType: 4,
                                  minute:
                                    draft.manMarkingOrder?.minute ??
                                    SENIOR_ORDER_DEFAULT_MINUTE,
                                  standing:
                                    draft.manMarkingOrder?.standing ??
                                    SENIOR_ORDER_DEFAULT_CONDITION,
                                  card:
                                    draft.manMarkingOrder?.card ??
                                    SENIOR_ORDER_DEFAULT_CONDITION,
                                  subjectPlayerId: nextMarkerId,
                                  objectPlayerId:
                                    draft.manMarkingOrder?.objectPlayerId ?? null,
                                  newPositionId: SENIOR_ORDER_DEFAULT_POSITION,
                                  newPositionBehaviour:
                                    SENIOR_ORDER_DEFAULT_BEHAVIOUR,
                                },
                        }));
                      }}
                    >
                      <option value={0}>
                        {startingXiOrderPlayerOptions.length === 0
                          ? messages.seniorOtherOrdersNoStartingXiPlayers
                          : messages.unknownShort}
                      </option>
                      {startingXiOrderPlayerOptions.map((player) => (
                        <option key={player.id} value={player.id}>
                          {seniorOtherOrdersPlayerNameLabel(player)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{messages.seniorOtherOrdersTargetLabel}</span>
                    <div
                      className={styles.seniorOtherOrdersCombobox}
                      ref={manMarkingTargetDropdownRef}
                    >
                      <button
                        type="button"
                        className={styles.seniorOtherOrdersComboboxButton}
                        onClick={openSeniorOtherOrdersManMarkingTargetDropdown}
                        aria-haspopup="listbox"
                        aria-expanded={manMarkingTargetDropdownOpen}
                      >
                        {otherOrdersDraft.manMarkingOrder?.objectPlayerId
                          ? seniorOtherOrdersOpponentPlayerName(
                              otherOrdersDraft.manMarkingOrder.objectPlayerId
                            )
                          : messages.seniorOtherOrdersManMarkingTargetPlaceholder}
                      </button>
                      {manMarkingTargetDropdownOpen ? (
                        <div
                          className={styles.seniorOtherOrdersComboboxMenu}
                          role="listbox"
                        >
                          {!activeOtherOrdersOpponentTeam ? (
                            <div className={styles.seniorOtherOrdersComboboxStatus}>
                              {messages.seniorOtherOrdersManMarkingNoOpponent}
                            </div>
                          ) : null}
                          {opponentPlayersLoading ? (
                            <div className={styles.seniorOtherOrdersComboboxStatus}>
                              <span className={styles.spinner} aria-hidden="true" />
                              <span>
                                {messages.seniorOtherOrdersOpponentPlayersLoading}
                              </span>
                            </div>
                          ) : null}
                          {opponentPlayersError ? (
                            <div className={styles.seniorOtherOrdersComboboxStatus}>
                              <span>{opponentPlayersError}</span>
                              <button
                                type="button"
                                className={styles.seniorOtherOrdersInlineButton}
                                onClick={() => {
                                  setOpponentPlayersForSession(null);
                                  void ensureOpponentPlayersForManMarking(true);
                                }}
                              >
                                {messages.seniorOtherOrdersOpponentPlayersRetry}
                              </button>
                            </div>
                          ) : null}
                          {!opponentPlayersLoading &&
                          !opponentPlayersError &&
                          activeOtherOrdersOpponentTeam &&
                          seniorOtherOrdersOpponentTargetOptions(
                            otherOrdersDraft.manMarkingOrder?.objectPlayerId ?? null
                          ).length === 0 ? (
                            <div className={styles.seniorOtherOrdersComboboxStatus}>
                              {messages.seniorOtherOrdersOpponentPlayersNone}
                            </div>
                          ) : null}
                          {!opponentPlayersLoading && !opponentPlayersError
                            ? seniorOtherOrdersOpponentTargetOptions(
                                otherOrdersDraft.manMarkingOrder?.objectPlayerId ?? null
                              ).map((player) => (
                                <button
                                  key={player.playerId}
                                  type="button"
                                  role="option"
                                  className={styles.seniorOtherOrdersComboboxOption}
                                  aria-selected={
                                    player.playerId ===
                                    otherOrdersDraft.manMarkingOrder?.objectPlayerId
                                  }
                                  onClick={() => {
                                    updateSeniorOtherOrdersManMarkingTarget(
                                      player.playerId
                                    );
                                    setManMarkingTargetDropdownOpen(false);
                                  }}
                                >
                                  {player.name}
                                </button>
                              ))
                            : null}
                        </div>
                      ) : null}
                    </div>
                    {!activeOtherOrdersOpponentTeam ? (
                      <small className={styles.seniorOtherOrdersInlineStatus}>
                        {messages.seniorOtherOrdersManMarkingNoOpponent}
                      </small>
                    ) : null}
                    {otherOrdersDraft.manMarkingOrder?.objectPlayerId ? (
                      <small>
                        {messages.seniorOtherOrdersCurrentTarget.replace(
                          "{{target}}",
                          seniorOtherOrdersOpponentPlayerName(
                            otherOrdersDraft.manMarkingOrder.objectPlayerId
                          )
                        )}
                      </small>
                    ) : null}
                  </label>
                </div>
              </section>
              <section className={styles.seniorOtherOrdersSection}>
                <h3>{messages.seniorOtherOrdersPenaltyTakersTitle}</h3>
                {availableOrderPlayerOptions.length === 0 ? (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersNoLineupPlayers}
                  </p>
                ) : null}
                <ol className={styles.seniorOtherOrdersEditableList}>
                  {Array.from({ length: 11 }, (_, index) => (
                    <li
                      key={`penalty-${index}`}
                      className={styles.seniorOtherOrdersPenaltyRow}
                    >
                      <select
                        className={styles.seniorOtherOrdersSelect}
                        value={otherOrdersDraft.penaltyTakerIds[index] ?? 0}
                        onChange={(event) =>
                          updateOtherOrdersDraft((draft) => {
                            const nextIds = [...draft.penaltyTakerIds];
                            nextIds[index] = Number(event.target.value) || 0;
                            return { ...draft, source: "mixed", penaltyTakerIds: nextIds };
                          })
                        }
                      >
                        <option value={0}>{messages.seniorOtherOrdersPenaltyTakersNone}</option>
                        {availableOrderPlayerOptions.map((player) => (
                          <option key={player.id} value={player.id}>
                            {seniorOtherOrdersPlayerSetPiecesLabel(player)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.lineupButtonSecondary}
                        disabled={index === 0}
                        onClick={() =>
                          updateOtherOrdersDraft((draft) => {
                            const nextIds = [...draft.penaltyTakerIds];
                            [nextIds[index - 1], nextIds[index]] = [
                              nextIds[index] ?? 0,
                              nextIds[index - 1] ?? 0,
                            ];
                            return { ...draft, source: "mixed", penaltyTakerIds: nextIds };
                          })
                        }
                      >
                        {messages.seniorOtherOrdersMoveUp}
                      </button>
                      <button
                        type="button"
                        className={styles.lineupButtonSecondary}
                        onClick={() =>
                          updateOtherOrdersDraft((draft) => {
                            const nextIds = [...draft.penaltyTakerIds];
                            nextIds[index] = 0;
                            return { ...draft, source: "mixed", penaltyTakerIds: nextIds };
                          })
                        }
                      >
                        {messages.seniorOtherOrdersClear}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
              <section className={styles.seniorOtherOrdersSection}>
                <h3>{messages.seniorOtherOrdersCaptainTitle}</h3>
                {availableOrderPlayerOptions.length === 0 ? (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersNoLineupPlayers}
                  </p>
                ) : null}
                <select
                  className={styles.seniorOtherOrdersSelect}
                  value={otherOrdersDraft.captainPlayerId ?? 0}
                  onChange={(event) =>
                    updateOtherOrdersDraft((draft) => ({
                      ...draft,
                      source: "mixed",
                      captainPlayerId: Number(event.target.value) || null,
                    }))
                  }
                >
                  <option value={0}>{messages.seniorOtherOrdersCoachPick}</option>
                  {availableOrderPlayerOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {seniorOtherOrdersPlayerNameLabel(player)}
                    </option>
                  ))}
                </select>
              </section>
              <section className={styles.seniorOtherOrdersSection}>
                <h3>{messages.seniorOtherOrdersSetPiecesTitle}</h3>
                {availableOrderPlayerOptions.length === 0 ? (
                  <p className={styles.seniorOtherOrdersEmpty}>
                    {messages.seniorOtherOrdersNoLineupPlayers}
                  </p>
                ) : null}
                <select
                  className={styles.seniorOtherOrdersSelect}
                  value={otherOrdersDraft.setPiecesPlayerId ?? 0}
                  onChange={(event) =>
                    updateOtherOrdersDraft((draft) => ({
                      ...draft,
                      source: "mixed",
                      setPiecesPlayerId: Number(event.target.value) || null,
                    }))
                  }
                >
                  <option value={0}>{messages.seniorOtherOrdersCoachPick}</option>
                  {setPiecesOrderPlayerOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      {seniorOtherOrdersPlayerSetPiecesLabel(player)}
                    </option>
                  ))}
                </select>
              </section>
            </div>
          ) : (
            <p className={styles.seniorOtherOrdersEmpty}>
              {messages.seniorOtherOrdersSubstitutionsNone}
            </p>
          )
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={closeOtherOrdersEditor}
            >
              {messages.seniorOtherOrdersCancel}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={saveOtherOrdersEditor}
              disabled={!otherOrdersDraft}
            >
              {messages.seniorOtherOrdersSave}
            </button>
          </>
        }
        closeOnBackdrop
        onClose={closeOtherOrdersEditor}
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
              <div>
                <p className={styles.seniorDisclaimerIntro}>
                  {messages.seniorExtraTimeSubmitDisclaimerSubstitutionsTitle}
                </p>
                <ul className={styles.seniorDisclaimerList}>
                  {submitDisclaimerExtraTimeSummary.substitutions.map((substitution, index) => (
                    <li key={`${substitution.type}-${substitution.minute}-${index}`}>
                      {(
                        substitution.type === "swap"
                          ? messages.seniorExtraTimeSubmitDisclaimerSwapLine
                          : messages.seniorExtraTimeSubmitDisclaimerReplaceLine
                      )
                        .replace("{{minute}}", String(substitution.minute))
                        .split("{{playerIn}}")
                        .flatMap((segment, segmentIndex, segments) => {
                          if (segmentIndex === segments.length - 1) return [segment];
                          return [
                            segment,
                            <a
                              key={`player-in-${substitution.playerIn.id}`}
                              className={styles.chroniclePressLink}
                              href={hattrickPlayerUrl(substitution.playerIn.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {substitution.playerIn.name}
                            </a>,
                          ];
                        })
                        .flatMap((segment) => {
                          if (typeof segment !== "string") return [segment];
                          return segment.split("{{playerOut}}").flatMap((part, partIndex, parts) => {
                            if (partIndex === parts.length - 1) return [part];
                            return [
                              part,
                              <a
                                key={`player-out-${substitution.playerOut.id}`}
                                className={styles.chroniclePressLink}
                                href={hattrickPlayerUrl(substitution.playerOut.id)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {substitution.playerOut.name}
                              </a>,
                            ];
                          });
                        })}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={styles.seniorDisclaimerIntro}>
                  {messages.seniorExtraTimeSubmitDisclaimerTrainingTitle}
                </p>
                <p>{messages.seniorExtraTimeModalTrainingLimit}</p>
                <div className={styles.seniorDisclaimerTrainingCards}>
                  {submitDisclaimerExtraTimeSummary.trainingRows.map((row) => (
                    <article key={`mobile-training-${row.id}`} className={styles.seniorDisclaimerTrainingCard}>
                      <div className={styles.seniorDisclaimerTrainingCardHeader}>
                        <span className={styles.seniorDisclaimerTrainingCardIndex}>
                          {row.number}
                        </span>
                        <a
                          className={styles.chroniclePressLink}
                          href={hattrickPlayerUrl(row.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.name}
                        </a>
                      </div>
                      <div className={styles.seniorDisclaimerTrainingCardGrid}>
                        <div className={styles.seniorDisclaimerTrainingCardMetric}>
                          <span className={styles.seniorDisclaimerTrainingCardLabel}>
                            {messages.seniorExtraTimeSubmitDisclaimerTrainingScenario90Header}
                          </span>
                          <span>{formatEffectiveTrainingMinutes(row.scenario90)}</span>
                        </div>
                        <div className={styles.seniorDisclaimerTrainingCardMetric}>
                          <span className={styles.seniorDisclaimerTrainingCardLabel}>
                            {messages.seniorExtraTimeSubmitDisclaimerTrainingScenario120Header}
                          </span>
                          <span>{formatEffectiveTrainingMinutes(row.scenario120)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <div className={styles.opponentFormationsTableWrap}>
                  <table className={styles.opponentFormationsTable}>
                    <thead>
                      <tr>
                        <th>{messages.ratingsIndexLabel}</th>
                        <th>{messages.seniorExtraTimeSubmitDisclaimerTrainingPlayerHeader}</th>
                        <th>{messages.seniorExtraTimeSubmitDisclaimerTrainingScenario90Header}</th>
                        <th>{messages.seniorExtraTimeSubmitDisclaimerTrainingScenario120Header}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submitDisclaimerExtraTimeSummary.trainingRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.number}</td>
                          <td>
                            <a
                              className={styles.chroniclePressLink}
                              href={hattrickPlayerUrl(row.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.name}
                            </a>
                          </td>
                          <td>{formatEffectiveTrainingMinutes(row.scenario90)}</td>
                          <td>{formatEffectiveTrainingMinutes(row.scenario120)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <p className={styles.seniorDisclaimerIntro}>
                  {messages.seniorSubmitDisclaimerPenaltyOrderTitle}
                </p>
                <ol className={styles.seniorDisclaimerList}>
                  {submitDisclaimerExtraTimeSummary.penaltyTakers.map((player) => (
                    <li key={`extra-time-penalty-${player.id}`}>
                      <a
                        className={styles.chroniclePressLink}
                        href={hattrickPlayerUrl(player.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {player.name}
                      </a>{" "}
                      ({player.setPiecesSkill ?? messages.unknownShort})
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className={styles.seniorDisclaimerIntro}>
                  {messages.seniorSubmitDisclaimerSetPiecesTitle}
                </p>
                <p>
                  {submitDisclaimerExtraTimeSummary.setPiecesTaker ? (
                    <>
                      <a
                        className={styles.chroniclePressLink}
                        href={hattrickPlayerUrl(
                          submitDisclaimerExtraTimeSummary.setPiecesTaker.id
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {submitDisclaimerExtraTimeSummary.setPiecesTaker.name}
                      </a>{" "}
                      ({submitDisclaimerExtraTimeSummary.setPiecesTaker.setPiecesSkill ??
                        messages.unknownShort})
                    </>
                  ) : (
                    messages.unknownShort
                  )}
                </p>
              </div>
              <div>
                <p className={styles.seniorDisclaimerIntro}>
                  {messages.seniorExtraTimeSubmitDisclaimerFurtherTitle}
                </p>
              </div>
              <ul className={styles.seniorDisclaimerList}>
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
              {submitDisclaimerManMarkingSummary ? (
                <div>
                  <p className={styles.seniorDisclaimerIntro}>
                    {messages.seniorAiManMarkingToggleLabel}
                  </p>
                  <p>
                    {submitDisclaimerManMarkingSummary.target
                      ? renderTemplateTokens(
                          messages.seniorSubmitDisclaimerManMarkingTargetChosen,
                          {
                            target: (
                              <a
                                className={styles.chroniclePressLink}
                                href={hattrickPlayerUrl(
                                  submitDisclaimerManMarkingSummary.target.id
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {submitDisclaimerManMarkingSummary.target.name}
                              </a>
                            ),
                          }
                        )
                      : messages.seniorSubmitDisclaimerManMarkingTargetMissing}
                    {", "}
                    {submitDisclaimerManMarkingSummary.marker
                      ? renderTemplateTokens(
                          messages.seniorSubmitDisclaimerManMarkingMarkerChosen,
                          {
                            marker: (
                              <a
                                className={styles.chroniclePressLink}
                                href={hattrickPlayerUrl(
                                  submitDisclaimerManMarkingSummary.marker.id
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {submitDisclaimerManMarkingSummary.marker.name}
                              </a>
                            ),
                          }
                        )
                      : messages.seniorSubmitDisclaimerManMarkingMarkerMissing}
                    {"."}
                  </p>
                </div>
              ) : null}
              {submitDisclaimerSeniorOrdersSummary ? (
                <>
                  <div>
                    <p className={styles.seniorDisclaimerIntro}>
                      {messages.seniorSubmitDisclaimerOrdersTitle}
                    </p>
                    {submitDisclaimerSeniorOrdersSummary.substitutions.length > 0 ? (
                      <ul className={styles.seniorDisclaimerList}>
                        {submitDisclaimerSeniorOrdersSummary.substitutions.map(
                          (substitution, index) => (
                            <li key={`${substitution.type}-${substitution.minute}-${index}`}>
                              {(
                                substitution.type === "swap"
                                  ? messages.seniorExtraTimeSubmitDisclaimerSwapLine
                                  : messages.seniorExtraTimeSubmitDisclaimerReplaceLine
                              )
                                .replace("{{minute}}", String(substitution.minute))
                                .split("{{playerIn}}")
                                .flatMap((segment, segmentIndex, segments) => {
                                  if (segmentIndex === segments.length - 1) return [segment];
                                  return [
                                    segment,
                                    <a
                                      key={`senior-orders-player-in-${substitution.playerIn.id}`}
                                      className={styles.chroniclePressLink}
                                      href={hattrickPlayerUrl(substitution.playerIn.id)}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {substitution.playerIn.name}
                                    </a>,
                                  ];
                                })
                                .flatMap((segment) => {
                                  if (typeof segment !== "string") return [segment];
                                  return segment
                                    .split("{{playerOut}}")
                                    .flatMap((part, partIndex, parts) => {
                                      if (partIndex === parts.length - 1) return [part];
                                      return [
                                        part,
                                        <a
                                          key={`senior-orders-player-out-${substitution.playerOut.id}`}
                                          className={styles.chroniclePressLink}
                                          href={hattrickPlayerUrl(substitution.playerOut.id)}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          {substitution.playerOut.name}
                                        </a>,
                                      ];
                                    });
                                })}
                            </li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p>{messages.seniorSubmitDisclaimerOrdersNone}</p>
                    )}
                  </div>
                  <div>
                    <p className={styles.seniorDisclaimerIntro}>
                      {messages.seniorSubmitDisclaimerPenaltyOrderTitle}
                    </p>
                    <ol className={styles.seniorDisclaimerList}>
                      {submitDisclaimerSeniorOrdersSummary.penaltyTakers.map((player) => (
                        <li key={`penalty-${player.id}`}>
                          <a
                            className={styles.chroniclePressLink}
                            href={hattrickPlayerUrl(player.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {player.name}
                          </a>{" "}
                          ({player.setPiecesSkill ?? messages.unknownShort})
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className={styles.seniorDisclaimerIntro}>
                      {messages.seniorSubmitDisclaimerSetPiecesTitle}
                    </p>
                    <p>
                      {submitDisclaimerSeniorOrdersSummary.setPiecesTaker ? (
                        <>
                          <a
                            className={styles.chroniclePressLink}
                            href={hattrickPlayerUrl(
                              submitDisclaimerSeniorOrdersSummary.setPiecesTaker.id
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {submitDisclaimerSeniorOrdersSummary.setPiecesTaker.name}
                          </a>{" "}
                          (
                          {submitDisclaimerSeniorOrdersSummary.setPiecesTaker.setPiecesSkill ??
                            messages.unknownShort}
                          )
                        </>
                      ) : (
                        messages.unknownShort
                      )}
                    </p>
                  </div>
                </>
              ) : null}
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
              setSubmitDisclaimerManMarkingSummary(null);
              setSubmitDisclaimerSeniorOrdersSummary(null);
            }}
          >
            {messages.closeLabel}
          </button>
        }
        onClose={() => {
          setSubmitDisclaimerOpen(false);
          setSubmitDisclaimerExtraTimeSummary(null);
          setSubmitDisclaimerManMarkingSummary(null);
          setSubmitDisclaimerSeniorOrdersSummary(null);
        }}
      />
      <Modal
        open={trainingAwareInfoOpen}
        title={messages.setBestLineupTrainingAware}
        className={`${styles.chronicleTransferHistoryModal} ${styles.seniorExtraTimeModal}`}
        body={
          <div className={styles.seniorExtraTimeModalBody}>
            <p className={styles.seniorExtraTimeModalChooseTrainees}>
              {messages.seniorExtraTimeModalChooseTrainees.replace(
                "{{count}}",
                String(
                  trainingAwareTraineesTargetForTrainingType(
                    resolvedTrainingAwareTrainingType
                  )
                )
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
              skillsMatrixRows={trainingAwareSkillsMatrixRows}
              ratingsMatrixResponse={null}
              ratingsMatrixSelectedName={null}
              ratingsMatrixSpecialtyByName={specialtyByName}
              ratingsMatrixMotherClubBonusByName={motherClubBonusByName}
              ratingsMatrixCardStatusByName={seniorCardStatusByName}
              ratingsMatrixTransferListingByName={transferListingByName}
              cardStatusByPlayerId={seniorCardStatusByPlayerId}
              matrixNewPlayerIds={matrixNewMarkers.playerIds}
              matrixNewRatingsByPlayerId={matrixNewMarkers.ratingsByPlayerId}
              matrixNewSkillsCurrentByPlayerId={matrixNewMarkers.skillsCurrentByPlayerId}
              matrixNewSkillsMaxByPlayerId={matrixNewMarkers.skillsMaxByPlayerId}
              onSelectRatingsPlayer={() => {
                void 0;
              }}
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
                      onClick={() => setTrainingAwareTrainingMenuOpen((prev) => !prev)}
                      ref={trainingAwareTrainingButtonRef}
                      aria-haspopup="menu"
                      aria-expanded={trainingAwareTrainingMenuOpen}
                    >
                      <span className={styles.lineupTrainingTypeValue}>
                        {obtainedTrainingRegimenLabel(
                          resolvedTrainingAwareTrainingType ??
                            NON_DEPRECATED_TRAINING_TYPES[0]
                        )}
                      </span>
                    </button>
                    {trainingAwareTrainingMenuOpen ? (
                      <div
                        className={`${styles.feedbackMenu} ${styles.lineupTrainingTypeMenu}`}
                        ref={trainingAwareTrainingMenuRef}
                        role="menu"
                      >
                        {NON_DEPRECATED_TRAINING_TYPES.map((value) => {
                          const isActive =
                            value ===
                            (resolvedTrainingAwareTrainingType ??
                              NON_DEPRECATED_TRAINING_TYPES[0]);
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
                                    setTrainingAwareMatrixTrainingType(value);
                                    setTrainingAwareMatrixTrainingTypeManual(
                                      value !== trainingType
                                    );
                                    setTrainingAwareTrainingMenuOpen(false);
                                  }}
                                >
                                  {obtainedTrainingRegimenLabel(value)}
                                </button>
                                {!isActive ? (
                                  <Tooltip
                                    content={
                                      canSetTraining
                                        ? messages.trainingSetButtonTooltip
                                        : messages.chppMissingSetTrainingTooltip
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={styles.lineupTrainingTypeSetButton}
                                      disabled={trainingTypeSetPending || !canSetTraining}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (trainingTypeSetPending || !canSetTraining) return;
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
                    checked={allTrainingAwarePlayersSelected}
                    disabled={trainingAwareSelectablePlayerIds.length === 0}
                    aria-label={messages.seniorExtraTimeModalChooseTrainees.replace(
                      "{{count}}",
                      String(
                        trainingAwareTraineesTargetForTrainingType(
                          resolvedTrainingAwareTrainingType
                        )
                      )
                    )}
                    ref={(node) => {
                      if (!node) return;
                      node.indeterminate = someTrainingAwarePlayersSelected;
                    }}
                    onChange={(event) => {
                      setTrainingAwareSelectedPlayerIds(
                        event.target.checked ? trainingAwareSelectablePlayerIds : []
                      );
                    }}
                  />
                  <span className={styles.seniorMatrixCheckboxBox} aria-hidden="true" />
                </label>
              }
              renderSkillsMatrixLeadingCell={(row) => {
                const rowId = typeof row.id === "number" ? row.id : null;
                const isChecked =
                  typeof rowId === "number" &&
                  trainingAwareSelectedPlayerIds.includes(rowId);
                const isInjured =
                  typeof rowId === "number" && extraTimeInjuredPlayerIdSet.has(rowId);
                const isRedCarded =
                  typeof rowId === "number" &&
                  trainingAwareRedCardedPlayerIds.has(rowId);
                const isDisregarded =
                  typeof rowId === "number" &&
                  (isRedCarded || extraTimeDisregardedPlayerIds.has(rowId));
                const isUnavailable =
                  typeof rowId !== "number" ||
                  !trainingAwareSelectablePlayerIds.includes(rowId);
                const checkbox = (
                  <label className={styles.seniorMatrixCheckboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.seniorMatrixCheckboxInput}
                      checked={Boolean(isChecked)}
                      disabled={isUnavailable || isInjured || isDisregarded}
                      aria-label={row.name}
                      onChange={(event) => {
                        if (
                          typeof rowId !== "number" ||
                          isUnavailable ||
                          isInjured ||
                          isDisregarded
                        ) {
                          return;
                        }
                        setTrainingAwareSelectedPlayerIds((prev) => {
                          if (event.target.checked) {
                            if (prev.includes(rowId)) return prev;
                            return [...prev, rowId];
                          }
                          return prev.filter((playerId) => playerId !== rowId);
                        });
                      }}
                    />
                    <span className={styles.seniorMatrixCheckboxBox} aria-hidden="true" />
                  </label>
                );
                if (isRedCarded) {
                  return (
                    <Tooltip content={messages.seniorAiRedCardedDisregardedTooltip}>
                      <span className={styles.seniorExtraTimeDisabledCheckboxWrap}>
                        {checkbox}
                      </span>
                    </Tooltip>
                  );
                }
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
                    <Tooltip content={getExtraTimeDisregardedTooltip(rowId ?? 0)}>
                      <span className={styles.seniorExtraTimeDisabledCheckboxWrap}>
                        {checkbox}
                      </span>
                    </Tooltip>
                  );
                }
                if (isUnavailable) {
                  return (
                    <span className={styles.seniorExtraTimeDisabledCheckboxWrap}>
                      {checkbox}
                    </span>
                  );
                }
                return checkbox;
              }}
              skillsMatrixRowClassName={(row) => {
                if (
                  typeof row.id !== "number" ||
                  trainingAwareSelectablePlayerIds.includes(row.id)
                ) {
                  return null;
                }
                return styles.matrixRowDisregarded;
              }}
              skillsMatrixRowTooltip={(row) => {
                if (
                  typeof row.id !== "number" ||
                  trainingAwareSelectablePlayerIds.includes(row.id)
                ) {
                  return null;
                }
                if (trainingAwareRedCardedPlayerIds.has(row.id)) {
                  return messages.seniorAiRedCardedDisregardedTooltip;
                }
                return extraTimeDisregardedPlayerIds.has(row.id)
                  ? getExtraTimeDisregardedTooltip(row.id)
                  : null;
              }}
              messages={messages}
            />
          </div>
        }
        actions={
          <Tooltip
            content={
              trainingAwareSetLineupDisabled
                ? messages.seniorExtraTimeModalSetLineupDisabledTooltip
                : messages.seniorExtraTimeModalSetLineupReadyTooltip
            }
          >
            <span>
              <button
                type="button"
                className={styles.confirmSubmit}
                disabled={trainingAwareSetLineupDisabled}
                onClick={() => {
                  void handleTrainingAwareSetLineup();
                }}
              >
                {messages.seniorExtraTimeModalSetLineupButton}
              </button>
            </span>
          </Tooltip>
        }
        closeOnBackdrop
        onClose={() => {
          setTrainingAwareInfoOpen(false);
          setTrainingAwareMatchId(null);
          clearSeniorAiSubmitLock();
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
              ratingsMatrixTransferListingByName={transferListingByName}
              cardStatusByPlayerId={seniorCardStatusByPlayerId}
              matrixNewPlayerIds={matrixNewMarkers.playerIds}
              matrixNewRatingsByPlayerId={matrixNewMarkers.ratingsByPlayerId}
              matrixNewSkillsCurrentByPlayerId={matrixNewMarkers.skillsCurrentByPlayerId}
              matrixNewSkillsMaxByPlayerId={matrixNewMarkers.skillsMaxByPlayerId}
              onSelectRatingsPlayer={() => {
                void 0;
              }}
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
                                  <Tooltip
                                    content={
                                      canSetTraining
                                        ? messages.trainingSetButtonTooltip
                                        : messages.chppMissingSetTrainingTooltip
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={styles.lineupTrainingTypeSetButton}
                                      disabled={trainingTypeSetPending || !canSetTraining}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (trainingTypeSetPending || !canSetTraining) return;
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
                const isRedCarded =
                  typeof rowId === "number" && extraTimeRedCardedPlayerIds.has(rowId);
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
                if (isRedCarded) {
                  return (
                    <Tooltip content={messages.seniorAiRedCardedDisregardedTooltip}>
                      <span className={styles.seniorExtraTimeDisabledCheckboxWrap}>
                        {checkbox}
                      </span>
                    </Tooltip>
                  );
                }
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
                  typeof row.id !== "number" ||
                  !extraTimeDisregardedPlayerIds.has(row.id)
                ) {
                  return null;
                }
                return styles.matrixRowDisregarded;
              }}
              skillsMatrixRowTooltip={(row) => {
                if (
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
          clearSeniorAiSubmitLock();
        }}
      />
      <Modal
        open={!!opponentAnalysisModal}
        title={opponentAnalysisModal?.title ?? messages.analyzeOpponent}
        className={`${styles.chronicleTransferHistoryModal} ${styles.seniorOpponentAnalysisModal}`}
        body={
          opponentAnalysisModal ? (
            <div className={styles.seniorOpponentAnalysisModalBody}>
              <div className={styles.detailsTabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={opponentAnalysisActiveTab === "matches"}
                  className={`${styles.detailsTabButton} ${
                    opponentAnalysisActiveTab === "matches"
                      ? styles.detailsTabActive
                      : ""
                  }`}
                  onClick={() => setOpponentAnalysisActiveTab("matches")}
                >
                  {messages.seniorOpponentAnalysisTabMatches}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={opponentAnalysisActiveTab === "scoutTeam"}
                  className={`${styles.detailsTabButton} ${
                    opponentAnalysisActiveTab === "scoutTeam"
                      ? styles.detailsTabActive
                      : ""
                  }`}
                  onClick={() => {
                    setOpponentAnalysisActiveTab("scoutTeam");
                    void loadOpponentScoutTeam();
                  }}
                >
                  {messages.seniorOpponentAnalysisTabScoutTeam}
                </button>
              </div>
              {opponentAnalysisModal.loading ? (
                <p className={styles.chronicleEmpty}>{messages.loadingDetails}</p>
              ) : opponentAnalysisModal.error ? (
                <p className={styles.errorDetails}>{opponentAnalysisModal.error}</p>
              ) : opponentAnalysisActiveTab === "matches" ? (
                <div className={styles.seniorOpponentAnalysisMatchesPanel}>
                <div className={styles.opponentFormationsTableWrap}>
                  <table className={styles.opponentFormationsTable}>
                    <thead>
                      <tr>
                        <th>{messages.analyzeOpponentMatchId}</th>
                        <th>{messages.clubChronicleTransferHistoryDateColumn}</th>
                        <th>{messages.analyzeOpponentMatchType}</th>
                        <th>{messages.analyzeOpponentFormationColumn}</th>
                        <th>{messages.analyzeOpponentTacticColumn}</th>
                        <th>{messages.analyzeOpponentAverageRatingsColumn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opponentAnalysisModal.opponentRows.map((row) => {
                        const sectorRatings = opponentSectorRatings(row);
                        const foxtrickHatstats = computeFoxtrickHatstats(row);
                        return (
                          <tr key={row.matchId}>
                            <td className={styles.opponentFormationsMatchIdCell}>
                              <a
                                className={styles.chroniclePressLink}
                                href={hattrickMatchUrlWithSourceSystem(
                                  row.matchId,
                                  row.sourceSystem
                                )}
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
                            <td>
                              <div>
                                {`${messages.analyzeOpponentAvgDefense}: ${formatOpponentSectorRating(
                                  sectorRatings.defense
                                )}`}
                              </div>
                              <div>
                                {`${messages.analyzeOpponentAvgMidfield}: ${formatOpponentSectorRating(
                                  sectorRatings.midfield
                                )}`}
                              </div>
                              <div>
                                {`${messages.analyzeOpponentAvgAttack}: ${formatOpponentSectorRating(
                                  sectorRatings.attack
                                )}`}
                              </div>
                              <div>
                                {`${messages.analyzeOpponentHatstatsBreakdown}: ${
                                  foxtrickHatstats
                                    ? `${foxtrickHatstats.defense}/${foxtrickHatstats.midfield}/${foxtrickHatstats.attack}/${foxtrickHatstats.total}`
                                    : messages.unknownShort
                                }`}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                </div>
              ) : (
                <div className={styles.chronicleTsiWagesDetailModalLayout}>
                  {opponentScoutTeamState.status === "loading" ? (
                    <div className={styles.loadingRow}>
                      <span className={styles.spinner} aria-hidden="true" />
                      <span>{messages.seniorOpponentScoutTeamLoading}</span>
                    </div>
                  ) : null}
                  {opponentScoutTeamState.status === "error" ? (
                    <div className={styles.seniorOtherOrdersComboboxStatus}>
                      <span>{opponentScoutTeamState.error}</span>
                      <button
                        type="button"
                        className={styles.seniorOtherOrdersInlineButton}
                        onClick={() => void loadOpponentScoutTeam(true)}
                      >
                        {messages.seniorOtherOrdersOpponentPlayersRetry}
                      </button>
                    </div>
                  ) : null}
                  {opponentScoutTeamState.status === "success" &&
                  opponentScoutTeamState.data.rows.length === 0 ? (
                    <p className={styles.chronicleEmpty}>
                      {messages.seniorOpponentScoutTeamEmpty}
                    </p>
                  ) : null}
                  {opponentScoutTeamState.status === "success" &&
                  opponentScoutTeamState.data.rows.length > 0 ? (
                    <TeamScoutDetailTable
                      mode="tsi"
                      rows={opponentScoutTeamState.data.rows}
                      messages={messages}
                      displayCurrency={displayCurrency}
                      likelyTraining={opponentScoutTeamState.data.likelyTraining}
                      matchSampleSize={opponentScoutTeamState.data.matchCount}
                      showEffectiveMainSkillEstimation={
                        showOpponentScoutEffectiveMainSkillEstimation
                      }
                      onShowEffectiveMainSkillEstimationChange={
                        setShowOpponentScoutEffectiveMainSkillEstimation
                      }
                      sortState={opponentScoutTeamSortState}
                      onSortChange={handleOpponentScoutTeamSort}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ) : null
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={closeOpponentAnalysisModal}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={closeOpponentAnalysisModal}
      />
      <Modal
        open={showSetBestLineupDebugModal && !!nonTraineeAssignmentModal}
        title={nonTraineeAssignmentModal?.title ?? messages.setBestLineupDevNonTraineeTraceTitle}
        className={`${styles.chronicleUpdatesModal} ${styles.nonTraineeAssignmentDebugModal}`}
        body={
          nonTraineeAssignmentModal ? (
            <div className={styles.algorithmsModalBody}>
              <p className={styles.chroniclePressMeta}>
                <strong>{messages.setBestLineupDevNonTraineeTraceTitle}</strong>
              </p>
              {nonTraineeAssignmentModal.entries.map((entry, index) => (
                <div key={`${entry.slot}-${index}`} className={styles.chroniclePressMeta}>
                  <p>
                    <strong>{`${index + 1}. ${entry.slot}`}</strong>
                    {" · "}
                    {playerNameById.get(entry.selectedPlayerId ?? 0) ??
                      (entry.selectedPlayerId ? String(entry.selectedPlayerId) : messages.setBestLineupDevUnfilledLabel)}
                  </p>
                  <p>
                    {messages.setBestLineupDevSelectedReasonLabel}: {entry.selectedReason}
                  </p>
                  <p>{messages.setBestLineupDevRankingLabel}</p>
                  <div className={styles.opponentFormationsTableWrap}>
                    <table className={styles.opponentFormationsTable}>
                      <thead>
                        <tr>
                          <th>{messages.setBestLineupDevRankLabel}</th>
                          <th>{messages.sortName}</th>
                          <th className={styles.opponentFormationsNumberHeader}>
                            {messages.setBestLineupDevSlotRatingLabel}
                          </th>
                          <th className={styles.opponentFormationsNumberHeader}>
                            {messages.setBestLineupDevSkillComboLabel}
                          </th>
                          <th className={styles.opponentFormationsNumberHeader}>
                            {messages.sortForm}
                          </th>
                          <th className={styles.opponentFormationsNumberHeader}>
                            {messages.sortStamina}
                          </th>
                          <th className={styles.opponentFormationsNumberHeader}>
                            {messages.setBestLineupDevOverallLabel}
                          </th>
                          <th className={styles.opponentFormationsNumberHeader}>
                            {messages.setBestLineupDevBestOtherRowLabel}
                          </th>
                          <th>{messages.setBestLineupDevRowFitLabel}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.ranking.map((candidate, candidateIndex) => (
                          <tr
                            key={`${entry.slot}-${candidate.playerId}`}
                            className={
                              candidate.playerId === entry.selectedPlayerId
                                ? styles.opponentFormationsSelectedRow
                                : undefined
                            }
                          >
                            <td className={styles.opponentFormationsMatchIdCell}>
                              {candidateIndex + 1}
                            </td>
                            <td>
                              {playerNameById.get(candidate.playerId) ?? String(candidate.playerId)}
                            </td>
                            <td className={styles.opponentFormationsNumberCell}>
                              {typeof candidate.slotRating === "number"
                                ? candidate.slotRating.toFixed(1)
                                : messages.unknownShort}
                            </td>
                            <td className={styles.opponentFormationsNumberCell}>
                              {candidate.skillCombo}
                            </td>
                            <td className={styles.opponentFormationsNumberCell}>
                              {candidate.form}
                            </td>
                            <td className={styles.opponentFormationsNumberCell}>
                              {candidate.stamina}
                            </td>
                            <td className={styles.opponentFormationsNumberCell}>
                              {candidate.overall}
                            </td>
                            <td className={styles.opponentFormationsNumberCell}>
                              {typeof candidate.bestOtherRowRating === "number"
                                ? candidate.bestOtherRowRating.toFixed(1)
                                : messages.unknownShort}
                            </td>
                            <td>
                              {candidate.passesRowFit ? messages.yesLabel : messages.noLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : null
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setNonTraineeAssignmentModal(null)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setNonTraineeAssignmentModal(null)}
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
              <>
                <p className={styles.errorDetails}>{opponentFormationsModal.error}</p>
                {process.env.NODE_ENV !== "production" &&
                opponentFormationsModal.fixedFormationFailureEligiblePlayerIds.length > 0 ? (
                  <p className={styles.chroniclePressMeta}>
                    {messages.setBestLineupDevEligiblePlayersLabel}:{" "}
                    {formatDebugPlayerNames(
                      opponentFormationsModal.fixedFormationFailureEligiblePlayerIds
                    )}
                  </p>
                ) : null}
                {process.env.NODE_ENV !== "production" &&
                opponentFormationsModal.fixedFormationFailureSlotDiagnostics.length > 0 ? (
                  <div className={styles.algorithmsModalBody}>
                    <p className={styles.chroniclePressMeta}>
                      <strong>{messages.setBestLineupDevAssignmentTraceLabel}</strong>
                    </p>
                    {opponentFormationsModal.fixedFormationFailureSlotDiagnostics.map((entry) => (
                      <div key={entry.slot} className={styles.chroniclePressMeta}>
                        <strong>{entry.slot}</strong>:{" "}
                        {entry.assignedPlayerId !== null
                          ? playerNameById.get(entry.assignedPlayerId) ??
                            String(entry.assignedPlayerId)
                          : messages.setBestLineupDevUnfilledLabel}
                        {entry.assignedPlayerId === null ? (
                          <>
                            {entry.noSlotRatingPlayerIds.length > 0 ? (
                              <div>
                                {messages.setBestLineupDevNoSlotRatingLabel}:{" "}
                                {formatDebugPlayerNames(entry.noSlotRatingPlayerIds)}
                              </div>
                            ) : null}
                            {entry.betterOtherSectorPlayerIds.length > 0 ? (
                              <div>
                                {messages.setBestLineupDevBetterOtherSectorLabel}:{" "}
                                {formatDebugPlayerNames(entry.betterOtherSectorPlayerIds)}
                              </div>
                            ) : null}
                            {entry.tiedOtherSectorPlayerIds.length > 0 ? (
                              <div>
                                {messages.setBestLineupDevTiedOtherSectorLabel}:{" "}
                                {formatDebugPlayerNames(entry.tiedOtherSectorPlayerIds)}
                              </div>
                            ) : null}
                            {entry.alreadyUsedPlayerIds.length > 0 ? (
                              <div>
                                {messages.setBestLineupDevAlreadyUsedLabel}:{" "}
                                {formatDebugPlayerNames(entry.alreadyUsedPlayerIds)}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
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
                    <p className={styles.chroniclePressMeta}>
                      {messages.seniorAiManMarkingFuzzinessLabel}:{" "}
                      <strong>{seniorAiManMarkingFuzziness}</strong>
                    </p>
                    <p className={styles.chroniclePressMeta}>
                      {messages.setBestLineupDevPotentialTargetsLabel}:{" "}
                      <strong>
                        {renderOpponentTargetSummary(
                          opponentFormationsModal.potentialManMarkingTargets,
                          opponentFormationsModal.manMarkingTarget
                        )}
                      </strong>
                    </p>
                    <p className={styles.chroniclePressMeta}>
                      {messages.setBestLineupDevFinalTargetLabel}:{" "}
                      <strong>
                        {opponentFormationsModal.manMarkingTarget
                          ? `${opponentFormationsModal.manMarkingTarget.name} (${opponentTrackedRoleLabel(
                              opponentFormationsModal.manMarkingTarget.role
                            )})`
                          : messages.setBestLineupDevPotentialTargetsNone}
                      </strong>
                    </p>
                    <p className={styles.chroniclePressMeta}>
                      {messages.setBestLineupDevFinalMarkerLabel}:{" "}
                      <strong>
                        {opponentFormationsModal.manMarkingMarker
                          ? `${opponentFormationsModal.manMarkingMarker.name} (${opponentFormationsModal.manMarkingMarker.role})`
                          : messages.setBestLineupDevPotentialTargetsNone}
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
                            <th>{messages.setBestLineupDevLineupColumn}</th>
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
                                  href={hattrickMatchUrlWithSourceSystem(
                                    row.matchId,
                                    row.sourceSystem
                                  )}
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
                              <td>
                                {renderOpponentTrackedLineup(
                                  row,
                                  opponentFormationsModal.potentialManMarkingTargets,
                                  opponentFormationsModal.manMarkingTarget
                                )}
                              </td>
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
                              <td colSpan={5}>
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

      {mobileSeniorActive ? (
        <>
          <MobileToolMenu
            messages={messages}
            toggleLabel={messages.mobileSeniorMenuToggleLabel}
            teamLabel={messages.seniorTeamLabel}
            teamOptions={seniorTeams.map((team) => ({
              id: team.teamId,
              label: formatSeniorTeamOptionLabel(team),
            }))}
            selectedTeamId={selectedSeniorTeamId}
            onHome={openMobileSeniorHome}
            onOpenHelp={() => pushMobileSeniorState("help", "root")}
            onOpenPlayerList={() => pushMobileSeniorState("playerDetails", "list")}
            onTeamChange={handleSeniorTeamChange}
            onRefresh={() => {
              void refreshAllRef.current?.("manual");
            }}
            onOpenUpdates={() => setUpdatesOpen(true)}
            activeView={mobileSeniorView}
            playerListActive={
              mobileSeniorView === "playerDetails" && mobileSeniorPlayerScreen === "list"
            }
            onSelectView={handleMobileSeniorViewSelect}
            position={mobileSeniorMenuPosition}
            onPositionChange={setMobileSeniorMenuPosition}
          />
          {mobileSeniorRefreshFeedbackVisible && mobileSeniorRefreshStatus ? (
            <div className={styles.mobileYouthRefreshStatus} aria-live="polite">
              <span className={styles.mobileYouthRefreshStatusText}>
                {mobileSeniorRefreshStatus}
              </span>
              {refreshing ? (
                <span className={styles.mobileYouthRefreshProgressTrack} aria-hidden="true">
                  <span
                    className={styles.mobileYouthRefreshProgressFill}
                    style={{
                      width: `${Math.max(0, Math.min(100, refreshProgressPct || 0))}%`,
                    }}
                  />
                </span>
              ) : null}
            </div>
          ) : null}
          {mobileSeniorContent}
        </>
      ) : showHelp ? (
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
      {!mobileSeniorActive ? <div className={styles.dashboardGrid}>
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
                    setSortDirection(defaultSortDirectionForKey(nextKey));
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
                  <optgroup label={messages.skillsLabel}>
                    <option value="keeper">{messages.sortKeeper}</option>
                    <option value="defender">{messages.sortDefender}</option>
                    <option value="playmaker">{messages.sortPlaymaker}</option>
                    <option value="winger">{messages.sortWinger}</option>
                    <option value="passing">{messages.sortPassing}</option>
                    <option value="scorer">{messages.sortScorer}</option>
                    <option value="setpieces">{messages.sortSetPieces}</option>
                  </optgroup>
                </select>
              </label>
              <Tooltip content={messages.sortToggleAria}>
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
              </Tooltip>
            </div>
          </div>
          {orderedListPlayers.length === 0 ? (
            <p className={styles.muted}>{messages.unableToLoadPlayers}</p>
          ) : (
            <ul className={styles.list}>
              {orderedListPlayers.map((player) => {
                const playerDetails = detailsById.get(player.PlayerID);
                const originFlagDisplay =
                  panelDetailsById.get(player.PlayerID)?.OriginFlagDisplay ?? null;
                const playerName = formatPlayerName(player);
                const isExcluded = isPlayerExcluded(excludedPlayers, player.PlayerID);
                const hasMotherClubBonus = Boolean(playerDetails?.MotherClubBonus);
                const transferListing = seniorTransferListingForDetails(playerDetails);
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
                const isBruised =
                  injuryLevel !== null &&
                  (injuryLevel === 0 || (injuryLevel > 0 && injuryLevel < 1));
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
                          {wageValue !== null ? formatDisplayCurrencyFromSek(wageValue) : messages.unknownShort}
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
                      <LineupExcludeButton
                        playerName={playerName}
                        excluded={isExcluded}
                        onToggle={() => handleToggleSeniorExcludedPlayer(player.PlayerID)}
                        messages={messages}
                      />
                      <Tooltip content={messages.youthDragToLineupHint} fullWidth>
                        <button
                          type="button"
                          className={`${styles.playerButton} ${
                            isExcluded ? styles.lineupExcludedPlayerButton : ""
                          }`}
                          aria-pressed={isSelected}
                          onClick={() =>
                            handleSeniorListPlayerSelect(player.PlayerID, playerName)
                          }
                          draggable={!mobileSeniorActive && !isExcluded}
                          onDragStart={(event) =>
                            !mobileSeniorActive
                              ? handleSeniorPlayerDragStart(
                                  event,
                                  player.PlayerID,
                                  playerName
                                )
                              : undefined
                          }
                        >
                        <span
                          className={`${styles.playerNameRow} ${styles.seniorPlayerNameRow} ${
                            isNameSort ? styles.playerNameRowTruncate : ""
                          }`}
                        >
                          <span
                            className={`${styles.playerName} ${styles.seniorPlayerName}`}
                            title={playerName}
                          >
                            {playerName}
                          </span>
                          {originFlagDisplay ? (
                            <OriginFlag
                              display={originFlagDisplay}
                              className={styles.transferSearchCardNationality}
                            />
                          ) : null}
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
                          {transferListing ? (
                            <SeniorTransferListedIndicator
                              listing={transferListing}
                              messages={messages}
                              formatSekValue={formatDisplayCurrencyFromSek}
                              compact
                              nested
                            />
                          ) : null}
                          {specialty && SPECIALTY_EMOJI[specialty] ? (
                            <span className={styles.playerSpecialty}>
                              {SPECIALTY_EMOJI[specialty]}
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.playerIndicators}>
                          {isNameSort ? (
                            ageLabel && agePillClassName ? (
                              <span className={`${styles.playerAgePill} ${agePillClassName}`}>
                                {ageLabel}
                              </span>
                            ) : null
                          ) : (
                            metricNode
                          )}
                        </span>
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
                <li>{messages.seniorHelpBulletPredictedRatings}</li>
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
            lastUpdated={
              observedSeniorPlayerActive
                ? observedSeniorPlayer?.fetchedAt ?? null
                : selectedId
                  ? detailsCache[selectedId]?.fetchedAt ?? null
                  : null
            }
            unlockStatus={null}
            onRefresh={handleSeniorDetailsRefresh}
            players={panelPlayers}
            playerDetailsById={panelDetailsById}
            skillsMatrixRows={skillsMatrixRows}
            ratingsMatrixResponse={ratingsResponse}
            ratingsManualOverrideEnabled={effectiveRatingsManualOverrideEnabled}
            onRatingsManualOverrideEnabledChange={handleRatingsManualOverrideEnabledChange}
            ratingsManualOverrideTooltip={
              premiumUnlocked
                ? messages.ratingsManualOverrideTooltip
                : messages.ratingsManualOverridePremiumTooltip
            }
            onRatingsManualEditingToggleInteraction={() =>
              trackSeniorFeatureUsed("ratings_manual_edit_toggled")
            }
            ratingsOverwriteManualEditsEnabled={ratingsOverwriteManualEditsEnabled}
            onRatingsOverwriteManualEditsEnabledChange={
              handleRatingsOverwriteManualEditsEnabledChange
            }
            onRatingsDiscardManualEdits={handleDiscardRatingsManualEdits}
            ratingsHasManualEdits={hasManualRatingsEdits}
            onRatingsManualCellChange={handleRatingsManualCellChange}
            ratingsManualEditsByPlayerId={ratingsManualEditsByPlayerId}
            ratingsMatrixSelectedName={
              observedSeniorPlayerActive || !selectedOwnPlayer
                ? null
                : formatPlayerName(selectedOwnPlayer)
            }
            ratingsMatrixSpecialtyByName={specialtyByName}
            ratingsMatrixMotherClubBonusByName={motherClubBonusByName}
            ratingsMatrixCardStatusByName={seniorCardStatusByName}
            ratingsMatrixTransferListingByName={transferListingByName}
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
            hasPreviousPlayer={!observedSeniorPlayerActive && Boolean(previousPlayerId)}
            hasNextPlayer={!observedSeniorPlayerActive && Boolean(nextPlayerId)}
            onPreviousPlayer={() => {
              if (observedSeniorPlayerActive) return;
              if (!previousPlayerId) return;
              setActiveDetailsTab("details");
              setSelectedId(previousPlayerId);
            }}
            onNextPlayer={() => {
              if (observedSeniorPlayerActive) return;
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
            detailsHeaderActions={seniorDetailsHeaderActions}
            detailsNotice={
              observedSeniorPlayerActive ? messages.seniorObservedExternalPlayerNotice : null
            }
            onSeniorSimulationStateChange={handleSelectedPlayerSimulationStateChange}
            seniorSimulationEditingBlocked={!premiumUnlocked}
            onSeniorSimulationBlockedInteraction={() =>
              openPremiumLicenseModal(seniorSimulationLicenseContext)
            }
            onSeniorSimulationEditingToggleInteraction={() =>
              trackSeniorFeatureUsed("edit_skills_age_wage_tsi_toggled")
            }
            messages={messages}
          displayCurrency={displayCurrency}
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
              excludedPlayers={excludedPlayers}
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
                if (isPlayerExcluded(excludedPlayers, playerId)) return;
                const nextAssignments = { ...assignments };
                Object.keys(nextAssignments).forEach((key) => {
                  if (nextAssignments[key] === playerId) {
                    nextAssignments[key] = null;
                  }
                });
                nextAssignments[slotId] = playerId;
                setAssignments(nextAssignments);
                markSeniorLineupMutated();
                preservePreparedSeniorAiContextAfterManualEdit(
                  nextAssignments,
                  behaviors,
                  tacticType
                );
              }}
              onClear={(slotId) => {
                const nextAssignments = { ...assignments, [slotId]: null };
                setAssignments(nextAssignments);
                markSeniorLineupMutated();
                preservePreparedSeniorAiContextAfterManualEdit(
                  nextAssignments,
                  behaviors,
                  tacticType
                );
              }}
              onMove={(fromSlot, toSlot) => {
                const movingPlayerId = assignments[fromSlot] ?? null;
                if (isPlayerExcluded(excludedPlayers, movingPlayerId)) return;
                const nextAssignments = {
                  ...assignments,
                  [toSlot]: assignments[fromSlot] ?? null,
                  [fromSlot]: assignments[toSlot] ?? null,
                };
                setAssignments(nextAssignments);
                markSeniorLineupMutated();
                preservePreparedSeniorAiContextAfterManualEdit(
                  nextAssignments,
                  behaviors,
                  tacticType
                );
              }}
              onChangeBehavior={(slotId, behavior) => {
                const nextBehaviors = { ...behaviors };
                if (behavior) nextBehaviors[slotId] = behavior;
                else delete nextBehaviors[slotId];
                setBehaviors(nextBehaviors);
                preservePreparedSeniorAiContextAfterManualEdit(
                  assignments,
                  nextBehaviors,
                  tacticType
                );
              }}
              onReset={() => {
                setAssignments({});
                markSeniorLineupMutated();
                setBehaviors({});
                setLoadedMatchId(null);
                clearSeniorRatingsPrediction();
                clearSeniorAiSubmitLock();
                addNotification(messages.notificationLineupReset);
              }}
              tacticType={tacticType}
              onTacticChange={(nextTacticType) => {
                setTacticType(nextTacticType);
                preservePreparedSeniorAiContextAfterManualEdit(
                  assignments,
                  behaviors,
                  nextTacticType
                );
              }}
              tacticPlacement="headerRight"
              trainingType={trainingType}
              onTrainingTypeChange={setTrainingType}
              onTrainingTypeSet={handleSetTrainingType}
              trainingTypeSetPending={trainingTypeSetPending}
              trainingTypeSetPendingValue={trainingTypeSetPendingValue}
              trainingTypePlacement="fieldTopLeft"
              topRightOverlayContent={seniorPredictedRatingsOverlay}
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
              emptySlotPickerOptions={seniorEmptySlotPickerOptions}
              titleNote={messages.lineupEmptySlotRecommendationsHint}
              skillMode="single"
              maxSkillLevel={20}
              lineupActionsRightContent={renderSeniorOtherOrdersButton()}
              messages={messages}
            />
          </div>
          <SeniorMatchesPanel
            response={matchesState}
            messages={messages}
            currentSeason={currentSeason}
            selectedSeniorTeamId={resolvedSeniorTeamId}
            defaultCoachLeadership={ownSeniorTeamTrainerLeadership}
            assignments={assignments}
            behaviors={behaviors}
            captainId={effectiveSeniorCaptainId}
            penaltyKickerIds={effectiveSeniorPenaltyKickerIds}
            setPiecesId={effectiveSeniorSetPiecesPlayerId}
            tacticType={tacticType}
            sourceSystem="Hattrick"
            includeTournamentMatches={includeTournamentMatches}
            onIncludeTournamentMatchesChange={setIncludeTournamentMatches}
            getOpponentCupStatus={getOpponentCupStatus}
            ensureOpponentCupStatus={fetchOpponentCupStatus}
            setBestLineupHelpAnchor="senior-set-lineup-ai"
            showExtraTimeSetBestLineupMode
            keepBestLineupMenuTopmost
            fixedFormationOptions={[...FIXED_FORMATION_OPTIONS]}
            selectedFixedFormation={setBestLineupFixedFormation}
            onSelectedFixedFormationChange={setSetBestLineupFixedFormation}
            fixedFormationBlocked={!premiumUnlocked}
            onBlockedFixedFormationInteraction={() =>
              openPremiumLicenseModal(seniorFixedFormationLicenseContext)
            }
            selectedIgnoreTrainingFormationPolicy={ignoreTrainingFormationPolicy}
            onSelectedIgnoreTrainingFormationPolicyChange={
              setIgnoreTrainingFormationPolicy
            }
            analyticsSource="mobile"
            seniorSubmittedLineupVariantFeature={
              pendingSeniorSubmittedLineupVariantFeature
            }
            onAnalyticsFeature={(feature, source) => trackSeniorFeatureUsed(feature, source)}
            setBestLineupCustomContent={buildSetBestLineupBTeamMenuContent("mobile")}
            setBestLineupDisabledTooltipBuilder={getSetBestLineupDisabledTooltip}
            onRefresh={onRefreshMatchesOnly}
            onSetBestLineupMode={async (matchId, mode, fixedFormation, options) => {
              clearSeniorAiSubmitLock();
              if (mode === "extraTime") {
                setExtraTimeMatchId(matchId);
                await syncExtraTimeModalTrainingType().catch(() => {
                  // Fall back to the last known senior training if the live fetch fails.
                });
                setExtraTimeInfoOpen(true);
                return;
              }
              if (mode === "trainingAware") {
                setTrainingAwareMatchId(matchId);
                await syncTrainingAwareModalTrainingType().catch(() => {
                  // Fall back to the last known senior training if the live fetch fails.
                });
                setTrainingAwareInfoOpen(true);
                return;
              }
              return runSetBestLineupPredictRatings(
                matchId,
                mode,
                fixedFormation,
                options
              );
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
              loadedTacticType,
              loadedOrders
            ) => {
              clearSeniorAiSubmitLock();
              setAssignments(nextAssignments);
              markSeniorLineupMutated();
              setBehaviors(nextBehaviors);
              if (typeof loadedTacticType === "number") {
                setTacticType(loadedTacticType);
              }
              if (loadedOrders) {
                setLoadedLineupOrdersByMatchId((prev) => ({
                  ...prev,
                  [matchId]: loadedOrders,
                }));
                const loadedPayload = buildLineupPayload(
                  nextAssignments,
                  loadedTacticType ?? tacticType,
                  {
                    behaviors: nextBehaviors,
                    kickerIds: loadedOrders.penaltyKickerIds,
                    captainId: loadedOrders.captainId ?? 0,
                    setPiecesId: loadedOrders.setPiecesId ?? 0,
                    substitutions: loadedOrders.substitutions,
                  }
                );
                loadedPayload.settings.speechLevel = loadedOrders.matchAttitude ?? 0;
                loadedPayload.settings.coachModifier = loadedOrders.coachModifier ?? 0;
                loadedPayload.settings.manMarkerPlayerId =
                  loadedOrders.manMarkerPlayerId ?? 0;
                loadedPayload.settings.manMarkingPlayerId =
                  loadedOrders.manMarkingPlayerId ?? 0;
                setSeniorEditableOrdersState(
                  sanitizeSeniorEditableOrdersSetPieces(
                    buildSeniorEditableOrdersFromPayload(matchId, loadedPayload, "loaded")
                  )
                );
              }
              setLoadedMatchId(matchId);
              setSeniorRatingsMatchContext(buildSeniorRatingsMatchContext(matchId));
              setOtherOrdersModalMatchId(matchId);
              setOtherOrdersEditorOpen(true);
            }}
            loadedMatchId={loadedMatchId}
            onSubmitSuccess={(submittedMatchId, submittedLineupPayload) => {
              if (extraTimePreparedSubmission) {
                try {
                  setSubmitDisclaimerExtraTimeSummary(buildExtraTimeSubmitDisclaimerSummary());
                } catch {
                  setSubmitDisclaimerExtraTimeSummary(null);
                }
                setSubmitDisclaimerManMarkingSummary(null);
                setSubmitDisclaimerSeniorOrdersSummary(null);
              } else {
                setSubmitDisclaimerExtraTimeSummary(null);
                setSubmitDisclaimerSeniorOrdersSummary(
                  seniorAiPreparedSubmissionMode === "trainingAware" ||
                    seniorAiPreparedSubmissionMode === "ignoreTraining" ||
                    seniorAiPreparedSubmissionMode === "fixedFormation"
                    ? buildSeniorSubmitDisclaimerOrdersSummary(submittedLineupPayload)
                    : null
                );
                setSubmitDisclaimerManMarkingSummary(
                  buildSeniorSubmitDisclaimerManMarkingSummary(submittedMatchId)
                );
              }
              clearSeniorAiSubmitLock();
              setSubmitDisclaimerOpen(true);
              void onRefreshMatchesOnly();
            }}
            submitEnabledMatchId={seniorAiSubmitTargetMatchId}
            canSubmitToHattrick={isSupporter}
            submitUnavailableTooltip={messages.hattrickSupporterActionRequiredTooltip}
            submitRestrictedTooltipBuilder={(targetMatch) => {
              if (!targetMatch) return messages.submitOrdersTooltip;
              const home = targetMatch.HomeTeam?.HomeTeamName ?? messages.homeLabel;
              const away = targetMatch.AwayTeam?.AwayTeamName ?? messages.awayLabel;
              const parsedMatchDate = parseChppDate(targetMatch.MatchDate);
              const datetime = parsedMatchDate
                ? formatDateTime(parsedMatchDate)
                : messages.unknownDate;
              return messages.seniorSubmitOrdersOtherMatchTooltip
                .replace("{{home}}", home)
                .replace("{{away}}", away)
                .replace("{{datetime}}", datetime);
            }}
            buildSubmitLineupPayload={(matchId, defaultPayload) =>
              buildSeniorSubmitLineupPayload(matchId, defaultPayload)
            }
          />
        </div>
      </div> : null}
      {process.env.NEXT_PUBLIC_HT_ALCHEMY_PREMIUM_ENABLED === "true" ? (
        <AppLicenseModal
          key={premiumLicenseModalNonce}
          open={premiumLicenseModalOpen}
          messages={messages}
          context={premiumLicenseModalContext}
          onClose={() => setPremiumLicenseModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
