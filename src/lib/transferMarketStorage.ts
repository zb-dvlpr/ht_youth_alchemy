import type {
  TransferSearchFilters,
  TransferSearchHtmsPotentialFilter,
  TransferSearchResultsViewMode,
  TransferSearchSortKey,
} from "@/app/components/TransferSearchModal";
import type { DisplayCurrency } from "@/lib/currency";

const TRANSFER_MARKET_DB_NAME = "hattrick-alchemy-transfer-market";
const TRANSFER_MARKET_DB_VERSION = 2;
const PAST_SEARCHES_STORE = "pastSearches";
const PROFILES_STORE = "profiles";
const CURRENT_CRITERIA_STORE = "currentCriteria";
const PAST_SEARCH_LIMIT = 10;

export type TransferMarketStoredCriteria = {
  filters: TransferSearchFilters;
  htmsPotentialFilter: TransferSearchHtmsPotentialFilter;
  displayCurrency: DisplayCurrency;
};

export type TransferMarketPastSearchEntry = TransferMarketStoredCriteria & {
  id: string;
  scopeKey: string;
  createdAt: number;
};

export type TransferMarketSearchProfile = TransferMarketStoredCriteria & {
  id: string;
  scopeKey: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type TransferMarketCurrentCriteriaEntry = TransferMarketStoredCriteria & {
  id: string;
  scopeKey: string;
  updatedAt: number;
  sortKey: TransferSearchSortKey;
  resultsViewMode: TransferSearchResultsViewMode;
};

export type TransferMarketStorageExport = {
  pastSearches: TransferMarketPastSearchEntry[];
  profiles: TransferMarketSearchProfile[];
  currentCriteria?: TransferMarketCurrentCriteriaEntry[];
};

export function buildTransferMarketScopeKey(input: {
  managerId: number | string | null | undefined;
  teamId: number | null | undefined;
}) {
  return `manager:${String(input.managerId ?? "unknown")}:team:${String(
    input.teamId ?? "unknown"
  )}`;
}

const buildProfileId = (scopeKey: string, name: string) =>
  `${scopeKey}\u0000${name}`;

const openTransferMarketDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(
      TRANSFER_MARKET_DB_NAME,
      TRANSFER_MARKET_DB_VERSION
    );
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PAST_SEARCHES_STORE)) {
        const store = db.createObjectStore(PAST_SEARCHES_STORE, {
          keyPath: "id",
        });
        store.createIndex("scopeKey", "scopeKey", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        const store = db.createObjectStore(PROFILES_STORE, { keyPath: "id" });
        store.createIndex("scopeKey", "scopeKey", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains(CURRENT_CRITERIA_STORE)) {
        const store = db.createObjectStore(CURRENT_CRITERIA_STORE, {
          keyPath: "id",
        });
        store.createIndex("scopeKey", "scopeKey", { unique: true });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
    request.onsuccess = () => resolve(request.result);
  });

const readStoreByScope = async <T>(
  storeName: string,
  scopeKey: string
): Promise<T[]> => {
  const db = await openTransferMarketDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).index("scopeKey").getAll(scopeKey);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read error"));
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction error"));
  });
};

export async function readTransferMarketPastSearches(scopeKey: string) {
  const entries = await readStoreByScope<TransferMarketPastSearchEntry>(
    PAST_SEARCHES_STORE,
    scopeKey
  );
  return entries.sort((left, right) => right.createdAt - left.createdAt);
}

export async function addTransferMarketPastSearch(
  entry: Omit<TransferMarketPastSearchEntry, "id" | "createdAt"> & {
    createdAt?: number;
  }
) {
  const db = await openTransferMarketDb();
  const createdAt = entry.createdAt ?? Date.now();
  const next: TransferMarketPastSearchEntry = {
    ...entry,
    id: `${entry.scopeKey}:${createdAt}:${Math.random().toString(36).slice(2)}`,
    createdAt,
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PAST_SEARCHES_STORE, "readwrite");
    transaction.objectStore(PAST_SEARCHES_STORE).put(next);
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write error"));
    transaction.oncomplete = () => resolve();
  });
  db.close();
  const entries = await readTransferMarketPastSearches(entry.scopeKey);
  const overflow = entries.slice(PAST_SEARCH_LIMIT);
  if (overflow.length) {
    const cleanupDb = await openTransferMarketDb();
    await new Promise<void>((resolve, reject) => {
      const transaction = cleanupDb.transaction(PAST_SEARCHES_STORE, "readwrite");
      const store = transaction.objectStore(PAST_SEARCHES_STORE);
      overflow.forEach((oldEntry) => store.delete(oldEntry.id));
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB cleanup error"));
      transaction.oncomplete = () => resolve();
    });
    cleanupDb.close();
  }
  return readTransferMarketPastSearches(entry.scopeKey);
}

