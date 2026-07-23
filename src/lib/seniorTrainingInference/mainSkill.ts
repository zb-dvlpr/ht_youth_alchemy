import type { SeniorPlayerMetricInput } from "@/lib/seniorPlayerMetrics";
import type {
  SeniorTrainableMainSkill,
  UniqueMainSkillResolution,
} from "./types";

export const SENIOR_TRAINABLE_MAIN_SKILLS: readonly SeniorTrainableMainSkill[] = [
  "keeper",
  "defending",
  "playmaking",
  "winger",
  "passing",
  "scoring",
  "setPieces",
] as const;

export function resolveUniqueHighestFootballSkill(
  metricInput: Pick<SeniorPlayerMetricInput, SeniorTrainableMainSkill>
): UniqueMainSkillResolution {
  const values = SENIOR_TRAINABLE_MAIN_SKILLS.map((skill) => ({
    skill,
    level: metricInput[skill],
  }));

  if (
    values.some(
      ({ level }) => typeof level !== "number" || !Number.isFinite(level)
    )
  ) {
    return { status: "incomplete" };
  }

  const numeric = values as Array<{ skill: SeniorTrainableMainSkill; level: number }>;
  const highest = Math.max(...numeric.map(({ level }) => level));
  const tiedSkills = numeric
    .filter(({ level }) => level === highest)
    .map(({ skill }) => skill);

  if (tiedSkills.length !== 1) {
    return { status: "tie", tiedSkills, level: highest };
  }

  return { status: "unique", skill: tiedSkills[0], level: highest };
}

export function hasUniqueHighestFootballSkill(
  metricInput: Pick<SeniorPlayerMetricInput, SeniorTrainableMainSkill>
) {
  return resolveUniqueHighestFootballSkill(metricInput).status === "unique";
}

