export type InjuryStatus = {
  raw: number | null;
  isKnown: boolean;
  isHealthy: boolean;
  isBruised: boolean;
  isInjured: boolean;
  injuryWeeks: number | null;
};

export function resolveInjuryStatus(value: unknown): InjuryStatus {
  const raw =
    typeof value === "number" && Number.isFinite(value) ? value : null;
  if (raw === null) {
    return {
      raw: null,
      isKnown: false,
      isHealthy: false,
      isBruised: false,
      isInjured: false,
      injuryWeeks: null,
    };
  }
  const injuryWeeks = raw >= 1 ? Math.ceil(raw) : null;
  return {
    raw,
    isKnown: true,
    isHealthy: raw === -1,
    isBruised: raw === 0,
    isInjured: injuryWeeks !== null,
    injuryWeeks,
  };
}
