export const GLOBAL_SEASON_STORAGE_KEY = "ya_global_season_v1";

declare global {
  interface Window {
    __YA_GLOBAL_SEASON__?: number;
  }
}

const toValidSeason = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.floor(numeric);
  if (rounded <= 0) return null;
  return rounded;
};

export const extractSeasonFromManagerCompendiumPayload = (
  payload: unknown
): number | null => {
  if (!payload || typeof payload !== "object") return null;
  const topLevel = toValidSeason((payload as Record<string, unknown>).season);
  if (topLevel !== null) return topLevel;
  const manager = (payload as Record<string, unknown>)?.data as
    | { HattrickData?: { Manager?: { Teams?: { Team?: unknown } } } }
    | undefined;
  const teamsNode = manager?.HattrickData?.Manager?.Teams?.Team;
  const teams = Array.isArray(teamsNode) ? teamsNode : teamsNode ? [teamsNode] : [];
  for (const team of teams) {
    const season = toValidSeason(
      (team as { League?: { Season?: unknown } })?.League?.Season
    );
    if (season !== null) return season;
  }
  return null;
};

export const writeGlobalSeason = (season: number | null) => {
  if (typeof window === "undefined") return;
  if (season === null || !Number.isFinite(season) || season <= 0) return;
  const normalized = Math.floor(season);
  window.__YA_GLOBAL_SEASON__ = normalized;
  try {
    window.localStorage.setItem(GLOBAL_SEASON_STORAGE_KEY, String(normalized));
  } catch {
    // ignore storage errors
  }
};

export const readGlobalSeason = (): number | null => {
  if (typeof window === "undefined") return null;
  const memorySeason = toValidSeason(window.__YA_GLOBAL_SEASON__);
  if (memorySeason !== null) return memorySeason;
  try {
    const stored = window.localStorage.getItem(GLOBAL_SEASON_STORAGE_KEY);
    return toValidSeason(stored);
  } catch {
    return null;
  }
};

