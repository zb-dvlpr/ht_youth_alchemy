"use client";

import {
  memo,
  startTransition,
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import { Messages } from "@/lib/i18n";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
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
  renderResultCard: (result: TransferSearchResult) => ReactNode;
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
  renderResultCard,
  onClose,
}: TransferSearchModalProps) {
  const [mobilePanel, setMobilePanel] = useState<TransferSearchMobilePanel>("results");
  const marketSummary = useMemo(
    () => buildTransferSearchMarketSummary(results),
    [results]
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
      data-transfer-search-mobile-active={mobilePanel === "summary" ? "true" : "false"}
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

  return (
    <Modal
      open={open}
      title={messages.seniorTransferSearchModalTitle}
      className={styles.transferSearchModal}
      movable
      body={
        <div className={styles.transferSearchModalShell}>
          <div className={styles.transferSearchModalContent}>
            <aside
              className={styles.transferSearchModalSidebar}
              data-transfer-search-mobile-panel="criteria"
              data-transfer-search-mobile-active={mobilePanel === "criteria" ? "true" : "false"}
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
                className={styles.transferSearchModalResults}
                data-transfer-search-mobile-panel="results"
                data-transfer-search-mobile-active={mobilePanel === "results" ? "true" : "false"}
              >
                {renderMobilePanelNav("results")}
                <div className={styles.transferSearchResultsHeader}>
                  <h3 className={styles.sectionHeading}>{messages.seniorTransferSearchResultsTitle}</h3>
                  {resultCountLabel ? (
                    <span className={styles.profileUpdated}>{resultCountLabel}</span>
                  ) : null}
                </div>
                {exactEmpty ? (
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
                <div className={styles.transferSearchResultsList}>
                  {results.map((result) => renderResultCard(result))}
                </div>
              </section>
              {marketSummaryCard}
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
