"use client";

import {
  calculateHtmsMetrics,
  calculatePsicoTsiMetrics,
  type SeniorPlayerMetricInput,
} from "@/lib/seniorPlayerMetrics";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { Messages } from "@/lib/i18n";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { hattrickPlayerUrl } from "@/lib/hattrick/urls";
import { parseChppDate } from "@/lib/chpp/utils";
import { formatTimeRemaining } from "@/lib/datetime";
import Modal from "./Modal";
import Tooltip from "./Tooltip";
import styles from "../page.module.css";

export const HATTRICK_AGE_DAYS_PER_YEAR = 112;
export const TRANSFER_SEARCH_MIN_AGE_YEARS = 17;
export const TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS =
  TRANSFER_SEARCH_MIN_AGE_YEARS * HATTRICK_AGE_DAYS_PER_YEAR;
export const TRANSFER_SEARCH_PAGE_SIZE = 25;
export const CHPP_SEK_PER_EUR = 10;

export const TRANSFER_SEARCH_SKILLS = [
  { key: "KeeperSkill", skillType: 1, labelKey: "skillKeeper", min: 0, max: 20 },
  { key: "DefenderSkill", skillType: 4, labelKey: "skillDefending", min: 0, max: 20 },
  { key: "PlaymakerSkill", skillType: 8, labelKey: "skillPlaymaking", min: 0, max: 20 },
  { key: "WingerSkill", skillType: 6, labelKey: "skillWinger", min: 0, max: 20 },
  { key: "PassingSkill", skillType: 7, labelKey: "skillPassing", min: 0, max: 20 },
  { key: "ScorerSkill", skillType: 5, labelKey: "skillScoring", min: 0, max: 20 },
  { key: "SetPiecesSkill", skillType: 3, labelKey: "skillSetPieces", min: 0, max: 20 },
  { key: "StaminaSkill", skillType: 9, labelKey: "sortStamina", min: 0, max: 9 },
  { key: "Leadership", skillType: 10, labelKey: "clubChronicleCoachColumnLeadership", min: 0, max: 7 },
  { key: "Experience", skillType: 11, labelKey: "sortExperience", min: 0, max: 20 },
] as const;

export type TransferSearchSkillKey = (typeof TRANSFER_SEARCH_SKILLS)[number]["key"];

export type TransferSearchSkillFilter = {
  skillKey: TransferSearchSkillKey;
  min: number;
  max: number;
};

export type TransferSearchFilters = {
  skillFilters: TransferSearchSkillFilter[];
  specialty: number | null;
  ageMinYears: number;
  ageMinDays: number;
  ageMaxYears: number;
  ageMaxDays: number;
  tsiMin: string;
  tsiMax: string;
  priceMinEur: string;
  priceMaxEur: string;
};

export type TransferSearchResult = {
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

export type TransferSearchBidDraft = {
  bidEur: string;
  maxBidEur: string;
};

export const TRANSFER_SEARCH_SORT_SEPARATOR = "__separator__";

export type TransferSearchSortKey =
  | "default"
  | "htmsPotential"
  | "psicoTsiAvg"
  | "psicoWageAvg"
  | "keeper"
  | "defending"
  | "playmaking"
  | "winger"
  | "passing"
  | "scoring"
  | "setPieces";

export type TransferSearchResultsViewMode = "cards" | "table";

export type TransferSearchTableRowData = {
  nationality: string;
  nationalityFlag?: string | null;
  nationalityTitle?: string;
  name: string;
  specialty: string;
  specialtyEmoji?: string | null;
  specialtyTitle?: string;
  injury: string;
  ageYears: number | null;
  ageDays: number | null;
  ageTotalDays?: number | null;
  priceKind: "HB" | "AP" | null;
  priceDisplay: string;
  priceValueEur?: number | null;
  tsi: number | null;
  leadership: number | null;
  experience: number | null;
  form: number | null;
  stamina: number | null;
  keeper: number | null;
  defending: number | null;
  playmaking: number | null;
  winger: number | null;
  passing: number | null;
  scoring: number | null;
  setPieces: number | null;
  htmsPotential: number | null;
  avgPsicoTsi: number | null;
  avgPsicoWage: number | null;
  wageDisplay: string;
  wageValueEur?: number | null;
  wageIncludesForeignBonus?: boolean;
  deadline: string | null;
  deadlineTimestamp?: number | null;
  minBidEur: number | null;
};

type TransferSearchSkillRowProps = {
  filter: TransferSearchSkillFilter;
  index: number;
  selectedOtherSkillKeys: string;
  disabled: boolean;
  messages: Messages;
  onUpdateFilter: (
    index: number,
    patch: Partial<TransferSearchSkillFilter>
  ) => void;
};

type TransferSearchModalProps = {
  open: boolean;
  messages: Messages;
  selectedPlayerName: string | null;
  selectedPlayerDetailPills?: string[];
  selectedPlayerDetailPillsInline?: boolean;
  filters: TransferSearchFilters | null;
  skillSlotCount?: number;
  loading: boolean;
  onUpdateSkillFilter: (
    index: number,
    patch: Partial<TransferSearchSkillFilter>
  ) => void;
  onAddSkillFilter?: (skillKey: TransferSearchSkillKey) => void;
  onUpdateFilterField: <K extends Exclude<keyof TransferSearchFilters, "skillFilters">>(
    key: K,
    value: TransferSearchFilters[K]
  ) => void;
  onSearch: (filters: TransferSearchFilters) => void;
  resultCountLabel: string | null;
  exactEmpty: boolean;
  fallbackNotice?: string;
  error: string | null;
  results: TransferSearchResult[];
  sortKey: TransferSearchSortKey;
  onSortKeyChange: (sortKey: TransferSearchSortKey) => void;
  resultsViewMode: TransferSearchResultsViewMode;
  onResultsViewModeChange: (mode: TransferSearchResultsViewMode) => void;
  getSortMetricInput?: (result: TransferSearchResult) => SeniorPlayerMetricInput;
  getTableRowData?: (result: TransferSearchResult) => TransferSearchTableRowData;
  canQuickBid?: boolean;
  quickBidPendingPlayerId?: number | null;
  onQuickBid?: (result: TransferSearchResult) => void;
  renderResultCard: (
    result: TransferSearchResult,
    countryMeta: TransferSearchResolvedCountryMeta | null
  ) => ReactNode;
  onClose: () => void;
};

type TransferSearchMarketBucket = {
  min: number;
  max: number;
  count: number;
};

type TransferSearchMarketSummary = {
  count: number;
  min: number;
  max: number;
  median: number;
  mean: number;
  q1: number;
  q3: number;
  buckets: TransferSearchMarketBucket[];
};

type TransferSearchMobilePanel = "criteria" | "results" | "summary";
type TransferSearchTableSortDirection = "best" | "reverse";
type TransferSearchCountryMeta = {
  name: string;
  flagEmoji: string | null;
};

export type TransferSearchResolvedCountryMeta = {
  name: string;
  display: string;
};

const TRANSFER_SEARCH_SORT_KEYS: readonly TransferSearchSortKey[] = [
  "default",
  "htmsPotential",
  "psicoTsiAvg",
  "psicoWageAvg",
  "keeper",
  "defending",
  "playmaking",
  "winger",
  "passing",
  "scoring",
  "setPieces",
] as const;

const buildTransferSearchMetricInput = (
  result: TransferSearchResult
): SeniorPlayerMetricInput => ({
  ageYears: result.age,
  ageDays: result.ageDays,
  tsi: result.tsi,
  salarySek: result.salarySek,
  isAbroad: result.isAbroad ?? undefined,
  form: result.form,
  stamina: result.staminaSkill,
  keeper: result.keeperSkill,
  defending: result.defenderSkill,
  playmaking: result.playmakerSkill,
  winger: result.wingerSkill,
  passing: result.passingSkill,
  scoring: result.scorerSkill,
  setPieces: result.setPiecesSkill,
});

const parsePsicoMetricValue = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateAverage = (values: Array<number | null>) => {
  const numeric = values.filter((value): value is number => typeof value === "number");
  if (numeric.length === 0) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
};

const getTransferSearchSortValue = (
  metricInput: SeniorPlayerMetricInput,
  sortKey: Exclude<TransferSearchSortKey, "default">
) => {
  if (sortKey === "keeper") return metricInput.keeper;
  if (sortKey === "defending") return metricInput.defending;
  if (sortKey === "playmaking") return metricInput.playmaking;
  if (sortKey === "winger") return metricInput.winger;
  if (sortKey === "passing") return metricInput.passing;
  if (sortKey === "scoring") return metricInput.scoring;
  if (sortKey === "setPieces") return metricInput.setPieces;
  if (sortKey === "htmsPotential") {
    return calculateHtmsMetrics(metricInput)?.potential ?? null;
  }

  const psico = calculatePsicoTsiMetrics(metricInput);
  if (!psico) return null;
  if (sortKey === "psicoTsiAvg") {
    return calculateAverage([
      parsePsicoMetricValue(psico.formHigh),
      parsePsicoMetricValue(psico.formAvg),
      parsePsicoMetricValue(psico.formLow),
    ]);
  }
  return calculateAverage([
    parsePsicoMetricValue(psico.wageHigh),
    parsePsicoMetricValue(psico.wageAvg),
    parsePsicoMetricValue(psico.wageLow),
  ]);
};

const formatTransferSearchTableMetric = (value: number | null, fractionDigits = 0) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return fractionDigits > 0 ? value.toFixed(fractionDigits) : String(Math.round(value));
};

