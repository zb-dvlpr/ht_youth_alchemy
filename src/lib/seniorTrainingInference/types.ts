import type { SeniorPlayerMetricInput } from "@/lib/seniorPlayerMetrics";

export type SeniorTrainableMainSkill =
  | "keeper"
  | "defending"
  | "playmaking"
  | "winger"
  | "passing"
  | "scoring"
  | "setPieces";

export type UniqueMainSkillResolution =
  | {
      status: "unique";
      skill: SeniorTrainableMainSkill;
      level: number;
    }
  | {
      status: "tie";
      tiedSkills: SeniorTrainableMainSkill[];
      level: number;
    }
  | {
      status: "incomplete";
    };

export type SeniorTrainingInferenceState =
  | { status: "idle" }
  | {
      status: "not-applicable";
      reason: "tied-main-skill" | "incomplete-skills";
    }
  | {
      status: "loading";
      mainSkill: SeniorTrainableMainSkill;
    }
  | {
      status: "available";
      playerId: number;
      mainSkill: SeniorTrainableMainSkill;
      birthdayCutoff: string;
      rawWeightedMinutes: number;
      weeklyCappedMinutes: number;
      equivalentTrainingWeeks: number;
      inferredHigh: number;
      inferredAverage: number;
      inferredLow: number;
      tsiHighPossiblyInflated: boolean;
      tsiAveragePossiblyInflated: boolean;
      tsiLowPossiblyInflated: boolean;
      algorithmVersion: number;
      latestRelevantMatchDate: string | null;
    }
  | {
      status: "unavailable";
      reason:
        | "wage-prediction-unavailable"
        | "psico-main-skill-mismatch"
        | "unsupported-model-input"
        | "team-history-unavailable"
        | "match-history-unavailable"
        | "lineup-unavailable"
        | "timeline-unavailable"
        | "request-failed"
        | "unknown";
    };

export type SeniorTrainingInferencePlayerInput = {
  playerId: number;
  currentTeamId?: number | null;
  currentLeagueId?: number | null;
  metricInput: SeniorPlayerMetricInput;
};

export const SENIOR_TRAINING_HISTORY_ALGORITHM_VERSION = 1;
export const SENIOR_TRAINING_MODEL_VERSION = 1;
export const SENIOR_TRAINING_CACHE_VERSION = 1;

