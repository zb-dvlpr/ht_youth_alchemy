"use client";

import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatDateTime } from "@/lib/datetime";
import { parseChppDate } from "@/lib/chpp/utils";
import { hattrickPlayerUrl, hattrickTeamUrl } from "@/lib/hattrick/urls";
import {
  formatSekCurrency,
  getDisplayCurrencyLabel,
  type DisplayCurrency,
} from "@/lib/currency";
import { predictSeniorEncounteredPlayerWage } from "@/lib/seniorEncounteredPlayerModel";
import type { Messages } from "@/lib/i18n";
import type { SeniorPlayerMetricInput } from "@/lib/seniorPlayerMetrics";
import OriginFlag from "./OriginFlag";
import PlayerStatementQuote from "./PlayerStatementQuote";
import SeniorFoxtrickSimulator from "./SeniorFoxtrickSimulator";
import Tooltip from "./Tooltip";
import {
  formatTransferSearchCurrencyLabel,
  formatTransferSearchPlayerName,
  type TransferSearchBidDraft,
  type TransferSearchResolvedCountryMeta,
  type TransferSearchResult,
} from "./TransferSearchModal";
import { useNotifications } from "./notifications/NotificationsProvider";
import styles from "../page.module.css";

export type TransferSearchResultCardDetails = {
  PlayerID?: number;
  FirstName?: string;
  NickName?: string;
  LastName?: string;
  Age?: number;
  AgeDays?: number;
  ArrivalDate?: string;
  NativeCountryName?: string;
  NativeLeagueID?: number;
  Specialty?: number;
  Form?: number;
  StaminaSkill?: number;
  InjuryLevel?: number;
  Cards?: number;
  TSI?: number;
  Salary?: number;
  IsAbroad?: boolean;
  OwningTeam?: {
    LeagueID?: number;
  };
  PersonalityStatement?: string;
  Statement?: string;
  Agreeability?: number;
  Aggressiveness?: number;
  Honesty?: number;
  Experience?: number;
  Leadership?: number;
  Loyalty?: number;
  MotherClubBonus?: boolean;
  CareerGoals?: number;
  CareerHattricks?: number;
  LeagueGoals?: number;
  CupGoals?: number;
  FriendliesGoals?: number;
  Caps?: number;
  CapsU20?: number;
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
  TransferListed?: boolean;
  TransferDetails?: {
    AskingPrice?: number;
    Deadline?: string;
    HighestBid?: number;
    BidderTeam?: {
      TeamID?: number;
      TeamName?: string;
    };
  };
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

type TransferSearchResultCardProps = {
  result: TransferSearchResult;
  countryMeta: TransferSearchResolvedCountryMeta | null;
  resultDetails?: TransferSearchResultCardDetails | null;
  messages: Messages;
  displayCurrency: DisplayCurrency;
  selectedSeniorLeagueId?: number | null;
  bidDraft: TransferSearchBidDraft;
  pending: boolean;
  canBid: boolean;
  canPlaceBid: boolean;
  onBidDraftChange: (
    playerId: number,
    key: keyof TransferSearchBidDraft,
    value: string
  ) => void;
  onSubmitBid: (
    result: TransferSearchResult,
    bidKind: keyof TransferSearchBidDraft
  ) => void;
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
    const parsed = Number(record["#text"]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return null;
};

export const normalizeTransferSearchResultCardDetails = (
  input: unknown,
  fallbackPlayerId?: number
): TransferSearchResultCardDetails | null => {
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
  const owningTeam =
    node.OwningTeam && typeof node.OwningTeam === "object"
      ? (node.OwningTeam as Record<string, unknown>)
      : null;
  const lastMatch =
    node.LastMatch && typeof node.LastMatch === "object"
      ? (node.LastMatch as Record<string, unknown>)
      : null;
  const transferDetails =
    node.TransferDetails && typeof node.TransferDetails === "object"
      ? (node.TransferDetails as Record<string, unknown>)
      : null;
  const bidderTeam =
    transferDetails?.BidderTeam && typeof transferDetails.BidderTeam === "object"
      ? (transferDetails.BidderTeam as Record<string, unknown>)
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
    NativeLeagueID: parseNumber(node.NativeLeagueID) ?? undefined,
    Specialty: parseNumber(node.Specialty) ?? undefined,
    Form: parseSkill(node.PlayerForm ?? node.Form) ?? undefined,
    StaminaSkill:
      parseSkill(node.StaminaSkill) ??
      parseNumber(node.StaminaSkill) ??
      staminaFromSkills ??
      undefined,
    InjuryLevel: parseNumber(node.InjuryLevel) ?? undefined,
    Cards: parseNumber(node.Cards) ?? undefined,
    TSI: parseNumber(node.TSI) ?? undefined,
    Salary: parseNumber(node.Salary) ?? undefined,
    IsAbroad: parseBoolean(node.IsAbroad) ?? undefined,
    OwningTeam: owningTeam
      ? {
          LeagueID: parseNumber(owningTeam.LeagueID) ?? undefined,
        }
      : undefined,
    Statement:
      typeof node.Statement === "string" && node.Statement.trim()
        ? node.Statement
        : undefined,
    Agreeability:
      parseNumber(trainerData?.Agreeability ?? node.Agreeability) ?? undefined,
    Aggressiveness:
      parseNumber(trainerData?.Aggressiveness ?? node.Aggressiveness) ?? undefined,
    Honesty: parseNumber(trainerData?.Honesty ?? node.Honesty) ?? undefined,
    Experience: parseNumber(trainerData?.Experience ?? node.Experience) ?? undefined,
    Leadership: parseNumber(trainerData?.Leadership ?? node.Leadership) ?? undefined,
    Loyalty: parseNumber(trainerData?.Loyalty ?? node.Loyalty) ?? undefined,
    MotherClubBonus:
      parseBoolean(trainerData?.MotherClubBonus ?? node.MotherClubBonus) ?? undefined,
    CareerGoals: parseNumber(node.CareerGoals) ?? undefined,
    CareerHattricks: parseNumber(node.CareerHattricks) ?? undefined,
    LeagueGoals: parseNumber(node.LeagueGoals) ?? undefined,
    CupGoals: parseNumber(node.CupGoals) ?? undefined,
    FriendliesGoals: parseNumber(node.FriendliesGoals) ?? undefined,
    Caps: parseNumber(node.Caps) ?? undefined,
    CapsU20: parseNumber(node.CapsU20) ?? undefined,
    GoalsCurrentTeam: parseNumber(node.GoalsCurrentTeam) ?? undefined,
    AssistsCurrentTeam: parseNumber(node.AssistsCurrentTeam) ?? undefined,
    CareerAssists: parseNumber(node.CareerAssists) ?? undefined,
    MatchesCurrentTeam: parseNumber(node.MatchesCurrentTeam) ?? undefined,
    PlayerSkills:
      node.PlayerSkills && typeof node.PlayerSkills === "object"
        ? (node.PlayerSkills as Record<string, SkillValue>)
        : undefined,
    LastMatch: lastMatch
      ? {
          Date: typeof lastMatch.Date === "string" ? String(lastMatch.Date) : undefined,
          PositionCode: parseNumber(lastMatch.PositionCode) ?? undefined,
          Rating: parseNumber(lastMatch.Rating) ?? undefined,
        }
      : undefined,
    TransferListed: parseBoolean(node.TransferListed) ?? undefined,
    TransferDetails: transferDetails
      ? {
          AskingPrice: parseNumber(transferDetails.AskingPrice) ?? undefined,
          Deadline:
            typeof transferDetails.Deadline === "string"
              ? String(transferDetails.Deadline)
              : undefined,
          HighestBid: parseNumber(transferDetails.HighestBid) ?? undefined,
          BidderTeam: bidderTeam
            ? {
                TeamID: parseNumber(bidderTeam.TeamID) ?? undefined,
                TeamName:
                  typeof bidderTeam.TeamName === "string"
                    ? String(bidderTeam.TeamName)
                    : undefined,
              }
            : undefined,
        }
      : undefined,
  };
};

const neutralizeSeniorPersonalityFallback = (value: string | undefined | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/\b[Pp]opular guy\b/g, (match) =>
      match[0] === "P" ? "Popular person" : "popular person"
    )
    .replace(/\b[Ss]ympathetic guy\b/g, (match) =>
      match[0] === "S" ? "Sympathetic person" : "sympathetic person"
    )
    .replace(/\b[Pp]leasant guy\b/g, (match) =>
      match[0] === "P" ? "Pleasant person" : "pleasant person"
    );
};

