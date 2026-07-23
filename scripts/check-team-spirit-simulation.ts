import assert from "node:assert/strict";
import {
  applyTeamSpiritAttitude,
  calculateNaturalTeamSpirit,
  driftTeamSpiritDays,
  driftTeamSpiritDuration,
  type TeamSpiritAttitude,
} from "../src/lib/teamSpirit";
import {
  calculateTeamSpiritRows,
  driftTeamSpiritAcrossInterval,
  getCoachSimulationStatus,
  getPsychologistSimulationStatus,
  type TeamSpiritSimulationContext,
} from "../src/lib/teamSpiritSimulation";
import {
  normalizePsychologistSimulationState,
  resetCoachSimulation,
  resetPsychologistSimulation,
  sanitizeSeniorTeamSpiritSettings,
  type SeniorTeamSpiritSettings,
} from "../src/lib/seniorTeamSpiritStorage";
import type { TeamSpiritMatch } from "../src/lib/seniorTeamSpiritTimeline";

const DAY = 86_400_000;
const EPSILON = 1e-8;

function close(actual: number, expected: number, message?: string) {
  assert.ok(
    Math.abs(actual - expected) < EPSILON,
    `${message ?? "values differ"}: expected ${expected}, received ${actual}`
  );
}

function context(
  overrides: Partial<TeamSpiritSimulationContext> = {}
): TeamSpiritSimulationContext {
  return {
    baselineCoachLeadership: "weak",
    baselineSportsPsychologistLevel: 0,
    coachLeadershipOverride: null,
    coachLeadershipOverrideEffectiveFrom: null,
    simulatedSportsPsychologistLevel: null,
    sportsPsychologistOverrideEffectiveFrom: null,
    ...overrides,
  };
}

function match(
  id: number,
  sortTime: number,
  status: "FINISHED" | "ONGOING" | "UPCOMING"
): TeamSpiritMatch {
  return {
    MatchID: id,
    MatchDate: "2026-07-01 12:00:00",
    Status: status,
    MatchType: 1,
    CupLevel: 0,
    SourceSystem: "Hattrick",
    HomeTeam: { HomeTeamName: "Home", HomeTeamID: 1 },
    AwayTeam: { AwayTeamName: "Away", AwayTeamID: 2 },
    sortTime,
    derivedStatus: status,
    isSyntheticPlaceholder: false,
  };
}

function settings(overrides: Partial<SeniorTeamSpiritSettings> = {}): SeniorTeamSpiritSettings {
  return {
    schemaVersion: 3,
    teamId: 1,
    season: 90,
    coachLeadershipOverride: null,
    coachLeadershipOverrideEffectiveFrom: null,
    sportsPsychologistEnabledOverride: null,
    sportsPsychologistLevelOverride: null,
    sportsPsychologistOverrideEffectiveFrom: null,
    upcomingAttitudes: {},
    teamSpiritBeforeMatchOverrides: {},
    updatedAt: 1_000,
    ...overrides,
  };
}

{
  const value = 8.4;
  close(
    driftTeamSpiritAcrossInterval(value, 0, 6 * DAY, context()),
    driftTeamSpiritDays(value, 6, "weak", 0),
    "no simulation matches daily drift"
  );
}

{
  const value = 8.4;
  close(driftTeamSpiritDuration(value, 1, "weak", 0), driftTeamSpiritDays(value, 1, "weak", 0));
  close(
    driftTeamSpiritDuration(value, 4, "passable", 3),
    driftTeamSpiritDays(value, 4, "passable", 3),
    "integer duration matches repeated daily drift"
  );
  close(
    driftTeamSpiritDuration(driftTeamSpiritDuration(value, 1.5, "solid", 3), 2.5, "solid", 3),
    driftTeamSpiritDuration(value, 4, "solid", 3),
    "fractional same-configuration segments compose"
  );
  close(driftTeamSpiritDuration(value, 0, "weak", 0), value, "zero duration unchanged");
  close(driftTeamSpiritDuration(value, -1, "weak", 0), value, "negative duration unchanged");
}

