const HATTRICK_AGE_DAYS_PER_YEAR = 112;
const DAY_MS = 86_400_000;

export function resolveLastBirthdayCutoff(input: {
  ageYears: number;
  ageDays: number;
  referenceDate: Date;
}): Date {
  const ageYears = Math.floor(input.ageYears);
  const ageDays = Math.floor(input.ageDays);
  const referenceTime = input.referenceDate.getTime();
  if (
    !Number.isFinite(ageYears) ||
    !Number.isFinite(ageDays) ||
    ageYears < 17 ||
    ageDays < 0 ||
    ageDays >= HATTRICK_AGE_DAYS_PER_YEAR ||
    !Number.isFinite(referenceTime)
  ) {
    return new Date(Number.NaN);
  }

  return new Date(referenceTime - ageDays * DAY_MS);
}

export function resolveHattrickAgeYearFraction(ageYears: number, ageDays: number) {
  return ageYears + ageDays / HATTRICK_AGE_DAYS_PER_YEAR;
}