const seniorBarGradient = (
  value: number | null,
  minSkillLevel: number,
  maxSkillLevel: number
) => {
  if (value === null || value === undefined) return undefined;
  if (maxSkillLevel <= minSkillLevel) return undefined;
  const t = Math.min(
    1,
    Math.max((value - minSkillLevel) / (maxSkillLevel - minSkillLevel), 0)
  );
  if (t >= 1) return "linear-gradient(90deg, #2f9f5b, #1f6f3f)";
  if (t <= 0) return "linear-gradient(90deg, #cf3f3a, #8b241f)";
  const startHue = 6 + (136 - 6) * t;
  const startSat = 72 - 8 * t;
  const startLight = 49 - 9 * t;
  const endHue = 2 + (145 - 2) * t;
  const endSat = 66 - 10 * t;
  const endLight = 33 - 5 * t;
  const startColor = `hsl(${Math.round(startHue)} ${Math.round(startSat)}% ${Math.round(startLight)}%)`;
  const endColor = `hsl(${Math.round(endHue)} ${Math.round(endSat)}% ${Math.round(endLight)}%)`;
  return `linear-gradient(90deg, ${startColor}, ${endColor})`;
};

const formatPredictionDiffPercent = (
  actualSek: number | null,
  predictedSek: number | null
) => {
  if (
    typeof actualSek !== "number" ||
    !Number.isFinite(actualSek) ||
    actualSek <= 0 ||
    typeof predictedSek !== "number" ||
    !Number.isFinite(predictedSek)
  ) {
    return null;
  }
  const diffPercent = ((predictedSek - actualSek) / actualSek) * 100;
  const rounded = Math.round((diffPercent + Number.EPSILON) * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}%`;
};

export const resolveTransferSearchSalaryForSelectedTeam = (
  salarySek: number | null | undefined,
  currentForeign: boolean | null | undefined,
  foreignForSelectedTeam: boolean | null | undefined
) => {
  if (typeof salarySek !== "number" || !Number.isFinite(salarySek) || salarySek <= 0) {
    return null;
  }
  const baseSalary =
    currentForeign === true ? Math.round(salarySek / 1.2) : Math.round(salarySek);
  return foreignForSelectedTeam === true
    ? Math.round(baseSalary * 1.2)
    : baseSalary;
};

export const isForeignForSelectedLeague = (
  nativeLeagueId: number | null | undefined,
  selectedLeagueId: number | null | undefined
) => {
  if (
    typeof nativeLeagueId !== "number" ||
    !Number.isFinite(nativeLeagueId) ||
    nativeLeagueId <= 0 ||
    typeof selectedLeagueId !== "number" ||
    !Number.isFinite(selectedLeagueId) ||
    selectedLeagueId <= 0
  ) {
    return null;
  }
  return nativeLeagueId !== selectedLeagueId;
};

export const resolveSeniorIsAbroad = (
  details: TransferSearchResultCardDetails | null | undefined
) => {
  if (!details) return undefined;
  if (typeof details.IsAbroad === "boolean") return details.IsAbroad;
  if (
    typeof details.NativeLeagueID === "number" &&
    typeof details.OwningTeam?.LeagueID === "number"
  ) {
    return details.NativeLeagueID !== details.OwningTeam.LeagueID;
  }
  return undefined;
};

const resolveSpecialtyName = (messages: Messages, value?: number | null) => {
  switch (value) {
    case 0:
      return messages.specialtyNone;
    case 1:
      return messages.specialtyTechnical;
    case 2:
      return messages.specialtyQuick;
    case 3:
      return messages.specialtyPowerful;
    case 4:
      return messages.specialtyUnpredictable;
    case 5:
      return messages.specialtyHeadSpecialist;
    case 6:
      return messages.specialtyResilient;
    case 8:
      return messages.specialtySupport;
    default:
      return null;
  }
};

export default function TransferSearchResultCard({
  result,
  countryMeta,
  resultDetails = null,
  messages,
  displayCurrency,
  selectedSeniorLeagueId = null,
  bidDraft,
  pending,
  canBid,
  canPlaceBid,
  onBidDraftChange,
  onSubmitBid,
}: TransferSearchResultCardProps) {
  const { addNotification } = useNotifications();
  const playerName = formatTransferSearchPlayerName(result);
  const displayPriceSek =
    typeof result.highestBidSek === "number" && result.highestBidSek > 0
      ? result.highestBidSek
      : result.askingPriceSek;
  const displayPriceLabel =
    typeof result.highestBidSek === "number" && result.highestBidSek > 0
      ? messages.seniorTransferSearchHighestBidLabel
      : messages.clubChronicleTransferListedAskingPriceColumn;
  const currencyName = getDisplayCurrencyLabel(displayCurrency);
  const displayPriceCurrencyLabel = `${displayPriceLabel} (${currencyName})`;
  const formatDisplayCurrencyFromSek = (valueSek: number) =>
    formatSekCurrency(valueSek, displayCurrency);
  const bidAmountCurrencyLabel = formatTransferSearchCurrencyLabel(
    messages.seniorTransferSearchBidAmountLabel,
    displayCurrency
  );
  const maxBidAmountCurrencyLabel = formatTransferSearchCurrencyLabel(
    messages.seniorTransferSearchMaxBidAmountLabel,
    displayCurrency
  );
  const deadlineDate = parseChppDate(result.deadline ?? undefined);
  const seniorSkillLevelLabels = messages.seniorSkillLevelLabels
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const formatSeniorSkillLevel = (value: number | undefined) => {
    if (typeof value !== "number" || value <= 0) return messages.unknownLabel;
    const index = Math.min(20, Math.max(1, Math.floor(value))) - 1;
    return seniorSkillLevelLabels[index] ?? messages.unknownLabel;
  };
  const seniorAgreeabilityLabels = messages.seniorAgreeabilityLabels
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const seniorAggressivenessLabels = messages.seniorAggressivenessLabels
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const seniorHonestyLabels = messages.seniorHonestyLabels
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const seniorPersonalitySentence =
    !resultDetails
      ? null
      : (() => {
          const agreeability =
            typeof resultDetails.Agreeability === "number" ? resultDetails.Agreeability : null;
          const aggressiveness =
            typeof resultDetails.Aggressiveness === "number"
              ? resultDetails.Aggressiveness
              : null;
          const honesty =
            typeof resultDetails.Honesty === "number" ? resultDetails.Honesty : null;
          if (
            agreeability === null ||
            aggressiveness === null ||
            honesty === null ||
            !seniorAgreeabilityLabels[agreeability] ||
            !seniorAggressivenessLabels[aggressiveness] ||
            !seniorHonestyLabels[honesty]
          ) {
            return neutralizeSeniorPersonalityFallback(resultDetails.PersonalityStatement);
          }
          return messages.seniorPersonalitySentence
            .replace("{{agreeabilityLabel}}", seniorAgreeabilityLabels[agreeability])
            .replace("{{agreeabilityValue}}", String(agreeability))
            .replace("{{aggressivenessLabel}}", seniorAggressivenessLabels[aggressiveness])
            .replace("{{aggressivenessValue}}", String(aggressiveness))
            .replace("{{honestyLabel}}", seniorHonestyLabels[honesty])
            .replace("{{honestyValue}}", String(honesty));
        })();
  const seniorTraitsSentence =
    !resultDetails
      ? null
      : (() => {
          const parts: string[] = [];
          if (
            typeof resultDetails.Experience === "number" &&
            typeof resultDetails.Leadership === "number"
          ) {
            parts.push(
              messages.seniorTraitsSentenceExperienceLeadership
                .replace(
                  "{{experienceLevel}}",
                  formatSeniorSkillLevel(resultDetails.Experience)
                )
                .replace("{{experienceValue}}", String(resultDetails.Experience))
                .replace(
                  "{{leadershipLevel}}",
                  formatSeniorSkillLevel(resultDetails.Leadership)
                )
                .replace("{{leadershipValue}}", String(resultDetails.Leadership))
            );
          }
          if (typeof resultDetails.Loyalty === "number") {
            parts.push(
              messages.seniorTraitsSentenceLoyalty
                .replace("{{loyaltyLevel}}", formatSeniorSkillLevel(resultDetails.Loyalty))
                .replace("{{loyaltyValue}}", String(resultDetails.Loyalty))
            );
          }
          return parts.length ? parts.join(" ") : null;
        })();
  const specialtyValue = resultDetails?.Specialty ?? result.specialty;
  const resultSpecialtyName =
    specialtyValue !== null && specialtyValue !== undefined
      ? resolveSpecialtyName(messages, specialtyValue)
      : null;
  const resolvedForm = resultDetails?.Form ?? result.form;
  const resolvedStamina = resultDetails?.StaminaSkill ?? result.staminaSkill;
  const resolvedSalary =
    typeof resultDetails?.Salary === "number" ? resultDetails.Salary : result.salarySek;
  const resolvedIsAbroad = resolveSeniorIsAbroad(resultDetails) ?? result.isAbroad;
  const foreignForSelectedTeam = isForeignForSelectedLeague(
    resultDetails?.NativeLeagueID,
    selectedSeniorLeagueId
  );
  const adjustedSalary = resolveTransferSearchSalaryForSelectedTeam(
    resolvedSalary,
    resolvedIsAbroad,
    foreignForSelectedTeam
  );
  const seniorMetricInput: SeniorPlayerMetricInput = {
    ageYears:
      typeof resultDetails?.Age === "number" ? resultDetails.Age : result.age,
    ageDays:
      typeof resultDetails?.AgeDays === "number" ? resultDetails.AgeDays : result.ageDays,
    tsi: typeof resultDetails?.TSI === "number" ? resultDetails.TSI : result.tsi,
    salarySek: resolvedSalary,
    isAbroad: resolvedIsAbroad ?? undefined,
    form: resolvedForm,
    stamina: resolvedStamina,
    keeper: parseSkill(resultDetails?.PlayerSkills?.KeeperSkill) ?? result.keeperSkill,
    defending:
      parseSkill(resultDetails?.PlayerSkills?.DefenderSkill) ?? result.defenderSkill,
    playmaking:
      parseSkill(resultDetails?.PlayerSkills?.PlaymakerSkill) ?? result.playmakerSkill,
    winger: parseSkill(resultDetails?.PlayerSkills?.WingerSkill) ?? result.wingerSkill,
    passing: parseSkill(resultDetails?.PlayerSkills?.PassingSkill) ?? result.passingSkill,
    scoring: parseSkill(resultDetails?.PlayerSkills?.ScorerSkill) ?? result.scorerSkill,
    setPieces:
      parseSkill(resultDetails?.PlayerSkills?.SetPiecesSkill) ?? result.setPiecesSkill,
  };
  const predictedBaseWageSek =
    process.env.NODE_ENV !== "production"
      ? predictSeniorEncounteredPlayerWage({
          playerId: result.playerId,
          ageYears: seniorMetricInput.ageYears,
          ageDays: seniorMetricInput.ageDays,
          keeper: seniorMetricInput.keeper,
          defending: seniorMetricInput.defending,
          playmaking: seniorMetricInput.playmaking,
          winger: seniorMetricInput.winger,
          passing: seniorMetricInput.passing,
          scoring: seniorMetricInput.scoring,
          setPieces: seniorMetricInput.setPieces,
          form: seniorMetricInput.form ?? null,
          stamina: seniorMetricInput.stamina ?? null,
          tsi: seniorMetricInput.tsi ?? null,
          salarySek: seniorMetricInput.salarySek ?? null,
          isAbroad: seniorMetricInput.isAbroad,
          injuryLevel:
            typeof resultDetails?.InjuryLevel === "number"
              ? resultDetails.InjuryLevel
              : null,
        })
      : null;
  const adjustedPredictedSalary =
    predictedBaseWageSek !== null
      ? resolveTransferSearchSalaryForSelectedTeam(
          predictedBaseWageSek,
          false,
          foreignForSelectedTeam
        )
      : null;
  const predictedSalaryDiffPercent = formatPredictionDiffPercent(
    adjustedSalary,
    adjustedPredictedSalary
  );

  return (
    <article key={result.playerId} className={styles.transferSearchResultCard}>
      <div className={styles.transferSearchResultHeader}>
        <div>
          <h4 className={styles.profileName}>
            <a
              className={styles.profileNameLink}
              href={hattrickPlayerUrl(result.playerId)}
              target="_blank"
              rel="noreferrer"
              aria-label={messages.playerLinkLabel}
            >
              {playerName}
            </a>
            {countryMeta ? (
              <OriginFlag
                display={countryMeta.flagDisplay}
                className={styles.transferSearchCardNationality}
              />
            ) : null}
          </h4>
          <PlayerStatementQuote statement={resultDetails?.Statement} />
          {seniorPersonalitySentence ? (
            <p className={styles.seniorPersonaLine}>{seniorPersonalitySentence}</p>
          ) : null}
          {seniorTraitsSentence ? (
            <p className={styles.seniorPersonaLine}>{seniorTraitsSentence}</p>
          ) : null}
          <p className={styles.profileMeta}>
            {result.age !== null ? (
              <span className={styles.metaItem}>
                {result.age} {messages.yearsLabel} {result.ageDays ?? 0} {messages.daysLabel}
              </span>
            ) : null}
            {result.tsi !== null ? (
              <span className={styles.metaItem}>
                {messages.sortTsi}: {result.tsi}
              </span>
            ) : null}
            {adjustedSalary !== null ? (
              <span className={styles.metaItem}>
                {messages.seniorWageLabel}:{" "}
                {`${formatDisplayCurrencyFromSek(adjustedSalary)}${
                  foreignForSelectedTeam === true ? "*" : ""
                }`}
              </span>
            ) : null}
          </p>
          {adjustedPredictedSalary !== null ? (
            <p className={styles.infoValueTiny}>
              {messages.seniorMlPredictedWageLabel}:{" "}
              {`${formatDisplayCurrencyFromSek(adjustedPredictedSalary)}${
                foreignForSelectedTeam === true ? "*" : ""
              }`}
              {predictedSalaryDiffPercent
                ? ` (${messages.seniorMlPredictionDiffLabel} ${predictedSalaryDiffPercent})`
                : ""}
            </p>
          ) : null}
          {adjustedSalary !== null && foreignForSelectedTeam === true ? (
            <p className={styles.seniorPersonaLine}>
              {messages.transferSearchTableWageFootnote}
            </p>
          ) : null}
        </div>
        <div className={styles.transferSearchPriceBlock}>
          <div className={styles.infoLabel}>{displayPriceCurrencyLabel}</div>
          <div className={`${styles.infoValue} ${styles.transferSearchPriceValue}`}>
            {displayPriceSek !== null
              ? formatDisplayCurrencyFromSek(displayPriceSek)
              : messages.unknownShort}
          </div>
        </div>
      </div>

      <div className={styles.profileInfoRow}>
        <div>
          <div className={styles.infoLabel}>{messages.playerIdLabel}</div>
          <div className={styles.infoValue}>
            {result.playerId}
            <Tooltip content={messages.copyPlayerIdLabel}>
              <button
                type="button"
                className={`${styles.infoLinkIcon} ${styles.copyPlayerIdButton}`}
                onClick={() => {
                  void copyTextToClipboard(String(result.playerId)).then((copied) => {
                    if (copied) addNotification(messages.notificationPlayerIdCopied);
                  });
                }}
                aria-label={messages.copyPlayerIdLabel}
              >
                ⧉
              </button>
            </Tooltip>
          </div>
        </div>
        {resultSpecialtyName ? (
          <div>
            <div className={styles.infoLabel}>{messages.specialtyLabel}</div>
            <div className={styles.infoValue}>
              {specialtyValue !== null &&
              specialtyValue !== undefined &&
              SPECIALTY_EMOJI[specialtyValue] ? (
                <span className={styles.playerSpecialty}>
                  {SPECIALTY_EMOJI[specialtyValue]}
                </span>
              ) : null}{" "}
              {resultSpecialtyName}
            </div>
          </div>
        ) : null}
        <div>
          <div className={styles.infoLabel}>{messages.seniorTransferSearchDeadlineLabel}</div>
          <div className={styles.infoValue}>
            {deadlineDate ? formatDateTime(deadlineDate) : messages.unknownShort}
          </div>
        </div>
        {result.sellerTeamName ? (
          <div>
            <div className={styles.infoLabel}>{messages.seniorTransferSearchSellerLabel}</div>
            <div className={styles.infoValue}>
              {result.sellerTeamId ? (
                <a
                  className={styles.chroniclePressLink}
                  href={hattrickTeamUrl(result.sellerTeamId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.sellerTeamName}
                </a>
              ) : (
                result.sellerTeamName
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.sectionDivider} />

      <SeniorFoxtrickSimulator
        key={`${result.playerId}-${Boolean(resultDetails)}`}
        input={seniorMetricInput}
        messages={messages}
        displayCurrency={displayCurrency}
        barGradient={seniorBarGradient}
      />

      <div className={styles.transferSearchBidGrid}>
        <div className={styles.transferSearchBidField}>
          <label className={styles.infoLabel} htmlFor={`bid-${result.playerId}`}>
            {bidAmountCurrencyLabel}
          </label>
          <input
            id={`bid-${result.playerId}`}
            className={styles.transferSearchInput}
            type="number"
            min="0"
            step="1"
            value={bidDraft.bidDisplay}
            onChange={(event) =>
              onBidDraftChange(result.playerId, "bidDisplay", event.target.value)
            }
            disabled={!canBid || pending}
          />
        </div>
        <Tooltip
          content={
            !canPlaceBid
              ? messages.chppMissingPlaceBidTooltip
              : messages.seniorTransferSearchSupporterOnlyTooltip
          }
          disabled={canBid}
        >
          <button
            type="button"
            className={`${styles.confirmSubmit} ${styles.transferSearchBidAction}`}
            onClick={() => onSubmitBid(result, "bidDisplay")}
            disabled={!canBid || pending}
          >
            {messages.seniorTransferSearchPlaceBidButton}
          </button>
        </Tooltip>
        <div className={styles.transferSearchBidField}>
          <label className={styles.infoLabel} htmlFor={`max-bid-${result.playerId}`}>
            {maxBidAmountCurrencyLabel}
          </label>
          <input
            id={`max-bid-${result.playerId}`}
            className={styles.transferSearchInput}
            type="number"
            min="0"
            step="1"
            value={bidDraft.maxBidDisplay}
            onChange={(event) =>
              onBidDraftChange(result.playerId, "maxBidDisplay", event.target.value)
            }
            disabled={!canBid || pending}
          />
        </div>
        <Tooltip
          content={
            !canPlaceBid
              ? messages.chppMissingPlaceBidTooltip
              : messages.seniorTransferSearchSupporterOnlyTooltip
          }
          disabled={canBid}
        >
          <button
            type="button"
            className={`${styles.confirmSubmit} ${styles.transferSearchBidAction}`}
            onClick={() => onSubmitBid(result, "maxBidDisplay")}
            disabled={!canBid || pending}
          >
            {messages.seniorTransferSearchPlaceMaxBidButton}
          </button>
        </Tooltip>
      </div>
    </article>
  );
}
