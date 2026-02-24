"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "../page.module.css";
import YouthPlayerList from "./YouthPlayerList";
import PlayerDetailsPanel, {
  YouthPlayerDetails,
} from "./PlayerDetailsPanel";
import LineupField, {
  LineupAssignments,
  LineupBehaviors,
  OptimizeMode,
} from "./LineupField";
import UpcomingMatches, { type MatchesResponse } from "./UpcomingMatches";
import type { YouthTeamOption } from "../page";
import { Messages } from "@/lib/i18n";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import Tooltip from "./Tooltip";
import Modal from "./Modal";
import { POSITION_COLUMNS, normalizeMatchRoleId } from "@/lib/positions";
import { parseChppDate } from "@/lib/chpp/utils";
import {
  getAutoSelection,
  getTrainingForStar,
  getTrainingSlots,
  optimizeLineupForStar,
  optimizeByRatings,
  optimizeRevealPrimaryCurrent,
  optimizeRevealSecondaryMax,
  buildSkillRanking,
  type OptimizerPlayer,
  type OptimizerDebug,
  type TrainingSkillKey,
} from "@/lib/optimizer";
import {
  ALGORITHM_SETTINGS_EVENT,
  ALGORITHM_SETTINGS_STORAGE_KEY,
  DEFAULT_YOUTH_STALENESS_HOURS,
  LAST_REFRESH_STORAGE_KEY,
  readAllowTrainingUntilMaxedOut,
  readLastRefreshTimestamp,
  readYouthStalenessHours,
  writeLastRefreshTimestamp,
  YOUTH_SETTINGS_EVENT,
  YOUTH_SETTINGS_STORAGE_KEY,
} from "@/lib/settings";
import { useNotifications } from "./notifications/NotificationsProvider";
import {
  CHPP_AUTH_REQUIRED_EVENT,
  ChppAuthRequiredError,
  fetchChppJson,
} from "@/lib/chpp/client";

