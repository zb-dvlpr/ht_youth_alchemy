import type { SeniorTrainableMainSkill } from "./types";

export type TrainingModelInput = {
  mainSkill: SeniorTrainableMainSkill;
  startingAgeYears: number;
  startingAgeDays: number;
  startingSkill: number;
  equivalentTrainingWeeks: number;
};

export type TrainingModelResult =
  | {
      status: "available";
      inferredSkill: number;
    }
  | {
      status: "unsupported";
      reason: "age" | "skill" | "numeric";
    };

export const TRAINING_COEFFICIENTS = {
  keeper: 0.335,
  defending: 0.206,
  winger: 0.315,
  playmaking: 0.22,
  passing: 0.237,
  scoring: 0.218,
  setPieces: 0.941,
} as const;

const ASSISTANT_COEFFICIENTS = [
  0.66, 0.692, 0.724, 0.756, 0.788, 0.82, 0.852, 0.884, 0.916, 0.948, 0.98,
  1.012, 1.044, 1.076, 1.108, 1.14,
] as const;

const COACH_COEFFICIENTS = [0, 0, 0, 0, 0.774, 0.867, 0.943, 1, 1.045] as const;

const AGE_TABLE = [
  0.0, 16.0, 31.704, 47.117, 62.246, 77.094, 91.668, 105.972, 120.012,
  133.791, 147.316, 160.591, 173.62, 186.408, 198.96, 211.279, 223.37,
  235.238,
] as const;

const HATTRICK_AGE_WEEKS_PER_YEAR = 16;
const MODEL_MIN_AGE = 16;
const MODEL_MAX_AGE = 33;
const MODEL_MAX_SKILL = 20.5;
const SKILL_TOLERANCE = 0.00001;
const MAX_ITERATIONS = 80;
const HIGH_SKILL_SLOWDOWN_SCALE = 13.6;

function skillCurve(skill: number) {
  if (skill < 9) {
    return (Math.pow(skill, 1.72) - 1) / (6.0896 * 1.72);
  }
  return 2.45426 + Math.pow(skill - 5, 1.96) / (4.7371 * 1.96);
}

function interpolateAgeTable(ageYears: number) {
  const position = ageYears - MODEL_MIN_AGE;
  if (position < 0 || position > AGE_TABLE.length - 1) return null;
  const index = Math.floor(position);
  const fraction = position - index;
  if (index >= AGE_TABLE.length - 1) return AGE_TABLE[AGE_TABLE.length - 1];
  return AGE_TABLE[index] + (AGE_TABLE[index + 1] - AGE_TABLE[index]) * fraction;
}

function highSkillSlowdown(targetSkill: number) {
  const drop =
    targetSkill > 15
      ? (Math.pow(targetSkill, 7.5) * 8) / Math.pow(10, 12)
      : 0;
  return Math.max(0.05, 1 - drop * HIGH_SKILL_SLOWDOWN_SCALE);
}

function requiredSkillCurveDistance(startingSkill: number, targetSkill: number) {
  if (targetSkill <= startingSkill) return 0;
  const slices = Math.max(1, Math.ceil((targetSkill - startingSkill) / 0.01));
  let distance = 0;
  let previousSkill = startingSkill;
  let previousCurve = skillCurve(startingSkill);
  for (let index = 1; index <= slices; index += 1) {
    const nextSkill =
      index === slices
        ? targetSkill
        : startingSkill + ((targetSkill - startingSkill) * index) / slices;
    const nextCurve = skillCurve(nextSkill);
    distance += (nextCurve - previousCurve) / highSkillSlowdown(nextSkill);
    previousSkill = nextSkill;
    previousCurve = nextCurve;
  }
  void previousSkill;
  return distance;
}

