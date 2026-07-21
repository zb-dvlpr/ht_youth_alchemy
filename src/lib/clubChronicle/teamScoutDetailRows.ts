import { matchRoleIdToPositionKey, type PositionKey } from "@/lib/positions";
import { normalizeSeniorShirtNumber } from "@/lib/seniorShirtNumber";
import type {
  TeamScoutDerivedData,
  TeamScoutLikelyTrainingKey,
  TeamScoutPlayerRow,
  TeamScoutPlayingPositionEntry,
} from "./teamScoutDetailTypes";
import type { OriginFlagDisplay } from "@/lib/originFlag";

export type TeamScoutBasePlayer = {
  playerId: number;
  playerName: string | null;
  originFlagDisplay?: OriginFlagDisplay | null;
  playerNumber?: number | null;
  age?: number | null;
  ageDays?: number | null;
  injuryLevel?: number | null;
  specialty?: number | null;
  cards?: number | null;
  form?: number | null;
  stamina?: number | null;
  experience?: number | null;
  leadership?: number | null;
  loyalty?: number | null;
  motherClubBonus?: boolean | null;
  tsi?: number | null;
  salarySek?: number | null;
  wageIncludesForeignBonus?: boolean | null;
};

export const isLikelyTraineeForTeamScoutDetail = (
  entries: TeamScoutPlayingPositionEntry[] | null | undefined,
  likelyTrainingKey: TeamScoutLikelyTrainingKey | null | undefined
) => {
  if (!entries || entries.length === 0 || !likelyTrainingKey) return false;
  const allowedPositionKeysByLikelyTrainingKey: Record<
    TeamScoutLikelyTrainingKey,
    PositionKey[]
  > = {
    keepingOrSetPieces: ["KP"],
    defending: ["CD", "WB"],
    playmaking: ["IM", "W"],
    winger: ["W", "WB"],
    passing: ["IM", "W", "F"],
    scoring: ["F"],
  };
  const allowedPositions = new Set(
    allowedPositionKeysByLikelyTrainingKey[likelyTrainingKey] ?? []
  );
  if (allowedPositions.size === 0) return false;
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + Math.max(0, entry.minutes ?? 0),
    0
  );
  if (totalMinutes <= 0) return false;
  const allowedMinutes = entries.reduce((sum, entry) => {
    const positionKey = matchRoleIdToPositionKey(entry.roleId);
    if (!positionKey || !allowedPositions.has(positionKey)) return sum;
    return sum + Math.max(0, entry.minutes ?? 0);
  }, 0);
  return allowedMinutes / totalMinutes >= 0.8;
};

export const buildTeamScoutPlayerRows = ({
  teamId,
  players,
  derivedData,
  likelyTrainingKey,
  wagesPlayersById,
}: {
  teamId: number;
  players: TeamScoutBasePlayer[];
  derivedData: TeamScoutDerivedData;
  likelyTrainingKey: TeamScoutLikelyTrainingKey | null | undefined;
  wagesPlayersById?: Map<number, TeamScoutBasePlayer>;
}): TeamScoutPlayerRow[] =>
  players.map((player) => {
    const wagesPlayer = wagesPlayersById?.get(player.playerId) ?? null;
    const playingPositions =
      derivedData.playingPositionByPlayerId[player.playerId] ?? [];
    return {
      teamId,
      playerId: player.playerId,
      playerName: player.playerName,
      originFlagDisplay: player.originFlagDisplay ?? null,
      playerNumber: normalizeSeniorShirtNumber(player.playerNumber),
      age: player.age ?? null,
      ageDays: player.ageDays ?? null,
      injuryLevel: player.injuryLevel ?? null,
      specialty: player.specialty ?? null,
      cards: player.cards ?? null,
      form: player.form ?? null,
      stamina: player.stamina ?? null,
      experience: player.experience ?? null,
      leadership: player.leadership ?? null,
      loyalty: player.loyalty ?? null,
      motherClubBonus:
        player.motherClubBonus ?? wagesPlayer?.motherClubBonus ?? false,
      tsi: player.tsi ?? null,
      salarySek: player.salarySek ?? wagesPlayer?.salarySek ?? null,
      wageIncludesForeignBonus:
        player.wageIncludesForeignBonus ??
        wagesPlayer?.wageIncludesForeignBonus ??
        null,
      form7Ratings: derivedData.form7RatingsByPlayerId[player.playerId] ?? [],
      playingPositions,
      usedAsManMarker: derivedData.manMarkerByPlayerId[player.playerId] === true,
      isLikelyTrainee: isLikelyTraineeForTeamScoutDetail(
        playingPositions,
        likelyTrainingKey
      ),
    };
  });
