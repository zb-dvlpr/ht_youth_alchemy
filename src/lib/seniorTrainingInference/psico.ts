export function parsePsicoSkillValue(
  value: string | number | null | undefined
): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const rounded = Math.round(value * 100);
    return rounded >= 0 ? rounded / 100 : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = Number(match[1]);
  const decimals = Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isFinite(whole) || !Number.isFinite(decimals)) return null;
  return (whole * 100 + decimals) / 100;
}

export function roundSkillToDisplayedPrecision(value: number) {
  return Math.round(value * 100) / 100;
}

export function isTsiPredictionPossiblyInflated(
  tsiPrediction: number | null,
  inferredUpperBound: number | null
) {
  if (
    typeof tsiPrediction !== "number" ||
    !Number.isFinite(tsiPrediction) ||
    typeof inferredUpperBound !== "number" ||
    !Number.isFinite(inferredUpperBound)
  ) {
    return false;
  }
  return (
    roundSkillToDisplayedPrecision(tsiPrediction) >
    roundSkillToDisplayedPrecision(inferredUpperBound)
  );
}

