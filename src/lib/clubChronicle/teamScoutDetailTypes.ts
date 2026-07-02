import type { OriginFlagDisplay } from "@/lib/originFlag";

export type TeamScoutLikelyTrainingKey =
  | "winger"
  | "playmaking"
  | "defending"
  | "passing"
  | "scoring"
  | "keepingOrSetPieces";

export type TeamScoutLikelyTrainingInfo = {
  likelyTrainingKey: TeamScoutLikelyTrainingKey | null;
  label: string;
} | null;

export type TeamScoutForm7RatingEntry = {
  matchId: number;
  sourceSystem: string;
  matchDate: string | null;
  ratingStarsEndOfMatch: number;
  weatherId: number;
  roleId?: number | null;
  recordedAt: number;
};

export type TeamScoutPlayingPositionEntry = {
  roleId: number;
  minutes: number;
};

export type TeamScoutAnalyzedMatch = {
  matchId: number;
  matchType: number | null;
  matchDate: string | null;
  sourceSystem: string;
  matchDurationMinutes: number;
  formation: string | null;
  tacticType: number | null;
};

export type TeamScoutDerivedData = {
  form7RatingsByPlayerId: Record<number, TeamScoutForm7RatingEntry[]>;
  playingPositionByPlayerId: Record<number, TeamScoutPlayingPositionEntry[]>;
  manMarkerByPlayerId: Record<number, boolean>;
  analyzedMatches: TeamScoutAnalyzedMatch[];
  matchSampleSize: number;
};

export type TeamScoutPlayerRow = {
  teamId: number;
  playerId: number;
  playerName: string | null;
  originFlagDisplay?: OriginFlagDisplay | null;
  playerNumber: number | null;
  age: number | null;
  ageDays: number | null;
  injuryLevel: number | null;
  specialty: number | null;
  cards: number | null;
  form: number | null;
  stamina: number | null;
  experience: number | null;
  leadership: number | null;
  loyalty: number | null;
  motherClubBonus?: boolean | null;
  tsi: number | null;
  salarySek: number | null;
  wageIncludesForeignBonus?: boolean | null;
  form7Ratings: TeamScoutForm7RatingEntry[];
  playingPositions: TeamScoutPlayingPositionEntry[];
  usedAsManMarker: boolean;
  isLikelyTrainee: boolean;
};

