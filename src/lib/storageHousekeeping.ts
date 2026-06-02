export type StorageKeyFamilySpec = {
  familyId: string;
  keyPattern: RegExp;
  currentVersion: number;
  deleteVersionsBelow: number;
  description?: string;
  preserveIfNoCurrentKey?: boolean;
  allowMultipleCurrentKeys?: boolean;
};

export type ParsedStorageKey = {
  key: string;
  version: number;
};

export type StorageHousekeepingResult = {
  removedKeys: string[];
  keptKeys: string[];
  errors: Array<{ key?: string; message: string }>;
};

export type LocalStorageUsageSummaryEntry = {
  key: string;
  chars: number;
  approxUtf16Kb: number;
};

const STORAGE_HOUSEKEEPING_LAST_RUN_KEY = "ya_storage_housekeeping_last_run_v1";

const STORAGE_KEY_FAMILIES: StorageKeyFamilySpec[] = [
  {
    familyId: "clubChronicleCache",
    keyPattern: /^ya_cc_cache_v(\d+)$/,
    currentVersion: 2,
    deleteVersionsBelow: 2,
    description: "Club Chronicle standalone cache schema",
    preserveIfNoCurrentKey: true,
  },
];

let startupHousekeepingHasRun = false;

const parseStorageKeyForFamily = (
  key: string,
  spec: StorageKeyFamilySpec
): ParsedStorageKey | null => {
  const match = spec.keyPattern.exec(key);
  if (!match) return null;
  const version = Number(match[1]);
  if (!Number.isFinite(version)) return null;
  return { key, version };
};

const readLocalStorageKeys = () => {
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key) keys.push(key);
  }
  return keys;
};

export function isQuotaExceededError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014
    );
  }
  return (
    typeof error === "object" &&
    error !== null &&
    ("name" in error || "code" in error) &&
    ((error as { name?: unknown }).name === "QuotaExceededError" ||
      (error as { name?: unknown }).name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      (error as { code?: unknown }).code === 22 ||
      (error as { code?: unknown }).code === 1014)
  );
}

export function runStorageHousekeeping(): StorageHousekeepingResult {
  const result: StorageHousekeepingResult = {
    removedKeys: [],
    keptKeys: [],
    errors: [],
  };
  if (typeof window === "undefined") return result;

  let keys: string[];
  try {
    keys = readLocalStorageKeys();
  } catch (error) {
    result.errors.push({
      message: error instanceof Error ? error.message : "Could not read localStorage.",
    });
    return result;
  }

  STORAGE_KEY_FAMILIES.forEach((spec) => {
    const parsedKeys = keys.flatMap((key) => {
      const parsed = parseStorageKeyForFamily(key, spec);
      return parsed ? [parsed] : [];
    });
    const hasCurrentKey = parsedKeys.some(
      (item) => item.version === spec.currentVersion
    );

    parsedKeys.forEach((item) => {
      const shouldPreserveOnlyLegacy =
        spec.preserveIfNoCurrentKey && !hasCurrentKey;
      const shouldRemove =
        item.version < spec.deleteVersionsBelow && !shouldPreserveOnlyLegacy;
      if (!shouldRemove) {
        result.keptKeys.push(item.key);
        return;
      }
      try {
        window.localStorage.removeItem(item.key);
        result.removedKeys.push(item.key);
      } catch (error) {
        result.errors.push({
          key: item.key,
          message:
            error instanceof Error ? error.message : "Could not remove localStorage key.",
        });
      }
    });
  });

  try {
    window.localStorage.setItem(
      STORAGE_HOUSEKEEPING_LAST_RUN_KEY,
      String(Date.now())
    );
  } catch {
    // Diagnostic marker only; ignore quota/security failures.
  }

  return result;
}

export function runStartupStorageHousekeeping(): StorageHousekeepingResult {
  if (startupHousekeepingHasRun) {
    return { removedKeys: [], keptKeys: [], errors: [] };
  }
  startupHousekeepingHasRun = true;
  return runStorageHousekeeping();
}

export function getLocalStorageUsageSummary(): LocalStorageUsageSummaryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return readLocalStorageKeys()
      .map((key) => {
        const value = window.localStorage.getItem(key) ?? "";
        return {
          key,
          chars: value.length,
          approxUtf16Kb: Math.round((value.length * 2) / 102.4) / 10,
        };
      })
      .sort((left, right) => right.chars - left.chars);
  } catch {
    return [];
  }
}
