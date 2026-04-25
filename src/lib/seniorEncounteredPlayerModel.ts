export const SENIOR_ENCOUNTERED_PLAYER_MODEL_STORAGE_KEY =
  "ya_senior_encountered_player_model_v1";
const SENIOR_ENCOUNTERED_PLAYER_MODEL_ENABLED =
  process.env.NODE_ENV !== "production";

const DAYS_PER_HT_YEAR = 112;
const MODEL_SCHEMA_VERSION = 1;
const K_NEIGHBORS = 7;
const SENIOR_DASHBOARD_DATA_STORAGE_KEY = "ya_senior_dashboard_data_v1";

export type SeniorEncounterSource =
  | "ownSenior"
  | "seniorTransferMarket"
  | "youthTransferMarket";

export type SeniorEncounteredPlayerSample = {
  sampleHash: string;
  playerHash: string;
  source: SeniorEncounterSource;
  firstSeenAt: number;
  lastSeenAt: number;
  ageYears: number;
  ageDays: number;
  keeper: number;
  defending: number;
  playmaking: number;
  winger: number;
  passing: number;
  scoring: number;
  setPieces: number;
  form: number;
  stamina: number;
  tsi: number;
  baseWageSek: number;
};

type SeniorEncounteredPlayerStore = {
  version: number;
  updatedAt: number | null;
  samples: SeniorEncounteredPlayerSample[];
};

export type SeniorEncounteredPlayerModelSummary = {
  sampleCount: number;
  distinctPlayerCount: number;
  updatedAt: number | null;
  sourceCounts: Record<SeniorEncounterSource, number>;
};

export type SeniorModelEvaluationResult = {
  sampleCount: number;
  testedCount: number;
  distinctPlayerCount: number;
  tsiMae: number | null;
  wageMaeSek: number | null;
  ageMaeDays: number | null;
};

export type SeniorEncounterCaptureStatus = "added" | "deduped" | "failed";

type NormalizedSeniorPlayerSnapshot = Omit<
  SeniorEncounteredPlayerSample,
  "sampleHash" | "playerHash" | "source" | "firstSeenAt" | "lastSeenAt"
> & {
  playerId: number;
};

type ModelTarget = "tsi" | "wage" | "age";

const emptySourceCounts = (): Record<SeniorEncounterSource, number> => ({
  ownSenior: 0,
  seniorTransferMarket: 0,
  youthTransferMarket: 0,
});

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
};

const parseSkill = (value: unknown): number | null => {
  if (value && typeof value === "object" && "#text" in value) {
    return parseSkill((value as { "#text"?: unknown })["#text"]);
  }
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round(parsed));
};

const readStore = (): SeniorEncounteredPlayerStore => {
  if (typeof window === "undefined") {
    return { version: MODEL_SCHEMA_VERSION, updatedAt: null, samples: [] };
  }
  try {
    const raw = window.localStorage.getItem(
      SENIOR_ENCOUNTERED_PLAYER_MODEL_STORAGE_KEY
    );
    if (!raw) {
      return { version: MODEL_SCHEMA_VERSION, updatedAt: null, samples: [] };
    }
    const parsed = JSON.parse(raw) as Partial<SeniorEncounteredPlayerStore>;
    const samples = Array.isArray(parsed.samples)
      ? parsed.samples.filter(isStoredSample)
      : [];
    return {
      version: MODEL_SCHEMA_VERSION,
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : null,
      samples,
    };
  } catch {
    return { version: MODEL_SCHEMA_VERSION, updatedAt: null, samples: [] };
  }
};

const writeStore = (store: SeniorEncounteredPlayerStore) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SENIOR_ENCOUNTERED_PLAYER_MODEL_STORAGE_KEY,
      JSON.stringify(store)
    );
  } catch {
    // ignore storage errors
  }
};

let storeUpdateQueue: Promise<unknown> = Promise.resolve();

const queueStoreUpdate = <T>(fn: () => T | Promise<T>): Promise<T> => {
  const next = storeUpdateQueue.then(() => fn());
  storeUpdateQueue = next.catch(() => undefined);
  return next;
};

