import { TEAM_SPIRIT_LABELS, type CoachLeadership, type TeamSpiritAttitude } from "@/lib/teamSpirit";

export type SeniorTeamSpiritSettings = {
  schemaVersion: 2;
  teamId: number;
  season: number;
  coachLeadershipOverride: CoachLeadership | null;
  sportsPsychologistEnabledOverride: boolean | null;
  sportsPsychologistLevelOverride: number | null;
  upcomingAttitudes: Record<string, TeamSpiritAttitude>;
  teamSpiritBeforeMatchOverrides: Record<string, number>;
  updatedAt: number;
};

export type SeniorTeamSpiritStorageExport = {
  settings: SeniorTeamSpiritSettings[];
};

const DB_NAME = "hattrick-alchemy-senior-team-spirit";
const DB_VERSION = 1;
const STORE_NAME = "settings";
const LOCAL_STORAGE_PREFIX = "ya_senior_team_spirit_settings_v1_";
const MAX_SPORTS_PSYCHOLOGIST_LEVEL = 5;
const VALID_TEAM_SPIRIT_VALUES = new Set(TEAM_SPIRIT_LABELS.map((entry) => entry.value));

let dbPromise: Promise<IDBDatabase | null> | null = null;

function buildSettingsKey(teamId: number, season: number) {
  return `senior-team-spirit-settings:${teamId}:${season}`;
}

function sanitizePositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function isCoachLeadership(value: unknown): value is CoachLeadership {
  return (
    value === "solid" ||
    value === "passable" ||
    value === "inadequate" ||
    value === "weak" ||
    value === "poor" ||
    value === "wretched" ||
    value === "disastrous" ||
    value === "non-existent"
  );
}

function isTeamSpiritAttitude(value: unknown): value is TeamSpiritAttitude {
  return value === "PIC" || value === "PIN" || value === "MOTS";
}

function sanitizeTeamSpiritValue(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return VALID_TEAM_SPIRIT_VALUES.has(parsed) ? parsed : null;
}

function sanitizeLevel(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  if (normalized < 1) return null;
  return Math.min(MAX_SPORTS_PSYCHOLOGIST_LEVEL, normalized);
}

function sanitizeAttitudes(value: unknown): Record<string, TeamSpiritAttitude> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, TeamSpiritAttitude] =>
        Boolean(entry[0]) && isTeamSpiritAttitude(entry[1])
    )
  );
}

function sanitizeTeamSpiritOverrides(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]) => [key, sanitizeTeamSpiritValue(rawValue)] as const)
      .filter((entry): entry is [string, number] => Boolean(entry[0]) && entry[1] !== null)
  );
}

function sanitizeSettings(value: unknown): SeniorTeamSpiritSettings | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<SeniorTeamSpiritSettings>;
  const teamId = sanitizePositiveInteger(input.teamId);
  const season = sanitizePositiveInteger(input.season);
  if (teamId === null || season === null) return null;
  return {
    schemaVersion: 2,
    teamId,
    season,
    coachLeadershipOverride: isCoachLeadership(input.coachLeadershipOverride)
      ? input.coachLeadershipOverride
      : null,
    sportsPsychologistEnabledOverride:
      typeof input.sportsPsychologistEnabledOverride === "boolean"
        ? input.sportsPsychologistEnabledOverride
        : null,
    sportsPsychologistLevelOverride: sanitizeLevel(input.sportsPsychologistLevelOverride),
    upcomingAttitudes: sanitizeAttitudes(input.upcomingAttitudes),
    teamSpiritBeforeMatchOverrides: sanitizeTeamSpiritOverrides(
      input.teamSpiritBeforeMatchOverrides
    ),
    updatedAt:
      typeof input.updatedAt === "number" && Number.isFinite(input.updatedAt)
        ? input.updatedAt
        : Date.now(),
  };
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => {
      dbPromise = null;
      resolve(null);
    };
    request.onblocked = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
  });
  return dbPromise;
}

