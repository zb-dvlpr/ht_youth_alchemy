"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import type { Messages } from "@/lib/i18n";
import type { SeniorPlayerMetricInput } from "@/lib/seniorPlayerMetrics";
import { YOUTUBE_HELP_URLS } from "@/lib/youtubeHelpVideos";
import styles from "../page.module.css";
import SeniorFoxtrickMetrics from "./SeniorFoxtrickMetrics";
import Tooltip from "./Tooltip";
import YouTubeLink from "./youtube/YouTubeLink";
import {
  getDisplayCurrencyLabel,
  SEK_DISPLAY_CURRENCY,
  type DisplayCurrency,
} from "@/lib/currency";

const HATTRICK_AGE_DAYS_PER_YEAR = 112;
const FORM_MAX_LEVEL = 8;
const STAMINA_MAX_LEVEL = 9;
const SENIOR_SKILL_MAX_LEVEL = 20;
const SIMULATION_MAX_WAGE_DISPLAY = 100_000_000;
const SIMULATION_MAX_TSI = 10_000_000;

type SimulatedValues = {
  ageYears: number;
  ageDays: number;
  wageDisplay: number;
  tsi: number;
  form: number;
  stamina: number;
  keeper: number;
  defending: number;
  playmaking: number;
  winger: number;
  passing: number;
  scoring: number;
  setPieces: number;
};

type SimulationControlDraft = {
  ageYears: string;
  ageDays: string;
  wageDisplay: string;
  tsi: string;
};

type SimulationSkillKey = Exclude<
  keyof SimulatedValues,
  "ageYears" | "ageDays" | "wageDisplay" | "tsi"
>;

type SimulationSkillDefinition = {
  key: SimulationSkillKey;
  inputKey: keyof SeniorPlayerMetricInput;
  labelKey: keyof Messages;
  min: number;
  max: number;
};

const FORM_STAMINA_ROWS: SimulationSkillDefinition[] = [
  { key: "form", inputKey: "form", labelKey: "sortForm", min: 1, max: FORM_MAX_LEVEL },
  {
    key: "stamina",
    inputKey: "stamina",
    labelKey: "sortStamina",
    min: 1,
    max: STAMINA_MAX_LEVEL,
  },
];

const SKILL_ROWS: SimulationSkillDefinition[] = [
  {
    key: "keeper",
    inputKey: "keeper",
    labelKey: "skillKeeper",
    min: 0,
    max: SENIOR_SKILL_MAX_LEVEL,
  },
  {
    key: "defending",
    inputKey: "defending",
    labelKey: "skillDefending",
    min: 0,
    max: SENIOR_SKILL_MAX_LEVEL,
  },
  {
    key: "playmaking",
    inputKey: "playmaking",
    labelKey: "skillPlaymaking",
    min: 0,
    max: SENIOR_SKILL_MAX_LEVEL,
  },
  {
    key: "winger",
    inputKey: "winger",
    labelKey: "skillWinger",
    min: 0,
    max: SENIOR_SKILL_MAX_LEVEL,
  },
  {
    key: "passing",
    inputKey: "passing",
    labelKey: "skillPassing",
    min: 0,
    max: SENIOR_SKILL_MAX_LEVEL,
  },
  {
    key: "scoring",
    inputKey: "scoring",
    labelKey: "skillScoring",
    min: 0,
    max: SENIOR_SKILL_MAX_LEVEL,
  },
  {
    key: "setPieces",
    inputKey: "setPieces",
    labelKey: "skillSetPieces",
    min: 0,
    max: SENIOR_SKILL_MAX_LEVEL,
  },
];

type SeniorFoxtrickSimulatorProps = {
  input: SeniorPlayerMetricInput;
  messages: Messages;
  displayCurrency?: DisplayCurrency;
  loyalty?: number | null;
  motherClubBonus?: boolean;
  editingBlocked?: boolean;
  onBlockedInteraction?: () => void;
  onEditingToggleInteraction?: () => void;
  onSimulationStateChange?: (state: {
    editing: boolean;
    dirty: boolean;
    metricInput: SeniorPlayerMetricInput;
  }) => void;
  barGradient: (
    value: number | null,
    minSkillLevel: number,
    maxSkillLevel: number
  ) => string | undefined;
};

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;

