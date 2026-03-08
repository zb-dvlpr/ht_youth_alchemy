"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { setDragGhost } from "@/lib/drag";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { getSkillMaxReached } from "@/lib/skills";
import Tooltip from "./Tooltip";

export type LineupAssignments = Record<string, number | null>;
export type LineupBehaviors = Record<string, number>;

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName?: string;
  LastName: string;
  Specialty?: number;
  Cards?: number;
  InjuryLevel?: number;
  Age?: number;
  AgeDays?: number;
  Form?: SkillInput;
  StaminaSkill?: SkillInput;
  PlayerSkills?: Record<string, SkillValue>;
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

type SkillInput = SkillValue | number | string | null | undefined;

export type OptimizeMode =
  | "star"
  | "ratings"
  | "revealPrimaryCurrent"
  | "revealSecondaryMax";

type LineupFieldProps = {
  assignments: LineupAssignments;
  behaviors?: LineupBehaviors;
  playersById: Map<number, YouthPlayer>;
  playerDetailsById?: Map<
    number,
    {
      PlayerSkills?: Record<string, SkillValue>;
      InjuryLevel?: number;
      Cards?: number;
      Form?: SkillInput;
      StaminaSkill?: SkillInput;
    }
  >;
  onAssign: (slotId: string, playerId: number) => void;
  onClear: (slotId: string) => void;
  onMove?: (fromSlot: string, toSlot: string) => void;
  onSelectPlayer?: (playerId: number) => void | Promise<void>;
  onChangeBehavior?: (slotId: string, behavior: number) => void;
  onRandomize?: () => void;
  onReset?: () => void;
  onOptimizeSelect?: (mode: OptimizeMode) => void;
  tacticType?: number;
  onTacticChange?: (value: number) => void;
  tacticPlacement?: "headerRight" | "bottomRight" | "fieldTopLeft";
  trainingType?: number | null;
  onTrainingTypeChange?: (value: number) => void;
  onTrainingTypeSet?: (value: number) => void | Promise<void>;
  trainingTypeSetPending?: boolean;
  trainingTypeSetPendingValue?: number | null;
  trainingTypeOptions?: number[];
  trainingTypeLabelForValue?: (value: number) => string;
  trainingTypeSectionTitleForValue?: (value: number) => string | null;
  trainingTypeAriaLabel?: string;
  optimizeDisabled?: boolean;
  optimizeDisabledReason?: string;
  forceOptimizeOpen?: boolean;
  optimizeStarPlayerName?: string;
  optimizePrimaryTrainingName?: string;
  optimizeSecondaryTrainingName?: string;
  optimizeModeDisabledReasons?: {
    revealPrimaryCurrent?: string;
    revealSecondaryMax?: string;
  };
  trainedSlots?: {
    primary: Set<string>;
    secondary: Set<string>;
    primaryFull: Set<string>;
    primaryHalf: Set<string>;
    secondaryFull: Set<string>;
    secondaryHalf: Set<string>;
    all: Set<string>;
  };
  hiddenSpecialtyByPlayerId?: Record<number, number>;
  hiddenSpecialtyMatchHrefByPlayerId?: Record<number, string>;
  onHoverPlayer?: (playerId: number) => void;
  skillMode?: "currentMax" | "single";
  maxSkillLevel?: number;
  messages: Messages;
};

type PositionRow = {
  className: string;
  positions: { id: string; label: string }[];
};

type BehaviorOption = {
  value: number;
  icon: string;
  position: "top" | "bottom" | "left" | "right";
};

const POSITION_ROWS: PositionRow[] = [
  { className: "fieldRowGoal", positions: [{ id: "KP", label: "KP" }] },
  {
    className: "fieldRowDef",
    positions: [
      { id: "WB_L", label: "WB" },
      { id: "CD_L", label: "CD" },
      { id: "CD_C", label: "CD" },
      { id: "CD_R", label: "CD" },
      { id: "WB_R", label: "WB" },
    ],
  },
  {
    className: "fieldRowMid",
    positions: [
      { id: "W_L", label: "W" },
      { id: "IM_L", label: "IM" },
      { id: "IM_C", label: "IM" },
      { id: "IM_R", label: "IM" },
      { id: "W_R", label: "W" },
    ],
  },
  {
    className: "fieldRowAtk",
    positions: [
      { id: "F_L", label: "F" },
      { id: "F_C", label: "F" },
      { id: "F_R", label: "F" },
    ],
  },
];

const BENCH_SLOTS = [
  { id: "B_GK", labelKey: "benchKeeperLabel" },
  { id: "B_CD", labelKey: "benchDefenderLabel" },
  { id: "B_WB", labelKey: "benchWingBackLabel" },
  { id: "B_IM", labelKey: "benchMidfieldLabel" },
  { id: "B_F", labelKey: "benchForwardLabel" },
  { id: "B_W", labelKey: "benchWingerLabel" },
  { id: "B_X", labelKey: "benchExtraLabel" },
];

const slotSide = (slotId: string) => {
  if (slotId.endsWith("_L")) return "left";
  if (slotId.endsWith("_R")) return "right";
  return "center";
};

