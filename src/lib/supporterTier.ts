export const HATTRICK_SUPPORTER_TIERS = [
  "none",
  "silver",
  "gold",
  "platinum",
  "diamond",
] as const;

export type HattrickSupporterTier =
  (typeof HATTRICK_SUPPORTER_TIERS)[number];

const HATTRICK_SUPPORTER_TIER_SET = new Set<string>(HATTRICK_SUPPORTER_TIERS);

export function normalizeHattrickSupporterTier(
  value: unknown
): HattrickSupporterTier | null {
  if (value === null || value === undefined) return "none";
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return "none";
  return HATTRICK_SUPPORTER_TIER_SET.has(normalized)
    ? (normalized as HattrickSupporterTier)
    : null;
}

export function isAnyHattrickSupporter(
  tier: HattrickSupporterTier
): boolean {
  return tier !== "none";
}

export function hasGoldOrHigherSupporterTier(
  tier: HattrickSupporterTier
): boolean {
  return tier === "gold" || tier === "platinum" || tier === "diamond";
}
