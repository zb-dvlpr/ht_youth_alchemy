import assert from "node:assert/strict";
import { resolveUniqueHighestFootballSkill } from "../src/lib/seniorTrainingInference/mainSkill";
import {
  getTrainingPositionWeight,
  type SeniorPositionGroup,
} from "../src/lib/seniorTrainingInference/trainingPositions";
import {
  calculateWeightedTrainingMinutesForPlayer,
  reconstructPlayerPositionSegments,
} from "../src/lib/seniorTrainingInference/matchTimeline";
import { summarizeWeeklyTraining } from "../src/lib/seniorTrainingInference/weeklyTraining";
import {
  calculateTrainingWeeksToReachSkill,
  inferTrainingAwareSkillUpperBound,
} from "../src/lib/seniorTrainingInference/trainingModel";
import {
  isTsiPredictionPossiblyInflated,
  parsePsicoSkillValue,
} from "../src/lib/seniorTrainingInference/psico";
import { resolveTrainingInferenceFromHistory } from "../src/lib/seniorTrainingInference/inference";
import type { SeniorPlayerMetricInput } from "../src/lib/seniorPlayerMetrics";

const baseMetricInput: SeniorPlayerMetricInput = {
  ageYears: 18,
  ageDays: 56,
  tsi: 20_000,
  salarySek: 80_000,
  isAbroad: false,
  specialty: null,
  form: 6,
  stamina: 7,
  keeper: 1,
  defending: 5,
  playmaking: 7,
  winger: 6,
  passing: 8,
  scoring: 10,
  setPieces: 4,
};

