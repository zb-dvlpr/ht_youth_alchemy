export type ChronicleDetailPlayerSnapshot = {
  playerId: number | null | undefined;
};

export type ChroniclePlayingPositionEntry = {
  roleId?: number | null;
  minutes?: number | null;
};

export type ChronicleForm7RatingEntry = unknown;

export type ChronicleDetailPlayingPositionCoverageInput = {
  currentPlayers: ChronicleDetailPlayerSnapshot[] | null | undefined;
  analyzedMatchesCount: number;
  playingPositionByPlayerId:
    | Record<string, ChroniclePlayingPositionEntry[] | null | undefined>
    | Record<number, ChroniclePlayingPositionEntry[] | null | undefined>
    | null
    | undefined;
  form7RatingsByPlayerId:
    | Record<string, ChronicleForm7RatingEntry[] | null | undefined>
    | Record<number, ChronicleForm7RatingEntry[] | null | undefined>
    | null
    | undefined;
};

export function hasUsableChroniclePlayingPositionEntries(
  entries: ChroniclePlayingPositionEntry[] | null | undefined
): boolean {
  return (
    Array.isArray(entries) &&
    entries.some(
      (entry) =>
        typeof entry?.minutes === "number" &&
        Number.isFinite(entry.minutes) &&
        entry.minutes > 0
    )
  );
}

export function needsChronicleDetailPlayingPositionCoverageBackfill({
  currentPlayers,
  analyzedMatchesCount,
  playingPositionByPlayerId,
  form7RatingsByPlayerId,
}: ChronicleDetailPlayingPositionCoverageInput): boolean {
  if (!Array.isArray(currentPlayers) || currentPlayers.length === 0) return false;
  if (analyzedMatchesCount <= 0) return false;

  const currentPlayerIds = new Set(
    currentPlayers
      .map((player) => player.playerId)
      .filter(
        (playerId): playerId is number =>
          typeof playerId === "number" && Number.isFinite(playerId)
      )
  );
  if (currentPlayerIds.size === 0) return false;

  const hasPlayingPositionMap =
    playingPositionByPlayerId !== null &&
    playingPositionByPlayerId !== undefined &&
    typeof playingPositionByPlayerId === "object";
  if (!hasPlayingPositionMap) return true;
  const playingPositionMap = playingPositionByPlayerId as Record<
    string,
    ChroniclePlayingPositionEntry[] | null | undefined
  >;

  const coveredCurrentPlayers = Object.entries(playingPositionMap).filter(
    ([playerId, entries]) =>
      currentPlayerIds.has(Number(playerId)) &&
      hasUsableChroniclePlayingPositionEntries(entries)
  );
  if (coveredCurrentPlayers.length === 0) return true;

  if (
    form7RatingsByPlayerId === null ||
    form7RatingsByPlayerId === undefined ||
    typeof form7RatingsByPlayerId !== "object"
  ) {
    return false;
  }

  return Object.entries(form7RatingsByPlayerId).some(([playerId, entries]) => {
    const numericPlayerId = Number(playerId);
    if (!currentPlayerIds.has(numericPlayerId)) return false;
    if (!Array.isArray(entries) || entries.length === 0) return false;
    return !hasUsableChroniclePlayingPositionEntries(
      playingPositionMap[String(numericPlayerId)]
    );
  });
}
