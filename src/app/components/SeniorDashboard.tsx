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
import { parseChppDate } from "@/lib/chpp/utils";
import { hattrickMatchUrl } from "@/lib/hattrick/urls";
import {
  readSeniorStalenessDays,
  SENIOR_SETTINGS_EVENT,
  SENIOR_SETTINGS_STORAGE_KEY,
} from "@/lib/settings";
import Modal from "./Modal";
import { RatingsMatrixResponse } from "./RatingsMatrix";
import PlayerDetailsPanel, { type PlayerDetailsPanelTab } from "./PlayerDetailsPanel";
import LineupField, { LineupAssignments, LineupBehaviors } from "./LineupField";
import UpcomingMatches, { Match, MatchesResponse } from "./UpcomingMatches";
import type { SetBestLineupMode } from "./UpcomingMatches";
import Tooltip from "./Tooltip";

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
const FRIENDLY_MATCH_TYPES = new Set<number>([4, 5, 8, 9]);
const LEAGUE_CUP_QUALI_MATCH_TYPES = new Set<number>([1, 2, 3]);
const TOURNAMENT_MATCH_TYPES = new Set<number>([50, 51]);
const OPPONENT_ARCHIVE_LIMIT = 20;
const OPPONENT_DETAILS_CONCURRENCY = 6;
const FORMATION_PREDICT_CONCURRENCY = 4;
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
  ratingMidfield: number | null;
  ratingRightDef: number | null;
  ratingMidDef: number | null;
  ratingLeftDef: number | null;
  ratingRightAtt: number | null;
  ratingMidAtt: number | null;
  ratingLeftAtt: number | null;
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