function close(actual: number, expected: number, epsilon = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${expected}, received ${actual}`
  );
}

{
  assert.deepEqual(resolveUniqueHighestFootballSkill(baseMetricInput), {
    status: "unique",
    skill: "scoring",
    level: 10,
  });
  assert.equal(
    resolveUniqueHighestFootballSkill({
      ...baseMetricInput,
      passing: 10,
    }).status,
    "tie"
  );
  assert.equal(
    resolveUniqueHighestFootballSkill({
      ...baseMetricInput,
      winger: null,
    }).status,
    "incomplete"
  );
  assert.equal(
    resolveUniqueHighestFootballSkill({
      ...baseMetricInput,
      scoring: 10,
      setPieces: 11,
    }).status,
    "unique"
  );
  assert.equal(
    resolveUniqueHighestFootballSkill({
      ...baseMetricInput,
      keeper: 12,
    }).status,
    "unique"
  );
}

{
  const groups: SeniorPositionGroup[] = [
    "goalkeeper",
    "wingback",
    "centralDefender",
    "winger",
    "innerMidfielder",
    "forward",
    "other",
  ];
  assert.equal(getTrainingPositionWeight("keeper", "goalkeeper"), 1);
  assert.equal(getTrainingPositionWeight("defending", "wingback"), 1);
  assert.equal(getTrainingPositionWeight("defending", "centralDefender"), 1);
  assert.equal(getTrainingPositionWeight("winger", "winger"), 1);
  assert.equal(getTrainingPositionWeight("winger", "wingback"), 0.5);
  assert.equal(getTrainingPositionWeight("playmaking", "innerMidfielder"), 1);
  assert.equal(getTrainingPositionWeight("playmaking", "winger"), 0.5);
  assert.equal(getTrainingPositionWeight("passing", "winger"), 1);
  assert.equal(getTrainingPositionWeight("passing", "innerMidfielder"), 1);
  assert.equal(getTrainingPositionWeight("passing", "forward"), 1);
  assert.equal(getTrainingPositionWeight("scoring", "forward"), 1);
  assert.equal(getTrainingPositionWeight("scoring", "winger"), 0);
  groups
    .filter((group) => group !== "other")
    .forEach((group) => assert.equal(getTrainingPositionWeight("setPieces", group), 1));
  assert.equal(getTrainingPositionWeight("setPieces", "other"), 0);
}

{
  const segments = reconstructPlayerPositionSegments({
    startingLineup: [{ PlayerID: 1, RoleID: 111 }],
    orders: [{ OrderType: 1, SubjectPlayerID: 1, MatchMinute: 45, NewPositionID: 106 }],
    totalMatchMinutes: 90,
  });
  close(
    calculateWeightedTrainingMinutesForPlayer({
      segments,
      playerId: 1,
      mainSkill: "scoring",
    }),
    45
  );
}

{
  const segments = reconstructPlayerPositionSegments({
    startingLineup: [{ PlayerID: 1, RoleID: 106 }],
    orders: [
      { OrderType: 1, SubjectPlayerID: 1, MatchMinute: 30, NewPositionID: 108 },
      { OrderType: 1, SubjectPlayerID: 1, MatchMinute: 75, NewPositionID: 111 },
    ],
    totalMatchMinutes: 90,
  });
  close(
    calculateWeightedTrainingMinutesForPlayer({
      segments,
      playerId: 1,
      mainSkill: "playmaking",
    }),
    60
  );
}

{
  const substitute = reconstructPlayerPositionSegments({
    startingLineup: [{ PlayerID: 1, RoleID: 111 }],
    orders: [{ OrderType: 1, SubjectPlayerID: 1, ObjectPlayerID: 2, MatchMinute: 60 }],
    totalMatchMinutes: 90,
  });
  close(
    calculateWeightedTrainingMinutesForPlayer({
      segments: substitute,
      playerId: 2,
      mainSkill: "scoring",
    }),
    30
  );

  const swap = reconstructPlayerPositionSegments({
    startingLineup: [
      { PlayerID: 1, RoleID: 106 },
      { PlayerID: 2, RoleID: 111 },
    ],
    orders: [{ OrderType: 3, SubjectPlayerID: 1, ObjectPlayerID: 2, MatchMinute: 45 }],
    totalMatchMinutes: 120,
  });
  close(
    calculateWeightedTrainingMinutesForPlayer({
      segments: swap,
      playerId: 1,
      mainSkill: "scoring",
    }),
    75
  );
}

{
  const weekA = new Date("2026-07-03T12:00:00Z");
  const weekB = new Date("2026-07-10T12:00:00Z");
  assert.deepEqual(
    summarizeWeeklyTraining([
      { matchDate: weekA, weightedMinutes: 90 },
      { matchDate: weekA, weightedMinutes: 90 },
    ]),
    {
      rawWeightedMinutes: 180,
      weeklyCappedMinutes: 90,
      equivalentTrainingWeeks: 1,
      weeks: [{ weekKey: "utc-2948", rawWeightedMinutes: 180, creditedMinutes: 90 }],
    }
  );
  close(
    summarizeWeeklyTraining([
      { matchDate: weekA, weightedMinutes: 90 },
      { matchDate: weekB, weightedMinutes: 90 },
    ]).equivalentTrainingWeeks,
    2
  );
  close(
    summarizeWeeklyTraining([{ matchDate: weekA, weightedMinutes: 75 }])
      .weeklyCappedMinutes,
    75
  );
  close(
    summarizeWeeklyTraining([{ matchDate: weekA, weightedMinutes: 120 }])
      .weeklyCappedMinutes,
    90
  );
}

{
  assert.equal(parsePsicoSkillValue("8.44"), 8.44);
  assert.equal(parsePsicoSkillValue("10.07"), 10.07);
  assert.equal(parsePsicoSkillValue("7.85"), 7.85);
  assert.equal(parsePsicoSkillValue("7.5"), 7.5);
  assert.equal(parsePsicoSkillValue("N/A"), null);
  assert.equal(parsePsicoSkillValue("bad"), null);
}

{
  let previousWeeks = 0;
  const expectedAdditional = [5.6, 6.7, 7.9, 8.9, 10.1, 12.0, 14.1, 17.3, 22.9, 36.7];
  for (let skill = 11; skill <= 20; skill += 1) {
    const weeks = calculateTrainingWeeksToReachSkill({
      mainSkill: "scoring",
      startingAgeYears: 18,
      startingAgeDays: 0,
      startingSkill: 10.04,
      targetSkill: skill,
    });
    assert.notEqual(weeks, null);
    close(
      Math.round(((weeks as number) - previousWeeks) * 10) / 10,
      expectedAdditional[skill - 11],
      1
    );
    previousWeeks = weeks as number;
  }
  const partial = inferTrainingAwareSkillUpperBound({
    mainSkill: "scoring",
    startingAgeYears: 18,
    startingAgeDays: 0,
    startingSkill: 10.04,
    equivalentTrainingWeeks: 5,
  });
  assert.equal(partial.status, "available");
  if (partial.status === "available") {
    assert.ok(partial.inferredSkill > 10.04);
    assert.ok(partial.inferredSkill < 11);
  }
  assert.deepEqual(
    inferTrainingAwareSkillUpperBound({
      mainSkill: "scoring",
      startingAgeYears: 18,
      startingAgeDays: 0,
      startingSkill: 10.04,
      equivalentTrainingWeeks: 0,
    }),
    { status: "available", inferredSkill: 10.04 }
  );
  assert.equal(
    inferTrainingAwareSkillUpperBound({
      mainSkill: "scoring",
      startingAgeYears: 40,
      startingAgeDays: 0,
      startingSkill: 10.04,
      equivalentTrainingWeeks: 1,
    }).status,
    "unsupported"
  );
}

{
  assert.equal(isTsiPredictionPossiblyInflated(10.01, 10), true);
  assert.equal(isTsiPredictionPossiblyInflated(10, 10.004), false);
  assert.equal(isTsiPredictionPossiblyInflated(9.99, 10), false);
  assert.equal(isTsiPredictionPossiblyInflated(null, 10), false);
}

{
  const state = resolveTrainingInferenceFromHistory({
    playerId: 1,
    metricInput: baseMetricInput,
    history: {
      status: "available",
      playerId: 1,
      mainSkill: "scoring",
      birthdayCutoff: "2026-01-01T00:00:00.000Z",
      rawWeightedMinutes: 0,
      weeklyCappedMinutes: 0,
      equivalentTrainingWeeks: 0,
      latestRelevantMatchDate: null,
      algorithmVersion: 1,
    },
  });
  assert.equal(state.status, "available");
  if (state.status === "available") {
    close(state.equivalentTrainingWeeks, 0);
  }
  assert.equal(
    resolveTrainingInferenceFromHistory({
      playerId: 1,
      metricInput: { ...baseMetricInput, passing: 10 },
      history: null,
    }).status,
    "not-applicable"
  );
}
