"use client";

import { useMemo, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

import type { Messages } from "@/lib/i18n";
import type { SeniorPlayerMetricInput } from "@/lib/seniorPlayerMetrics";
import styles from "../page.module.css";
import SeniorFoxtrickMetrics from "./SeniorFoxtrickMetrics";
import Tooltip from "./Tooltip";

const HATTRICK_AGE_DAYS_PER_YEAR = 112;
const CHPP_SEK_PER_EUR = 10;
const FORM_MAX_LEVEL = 8;
const STAMINA_MAX_LEVEL = 9;
const SENIOR_SKILL_MAX_LEVEL = 20;
const SIMULATION_MIN_AGE_DAYS = 17 * HATTRICK_AGE_DAYS_PER_YEAR;
const SIMULATION_MAX_AGE_DAYS = 28 * HATTRICK_AGE_DAYS_PER_YEAR;
const SIMULATION_MAX_WAGE_EUR = 100_000_000;
const SIMULATION_MAX_TSI = 10_000_000;

type SimulatedValues = {
  ageYears: number;
  ageDays: number;
  wageEur: number;
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

type SimulationSkillKey = Exclude<
  keyof SimulatedValues,
  "ageYears" | "ageDays" | "wageEur" | "tsi"
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
  loyalty?: number | null;
  motherClubBonus?: boolean;
  barGradient: (
    value: number | null,
    minSkillLevel: number,
    maxSkillLevel: number
  ) => string | undefined;
};

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;

const clampAgeTotalDays = (years: number | null, days: number | null) => {
  const totalDays =
    (typeof years === "number" ? years : 17) * HATTRICK_AGE_DAYS_PER_YEAR +
    Math.max(0, typeof days === "number" ? days : 0);
  return clamp(totalDays, SIMULATION_MIN_AGE_DAYS, SIMULATION_MAX_AGE_DAYS);
};

const agePartsFromTotalDays = (totalDays: number) => ({
  ageYears: Math.floor(totalDays / HATTRICK_AGE_DAYS_PER_YEAR),
  ageDays: totalDays % HATTRICK_AGE_DAYS_PER_YEAR,
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

const buildInitialValues = (input: SeniorPlayerMetricInput): SimulatedValues => {
  const age = agePartsFromTotalDays(clampAgeTotalDays(input.ageYears, input.ageDays));
  return {
    ...age,
    wageEur:
      typeof input.salarySek === "number"
        ? clamp(input.salarySek / CHPP_SEK_PER_EUR, 0, SIMULATION_MAX_WAGE_EUR)
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

export default function SeniorFoxtrickSimulator({
  input,
  messages,
  loyalty = null,
  motherClubBonus = false,
  barGradient,
}: SeniorFoxtrickSimulatorProps) {
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [values, setValues] = useState<SimulatedValues>(() => buildInitialValues(input));

  const metricInput = useMemo<SeniorPlayerMetricInput>(() => {
    if (!editing) return input;
    return {
      ...input,
      ageYears: values.ageYears,
      ageDays: values.ageDays,
      tsi: values.tsi,
      salarySek: values.wageEur * CHPP_SEK_PER_EUR,
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
  }, [editing, input, values]);

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
      const totalDays = clampAgeTotalDays(
        patch.ageYears ?? prev.ageYears,
        patch.ageDays ?? prev.ageDays
      );
      return {
        ...prev,
        ...agePartsFromTotalDays(totalDays),
      };
    });
  };

  const toggleEditing = (enabled: boolean) => {
    setEditing(enabled);
    setDirty(false);
    setValues(buildInitialValues(input));
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
    const value = editing
      ? values[definition.key]
      : typeof input[definition.inputKey] === "number"
        ? (input[definition.inputKey] as number)
        : null;
    const pct = value !== null ? Math.min(100, (value / definition.max) * 100) : null;
    const bonus =
      !editing && value !== null && definition.max === SENIOR_SKILL_MAX_LEVEL
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
          className={`${styles.skillBar} ${editing ? styles.simulationEditableSkillBar : ""}`}
          role={editing ? "slider" : undefined}
          tabIndex={editing ? 0 : undefined}
          aria-label={editing ? (messages[definition.labelKey] as string) : undefined}
          aria-valuemin={editing ? definition.min : undefined}
          aria-valuemax={editing ? definition.max : undefined}
          aria-valuenow={editing ? (value ?? definition.min) : undefined}
          onPointerDown={
            editing
              ? (event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateSkillFromPointer(event, definition);
                }
              : undefined
          }
          onPointerMove={
            editing
              ? (event) => {
                  if (event.buttons === 1) {
                    updateSkillFromPointer(event, definition);
                  }
                }
              : undefined
          }
          onKeyDown={
            editing
              ? (event) =>
                  handleSkillKeyDown(event, definition, value ?? definition.min)
              : undefined
          }
        >
          {editing ? (
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
          <Tooltip content={messages.seniorFoxtrickSimulationTooltip}>
            <label className={styles.simulationToggle}>
              <input
                className={styles.simulationToggleInput}
                type="checkbox"
                checked={editing}
                onChange={(event) => toggleEditing(event.currentTarget.checked)}
              />
              <span className={styles.simulationToggleTrack} aria-hidden="true">
                <span className={styles.simulationToggleThumb} />
              </span>
              <span>{messages.seniorFoxtrickEditSkillsLabel}</span>
            </label>
          </Tooltip>
        </div>

        {editing ? (
          <div className={styles.simulationControls}>
            <div className={styles.simulationControlGroup}>
              <label className={styles.simulationControlLabel}>
                <span>{messages.seniorFoxtrickSimulationAgeYearsLabel}</span>
                <input
                  className={styles.transferSearchInput}
                  type="number"
                  min={17}
                  max={28}
                  step={1}
                  value={values.ageYears}
                  onChange={(event) => updateAge({ ageYears: Number(event.currentTarget.value) })}
                />
              </label>
              <label className={styles.simulationControlLabel}>
                <span>{messages.seniorFoxtrickSimulationAgeDaysLabel}</span>
                <input
                  className={styles.transferSearchInput}
                  type="number"
                  min={0}
                  max={values.ageYears >= 28 ? 0 : HATTRICK_AGE_DAYS_PER_YEAR - 1}
                  step={1}
                  value={values.ageDays}
                  onChange={(event) => updateAge({ ageDays: Number(event.currentTarget.value) })}
                />
              </label>
              <label className={styles.simulationControlLabel}>
                <span>{messages.seniorFoxtrickSimulationWageLabel}</span>
                <input
                  className={styles.transferSearchInput}
                  type="number"
                  min={0}
                  max={SIMULATION_MAX_WAGE_EUR}
                  step={1000}
                  value={values.wageEur}
                  onChange={(event) =>
                    updateValue(
                      "wageEur",
                      clamp(Number(event.currentTarget.value), 0, SIMULATION_MAX_WAGE_EUR)
                    )
                  }
                />
              </label>
              <label className={styles.simulationControlLabel}>
                <span>{messages.sortTsi}</span>
                <input
                  className={styles.transferSearchInput}
                  type="number"
                  min={0}
                  max={SIMULATION_MAX_TSI}
                  step={1}
                  value={values.tsi}
                  onChange={(event) =>
                    updateValue(
                      "tsi",
                      clamp(Number(event.currentTarget.value), 0, SIMULATION_MAX_TSI)
                    )
                  }
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className={styles.skillsGrid}>
          {SKILL_ROWS.map((definition) => renderSkillRow(definition))}
        </div>
        {editing && dirty ? (
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