const countryCodeToFlagEmoji = (input: unknown): string | null => {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return Array.from(code)
    .map((char) => String.fromCodePoint(char.charCodeAt(0) - 65 + 0x1f1e6))
    .join("");
};

const formatTransferSearchCountryFallback = (countryName: string | null | undefined) => {
  if (typeof countryName !== "string") return "—";
  const trimmed = countryName.trim();
  return trimmed || "—";
};

const formatTransferSearchInjuryCell = (
  injuryLevel: number | null
) => {
  if (injuryLevel === null || injuryLevel === undefined) return "—";
  if (injuryLevel <= 0) return "—";
  return String(injuryLevel);
};

const formatTransferSearchInjuryTooltip = (
  injuryLevel: number | null,
  messages: Messages
) => {
  if (injuryLevel === null || injuryLevel === undefined) {
    return messages.clubChronicleInjuryHealthy;
  }
  if (injuryLevel === 0 || (injuryLevel > 0 && injuryLevel < 1)) {
    return messages.seniorListInjuryBruised;
  }
  if (injuryLevel >= 1) {
    return messages.seniorListInjuryWeeks.replace(
      "{weeks}",
      String(Math.ceil(injuryLevel))
    );
  }
  return messages.clubChronicleInjuryHealthy;
};

const formatTransferSearchDeadlineRemaining = (
  deadline: string | null,
  messages: Messages
) => {
  const parsed = parseChppDate(deadline ?? undefined);
  if (!parsed) return messages.unknownShort;
  return formatTimeRemaining(parsed, {
    now: messages.transferSearchDeadlineNowShort,
    day: messages.transferSearchDeadlineDayShort,
    hour: messages.transferSearchDeadlineHourShort,
    minute: messages.transferSearchDeadlineMinuteShort,
  });
};

const interpolateChannel = (from: number, to: number, ratio: number) =>
  Math.round(from + (to - from) * ratio);

const buildTransferSearchPillStyle = (
  value: number | null | undefined,
  min: number | null,
  max: number | null,
  higherBetter = true
) => {
  if (value === null || value === undefined || min === null || max === null) {
    return undefined;
  }
  const useLogScale = min > 0 && max > min && max / min >= 3;
  const normalizedValue = useLogScale ? Math.log(value) : value;
  const normalizedMin = useLogScale ? Math.log(min) : min;
  const normalizedMax = useLogScale ? Math.log(max) : max;
  const span = normalizedMax - normalizedMin;
  const baseRatio =
    span <= 0
      ? 1
      : Math.min(1, Math.max(0, (normalizedValue - normalizedMin) / span));
  const ratio = higherBetter ? baseRatio : 1 - baseRatio;
  const bg = `rgb(${interpolateChannel(248, 221, ratio)} ${interpolateChannel(
    225,
    243,
    ratio
  )} ${interpolateChannel(224, 226, ratio)})`;
  const border = `rgb(${interpolateChannel(212, 61, ratio)} ${interpolateChannel(
    115,
    166,
    ratio
  )} ${interpolateChannel(106, 84, ratio)})`;
  const color = `rgb(${interpolateChannel(121, 20, ratio)} ${interpolateChannel(
    43,
    95,
    ratio
  )} ${interpolateChannel(36, 45, ratio)})`;
  return {
    background: bg,
    borderColor: border,
    color,
  };
};

export const ageToTotalDays = (years: number, days: number) =>
  Math.max(0, years) * HATTRICK_AGE_DAYS_PER_YEAR + Math.max(0, days);

export const totalDaysToAge = (totalDays: number) => {
  const clamped = Math.max(0, Math.round(totalDays));
  return {
    years: Math.floor(clamped / HATTRICK_AGE_DAYS_PER_YEAR),
    days: clamped % HATTRICK_AGE_DAYS_PER_YEAR,
  };
};

export const clampTransferSkillValue = (
  skillKey: TransferSearchSkillKey,
  value: number
) => {
  const definition =
    TRANSFER_SEARCH_SKILLS.find((entry) => entry.key === skillKey) ??
    TRANSFER_SEARCH_SKILLS[0];
  return Math.min(definition.max, Math.max(definition.min, Math.round(value)));
};

export const normalizeTransferSearchFilters = (
  filters: TransferSearchFilters
): TransferSearchFilters => {
  const ageMinYears = Math.max(0, Math.round(filters.ageMinYears));
  const ageMinDays = Math.min(
    HATTRICK_AGE_DAYS_PER_YEAR - 1,
    Math.max(0, Math.round(filters.ageMinDays))
  );
  const ageMaxYears = Math.max(0, Math.round(filters.ageMaxYears));
  const ageMaxDays = Math.min(
    HATTRICK_AGE_DAYS_PER_YEAR - 1,
    Math.max(0, Math.round(filters.ageMaxDays))
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
  return {
    ...filters,
    skillFilters: filters.skillFilters.map((filter) => {
      const clampedMin = clampTransferSkillValue(filter.skillKey, filter.min);
      const clampedMax = clampTransferSkillValue(filter.skillKey, filter.max);
      const normalizedMin = Math.min(clampedMin, clampedMax);
      const normalizedMax = Math.max(clampedMin, clampedMax);
      return {
        ...filter,
        min: normalizedMin,
        max: Math.min(normalizedMax, normalizedMin + TRANSFER_SEARCH_MAX_SKILL_SPAN),
      };
    }),
    ageMinYears: normalizedMinAge.years,
    ageMinDays: normalizedMinAge.days,
    ageMaxYears: normalizedMaxAge.years,
    ageMaxDays: normalizedMaxAge.days,
    tsiMin: filters.tsiMin.trim(),
    tsiMax: filters.tsiMax.trim(),
    priceMinEur: filters.priceMinEur.trim(),
    priceMaxEur: filters.priceMaxEur.trim(),
  };
};

export const buildTransferSearchParams = (filters: TransferSearchFilters) => {
  const normalized = normalizeTransferSearchFilters(filters);
  const params = new URLSearchParams({
    ageMin: String(normalized.ageMinYears),
    ageDaysMin: String(normalized.ageMinDays),
    ageMax: String(normalized.ageMaxYears),
    ageDaysMax: String(normalized.ageMaxDays),
    pageSize: String(TRANSFER_SEARCH_PAGE_SIZE),
    pageIndex: "0",
  });

  normalized.skillFilters.forEach((filter, index) => {
    const slot = index + 1;
    const definition = TRANSFER_SEARCH_SKILLS.find(
      (entry) => entry.key === filter.skillKey
    );
    if (!definition) return;
    params.set(`skillType${slot}`, String(definition.skillType));
    params.set(`minSkillValue${slot}`, String(filter.min));
    params.set(`maxSkillValue${slot}`, String(filter.max));
  });

  if (normalized.specialty !== null) {
    params.set("specialty", String(normalized.specialty));
  }

  const tsiMin = Number(normalized.tsiMin);
  const tsiMax = Number(normalized.tsiMax);
  if (Number.isFinite(tsiMin) && tsiMin >= 0) {
    params.set("tsiMin", String(Math.round(tsiMin)));
  }
  if (Number.isFinite(tsiMax) && tsiMax >= 0) {
    params.set("tsiMax", String(Math.round(tsiMax)));
  }

  const priceMinEur = Number(normalized.priceMinEur);
  const priceMaxEur = Number(normalized.priceMaxEur);
  if (Number.isFinite(priceMinEur) && priceMinEur >= 0) {
    params.set("priceMin", String(Math.round(priceMinEur * CHPP_SEK_PER_EUR)));
  }
  if (Number.isFinite(priceMaxEur) && priceMaxEur >= 0) {
    params.set("priceMax", String(Math.round(priceMaxEur * CHPP_SEK_PER_EUR)));
  }

  return params;
};

const parseTransferSearchNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseTransferSearchBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
};

