"use client";

import {
  Children,
  Fragment,
  type CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../page.module.css";
import Tooltip from "./Tooltip";
import ClubChronicle from "./ClubChronicle";
import ChppAccessGate from "./ChppAccessGate";
import { DisplayCurrencyProvider } from "./DisplayCurrencyProvider";
import Modal from "./Modal";
import ManualModal from "./ManualModal";
import ReminderBell from "./reminders/ReminderBell";
import ReminderBatchModal from "./reminders/ReminderBatchModal";
import { ReminderBellSlotProvider } from "./reminders/ReminderBellSlot";
import { useNotifications } from "./notifications/NotificationsProvider";
import BuyCoffeeButton, { type BuyCoffeePromptSource } from "./BuyCoffeeButton";
import PremiumStatusPill from "./PremiumStatusPill";
import VersionUpdateGate from "./VersionUpdateGate";
import { Messages } from "@/lib/i18n";
import { getChangelogEntries } from "@/lib/changelog";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatDateTime } from "@/lib/datetime";
import {
  CHPP_ACCESS_BLOCKED_EVENT,
  ChppAccessBlockedError,
  type ChppAccessBlockedDetail,
  fetchChppJson,
  reconnectChppWithTokenReset,
  writeChppDebugOauthErrorMode,
} from "@/lib/chpp/client";
import {
  BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT,
  BUY_COFFEE_PROMPT_OPEN_EVENT,
} from "@/lib/settings";
import { APP_SHELL_OPEN_TOOL_EVENT } from "@/lib/chronicleWatchlistTransfer";
import { runStartupStorageHousekeeping } from "@/lib/storageHousekeeping";
import {
  dismissReminder,
  resolveReminderEvaluation,
  snoozeReminder,
} from "@/lib/reminders/engine";
import {
  emptyReminderStorageState,
  readReminderStorageState,
  setRemindersEnabled,
  subscribeReminderStorageState,
  writeReminderStorageState,
} from "@/lib/reminders/storage";
import {
  ALL_REMINDER_RULES,
  evaluateRegisteredReminderEpisodes,
  evaluateRegisteredReminderCandidates,
  type GlobalReminderContext,
} from "@/lib/reminders/registry";
import type {
  ReminderAction,
  ReminderDisplayItem,
} from "@/lib/reminders/types";
import {
  hattrickMatchUrlWithSourceSystem,
} from "@/lib/hattrick/urls";
import {
  SENIOR_OPEN_FIND_SIMILAR_PLAYERS_EVENT,
  SENIOR_REMINDER_CONTEXT_EVENT,
  type SeniorFindSimilarPlayersEventDetail,
  type SeniorReminderContext,
  type SeniorReminderContextEventDetail,
  type SeniorReminderPlayer,
  type SeniorReminderTeamContext,
} from "@/lib/reminders/senior";
import { updateSeniorSalaryBaseline } from "@/lib/reminders/seniorSalaryBaseline";
import {
  MATCH_REMINDER_CONTEXT_EVENT,
  type MatchReminderContext,
  type MatchReminderContextEventDetail,
} from "@/lib/reminders/matches";
import {
  YOUTH_PROMOTION_REMINDER_CONTEXT_EVENT,
  type YouthPromotionReminderContext,
  type YouthPromotionReminderContextEventDetail,
  type YouthPromotionReminderDetails,
  type YouthPromotionReminderPlayer,
} from "@/lib/reminders/youthPromotion";
import {
  CLUB_CHRONICLE_REMINDER_CONTEXT_EVENT,
  type ClubChronicleReminderContext,
  type ClubChronicleReminderContextEventDetail,
} from "@/lib/reminders/clubChronicle";
import {
  TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT,
  TRANSFER_MARKET_OPEN_PROFILES_EVENT,
} from "@/lib/transferMarket/events";

type AppShellProps = {
  messages: Messages;
  appVersion: string;
  globalHeader: ReactNode;
  children: ReactNode;
  seniorTool: ReactNode;
  transferMarketTool: ReactNode;
  initialSeniorTeams?: Array<{
    teamId: number;
    teamName: string;
    leagueId?: number | null;
    countryId?: number | null;
    isPrimaryClub?: boolean;
    teamGender: "male" | "female" | null;
  }>;
  initialSeniorTeamId?: number | null;
  initialYouthTeams?: Array<{
    youthTeamId: number;
    youthTeamName: string;
    countryId?: number | null;
    isPrimaryClub?: boolean;
  }>;
  initialYouthTeamId?: number | null;
  primarySeniorTeamCountryId?: number | null;
  mobileLauncherUtility?: ReactNode;
};

type ToolId = "youth" | "senior" | "chronicle" | "transferMarket";
type ToolSelectionSource = "desktop_sidebar" | "mobile_launcher";

type ViewStateSnapshot = {
  activeTool: ToolId;
  collapsed: boolean;
  windowScrollX: number;
  windowScrollY: number;
  mainScrollTop: number | null;
  mainScrollLeft: number | null;
  chroniclePanelScroll: Record<string, number>;
  capturedAt: number;
};

type BuyCoffeePromptState = {
  firstSeenAt: number;
  lastPromptAt: number | null;
  cadenceDays: number;
};

type PendingReminderActionConfirmation = {
  action: ReminderAction;
  item: ReminderDisplayItem;
} | null;

const APP_SHELL_VIEW_STATE_KEY = "ya_app_shell_view_state_v1";
const APP_SHELL_ACTIVE_TOOL_KEY = "ya_app_shell_active_tool_v1";
const APP_SHELL_COLLAPSED_KEY = "ya_app_shell_collapsed_v1";
const CHANGELOG_SEEN_LATEST_ENTRY_KEY = "ya_changelog_seen_latest_entry_v1";
const BUY_COFFEE_PROMPT_STORAGE_KEY = "ya_buy_me_coffee_prompt_v1";
const BUY_COFFEE_INITIAL_DELAY_MS = 30 * 1000;
const BUY_COFFEE_FIRST_PROMPT_MS = 7 * 24 * 60 * 60 * 1000;
const BUY_COFFEE_DEFAULT_CADENCE_DAYS = 7;
const BUY_COFFEE_SUPPORTED_CADENCE_DAYS = 30;
const YOUTH_REFRESH_REQUEST_EVENT = "ya:youth-refresh-request";
const YOUTH_REFRESH_STOP_EVENT = "ya:youth-refresh-stop";
const YOUTH_REFRESH_STATE_EVENT = "ya:youth-refresh-state";
const YOUTH_LATEST_UPDATES_OPEN_EVENT = "ya:youth-latest-updates-open";
const SENIOR_REFRESH_REQUEST_EVENT = "ya:senior-refresh-request";
const SENIOR_REFRESH_STOP_EVENT = "ya:senior-refresh-stop";
const SENIOR_REFRESH_STATE_EVENT = "ya:senior-refresh-state";
const SENIOR_LATEST_UPDATES_OPEN_EVENT = "ya:senior-latest-updates-open";
const MOBILE_LAUNCHER_REQUEST_EVENT = "ya:mobile-launcher-request";
const MOBILE_NAV_TRAIL_STATE_EVENT = "ya:mobile-nav-trail-state";
const MOBILE_NAV_TRAIL_JUMP_EVENT = "ya:mobile-nav-trail-jump";
const MOBILE_LAYOUT_MAX_WIDTH = 900;
const MOBILE_LAYOUT_MEDIA_QUERY = `(max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px)`;
const SENIOR_DASHBOARD_DATA_STORAGE_KEY = "ya_senior_dashboard_data_v1";
const YOUTH_DASHBOARD_STATE_STORAGE_KEY = "ya_dashboard_state_v2";

type MobileNavSegment = {
  id: string;
  label: string;
};

