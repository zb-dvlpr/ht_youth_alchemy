import {
  applyTeamSpiritAttitude,
  calculateMidfieldPercent,
  calculateNaturalTeamSpirit,
  driftTeamSpiritDuration,
  type CoachLeadership,
  type TeamSpiritAttitude,
} from "@/lib/teamSpirit";
import {
  isFinishedMatch,
  isInProgressMatch,
  matchKey,
  type TeamSpiritMatch,
} from "@/lib/seniorTeamSpiritTimeline";

const DAY_MS = 86_400_000;

export type TeamSpiritBlockReason = "missingFinishedAttitude" | "matchInProgress";

export type TeamSpiritSimulationContext = {
  baselineCoachLeadership: CoachLeadership;
  baselineSportsPsychologistLevel: number;
  coachLeadershipOverride: CoachLeadership | null;
  coachLeadershipOverrideEffectiveFrom: number | null;
  simulatedSportsPsychologistLevel: number | null;
  sportsPsychologistOverrideEffectiveFrom: number | null;
};

export type TeamSpiritTimelineRow = {
  match: TeamSpiritMatch;
  attitude: TeamSpiritAttitude | null;
  calculatedBefore: number | null;
  before: number | null;
  beforeOverride: number | null;
  beforeOverridden: boolean;
  midfieldPercent: number | null;
  after: number | null;
  recoveryDays: number | null;
  afterRecovery: number | null;
  uncertain: boolean;
  blockedReason: TeamSpiritBlockReason | null;
  isFirstTeamSpiritMatch: boolean;
  usesSeasonStartNote: boolean;
};

export type TeamSpiritStatusMessage =
  | { kind: "coach"; leadership: CoachLeadership; effectiveFrom: number }
  | { kind: "psychologistLevel"; level: number; effectiveFrom: number }
  | { kind: "psychologistDisabled"; effectiveFrom: number };

