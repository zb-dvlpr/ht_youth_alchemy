export type ExcludedPlayersState = Record<number, true>;

export type LineupExclusionScope = "youth" | "senior";

type LineupExclusionsArgs = {
  scope: LineupExclusionScope;
  teamId: number | null | undefined;
  userKey?: string | null;
};

type LineupExclusionPlayerArgs = LineupExclusionsArgs & {
  playerId: number;
};

type LineupExclusionSetArgs = LineupExclusionPlayerArgs & {
  excluded: boolean;
};

type LineupExclusionPruneArgs = LineupExclusionsArgs & {
  currentPlayerIds: Iterable<number>;
};

type LineupExclusionRecord = {
  key: string;
  scopeTeamUserKey: string;
  userKey: string;
  scope: LineupExclusionScope;
  teamId: number;
  playerId: number;
  updatedAt: number;
};

type SanitizedLineupExclusionsArgs = {
  scope: LineupExclusionScope;
  teamId: number;
  userKey: string;
};

export const YOUTH_LINEUP_EXCLUSIONS_EVENT = "ya:youth-lineup-exclusions";
export const SENIOR_LINEUP_EXCLUSIONS_EVENT = "ya:senior-lineup-exclusions";

const DB_NAME = "ht_youth_alchemy";
const DB_VERSION = 1;
const STORE_NAME = "lineup_exclusions";
const SCOPE_TEAM_USER_INDEX = "scopeTeamUserKey";
const DEFAULT_USER_KEY = "default";

const dbRequestPromiseByName = new Map<string, Promise<IDBDatabase | null>>();
const inMemoryFallbackState = new Map<string, ExcludedPlayersState>();

const sanitizePositiveInteger = (input: unknown): number | null => {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
};

const sanitizeUserKey = (input: string | null | undefined): string => {
  const trimmed = typeof input === "string" ? input.trim() : "";
  return trimmed || DEFAULT_USER_KEY;
};

const sanitizeExcludedPlayers = (input: unknown): ExcludedPlayersState => {
  if (!input || typeof input !== "object") return {};
  const next: ExcludedPlayersState = {};
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== true) return;
    const playerId = sanitizePositiveInteger(key);
    if (playerId === null) return;
    next[playerId] = true;
  });
  return next;
};

const buildScopeTeamUserKey = (
  userKey: string,
  scope: LineupExclusionScope,
  teamId: number
) => `${encodeURIComponent(userKey)}:${scope}:${teamId}`;

const buildRecordKey = (
  userKey: string,
  scope: LineupExclusionScope,
  teamId: number,
  playerId: number
) => `${buildScopeTeamUserKey(userKey, scope, teamId)}:${playerId}`;

const getMemoryState = (args: SanitizedLineupExclusionsArgs): ExcludedPlayersState => ({
  ...(inMemoryFallbackState.get(
    buildScopeTeamUserKey(args.userKey, args.scope, args.teamId)
  ) ?? {}),
});

const setMemoryState = (
  args: SanitizedLineupExclusionsArgs,
  state: ExcludedPlayersState
) => {
  const key = buildScopeTeamUserKey(args.userKey, args.scope, args.teamId);
  const sanitized = sanitizeExcludedPlayers(state);
  if (Object.keys(sanitized).length === 0) {
    inMemoryFallbackState.delete(key);
  } else {
    inMemoryFallbackState.set(key, sanitized);
  }
  return sanitized;
};

const dispatchLineupExclusionsEvent = (
  scope: LineupExclusionScope,
  excludedPlayers: ExcludedPlayersState
) => {
  if (typeof window === "undefined") return;
  const eventName =
    scope === "youth" ? YOUTH_LINEUP_EXCLUSIONS_EVENT : SENIOR_LINEUP_EXCLUSIONS_EVENT;
  window.dispatchEvent(
    new CustomEvent(eventName, { detail: { excludedPlayers } })
  );
};

const openLineupExclusionsDb = (): Promise<IDBDatabase | null> => {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  const existing = dbRequestPromiseByName.get(DB_NAME);
  if (existing) return existing;
  const promise = new Promise<IDBDatabase | null>((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: "key" });
      if (store && !store.indexNames.contains(SCOPE_TEAM_USER_INDEX)) {
        store.createIndex(SCOPE_TEAM_USER_INDEX, SCOPE_TEAM_USER_INDEX, {
          unique: false,
        });
      }
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
  dbRequestPromiseByName.set(DB_NAME, promise);
  return promise;
};

