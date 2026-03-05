"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { fetchChppJson, ChppAuthRequiredError } from "@/lib/chpp/client";
import { mapWithConcurrency } from "@/lib/async";
import { useNotifications } from "./notifications/NotificationsProvider";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { formatDateTime } from "@/lib/datetime";
import {
  readSeniorStalenessDays,
  SENIOR_SETTINGS_EVENT,
  SENIOR_SETTINGS_STORAGE_KEY,
} from "@/lib/settings";
import Modal from "./Modal";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import PlayerDetailsPanel, { type PlayerDetailsPanelTab } from "./PlayerDetailsPanel";
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
type SeniorSortSelectKey = SortKey | "custom";

const SENIOR_REFRESH_REQUEST_EVENT = "ya:senior-refresh-request";
const SENIOR_REFRESH_STOP_EVENT = "ya:senior-refresh-stop";
const SENIOR_REFRESH_STATE_EVENT = "ya:senior-refresh-state";
const SENIOR_LATEST_UPDATES_OPEN_EVENT = "ya:senior-latest-updates-open";

const STATE_STORAGE_KEY = "ya_senior_dashboard_state_v1";
const DATA_STORAGE_KEY = "ya_senior_dashboard_data_v1";
const LAST_REFRESH_STORAGE_KEY = "ya_senior_last_refresh_ts_v1";
const LIST_SORT_STORAGE_KEY = "ya_senior_player_list_sort_v1";
const DETAILS_TTL_MS = 60 * 60 * 1000;
const SENIOR_DETAILS_CONCURRENCY = 6;
const CHPP_SEK_PER_EUR = 10;
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
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = record["#text"];
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
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
  const [trainingType, setTrainingType] = useState<number | null>(null);
  const [includeTournamentMatches, setIncludeTournamentMatches] = useState(false);
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
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<number[] | null>(null);
  const [orderSource, setOrderSource] = useState<"list" | "ratings" | "skills" | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] =
    useState<PlayerDetailsPanelTab>("details");
  const [stateRestored, setStateRestored] = useState(false);
  const [stalenessDays, setStalenessDays] = useState(1);
  const [dataRestored, setDataRestored] = useState(false);

  const refreshRunSeqRef = useRef(0);
  const activeRefreshRunIdRef = useRef<number | null>(null);
  const stoppedRefreshRunIdsRef = useRef<Set<number>>(new Set());
  const staleRefreshAttemptedRef = useRef(false);

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

  const salaryValueForPlayer = (player: SeniorPlayer) => {
    const detailsSalary = detailsById.get(player.PlayerID)?.Salary;
    return typeof detailsSalary === "number" ? detailsSalary : player.Salary ?? null;
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

  const orderedListPlayers = useMemo(() => {
    if (orderedPlayerIds && orderSource && orderSource !== "list") {
      const map = new Map(players.map((player) => [player.PlayerID, player]));
      return orderedPlayerIds
        .map((id) => map.get(id))
        .filter((player): player is SeniorPlayer => Boolean(player));
    }
    return sortedPlayers;
  }, [orderSource, orderedPlayerIds, players, sortedPlayers]);
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
        InjuryLevel: player.InjuryLevel,
      });
    });
    return map;
  }, [detailsById, players]);

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

  const fetchTrainingType = async (): Promise<number | null> => {
    const { response, payload } = await fetchChppJson<{
      data?: {
        HattrickData?: {
          Team?: {
            TrainingType?: unknown;
          };
        };
      };
      error?: string;
      details?: string;
    }>("/api/chpp/training?actionType=view", { cache: "no-store" });
    if (!response.ok || payload?.error) {
      throw new Error(payload?.details ?? payload?.error ?? "Failed to fetch training");
    }
    return parseNumber(payload?.data?.HattrickData?.Team?.TrainingType);
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
    return normalizeSeniorPlayerDetails(payload.data.HattrickData.Player, playerId);
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
      let nextTrainingType: number | null | undefined = undefined;
      try {
        nextTrainingType = await fetchTrainingType();
      } catch {
        // Keep refresh flow intact even if training endpoint fails.
      }

      setPlayers(nextPlayers);
      setMatchesState(nextMatches);
      setRatingsResponse(nextRatings);
      if (nextTrainingType !== undefined) {
        setTrainingType(nextTrainingType);
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
    try {
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
            trainingType?: number | null;
            includeTournamentMatches?: boolean;
            updatesHistory?: SeniorUpdatesGroupedEntry[];
            selectedUpdatesId?: string | null;
            activeDetailsTab?: PlayerDetailsPanelTab;
            orderedPlayerIds?: number[] | null;
            orderSource?: "list" | "ratings" | "skills" | null;
          };
          setSelectedId(typeof parsed.selectedId === "number" ? parsed.selectedId : null);
          setAssignments(parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {});
          setBehaviors(parsed.behaviors && typeof parsed.behaviors === "object" ? parsed.behaviors : {});
          setLoadedMatchId(typeof parsed.loadedMatchId === "number" ? parsed.loadedMatchId : null);
          setTacticType(typeof parsed.tacticType === "number" ? parsed.tacticType : 0);
          setTrainingType(
            typeof parsed.trainingType === "number" ? parsed.trainingType : null
          );
          setIncludeTournamentMatches(Boolean(parsed.includeTournamentMatches));
          setUpdatesHistory(Array.isArray(parsed.updatesHistory) ? parsed.updatesHistory : []);
          setSelectedUpdatesId(typeof parsed.selectedUpdatesId === "string" ? parsed.selectedUpdatesId : null);
          if (
            parsed.activeDetailsTab === "details" ||
            parsed.activeDetailsTab === "skillsMatrix" ||
            parsed.activeDetailsTab === "ratingsMatrix"
          ) {
            setActiveDetailsTab(parsed.activeDetailsTab);
          }
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

      const rawData = window.localStorage.getItem(DATA_STORAGE_KEY);
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
          if (parsed.ratingsResponse && typeof parsed.ratingsResponse === "object") {
            setRatingsResponse(parsed.ratingsResponse);
          }
          if (parsed.detailsCache && typeof parsed.detailsCache === "object") {
            setDetailsCache(parsed.detailsCache);
          }
        } catch {
          // ignore parse errors
        }
      }

      setLastRefreshAt(readStoredLastRefresh());
      setStalenessDays(readSeniorStalenessDays());
      const lastRefresh = readStoredLastRefresh();
      const shouldRefresh =
        !lastRefresh || Date.now() - lastRefresh >= readSeniorStalenessDays() * 24 * 60 * 60 * 1000;
      const shouldBootstrap = restoredPlayersCount === 0;
      if (shouldRefresh || shouldBootstrap) {
        void refreshAll(shouldRefresh && lastRefresh ? "stale" : "manual");
      }
    } finally {
      setStateRestored(true);
      setDataRestored(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (
          event.key &&
          event.key !== SENIOR_SETTINGS_STORAGE_KEY &&
          event.key !== LAST_REFRESH_STORAGE_KEY
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
    window.addEventListener("storage", handle);
    window.addEventListener(SENIOR_SETTINGS_EVENT, handle);
    return () => {
      window.removeEventListener("storage", handle);
      window.removeEventListener(SENIOR_SETTINGS_EVENT, handle);
    };
  }, []);

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
      const lastRefresh = readStoredLastRefresh();
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
  }, [refreshing, stalenessDays]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!stateRestored) return;
    const payload = {
      selectedId,
      assignments,
      behaviors,
      loadedMatchId,
      tacticType,
      trainingType,
      includeTournamentMatches,
      updatesHistory,
      selectedUpdatesId,
      activeDetailsTab,
      orderedPlayerIds,
      orderSource,
    };
    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(payload));
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
    updatesHistory,
    activeDetailsTab,
    orderedPlayerIds,
    orderSource,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!stateRestored) return;
    window.localStorage.setItem(
      LIST_SORT_STORAGE_KEY,
      JSON.stringify({ sortKey, sortDirection })
    );
  }, [stateRestored, sortDirection, sortKey]);

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
    const payload = {
      players,
      matchesState,
      ratingsResponse,
      detailsCache,
    };
    try {
      window.localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore persist errors
    }
  }, [dataRestored, detailsCache, matchesState, players, ratingsResponse]);

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
                const cardsValue =
                  typeof playerDetails?.Cards === "number"
                    ? playerDetails.Cards
                    : typeof player.Cards === "number"
                    ? player.Cards
                    : null;
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
                      <span className={styles.playerMetricPill} title={messages.sortCards}>
                        <span className={styles.playerCardIcon}>🟥</span>
                      </span>
                    );
                  }
                  if (cardsValue === 2) {
                    return (
                      <span className={styles.playerMetricPill} title={messages.sortCards}>
                        <span className={styles.playerCardIcon}>🟨</span>
                        <span className={styles.playerCardIcon}>🟨</span>
                      </span>
                    );
                  }
                  if (cardsValue === 1) {
                    return (
                      <span className={styles.playerMetricPill} title={messages.sortCards}>
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
                      <button
                        type="button"
                        className={styles.playerButton}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setActiveDetailsTab("details");
                          setSelectedId(player.PlayerID);
                          addNotification(`${messages.notificationPlayerSelected} ${playerName}`);
                        }}
                      >
                        {!isNameSort ? (
                          <span className={styles.playerSortMetric}>
                            {metricNode}
                          </span>
                        ) : null}
                        <span
                          className={`${styles.playerNameRow} ${
                            isNameSort ? styles.playerNameRowTruncate : ""
                          }`}
                        >
                          {injuryLabel ? (
                            <span
                              className={styles.playerInjuryInline}
                              title={injuryLabel}
                              aria-label={injuryLabel}
                            >
                              {isBruised ? "🩹" : `✚${toSubscript(injuryWeeks ?? 0)}`}
                            </span>
                          ) : null}
                          <span className={styles.playerName}>{playerName}</span>
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
              setActiveDetailsTab("details");
              setSelectedId(player.PlayerID);
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
              setActiveDetailsTab("details");
              setSelectedId(playerId);
            }}
            messages={messages}
          />
          <UpcomingMatches
            response={matchesState}
            messages={messages}
            assignments={assignments}
            behaviors={behaviors}
            tacticType={tacticType}
            sourceSystem="Hattrick"
            includeTournamentMatches={includeTournamentMatches}
            onIncludeTournamentMatchesChange={setIncludeTournamentMatches}
            onRefresh={onRefreshMatchesOnly}
            onLoadLineup={(
              nextAssignments,
              nextBehaviors,
              matchId,
              loadedTacticType
            ) => {
              setAssignments(nextAssignments);
              setBehaviors(nextBehaviors);
              if (typeof loadedTacticType === "number") {
                setTacticType(loadedTacticType);
              }
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