function validTimestamp(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function fullElapsedDays(fromTime: number, toTime: number) {
  return Math.max(0, Math.floor((toTime - fromTime) / DAY_MS));
}

function activeCoachLeadership(time: number, context: TeamSpiritSimulationContext) {
  return context.coachLeadershipOverride !== null &&
    validTimestamp(context.coachLeadershipOverrideEffectiveFrom) &&
    context.coachLeadershipOverrideEffectiveFrom <= time
    ? context.coachLeadershipOverride
    : context.baselineCoachLeadership;
}

function activePsychologistLevel(time: number, context: TeamSpiritSimulationContext) {
  return context.simulatedSportsPsychologistLevel !== null &&
    validTimestamp(context.sportsPsychologistOverrideEffectiveFrom) &&
    context.sportsPsychologistOverrideEffectiveFrom <= time
    ? context.simulatedSportsPsychologistLevel
    : context.baselineSportsPsychologistLevel;
}

export function driftTeamSpiritAcrossInterval(
  currentTeamSpirit: number,
  fromTime: number,
  toTime: number,
  context: TeamSpiritSimulationContext
): number {
  const fullDays = fullElapsedDays(fromTime, toTime);
  const modeledEndTime = fromTime + fullDays * DAY_MS;
  if (fullDays === 0 || modeledEndTime <= fromTime) return currentTeamSpirit;

  const cutovers = [
    context.coachLeadershipOverrideEffectiveFrom,
    context.sportsPsychologistOverrideEffectiveFrom,
  ]
    .filter(
      (timestamp): timestamp is number =>
        validTimestamp(timestamp) && timestamp > fromTime && timestamp < modeledEndTime
    )
    .sort((a, b) => a - b)
    .filter((timestamp, index, all) => index === 0 || timestamp !== all[index - 1]);

  let current = currentTeamSpirit;
  let segmentStart = fromTime;
  for (const segmentEnd of [...cutovers, modeledEndTime]) {
    const durationDays = (segmentEnd - segmentStart) / DAY_MS;
    current = driftTeamSpiritDuration(
      current,
      durationDays,
      activeCoachLeadership(segmentStart, context),
      activePsychologistLevel(segmentStart, context)
    );
    segmentStart = segmentEnd;
  }
  return current;
}

export function calculateTeamSpiritRows(input: {
  matches: TeamSpiritMatch[];
  initialTeamSpirit: number | null;
  initialBlockedReason?: TeamSpiritBlockReason | null;
  attitudes: (match: TeamSpiritMatch) => TeamSpiritAttitude | null;
  beforeMatchOverrides: Record<string, number>;
  simulationContext: TeamSpiritSimulationContext;
  seasonStartTime: number | null;
}): {
  rows: TeamSpiritTimelineRow[];
  finalTeamSpirit: number | null;
  blockedReason: TeamSpiritBlockReason | null;
} {
  let current = input.initialTeamSpirit;
  let blockedReason = input.initialBlockedReason ?? null;
  const rows = input.matches.map((match, index) => {
    const key = matchKey(match);
    const isFirstTeamSpiritMatch = index === 0;
    const inProgress = isInProgressMatch(match);
    const finished = isFinishedMatch(match);
    const attitude = inProgress ? null : input.attitudes(match);
    const firstMatchProjected =
      isFirstTeamSpiritMatch &&
      !finished &&
      current !== null &&
      input.seasonStartTime !== null
        ? driftTeamSpiritAcrossInterval(
            current,
            input.seasonStartTime,
            match.sortTime,
            input.simulationContext
          )
        : current;
    const calculatedBefore = isFirstTeamSpiritMatch ? firstMatchProjected : current;
    const beforeOverride = isFirstTeamSpiritMatch
      ? null
      : input.beforeMatchOverrides[key] ?? null;
    const before = isFirstTeamSpiritMatch
      ? firstMatchProjected
      : beforeOverride ?? calculatedBefore;
    const midfieldPercent =
      before !== null && attitude ? calculateMidfieldPercent(before, attitude) : null;
    const after =
      before !== null && attitude ? applyTeamSpiritAttitude(before, attitude) : null;
    const nextMatch = input.matches[index + 1] ?? null;
    const recoveryDays = nextMatch ? fullElapsedDays(match.sortTime, nextMatch.sortTime) : null;
    const afterRecovery =
      after !== null && nextMatch !== null
        ? driftTeamSpiritAcrossInterval(
            after,
            match.sortTime,
            nextMatch.sortTime,
            input.simulationContext
          )
        : null;
    const rowBlockedReason =
      before === null
        ? blockedReason
        : inProgress
        ? "matchInProgress"
        : !attitude && finished
        ? "missingFinishedAttitude"
        : null;
    const rowUncertain = Boolean(rowBlockedReason);
    if (inProgress) {
      current = null;
      blockedReason = "matchInProgress";
    } else if (!attitude) {
      current = null;
      if (finished) blockedReason = "missingFinishedAttitude";
    } else if (after !== null) {
      current = afterRecovery ?? after;
      blockedReason = null;
    } else {
      current = null;
    }
    return {
      match,
      attitude,
      calculatedBefore,
      before,
      beforeOverride,
      beforeOverridden: beforeOverride !== null,
      midfieldPercent,
      after,
      recoveryDays,
      afterRecovery,
      uncertain: rowUncertain,
      blockedReason: rowBlockedReason,
      isFirstTeamSpiritMatch,
      usesSeasonStartNote:
        isFirstTeamSpiritMatch &&
        firstMatchProjected === input.initialTeamSpirit &&
        calculatedBefore === input.initialTeamSpirit,
    };
  });
  return { rows, finalTeamSpirit: current, blockedReason };
}

export function calculateBaselineSeasonStartTeamSpirit(
  baselineSportsPsychologistLevel: number
) {
  return calculateNaturalTeamSpirit(baselineSportsPsychologistLevel);
}

export function getCoachSimulationStatus(input: {
  coachLeadershipOverride: CoachLeadership | null;
  coachLeadershipOverrideEffectiveFrom: number | null;
}): TeamSpiritStatusMessage | null {
  return input.coachLeadershipOverride !== null &&
    validTimestamp(input.coachLeadershipOverrideEffectiveFrom)
    ? {
        kind: "coach",
        leadership: input.coachLeadershipOverride,
        effectiveFrom: input.coachLeadershipOverrideEffectiveFrom,
      }
    : null;
}

export function getPsychologistSimulationStatus(input: {
  sportsPsychologistEnabledOverride: boolean | null;
  sportsPsychologistLevelOverride: number | null;
  simulatedSportsPsychologistLevel: number | null;
  sportsPsychologistOverrideEffectiveFrom: number | null;
}): TeamSpiritStatusMessage | null {
  const overridden =
    input.sportsPsychologistEnabledOverride !== null ||
    input.sportsPsychologistLevelOverride !== null;
  if (!overridden || !validTimestamp(input.sportsPsychologistOverrideEffectiveFrom)) {
    return null;
  }
  if (input.simulatedSportsPsychologistLevel === 0) {
    return {
      kind: "psychologistDisabled",
      effectiveFrom: input.sportsPsychologistOverrideEffectiveFrom,
    };
  }
  return {
    kind: "psychologistLevel",
    level: input.simulatedSportsPsychologistLevel ?? 0,
    effectiveFrom: input.sportsPsychologistOverrideEffectiveFrom,
  };
}
