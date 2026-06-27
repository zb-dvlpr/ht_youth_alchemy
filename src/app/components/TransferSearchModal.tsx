"use client";

import {
  calculateHtmsMetrics,
  calculatePsicoTsiMetrics,
  type SeniorPlayerMetricInput,
} from "@/lib/seniorPlayerMetrics";
import {
  memo,
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { Messages } from "@/lib/i18n";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { hattrickPlayerUrl } from "@/lib/hattrick/urls";
import { parseChppDate } from "@/lib/chpp/utils";
import { fetchChppJson } from "@/lib/chpp/client";
import { formatTimeRemaining } from "@/lib/datetime";
import {
  displayAmountToSek,
  formatSekCurrency,
  getDisplayCurrencyLabel,
  sekToDisplayAmount,
  type DisplayCurrency,
} from "@/lib/currency";
import Modal from "./Modal";
import Tooltip from "./Tooltip";
import OriginFlag from "./OriginFlag";
import styles from "../page.module.css";
import {
  resolveLeagueOriginFlagDisplay,
  type OriginFlagDisplay,
} from "@/lib/originFlag";

export const HATTRICK_AGE_DAYS_PER_YEAR = 112;
export const TRANSFER_SEARCH_MIN_AGE_YEARS = 17;
export const TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS =
  TRANSFER_SEARCH_MIN_AGE_YEARS * HATTRICK_AGE_DAYS_PER_YEAR;
export const TRANSFER_SEARCH_PAGE_SIZE = 100;

export const TRANSFER_SEARCH_SKILLS = [
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

export type TransferSearchSkillKey = (typeof TRANSFER_SEARCH_SKILLS)[number]["key"];

export type TransferSearchSkillFilter = {
  skillKey: TransferSearchSkillKey | null;
  min: number;
  max: number;
};

export type TransferSearchFilters = {
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

export type TransferSearchCountryOption = {
  id: number;
  name: string;
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
  bidDisplay: string;
  maxBidDisplay: string;
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
  originFlagDisplay?: OriginFlagDisplay | null;
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
  priceValueSek?: number | null;
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
  wageValueSek?: number | null;
  wageIncludesForeignBonus?: boolean;
  deadline: string | null;
  deadlineTimestamp?: number | null;
  minBidSek: number | null;
};

type TransferSearchSkillRowProps = {
  filter: TransferSearchSkillFilter;
  index: number;
  selectedOtherSkillKeys: TransferSearchSkillKey[];
  disabled: boolean;
  messages: Messages;
  onUpdateFilter: (
    index: number,
    patch: Partial<TransferSearchSkillFilter>
  ) => void;
};

export type TransferSearchHtmsPotentialFilter = {
  min: string;
  max: string;
};

export type TransferSearchContentMode = "modal" | "workspace";

export type TransferSearchModalProps = {
  open: boolean;
  mode?: TransferSearchContentMode;
  messages: Messages;
  selectedPlayerName: string | null;
  selectedPlayerDetailPills?: string[];
  selectedPlayerDetailPillsInline?: boolean;
  filters: TransferSearchFilters | null;
  displayCurrency: DisplayCurrency;
  countryOptions?: TransferSearchCountryOption[];
  skillSlotCount?: number;
  loading: boolean;
  onUpdateSkillFilter: (
    index: number,
    patch: Partial<TransferSearchSkillFilter>
  ) => void;
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
  getNativeLeagueId?: (result: TransferSearchResult) => number | null | undefined;
  canQuickBid?: boolean;
  quickBidUnavailableTooltip?: ReactNode;
  quickBidPendingPlayerId?: number | null;
  onQuickBid?: (result: TransferSearchResult) => void;
  htmsPotentialFilter?: TransferSearchHtmsPotentialFilter;
  onHtmsPotentialFilterChange?: (next: TransferSearchHtmsPotentialFilter) => void;
  onSaveAsProfile?: (filters: TransferSearchFilters) => void;
  saveAsProfileLabel?: string;
  renderResultCard: (
    result: TransferSearchResult,
    countryMeta: TransferSearchResolvedCountryMeta | null
  ) => ReactNode;
  onClose: () => void;
};

type TransferSearchDraftFields = Pick<
  TransferSearchFilters,
  | "ageMinYears"
  | "ageMinDays"
  | "ageMaxYears"
  | "ageMaxDays"
  | "tsiMin"
  | "tsiMax"
  | "priceMinDisplay"
  | "priceMaxDisplay"
>;

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
  flagDisplay?: OriginFlagDisplay;
};

export type TransferSearchResolvedCountryMeta = {
  name: string;
  flagDisplay?: OriginFlagDisplay;
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

const parseTransferSearchHtmsPotentialFilterValue = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const hasActiveTransferSearchHtmsPotentialFilter = (
  filter: TransferSearchHtmsPotentialFilter
) =>
  parseTransferSearchHtmsPotentialFilterValue(filter.min) !== null ||
  parseTransferSearchHtmsPotentialFilterValue(filter.max) !== null;

const filterTransferSearchResultsByHtmsPotential = (
  results: TransferSearchResult[],
  filter: TransferSearchHtmsPotentialFilter,
  resolveHtmsPotential: (result: TransferSearchResult) => number | null
) => {
  const min = parseTransferSearchHtmsPotentialFilterValue(filter.min);
  const max = parseTransferSearchHtmsPotentialFilterValue(filter.max);
  if (min === null && max === null) return results;
  return results.filter((result) => {
    const potential = resolveHtmsPotential(result);
    if (potential === null || !Number.isFinite(potential)) return false;
    if (min !== null && potential < min) return false;
    if (max !== null && potential > max) return false;
    return true;
  });
};

const formatTransferSearchTableMetric = (value: number | null, fractionDigits = 0) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return fractionDigits > 0 ? value.toFixed(fractionDigits) : String(Math.round(value));
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

const isTransferSearchDigitsInput = (
  value: string,
  options?: { maxValue?: number }
) => {
  if (!/^\d*$/.test(value)) return false;
  if (value === "") return true;
  if (typeof options?.maxValue !== "number") return true;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed <= options.maxValue;
};

export const formatTransferSearchCurrencyLabel = (
  label: string,
  displayCurrency: DisplayCurrency
) => {
  const currencyName = getDisplayCurrencyLabel(displayCurrency);
  return label
    .replace("{{currency}}", currencyName)
    .replace(/\((?:the\s+)?display currency\)/gi, `(${currencyName})`);
};

const parseTransferSearchDraftInteger = (value: string): number | null => {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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

const isTransferSearchRangeDraftValid = (
  minValue: string,
  maxValue: string
) => {
  if (minValue !== "" && !/^\d+$/.test(minValue)) return false;
  if (maxValue !== "" && !/^\d+$/.test(maxValue)) return false;
  if (minValue === "" || maxValue === "") return true;
  return Number.parseInt(minValue, 10) <= Number.parseInt(maxValue, 10);
};

const isTransferSearchAgeDraftValid = (
  filters: TransferSearchFilters,
  patch: Partial<
    Pick<
      TransferSearchFilters,
      "ageMinYears" | "ageMinDays" | "ageMaxYears" | "ageMaxDays"
    >
  >
) => {
  const next = { ...filters, ...patch };
  const ageFields = [
    next.ageMinYears,
    next.ageMinDays,
    next.ageMaxYears,
    next.ageMaxDays,
  ];
  if (!ageFields.every((value) => /^\d*$/.test(value))) return false;
  const minDays = parseTransferSearchDraftInteger(next.ageMinDays);
  const maxDays = parseTransferSearchDraftInteger(next.ageMaxDays);
  if (
    (minDays !== null && minDays >= HATTRICK_AGE_DAYS_PER_YEAR) ||
    (maxDays !== null && maxDays >= HATTRICK_AGE_DAYS_PER_YEAR)
  ) {
    return false;
  }

  const minYears = parseTransferSearchDraftInteger(next.ageMinYears);
  const maxYears = parseTransferSearchDraftInteger(next.ageMaxYears);
  const resolvedMinYears =
    minYears ?? TRANSFER_SEARCH_MIN_AGE_YEARS;
  const resolvedMinDays = minDays ?? 0;
  const resolvedMaxYears =
    maxYears ?? TRANSFER_SEARCH_MIN_AGE_YEARS;
  const resolvedMaxDays = maxDays ?? 0;
  const minTotalDays = ageToTotalDays(resolvedMinYears, resolvedMinDays);
  const maxTotalDays = ageToTotalDays(resolvedMaxYears, resolvedMaxDays);
  if (
    minTotalDays < TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS ||
    maxTotalDays < TRANSFER_SEARCH_MIN_AGE_TOTAL_DAYS
  ) {
    return false;
  }
  return minTotalDays <= maxTotalDays;
};

const buildTransferSearchDraftFields = (
  filters: TransferSearchFilters
): TransferSearchDraftFields => ({
  ageMinYears: filters.ageMinYears,
  ageMinDays: filters.ageMinDays,
  ageMaxYears: filters.ageMaxYears,
  ageMaxDays: filters.ageMaxDays,
  tsiMin: filters.tsiMin,
  tsiMax: filters.tsiMax,
  priceMinDisplay: filters.priceMinDisplay,
  priceMaxDisplay: filters.priceMaxDisplay,
});

const resolveValidatedTransferSearchDraftFilters = (
  filters: TransferSearchFilters,
  drafts: TransferSearchDraftFields
): TransferSearchFilters | null => {
  const nextFilters = { ...filters, ...drafts };
  const ageValues = [
    nextFilters.ageMinYears,
    nextFilters.ageMinDays,
    nextFilters.ageMaxYears,
    nextFilters.ageMaxDays,
  ];
  if (!ageValues.every((value) => /^\d+$/.test(value))) return null;
  if (
    !isTransferSearchAgeDraftValid(filters, {
      ageMinYears: nextFilters.ageMinYears,
      ageMinDays: nextFilters.ageMinDays,
      ageMaxYears: nextFilters.ageMaxYears,
      ageMaxDays: nextFilters.ageMaxDays,
    })
  ) {
    return null;
  }
  if (
    !isTransferSearchRangeDraftValid(nextFilters.tsiMin, nextFilters.tsiMax) ||
    !isTransferSearchRangeDraftValid(
      nextFilters.priceMinDisplay,
      nextFilters.priceMaxDisplay
    )
  ) {
    return null;
  }
  return nextFilters;
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

const isActiveTransferSearchSkillFilter = (
  filter: TransferSearchSkillFilter
): filter is TransferSearchSkillFilter & { skillKey: TransferSearchSkillKey } =>
  Boolean(filter.skillKey);

export const normalizeTransferSearchFilters = (
  filters: TransferSearchFilters
): TransferSearchFilters => {
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
      if (!isActiveTransferSearchSkillFilter(filter)) {
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

export const buildTransferSearchParams = (
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
    .filter(isActiveTransferSearchSkillFilter)
    .forEach((filter, index) => {
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
    if (priceMinSek !== null) params.set("priceMin", String(priceMinSek));
  }
  if (priceMaxDisplay !== null) {
    const priceMaxSek = displayAmountToSek(priceMaxDisplay, displayCurrency);
    if (priceMaxSek !== null) params.set("priceMax", String(priceMaxSek));
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

export const displayToSek = (
  value: string,
  displayCurrency: DisplayCurrency
) => displayAmountToSek(value, displayCurrency);

export const buildTransferSearchMinimumBidSek = (result: TransferSearchResult) => {
  if (typeof result.highestBidSek === "number" && result.highestBidSek > 0) {
    return result.highestBidSek + 1000;
  }
  if (typeof result.askingPriceSek === "number" && result.askingPriceSek > 0) {
    return result.askingPriceSek;
  }
  return "";
};

export const formatTransferSearchBidDraftDisplay = (
  valueSek: number | string,
  displayCurrency: DisplayCurrency
) => {
  if (valueSek === "") return "";
  const displayAmount =
    typeof valueSek === "number" ? sekToDisplayAmount(valueSek, displayCurrency) : null;
  return displayAmount === null ? "" : String(Math.ceil(displayAmount));
};

const TRANSFER_SEARCH_MAX_SKILL_LEVEL_COUNT = 4;
const TRANSFER_SEARCH_MAX_SKILL_DELTA =
  TRANSFER_SEARCH_MAX_SKILL_LEVEL_COUNT - 1;
const TRANSFER_SEARCH_MAX_AGE_RANGE_DAYS =
  HATTRICK_AGE_DAYS_PER_YEAR * 2 - 1;
const TRANSFER_SEARCH_MARKET_MIN_RICH_STATS_COUNT = 3;

const formatTransferSearchMarketDisplay = (
  valueSek: number,
  displayCurrency: DisplayCurrency
) =>
  formatSekCurrency(valueSek, displayCurrency, {
    compact: valueSek >= 100000,
  });

const resolveTransferSearchMarketPriceSek = (result: TransferSearchResult) => {
  const priceSek =
    typeof result.highestBidSek === "number" && result.highestBidSek > 0
      ? result.highestBidSek
      : typeof result.askingPriceSek === "number" && result.askingPriceSek >= 0
        ? result.askingPriceSek
        : null;
  return priceSek;
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
    .map(resolveTransferSearchMarketPriceSek)
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

type TransferSearchValidationIssue =
  | { type: "skillRange"; skillLabel: string; min: number; max: number }
  | { type: "ageRange" };

const validateTransferSearchCriteria = (
  filters: TransferSearchFilters,
  messages: Messages
): TransferSearchValidationIssue | null => {
  for (const filter of filters.skillFilters) {
    if (!isActiveTransferSearchSkillFilter(filter)) continue;
    const definition = TRANSFER_SEARCH_SKILLS.find(
      (entry) => entry.key === filter.skillKey
    );
    const skillLabel = definition
      ? String(messages[definition.labelKey as keyof Messages])
      : filter.skillKey;
    if (filter.max < filter.min || filter.max - filter.min > TRANSFER_SEARCH_MAX_SKILL_DELTA) {
      return {
        type: "skillRange",
        skillLabel,
        min: filter.min,
        max: filter.max,
      };
    }
  }

  const minYears = parseTransferSearchDraftInteger(filters.ageMinYears);
  const minDays = parseTransferSearchDraftInteger(filters.ageMinDays);
  const maxYears = parseTransferSearchDraftInteger(filters.ageMaxYears);
  const maxDays = parseTransferSearchDraftInteger(filters.ageMaxDays);
  if (
    minYears === null ||
    minDays === null ||
    maxYears === null ||
    maxDays === null
  ) {
    return null;
  }
  const minAgeTotal = ageToTotalDays(minYears, minDays);
  const maxAgeTotal = ageToTotalDays(maxYears, maxDays);
  if (maxAgeTotal - minAgeTotal > TRANSFER_SEARCH_MAX_AGE_RANGE_DAYS) {
    return { type: "ageRange" };
  }

  return null;
};

const resolveTransferSearchSkillRange = (
  skillKey: TransferSearchSkillKey,
  currentMin: number,
  currentMax: number,
  edge: "min" | "max",
  nextValue: number
) => {
  const clamped = clampTransferSkillValue(skillKey, nextValue);
  if (edge === "min") {
    return {
      min: clamped,
      max: currentMax,
    };
  }

  return {
    min: currentMin,
    max: clamped,
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
  const filterIsInactive = filter.skillKey === null;
  const draftBaseKey = `${filter.skillKey ?? "none"}:${filter.min}:${filter.max}`;
  const [draftState, setDraftState] = useState({
    baseKey: draftBaseKey,
    min: String(filter.min),
    max: String(filter.max),
  });
  const draftMin =
    draftState.baseKey === draftBaseKey ? draftState.min : String(filter.min);
  const draftMax =
    draftState.baseKey === draftBaseKey ? draftState.max : String(filter.max);
  const setDraftMin = useCallback(
    (min: string) =>
      setDraftState((prev) => ({
        baseKey: draftBaseKey,
        min,
        max: prev.baseKey === draftBaseKey ? prev.max : String(filter.max),
      })),
    [draftBaseKey, filter.max]
  );
  const setDraftMax = useCallback(
    (max: string) =>
      setDraftState((prev) => ({
        baseKey: draftBaseKey,
        min: prev.baseKey === draftBaseKey ? prev.min : String(filter.min),
        max,
      })),
    [draftBaseKey, filter.min]
  );
  const availableOptions = TRANSFER_SEARCH_SKILLS.filter(
    (entry) =>
      entry.key === filter.skillKey || !selectedOtherSkillKeys.includes(entry.key)
  );
  const skillDefinition =
    (filter.skillKey
      ? TRANSFER_SEARCH_SKILLS.find((entry) => entry.key === filter.skillKey)
      : null) ?? TRANSFER_SEARCH_SKILLS[0];
  const commitRange = useCallback(
    (edge: "min" | "max", nextValue: number) => {
      if (!filter.skillKey) return;
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
    [
      filter.max,
      filter.min,
      filter.skillKey,
      index,
      onUpdateFilter,
      setDraftMax,
      setDraftMin,
    ]
  );
  const handleMinInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      if (!/^\d*$/.test(nextValue)) return;
      setDraftMin(nextValue);
      if (nextValue === "") return;
      const parsed = Number(nextValue);
      if (!Number.isFinite(parsed)) return;
      commitRange("min", parsed);
    },
    [commitRange, setDraftMin]
  );
  const handleMaxInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      if (!/^\d*$/.test(nextValue)) return;
      setDraftMax(nextValue);
      if (nextValue === "") return;
      const parsed = Number(nextValue);
      if (!Number.isFinite(parsed)) return;
      commitRange("max", parsed);
    },
    [commitRange, setDraftMax]
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
            disabled={
              disabled ||
              filterIsInactive ||
              filter.min <= skillDefinition.min
            }
            aria-label={`${messages.seniorTransferSearchMinLabel} -`}
          >
            -
          </button>
          <input
            className={styles.transferSearchSkillNumberInput}
            type={filterIsInactive ? "text" : "number"}
            min={skillDefinition.min}
            max={skillDefinition.max}
            step={1}
            value={filterIsInactive ? "-" : draftMin}
            onChange={handleMinInputChange}
            onBlur={() => {
              if (!filter.skillKey) return;
              const parsed = Number(draftMin);
              if (!Number.isFinite(parsed)) {
                setDraftMin(String(filter.min));
                return;
              }
              commitRange("min", parsed);
            }}
            disabled={disabled || filterIsInactive}
            aria-label={messages.seniorTransferSearchMinLabel}
          />
          <button
            type="button"
            className={styles.transferSearchSkillStepperButton}
            onClick={() => commitRange("min", filter.min + 1)}
            disabled={
              disabled ||
              filterIsInactive ||
              filter.min >= skillDefinition.max
            }
            aria-label={`${messages.seniorTransferSearchMinLabel} +`}
          >
            +
          </button>
        </div>
      </div>
      <select
        className={styles.transferSearchSelect}
        value={filter.skillKey ?? ""}
        onChange={(event) => {
          const nextSkillKey = event.target.value
            ? (event.target.value as TransferSearchSkillKey)
            : null;
          if (!nextSkillKey) {
            startTransition(() => {
              onUpdateFilter(index, { skillKey: null });
            });
            return;
          }
          const next = {
            skillKey: nextSkillKey,
            min: clampTransferSkillValue(nextSkillKey, filter.skillKey ? filter.min : 0),
            max: clampTransferSkillValue(nextSkillKey, filter.skillKey ? filter.max : 0),
          };
          setDraftMin(String(next.min));
          setDraftMax(String(next.max));
          startTransition(() => {
            onUpdateFilter(index, next);
          });
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
        <div className={styles.transferSearchValueStepper}>
          <button
            type="button"
            className={styles.transferSearchSkillStepperButton}
            onClick={() => commitRange("max", filter.max - 1)}
            disabled={disabled || filterIsInactive || filter.max <= skillDefinition.min}
            aria-label={`${messages.seniorTransferSearchMaxLabel} -`}
          >
            -
          </button>
          <input
            className={styles.transferSearchSkillNumberInput}
            type={filterIsInactive ? "text" : "number"}
            min={skillDefinition.min}
            max={skillDefinition.max}
            step={1}
            value={filterIsInactive ? "-" : draftMax}
            onChange={handleMaxInputChange}
            onBlur={() => {
              if (!filter.skillKey) return;
              const parsed = Number(draftMax);
              if (!Number.isFinite(parsed)) {
                setDraftMax(String(filter.max));
                return;
              }
              commitRange("max", parsed);
            }}
            disabled={disabled || filterIsInactive}
            aria-label={messages.seniorTransferSearchMaxLabel}
          />
          <button
            type="button"
            className={styles.transferSearchSkillStepperButton}
            onClick={() => commitRange("max", filter.max + 1)}
            disabled={
              disabled ||
              filterIsInactive ||
              filter.max >= skillDefinition.max
            }
            aria-label={`${messages.seniorTransferSearchMaxLabel} +`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
});

const TransferSearchModal = memo(function TransferSearchModal({
  open,
  mode = "modal",
  messages,
  selectedPlayerName,
  selectedPlayerDetailPills,
  selectedPlayerDetailPillsInline,
  filters,
  displayCurrency,
  countryOptions = [],
  skillSlotCount,
  loading,
  onUpdateSkillFilter,
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
  getNativeLeagueId,
  canQuickBid,
  quickBidUnavailableTooltip,
  quickBidPendingPlayerId,
  onQuickBid,
  htmsPotentialFilter: controlledHtmsPotentialFilter,
  onHtmsPotentialFilterChange,
  onSaveAsProfile,
  saveAsProfileLabel,
  renderResultCard,
  onClose,
}: TransferSearchModalProps) {
  const filtersDraftKey = filters
    ? JSON.stringify(buildTransferSearchDraftFields(filters))
    : "null";
  const [mobilePanel, setMobilePanel] = useState<TransferSearchMobilePanel>("results");
  const [tableSortColumn, setTableSortColumn] = useState<string>("htms");
  const [tableSortDirection, setTableSortDirection] =
    useState<TransferSearchTableSortDirection>("best");
  const [draftState, setDraftState] = useState<{
    baseKey: string;
    fields: TransferSearchDraftFields | null;
  }>({
    baseKey: filtersDraftKey,
    fields: filters ? buildTransferSearchDraftFields(filters) : null,
  });
  const [internalHtmsPotentialFilter, setInternalHtmsPotentialFilter] =
    useState<TransferSearchHtmsPotentialFilter>({ min: "", max: "" });
  const [validationIssue, setValidationIssue] =
    useState<TransferSearchValidationIssue | null>(null);
  const htmsPotentialFilter =
    controlledHtmsPotentialFilter ?? internalHtmsPotentialFilter;
  const setHtmsPotentialFilter = useCallback(
    (updater: (prev: TransferSearchHtmsPotentialFilter) => TransferSearchHtmsPotentialFilter) => {
      const next = updater(htmsPotentialFilter);
      if (onHtmsPotentialFilterChange) {
        onHtmsPotentialFilterChange(next);
        return;
      }
      setInternalHtmsPotentialFilter(next);
    },
    [htmsPotentialFilter, onHtmsPotentialFilterChange]
  );
  const draftFields =
    draftState.baseKey === filtersDraftKey
      ? draftState.fields
      : filters
        ? buildTransferSearchDraftFields(filters)
        : null;
  const [countryMetaById, setCountryMetaById] = useState<Record<number, TransferSearchCountryMeta>>(
    {}
  );
  const [leagueFlagDisplayById, setLeagueFlagDisplayById] = useState<
    Record<number, OriginFlagDisplay>
  >({});
  const worlddetailsRequestedRef = useRef(false);
  const worlddetailsLoadedRef = useRef(false);
  const hasTransferSearchResults = results.length > 0;
  const resolveResultHtmsPotential = useCallback(
    (result: TransferSearchResult) =>
      getTransferSearchSortValue(
        getSortMetricInput
          ? getSortMetricInput(result)
          : buildTransferSearchMetricInput(result),
        "htmsPotential"
      ),
    [getSortMetricInput]
  );
  const displayedResults = useMemo(
    () =>
      filterTransferSearchResultsByHtmsPotential(
        results,
        htmsPotentialFilter,
        resolveResultHtmsPotential
      ),
    [htmsPotentialFilter, resolveResultHtmsPotential, results]
  );
  const htmsPotentialFilterActive =
    hasActiveTransferSearchHtmsPotentialFilter(htmsPotentialFilter);
  const displayedResultCountLabel =
    htmsPotentialFilterActive && resultCountLabel
      ? messages.seniorTransferSearchResultsCount.replace(
          "{{count}}",
          String(displayedResults.length)
        )
      : resultCountLabel;
  const marketSummary = useMemo(
    () => buildTransferSearchMarketSummary(displayedResults),
    [displayedResults]
  );

  const updateDraftField = useCallback(
    <K extends keyof TransferSearchDraftFields>(key: K, value: TransferSearchDraftFields[K]) => {
      setDraftState((prev) => {
        const baseFields =
          prev.baseKey === filtersDraftKey
            ? prev.fields
            : filters
              ? buildTransferSearchDraftFields(filters)
              : null;
        return baseFields
          ? {
              baseKey: filtersDraftKey,
              fields: {
                ...baseFields,
                [key]: value,
              },
            }
          : prev;
      });
    },
    [filters, filtersDraftKey]
  );

  const commitDraftFields = useCallback(() => {
    if (!filters || !draftFields) return null;
    const validated = resolveValidatedTransferSearchDraftFilters(filters, draftFields);
    if (!validated) {
      setDraftState({
        baseKey: filtersDraftKey,
        fields: buildTransferSearchDraftFields(filters),
      });
      return null;
    }
    (Object.keys(draftFields) as Array<keyof TransferSearchDraftFields>).forEach((key) => {
      if (validated[key] !== filters[key]) {
        onUpdateFilterField(key, validated[key]);
      }
    });
    setDraftState({
      baseKey: JSON.stringify(buildTransferSearchDraftFields(validated)),
      fields: buildTransferSearchDraftFields(validated),
    });
    return validated;
  }, [draftFields, filters, filtersDraftKey, onUpdateFilterField]);
  const commitAndValidateCriteria = useCallback(() => {
    const committedFilters = commitDraftFields();
    if (!committedFilters) return null;
    const issue = validateTransferSearchCriteria(committedFilters, messages);
    if (issue) {
      setValidationIssue(issue);
      return null;
    }
    return committedFilters;
  }, [commitDraftFields, messages]);
  useEffect(() => {
    if (
      !hasTransferSearchResults ||
      worlddetailsRequestedRef.current ||
      worlddetailsLoadedRef.current
    ) {
      return;
    }

    let cancelled = false;
    worlddetailsRequestedRef.current = true;
    void (async () => {
      try {
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              LeagueList?: {
                League?: Record<string, unknown> | Array<Record<string, unknown>>;
              };
            };
          };
          error?: string;
        }>("/api/chpp/worlddetails", { cache: "no-store" });
        if (!response.ok || payload?.error || cancelled) return;
        const rawLeague = payload?.data?.HattrickData?.LeagueList?.League;
        const leagues = Array.isArray(rawLeague) ? rawLeague : rawLeague ? [rawLeague] : [];
        const nextCountryMetaById: Record<number, TransferSearchCountryMeta> = {};
        const nextLeagueFlagDisplayById: Record<number, OriginFlagDisplay> = {};
        leagues.forEach((league) => {
          const leagueId = Number(league?.LeagueID);
          const leagueName =
            typeof league?.LeagueName === "string" ? league.LeagueName.trim() : "";
          const country =
            league?.Country && typeof league.Country === "object"
              ? (league.Country as Record<string, unknown>)
              : null;
          const countryId = Number(country?.CountryID);
          const countryName =
            typeof country?.CountryName === "string" ? country.CountryName.trim() : "";
          const countryCode =
            typeof country?.CountryCode === "string" ? country.CountryCode : undefined;
          if (!Number.isFinite(leagueId) || leagueId <= 0 || !leagueName) return;
          const flagDisplay = resolveLeagueOriginFlagDisplay(
            leagueId,
            leagueName,
            countryCode
          );
          if (flagDisplay) nextLeagueFlagDisplayById[leagueId] = flagDisplay;
          if (
            Number.isFinite(countryId) &&
            countryId > 0 &&
            countryName &&
            !nextCountryMetaById[countryId]
          ) {
            nextCountryMetaById[countryId] = { name: countryName, flagDisplay };
          }
        });
        if (cancelled) return;
        setCountryMetaById(nextCountryMetaById);
        setLeagueFlagDisplayById(nextLeagueFlagDisplayById);
        worlddetailsLoadedRef.current = true;
      } catch {
        // Origin indicators remain absent when worlddetails is unavailable.
      }
    })();

    return () => {
      cancelled = true;
      if (!worlddetailsLoadedRef.current) {
        worlddetailsRequestedRef.current = false;
      }
    };
  }, [hasTransferSearchResults]);
  const activeMobilePanel: TransferSearchMobilePanel =
    resultsViewMode === "table" ? "results" : mobilePanel;
  const currencyName = getDisplayCurrencyLabel(displayCurrency);
  const priceRangeLabel = formatTransferSearchCurrencyLabel(
    messages.seniorTransferSearchPriceRangeLabel,
    displayCurrency
  );
  const tablePriceLabel = `${messages.transferSearchTablePriceColumn} (${currencyName})`;
  const tableWageLabel = `${messages.transferSearchTableWageColumn} (${currencyName})`;
  const tableBidLabel = `${messages.transferSearchTableBidColumn} (${currencyName})`;
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
    if (sortKey === "default") return displayedResults;
    return [...displayedResults].sort((left, right) => {
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
  }, [displayedResults, getSortMetricInput, sortKey]);
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
        const fallbackMinimumBid = buildTransferSearchMinimumBidSek(result);
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
              originFlagDisplay: null,
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
                  : typeof result.askingPriceSek === "number" && result.askingPriceSek >= 0
                    ? "AP"
                    : null,
              priceDisplay:
                typeof fallbackPriceSek === "number" && fallbackPriceSek >= 0
                  ? formatSekCurrency(fallbackPriceSek, displayCurrency)
                  : "—",
              priceValueSek:
                typeof fallbackPriceSek === "number" && fallbackPriceSek >= 0
                  ? fallbackPriceSek
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
                  ? formatSekCurrency(result.salarySek, displayCurrency)
                  : messages.unknownShort,
              wageValueSek:
                typeof result.salarySek === "number" ? result.salarySek : null,
              wageIncludesForeignBonus: Boolean(result.isAbroad),
              deadline: result.deadline,
              deadlineTimestamp: fallbackDeadline?.getTime() ?? null,
              minBidSek: typeof fallbackMinimumBid === "number" ? fallbackMinimumBid : null,
            },
        };
      }),
    [displayCurrency, getSortMetricInput, getTableRowData, messages, sortedResults]
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
        <div className={styles.loadingRow}>
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.muted}>{messages.seniorTransferSearchLoading}</span>
        </div>
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
                {formatTransferSearchMarketDisplay(marketSummary.min, displayCurrency)}
                {" - "}
                {formatTransferSearchMarketDisplay(marketSummary.max, displayCurrency)}
              </strong>
            </div>
            {marketSummaryRich ? (
              <>
                <div className={styles.transferSearchMarketStat}>
                  <span className={styles.infoLabel}>
                    {messages.transferSearchMarketMedianLabel}
                  </span>
                  <strong>
                    {formatTransferSearchMarketDisplay(marketSummary.median, displayCurrency)}
                  </strong>
                </div>
                <div className={styles.transferSearchMarketStat}>
                  <span className={styles.infoLabel}>
                    {messages.transferSearchMarketMeanLabel}
                  </span>
                  <strong>{formatTransferSearchMarketDisplay(marketSummary.mean, displayCurrency)}</strong>
                </div>
                <div className={styles.transferSearchMarketStat}>
                  <span className={styles.infoLabel}>
                    {messages.transferSearchMarketMiddleLabel}
                  </span>
                  <strong>
                    {formatTransferSearchMarketDisplay(marketSummary.q1, displayCurrency)}
                    {" - "}
                    {formatTransferSearchMarketDisplay(marketSummary.q3, displayCurrency)}
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
                    {formatTransferSearchMarketDisplay(bucket.min, displayCurrency)}
                    {" - "}
                    {formatTransferSearchMarketDisplay(bucket.max, displayCurrency)}
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
    { key: "price", label: tablePriceLabel, higherBetter: false },
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
    { key: "wage", label: tableWageLabel, higherBetter: false },
    { key: "deadline", label: messages.transferSearchTableDeadlineColumn, higherBetter: null },
    { key: "bid", label: tableBidLabel, higherBetter: false },
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
      price: collect((row) => row.priceValueSek),
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
      wage: collect((row) => row.wageValueSek),
      bid: collect((row) => row.minBidSek),
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
          return (left.priceValueSek ?? Number.POSITIVE_INFINITY) - (right.priceValueSek ?? Number.POSITIVE_INFINITY);
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
          return (left.wageValueSek ?? Number.POSITIVE_INFINITY) - (right.wageValueSek ?? Number.POSITIVE_INFINITY);
        case "deadline":
          return (left.deadlineTimestamp ?? Number.POSITIVE_INFINITY) - (right.deadlineTimestamp ?? Number.POSITIVE_INFINITY);
        case "bid":
          return (left.minBidSek ?? Number.POSITIVE_INFINITY) - (right.minBidSek ?? Number.POSITIVE_INFINITY);
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

  const body = (
        <div
          className={
            mode === "workspace"
              ? styles.transferSearchWorkspaceShell
              : styles.transferSearchModalShell
          }
        >
          <div
            className={`${mode === "workspace" ? styles.transferSearchWorkspaceContent : styles.transferSearchModalContent}${
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
                    {Array.from({ length: renderedSkillSlotCount }).map((_, index) => {
                      const filter = filters.skillFilters[index] ?? {
                        skillKey: null,
                        min: 0,
                        max: 0,
                      };
                      const selectedOtherSkillKeys = filters.skillFilters
                        .filter((_, filterIndex) => filterIndex !== index)
                        .filter(isActiveTransferSearchSkillFilter)
                        .map((entry) => entry.skillKey)
                        .sort();
                      return (
                        <TransferSearchSkillRow
                          key={`${filter.skillKey ?? "none"}-${index}`}
                          filter={filter}
                          index={index}
                          selectedOtherSkillKeys={selectedOtherSkillKeys}
                          disabled={loading}
                          messages={messages}
                          onUpdateFilter={onUpdateSkillFilter}
                        />
                      );
                    })}
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
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={draftFields?.ageMinYears ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        updateDraftField("ageMinYears", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
                      disabled={loading}
                    />
                    <span className={styles.muted}>{messages.yearsLabel}</span>
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={draftFields?.ageMinDays ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (
                          !isTransferSearchDigitsInput(nextValue, {
                            maxValue: HATTRICK_AGE_DAYS_PER_YEAR - 1,
                          })
                        ) {
                          return;
                        }
                        updateDraftField("ageMinDays", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
                      disabled={loading}
                    />
                    <span className={styles.muted}>{messages.daysLabel}</span>
                    <span className={styles.infoLabel}>{messages.seniorTransferSearchMaxLabel}</span>
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={draftFields?.ageMaxYears ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        updateDraftField("ageMaxYears", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
                      disabled={loading}
                    />
                    <span className={styles.muted}>{messages.yearsLabel}</span>
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={draftFields?.ageMaxDays ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (
                          !isTransferSearchDigitsInput(nextValue, {
                            maxValue: HATTRICK_AGE_DAYS_PER_YEAR - 1,
                          })
                        ) {
                          return;
                        }
                        updateDraftField("ageMaxDays", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
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
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={messages.seniorTransferSearchMinLabel}
                      value={draftFields?.tsiMin ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        updateDraftField("tsiMin", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
                      disabled={loading}
                    />
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={messages.seniorTransferSearchMaxLabel}
                      value={draftFields?.tsiMax ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        updateDraftField("tsiMax", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className={styles.transferSearchSection}>
                  <div className={styles.infoLabel}>{priceRangeLabel}</div>
                  <div className={styles.transferSearchSimpleRange}>
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={`${messages.seniorTransferSearchMinLabel}`}
                      value={draftFields?.priceMinDisplay ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        updateDraftField("priceMinDisplay", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
                      disabled={loading}
                    />
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={`${messages.seniorTransferSearchMaxLabel}`}
                      value={draftFields?.priceMaxDisplay ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        updateDraftField("priceMaxDisplay", nextValue);
                      }}
                      onBlur={() => {
                        void commitDraftFields();
                      }}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className={styles.transferSearchSection}>
                  <div className={styles.infoLabel}>
                    {messages.transferSearchHtmsPotentialRangeLabel}
                  </div>
                  <div className={styles.transferSearchSimpleRange}>
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={messages.transferSearchHtmsPotentialMinLabel}
                      value={htmsPotentialFilter.min}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        setHtmsPotentialFilter((prev) => ({
                          ...prev,
                          min: nextValue,
                        }));
                      }}
                      disabled={loading}
                    />
                    <input
                      className={styles.transferSearchInput}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={messages.transferSearchHtmsPotentialMaxLabel}
                      value={htmsPotentialFilter.max}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (!isTransferSearchDigitsInput(nextValue)) return;
                        setHtmsPotentialFilter((prev) => ({
                          ...prev,
                          max: nextValue,
                        }));
                      }}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className={styles.transferSearchSection}>
                  <label className={styles.infoLabel} htmlFor="transfer-search-native-country">
                    {messages.transferSearchNativeCountryLabel}
                  </label>
                  <select
                    id="transfer-search-native-country"
                    className={styles.transferSearchInput}
                    value={filters?.nativeCountryId === null ? "" : String(filters?.nativeCountryId ?? "")}
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      const nextValue = Number(rawValue);
                      onUpdateFilterField(
                        "nativeCountryId",
                        rawValue === "" || !Number.isFinite(nextValue) || nextValue <= 0
                          ? null
                          : Math.round(nextValue)
                      );
                    }}
                    disabled={loading || countryOptions.length === 0}
                  >
                    <option value="">
                      {messages.seniorTransferSearchAnySpecialtyLabel}
                    </option>
                    {countryOptions.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.transferSearchSidebarActions}>
                  {onSaveAsProfile ? (
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${styles.transferSearchSaveProfileButton}`}
                      onClick={() => {
                        const committedFilters = commitAndValidateCriteria();
                        if (!committedFilters) return;
                        onSaveAsProfile(committedFilters);
                      }}
                      disabled={loading}
                    >
                      {saveAsProfileLabel ?? "Save as profile"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.confirmSubmit}
                    onClick={() => {
                      const committedFilters = commitAndValidateCriteria();
                      if (!committedFilters) return;
                      onSearch(committedFilters);
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className={styles.spinner} aria-hidden="true" />{" "}
                        {messages.seniorTransferSearchLoading}
                      </>
                    ) : (
                      messages.seniorTransferSearchSearchButton
                    )}
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
                    {displayedResultCountLabel ? (
                      <span className={styles.profileUpdated}>{displayedResultCountLabel}</span>
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
                    <div className={styles.loadingRow}>
                      <span className={styles.spinner} aria-hidden="true" />
                      <span className={styles.muted}>{messages.seniorTransferSearchLoading}</span>
                    </div>
                  </div>
                ) : null}
                {error ? <p className={styles.errorText}>{error}</p> : null}
                {!loading && !error && displayedResults.length === 0 ? (
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
                                  const nativeLeagueId = getNativeLeagueId?.(result);
                                  const originFlagDisplay =
                                    (typeof nativeLeagueId === "number"
                                      ? leagueFlagDisplayById[nativeLeagueId]
                                      : undefined) ??
                                    data.originFlagDisplay ??
                                    countryMeta?.flagDisplay;
                                  const nationalityTitle =
                                    originFlagDisplay?.label ??
                                    countryMeta?.name ??
                                    data.nationalityTitle ??
                                    formatTransferSearchCountryFallback(data.nationality);
                                  return renderTablePill(
                                    originFlagDisplay ? (
                                      <OriginFlag display={originFlagDisplay} />
                                    ) : (
                                      <span title={nationalityTitle}>{nationalityTitle}</span>
                                    ),
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
                                    numericValue: data.priceValueSek ?? null,
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
                                    numericValue: data.wageValueSek ?? null,
                                    stats: tableColumnStats.wage,
                                    higherBetter: false,
                                  }
                                )}
                              </td>
                              <td>{renderTablePill(formatTransferSearchDeadlineRemaining(data.deadline, messages), { neutral: true })}</td>
                              <td>
                                <Tooltip
                                  content={
                                    quickBidUnavailableTooltip ??
                                    messages.seniorTransferSearchSupporterOnlyTooltip
                                  }
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
                                      data.minBidSek === null
                                    }
                                  >
                                    {data.minBidSek === null
                                      ? messages.unknownShort
                                      : `${messages.transferSearchTableBidAction} ${formatSekCurrency(
                                          data.minBidSek,
                                          displayCurrency
                                        )}`}
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
                      const nativeLeagueId = getNativeLeagueId?.(result);
                      const flagDisplay =
                        (typeof nativeLeagueId === "number"
                          ? leagueFlagDisplayById[nativeLeagueId]
                          : undefined) ?? countryMeta?.flagDisplay;
                      const renderedCard = renderResultCard(
                        result,
                        countryMeta || flagDisplay
                          ? {
                              name:
                                flagDisplay?.label ??
                                countryMeta?.name ??
                                messages.unknownShort,
                              flagDisplay,
                            }
                          : null
                      );
                      return (
                        <Fragment key={`transfer-search-result-${result.playerId}`}>
                          {renderedCard}
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </section>
              {resultsViewMode === "cards" ? marketSummaryCard : null}
            </div>
          </div>
        </div>
  );

  const validationModal =
    validationIssue === null ? null : (
      <Modal
        open
        title={
          validationIssue.type === "skillRange"
            ? messages.transferSearchInvalidSkillRangeTitle
            : messages.transferSearchInvalidAgeRangeTitle
        }
        body={
          <p className={styles.muted}>
            {validationIssue.type === "skillRange"
              ? messages.transferSearchInvalidSkillRangeBody
                  .replace("{{skill}}", validationIssue.skillLabel)
                  .replace("{{min}}", String(validationIssue.min))
                  .replace("{{max}}", String(validationIssue.max))
              : messages.transferSearchInvalidAgeRangeBody}
          </p>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setValidationIssue(null)}
          >
            {validationIssue.type === "skillRange"
              ? messages.transferSearchInvalidSkillRangeConfirm
              : messages.transferSearchInvalidAgeRangeConfirm}
          </button>
        }
        closeOnBackdrop
        onClose={() => setValidationIssue(null)}
      />
    );

  if (mode === "workspace") {
    return (
      <>
        {body}
        {validationModal}
      </>
    );
  }

  return (
    <>
      <Modal
        open={open}
        title={messages.seniorTransferSearchModalTitle}
        className={`${styles.transferSearchModal}${
          resultsViewMode === "table" ? ` ${styles.transferSearchModalTableMode}` : ""
        }`}
        movable
        body={body}
        actions={
          <button type="button" className={styles.confirmSubmit} onClick={onClose}>
            {messages.seniorTransferSearchCloseButton}
          </button>
        }
        closeOnBackdrop
        onClose={onClose}
      />
      {validationModal}
    </>
  );
});

export default TransferSearchModal;
export { TransferSearchModal as TransferSearchContent };
