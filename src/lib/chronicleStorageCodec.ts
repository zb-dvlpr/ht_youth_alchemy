const LEGACY_COMPACT_PREFIX = "ya-ccz1:";
const CURRENT_COMPACT_PREFIX = "ya-ccz2:";

const LEGACY_COMPACT_KEY_SOURCE = [
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
  "form7RatingsByPlayerId",
  "ratingStarsEndOfMatch",
  "weatherId",
  "recordedAt",
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

const INTERIM_COMPACT_KEY_SOURCE = [
  ...LEGACY_COMPACT_KEY_SOURCE.slice(
    0,
    LEGACY_COMPACT_KEY_SOURCE.indexOf("ratingStarsEndOfMatch")
  ),
  "playingPositionByPlayerId",
  "ratingStarsEndOfMatch",
  "weatherId",
  "roleId",
  "minutes",
  "recordedAt",
  ...LEGACY_COMPACT_KEY_SOURCE.slice(
    LEGACY_COMPACT_KEY_SOURCE.indexOf("key")
  ),
] as const;

const CURRENT_COMPACT_KEY_SOURCE = [
  ...LEGACY_COMPACT_KEY_SOURCE,
  "playingPositionByPlayerId",
  "roleId",
  "minutes",
  "manMarkerByPlayerId",
  "nativeLeagueIdByPlayerId",
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

const buildAliasMaps = (source: readonly string[]) => {
  const keyToAlias = new Map<string, string>(
    source.map((key, index) => [key, encodeToken(index)])
  );
  const aliasToKey = new Map<string, string>(
    source.map((key, index) => [encodeToken(index), key])
  );
  return { keyToAlias, aliasToKey };
};

const LEGACY_ALIAS_MAPS = buildAliasMaps(LEGACY_COMPACT_KEY_SOURCE);
const INTERIM_ALIAS_MAPS = buildAliasMaps(INTERIM_COMPACT_KEY_SOURCE);
const CURRENT_ALIAS_MAPS = buildAliasMaps(CURRENT_COMPACT_KEY_SOURCE);

const encodeCompactValue = (
  value: unknown,
  keyToAlias: Map<string, string>
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => encodeCompactValue(entry, keyToAlias));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      keyToAlias.get(key) ?? key,
      encodeCompactValue(entryValue, keyToAlias),
    ])
  );
};

const decodeCompactValue = (
  value: unknown,
  aliasToKey: Map<string, string>
): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => decodeCompactValue(entry, aliasToKey));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      aliasToKey.get(key) ?? key,
      decodeCompactValue(entryValue, aliasToKey),
    ])
  );
};

const isFinitePositiveNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isFiniteNonNegativeNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isOptionalRoleId = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === "number" && Number.isFinite(value) && value >= 100 && value <= 113);

const scoreChronicleCandidate = (value: unknown) => {
  let validForm7Entries = 0;
  let invalidForm7Entries = 0;
  let validPlayingPositionEntries = 0;
  let invalidPlayingPositionEntries = 0;

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== "object") {
      return;
    }
    const record = node as Record<string, unknown>;
    if (
      record.form7RatingsByPlayerId &&
      typeof record.form7RatingsByPlayerId === "object" &&
      !Array.isArray(record.form7RatingsByPlayerId)
    ) {
      Object.values(record.form7RatingsByPlayerId as Record<string, unknown>).forEach(
        (entryList) => {
          if (!Array.isArray(entryList)) {
            invalidForm7Entries += 1;
            return;
          }
          entryList.forEach((entry) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
              invalidForm7Entries += 1;
              return;
            }
            const item = entry as Record<string, unknown>;
            const isValid =
              isFinitePositiveNumber(item.matchId) &&
              typeof item.sourceSystem === "string" &&
              item.sourceSystem.trim().length > 0 &&
              isFiniteNonNegativeNumber(item.ratingStarsEndOfMatch) &&
              typeof item.weatherId === "number" &&
              Number.isInteger(item.weatherId) &&
              item.weatherId >= 0 &&
              item.weatherId <= 3 &&
              isOptionalRoleId(item.roleId);
            if (isValid) {
              validForm7Entries += 1;
            } else {
              invalidForm7Entries += 1;
            }
          });
        }
      );
    }
    if (
      record.playingPositionByPlayerId &&
      typeof record.playingPositionByPlayerId === "object" &&
      !Array.isArray(record.playingPositionByPlayerId)
    ) {
      Object.values(
        record.playingPositionByPlayerId as Record<string, unknown>
      ).forEach((entryList) => {
        if (!Array.isArray(entryList)) {
          invalidPlayingPositionEntries += 1;
          return;
        }
        entryList.forEach((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            invalidPlayingPositionEntries += 1;
            return;
          }
          const item = entry as Record<string, unknown>;
          const isValid =
            typeof item.roleId === "number" &&
            Number.isFinite(item.roleId) &&
            item.roleId >= 100 &&
            item.roleId <= 113 &&
            isFiniteNonNegativeNumber(item.minutes);
          if (isValid) {
            validPlayingPositionEntries += 1;
          } else {
            invalidPlayingPositionEntries += 1;
          }
        });
      });
    }
    Object.values(record).forEach(visit);
  };

  visit(value);

  return (
    validForm7Entries * 10 -
    invalidForm7Entries * 20 +
    validPlayingPositionEntries * 5 -
    invalidPlayingPositionEntries * 10
  );
};

const parseCompactStoragePayload = <T>(raw: string): { payload: T | null; needsRewrite: boolean } => {
  try {
    if (raw.startsWith(CURRENT_COMPACT_PREFIX)) {
      const parsed = JSON.parse(raw.slice(CURRENT_COMPACT_PREFIX.length)) as unknown;
      return {
        payload: decodeCompactValue(parsed, CURRENT_ALIAS_MAPS.aliasToKey) as T,
        needsRewrite: false,
      };
    }
    if (!raw.startsWith(LEGACY_COMPACT_PREFIX)) {
      return { payload: null, needsRewrite: false };
    }
    const parsed = JSON.parse(raw.slice(LEGACY_COMPACT_PREFIX.length)) as unknown;
    const legacyDecoded = decodeCompactValue(parsed, LEGACY_ALIAS_MAPS.aliasToKey);
    const interimDecoded = decodeCompactValue(parsed, INTERIM_ALIAS_MAPS.aliasToKey);
    const legacyScore = scoreChronicleCandidate(legacyDecoded);
    const interimScore = scoreChronicleCandidate(interimDecoded);
    return {
      payload: (interimScore > legacyScore ? interimDecoded : legacyDecoded) as T,
      needsRewrite: true,
    };
  } catch {
    return { payload: null, needsRewrite: false };
  }
};

export const readCompressedChronicleStorage = <T>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const compact = parseCompactStoragePayload<T>(raw);
    if (compact.payload !== null) {
      if (compact.needsRewrite) {
        void writeCompressedChronicleStorage(key, compact.payload);
      }
      return compact.payload;
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
      `${CURRENT_COMPACT_PREFIX}${JSON.stringify(
        encodeCompactValue(payload, CURRENT_ALIAS_MAPS.keyToAlias)
      )}`
    );
    return true;
  } catch {
    return false;
  }
};
