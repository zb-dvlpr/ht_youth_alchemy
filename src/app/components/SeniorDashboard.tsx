"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { fetchChppJson, ChppAuthRequiredError } from "@/lib/chpp/client";
import { mapWithConcurrency } from "@/lib/async";
import { useNotifications } from "./notifications/NotificationsProvider";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { formatDateTime } from "@/lib/datetime";
import Modal from "./Modal";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import PlayerDetailsPanel from "./PlayerDetailsPanel";
import LineupField, { LineupAssignments, LineupBehaviors } from "./LineupField";
import UpcomingMatches, { MatchesResponse } from "./UpcomingMatches";

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
    }
  >;
};

type SeniorDashboardProps = {
  messages: Messages;
};

type SortKey =
  | "name"
  | "age"
  | "arrival"
  | "tsi"
  | "wage"
  | "form"
  | "stamina"
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

const SENIOR_REFRESH_REQUEST_EVENT = "ya:senior-refresh-request";
const SENIOR_REFRESH_STOP_EVENT = "ya:senior-refresh-stop";
const SENIOR_REFRESH_STATE_EVENT = "ya:senior-refresh-state";
const SENIOR_LATEST_UPDATES_OPEN_EVENT = "ya:senior-latest-updates-open";

const STATE_STORAGE_KEY = "ya_senior_dashboard_state_v1";
const LAST_REFRESH_STORAGE_KEY = "ya_senior_last_refresh_ts_v1";
const LIST_SORT_STORAGE_KEY = "ya_senior_player_list_sort_v1";
const DETAILS_TTL_MS = 60 * 60 * 1000;
const SENIOR_DETAILS_CONCURRENCY = 6;
const ALLOWED_MATCH_TYPES = new Set<number>([1, 2, 3, 4, 5, 8, 9]);
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

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
        Form: parseNumber(node.Form) ?? undefined,
        StaminaSkill: parseNumber(node.StaminaSkill) ?? undefined,
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

const readStoredLastRefresh = () => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(LAST_REFRESH_STORAGE_KEY);
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const writeStoredLastRefresh = (value: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_REFRESH_STORAGE_KEY, String(value));
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