const parseBuyCoffeePromptSource = (
  value: unknown
): BuyCoffeePromptSource => {
  return value === "top_bar" ||
    value === "sidebar" ||
    value === "mobile_launcher" ||
    value === "auto"
    ? value
    : "unknown";
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMobileLayoutViewport = () => {
  if (typeof window === "undefined") return false;

  const visualViewportWidth = window.visualViewport?.width;
  const cssViewportMobile =
    window.matchMedia?.(MOBILE_LAYOUT_MEDIA_QUERY).matches === true ||
    window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH ||
    (typeof visualViewportWidth === "number" &&
      visualViewportWidth <= MOBILE_LAYOUT_MAX_WIDTH);

  const screenWidth = window.screen?.width;
  const screenHeight = window.screen?.height;
  const physicalScreenMin = Math.min(
    typeof screenWidth === "number" && screenWidth > 0
      ? screenWidth
      : Number.POSITIVE_INFINITY,
    typeof screenHeight === "number" && screenHeight > 0
      ? screenHeight
      : Number.POSITIVE_INFINITY
  );

  const coarsePointer =
    window.matchMedia?.("(pointer: coarse)").matches === true ||
    navigator.maxTouchPoints > 0;

  const noHover = window.matchMedia?.("(hover: none)").matches === true;
  const phoneOrSmallTabletInDesktopSiteMode =
    physicalScreenMin <= MOBILE_LAYOUT_MAX_WIDTH && coarsePointer && noHover;

  return cssViewportMobile || phoneOrSmallTabletInDesktopSiteMode;
};

const normalizeToolId = (value: unknown): ToolId =>
  value === "chronicle" ||
  value === "senior" ||
  value === "transferMarket" ||
  value === "youth"
    ? value
    : "youth";

const resolveSeniorDashboardDataStorageKey = (
  teamId: number | null,
  multiTeamEnabled: boolean
) =>
  multiTeamEnabled && typeof teamId === "number" && teamId > 0
    ? `${SENIOR_DASHBOARD_DATA_STORAGE_KEY}_${teamId}`
    : SENIOR_DASHBOARD_DATA_STORAGE_KEY;

const resolveYouthDashboardStateStorageKey = (
  youthTeamId: number | null,
  multiTeamEnabled: boolean
) =>
  multiTeamEnabled && typeof youthTeamId === "number" && youthTeamId > 0
    ? `${YOUTH_DASHBOARD_STATE_STORAGE_KEY}_${youthTeamId}`
    : YOUTH_DASHBOARD_STATE_STORAGE_KEY;

const resolveCachedYouthPromotionDetails = (
  entry: unknown
): YouthPromotionReminderDetails | null => {
  if (!isObject(entry) || !isObject(entry.data)) return null;
  const data = entry.data;
  const hattrickData = isObject(data.HattrickData) ? data.HattrickData : null;
  const youthPlayer =
    hattrickData && isObject(hattrickData.YouthPlayer)
      ? hattrickData.YouthPlayer
      : null;
  const source = youthPlayer ?? data;
  return {
    CanBePromotedIn:
      typeof source.CanBePromotedIn === "number"
        ? source.CanBePromotedIn
        : undefined,
  };
};

export default function AppShell({
  messages,
  appVersion,
  globalHeader,
  children,
  seniorTool,
  transferMarketTool,
  initialSeniorTeams = [],
  initialSeniorTeamId = null,
  initialYouthTeams = [],
  initialYouthTeamId = null,
  primarySeniorTeamCountryId = null,
  mobileLauncherUtility,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("youth");
  const [mobileLayoutActive, setMobileLayoutActive] = useState(false);
  const [mobileLauncherOpen, setMobileLauncherOpen] = useState(false);
  const [mobileNavSegments, setMobileNavSegments] = useState<MobileNavSegment[]>([]);
  const [viewStateRestored, setViewStateRestored] = useState(false);
  const [topBarHeight, setTopBarHeight] = useState(56);
  const [mobileNavHeaderHeight, setMobileNavHeaderHeight] = useState(56);
  const [youthRefreshing, setYouthRefreshing] = useState(false);
  const [youthRefreshStatus, setYouthRefreshStatus] = useState<string | null>(null);
  const [youthRefreshProgressPct, setYouthRefreshProgressPct] = useState(0);
  const [youthLastRefreshAt, setYouthLastRefreshAt] = useState<number | null>(null);
  const [seniorRefreshing, setSeniorRefreshing] = useState(false);
  const [seniorRefreshStatus, setSeniorRefreshStatus] = useState<string | null>(null);
  const [seniorRefreshProgressPct, setSeniorRefreshProgressPct] = useState(0);
  const [seniorLastRefreshAt, setSeniorLastRefreshAt] = useState<number | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [changelogPage, setChangelogPage] = useState(0);
  const [scopeReconnectModalOpen, setScopeReconnectModalOpen] = useState(false);
  const [buyCoffeePromptOpen, setBuyCoffeePromptOpen] = useState(false);
  const [buyCoffeePromptSource, setBuyCoffeePromptSource] =
    useState<BuyCoffeePromptSource>("unknown");
  const [chppAccessBlock, setChppAccessBlock] =
    useState<ChppAccessBlockedDetail | null>(null);
  const [buyCoffeePromptState, setBuyCoffeePromptState] =
    useState<BuyCoffeePromptState | null>(null);
  const [buyCoffeeSessionReady, setBuyCoffeeSessionReady] = useState(false);
  const [reminderStorageState, setReminderStorageState] = useState(
    emptyReminderStorageState
  );
  const [reminderBatchItems, setReminderBatchItems] = useState<
    ReminderDisplayItem[]
  >([]);
  const [
    pendingReminderActionConfirmation,
    setPendingReminderActionConfirmation,
  ] = useState<PendingReminderActionConfirmation>(null);
  const [seniorReminderContext, setSeniorReminderContext] =
    useState<SeniorReminderContext | null>(null);
  const [seniorMatchReminderContext, setSeniorMatchReminderContext] =
    useState<MatchReminderContext | null>(null);
  const [youthMatchReminderContext, setYouthMatchReminderContext] =
    useState<MatchReminderContext | null>(null);
  const [youthPromotionReminderContext, setYouthPromotionReminderContext] =
    useState<YouthPromotionReminderContext | null>(null);
  const [clubChronicleReminderContext, setClubChronicleReminderContext] =
    useState<ClubChronicleReminderContext | null>(null);
  const shellTopBarRef = useRef<HTMLDivElement | null>(null);
  const mobileNavHeaderRef = useRef<HTMLDivElement | null>(null);
  const buyCoffeePromptShownThisSessionRef = useRef(false);
  const surfacedReminderTriggerKeysThisSessionRef = useRef(new Set<string>());
  const seniorCachedReminderContextSignatureRef = useRef<string | null>(null);
  const youthCachedPromotionReminderContextSignatureRef = useRef<string | null>(
    null
  );
  const mobileLayoutInitializedRef = useRef(false);
  const { addNotification } = useNotifications();

  const persistBuyCoffeePromptState = (nextState: BuyCoffeePromptState) => {
    setBuyCoffeePromptState(nextState);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        BUY_COFFEE_PROMPT_STORAGE_KEY,
        JSON.stringify(nextState)
      );
    } catch {
      // ignore storage errors
    }
  };

  const ensureRefreshScopes = async () => {
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
      return true;
    } catch (error) {
      if (error instanceof ChppAccessBlockedError) return false;
      setScopeReconnectModalOpen(true);
      return false;
    }
  };

  const tools = useMemo(
    () => [
      {
        id: "youth" as const,
        label: messages.toolYouthOptimization,
        icon: "✨",
        badge: messages.toolYouthBadge,
      },
      {
        id: "senior" as const,
        label: messages.toolSeniorOptimization,
        icon: "✨",
        badge: messages.toolSeniorBadge,
      },
      {
        id: "chronicle" as const,
        label: messages.toolClubChronicle,
        icon: "📰",
      },
      {
        id: "transferMarket" as const,
        label: messages.toolTransferMarket,
        icon: "🔍",
      },
    ],
    [
      messages.toolClubChronicle,
      messages.toolSeniorBadge,
      messages.toolSeniorOptimization,
      messages.toolTransferMarket,
      messages.toolYouthBadge,
      messages.toolYouthOptimization,
    ]
  );

  useEffect(() => {
    runStartupStorageHousekeeping();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleChppAccessBlocked = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as ChppAccessBlockedDetail | undefined)
          : undefined;
      if (!detail) return;
      setChppAccessBlock(detail);
      setMobileLauncherOpen(false);
      setBuyCoffeePromptOpen(false);
      setScopeReconnectModalOpen(false);
      setReminderBatchItems([]);
      setPendingReminderActionConfirmation(null);
    };
    window.addEventListener(CHPP_ACCESS_BLOCKED_EVENT, handleChppAccessBlocked);
    return () =>
      window.removeEventListener(CHPP_ACCESS_BLOCKED_EVENT, handleChppAccessBlocked);
  }, []);

  useEffect(() => {
    const syncReminderStorage = () => {
      const nextState = readReminderStorageState();
      setReminderStorageState((current) =>
        JSON.stringify(current) === JSON.stringify(nextState)
          ? current
          : nextState
      );
    };
    syncReminderStorage();
    return subscribeReminderStorageState(syncReminderStorage);
  }, []);

  const initialSeniorTeamsSignature = useMemo(
    () =>
      JSON.stringify(
        initialSeniorTeams.map((team) => ({
          teamId: team.teamId,
        }))
      ),
    [initialSeniorTeams]
  );
  const initialSeniorReminderTeamIds = useMemo(() => {
    const parsed = JSON.parse(initialSeniorTeamsSignature) as Array<{
      teamId?: unknown;
    }>;
    const teamIds = parsed
      .map((team) => team.teamId)
      .filter((teamId): teamId is number => typeof teamId === "number");
    return teamIds.length ? teamIds : [initialSeniorTeamId ?? 0];
  }, [initialSeniorTeamId, initialSeniorTeamsSignature]);
  const initialYouthTeamsSignature = useMemo(
    () =>
      JSON.stringify(
        initialYouthTeams.map((team) => ({
          youthTeamId: team.youthTeamId,
        }))
      ),
    [initialYouthTeams]
  );
  const initialYouthReminderTeamIds = useMemo(() => {
    const parsed = JSON.parse(initialYouthTeamsSignature) as Array<{
      youthTeamId?: unknown;
    }>;
    const teamIds = parsed
      .map((team) => team.youthTeamId)
      .filter((teamId): teamId is number => typeof teamId === "number");
    return teamIds.length ? teamIds : [initialYouthTeamId ?? 0];
  }, [initialYouthTeamId, initialYouthTeamsSignature]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const multiTeamEnabled = initialSeniorReminderTeamIds.length > 1;
    const teamContexts: SeniorReminderTeamContext[] =
      initialSeniorReminderTeamIds.flatMap((sourceTeamId) => {
        const teamId =
          typeof sourceTeamId === "number" && sourceTeamId > 0
            ? sourceTeamId
            : initialSeniorTeamId;
        const key = resolveSeniorDashboardDataStorageKey(
          multiTeamEnabled ? teamId : null,
          multiTeamEnabled
        );
        try {
          const raw = window.localStorage.getItem(key);
          if (!raw) return [];
          const parsed = JSON.parse(raw) as unknown;
          if (!isObject(parsed)) return [];
          const players = Array.isArray(parsed.players)
            ? (parsed.players as SeniorReminderPlayer[])
            : [];
          const detailsCache = isObject(parsed.detailsCache)
            ? (parsed.detailsCache as SeniorReminderTeamContext["detailsCache"])
            : {};
          const salaryIncreaseEvents = updateSeniorSalaryBaseline({
            teamId,
            players: players.map((player) => {
              const detailsSalary = detailsCache[player.PlayerID]?.data?.Salary;
              return {
                playerId: player.PlayerID,
                playerName:
                  [player.FirstName, player.NickName, player.LastName]
                    .filter((part): part is string => Boolean(part && part.trim()))
                    .join(" ")
                    .trim() || String(player.PlayerID),
                salarySek:
                  typeof detailsSalary === "number"
                    ? detailsSalary
                    : typeof player.Salary === "number"
                      ? player.Salary
                      : null,
              };
            }),
            createReminderEvents: reminderStorageState.preferences.enabled,
          });
          return [
            {
              teamId,
              players,
              detailsCache,
              salaryIncreaseEvents,
            },
          ];
        } catch {
          return [];
        }
      });
    if (!teamContexts.length) return;
    const signature = JSON.stringify(
      teamContexts.map((teamContext) => ({
        teamId: teamContext.teamId,
        players: teamContext.players.map((player) => [
          player.PlayerID,
          player.InjuryLevel ?? null,
          (player as SeniorReminderPlayer & { Salary?: number }).Salary ?? null,
        ]),
        detailKeys: Object.keys(teamContext.detailsCache).sort(),
        salaryEvents: (teamContext.salaryIncreaseEvents ?? []).map((event) => [
          event.playerId,
          event.previousSalarySek,
          event.currentSalarySek,
        ]),
      }))
    );
    if (seniorCachedReminderContextSignatureRef.current === signature) return;
    seniorCachedReminderContextSignatureRef.current = signature;
    setSeniorReminderContext({
      messages,
      teamContexts,
      teamId: null,
      players: [],
      detailsCache: {},
    });
  }, [
    initialSeniorReminderTeamIds,
    initialSeniorTeamId,
    messages,
    reminderStorageState.preferences.enabled,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const multiTeamEnabled = initialYouthReminderTeamIds.length > 1;
    const contexts = initialYouthReminderTeamIds.flatMap((sourceYouthTeamId) => {
      const youthTeamId =
        typeof sourceYouthTeamId === "number" && sourceYouthTeamId > 0
          ? sourceYouthTeamId
          : initialYouthTeamId;
      const key = resolveYouthDashboardStateStorageKey(
        multiTeamEnabled ? youthTeamId : null,
        multiTeamEnabled
      );
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!isObject(parsed)) return [];
        const players = Array.isArray(parsed.playerList)
          ? (parsed.playerList as YouthPromotionReminderPlayer[])
          : [];
        const detailsById: Record<
          number,
          YouthPromotionReminderDetails | null | undefined
        > = {};
        if (isObject(parsed.cache)) {
          Object.entries(parsed.cache).forEach(([playerId, entry]) => {
            const id = Number(playerId);
            if (!Number.isFinite(id)) return;
            detailsById[id] = resolveCachedYouthPromotionDetails(entry);
          });
        }
        return [
          {
            youthTeamId,
            players,
            detailsById,
          },
        ];
      } catch {
        return [];
      }
    });
    if (!contexts.length) return;
    const signature = JSON.stringify(
      contexts.map((context) => ({
        youthTeamId: context.youthTeamId,
        players: context.players.map((player) => [
          player.YouthPlayerID,
          player.CanBePromotedIn ?? null,
        ]),
        detailKeys: Object.keys(context.detailsById).sort(),
      }))
    );
    if (youthCachedPromotionReminderContextSignatureRef.current === signature) {
      return;
    }
    youthCachedPromotionReminderContextSignatureRef.current = signature;
    setYouthPromotionReminderContext({
      messages,
      teamContexts: contexts,
      youthTeamId: null,
      players: [],
      detailsById: {},
    });
  }, [initialYouthReminderTeamIds, initialYouthTeamId, messages]);

  useEffect(() => {
    const handleSeniorReminderContext = (event: Event) => {
      const detail = (event as CustomEvent<SeniorReminderContextEventDetail>).detail;
      setSeniorReminderContext(detail?.context ?? null);
    };
    window.addEventListener(
      SENIOR_REMINDER_CONTEXT_EVENT,
      handleSeniorReminderContext
    );
    return () => {
      window.removeEventListener(
        SENIOR_REMINDER_CONTEXT_EVENT,
        handleSeniorReminderContext
      );
    };
  }, []);

  useEffect(() => {
    const handleYouthPromotionReminderContext = (event: Event) => {
      const detail = (
        event as CustomEvent<YouthPromotionReminderContextEventDetail>
      ).detail;
      setYouthPromotionReminderContext(detail ?? null);
    };
    window.addEventListener(
      YOUTH_PROMOTION_REMINDER_CONTEXT_EVENT,
      handleYouthPromotionReminderContext
    );
    return () => {
      window.removeEventListener(
        YOUTH_PROMOTION_REMINDER_CONTEXT_EVENT,
        handleYouthPromotionReminderContext
      );
    };
  }, []);

  useEffect(() => {
    const handleMatchReminderContext = (event: Event) => {
      const detail = (event as CustomEvent<MatchReminderContextEventDetail>)
        .detail;
      if (!detail) return;
      if (detail.scope === "senior") {
        setSeniorMatchReminderContext(detail);
      } else if (detail.scope === "youth") {
        setYouthMatchReminderContext(detail);
      }
    };
    window.addEventListener(
      MATCH_REMINDER_CONTEXT_EVENT,
      handleMatchReminderContext
    );
    return () => {
      window.removeEventListener(
        MATCH_REMINDER_CONTEXT_EVENT,
        handleMatchReminderContext
      );
    };
  }, []);

  useEffect(() => {
    const handleClubChronicleReminderContext = (event: Event) => {
      const detail = (
        event as CustomEvent<ClubChronicleReminderContextEventDetail>
      ).detail;
      setClubChronicleReminderContext(detail ?? null);
    };
    window.addEventListener(
      CLUB_CHRONICLE_REMINDER_CONTEXT_EVENT,
      handleClubChronicleReminderContext
    );
    return () => {
      window.removeEventListener(
        CLUB_CHRONICLE_REMINDER_CONTEXT_EVENT,
        handleClubChronicleReminderContext
      );
    };
  }, []);

  const reminderContext = useMemo<GlobalReminderContext>(
    () => ({
      senior: seniorReminderContext ?? undefined,
      seniorMatches: seniorMatchReminderContext ?? undefined,
      youth: youthMatchReminderContext ?? undefined,
      youthPromotion: youthPromotionReminderContext ?? undefined,
      clubChronicle: clubChronicleReminderContext ?? undefined,
    }),
    [
      clubChronicleReminderContext,
      seniorMatchReminderContext,
      seniorReminderContext,
      youthMatchReminderContext,
      youthPromotionReminderContext,
    ]
  );

  const reminderCandidates = useMemo(
    () =>
      reminderStorageState.preferences.enabled
        ? evaluateRegisteredReminderCandidates(reminderContext)
        : [],
    [reminderContext, reminderStorageState.preferences.enabled]
  );

  const activeReminderEpisodes = useMemo(
    () =>
      reminderStorageState.preferences.enabled
        ? evaluateRegisteredReminderEpisodes(reminderContext)
        : [],
    [reminderContext, reminderStorageState.preferences.enabled]
  );

  const reminderEvaluation = useMemo(
    () =>
      resolveReminderEvaluation({
        candidates: reminderCandidates,
        rules: ALL_REMINDER_RULES,
        state: reminderStorageState,
        now: Date.now(),
        surfacedTriggerKeysThisSession:
          surfacedReminderTriggerKeysThisSessionRef.current,
        activeEpisodes: activeReminderEpisodes,
      }),
    [activeReminderEpisodes, reminderCandidates, reminderStorageState]
  );

  useEffect(() => {
    if (!reminderStorageState.preferences.enabled) {
      setReminderBatchItems([]);
      return;
    }
    if (chppAccessBlock) return;
    if (!reminderEvaluation.newlyDueToSurface.length) return;
    reminderEvaluation.newlyDueToSurface.forEach((item) => {
      surfacedReminderTriggerKeysThisSessionRef.current.add(
        item.candidate.triggerKey
      );
    });
    setReminderBatchItems(reminderEvaluation.due);
  }, [
    chppAccessBlock,
    reminderEvaluation.due,
    reminderEvaluation.newlyDueToSurface,
    reminderStorageState.preferences.enabled,
  ]);

  useEffect(() => {
    if (!reminderStorageState.preferences.enabled) return;
    if (
      JSON.stringify(reminderEvaluation.state) ===
      JSON.stringify(reminderStorageState)
    ) {
      return;
    }
    writeReminderStorageState(reminderEvaluation.state);
  }, [reminderEvaluation.state, reminderStorageState]);

  const handleReminderDismiss = useCallback((item: ReminderDisplayItem) => {
    const rule = ALL_REMINDER_RULES.find(
      (entry) => entry.ruleId === item.candidate.ruleId
    );
    dismissReminder(item.candidate, readReminderStorageState(), rule);
    setReminderBatchItems((current) =>
      current.filter(
        (entry) => entry.candidate.stableKey !== item.candidate.stableKey
      )
    );
  }, []);

  const handleReminderSnooze = useCallback(
    (item: ReminderDisplayItem, durationMs: number) => {
      snoozeReminder(item.candidate, readReminderStorageState(), durationMs);
      setReminderBatchItems((current) =>
        current.filter(
          (entry) => entry.candidate.stableKey !== item.candidate.stableKey
        )
      );
    },
    []
  );

  const handleReminderAction = useCallback(
    (
      action: ReminderAction,
      item: ReminderDisplayItem,
      options: { recordDismissal?: boolean } = {}
    ) => {
      const recordDismissal = options.recordDismissal ?? true;
      const dismissActionReminder = () => {
        if (!recordDismissal) return;
        const rule = ALL_REMINDER_RULES.find(
          (entry) => entry.ruleId === item.candidate.ruleId
        );
        dismissReminder(
          item.candidate,
          readReminderStorageState(),
          rule,
          Date.now(),
          "action"
        );
        setReminderBatchItems((current) =>
          current.filter(
            (entry) => entry.candidate.stableKey !== item.candidate.stableKey
          )
        );
      };
      if (action.type === "openMatch") {
        window.open(
          hattrickMatchUrlWithSourceSystem(
            action.payload.matchId,
            action.payload.sourceSystem ?? "Hattrick"
          ),
          "_blank",
          "noopener,noreferrer"
        );
        dismissActionReminder();
        return;
      }
      if (action.type === "senior.openFindSimilarPlayers") {
        const playerId = Number(action.payload.playerId);
        const teamId =
          typeof action.payload.teamId === "number"
            ? action.payload.teamId
            : null;
        if (!Number.isFinite(playerId)) {
          addNotification(messages.reminderSeniorInjuryActionUnavailable);
          return;
        }
        setActiveTool("senior");
        const detail: SeniorFindSimilarPlayersEventDetail = {
          teamId,
          playerId,
          onHandled: (opened) => {
            if (!opened) {
              addNotification(messages.reminderSeniorInjuryActionUnavailable);
              return;
            }
            dismissActionReminder();
          },
        };
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent(SENIOR_OPEN_FIND_SIMILAR_PLAYERS_EVENT, { detail })
          );
        }, 0);
        return;
      }
      if (action.type === "app.focusTool") {
        const targetTool = action.payload.tool;
        if (targetTool !== "senior" && targetTool !== "youth") {
          addNotification(messages.reminderMatchLineupMissingActionUnavailable);
          return;
        }
        dismissActionReminder();
        setActiveTool(targetTool);
        return;
      }
      if (action.type === "openExternalUrl") {
        const url = action.payload.url;
        if (!url) {
          addNotification(
            item.candidate.ruleId ===
              "clubChronicle.ownArena.occupancy.gte90"
              ? messages.reminderClubChronicleArenaOccupancyActionUnavailable
              : item.candidate.ruleId ===
                  "senior.player.salaryIncrease.gt100kSek"
                ? messages.reminderSeniorSalaryIncreaseActionUnavailable
              : messages.reminderYouthPromotionActionUnavailable
          );
          return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
        dismissActionReminder();
        return;
      }
      addNotification(messages.reminderMissingActionFallback);
    },
    [
      addNotification,
      messages.reminderMissingActionFallback,
      messages.reminderMatchLineupMissingActionUnavailable,
      messages.reminderClubChronicleArenaOccupancyActionUnavailable,
      messages.reminderSeniorInjuryActionUnavailable,
      messages.reminderSeniorSalaryIncreaseActionUnavailable,
      messages.reminderYouthPromotionActionUnavailable,
    ]
  );

  const requestReminderActionConfirmation = useCallback(
    (action: ReminderAction, item: ReminderDisplayItem) => {
      setPendingReminderActionConfirmation({ action, item });
    },
    []
  );

  const handleTurnRemindersOff = useCallback(() => {
    setRemindersEnabled(false);
    setReminderBatchItems([]);
  }, []);

  const reminderBell = useMemo(
    () => (
      <ReminderBell
        messages={messages}
        enabled={reminderStorageState.preferences.enabled}
        due={reminderEvaluation.due}
        snoozed={reminderEvaluation.snoozed}
        dismissed={reminderStorageState.dismissedHistory}
        onOpenBatch={() => setReminderBatchItems(reminderEvaluation.due)}
        onAction={requestReminderActionConfirmation}
        onDismissedAction={(action, item) =>
          handleReminderAction(action, item, { recordDismissal: false })
        }
      />
    ),
    [
      handleReminderAction,
      messages,
      requestReminderActionConfirmation,
      reminderEvaluation.due,
      reminderEvaluation.snoozed,
      reminderStorageState.dismissedHistory,
      reminderStorageState.preferences.enabled,
    ]
  );

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const latestVersion = changelogEntries[0]?.version ?? null;
    if (!latestVersion) return;
    if (chppAccessBlock) return;
    try {
      const previous = window.localStorage.getItem(CHANGELOG_SEEN_LATEST_ENTRY_KEY);
      if (!previous) {
        window.localStorage.setItem(CHANGELOG_SEEN_LATEST_ENTRY_KEY, latestVersion);
        return;
      }
      if (previous !== latestVersion) {
        window.localStorage.setItem(CHANGELOG_SEEN_LATEST_ENTRY_KEY, latestVersion);
        setChangelogPage(0);
        setShowChangelog(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [changelogEntries, chppAccessBlock]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chppAccessBlock) return;
    try {
      const raw = window.localStorage.getItem(BUY_COFFEE_PROMPT_STORAGE_KEY);
      if (!raw) {
        const initialState: BuyCoffeePromptState = {
          firstSeenAt: Date.now(),
          lastPromptAt: null,
          cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
        };
        window.localStorage.setItem(
          BUY_COFFEE_PROMPT_STORAGE_KEY,
          JSON.stringify(initialState)
        );
        setBuyCoffeePromptState(initialState);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<BuyCoffeePromptState> | null;
      const normalized: BuyCoffeePromptState = {
        firstSeenAt:
          typeof parsed?.firstSeenAt === "number" &&
          Number.isFinite(parsed.firstSeenAt)
            ? parsed.firstSeenAt
            : Date.now(),
        lastPromptAt:
          typeof parsed?.lastPromptAt === "number" &&
          Number.isFinite(parsed.lastPromptAt)
            ? parsed.lastPromptAt
            : null,
        cadenceDays:
          parsed?.cadenceDays === BUY_COFFEE_SUPPORTED_CADENCE_DAYS
            ? BUY_COFFEE_SUPPORTED_CADENCE_DAYS
            : BUY_COFFEE_DEFAULT_CADENCE_DAYS,
      };
      window.localStorage.setItem(
        BUY_COFFEE_PROMPT_STORAGE_KEY,
        JSON.stringify(normalized)
      );
      setBuyCoffeePromptState(normalized);
    } catch {
      setBuyCoffeePromptState({
        firstSeenAt: Date.now(),
        lastPromptAt: null,
        cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
      });
    }
  }, [chppAccessBlock]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chppAccessBlock) return;
    const timer = window.setTimeout(() => {
      setBuyCoffeeSessionReady(true);
    }, BUY_COFFEE_INITIAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [chppAccessBlock]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyMobileLayoutState = () => {
      const nextMobileLayoutActive = isMobileLayoutViewport();
      setMobileLayoutActive(nextMobileLayoutActive);
      if (!nextMobileLayoutActive) {
        setMobileLauncherOpen(false);
        return;
      }
      if (!mobileLayoutInitializedRef.current) {
        mobileLayoutInitializedRef.current = true;
        setMobileLauncherOpen(true);
      }
    };

    applyMobileLayoutState();

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY)
        : null;
    const visualViewport = window.visualViewport ?? null;
    const screenOrientation = window.screen?.orientation ?? null;
    const handleViewportChange = () => {
      applyMobileLayoutState();
    };

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleViewportChange);
      } else {
        mediaQuery.addListener(handleViewportChange);
      }
    }
    window.addEventListener("resize", handleViewportChange);
    visualViewport?.addEventListener("resize", handleViewportChange);
    screenOrientation?.addEventListener?.("change", handleViewportChange);

    return () => {
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", handleViewportChange);
        } else {
          mediaQuery.removeListener(handleViewportChange);
        }
      }
      window.removeEventListener("resize", handleViewportChange);
      visualViewport?.removeEventListener("resize", handleViewportChange);
      screenOrientation?.removeEventListener?.("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (mobileLayoutActive) {
      root.dataset.mobileShell = "true";
    } else {
      delete root.dataset.mobileShell;
    }
    return () => {
      delete root.dataset.mobileShell;
    };
  }, [mobileLayoutActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileLayoutActive) return;
    if (mobileLauncherOpen) {
      window.history.replaceState({ appShell: "launcher" }, "", window.location.href);
    }
  }, [mobileLayoutActive, mobileLauncherOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileLayoutActive) return;
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as
        | { appShell?: "launcher" | "tool"; tool?: ToolId }
        | null;
      if (state?.appShell === "tool" && state.tool) {
        setActiveTool(normalizeToolId(state.tool));
        setMobileLauncherOpen(false);
        return;
      }
      setMobileLauncherOpen(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [mobileLayoutActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = () => {
      setMobileLauncherOpen(true);
      if (mobileLayoutActive) {
        window.history.pushState({ appShell: "launcher" }, "", window.location.href);
      }
    };
    window.addEventListener(MOBILE_LAUNCHER_REQUEST_EVENT, handle);
    return () => window.removeEventListener(MOBILE_LAUNCHER_REQUEST_EVENT, handle);
  }, [mobileLayoutActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chppAccessBlock) return;
    if (!buyCoffeePromptState) return;
    if (!buyCoffeeSessionReady) return;
    if (buyCoffeePromptOpen) return;
    if (buyCoffeePromptShownThisSessionRef.current) return;
    if (showChangelog || scopeReconnectModalOpen) return;
    if (youthRefreshing || seniorRefreshing) return;
    if (document.hidden) return;
    const otherModalOpen =
      document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 0;
    if (otherModalOpen) return;
    const nextPromptAt =
      buyCoffeePromptState.lastPromptAt === null
        ? buyCoffeePromptState.firstSeenAt + BUY_COFFEE_FIRST_PROMPT_MS
        : buyCoffeePromptState.lastPromptAt +
          buyCoffeePromptState.cadenceDays * 24 * 60 * 60 * 1000;
    if (Date.now() < nextPromptAt) return;
    buyCoffeePromptShownThisSessionRef.current = true;
    setBuyCoffeePromptSource("auto");
    setBuyCoffeePromptOpen(true);
  }, [
    buyCoffeePromptOpen,
    buyCoffeePromptState,
    buyCoffeeSessionReady,
    chppAccessBlock,
    scopeReconnectModalOpen,
    seniorRefreshing,
    showChangelog,
    youthRefreshing,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      if (chppAccessBlock) return;
      const source =
        event instanceof CustomEvent
          ? parseBuyCoffeePromptSource(
              (event.detail as { source?: unknown } | undefined)?.source
            )
          : "unknown";
      buyCoffeePromptShownThisSessionRef.current = true;
      setBuyCoffeePromptSource(source);
      setBuyCoffeePromptOpen(true);
    };
    window.addEventListener(BUY_COFFEE_PROMPT_OPEN_EVENT, handler);
    window.addEventListener(BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT, handler);
    return () => {
      window.removeEventListener(BUY_COFFEE_PROMPT_OPEN_EVENT, handler);
      window.removeEventListener(BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT, handler);
    };
  }, [chppAccessBlock]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewStateRestored) return;
    try {
      window.localStorage.setItem(APP_SHELL_ACTIVE_TOOL_KEY, activeTool);
    } catch {
      // ignore storage errors
    }
  }, [activeTool, viewStateRestored]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewStateRestored) return;
    try {
      window.localStorage.setItem(
        APP_SHELL_COLLAPSED_KEY,
        collapsed ? "1" : "0"
      );
    } catch {
      // ignore storage errors
    }
  }, [collapsed, viewStateRestored]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restore = () => {
      try {
        const raw = window.localStorage.getItem(APP_SHELL_VIEW_STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ViewStateSnapshot;
          if (
            parsed &&
            typeof parsed === "object" &&
            Date.now() - Number(parsed.capturedAt ?? 0) <= 2 * 60 * 1000
          ) {
            setCollapsed(Boolean(parsed.collapsed));
            setActiveTool(normalizeToolId(parsed.activeTool));
            return;
          }
          window.localStorage.removeItem(APP_SHELL_VIEW_STATE_KEY);
        }
        const stored = window.localStorage.getItem(APP_SHELL_ACTIVE_TOOL_KEY);
        setActiveTool(normalizeToolId(stored));
        const collapsedStored = window.localStorage.getItem(
          APP_SHELL_COLLAPSED_KEY
        );
        if (collapsedStored === "1" || collapsedStored === "0") {
          setCollapsed(collapsedStored === "1");
        }
      } catch {
        // ignore parse/storage errors
      } finally {
        setViewStateRestored(true);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let parsed: ViewStateSnapshot | null = null;
    try {
      const raw = window.localStorage.getItem(APP_SHELL_VIEW_STATE_KEY);
      if (!raw) return;
      parsed = JSON.parse(raw) as ViewStateSnapshot;
      if (!parsed || typeof parsed !== "object") return;
      if (Date.now() - Number(parsed.capturedAt ?? 0) > 2 * 60 * 1000) {
        window.localStorage.removeItem(APP_SHELL_VIEW_STATE_KEY);
        return;
      }
    } catch {
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!parsed) return;
        const main = document.querySelector("[data-app-main='true']") as HTMLElement | null;
        if (main && parsed.mainScrollTop !== null && parsed.mainScrollLeft !== null) {
          main.scrollTop = parsed.mainScrollTop;
          main.scrollLeft = parsed.mainScrollLeft;
        }
        window.scrollTo(parsed.windowScrollX ?? 0, parsed.windowScrollY ?? 0);
        if (parsed.activeTool === "chronicle" && parsed.chroniclePanelScroll) {
          Object.entries(parsed.chroniclePanelScroll).forEach(([panelId, top]) => {
            const panel = document.querySelector(
              `[data-cc-scroll-key='${panelId}']`
            ) as HTMLElement | null;
            if (panel && Number.isFinite(top)) {
              panel.scrollTop = top;
            }
          });
        }
        window.localStorage.removeItem(APP_SHELL_VIEW_STATE_KEY);
      });
    });
  }, [activeTool]);

  useEffect(() => {
    setMobileNavSegments([]);
  }, [activeTool, mobileLauncherOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | { tool?: ToolId; segments?: MobileNavSegment[] }
        | undefined;
      if (!detail || detail.tool !== activeTool) return;
      const segments = Array.isArray(detail.segments)
        ? detail.segments.filter(
            (segment): segment is MobileNavSegment =>
              Boolean(
                segment &&
                  typeof segment.id === "string" &&
                  typeof segment.label === "string"
              )
          )
        : [];
      setMobileNavSegments(segments);
    };
    window.addEventListener(MOBILE_NAV_TRAIL_STATE_EVENT, handle);
    return () => window.removeEventListener(MOBILE_NAV_TRAIL_STATE_EVENT, handle);
  }, [activeTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const captureViewState = () => {
      const main = document.querySelector("[data-app-main='true']") as HTMLElement | null;
      const chroniclePanelScroll: Record<string, number> = {};
      document.querySelectorAll<HTMLElement>("[data-cc-scroll-key]").forEach((node) => {
        const key = node.dataset.ccScrollKey;
        if (!key) return;
        chroniclePanelScroll[key] = node.scrollTop;
      });
      const snapshot: ViewStateSnapshot = {
        activeTool,
        collapsed,
        windowScrollX: window.scrollX,
        windowScrollY: window.scrollY,
        mainScrollTop: main ? main.scrollTop : null,
        mainScrollLeft: main ? main.scrollLeft : null,
        chroniclePanelScroll,
        capturedAt: Date.now(),
      };
      try {
        window.localStorage.setItem(APP_SHELL_VIEW_STATE_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore storage errors
      }
    };
    window.addEventListener("ya:before-locale-switch", captureViewState);
    return () => {
      window.removeEventListener("ya:before-locale-switch", captureViewState);
    };
  }, [activeTool, collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = shellTopBarRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().height);
      if (next > 0) {
        setTopBarHeight(next);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = mobileNavHeaderRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().height);
      if (next > 0) {
        setMobileNavHeaderHeight(next);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mobileLayoutActive, mobileLauncherOpen, mobileNavSegments, activeTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | {
            refreshing?: boolean;
            status?: string | null;
            progressPct?: number;
            lastRefreshAt?: number | null;
          }
        | undefined;
      if (!detail) return;
      setSeniorRefreshing(Boolean(detail.refreshing));
      setSeniorRefreshStatus(
        typeof detail.status === "string" ? detail.status : null
      );
      setSeniorRefreshProgressPct(
        typeof detail.progressPct === "number"
          ? Math.max(0, Math.min(100, detail.progressPct))
          : 0
      );
      setSeniorLastRefreshAt(
        typeof detail.lastRefreshAt === "number" ? detail.lastRefreshAt : null
      );
    };
    window.addEventListener(SENIOR_REFRESH_STATE_EVENT, handle);
    return () => window.removeEventListener(SENIOR_REFRESH_STATE_EVENT, handle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | {
            refreshing?: boolean;
            status?: string | null;
            progressPct?: number;
            lastRefreshAt?: number | null;
          }
        | undefined;
      if (!detail) return;
      setYouthRefreshing(Boolean(detail.refreshing));
      setYouthRefreshStatus(
        typeof detail.status === "string" ? detail.status : null
      );
      setYouthRefreshProgressPct(
        typeof detail.progressPct === "number"
          ? Math.max(0, Math.min(100, detail.progressPct))
          : 0
      );
      setYouthLastRefreshAt(
        typeof detail.lastRefreshAt === "number" ? detail.lastRefreshAt : null
      );
    };
    window.addEventListener(YOUTH_REFRESH_STATE_EVENT, handle);
    return () => window.removeEventListener(YOUTH_REFRESH_STATE_EVENT, handle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (activeTool === "youth") return;
      setChangelogPage(0);
      setShowChangelog(true);
    };
    window.addEventListener("ya:changelog-open", handler);
    return () => window.removeEventListener("ya:changelog-open", handler);
  }, [activeTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setShowManual(true);
    window.addEventListener("ya:manual-open", handler);
    return () => window.removeEventListener("ya:manual-open", handler);
  }, []);

  const selectTool = useCallback((toolId: ToolId) => {
    setActiveTool(toolId);
    if (mobileLayoutActive) {
      setMobileLauncherOpen(false);
      window.history.pushState(
        { appShell: "tool", tool: toolId },
        "",
        window.location.href
      );
    }
  }, [mobileLayoutActive]);

  const handleSelectTool = useCallback((toolId: ToolId, source: ToolSelectionSource) => {
    trackAnalyticsEvent("main_tool_selected", {
      tool: toolId,
      app_source: source,
    });
    selectTool(toolId);
  }, [selectTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { tool?: ToolId } | undefined;
      if (!detail?.tool) return;
      selectTool(normalizeToolId(detail.tool));
    };
    window.addEventListener(APP_SHELL_OPEN_TOOL_EVENT, handler);
    return () => window.removeEventListener(APP_SHELL_OPEN_TOOL_EVENT, handler);
  }, [selectTool]);

  const renderToolButton = (tool: (typeof tools)[number]) => {
    const button = (
      <button
        type="button"
        className={`${styles.sidebarItem} ${
          activeTool === tool.id ? styles.sidebarItemActive : ""
        }`}
        onClick={() => handleSelectTool(tool.id, "desktop_sidebar")}
        aria-label={tool.label}
      >
        <span className={styles.sidebarIcon} aria-hidden="true">
          <span className={styles.sidebarIconGlyph}>
            {tool.badge ? `${tool.badge}${tool.icon}` : tool.icon}
          </span>
        </span>
        {!collapsed ? (
          <span className={styles.sidebarLabel}>{tool.label}</span>
        ) : null}
      </button>
    );

    if (!collapsed) return button;

    return (
      <Tooltip content={tool.label} fullWidth>
        {button}
      </Tooltip>
    );
  };

  const kofiButton = (
    <BuyCoffeeButton
      className={styles.sidebarItem}
      aria-label={messages.supportOnKofi}
      source="sidebar"
    >
      <span className={styles.sidebarIcon} aria-hidden="true">
        <span className={styles.sidebarIconGlyph}>☕</span>
      </span>
      {!collapsed ? <span className={styles.sidebarLabel}>{messages.supportOnKofi}</span> : null}
    </BuyCoffeeButton>
  );

  const activeOptimizationLastRefreshAt =
    activeTool === "youth" ? youthLastRefreshAt : seniorLastRefreshAt;
  const activeToolMeta = tools.find((tool) => tool.id === activeTool) ?? tools[0];
  const headerChildren = useMemo(() => Children.toArray(globalHeader), [globalHeader]);
  const youthToolChildren = useMemo(() => Children.toArray(children), [children]);
  const seniorToolChildren = useMemo(() => Children.toArray(seniorTool), [seniorTool]);
  const transferMarketToolChildren = useMemo(
    () => Children.toArray(transferMarketTool),
    [transferMarketTool]
  );

  const handleBuyCoffeeLater = () => {
    trackAnalyticsEvent("coffee_flow", {
      action: "not_now_clicked",
      app_source: buyCoffeePromptSource,
    });
    const baseState = buyCoffeePromptState ?? {
      firstSeenAt: Date.now(),
      lastPromptAt: null,
      cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
    };
    persistBuyCoffeePromptState({
      ...baseState,
      lastPromptAt: Date.now(),
    });
    setBuyCoffeePromptOpen(false);
    setBuyCoffeePromptSource("unknown");
  };

  const handleBuyCoffeeAction = () => {
    trackAnalyticsEvent("coffee_flow", {
      action: "buy_clicked",
      app_source: buyCoffeePromptSource,
    });
    trackAnalyticsEvent("coffee_buy_clicked", {
      app_source: buyCoffeePromptSource,
    });
    if (typeof window !== "undefined") {
      window.open("https://ko-fi.com/zbdvlpr", "_blank", "noopener,noreferrer");
    }
    const baseState = buyCoffeePromptState ?? {
      firstSeenAt: Date.now(),
      lastPromptAt: null,
      cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
    };
    persistBuyCoffeePromptState({
      ...baseState,
      lastPromptAt: Date.now(),
      cadenceDays: BUY_COFFEE_SUPPORTED_CADENCE_DAYS,
    });
    setBuyCoffeePromptOpen(false);
    setBuyCoffeePromptSource("unknown");
  };

  const mobileNavTrail = mobileLayoutActive && !mobileLauncherOpen ? (
    <div className={styles.mobileNavHeader} ref={mobileNavHeaderRef}>
      <div className={styles.mobileNavAppMeta}>
        <span className={styles.mobileNavAppTitle}>{messages.brandTitle}</span>
        <span className={styles.version}>v{appVersion}</span>
        <PremiumStatusPill
          messages={messages}
          className={styles.mobileNavPremiumPill}
        />
      </div>
      <div className={styles.mobileNavTrail} aria-label={messages.brandTitle}>
        <button
          type="button"
          className={styles.mobileNavTrailButton}
          onClick={() => {
            window.dispatchEvent(new CustomEvent(MOBILE_LAUNCHER_REQUEST_EVENT));
          }}
        >
          {messages.brandTitle}
        </button>
        <span className={styles.mobileNavTrailSeparator} aria-hidden="true">
          ›
        </span>
        <button
          type="button"
          className={`${styles.mobileNavTrailButton} ${
            mobileNavSegments.length === 0 ? styles.mobileNavTrailCurrent : ""
          }`}
          disabled={mobileNavSegments.length === 0}
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent(MOBILE_NAV_TRAIL_JUMP_EVENT, {
                detail: { tool: activeTool, target: "tool-root" },
              })
            );
          }}
        >
          {activeToolMeta.label}
        </button>
        {mobileNavSegments.map((segment, index) => {
          const isCurrent = index === mobileNavSegments.length - 1;
          return (
            <Fragment key={segment.id}>
              <span className={styles.mobileNavTrailSeparator} aria-hidden="true">
                ›
              </span>
              <button
                type="button"
                className={`${styles.mobileNavTrailButton} ${
                  isCurrent ? styles.mobileNavTrailCurrent : ""
                }`}
                disabled={isCurrent}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(MOBILE_NAV_TRAIL_JUMP_EVENT, {
                      detail: { tool: activeTool, target: segment.id },
                    })
                  )
                }
              >
                {segment.label}
              </button>
            </Fragment>
          );
        })}
      </div>
      <div className={styles.mobileNavActions}>{reminderBell}</div>
    </div>
  ) : null;

  if (chppAccessBlock) {
    return (
      <DisplayCurrencyProvider>
        <ReminderBellSlotProvider bell={null}>
          <div className={styles.chppAccessPage}>
            <ChppAccessGate
              messages={messages}
              kind={chppAccessBlock.kind}
              statusCode={chppAccessBlock.statusCode ?? null}
              reason={chppAccessBlock.reason ?? null}
              details={chppAccessBlock.details ?? null}
              simulated={chppAccessBlock.simulated}
              onCloseSimulation={
                chppAccessBlock.simulated
                  ? () => {
                      writeChppDebugOauthErrorMode("off");
                      setChppAccessBlock(null);
                    }
                  : undefined
              }
            />
          </div>
        </ReminderBellSlotProvider>
      </DisplayCurrencyProvider>
    );
  }

  return (
    <DisplayCurrencyProvider>
    <ReminderBellSlotProvider bell={reminderBell}>
      <div
        className={styles.shellFrame}
        data-mobile-layout={mobileLayoutActive ? "true" : "false"}
        data-mobile-launcher-open={mobileLauncherOpen ? "true" : "false"}
        style={
          {
            "--shell-topbar-height": `${topBarHeight}px`,
            "--mobile-nav-header-height": `${mobileNavHeaderHeight}px`,
          } as CSSProperties
        }
      >
      <div className={styles.shellTopBar} ref={shellTopBarRef}>
        {headerChildren}
      </div>
      {!mobileLayoutActive ? (
        <aside
          className={`${styles.sidebar} ${
            collapsed ? styles.sidebarCollapsed : ""
          }`}
        >
          <div className={styles.sidebarHeader}>
            <Tooltip
              content={
                collapsed
                  ? messages.sidebarExpandTooltip
                  : messages.sidebarCollapseTooltip
              }
            >
              <button
                type="button"
                className={styles.sidebarToggle}
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={
                  collapsed
                    ? messages.sidebarExpandTooltip
                    : messages.sidebarCollapseTooltip
                }
              >
                {collapsed ? "»" : "«"}
              </button>
            </Tooltip>
          </div>
          <nav className={styles.sidebarNav}>
            {tools.map((tool) => (
              <div key={tool.id} className={styles.sidebarItemWrap}>
                {renderToolButton(tool)}
              </div>
            ))}
            <div className={styles.sidebarItemWrap}>
              {collapsed ? (
                <Tooltip content={messages.supportOnKofi} fullWidth>
                  {kofiButton}
                </Tooltip>
              ) : (
                kofiButton
              )}
            </div>
          </nav>
        </aside>
      ) : null}
      {!mobileLauncherOpen &&
      !mobileLayoutActive &&
      (activeTool === "youth" || activeTool === "senior") ? (
        <div className={styles.shellContextBar}>
          <div className={styles.youthActionBarActions}>
            <Tooltip content={messages.refreshAllYouthDataTooltip}>
              <button
                type="button"
                className={styles.chronicleUpdatesButton}
                onClick={() => {
                  void (async () => {
                    const hasRequiredScopes = await ensureRefreshScopes();
                    if (!hasRequiredScopes) return;
                    window.dispatchEvent(
                      new CustomEvent(
                        activeTool === "youth"
                          ? YOUTH_REFRESH_REQUEST_EVENT
                          : SENIOR_REFRESH_REQUEST_EVENT
                      )
                    );
                  })();
                }}
                disabled={activeTool === "youth" ? youthRefreshing : seniorRefreshing}
                aria-label={
                  activeTool === "youth"
                    ? messages.refreshAllYouthDataTooltip
                    : messages.refreshAllSeniorDataTooltip
                }
              >
                {messages.clubChronicleRefreshButton}
              </button>
            </Tooltip>
            <button
              type="button"
              className={styles.chronicleUpdatesButton}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(
                    activeTool === "youth"
                      ? YOUTH_LATEST_UPDATES_OPEN_EVENT
                      : SENIOR_LATEST_UPDATES_OPEN_EVENT
                  )
                )
              }
              aria-label={messages.clubChronicleUpdatesButton}
              data-help-anchor={
                activeTool === "senior" ? "senior-latest-updates" : undefined
              }
            >
              {messages.clubChronicleUpdatesButton}
            </button>
          </div>
          {(activeTool === "youth"
            ? youthRefreshStatus || youthRefreshing
            : seniorRefreshStatus || seniorRefreshing) ? (
            <div className={styles.chronicleRefreshStatusWrap} aria-live="polite">
              <span className={styles.chronicleRefreshStatusText}>
                {activeTool === "youth"
                  ? youthRefreshStatus ?? messages.refreshingLabel
                  : seniorRefreshStatus ?? messages.refreshingLabel}
              </span>
              <span className={styles.chronicleRefreshProgressRow}>
                <span className={styles.chronicleRefreshProgressTrack} aria-hidden="true">
                  <span
                    className={styles.chronicleRefreshProgressFill}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          activeTool === "youth"
                            ? youthRefreshProgressPct
                            : seniorRefreshProgressPct
                        )
                      )}%`,
                    }}
                  />
                </span>
                {(activeTool === "youth" ? youthRefreshing : seniorRefreshing) ? (
                  <Tooltip content={messages.refreshStopTooltip}>
                    <button
                      type="button"
                      className={`${styles.chronicleUpdatesButton} ${styles.chronicleRefreshStopButton}`}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent(
                            activeTool === "youth"
                              ? YOUTH_REFRESH_STOP_EVENT
                              : SENIOR_REFRESH_STOP_EVENT
                          )
                        )
                      }
                      aria-label={messages.refreshStopTooltip}
                    >
                      ■
                    </button>
                  </Tooltip>
                ) : null}
              </span>
            </div>
          ) : null}
          {activeOptimizationLastRefreshAt ? (
            <span className={styles.chronicleRefreshStatusText}>
              {messages.youthLastGlobalRefresh}:{" "}
              {formatDateTime(activeOptimizationLastRefreshAt)}
            </span>
          ) : null}
        </div>
      ) : null}
      {!mobileLauncherOpen &&
      !mobileLayoutActive &&
      activeTool === "transferMarket" ? (
        <div className={styles.shellContextBar}>
          <div className={styles.youthActionBarActions}>
            <button
              type="button"
              className={styles.chronicleUpdatesButton}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT)
                )
              }
            >
              {messages.transferMarketPastSearchesButton}
            </button>
          </div>
          <Tooltip content={messages.transferMarketProfilesTooltip}>
            <button
              type="button"
              className={styles.chronicleUpdatesButton}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(TRANSFER_MARKET_OPEN_PROFILES_EVENT)
                )
              }
              aria-label={messages.transferMarketProfilesAriaLabel}
            >
              ☰
            </button>
          </Tooltip>
        </div>
      ) : null}
      {mobileLayoutActive && !mobileLauncherOpen ? mobileNavTrail : null}
      <section className={styles.shellWorkspace} data-active-tool={activeTool}>
        {mobileLayoutActive ? (
          mobileLauncherOpen ? (
            <div className={styles.mobileLauncher}>
              <div className={styles.mobileLauncherGrid}>
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className={styles.mobileLauncherToolCard}
                    onClick={() => handleSelectTool(tool.id, "mobile_launcher")}
                    aria-label={tool.label}
                  >
                    <span className={styles.mobileLauncherToolIcon} aria-hidden="true">
                      {tool.badge ? `${tool.badge}${tool.icon}` : tool.icon}
                    </span>
                    <span className={styles.mobileLauncherToolLabel}>{tool.label}</span>
                  </button>
                ))}
              </div>
              {mobileLauncherUtility ? (
                <div className={styles.mobileLauncherUtilityRow}>
                  {mobileLauncherUtility}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {activeTool === "youth" ? youthToolChildren : null}
              {activeTool === "senior" ? seniorToolChildren : null}
              {activeTool === "chronicle" ? (
                <ClubChronicle
                  messages={messages}
                  primarySeniorTeamCountryId={primarySeniorTeamCountryId}
                />
              ) : null}
              {activeTool === "transferMarket" ? transferMarketToolChildren : null}
            </>
          )
        ) : (
          <>
            {activeTool === "youth" ? youthToolChildren : null}
            {activeTool === "senior" ? seniorToolChildren : null}
            {activeTool === "chronicle" ? (
              <ClubChronicle
                messages={messages}
                primarySeniorTeamCountryId={primarySeniorTeamCountryId}
              />
            ) : null}
            {activeTool === "transferMarket" ? transferMarketToolChildren : null}
          </>
        )}
      </section>
      <Modal
        open={buyCoffeePromptOpen}
        title={messages.buyCoffeePromptTitle}
        movable={false}
        body={
          <div className={styles.algorithmsModalBody}>
            <p>{messages.buyCoffeePromptLead}</p>
            <p>{messages.buyCoffeePromptBody}</p>
            <p>{messages.buyCoffeePromptFoot}</p>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={handleBuyCoffeeLater}
            >
              {messages.buyCoffeePromptLater}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={handleBuyCoffeeAction}
            >
              {messages.buyCoffeePromptAction}
            </button>
          </>
        }
      />
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
      <ManualModal
        open={showManual}
        title={messages.manualTitle}
        tocTitle={messages.manualTocTitle}
        onClose={() => setShowManual(false)}
      />
      <ReminderBatchModal
        open={reminderBatchItems.length > 0}
        messages={messages}
        reminders={reminderBatchItems}
        onClose={() => setReminderBatchItems([])}
        onDismiss={handleReminderDismiss}
        onSnooze={handleReminderSnooze}
        onAction={requestReminderActionConfirmation}
        onTurnOff={handleTurnRemindersOff}
        defaultSnoozeDurationMsByRuleId={
          reminderStorageState.preferences.defaultSnoozeDurationMsByRuleId
        }
      />
      <Modal
        open={pendingReminderActionConfirmation !== null}
        title={messages.reminderActionConfirmTitle}
        movable={false}
        body={
          <div className={styles.algorithmsModalBody}>
            <p>{messages.reminderActionConfirmBody}</p>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={() => setPendingReminderActionConfirmation(null)}
            >
              {messages.confirmCancel}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={() => {
                const pending = pendingReminderActionConfirmation;
                if (!pending) return;
                setPendingReminderActionConfirmation(null);
                handleReminderAction(pending.action, pending.item);
              }}
            >
              {messages.reminderActionConfirmContinue}
            </button>
          </>
        }
        onClose={() => setPendingReminderActionConfirmation(null)}
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
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setShowChangelog(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setShowChangelog(false)}
      />
      <VersionUpdateGate appVersion={appVersion} messages={messages} />
      </div>
    </ReminderBellSlotProvider>
    </DisplayCurrencyProvider>
  );
}