const runStoreTransaction = async <T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => Promise<T> | T
): Promise<T | null> => {
  const db = await openLineupExclusionsDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    let settled = false;
    let result: T | null = null;
    try {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      Promise.resolve(callback(store))
        .then((value) => {
          result = value;
        })
        .catch(() => {
          result = null;
          try {
            transaction.abort();
          } catch {
            // Transaction may already be complete.
          }
        });
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      transaction.onerror = () => {
        if (settled) return;
        settled = true;
        resolve(null);
      };
      transaction.onabort = () => {
        if (settled) return;
        settled = true;
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const cursorRequestToRecords = (
  request: IDBRequest<IDBCursorWithValue | null>
): Promise<LineupExclusionRecord[]> =>
  new Promise((resolve, reject) => {
    const records: LineupExclusionRecord[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(records);
        return;
      }
      records.push(cursor.value as LineupExclusionRecord);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });

const readRecordsForScope = async (
  store: IDBObjectStore,
  args: SanitizedLineupExclusionsArgs
): Promise<LineupExclusionRecord[]> => {
  const scopeTeamUserKey = buildScopeTeamUserKey(
    args.userKey,
    args.scope,
    args.teamId
  );
  const index = store.index(SCOPE_TEAM_USER_INDEX);
  return cursorRequestToRecords(index.openCursor(IDBKeyRange.only(scopeTeamUserKey)));
};

const recordsToState = (
  records: Iterable<LineupExclusionRecord>
): ExcludedPlayersState => {
  const next: ExcludedPlayersState = {};
  for (const record of records) {
    const playerId = sanitizePositiveInteger(record.playerId);
    if (playerId !== null) next[playerId] = true;
  }
  return next;
};

const sanitizeArgs = (
  args: LineupExclusionsArgs
): SanitizedLineupExclusionsArgs | null => {
  const teamId = sanitizePositiveInteger(args.teamId);
  if (teamId === null) return null;
  return {
    scope: args.scope,
    teamId,
    userKey: sanitizeUserKey(args.userKey),
  };
};

export async function readLineupExcludedPlayers(
  args: LineupExclusionsArgs
): Promise<ExcludedPlayersState> {
  const sanitizedArgs = sanitizeArgs(args);
  if (!sanitizedArgs) return {};
  const result = await runStoreTransaction("readonly", async (store) => {
    const records = await readRecordsForScope(store, sanitizedArgs);
    return recordsToState(records);
  });
  if (result === null) return getMemoryState(sanitizedArgs);
  return sanitizeExcludedPlayers(result ?? {});
}

export async function setLineupExcludedPlayer(
  args: LineupExclusionSetArgs
): Promise<ExcludedPlayersState> {
  const sanitizedArgs = sanitizeArgs(args);
  const playerId = sanitizePositiveInteger(args.playerId);
  if (!sanitizedArgs || playerId === null) {
    return sanitizedArgs ? readLineupExcludedPlayers(sanitizedArgs) : {};
  }
  const result = await runStoreTransaction("readwrite", async (store) => {
    const key = buildRecordKey(
      sanitizedArgs.userKey,
      sanitizedArgs.scope,
      sanitizedArgs.teamId,
      playerId
    );
    if (args.excluded) {
      const scopeTeamUserKey = buildScopeTeamUserKey(
        sanitizedArgs.userKey,
        sanitizedArgs.scope,
        sanitizedArgs.teamId
      );
      await requestToPromise(
        store.put({
          key,
          scopeTeamUserKey,
          userKey: sanitizedArgs.userKey,
          scope: sanitizedArgs.scope,
          teamId: sanitizedArgs.teamId,
          playerId,
          updatedAt: Date.now(),
        } satisfies LineupExclusionRecord)
      );
    } else {
      await requestToPromise(store.delete(key));
    }
    const records = await readRecordsForScope(store, sanitizedArgs);
    return recordsToState(records);
  });
  if (result === null) {
    const next = getMemoryState(sanitizedArgs);
    if (args.excluded) {
      next[playerId] = true;
    } else {
      delete next[playerId];
    }
    const fallback = setMemoryState(sanitizedArgs, next);
    dispatchLineupExclusionsEvent(sanitizedArgs.scope, fallback);
    return fallback;
  }
  const next = sanitizeExcludedPlayers(result ?? {});
  dispatchLineupExclusionsEvent(sanitizedArgs.scope, next);
  return next;
}

export async function toggleLineupExcludedPlayer(
  args: LineupExclusionPlayerArgs
): Promise<ExcludedPlayersState> {
  const current = await readLineupExcludedPlayers(args);
  const playerId = sanitizePositiveInteger(args.playerId);
  if (playerId === null) return current;
  return setLineupExcludedPlayer({
    ...args,
    playerId,
    excluded: current[playerId] !== true,
  });
}

export async function pruneLineupExcludedPlayers(
  args: LineupExclusionPruneArgs
): Promise<ExcludedPlayersState> {
  const sanitizedArgs = sanitizeArgs(args);
  if (!sanitizedArgs) return {};
  const currentIds = new Set<number>();
  for (const rawId of args.currentPlayerIds) {
    const playerId = sanitizePositiveInteger(rawId);
    if (playerId !== null) currentIds.add(playerId);
  }
  const result = await runStoreTransaction("readwrite", async (store) => {
    const records = await readRecordsForScope(store, sanitizedArgs);
    await Promise.all(
      records
        .filter((record) => !currentIds.has(record.playerId))
        .map((record) => requestToPromise(store.delete(record.key)))
    );
    return recordsToState(
      records.filter((record) => currentIds.has(record.playerId))
    );
  });
  if (result === null) {
    const current = getMemoryState(sanitizedArgs);
    const next: ExcludedPlayersState = {};
    Object.keys(current).forEach((rawId) => {
      const playerId = sanitizePositiveInteger(rawId);
      if (playerId !== null && currentIds.has(playerId)) next[playerId] = true;
    });
    const fallback = setMemoryState(sanitizedArgs, next);
    dispatchLineupExclusionsEvent(sanitizedArgs.scope, fallback);
    return fallback;
  }
  const next = sanitizeExcludedPlayers(result ?? {});
  dispatchLineupExclusionsEvent(sanitizedArgs.scope, next);
  return next;
}

export const readYouthLineupExcludedPlayers = (
  args: Omit<LineupExclusionsArgs, "scope">
) => readLineupExcludedPlayers({ ...args, scope: "youth" });

export const setYouthLineupExcludedPlayer = (
  args: Omit<LineupExclusionSetArgs, "scope">
) => setLineupExcludedPlayer({ ...args, scope: "youth" });

export const toggleYouthLineupExcludedPlayer = (
  args: Omit<LineupExclusionPlayerArgs, "scope">
) => toggleLineupExcludedPlayer({ ...args, scope: "youth" });

export const pruneYouthLineupExcludedPlayers = (
  args: Omit<LineupExclusionPruneArgs, "scope">
) => pruneLineupExcludedPlayers({ ...args, scope: "youth" });

export const readSeniorLineupExcludedPlayers = (
  args: Omit<LineupExclusionsArgs, "scope">
) => readLineupExcludedPlayers({ ...args, scope: "senior" });

export const setSeniorLineupExcludedPlayer = (
  args: Omit<LineupExclusionSetArgs, "scope">
) => setLineupExcludedPlayer({ ...args, scope: "senior" });

export const toggleSeniorLineupExcludedPlayer = (
  args: Omit<LineupExclusionPlayerArgs, "scope">
) => toggleLineupExcludedPlayer({ ...args, scope: "senior" });

export const pruneSeniorLineupExcludedPlayers = (
  args: Omit<LineupExclusionPruneArgs, "scope">
) => pruneLineupExcludedPlayers({ ...args, scope: "senior" });

export function isPlayerExcluded(
  excludedPlayers: ExcludedPlayersState,
  playerId: number | string | null | undefined
): boolean {
  const normalized = Number(playerId);
  return Number.isFinite(normalized) && normalized > 0 && excludedPlayers[normalized] === true;
}