function progressForWeeks(input: {
  mainSkill: SeniorTrainableMainSkill;
  startingAge: number;
  weeks: number;
}) {
  const startAgeValue = interpolateAgeTable(input.startingAge);
  const endAgeValue = interpolateAgeTable(
    input.startingAge + input.weeks / HATTRICK_AGE_WEEKS_PER_YEAR
  );
  if (startAgeValue === null || endAgeValue === null) return null;
  const coachCoefficient = COACH_COEFFICIENTS[7];
  const assistantCoefficient = ASSISTANT_COEFFICIENTS[10];
  const trainingCoefficient = TRAINING_COEFFICIENTS[input.mainSkill];
  const totalK =
    coachCoefficient * assistantCoefficient * 1 * 0.9 * trainingCoefficient;
  return (endAgeValue - startAgeValue) * totalK;
}

function canReachTarget(input: TrainingModelInput, targetSkill: number) {
  const startingAge = input.startingAgeYears + input.startingAgeDays / 112;
  const progress = progressForWeeks({
    mainSkill: input.mainSkill,
    startingAge,
    weeks: input.equivalentTrainingWeeks,
  });
  if (progress === null) return null;
  return progress >= requiredSkillCurveDistance(input.startingSkill, targetSkill);
}

export function inferTrainingAwareSkillUpperBound(
  input: TrainingModelInput
): TrainingModelResult {
  const startingAge = input.startingAgeYears + input.startingAgeDays / 112;
  if (
    !Number.isFinite(input.startingAgeYears) ||
    !Number.isFinite(input.startingAgeDays) ||
    startingAge < MODEL_MIN_AGE ||
    startingAge > MODEL_MAX_AGE
  ) {
    return { status: "unsupported", reason: "age" };
  }
  if (
    !Number.isFinite(input.startingSkill) ||
    input.startingSkill < 0 ||
    input.startingSkill > MODEL_MAX_SKILL
  ) {
    return { status: "unsupported", reason: "skill" };
  }
  if (
    !Number.isFinite(input.equivalentTrainingWeeks) ||
    input.equivalentTrainingWeeks < 0
  ) {
    return { status: "unsupported", reason: "numeric" };
  }
  if (input.equivalentTrainingWeeks === 0) {
    return { status: "available", inferredSkill: input.startingSkill };
  }

  const maxReachable = canReachTarget(input, MODEL_MAX_SKILL);
  if (maxReachable === null) return { status: "unsupported", reason: "age" };

  let low = input.startingSkill;
  let high = MODEL_MAX_SKILL;
  if (maxReachable !== true) {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      const mid = (low + high) / 2;
      const reachable = canReachTarget(input, mid);
      if (reachable === null) return { status: "unsupported", reason: "age" };
      if (reachable) low = mid;
      else high = mid;
      if (high - low <= SKILL_TOLERANCE) break;
    }
  } else {
    low = MODEL_MAX_SKILL;
  }

  if (!Number.isFinite(low) || low < input.startingSkill) {
    return { status: "unsupported", reason: "numeric" };
  }
  return { status: "available", inferredSkill: low };
}

export function calculateTrainingWeeksToReachSkill(input: {
  mainSkill: SeniorTrainableMainSkill;
  startingAgeYears: number;
  startingAgeDays: number;
  startingSkill: number;
  targetSkill: number;
}) {
  const startingAge = input.startingAgeYears + input.startingAgeDays / 112;
  if (
    !Number.isFinite(startingAge) ||
    startingAge < MODEL_MIN_AGE ||
    startingAge > MODEL_MAX_AGE ||
    input.targetSkill < input.startingSkill
  ) {
    return null;
  }
  let low = 0;
  let high = (MODEL_MAX_AGE - startingAge) * HATTRICK_AGE_WEEKS_PER_YEAR;
  const required = requiredSkillCurveDistance(input.startingSkill, input.targetSkill);
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const mid = (low + high) / 2;
    const progress = progressForWeeks({
      mainSkill: input.mainSkill,
      startingAge,
      weeks: mid,
    });
    if (progress === null) return null;
    if (progress >= required) high = mid;
    else low = mid;
  }
  return high;
}
