import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { formatChppDate, formatDateTime } from "@/lib/datetime";
import Tooltip from "./Tooltip";
import RatingsMatrix, { RatingsMatrixResponse } from "./RatingsMatrix";
import { positionLabelShortByRoleId } from "@/lib/positions";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { getSkillMaxReached } from "@/lib/skills";
import { hattrickPlayerUrl, hattrickYouthPlayerUrl } from "@/lib/hattrick/urls";
import { copyTextToClipboard } from "@/lib/clipboard";
import type { SeniorPlayerMetricInput } from "@/lib/seniorPlayerMetrics";
import { useNotifications } from "./notifications/NotificationsProvider";
import SeniorFoxtrickSimulator from "./SeniorFoxtrickSimulator";
import PlayerStatementQuote from "./PlayerStatementQuote";
import { predictSeniorEncounteredPlayerWage } from "@/lib/seniorEncounteredPlayerModel";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Age?: number;
  AgeDays?: number;
  TSI?: number;
  Specialty?: number;
  InjuryLevel?: number;
  Form?: number;
  StaminaSkill?: number;
  PlayerSkills?: Record<string, SkillValue | number | string>;
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

export type YouthPlayerDetails = {
  YouthPlayerID: number;
  FirstName: string;
  NickName?: string;
  LastName: string;
  Age?: number;
  AgeDays?: number;
  TSI?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  NativeCountryName?: string;
  NativeLeagueID?: number;
  OriginName?: string;
  OriginFlagEmoji?: string;
  Specialty?: number;
  InjuryLevel?: number;
  Form?: number;
  StaminaSkill?: number;
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
  OwningYouthTeam?: {
    YouthTeamName?: string;
    SeniorTeam?: {
      SeniorTeamName?: string;
    };
  };
  PlayerSkills?: Record<string, SkillValue>;
  ScoutCall?: {
    ScoutComments?: {
      ScoutComment?:
        | {
            CommentType?: number | string;
            CommentSkillType?: number | string;
          }
        | Array<{
            CommentType?: number | string;
            CommentSkillType?: number | string;
          }>;
    };
  };
  LastMatch?: {
    Date?: string;
    YouthMatchID?: number;
    PositionCode?: number;
    PlayedMinutes?: number;
    Rating?: number;
  };
};

export type PlayerDetailsPanelTab = "details" | "skillsMatrix" | "ratingsMatrix";

type PlayerDetailsPanelProps = {
  selectedPlayer: YouthPlayer | null;
  detailsData: YouthPlayerDetails | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  unlockStatus: "success" | "denied" | null;
  onRefresh: () => void;
  players: YouthPlayer[];
  playerDetailsById: Map<number, YouthPlayerDetails>;
  skillsMatrixRows: { id: number | null; name: string }[];
  ratingsMatrixResponse: RatingsMatrixResponse | null;
  ratingsMatrixMatchHrefBuilder?: (matchId: number) => string;
  ratingsMatrixSelectedName: string | null;
  ratingsMatrixSpecialtyByName: Record<string, number | undefined>;
  ratingsMatrixHiddenSpecialtyByName?: Record<string, boolean>;
  ratingsMatrixHiddenSpecialtyMatchHrefByName?: Record<string, string | undefined>;
  ratingsMatrixMotherClubBonusByName?: Record<string, boolean>;
  ratingsMatrixCardStatusByName?: Record<
    string,
    { display: string; label: string }
  >;
  cardStatusByPlayerId?: Record<number, { display: string; label: string }>;
  matrixNewPlayerIds?: number[];
  matrixNewRatingsByPlayerId?: Record<number, number[]>;
  matrixNewSkillsCurrentByPlayerId?: Record<number, string[]>;
  matrixNewSkillsMaxByPlayerId?: Record<number, string[]>;
  scoutImportantSkillsByPlayerId?: Record<number, string[]>;
  scoutOverallSkillLevelByPlayerId?: Record<number, number>;
  hiddenSpecialtyByPlayerId?: Record<number, number>;
  hiddenSpecialtyMatchHrefByPlayerId?: Record<number, string>;
  onSelectRatingsPlayer: (playerName: string) => void;
  onMatrixPlayerDragStart?: (
    event: React.DragEvent<HTMLElement>,
    playerId: number,
    playerName: string
  ) => void;
  orderedPlayerIds?: number[] | null;
  orderSource?: "list" | "ratings" | "skills" | null;
  onRatingsOrderChange?: (orderedIds: number[]) => void;
  onSkillsOrderChange?: (orderedIds: number[]) => void;
  onRatingsSortStart?: () => void;
  onSkillsSortStart?: () => void;
  hasPreviousPlayer?: boolean;
  hasNextPlayer?: boolean;
  onPreviousPlayer?: () => void;
  onNextPlayer?: () => void;
  playerKind?: "youth" | "senior";
  skillMode?: "currentMax" | "single";
  maxSkillLevel?: number;
  activeTab?: PlayerDetailsPanelTab;
  onActiveTabChange?: (tab: PlayerDetailsPanelTab) => void;
  showSeniorSkillBonusInMatrix?: boolean;
  onShowSeniorSkillBonusInMatrixChange?: (enabled: boolean) => void;
  showTabs?: boolean;
  detailsHeaderActions?: ReactNode;
  onSeniorSimulationStateChange?: (state: {
    editing: boolean;
    dirty: boolean;
    metricInput: SeniorPlayerMetricInput;
  }) => void;
  skillsMatrixHeaderAux?: ReactNode;
  extraSkillsMatrixHeaderAux?: ReactNode;
  skillsMatrixLeadingHeader?: ReactNode;
  renderSkillsMatrixLeadingCell?: (row: { id: number | null; name: string }) => ReactNode;
  skillsMatrixRowClassName?: (row: { id: number | null; name: string }) => string | null;
  skillsMatrixRowTooltip?: (row: { id: number | null; name: string }) => ReactNode;
  messages: Messages;
};

const SKILL_ROWS = [
  {
    key: "KeeperSkill",
    maxKey: "KeeperSkillMax",
    labelKey: "skillKeeper",
    shortLabelKey: "skillKeeperShort",
  },
  {
    key: "DefenderSkill",
    maxKey: "DefenderSkillMax",
    labelKey: "skillDefending",
    shortLabelKey: "skillDefendingShort",
  },
  {
    key: "PlaymakerSkill",
    maxKey: "PlaymakerSkillMax",
    labelKey: "skillPlaymaking",
    shortLabelKey: "skillPlaymakingShort",
  },
  {
    key: "WingerSkill",
    maxKey: "WingerSkillMax",
    labelKey: "skillWinger",
    shortLabelKey: "skillWingerShort",
  },
  {
    key: "PassingSkill",
    maxKey: "PassingSkillMax",
    labelKey: "skillPassing",
    shortLabelKey: "skillPassingShort",
  },
  {
    key: "ScorerSkill",
    maxKey: "ScorerSkillMax",
    labelKey: "skillScoring",
    shortLabelKey: "skillScoringShort",
  },
  {
    key: "SetPiecesSkill",
    maxKey: "SetPiecesSkillMax",
    labelKey: "skillSetPieces",
    shortLabelKey: "skillSetPiecesShort",
  },
];
const HATTRICK_AGE_DAYS_PER_YEAR = 112;
const CHPP_SEK_PER_EUR = 10;
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

const buildInjuryStatus = (injuryLevelRaw: number | null, messages: Messages) => {
  if (injuryLevelRaw === null) return null;
  const isBruised = injuryLevelRaw === 0 || (injuryLevelRaw > 0 && injuryLevelRaw < 1);
  const injuryWeeks = injuryLevelRaw >= 1 ? Math.ceil(injuryLevelRaw) : null;
  const label = isBruised
    ? messages.seniorListInjuryBruised
    : injuryWeeks !== null
    ? messages.seniorListInjuryWeeks.replace("{weeks}", String(injuryWeeks))
    : messages.clubChronicleInjuryHealthy;
  const display = isBruised
    ? "🩹"
    : injuryWeeks !== null
    ? `✚${toSubscript(injuryWeeks)}`
    : messages.clubChronicleInjuryHealthy;
  return {
    label,
    display,
    isHealthy: !isBruised && injuryWeeks === null,
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
    )
    .replace(/\b[Nn]asty fellow\b/g, (match) =>
      match[0] === "N" ? "Nasty person" : "nasty person"
    );
};

