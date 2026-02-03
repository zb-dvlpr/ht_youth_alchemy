"use client";

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
import {
  getAutoSelection,
  getTrainingForStar,
  getTrainingSlots,
  optimizeLineupForStar,
  optimizeByRatings,
  optimizeRevealPrimaryCurrent,
  optimizeRevealPrimaryMax,
  optimizeRevealSecondaryCurrent,
  optimizeRevealSecondaryMax,
  buildSkillRanking,
  type OptimizerPlayer,
  type OptimizerDebug,
  type AutoSelection,
  type TrainingSkillKey,
} from "@/lib/optimizer";
import { useNotifications } from "./notifications/NotificationsProvider";

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

const DETAILS_TTL_MS = 5 * 60 * 1000;
const TRAINING_SKILLS: TrainingSkillKey[] = [
  "keeper",
  "defending",
  "playmaking",
  "winger",
  "passing",
  "scoring",
  "setpieces",
];

const isTrainingSkill = (
  value: string | null | undefined
): value is TrainingSkillKey => TRAINING_SKILLS.includes(value as TrainingSkillKey);

function resolveDetails(data: Record<string, unknown> | null) {
  if (!data) return null;
  const hattrickData = data.HattrickData as Record<string, unknown> | undefined;
  if (!hattrickData) return null;
  return (hattrickData.YouthPlayer as YouthPlayerDetails) ?? null;
}

