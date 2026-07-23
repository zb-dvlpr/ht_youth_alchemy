import {
  calculateSeniorPlayerMetrics,
  type PsicoTsiMetrics,
  type SeniorPlayerMetricInput,
} from "@/lib/seniorPlayerMetrics";
import { resolveUniqueHighestFootballSkill } from "./mainSkill";
import {
  inferTrainingAwareSkillUpperBound,
  type TrainingModelResult,
} from "./trainingModel";
import {
  isTsiPredictionPossiblyInflated,
  parsePsicoSkillValue,
} from "./psico";
import type {
  SeniorTrainingInferenceState,
  SeniorTrainableMainSkill,
} from "./types";

export type SeniorTrainingHistoryAvailableInput = {
  status: "available";
  playerId: number;
  mainSkill: SeniorTrainableMainSkill;
  birthdayCutoff: string;
  rawWeightedMinutes: number;
  weeklyCappedMinutes: number;
  equivalentTrainingWeeks: number;
  latestRelevantMatchDate: string | null;
  algorithmVersion: number;
};

export type SeniorTrainingHistoryUnavailableInput = {
  status: "unavailable";
  reason:
    | "team-history-unavailable"
    | "match-history-unavailable"
    | "lineup-unavailable"
    | "timeline-unavailable"
    | "unknown";
};

export type SeniorTrainingHistoryInput =
  | SeniorTrainingHistoryAvailableInput
  | SeniorTrainingHistoryUnavailableInput;

function parsePsicoTriple(psico: PsicoTsiMetrics) {
  const wageHigh = parsePsicoSkillValue(psico.wageHigh);
  const wageAvg = parsePsicoSkillValue(psico.wageAvg);
  const wageLow = parsePsicoSkillValue(psico.wageLow);
  const formHigh = parsePsicoSkillValue(psico.formHigh);
  const formAvg = parsePsicoSkillValue(psico.formAvg);
  const formLow = parsePsicoSkillValue(psico.formLow);
  if (wageHigh === null || wageAvg === null || wageLow === null) return null;
  return { wageHigh, wageAvg, wageLow, formHigh, formAvg, formLow };
}

function unwrapModel(result: TrainingModelResult) {
  return result.status === "available" ? result.inferredSkill : null;
}

export function resolveTrainingInferenceFromHistory(input: {
  playerId: number;
  metricInput: SeniorPlayerMetricInput;
  history: SeniorTrainingHistoryInput | null;
}): SeniorTrainingInferenceState {
  const mainSkill = resolveUniqueHighestFootballSkill(input.metricInput);
  if (mainSkill.status === "incomplete") {
    return { status: "not-applicable", reason: "incomplete-skills" };
  }
  if (mainSkill.status === "tie") {
    return { status: "not-applicable", reason: "tied-main-skill" };
  }
  if (input.history === null) {
    return { status: "loading", mainSkill: mainSkill.skill };
  }
  if (input.history.status === "unavailable") {
    return { status: "unavailable", reason: input.history.reason };
  }
  if (input.history.mainSkill !== mainSkill.skill) {
    return { status: "unavailable", reason: "psico-main-skill-mismatch" };
  }
  const metrics = calculateSeniorPlayerMetrics(input.metricInput);
  if (!metrics.psicoTsi) {
    return { status: "unavailable", reason: "wage-prediction-unavailable" };
  }
  if (metrics.psicoTsi.mainSkill !== mainSkill.skill) {
    return { status: "unavailable", reason: "psico-main-skill-mismatch" };
  }
  const psico = parsePsicoTriple(metrics.psicoTsi);
  if (!psico) {
    return { status: "unavailable", reason: "wage-prediction-unavailable" };
  }
  if (
    typeof input.metricInput.ageYears !== "number" ||
    !Number.isFinite(input.metricInput.ageYears)
  ) {
    return { status: "unavailable", reason: "unsupported-model-input" };
  }

  const modelBase = {
    mainSkill: mainSkill.skill,
    startingAgeYears: input.metricInput.ageYears,
    startingAgeDays: 0,
    equivalentTrainingWeeks: input.history.equivalentTrainingWeeks,
  };
  const inferredHigh = unwrapModel(
    inferTrainingAwareSkillUpperBound({
      ...modelBase,
      startingSkill: psico.wageHigh,
    })
  );
  const inferredAverage = unwrapModel(
    inferTrainingAwareSkillUpperBound({
      ...modelBase,
      startingSkill: psico.wageAvg,
    })
  );
  const inferredLow = unwrapModel(
    inferTrainingAwareSkillUpperBound({
      ...modelBase,
      startingSkill: psico.wageLow,
    })
  );
  if (
    inferredHigh === null ||
    inferredAverage === null ||
    inferredLow === null
  ) {
    return { status: "unavailable", reason: "unsupported-model-input" };
  }

  return {
    status: "available",
    playerId: input.playerId,
    mainSkill: mainSkill.skill,
    birthdayCutoff: input.history.birthdayCutoff,
    rawWeightedMinutes: input.history.rawWeightedMinutes,
    weeklyCappedMinutes: input.history.weeklyCappedMinutes,
    equivalentTrainingWeeks: input.history.equivalentTrainingWeeks,
    inferredHigh,
    inferredAverage,
    inferredLow,
    tsiHighPossiblyInflated: isTsiPredictionPossiblyInflated(
      psico.formHigh,
      inferredHigh
    ),
    tsiAveragePossiblyInflated: isTsiPredictionPossiblyInflated(
      psico.formAvg,
      inferredAverage
    ),
    tsiLowPossiblyInflated: isTsiPredictionPossiblyInflated(
      psico.formLow,
      inferredLow
    ),
    algorithmVersion: input.history.algorithmVersion,
    latestRelevantMatchDate: input.history.latestRelevantMatchDate,
  };
}