export async function readTransferMarketProfiles(scopeKey: string) {
  const profiles = await readStoreByScope<TransferMarketSearchProfile>(
    PROFILES_STORE,
    scopeKey
  );
  return profiles.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function getTransferMarketProfile(scopeKey: string, name: string) {
  const db = await openTransferMarketDb();
  return new Promise<TransferMarketSearchProfile | null>((resolve, reject) => {
    const transaction = db.transaction(PROFILES_STORE, "readonly");
    const request = transaction
      .objectStore(PROFILES_STORE)
      .get(buildProfileId(scopeKey, name));
    request.onerror = () => reject(request.error ?? new Error("IndexedDB read error"));
    request.onsuccess = () =>
      resolve((request.result as TransferMarketSearchProfile | undefined) ?? null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction error"));
  });
}

export async function saveTransferMarketProfile(
  profile: Omit<
    TransferMarketSearchProfile,
    "id" | "createdAt" | "updatedAt"
  > & {
    createdAt?: number;
    updatedAt?: number;
  }
) {
  const now = Date.now();
  const existing = await getTransferMarketProfile(profile.scopeKey, profile.name);
  const next: TransferMarketSearchProfile = {
    ...profile,
    id: buildProfileId(profile.scopeKey, profile.name),
    createdAt: existing?.createdAt ?? profile.createdAt ?? now,
    updatedAt: profile.updatedAt ?? now,
  };
  const db = await openTransferMarketDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROFILES_STORE, "readwrite");
    transaction.objectStore(PROFILES_STORE).put(next);
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write error"));
    transaction.oncomplete = () => resolve();
  });
  db.close();
  return next;
}

export async function deleteTransferMarketProfile(
  scopeKey: string,
  name: string
): Promise<void> {
  const db = await openTransferMarketDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROFILES_STORE, "readwrite");
    transaction.objectStore(PROFILES_STORE).delete(buildProfileId(scopeKey, name));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB delete error"));
    transaction.oncomplete = () => resolve();
  });
  db.close();
}

export async function readTransferMarketCurrentCriteria(scopeKey: string) {
  const db = await openTransferMarketDb();
  return new Promise<TransferMarketCurrentCriteriaEntry | null>((resolve, reject) => {
    const transaction = db.transaction(CURRENT_CRITERIA_STORE, "readonly");
    const request = transaction.objectStore(CURRENT_CRITERIA_STORE).get(scopeKey);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB read error"));
    request.onsuccess = () =>
      resolve((request.result as TransferMarketCurrentCriteriaEntry | undefined) ?? null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction error"));
  });
}

export async function saveTransferMarketCurrentCriteria(
  entry: Omit<TransferMarketCurrentCriteriaEntry, "id" | "updatedAt"> & {
    updatedAt?: number;
  }
) {
  const next: TransferMarketCurrentCriteriaEntry = {
    ...entry,
    id: entry.scopeKey,
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  const db = await openTransferMarketDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CURRENT_CRITERIA_STORE, "readwrite");
    transaction.objectStore(CURRENT_CRITERIA_STORE).put(next);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB write error"));
    transaction.oncomplete = () => resolve();
  });
  db.close();
  return next;
}

export async function deleteTransferMarketCurrentCriteria(
  scopeKey: string
): Promise<void> {
  const db = await openTransferMarketDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CURRENT_CRITERIA_STORE, "readwrite");
    transaction.objectStore(CURRENT_CRITERIA_STORE).delete(scopeKey);
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB delete error"));
    transaction.oncomplete = () => resolve();
  });
  db.close();
}

export async function exportTransferMarketStorage(): Promise<TransferMarketStorageExport> {
  const db = await openTransferMarketDb();
  const readAll = <T>(storeName: string) =>
    new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onerror = () => reject(request.error ?? new Error("IndexedDB read error"));
      request.onsuccess = () => resolve((request.result ?? []) as T[]);
    });
  try {
    const [pastSearches, profiles, currentCriteria] = await Promise.all([
      readAll<TransferMarketPastSearchEntry>(PAST_SEARCHES_STORE),
      readAll<TransferMarketSearchProfile>(PROFILES_STORE),
      readAll<TransferMarketCurrentCriteriaEntry>(CURRENT_CRITERIA_STORE),
    ]);
    return { pastSearches, profiles, currentCriteria };
  } finally {
    db.close();
  }
}

export async function importTransferMarketStorage(
  payload: TransferMarketStorageExport
): Promise<void> {
  const db = await openTransferMarketDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(
      [PAST_SEARCHES_STORE, PROFILES_STORE, CURRENT_CRITERIA_STORE],
      "readwrite"
    );
    const pastStore = transaction.objectStore(PAST_SEARCHES_STORE);
    const profilesStore = transaction.objectStore(PROFILES_STORE);
    const currentCriteriaStore = transaction.objectStore(CURRENT_CRITERIA_STORE);
    pastStore.clear();
    profilesStore.clear();
    currentCriteriaStore.clear();
    payload.pastSearches.forEach((entry) => pastStore.put(entry));
    payload.profiles.forEach((profile) => profilesStore.put(profile));
    (payload.currentCriteria ?? []).forEach((entry) =>
      currentCriteriaStore.put(entry)
    );
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB import error"));
    transaction.oncomplete = () => resolve();
  });
  db.close();
}
