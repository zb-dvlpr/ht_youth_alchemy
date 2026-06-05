const DAY_MS = 24 * 60 * 60 * 1000;

export type YouthPromotionStatus = {
  raw: unknown;
  isKnown: boolean;
  timeUntilPromotionMs: number | null;
  promotionAt: number | null;
  isPromotableNowOrPast: boolean;
};

export function resolveYouthPromotionStatus(
  canBePromotedIn: unknown,
  now: number
): YouthPromotionStatus {
  const days =
    typeof canBePromotedIn === "number" && Number.isFinite(canBePromotedIn)
      ? canBePromotedIn
      : null;
  if (days === null) {
    return {
      raw: canBePromotedIn,
      isKnown: false,
      timeUntilPromotionMs: null,
      promotionAt: null,
      isPromotableNowOrPast: false,
    };
  }
  const timeUntilPromotionMs = days * DAY_MS;
  const promotionAt = now + timeUntilPromotionMs;
  return {
    raw: canBePromotedIn,
    isKnown: true,
    timeUntilPromotionMs,
    promotionAt,
    isPromotableNowOrPast: timeUntilPromotionMs <= 0,
  };
}
