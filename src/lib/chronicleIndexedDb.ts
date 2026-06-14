const CHRONICLE_DB_NAME = "ht-alchemy-club-chronicle";
const CHRONICLE_DB_VERSION = 1;
const CHRONICLE_DATA_STORE = "tab-data";

export type ChronicleIndexedDbRecord<
  Cache = unknown,
  Updates = unknown,
  UpdatesHistory = unknown[],
> = {
  tabId: string;
  cache: Cache | null;
  baseline: Cache | null;
  updates: Updates | null;
  updatesHistory: UpdatesHistory;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

const openChronicleDb = (): Promise<IDBDatabase> => {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(CHRONICLE_DB_NAME, CHRONICLE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHRONICLE_DATA_STORE)) {
        db.createObjectStore(CHRONICLE_DATA_STORE, { keyPath: "tabId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("IndexedDB open failed"));
    };
    request.onblocked = () => {
      reject(new Error("IndexedDB open blocked"));
    };
  });

  return dbPromise;
};

const runStoreRequest = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openChronicleDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHRONICLE_DATA_STORE, mode);
    const request = run(transaction.objectStore(CHRONICLE_DATA_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
};

export async function readChronicleDataRecord<
  Cache,
  Updates,
  UpdatesHistory = unknown[],
>(
  tabId: string
): Promise<ChronicleIndexedDbRecord<Cache, Updates, UpdatesHistory> | null> {
  if (!tabId) return null;
  const record = await runStoreRequest<
    ChronicleIndexedDbRecord<Cache, Updates, UpdatesHistory> | undefined
  >(
    "readonly",
    (store) => store.get(tabId)
  );
  return record ?? null;
}

export async function writeChronicleDataRecord<
  Cache,
  Updates,
  UpdatesHistory = unknown[],
>(
  record: ChronicleIndexedDbRecord<Cache, Updates, UpdatesHistory>
): Promise<void> {
  await runStoreRequest<IDBValidKey>("readwrite", (store) =>
    store.put({
      ...record,
      updatedAt: record.updatedAt || Date.now(),
    })
  );
}

export async function deleteChronicleDataRecord(tabId: string): Promise<void> {
  if (!tabId) return;
  await runStoreRequest<undefined>("readwrite", (store) => store.delete(tabId));
}

export async function estimateChronicleIndexedDbBytes(): Promise<number | null> {
  try {
    const db = await openChronicleDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(CHRONICLE_DATA_STORE, "readonly");
      const store = transaction.objectStore(CHRONICLE_DATA_STORE);
      const request = store.openCursor();
      let bytes = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(bytes);
          return;
        }
        try {
          bytes += JSON.stringify(cursor.value).length * 2;
        } catch {
          // Skip records that cannot be estimated.
        }
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB cursor failed"));
    });
  } catch {
    return null;
  }
}