{
  const value = 8.4;
  const halfCut = driftTeamSpiritAcrossInterval(
    value,
    0,
    6 * DAY,
    context({ coachLeadershipOverride: "solid", coachLeadershipOverrideEffectiveFrom: 3 * DAY })
  );
  const expected = driftTeamSpiritDuration(
    driftTeamSpiritDuration(value, 3, "weak", 0),
    3,
    "solid",
    0
  );
  close(halfCut, expected, "coach cutover splits interval");
  close(
    driftTeamSpiritAcrossInterval(
      value,
      0,
      6 * DAY,
      context({ coachLeadershipOverride: "solid", coachLeadershipOverrideEffectiveFrom: 7 * DAY })
    ),
    driftTeamSpiritDuration(value, 6, "weak", 0),
    "coach cutover after interval ignored"
  );
  close(
    driftTeamSpiritAcrossInterval(
      value,
      0,
      6 * DAY,
      context({ coachLeadershipOverride: "solid", coachLeadershipOverrideEffectiveFrom: -1 })
    ),
    driftTeamSpiritDuration(value, 6, "weak", 0),
    "invalid coach cutover ignored"
  );
  close(
    driftTeamSpiritAcrossInterval(
      value,
      DAY,
      7 * DAY,
      context({ coachLeadershipOverride: "solid", coachLeadershipOverrideEffectiveFrom: 1 })
    ),
    driftTeamSpiritDuration(value, 6, "solid", 0),
    "coach cutover before interval applies throughout"
  );
  close(
    driftTeamSpiritAcrossInterval(
      value,
      DAY,
      7 * DAY,
      context({ coachLeadershipOverride: "solid", coachLeadershipOverrideEffectiveFrom: DAY })
    ),
    driftTeamSpiritDuration(value, 6, "solid", 0),
    "coach cutover at interval start applies immediately"
  );
  close(
    driftTeamSpiritAcrossInterval(
      value,
      0,
      6 * DAY,
      context({ coachLeadershipOverride: "solid", coachLeadershipOverrideEffectiveFrom: 0 })
    ),
    driftTeamSpiritDuration(value, 6, "weak", 0),
    "zero timestamp is invalid"
  );
  close(
    driftTeamSpiritAcrossInterval(
      value,
      0,
      6 * DAY,
      context({ coachLeadershipOverride: "solid", coachLeadershipOverrideEffectiveFrom: 6 * DAY })
    ),
    driftTeamSpiritDuration(value, 6, "weak", 0),
    "coach cutover at modeled end does not affect interval"
  );
}

{
  const value = 8.4;
  const result = driftTeamSpiritAcrossInterval(
    value,
    0,
    6 * DAY,
    context({ simulatedSportsPsychologistLevel: 3, sportsPsychologistOverrideEffectiveFrom: DAY })
  );
  const expected = driftTeamSpiritDuration(
    driftTeamSpiritDuration(value, 1, "weak", 0),
    5,
    "weak",
    3
  );
  close(result, expected, "psychologist cutover applies after timestamp");
  close(
    driftTeamSpiritAcrossInterval(
      value,
      0,
      DAY,
      context({ simulatedSportsPsychologistLevel: 3, sportsPsychologistOverrideEffectiveFrom: 2 * DAY })
    ),
    driftTeamSpiritDuration(value, 1, "weak", 0),
    "earlier historical interval unchanged"
  );
}