const behaviorOptionsForSlot = (slotId: string): BehaviorOption[] => {
  if (slotId === "KP") return [];
  const side = slotSide(slotId);
  const towardMiddle =
    side === "left"
      ? { value: 3, icon: "▶", position: "right" as const }
      : side === "right"
      ? { value: 3, icon: "◀", position: "left" as const }
      : null;
  const towardWing =
    side === "left"
      ? { value: 4, icon: "◀", position: "left" as const }
      : side === "right"
      ? { value: 4, icon: "▶", position: "right" as const }
      : { value: 4, icon: "↔", position: "right" as const };

  if (slotId.startsWith("WB_")) {
    return [
      { value: 2, icon: "▲", position: "top" },
      { value: 1, icon: "▼", position: "bottom" },
      ...(towardMiddle ? [towardMiddle] : []),
    ];
  }
  if (slotId === "CD_C") {
    return [{ value: 1, icon: "▼", position: "bottom" }];
  }
  if (slotId.startsWith("CD_")) {
    return [
      { value: 1, icon: "▼", position: "bottom" },
      towardWing,
    ];
  }
  if (slotId.startsWith("W_")) {
    return [
      { value: 2, icon: "▲", position: "top" },
      { value: 1, icon: "▼", position: "bottom" },
      ...(towardMiddle ? [towardMiddle] : []),
    ];
  }
  if (slotId === "IM_C") {
    return [
      { value: 2, icon: "▲", position: "top" },
      { value: 1, icon: "▼", position: "bottom" },
    ];
  }
  if (slotId.startsWith("IM_")) {
    return [
      { value: 2, icon: "▲", position: "top" },
      { value: 1, icon: "▼", position: "bottom" },
      towardWing,
    ];
  }
  if (slotId.startsWith("F_")) {
    if (slotId === "F_C") {
      return [{ value: 2, icon: "▲", position: "top" }];
    }
    return [
      { value: 2, icon: "▲", position: "top" },
      towardWing,
    ];
  }
  return [];
};

const MAX_SKILL_LEVEL = 8;
const FORM_MAX_LEVEL = 8;
const STAMINA_MAX_LEVEL = 9;
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

const normalizeInjuryLevel = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const injuryStatus = (
  injuryLevelRaw: unknown,
  messages: Messages
) => {
  const injuryLevel = normalizeInjuryLevel(injuryLevelRaw);
  if (injuryLevel === null) return null;
  if (injuryLevel === 0 || (injuryLevel > 0 && injuryLevel < 1)) {
    return { display: "🩹", label: messages.seniorListInjuryBruised, isHealthy: false };
  }
  if (injuryLevel >= 1) {
    const weeks = Math.ceil(injuryLevel);
    return {
      display: `✚${toSubscript(weeks)}`,
      label: messages.seniorListInjuryWeeks.replace("{weeks}", String(weeks)),
      isHealthy: false,
    };
  }
  return null;
};

const cardStatus = (cardsRaw: unknown, messages: Messages) => {
  const cards = normalizeInjuryLevel(cardsRaw);
  if (cards === null) return null;
  if (cards >= 3) {
    return { display: "🟥", label: messages.sortCards };
  }
  if (cards >= 2) {
    return { display: "🟨🟨", label: messages.sortCards };
  }
  if (cards >= 1) {
    return { display: "🟨", label: messages.sortCards };
  }
  return null;
};

const SKILL_ROWS = [
  { key: "KeeperSkill", maxKey: "KeeperSkillMax", labelKey: "skillKeeper" },
  { key: "DefenderSkill", maxKey: "DefenderSkillMax", labelKey: "skillDefending" },
  { key: "PlaymakerSkill", maxKey: "PlaymakerSkillMax", labelKey: "skillPlaymaking" },
  { key: "WingerSkill", maxKey: "WingerSkillMax", labelKey: "skillWinger" },
  { key: "PassingSkill", maxKey: "PassingSkillMax", labelKey: "skillPassing" },
  { key: "ScorerSkill", maxKey: "ScorerSkillMax", labelKey: "skillScoring" },
  { key: "SetPiecesSkill", maxKey: "SetPiecesSkillMax", labelKey: "skillSetPieces" },
];

