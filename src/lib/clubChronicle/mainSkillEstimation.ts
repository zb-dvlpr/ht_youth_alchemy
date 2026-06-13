import {
  matchRoleIdToPositionKey,
  normalizeMatchRoleId,
  type PositionKey,
} from "@/lib/positions";

export type ChroniclePlayingPositionEntry = {
  roleId: number;
  minutes: number;
};

export type ChronicleMainSkillKey =
  | "keeper"
  | "defending"
  | "playmaking"
  | "passing"
  | "winger"
  | "scoring";

export type ChronicleEstimatedMainSkill =
  | {
      kind: "estimated";
      level: number;
      dominantRoleId: number;
      dominantPositionKey: PositionKey;
      mainSkill: Exclude<ChronicleMainSkillKey, "passing">;
      baseWageInternal: number;
    }
  | { kind: "tooOld" }
  | { kind: "unavailable" };

export type ChronicleDominantPlayingPosition = {
  roleId: number;
  positionKey: PositionKey;
  sortBucket: number;
  minutes: number;
};

export const PLAYING_POSITION_SORT_BUCKET_NO_VALUE = 4;

export const resolveChroniclePlayingPositionRoleSortBucket = (
  roleId: number | null | undefined
) => {
  const positionKey = matchRoleIdToPositionKey(roleId);
  switch (positionKey) {
    case "KP":
      return 0;
    case "WB":
    case "CD":
      return 1;
    case "W":
    case "IM":
      return 2;
    case "F":
      return 3;
    default:
      return PLAYING_POSITION_SORT_BUCKET_NO_VALUE;
  }
};

export const resolveChronicleDominantPlayingPosition = (
  entries: ChroniclePlayingPositionEntry[] | null | undefined
): ChronicleDominantPlayingPosition | null => {
  if (!entries || entries.length === 0) return null;

  const best = entries.reduce<{
    bucket: number;
    minutes: number;
    roleId: number;
    positionKey: PositionKey | null;
  }>(
    (currentBest, entry) => {
      const minutes = entry.minutes;
      const roleId = normalizeMatchRoleId(entry.roleId);
      if (!roleId || !Number.isFinite(minutes) || minutes <= 0) return currentBest;
      const bucket = resolveChroniclePlayingPositionRoleSortBucket(roleId);
      if (bucket === PLAYING_POSITION_SORT_BUCKET_NO_VALUE) return currentBest;
      const positionKey = matchRoleIdToPositionKey(roleId);
      if (!positionKey) return currentBest;
      if (
        minutes > currentBest.minutes ||
        (minutes === currentBest.minutes &&
          (bucket < currentBest.bucket ||
            (bucket === currentBest.bucket && roleId < currentBest.roleId)))
      ) {
        return { bucket, minutes, roleId, positionKey };
      }
      return currentBest;
    },
    {
      bucket: PLAYING_POSITION_SORT_BUCKET_NO_VALUE,
      minutes: -1,
      roleId: Number.POSITIVE_INFINITY,
      positionKey: null,
    }
  );

  if (!best.positionKey) return null;

  return {
    roleId: best.roleId,
    positionKey: best.positionKey,
    sortBucket: best.bucket,
    minutes: best.minutes,
  };
};

const INTERNAL_SEK_PER_WAGE_MODEL_UNIT = 10;

const MAIN_SKILL_WAGE_MINIMUMS_INTERNAL: Record<
  ChronicleMainSkillKey,
  readonly (readonly [number, number])[]
> = {
  keeper: [
    [5, 610],
    [6, 830],
    [7, 1150],
    [8, 1590],
    [9, 2250],
    [10, 3170],
    [11, 4530],
    [12, 6450],
    [13, 9150],
    [14, 12910],
    [15, 18050],
    [16, 24150],
    [17, 31480],
    [18, 40930],
    [19, 52990],
    [20, 68210],
    [21, 87280],
  ],
  defending: [
    [5, 250],
    [6, 270],
    [7, 310],
    [8, 450],
    [9, 730],
    [10, 1290],
    [11, 2310],
    [12, 4070],
    [13, 6930],
    [14, 11450],
    [15, 18270],
    [16, 26840],
    [17, 38310],
    [18, 54160],
    [19, 75730],
  ],
  playmaking: [
    [5, 250],
    [6, 270],
    [7, 330],
    [8, 510],
    [9, 850],
    [10, 1550],
    [11, 2830],
    [12, 5030],
    [13, 8610],
    [14, 14250],
    [15, 22370],
    [16, 32450],
    [17, 46640],
    [18, 66330],
    [19, 93180],
    [20, 129150],
  ],
  passing: [
    [5, 250],
    [6, 250],
    [7, 290],
    [8, 390],
    [9, 590],
    [10, 970],
    [11, 1690],
    [12, 2930],
    [13, 4930],
    [14, 8090],
    [15, 12870],
    [16, 19910],
    [17, 28200],
    [18, 39440],
    [19, 54680],
    [20, 75100],
  ],
  winger: [
    [5, 250],
    [6, 250],
    [7, 290],
    [8, 370],
    [9, 550],
    [10, 890],
    [11, 1530],
    [12, 2630],
    [13, 4430],
    [14, 7250],
    [15, 11510],
    [16, 17810],
    [17, 25650],
    [18, 35720],
    [19, 49380],
    [20, 67660],
    [21, 91800],
  ],
  scoring: [
    [5, 250],
    [6, 270],
    [7, 330],
    [8, 470],
    [9, 790],
    [10, 1430],
    [11, 2570],
    [12, 4550],
    [13, 7770],
    [14, 12830],
    [15, 20490],
    [16, 29650],
    [17, 42480],
    [18, 60240],
    [19, 84470],
  ],
};