{
  const value = 8.4;
  const result = driftTeamSpiritAcrossInterval(
    value,
    0,
    6 * DAY,
    context({
      coachLeadershipOverride: "solid",
      coachLeadershipOverrideEffectiveFrom: DAY,
      simulatedSportsPsychologistLevel: 3,
      sportsPsychologistOverrideEffectiveFrom: 3 * DAY,
    })
  );
  const expected = driftTeamSpiritDuration(
    driftTeamSpiritDuration(
      driftTeamSpiritDuration(value, 1, "weak", 0),
      2,
      "solid",
      0
    ),
    3,
    "solid",
    3
  );
  close(result, expected, "independent cutovers apply in order");
  close(
    driftTeamSpiritAcrossInterval(
      value,
      0,
      6 * DAY,
      context({
        coachLeadershipOverride: "solid",
        coachLeadershipOverrideEffectiveFrom: 2 * DAY,
        simulatedSportsPsychologistLevel: 3,
        sportsPsychologistOverrideEffectiveFrom: 2 * DAY,
      })
    ),
    driftTeamSpiritDuration(
      driftTeamSpiritDuration(value, 2, "weak", 0),
      4,
      "solid",
      3
    ),
    "duplicate cutovers are de-duplicated"
  );
}

{
  const matches = [match(1, 0, "FINISHED"), match(2, 7 * DAY, "FINISHED"), match(3, 14 * DAY, "UPCOMING")];
  const attitudes: Record<number, TeamSpiritAttitude | null> = { 1: "PIN", 2: "PIN", 3: "PIN" };
  const baseline = calculateTeamSpiritRows({
    matches,
    initialTeamSpirit: calculateNaturalTeamSpirit(0),
    attitudes: (item) => attitudes[item.MatchID ?? 0],
    beforeMatchOverrides: {},
    simulationContext: context(),
    seasonStartTime: -7 * DAY,
  }).rows;
  const simulated = calculateTeamSpiritRows({
    matches,
    initialTeamSpirit: calculateNaturalTeamSpirit(0),
    attitudes: (item) => attitudes[item.MatchID ?? 0],
    beforeMatchOverrides: {},
    simulationContext: context({
      simulatedSportsPsychologistLevel: 3,
      sportsPsychologistOverrideEffectiveFrom: 10 * DAY,
    }),
    seasonStartTime: -7 * DAY,
  }).rows;
  close(simulated[0].before ?? 0, baseline[0].before ?? 1, "first finished row unchanged");
  close(simulated[1].before ?? 0, baseline[1].before ?? 1, "second finished row unchanged");
  assert.notEqual(simulated[2].before, baseline[2].before, "upcoming row changes after cutover");

  const overridden = calculateTeamSpiritRows({
    matches,
    initialTeamSpirit: calculateNaturalTeamSpirit(0),
    attitudes: (item) => attitudes[item.MatchID ?? 0],
    beforeMatchOverrides: { "Hattrick:2": 7.5 },
    simulationContext: context(),
    seasonStartTime: -7 * DAY,
  }).rows;
  assert.equal(overridden[1].before, 7.5);

  const blocked = calculateTeamSpiritRows({
    matches,
    initialTeamSpirit: calculateNaturalTeamSpirit(0),
    attitudes: (item) => (item.MatchID === 1 ? null : "PIN"),
    beforeMatchOverrides: {},
    simulationContext: context(),
    seasonStartTime: -7 * DAY,
  }).rows;
  assert.equal(blocked[1].blockedReason, "missingFinishedAttitude");

  const ongoing = calculateTeamSpiritRows({
    matches: [match(1, 0, "FINISHED"), match(2, 7 * DAY, "ONGOING"), match(3, 14 * DAY, "UPCOMING")],
    initialTeamSpirit: calculateNaturalTeamSpirit(0),
    attitudes: () => "PIN",
    beforeMatchOverrides: {},
    simulationContext: context(),
    seasonStartTime: -7 * DAY,
  }).rows;
  assert.equal(ongoing[2].blockedReason, "matchInProgress");
}

