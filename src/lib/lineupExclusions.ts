export type ExcludedPlayersState = Record<number, true>;

export const YOUTH_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY =
  "ya_youth_lineup_excluded_players_v1";
export const SENIOR_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY =
  "ya_senior_lineup_excluded_players_v1";

export const YOUTH_LINEUP_EXCLUSIONS_EVENT = "ya:youth-lineup-exclusions";
export const SENIOR_LINEUP_EXCLUSIONS_EVENT = "ya:senior-lineup-exclusions";

const sanitizeExcludedPlayers = (input: unknown): ExcludedPlayersState => {
  if (!input || typeof input !== "object") return {};
  const next: ExcludedPlayersState = {};
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== true) return;
    const playerId = Number(key);
    if (!Number.isFinite(playerId) || playerId <= 0) return;
    next[playerId] = true;
  });
  return next;
};

const readExcludedPlayers = (key: string): ExcludedPlayersState => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    return sanitizeExcludedPlayers(JSON.parse(raw));
  } catch {
    return {};
  }
};

const writeExcludedPlayers = (
  key: string,
  eventName: string,
  state: ExcludedPlayersState
): ExcludedPlayersState => {
  const sanitized = sanitizeExcludedPlayers(state);
  if (typeof window === "undefined") return sanitized;
  try {
    if (Object.keys(sanitized).length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(sanitized));
    }
    window.dispatchEvent(
      new CustomEvent(eventName, { detail: { excludedPlayers: sanitized } })
    );
  } catch {
    // Keep in-memory state even if localStorage is blocked.
  }
  return sanitized;
};

const toggleExcludedPlayer = (
  key: string,
  eventName: string,
  playerId: number
): ExcludedPlayersState => {
  const normalized = Number(playerId);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return readExcludedPlayers(key);
  }
  const current = readExcludedPlayers(key);
  const next = { ...current };
  if (next[normalized]) {
    delete next[normalized];
  } else {
    next[normalized] = true;
  }
  return writeExcludedPlayers(key, eventName, next);
};

const pruneExcludedPlayers = (
  key: string,
  eventName: string,
  currentPlayerIds: Iterable<number>
): ExcludedPlayersState => {
  const currentIds = new Set<number>();
  for (const rawId of currentPlayerIds) {
    const playerId = Number(rawId);
    if (Number.isFinite(playerId) && playerId > 0) currentIds.add(playerId);
  }
  const current = readExcludedPlayers(key);
  const next: ExcludedPlayersState = {};
  Object.keys(current).forEach((rawId) => {
    const playerId = Number(rawId);
    if (currentIds.has(playerId)) next[playerId] = true;
  });
  return writeExcludedPlayers(key, eventName, next);
};

export function readYouthLineupExcludedPlayers(): ExcludedPlayersState {
  return readExcludedPlayers(YOUTH_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY);
}

export function writeYouthLineupExcludedPlayers(
  state: ExcludedPlayersState
): ExcludedPlayersState {
  return writeExcludedPlayers(
    YOUTH_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY,
    YOUTH_LINEUP_EXCLUSIONS_EVENT,
    state
  );
}

export function toggleYouthLineupExcludedPlayer(
  playerId: number
): ExcludedPlayersState {
  return toggleExcludedPlayer(
    YOUTH_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY,
    YOUTH_LINEUP_EXCLUSIONS_EVENT,
    playerId
  );
}

export function pruneYouthLineupExcludedPlayers(
  currentPlayerIds: Iterable<number>
): ExcludedPlayersState {
  return pruneExcludedPlayers(
    YOUTH_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY,
    YOUTH_LINEUP_EXCLUSIONS_EVENT,
    currentPlayerIds
  );
}

export function readSeniorLineupExcludedPlayers(): ExcludedPlayersState {
  return readExcludedPlayers(SENIOR_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY);
}

export function writeSeniorLineupExcludedPlayers(
  state: ExcludedPlayersState
): ExcludedPlayersState {
  return writeExcludedPlayers(
    SENIOR_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY,
    SENIOR_LINEUP_EXCLUSIONS_EVENT,
    state
  );
}

export function toggleSeniorLineupExcludedPlayer(
  playerId: number
): ExcludedPlayersState {
  return toggleExcludedPlayer(
    SENIOR_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY,
    SENIOR_LINEUP_EXCLUSIONS_EVENT,
    playerId
  );
}

export function pruneSeniorLineupExcludedPlayers(
  currentPlayerIds: Iterable<number>
): ExcludedPlayersState {
  return pruneExcludedPlayers(
    SENIOR_LINEUP_EXCLUDED_PLAYERS_STORAGE_KEY,
    SENIOR_LINEUP_EXCLUSIONS_EVENT,
    currentPlayerIds
  );
}

export function isPlayerExcluded(
  excludedPlayers: ExcludedPlayersState,
  playerId: number | string | null | undefined
): boolean {
  const normalized = Number(playerId);
  return Number.isFinite(normalized) && normalized > 0 && excludedPlayers[normalized] === true;
}
