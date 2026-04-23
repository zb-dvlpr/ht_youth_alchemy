const COMPACT_PREFIX = "ya-ccz1:";

const COMPACT_KEY_SOURCE = [
  "version",
  "activeTabId",
  "tabs",
  "id",
  "name",
  "supportedSelections",
  "ownLeagueSelections",
  "manualTeams",
  "updates",
  "globalUpdatesHistory",
  "globalBaselineCache",
  "lastRefreshAt",
  "lastComparedAt",
  "lastHadChanges",
  "mobilePanelId",
  "mobileScreen",
  "mobileDetailKind",
  "mobileDetailTeamId",
  "mobileMenuPosition",
  "x",
  "y",
  "teams",
  "panelOrder",
  "teamId",
  "teamName",
  "leagueName",
  "leagueLevelUnitName",
  "leagueLevelUnitId",
  "teamGender",
  "arenaId",
  "arenaName",
  "leaguePerformance",
  "pressAnnouncement",
  "fanclub",
  "arena",
  "financeEstimate",
  "transferActivity",
  "tsi",
  "wages",
  "formationsTactics",
  "lastLogin",
  "coach",
  "powerRatings",
  "ongoingMatch",
  "current",
  "previous",
  "fetchedAt",
  "leagueId",
  "leagueLevel",
  "maxLevel",
  "currentMatchRound",
  "rank",
  "userId",
  "position",
  "positionChange",
  "matches",
  "goalsFor",
  "goalsAgainst",
  "points",
  "won",
  "draws",
  "lost",
  "subject",
  "body",
  "sendDate",
  "fanclubName",
  "fanclubSize",
  "currentTotalCapacity",
  "rebuiltDate",
  "currentAvailable",
  "terraces",
  "basic",
  "roof",
  "vip",
  "expandedAvailable",
  "expandedTotalCapacity",
  "expansionDate",
  "expandedTerraces",
  "expandedBasic",
  "expandedRoof",
  "expandedVip",
  "totalBuysSek",
  "totalSalesSek",
  "numberOfBuys",
  "numberOfSales",
  "estimatedSek",
  "transferListedCount",
  "transferListedPlayers",
  "playerId",
  "playerName",
  "age",
  "ageDays",
  "askingPriceSek",
  "latestTransfers",
  "transferId",
  "deadline",
  "transferType",
  "resolvedPlayerName",
  "priceSek",
  "totalTsi",
  "top11Tsi",
  "players",
  "playerNumber",
  "injuryLevel",
  "totalWagesSek",
  "top11WagesSek",
  "salarySek",
  "key",
  "label",
  "count",
  "topFormation",
  "topTactic",
  "likelyTrainingKey",
  "likelyTrainingTopKeys",
  "likelyTrainingIsUnclear",
  "likelyTrainingConfidencePct",
  "likelyTrainingScores",
  "confidencePct",
  "formationDistribution",
  "tacticDistribution",
  "analyzedMatches",
  "sampleSize",
  "latestLoginDateTime",
  "loginEvents",
  "dateTime",
  "ipAddress",
  "raw",
  "trainerId",
  "contractDate",
  "costSek",
  "countryId",
  "countryName",
  "trainerType",
  "leadership",
  "trainerSkillLevel",
  "trainerStatus",
  "powerRating",
  "globalRanking",
  "leagueRanking",
  "regionRanking",
  "matchId",
  "matchType",
  "sourceSystem",
  "matchDate",
  "homeTeamId",
  "homeTeamName",
  "awayTeamId",
  "awayTeamName",
  "homeGoals",
  "awayGoals",
  "events",
  "minute",
  "eventText",
  "generatedAt",
  "changes",
  "fieldKey",
  "comparedAt",
  "hasChanges",
] as const;

const TOKEN_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const encodeToken = (index: number) => {
  let value = index;
  let token = "";
  do {
    token = TOKEN_ALPHABET[value % TOKEN_ALPHABET.length] + token;
    value = Math.floor(value / TOKEN_ALPHABET.length) - 1;
  } while (value >= 0);
  return `~${token}`;
};

const KEY_TO_ALIAS = new Map<string, string>(
  COMPACT_KEY_SOURCE.map((key, index) => [key, encodeToken(index)])
);
const ALIAS_TO_KEY = new Map<string, string>(
  COMPACT_KEY_SOURCE.map((key, index) => [encodeToken(index), key])
);

const encodeCompactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => encodeCompactValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      KEY_TO_ALIAS.get(key) ?? key,
      encodeCompactValue(entryValue),
    ])
  );
};

const decodeCompactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeCompactValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      ALIAS_TO_KEY.get(key) ?? key,
      decodeCompactValue(entryValue),
    ])
  );
};

const parseCompactStoragePayload = <T>(raw: string): T | null => {
  try {
    if (!raw.startsWith(COMPACT_PREFIX)) return null;
    const parsed = JSON.parse(raw.slice(COMPACT_PREFIX.length)) as unknown;
    return decodeCompactValue(parsed) as T;
  } catch {
    return null;
  }
};

export const readCompressedChronicleStorage = <T>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const compact = parseCompactStoragePayload<T>(raw);
    if (compact !== null) {
      return compact;
    }
    const parsed = JSON.parse(raw) as T;
    void writeCompressedChronicleStorage(key, parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const writeCompressedChronicleStorage = (
  key: string,
  payload: unknown
): boolean => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      key,
      `${COMPACT_PREFIX}${JSON.stringify(encodeCompactValue(payload))}`
    );
    return true;
  } catch {
    return false;
  }
};