{
  const first = [match(1, 7 * DAY, "UPCOMING")];
  const result = calculateTeamSpiritRows({
    matches: first,
    initialTeamSpirit: calculateNaturalTeamSpirit(0),
    attitudes: () => "PIN",
    beforeMatchOverrides: {},
    simulationContext: context({
      simulatedSportsPsychologistLevel: 3,
      sportsPsychologistOverrideEffectiveFrom: 4 * DAY,
    }),
    seasonStartTime: 0,
  }).rows[0].before;
  const expected = driftTeamSpiritDuration(calculateNaturalTeamSpirit(0), 3, "weak", 3);
  close(result ?? 0, expected, "first upcoming match uses only post-cutover drift");
  assert.notEqual(result, calculateNaturalTeamSpirit(3));

  const independent = calculateTeamSpiritRows({
    matches: first,
    initialTeamSpirit: 8,
    attitudes: () => "PIN",
    beforeMatchOverrides: {},
    simulationContext: context({
      coachLeadershipOverride: "solid",
      coachLeadershipOverrideEffectiveFrom: 2 * DAY,
      simulatedSportsPsychologistLevel: 3,
      sportsPsychologistOverrideEffectiveFrom: 4 * DAY,
    }),
    seasonStartTime: 0,
  }).rows[0].before;
  const independentExpected = driftTeamSpiritDuration(
    driftTeamSpiritDuration(
      driftTeamSpiritDuration(8, 2, "weak", 0),
      2,
      "solid",
      0
    ),
    3,
    "solid",
    3
  );
  close(independent ?? 0, independentExpected, "first-match independent cutovers");
}

{
  const base = settings({
    coachLeadershipOverride: "solid",
    coachLeadershipOverrideEffectiveFrom: 123,
    sportsPsychologistEnabledOverride: true,
    sportsPsychologistLevelOverride: 3,
    sportsPsychologistOverrideEffectiveFrom: 456,
  });
  assert.equal(sanitizeSeniorTeamSpiritSettings(base)?.coachLeadershipOverrideEffectiveFrom, 123);
  assert.equal(
    sanitizeSeniorTeamSpiritSettings(settings({ coachLeadershipOverrideEffectiveFrom: 123 }))
      ?.coachLeadershipOverrideEffectiveFrom,
    null
  );
  assert.equal(resetCoachSimulation(base).coachLeadershipOverrideEffectiveFrom, null);
  assert.equal(resetCoachSimulation(base).sportsPsychologistOverrideEffectiveFrom, 456);
  assert.equal(resetPsychologistSimulation(base).coachLeadershipOverrideEffectiveFrom, 123);
  assert.equal(resetPsychologistSimulation(base).sportsPsychologistOverrideEffectiveFrom, null);
  assert.deepEqual(normalizePsychologistSimulationState({
    detectedSportsPsychologistLevel: 3,
    enabled: true,
    level: 3,
    effectiveFrom: 999,
  }), {
    sportsPsychologistEnabledOverride: null,
    sportsPsychologistLevelOverride: null,
    sportsPsychologistOverrideEffectiveFrom: null,
  });
  assert.deepEqual(normalizePsychologistSimulationState({
    detectedSportsPsychologistLevel: 0,
    enabled: true,
    level: 1,
    effectiveFrom: 999,
  }), {
    sportsPsychologistEnabledOverride: true,
    sportsPsychologistLevelOverride: 1,
    sportsPsychologistOverrideEffectiveFrom: 999,
  });
  assert.deepEqual(normalizePsychologistSimulationState({
    detectedSportsPsychologistLevel: 0,
    enabled: false,
    level: 1,
    effectiveFrom: 999,
  }), {
    sportsPsychologistEnabledOverride: null,
    sportsPsychologistLevelOverride: null,
    sportsPsychologistOverrideEffectiveFrom: null,
  });
}