export const normalizeTransferSearchResults = (input: unknown): TransferSearchResult[] => {
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
      const playerId = parseTransferSearchNumber(node.PlayerId);
      if (!playerId || playerId <= 0) return null;
      return {
        playerId,
        firstName: typeof node.FirstName === "string" ? node.FirstName : "",
        nickName: typeof node.NickName === "string" ? node.NickName : "",
        lastName: typeof node.LastName === "string" ? node.LastName : "",
        nativeCountryId: parseTransferSearchNumber(node.NativeCountryID),
        specialty: parseTransferSearchNumber(details?.Specialty),
        age: parseTransferSearchNumber(details?.Age),
        ageDays: parseTransferSearchNumber(details?.AgeDays),
        salarySek: parseTransferSearchNumber(details?.Salary),
        isAbroad: parseTransferSearchBoolean(details?.IsAbroad),
        tsi: parseTransferSearchNumber(details?.TSI),
        form: parseTransferSearchNumber(details?.PlayerForm),
        experience: parseTransferSearchNumber(details?.Experience),
        leadership: parseTransferSearchNumber(details?.Leadership),
        cards: parseTransferSearchNumber(details?.Cards),
        injuryLevel: parseTransferSearchNumber(details?.InjuryLevel),
        staminaSkill: parseTransferSearchNumber(details?.StaminaSkill),
        keeperSkill: parseTransferSearchNumber(details?.KeeperSkill),
        playmakerSkill: parseTransferSearchNumber(details?.PlaymakerSkill),
        scorerSkill: parseTransferSearchNumber(details?.ScorerSkill),
        passingSkill: parseTransferSearchNumber(details?.PassingSkill),
        wingerSkill: parseTransferSearchNumber(details?.WingerSkill),
        defenderSkill: parseTransferSearchNumber(details?.DefenderSkill),
        setPiecesSkill: parseTransferSearchNumber(details?.SetPiecesSkill),
        askingPriceSek: parseTransferSearchNumber(node.AskingPrice),
        highestBidSek: parseTransferSearchNumber(node.HighestBid),
        deadline: typeof node.Deadline === "string" ? node.Deadline : null,
        sellerTeamId: parseTransferSearchNumber(seller?.TeamID),
        sellerTeamName:
          typeof seller?.TeamName === "string" ? String(seller.TeamName) : null,
      } satisfies TransferSearchResult;
    })
    .filter((entry): entry is TransferSearchResult => Boolean(entry));
};

export const formatTransferSearchPlayerName = (player: TransferSearchResult) =>
  [player.firstName, player.nickName ? `"${player.nickName}"` : null, player.lastName]
    .filter(Boolean)
    .join(" ");

export const eurToSek = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * CHPP_SEK_PER_EUR);
};

export const buildTransferSearchMinimumBidEur = (result: TransferSearchResult) => {
  if (typeof result.highestBidSek === "number" && result.highestBidSek > 0) {
    return Math.ceil((result.highestBidSek + 1000 * CHPP_SEK_PER_EUR) / CHPP_SEK_PER_EUR);
  }
  if (typeof result.askingPriceSek === "number" && result.askingPriceSek > 0) {
    return Math.ceil(result.askingPriceSek / CHPP_SEK_PER_EUR);
  }
  return "";
};

export const formatTransferSearchBidDraftEur = (valueEur: number | string) =>
  valueEur === "" ? "" : String(valueEur);

const TRANSFER_SEARCH_MAX_SKILL_SPAN = 4;
const TRANSFER_SEARCH_MARKET_MIN_RICH_STATS_COUNT = 3;

const formatTransferSearchMarketEur = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    notation: value >= 100000 ? "compact" : "standard",
  }).format(Math.round(value));

const resolveTransferSearchMarketPriceEur = (result: TransferSearchResult) => {
  const priceSek =
    typeof result.highestBidSek === "number" && result.highestBidSek > 0
      ? result.highestBidSek
      : typeof result.askingPriceSek === "number" && result.askingPriceSek > 0
        ? result.askingPriceSek
        : null;
  return priceSek === null ? null : priceSek / CHPP_SEK_PER_EUR;
};

const percentile = (sortedValues: number[], ratio: number) => {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * ratio;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sortedValues[lowerIndex];
  const lower = sortedValues[lowerIndex];
  const upper = sortedValues[upperIndex];
  return lower + (upper - lower) * (index - lowerIndex);
};

const buildTransferSearchMarketSummary = (
  results: TransferSearchResult[]
): TransferSearchMarketSummary | null => {
  const prices = results
    .map(resolveTransferSearchMarketPriceEur)
    .filter((price): price is number => price !== null && Number.isFinite(price))
    .sort((left, right) => left - right);
  if (prices.length === 0) return null;

  const min = prices[0];
  const max = prices[prices.length - 1];
  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const bucketCount =
    min === max ? 1 : Math.min(8, Math.max(3, Math.ceil(Math.sqrt(prices.length))));
  const bucketWidth = min === max ? 1 : (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    min: min + bucketWidth * index,
    max: index === bucketCount - 1 ? max : min + bucketWidth * (index + 1),
    count: 0,
  }));
  prices.forEach((price) => {
    const bucketIndex =
      min === max
        ? 0
        : Math.min(bucketCount - 1, Math.floor((price - min) / bucketWidth));
    buckets[bucketIndex].count += 1;
  });

  return {
    count: prices.length,
    min,
    max,
    median: percentile(prices, 0.5),
    mean,
    q1: percentile(prices, 0.25),
    q3: percentile(prices, 0.75),
    buckets,
  };
};

const resolveTransferSearchSkillRange = (
  skillKey: TransferSearchSkillKey,
  currentMin: number,
  currentMax: number,
  edge: "min" | "max",
  nextValue: number
) => {
  if (edge === "min") {
    const nextMin = clampTransferSkillValue(skillKey, nextValue);
    const nextMax = clampTransferSkillValue(
      skillKey,
      Math.max(currentMax, nextMin)
    );
    return {
      min: nextMin,
      max: Math.min(nextMax, nextMin + TRANSFER_SEARCH_MAX_SKILL_SPAN),
    };
  }

  const nextMax = clampTransferSkillValue(skillKey, nextValue);
  const nextMin = clampTransferSkillValue(skillKey, Math.min(currentMin, nextMax));
  return {
    min: Math.max(nextMin, nextMax - TRANSFER_SEARCH_MAX_SKILL_SPAN),
    max: nextMax,
  };
};

const TransferSearchSkillRow = memo(function TransferSearchSkillRow({
  filter,
  index,
  selectedOtherSkillKeys,
  disabled,
  messages,
  onUpdateFilter,
}: TransferSearchSkillRowProps) {
  const [draftMin, setDraftMin] = useState(String(filter.min));
  const [draftMax, setDraftMax] = useState(String(filter.max));

  const availableOptions = TRANSFER_SEARCH_SKILLS.filter(
    (entry) =>
      entry.key === filter.skillKey || !selectedOtherSkillKeys.includes(entry.key)
  );
  const skillDefinition =
    TRANSFER_SEARCH_SKILLS.find((entry) => entry.key === filter.skillKey) ??
    TRANSFER_SEARCH_SKILLS[0];
  const commitRange = useCallback(
    (edge: "min" | "max", nextValue: number) => {
      const next = resolveTransferSearchSkillRange(
        filter.skillKey,
        filter.min,
        filter.max,
        edge,
        nextValue
      );
      setDraftMin(String(next.min));
      setDraftMax(String(next.max));
      startTransition(() => {
        onUpdateFilter(index, next);
      });
    },
    [filter.max, filter.min, filter.skillKey, index, onUpdateFilter]
  );
  const handleMinInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setDraftMin(nextValue);
      const parsed = Number(nextValue);
      if (!Number.isFinite(parsed)) return;
      commitRange("min", parsed);
    },
    [commitRange]
  );
  const handleMaxInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setDraftMax(nextValue);
      const parsed = Number(nextValue);
      if (!Number.isFinite(parsed)) return;
      commitRange("max", parsed);
    },
    [commitRange]
  );

  return (
    <div className={styles.transferSearchSkillRow}>
      <div className={styles.transferSearchValueGroup}>
        <span className={styles.transferSearchValueLabel}>
          {messages.seniorTransferSearchMinLabel}
        </span>
        <div className={styles.transferSearchValueStepper}>
          <button
            type="button"
            className={styles.transferSearchSkillStepperButton}
            onClick={() => commitRange("min", filter.min - 1)}
            disabled={disabled || filter.min <= skillDefinition.min}
            aria-label={`${messages.seniorTransferSearchMinLabel} -`}
          >
            -
          </button>
          <input
            className={styles.transferSearchSkillNumberInput}
            type="number"
            min={skillDefinition.min}
            max={skillDefinition.max}
            step={1}
            value={draftMin}
            onChange={handleMinInputChange}
            onBlur={() => setDraftMin(String(filter.min))}
            disabled={disabled}
            aria-label={messages.seniorTransferSearchMinLabel}
          />
          <button
            type="button"
            className={styles.transferSearchSkillStepperButton}
            onClick={() => commitRange("min", filter.min + 1)}
            disabled={disabled || filter.min >= Math.min(skillDefinition.max, filter.max)}
            aria-label={`${messages.seniorTransferSearchMinLabel} +`}
          >
            +
          </button>
        </div>
      </div>
      <select
        className={styles.transferSearchSelect}
        value={filter.skillKey}
        onChange={(event) => {
          const nextSkillKey = event.target.value as TransferSearchSkillKey;
          const next = {
            skillKey: nextSkillKey,
            ...resolveTransferSearchSkillRange(
              nextSkillKey,
              filter.min,
              filter.max,
              "max",
              filter.max
            ),
          };
          setDraftMin(String(next.min));
          setDraftMax(String(next.max));
          startTransition(() => {
            onUpdateFilter(index, next);
          });
        }}
        disabled={disabled}
      >
        {availableOptions.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {messages[entry.labelKey as keyof Messages]}
          </option>
        ))}
      </select>
      <div className={styles.transferSearchValueGroup}>
        <span className={styles.transferSearchValueLabel}>
          {messages.seniorTransferSearchMaxLabel}
        </span>
        <div className={styles.transferSearchValueStepper}>
          <button
            type="button"
            className={styles.transferSearchSkillStepperButton}
            onClick={() => commitRange("max", filter.max - 1)}
            disabled={disabled || filter.max <= filter.min}
            aria-label={`${messages.seniorTransferSearchMaxLabel} -`}
          >
            -
          </button>
          <input
            className={styles.transferSearchSkillNumberInput}
            type="number"
            min={skillDefinition.min}
            max={skillDefinition.max}
            step={1}
            value={draftMax}
            onChange={handleMaxInputChange}
            onBlur={() => setDraftMax(String(filter.max))}
            disabled={disabled}
            aria-label={messages.seniorTransferSearchMaxLabel}
          />
          <button
            type="button"
            className={styles.transferSearchSkillStepperButton}
            onClick={() => commitRange("max", filter.max + 1)}
            disabled={disabled || filter.max >= skillDefinition.max}
            aria-label={`${messages.seniorTransferSearchMaxLabel} +`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
});