const buildLineupPayload = (
  assignments: LineupAssignments,
  tacticType: number
) => {
  const toId = (value: number | null | undefined) => value ?? 0;
  return {
    positions: FIELD_SLOT_ORDER.map((slot) => ({
      id: toId(assignments[slot]),
      behaviour: 0,
    })),
    bench: [
      ...BENCH_SLOT_ORDER.map((slot) => ({ id: toId(assignments[slot]), behaviour: 0 })),
      ...Array.from({ length: 7 }, () => ({ id: 0, behaviour: 0 })),
    ],
    kickers: Array.from({ length: 11 }, () => ({ id: 0, behaviour: 0 })),
    captain: 0,
    setPieces: 0,
    settings: {
      tactic: Number.isFinite(tacticType) ? tacticType : 0,
      speechLevel: 0,
      newLineup: "",
      coachModifier: 0,
      manMarkerPlayerId: 0,
      manMarkingPlayerId: 0,
    },
    substitutions: [],
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

const trainingAwareShapeAllowed = (
  shape: { defenders: number; midfielders: number; attackers: number },
  trainingType: number | null
) => {
  if (trainingType === null || trainingType === 0 || trainingType === 1) return true;
  if (trainingType === 2 || trainingType === 6 || trainingType === 9) return true;
  if (trainingType === 3 || trainingType === 11) {
    return shape.defenders === 5 || shape.defenders === 4 || shape.defenders === 3;
  }
  if (trainingType === 4) return shape.attackers === 3;
  if (trainingType === 5) return shape.defenders >= 4 && shape.midfielders >= 4;
  if (trainingType === 7) return shape.defenders === 2 && shape.midfielders === 5 && shape.attackers === 3;
  if (trainingType === 8) return shape.midfielders === 5;
  if (trainingType === 10) return shape.defenders === 5 && shape.midfielders === 5 && shape.attackers === 0;
  if (trainingType === 12) return shape.midfielders >= 4 && shape.attackers === 3;
  return true;
};

const requiredTrainableSlots = (trainingType: number | null): string[] => {
  switch (trainingType) {
    case 3:
    case 11:
      return ["CD_L", "CD_C", "CD_R"];
    case 4:
      return ["F_L", "F_C", "F_R"];
    case 5:
      return ["WB_L", "WB_R", "W_L", "W_R"];
    case 8:
      return ["W_L", "IM_L", "IM_C", "IM_R", "W_R"];
    case 10:
      return [...DEFENSE_SLOTS, ...MIDFIELD_SLOTS];
    case 12:
      return ["W_L", "W_R", "F_L", "F_C", "F_R"];
    default:
      return [];
  }
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

export default function SeniorDashboard({ messages }: SeniorDashboardProps) {
  const showSetBestLineupDebugModal = process.env.NODE_ENV !== "production";
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
  const [opponentFormationsModal, setOpponentFormationsModal] = useState<{
    title: string;
    opponentRows: OpponentFormationRow[];
    chosenFormation: string | null;
    chosenFormationAverages: OpponentFormationAverages | null;
    generatedRows: GeneratedFormationRow[];
    selectedGeneratedFormation: string | null;
    selectedGeneratedTactic: number | null;
    selectedComparison:
      | {
          ours: CollectiveRatings;
          opponent: CollectiveRatings;
        }
      | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

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
        return `${messages.trainingPassing} (${messages.sortDefender} + ${messages.sortPlaymaker})`;
      case 11:
        return `${messages.trainingDefending} (${messages.sortDefender} + ${messages.sortPlaymaker})`;
      case 12:
        return `${messages.trainingWinger} (${messages.trainingWinger} + ${messages.trainingScoring})`;
      default:
        return messages.unknownShort;
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
      });
    });
    return map;
  }, [detailsById, players]);

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
    if (options?.isStopped?.()) return false;
    const detailsPatch: Record<number, PlayerDetailCacheEntry> = {};
    rows.forEach((row) => {
      if (!row.detail) return;
      detailsPatch[row.playerId] = {
        data: row.detail,
        fetchedAt: row.fetchedAt,
      };
    });
    if (Object.keys(detailsPatch).length > 0) {
      setDetailsCache((prev) => ({ ...prev, ...detailsPatch }));
    }
    return true;
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
      return new Set<number>([...LEAGUE_CUP_QUALI_MATCH_TYPES, ...TOURNAMENT_MATCH_TYPES]);
    }
    return LEAGUE_CUP_QUALI_MATCH_TYPES;
  };

  const runSetBestLineupPredictRatings = async (
    matchId: number,
    mode: SetBestLineupMode
  ) => {
    const teamIdValue = Number(matchesState?.data?.HattrickData?.Team?.TeamID ?? 0);
    if (!Number.isFinite(teamIdValue) || teamIdValue <= 0) return;
    const selectedMatch = allMatches.find((match) => Number(match.MatchID) === matchId);
    if (!selectedMatch) return;
    const homeTeamId = Number(selectedMatch.HomeTeam?.HomeTeamID ?? 0);
    const awayTeamId = Number(selectedMatch.AwayTeam?.AwayTeamID ?? 0);
    const opponentTeamId =
      homeTeamId === teamIdValue
        ? awayTeamId
        : awayTeamId === teamIdValue
          ? homeTeamId
          : 0;
    if (!opponentTeamId) return;
    const opponentName =
      homeTeamId === teamIdValue
        ? selectedMatch.AwayTeam?.AwayTeamName
        : selectedMatch.HomeTeam?.HomeTeamName;
    const requestedTypes = classifyRequestedTypes(
      Number.isFinite(Number(selectedMatch.MatchType))
        ? Number(selectedMatch.MatchType)
        : null
    );
    const sourceSystem =
      typeof (selectedMatch as Record<string, unknown>).SourceSystem === "string"
        ? String((selectedMatch as Record<string, unknown>).SourceSystem)
        : "Hattrick";

    if (showSetBestLineupDebugModal) {
      setOpponentFormationsModal({
        title: opponentName
          ? `${messages.setBestLineup} · ${opponentName}`
          : messages.setBestLineup,
        opponentRows: [],
        chosenFormation: null,
        chosenFormationAverages: null,
        generatedRows: [],
        selectedGeneratedFormation: null,
        selectedGeneratedTactic: null,
        selectedComparison: null,
        loading: true,
        error: null,
      });
    }

    try {
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
      }>(`/api/chpp/matchesarchive?teamId=${opponentTeamId}`, { cache: "no-store" });
      if (!archiveResponse.ok || archivePayload?.error) {
        throw new Error(
          archivePayload?.details ?? archivePayload?.error ?? messages.unableToLoadMatches
        );
      }
      const archiveRaw = archivePayload?.data?.HattrickData?.Team?.MatchList?.Match;
      const archiveMatches = Array.isArray(archiveRaw)
        ? archiveRaw
        : archiveRaw
          ? [archiveRaw]
          : [];
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
            matchDate:
              typeof match.MatchDate === "string" ? String(match.MatchDate) : null,
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
      const opponentRows = await mapWithConcurrency(
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
          const formation = isOpponentHome
            ? typeof home?.Formation === "string"
              ? String(home.Formation)
              : null
            : awayId === opponentTeamId
              ? typeof away?.Formation === "string"
                ? String(away.Formation)
                : null
              : null;
          return {
            ...entry,
            formation,
            againstMyTeam,
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
      const chosenFormation = chooseFormationByRules(opponentRows);
      const chosenFormationAverages = computeChosenFormationAverages(
        opponentRows,
        chosenFormation
      );
      let activeTrainingType = trainingType;
      if (mode === "trainingAware" && activeTrainingType === null) {
        try {
          activeTrainingType = await fetchTrainingType();
          setTrainingType(activeTrainingType);
        } catch {
          activeTrainingType = null;
        }
      }

      let ratingsById = ratingsByPlayerId;
      if (!ratingsResponse?.players?.length) {
        const refreshedRatings = await fetchRatings();
        setRatingsResponse(refreshedRatings);
        ratingsById = {};
        (refreshedRatings.players ?? []).forEach((row) => {
          ratingsById[row.id] = { ...row.ratings };
        });
      }

      const playerPool = players.map((player) => ({
        id: player.PlayerID,
        name: formatPlayerName(player) || String(player.PlayerID),
      }));
      if (playerPool.length < 11) {
        throw new Error(messages.submitOrdersMinPlayers);
      }

      const baseRows = generateFormationShapes()
        .map((shape) => {
          if (
            mode === "trainingAware" &&
            !trainingAwareShapeAllowed(shape, activeTrainingType)
          ) {
            return null;
          }
          const defenseSlots =
            mode === "trainingAware" &&
            (activeTrainingType === 3 || activeTrainingType === 11) &&
            shape.defenders === 4
              ? ["WB_L", "CD_L", "CD_C", "CD_R"]
              : DEFENSE_FORMATION_MAP[shape.defenders] ?? [];
          const occupiedSlots = [
            "KP",
            ...defenseSlots,
            ...(MIDFIELD_FORMATION_MAP[shape.midfielders] ?? []),
            ...(ATTACK_FORMATION_MAP[shape.attackers] ?? []),
          ];
          if (mode === "trainingAware") {
            const requiredSlots = requiredTrainableSlots(activeTrainingType);
            if (requiredSlots.some((slot) => !occupiedSlots.includes(slot))) {
              return null;
            }
          }
          const orderedSlots = FIELD_SLOT_ORDER.filter((slot) => occupiedSlots.includes(slot));
        const availablePlayers = [...playerPool];
        const assignmentsForFormation: LineupAssignments = {};
        const slotRatingsForFormation: Record<string, number | null> = {};

        orderedSlots.forEach((slot) => {
          const roleCode = SLOT_TO_RATING_CODE[slot];
          availablePlayers.sort((left, right) => {
            const leftRating =
              typeof ratingsById[left.id]?.[String(roleCode)] === "number"
                ? ratingsById[left.id]?.[String(roleCode)]
                : -1;
            const rightRating =
              typeof ratingsById[right.id]?.[String(roleCode)] === "number"
                ? ratingsById[right.id]?.[String(roleCode)]
                : -1;
            if (rightRating !== leftRating) {
              return rightRating - leftRating;
            }
            return left.name.localeCompare(right.name);
          });
          const selectedPlayer = availablePlayers.shift() ?? null;
          if (!selectedPlayer) return;
          assignmentsForFormation[slot] = selectedPlayer.id;
          slotRatingsForFormation[slot] =
            typeof ratingsById[selectedPlayer.id]?.[String(roleCode)] === "number"
              ? ratingsById[selectedPlayer.id]?.[String(roleCode)]
              : null;
        });

          return {
            formation: `${shape.defenders}-${shape.midfielders}-${shape.attackers}`,
            assignments: assignmentsForFormation,
            slotRatings: slotRatingsForFormation,
            predicted: null,
            error: null,
          } as GeneratedFormationRow;
        })
        .filter((row): row is GeneratedFormationRow => Boolean(row));

      const rows = await mapWithConcurrency(
        baseRows,
        FORMATION_PREDICT_CONCURRENCY,
        async (row) => {
          try {
            const lineup = buildLineupPayload(row.assignments, tacticType);
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
              ...row,
              predicted: {
                tacticType: parseNumber(matchData.TacticType),
                tacticSkill: parseNumber(matchData.TacticSkill),
                ratingMidfield: parseNumber(matchData.RatingMidfield),
                ratingRightDef: parseNumber(matchData.RatingRightDef),
                ratingMidDef: parseNumber(matchData.RatingMidDef),
                ratingLeftDef: parseNumber(matchData.RatingLeftDef),
                ratingRightAtt: parseNumber(matchData.RatingRightAtt),
                ratingMidAtt: parseNumber(matchData.RatingMidAtt),
                ratingLeftAtt: parseNumber(matchData.RatingLeftAtt),
              },
              error: null,
            } as GeneratedFormationRow;
          } catch (error) {
            const details =
              error instanceof Error ? error.message : messages.submitOrdersError;
            return {
              ...row,
              predicted: null,
              error: details,
            } as GeneratedFormationRow;
          }
        }
      );

      let selectedGeneratedFormation: string | null = null;
      let selectedGeneratedTactic: number | null = null;
      let selectedComparison:
        | {
            ours: CollectiveRatings;
            opponent: CollectiveRatings;
          }
        | null = null;

      if (
        (mode === "ignoreTraining" || mode === "trainingAware") &&
        chosenFormationAverages
      ) {
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
          selectedComparison = {
            ours: chosenItem.collective,
            opponent: opponentCollective,
          };

          const chosenAssignments: LineupAssignments = { ...chosenItem.row.assignments };
          const used = new Set<number>(
            Object.values(chosenAssignments).filter(
              (id): id is number => typeof id === "number" && id > 0
            )
          );
          const remaining = players
            .filter((player) => !used.has(player.PlayerID))
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
        }
      }

      if (showSetBestLineupDebugModal) {
        setOpponentFormationsModal((prev) =>
          prev
            ? {
                ...prev,
                opponentRows,
                chosenFormation,
                chosenFormationAverages,
                generatedRows: rows,
                selectedGeneratedFormation,
                selectedGeneratedTactic,
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
                opponentRows: [],
                chosenFormation: null,
                chosenFormationAverages: null,
                generatedRows: [],
                selectedGeneratedFormation: null,
                selectedGeneratedTactic: null,
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
                      {messages.clubChronicleFormationsColumnFormation}:{" "}
                      <strong>
                        {opponentFormationsModal.chosenFormation ?? messages.unknownShort}
                      </strong>
                    </p>
                    <div className={styles.opponentFormationsTableWrap}>
                      <table className={styles.opponentFormationsTable}>
                        <thead>
                          <tr>
                            <th>{messages.matchesTitle}</th>
                            <th>{messages.ordersLabel}</th>
                            <th>{messages.clubChronicleFormationsColumnFormation}</th>
                            <th>{messages.ratingSectorMidfieldShort}</th>
                            <th>{messages.ratingSectorRightDefShort}</th>
                            <th>{messages.ratingSectorMidDefShort}</th>
                            <th>{messages.ratingSectorLeftDefShort}</th>
                            <th>{messages.ratingSectorRightAttShort}</th>
                            <th>{messages.ratingSectorMidAttShort}</th>
                            <th>{messages.ratingSectorLeftAttShort}</th>
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
                              <td colSpan={3}>
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
                {opponentFormationsModal.selectedGeneratedFormation &&
                opponentFormationsModal.selectedComparison ? (
                  <p className={styles.chroniclePressMeta}>
                    <strong>{opponentFormationsModal.selectedGeneratedFormation}</strong> ·{" "}
                    {opponentFormationsModal.selectedGeneratedTactic === 0
                      ? messages.tacticNormal
                      : opponentFormationsModal.selectedGeneratedTactic === 2
                        ? messages.tacticCounterAttacks
                        : messages.tacticPressing}
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
                ) : null}
                <div className={styles.opponentFormationsTableWrap}>
                  <table className={styles.opponentFormationsTable}>
                    <thead>
                      <tr>
                        <th>{messages.clubChronicleFormationsColumnFormation}</th>
                        <th>{messages.lineupTitle}</th>
                        <th>{messages.ratingSectorMidfieldShort}</th>
                        <th>{messages.ratingSectorRightDefShort}</th>
                        <th>{messages.ratingSectorMidDefShort}</th>
                        <th>{messages.ratingSectorLeftDefShort}</th>
                        <th>{messages.ratingSectorRightAttShort}</th>
                        <th>{messages.ratingSectorMidAttShort}</th>
                        <th>{messages.ratingSectorLeftAttShort}</th>
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
                {
                  PlayerSkills: detail.PlayerSkills,
                  InjuryLevel: detail.InjuryLevel,
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
              addNotification(messages.notificationLineupReset);
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
            skillMode="single"
            maxSkillLevel={20}
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
            onSetBestLineupMode={(matchId, mode) => {
              return runSetBestLineupPredictRatings(matchId, mode);
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