const isStoredSample = (sample: unknown): sample is SeniorEncounteredPlayerSample => {
  if (!sample || typeof sample !== "object") return false;
  const node = sample as Record<string, unknown>;
  return (
    typeof node.sampleHash === "string" &&
    typeof node.playerHash === "string" &&
    ["ownSenior", "seniorTransferMarket", "youthTransferMarket"].includes(
      String(node.source)
    ) &&
    typeof node.ageYears === "number" &&
    typeof node.ageDays === "number" &&
    typeof node.tsi === "number" &&
    typeof node.baseWageSek === "number"
  );
};

const fallbackHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const hashText = async (value: string) => {
  if (
    typeof window !== "undefined" &&
    window.crypto?.subtle &&
    typeof TextEncoder !== "undefined"
  ) {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  return fallbackHash(value);
};

const normalizeSeniorSnapshot = (
  player: unknown
): NormalizedSeniorPlayerSnapshot | null => {
  if (!player || typeof player !== "object") return null;
  const node = player as Record<string, unknown>;
  const playerSkills =
    node.PlayerSkills && typeof node.PlayerSkills === "object"
      ? (node.PlayerSkills as Record<string, unknown>)
      : null;
  const playerId = parseNumber(node.PlayerID);
  const ageYears = parseNumber(node.Age);
  const ageDays = parseNumber(node.AgeDays);
  const salary = parseNumber(node.Salary);
  const injuryLevel = parseNumber(node.InjuryLevel);
  const isAbroad = parseBoolean(node.IsAbroad) ?? false;
  const form = parseSkill(node.PlayerForm ?? node.Form);
  const readSkill = (...keys: string[]) => {
    for (const key of keys) {
      const value = parseSkill(playerSkills?.[key] ?? node[key]);
      if (value !== null) return value;
    }
    return null;
  };
  const stamina =
    readSkill("StaminaSkill", "stamina", "staminaSkill") ??
    parseSkill(node.StaminaSkill);
  const snapshot = {
    playerId,
    ageYears,
    ageDays,
    keeper: readSkill("KeeperSkill", "keeper", "keeperSkill"),
    defending: readSkill("DefenderSkill", "defending", "defenderSkill"),
    playmaking: readSkill("PlaymakerSkill", "playmaking", "playmakerSkill"),
    winger: readSkill("WingerSkill", "winger", "wingerSkill"),
    passing: readSkill("PassingSkill", "passing", "passingSkill"),
    scoring: readSkill("ScorerSkill", "scoring", "scorerSkill"),
    setPieces: readSkill("SetPiecesSkill", "setPieces", "setPiecesSkill"),
    form,
    stamina,
    tsi: parseNumber(node.TSI),
    baseWageSek:
      typeof salary === "number" ? Math.round(isAbroad ? salary / 1.2 : salary) : null,
  };
  if (
    !snapshot.playerId ||
    snapshot.playerId <= 0 ||
    snapshot.ageYears === null ||
    snapshot.ageDays === null ||
    snapshot.keeper === null ||
    snapshot.defending === null ||
    snapshot.playmaking === null ||
    snapshot.winger === null ||
    snapshot.passing === null ||
    snapshot.scoring === null ||
    snapshot.setPieces === null ||
    snapshot.form === null ||
    snapshot.stamina === null ||
    snapshot.tsi === null ||
    snapshot.baseWageSek === null
  ) {
    return null;
  }
  // Keep healthy (-1), bruised (0), and unknown injury status. Exclude known injuries.
  if (typeof injuryLevel === "number" && injuryLevel >= 1) {
    return null;
  }
  return snapshot as NormalizedSeniorPlayerSnapshot;
};

const buildSnapshotValueKey = (snapshot: NormalizedSeniorPlayerSnapshot) =>
  [
    snapshot.ageYears,
    snapshot.ageDays,
    snapshot.keeper,
    snapshot.defending,
    snapshot.playmaking,
    snapshot.winger,
    snapshot.passing,
    snapshot.scoring,
    snapshot.setPieces,
    snapshot.form,
    snapshot.stamina,
    snapshot.tsi,
    snapshot.baseWageSek,
  ].join("|");

const toStoredSnapshot = (snapshot: NormalizedSeniorPlayerSnapshot) => ({
  ageYears: snapshot.ageYears,
  ageDays: snapshot.ageDays,
  keeper: snapshot.keeper,
  defending: snapshot.defending,
  playmaking: snapshot.playmaking,
  winger: snapshot.winger,
  passing: snapshot.passing,
  scoring: snapshot.scoring,
  setPieces: snapshot.setPieces,
  form: snapshot.form,
  stamina: snapshot.stamina,
  tsi: snapshot.tsi,
  baseWageSek: snapshot.baseWageSek,
});

const readSeniorDashboardDataStorageKeys = () => {
  if (typeof window === "undefined") return [];
  const storageKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (
      key === SENIOR_DASHBOARD_DATA_STORAGE_KEY ||
      key?.startsWith(`${SENIOR_DASHBOARD_DATA_STORAGE_KEY}_`)
    ) {
      storageKeys.push(key);
    }
  }
  return storageKeys;
};