async function runStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return await new Promise<T | null>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = callback(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      transaction.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readSeniorTeamSpiritSettings(
  teamId: number,
  season: number
): Promise<SeniorTeamSpiritSettings | null> {
  const record = await runStore<unknown>("readonly", (store) =>
    store.get(buildSettingsKey(teamId, season))
  );
  return sanitizeSettings(record);
}

export async function writeSeniorTeamSpiritSettings(
  settings: SeniorTeamSpiritSettings
): Promise<void> {
  const sanitized = sanitizeSettings(settings);
  if (!sanitized) return;
  await runStore<IDBValidKey>("readwrite", (store) =>
    store.put({
      ...sanitized,
      id: buildSettingsKey(sanitized.teamId, sanitized.season),
      updatedAt: Date.now(),
    })
  );
}

export async function deleteSeniorTeamSpiritSettings(
  teamId: number,
  season: number
): Promise<void> {
  await runStore<undefined>("readwrite", (store) =>
    store.delete(buildSettingsKey(teamId, season))
  );
}

export async function pruneSeniorTeamSpiritSettingsForCurrentSeason(
  currentSeason: number
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const sanitized = sanitizeSettings(cursor.value);
        if (sanitized && sanitized.season !== currentSeason) {
          cursor.delete();
        }
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function exportSeniorTeamSpiritSettings(): Promise<SeniorTeamSpiritStorageExport> {
  const records = await runStore<unknown[]>("readonly", (store) => store.getAll());
  return {
    settings: (records ?? [])
      .map(sanitizeSettings)
      .filter((record): record is SeniorTeamSpiritSettings => Boolean(record)),
  };
}

export async function importSeniorTeamSpiritSettings(
  data: SeniorTeamSpiritStorageExport
): Promise<void> {
  if (!data || !Array.isArray(data.settings)) return;
  for (const record of data.settings) {
    await writeSeniorTeamSpiritSettings(record);
  }
}

function parseLegacyKey(key: string): { teamId: number; season: number } | null {
  if (!key.startsWith(LOCAL_STORAGE_PREFIX)) return null;
  const suffix = key.slice(LOCAL_STORAGE_PREFIX.length);
  const [teamIdRaw, seasonRaw] = suffix.split("_");
  const teamId = sanitizePositiveInteger(teamIdRaw);
  const season = sanitizePositiveInteger(seasonRaw);
  return teamId !== null && season !== null ? { teamId, season } : null;
}

function migrateLegacySettings(
  legacy: unknown,
  teamId: number,
  season: number
): SeniorTeamSpiritSettings {
  const input = legacy && typeof legacy === "object" ? legacy as Record<string, unknown> : {};
  return {
    schemaVersion: 2,
    teamId,
    season,
    coachLeadershipOverride: null,
    sportsPsychologistEnabledOverride:
      typeof input.sportsPsychologistEnabled === "boolean"
        ? input.sportsPsychologistEnabled
        : null,
    sportsPsychologistLevelOverride: sanitizeLevel(input.sportsPsychologistLevel),
    upcomingAttitudes: sanitizeAttitudes(input.attitudes),
    teamSpiritBeforeMatchOverrides: {},
    updatedAt: Date.now(),
  };
}

export async function migrateSeniorTeamSpiritLocalStorageSettings(): Promise<void> {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(LOCAL_STORAGE_PREFIX)) keys.push(key);
    }
  } catch {
    return;
  }
  for (const key of keys) {
    const parsedKey = parseLegacyKey(key);
    if (!parsedKey) continue;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      await writeSeniorTeamSpiritSettings(
        migrateLegacySettings(parsed, parsedKey.teamId, parsedKey.season)
      );
      window.localStorage.removeItem(key);
    } catch {
      // Ignore corrupt legacy records and leave them for manual cleanup.
    }
  }
}