const mainSkillByPositionKey: Partial<
  Record<PositionKey, Exclude<ChronicleMainSkillKey, "passing">>
> = {
  KP: "keeper",
  CD: "defending",
  WB: "defending",
  W: "winger",
  IM: "playmaking",
  F: "scoring",
};

const hasSpecialty = (specialty: number | null | undefined): boolean =>
  typeof specialty === "number" && Number.isFinite(specialty) && specialty > 0;

function estimateLevelFromWageMinimums(
  baseWageInternal: number,
  wageMinimums: readonly (readonly [number, number])[]
): number | null {
  if (!Number.isFinite(baseWageInternal)) return null;

  if (wageMinimums.length === 0) return null;

  const first = wageMinimums[0];
  if (!first || baseWageInternal < first[1]) return null;

  for (let index = 0; index < wageMinimums.length; index += 1) {
    const current = wageMinimums[index];
    if (!current) continue;

    const [level, minimumWageInternal] = current;
    const next = wageMinimums[index + 1];

    if (!next) {
      return level;
    }

    const [nextLevel, nextMinimumWageInternal] = next;

    if (baseWageInternal >= minimumWageInternal && baseWageInternal < nextMinimumWageInternal) {
      const wageSpan = nextMinimumWageInternal - minimumWageInternal;
      if (wageSpan <= 0) return level;

      const fraction = (baseWageInternal - minimumWageInternal) / wageSpan;
      const interpolated = level + (nextLevel - level) * fraction;

      return Math.round((interpolated + Number.EPSILON) * 10) / 10;
    }
  }

  return null;
}

export function estimateChronicleMainSkillFromWage(input: {
  salarySek: number | null | undefined;
  ageYears: number | null | undefined;
  specialty: number | null | undefined;
  wageIncludesForeignBonus: boolean | null | undefined;
  playingPositions: ChroniclePlayingPositionEntry[] | null | undefined;
}): ChronicleEstimatedMainSkill {
  const { ageYears, salarySek } = input;
  if (typeof ageYears !== "number" || !Number.isFinite(ageYears)) {
    return { kind: "unavailable" };
  }
  if (ageYears > 37) {
    return { kind: "tooOld" };
  }
  if (typeof salarySek !== "number" || !Number.isFinite(salarySek) || salarySek <= 0) {
    return { kind: "unavailable" };
  }

  const dominantPosition = resolveChronicleDominantPlayingPosition(
    input.playingPositions
  );
  if (!dominantPosition) return { kind: "unavailable" };

  const mainSkill = mainSkillByPositionKey[dominantPosition.positionKey];
  if (!mainSkill) return { kind: "unavailable" };

  let baseWageInternal = salarySek / INTERNAL_SEK_PER_WAGE_MODEL_UNIT;
  if (input.wageIncludesForeignBonus) {
    baseWageInternal /= 1.2;
  }
  if (hasSpecialty(input.specialty)) {
    baseWageInternal /= 1.1;
  }
  if (ageYears >= 29) {
    const ageFactor = 1 - (ageYears - 28) / 10;
    if (ageFactor <= 0) return { kind: "tooOld" };
    baseWageInternal /= ageFactor;
  }

  const wageMinimums = MAIN_SKILL_WAGE_MINIMUMS_INTERNAL[mainSkill];
  const estimatedLevel = estimateLevelFromWageMinimums(baseWageInternal, wageMinimums);

  if (estimatedLevel === null) return { kind: "unavailable" };

  return {
    kind: "estimated",
    level: estimatedLevel,
    dominantRoleId: dominantPosition.roleId,
    dominantPositionKey: dominantPosition.positionKey,
    mainSkill,
    baseWageInternal,
  };
}