function getSkillLevel(skill?: SkillValue | number | string | null): number | null {
  if (skill === null || skill === undefined) return null;
  if (typeof skill === "number") return skill;
  if (typeof skill === "string") {
    const numeric = Number(skill);
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

function getSkillMax(skill?: SkillValue | number | string | null): number | null {
  if (skill === null || skill === undefined) return null;
  if (typeof skill === "number") return skill;
  if (typeof skill === "string") {
    const numeric = Number(skill);
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

function skillCellColor(
  value: number | null,
  minSkillLevel: number,
  maxSkillLevel: number
) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (maxSkillLevel <= minSkillLevel) {
    return undefined;
  }
  const normalized = Math.min(
    Math.max((value - minSkillLevel) / (maxSkillLevel - minSkillLevel), 0),
    1
  );
  const hue = 120 * normalized;
  const alpha = 0.2 + normalized * 0.35;
  return `hsla(${hue}, 70%, 38%, ${alpha})`;
}

const metricPillStyle = (
  value: number | null,
  minValue: number,
  maxValue: number,
  reverse = false
) => {
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

const formatSeniorWage = (
  valueSek: number | null,
  isAbroad: boolean | undefined,
  messages: Messages
) => {
  if (valueSek === null || valueSek === undefined) return messages.unknownShort;
  const base = formatEurFromSek(valueSek);
  return isAbroad ? `${base} (${messages.seniorWageForeignExtraNote})` : base;
};

const applyForeignWageBonus = (valueSek: number | null, isForeign: boolean | undefined) => {
  if (typeof valueSek !== "number" || !Number.isFinite(valueSek) || valueSek <= 0) {
    return null;
  }
  return isForeign ? Math.round(valueSek * 1.2) : Math.round(valueSek);
};

const formatPredictionDiffPercent = (actualSek: number | null, predictedSek: number | null) => {
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

const resolveSeniorIsAbroad = (details: YouthPlayerDetails | null | undefined) => {
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
  if (t >= 1) {
    return "linear-gradient(90deg, #2f9f5b, #1f6f3f)";
  }
  if (t <= 0) {
    return "linear-gradient(90deg, #cf3f3a, #8b241f)";
  }
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

const SENIOR_SKILL_EFFECT_CAP = 20;

const formatSkillMatrixFloat = (value: number) => {
  if (!Number.isFinite(value)) return "0.0";
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
};

const computeSeniorSkillBonus = (
  baseSkill: number | null,
  details: YouthPlayerDetails | null
) => {
  if (baseSkill === null) return null;
  if (baseSkill >= SENIOR_SKILL_EFFECT_CAP) return 0;
  const remaining = Math.max(0, SENIOR_SKILL_EFFECT_CAP - baseSkill);
  if (details?.MotherClubBonus) {
    return Math.min(1.5, remaining);
  }
  const loyaltyRaw = typeof details?.Loyalty === "number" ? details.Loyalty : 0;
  const loyalty = Math.max(0, loyaltyRaw);
  return Math.min(loyalty / 20, remaining);
};

const computeSeniorEffectiveSkill = (
  baseSkill: number | null,
  details: YouthPlayerDetails | null
) => {
  if (baseSkill === null) return null;
  const bonus = computeSeniorSkillBonus(baseSkill, details);
  if (bonus === null) return null;
  return Math.min(SENIOR_SKILL_EFFECT_CAP, baseSkill + bonus);
};

function daysSince(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function mergedSkills(
  detailsSkills?: Record<string, SkillValue> | null,
  playerSkills?: Record<string, SkillValue | number | string> | null
) {
  if (!detailsSkills && !playerSkills) return null;
  return {
    ...(detailsSkills ?? {}),
    ...(playerSkills ?? {}),
  };
}

const resolvePlayerAge = (
  player: YouthPlayer | null,
  details: YouthPlayerDetails | null
) => {
  const years =
    typeof details?.Age === "number"
      ? details.Age
      : typeof player?.Age === "number"
      ? player.Age
      : null;
  const days =
    typeof details?.AgeDays === "number"
      ? details.AgeDays
      : typeof player?.AgeDays === "number"
      ? player.AgeDays
      : null;
  if (years === null) return null;
  return {
    years,
    days,
    totalDays: years * HATTRICK_AGE_DAYS_PER_YEAR + Math.max(0, days ?? 0),
  };
};

const resolveSeniorAgePillClassName = (
  years: number | null,
  stylesModule: Record<string, string>
) => {
  if (years === null) return null;
  if (years > 35) return stylesModule.playerAgePillDarkRed;
  if (years > 30) return stylesModule.playerAgePillFadedRed;
  if (years >= 20) return stylesModule.playerAgePillYellow;
  return stylesModule.playerAgePillGreen;
};

const buildSeniorMetricInputFromDetails = (details: YouthPlayerDetails) => ({
  ageYears: typeof details.Age === "number" ? details.Age : null,
  ageDays: typeof details.AgeDays === "number" ? details.AgeDays : null,
  tsi: typeof details.TSI === "number" ? details.TSI : null,
  salarySek: typeof details.Salary === "number" ? details.Salary : null,
  isAbroad: resolveSeniorIsAbroad(details),
  form: typeof details.Form === "number" ? details.Form : null,
  stamina: typeof details.StaminaSkill === "number" ? details.StaminaSkill : null,
  keeper: getSkillLevel(details.PlayerSkills?.KeeperSkill),
  defending: getSkillLevel(details.PlayerSkills?.DefenderSkill),
  playmaking: getSkillLevel(details.PlayerSkills?.PlaymakerSkill),
  winger: getSkillLevel(details.PlayerSkills?.WingerSkill),
  passing: getSkillLevel(details.PlayerSkills?.PassingSkill),
  scoring: getSkillLevel(details.PlayerSkills?.ScorerSkill),
  setPieces: getSkillLevel(details.PlayerSkills?.SetPiecesSkill),
});

export default function PlayerDetailsPanel({
  selectedPlayer,
  detailsData,
  loading,
  error,
  lastUpdated,
  unlockStatus,
  onRefresh,
  players,
  playerDetailsById,
  skillsMatrixRows,
  ratingsMatrixResponse,
  ratingsMatrixMatchHrefBuilder,
  ratingsMatrixSelectedName,
  ratingsMatrixSpecialtyByName,
  ratingsMatrixHiddenSpecialtyByName,
  ratingsMatrixHiddenSpecialtyMatchHrefByName,
  ratingsMatrixMotherClubBonusByName,
  ratingsMatrixCardStatusByName = {},
  cardStatusByPlayerId = {},
  matrixNewPlayerIds = [],
  matrixNewRatingsByPlayerId = {},
  matrixNewSkillsCurrentByPlayerId = {},
  matrixNewSkillsMaxByPlayerId = {},
  scoutImportantSkillsByPlayerId = {},
  scoutOverallSkillLevelByPlayerId = {},
  hiddenSpecialtyByPlayerId = {},
  hiddenSpecialtyMatchHrefByPlayerId = {},
  onSelectRatingsPlayer,
  onMatrixPlayerDragStart,
  orderedPlayerIds,
  orderSource,
  onRatingsOrderChange,
  onSkillsOrderChange,
  onRatingsSortStart,
  onSkillsSortStart,
  hasPreviousPlayer = false,
  hasNextPlayer = false,
  onPreviousPlayer,
  onNextPlayer,
  playerKind = "youth",
  skillMode = "currentMax",
  maxSkillLevel = 8,
  activeTab,
  onActiveTabChange,
  showSeniorSkillBonusInMatrix = true,
  onShowSeniorSkillBonusInMatrixChange,
  showTabs = true,
  detailsHeaderActions,
  onSeniorSimulationStateChange,
  skillsMatrixHeaderAux,
  extraSkillsMatrixHeaderAux,
  skillsMatrixLeadingHeader,
  renderSkillsMatrixLeadingCell,
  skillsMatrixRowClassName,
  skillsMatrixRowTooltip,
  messages,
}: PlayerDetailsPanelProps) {
  const { addNotification } = useNotifications();
  const [uncontrolledActiveTab, setUncontrolledActiveTab] =
    useState<PlayerDetailsPanelTab>("details");
  const [skillsSortKey, setSkillsSortKey] = useState<
    (typeof SKILL_ROWS)[number]["key"] | "name" | "age" | "form" | "stamina" | null
  >(null);
  const [skillsSortDir, setSkillsSortDir] = useState<"asc" | "desc">("desc");
  const pendingSkillsSortRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  const onActiveTabChangeRef = useRef(onActiveTabChange);

  const resolvedActiveTab = activeTab ?? uncontrolledActiveTab;

  useEffect(() => {
    activeTabRef.current = activeTab;
    onActiveTabChangeRef.current = onActiveTabChange;
  }, [activeTab, onActiveTabChange]);

  const setResolvedActiveTab = useCallback((nextTab: PlayerDetailsPanelTab) => {
    if (activeTabRef.current === undefined) {
      setUncontrolledActiveTab(nextTab);
    }
    onActiveTabChangeRef.current?.(nextTab);
  }, []);

  const handleMatrixPlayerPick = (playerName: string) => {
    setResolvedActiveTab("details");
    onSelectRatingsPlayer?.(playerName);
  };

  const playerById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    players.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [players]);
  const ratingsMatrixInjuryStatusByName = useMemo(() => {
    const payload: Record<
      string,
      { display: string; label: string; isHealthy: boolean }
    > = {};
    skillsMatrixRows.forEach((row) => {
      if (!row.id) return;
      const details = playerDetailsById.get(row.id);
      const player = playerById.get(row.id);
      const injuryLevel =
        typeof details?.InjuryLevel === "number"
          ? details.InjuryLevel
          : typeof player?.InjuryLevel === "number"
          ? player.InjuryLevel
          : null;
      const status = buildInjuryStatus(injuryLevel, messages);
      if (!status || status.isHealthy) return;
      payload[row.name] = status;
    });
    return payload;
  }, [messages, playerById, playerDetailsById, skillsMatrixRows]);
  const matrixNewPlayerIdSet = useMemo(
    () => new Set(matrixNewPlayerIds),
    [matrixNewPlayerIds]
  );
  const seniorMetricInput = useMemo(
    () =>
      playerKind === "senior" && detailsData
        ? buildSeniorMetricInputFromDetails(detailsData)
        : null,
    [detailsData, playerKind]
  );
  const seniorIsAbroad = useMemo(
    () =>
      playerKind === "senior" && detailsData
        ? resolveSeniorIsAbroad(detailsData)
        : undefined,
    [detailsData, playerKind]
  );
  const seniorPredictedWageDisplay = useMemo(() => {
    if (process.env.NODE_ENV === "production") return null;
    if (playerKind !== "senior" || !detailsData || !seniorMetricInput) return null;
    const actualWageSek =
      typeof detailsData.Salary === "number" ? detailsData.Salary : null;
    const predictedBaseWageSek = predictSeniorEncounteredPlayerWage({
      playerId:
        typeof detailsData.YouthPlayerID === "number" ? detailsData.YouthPlayerID : null,
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
        typeof detailsData.InjuryLevel === "number" ? detailsData.InjuryLevel : null,
    });
    if (predictedBaseWageSek === null) return null;
    const displayedPrediction = applyForeignWageBonus(predictedBaseWageSek, seniorIsAbroad);
    if (displayedPrediction === null) return null;
    return {
      valueSek: displayedPrediction,
      diffPercent: formatPredictionDiffPercent(actualWageSek, displayedPrediction),
    };
  }, [detailsData, playerKind, seniorIsAbroad, seniorMetricInput]);

  const sortedSkillsRows = useMemo(() => {
    if (!skillsSortKey) return skillsMatrixRows;
    const direction = skillsSortDir === "asc" ? 1 : -1;
    if (skillsSortKey === "name") {
      return [...skillsMatrixRows].sort(
        (a, b) => a.name.localeCompare(b.name) * direction
      );
    }
    if (skillsSortKey === "age" || skillsSortKey === "form" || skillsSortKey === "stamina") {
      return [...skillsMatrixRows].sort((a, b) => {
        const detailsA = a.id ? playerDetailsById.get(a.id) : null;
        const detailsB = b.id ? playerDetailsById.get(b.id) : null;
        const playerA = a.id ? playerById.get(a.id) : null;
        const playerB = b.id ? playerById.get(b.id) : null;
        const valueA =
          skillsSortKey === "age"
            ? resolvePlayerAge(playerA ?? null, detailsA ?? null)?.totalDays ?? null
            : skillsSortKey === "form"
            ? (typeof detailsA?.Form === "number"
                ? detailsA.Form
                : typeof playerA?.Form === "number"
                ? playerA.Form
                : null)
            : (typeof detailsA?.StaminaSkill === "number"
                ? detailsA.StaminaSkill
                : typeof playerA?.StaminaSkill === "number"
                ? playerA.StaminaSkill
                : null);
        const valueB =
          skillsSortKey === "age"
            ? resolvePlayerAge(playerB ?? null, detailsB ?? null)?.totalDays ?? null
            : skillsSortKey === "form"
            ? (typeof detailsB?.Form === "number"
                ? detailsB.Form
                : typeof playerB?.Form === "number"
                ? playerB.Form
                : null)
            : (typeof detailsB?.StaminaSkill === "number"
                ? detailsB.StaminaSkill
                : typeof playerB?.StaminaSkill === "number"
                ? playerB.StaminaSkill
                : null);
        if (valueA === null && valueB === null) return 0;
        if (valueA === null) return 1;
        if (valueB === null) return -1;
        return (valueA - valueB) * direction;
      });
    }
    return [...skillsMatrixRows].sort((a, b) => {
      const detailsA = a.id ? playerDetailsById.get(a.id) : null;
      const detailsB = b.id ? playerDetailsById.get(b.id) : null;
      const playerA = a.id ? playerById.get(a.id) : null;
      const playerB = b.id ? playerById.get(b.id) : null;
      const skillsA = mergedSkills(detailsA?.PlayerSkills, playerA?.PlayerSkills);
      const skillsB = mergedSkills(detailsB?.PlayerSkills, playerB?.PlayerSkills);
      const currentA = getSkillLevel(skillsA?.[skillsSortKey]);
      const maxA = getSkillMax(skillsA?.[`${skillsSortKey}Max`]);
      const currentB = getSkillLevel(skillsB?.[skillsSortKey]);
      const maxB = getSkillMax(skillsB?.[`${skillsSortKey}Max`]);
      const effectiveCurrentA =
        playerKind === "senior" &&
        skillMode === "single" &&
        showSeniorSkillBonusInMatrix
          ? computeSeniorEffectiveSkill(currentA, detailsA ?? null)
          : currentA;
      const effectiveCurrentB =
        playerKind === "senior" &&
        skillMode === "single" &&
        showSeniorSkillBonusInMatrix
          ? computeSeniorEffectiveSkill(currentB, detailsB ?? null)
          : currentB;
      const sumA =
        skillMode === "single"
          ? (effectiveCurrentA ?? 0)
          : (currentA ?? 0) + (maxA ?? 0);
      const sumB =
        skillMode === "single"
          ? (effectiveCurrentB ?? 0)
          : (currentB ?? 0) + (maxB ?? 0);
      if (sumA === sumB) return 0;
      return (sumA - sumB) * direction;
    });
  }, [
    playerById,
    playerDetailsById,
    skillsMatrixRows,
    skillMode,
    showSeniorSkillBonusInMatrix,
    skillsSortDir,
    skillsSortKey,
    playerKind,
  ]);

  const orderedSkillsRows = useMemo(() => {
    if (orderedPlayerIds && orderSource && orderSource !== "skills") {
      const map = new Map(skillsMatrixRows.map((row) => [row.id, row]));
      return orderedPlayerIds
        .map((id) => map.get(id))
        .filter((row): row is (typeof skillsMatrixRows)[number] => Boolean(row));
    }
    if (!skillsSortKey) return skillsMatrixRows;
    return sortedSkillsRows;
  }, [orderSource, orderedPlayerIds, skillsMatrixRows, skillsSortKey, sortedSkillsRows]);

  useEffect(() => {
    if (!onSkillsOrderChange) return;
    if (!skillsSortKey) return;
    if (orderSource && orderSource !== "skills") return;
    const nextOrder = sortedSkillsRows
      .map((row) => row.id)
      .filter(Boolean) as number[];
    if (
      orderedPlayerIds &&
      orderedPlayerIds.length === nextOrder.length &&
      orderedPlayerIds.every((id, index) => id === nextOrder[index])
    ) {
      return;
    }
    onSkillsOrderChange(nextOrder);
  }, [
    onSkillsOrderChange,
    skillsSortKey,
    skillsSortDir,
    sortedSkillsRows,
    orderSource,
    orderedPlayerIds,
  ]);

  const handleSkillsSort = (
    key: (typeof SKILL_ROWS)[number]["key"] | "name" | "age" | "form" | "stamina"
  ) => {
    pendingSkillsSortRef.current = true;
    onSkillsSortStart?.();
    if (skillsSortKey === key) {
      setSkillsSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSkillsSortKey(key);
      setSkillsSortDir(key === "age" ? "asc" : "desc");
    }
  };

  useEffect(() => {
    if (orderSource && orderSource !== "skills" && skillsSortKey !== null) {
      if (pendingSkillsSortRef.current) {
        pendingSkillsSortRef.current = false;
        return;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSkillsSortKey(null);
    }
    if (orderSource === "skills") {
      pendingSkillsSortRef.current = false;
    }
  }, [orderSource, skillsSortKey]);

  const specialtyName = (value?: number) => {
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

  const playerId =
    detailsData?.YouthPlayerID ?? selectedPlayer?.YouthPlayerID ?? null;
  const playerHref =
    playerId !== null
      ? playerKind === "senior"
        ? hattrickPlayerUrl(playerId)
        : hattrickYouthPlayerUrl(playerId)
      : null;
  const playerDisplayName = detailsData
    ? `${detailsData.FirstName} ${detailsData.LastName}`
    : "";
  const handleCopyPlayerId = useCallback(async () => {
    if (playerId === null) return;
    let copied = false;
    try {
      copied = await copyTextToClipboard(String(playerId));
    } catch {
      copied = false;
    }
    if (
      copied &&
      document.documentElement.dataset.mobileShell !== "true"
    ) {
      addNotification(messages.notificationPlayerIdCopied);
    }
  }, [addNotification, messages.notificationPlayerIdCopied, playerId]);
  const seniorTsiRange = useMemo(() => {
    const values = players
      .map((player) => player.TSI)
      .filter((value): value is number => typeof value === "number");
    if (!values.length) return { min: 0, max: 0 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [players]);
  const selectedPlayerHasNewMarker =
    playerId !== null && matrixNewPlayerIdSet.has(playerId);
  const hiddenSpecialty =
    playerId && Number(hiddenSpecialtyByPlayerId[playerId] ?? 0) > 0
      ? Number(hiddenSpecialtyByPlayerId[playerId])
      : null;
  const knownSpecialty = Number(detailsData?.Specialty ?? selectedPlayer?.Specialty ?? 0);
  const resolvedSpecialty = knownSpecialty > 0 ? knownSpecialty : hiddenSpecialty;
  const isHiddenResolvedSpecialty = knownSpecialty <= 0 && hiddenSpecialty !== null;
  const hiddenSpecialtyMatchHref =
    playerId !== null && isHiddenResolvedSpecialty
      ? hiddenSpecialtyMatchHrefByPlayerId[playerId]
      : undefined;
  const injuryLevelRaw =
    typeof detailsData?.InjuryLevel === "number"
      ? detailsData.InjuryLevel
      : typeof selectedPlayer?.InjuryLevel === "number"
      ? selectedPlayer.InjuryLevel
      : null;
  const injuryStatus = buildInjuryStatus(injuryLevelRaw, messages);
  const selectedCardStatus =
    playerKind === "senior" && playerId !== null
      ? cardStatusByPlayerId[playerId] ?? null
      : null;
  const lastMatchDate = detailsData?.LastMatch
    ? formatChppDate(detailsData.LastMatch.Date) ?? messages.unknownDate
    : null;
  const lastMatchRating = detailsData?.LastMatch
    ? detailsData.LastMatch.Rating ?? messages.unknownLabel
    : null;
  const lastMatchPosition = detailsData?.LastMatch
    ? positionLabelShortByRoleId(detailsData.LastMatch.PositionCode, messages)
    : null;
  const promotionAge =
    detailsData?.Age !== undefined &&
    detailsData?.AgeDays !== undefined &&
    detailsData?.CanBePromotedIn !== undefined
      ? (() => {
          const daysPerYear = 112;
          const totalDays =
            detailsData.Age * daysPerYear +
            detailsData.AgeDays +
            Math.max(0, detailsData.CanBePromotedIn);
          const promoYears = Math.floor(totalDays / daysPerYear);
          const promoDays = totalDays % daysPerYear;
          return {
            label: `${promoYears} ${messages.yearsLabel} ${promoDays} ${messages.daysLabel}`,
            totalDays,
          };
        })()
      : null;
  const seniorTsiValue =
    playerKind === "senior"
      ? (typeof detailsData?.TSI === "number"
          ? detailsData.TSI
          : typeof selectedPlayer?.TSI === "number"
            ? selectedPlayer.TSI
            : null)
      : null;
  const seniorWageValue =
    playerKind === "senior"
      ? typeof detailsData?.Salary === "number"
        ? detailsData.Salary
        : null
      : null;
  const seniorAgeLabel =
    playerKind === "senior" && typeof detailsData?.Age === "number"
      ? `${detailsData.Age}${messages.ageYearsShort}${
          typeof detailsData.AgeDays === "number"
            ? ` ${detailsData.AgeDays}${messages.ageDaysShort}`
            : ""
        }`
      : null;
  const seniorAgePillClassName =
    playerKind === "senior"
      ? resolveSeniorAgePillClassName(
          typeof detailsData?.Age === "number" ? detailsData.Age : null,
          styles
        )
      : null;
  const seniorSkillLevelLabels = useMemo(() => {
    const raw = messages.seniorSkillLevelLabels
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    if (raw.length >= 20) return raw.slice(0, 20);
    return [
      "disastrous",
      "wretched",
      "poor",
      "weak",
      "inadequate",
      "passable",
      "solid",
      "excellent",
      "formidable",
      "outstanding",
      "brilliant",
      "magnificent",
      "world class",
      "supernatural",
      "titanic",
      "extra-terrestrial",
      "mythical",
      "magical",
      "utopian",
      "divine",
    ];
  }, [messages.seniorSkillLevelLabels]);
  const formatSeniorSkillLevel = (value: number | undefined) => {
    if (typeof value !== "number" || value <= 0) return messages.unknownLabel;
    const index = Math.min(20, Math.max(1, Math.floor(value))) - 1;
    return seniorSkillLevelLabels[index] ?? messages.unknownLabel;
  };
  const seniorAgreeabilityLabels = useMemo(
    () =>
      messages.seniorAgreeabilityLabels
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean),
    [messages.seniorAgreeabilityLabels]
  );
  const seniorAggressivenessLabels = useMemo(
    () =>
      messages.seniorAggressivenessLabels
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean),
    [messages.seniorAggressivenessLabels]
  );
  const seniorHonestyLabels = useMemo(
    () =>
      messages.seniorHonestyLabels
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean),
    [messages.seniorHonestyLabels]
  );
  const seniorPersonalitySentence =
    playerKind !== "senior" || !detailsData
      ? null
      : (() => {
          const agreeability =
            typeof detailsData.Agreeability === "number" ? detailsData.Agreeability : null;
          const aggressiveness =
            typeof detailsData.Aggressiveness === "number" ? detailsData.Aggressiveness : null;
          const honesty = typeof detailsData.Honesty === "number" ? detailsData.Honesty : null;
          if (
            agreeability === null ||
            aggressiveness === null ||
            honesty === null ||
            !seniorAgreeabilityLabels[agreeability] ||
            !seniorAggressivenessLabels[aggressiveness] ||
            !seniorHonestyLabels[honesty]
          ) {
            return neutralizeSeniorPersonalityFallback(detailsData.PersonalityStatement);
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
    playerKind !== "senior" || !detailsData
      ? null
      : (() => {
          const parts: string[] = [];
          if (
            typeof detailsData.Experience === "number" &&
            typeof detailsData.Leadership === "number"
          ) {
            parts.push(
              messages.seniorTraitsSentenceExperienceLeadership
                .replace("{{experienceLevel}}", formatSeniorSkillLevel(detailsData.Experience))
                .replace("{{experienceValue}}", String(detailsData.Experience))
                .replace("{{leadershipLevel}}", formatSeniorSkillLevel(detailsData.Leadership))
                .replace("{{leadershipValue}}", String(detailsData.Leadership))
            );
          }
          if (typeof detailsData.Loyalty === "number") {
            parts.push(
              messages.seniorTraitsSentenceLoyalty
                .replace("{{loyaltyLevel}}", formatSeniorSkillLevel(detailsData.Loyalty))
                .replace("{{loyaltyValue}}", String(detailsData.Loyalty))
            );
          }
          return parts.length ? parts.join(" ") : null;
        })();
  const seniorCareerStats =
    playerKind !== "senior" || !detailsData
      ? []
      : [
          { label: messages.seniorCareerGoalsLabel, value: detailsData.CareerGoals },
          { label: messages.seniorCareerHattricksLabel, value: detailsData.CareerHattricks },
          { label: messages.seniorLeagueGoalsLabel, value: detailsData.LeagueGoals },
          { label: messages.seniorCupGoalsLabel, value: detailsData.CupGoals },
          { label: messages.seniorFriendliesGoalsLabel, value: detailsData.FriendliesGoals },
          { label: messages.seniorCapsLabel, value: detailsData.Caps },
          { label: messages.seniorCapsU20Label, value: detailsData.CapsU20 },
          {
            label: messages.seniorGoalsCurrentTeamLabel,
            value: detailsData.GoalsCurrentTeam,
          },
          {
            label: messages.seniorAssistsCurrentTeamLabel,
            value: detailsData.AssistsCurrentTeam,
          },
          { label: messages.seniorCareerAssistsLabel, value: detailsData.CareerAssists },
          {
            label: messages.seniorMatchesCurrentTeamLabel,
            value: detailsData.MatchesCurrentTeam,
          },
        ];

  const renderDetails = () => {
    if (loading) {
      return (
        <div className={styles.loadingRow}>
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.muted}>{messages.loadingDetails}</span>
        </div>
      );
    }

    if (error) {
      return <p className={styles.errorText}>{error}</p>;
    }

    if (!detailsData) {
      return <p className={styles.muted}>{messages.selectPlayerPrompt}</p>;
    }

    return (
      <div
        className={`${styles.profileCard}${
          detailsHeaderActions ? ` ${styles.profileCardWithHeaderActions}` : ""
        }`}
      >
        <div className={styles.detailsRefreshCorner}>
          {detailsHeaderActions}
          <Tooltip content={messages.playerDetailsPreviousPlayer}>
            <button
              type="button"
              className={`${styles.sortToggle} ${styles.detailsRefresh}`}
              onClick={onPreviousPlayer}
              disabled={!selectedPlayer || loading || !hasPreviousPlayer}
              aria-label={messages.playerDetailsPreviousPlayer}
            >
              {"<"}
            </button>
          </Tooltip>
          <Tooltip content={messages.playerDetailsNextPlayer}>
            <button
              type="button"
              className={`${styles.sortToggle} ${styles.detailsRefresh}`}
              onClick={onNextPlayer}
              disabled={!selectedPlayer || loading || !hasNextPlayer}
              aria-label={messages.playerDetailsNextPlayer}
            >
              {">"}
            </button>
          </Tooltip>
          <Tooltip content={messages.refreshTooltip}>
            <button
              type="button"
              className={`${styles.sortToggle} ${styles.detailsRefresh}`}
              onClick={onRefresh}
              disabled={!selectedPlayer || loading}
              aria-label={messages.refreshTooltip}
            >
              ↻
            </button>
          </Tooltip>
        </div>
        <div className={styles.profileHeader}>
          <div className={styles.profileHeaderMain}>
            <div className={styles.profileNameRow}>
              {typeof detailsData.YouthPlayerID === "number" &&
              onMatrixPlayerDragStart ? (
                <Tooltip
                  content={
                    playerKind === "youth"
                      ? messages.youthDragToLineupHint
                      : messages.youthDragToLineupHint
                  }
                >
                  <h4
                    className={styles.profileName}
                    draggable
                    onDragStart={(event) =>
                      onMatrixPlayerDragStart(
                        event,
                        detailsData.YouthPlayerID as number,
                        playerDisplayName
                      )
                    }
                  >
                    {playerHref ? (
                      <a
                        className={styles.profileNameLink}
                        href={playerHref}
                        target="_blank"
                        rel="noreferrer"
                        draggable={false}
                        aria-label={messages.playerLinkLabel}
                      >
                        {playerDisplayName}
                      </a>
                    ) : (
                      playerDisplayName
                    )}
                  </h4>
                </Tooltip>
              ) : (
                <h4 className={styles.profileName}>
                  {playerHref ? (
                    <a
                      className={styles.profileNameLink}
                      href={playerHref}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={messages.playerLinkLabel}
                    >
                      {playerDisplayName}
                    </a>
                  ) : (
                    playerDisplayName
                  )}
                </h4>
              )}
              {playerKind === "senior" && detailsData.OriginName ? (
                <Tooltip content={detailsData.OriginName}>
                  <span
                    className={styles.playerOriginFlag}
                    aria-label={detailsData.OriginName}
                  >
                    {detailsData.OriginFlagEmoji ?? detailsData.OriginName}
                  </span>
                </Tooltip>
              ) : null}
              {playerKind === "senior" && detailsData.MotherClubBonus ? (
                <Tooltip content={messages.motherClubBonusTooltip}>
                  <span
                    className={styles.seniorMotherClubHeartLarge}
                    aria-label={messages.motherClubBonusTooltip}
                  >
                    ❤
                  </span>
                </Tooltip>
              ) : null}
              {selectedPlayerHasNewMarker ? (
                <span className={styles.matrixNewPill}>
                  {messages.matrixNewPillLabel}
                </span>
              ) : null}
              {lastUpdated && playerKind !== "senior" ? (
                <span className={styles.profileUpdated}>
                  {messages.lastUpdated}: {formatDateTime(lastUpdated)}
                </span>
              ) : null}
            </div>
            {lastUpdated && playerKind === "senior" ? (
              <div className={styles.profileHeaderSubrow}>
                <span className={styles.profileUpdated}>
                  {messages.lastUpdated}: {formatDateTime(lastUpdated)}
                </span>
              </div>
            ) : null}
            <PlayerStatementQuote statement={detailsData.Statement} />
            {playerKind === "senior" && seniorPersonalitySentence ? (
              <p className={styles.seniorPersonaLine}>
                {seniorPersonalitySentence}
              </p>
            ) : null}
            {playerKind === "senior" && seniorTraitsSentence ? (
              <p className={styles.seniorPersonaLine}>{seniorTraitsSentence}</p>
            ) : null}
            <p className={styles.profileMeta}>
              {detailsData.Age !== undefined ? (
                <span
                  className={
                    playerKind === "senior" && seniorAgeLabel && seniorAgePillClassName
                      ? undefined
                      : styles.metaItem
                  }
                >
                  {playerKind === "senior" && seniorAgeLabel && seniorAgePillClassName ? (
                    <>
                      <span className={`${styles.playerAgePill} ${seniorAgePillClassName}`}>
                        {seniorAgeLabel}
                      </span>{" "}
                      <span
                        className={`${styles.playerMetricPill} ${
                          typeof seniorTsiValue === "number"
                            ? ""
                            : styles.playerMetricPillNeutral
                        }`}
                        style={metricPillStyle(
                          seniorTsiValue,
                          seniorTsiRange.min,
                          seniorTsiRange.max
                        )}
                      >
                        {messages.sortTsi}:{" "}
                        {typeof seniorTsiValue === "number"
                          ? seniorTsiValue
                          : messages.unknownShort}
                      </span>
                    </>
                  ) : (
                    <>
                      {detailsData.Age} {messages.yearsLabel}
                      {detailsData.AgeDays !== undefined
                        ? ` ${detailsData.AgeDays} ${messages.daysLabel}`
                        : ""}
                    </>
                  )}
                  {promotionAge ? (
                    <>
                      {" "}
                      (
                      {messages.ageAtPromotionLabel}:{" "}
                      <span
                        className={
                          promotionAge.totalDays < 17 * 112 + 1
                            ? styles.agePromotionGood
                            : styles.agePromotionBad
                        }
                      >
                        {promotionAge.label}
                      </span>
                      )
                    </>
                  ) : null}
                </span>
              ) : null}
              {detailsData.CanBePromotedIn !== undefined ? (
                <span
                  className={`${styles.tag} ${styles.metaTag} ${
                    detailsData.CanBePromotedIn <= 0
                      ? styles.tagDanger
                      : styles.tagSuccess
                  }`}
                >
                  {detailsData.CanBePromotedIn <= 0
                    ? messages.promotableNow
                    : `${messages.promotableIn} ${detailsData.CanBePromotedIn} ${messages.daysLabel}`}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className={styles.profileInfoRow}>
          {detailsData.OwningYouthTeam?.YouthTeamName ? (
            <div>
              <div className={styles.infoLabel}>{messages.youthTeamLabel}</div>
              <div className={styles.infoValue}>
                {detailsData.OwningYouthTeam.YouthTeamName}
              </div>
            </div>
          ) : null}
          {detailsData.OwningYouthTeam?.SeniorTeam?.SeniorTeamName ? (
            <div>
              <div className={styles.infoLabel}>{messages.seniorTeamLabel}</div>
              <div className={styles.infoValue}>
                {detailsData.OwningYouthTeam.SeniorTeam.SeniorTeamName}
              </div>
            </div>
          ) : null}
          {detailsData.ArrivalDate ? (
            <div>
              <div className={styles.infoLabel}>{messages.arrivedLabel}</div>
              <div className={styles.infoValue}>
                {formatChppDate(detailsData.ArrivalDate)}
                {daysSince(detailsData.ArrivalDate) !== null
                  ? ` (${daysSince(detailsData.ArrivalDate)} days ago)`
                  : ""}
              </div>
            </div>
          ) : null}
          {resolvedSpecialty !== null ? (
            <div>
              <div className={styles.infoLabel}>{messages.specialtyLabel}</div>
              <div className={styles.infoValue}>
                <Tooltip
                  content={
                    isHiddenResolvedSpecialty
                      ? `${messages.hiddenSpecialtyTooltip}: ${
                          specialtyName(resolvedSpecialty) ?? messages.specialtyLabel
                        } (${messages.hiddenSpecialtyTooltipLinkHint})`
                      : specialtyName(resolvedSpecialty) ?? messages.specialtyLabel
                  }
                >
                  {hiddenSpecialtyMatchHref ? (
                    <a
                      className={styles.specialtyDiscoveryLink}
                      href={hiddenSpecialtyMatchHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span
                        className={`${styles.playerSpecialty} ${
                          isHiddenResolvedSpecialty ? styles.hiddenSpecialtyBadge : ""
                        }`}
                      >
                        {SPECIALTY_EMOJI[resolvedSpecialty] ?? "—"}
                      </span>
                    </a>
                  ) : (
                    <span
                      className={`${styles.playerSpecialty} ${
                        isHiddenResolvedSpecialty ? styles.hiddenSpecialtyBadge : ""
                      }`}
                    >
                      {SPECIALTY_EMOJI[resolvedSpecialty] ?? "—"}
                    </span>
                  )}
                </Tooltip>{" "}
                {specialtyName(resolvedSpecialty) ??
                  `${messages.specialtyLabel} ${resolvedSpecialty}`}
              </div>
            </div>
          ) : null}
          {injuryStatus && !injuryStatus.isHealthy ? (
            <div>
              <div className={styles.infoLabel}>
                {messages.clubChronicleWagesInjuryColumn}
              </div>
              <div className={styles.infoValue} title={injuryStatus.label}>
                {injuryStatus.display ? (
                  <span
                    className={
                      injuryStatus.isHealthy
                        ? styles.injuryStatusHealthy
                        : styles.injuryStatusSymbol
                    }
                  >
                    {injuryStatus.display}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {playerId ? (
            <div>
              <div className={styles.infoLabel}>{messages.playerIdLabel}</div>
              <div className={styles.infoValue}>
                {playerId}
                <Tooltip content={messages.copyPlayerIdLabel}>
                  <button
                    type="button"
                    className={`${styles.infoLinkIcon} ${styles.copyPlayerIdButton}`}
                    onClick={handleCopyPlayerId}
                    aria-label={messages.copyPlayerIdLabel}
                  >
                    ⧉
                  </button>
                </Tooltip>
              </div>
            </div>
          ) : null}
          {playerKind === "senior" ? (
            <div>
              <div className={styles.infoLabel}>{messages.cardStatusLabel}</div>
              <div className={styles.infoValue}>
                {selectedCardStatus ? (
                  <span
                    className={styles.matrixCardStatus}
                    title={selectedCardStatus.label}
                    aria-label={selectedCardStatus.label}
                  >
                    {selectedCardStatus.display}
                  </span>
                ) : (
                  "-"
                )}
              </div>
            </div>
          ) : null}
          {playerKind === "senior" ? (
            <div>
              <div className={styles.infoLabel}>{messages.seniorWageLabel}</div>
              <div className={styles.infoValue}>
                {formatSeniorWage(
                  seniorWageValue,
                  seniorIsAbroad,
                  messages
                )}
              </div>
              {seniorPredictedWageDisplay ? (
                <div className={styles.infoValueTiny}>
                  {messages.seniorMlPredictedWageLabel}:{" "}
                  {formatEurFromSek(seniorPredictedWageDisplay.valueSek)}
                  {seniorPredictedWageDisplay.diffPercent
                    ? ` (${messages.seniorMlPredictionDiffLabel} ${seniorPredictedWageDisplay.diffPercent})`
                    : ""}
                </div>
              ) : null}
            </div>
          ) : null}
          {detailsData.LastMatch ? (
            <div>
              <div className={styles.infoLabel}>
                {messages.lastMatchRatingLabel}
              </div>
              <div className={`${styles.infoValue} ${styles.lastMatchValue}`}>
                {lastMatchDate}: {lastMatchRating}
                {lastMatchPosition ? ` (${lastMatchPosition})` : ""}
              </div>
            </div>
          ) : null}
        </div>

        {playerKind === "senior" ? (
          <>
            <div className={styles.sectionDivider} />
            <SeniorFoxtrickSimulator
              key={`${playerKind}-${detailsData.YouthPlayerID}`}
              input={seniorMetricInput ?? buildSeniorMetricInputFromDetails(detailsData)}
              messages={messages}
              loyalty={detailsData.Loyalty ?? null}
              motherClubBonus={detailsData.MotherClubBonus}
              onSimulationStateChange={onSeniorSimulationStateChange}
              barGradient={seniorBarGradient}
            />
          </>
        ) : null}

        {playerKind !== "senior" ? (
          <>
            <div className={styles.sectionDivider} />

            <div>
              <div className={styles.sectionHeadingRow}>
                <h5 className={styles.sectionHeading}>{messages.skillsLabel}</h5>
                {unlockStatus === "success" ? (
                  <span
                    className={`${styles.detailsBadge} ${styles.detailsBadgeSuccess}`}
                  >
                    {messages.unlockedLabel}
                  </span>
                ) : null}
              </div>
              <div className={styles.skillsGrid}>
            {SKILL_ROWS.map((row) => {
              const skillNode = detailsData.PlayerSkills?.[row.key];
              const current = getSkillLevel(skillNode);
              const max = getSkillMax(detailsData.PlayerSkills?.[row.maxKey]);
              const isNewCurrent =
                playerId !== null
                  ? (matrixNewSkillsCurrentByPlayerId[playerId]?.includes(row.key) ??
                    false)
                  : false;
              const isNewMax =
                playerId !== null
                  ? (matrixNewSkillsMaxByPlayerId[playerId]?.includes(row.key) ??
                    false)
                  : false;
              const hasCurrent = current !== null;
              const hasMax = max !== null;
              const isMaxed = getSkillMaxReached(skillNode);
              const currentText = hasCurrent
                ? String(current)
                : messages.unknownShort;
              const maxText = hasMax ? String(max) : messages.unknownShort;
              const currentPct = hasCurrent
                ? Math.min(100, (current / maxSkillLevel) * 100)
                : null;
              const maxPct = hasMax
                ? Math.min(100, (max / maxSkillLevel) * 100)
                : null;
              const currentBarColor = undefined;
              const maxBarColor = undefined;

              return (
                <div key={row.key} className={styles.skillRow}>
                  <div className={styles.skillLabel}>
                    {messages[row.labelKey as keyof Messages]}
                  </div>
                  {skillMode === "single" ? (
                    <div className={styles.skillBar}>
                      {hasCurrent ? (
                        <div
                          className={styles.skillFillCurrent}
                          style={{
                            width: `${currentPct}%`,
                            background: currentBarColor,
                          }}
                        />
                      ) : null}
                    </div>
                  ) : isMaxed ? (
                    <Tooltip content={messages.skillMaxedTooltip} fullWidth>
                      <div className={`${styles.skillBar} ${styles.skillBarMaxed}`}>
                        {hasMax ? (
                          <div
                            className={styles.skillFillMax}
                            style={{
                              width: `${maxPct}%`,
                              background: maxBarColor,
                            }}
                          />
                        ) : null}
                        {hasCurrent ? (
                          <div
                            className={styles.skillFillCurrent}
                            style={{
                              width: `${currentPct}%`,
                              background: currentBarColor,
                            }}
                          />
                        ) : null}
                      </div>
                    </Tooltip>
                  ) : (
                    <div className={styles.skillBar}>
                      {hasMax ? (
                        <div
                          className={styles.skillFillMax}
                          style={{
                            width: `${maxPct}%`,
                            background: maxBarColor,
                          }}
                        />
                      ) : null}
                      {hasCurrent ? (
                        <div
                          className={styles.skillFillCurrent}
                          style={{
                            width: `${currentPct}%`,
                            background: currentBarColor,
                          }}
                        />
                      ) : null}
                    </div>
                  )}
                  {skillMode === "single" ? (
                    <div className={styles.skillValue}>
                      <span className={styles.skillValuePartWithFlag}>
                        <span>{currentText}</span>
                        {isNewCurrent ? (
                          <span className={styles.matrixNewPill}>
                            {messages.matrixNewPillLabel}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : (
                    <div className={styles.skillValue}>
                      <span className={styles.skillValuePartWithFlag}>
                        <span>{currentText}</span>
                        {isNewCurrent ? (
                          <span className={styles.matrixNewPill}>
                            {messages.matrixNewPillLabel}
                          </span>
                        ) : null}
                      </span>
                      /
                      <span className={styles.skillValuePartWithFlag}>
                        <span>{maxText}</span>
                        {isNewMax ? (
                          <span className={styles.matrixNewPill}>
                            {messages.matrixNewPillLabel}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
              </div>
            </div>
          </>
        ) : null}
        {playerKind === "senior" ? (
          <>
            <div className={styles.sectionDivider} />
            <div>
              <h5 className={styles.sectionHeading}>{messages.seniorCareerStatsTitle}</h5>
              <div className={styles.profileInfoRow}>
                {seniorCareerStats.map((item) => (
                  <div key={item.label}>
                    <div className={styles.infoLabel}>{item.label}</div>
                    <div className={styles.infoValue}>
                      {typeof item.value === "number" ? item.value : messages.unknownShort}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  };

  const renderSkillsMatrix = () => {
    if (skillsMatrixRows.length === 0) {
      return <p className={styles.muted}>{messages.noYouthPlayers}</p>;
    }
    const shortHeader = (
      preferred: string | undefined,
      fallback: string
    ): string => {
      if (typeof preferred === "string" && preferred.trim().length > 0) {
        return preferred;
      }
      return fallback;
    };
    const playerHeaderLabel =
      playerKind === "senior"
        ? messages.ratingsPlayerLabel
        : messages.ratingsPlayerLabel;
    const specialtyHeaderLabel =
      playerKind === "senior"
        ? shortHeader(messages.seniorMatrixSpecialtyShortLabel, "Sp")
        : messages.ratingsSpecialtyLabel;
    const formHeaderLabel =
      playerKind === "senior"
        ? shortHeader(messages.seniorMatrixFormShortLabel, "Fm")
        : messages.sortForm;
    const staminaHeaderLabel =
      playerKind === "senior"
        ? shortHeader(messages.seniorMatrixStaminaShortLabel, "St")
        : messages.sortStamina;
    const ageHeaderLabel = messages.sortAge;

    return (
      <div className={styles.matrixWrapper}>
        <table
          className={`${styles.matrixTable} ${
            playerKind === "senior" ? styles.matrixTableSeniorCompact : ""
          }`}
        >
          <thead>
            <tr>
              <th className={styles.matrixIndexHeader}>
                {messages.ratingsIndexLabel}
              </th>
              {skillsMatrixLeadingHeader !== undefined ? (
                <th className={styles.matrixSeniorSelectionHeader}>{skillsMatrixLeadingHeader}</th>
              ) : null}
              <th className={styles.matrixPlayerHeader}>
                <button
                  type="button"
                  className={styles.matrixSortButton}
                  onClick={() => handleSkillsSort("name")}
                  aria-label={`${messages.ratingsSortBy} ${messages.ratingsPlayerLabel}`}
                >
                  {playerHeaderLabel}
                  <span className={styles.matrixSortIcon}>
                    {skillsSortKey === "name"
                      ? skillsSortDir === "asc"
                        ? "▲"
                        : "▼"
                      : "⇅"}
                  </span>
                </button>
              </th>
              {playerKind === "senior" ? (
                <th
                  className={`${styles.matrixSeniorMetricHeader} ${styles.matrixSeniorAgeHeader}`}
                >
                  <button
                    type="button"
                    className={styles.matrixSortButton}
                    onClick={() => handleSkillsSort("age")}
                    aria-label={`${messages.ratingsSortBy} ${messages.sortAge}`}
                  >
                    {ageHeaderLabel}
                    <span className={styles.matrixSortIcon}>
                      {skillsSortKey === "age"
                        ? skillsSortDir === "asc"
                          ? "▲"
                          : "▼"
                        : "⇅"}
                    </span>
                  </button>
                </th>
              ) : null}
              <th className={styles.matrixSpecialtyHeader}>
                {specialtyHeaderLabel}
              </th>
                {playerKind === "senior" ? (
                  <>
                    <th className={styles.matrixSeniorMetricHeader}>
                      <button
                        type="button"
                        className={styles.matrixSortButton}
                        onClick={() => handleSkillsSort("form")}
                        aria-label={`${messages.ratingsSortBy} ${messages.sortForm}`}
                      >
                        {formHeaderLabel}
                        <span className={styles.matrixSortIcon}>
                          {skillsSortKey === "form"
                            ? skillsSortDir === "asc"
                              ? "▲"
                              : "▼"
                            : "⇅"}
                        </span>
                      </button>
                    </th>
                    <th
                      className={`${styles.matrixSeniorMetricHeader} ${styles.matrixSeniorStaminaDivider}`}
                    >
                      <button
                        type="button"
                        className={styles.matrixSortButton}
                        onClick={() => handleSkillsSort("stamina")}
                        aria-label={`${messages.ratingsSortBy} ${messages.sortStamina}`}
                      >
                        {staminaHeaderLabel}
                        <span className={styles.matrixSortIcon}>
                          {skillsSortKey === "stamina"
                            ? skillsSortDir === "asc"
                              ? "▲"
                              : "▼"
                            : "⇅"}
                        </span>
                      </button>
                    </th>
                  </>
                ) : null}
                {SKILL_ROWS.map((row) => {
                  const isActive = skillsSortKey === row.key;
                  const direction = isActive ? skillsSortDir : "desc";
                  return (
                    <th
                      key={row.key}
                      className={playerKind === "senior" ? styles.matrixSeniorSkillHeader : undefined}
                    >
                      <button
                        type="button"
                        className={styles.matrixSortButton}
                        onClick={() => handleSkillsSort(row.key)}
                        aria-label={`${messages.ratingsSortBy} ${messages[row.labelKey as keyof Messages]}`}
                      >
                      {messages[row.shortLabelKey as keyof Messages]}
                      <span className={styles.matrixSortIcon}>
                        {isActive ? (direction === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {orderedSkillsRows.map((row, index) => {
              const player = row.id ? playerById.get(row.id) : null;
              const details = row.id ? playerDetailsById.get(row.id) : null;
              const playerAge = resolvePlayerAge(player ?? null, details ?? null);
              const ageLabel = playerAge
                ? `${playerAge.years}${messages.ageYearsShort} ${Math.max(
                    0,
                    playerAge.days ?? 0
                  )}${messages.ageDaysShort}`
                : messages.unknownShort;
              const seniorAgePillClassName =
                playerKind === "senior"
                  ? resolveSeniorAgePillClassName(playerAge?.years ?? null, styles)
                  : null;
              const skills = mergedSkills(
                details?.PlayerSkills,
                player?.PlayerSkills
              );
              const rowInjuryLevel =
                typeof details?.InjuryLevel === "number"
                  ? details.InjuryLevel
                  : typeof player?.InjuryLevel === "number"
                  ? player.InjuryLevel
                  : null;
              const rowInjuryStatus = buildInjuryStatus(rowInjuryLevel, messages);
              const rowCardStatus =
                playerKind === "senior" && typeof row.id === "number"
                  ? cardStatusByPlayerId[row.id] ?? null
                  : null;
              const hasSeniorIndicatorRow =
                playerKind === "senior" &&
                (Boolean(details?.MotherClubBonus) ||
                  Boolean(rowCardStatus) ||
                  Boolean(rowInjuryStatus && !rowInjuryStatus.isHealthy));
              const isSelected = ratingsMatrixSelectedName === row.name;
              const isNewPlayer = row.id ? matrixNewPlayerIdSet.has(row.id) : false;
              const scoutOverallSkillLevel =
                row.id !== null ? scoutOverallSkillLevelByPlayerId[row.id] : undefined;
              const rowClassName = skillsMatrixRowClassName?.(row) ?? "";
              const rowTooltip = skillsMatrixRowTooltip?.(row) ?? null;
              const matrixPlayerContent = (
                <div
                  className={`${styles.matrixPlayerContent} ${
                    hasSeniorIndicatorRow ? styles.matrixPlayerContentTwoRow : ""
                  }`}
                >
                  <div className={styles.matrixPlayerNameLine}>
                    {typeof row.id === "number" && onMatrixPlayerDragStart ? (
                      <Tooltip
                        content={
                          playerKind === "youth"
                            ? messages.youthDragToLineupHint
                            : messages.youthDragToLineupHint
                        }
                      >
                        <button
                          type="button"
                          className={styles.matrixPlayerButton}
                          onClick={() => handleMatrixPlayerPick(row.name)}
                          disabled={!onSelectRatingsPlayer}
                          draggable
                          onDragStart={(event) => {
                            onMatrixPlayerDragStart(event, row.id as number, row.name);
                          }}
                        >
                          {row.name}
                        </button>
                      </Tooltip>
                    ) : (
                      <button
                        type="button"
                        className={styles.matrixPlayerButton}
                        onClick={() => handleMatrixPlayerPick(row.name)}
                        disabled={!onSelectRatingsPlayer}
                      >
                        {row.name}
                      </button>
                    )}
                    {isNewPlayer ? (
                      <span className={styles.matrixNewPill}>
                        {messages.matrixNewPillLabel}
                      </span>
                    ) : null}
                    {playerKind === "youth" &&
                    typeof scoutOverallSkillLevel === "number" ? (
                      <Tooltip content={messages.scoutOverallSkillLevelTooltip}>
                        <span className={styles.matrixScoutOverallBadge}>
                          {scoutOverallSkillLevel}
                        </span>
                      </Tooltip>
                    ) : null}
                  </div>
                  {hasSeniorIndicatorRow ? (
                    <div className={styles.matrixPlayerIndicatorsLine}>
                      {details?.MotherClubBonus ? (
                        <Tooltip content={messages.motherClubBonusTooltip}>
                          <span
                            className={styles.seniorMotherClubHeart}
                            aria-label={messages.motherClubBonusTooltip}
                          >
                            ❤
                          </span>
                        </Tooltip>
                      ) : null}
                      {rowInjuryStatus && !rowInjuryStatus.isHealthy ? (
                        <span
                          className={
                            rowInjuryStatus.isHealthy
                              ? styles.matrixInjuryHealthy
                              : styles.matrixInjuryStatus
                          }
                          title={rowInjuryStatus.label}
                        >
                          {rowInjuryStatus.display}
                        </span>
                      ) : null}
                      {rowCardStatus ? (
                        <span
                          className={styles.matrixCardStatus}
                          title={rowCardStatus.label}
                          aria-label={rowCardStatus.label}
                        >
                          {rowCardStatus.display}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {playerKind === "senior" && details?.MotherClubBonus ? (
                        <Tooltip content={messages.motherClubBonusTooltip}>
                          <span
                            className={styles.seniorMotherClubHeart}
                            aria-label={messages.motherClubBonusTooltip}
                          >
                            ❤
                          </span>
                        </Tooltip>
                      ) : null}
                      {rowInjuryStatus &&
                      !rowInjuryStatus.isHealthy ? (
                        <span
                          className={
                            rowInjuryStatus.isHealthy
                              ? styles.matrixInjuryHealthy
                              : styles.matrixInjuryStatus
                          }
                          title={rowInjuryStatus.label}
                        >
                          {rowInjuryStatus.display}
                        </span>
                      ) : null}
                      {rowCardStatus ? (
                        <span
                          className={styles.matrixCardStatus}
                          title={rowCardStatus.label}
                          aria-label={rowCardStatus.label}
                        >
                          {rowCardStatus.display}
                        </span>
                      ) : null}
                    </>
                  )}
                  {playerKind !== "senior" && details?.MotherClubBonus ? (
                    <Tooltip content={messages.motherClubBonusTooltip}>
                      <span
                        className={styles.seniorMotherClubHeart}
                        aria-label={messages.motherClubBonusTooltip}
                      >
                        ❤
                      </span>
                    </Tooltip>
                  ) : null}
                </div>
              );

              return (
                <tr
                  key={`${row.name}-${row.id ?? "unknown"}`}
                  className={`${styles.matrixRow} ${
                    isSelected ? styles.matrixRowSelected : ""
                  } ${rowClassName}`.trim()}
                >
                  <td className={styles.matrixIndex}>{index + 1}</td>
                  {renderSkillsMatrixLeadingCell ? (
                    <td className={styles.matrixSeniorSelectionCell}>
                      {renderSkillsMatrixLeadingCell(row)}
                    </td>
                  ) : null}
                  <td className={styles.matrixPlayer}>
                    {rowTooltip ? (
                      <Tooltip content={rowTooltip}>
                        {matrixPlayerContent}
                      </Tooltip>
                    ) : (
                      matrixPlayerContent
                    )}
                  </td>
                  {playerKind === "senior" ? (
                    <td
                      className={`${styles.matrixCell} ${styles.matrixSeniorMetricCell} ${styles.matrixSeniorAgeCell}`}
                    >
                      {seniorAgePillClassName ? (
                        <span className={`${styles.playerAgePill} ${seniorAgePillClassName}`}>
                          {ageLabel}
                        </span>
                      ) : (
                        <span className={`${styles.skillsMatrixHalf} ${styles.skillsMatrixHalfPill}`}>
                          {ageLabel}
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td className={styles.matrixSpecialty}>
                    {(() => {
                      const baseSpecialty = Number(player?.Specialty ?? 0);
                      const hiddenForPlayer =
                        player && Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0) > 0
                          ? Number(hiddenSpecialtyByPlayerId[player.YouthPlayerID])
                          : null;
                      const specialtyValue =
                        baseSpecialty > 0 ? baseSpecialty : hiddenForPlayer;
                      const isHidden = baseSpecialty <= 0 && hiddenForPlayer !== null;
                      const hiddenSpecialtyHref =
                        isHidden && player
                          ? hiddenSpecialtyMatchHrefByPlayerId[player.YouthPlayerID]
                          : undefined;
                      if (specialtyValue === null) return "—";
                      return (
                        <Tooltip
                          content={
                            isHidden
                              ? `${messages.hiddenSpecialtyTooltip}: ${
                                  specialtyName(specialtyValue) ?? messages.specialtyLabel
                                } (${messages.hiddenSpecialtyTooltipLinkHint})`
                              : specialtyName(specialtyValue) ?? messages.specialtyLabel
                          }
                        >
                          {hiddenSpecialtyHref ? (
                            <a
                              className={styles.specialtyDiscoveryLink}
                              href={hiddenSpecialtyHref}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span
                                className={`${styles.playerSpecialty} ${
                                  isHidden ? styles.hiddenSpecialtyBadge : ""
                                }`}
                              >
                                {SPECIALTY_EMOJI[specialtyValue] ?? "—"}
                              </span>
                            </a>
                          ) : (
                            <span
                              className={`${styles.playerSpecialty} ${
                                isHidden ? styles.hiddenSpecialtyBadge : ""
                              }`}
                            >
                              {SPECIALTY_EMOJI[specialtyValue] ?? "—"}
                            </span>
                          )}
                        </Tooltip>
                      );
                    })()}
                  </td>
                  {playerKind === "senior" ? (
                    <>
                      <td className={`${styles.matrixCell} ${styles.matrixSeniorMetricCell}`}>
                        <span
                          className={`${styles.skillsMatrixHalf} ${styles.skillsMatrixHalfPill}`}
                          style={
                            skillCellColor(
                              typeof details?.Form === "number"
                                ? details.Form
                                : typeof player?.Form === "number"
                                ? player.Form
                                : null,
                              0,
                              8
                            )
                              ? {
                                  backgroundColor: skillCellColor(
                                    typeof details?.Form === "number"
                                      ? details.Form
                                      : typeof player?.Form === "number"
                                      ? player.Form
                                      : null,
                                    0,
                                    8
                                  ),
                                }
                              : undefined
                          }
                        >
                          {typeof details?.Form === "number"
                            ? details.Form
                            : typeof player?.Form === "number"
                            ? player.Form
                            : messages.unknownShort}
                        </span>
                      </td>
                      <td
                        className={`${styles.matrixCell} ${styles.matrixSeniorMetricCell} ${styles.matrixSeniorStaminaDivider}`}
                      >
                        <span
                          className={`${styles.skillsMatrixHalf} ${styles.skillsMatrixHalfPill}`}
                          style={
                            skillCellColor(
                              typeof details?.StaminaSkill === "number"
                                ? details.StaminaSkill
                                : typeof player?.StaminaSkill === "number"
                                ? player.StaminaSkill
                                : null,
                              0,
                              9
                            )
                              ? {
                                  backgroundColor: skillCellColor(
                                    typeof details?.StaminaSkill === "number"
                                      ? details.StaminaSkill
                                      : typeof player?.StaminaSkill === "number"
                                      ? player.StaminaSkill
                                      : null,
                                    0,
                                    9
                                  ),
                                }
                              : undefined
                          }
                        >
                          {typeof details?.StaminaSkill === "number"
                            ? details.StaminaSkill
                            : typeof player?.StaminaSkill === "number"
                            ? player.StaminaSkill
                            : messages.unknownShort}
                        </span>
                      </td>
                    </>
                  ) : null}
                  {SKILL_ROWS.map((skill) => {
                    const current = getSkillLevel(skills?.[skill.key]);
                    const max = getSkillMax(skills?.[skill.maxKey]);
                    const isMaxed = getSkillMaxReached(skills?.[skill.key]);
                    const seniorEffectiveCurrent =
                      playerKind === "senior" &&
                      skillMode === "single" &&
                      showSeniorSkillBonusInMatrix
                        ? computeSeniorEffectiveSkill(current, details ?? null)
                        : current;
                    const isNewCurrent =
                      row.id !== null
                        ? (matrixNewSkillsCurrentByPlayerId[row.id]?.includes(
                            skill.key
                          ) ?? false)
                        : false;
                    const isNewMax =
                      row.id !== null
                        ? (matrixNewSkillsMaxByPlayerId[row.id]?.includes(skill.key) ??
                          false)
                        : false;
                    const isScoutImportant =
                      playerKind === "youth" && row.id !== null
                        ? (scoutImportantSkillsByPlayerId[row.id]?.includes(skill.key) ??
                          false)
                        : false;
                    const currentText =
                      skillMode === "single" && playerKind === "senior"
                        ? (showSeniorSkillBonusInMatrix
                            ? seniorEffectiveCurrent === null
                              ? messages.unknownShort
                              : formatSkillMatrixFloat(seniorEffectiveCurrent)
                            : current === null
                            ? messages.unknownShort
                            : String(Math.round(current)))
                        : current === null
                          ? messages.unknownShort
                          : String(current);
                    const maxText = max === null ? messages.unknownShort : String(max);
                    const currentColor = skillCellColor(
                      playerKind === "senior" && skillMode === "single"
                        ? seniorEffectiveCurrent
                        : current,
                      0,
                      maxSkillLevel
                    );
                    const maxColor = skillCellColor(max, 0, maxSkillLevel);
                    if (skillMode === "single") {
                      const singleContent = (
                        <span
                          className={`${styles.skillsMatrixHalf} ${
                            playerKind === "senior" ? styles.skillsMatrixHalfPill : ""
                          } ${
                            isScoutImportant ? styles.skillsMatrixImportantUnderline : ""
                          }`}
                          style={
                            currentColor
                              ? { backgroundColor: currentColor }
                              : undefined
                          }
                        >
                          {currentText}
                        </span>
                      );
                      return (
                        <td
                          key={skill.key}
                          className={`${styles.matrixCell} ${
                            playerKind === "senior" ? styles.matrixSeniorSkillCell : ""
                          }`}
                        >
                          {isScoutImportant ? (
                            <Tooltip content={messages.scoutImportantSkillTooltip}>
                              {singleContent}
                            </Tooltip>
                          ) : (
                            singleContent
                          )}
                        </td>
                      );
                    }
                    const cellContent = (
                      <div
                        className={`${styles.skillsMatrixSplit} ${
                          isMaxed ? styles.skillsMatrixMaxed : ""
                        } ${
                          isScoutImportant ? styles.skillsMatrixImportantUnderline : ""
                        }`}
                      >
                        {isNewCurrent ? (
                          <Tooltip content={messages.matrixNewNTooltip}>
                            <span
                              className={`${styles.matrixSplitNewTag} ${styles.matrixSplitNewTagLeft}`}
                            >
                              N
                            </span>
                          </Tooltip>
                        ) : null}
                        {isNewMax ? (
                          <Tooltip content={messages.matrixNewNTooltip}>
                            <span
                              className={`${styles.matrixSplitNewTag} ${styles.matrixSplitNewTagRight}`}
                            >
                              N
                            </span>
                          </Tooltip>
                        ) : null}
                        <span
                          className={`${styles.skillsMatrixHalf} ${styles.skillsMatrixHalfLeft}`}
                          style={
                            currentColor
                              ? { backgroundColor: currentColor }
                              : undefined
                          }
                        >
                          <span>{currentText}</span>
                        </span>
                        <span className={styles.skillsMatrixDivider}>/</span>
                        <span
                          className={`${styles.skillsMatrixHalf} ${styles.skillsMatrixHalfRight}`}
                          style={maxColor ? { backgroundColor: maxColor } : undefined}
                        >
                          <span>{maxText}</span>
                        </span>
                      </div>
                    );
                    return (
                      <td
                        key={skill.key}
                        className={`${styles.matrixCell} ${
                          playerKind === "senior" ? styles.matrixSeniorSkillCell : ""
                        }`}
                      >
                        {isScoutImportant ? (
                          <Tooltip content={messages.scoutImportantSkillTooltip}>
                            {cellContent}
                          </Tooltip>
                        ) : isMaxed ? (
                          <Tooltip content={messages.skillMaxedTooltip}>
                            {cellContent}
                          </Tooltip>
                        ) : (
                          cellContent
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={`${styles.card} ${styles.playerDetailsCard}`}>
      <div className={styles.detailsHeader}>
        {showTabs ? (
          <div className={styles.detailsTabs}>
            <button
              type="button"
              className={`${styles.detailsTabButton} ${
                resolvedActiveTab === "details" ? styles.detailsTabActive : ""
              }`}
              onClick={() => setResolvedActiveTab("details")}
            >
              {messages.detailsTabLabel}
            </button>
            <button
              type="button"
              className={`${styles.detailsTabButton} ${
                resolvedActiveTab === "skillsMatrix" ? styles.detailsTabActive : ""
              }`}
              onClick={() => setResolvedActiveTab("skillsMatrix")}
            >
              {messages.skillsMatrixTabLabel}
            </button>
            <button
              type="button"
              className={`${styles.detailsTabButton} ${
                resolvedActiveTab === "ratingsMatrix" ? styles.detailsTabActive : ""
              }`}
              onClick={() => setResolvedActiveTab("ratingsMatrix")}
            >
              {messages.ratingsMatrixTabLabel}
            </button>
          </div>
        ) : (
          <div className={styles.detailsTabs} />
        )}
        {resolvedActiveTab === "skillsMatrix" ||
        resolvedActiveTab === "ratingsMatrix" ? (
          <div className={styles.detailsHeaderAux}>
            {skillsMatrixHeaderAux}
            {extraSkillsMatrixHeaderAux}
            {resolvedActiveTab === "skillsMatrix" &&
            playerKind === "senior" &&
            skillMode === "single" ? (
              <Tooltip content={messages.seniorSkillsMatrixBonusToggleTooltip}>
                <label className={styles.matchesFilterToggle}>
                  <input
                    type="checkbox"
                    className={styles.matchesFilterToggleInput}
                    checked={showSeniorSkillBonusInMatrix}
                    onChange={(event) =>
                      onShowSeniorSkillBonusInMatrixChange?.(event.target.checked)
                    }
                  />
                  <span className={styles.matchesFilterToggleTrack} aria-hidden="true" />
                  <span className={styles.matchesFilterToggleLabel}>
                    {messages.seniorSkillsMatrixBonusToggleLabel}
                  </span>
                </label>
              </Tooltip>
            ) : null}
          </div>
        ) : null}
      </div>

      {resolvedActiveTab === "details" ? (
        renderDetails()
      ) : resolvedActiveTab === "skillsMatrix" ? (
        renderSkillsMatrix()
      ) : (
        <RatingsMatrix
          response={ratingsMatrixResponse}
          showTitle={false}
          messages={messages}
          matchHrefBuilder={ratingsMatrixMatchHrefBuilder}
          specialtyByName={ratingsMatrixSpecialtyByName}
          hiddenSpecialtyByName={ratingsMatrixHiddenSpecialtyByName}
          hiddenSpecialtyMatchHrefByName={ratingsMatrixHiddenSpecialtyMatchHrefByName}
          motherClubBonusByName={ratingsMatrixMotherClubBonusByName}
          injuryStatusByName={ratingsMatrixInjuryStatusByName}
          cardStatusByName={ratingsMatrixCardStatusByName}
          newPlayerIds={matrixNewPlayerIds}
          newRatingsByPlayerId={matrixNewRatingsByPlayerId}
          overallSkillLevelByPlayerId={
            playerKind === "youth" ? scoutOverallSkillLevelByPlayerId : undefined
          }
          selectedName={ratingsMatrixSelectedName}
          onSelectPlayer={handleMatrixPlayerPick}
          onPlayerDragStart={onMatrixPlayerDragStart}
          playerNameTooltip={messages.youthDragToLineupHint}
          orderedPlayerIds={orderedPlayerIds}
          orderSource={orderSource}
          onOrderChange={onRatingsOrderChange}
          onSortStart={onRatingsSortStart}
        />
      )}
    </div>
  );
}
