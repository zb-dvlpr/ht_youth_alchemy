"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import YouthPlayerList from "./YouthPlayerList";
import PlayerDetailsPanel, {
  YouthPlayerDetails,
} from "./PlayerDetailsPanel";
import LineupField, { LineupAssignments, LineupBehaviors } from "./LineupField";
import UpcomingMatches, { type MatchesResponse } from "./UpcomingMatches";
import { Messages } from "@/lib/i18n";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import Tooltip from "./Tooltip";
import {
  getAutoSelection,
  getTrainingSlots,
  optimizeLineupForStar,
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
};

type DashboardProps = {
  players: YouthPlayer[];
  matchesResponse: MatchesResponse;
  ratingsResponse: RatingsMatrixResponse | null;
  messages: Messages;
  isConnected: boolean;
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

export default function Dashboard({
  players,
  matchesResponse,
  ratingsResponse,
  messages,
  isConnected,
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

  const [assignments, setAssignments] = useState<LineupAssignments>({});
  const [behaviors, setBehaviors] = useState<LineupBehaviors>({});
  const [matchesState, setMatchesState] =
    useState<MatchesResponse>(matchesResponse);
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
  const [autoSelectionApplied, setAutoSelectionApplied] = useState(false);
  const [showTrainingReminder, setShowTrainingReminder] = useState(false);
  const { addNotification } = useNotifications();
  const isDev = process.env.NODE_ENV !== "production";
  const storageKey = "ya_dashboard_state_v1";
  const helpStorageKey = "ya_help_dismissed_v1";
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const helpCardRef = useRef<HTMLDivElement | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [helpPaths, setHelpPaths] = useState<string[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [ratingsCache, setRatingsCache] = useState<
    Record<number, Record<string, number>>
  >({});
  const [ratingsPositions, setRatingsPositions] = useState<number[]>([]);

  const playersById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    playerList.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [playerList]);

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

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as number[]),
    [assignments]
  );

  const selectedPlayer = useMemo(
    () =>
      playerList.find((player) => player.YouthPlayerID === selectedId) ?? null,
    [playerList, selectedId]
  );

  const ratingsMatrixData = useMemo(() => {
    if (playerList.length === 0) return null;
    const positions = ratingsResponse?.positions ?? ratingsPositions ?? [];
    const players = playerList.map((player) => ({
      id: player.YouthPlayerID,
      name: formatPlayerName(player),
      ratings: ratingsCache[player.YouthPlayerID] ?? {},
    }));
    if (!ratingsResponse && players.every((player) => !Object.keys(player.ratings).length)) {
      return null;
    }
    return {
      response: {
        positions,
        players,
      },
    };
  }, [playerList, ratingsCache, ratingsPositions, ratingsResponse]);

  const skillsMatrixRows = useMemo(
    () =>
      playerList.map((player) => ({
        id: player.YouthPlayerID,
        name: formatPlayerName(player),
      })),
    [playerList]
  );

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
    } catch {
      // ignore restore errors
    }
  }, []);

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
  ]);

  useEffect(() => {
    if (!ratingsResponse) return;
    setRatingsPositions(ratingsResponse.positions ?? []);
    setRatingsCache((prev) => {
      const next: Record<number, Record<string, number>> = { ...prev };
      const validIds = new Set(playerList.map((player) => player.YouthPlayerID));
      Object.keys(next).forEach((id) => {
        if (!validIds.has(Number(id))) delete next[Number(id)];
      });
      const byName = new Map(ratingsResponse.players.map((row) => [row.name, row]));
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
  }, [playerList, ratingsResponse]);

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
    if (!showHelp) {
      setHelpPaths([]);
      return;
    }
    const computePaths = () => {
      const root = dashboardRef.current;
      const helpCard = helpCardRef.current;
      if (!root || !helpCard) return;
      const rootRect = root.getBoundingClientRect();
      const helpRect = helpCard.getBoundingClientRect();
      const optimizeEl = root.querySelector(
        "[data-help-anchor='optimize']"
      ) as HTMLElement | null;
      const submitEl = root.querySelector(
        "[data-help-anchor='submit']"
      ) as HTMLElement | null;
      const optimizeTextEl = helpCard.querySelector(
        "[data-help-text='optimize']"
      ) as HTMLElement | null;
      const submitTextEl = helpCard.querySelector(
        "[data-help-text='submit']"
      ) as HTMLElement | null;
      const optimizeLineEl = helpCard.querySelector(
        "[data-help-line='optimize']"
      ) as HTMLElement | null;
      const submitLineEl = helpCard.querySelector(
        "[data-help-line='submit']"
      ) as HTMLElement | null;

      const paths: string[] = [];
      const defaultStartX = helpRect.right - rootRect.left - 6;
      const defaultStartY = helpRect.top - rootRect.top + 56;

      const makePath = (
        startEl: HTMLElement | null,
        target: HTMLElement,
        offsetY: number
      ) => {
        const rects =
          startEl?.getClientRects() ??
          (startEl ?? helpCard).getClientRects();
        const startRect = rects.length ? rects[rects.length - 1] : null;
        const startX = startRect
          ? startRect.right - rootRect.left
          : defaultStartX;
        const startY = startRect
          ? startRect.top - rootRect.top + startRect.height / 2 + offsetY
          : defaultStartY + offsetY;
        const targetRect = target.getBoundingClientRect();
        const endX =
          targetRect.left - rootRect.left + targetRect.width / 2;
        const endY =
          targetRect.top - rootRect.top + targetRect.height / 2 + offsetY;
        const midX = (startX + endX) / 2 + 80;
        const midY = (startY + endY) / 2 - 40;
        return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
      };

      if (optimizeEl) {
        paths.push(makePath(optimizeLineEl ?? optimizeTextEl, optimizeEl, 0));
      }
      if (submitEl) {
        paths.push(makePath(submitLineEl ?? submitTextEl, submitEl, 0));
      }

      setHelpPaths(paths);
    };

    const schedule = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(computePaths);
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

    setLoading(true);
    setError(null);
    setDetails(null);
    setUnlockStatus(null);

    try {
      const response = await fetch(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true&unlockSkills=1`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PlayerDetailsResponse;

      if (!response.ok || payload.error) {
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
    setAssignments(result.lineup);
    setBehaviors({});
    setOptimizerDebug(result.debug ?? null);
    setLoadedMatchId(null);
    if (Object.keys(result.lineup).length) {
      addNotification(messages.notificationOptimizeApplied);
    }
  };

  const refreshMatches = async () => {
    try {
      const response = await fetch("/api/chpp/matches?isYouth=true", {
        cache: "no-store",
      });
      const payload = (await response.json()) as MatchesResponse;
      setMatchesState(payload);
    } catch {
      // keep existing data
    }
  };

  const refreshPlayers = async () => {
    if (playersLoading) return;
    setPlayersLoading(true);
    try {
      const response = await fetch("/api/chpp/youth/players?actionType=details", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        data?: {
          HattrickData?: {
            PlayerList?: { YouthPlayer?: YouthPlayer[] | YouthPlayer };
          };
        };
      };
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
    } finally {
      setPlayersLoading(false);
    }
  };

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
  const trainingReminderText = messages.trainingReminderBody
    .replace("{{primary}}", trainingLabel(primaryTraining))
    .replace("{{secondary}}", trainingLabel(secondaryTraining));

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
    <div className={styles.dashboardGrid} ref={dashboardRef}>
      {showTrainingReminder ? (
        <div className={styles.trainingOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmCard}>
            <div className={styles.confirmTitle}>
              {messages.trainingReminderTitle}
            </div>
            <div className={styles.confirmBody}>
              {trainingReminderText}
            </div>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => setShowTrainingReminder(false)}
              >
                {messages.trainingReminderConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showHelp ? (
        <div className={styles.helpOverlay} aria-hidden="true">
          <svg className={styles.helpArrows} role="presentation">
            <defs>
              <marker
                id="helpArrowHead"
                markerWidth="10"
                markerHeight="8"
                refX="8"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path
                  d="M 0 0 L 10 4 L 0 8 Z"
                  className={styles.helpArrowHead}
                />
              </marker>
            </defs>
            {helpPaths.map((path) => (
              <path
                key={path}
                d={path}
                className={styles.helpArrow}
                markerEnd="url(#helpArrowHead)"
              />
            ))}
          </svg>
        </div>
      ) : null}
      <div
        className={showHelp ? styles.helpDisabledColumn : undefined}
        aria-hidden={showHelp ? "true" : undefined}
      >
        <YouthPlayerList
          players={playerList}
          assignedIds={assignedIds}
          selectedId={selectedId}
          starPlayerId={starPlayerId}
          onToggleStar={(playerId) => {
            setStarPlayerId((prev) => (prev === playerId ? null : playerId));
            setAutoSelectionApplied(false);
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
          refreshing={playersLoading}
          messages={messages}
        />
      </div>
      <div className={styles.columnStack}>
        {showHelp ? (
          <div className={styles.helpCard} ref={helpCardRef}>
            <h2 className={styles.helpTitle}>{messages.helpTitle}</h2>
            <p className={styles.helpIntro}>{messages.helpIntro}</p>
            <ul className={styles.helpList}>
              <li>{messages.helpPurpose}</li>
              <li>{messages.helpAi}</li>
              <li>{messages.helpOverride}</li>
              <li>{messages.helpNoAutoSubmit}</li>
              <li>{messages.helpLoadLineup}</li>
              <li>
                <span data-help-line="optimize" className={styles.helpLine}>
                  {messages.helpOptimizePrefix}{" "}
                  <span data-help-text="optimize" className={styles.helpAnchor}>
                    {messages.helpOptimizeLabel}
                  </span>{" "}
                  {messages.helpOptimizeSuffix}
                </span>
              </li>
              <li>
                <span data-help-line="submit" className={styles.helpLine}>
                  {messages.helpSubmitPrefix}{" "}
                  <span data-help-text="submit" className={styles.helpAnchor}>
                    {messages.helpSubmitLabel}
                  </span>{" "}
                  {messages.helpSubmitSuffix}
                </span>
              </li>
              <li>{messages.helpDrag}</li>
              <li>{messages.helpDesktop}</li>
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
        <div className={styles.card}>
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
          onOptimize={handleOptimize}
          optimizeDisabled={!manualReady}
          optimizeDisabledReason={optimizeDisabledReason}
          trainedSlots={trainingSlots}
          onHoverPlayer={ensureDetails}
          messages={messages}
        />
        {isDev ? (
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>{messages.optimizerDebugTitle}</h2>
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
            <div className={styles.optimizerModal}>
              <div className={styles.optimizerModalHeader}>
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
          onRefresh={refreshMatches}
          onLoadLineup={loadLineup}
          loadedMatchId={loadedMatchId}
          onSubmitSuccess={() => setShowTrainingReminder(true)}
        />
      </div>
    </div>
  );
}
