import { foxtrickPsico } from "./foxtrickPsico";

export type SeniorPlayerMetricSkills = {
  keeper: number | null;
  defending: number | null;
  playmaking: number | null;
  winger: number | null;
  passing: number | null;
  scoring: number | null;
  setPieces: number | null;
  stamina?: number | null;
  form?: number | null;
};

export type SeniorPlayerMetricInput = SeniorPlayerMetricSkills & {
  ageYears: number | null;
  ageDays: number | null;
  tsi?: number | null;
  salarySek?: number | null;
  isAbroad?: boolean;
};

export type HtmsMetrics = {
  ability: number;
  potential: number;
};

export type PsicoTsiMetrics = {
  mainSkill: keyof SeniorPlayerMetricSkills;
  isGoalkeeper: boolean;
  undefinedMainSkill: boolean;
  limit: "Low" | "Medium" | "High";
  formHigh: string;
  formAvg: string;
  formLow: string;
  wageHigh: string;
  wageAvg: string;
  wageLow: string;
};

const WEEKS_IN_SEASON = 16;
const DAYS_IN_WEEK = 7;
const DAYS_IN_SEASON = 112;
const HTMS_TARGET_AGE = 28;
const CHPP_SEK_PER_EUR = 10;

const WEEK_POINTS_PER_AGE: Record<number, number> = {
  17: 10,
  18: 9.92,
  19: 9.81,
  20: 9.69,
  21: 9.54,
  22: 9.39,
  23: 9.22,
  24: 9.04,
  25: 8.85,
  26: 8.66,
  27: 8.47,
  28: 8.27,
  29: 8.07,
  30: 7.87,
  31: 7.67,
  32: 7.47,
  33: 7.27,
  34: 7.07,
  35: 6.87,
  36: 6.67,
  37: 6.47,
  38: 6.26,
  39: 6.06,
  40: 5.86,
  41: 5.65,
  42: 6.45,
  43: 6.24,
  44: 6.04,
  45: 5.83,
};

const HTMS_MAIN_SKILLS = [
  "keeper",
  "defending",
  "playmaking",
  "winger",
  "passing",
  "scoring",
] as const;

const SKILL_POINTS_PER_LEVEL = [
  [0, 0, 0, 0, 0, 0, 0],
  [2, 4, 4, 2, 3, 4, 1],
  [12, 18, 17, 12, 14, 17, 2],
  [23, 39, 34, 25, 31, 36, 5],
  [39, 65, 57, 41, 51, 59, 9],
  [56, 98, 84, 60, 75, 88, 15],
  [76, 134, 114, 81, 104, 119, 21],
  [99, 175, 150, 105, 137, 156, 28],
  [123, 221, 190, 132, 173, 197, 37],
  [150, 271, 231, 161, 213, 240, 46],
  [183, 330, 281, 195, 259, 291, 56],
  [222, 401, 341, 238, 315, 354, 68],
  [268, 484, 412, 287, 381, 427, 81],
  [321, 580, 493, 344, 457, 511, 95],
  [380, 689, 584, 407, 540, 607, 112],
  [446, 809, 685, 478, 634, 713, 131],
  [519, 942, 798, 555, 738, 830, 153],
  [600, 1092, 924, 642, 854, 961, 179],
  [691, 1268, 1070, 741, 988, 1114, 210],
  [797, 1487, 1247, 855, 1148, 1300, 246],
  [924, 1791, 1480, 995, 1355, 1547, 287],
  [1074, 1791, 1791, 1172, 1355, 1547, 334],
  [1278, 1791, 1791, 1360, 1355, 1547, 388],
  [1278, 1791, 1791, 1360, 1355, 1547, 450],
];

const PSICO_SKILL_NAMES = [
  "form",
  "stamina",
  "playmaking",
  "winger",
  "scoring",
  "keeper",
  "passing",
  "defending",
  "setPieces",
] as const;

const PSICO_MAIN_SKILL_BY_INDEX: Record<number, keyof SeniorPlayerMetricSkills> = {
  2: "playmaking",
  3: "winger",
  4: "scoring",
  5: "keeper",
  6: "passing",
  7: "defending",
};