function formatName(player: YouthPlayer) {
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

function parseSkillValue(skill: SkillInput): number | null {
  if (skill === null || skill === undefined) return null;
  if (typeof skill === "number") return Number.isFinite(skill) ? skill : null;
  if (typeof skill === "string") {
    const numeric = Number(skill);
    return Number.isNaN(numeric) ? null : numeric;
  }
  const availability = skill["@_IsAvailable"];
  if (typeof availability === "string" && availability !== "True") return null;
  const raw = skill["#text"];
  if (raw === undefined || raw === null) return null;
  const numeric = Number(raw);
  return Number.isNaN(numeric) ? null : numeric;
}

const getSkillLevel = parseSkillValue;
const getSkillMax = parseSkillValue;

function specialtyName(value: number | undefined, messages: Messages) {
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
}

export default function LineupField({
  assignments,
  behaviors,
  playersById,
  playerDetailsById,
  onAssign,
  onClear,
  onMove,
  onChangeBehavior,
  onRandomize,
  onReset,
  onOptimizeSelect,
  tacticType = 7,
  onTacticChange,
  tacticPlacement = "headerRight",
  trainingType = null,
  onTrainingTypeChange,
  onTrainingTypeSet,
  trainingTypeSetPending = false,
  trainingTypeSetPendingValue = null,
  trainingTypeOptions = [],
  trainingTypeLabelForValue,
  trainingTypeSectionTitleForValue,
  trainingTypeAriaLabel,
  optimizeDisabled = false,
  optimizeDisabledReason,
  forceOptimizeOpen = false,
  optimizeStarPlayerName,
  optimizePrimaryTrainingName,
  optimizeSecondaryTrainingName,
  optimizeModeDisabledReasons,
  trainedSlots,
  hiddenSpecialtyByPlayerId = {},
  hiddenSpecialtyMatchHrefByPlayerId = {},
  onHoverPlayer,
  skillMode = "currentMax",
  maxSkillLevel = MAX_SKILL_LEVEL,
  onSelectPlayer,
  messages,
}: LineupFieldProps) {
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [trainingMenuOpen, setTrainingMenuOpen] = useState(false);
  const optimizeButtonRef = useRef<HTMLButtonElement | null>(null);
  const optimizeMenuRef = useRef<HTMLDivElement | null>(null);
  const trainingButtonRef = useRef<HTMLButtonElement | null>(null);
  const trainingMenuRef = useRef<HTMLDivElement | null>(null);
  const isDragActive = useRef(false);

  useEffect(() => {
    if (!optimizeOpen && !trainingMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (optimizeOpen) {
        if (optimizeButtonRef.current?.contains(target ?? null)) return;
        if (optimizeMenuRef.current?.contains(target ?? null)) return;
      }
      if (trainingMenuOpen) {
        if (trainingButtonRef.current?.contains(target ?? null)) return;
        if (trainingMenuRef.current?.contains(target ?? null)) return;
      }
      if (optimizeOpen && !forceOptimizeOpen) setOptimizeOpen(false);
      if (trainingMenuOpen) setTrainingMenuOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [optimizeOpen, trainingMenuOpen, forceOptimizeOpen]);

  const menuOpen = forceOptimizeOpen || optimizeOpen;
  const revealPlayerLabel = optimizeStarPlayerName ?? messages.unknownShort;
  const revealPrimaryLabel = optimizePrimaryTrainingName ?? messages.trainingUnset;
  const revealSecondaryLabel =
    optimizeSecondaryTrainingName ?? messages.trainingUnset;
  const revealPrimaryLabelLower = revealPrimaryLabel.toLocaleLowerCase();
  const revealSecondaryLabelLower = revealSecondaryLabel.toLocaleLowerCase();
  const optimizeStarLabel = messages.optimizeMenuStar.replace(
    "{{player}}",
    revealPlayerLabel
  );
  const revealPrimaryCurrentLabel = messages.optimizeMenuRevealPrimaryCurrent
    .replace("{{player}}", revealPlayerLabel)
    .replace("{{training}}", revealPrimaryLabel)
    .replace("{{trainingLower}}", revealPrimaryLabelLower);
  const revealSecondaryMaxLabel = messages.optimizeMenuRevealSecondaryMax
    .replace("{{player}}", revealPlayerLabel)
    .replace("{{training}}", revealSecondaryLabel)
    .replace("{{trainingLower}}", revealSecondaryLabelLower);
  const revealPrimaryCurrentDisabledReason =
    optimizeModeDisabledReasons?.revealPrimaryCurrent;
  const revealSecondaryMaxDisabledReason =
    optimizeModeDisabledReasons?.revealSecondaryMax;
  const resolvedMaxSkillLevel = Math.max(1, maxSkillLevel);
  const showBottomRightTactic = Boolean(onTacticChange && tacticPlacement === "bottomRight");
  const showFieldTopLeftTactic = Boolean(
    onTacticChange && tacticPlacement === "fieldTopLeft"
  );
  const showTrainingTypeControl = Boolean(
    onTrainingTypeChange && trainingTypeLabelForValue && trainingTypeOptions.length > 0
  );

  const renderTacticControl = (className?: string) => (
    <label className={`${styles.tacticOverlay}${className ? ` ${className}` : ""}`}>
      <span className={styles.tacticLabel}>{messages.tacticLabel}</span>
      <select
        className={styles.tacticSelect}
        value={tacticType}
        onChange={(event) => onTacticChange?.(Number(event.target.value))}
      >
        <option value={0}>{messages.tacticNormal}</option>
        <option value={1}>{messages.tacticPressing}</option>
        <option value={2}>{messages.tacticCounterAttacks}</option>
        <option value={3}>{messages.tacticAttackMiddle}</option>
        <option value={4}>{messages.tacticAttackWings}</option>
        <option value={7}>{messages.tacticPlayCreatively}</option>
        <option value={8}>{messages.tacticLongShots}</option>
      </select>
    </label>
  );

  const renderTrainingTypeControl = () => (
    <div className={styles.lineupTrainingTypeControl}>
      <span className={styles.lineupTrainingTypeLabel}>
        {trainingTypeAriaLabel ?? messages.trainingRegimenLabel}
      </span>
      <div className={styles.feedbackWrap}>
        <button
          type="button"
          className={styles.lineupTrainingTypeTrigger}
          onClick={() => setTrainingMenuOpen((prev) => !prev)}
          ref={trainingButtonRef}
          aria-haspopup="menu"
          aria-expanded={trainingMenuOpen}
        >
          <span className={styles.lineupTrainingTypeValue}>
            {trainingTypeLabelForValue?.(trainingType ?? trainingTypeOptions[0]) ?? ""}
          </span>
        </button>
        {trainingMenuOpen ? (
          <div
            className={`${styles.feedbackMenu} ${styles.lineupTrainingTypeMenu}`}
            ref={trainingMenuRef}
            role="menu"
          >
            {trainingTypeOptions.map((value) => {
              const isActive = value === (trainingType ?? trainingTypeOptions[0]);
              const sectionTitle = trainingTypeSectionTitleForValue?.(value) ?? null;
              return (
                <div key={value}>
                  {sectionTitle ? (
                    <div className={styles.lineupTrainingTypeSectionHeader}>
                      {sectionTitle}
                    </div>
                  ) : null}
                  <div className={styles.lineupTrainingTypeOptionRow}>
                    <div
                      className={`${styles.feedbackLink} ${styles.lineupTrainingTypeOption} ${
                        isActive ? styles.lineupTrainingTypeOptionActive : ""
                      }`}
                      role="presentation"
                    >
                      {trainingTypeLabelForValue?.(value) ?? String(value)}
                    </div>
                    {!isActive ? (
                      <Tooltip content={messages.trainingSetButtonTooltip}>
                        <button
                          type="button"
                          className={styles.lineupTrainingTypeSetButton}
                          disabled={trainingTypeSetPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (trainingTypeSetPending) return;
                            void onTrainingTypeSet?.(value);
                          }}
                        >
                          {trainingTypeSetPending && trainingTypeSetPendingValue === value ? (
                            <span className={styles.spinner} aria-hidden="true" />
                          ) : (
                            messages.trainingSetButtonLabel
                          )}
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderSingleValueMetric = (
    key: string,
    label: string,
    value: number | null,
    maxLevel: number
  ) => {
    const hasValue = value !== null;
    const pct = hasValue ? Math.min(100, (value / maxLevel) * 100) : null;
    return (
      <div key={key} className={styles.skillRow}>
        <div className={styles.skillLabel}>{label}</div>
        <div className={styles.skillBar}>
          {hasValue ? (
            <div
              className={styles.skillFillCurrent}
              style={{
                width: `${pct}%`,
                background: seniorBarGradient(value, 1, maxLevel),
              }}
            />
          ) : null}
        </div>
        <div className={styles.skillValue}>
          {hasValue ? String(value) : messages.unknownShort}
        </div>
      </div>
    );
  };

  const renderTooltipSkills = (skillSource: Record<string, SkillValue> | null) =>
    SKILL_ROWS.map((row) => {
      const current = getSkillLevel(skillSource?.[row.key]);
      const max = getSkillMax(skillSource?.[row.maxKey]);
      const hasCurrent = current !== null;
      const hasMax = max !== null;
      const isMaxed = getSkillMaxReached(skillSource?.[row.key]);
      const currentText = hasCurrent ? String(current) : messages.unknownShort;
      const maxText = hasMax ? String(max) : messages.unknownShort;
      const currentPct = hasCurrent
        ? Math.min(100, (current / resolvedMaxSkillLevel) * 100)
        : null;
      const maxPct = hasMax
        ? Math.min(100, (max / resolvedMaxSkillLevel) * 100)
        : null;

      return (
        <div key={row.key} className={styles.skillRow}>
          <div className={styles.skillLabel}>
            {messages[row.labelKey as keyof Messages]}
          </div>
          <div
            className={`${styles.skillBar} ${
              skillMode !== "single" && isMaxed ? styles.skillBarMaxed : ""
            }`}
          >
            {skillMode !== "single" && hasMax ? (
              <div className={styles.skillFillMax} style={{ width: `${maxPct}%` }} />
            ) : null}
            {hasCurrent ? (
              <div
                className={styles.skillFillCurrent}
                style={
                  skillMode === "single"
                    ? {
                        width: `${currentPct}%`,
                        background: seniorBarGradient(current, 1, resolvedMaxSkillLevel),
                      }
                    : { width: `${currentPct}%` }
                }
              />
            ) : null}
          </div>
          <div className={styles.skillValue}>
            {skillMode === "single" ? currentText : `${currentText}/${maxText}`}
          </div>
        </div>
      );
    });

  const renderTooltipGrid = (
    assignedPlayer: YouthPlayer,
    assignedDetails:
      | {
          PlayerSkills?: Record<string, SkillValue>;
          Form?: SkillInput;
          StaminaSkill?: SkillInput;
        }
      | null
      | undefined
  ) => {
    const skillSource =
      assignedDetails?.PlayerSkills ?? assignedPlayer.PlayerSkills ?? null;
    const rows: ReactElement[] = [];
    if (skillMode === "single") {
      const formValue = parseSkillValue(assignedDetails?.Form ?? assignedPlayer.Form);
      const staminaValue = parseSkillValue(
        assignedDetails?.StaminaSkill ?? skillSource?.StaminaSkill ?? assignedPlayer.StaminaSkill
      );
      rows.push(
        renderSingleValueMetric("form", messages.sortForm, formValue, FORM_MAX_LEVEL)
      );
      rows.push(
        renderSingleValueMetric(
          "stamina",
          messages.sortStamina,
          staminaValue,
          STAMINA_MAX_LEVEL
        )
      );
      rows.push(<div key="senior-divider" className={styles.slotTooltipDivider} />);
    }
    rows.push(...renderTooltipSkills(skillSource));
    return rows;
  };

  const handleOptimizeSelect = (mode: OptimizeMode) => {
    if (!forceOptimizeOpen) {
      setOptimizeOpen(false);
    }
    onOptimizeSelect?.(mode);
  };

  const behaviorLabel = (value: number) => {
    switch (value) {
      case 1:
        return messages.behaviorOffensive;
      case 2:
        return messages.behaviorDefensive;
      case 3:
        return messages.behaviorTowardsMiddle;
      case 4:
        return messages.behaviorTowardsWing;
      default:
        return messages.behaviorNeutral;
    }
  };

  const specialtyForPlayer = (player: YouthPlayer | null) => {
    if (!player) {
      return { value: null as number | null, hidden: false };
    }
    const knownSpecialty = Number(player.Specialty ?? 0);
    const hiddenSpecialty = Number(
      hiddenSpecialtyByPlayerId[player.YouthPlayerID] ?? 0
    );
    if (knownSpecialty > 0) {
      return { value: knownSpecialty, hidden: false };
    }
    if (hiddenSpecialty > 0) {
      return { value: hiddenSpecialty, hidden: true };
    }
    return { value: null as number | null, hidden: false };
  };

  const handleDrop = (slotId: string, event: React.DragEvent) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/json");
    if (raw) {
      try {
        const payload = JSON.parse(raw) as {
          type?: string;
          playerId?: number;
          fromSlot?: string;
        };
        if (payload.type === "slot" && payload.fromSlot && onMove) {
          onMove(payload.fromSlot, slotId);
          return;
        }
        if (payload.type === "player" && payload.playerId) {
          onAssign(slotId, payload.playerId);
          return;
        }
      } catch {
        // fall through to plain text
      }
    }

    const fallback = event.dataTransfer.getData("text/plain");
    const playerId = Number(fallback);
    if (Number.isNaN(playerId)) return;
    onAssign(slotId, playerId);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div className={styles.fieldCard}>
      <div className={styles.fieldHeader}>
        <span>{messages.lineupTitle}</span>
        <div className={styles.fieldHeaderControls}>
          {onTacticChange && !showBottomRightTactic && !showFieldTopLeftTactic
            ? renderTacticControl()
            : null}
          {onOptimizeSelect ? (
            <div className={styles.feedbackWrap}>
              <Tooltip
                content={
                  optimizeDisabled
                    ? optimizeDisabledReason
                    : messages.optimizeLineupTitle
                }
              >
                <button
                  type="button"
                  className={styles.optimizeButton}
                  onClick={() => {
                    if (forceOptimizeOpen) return;
                    setOptimizeOpen((prev) => !prev);
                  }}
                  aria-label={
                    optimizeDisabled
                      ? optimizeDisabledReason
                      : messages.optimizeLineupTitle
                  }
                  disabled={optimizeDisabled}
                  ref={optimizeButtonRef}
                >
                  ✨
                </button>
              </Tooltip>
              {menuOpen ? (
                <div
                  className={styles.feedbackMenu}
                  ref={optimizeMenuRef}
                  data-help-anchor="optimize-menu"
                >
                  <button
                    type="button"
                    className={`${styles.feedbackLink} ${styles.optimizeMenuItem}`}
                    onClick={() => handleOptimizeSelect("star")}
                  >
                    {optimizeStarLabel}
                  </button>
                  <button
                    type="button"
                    className={`${styles.feedbackLink} ${styles.optimizeMenuItem}`}
                    onClick={() => handleOptimizeSelect("ratings")}
                  >
                    {messages.optimizeMenuRatings}
                  </button>
                  <Tooltip
                    content={revealPrimaryCurrentDisabledReason ?? ""}
                    disabled={!revealPrimaryCurrentDisabledReason}
                    fullWidth
                  >
                    <span className={styles.optimizeMenuItemWrap}>
                      <button
                        type="button"
                        className={`${styles.feedbackLink} ${styles.optimizeMenuItem} ${
                          revealPrimaryCurrentDisabledReason
                            ? styles.optimizeMenuItemDisabled
                            : ""
                        }`}
                        onClick={() => handleOptimizeSelect("revealPrimaryCurrent")}
                        disabled={Boolean(revealPrimaryCurrentDisabledReason)}
                        aria-label={
                          revealPrimaryCurrentDisabledReason ??
                          revealPrimaryCurrentLabel
                        }
                      >
                        {revealPrimaryCurrentLabel}
                      </button>
                    </span>
                  </Tooltip>
                  <Tooltip
                    content={revealSecondaryMaxDisabledReason ?? ""}
                    disabled={!revealSecondaryMaxDisabledReason}
                    fullWidth
                  >
                    <span className={styles.optimizeMenuItemWrap}>
                      <button
                        type="button"
                        className={`${styles.feedbackLink} ${styles.optimizeMenuItem} ${
                          revealSecondaryMaxDisabledReason
                            ? styles.optimizeMenuItemDisabled
                            : ""
                        }`}
                        onClick={() => handleOptimizeSelect("revealSecondaryMax")}
                        disabled={Boolean(revealSecondaryMaxDisabledReason)}
                        aria-label={
                          revealSecondaryMaxDisabledReason ??
                          revealSecondaryMaxLabel
                        }
                      >
                        {revealSecondaryMaxLabel}
                      </button>
                    </span>
                  </Tooltip>
                </div>
              ) : null}
            </div>
          ) : null}
          {showTrainingTypeControl ? renderTrainingTypeControl() : null}
        </div>
      </div>
      <div className={styles.fieldPitch}>
        {showFieldTopLeftTactic
          ? renderTacticControl(styles.tacticOverlayFieldTopLeft)
          : null}
        <div className={styles.penaltyBox} />
        <div className={styles.penaltyArc} />
        <div className={styles.fieldGoal}>
          <div className={styles.fieldGoalNet} />
        </div>
        {POSITION_ROWS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`${styles.fieldRow} ${styles[row.className]}`}
          >
            {row.positions.map((position) => {
              const assignedId = assignments[position.id] ?? null;
              const isTrained = trainedSlots?.all?.has(position.id) ?? false;
              const isPrimaryFull =
                trainedSlots?.primaryFull?.has(position.id) ?? false;
              const isSecondaryFull =
                trainedSlots?.secondaryFull?.has(position.id) ?? false;
              const isPrimaryHalf =
                trainedSlots?.primaryHalf?.has(position.id) ?? false;
              const isSecondaryHalf =
                trainedSlots?.secondaryHalf?.has(position.id) ?? false;
              const isHalfOnly =
                !isPrimaryFull &&
                !isSecondaryFull &&
                (isPrimaryHalf || isSecondaryHalf) &&
                !(isPrimaryHalf && isSecondaryHalf);
              const isBothHalf =
                !isPrimaryFull && !isSecondaryFull && isPrimaryHalf && isSecondaryHalf;
              const isBothFull = isPrimaryFull && isSecondaryFull;
              const isPrimaryOnlyFull = isPrimaryFull && !isSecondaryFull;
              const isSecondaryOnlyFull = isSecondaryFull && !isPrimaryFull;
              const assignedPlayer = assignedId
                ? playersById.get(assignedId) ?? null
                : null;
              const assignedDetails = assignedId
                ? playerDetailsById?.get(assignedId) ?? null
                : null;
              const assignedInjuryStatus = injuryStatus(
                assignedDetails?.InjuryLevel ?? assignedPlayer?.InjuryLevel,
                messages
              );
              const assignedCardStatus = cardStatus(
                assignedDetails?.Cards ?? assignedPlayer?.Cards,
                messages
              );
              const behaviorValue = behaviors?.[position.id] ?? 0;
              const behaviorOptions = assignedPlayer
                ? behaviorOptionsForSlot(position.id)
                : [];

              const dragPayload = assignedPlayer
                ? JSON.stringify({
                    type: "slot",
                    playerId: assignedPlayer.YouthPlayerID,
                    fromSlot: position.id,
                  })
                : null;

              return (
                <div
                  key={position.id}
                  className={`${styles.fieldSlot} ${
                    isTrained ? styles.trainedSlot : ""
                  } ${isBothFull ? styles.trainedBothFull : ""} ${
                    isPrimaryOnlyFull ? styles.trainedPrimaryFull : ""
                  } ${isSecondaryOnlyFull ? styles.trainedSecondaryFull : ""} ${
                    isBothHalf ? styles.trainedBothHalf : ""
                  } ${
                    isHalfOnly ? styles.trainedHalf : ""
                  } ${behaviorValue ? styles.fieldSlotHasBehavior : ""}`}
                  onDrop={(event) => handleDrop(position.id, event)}
                  onDragOver={handleDragOver}
                >
                  {assignedPlayer && behaviorOptions.length ? (
                    <>
                      <div className={styles.orientationRing} />
                      {behaviorOptions.map((option) => {
                        const isActive = behaviorValue === option.value;
                        const positionClassMap: Record<
                          BehaviorOption["position"],
                          string
                        > = {
                          top: styles.orientationButtonTop,
                          bottom: styles.orientationButtonBottom,
                          left: styles.orientationButtonLeft,
                          right: styles.orientationButtonRight,
                        };
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.orientationButton} ${
                              positionClassMap[option.position]
                            } ${isActive ? styles.orientationButtonActive : ""}`}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              const nextValue =
                                behaviorValue === option.value ? 0 : option.value;
                              onChangeBehavior?.(position.id, nextValue);
                            }}
                            aria-label={behaviorLabel(option.value)}
                          />
                        );
                      })}
                    </>
                  ) : null}
                  {assignedPlayer ? (
                    <Tooltip
                      content={
                        <div className={styles.slotTooltipCard}>
                          <div className={styles.slotTooltipHint}>
                            {messages.dragPlayerHint}
                          </div>
                          {assignedPlayer.Age !== undefined &&
                          assignedPlayer.AgeDays !== undefined ? (
                            <div className={styles.slotTooltipMeta}>
                              {assignedPlayer.Age}
                              {messages.ageYearsShort} {assignedPlayer.AgeDays}
                              {messages.ageDaysShort}
                            </div>
                          ) : null}
                          <div className={styles.slotTooltipGrid}>
                            {renderTooltipGrid(assignedPlayer, assignedDetails)}
                          </div>
                        </div>
                      }
                      fullWidth
                      withCard={false}
                    >
                      <div
                        className={styles.slotContent}
                        draggable
                        onMouseEnter={() => {
                          if (!assignedPlayer) return;
                          onHoverPlayer?.(assignedPlayer.YouthPlayerID);
                        }}
                        onClick={() => {
                          if (!assignedPlayer) return;
                          if (isDragActive.current) return;
                          void onSelectPlayer?.(assignedPlayer.YouthPlayerID);
                        }}
                        onDragStart={(event) => {
                          if (!dragPayload) return;
                          isDragActive.current = true;
                          setDragGhost(event, {
                            label: formatName(assignedPlayer),
                            className: styles.dragGhost,
                            slotSelector: `.${styles.fieldSlot}`,
                          });
                          event.dataTransfer.setData(
                            "application/json",
                            dragPayload
                          );
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          isDragActive.current = false;
                        }}
                      >
                        <span className={styles.slotName}>
                          {formatName(assignedPlayer)}
                        </span>
                        {assignedInjuryStatus ? (
                          <span
                            className={
                              assignedInjuryStatus.isHealthy
                                ? styles.matrixInjuryHealthy
                                : styles.matrixInjuryStatus
                            }
                            title={assignedInjuryStatus.label}
                          >
                            {assignedInjuryStatus.display}
                          </span>
                        ) : null}
                        {(() => {
                          const specialty = specialtyForPlayer(assignedPlayer);
                          if (!specialty.value) return null;
                          const label =
                            specialtyName(specialty.value, messages) ??
                            messages.specialtyLabel;
                          const hiddenSpecialtyHref =
                            specialty.hidden && assignedPlayer
                              ? hiddenSpecialtyMatchHrefByPlayerId[
                                  assignedPlayer.YouthPlayerID
                                ]
                              : undefined;
                          return (
                            <Tooltip
                              content={
                                specialty.hidden
                                  ? `${messages.hiddenSpecialtyTooltip}: ${label} (${messages.hiddenSpecialtyTooltipLinkHint})`
                                  : label
                              }
                            >
                              {hiddenSpecialtyHref ? (
                                <a
                                  className={styles.specialtyDiscoveryLink}
                                  href={hiddenSpecialtyHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <span
                                    className={`${styles.slotEmoji} ${
                                      specialty.hidden ? styles.hiddenSpecialtyBadge : ""
                                    }`}
                                  >
                                    {SPECIALTY_EMOJI[specialty.value]}
                                  </span>
                                </a>
                              ) : (
                                <span
                                  className={`${styles.slotEmoji} ${
                                    specialty.hidden ? styles.hiddenSpecialtyBadge : ""
                                  }`}
                                >
                                  {SPECIALTY_EMOJI[specialty.value]}
                                </span>
                              )}
                            </Tooltip>
                          );
                        })()}
                        {skillMode === "single" && assignedCardStatus ? (
                          <span
                            className={styles.slotCardStatus}
                            title={assignedCardStatus.label}
                            aria-label={assignedCardStatus.label}
                          >
                            {assignedCardStatus.display}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className={styles.slotClear}
                          onClick={(event) => {
                            event.stopPropagation();
                            onClear(position.id);
                          }}
                          aria-label={`${messages.clearSlot} ${position.label}`}
                        >
                          ×
                        </button>
                      </div>
                    </Tooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
        <div className={styles.centerCircle} />
        <div className={styles.centerSpot} />
        <div className={styles.fieldMidline} />
        {onRandomize || onReset || showBottomRightTactic ? (
          <div className={styles.lineupActions}>
            {onReset ? (
              <button
                type="button"
                className={styles.lineupButtonSecondary}
                onClick={onReset}
              >
                {messages.resetLineup}
              </button>
            ) : null}
            {onRandomize ? (
              <button
                type="button"
                className={styles.lineupButton}
                onClick={onRandomize}
              >
                {messages.randomizeLineup}
              </button>
            ) : null}
            {showBottomRightTactic
              ? renderTacticControl(styles.tacticOverlayBottomRight)
              : null}
          </div>
        ) : null}
      </div>
      <div className={styles.benchArea}>
        {BENCH_SLOTS.map((slot) => {
          const assignedId = assignments[slot.id] ?? null;
          const assignedPlayer = assignedId
            ? playersById.get(assignedId) ?? null
            : null;
          const assignedDetails = assignedId
            ? playerDetailsById?.get(assignedId) ?? null
            : null;
          const assignedInjuryStatus = injuryStatus(
            assignedDetails?.InjuryLevel ?? assignedPlayer?.InjuryLevel,
            messages
          );
          const assignedCardStatus = cardStatus(
            assignedDetails?.Cards ?? assignedPlayer?.Cards,
            messages
          );
          const dragPayload = assignedPlayer
            ? JSON.stringify({
                type: "slot",
                playerId: assignedPlayer.YouthPlayerID,
                fromSlot: slot.id,
              })
            : null;
          return (
            <div key={slot.id} className={styles.benchSlotWrapper}>
              <div
                className={styles.fieldSlot}
                onDrop={(event) => handleDrop(slot.id, event)}
                onDragOver={handleDragOver}
              >
                {assignedPlayer ? (
                  <Tooltip
                    content={
                      <div className={styles.slotTooltipCard}>
                        <div className={styles.slotTooltipHint}>
                          {messages.dragPlayerHint}
                        </div>
                        {assignedPlayer.Age !== undefined &&
                        assignedPlayer.AgeDays !== undefined ? (
                          <div className={styles.slotTooltipMeta}>
                            {assignedPlayer.Age}
                            {messages.ageYearsShort} {assignedPlayer.AgeDays}
                            {messages.ageDaysShort}
                          </div>
                        ) : null}
                        <div className={styles.slotTooltipGrid}>
                          {renderTooltipGrid(assignedPlayer, assignedDetails)}
                        </div>
                      </div>
                    }
                    fullWidth
                    withCard={false}
                  >
                    <div
                      className={styles.slotContent}
                      draggable
                      onMouseEnter={() => {
                        if (!assignedPlayer) return;
                        onHoverPlayer?.(assignedPlayer.YouthPlayerID);
                      }}
                      onClick={() => {
                        if (!assignedPlayer) return;
                        if (isDragActive.current) return;
                        void onSelectPlayer?.(assignedPlayer.YouthPlayerID);
                      }}
                      onDragStart={(event) => {
                        if (!dragPayload) return;
                        isDragActive.current = true;
                        setDragGhost(event, {
                          label: formatName(assignedPlayer),
                          className: styles.dragGhost,
                          slotSelector: `.${styles.fieldSlot}`,
                        });
                        event.dataTransfer.setData(
                          "application/json",
                          dragPayload
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        isDragActive.current = false;
                      }}
                    >
                      <span className={styles.slotName}>
                        {formatName(assignedPlayer)}
                      </span>
                      {assignedInjuryStatus ? (
                        <span
                          className={
                            assignedInjuryStatus.isHealthy
                              ? styles.matrixInjuryHealthy
                              : styles.matrixInjuryStatus
                          }
                          title={assignedInjuryStatus.label}
                        >
                          {assignedInjuryStatus.display}
                        </span>
                      ) : null}
                        {(() => {
                          const specialty = specialtyForPlayer(assignedPlayer);
                          if (!specialty.value) return null;
                          const label =
                            specialtyName(specialty.value, messages) ??
                            messages.specialtyLabel;
                          const hiddenSpecialtyHref =
                            specialty.hidden && assignedPlayer
                              ? hiddenSpecialtyMatchHrefByPlayerId[
                                  assignedPlayer.YouthPlayerID
                                ]
                              : undefined;
                          return (
                            <Tooltip
                              content={
                                specialty.hidden
                                  ? `${messages.hiddenSpecialtyTooltip}: ${label} (${messages.hiddenSpecialtyTooltipLinkHint})`
                                  : label
                              }
                            >
                              {hiddenSpecialtyHref ? (
                                <a
                                  className={styles.specialtyDiscoveryLink}
                                  href={hiddenSpecialtyHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <span
                                    className={`${styles.slotEmoji} ${
                                      specialty.hidden ? styles.hiddenSpecialtyBadge : ""
                                    }`}
                                  >
                                    {SPECIALTY_EMOJI[specialty.value]}
                                  </span>
                                </a>
                              ) : (
                                <span
                                  className={`${styles.slotEmoji} ${
                                    specialty.hidden ? styles.hiddenSpecialtyBadge : ""
                                  }`}
                                >
                                  {SPECIALTY_EMOJI[specialty.value]}
                                </span>
                              )}
                            </Tooltip>
                          );
                        })()}
                      {skillMode === "single" && assignedCardStatus ? (
                        <span
                          className={styles.slotCardStatus}
                          title={assignedCardStatus.label}
                          aria-label={assignedCardStatus.label}
                        >
                          {assignedCardStatus.display}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className={styles.slotClear}
                        onClick={(event) => {
                          event.stopPropagation();
                          onClear(slot.id);
                        }}
                        aria-label={`${messages.clearSlot} ${
                          messages[slot.labelKey as keyof Messages]
                        }`}
                      >
                        ×
                      </button>
                    </div>
                  </Tooltip>
                ) : null}
              </div>
              <span className={styles.benchLabel}>
                {messages[slot.labelKey as keyof Messages]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