const normalizeAgeParts = (years: number | null, days: number | null) => ({
  ageYears:
    typeof years === "number" && Number.isFinite(years)
      ? Math.max(17, Math.round(years))
      : 17,
  ageDays:
    typeof days === "number" && Number.isFinite(days)
      ? Math.min(
          HATTRICK_AGE_DAYS_PER_YEAR - 1,
          Math.max(0, Math.round(days))
        )
      : 0,
});

const valueFromInput = (
  input: SeniorPlayerMetricInput,
  key: keyof SeniorPlayerMetricInput,
  min: number,
  max: number
) => {
  const value = input[key];
  return typeof value === "number" ? clamp(value, min, max) : min;
};

const formatSkillBonusDelta = (value: number) => {
  if (!Number.isFinite(value)) return "+0";
  const trimmed = value.toFixed(2).replace(/\.?0+$/, "");
  return `+${trimmed}`;
};

const buildInitialValues = (
  input: SeniorPlayerMetricInput,
  displayCurrencyRate: number
): SimulatedValues => {
  const age = normalizeAgeParts(input.ageYears, input.ageDays);
  return {
    ...age,
    wageDisplay:
      typeof input.salarySek === "number"
        ? clamp(input.salarySek / displayCurrencyRate, 0, SIMULATION_MAX_WAGE_DISPLAY)
        : 0,
    tsi: valueFromInput(input, "tsi", 0, SIMULATION_MAX_TSI),
    form: valueFromInput(input, "form", 1, FORM_MAX_LEVEL),
    stamina: valueFromInput(input, "stamina", 1, STAMINA_MAX_LEVEL),
    keeper: valueFromInput(input, "keeper", 0, SENIOR_SKILL_MAX_LEVEL),
    defending: valueFromInput(input, "defending", 0, SENIOR_SKILL_MAX_LEVEL),
    playmaking: valueFromInput(input, "playmaking", 0, SENIOR_SKILL_MAX_LEVEL),
    winger: valueFromInput(input, "winger", 0, SENIOR_SKILL_MAX_LEVEL),
    passing: valueFromInput(input, "passing", 0, SENIOR_SKILL_MAX_LEVEL),
    scoring: valueFromInput(input, "scoring", 0, SENIOR_SKILL_MAX_LEVEL),
    setPieces: valueFromInput(input, "setPieces", 0, SENIOR_SKILL_MAX_LEVEL),
  };
};

const buildControlDraft = (values: SimulatedValues): SimulationControlDraft => ({
  ageYears: String(values.ageYears),
  ageDays: String(values.ageDays),
  wageDisplay: String(values.wageDisplay),
  tsi: String(values.tsi),
});

const numericDraftValue = (value: string) => value.replace(/\D/g, "");

const parseDraftNumber = (value: string) => (value === "" ? null : Number(value));