const formatPlayerName = (player: YouthPlayer) =>
  [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
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

type PlayerDetailsResponse = {
  data?: Record<string, unknown>;
  unlockStatus?: "success" | "denied";
  error?: string;
  details?: string;
  statusCode?: number;
  code?: string;
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

type CachedDetails = {
  data: Record<string, unknown>;
  fetchedAt: number;
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

type EventPlayerRef = "subject" | "object";

type SpecialEventRule = {
  specialty: number;
  players: EventPlayerRef[];
};

const SPECIAL_EVENT_SPECIALTY_RULES: Record<number, SpecialEventRule> = {
  105: { specialty: 4, players: ["subject"] },
  106: { specialty: 4, players: ["subject"] },
  108: { specialty: 4, players: ["subject"] },
  109: { specialty: 4, players: ["subject"] },
  115: { specialty: 2, players: ["subject"] },
  116: { specialty: 2, players: ["object"] },
  119: { specialty: 5, players: ["subject"] },
  125: { specialty: 4, players: ["subject"] },
  137: { specialty: 5, players: ["subject"] },
  139: { specialty: 1, players: ["subject"] },
  190: { specialty: 3, players: ["subject"] },
  205: { specialty: 4, players: ["subject"] },
  206: { specialty: 4, players: ["subject"] },
  208: { specialty: 4, players: ["subject"] },
  209: { specialty: 4, players: ["subject"] },
  215: { specialty: 2, players: ["subject"] },
  216: { specialty: 2, players: ["object"] },
  219: { specialty: 5, players: ["subject"] },
  225: { specialty: 4, players: ["subject"] },
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
];
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
};

const isTrainingSkill = (
  value: string | null | undefined
): value is TrainingSkillKey => TRAINING_SKILLS.includes(value as TrainingSkillKey);

const getKnownSkillValue = (skill?: SkillValue) => {
  if (!skill) return null;
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
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
  appVersion,
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
  const [hiddenSpecialtyByPlayerId, setHiddenSpecialtyByPlayerId] = useState<
    Record<number, number>
  >({});
  const [analyzedHiddenSpecialtyMatchIds, setAnalyzedHiddenSpecialtyMatchIds] =
    useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [loadErrorDetails, setLoadErrorDetails] = useState<string | null>(
    initialLoadDetails
  );

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
  const [loadedMatchId, setLoadedMatchId] = useState<number | null>(null);
  const [starPlayerId, setStarPlayerId] = useState<number | null>(null);
  const [primaryTraining, setPrimaryTraining] = useState<TrainingSkillKey | "">(
    ""
  );
  const [secondaryTraining, setSecondaryTraining] = useState<
    TrainingSkillKey | ""
  >("");
  const [optimizerDebug, setOptimizerDebug] = useState<OptimizerDebug | null>(
    null
  );
  const [showOptimizerDebug, setShowOptimizerDebug] = useState(false);
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
  const [showTrainingReminder, setShowTrainingReminder] = useState(false);
  const [optimizeErrorMessage, setOptimizeErrorMessage] = useState<string | null>(
    null
  );
  const { addNotification } = useNotifications();
  const isDev = process.env.NODE_ENV !== "production";
  const helpStorageKey = "ya_help_dismissed_v1";
  const changelogStorageKey = "ya_changelog_seen_major_minor_v1";
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const [showHelp, setShowHelp] = useState(false);
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
  const [ratingsCache, setRatingsCache] = useState<
    Record<number, Record<string, number>>
  >({});
  const [ratingsPositions, setRatingsPositions] = useState<number[]>([]);
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<number[] | null>(
    null
  );
  const [orderSource, setOrderSource] = useState<
    "list" | "ratings" | "skills" | null
  >(null);
  const [allowTrainingUntilMaxedOut, setAllowTrainingUntilMaxedOut] =
    useState(true);
  const [stalenessHours, setStalenessHours] = useState(
    DEFAULT_YOUTH_STALENESS_HOURS
  );
  const [lastGlobalRefreshAt, setLastGlobalRefreshAt] = useState<number | null>(
    null
  );
  const [tacticType, setTacticType] = useState(7);
  const [restoredStorageKey, setRestoredStorageKey] = useState<string | null>(
    null
  );
  const staleRefreshAttemptedRef = useRef(false);
  const lastAuthNotificationAtRef = useRef(0);

  const playersById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    playerList.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [playerList]);

  const multiTeamEnabled = youthTeams.length > 1;
  const activeYouthTeamId = multiTeamEnabled ? selectedYouthTeamId : null;
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

  const changelogEntries = useMemo(
    () => [
      {
        version: "2.20.0",
        entries: [messages.changelog_2_20_0],
      },
      {
        version: "2.19.0",
        entries: [messages.changelog_2_19_0],
      },
      {
        version: "2.18.0",
        entries: [messages.changelog_2_18_0],
      },
      {
        version: "2.17.0",
        entries: [messages.changelog_2_17_0],
      },
      {
        version: "2.16.0",
        entries: [messages.changelog_2_16_0],
      },
      {
        version: "2.15.0",
        entries: [messages.changelog_2_15_0],
      },
      {
        version: "2.14.0",
        entries: [messages.changelog_2_14_0],
      },
      {
        version: "2.13.0",
        entries: [messages.changelog_2_13_0],
      },
      {
        version: "2.12.0",
        entries: [messages.changelog_2_12_0],
      },
      {
        version: "2.11.0",
        entries: [messages.changelog_2_11_0],
      },
      {
        version: "2.10.0",
        entries: [messages.changelog_2_10_0],
      },
      {
        version: "2.9.0",
        entries: [messages.changelog_2_9_0],
      },
      {
        version: "2.8.0",
        entries: [messages.changelog_2_8_0],
      },
      {
        version: "2.7.0",
        entries: [messages.changelog_2_7_0],
      },
      {
        version: "2.6.0",
        entries: [messages.changelog_2_6_0],
      },
      {
        version: "2.5.0",
        entries: [messages.changelog_2_5_0],
      },
      {
        version: "2.4.0",
        entries: [messages.changelog_2_4_0],
      },
      {
        version: "2.3.0",
        entries: [messages.changelog_2_3_0],
      },
      {
        version: "2.2.0",
        entries: [messages.changelog_2_2_0],
      },
      {
        version: "2.1.0",
        entries: [messages.changelog_2_1_0],
      },
      {
        version: "2.0.0",
        entries: [messages.changelog_2_0_0],
      },
      {
        version: "1.28.0",
        entries: [messages.changelog_1_28_0],
      },
      {
        version: "1.26.0",
        entries: [messages.changelog_1_26_0],
      },
      {
        version: "1.25.0",
        entries: [messages.changelog_1_25_0],
      },
      {
        version: "1.24.0",
        entries: [messages.changelog_1_24_0],
      },
      {
        version: "1.23.0",
        entries: [messages.changelog_1_23_0],
      },
      {
        version: "1.22.0",
        entries: [messages.changelog_1_22_0],
      },
      {
        version: "1.21.0",
        entries: [messages.changelog_1_21_0],
      },
      {
        version: "1.19.0",
        entries: [messages.changelog_1_19_0],
      },
    ],
    [
      messages.changelog_1_19_0,
      messages.changelog_1_21_0,
      messages.changelog_1_22_0,
      messages.changelog_1_23_0,
      messages.changelog_1_24_0,
      messages.changelog_1_25_0,
      messages.changelog_1_26_0,
      messages.changelog_1_28_0,
      messages.changelog_2_1_0,
      messages.changelog_2_0_0,
      messages.changelog_2_2_0,
      messages.changelog_2_3_0,
      messages.changelog_2_4_0,
      messages.changelog_2_5_0,
      messages.changelog_2_6_0,
      messages.changelog_2_7_0,
      messages.changelog_2_8_0,
      messages.changelog_2_9_0,
      messages.changelog_2_10_0,
      messages.changelog_2_11_0,
      messages.changelog_2_12_0,
      messages.changelog_2_13_0,
      messages.changelog_2_14_0,
      messages.changelog_2_15_0,
      messages.changelog_2_16_0,
      messages.changelog_2_17_0,
      messages.changelog_2_18_0,
      messages.changelog_2_20_0,
      messages.changelog_2_19_0,
    ]
  );

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
    if (typeof window === "undefined") return;
    const majorMinor = appVersion.split(".").slice(0, 2).join(".");
    try {
      const previous = window.localStorage.getItem(changelogStorageKey);
      if (!previous) {
        window.localStorage.setItem(changelogStorageKey, majorMinor);
        return;
      }
      if (previous !== majorMinor) {
        window.localStorage.setItem(changelogStorageKey, majorMinor);
        setShowChangelog(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [appVersion, changelogStorageKey]);

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
    () => new Set(Object.values(assignments).filter(Boolean) as number[]),
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
    const players = playerList.map((player) => ({
      id: player.YouthPlayerID,
      name: formatPlayerName(player),
      ratings: ratingsCache[player.YouthPlayerID] ?? {},
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
      },
    };
  }, [playerList, ratingsCache, ratingsPositions, ratingsResponseState]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
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
        analyzedHiddenSpecialtyMatchIds?: number[];
      };
      if (parsed.assignments) setAssignments(parsed.assignments);
      if (parsed.behaviors) setBehaviors(parsed.behaviors);
      if (parsed.selectedId !== undefined) setSelectedId(parsed.selectedId);
      if (parsed.starPlayerId !== undefined) setStarPlayerId(parsed.starPlayerId);
      if (parsed.primaryTraining !== undefined)
        setPrimaryTraining(
          isTrainingSkill(parsed.primaryTraining) ? parsed.primaryTraining : ""
        );
      if (parsed.secondaryTraining !== undefined)
        setSecondaryTraining(
          isTrainingSkill(parsed.secondaryTraining) ? parsed.secondaryTraining : ""
        );
      if (parsed.tacticType !== undefined && Number.isFinite(parsed.tacticType)) {
        setTacticType(parsed.tacticType);
      }
      if (parsed.loadedMatchId !== undefined)
        setLoadedMatchId(parsed.loadedMatchId);
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
      if (parsed.analyzedHiddenSpecialtyMatchIds) {
        setAnalyzedHiddenSpecialtyMatchIds(parsed.analyzedHiddenSpecialtyMatchIds);
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
      assignments,
      behaviors,
      selectedId,
      starPlayerId,
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
      analyzedHiddenSpecialtyMatchIds,
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
    starPlayerId,
    behaviors,
    playerList,
    matchesState,
    hiddenSpecialtyByPlayerId,
    analyzedHiddenSpecialtyMatchIds,
    storageKey,
    restoredStorageKey,
  ]);

  useEffect(() => {
    if (!ratingsResponseState) return;
    setRatingsPositions(ratingsResponseState.positions ?? []);
    setRatingsCache((prev) => {
      const next: Record<number, Record<string, number>> = { ...prev };
      const validIds = new Set(playerList.map((player) => player.YouthPlayerID));
      Object.keys(next).forEach((id) => {
        if (!validIds.has(Number(id))) delete next[Number(id)];
      });
      const byName = new Map(
        ratingsResponseState.players.map((row) => [row.name, row])
      );
      playerList.forEach((player) => {
        const row = byName.get(formatPlayerName(player));
        if (!row) return;
        const current = next[player.YouthPlayerID] ?? {};
        const updated = { ...current };
        Object.entries(row.ratings).forEach(([position, value]) => {
          if (typeof value !== "number") return;
          const previous = updated[position];
          if (previous === undefined || value > previous) {
            updated[position] = value;
          }
        });
        next[player.YouthPlayerID] = updated;
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
    setStalenessHours(readYouthStalenessHours());
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
          event.detail as { allowTrainingUntilMaxedOut?: boolean; stalenessHours?: number } | null;
        if (typeof detail?.allowTrainingUntilMaxedOut === "boolean") {
          setAllowTrainingUntilMaxedOut(detail.allowTrainingUntilMaxedOut);
        }
        if (typeof detail?.stalenessHours === "number") {
          setStalenessHours(detail.stalenessHours);
        }
      }
      setAllowTrainingUntilMaxedOut(readAllowTrainingUntilMaxedOut());
      setStalenessHours(readYouthStalenessHours());
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
    const maxAgeMs = stalenessHours * 60 * 60 * 1000;
    const isStale = Date.now() - lastRefresh >= maxAgeMs;
    if (!isStale) {
      staleRefreshAttemptedRef.current = false;
      return;
    }
    if (playersLoading) return;
    if (staleRefreshAttemptedRef.current) return;
    staleRefreshAttemptedRef.current = true;
    void refreshPlayers(undefined, { refreshAll: true, reason: "stale" });
  }, [playerList.length, stalenessHours, activeYouthTeamId, isConnected, playersLoading]);

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
        const storedToken = window.localStorage.getItem(helpStorageKey);
        if (storedToken !== token) {
          setShowHelp(true);
        }
      } catch (error) {
        if (error instanceof ChppAuthRequiredError) return;
        // ignore token check errors
      }
    };
    fetchToken();
  }, [isConnected]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setShowHelp(true);
    window.addEventListener("ya:help-open", handler);
    return () => window.removeEventListener("ya:help-open", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setShowChangelog(true);
    window.addEventListener("ya:changelog-open", handler);
    return () => window.removeEventListener("ya:changelog-open", handler);
  }, []);

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
          selector: "[data-help-anchor='training-panel']",
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
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error ?? "Failed to fetch player details");
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
      setError(err instanceof Error ? err.message : String(err));
      setDetails(previousDetails);
    } finally {
      setLoading(false);
    }
  };

  const ensureDetails = async (playerId: number, forceRefresh = false) => {
    const cached = cache[playerId];
    const isFresh =
      cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS;
    if (!forceRefresh && cached && isFresh) return;

    try {
      const { response, payload } = await fetchChppJson<PlayerDetailsResponse>(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      if (!response.ok || payload?.error) {
        return;
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
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
      // ignore hover failures
    }
  };

  const handleSelect = async (playerId: number) => {
    setSelectedId(playerId);
    await loadDetails(playerId);
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

    const optimizerPlayers: OptimizerPlayer[] = playerList.map((player) => ({
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
    }));

    const result = optimizeLineupForStar(
      optimizerPlayers,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelectionApplied,
      trainingPreferences
    );

    const nextAssignments: LineupAssignments = { ...result.lineup };
    const usedPlayers = new Set<number>(
      Object.values(nextAssignments).filter(Boolean) as number[]
    );
    const rankingBySkill = new Map<TrainingSkillKey, number[]>();
    (["keeper", "defending", "playmaking", "winger", "passing", "scoring", "setpieces"] as TrainingSkillKey[]).forEach(
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

    const benchSlots: Array<{ id: string; skill?: TrainingSkillKey }> = [
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
      rankingBySkill.get(primaryTraining)?.forEach(pushUnique);
    }
    if (isTrainingSkill(secondaryTraining)) {
      rankingBySkill.get(secondaryTraining)?.forEach(pushUnique);
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

      const optimizerPlayers: OptimizerPlayer[] = playerList.map((player) => ({
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
      }));

      const result = optimizeByRatings(
        optimizerPlayers,
        ratingsCache,
        starPlayerId,
        primaryTraining,
        secondaryTraining,
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

      const nextAssignments: LineupAssignments = { ...result.lineup };
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
      mode !== "revealSecondaryMax"
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
      } else {
        setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentUnavailable);
      }
      return;
    }

    const optimizerPlayers: OptimizerPlayer[] = playerList.map((player) => ({
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
    }));

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
      } else {
        setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentUnavailable);
      }
      return;
    }

    const nextAssignments: LineupAssignments = { ...result.lineup };
    const usedPlayers = new Set<number>(
      Object.values(nextAssignments).filter(Boolean) as number[]
    );
    const rankingBySkill = new Map<TrainingSkillKey, number[]>();
    ([
      "keeper",
      "defending",
      "playmaking",
      "winger",
      "passing",
      "scoring",
      "setpieces",
    ] as TrainingSkillKey[]).forEach((skill) => {
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
      { id: "B_X", skill: primaryTraining },
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

  const mapWithConcurrency = async <T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> => {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    const limit = Math.max(1, Math.min(concurrency, items.length));
    let nextIndex = 0;
    const runners = Array.from({ length: limit }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        if (currentIndex >= items.length) return;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    });
    await Promise.all(runners);
    return results;
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
    const teamId = teamIdOverride ?? activeYouthTeamId;
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
      // keep existing data
      return {
        ok: false,
        payload: null,
      };
    }
  };

  const refreshMatches = async (teamIdOverride?: number | null) => {
    const result = await fetchMatchesResponse(teamIdOverride);
    if (result.payload) {
      setMatchesState(result.payload);
    }
    return result.ok;
  };

  const refreshRatings = async (
    teamIdOverride?: number | null,
    matchesPayload?: MatchesResponse | null
  ) => {
    const teamId = teamIdOverride ?? activeYouthTeamId;
    try {
      setPlayerRefreshStatus(messages.refreshStatusFetchingMatches);
      const formatArchiveDate = (date: Date) => date.toISOString().slice(0, 10);
      const today = new Date();
      const firstDate = new Date(today.getTime() - 220 * 24 * 60 * 60 * 1000);
      const archiveParams = new URLSearchParams({
        isYouth: "true",
        FirstMatchDate: formatArchiveDate(firstDate),
        LastMatchDate: formatArchiveDate(today),
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
        return false;
      }

      setPlayerRefreshStatus(messages.refreshStatusFetchingRatings);

      const archiveTeam = archivePayload?.data?.HattrickData?.Team;
      const teamIdValue = Number(
        archiveTeam?.TeamID ??
          matchesPayload?.data?.HattrickData?.Team?.TeamID ??
          teamId ??
          0
      );
      const finishedMatches = normalizeArray<MatchSummary>(
        archiveTeam?.MatchList?.Match
      )
        .map((match) => ({
          ...match,
          _date: parseChppDate(match.MatchDate)?.getTime() ?? 0,
          _matchId: Number(match.MatchID),
          _sourceSystem:
            typeof match.SourceSystem === "string" && match.SourceSystem
              ? match.SourceSystem
              : "Youth",
        }))
        .filter((match) => Number.isFinite(match._matchId))
        .sort((a, b) => b._date - a._date)
        .slice(0, 50);

      if (!teamIdValue || finishedMatches.length === 0) {
        setRatingsResponseState({
          positions: POSITION_COLUMNS,
          players: [],
        });
        return true;
      }

      const playersMap = new Map<
        number,
        { id: number; name: string; ratings: Record<string, number> }
      >();
      const matchPlayerIdsByMatch = new Map<number, Set<number>>();

      let lineupCompleted = 0;
      const lineupResults = await mapWithConcurrency(
        finishedMatches,
        YOUTH_REFRESH_CONCURRENCY,
        async (match) => {
          try {
            const { response, payload } = await fetchChppJson<MatchLineupResponse>(
              `/api/chpp/youth/match-lineup?matchId=${match._matchId}&teamId=${teamIdValue}`,
              { cache: "no-store" }
            );
            if (!response.ok || payload?.error) {
              return {
                matchId: match._matchId,
                lineupPlayers: [] as MatchLineupPlayer[],
              };
            }
            return {
              matchId: match._matchId,
              lineupPlayers: normalizeArray<MatchLineupPlayer>(
                payload?.data?.HattrickData?.Team?.Lineup?.Player
              ),
            };
          } finally {
            lineupCompleted += 1;
            setPlayerRefreshStatus(
              formatStatusTemplate(messages.refreshStatusFetchingPastMatchesProgress, {
                completed: lineupCompleted,
                total: finishedMatches.length,
              })
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
          const fullName = [player.FirstName, player.NickName, player.LastName]
            .filter(Boolean)
            .join(" ");

          if (!playersMap.has(playerId)) {
            playersMap.set(playerId, {
              id: playerId,
              name: fullName,
              ratings: {},
            });
          }

          const entry = playersMap.get(playerId);
          if (!entry) return;
          const key = String(column);
          const existing = entry.ratings[key];
          if (existing === undefined || rating > existing) {
            entry.ratings[key] = rating;
          }
        });
        matchPlayerIdsByMatch.set(result.matchId, matchPlayers);
      });

      setRatingsResponseState({
        positions: POSITION_COLUMNS,
        players: Array.from(playersMap.values()),
      });

      setPlayerRefreshStatus(messages.refreshStatusFetchingHiddenSpecialties);
      const knownSpecialties = new Map<number, number>();
      playerList.forEach((player) => {
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
      Object.entries(hiddenSpecialtyByPlayerId).forEach(([id, specialty]) => {
        const playerId = Number(id);
        const specialtyValue = Number(specialty);
        if (
          Number.isFinite(playerId) &&
          Number.isFinite(specialtyValue) &&
          specialtyValue > 0
        ) {
          knownSpecialties.set(playerId, specialtyValue);
        }
      });
      const youthPlayerIds = new Set(playerList.map((player) => player.YouthPlayerID));
      const unresolvedPlayerIds = new Set(
        playerList
          .map((player) => player.YouthPlayerID)
          .filter((playerId) => {
            const known = knownSpecialties.get(playerId);
            return !(known && known > 0);
          })
      );
      const alreadyAnalyzedMatchIds = new Set(analyzedHiddenSpecialtyMatchIds);
      const discoveredThisRefresh: Record<number, number> = {};
      const newlyAnalyzedMatchIds = new Set<number>();

      if (unresolvedPlayerIds.size === 0) {
        finishedMatches.forEach((match) => {
          newlyAnalyzedMatchIds.add(match._matchId);
        });
      }

      const matchesToAnalyze =
        unresolvedPlayerIds.size > 0
          ? finishedMatches.filter((match) => {
              if (alreadyAnalyzedMatchIds.has(match._matchId)) return false;
              const participants = matchPlayerIdsByMatch.get(match._matchId);
              if (!participants || participants.size === 0) return true;
              let hasUnresolvedParticipant = false;
              participants.forEach((playerId) => {
                if (unresolvedPlayerIds.has(playerId)) {
                  hasUnresolvedParticipant = true;
                }
              });
              if (!hasUnresolvedParticipant) {
                newlyAnalyzedMatchIds.add(match._matchId);
              }
              return hasUnresolvedParticipant;
            })
          : [];

      let hiddenCompleted = 0;
      const hiddenResults = await mapWithConcurrency(
        matchesToAnalyze,
        YOUTH_REFRESH_CONCURRENCY,
        async (match) => {
          try {
            const { response, payload } = await fetchChppJson<MatchDetailsEventsResponse>(
              `/api/chpp/matchdetails?matchId=${match._matchId}&sourceSystem=${encodeURIComponent(
                match._sourceSystem
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
            events.forEach((event) => {
              const eventTypeId = Number(event.EventTypeID);
              const rule = SPECIAL_EVENT_SPECIALTY_RULES[eventTypeId];
              if (!rule) return;
              const candidateIds = rule.players.map((ref) =>
                Number(ref === "subject" ? event.SubjectPlayerID : event.ObjectPlayerID)
              );
              candidateIds.forEach((candidateId) => {
                if (!Number.isFinite(candidateId) || candidateId <= 0) return;
                if (!youthPlayerIds.has(candidateId)) return;
                candidates.push({
                  playerId: candidateId,
                  specialty: rule.specialty,
                });
              });
            });
            return {
              matchId: match._matchId,
              analyzed: true,
              candidates,
            };
          } finally {
            hiddenCompleted += 1;
            setPlayerRefreshStatus(
              formatStatusTemplate(
                messages.refreshStatusFetchingHiddenSpecialtiesProgress,
                {
                  completed: hiddenCompleted,
                  total: matchesToAnalyze.length,
                }
              )
            );
          }
        }
      );

      hiddenResults.forEach((result) => {
        if (!result.analyzed) return;
        result.candidates.forEach((candidate) => {
          const known = knownSpecialties.get(candidate.playerId);
          if (known && known > 0) return;
          knownSpecialties.set(candidate.playerId, candidate.specialty);
          discoveredThisRefresh[candidate.playerId] = candidate.specialty;
        });
        newlyAnalyzedMatchIds.add(result.matchId);
      });

      if (Object.keys(discoveredThisRefresh).length > 0) {
        setHiddenSpecialtyByPlayerId((prev) => ({
          ...prev,
          ...discoveredThisRefresh,
        }));
      }
      if (newlyAnalyzedMatchIds.size > 0) {
        setAnalyzedHiddenSpecialtyMatchIds((prev) => {
          const merged = new Set<number>(prev);
          newlyAnalyzedMatchIds.forEach((matchId) => merged.add(matchId));
          return Array.from(merged.values()).sort((a, b) => b - a);
        });
      }
      return true;
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return false;
      setRatingsResponseState(null);
      return false;
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
    setPlayersLoading(true);
    setPlayerRefreshStatus(messages.refreshStatusFetchingPlayers);
    const refreshAll = options?.refreshAll ?? false;
    const teamId =
      typeof teamIdOverride === "number" || teamIdOverride === null
        ? teamIdOverride ?? activeYouthTeamId
        : activeYouthTeamId;
    let playersUpdated = false;
    try {
      const teamParam = teamId ? `&youthTeamID=${teamId}` : "";
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
        throw new Error(payload?.error ?? "Failed to fetch youth players");
      }
      const raw = payload?.data?.HattrickData?.PlayerList?.YouthPlayer;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      setPlayerList(list);
      playersUpdated = true;
      let nextSelectedId = selectedId;
      if (
        selectedId &&
        !list.some((player) => player.YouthPlayerID === selectedId)
      ) {
        setSelectedId(null);
        nextSelectedId = null;
      }
      if (refreshAll) {
        setPlayerRefreshStatus(messages.refreshStatusFetchingPlayerDetails);
        const ids = list.map((player) => player.YouthPlayerID);
        const detailIds = nextSelectedId
          ? ids.filter((id) => id !== nextSelectedId)
          : ids;
        await Promise.all(detailIds.map((id) => ensureDetails(id, true)));
        if (nextSelectedId) {
          await loadDetails(nextSelectedId, true);
        }
      }
      if (options?.reason === "stale") {
        addNotification(messages.notificationStaleRefresh);
      }
      addNotification(messages.notificationPlayersRefreshed);
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return;
      addNotification(messages.unableToLoadPlayers);
      setLoadError(messages.unableToLoadPlayers);
      setLoadErrorDetails(null);
    } finally {
      let matchesOk = true;
      let ratingsOk = true;
      if (refreshAll) {
        setPlayerRefreshStatus(messages.refreshStatusFetchingMatches);
        const matchesResult = await fetchMatchesResponse(teamId);
        if (matchesResult.payload) {
          setMatchesState(matchesResult.payload);
        }
        matchesOk = matchesResult.ok;
        ratingsOk = await refreshRatings(teamId, matchesResult.payload ?? null);
      }
      if (
        playersUpdated &&
        (refreshAll ? matchesOk && ratingsOk : options?.recordRefresh)
      ) {
        const refreshedAt = Date.now();
        writeLastRefreshTimestamp(refreshedAt);
        setLastGlobalRefreshAt(refreshedAt);
      }
      setPlayerRefreshStatus(null);
      setPlayersLoading(false);
    }
  };

  const handleTeamChange = (nextTeamId: number | null) => {
    if (nextTeamId === selectedYouthTeamId) return;
    setSelectedYouthTeamId(nextTeamId);
    setAssignments({});
    setBehaviors({});
    setLoadedMatchId(null);
    setOptimizerDebug(null);
    setShowOptimizerDebug(false);
    setSelectedId(null);
    setPlayerList([]);
    setCache({});
    setDetails(null);
    setOrderSource(null);
    setOrderedPlayerIds(null);
    setStarPlayerId(null);
    setPrimaryTraining("");
    setSecondaryTraining("");
    setAutoSelectionApplied(false);
    setHiddenSpecialtyByPlayerId({});
    setAnalyzedHiddenSpecialtyMatchIds([]);
    if (nextTeamId) {
      refreshPlayers(nextTeamId, { recordRefresh: true });
      refreshMatches(nextTeamId);
      refreshRatings(nextTeamId);
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
      playerList.map((player) => ({
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
    setSecondaryTraining(autoSelection.secondarySkill ?? "");
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

  const manualReady = Boolean(starPlayerId && primaryTraining && secondaryTraining);

  const optimizeDisabledReason = !starPlayerId
    ? messages.optimizeLineupNeedsStar
    : !primaryTraining || !secondaryTraining
    ? messages.optimizeLineupNeedsTraining
    : messages.optimizeLineupTitle;

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
      default:
        return messages.unknownShort;
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
    ? trainingLabel(primaryTraining)
    : messages.trainingUnset;
  const optimizeSecondaryTrainingName = isTrainingSkill(secondaryTraining)
    ? trainingLabel(secondaryTraining)
    : messages.trainingUnset;
  const optimizeModeDisabledReasons = useMemo(() => {
    const reasons: {
      revealPrimaryCurrent?: string;
      revealSecondaryMax?: string;
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
    const primaryTrainingName = trainingLabel(primaryTraining).toLocaleLowerCase();
    const secondaryTrainingName = trainingLabel(secondaryTraining).toLocaleLowerCase();

    if (getKnownSkillValue(starSkills[primaryCurrentKey]) !== null) {
      reasons.revealPrimaryCurrent = messages.optimizeRevealPrimaryCurrentKnownTooltip
        .replace("{{player}}", starName)
        .replace("{{training}}", primaryTrainingName);
    }
    if (getKnownSkillValue(starSkills[secondaryMaxKey]) !== null) {
      reasons.revealSecondaryMax = messages.optimizeRevealSecondaryMaxKnownTooltip
        .replace("{{player}}", starName)
        .replace("{{training}}", secondaryTrainingName);
    }
    return reasons;
  }, [
    messages.optimizeRevealPrimaryCurrentKnownTooltip,
    messages.optimizeRevealSecondaryMaxKnownTooltip,
    messages.unknownShort,
    playerDetailsById,
    playerList,
    primaryTraining,
    secondaryTraining,
    starPlayerId,
  ]);

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
            <a className={styles.confirmSubmit} href="/api/chpp/oauth/start">
              {messages.authExpiredAction}
            </a>
          </div>
        }
      />
      <div className={styles.dashboardGrid} ref={dashboardRef}>
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
          orderedPlayerIds={orderedPlayerIds}
          orderSource={orderSource}
          youthTeams={youthTeams}
          selectedYouthTeamId={selectedYouthTeamId}
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
              setPrimaryTraining("");
              setSecondaryTraining("");
              return;
            }
            setPrimaryTraining(training.primarySkill);
            setSecondaryTraining(training.secondarySkill ?? "");
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
            setSecondaryTraining(autoSelection.secondarySkill ?? "");
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
          onRefresh={() =>
            refreshPlayers(undefined, { refreshAll: true, reason: "manual" })
          }
          onOrderChange={(ids) => applyPlayerOrder(ids, "list")}
          refreshing={playersLoading}
          refreshStatus={playerRefreshStatus}
          lastGlobalRefreshAt={lastGlobalRefreshAt}
          hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
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
                selectedId ? loadDetails(selectedId, true) : undefined
              }
              players={playerList}
              playerDetailsById={playerDetailsById}
              skillsMatrixRows={skillsMatrixRows}
              ratingsMatrixResponse={ratingsMatrixData?.response ?? null}
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
              hiddenSpecialtyByPlayerId={hiddenSpecialtyByPlayerId}
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
        <div className={styles.card} data-help-anchor="training-panel">
          <h2 className={styles.sectionTitle}>{messages.trainingTitle}</h2>
          <div className={styles.trainingControls}>
            <label className={styles.trainingRow}>
              <span className={styles.trainingLabel}>
                {messages.primaryTrainingLabel}
              </span>
              <select
                className={styles.trainingSelect}
                value={primaryTraining}
                onChange={(event) => {
                  const value = event.target.value;
                  const nextValue = isTrainingSkill(value) ? value : "";
                  setPrimaryTraining(nextValue);
                  setAutoSelectionApplied(false);
                  if (nextValue) {
                    addNotification(
                      `${messages.notificationPrimaryTrainingSet} ${trainingLabel(
                        nextValue
                      )}`
                    );
                  } else {
                    addNotification(
                      `${messages.notificationTrainingCleared} ${messages.primaryTrainingLabel}`
                    );
                  }
                }}
              >
                <option value="">{messages.trainingUnset}</option>
                <option value="keeper">{messages.trainingKeeper}</option>
                <option value="defending">{messages.trainingDefending}</option>
                <option value="playmaking">{messages.trainingPlaymaking}</option>
                <option value="winger">{messages.trainingWinger}</option>
                <option value="passing">{messages.trainingPassing}</option>
                <option value="scoring">{messages.trainingScoring}</option>
                <option value="setpieces">{messages.trainingSetPieces}</option>
              </select>
            </label>
            <label className={styles.trainingRow}>
              <span className={styles.trainingLabel}>
                {messages.secondaryTrainingLabel}
              </span>
              <select
                className={styles.trainingSelect}
                value={secondaryTraining}
                onChange={(event) => {
                  const value = event.target.value;
                  const nextValue = isTrainingSkill(value) ? value : "";
                  setSecondaryTraining(nextValue);
                  setAutoSelectionApplied(false);
                  if (nextValue) {
                    addNotification(
                      `${messages.notificationSecondaryTrainingSet} ${trainingLabel(
                        nextValue
                      )}`
                    );
                  } else {
                    addNotification(
                      `${messages.notificationTrainingCleared} ${messages.secondaryTrainingLabel}`
                    );
                  }
                }}
              >
                <option value="">{messages.trainingUnset}</option>
                <option value="keeper">{messages.trainingKeeper}</option>
                <option value="defending">{messages.trainingDefending}</option>
                <option value="playmaking">{messages.trainingPlaymaking}</option>
                <option value="winger">{messages.trainingWinger}</option>
                <option value="passing">{messages.trainingPassing}</option>
                <option value="scoring">{messages.trainingScoring}</option>
                <option value="setpieces">{messages.trainingSetPieces}</option>
              </select>
            </label>
          </div>
        </div>
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
          optimizeDisabled={!manualReady}
          optimizeDisabledReason={optimizeDisabledReason}
          forceOptimizeOpen={showHelp}
          optimizeStarPlayerName={optimizeStarPlayerName}
          optimizePrimaryTrainingName={optimizePrimaryTrainingName}
          optimizeSecondaryTrainingName={optimizeSecondaryTrainingName}
          optimizeModeDisabledReasons={optimizeModeDisabledReasons}
          trainedSlots={trainingSlots}
          onHoverPlayer={ensureDetails}
          onSelectPlayer={handleSelect}
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
          onRefresh={refreshMatches}
          onLoadLineup={loadLineup}
          loadedMatchId={loadedMatchId}
          onSubmitSuccess={() => setShowTrainingReminder(true)}
        />
      </div>
    </div>
    </div>
  );
}
