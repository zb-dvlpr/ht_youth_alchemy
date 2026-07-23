const DAY_MS = 86_400_000;
const TRAINING_WEEK_MS = 7 * DAY_MS;

export type TrainingUpdateSchedule = {
  timezone: "UTC";
  boundaryWeekdayUtc: number;
  boundaryHourUtc: number;
};

export const DEFAULT_TRAINING_UPDATE_SCHEDULE: TrainingUpdateSchedule = {
  timezone: "UTC",
  boundaryWeekdayUtc: 4,
  boundaryHourUtc: 0,
};

export type WeightedTrainingMinuteEntry = {
  matchDate: Date;
  weightedMinutes: number;
};

export type TrainingWeekSummary = {
  weekKey: string;
  rawWeightedMinutes: number;
  creditedMinutes: number;
};

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function resolveHattrickTrainingWeekKey(input: {
  matchDate: Date;
  leagueId?: number | null;
  trainingUpdateSchedule?: TrainingUpdateSchedule;
}) {
  const schedule =
    input.trainingUpdateSchedule ?? DEFAULT_TRAINING_UPDATE_SCHEDULE;
  const matchTime = input.matchDate.getTime();
  if (!Number.isFinite(matchTime)) return null;

  const boundaryOffsetMs = schedule.boundaryHourUtc * 3_600_000;
  const shifted = new Date(matchTime - boundaryOffsetMs);
  const weekdayDelta =
    (shifted.getUTCDay() - schedule.boundaryWeekdayUtc + 7) % 7;
  const weekStartTime = startOfUtcDay(shifted) - weekdayDelta * DAY_MS + boundaryOffsetMs;
  const weekIndex = Math.floor(weekStartTime / TRAINING_WEEK_MS);
  return `utc-${weekIndex}`;
}

export function summarizeWeeklyTraining(
  entries: WeightedTrainingMinuteEntry[],
  trainingUpdateSchedule: TrainingUpdateSchedule = DEFAULT_TRAINING_UPDATE_SCHEDULE
) {
  const byWeek = new Map<string, number>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.weightedMinutes) || entry.weightedMinutes <= 0) {
      continue;
    }
    const weekKey = resolveHattrickTrainingWeekKey({
      matchDate: entry.matchDate,
      trainingUpdateSchedule,
    });
    if (!weekKey) continue;
    byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + entry.weightedMinutes);
  }

  const weeks = [...byWeek.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekKey, rawWeightedMinutes]) => ({
      weekKey,
      rawWeightedMinutes,
      creditedMinutes: Math.min(90, rawWeightedMinutes),
    }));

  const rawWeightedMinutes = weeks.reduce(
    (sum, week) => sum + week.rawWeightedMinutes,
    0
  );
  const weeklyCappedMinutes = weeks.reduce(
    (sum, week) => sum + week.creditedMinutes,
    0
  );
  return {
    rawWeightedMinutes,
    weeklyCappedMinutes,
    equivalentTrainingWeeks: weeklyCappedMinutes / 90,
    weeks,
  };
}