export default function SeniorFoxtrickSimulator({
  input,
  messages,
  displayCurrency = SEK_DISPLAY_CURRENCY,
  loyalty = null,
  motherClubBonus = false,
  editingBlocked = false,
  onBlockedInteraction,
  onEditingToggleInteraction,
  onSimulationStateChange,
  barGradient,
}: SeniorFoxtrickSimulatorProps) {
  const displayCurrencyRate =
    Number.isFinite(displayCurrency.currencyRate) && displayCurrency.currencyRate > 0
      ? displayCurrency.currencyRate
      : SEK_DISPLAY_CURRENCY.currencyRate;
  const wageInputLabel = messages.seniorFoxtrickSimulationWageLabel.replace(
    "{{currency}}",
    getDisplayCurrencyLabel(displayCurrency)
  );
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [values, setValues] = useState<SimulatedValues>(() =>
    buildInitialValues(input, displayCurrencyRate)
  );
  const [controlDraft, setControlDraft] = useState<SimulationControlDraft>(() =>
    buildControlDraft(buildInitialValues(input, displayCurrencyRate))
  );
  const activeSkillPointerIdRef = useRef<number | null>(null);
  const editingEnabled = !editingBlocked && editing;
  const effectiveDirty = editingEnabled && dirty;

  const metricInput = useMemo<SeniorPlayerMetricInput>(() => {
    if (!editingEnabled) return input;
    return {
      ...input,
      ageYears: values.ageYears,
      ageDays: values.ageDays,
      tsi: values.tsi,
      salarySek: values.wageDisplay * displayCurrencyRate,
      form: values.form,
      stamina: values.stamina,
      keeper: values.keeper,
      defending: values.defending,
      playmaking: values.playmaking,
      winger: values.winger,
      passing: values.passing,
      scoring: values.scoring,
      setPieces: values.setPieces,
    };
  }, [displayCurrencyRate, editingEnabled, input, values]);

  useEffect(() => {
    onSimulationStateChange?.({
      editing: editingEnabled,
      dirty: effectiveDirty,
      metricInput,
    });
  }, [editingEnabled, effectiveDirty, metricInput, onSimulationStateChange]);

  const updateValue = (key: keyof SimulatedValues, value: number) => {
    setDirty(true);
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateAge = (patch: Partial<Pick<SimulatedValues, "ageYears" | "ageDays">>) => {
    setDirty(true);
    setValues((prev) => {
      const age = normalizeAgeParts(
        patch.ageYears ?? prev.ageYears,
        patch.ageDays ?? prev.ageDays
      );
      return {
        ...prev,
        ...age,
      };
    });
  };

  const updateAgeDraft = (key: "ageYears" | "ageDays", rawValue: string) => {
    const nextDraftValue = numericDraftValue(rawValue);
    setControlDraft((prev) => ({
      ...prev,
      [key]: nextDraftValue,
    }));

    const parsed = parseDraftNumber(nextDraftValue);
    if (parsed === null) return;

    if (key === "ageYears") {
      if (!Number.isFinite(parsed) || parsed < 17) return;
      setDirty(true);
      setValues((prev) => ({
        ...prev,
        ageYears: Math.round(parsed),
      }));
      return;
    }

    if (
      !Number.isFinite(parsed) ||
      parsed < 0 ||
      parsed > HATTRICK_AGE_DAYS_PER_YEAR - 1
    ) {
      return;
    }
    updateAge({ ageDays: Math.round(parsed) });
  };

  const commitAgeDraft = (key: "ageYears" | "ageDays") => {
    const parsed = parseDraftNumber(controlDraft[key]);
    const age =
      key === "ageYears"
        ? normalizeAgeParts(parsed, values.ageDays)
        : normalizeAgeParts(values.ageYears, parsed);
    setValues((prev) => ({
      ...prev,
      ...age,
    }));
    setControlDraft((prev) => ({
      ...prev,
      ageYears: String(age.ageYears),
      ageDays: String(age.ageDays),
    }));
  };

  const updateBoundedDraft = (
    key: "wageDisplay" | "tsi",
    rawValue: string,
    min: number,
    max: number
  ) => {
    const nextDraftValue = numericDraftValue(rawValue);
    setControlDraft((prev) => ({
      ...prev,
      [key]: nextDraftValue,
    }));

    const parsed = parseDraftNumber(nextDraftValue);
    if (parsed === null) return;
    updateValue(key, clamp(parsed, min, max));
  };

  const commitBoundedDraft = (key: "wageDisplay" | "tsi", min: number, max: number) => {
    const parsed = parseDraftNumber(controlDraft[key]);
    const nextValue = clamp(parsed ?? values[key], min, max);
    updateValue(key, nextValue);
    setControlDraft((prev) => ({
      ...prev,
      [key]: String(nextValue),
    }));
  };

  const toggleEditing = (enabled: boolean) => {
    const nextValues = buildInitialValues(input, displayCurrencyRate);
    activeSkillPointerIdRef.current = null;
    setEditing(enabled);
    setDirty(false);
    setValues(nextValues);
    setControlDraft(buildControlDraft(nextValues));
  };

  const valueFromPointer = (
    event: PointerEvent<HTMLDivElement>,
    min: number,
    max: number
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    return clamp(min + ratio * (max - min), min, max);
  };

  const updateSkillFromPointer = (
    event: PointerEvent<HTMLDivElement>,
    definition: SimulationSkillDefinition
  ) => {
    updateValue(
      definition.key,
      valueFromPointer(event, definition.min, definition.max)
    );
  };

  const finishSkillPointerInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (activeSkillPointerIdRef.current !== event.pointerId) {
      return;
    }

    activeSkillPointerIdRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSkillKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    definition: SimulationSkillDefinition,
    value: number
  ) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      updateValue(definition.key, clamp(value - 1, definition.min, definition.max));
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      updateValue(definition.key, clamp(value + 1, definition.min, definition.max));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      updateValue(definition.key, definition.min);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      updateValue(definition.key, definition.max);
    }
  };

  const renderSkillRow = (definition: SimulationSkillDefinition) => {
    const value = editingEnabled
      ? values[definition.key]
      : typeof input[definition.inputKey] === "number"
        ? (input[definition.inputKey] as number)
        : null;
    const pct = value !== null ? Math.min(100, (value / definition.max) * 100) : null;
    const bonus =
      !editingEnabled && value !== null && definition.max === SENIOR_SKILL_MAX_LEVEL
        ? motherClubBonus
          ? Math.min(1.5, SENIOR_SKILL_MAX_LEVEL - value)
          : Math.min(Math.max(0, loyalty ?? 0) / 20, SENIOR_SKILL_MAX_LEVEL - value)
        : 0;
    const bonusPct =
      value !== null && pct !== null && bonus > 0
        ? Math.min(100, ((value + bonus) / definition.max) * 100) - pct
        : 0;
    const bonusTooltip =
      bonus > 0
        ? `${
            motherClubBonus
              ? messages.skillBonusMotherClubTooltip
              : messages.skillBonusLoyaltyTooltip
          } (${formatSkillBonusDelta(bonus)})`
        : null;
    return (
      <div key={definition.key} className={styles.skillRow}>
        <div className={styles.skillLabel}>{messages[definition.labelKey] as string}</div>
        <div
          className={`${styles.skillBar} ${editingEnabled ? styles.simulationEditableSkillBar : ""}`}
          role={editingEnabled ? "slider" : undefined}
          tabIndex={editingEnabled ? 0 : undefined}
          aria-label={editingEnabled ? (messages[definition.labelKey] as string) : undefined}
          aria-valuemin={editingEnabled ? definition.min : undefined}
          aria-valuemax={editingEnabled ? definition.max : undefined}
          aria-valuenow={editingEnabled ? (value ?? definition.min) : undefined}
          onPointerDown={
            editingEnabled
              ? (event) => {
                  if (
                    !event.isPrimary ||
                    event.button !== 0 ||
                    activeSkillPointerIdRef.current !== null
                  ) {
                    return;
                  }

                  event.preventDefault();
                  event.currentTarget.focus({ preventScroll: true });

                  activeSkillPointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateSkillFromPointer(event, definition);
                }
              : undefined
          }
          onPointerMove={
            editingEnabled
              ? (event) => {
                  if (activeSkillPointerIdRef.current !== event.pointerId) {
                    return;
                  }

                  updateSkillFromPointer(event, definition);
                }
              : undefined
          }
          onPointerUp={
            editingEnabled
              ? (event) => finishSkillPointerInteraction(event)
              : undefined
          }
          onPointerCancel={
            editingEnabled
              ? (event) => finishSkillPointerInteraction(event)
              : undefined
          }
          onLostPointerCapture={
            editingEnabled
              ? (event) => {
                  if (activeSkillPointerIdRef.current === event.pointerId) {
                    activeSkillPointerIdRef.current = null;
                  }
                }
              : undefined
          }
          onDragStart={
            editingEnabled ? (event) => event.preventDefault() : undefined
          }
          onKeyDown={
            editingEnabled
              ? (event) =>
                  handleSkillKeyDown(event, definition, value ?? definition.min)
              : undefined
          }
        >
          {editingEnabled ? (
            <>
              <div
                className={styles.skillFillCurrent}
                style={{
                  width: `${pct ?? 0}%`,
                  background: barGradient(value, definition.min, definition.max),
                }}
              />
              <span
                className={styles.simulationSkillHandle}
                style={{ left: `${pct ?? 0}%` }}
                aria-hidden="true"
              />
            </>
          ) : pct !== null ? (
            <>
              <div
                className={styles.skillFillCurrent}
                style={{
                  width: `${pct}%`,
                  background: barGradient(value, definition.min, definition.max),
                }}
              />
              {bonusPct > 0 && bonusTooltip ? (
                <Tooltip content={bonusTooltip} followCursor offset={8}>
                  <span
                    className={styles.skillFillBonusTrigger}
                    style={{
                      left: `${pct}%`,
                      width: `${bonusPct}%`,
                    }}
                  >
                    <span className={styles.skillFillBonusHatched} />
                  </span>
                </Tooltip>
              ) : null}
            </>
          ) : null}
        </div>
        <div className={styles.skillValue}>
          <span className={styles.skillValuePartWithFlag}>
            <span>{value ?? messages.unknownShort}</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.skillsGrid}>
        {FORM_STAMINA_ROWS.map((definition) => renderSkillRow(definition))}
      </div>

      <div className={styles.sectionDivider} />

      <div>
        <div className={styles.sectionHeadingRow}>
          <h5 className={styles.sectionHeading}>{messages.skillsLabel}</h5>
          <div className={styles.seniorSimulationHeadingActions}>
            <Tooltip
              content={
                editingBlocked
                  ? messages.seniorFoxtrickSimulationPremiumTooltip
                  : messages.seniorFoxtrickSimulationTooltip
              }
            >
              <label className={styles.simulationToggle}>
                <input
                  className={styles.simulationToggleInput}
                  type="checkbox"
                  checked={editingEnabled}
                  onChange={(event) => {
                    onEditingToggleInteraction?.();
                    if (editingBlocked) {
                      event.preventDefault();
                      onBlockedInteraction?.();
                      return;
                    }
                    toggleEditing(event.currentTarget.checked);
                  }}
                />
                <span className={styles.simulationToggleTrack} aria-hidden="true">
                  <span className={styles.simulationToggleThumb} />
                </span>
                <span>{messages.seniorFoxtrickEditSkillsLabel}</span>
              </label>
            </Tooltip>
            <YouTubeLink
              url={YOUTUBE_HELP_URLS.seniorEditSkillsAgeWageTsi}
              label={messages.youtubeSeniorEditSkillsAgeWageTsiVideo}
              iconOnly
              mode="player"
              className={styles.seniorSimulationVideoLink}
            />
          </div>
        </div>

        {editingEnabled ? (
          <div className={styles.simulationControls}>
            <div className={styles.simulationControlGroup}>
              <label className={styles.simulationControlLabel}>
                <span>{messages.seniorFoxtrickSimulationAgeYearsLabel}</span>
                <input
                  className={`${styles.transferSearchInput} ${styles.simulationControlInput}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={controlDraft.ageYears}
                  onChange={(event) => updateAgeDraft("ageYears", event.currentTarget.value)}
                  onBlur={() => commitAgeDraft("ageYears")}
                />
              </label>
              <label className={styles.simulationControlLabel}>
                <span>{messages.seniorFoxtrickSimulationAgeDaysLabel}</span>
                <input
                  className={`${styles.transferSearchInput} ${styles.simulationControlInput}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={controlDraft.ageDays}
                  onChange={(event) => updateAgeDraft("ageDays", event.currentTarget.value)}
                  onBlur={() => commitAgeDraft("ageDays")}
                />
              </label>
              <label className={styles.simulationControlLabel}>
                <span>{wageInputLabel}</span>
                <input
                  className={`${styles.transferSearchInput} ${styles.simulationControlInput}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={controlDraft.wageDisplay}
                  onChange={(event) =>
                    updateBoundedDraft(
                      "wageDisplay",
                      event.currentTarget.value,
                      0,
                      SIMULATION_MAX_WAGE_DISPLAY
                    )
                  }
                  onBlur={() => commitBoundedDraft("wageDisplay", 0, SIMULATION_MAX_WAGE_DISPLAY)}
                />
              </label>
              <label className={styles.simulationControlLabel}>
                <span>{messages.sortTsi}</span>
                <input
                  className={`${styles.transferSearchInput} ${styles.simulationControlInput}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={controlDraft.tsi}
                  onChange={(event) =>
                    updateBoundedDraft("tsi", event.currentTarget.value, 0, SIMULATION_MAX_TSI)
                  }
                  onBlur={() => commitBoundedDraft("tsi", 0, SIMULATION_MAX_TSI)}
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className={styles.skillsGrid}>
          {SKILL_ROWS.map((definition) => renderSkillRow(definition))}
        </div>
        {editingEnabled && effectiveDirty ? (
          <p className={styles.simulationWarning}>
            <span className={styles.simulationWarningIcon} aria-hidden="true">
              ⚠
            </span>
            <span>{messages.seniorFoxtrickSimulationWarning}</span>
          </p>
        ) : null}
      </div>

      <div className={styles.sectionDivider} />

      <SeniorFoxtrickMetrics input={metricInput} messages={messages} />
    </>
  );
}