type TransferSearchEmptySkillRowProps = {
  selectedSkillKeys: string;
  disabled: boolean;
  messages: Messages;
  onAddSkillFilter: (skillKey: TransferSearchSkillKey) => void;
};

const TransferSearchEmptySkillRow = memo(function TransferSearchEmptySkillRow({
  selectedSkillKeys,
  disabled,
  messages,
  onAddSkillFilter,
}: TransferSearchEmptySkillRowProps) {
  const availableOptions = TRANSFER_SEARCH_SKILLS.filter(
    (entry) => !selectedSkillKeys.includes(entry.key)
  );

  return (
    <div className={styles.transferSearchSkillRow}>
      <div className={styles.transferSearchValueGroup}>
        <span className={styles.transferSearchValueLabel}>
          {messages.seniorTransferSearchMinLabel}
        </span>
        <input
          className={styles.transferSearchSkillNumberInput}
          type="text"
          value="-"
          disabled
          aria-label={messages.seniorTransferSearchMinLabel}
          readOnly
        />
      </div>
      <select
        className={styles.transferSearchSelect}
        value=""
        onChange={(event) => {
          const nextSkillKey = event.target.value as TransferSearchSkillKey;
          if (nextSkillKey) {
            onAddSkillFilter(nextSkillKey);
          }
        }}
        disabled={disabled}
      >
        <option value="">-</option>
        {availableOptions.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {messages[entry.labelKey as keyof Messages]}
          </option>
        ))}
      </select>
      <div className={styles.transferSearchValueGroup}>
        <span className={styles.transferSearchValueLabel}>
          {messages.seniorTransferSearchMaxLabel}
        </span>
        <input
          className={styles.transferSearchSkillNumberInput}
          type="text"
          value="-"
          disabled
          aria-label={messages.seniorTransferSearchMaxLabel}
          readOnly
        />
      </div>
    </div>
  );
});