function isAuthErrorPayload(
  payload: { code?: string; statusCode?: number; details?: string } | null,
  response?: Response
) {
  return (
    response?.status === 401 ||
    payload?.statusCode === 401 ||
    (payload?.code?.startsWith("CHPP_AUTH") ?? false) ||
    (payload?.details?.includes("401 - Unauthorized") ?? false)
  );
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
  const [helpCallouts, setHelpCallouts] = useState<
    {
      id: string;
      text: string;
      style: CSSProperties;
      hideIndex?: boolean;
      placement?: "above-left" | "above-center" | "right-center" | "left-center";
    }[]
  >([]);
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

  const playersById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    playerList.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [playerList]);

  const multiTeamEnabled = youthTeams.length > 1;
  const activeYouthTeamId = multiTeamEnabled ? selectedYouthTeamId : null;
  const activeYouthTeam = useMemo(() => {
    if (!activeYouthTeamId) return null;
    return youthTeams.find((team) => team.youthTeamId === activeYouthTeamId) ?? null;
  }, [activeYouthTeamId, youthTeams]);

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
    ]
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
        loadedMatchId?: number | null;
        cache?: Record<number, CachedDetails>;
        ratingsCache?: Record<number, Record<string, number>>;
        ratingsPositions?: number[];
        playerList?: YouthPlayer[];
        matchesState?: MatchesResponse;
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
    } catch {
      // ignore restore errors
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      assignments,
      behaviors,
      selectedId,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      loadedMatchId,
      cache,
      ratingsCache,
      ratingsPositions,
      playerList,
      matchesState,
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
    selectedId,
    starPlayerId,
    behaviors,
    playerList,
    matchesState,
    storageKey,
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
    if (!initialAuthError) return;
    setAuthError(true);
    setAuthErrorDetails(initialLoadDetails ?? null);
  }, [initialAuthError, initialLoadDetails]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isConnected) {
      setCurrentToken(null);
      setShowHelp(false);
      return;
    }
    const fetchToken = async () => {
      try {
        const response = await fetch("/api/chpp/oauth/check-token", {
          cache: "no-store",
        });
        const payload = (await response.json()) as { raw?: string };
        const raw = payload.raw ?? "";
        const match = raw.match(/<Token>(.*?)<\/Token>/);
        const token = match?.[1]?.trim() ?? null;
        if (!token) return;
        setCurrentToken(token);
        const storedToken = window.localStorage.getItem(helpStorageKey);
        if (storedToken !== token) {
          setShowHelp(true);
        }
      } catch {
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
        placement: "above-left" | "above-center" | "right-center" | "left-center";
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
          placement: "above-center",
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
          target.placement === "above-center"
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
      const response = await fetch(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PlayerDetailsResponse;

      if (!response.ok || payload.error) {
        if (isAuthErrorPayload(payload, response)) {
          setAuthError(true);
          setAuthErrorDetails(payload.details ?? messages.connectHint);
          setDetails(previousDetails);
          return;
        }
        throw new Error(payload.error ?? "Failed to fetch player details");
      }

      const resolved = payload.data ?? null;
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
      if (payload.unlockStatus) {
        setUnlockStatus(payload.unlockStatus);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDetails(previousDetails);
    } finally {
      setLoading(false);
    }
  };

  const ensureDetails = async (playerId: number) => {
    const cached = cache[playerId];
    const isFresh =
      cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS;
    if (cached && isFresh) return;

    try {
      const response = await fetch(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PlayerDetailsResponse;
      if (isAuthErrorPayload(payload, response)) {
        setAuthError(true);
        setAuthErrorDetails(payload.details ?? messages.connectHint);
        return;
      }
      if (!response.ok || payload.error) {
        return;
      }
      const resolved = payload.data ?? null;
      if (resolved) {
        setCache((prev) => ({
          ...prev,
          [playerId]: {
            data: resolved,
            fetchedAt: Date.now(),
          },
        }));
      }
      if (payload.unlockStatus) {
        setUnlockStatus(payload.unlockStatus);
      }
    } catch {
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
      autoSelectionApplied
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
          buildSkillRanking(optimizerPlayers, skill).ordered.map(
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
        autoSelectionApplied
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
      mode !== "revealPrimaryMax" &&
      mode !== "revealSecondaryCurrent" &&
      mode !== "revealSecondaryMax"
    ) {
      return;
    }
    if (
      !starPlayerId ||
      !isTrainingSkill(primaryTraining) ||
      !isTrainingSkill(secondaryTraining)
    ) {
      if (mode === "revealPrimaryMax") {
        setOptimizeErrorMessage(messages.optimizeRevealPrimaryMaxUnavailable);
      } else if (mode === "revealSecondaryCurrent") {
        setOptimizeErrorMessage(
          messages.optimizeRevealSecondaryCurrentUnavailable
        );
      } else if (mode === "revealSecondaryMax") {
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
      skills:
        playerDetailsById.get(player.YouthPlayerID)?.PlayerSkills ??
        (player.PlayerSkills as OptimizerPlayer["skills"]) ??
        null,
    }));

    const result =
      mode === "revealPrimaryMax"
        ? optimizeRevealPrimaryMax(
            optimizerPlayers,
            starPlayerId,
            primaryTraining,
            secondaryTraining,
            autoSelectionApplied
          )
        : mode === "revealSecondaryMax"
        ? optimizeRevealSecondaryMax(
            optimizerPlayers,
            starPlayerId,
            primaryTraining,
            secondaryTraining,
            autoSelectionApplied
          )
        : mode === "revealSecondaryCurrent"
        ? optimizeRevealSecondaryCurrent(
            optimizerPlayers,
            starPlayerId,
            primaryTraining,
            secondaryTraining,
            autoSelectionApplied
          )
        : optimizeRevealPrimaryCurrent(
            optimizerPlayers,
            starPlayerId,
            primaryTraining,
            secondaryTraining,
            autoSelectionApplied
          );

    if (result.error === "primary_current_known") {
      setOptimizeErrorMessage(messages.optimizeRevealPrimaryCurrentKnown);
      return;
    }

    if (result.error === "primary_max_known") {
      setOptimizeErrorMessage(messages.optimizeRevealPrimaryMaxKnown);
      return;
    }

    if (result.error === "secondary_current_known") {
      setOptimizeErrorMessage(messages.optimizeRevealSecondaryCurrentKnown);
      return;
    }

    if (result.error === "secondary_max_known") {
      setOptimizeErrorMessage(messages.optimizeRevealSecondaryMaxKnown);
      return;
    }

    if (result.error) {
      if (mode === "revealPrimaryMax") {
        setOptimizeErrorMessage(messages.optimizeRevealPrimaryMaxUnavailable);
      } else if (mode === "revealSecondaryCurrent") {
        setOptimizeErrorMessage(
          messages.optimizeRevealSecondaryCurrentUnavailable
        );
      } else if (mode === "revealSecondaryMax") {
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
        buildSkillRanking(optimizerPlayers, skill).ordered.map(
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

  const refreshMatches = async (teamIdOverride?: number | null) => {
    const teamId = teamIdOverride ?? activeYouthTeamId;
    try {
      const teamParam = teamId ? `&teamID=${teamId}` : "";
      const response = await fetch(`/api/chpp/matches?isYouth=true${teamParam}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as MatchesResponse & {
        code?: string;
        statusCode?: number;
        details?: string;
        error?: string;
      };
      if (isAuthErrorPayload(payload, response)) {
        setAuthError(true);
        setAuthErrorDetails(payload.details ?? messages.connectHint);
        return;
      }
      setMatchesState(payload);
    } catch {
      // keep existing data
    }
  };

  const refreshRatings = async (teamIdOverride?: number | null) => {
    const teamId = teamIdOverride ?? activeYouthTeamId;
    try {
      const teamParam = teamId ? `?teamID=${teamId}` : "";
      const response = await fetch(`/api/chpp/youth/ratings${teamParam}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        setAuthError(true);
        setAuthErrorDetails(messages.connectHint);
        return;
      }
      if (!response.ok) {
        setRatingsResponseState(null);
        return;
      }
      const payload = (await response.json()) as RatingsMatrixResponse;
      setRatingsResponseState(payload);
    } catch {
      setRatingsResponseState(null);
    }
  };

  const refreshPlayers = async (teamIdOverride?: number | null) => {
    if (playersLoading) return;
    setPlayersLoading(true);
    try {
      const teamId = teamIdOverride ?? activeYouthTeamId;
      const teamParam = teamId ? `&youthTeamID=${teamId}` : "";
      const response = await fetch(
        `/api/chpp/youth/players?actionType=details${teamParam}`,
        {
        cache: "no-store",
        }
      );
      const payload = (await response.json()) as {
        data?: {
          HattrickData?: {
            PlayerList?: { YouthPlayer?: YouthPlayer[] | YouthPlayer };
          };
        };
        error?: string;
        details?: string;
        statusCode?: number;
        code?: string;
      };
      if (isAuthErrorPayload(payload, response)) {
        setAuthError(true);
        setAuthErrorDetails(payload.details ?? messages.connectHint);
        return;
      }
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to fetch youth players");
      }
      const raw = payload?.data?.HattrickData?.PlayerList?.YouthPlayer;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      setPlayerList(list);
      if (
        selectedId &&
        !list.some((player) => player.YouthPlayerID === selectedId)
      ) {
        setSelectedId(null);
      }
      addNotification(messages.notificationPlayersRefreshed);
    } catch {
      addNotification(messages.unableToLoadPlayers);
      setLoadError(messages.unableToLoadPlayers);
      setLoadErrorDetails(null);
    } finally {
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
    setRatingsCache({});
    setRatingsPositions([]);
    setRatingsResponseState(null);
    setOrderSource(null);
    setOrderedPlayerIds(null);
    setStarPlayerId(null);
    setPrimaryTraining("");
    setSecondaryTraining("");
    setAutoSelectionApplied(false);
    if (nextTeamId) {
      refreshPlayers(nextTeamId);
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
      const response = await fetch(`/api/chpp/managercompendium${query}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ManagerCompendiumResponse;
      if (isAuthErrorPayload(payload, response)) {
        setAuthError(true);
        setAuthErrorDetails(payload.details ?? messages.connectHint);
        return;
      }
      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to fetch manager compendium");
      }
      const teams = extractYouthTeams(payload);
      setYouthTeams(teams);
      if (teams.length > 1) {
        handleTeamChange(teams[0]?.youthTeamId ?? null);
      } else {
        setSelectedYouthTeamId(null);
      }
      addNotification(messages.notificationTeamsLoaded);
    } catch {
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
        skills:
          playerDetailsById.get(player.YouthPlayerID)?.PlayerSkills ??
          (player.PlayerSkills as OptimizerPlayer["skills"]) ??
          null,
      })),
    [playerList, playerDetailsById]
  );

  const autoSelection = useMemo(
    () => getAutoSelection(optimizerPlayers),
    [optimizerPlayers]
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
      autoSelectionApplied
    );
    setOptimizerDebug(result.debug ?? null);
  }, [
    autoSelectionApplied,
    isDev,
    optimizerPlayers,
    primaryTraining,
    secondaryTraining,
    starPlayerId,
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
  const captainName = captainId
    ? formatPlayerName(playersById.get(captainId) ?? ({} as YouthPlayer))
    : messages.unknownShort;
  const trainingReminderText = messages.trainingReminderBody
    .replace("{{primary}}", trainingLabel(primaryTraining))
    .replace("{{secondary}}", trainingLabel(secondaryTraining))
    .replace("{{captain}}", captainName)
    .replace("{{tactic}}", messages.tacticPlayCreatively);

  const trainingSlots = useMemo(() => {
    if (!isTrainingSkill(primaryTraining) || !isTrainingSkill(secondaryTraining)) {
      return {
        primary: new Set<string>(),
        secondary: new Set<string>(),
        all: new Set<string>(),
      };
    }
    const slots = getTrainingSlots(primaryTraining, secondaryTraining);
    return {
      primary: slots.primarySlots,
      secondary: slots.secondarySlots,
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
            {changelogEntries.map((entry) => (
              <div key={entry.version} className={styles.changelogEntry}>
                <div className={styles.changelogVersion}>v{entry.version}</div>
                <ul className={styles.changelogList}>
                  {entry.entries.map((item, index) => (
                    <li key={`${entry.version}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setShowChangelog(false)}
          >
            {messages.helpDismissLabel}
          </button>
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
            const training = getTrainingForStar(optimizerPlayers, playerId);
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
          onRefresh={refreshPlayers}
          onOrderChange={(ids) => applyPlayerOrder(ids, "list")}
          refreshing={playersLoading}
          messages={messages}
        />
      </div>
      <div className={styles.columnStack}>
        {showHelp ? (
          <div className={styles.helpCard}>
            <h2 className={styles.helpTitle}>{messages.helpTitle}</h2>
            <p className={styles.helpIntro}>{messages.helpIntro}</p>
            <ul className={styles.helpList}>
              <li>{messages.helpBulletOverview}</li>
              <li>{messages.helpBulletMatches}</li>
              <li>{messages.helpBulletAdjust}</li>
              <li>{messages.helpBulletTraining}</li>
              <li>{messages.helpBulletDesktop}</li>
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
                  player.Specialty,
                ])
              )}
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
          optimizeDisabled={!manualReady}
          optimizeDisabledReason={optimizeDisabledReason}
          forceOptimizeOpen={showHelp}
          trainedSlots={trainingSlots}
          onHoverPlayer={ensureDetails}
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