const MAX_HTMS_SKILL_LEVEL = SKILL_POINTS_PER_LEVEL.length - 1;
const MAX_HTMS_AGE = Math.max(...Object.keys(WEEK_POINTS_PER_AGE).map(Number));

const normalizeLevel = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
};

export function calculateHtmsMetrics(input: SeniorPlayerMetricInput): HtmsMetrics | null {
  const ageYears = normalizeLevel(input.ageYears);
  const ageDays = normalizeLevel(input.ageDays) ?? 0;
  if (ageYears === null) return null;

  let ability = 0;
  for (const [index, skill] of HTMS_MAIN_SKILLS.entries()) {
    const level = normalizeLevel(input[skill]);
    if (level === null || level > MAX_HTMS_SKILL_LEVEL) return null;
    ability += SKILL_POINTS_PER_LEVEL[level][index];
  }

  const setPieces = normalizeLevel(input.setPieces);
  if (setPieces === null) return null;
  ability += SKILL_POINTS_PER_LEVEL[Math.min(MAX_HTMS_SKILL_LEVEL, setPieces)][6];

  let pointsDiff = 0;
  if (ageYears < HTMS_TARGET_AGE) {
    const pointsPerWeek = WEEK_POINTS_PER_AGE[ageYears];
    if (typeof pointsPerWeek !== "number") return null;
    pointsDiff = ((DAYS_IN_SEASON - ageDays) / DAYS_IN_WEEK) * pointsPerWeek;
    for (let age = ageYears + 1; age < HTMS_TARGET_AGE; age += 1) {
      pointsDiff += WEEKS_IN_SEASON * WEEK_POINTS_PER_AGE[age];
    }
  } else if (ageYears <= MAX_HTMS_AGE) {
    pointsDiff = (ageDays / DAYS_IN_WEEK) * WEEK_POINTS_PER_AGE[ageYears];
    for (let age = ageYears; age > HTMS_TARGET_AGE; age -= 1) {
      pointsDiff += WEEKS_IN_SEASON * WEEK_POINTS_PER_AGE[age];
    }
    pointsDiff = -pointsDiff;
  } else {
    pointsDiff = -ability;
  }

  return {
    ability,
    potential: Math.round(ability + pointsDiff),
  };
}

export function calculatePsicoTsiMetrics(
  input: SeniorPlayerMetricInput
): PsicoTsiMetrics | null {
  const levels = PSICO_SKILL_NAMES.map((skill) => normalizeLevel(input[skill]));
  if (levels.some((value) => value === null)) return null;
  const normalizedLevels = levels as number[];
  const tsi = normalizeLevel(input.tsi);
  const ageYears = normalizeLevel(input.ageYears);
  if (tsi === null || ageYears === null) return null;

  const salarySek =
    typeof input.salarySek === "number" && Number.isFinite(input.salarySek)
      ? Math.floor(input.salarySek / CHPP_SEK_PER_EUR / (input.isAbroad ? 1.2 : 1))
      : 0;
  const prediction = foxtrickPsico.getPrediction(normalizedLevels, tsi, salarySek, ageYears);
  if (!prediction) return null;

  const mainSkillIndex = Number(prediction.maxSkill);
  const mainSkill = PSICO_MAIN_SKILL_BY_INDEX[mainSkillIndex];
  if (!mainSkill) return null;
  const limit =
    prediction.limit === "Low" || prediction.limit === "High"
      ? prediction.limit
      : "Medium";

  return {
    mainSkill,
    isGoalkeeper: Boolean(prediction.isGK),
    undefinedMainSkill: Boolean(prediction.undef),
    limit,
    formHigh: String(prediction.formHigh),
    formAvg: String(prediction.formAvg),
    formLow: String(prediction.formLow),
    wageHigh: String(prediction.wageHigh),
    wageAvg: String(prediction.wageAvg),
    wageLow: String(prediction.wageLow),
  };
}

export function calculateSeniorPlayerMetrics(input: SeniorPlayerMetricInput) {
  return {
    htms: calculateHtmsMetrics(input),
    psicoTsi: calculatePsicoTsiMetrics(input),
  };
}
