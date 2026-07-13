export const normalizeSeniorShirtNumber = (
  value: number | null | undefined
): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 99
    ? value
    : null;

export const seniorPlayerNumberValue = (
  player: { PlayerNumber?: number | null; playerNumber?: number | null } | null | undefined
): number | null => normalizeSeniorShirtNumber(player?.PlayerNumber ?? player?.playerNumber);
