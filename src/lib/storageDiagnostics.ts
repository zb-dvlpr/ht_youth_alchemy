export type LocalStorageKeyUsage = {
  key: string;
  bytes: number;
  formatted: string;
};

export type LocalStorageDiagnostics = {
  localStorageBytes: number | null;
  localStorageFormatted: string | null;
  localStorageKeys: LocalStorageKeyUsage[];
  error?: string | null;
};

export type FeedbackStorageMetadata = {
  localStorageTotalBytes: number | null;
  localStorageTotalFormatted: string | null;
  localStorageKeys: LocalStorageKeyUsage[];
  error?: string | null;
};

export type StorageDiagnostics = {
  originUsageBytes: number | null;
  originQuotaBytes: number | null;
  originUsageFormatted: string | null;
  originQuotaFormatted: string | null;
  originUsagePct: number | null;
  localStorageBytes: number | null;
  localStorageFormatted: string | null;
  localStorageKeys: LocalStorageKeyUsage[];
  error?: string | null;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(/\.0+$/, "")} ${units[unitIndex]}`;
}

const buildUnavailableDiagnostics = (error?: string): StorageDiagnostics => ({
  originUsageBytes: null,
  originQuotaBytes: null,
  originUsageFormatted: null,
  originQuotaFormatted: null,
  originUsagePct: null,
  localStorageBytes: null,
  localStorageFormatted: null,
  localStorageKeys: [],
  error: error ?? null,
});

export function collectLocalStorageDiagnostics(): LocalStorageDiagnostics {
  if (typeof window === "undefined") {
    return {
      localStorageBytes: null,
      localStorageFormatted: null,
      localStorageKeys: [],
      error: "window unavailable",
    };
  }

  try {
    const rows: LocalStorageKeyUsage[] = [];
    let totalBytes = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key === null) continue;
      const value = window.localStorage.getItem(key);
      if (value === null) continue;
      const bytes = 2 * (key.length + value.length);
      totalBytes += bytes;
      rows.push({
        key,
        bytes,
        formatted: formatBytes(bytes),
      });
    }

    return {
      localStorageBytes: totalBytes,
      localStorageFormatted: formatBytes(totalBytes),
      localStorageKeys: rows.sort((left, right) => right.bytes - left.bytes),
      error: null,
    };
  } catch (error) {
    return {
      localStorageBytes: null,
      localStorageFormatted: null,
      localStorageKeys: [],
      error: error instanceof Error ? error.message : "localStorage read failed",
    };
  }
}

export function collectFeedbackStorageMetadata(): FeedbackStorageMetadata {
  const diagnostics = collectLocalStorageDiagnostics();
  return {
    localStorageTotalBytes: diagnostics.localStorageBytes,
    localStorageTotalFormatted: diagnostics.localStorageFormatted,
    localStorageKeys: diagnostics.localStorageKeys,
    error: diagnostics.error,
  };
}

export async function collectStorageDiagnostics(): Promise<StorageDiagnostics> {
  if (typeof window === "undefined") {
    return buildUnavailableDiagnostics("window unavailable");
  }

  let originUsageBytes: number | null = null;
  let originQuotaBytes: number | null = null;
  let originError: string | null = null;

  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate) {
      originUsageBytes =
        typeof estimate.usage === "number" && Number.isFinite(estimate.usage)
          ? estimate.usage
          : null;
      originQuotaBytes =
        typeof estimate.quota === "number" && Number.isFinite(estimate.quota)
          ? estimate.quota
          : null;
    }
  } catch (error) {
    originError = error instanceof Error ? error.message : "storage estimate failed";
  }

  const localStorageDiagnostics = collectLocalStorageDiagnostics();

  const originUsagePct =
    originUsageBytes !== null && originQuotaBytes !== null && originQuotaBytes > 0
      ? (originUsageBytes / originQuotaBytes) * 100
      : null;

  return {
    originUsageBytes,
    originQuotaBytes,
    originUsageFormatted:
      originUsageBytes !== null ? formatBytes(originUsageBytes) : null,
    originQuotaFormatted:
      originQuotaBytes !== null ? formatBytes(originQuotaBytes) : null,
    originUsagePct,
    localStorageBytes: localStorageDiagnostics.localStorageBytes,
    localStorageFormatted: localStorageDiagnostics.localStorageFormatted,
    localStorageKeys: localStorageDiagnostics.localStorageKeys,
    error:
      [originError, localStorageDiagnostics.error].filter(Boolean).join("; ") ||
      null,
  };
}