{
  const migratedCoach = sanitizeSeniorTeamSpiritSettings({
    schemaVersion: 2,
    teamId: 1,
    season: 90,
    coachLeadershipOverride: "solid",
    updatedAt: 1234,
    upcomingAttitudes: { a: "PIC" },
    teamSpiritBeforeMatchOverrides: { b: 7.5 },
  });
  assert.equal(migratedCoach?.schemaVersion, 3);
  assert.equal(migratedCoach?.coachLeadershipOverrideEffectiveFrom, 1234);
  assert.deepEqual(migratedCoach?.upcomingAttitudes, { a: "PIC" });
  assert.deepEqual(migratedCoach?.teamSpiritBeforeMatchOverrides, { b: 7.5 });

  const migratedPsychologist = sanitizeSeniorTeamSpiritSettings({
    schemaVersion: 2,
    teamId: 1,
    season: 90,
    sportsPsychologistLevelOverride: 3,
    updatedAt: 4321,
  });
  assert.equal(migratedPsychologist?.sportsPsychologistOverrideEffectiveFrom, 4321);

  const fallback = sanitizeSeniorTeamSpiritSettings({
    schemaVersion: 2,
    teamId: 1,
    season: 90,
    coachLeadershipOverride: "solid",
    sportsPsychologistEnabledOverride: false,
    updatedAt: "bad",
  }, 9999);
  assert.equal(fallback?.coachLeadershipOverrideEffectiveFrom, 9999);
  assert.equal(fallback?.sportsPsychologistOverrideEffectiveFrom, 9999);

  const preserved = sanitizeSeniorTeamSpiritSettings(settings({
    coachLeadershipOverride: "solid",
    coachLeadershipOverrideEffectiveFrom: 222,
    sportsPsychologistEnabledOverride: true,
    sportsPsychologistOverrideEffectiveFrom: 333,
  }));
  assert.equal(preserved?.coachLeadershipOverrideEffectiveFrom, 222);
  assert.equal(preserved?.sportsPsychologistOverrideEffectiveFrom, 333);
  assert.equal(
    sanitizeSeniorTeamSpiritSettings(settings({ sportsPsychologistOverrideEffectiveFrom: 333 }))
      ?.sportsPsychologistOverrideEffectiveFrom,
    null
  );
}

{
  assert.deepEqual(getCoachSimulationStatus({
    coachLeadershipOverride: "solid",
    coachLeadershipOverrideEffectiveFrom: 123,
  }), { kind: "coach", leadership: "solid", effectiveFrom: 123 });
  assert.equal(getCoachSimulationStatus({
    coachLeadershipOverride: "solid",
    coachLeadershipOverrideEffectiveFrom: null,
  }), null);
  assert.deepEqual(getPsychologistSimulationStatus({
    sportsPsychologistEnabledOverride: true,
    sportsPsychologistLevelOverride: null,
    simulatedSportsPsychologistLevel: 3,
    sportsPsychologistOverrideEffectiveFrom: 456,
  }), { kind: "psychologistLevel", level: 3, effectiveFrom: 456 });
  assert.deepEqual(getPsychologistSimulationStatus({
    sportsPsychologistEnabledOverride: false,
    sportsPsychologistLevelOverride: null,
    simulatedSportsPsychologistLevel: 0,
    sportsPsychologistOverrideEffectiveFrom: 456,
  }), { kind: "psychologistDisabled", effectiveFrom: 456 });
  assert.equal(getPsychologistSimulationStatus({
    sportsPsychologistEnabledOverride: null,
    sportsPsychologistLevelOverride: null,
    simulatedSportsPsychologistLevel: null,
    sportsPsychologistOverrideEffectiveFrom: 456,
  }), null);
  assert.equal(getPsychologistSimulationStatus({
    sportsPsychologistEnabledOverride: true,
    sportsPsychologistLevelOverride: null,
    simulatedSportsPsychologistLevel: 3,
    sportsPsychologistOverrideEffectiveFrom: Number.NaN,
  }), null);
}

{
  const before = 8;
  const after = applyTeamSpiritAttitude(before, "PIC");
  assert.ok(after > before);
}

console.log("Team spirit simulation checks passed.");