export default function SeniorDashboard({ messages }: SeniorDashboardProps) {
  const { addNotification } = useNotifications();
  const [players, setPlayers] = useState<SeniorPlayer[]>([]);
  const [matchesState, setMatchesState] = useState<MatchesResponse>({});
  const [ratingsResponse, setRatingsResponse] = useState<RatingsMatrixResponse | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<number, PlayerDetailCacheEntry>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<LineupAssignments>({});
  const [behaviors, setBehaviors] = useState<LineupBehaviors>({});
  const [loadedMatchId, setLoadedMatchId] = useState<number | null>(null);
  const [tacticType, setTacticType] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorDetails, setLoadErrorDetails] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [refreshProgressPct, setRefreshProgressPct] = useState(0);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [updatesHistory, setUpdatesHistory] = useState<SeniorUpdatesGroupedEntry[]>([]);
  const [selectedUpdatesId, setSelectedUpdatesId] = useState<string | null>(null);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const refreshRunSeqRef = useRef(0);
  const activeRefreshRunIdRef = useRef<number | null>(null);
  const stoppedRefreshRunIdsRef = useRef<Set<number>>(new Set());

  const selectedPlayer =
    selectedId !== null
      ? players.find((player) => player.PlayerID === selectedId) ?? null
      : null;
  const selectedDetails =
    selectedId !== null ? detailsCache[selectedId]?.data ?? null : null;

  const detailsById = useMemo(() => {
    const map = new Map<number, SeniorPlayerDetails>();
    Object.entries(detailsCache).forEach(([key, entry]) => {
      const id = Number(key);
      if (!Number.isFinite(id)) return;
      map.set(id, entry.data);
    });
    return map;
  }, [detailsCache]);

  const skillValueForPlayer = (player: SeniorPlayer, key: (typeof SKILL_KEYS)[number]) => {
    const detailsSkills = detailsById.get(player.PlayerID)?.PlayerSkills;
    const listSkills = player.PlayerSkills;
    return parseSkill(detailsSkills?.[key] ?? listSkills?.[key]);
  };

  const sortedPlayers = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...players]
      .map((player, index) => ({ player, index }))
      .sort((left, right) => {
        const getMetric = (player: SeniorPlayer): number | string | null => {
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
              return player.Salary ?? null;
            case "form":
              return player.Form ?? null;
            case "stamina":
              return player.StaminaSkill ?? null;
            case "injuries":
              return player.InjuryLevel ?? null;
            case "cards":
              return player.Cards ?? null;
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

  const selectedSortedIndex = useMemo(() => {
    if (!selectedId) return -1;
    return sortedPlayers.findIndex((player) => player.PlayerID === selectedId);
  }, [selectedId, sortedPlayers]);

  const previousPlayerId =
    selectedSortedIndex > 0 ? sortedPlayers[selectedSortedIndex - 1]?.PlayerID ?? null : null;
  const nextPlayerId =
    selectedSortedIndex >= 0 && selectedSortedIndex < sortedPlayers.length - 1
      ? sortedPlayers[selectedSortedIndex + 1]?.PlayerID ?? null
      : null;

  const panelPlayers = useMemo(
    () =>
      players.map((player) => ({
        YouthPlayerID: player.PlayerID,
        FirstName: player.FirstName,
        NickName: player.NickName ?? "",
        LastName: player.LastName,
        Specialty: player.Specialty,
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
      PlayerSkills: selectedDetails?.PlayerSkills ?? selectedPlayer.PlayerSkills,
    };
  }, [selectedDetails?.PlayerSkills, selectedPlayer]);

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
        PlayerSkills: selectedPlayer.PlayerSkills,
      }
    );
  }, [panelDetailsById, selectedPlayer]);

  const skillsMatrixRows = useMemo(
    () =>
      sortedPlayers.map((player) => ({
        id: player.PlayerID,
        name: formatPlayerName(player),
      })),
    [sortedPlayers]
  );

  const playersByIdForLineup = useMemo(() => {
    const map = new Map<
      number,
      {
        YouthPlayerID: number;
        FirstName: string;
        NickName?: string;
        LastName: string;
        Specialty?: number;
        Age?: number;
        AgeDays?: number;
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
        PlayerSkills: detailsById.get(player.PlayerID)?.PlayerSkills,
      });
    });
    return map;
  }, [detailsById, players]);

  const filteredMatchesResponse = useMemo<MatchesResponse>(() => {
    const rawMatches = matchesState.data?.HattrickData?.MatchList?.Match;
    const list = Array.isArray(rawMatches) ? rawMatches : rawMatches ? [rawMatches] : [];
    const filtered = list.filter((match) => {
      const matchType = Number((match as { MatchType?: number | string }).MatchType);
      return Number.isFinite(matchType) && ALLOWED_MATCH_TYPES.has(matchType);
    });
    return {
      ...matchesState,
      data: {
        ...matchesState.data,
        HattrickData: {
          ...matchesState.data?.HattrickData,
          MatchList: {
            Match: filtered,
          },
        },
      },
    };
  }, [matchesState]);

  const ratingsByPlayerId = useMemo(() => {
    const payload: Record<number, Record<string, number>> = {};
    (ratingsResponse?.players ?? []).forEach((row) => {
      payload[row.id] = { ...row.ratings };
    });
    return payload;
  }, [ratingsResponse]);

  const selectedUpdatesEntry = useMemo(
    () =>
      selectedUpdatesId
        ? updatesHistory.find((entry) => entry.id === selectedUpdatesId) ?? null
        : updatesHistory[0] ?? null,
    [selectedUpdatesId, updatesHistory]
  );

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

  const fetchPlayers = async () => {
    const { response, payload } = await fetchChppJson<{
      data?: { HattrickData?: { Team?: { PlayerList?: { Player?: unknown } } } };
      error?: string;
      details?: string;
    }>("/api/chpp/players?orderBy=PlayerNumber", { cache: "no-store" });
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? messages.unableToLoadPlayers);
    }
    return normalizeSeniorPlayers(payload?.data?.HattrickData?.Team?.PlayerList?.Player);
  };

  const fetchMatches = async () => {
    const { response, payload } = await fetchChppJson<MatchesResponse>(
      "/api/chpp/matches?isYouth=false",
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? messages.unableToLoadMatches);
    }
    return payload as MatchesResponse;
  };

  const fetchRatings = async () => {
    const { response, payload } = await fetchChppJson<RatingsMatrixResponse & { error?: string; details?: string }>(
      "/api/chpp/ratings",
      { cache: "no-store" }
    );
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? messages.noMatchesReturned);
    }
    return payload as RatingsMatrixResponse;
  };

  const fetchPlayerDetailsById = async (playerId: number) => {
    const { response, payload } = await fetchChppJson<{
      data?: { HattrickData?: { Player?: SeniorPlayerDetails } };
      error?: string;
      details?: string;
    }>(`/api/chpp/playerdetails?playerId=${playerId}`, { cache: "no-store" });
    if (!response.ok || payload?.error || !payload?.data?.HattrickData?.Player) {
      return null;
    }
    return payload.data.HattrickData.Player;
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

  const buildUpdatesEntry = (
    prevPlayers: SeniorPlayer[],
    nextPlayers: SeniorPlayer[],
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
        };
      } else if (isNewPlayer) {
        groupedByPlayerId[playerId].isNewPlayer = true;
      }
      return groupedByPlayerId[playerId];
    };

    nextPlayers.forEach((player) => {
      const playerId = player.PlayerID;
      const previous = prevById.get(playerId);
      const playerName = formatPlayerName(player);
      const entry = upsert(playerId, playerName, !previous);

      SKILL_KEYS.forEach((skillKey) => {
        const prevValue = previous ? parseSkill(previous.PlayerSkills?.[skillKey]) : null;
        const nextValue = parseSkill(player.PlayerSkills?.[skillKey]);
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
    });

    const hasChanges = Object.values(groupedByPlayerId).some(
      (entry) => entry.isNewPlayer || entry.skills.length > 0 || entry.ratings.length > 0
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

    const previousPlayers = players;
    const previousRatings = ratingsByPlayerId;

    setRefreshing(true);
    setRefreshStatus(messages.refreshStatusFetchingPlayers);
    setRefreshProgressPct(10);

    try {
      const nextPlayers = await fetchPlayers();
      if (isStopped()) return false;

      setRefreshStatus(messages.refreshStatusFetchingPlayerDetails);
      setRefreshProgressPct(30);
      let detailsCompleted = 0;
      const detailRows = await mapWithConcurrency(
        nextPlayers,
        SENIOR_DETAILS_CONCURRENCY,
        async (player) => {
          const detail = await fetchPlayerDetailsById(player.PlayerID);
          detailsCompleted += 1;
          if (!isStopped()) {
            const pct = Math.round((detailsCompleted / Math.max(1, nextPlayers.length)) * 15);
            setRefreshProgressPct(30 + pct);
          }
          return {
            playerId: player.PlayerID,
            detail,
            fetchedAt: Date.now(),
          };
        }
      );
      if (isStopped()) return false;

      const detailsPatch: Record<number, PlayerDetailCacheEntry> = {};
      detailRows.forEach((row) => {
        if (!row.detail) return;
        detailsPatch[row.playerId] = {
          data: row.detail,
          fetchedAt: row.fetchedAt,
        };
      });
      if (Object.keys(detailsPatch).length > 0) {
        setDetailsCache((prev) => ({ ...prev, ...detailsPatch }));
      }

      setRefreshStatus(messages.refreshStatusFetchingMatches);
      setRefreshProgressPct(45);
      const nextMatches = await fetchMatches();
      if (isStopped()) return false;

      setRefreshStatus(messages.refreshStatusFetchingRatings);
      setRefreshProgressPct(75);
      const nextRatings = await fetchRatings();
      if (isStopped()) return false;

      setPlayers(nextPlayers);
      setMatchesState(nextMatches);
      setRatingsResponse(nextRatings);
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
        previousRatings,
        nextRatingsById
      );
      if (updatesEntry.hasChanges) {
        setUpdatesHistory((prev) => [updatesEntry, ...prev].slice(0, UPDATES_HISTORY_LIMIT));
        setSelectedUpdatesId(updatesEntry.id);
      }

      const refreshedAt = Date.now();
      writeStoredLastRefresh(refreshedAt);
      setLastRefreshAt(refreshedAt);
      setRefreshStatus(null);
      setRefreshProgressPct(100);
      setRefreshProgressPct(0);
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
    try {
      const nextMatches = await fetchMatches();
      setMatchesState(nextMatches);
      return true;
    } catch (error) {
      if (error instanceof ChppAuthRequiredError) return false;
      return false;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawSort = window.localStorage.getItem(LIST_SORT_STORAGE_KEY);
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

    const rawState = window.localStorage.getItem(STATE_STORAGE_KEY);
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState) as {
          selectedId?: number | null;
          assignments?: LineupAssignments;
          behaviors?: LineupBehaviors;
          loadedMatchId?: number | null;
          tacticType?: number;
          updatesHistory?: SeniorUpdatesGroupedEntry[];
          selectedUpdatesId?: string | null;
        };
        setSelectedId(typeof parsed.selectedId === "number" ? parsed.selectedId : null);
        setAssignments(parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {});
        setBehaviors(parsed.behaviors && typeof parsed.behaviors === "object" ? parsed.behaviors : {});
        setLoadedMatchId(typeof parsed.loadedMatchId === "number" ? parsed.loadedMatchId : null);
        setTacticType(typeof parsed.tacticType === "number" ? parsed.tacticType : 0);
        setUpdatesHistory(Array.isArray(parsed.updatesHistory) ? parsed.updatesHistory : []);
        setSelectedUpdatesId(typeof parsed.selectedUpdatesId === "string" ? parsed.selectedUpdatesId : null);
      } catch {
        // ignore parse errors
      }
    }

    setLastRefreshAt(readStoredLastRefresh());
    void refreshAll("manual");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      selectedId,
      assignments,
      behaviors,
      loadedMatchId,
      tacticType,
      updatesHistory,
      selectedUpdatesId,
    };
    window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(payload));
  }, [assignments, behaviors, loadedMatchId, selectedId, selectedUpdatesId, tacticType, updatesHistory]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LIST_SORT_STORAGE_KEY,
      JSON.stringify({ sortKey, sortDirection })
    );
  }, [sortDirection, sortKey]);

  useEffect(() => {
    if (!selectedId) return;
    void ensureDetails(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRefresh = () => {
      void refreshAll("manual");
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

    window.addEventListener(SENIOR_REFRESH_REQUEST_EVENT, handleRefresh);
    window.addEventListener(SENIOR_REFRESH_STOP_EVENT, handleStop);
    window.addEventListener(SENIOR_LATEST_UPDATES_OPEN_EVENT, handleUpdatesOpen);
    return () => {
      window.removeEventListener(SENIOR_REFRESH_REQUEST_EVENT, handleRefresh);
      window.removeEventListener(SENIOR_REFRESH_STOP_EVENT, handleStop);
      window.removeEventListener(SENIOR_LATEST_UPDATES_OPEN_EVENT, handleUpdatesOpen);
    };
  }, [addNotification, messages.notificationRefreshStoppedManual]);

  const specialtyByName = useMemo(() => {
    const map: Record<string, number | undefined> = {};
    players.forEach((player) => {
      map[formatPlayerName(player)] = player.Specialty;
    });
    return map;
  }, [players]);

  const selectedUpdatesRows = useMemo(() => {
    if (!selectedUpdatesEntry) return [];
    return Object.values(selectedUpdatesEntry.groupedByPlayerId).sort((a, b) =>
      a.playerName.localeCompare(b.playerName)
    );
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

  return (
    <div className={styles.dashboardStack}>
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
        open={updatesOpen}
        title={messages.clubChronicleUpdatesTitle}
        className={styles.chronicleUpdatesModal}
        body={
          updatesHistory.length > 0 ? (
            <>
              <div className={styles.chronicleUpdatesMetaBlock}>
                {selectedUpdatesEntry ? (
                  <p className={styles.chroniclePressMeta}>
                    {messages.clubChronicleUpdatesComparedAt}: {formatDateTime(selectedUpdatesEntry.comparedAt)}
                  </p>
                ) : null}
              </div>
              <div className={styles.chronicleUpdatesHistoryWrap}>
                <div className={styles.chronicleUpdatesHistoryHeader}>
                  {messages.clubChronicleUpdatesHistoryTitle}
                </div>
                <div className={styles.chronicleUpdatesHistoryList}>
                  {updatesHistory.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`${styles.chronicleUpdatesHistoryItem}${
                        selectedUpdatesEntry?.id === entry.id
                          ? ` ${styles.chronicleUpdatesHistoryItemActive}`
                          : ""
                      }`}
                      onClick={() => setSelectedUpdatesId(entry.id)}
                    >
                      <span>{formatDateTime(entry.comparedAt)}</span>
                      <span className={styles.chronicleUpdatesLabel}>
                        {entry.hasChanges
                          ? messages.clubChronicleUpdatesHistoryChanged
                          : messages.clubChronicleUpdatesHistoryNoChanges}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.chronicleUpdatesBody}>
                {selectedUpdatesRows.map((entry) => (
                  <div key={entry.playerId} className={styles.chronicleUpdatesTeamBlock}>
                    <h4 className={styles.chronicleUpdatesTeamHeading}>{entry.playerName}</h4>
                    {entry.isNewPlayer ? (
                      <p className={styles.chroniclePressMeta}>{messages.youthUpdatesNewPlayerLabel}</p>
                    ) : null}
                    {entry.skills.length > 0 ? (
                      <ul className={styles.chronicleUpdatesList}>
                        {entry.skills.map((change) => (
                          <li key={`${entry.playerId}-skill-${change.skillKey}`}>
                            {skillLabelByKey(change.skillKey)}: {change.previous ?? messages.unknownShort} →{" "}
                            {change.current ?? messages.unknownShort}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {entry.ratings.length > 0 ? (
                      <ul className={styles.chronicleUpdatesList}>
                        {entry.ratings.map((change) => (
                          <li key={`${entry.playerId}-rating-${change.position}`}>
                            {change.position}: {change.previous?.toFixed(1) ?? messages.unknownShort} →{" "}
                            {change.current?.toFixed(1) ?? messages.unknownShort}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
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

      <div className={styles.dashboardGrid}>
        <div className={styles.card}>
          <div className={styles.listHeader}>
            <h2 className={`${styles.sectionTitle} ${styles.listHeaderTitle}`}>
              {messages.seniorPlayerListTitle}
            </h2>
            <div className={styles.listHeaderControls}>
              <label className={styles.sortControl}>
                <span className={styles.sortLabel}>{messages.sortLabel}</span>
                <select
                  className={styles.sortSelect}
                  value={sortKey}
                  onChange={(event) => {
                    const nextKey = event.target.value as SortKey;
                    setSortKey(nextKey);
                    addNotification(`${messages.notificationSortBy} ${sortLabel(messages, nextKey)}`);
                  }}
                >
                  <option value="name">{messages.sortName}</option>
                  <option value="age">{messages.sortAge}</option>
                  <option value="arrival">{messages.sortArrival}</option>
                  <option value="tsi">{messages.sortTsi}</option>
                  <option value="wage">{messages.sortWage}</option>
                  <option value="form">{messages.sortForm}</option>
                  <option value="stamina">{messages.sortStamina}</option>
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
          {sortedPlayers.length === 0 ? (
            <p className={styles.muted}>{messages.unableToLoadPlayers}</p>
          ) : (
            <ul className={styles.list}>
              {sortedPlayers.map((player) => {
                const playerName = formatPlayerName(player);
                const isSelected = selectedId === player.PlayerID;
                const specialty = player.Specialty ?? null;
                const metric = (() => {
                  switch (sortKey) {
                    case "age":
                      return player.Age !== undefined && player.AgeDays !== undefined
                        ? `${player.Age}${messages.ageYearsShort} ${player.AgeDays}${messages.ageDaysShort}`
                        : messages.unknownShort;
                    case "arrival":
                      return player.ArrivalDate
                        ? formatDateTime(Date.parse(player.ArrivalDate.replace(" ", "T")))
                        : messages.unknownShort;
                    case "tsi":
                      return player.TSI ?? messages.unknownShort;
                    case "wage":
                      return player.Salary ?? messages.unknownShort;
                    case "form":
                      return player.Form ?? messages.unknownShort;
                    case "stamina":
                      return player.StaminaSkill ?? messages.unknownShort;
                    case "injuries":
                      return player.InjuryLevel ?? messages.unknownShort;
                    case "cards":
                      return player.Cards ?? messages.unknownShort;
                    case "keeper":
                      return skillValueForPlayer(player, "KeeperSkill") ?? messages.unknownShort;
                    case "defender":
                      return skillValueForPlayer(player, "DefenderSkill") ?? messages.unknownShort;
                    case "playmaker":
                      return skillValueForPlayer(player, "PlaymakerSkill") ?? messages.unknownShort;
                    case "winger":
                      return skillValueForPlayer(player, "WingerSkill") ?? messages.unknownShort;
                    case "passing":
                      return skillValueForPlayer(player, "PassingSkill") ?? messages.unknownShort;
                    case "scorer":
                      return skillValueForPlayer(player, "ScorerSkill") ?? messages.unknownShort;
                    case "setpieces":
                      return skillValueForPlayer(player, "SetPiecesSkill") ?? messages.unknownShort;
                    default:
                      return "";
                  }
                })();

                return (
                  <li key={player.PlayerID} className={styles.listItem}>
                    <div className={styles.playerRow}>
                      <button
                        type="button"
                        className={styles.playerButton}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedId(player.PlayerID);
                          addNotification(`${messages.notificationPlayerSelected} ${playerName}`);
                        }}
                      >
                        <span className={styles.playerSortMetric}>{metric}</span>
                        <span className={styles.playerNameRow}>
                          <span className={styles.playerName}>{playerName}</span>
                          {specialty && SPECIALTY_EMOJI[specialty] ? (
                            <span className={styles.playerSpecialty}>
                              {SPECIALTY_EMOJI[specialty]}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={styles.columnStack}>
          <PlayerDetailsPanel
            selectedPlayer={selectedPanelPlayer}
            detailsData={selectedPanelDetails}
            loading={false}
            error={null}
            lastUpdated={selectedId ? (detailsCache[selectedId]?.fetchedAt ?? null) : null}
            unlockStatus={null}
            onRefresh={() => {
              if (!selectedId) return;
              void ensureDetails(selectedId, true);
            }}
            players={panelPlayers}
            playerDetailsById={panelDetailsById}
            skillsMatrixRows={skillsMatrixRows}
            ratingsMatrixResponse={ratingsResponse}
            ratingsMatrixSelectedName={selectedPlayer ? formatPlayerName(selectedPlayer) : null}
            ratingsMatrixSpecialtyByName={specialtyByName}
            onSelectRatingsPlayer={(playerName) => {
              const player = players.find((item) => formatPlayerName(item) === playerName);
              if (!player) return;
              setSelectedId(player.PlayerID);
            }}
            hasPreviousPlayer={Boolean(previousPlayerId)}
            hasNextPlayer={Boolean(nextPlayerId)}
            onPreviousPlayer={() => {
              if (!previousPlayerId) return;
              setSelectedId(previousPlayerId);
            }}
            onNextPlayer={() => {
              if (!nextPlayerId) return;
              setSelectedId(nextPlayerId);
            }}
            playerKind="senior"
            skillMode="single"
            maxSkillLevel={20}
            messages={messages}
          />
        </div>

        <div className={styles.columnStack}>
          <LineupField
            assignments={assignments}
            behaviors={behaviors}
            playersById={playersByIdForLineup}
            playerDetailsById={new Map(
              Array.from(detailsById.entries()).map(([id, detail]) => [
                id,
                { PlayerSkills: detail.PlayerSkills },
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
            tacticType={tacticType}
            onTacticChange={setTacticType}
            onHoverPlayer={(playerId) => {
              void ensureDetails(playerId);
            }}
            onSelectPlayer={(playerId) => {
              setSelectedId(playerId);
            }}
            messages={messages}
          />
          <UpcomingMatches
            response={filteredMatchesResponse}
            messages={messages}
            assignments={assignments}
            behaviors={behaviors}
            tacticType={tacticType}
            sourceSystem="Hattrick"
            onRefresh={onRefreshMatchesOnly}
            onLoadLineup={(nextAssignments, nextBehaviors, matchId) => {
              setAssignments(nextAssignments);
              setBehaviors(nextBehaviors);
              setLoadedMatchId(matchId);
            }}
            loadedMatchId={loadedMatchId}
            onSubmitSuccess={() => {
              void onRefreshMatchesOnly();
            }}
          />
        </div>
      </div>
    </div>
  );
}