const readSeniorDashboardCacheCandidates = () => {
  if (typeof window === "undefined") return [];
  const candidates: unknown[] = [];
  for (const storageKey of readSeniorDashboardDataStorageKeys()) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        players?: unknown[];
        detailsCache?: Record<string, { data?: unknown }>;
      };
      Object.values(parsed.detailsCache ?? {}).forEach((entry) => {
        if (entry?.data) {
          candidates.push(entry.data);
        }
      });
      if (Array.isArray(parsed.players)) {
        candidates.push(...parsed.players);
      }
    } catch {
      // ignore malformed local caches
    }
  }
  return candidates;
};

export const captureSeniorEncounteredPlayer = async (
  player: unknown,
  source: SeniorEncounterSource
) => {
  if (!SENIOR_ENCOUNTERED_PLAYER_MODEL_ENABLED) return "failed" as const;
  const snapshot = normalizeSeniorSnapshot(player);
  if (!snapshot) return "failed" as const;
  const playerHash = await hashText(`senior-player:${snapshot.playerId}`);
  const sampleHash = await hashText(
    `senior-sample:${playerHash}:${buildSnapshotValueKey(snapshot)}`
  );
  return queueStoreUpdate(() => {
    const store = readStore();
    const existing = store.samples.find((sample) => sample.sampleHash === sampleHash);
    if (existing) {
      existing.lastSeenAt = Date.now();
      writeStore({ ...store, updatedAt: Date.now() });
      return "deduped" as const;
    }
    const now = Date.now();
    const nextStore: SeniorEncounteredPlayerStore = {
      version: MODEL_SCHEMA_VERSION,
      updatedAt: now,
      samples: [
        ...store.samples,
        {
          ...toStoredSnapshot(snapshot),
          sampleHash,
          playerHash,
          source,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      ],
    };
    writeStore(nextStore);
    const persistedStore = readStore();
    const persisted = persistedStore.samples.some(
      (sample) => sample.sampleHash === sampleHash
    );
    if (!persisted) {
      return "failed" as const;
    }
    return "added" as const;
  });
};

let backfillInFlight: Promise<number> | null = null;

export const backfillSeniorEncounteredPlayerModelFromLocalCache = async () => {
  if (!SENIOR_ENCOUNTERED_PLAYER_MODEL_ENABLED) return 0;
  if (backfillInFlight) return backfillInFlight;
  backfillInFlight = (async () => {
    let added = 0;
    const candidates = readSeniorDashboardCacheCandidates();
    for (const candidate of candidates) {
      if ((await captureSeniorEncounteredPlayer(candidate, "ownSenior")) === "added") {
        added += 1;
      }
    }
    return added;
  })();
  try {
    return await backfillInFlight;
  } finally {
    backfillInFlight = null;
  }
};

export const getSeniorEncounteredPlayerModelSummary =
  (): SeniorEncounteredPlayerModelSummary => {
    if (!SENIOR_ENCOUNTERED_PLAYER_MODEL_ENABLED) {
      return {
        sampleCount: 0,
        distinctPlayerCount: 0,
        updatedAt: null,
        sourceCounts: emptySourceCounts(),
      };
    }
    const store = readStore();
    const playerHashes = new Set<string>();
    const sourceCounts = emptySourceCounts();
    store.samples.forEach((sample) => {
      playerHashes.add(sample.playerHash);
      sourceCounts[sample.source] += 1;
    });
    return {
      sampleCount: store.samples.length,
      distinctPlayerCount: playerHashes.size,
      updatedAt: store.updatedAt,
      sourceCounts,
    };
  };

const ageTotalDays = (sample: Pick<SeniorEncounteredPlayerSample, "ageYears" | "ageDays">) =>
  sample.ageYears * DAYS_PER_HT_YEAR + sample.ageDays;

const targetValue = (sample: SeniorEncounteredPlayerSample, target: ModelTarget) => {
  if (target === "tsi") return sample.tsi;
  if (target === "wage") return sample.baseWageSek;
  return ageTotalDays(sample);
};

const featureVector = (sample: SeniorEncounteredPlayerSample, target: ModelTarget) => {
  const values = [
    sample.keeper / 20,
    sample.defending / 20,
    sample.playmaking / 20,
    sample.winger / 20,
    sample.passing / 20,
    sample.scoring / 20,
    sample.setPieces / 20,
    sample.form / 9,
    sample.stamina / 9,
  ];
  if (target !== "age") {
    values.push(ageTotalDays(sample) / (45 * DAYS_PER_HT_YEAR));
  }
  if (target !== "tsi") {
    values.push(Math.log1p(sample.tsi) / 16);
  }
  if (target !== "wage") {
    values.push(Math.log1p(sample.baseWageSek) / 16);
  }
  return values;
};

const predict = (
  trainingSamples: SeniorEncounteredPlayerSample[],
  sample: SeniorEncounteredPlayerSample,
  target: ModelTarget
) => {
  if (trainingSamples.length === 0) return null;
  const input = featureVector(sample, target);
  const neighbors = trainingSamples
    .map((candidate) => {
      const candidateVector = featureVector(candidate, target);
      const distance = Math.sqrt(
        input.reduce((total, value, index) => {
          const diff = value - (candidateVector[index] ?? 0);
          return total + diff * diff;
        }, 0)
      );
      return {
        distance,
        value: targetValue(candidate, target),
      };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.min(K_NEIGHBORS, trainingSamples.length));
  const weighted = neighbors.reduce(
    (acc, neighbor) => {
      const weight = 1 / Math.max(0.0001, neighbor.distance);
      return {
        total: acc.total + neighbor.value * weight,
        weight: acc.weight + weight,
      };
    },
    { total: 0, weight: 0 }
  );
  return weighted.weight > 0 ? weighted.total / weighted.weight : null;
};

const readOwnSeniorSamples = async (): Promise<SeniorEncounteredPlayerSample[]> => {
  if (typeof window === "undefined") return [];
  try {
    const samples: SeniorEncounteredPlayerSample[] = [];
    const candidates = readSeniorDashboardCacheCandidates();
    for (const candidate of candidates) {
      const snapshot = normalizeSeniorSnapshot(candidate);
      if (!snapshot) continue;
      const playerHash = await hashText(`senior-player:${snapshot.playerId}`);
      const sampleHash = await hashText(
        `senior-sample:${playerHash}:${buildSnapshotValueKey(snapshot)}`
      );
      samples.push({
        ...toStoredSnapshot(snapshot),
        playerHash,
        sampleHash,
        source: "ownSenior",
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      });
    }
    return samples;
  } catch {
    return [];
  }
};

const mean = (values: number[]) =>
  values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;

export const evaluateSeniorEncounteredPlayerModel =
  async (): Promise<SeniorModelEvaluationResult> => {
    if (!SENIOR_ENCOUNTERED_PLAYER_MODEL_ENABLED) {
      return {
        sampleCount: 0,
        distinctPlayerCount: 0,
        testedCount: 0,
        tsiMae: null,
        wageMaeSek: null,
        ageMaeDays: null,
      };
    }
    const store = readStore();
    const ownSamples = await readOwnSeniorSamples();
    const tsiErrors: number[] = [];
    const wageErrors: number[] = [];
    const ageErrors: number[] = [];
    let testedCount = 0;
    ownSamples.forEach((sample) => {
      const training = store.samples.filter(
        (candidate) => candidate.sampleHash !== sample.sampleHash
      );
      if (training.length < 2) return;
      const tsi = predict(training, sample, "tsi");
      const wage = predict(training, sample, "wage");
      const age = predict(training, sample, "age");
      if (tsi === null || wage === null || age === null) return;
      testedCount += 1;
      tsiErrors.push(Math.abs(tsi - sample.tsi));
      wageErrors.push(Math.abs(wage - sample.baseWageSek));
      ageErrors.push(Math.abs(age - ageTotalDays(sample)));
    });
    const playerHashes = new Set(store.samples.map((sample) => sample.playerHash));
    return {
      sampleCount: store.samples.length,
      distinctPlayerCount: playerHashes.size,
      testedCount,
      tsiMae: mean(tsiErrors),
      wageMaeSek: mean(wageErrors),
      ageMaeDays: mean(ageErrors),
    };
  };