const TransferSearchModal = memo(function TransferSearchModal({
  open,
  messages,
  selectedPlayerName,
  selectedPlayerDetailPills,
  selectedPlayerDetailPillsInline,
  filters,
  skillSlotCount,
  loading,
  onUpdateSkillFilter,
  onAddSkillFilter,
  onUpdateFilterField,
  onSearch,
  resultCountLabel,
  exactEmpty,
  fallbackNotice,
  error,
  results,
  sortKey,
  onSortKeyChange,
  resultsViewMode,
  onResultsViewModeChange,
  getSortMetricInput,
  getTableRowData,
  canQuickBid,
  quickBidPendingPlayerId,
  onQuickBid,
  renderResultCard,
  onClose,
}: TransferSearchModalProps) {
  const [mobilePanel, setMobilePanel] = useState<TransferSearchMobilePanel>("results");
  const [tableSortColumn, setTableSortColumn] = useState<string>("htms");
  const [tableSortDirection, setTableSortDirection] =
    useState<TransferSearchTableSortDirection>("best");
  const [countryMetaById, setCountryMetaById] = useState<Record<number, TransferSearchCountryMeta>>(
    {}
  );
  const marketSummary = useMemo(
    () => buildTransferSearchMarketSummary(results),
    [results]
  );
  useEffect(() => {
    const countryIds = Array.from(
      new Set(
        results
          .map((result) => result.nativeCountryId)
          .filter((countryId): countryId is number =>
            typeof countryId === "number" && Number.isFinite(countryId) && countryId > 0
          )
      )
    ).filter((countryId) => !countryMetaById[countryId]);
    if (countryIds.length === 0) return;

    let cancelled = false;
    void Promise.all(
      countryIds.map(async (countryId) => {
        try {
          const response = await fetch(`/api/chpp/worlddetails?countryId=${countryId}`, {
            cache: "no-store",
          });
          const payload = (await response.json()) as {
            data?: {
              HattrickData?: {
                LeagueList?: {
                  League?: Record<string, unknown> | Array<Record<string, unknown>>;
                };
              };
            };
            error?: string;
          };
          if (!response.ok || payload?.error) return null;
          const rawLeague = payload?.data?.HattrickData?.LeagueList?.League;
          const leagues = Array.isArray(rawLeague) ? rawLeague : rawLeague ? [rawLeague] : [];
          for (const league of leagues) {
            const country =
              league && typeof league === "object" && league.Country && typeof league.Country === "object"
                ? (league.Country as Record<string, unknown>)
                : null;
            const resolvedId = Number(country?.CountryID);
            const name =
              typeof country?.CountryName === "string" ? country.CountryName.trim() : "";
            const flagEmoji = countryCodeToFlagEmoji(country?.CountryCode);
            if (resolvedId === countryId && name) {
              return {
                countryId,
                meta: {
                  name,
                  flagEmoji,
                },
              };
            }
          }
          return null;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const updates = entries.filter(
        (entry): entry is { countryId: number; meta: TransferSearchCountryMeta } => Boolean(entry)
      );
      if (updates.length === 0) return;
      setCountryMetaById((prev) => {
        const next = { ...prev };
        updates.forEach(({ countryId, meta }) => {
          next[countryId] = meta;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [countryMetaById, results]);
  const activeMobilePanel: TransferSearchMobilePanel =
    resultsViewMode === "table" ? "results" : mobilePanel;
  const sortOptions = useMemo(
    () => [
      { value: "default", label: messages.transferSearchSortDefault },
      { value: "htmsPotential", label: messages.transferSearchSortHtmsPotential },
      { value: TRANSFER_SEARCH_SORT_SEPARATOR, label: "──────────" },
      { value: "psicoTsiAvg", label: messages.transferSearchSortPsicoTsiAverage },
      { value: TRANSFER_SEARCH_SORT_SEPARATOR, label: "──────────" },
      { value: "psicoWageAvg", label: messages.transferSearchSortPsicoWageAverage },
      { value: TRANSFER_SEARCH_SORT_SEPARATOR, label: "──────────" },
      { value: "keeper", label: messages.skillKeeper },
      { value: "defending", label: messages.skillDefending },
      { value: "playmaking", label: messages.skillPlaymaking },
      { value: "winger", label: messages.skillWinger },
      { value: "passing", label: messages.skillPassing },
      { value: "scoring", label: messages.skillScoring },
      { value: "setPieces", label: messages.skillSetPieces },
    ] as const,
    [messages]
  );
  const sortedResults = useMemo(() => {
    if (sortKey === "default") return results;
    return [...results].sort((left, right) => {
      const leftValue = getTransferSearchSortValue(
        getSortMetricInput ? getSortMetricInput(left) : buildTransferSearchMetricInput(left),
        sortKey
      );
      const rightValue = getTransferSearchSortValue(
        getSortMetricInput ? getSortMetricInput(right) : buildTransferSearchMetricInput(right),
        sortKey
      );
      if (leftValue === null && rightValue === null) return left.playerId - right.playerId;
      if (leftValue === null) return 1;
      if (rightValue === null) return -1;
      if (rightValue !== leftValue) return rightValue - leftValue;
      return left.playerId - right.playerId;
    });
  }, [getSortMetricInput, results, sortKey]);
  const handleSortChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      if (
        nextValue === TRANSFER_SEARCH_SORT_SEPARATOR ||
        !TRANSFER_SEARCH_SORT_KEYS.includes(nextValue as TransferSearchSortKey)
      ) {
        return;
      }
      onSortKeyChange(nextValue as TransferSearchSortKey);
    },
    [onSortKeyChange]
  );
  const tableRows = useMemo(
    (): Array<{ result: TransferSearchResult; data: TransferSearchTableRowData }> =>
      sortedResults.map((result) => {
        const fallbackMinimumBid = buildTransferSearchMinimumBidEur(result);
        const fallbackMetricInput = getSortMetricInput
          ? getSortMetricInput(result)
          : buildTransferSearchMetricInput(result);
        const fallbackPriceSek =
          typeof result.highestBidSek === "number" && result.highestBidSek > 0
            ? result.highestBidSek
            : result.askingPriceSek;
        const fallbackDeadline = parseChppDate(result.deadline ?? undefined);
        return {
          result,
          data:
            getTableRowData?.(result) ?? {
              nationality: "—",
              nationalityFlag: null,
              nationalityTitle: undefined,
              name: formatTransferSearchPlayerName(result),
              specialty:
                result.specialty === null || result.specialty === undefined
                  ? "—"
                  : result.specialty === 0
                    ? messages.specialtyNone
                    : messages.unknownShort,
              specialtyEmoji:
                result.specialty !== null && result.specialty !== undefined
                  ? (SPECIALTY_EMOJI[result.specialty] ?? null)
                  : null,
              specialtyTitle:
                result.specialty === null || result.specialty === undefined
                  ? undefined
                  : result.specialty === 0
                    ? messages.specialtyNone
                    : messages.unknownShort,
              injury: formatTransferSearchInjuryCell(result.injuryLevel),
              ageYears: result.age,
              ageDays: result.ageDays,
              ageTotalDays:
                result.age !== null && result.ageDays !== null
                  ? ageToTotalDays(result.age, result.ageDays)
                  : null,
              priceKind:
                typeof result.highestBidSek === "number" && result.highestBidSek > 0
                  ? "HB"
                  : typeof result.askingPriceSek === "number" && result.askingPriceSek > 0
                    ? "AP"
                    : null,
              priceDisplay:
                typeof fallbackPriceSek === "number" && fallbackPriceSek > 0
                  ? new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }).format(fallbackPriceSek / CHPP_SEK_PER_EUR)
                  : "—",
              priceValueEur:
                typeof fallbackPriceSek === "number" && fallbackPriceSek > 0
                  ? fallbackPriceSek / CHPP_SEK_PER_EUR
                  : null,
              tsi: fallbackMetricInput.tsi ?? null,
              leadership: result.leadership,
              experience: result.experience,
              form: fallbackMetricInput.form ?? null,
              stamina: fallbackMetricInput.stamina ?? null,
              keeper: fallbackMetricInput.keeper ?? null,
              defending: fallbackMetricInput.defending ?? null,
              playmaking: fallbackMetricInput.playmaking ?? null,
              winger: fallbackMetricInput.winger ?? null,
              passing: fallbackMetricInput.passing ?? null,
              scoring: fallbackMetricInput.scoring ?? null,
              setPieces: fallbackMetricInput.setPieces ?? null,
              htmsPotential: getTransferSearchSortValue(fallbackMetricInput, "htmsPotential"),
              avgPsicoTsi: getTransferSearchSortValue(fallbackMetricInput, "psicoTsiAvg"),
              avgPsicoWage: getTransferSearchSortValue(fallbackMetricInput, "psicoWageAvg"),
              wageDisplay:
                typeof result.salarySek === "number"
                  ? new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }).format(result.salarySek / CHPP_SEK_PER_EUR)
                  : messages.unknownShort,
              wageValueEur:
                typeof result.salarySek === "number" ? result.salarySek / CHPP_SEK_PER_EUR : null,
              wageIncludesForeignBonus: Boolean(result.isAbroad),
              deadline: result.deadline,
              deadlineTimestamp: fallbackDeadline?.getTime() ?? null,
              minBidEur: typeof fallbackMinimumBid === "number" ? fallbackMinimumBid : null,
            },
        };
      }),
    [getSortMetricInput, getTableRowData, messages, sortedResults]
  );
  const renderedSkillSlotCount = filters
    ? Math.max(filters.skillFilters.length, skillSlotCount ?? filters.skillFilters.length)
    : 0;
  const maxBucketCount = marketSummary
    ? Math.max(...marketSummary.buckets.map((bucket) => bucket.count), 1)
    : 1;
  const marketSummaryRich =
    marketSummary &&
    marketSummary.count >= TRANSFER_SEARCH_MARKET_MIN_RICH_STATS_COUNT;
  const renderMobilePanelNav = (currentPanel: TransferSearchMobilePanel) => {
    if (resultsViewMode === "table") {
      return null;
    }
    const panelOptions: Array<{
      panel: TransferSearchMobilePanel;
      label: string;
    }> = [
      {
        panel: "results",
        label: messages.seniorTransferSearchResultsTitle,
      },
      {
        panel: "criteria",
        label: messages.seniorTransferSearchCriteriaTitle,
      },
      {
        panel: "summary",
        label: messages.transferSearchMarketSummaryTitle,
      },
    ];

    return (
      <div className={styles.transferSearchMobilePanelNav}>
        {panelOptions
          .filter((option) => option.panel !== currentPanel)
          .map((option) => (
            <button
              key={option.panel}
              type="button"
              className={styles.transferSearchMobilePanelButton}
              onClick={() => setMobilePanel(option.panel)}
            >
              {option.label}
            </button>
          ))}
      </div>
    );
  };
  const marketSummaryCard = (
      <div
      className={styles.transferSearchMarketSummary}
      data-transfer-search-mobile-panel="summary"
      data-transfer-search-mobile-active={activeMobilePanel === "summary" ? "true" : "false"}
    >
      {renderMobilePanelNav("summary")}
      <div className={styles.transferSearchMarketSummaryHeader}>
        <h4 className={styles.sectionHeading}>
          {messages.transferSearchMarketSummaryTitle}
        </h4>
        {marketSummary ? (
          <span className={styles.profileUpdated}>
            {messages.transferSearchMarketSummaryBasis.replace(
              "{{count}}",
              String(marketSummary.count)
            )}
          </span>
        ) : null}
      </div>
      {loading ? (
        <p className={styles.muted}>{messages.seniorTransferSearchLoading}</p>
      ) : marketSummary ? (
        <>
          {marketSummary.count < TRANSFER_SEARCH_MARKET_MIN_RICH_STATS_COUNT ? (
            <p className={styles.muted}>
              {messages.transferSearchMarketSummarySparse.replace(
                "{{count}}",
                String(marketSummary.count)
              )}
            </p>
          ) : null}
          <div className={styles.transferSearchMarketStatsGrid}>
            <div className={styles.transferSearchMarketStat}>
              <span className={styles.infoLabel}>
                {messages.transferSearchMarketRangeLabel}
              </span>
              <strong>
                {formatTransferSearchMarketEur(marketSummary.min)}
                {" - "}
                {formatTransferSearchMarketEur(marketSummary.max)}
              </strong>
            </div>
            {marketSummaryRich ? (
              <>
                <div className={styles.transferSearchMarketStat}>
                  <span className={styles.infoLabel}>
                    {messages.transferSearchMarketMedianLabel}
                  </span>
                  <strong>
                    {formatTransferSearchMarketEur(marketSummary.median)}
                  </strong>
                </div>
                <div className={styles.transferSearchMarketStat}>
                  <span className={styles.infoLabel}>
                    {messages.transferSearchMarketMeanLabel}
                  </span>
                  <strong>{formatTransferSearchMarketEur(marketSummary.mean)}</strong>
                </div>
                <div className={styles.transferSearchMarketStat}>
                  <span className={styles.infoLabel}>
                    {messages.transferSearchMarketMiddleLabel}
                  </span>
                  <strong>
                    {formatTransferSearchMarketEur(marketSummary.q1)}
                    {" - "}
                    {formatTransferSearchMarketEur(marketSummary.q3)}
                  </strong>
                </div>
              </>
            ) : null}
          </div>
          {marketSummaryRich ? (
            <div
              className={styles.transferSearchMarketDistribution}
              aria-label={messages.transferSearchMarketDistributionLabel}
            >
              {marketSummary.buckets.map((bucket, index) => (
                <div
                  key={`${bucket.min}-${bucket.max}-${index}`}
                  className={styles.transferSearchMarketBucketRow}
                >
                  <span className={styles.transferSearchMarketBucketLabel}>
                    {formatTransferSearchMarketEur(bucket.min)}
                    {" - "}
                    {formatTransferSearchMarketEur(bucket.max)}
                  </span>
                  <span className={styles.transferSearchMarketBucketTrack}>
                    <span
                      className={styles.transferSearchMarketBucketBar}
                      style={{
                        width:
                          bucket.count === 0
                            ? "0%"
                            : `${Math.max(
                                8,
                                Math.round((bucket.count / maxBucketCount) * 100)
                              )}%`,
                      }}
                    />
                  </span>
                  <span className={styles.transferSearchMarketBucketCount}>
                    {bucket.count}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className={styles.muted}>
          {messages.transferSearchMarketSummaryNoPrices}
        </p>
      )}
    </div>
  );

  const tableHeaderColumns: Array<{ key: string; label: string; higherBetter?: boolean | null }> = [
    { key: "nat", label: messages.transferSearchTableNationalityColumn, higherBetter: null },
    { key: "name", label: messages.transferSearchTableNameColumn, higherBetter: null },
    { key: "spec", label: messages.transferSearchTableSpecialtyColumn },
    { key: "inj", label: messages.transferSearchTableInjuryColumn, higherBetter: null },
    { key: "age", label: messages.transferSearchTableAgeColumn, higherBetter: false },
    { key: "price", label: messages.transferSearchTablePriceColumn, higherBetter: false },
    { key: "tsi", label: "TSI", higherBetter: true },
    { key: "lead", label: messages.transferSearchTableLeadershipColumn, higherBetter: true },
    { key: "xp", label: messages.transferSearchTableExperienceColumn, higherBetter: true },
    { key: "form", label: messages.transferSearchTableFormColumn, higherBetter: true },
    { key: "stam", label: messages.transferSearchTableStaminaColumn, higherBetter: true },
    { key: "kp", label: messages.transferSearchTableKeeperColumn, higherBetter: true },
    { key: "def", label: messages.transferSearchTableDefendingColumn, higherBetter: true },
    { key: "pm", label: messages.transferSearchTablePlaymakingColumn, higherBetter: true },
    { key: "wg", label: messages.transferSearchTableWingerColumn, higherBetter: true },
    { key: "ps", label: messages.transferSearchTablePassingColumn, higherBetter: true },
    { key: "sc", label: messages.transferSearchTableScoringColumn, higherBetter: true },
    { key: "sp", label: messages.transferSearchTableSetPiecesColumn, higherBetter: true },
    { key: "htms", label: messages.transferSearchTableHtmsColumn, higherBetter: true },
    { key: "ptsi", label: messages.transferSearchTablePsicoTsiColumn, higherBetter: true },
    { key: "pwage", label: messages.transferSearchTablePsicoWageColumn, higherBetter: true },
    { key: "wage", label: messages.transferSearchTableWageColumn, higherBetter: false },
    { key: "deadline", label: messages.transferSearchTableDeadlineColumn, higherBetter: null },
    { key: "bid", label: messages.transferSearchTableBidColumn, higherBetter: false },
  ] as const;

  const tableColumnStats = useMemo(() => {
    const collect = (selector: (row: TransferSearchTableRowData) => number | null | undefined) => {
      const values = tableRows
        .map(({ data }) => selector(data))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      if (values.length === 0) return { min: null, max: null };
      return { min: Math.min(...values), max: Math.max(...values) };
    };
    return {
      age: collect((row) => row.ageTotalDays),
      price: collect((row) => row.priceValueEur),
      tsi: collect((row) => row.tsi),
      lead: collect((row) => row.leadership),
      xp: collect((row) => row.experience),
      form: collect((row) => row.form),
      stam: collect((row) => row.stamina),
      kp: collect((row) => row.keeper),
      def: collect((row) => row.defending),
      pm: collect((row) => row.playmaking),
      wg: collect((row) => row.winger),
      ps: collect((row) => row.passing),
      sc: collect((row) => row.scoring),
      sp: collect((row) => row.setPieces),
      htms: collect((row) => row.htmsPotential),
      ptsi: collect((row) => row.avgPsicoTsi),
      pwage: collect((row) => row.avgPsicoWage),
      wage: collect((row) => row.wageValueEur),
      bid: collect((row) => row.minBidEur),
    };
  }, [tableRows]);

  const sortedTableRows = useMemo(() => {
    const compareText = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: "base" });
    const columnComparator = (left: TransferSearchTableRowData, right: TransferSearchTableRowData) => {
      switch (tableSortColumn) {
        case "nat":
          return compareText(left.nationalityTitle ?? left.nationality, right.nationalityTitle ?? right.nationality);
        case "name":
          return compareText(left.name, right.name);
        case "spec":
          return compareText(left.specialtyTitle ?? left.specialty, right.specialtyTitle ?? right.specialty);
        case "inj":
          return compareText(left.injury, right.injury);
        case "age":
          return (left.ageTotalDays ?? Number.POSITIVE_INFINITY) - (right.ageTotalDays ?? Number.POSITIVE_INFINITY);
        case "price":
          return (left.priceValueEur ?? Number.POSITIVE_INFINITY) - (right.priceValueEur ?? Number.POSITIVE_INFINITY);
        case "tsi":
          return (right.tsi ?? Number.NEGATIVE_INFINITY) - (left.tsi ?? Number.NEGATIVE_INFINITY);
        case "lead":
          return (right.leadership ?? Number.NEGATIVE_INFINITY) - (left.leadership ?? Number.NEGATIVE_INFINITY);
        case "xp":
          return (right.experience ?? Number.NEGATIVE_INFINITY) - (left.experience ?? Number.NEGATIVE_INFINITY);
        case "form":
          return (right.form ?? Number.NEGATIVE_INFINITY) - (left.form ?? Number.NEGATIVE_INFINITY);
        case "stam":
          return (right.stamina ?? Number.NEGATIVE_INFINITY) - (left.stamina ?? Number.NEGATIVE_INFINITY);
        case "kp":
          return (right.keeper ?? Number.NEGATIVE_INFINITY) - (left.keeper ?? Number.NEGATIVE_INFINITY);
        case "def":
          return (right.defending ?? Number.NEGATIVE_INFINITY) - (left.defending ?? Number.NEGATIVE_INFINITY);
        case "pm":
          return (right.playmaking ?? Number.NEGATIVE_INFINITY) - (left.playmaking ?? Number.NEGATIVE_INFINITY);
        case "wg":
          return (right.winger ?? Number.NEGATIVE_INFINITY) - (left.winger ?? Number.NEGATIVE_INFINITY);
        case "ps":
          return (right.passing ?? Number.NEGATIVE_INFINITY) - (left.passing ?? Number.NEGATIVE_INFINITY);
        case "sc":
          return (right.scoring ?? Number.NEGATIVE_INFINITY) - (left.scoring ?? Number.NEGATIVE_INFINITY);
        case "sp":
          return (right.setPieces ?? Number.NEGATIVE_INFINITY) - (left.setPieces ?? Number.NEGATIVE_INFINITY);
        case "htms":
          return (right.htmsPotential ?? Number.NEGATIVE_INFINITY) - (left.htmsPotential ?? Number.NEGATIVE_INFINITY);
        case "ptsi":
          return (right.avgPsicoTsi ?? Number.NEGATIVE_INFINITY) - (left.avgPsicoTsi ?? Number.NEGATIVE_INFINITY);
        case "pwage":
          return (right.avgPsicoWage ?? Number.NEGATIVE_INFINITY) - (left.avgPsicoWage ?? Number.NEGATIVE_INFINITY);
        case "wage":
          return (left.wageValueEur ?? Number.POSITIVE_INFINITY) - (right.wageValueEur ?? Number.POSITIVE_INFINITY);
        case "deadline":
          return (left.deadlineTimestamp ?? Number.POSITIVE_INFINITY) - (right.deadlineTimestamp ?? Number.POSITIVE_INFINITY);
        case "bid":
          return (left.minBidEur ?? Number.POSITIVE_INFINITY) - (right.minBidEur ?? Number.POSITIVE_INFINITY);
        default:
          return 0;
      }
    };
    return [...tableRows].sort((left, right) => {
      const cmp = columnComparator(left.data, right.data);
      if (cmp !== 0) return tableSortDirection === "reverse" ? -cmp : cmp;
      return left.result.playerId - right.result.playerId;
    });
  }, [tableRows, tableSortColumn, tableSortDirection]);

  const renderTablePill = useCallback(
    (
      content: ReactNode,
      options?: {
        numericValue?: number | null;
        stats?: { min: number | null; max: number | null };
        higherBetter?: boolean;
        neutral?: boolean;
      }
    ) => {
      const style =
        options?.neutral || !options?.stats
          ? undefined
          : buildTransferSearchPillStyle(
              options.numericValue ?? null,
              options.stats.min,
              options.stats.max,
              options.higherBetter ?? true
            );
      return (
        <span
          className={`${styles.transferSearchTablePill}${
            options?.neutral ? ` ${styles.transferSearchTablePillNeutral}` : ""
          }`}
          style={style}
        >
          {content}
        </span>
      );
    },
    []
  );

  return (
    <Modal
      open={open}
      title={messages.seniorTransferSearchModalTitle}
      className={`${styles.transferSearchModal}${
        resultsViewMode === "table" ? ` ${styles.transferSearchModalTableMode}` : ""
      }`}
      movable
      body={
        <div className={styles.transferSearchModalShell}>
          <div
            className={`${styles.transferSearchModalContent}${
              resultsViewMode === "table" ? ` ${styles.transferSearchModalContentTableMode}` : ""
            }`}
          >
            <aside
              className={`${styles.transferSearchModalSidebar}${
                resultsViewMode === "table" ? ` ${styles.transferSearchModalSidebarHidden}` : ""
              }`}
              data-transfer-search-mobile-panel="criteria"
              data-transfer-search-mobile-active={activeMobilePanel === "criteria" ? "true" : "false"}
            >
              {renderMobilePanelNav("criteria")}
              <div className={styles.transferSearchSidebarHeader}>
                <h3 className={styles.sectionHeading}>
                  {messages.seniorTransferSearchCriteriaTitle}
                </h3>
                {selectedPlayerName ? (
                  <div
                    className={
                      selectedPlayerDetailPillsInline
                        ? styles.transferSearchSourceInline
                        : undefined
                    }
                  >
                    <p className={styles.seniorPersonaLine}>
                      {messages.seniorTransferSearchSourcePlayerLabel.replace(
                        "{{player}}",
                        selectedPlayerName
                      )}
                    </p>
                    {selectedPlayerDetailPills?.length ? (
                      <div className={styles.transferSearchSourcePills}>
                        {selectedPlayerDetailPills.map((pill) => (
                          <span
                            key={pill}
                            className={styles.transferSearchSourcePill}
                          >
                            {pill}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {filters ? (
                <>
                  <div className={`${styles.transferSearchSection} ${styles.transferSearchCriteriaGrid}`}>
                    {filters.skillFilters.map((filter, index) => {
                      const selectedOtherSkillKeys = filters.skillFilters
                        .filter((_, filterIndex) => filterIndex !== index)
                        .map((entry) => entry.skillKey)
                        .sort()
                        .join("|");
                      return (
                        <TransferSearchSkillRow
                          key={`${filter.skillKey}-${filter.min}-${filter.max}-${index}`}
                          filter={filter}
                          index={index}
                          selectedOtherSkillKeys={selectedOtherSkillKeys}
                          disabled={loading}
                          messages={messages}
                          onUpdateFilter={onUpdateSkillFilter}
                        />
                      );
                    })}
                    {onAddSkillFilter
                      ? Array.from({
                          length: Math.max(
                            0,
                            renderedSkillSlotCount - filters.skillFilters.length
                          ),
                        }).map((_, index) => {
                          const selectedSkillKeys = filters.skillFilters
                            .map((entry) => entry.skillKey)
                            .sort()
                            .join("|");
                          return (
                            <TransferSearchEmptySkillRow
                              key={`empty-skill-${filters.skillFilters.length + index}`}
                              selectedSkillKeys={selectedSkillKeys}
                              disabled={loading}
                              messages={messages}
                              onAddSkillFilter={onAddSkillFilter}
                            />
                          );
                        })
                      : null}
                  </div>

                <div className={styles.transferSearchSection}>
                  <div className={styles.infoLabel}>{messages.specialtyLabel}</div>
                  <div className={styles.transferSearchSpecialtyRow}>
                    {[
                      { value: 0, label: messages.specialtyNone, emoji: "-" },
                      { value: 1, label: messages.specialtyTechnical, emoji: SPECIALTY_EMOJI[1] ?? "1" },
                      { value: 2, label: messages.specialtyQuick, emoji: SPECIALTY_EMOJI[2] ?? "2" },
                      { value: 3, label: messages.specialtyPowerful, emoji: SPECIALTY_EMOJI[3] ?? "3" },
                      { value: 4, label: messages.specialtyUnpredictable, emoji: SPECIALTY_EMOJI[4] ?? "4" },
                      { value: 5, label: messages.specialtyHeadSpecialist, emoji: SPECIALTY_EMOJI[5] ?? "5" },
                      { value: 6, label: messages.specialtyResilient, emoji: SPECIALTY_EMOJI[6] ?? "6" },
                      { value: 8, label: messages.specialtySupport, emoji: SPECIALTY_EMOJI[8] ?? "8" },
                    ].map((entry) => (
                      <Tooltip key={`spec-${String(entry.value)}`} content={entry.label}>
                        <button
                          type="button"
                          className={`${styles.transferSearchSpecialtyButton}${
                            filters.specialty === entry.value
                              ? ` ${styles.transferSearchSpecialtyButtonActive}`
                              : ""
                          }`}
                          onClick={() =>
                            onUpdateFilterField(
                              "specialty",
                              filters.specialty === entry.value ? null : entry.value
                            )
                          }
                          disabled={loading}
                        >
                          <span>{entry.emoji}</span>
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                </div>

                <div className={styles.transferSearchSection}>
                  <div className={styles.infoLabel}>{messages.seniorTransferSearchAgeRangeLabel}</div>
                  <div className={styles.transferSearchRangeGrid}>
                    <span className={styles.infoLabel}>{messages.seniorTransferSearchMinLabel}</span>
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min={TRANSFER_SEARCH_MIN_AGE_YEARS}
                      value={filters.ageMinYears}
                      onChange={(event) =>
                        onUpdateFilterField(
                          "ageMinYears",
                          Number.parseInt(event.target.value, 10) || TRANSFER_SEARCH_MIN_AGE_YEARS
                        )
                      }
                      disabled={loading}
                    />
                    <span className={styles.muted}>{messages.yearsLabel}</span>
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min={0}
                      max={HATTRICK_AGE_DAYS_PER_YEAR - 1}
                      value={filters.ageMinDays}
                      onChange={(event) =>
                        onUpdateFilterField(
                          "ageMinDays",
                          Number.parseInt(event.target.value, 10) || 0
                        )
                      }
                      disabled={loading}
                    />
                    <span className={styles.muted}>{messages.daysLabel}</span>
                    <span className={styles.infoLabel}>{messages.seniorTransferSearchMaxLabel}</span>
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min={TRANSFER_SEARCH_MIN_AGE_YEARS}
                      value={filters.ageMaxYears}
                      onChange={(event) =>
                        onUpdateFilterField(
                          "ageMaxYears",
                          Number.parseInt(event.target.value, 10) || TRANSFER_SEARCH_MIN_AGE_YEARS
                        )
                      }
                      disabled={loading}
                    />
                    <span className={styles.muted}>{messages.yearsLabel}</span>
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min={0}
                      max={HATTRICK_AGE_DAYS_PER_YEAR - 1}
                      value={filters.ageMaxDays}
                      onChange={(event) =>
                        onUpdateFilterField(
                          "ageMaxDays",
                          Number.parseInt(event.target.value, 10) || 0
                        )
                      }
                      disabled={loading}
                    />
                    <span className={styles.muted}>{messages.daysLabel}</span>
                  </div>
                </div>

                <div className={styles.transferSearchSection}>
                  <div className={styles.infoLabel}>{messages.seniorTransferSearchTsiRangeLabel}</div>
                  <div className={styles.transferSearchSimpleRange}>
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min="0"
                      placeholder={messages.seniorTransferSearchMinLabel}
                      value={filters.tsiMin}
                      onChange={(event) => onUpdateFilterField("tsiMin", event.target.value)}
                      disabled={loading}
                    />
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min="0"
                      placeholder={messages.seniorTransferSearchMaxLabel}
                      value={filters.tsiMax}
                      onChange={(event) => onUpdateFilterField("tsiMax", event.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className={styles.transferSearchSection}>
                  <div className={styles.infoLabel}>{messages.seniorTransferSearchPriceRangeLabel}</div>
                  <div className={styles.transferSearchSimpleRange}>
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min="0"
                      placeholder={`${messages.seniorTransferSearchMinLabel} (EUR)`}
                      value={filters.priceMinEur}
                      onChange={(event) =>
                        onUpdateFilterField("priceMinEur", event.target.value)
                      }
                      disabled={loading}
                    />
                    <input
                      className={styles.transferSearchInput}
                      type="number"
                      min="0"
                      placeholder={`${messages.seniorTransferSearchMaxLabel} (EUR)`}
                      value={filters.priceMaxEur}
                      onChange={(event) =>
                        onUpdateFilterField("priceMaxEur", event.target.value)
                      }
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className={styles.transferSearchSidebarActions}>
                  <button
                    type="button"
                    className={styles.confirmSubmit}
                    onClick={() => onSearch(filters)}
                    disabled={loading}
                  >
                    {messages.seniorTransferSearchSearchButton}
                  </button>
                </div>
                </>
              ) : null}
            </aside>

            <div className={styles.transferSearchResultsStack}>
              <section
                className={`${styles.transferSearchModalResults}${
                  resultsViewMode === "table"
                    ? ` ${styles.transferSearchModalResultsTableMode}`
                    : ""
                }`}
                data-transfer-search-mobile-panel="results"
                data-transfer-search-mobile-active={activeMobilePanel === "results" ? "true" : "false"}
              >
                {renderMobilePanelNav("results")}
                <div className={styles.transferSearchResultsHeader}>
                  <div>
                    <h3 className={styles.sectionHeading}>{messages.seniorTransferSearchResultsTitle}</h3>
                    {resultCountLabel ? (
                      <span className={styles.profileUpdated}>{resultCountLabel}</span>
                    ) : null}
                  </div>
                  <div className={styles.transferSearchResultsHeaderControls}>
                    <button
                      type="button"
                      className={styles.transferSearchViewToggle}
                      onClick={() =>
                        onResultsViewModeChange(
                          resultsViewMode === "cards" ? "table" : "cards"
                        )
                      }
                      disabled={loading}
                    >
                      {resultsViewMode === "cards"
                        ? messages.transferSearchShowTableButton
                        : messages.transferSearchShowCardsButton}
                    </button>
                    {resultsViewMode === "cards" ? (
                      <label className={styles.transferSearchResultsSortControl}>
                        <span className={styles.infoLabel}>{messages.sortLabel}</span>
                        <select
                          className={styles.transferSearchSelect}
                          value={sortKey}
                          onChange={handleSortChange}
                          disabled={loading}
                        >
                          {sortOptions.map((option, index) => (
                            <option
                              key={`${option.value}-${index}`}
                              value={option.value}
                              disabled={option.value === TRANSFER_SEARCH_SORT_SEPARATOR}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </div>
                {exactEmpty && resultsViewMode !== "table" ? (
                  <p className={styles.transferSearchFallbackNotice}>
                    {fallbackNotice ?? messages.seniorTransferSearchFallbackNotice}
                  </p>
                ) : null}
                {loading ? (
                  <div className={styles.miniMutedCard}>
                    <span className={styles.muted}>{messages.seniorTransferSearchLoading}</span>
                  </div>
                ) : null}
                {error ? <p className={styles.errorText}>{error}</p> : null}
                {!loading && !error && results.length === 0 ? (
                  <p className={styles.muted}>{messages.seniorTransferSearchNoResults}</p>
                ) : null}
                {resultsViewMode === "table" ? (
                  <div className={styles.transferSearchTableShell}>
                    {exactEmpty ? (
                      <p
                        className={`${styles.transferSearchFallbackNotice} ${styles.transferSearchFallbackNoticeTable}`}
                      >
                        {fallbackNotice ?? messages.seniorTransferSearchFallbackNotice}
                      </p>
                    ) : null}
                    <div className={styles.transferSearchTableScroller}>
                      <table className={styles.transferSearchResultsTable}>
                        <thead>
                          <tr>
                            {tableHeaderColumns.map((column) => (
                              <th key={column.key}>
                                <button
                                  type="button"
                                  className={styles.transferSearchTableSortButton}
                                  onClick={() => {
                                    if (tableSortColumn === column.key) {
                                      setTableSortDirection((prev) =>
                                        prev === "best" ? "reverse" : "best"
                                      );
                                      return;
                                    }
                                    setTableSortColumn(column.key);
                                    setTableSortDirection("best");
                                  }}
                                >
                                  <span>
                                    {column.label}
                                    {column.key === "price" ? (
                                      <sup className={styles.transferSearchTableFootnoteMarker}>
                                        †
                                      </sup>
                                    ) : null}
                                  </span>
                                  <span className={styles.matrixSortIcon}>
                                    {tableSortColumn === column.key
                                      ? tableSortDirection === "best"
                                        ? "▼"
                                        : "▲"
                                      : "⇅"}
                                  </span>
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTableRows.map(({ result, data }) => (
                            <tr key={result.playerId}>
                              <td>
                                {(() => {
                                  const countryMeta =
                                    typeof result.nativeCountryId === "number"
                                      ? countryMetaById[result.nativeCountryId]
                                      : undefined;
                                  const nationalityTitle =
                                    countryMeta?.name ??
                                    data.nationalityTitle ??
                                    formatTransferSearchCountryFallback(data.nationality);
                                  const nationalityDisplay =
                                    countryMeta?.flagEmoji ??
                                    data.nationalityFlag ??
                                    nationalityTitle;
                                  return renderTablePill(
                                    <span title={nationalityTitle}>{nationalityDisplay}</span>,
                                    { neutral: true }
                                  );
                                })()}
                              </td>
                              <td>
                                {renderTablePill(
                                  <a
                                    className={styles.profileNameLink}
                                    href={hattrickPlayerUrl(result.playerId)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {data.name}
                                  </a>,
                                  { neutral: true }
                                )}
                              </td>
                              <td>
                                <Tooltip content={data.specialtyTitle ?? data.specialty}>
                                  {renderTablePill(
                                    <>
                                      {data.specialtyEmoji ? `${data.specialtyEmoji} ` : ""}
                                      {data.specialtyEmoji ? "" : data.specialty}
                                    </>,
                                    { neutral: true }
                                  )}
                                </Tooltip>
                              </td>
                              <td>
                                <Tooltip
                                  content={formatTransferSearchInjuryTooltip(
                                    result.injuryLevel,
                                    messages
                                  )}
                                >
                                  {renderTablePill(data.injury, { neutral: true })}
                                </Tooltip>
                              </td>
                              <td>
                                {renderTablePill(
                                  data.ageYears === null
                                    ? "—"
                                    : `${data.ageYears}${messages.ageYearsShort} ${data.ageDays ?? 0}${messages.ageDaysShort}`,
                                  {
                                    numericValue: data.ageTotalDays ?? null,
                                    stats: tableColumnStats.age,
                                    higherBetter: false,
                                  }
                                )}
                              </td>
                              <td>
                                {renderTablePill(
                                  <>
                                    {data.priceKind ? `${data.priceKind} ` : ""}
                                    {data.priceDisplay}
                                  </>,
                                  {
                                    numericValue: data.priceValueEur ?? null,
                                    stats: tableColumnStats.price,
                                    higherBetter: false,
                                  }
                                )}
                              </td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.tsi) ?? "—", { numericValue: data.tsi, stats: tableColumnStats.tsi, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.leadership) ?? "—", { numericValue: data.leadership, stats: tableColumnStats.lead, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.experience) ?? "—", { numericValue: data.experience, stats: tableColumnStats.xp, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.form) ?? "—", { numericValue: data.form, stats: tableColumnStats.form, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.stamina) ?? "—", { numericValue: data.stamina, stats: tableColumnStats.stam, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.keeper) ?? "—", { numericValue: data.keeper, stats: tableColumnStats.kp, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.defending) ?? "—", { numericValue: data.defending, stats: tableColumnStats.def, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.playmaking) ?? "—", { numericValue: data.playmaking, stats: tableColumnStats.pm, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.winger) ?? "—", { numericValue: data.winger, stats: tableColumnStats.wg, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.passing) ?? "—", { numericValue: data.passing, stats: tableColumnStats.ps, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.scoring) ?? "—", { numericValue: data.scoring, stats: tableColumnStats.sc, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.setPieces) ?? "—", { numericValue: data.setPieces, stats: tableColumnStats.sp, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.htmsPotential) ?? "—", { numericValue: data.htmsPotential, stats: tableColumnStats.htms, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.avgPsicoTsi, 2) ?? "—", { numericValue: data.avgPsicoTsi, stats: tableColumnStats.ptsi, higherBetter: true })}</td>
                              <td>{renderTablePill(formatTransferSearchTableMetric(data.avgPsicoWage, 2) ?? "—", { numericValue: data.avgPsicoWage, stats: tableColumnStats.pwage, higherBetter: true })}</td>
                              <td>
                                {renderTablePill(
                                  `${data.wageDisplay}${data.wageIncludesForeignBonus ? "*" : ""}`,
                                  {
                                    numericValue: data.wageValueEur ?? null,
                                    stats: tableColumnStats.wage,
                                    higherBetter: false,
                                  }
                                )}
                              </td>
                              <td>{renderTablePill(formatTransferSearchDeadlineRemaining(data.deadline, messages), { neutral: true })}</td>
                              <td>
                                <Tooltip
                                  content={messages.seniorTransferSearchSupporterOnlyTooltip}
                                  disabled={Boolean(canQuickBid)}
                                >
                                  <button
                                    type="button"
                                    className={`${styles.confirmSubmit} ${styles.transferSearchTableBidButton}`}
                                    onClick={() => onQuickBid?.(result)}
                                    disabled={
                                      !canQuickBid ||
                                      !onQuickBid ||
                                      quickBidPendingPlayerId === result.playerId ||
                                      data.minBidEur === null
                                    }
                                  >
                                    {data.minBidEur === null
                                      ? messages.unknownShort
                                      : `${messages.transferSearchTableBidAction} ${data.minBidEur.toLocaleString()}`}
                                  </button>
                                </Tooltip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={styles.transferSearchTableFooter}>
                      <span>
                        <span className={styles.transferSearchTableFootnoteMarker}>†</span>{" "}
                        {messages.transferSearchTablePriceFootnote}
                      </span>
                      <span>{messages.transferSearchTableWageFootnote}</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.transferSearchResultsList}>
                    {sortedResults.map((result) => {
                      const countryMeta =
                        typeof result.nativeCountryId === "number"
                          ? countryMetaById[result.nativeCountryId]
                          : undefined;
                      return renderResultCard(
                        result,
                        countryMeta
                          ? {
                              name: countryMeta.name,
                              display: countryMeta.flagEmoji ?? countryMeta.name,
                            }
                          : null
                      );
                    })}
                  </div>
                )}
              </section>
              {resultsViewMode === "cards" ? marketSummaryCard : null}
            </div>
          </div>
        </div>
      }
      actions={
        <button type="button" className={styles.confirmSubmit} onClick={onClose}>
          {messages.seniorTransferSearchCloseButton}
        </button>
      }
      closeOnBackdrop
      onClose={onClose}
    />
  );
});

export default TransferSearchModal;
