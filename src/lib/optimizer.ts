import type { LineupAssignments } from "@/app/components/LineupField";

export type SkillKey =
  | "keeper"
  | "defending"
  | "playmaking"
  | "winger"
  | "passing"
  | "scoring"
  | "setpieces";

export type TrainingSkillKey =
  | SkillKey
  | "defending_defenders_midfielders"
  | "winger_winger_attackers"
  | "passing_defenders_midfielders"
  | "scoring_setpieces";

export type CombinedTrainingSkillKey = "scoring_setpieces";
export type SingleSkillTrainingKey = Exclude<
  TrainingSkillKey,
  CombinedTrainingSkillKey
>;

export const SCORING_SETPIECES_SKILLS = ["scoring", "setpieces"] as const;

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
};

export type PlayerSkillSet = {
  KeeperSkill?: SkillValue;
  KeeperSkillMax?: SkillValue;
  DefenderSkill?: SkillValue;
  DefenderSkillMax?: SkillValue;
  PlaymakerSkill?: SkillValue;
  PlaymakerSkillMax?: SkillValue;
  WingerSkill?: SkillValue;
  WingerSkillMax?: SkillValue;
  PassingSkill?: SkillValue;
  PassingSkillMax?: SkillValue;
  ScorerSkill?: SkillValue;
  ScorerSkillMax?: SkillValue;
  SetPiecesSkill?: SkillValue;
  SetPiecesSkillMax?: SkillValue;
};

export type OptimizerPlayer = {
  id: number;
  name?: string;
  age?: number | null;
  ageDays?: number | null;
  canBePromotedIn?: number | null;
  specialty?: number | null;
  skills?: PlayerSkillSet | null;
};

type RoleGroup = "GK" | "DEF" | "WB" | "IM" | "W" | "F";

type RankingCategory = "cat1" | "cat2" | "cat3" | "cat4" | "dontCare" | "maxed";

export type RatingsByPlayer = Record<number, Record<string, number>>;

export type RankingEntry = {
  playerId: number;
  name?: string;
  category: RankingCategory;
  current: number | null;
  max: number | null;
  rankValue: number | null;
};

type TrainingPreferences = {
  allowTrainingUntilMaxedOut: boolean;
};

export type OptimizerDebug = {
  primary: { skill: SkillKey; list: RankingEntry[] };
  secondary: { skill: SkillKey; list: RankingEntry[] } | null;
  trainingSlots: {
    primary: string[];
    secondary: string[];
    all: string[];
    starSlot: string;
  };
  selection: {
    starPlayerId: number;
    primarySkill: TrainingSkillKey;
    secondarySkill: TrainingSkillKey | null;
    autoSelected: boolean;
  };
  combinedTraining?: {
    primarySkills?: SkillKey[];
    secondarySkills?: SkillKey[];
    resolvedPrimaryRevealSkill?: SkillKey | null;
    resolvedSecondaryRevealSkill?: SkillKey | null;
  };
  starSelectionRanks?: Array<{
    playerId: number;
    name?: string;
    skill: SkillKey;
    score: number;
    age?: number | null;
    ageDays?: number | null;
    current: number | null;
    max: number | null;
  }>;
};

const ALL_SLOTS = [
  "KP",
  "WB_L",
  "CD_L",
  "CD_C",
  "CD_R",
  "WB_R",
  "W_L",
  "IM_L",
  "IM_C",
  "IM_R",
  "W_R",
  "F_L",
  "F_C",
  "F_R",
] as const;

export type FieldSlotId = (typeof ALL_SLOTS)[number];
export type BenchSlotId =
  | "B_GK"
  | "B_CD"
  | "B_WB"
  | "B_IM"
  | "B_F"
  | "B_W"
  | "B_X";
export type YouthLineupSlotId = FieldSlotId | BenchSlotId;

const BENCH_ROLE_BY_SLOT: Partial<Record<BenchSlotId, RoleGroup>> = {
  B_GK: "GK",
  B_CD: "DEF",
  B_WB: "WB",
  B_IM: "IM",
  B_F: "F",
  B_W: "W",
};

const MAX_YOUTH_FIELD_PLAYERS = 11;
const AUTO_STAR_MAX_AGE_DAYS = 17 * 112;

const YOUTH_FIELD_SLOT_SET = new Set<FieldSlotId>(ALL_SLOTS);

function assignedLineupCount(lineup: LineupAssignments) {
  return ALL_SLOTS.reduce(
    (count, slot) => count + (lineup[slot] != null ? 1 : 0),
    0
  );
}

function hasLineupCapacity(lineup: LineupAssignments) {
  return assignedLineupCount(lineup) < MAX_YOUTH_FIELD_PLAYERS;
}

function canAssignYouthFieldPlayer(
  lineup: LineupAssignments,
  slot: FieldSlotId
) {
  if (!YOUTH_FIELD_SLOT_SET.has(slot)) return false;
  if (lineup[slot] != null) return false;

  const count = assignedLineupCount(lineup);
  if (count >= MAX_YOUTH_FIELD_PLAYERS) return false;

  if (slot !== "KP" && lineup.KP == null && count >= MAX_YOUTH_FIELD_PLAYERS - 1) {
    return false;
  }

  return true;
}

function assignYouthFieldPlayer(
  lineup: LineupAssignments,
  usedPlayers: Set<number>,
  slot: FieldSlotId,
  playerId: number
) {
  if (usedPlayers.has(playerId)) return false;
  if (!canAssignYouthFieldPlayer(lineup, slot)) return false;
  lineup[slot] = playerId;
  usedPlayers.add(playerId);
  return true;
}

function isValidYouthFieldLineup(lineup: LineupAssignments) {
  const ids = ALL_SLOTS
    .map((slot) => lineup[slot])
    .filter((playerId): playerId is number => playerId != null);
  if (ids.length > MAX_YOUTH_FIELD_PLAYERS) return false;
  if (ids.length > 0 && lineup.KP == null) return false;
  return new Set(ids).size === ids.length;
}

function validOptimizerResult(lineup: LineupAssignments) {
  return isValidYouthFieldLineup(lineup) ? lineup : ({} as LineupAssignments);
}

const IM_SLOTS = new Set<(typeof ALL_SLOTS)[number]>([
  "IM_L",
  "IM_C",
  "IM_R",
]);

const CD_SLOTS = new Set<(typeof ALL_SLOTS)[number]>([
  "CD_L",
  "CD_C",
  "CD_R",
]);

const ROLE_BY_SLOT: Record<(typeof ALL_SLOTS)[number], RoleGroup> = {
  KP: "GK",
  WB_L: "WB",
  WB_R: "WB",
  CD_L: "DEF",
  CD_C: "DEF",
  CD_R: "DEF",
  IM_L: "IM",
  IM_C: "IM",
  IM_R: "IM",
  W_L: "W",
  W_R: "W",
  F_L: "F",
  F_C: "F",
  F_R: "F",
};

const ROLE_RATING_CODE: Record<RoleGroup, number> = {
  GK: 100,
  WB: 101,
  DEF: 103,
  W: 106,
  IM: 107,
  F: 111,
};

const ROLE_EFFECTS: Record<SkillKey, Partial<Record<RoleGroup, number>>> = {
  keeper: { GK: 1 },
  defending: { DEF: 1, WB: 1 },
  playmaking: { IM: 1, W: 0.5 },
  winger: { W: 1, WB: 0.5 },
  passing: { IM: 1, W: 1, F: 1 },
  scoring: { F: 1 },
  setpieces: { GK: 1, DEF: 1, WB: 1, IM: 1, W: 1, F: 1 },
};

const TRAINING_ROLE_EFFECTS: Record<
  TrainingSkillKey,
  Partial<Record<RoleGroup, number>>
> = {
  ...ROLE_EFFECTS,
  defending_defenders_midfielders: { GK: 1, DEF: 1, WB: 1, IM: 1, W: 1 },
  winger_winger_attackers: { W: 1, F: 1 },
  passing_defenders_midfielders: { DEF: 1, WB: 1, IM: 1, W: 1 },
  scoring_setpieces: { GK: 1, DEF: 1, WB: 1, IM: 1, W: 1, F: 1 },
};

const TRAINING_BASE_SKILL_MAP: Record<SingleSkillTrainingKey, SkillKey> = {
  keeper: "keeper",
  defending: "defending",
  playmaking: "playmaking",
  winger: "winger",
  passing: "passing",
  scoring: "scoring",
  setpieces: "setpieces",
  defending_defenders_midfielders: "defending",
  winger_winger_attackers: "winger",
  passing_defenders_midfielders: "passing",
};

export function isScoringSetPiecesTraining(
  training: TrainingSkillKey | null | undefined
): training is "scoring_setpieces" {
  return training === "scoring_setpieces";
}

function isSingleSkillTrainingKey(
  training: TrainingSkillKey
): training is SingleSkillTrainingKey {
  return !isScoringSetPiecesTraining(training);
}

function toBaseTrainingSkill(value: SingleSkillTrainingKey): SkillKey {
  return TRAINING_BASE_SKILL_MAP[value];
}

export function getTrainingBaseSkills(
  training: TrainingSkillKey
): readonly SkillKey[] {
  if (isScoringSetPiecesTraining(training)) {
    return SCORING_SETPIECES_SKILLS;
  }
  return [TRAINING_BASE_SKILL_MAP[training]];
}

const SKILL_MAP: Record<
  SkillKey,
  { current: keyof PlayerSkillSet; max: keyof PlayerSkillSet }
> = {
  keeper: { current: "KeeperSkill", max: "KeeperSkillMax" },
  defending: { current: "DefenderSkill", max: "DefenderSkillMax" },
  playmaking: { current: "PlaymakerSkill", max: "PlaymakerSkillMax" },
  winger: { current: "WingerSkill", max: "WingerSkillMax" },
  passing: { current: "PassingSkill", max: "PassingSkillMax" },
  scoring: { current: "ScorerSkill", max: "ScorerSkillMax" },
  setpieces: { current: "SetPiecesSkill", max: "SetPiecesSkillMax" },
};

const SKILL_PAIRS: Record<SkillKey, SkillKey[]> = {
  scoring: ["passing", "winger"],
  passing: ["scoring", "playmaking", "defending"],
  playmaking: ["passing", "winger", "defending"],
  winger: ["playmaking"],
  defending: ["passing", "playmaking", "winger"],
  keeper: ["setpieces"],
  setpieces: ["keeper"],
};

function toNumber(value?: SkillValue): number | null {
  if (!value) return null;
  if (value["@_IsAvailable"] && value["@_IsAvailable"] !== "True") return null;
  const raw = value["#text"];
  if (raw === undefined || raw === null || raw === "") return null;
  const numeric = Number(raw);
  return Number.isNaN(numeric) ? null : numeric;
}

function skillValues(player: OptimizerPlayer, skill: SkillKey) {
  const map = SKILL_MAP[skill];
  return {
    current: toNumber(player.skills?.[map.current]),
    max: toNumber(player.skills?.[map.max]),
  };
}

export function resolvePrimaryCurrentRevealSkill(
  player: OptimizerPlayer,
  training: TrainingSkillKey
): SkillKey | null {
  if (!isScoringSetPiecesTraining(training)) {
    return toBaseTrainingSkill(training);
  }
  const scoring = skillValues(player, "scoring");
  const setPieces = skillValues(player, "setpieces");
  const scoringUnknown = scoring.current === null;
  const setPiecesUnknown = setPieces.current === null;
  if (scoringUnknown && !setPiecesUnknown) return "scoring";
  if (!scoringUnknown && setPiecesUnknown) return "setpieces";
  if (!scoringUnknown && !setPiecesUnknown) return null;
  const scoringMax = scoring.max ?? Number.NEGATIVE_INFINITY;
  const setPiecesMax = setPieces.max ?? Number.NEGATIVE_INFINITY;
  if (setPiecesMax > scoringMax) return "setpieces";
  return "scoring";
}

export function resolveSecondaryMaxRevealSkill(
  player: OptimizerPlayer,
  training: TrainingSkillKey
): SkillKey | null {
  if (!isScoringSetPiecesTraining(training)) {
    return toBaseTrainingSkill(training);
  }
  const scoring = skillValues(player, "scoring");
  const setPieces = skillValues(player, "setpieces");
  const scoringUnknown = scoring.max === null;
  const setPiecesUnknown = setPieces.max === null;
  if (scoringUnknown && !setPiecesUnknown) return "scoring";
  if (!scoringUnknown && setPiecesUnknown) return "setpieces";
  if (!scoringUnknown && !setPiecesUnknown) return null;
  const scoringCurrent = scoring.current ?? Number.NEGATIVE_INFINITY;
  const setPiecesCurrent = setPieces.current ?? Number.NEGATIVE_INFINITY;
  if (setPiecesCurrent > scoringCurrent) return "setpieces";
  return "scoring";
}

function totalAgeDays(player: OptimizerPlayer): number | null {
  const age = typeof player.age === "number" ? player.age : null;
  const ageDays = typeof player.ageDays === "number" ? player.ageDays : 0;
  return age !== null ? age * 112 + ageDays : null;
}

function keeperSelectionValues(player: OptimizerPlayer) {
  const current = toNumber(player.skills?.KeeperSkill) ?? 0;
  const max = toNumber(player.skills?.KeeperSkillMax) ?? 0;
  return {
    current,
    max,
    score: current + max,
  };
}

function findBestFallbackKeeperBySkill(
  players: OptimizerPlayer[],
  usedPlayers: Set<number>
): OptimizerPlayer | null {
  const candidates = players.filter((player) => !usedPlayers.has(player.id));
  candidates.sort((left, right) => {
    const leftKeeper = keeperSelectionValues(left);
    const rightKeeper = keeperSelectionValues(right);

    if (rightKeeper.score !== leftKeeper.score) {
      return rightKeeper.score - leftKeeper.score;
    }
    if (rightKeeper.current !== leftKeeper.current) {
      return rightKeeper.current - leftKeeper.current;
    }
    if (rightKeeper.max !== leftKeeper.max) {
      return rightKeeper.max - leftKeeper.max;
    }

    const leftAgeDays = totalAgeDays(left);
    const rightAgeDays = totalAgeDays(right);
    if (
      leftAgeDays !== null &&
      rightAgeDays !== null &&
      leftAgeDays !== rightAgeDays
    ) {
      return leftAgeDays - rightAgeDays;
    }
    if (leftAgeDays === null && rightAgeDays !== null) return 1;
    if (leftAgeDays !== null && rightAgeDays === null) return -1;

    return left.id - right.id;
  });

  return candidates[0] ?? null;
}

function ensureYouthGoalkeeper(
  lineup: LineupAssignments,
  players: OptimizerPlayer[],
  usedPlayers: Set<number>
) {
  if (lineup.KP != null) return true;

  const keeper = findBestFallbackKeeperBySkill(players, usedPlayers);
  if (!keeper) return false;

  return assignYouthFieldPlayer(lineup, usedPlayers, "KP", keeper.id);
}

function resolveTrainingPreferences(
  preferences?: Partial<TrainingPreferences>
): TrainingPreferences {
  return {
    allowTrainingUntilMaxedOut:
      preferences?.allowTrainingUntilMaxedOut ?? true,
  };
}

function isCurrentAtMax(player: OptimizerPlayer, skill: SkillKey) {
  const { current, max } = skillValues(player, skill);
  return current !== null && max !== null && current >= max;
}

function isMaxReached(player: OptimizerPlayer, skill: SkillKey) {
  const map = SKILL_MAP[skill];
  const value = player.skills?.[map.current] as
    | { ["@_IsMaxReached"]?: string }
    | undefined;
  return value?.["@_IsMaxReached"] === "True";
}

function isSkillMaxed(player: OptimizerPlayer, skill: SkillKey) {
  return isMaxReached(player, skill);
}

function isTrainingBlocked(
  player: OptimizerPlayer,
  skill: SkillKey,
  allowTrainingUntilMaxedOut: boolean
) {
  if (isSkillMaxed(player, skill)) return true;
  if (!allowTrainingUntilMaxedOut && isCurrentAtMax(player, skill)) return true;
  return false;
}

function canStillBenefitFromSecondaryTraining(
  player: OptimizerPlayer,
  secondary: SkillKey
) {
  const { current, max } = skillValues(player, secondary);
  return !(current !== null && max !== null && current >= max);
}

function pickStarTrainingSlot(
  primary: SkillKey,
  primarySlots: Set<(typeof ALL_SLOTS)[number]>,
  primaryFullSlots: Set<(typeof ALL_SLOTS)[number]>,
  secondary: SkillKey | null,
  secondaryFullSlots: Set<(typeof ALL_SLOTS)[number]> | null,
  prefersSharedSlot: boolean,
  allowedSlots?: Set<(typeof ALL_SLOTS)[number]>
) {
  const primarySlotList = [...primarySlots];
  const primaryFullSlotList = [...primaryFullSlots];
  const sharedSlots =
    secondary && secondaryFullSlots
      ? [...primaryFullSlots].filter((slot) => secondaryFullSlots.has(slot))
      : [];
  const starSlotCandidates =
    prefersSharedSlot && sharedSlots.length
      ? sharedSlots
      : primaryFullSlotList.length
        ? primaryFullSlotList
        : primarySlotList;
  const filteredCandidates = allowedSlots
    ? starSlotCandidates.filter((slot) => allowedSlots.has(slot))
    : starSlotCandidates;
  const resolvedCandidates = filteredCandidates.length
    ? filteredCandidates
    : starSlotCandidates;
  const preferredStarSlots = preferStarSlots(primary, resolvedCandidates);
  return preferredStarSlots[Math.floor(Math.random() * preferredStarSlots.length)];
}

function scoreSkillForStarSelection(
  player: OptimizerPlayer,
  skill: SkillKey,
  allowTrainingUntilMaxedOut: boolean
): number | null {
  const { current, max } = skillValues(player, skill);
  if (current === null) return null;
  if (isTrainingBlocked(player, skill, allowTrainingUntilMaxedOut)) return null;
  return current * 100 + (max !== null ? 50 + max : 0);
}

function nextSkillTieBreakerScore(
  player: OptimizerPlayer,
  primarySkill: SkillKey,
  allowTrainingUntilMaxedOut: boolean
): number | null {
  const pairedSkills = SKILL_PAIRS[primarySkill] ?? [];
  for (const candidate of pairedSkills) {
    const score = scoreSkillForStarSelection(
      player,
      candidate,
      allowTrainingUntilMaxedOut
    );
    if (score !== null) return score;
  }
  const otherSkills: SkillKey[] = [
    "keeper",
    "defending",
    "playmaking",
    "winger",
    "passing",
    "scoring",
    "setpieces",
  ];
  let bestScore: number | null = null;
  otherSkills.forEach((skill) => {
    if (skill === primarySkill) return;
    const score = scoreSkillForStarSelection(
      player,
      skill,
      allowTrainingUntilMaxedOut
    );
    if (score === null) return;
    if (bestScore === null || score > bestScore) {
      bestScore = score;
    }
  });
  return bestScore;
}

function trainingPriorityTier(
  player: OptimizerPlayer,
  skills: SkillKey[],
  allowTrainingUntilMaxedOut: boolean
) {
  if (!skills.length) return 0;
  if (skills.some((skill) => isMaxReached(player, skill))) {
    return 2;
  }
  if (
    !allowTrainingUntilMaxedOut &&
    skills.some((skill) => isCurrentAtMax(player, skill))
  ) {
    return 1;
  }
  return 0;
}

function slotsForSkill(skill: SkillKey) {
  const slots = new Set<(typeof ALL_SLOTS)[number]>();
  ALL_SLOTS.forEach((slot) => {
    const role = ROLE_BY_SLOT[slot];
    if ((ROLE_EFFECTS[skill][role] ?? 0) > 0) {
      slots.add(slot);
    }
  });
  return slots;
}

function slotsForSkillByIntensity(skill: SkillKey, intensity: 1 | 0.5) {
  const slots = new Set<(typeof ALL_SLOTS)[number]>();
  ALL_SLOTS.forEach((slot) => {
    const role = ROLE_BY_SLOT[slot];
    if ((ROLE_EFFECTS[skill][role] ?? 0) === intensity) {
      slots.add(slot);
    }
  });
  return slots;
}

function preferStarSlots(
  primarySkill: SkillKey | null | undefined,
  slots: (typeof ALL_SLOTS)[number][]
) {
  if (primarySkill === "playmaking") {
    const imSlots = slots.filter((slot) => IM_SLOTS.has(slot));
    if (imSlots.length) return imSlots;
  }
  if (primarySkill === "winger") {
    const wSlots = slots.filter((slot) => ROLE_BY_SLOT[slot] === "W");
    if (wSlots.length) return wSlots;
  }
  return slots;
}

function ratingForSlot(
  ratingsByPlayer: RatingsByPlayer | null | undefined,
  playerId: number,
  slot: (typeof ALL_SLOTS)[number]
) {
  if (!ratingsByPlayer) return null;
  const role = ROLE_BY_SLOT[slot];
  const code = ROLE_RATING_CODE[role];
  const value = ratingsByPlayer[playerId]?.[String(code)];
  return typeof value === "number" ? value : null;
}

function ratingForRole(
  ratingsByPlayer: RatingsByPlayer | null | undefined,
  playerId: number,
  role: RoleGroup
) {
  if (!ratingsByPlayer) return null;
  const code = ROLE_RATING_CODE[role];
  const value = ratingsByPlayer[playerId]?.[String(code)];
  return typeof value === "number" ? value : null;
}

function bestPlayerRoleRating(
  ratingsByPlayer: RatingsByPlayer | null | undefined,
  playerId: number
) {
  let best: number | null = null;
  (Object.keys(ROLE_RATING_CODE) as RoleGroup[]).forEach((role) => {
    const value = ratingForRole(ratingsByPlayer, playerId, role);
    if (value === null) return;
    if (best === null || value > best) {
      best = value;
    }
  });
  return best;
}

function slotTrainsSkill(slot: (typeof ALL_SLOTS)[number], skill: SkillKey) {
  const role = ROLE_BY_SLOT[slot];
  return (ROLE_EFFECTS[skill][role] ?? 0) > 0;
}

function slotTrainingSkills(
  slot: (typeof ALL_SLOTS)[number],
  primary: SkillKey,
  secondary: SkillKey | null
) {
  const skills: SkillKey[] = [];
  if (slotTrainsSkill(slot, primary)) skills.push(primary);
  if (secondary && slotTrainsSkill(slot, secondary) && secondary !== primary) {
    skills.push(secondary);
  }
  return skills;
}

function benchTrainingSkills(
  slot: BenchSlotId,
  primary: SkillKey | null,
  secondary: SkillKey | null
): SkillKey[] {
  if (slot === "B_X") {
    return [primary, secondary].filter(Boolean) as SkillKey[];
  }
  const role = BENCH_ROLE_BY_SLOT[slot];
  if (!role) return [];
  const skills: SkillKey[] = [];
  if (primary && (ROLE_EFFECTS[primary][role] ?? 0) > 0) skills.push(primary);
  if (
    secondary &&
    secondary !== primary &&
    (ROLE_EFFECTS[secondary][role] ?? 0) > 0
  ) {
    skills.push(secondary);
  }
  if (skills.length) return skills;
  if (slot === "B_GK") return ["keeper"];
  if (slot === "B_CD") return ["defending"];
  if (slot === "B_WB") return ["defending", "winger"];
  if (slot === "B_IM") return ["playmaking"];
  if (slot === "B_F") return ["scoring"];
  if (slot === "B_W") return ["winger"];
  return [];
}

export function rankPlayersForYouthLineupSlot(
  players: OptimizerPlayer[],
  slotId: YouthLineupSlotId,
  ratingsByPlayer: RatingsByPlayer | null | undefined,
  primary: TrainingSkillKey | null,
  secondary: TrainingSkillKey | null,
  preferences?: Partial<TrainingPreferences>,
  excludedPlayerIds?: Iterable<number>
) {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  const excluded = excludedPlayerIds ? new Set<number>(excludedPlayerIds) : null;
  const isFieldSlot = (ALL_SLOTS as readonly string[]).includes(slotId);
  const candidates = players.filter((player) => !excluded?.has(player.id));
  const combinedRankingIndex = new Map(
    buildScoringSetPiecesRanking(players, preferences).ordered.map((entry, index) => [
      entry.playerId,
      index,
    ])
  );
  const slotUsesCombinedTraining = () => {
    if (isFieldSlot) {
      const role = ROLE_BY_SLOT[slotId as FieldSlotId];
      return [primary, secondary].some(
        (training) =>
          isScoringSetPiecesTraining(training) &&
          (TRAINING_ROLE_EFFECTS[training][role] ?? 0) > 0
      );
    }
    return slotId === "B_X" && [primary, secondary].some(isScoringSetPiecesTraining);
  };
  const useCombinedRanking = slotUsesCombinedTraining();
  const skillsForFieldSlot = (slot: FieldSlotId) => {
    const role = ROLE_BY_SLOT[slot];
    const skills: SkillKey[] = [];
    [primary, secondary].forEach((training) => {
      if (!training) return;
      if ((TRAINING_ROLE_EFFECTS[training][role] ?? 0) <= 0) return;
      getTrainingBaseSkills(training).forEach((skill) => {
        if (!skills.includes(skill)) skills.push(skill);
      });
    });
    return skills;
  };
  const skillsForBenchSlot = (slot: BenchSlotId) => {
    if (slot === "B_X") {
      const skills: SkillKey[] = [];
      [primary, secondary].forEach((training) => {
        if (!training) return;
        getTrainingBaseSkills(training).forEach((skill) => {
          if (!skills.includes(skill)) skills.push(skill);
        });
      });
      return skills;
    }
    const primarySkill =
      primary && isSingleSkillTrainingKey(primary) ? toBaseTrainingSkill(primary) : null;
    const secondarySkill =
      secondary && isSingleSkillTrainingKey(secondary)
        ? toBaseTrainingSkill(secondary)
        : null;
    return benchTrainingSkills(slot, primarySkill, secondarySkill);
  };
  candidates.sort((left, right) => {
    const skills = isFieldSlot
      ? skillsForFieldSlot(slotId as FieldSlotId)
      : skillsForBenchSlot(slotId as BenchSlotId);
    if (useCombinedRanking) {
      const leftBenefit = trainingRegimenBenefitCount(
        left,
        "scoring_setpieces",
        allowTrainingUntilMaxedOut
      );
      const rightBenefit = trainingRegimenBenefitCount(
        right,
        "scoring_setpieces",
        allowTrainingUntilMaxedOut
      );
      if (leftBenefit !== rightBenefit) return rightBenefit - leftBenefit;
      const leftCombinedIndex =
        combinedRankingIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightCombinedIndex =
        combinedRankingIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      if (leftCombinedIndex !== rightCombinedIndex) {
        return leftCombinedIndex - rightCombinedIndex;
      }
    }
    const leftTier = trainingPriorityTier(
      left,
      skills,
      allowTrainingUntilMaxedOut
    );
    const rightTier = trainingPriorityTier(
      right,
      skills,
      allowTrainingUntilMaxedOut
    );
    if (leftTier !== rightTier) return leftTier - rightTier;
    const leftRating = isFieldSlot
      ? ratingForSlot(ratingsByPlayer, left.id, slotId as FieldSlotId)
      : slotId === "B_X"
      ? bestPlayerRoleRating(ratingsByPlayer, left.id)
      : ratingForRole(
          ratingsByPlayer,
          left.id,
          BENCH_ROLE_BY_SLOT[slotId as BenchSlotId] as RoleGroup
        );
    const rightRating = isFieldSlot
      ? ratingForSlot(ratingsByPlayer, right.id, slotId as FieldSlotId)
      : slotId === "B_X"
      ? bestPlayerRoleRating(ratingsByPlayer, right.id)
      : ratingForRole(
          ratingsByPlayer,
          right.id,
          BENCH_ROLE_BY_SLOT[slotId as BenchSlotId] as RoleGroup
        );
    if (leftRating === null && rightRating === null) {
      return (left.name ?? "").localeCompare(right.name ?? "", undefined, {
        sensitivity: "base",
      });
    }
    if (leftRating === null) return 1;
    if (rightRating === null) return -1;
    if (rightRating !== leftRating) return rightRating - leftRating;
    return (left.name ?? "").localeCompare(right.name ?? "", undefined, {
      sensitivity: "base",
    });
  });
  return candidates;
}

function capSecondarySlots(
  primarySlots: Set<(typeof ALL_SLOTS)[number]>,
  secondarySlots: Set<(typeof ALL_SLOTS)[number]>
) {
  const secondaryOnly = [...secondarySlots].filter(
    (slot) => !primarySlots.has(slot)
  );
  const keeperInPrimary = primarySlots.has("KP");
  const capacity = 11 - primarySlots.size - (keeperInPrimary ? 0 : 1);
  const capped = shuffleSlots(secondaryOnly).slice(0, Math.max(0, capacity));
  return new Set<(typeof ALL_SLOTS)[number]>(capped);
}

function trainingSlotSet(primary: SkillKey, secondary: SkillKey) {
  const primarySlots = slotsForSkill(primary);
  const secondarySlots = slotsForSkill(secondary);

  if (primary === secondary) {
    return {
      primarySkill: primary,
      secondarySkill: null as SkillKey | null,
      primarySlots,
      secondarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
    };
  }

  const primaryOvershoots = primarySlots.size > 11;
  const secondaryOvershoots = secondarySlots.size > 11;

  if (primaryOvershoots && !secondaryOvershoots) {
    return {
      primarySkill: secondary,
      secondarySkill: null as SkillKey | null,
      primarySlots: secondarySlots,
      secondarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
    };
  }
  if (secondaryOvershoots && !primaryOvershoots) {
    return {
      primarySkill: primary,
      secondarySkill: null as SkillKey | null,
      primarySlots,
      secondarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
    };
  }

  const cappedSecondarySlots = capSecondarySlots(primarySlots, secondarySlots);
  return {
    primarySkill: primary,
    secondarySkill: secondary,
    primarySlots,
    secondarySlots: cappedSecondarySlots,
  };
}

export function getTrainingSlots(
  primary: TrainingSkillKey | null,
  secondary: TrainingSkillKey | null
) {
  if (!primary) {
    return {
      primarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
      secondarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
      primaryFullSlots: new Set<(typeof ALL_SLOTS)[number]>(),
      primaryHalfSlots: new Set<(typeof ALL_SLOTS)[number]>(),
      secondaryFullSlots: new Set<(typeof ALL_SLOTS)[number]>(),
      secondaryHalfSlots: new Set<(typeof ALL_SLOTS)[number]>(),
      allSlots: new Set<(typeof ALL_SLOTS)[number]>(),
    };
  }
  const slotsForTrainingSkill = (skill: TrainingSkillKey) => {
    const slots = new Set<(typeof ALL_SLOTS)[number]>();
    ALL_SLOTS.forEach((slot) => {
      const role = ROLE_BY_SLOT[slot];
      if ((TRAINING_ROLE_EFFECTS[skill][role] ?? 0) > 0) {
        slots.add(slot);
      }
    });
    return slots;
  };
  const slotsForTrainingSkillByIntensity = (
    skill: TrainingSkillKey,
    intensity: 1 | 0.5
  ) => {
    const slots = new Set<(typeof ALL_SLOTS)[number]>();
    ALL_SLOTS.forEach((slot) => {
      const role = ROLE_BY_SLOT[slot];
      if ((TRAINING_ROLE_EFFECTS[skill][role] ?? 0) === intensity) {
        slots.add(slot);
      }
    });
    return slots;
  };
  const primarySlots = slotsForTrainingSkill(primary);
  const primaryFullSlots = slotsForTrainingSkillByIntensity(primary, 1);
  const primaryHalfSlots = slotsForTrainingSkillByIntensity(primary, 0.5);
  if (!secondary || secondary === primary) {
    return {
      primarySlots,
      secondarySlots: new Set(primarySlots),
      primaryFullSlots,
      primaryHalfSlots,
      secondaryFullSlots: new Set(primaryFullSlots),
      secondaryHalfSlots: new Set(primaryHalfSlots),
      allSlots: new Set(primarySlots),
    };
  }
  const secondarySlots = slotsForTrainingSkill(secondary);
  const secondaryFullSlots = slotsForTrainingSkillByIntensity(secondary, 1);
  const secondaryHalfSlots = slotsForTrainingSkillByIntensity(secondary, 0.5);
  return {
    primarySlots,
    secondarySlots,
    primaryFullSlots,
    primaryHalfSlots,
    secondaryFullSlots,
    secondaryHalfSlots,
    allSlots: new Set<(typeof ALL_SLOTS)[number]>([
      ...primarySlots,
      ...secondarySlots,
    ]),
  };
}

function chooseStarAndTraining(
  players: OptimizerPlayer[],
  preferences?: Partial<TrainingPreferences>
): {
  starPlayerId: number;
  primarySkill: SkillKey;
  secondarySkill: SkillKey | null;
  candidates: OptimizerDebug["starSelectionRanks"];
} | null {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  const totalAgeDays = (player: OptimizerPlayer): number | null => {
    const age = player.age ?? null;
    if (age === null) return null;
    const days = player.ageDays ?? null;
    return age * 112 + (days ?? 0);
  };
  const promotionAgeDays = (player: OptimizerPlayer): number | null => {
    const base = totalAgeDays(player);
    if (base === null) return null;
    const promoDays = player.canBePromotedIn ?? null;
    if (promoDays === null) return null;
    return base + Math.max(0, promoDays);
  };
  let best: {
    playerId: number;
    skill: SkillKey;
    score: number;
    nextSkillScore?: number | null;
    hasSpecialty?: boolean;
    ageDays?: number | null;
    promoAgeDays?: number | null;
    canBePromotedIn?: number | null;
  } | null = null;
  const candidates: Array<{
    playerId: number;
    name?: string;
    skill: SkillKey;
    score: number;
    age?: number | null;
    ageDays?: number | null;
    current: number | null;
    max: number | null;
  }> = [];
  const skillKeys: SkillKey[] = [
    "keeper",
    "defending",
    "playmaking",
    "winger",
    "passing",
    "scoring",
    "setpieces",
  ];

  players.forEach((player) => {
    const playerAgeDays = totalAgeDays(player);
    if (playerAgeDays === null || playerAgeDays >= AUTO_STAR_MAX_AGE_DAYS) {
      return;
    }

    skillKeys.forEach((skill) => {
      const { current, max } = skillValues(player, skill);
      if (current === null) return;
      if (isTrainingBlocked(player, skill, allowTrainingUntilMaxedOut)) return;
      const score = current * 100 + (max !== null ? 50 + max : 0);
      const nextSkillScore = nextSkillTieBreakerScore(
        player,
        skill,
        allowTrainingUntilMaxedOut
      );
      const hasSpecialty = Number(player.specialty ?? 0) > 0;
      candidates.push({
        playerId: player.id,
        name: player.name,
        skill,
        score,
        age: player.age ?? null,
        ageDays: player.ageDays ?? null,
        current,
        max,
      });
      if (!best || score > best.score) {
        best = {
          playerId: player.id,
          skill,
          score,
          nextSkillScore,
          hasSpecialty,
          ageDays: playerAgeDays,
          promoAgeDays: promotionAgeDays(player),
          canBePromotedIn: player.canBePromotedIn ?? null,
        };
      } else if (best && score === best.score) {
        const currentNextSkillScore = nextSkillScore ?? -1;
        const bestNextSkillScore = best.nextSkillScore ?? -1;
        if (currentNextSkillScore > bestNextSkillScore) {
          best = {
            playerId: player.id,
            skill,
            score,
            nextSkillScore,
            hasSpecialty,
            ageDays: playerAgeDays,
            promoAgeDays: promotionAgeDays(player),
            canBePromotedIn: player.canBePromotedIn ?? null,
          };
          return;
        }
        if (currentNextSkillScore < bestNextSkillScore) {
          return;
        }
        const bestHasSpecialty = Boolean(best.hasSpecialty);
        if (hasSpecialty && !bestHasSpecialty) {
          best = {
            playerId: player.id,
            skill,
            score,
            nextSkillScore,
            hasSpecialty,
            ageDays: playerAgeDays,
            promoAgeDays: promotionAgeDays(player),
            canBePromotedIn: player.canBePromotedIn ?? null,
          };
          return;
        }
        if (!hasSpecialty && bestHasSpecialty) {
          return;
        }
        const currentPromoAgeDays = promotionAgeDays(player);
        const bestPromoAgeDays = best.promoAgeDays ?? null;
        if (
          currentPromoAgeDays !== null &&
          (bestPromoAgeDays === null || currentPromoAgeDays < bestPromoAgeDays)
        ) {
          best = {
            playerId: player.id,
            skill,
            score,
            nextSkillScore,
            hasSpecialty,
            ageDays: playerAgeDays,
            promoAgeDays: currentPromoAgeDays,
            canBePromotedIn: player.canBePromotedIn ?? null,
          };
        } else if (
          currentPromoAgeDays !== null &&
          bestPromoAgeDays !== null &&
          currentPromoAgeDays === bestPromoAgeDays
        ) {
          const currentPromoIn = player.canBePromotedIn ?? null;
          const bestPromoIn = best.canBePromotedIn ?? null;
          if (
            currentPromoIn !== null &&
            (bestPromoIn === null || currentPromoIn < bestPromoIn)
          ) {
              best = {
                playerId: player.id,
                skill,
                score,
                nextSkillScore,
                hasSpecialty,
                ageDays: playerAgeDays,
                promoAgeDays: currentPromoAgeDays,
                canBePromotedIn: currentPromoIn,
              };
            }
        }
      }
    });
  });

  if (!best) return null;

  const bestCandidate: {
    playerId: number;
    skill: SkillKey;
    score: number;
    ageDays?: number | null;
  } = best;
  const primarySkill: SkillKey = bestCandidate.skill;
  const starPlayer = players.find(
    (player) => player.id === bestCandidate.playerId
  );
  let secondarySkill: SkillKey | null = null;

  if (starPlayer) {
    const candidates = SKILL_PAIRS[primarySkill] ?? [];
    for (const candidate of candidates) {
      if (isTrainingBlocked(starPlayer, candidate, allowTrainingUntilMaxedOut)) {
        continue;
      }
      secondarySkill = candidate;
      break;
    }
  }

  if (!secondarySkill) {
    let bestSkill: SkillKey | null = null;
    let bestRank = -1;
    skillKeys.forEach((skill) => {
      if (skill === primarySkill) return;
      const ranking = buildSkillRanking(players, skill, preferences).ordered;
      const topRank = ranking.find((entry) => entry.rankValue !== null)?.rankValue;
      if (topRank !== undefined && topRank !== null && topRank > bestRank) {
        bestRank = topRank;
        bestSkill = skill;
      }
    });
    secondarySkill = bestSkill;
  }

  return {
    starPlayerId: best.playerId,
    primarySkill,
    secondarySkill,
    candidates,
  };
}

export function getAutoSelection(
  players: OptimizerPlayer[],
  preferences?: Partial<TrainingPreferences>
): { starPlayerId: number; primarySkill: SkillKey; secondarySkill: SkillKey | null } | null {
  const auto = chooseStarAndTraining(players, preferences);
  if (!auto) return null;
  return {
    starPlayerId: auto.starPlayerId,
    primarySkill: auto.primarySkill,
    secondarySkill: auto.secondarySkill,
  };
}

export type AutoSelection = ReturnType<typeof getAutoSelection>;

export function getTrainingForStar(
  players: OptimizerPlayer[],
  starPlayerId: number,
  preferences?: Partial<TrainingPreferences>
): { primarySkill: SkillKey; secondarySkill: SkillKey | null } | null {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  const starPlayer = players.find((player) => player.id === starPlayerId);
  if (!starPlayer) return null;
  const skillKeys: SkillKey[] = [
    "keeper",
    "defending",
    "playmaking",
    "winger",
    "passing",
    "scoring",
    "setpieces",
  ];

  let bestSkill: SkillKey | null = null;
  let bestScore = -1;
  skillKeys.forEach((skill) => {
    const { current, max } = skillValues(starPlayer, skill);
    if (current === null) return;
    if (isTrainingBlocked(starPlayer, skill, allowTrainingUntilMaxedOut)) return;
    const score = current * 100 + (max !== null ? 50 + max : 0);
    if (score > bestScore) {
      bestScore = score;
      bestSkill = skill;
    }
  });

  if (!bestSkill) return null;

  let secondarySkill: SkillKey | null = null;
  const pairCandidates =
    bestSkill ? SKILL_PAIRS[bestSkill] ?? [] : [];
  for (const candidate of pairCandidates) {
    if (isTrainingBlocked(starPlayer, candidate, allowTrainingUntilMaxedOut)) {
      continue;
    }
    secondarySkill = candidate;
    break;
  }

  if (!secondarySkill) {
    let bestRank = -1;
    skillKeys.forEach((skill) => {
      if (skill === bestSkill) return;
      const ranking = buildSkillRanking(players, skill, preferences).ordered;
      const topRank = ranking.find((entry) => entry.rankValue !== null)?.rankValue;
      if (topRank !== undefined && topRank !== null && topRank > bestRank) {
        bestRank = topRank;
        secondarySkill = skill;
      }
    });
  }

  return {
    primarySkill: bestSkill,
    secondarySkill,
  };
}

export function buildSkillRanking(
  players: OptimizerPlayer[],
  skill: SkillKey,
  preferences?: Partial<TrainingPreferences>
) {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  const totalAgeDaysByPlayerId = new Map<number, number | null>();
  players.forEach((player) => {
    const age = typeof player.age === "number" ? player.age : null;
    const ageDays = typeof player.ageDays === "number" ? player.ageDays : 0;
    totalAgeDaysByPlayerId.set(
      player.id,
      age !== null ? age * 112 + ageDays : null
    );
  });
  const entries: RankingEntry[] = players.map((player) => {
    const { current, max } = skillValues(player, skill);
    const maxReached = isMaxReached(player, skill);
    let category: RankingCategory = "cat2";

    if (current !== null && max !== null) {
      category = "cat1";
    } else if (current === null && max === null) {
      category = "cat2";
    } else if (current === null && max !== null) {
      category = "cat3";
    } else if (current !== null && max === null) {
      category = "cat4";
    }

    let dontCare = false;
    if (maxReached) {
      category = "maxed";
    }
    if (category === "cat1") {
      if (!allowTrainingUntilMaxedOut && isCurrentAtMax(player, skill)) {
        dontCare = true;
      }
      if ((current ?? 0) < 5 || (max ?? 0) < 6) dontCare = true;
    } else if (category === "cat3") {
      if ((max ?? 0) < 6) dontCare = true;
    } else if (category === "cat4") {
      if ((current ?? 0) < 5) dontCare = true;
    }

    const rankValue =
      category === "cat1" || category === "cat3"
        ? max
        : category === "cat4"
        ? current
        : null;

    return {
      playerId: player.id,
      name: player.name,
      category: dontCare ? "dontCare" : category,
      current,
      max,
      rankValue: rankValue ?? null,
    };
  });

  const byRankDesc = (a: RankingEntry, b: RankingEntry) =>
    (b.rankValue ?? -1) - (a.rankValue ?? -1);
  const byYoungestFirst = (a: RankingEntry, b: RankingEntry) => {
    const aAgeDays = totalAgeDaysByPlayerId.get(a.playerId) ?? null;
    const bAgeDays = totalAgeDaysByPlayerId.get(b.playerId) ?? null;
    if (aAgeDays === null && bAgeDays === null) {
      return a.playerId - b.playerId;
    }
    if (aAgeDays === null) return 1;
    if (bAgeDays === null) return -1;
    if (aAgeDays !== bAgeDays) return aAgeDays - bAgeDays;
    return a.playerId - b.playerId;
  };

  const cat1 = entries.filter((entry) => entry.category === "cat1").sort(byRankDesc);
  const cat4 = entries.filter((entry) => entry.category === "cat4").sort(byRankDesc);
  const cat3 = entries.filter((entry) => entry.category === "cat3").sort(byRankDesc);
  const cat2 = entries.filter((entry) => entry.category === "cat2").sort(byYoungestFirst);
  const dontCare = entries
    .filter((entry) => entry.category === "dontCare")
    .sort(byYoungestFirst);
  const maxed = entries.filter((entry) => entry.category === "maxed").sort(byYoungestFirst);

  const ordered = [...cat1, ...cat4, ...cat3, ...cat2, ...dontCare, ...maxed];
  return { ordered, debug: ordered };
}

export type CombinedRankingEntry = RankingEntry & {
  benefitCount: number;
  scoringIndex: number;
  setPiecesIndex: number;
  combinedIndexSum: number;
  bestIndividualIndex: number;
};

export function trainingRegimenBenefitCount(
  player: OptimizerPlayer,
  training: TrainingSkillKey,
  allowTrainingUntilMaxedOut: boolean
) {
  return getTrainingBaseSkills(training).filter(
    (skill) => !isTrainingBlocked(player, skill, allowTrainingUntilMaxedOut)
  ).length;
}

export function isTrainingRegimenBlocked(
  player: OptimizerPlayer,
  training: TrainingSkillKey,
  preferences?: Partial<TrainingPreferences>
) {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  return trainingRegimenBenefitCount(player, training, allowTrainingUntilMaxedOut) === 0;
}

export function buildScoringSetPiecesRanking(
  players: OptimizerPlayer[],
  preferences?: Partial<TrainingPreferences>
) {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  const scoringRanking = buildSkillRanking(players, "scoring", preferences);
  const setPiecesRanking = buildSkillRanking(players, "setpieces", preferences);
  const scoringIndexByPlayerId = new Map(
    scoringRanking.ordered.map((entry, index) => [entry.playerId, index])
  );
  const setPiecesIndexByPlayerId = new Map(
    setPiecesRanking.ordered.map((entry, index) => [entry.playerId, index])
  );
  const ageByPlayerId = new Map(players.map((player) => [player.id, totalAgeDays(player)]));

  const entries: CombinedRankingEntry[] = players.map((player) => {
    const scoringCanBenefit = !isTrainingBlocked(
      player,
      "scoring",
      allowTrainingUntilMaxedOut
    );
    const setPiecesCanBenefit = !isTrainingBlocked(
      player,
      "setpieces",
      allowTrainingUntilMaxedOut
    );
    const benefitCount = Number(scoringCanBenefit) + Number(setPiecesCanBenefit);
    const scoringIndex = scoringIndexByPlayerId.get(player.id) ?? Number.MAX_SAFE_INTEGER;
    const setPiecesIndex =
      setPiecesIndexByPlayerId.get(player.id) ?? Number.MAX_SAFE_INTEGER;
    const scoringValues = skillValues(player, "scoring");
    const setPiecesValues = skillValues(player, "setpieces");
    return {
      playerId: player.id,
      name: player.name,
      category:
        benefitCount === 2 ? "cat1" : benefitCount === 1 ? "cat4" : "maxed",
      current:
        scoringValues.current !== null && setPiecesValues.current !== null
          ? scoringValues.current + setPiecesValues.current
          : null,
      max:
        scoringValues.max !== null && setPiecesValues.max !== null
          ? scoringValues.max + setPiecesValues.max
          : null,
      rankValue: benefitCount,
      benefitCount,
      scoringIndex,
      setPiecesIndex,
      combinedIndexSum: scoringIndex + setPiecesIndex,
      bestIndividualIndex: Math.min(scoringIndex, setPiecesIndex),
    };
  });

  entries.sort((left, right) => {
    if (right.benefitCount !== left.benefitCount) {
      return right.benefitCount - left.benefitCount;
    }
    if (left.combinedIndexSum !== right.combinedIndexSum) {
      return left.combinedIndexSum - right.combinedIndexSum;
    }
    if (left.bestIndividualIndex !== right.bestIndividualIndex) {
      return left.bestIndividualIndex - right.bestIndividualIndex;
    }
    const leftAge = ageByPlayerId.get(left.playerId) ?? null;
    const rightAge = ageByPlayerId.get(right.playerId) ?? null;
    if (leftAge !== null && rightAge !== null && leftAge !== rightAge) {
      return leftAge - rightAge;
    }
    if (leftAge === null && rightAge !== null) return 1;
    if (leftAge !== null && rightAge === null) return -1;
    return left.playerId - right.playerId;
  });

  return {
    ordered: entries,
    debug: entries,
    scoring: scoringRanking,
    setpieces: setPiecesRanking,
  };
}

function skillPotential(player: OptimizerPlayer, skill: SkillKey) {
  const { current, max } = skillValues(player, skill);
  if (current === null || max === null) return 0;
  if (current >= max) return 0;
  if (current < 5 || max < 6) return 0;
  return max;
}

function sortKnownCurrentRevealCandidates(
  players: OptimizerPlayer[],
  skill: SkillKey
) {
  return players
    .map((player, index) => {
      const { current, max } = skillValues(player, skill);
      const isMaxed = isSkillMaxed(player, skill);
      const bucket =
        max === null || current !== max ? 0 : isMaxed ? 2 : 1;
      return {
        player,
        index,
        current,
        bucket,
      };
    })
    .sort((left, right) => {
      if (left.bucket !== right.bucket) return left.bucket - right.bucket;
      if (left.bucket <= 1 && left.current !== right.current) {
        return (
          (right.current ?? Number.NEGATIVE_INFINITY) -
          (left.current ?? Number.NEGATIVE_INFINITY)
        );
      }
      return left.index - right.index;
    })
    .map((entry) => entry.player);
}

function sortKnownMaxRevealCandidates(
  players: OptimizerPlayer[],
  skill: SkillKey
) {
  return players
    .map((player, index) => {
      const { current, max } = skillValues(player, skill);
      const isMaxed = isSkillMaxed(player, skill);
      const bucket =
        current === null || current !== max ? 0 : isMaxed ? 2 : 1;
      return {
        player,
        index,
        current,
        max,
        bucket,
      };
    })
    .sort((left, right) => {
      if (left.bucket !== right.bucket) return left.bucket - right.bucket;
      if (left.bucket === 0 && left.current !== right.current) {
        return (
          (right.current ?? Number.NEGATIVE_INFINITY) -
          (left.current ?? Number.NEGATIVE_INFINITY)
        );
      }
      if (left.bucket === 1 && left.max !== right.max) {
        return (
          (right.max ?? Number.NEGATIVE_INFINITY) -
          (left.max ?? Number.NEGATIVE_INFINITY)
        );
      }
      return left.index - right.index;
    })
    .map((entry) => entry.player);
}

function orderedKnownCurrentRevealIds(
  playersById: Map<number, OptimizerPlayer>,
  ranking: RankingEntry[],
  usedPlayers: Set<number>,
  skill: SkillKey
) {
  return sortKnownCurrentRevealCandidates(
    ranking
      .filter((entry) => !usedPlayers.has(entry.playerId) && entry.current !== null)
      .map((entry) => playersById.get(entry.playerId))
      .filter((player): player is OptimizerPlayer => Boolean(player)),
    skill
  ).map((player) => player.id);
}

function orderedKnownMaxRevealIds(
  playersById: Map<number, OptimizerPlayer>,
  ranking: RankingEntry[],
  usedPlayers: Set<number>,
  skill: SkillKey
) {
  return sortKnownMaxRevealCandidates(
    ranking
      .filter((entry) => !usedPlayers.has(entry.playerId) && entry.max !== null)
      .map((entry) => playersById.get(entry.playerId))
      .filter((player): player is OptimizerPlayer => Boolean(player)),
    skill
  ).map((player) => player.id);
}

function orderedBothRevealKnownIds(
  primaryEligibleIds: number[],
  secondaryEligibleIds: number[]
) {
  const primaryIndex = new Map(primaryEligibleIds.map((id, index) => [id, index]));
  const secondaryIndex = new Map(secondaryEligibleIds.map((id, index) => [id, index]));
  return primaryEligibleIds
    .filter((id) => secondaryIndex.has(id))
    .sort((left, right) => {
      const leftPrimary = primaryIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightPrimary = primaryIndex.get(right) ?? Number.MAX_SAFE_INTEGER;
      const leftSecondary = secondaryIndex.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightSecondary = secondaryIndex.get(right) ?? Number.MAX_SAFE_INTEGER;
      const leftScore = leftPrimary + leftSecondary;
      const rightScore = rightPrimary + rightSecondary;
      if (leftScore !== rightScore) return leftScore - rightScore;
      if (leftPrimary !== rightPrimary) return leftPrimary - rightPrimary;
      return leftSecondary - rightSecondary;
    });
}

function fillSlotsWithOrderedIds(
  slots: (typeof ALL_SLOTS)[number][],
  orderedPlayerIds: number[],
  lineup: LineupAssignments,
  usedPlayers: Set<number>
) {
  const freeSlots = [...slots];
  const pendingPlayerIds = orderedPlayerIds.filter((id) => !usedPlayers.has(id));
  while (freeSlots.length && pendingPlayerIds.length) {
    const slotIndex = Math.floor(Math.random() * freeSlots.length);
    const slot = freeSlots.splice(slotIndex, 1)[0];
    const playerId = pendingPlayerIds.shift();
    if (!playerId) break;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, playerId);
  }
  return freeSlots;
}

function fillSlotsFromRanking(
  slots: (typeof ALL_SLOTS)[number][],
  ranking: RankingEntry[],
  lineup: LineupAssignments,
  usedPlayers: Set<number>
) {
  const freeSlots = [...slots];
  let rankingIndex = 0;
  while (freeSlots.length) {
    while (rankingIndex < ranking.length && usedPlayers.has(ranking[rankingIndex].playerId)) {
      rankingIndex += 1;
    }
    const entry = ranking[rankingIndex];
    if (!entry) break;
    const slotIndex = Math.floor(Math.random() * freeSlots.length);
    const slot = freeSlots.splice(slotIndex, 1)[0];
    assignYouthFieldPlayer(lineup, usedPlayers, slot, entry.playerId);
    rankingIndex += 1;
  }
  return freeSlots;
}

function fillPrimaryRevealSlots(
  primarySkill: SkillKey,
  slots: (typeof ALL_SLOTS)[number][],
  eligiblePlayerIds: number[],
  ranking: RankingEntry[],
  lineup: LineupAssignments,
  usedPlayers: Set<number>
) {
  const groupedPrimarySlots = splitPrimarySlots(primarySkill, slots);
  const primarySlotGroups = groupedPrimarySlots.secondary.length
    ? [groupedPrimarySlots.primary, groupedPrimarySlots.secondary]
    : [groupedPrimarySlots.primary];
  let eligibleQueue = eligiblePlayerIds.filter((id) => !usedPlayers.has(id));
  primarySlotGroups.forEach((group) => {
    let freeSlots = fillSlotsWithOrderedIds(group, eligibleQueue, lineup, usedPlayers);
    eligibleQueue = eligibleQueue.filter((id) => !usedPlayers.has(id));
    freeSlots = fillSlotsFromRanking(freeSlots, ranking, lineup, usedPlayers);
    void freeSlots;
  });
}

function fillSecondaryRevealSlots(
  slots: (typeof ALL_SLOTS)[number][],
  eligiblePlayerIds: number[],
  ranking: RankingEntry[],
  lineup: LineupAssignments,
  usedPlayers: Set<number>
) {
  const freeAfterEligible = fillSlotsWithOrderedIds(slots, eligiblePlayerIds, lineup, usedPlayers);
  fillSlotsFromRanking(freeAfterEligible, ranking, lineup, usedPlayers);
}

function orderLineSlots(
  remaining: (typeof ALL_SLOTS)[number][],
  left: (typeof ALL_SLOTS)[number][],
  center: (typeof ALL_SLOTS)[number][],
  right: (typeof ALL_SLOTS)[number][]
) {
  const remainingSet = new Set(remaining);
  const leftSlots = left.filter((slot) => remainingSet.has(slot));
  const centerSlots = center.filter((slot) => remainingSet.has(slot));
  const rightSlots = right.filter((slot) => remainingSet.has(slot));
  const ordered: (typeof ALL_SLOTS)[number][] = [];

  if (centerSlots.length) {
    ordered.push(centerSlots.shift() as (typeof ALL_SLOTS)[number]);
  }

  let takeLeft = true;
  while (leftSlots.length || rightSlots.length || centerSlots.length) {
    if (takeLeft && leftSlots.length) {
      ordered.push(leftSlots.shift() as (typeof ALL_SLOTS)[number]);
    } else if (!takeLeft && rightSlots.length) {
      ordered.push(rightSlots.shift() as (typeof ALL_SLOTS)[number]);
    } else if (leftSlots.length) {
      ordered.push(leftSlots.shift() as (typeof ALL_SLOTS)[number]);
    } else if (rightSlots.length) {
      ordered.push(rightSlots.shift() as (typeof ALL_SLOTS)[number]);
    } else if (centerSlots.length) {
      ordered.push(centerSlots.shift() as (typeof ALL_SLOTS)[number]);
    }
    takeLeft = !takeLeft;
  }

  return ordered;
}

function buildRemainingSlotOrder(remainingSlots: (typeof ALL_SLOTS)[number][]) {
  const slots = new Set(remainingSlots);
  const defenseSlots = ["WB_L", "CD_L", "CD_C", "CD_R", "WB_R"].filter((slot) =>
    slots.has(slot as (typeof ALL_SLOTS)[number])
  ) as (typeof ALL_SLOTS)[number][];
  const midSlots = ["W_L", "IM_L", "IM_C", "IM_R", "W_R"].filter((slot) =>
    slots.has(slot as (typeof ALL_SLOTS)[number])
  ) as (typeof ALL_SLOTS)[number][];
  const forwardSlots = ["F_L", "F_C", "F_R"].filter((slot) =>
    slots.has(slot as (typeof ALL_SLOTS)[number])
  ) as (typeof ALL_SLOTS)[number][];

  const ordered: (typeof ALL_SLOTS)[number][] = [];
  ordered.push(
    ...orderLineSlots(defenseSlots, ["WB_L", "CD_L"], ["CD_C"], ["CD_R", "WB_R"])
  );
  ordered.push(
    ...orderLineSlots(midSlots, ["W_L", "IM_L"], ["IM_C"], ["IM_R", "W_R"])
  );
  ordered.push(...orderLineSlots(forwardSlots, ["F_L"], ["F_C"], ["F_R"]));

  const leftovers = remainingSlots.filter((slot) => !ordered.includes(slot));
  return [...ordered, ...leftovers];
}

function splitPrimarySlots(
  primarySkill: SkillKey,
  slots: (typeof ALL_SLOTS)[number][]
) {
  if (primarySkill === "playmaking") {
    const imSlots = slots.filter((slot) => IM_SLOTS.has(slot));
    const otherSlots = slots.filter((slot) => !IM_SLOTS.has(slot));
    return { primary: imSlots, secondary: otherSlots };
  }
  if (primarySkill === "defending") {
    const cdSlots = slots.filter((slot) => CD_SLOTS.has(slot));
    const otherSlots = slots.filter((slot) => !CD_SLOTS.has(slot));
    return { primary: cdSlots, secondary: otherSlots };
  }
  return { primary: slots, secondary: [] as (typeof ALL_SLOTS)[number][] };
}

function shuffleSlots<T>(slots: T[]) {
  const shuffled = [...slots];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function orderedCombinedPlayerIds(
  players: OptimizerPlayer[],
  preferences?: Partial<TrainingPreferences>
) {
  return buildScoringSetPiecesRanking(players, preferences).ordered.map(
    (entry) => entry.playerId
  );
}

function pushUniquePlayerId(target: number[], playerId: number | null | undefined) {
  if (typeof playerId !== "number" || playerId <= 0) return;
  if (!target.includes(playerId)) target.push(playerId);
}

function buildCombinedSelectedIds(
  players: OptimizerPlayer[],
  starPlayerId: number,
  preferences?: Partial<TrainingPreferences>,
  requiredPlayerIds: number[] = [],
  priorityPlayerIds: number[] = []
) {
  const selectedIds: number[] = [];
  pushUniquePlayerId(selectedIds, starPlayerId);
  requiredPlayerIds.forEach((playerId) => pushUniquePlayerId(selectedIds, playerId));
  const keeper = findBestFallbackKeeperBySkill(
    players,
    new Set(selectedIds.filter((id) => id !== starPlayerId))
  );
  pushUniquePlayerId(selectedIds, keeper?.id);
  priorityPlayerIds.forEach((playerId) => {
    if (selectedIds.length < MAX_YOUTH_FIELD_PLAYERS) {
      pushUniquePlayerId(selectedIds, playerId);
    }
  });
  orderedCombinedPlayerIds(players, preferences).forEach((playerId) => {
    if (selectedIds.length < MAX_YOUTH_FIELD_PLAYERS) {
      pushUniquePlayerId(selectedIds, playerId);
    }
  });
  return selectedIds.slice(0, MAX_YOUTH_FIELD_PLAYERS);
}

function assignSelectedIdsToLineup(
  selectedIds: number[],
  players: OptimizerPlayer[],
  preferences: Partial<TrainingPreferences> | undefined,
  options: {
    starPlayerId: number;
    primaryTraining: TrainingSkillKey;
    secondaryTraining: TrainingSkillKey;
    primarySkill: SkillKey | null;
    secondarySkill: SkillKey | null;
    preferSecondarySlots?: boolean;
  }
) {
  const trainingInfo = getTrainingSlots(options.primaryTraining, options.secondaryTraining);
  const lineup: LineupAssignments = {};
  const usedPlayers = new Set<number>();
  const playerSet = new Set(selectedIds);
  const selectedPlayers = selectedIds
    .map((id) => players.find((player) => player.id === id) ?? null)
    .filter((player): player is OptimizerPlayer => Boolean(player));
  const combinedRanking = buildScoringSetPiecesRanking(selectedPlayers, preferences);
  const combinedOrder = combinedRanking.ordered.map((entry) => entry.playerId);
  const primaryRanking =
    options.primarySkill !== null
      ? buildSkillRanking(selectedPlayers, options.primarySkill, preferences)
      : null;
  const secondaryRanking =
    options.secondarySkill !== null
      ? buildSkillRanking(selectedPlayers, options.secondarySkill, preferences)
      : null;
  const starPlayer =
    selectedPlayers.find((player) => player.id === options.starPlayerId) ?? null;
  const starSlotPool = options.preferSecondarySlots
    ? trainingInfo.secondaryFullSlots.size
      ? trainingInfo.secondaryFullSlots
      : trainingInfo.secondarySlots
    : trainingInfo.primaryFullSlots.size
      ? trainingInfo.primaryFullSlots
      : trainingInfo.primarySlots;
  const starSlotCandidates = [...starSlotPool].length ? [...starSlotPool] : [...ALL_SLOTS];
  const starSlot = preferStarSlots(
    options.primarySkill ?? "scoring",
    starSlotCandidates
  )[0] ?? "F_C";
  if (starPlayer) {
    assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);
  }
  ensureYouthGoalkeeper(
    lineup,
    selectedPlayers.length ? selectedPlayers : players,
    usedPlayers
  );

  const fillSlotsFromIds = (
    slots: FieldSlotId[],
    orderedIds: number[]
  ) => {
    slots.forEach((slot) => {
      if (!hasLineupCapacity(lineup) || lineup[slot] != null) return;
      const playerId = orderedIds.find(
        (id) => playerSet.has(id) && !usedPlayers.has(id)
      );
      if (!playerId) return;
      assignYouthFieldPlayer(lineup, usedPlayers, slot, playerId);
    });
  };

  if (options.primarySkill && !isScoringSetPiecesTraining(options.primaryTraining)) {
    const primarySlots = [...trainingInfo.primarySlots].filter(
      (slot) => slot !== starSlot && slot !== "KP"
    );
    const grouped = splitPrimarySlots(options.primarySkill, primarySlots);
    const ordered = primaryRanking?.ordered.map((entry) => entry.playerId) ?? [];
    fillSlotsFromIds(grouped.primary, ordered);
    fillSlotsFromIds(grouped.secondary, ordered);
  }

  if (options.secondarySkill && !isScoringSetPiecesTraining(options.secondaryTraining)) {
    const secondarySlots = [...trainingInfo.secondarySlots].filter(
      (slot) => slot !== starSlot && slot !== "KP" && lineup[slot] == null
    );
    const grouped = splitPrimarySlots(options.secondarySkill, secondarySlots);
    const ordered = secondaryRanking?.ordered.map((entry) => entry.playerId) ?? [];
    fillSlotsFromIds(grouped.primary, ordered);
    fillSlotsFromIds(grouped.secondary, ordered);
  }

  const remainingSlots = buildRemainingSlotOrder(
    ALL_SLOTS.filter((slot) => lineup[slot] == null)
  );
  fillSlotsFromIds(remainingSlots, combinedOrder);
  selectedIds.forEach((playerId) => {
    if (!hasLineupCapacity(lineup) || usedPlayers.has(playerId)) return;
    const slot = remainingSlots.find((candidate) => lineup[candidate] == null);
    if (!slot) return;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, playerId);
  });
  ensureYouthGoalkeeper(
    lineup,
    selectedPlayers.length ? selectedPlayers : players,
    usedPlayers
  );

  const primarySlots = trainingInfo.primarySlots;
  const secondarySlots = trainingInfo.secondarySlots;
  const trainingSlots = new Set<FieldSlotId>([...primarySlots, ...secondarySlots]);

  return {
    lineup,
    debug: {
      primary: {
        skill: options.primarySkill ?? "scoring",
        list:
          options.primarySkill && primaryRanking
            ? primaryRanking.debug
            : combinedRanking.debug,
      },
      secondary: options.secondarySkill
        ? {
            skill: options.secondarySkill,
            list: secondaryRanking?.debug ?? [],
          }
        : isScoringSetPiecesTraining(options.secondaryTraining)
          ? { skill: "setpieces" as SkillKey, list: combinedRanking.debug }
          : null,
      trainingSlots: {
        primary: [...primarySlots],
        secondary: [...secondarySlots],
        all: [...trainingSlots],
        starSlot,
      },
      selection: {
        starPlayerId: options.starPlayerId,
        primarySkill: options.primaryTraining,
        secondarySkill: options.secondaryTraining,
        autoSelected: false,
      },
      combinedTraining: {
        primarySkills: isScoringSetPiecesTraining(options.primaryTraining)
          ? [...SCORING_SETPIECES_SKILLS]
          : undefined,
        secondarySkills: isScoringSetPiecesTraining(options.secondaryTraining)
          ? [...SCORING_SETPIECES_SKILLS]
          : undefined,
      },
    } satisfies OptimizerDebug,
  };
}

function optimizeCombinedLineupForStar(
  players: OptimizerPlayer[],
  starPlayerId: number,
  primaryTraining: TrainingSkillKey,
  secondaryTraining: TrainingSkillKey,
  autoSelected: boolean,
  preferences?: Partial<TrainingPreferences>,
  requiredPlayerIds: number[] = []
) {
  const primarySkill = isSingleSkillTrainingKey(primaryTraining)
    ? toBaseTrainingSkill(primaryTraining)
    : null;
  const secondarySkill = isSingleSkillTrainingKey(secondaryTraining)
    ? toBaseTrainingSkill(secondaryTraining)
    : null;
  const priorityPlayerIds =
    primarySkill !== null && isScoringSetPiecesTraining(secondaryTraining)
      ? buildSkillRanking(players, primarySkill, preferences).ordered.map(
          (entry) => entry.playerId
        )
      : [];
  const selectedIds = buildCombinedSelectedIds(
    players,
    starPlayerId,
    preferences,
    requiredPlayerIds,
    priorityPlayerIds
  );
  const built = assignSelectedIdsToLineup(selectedIds, players, preferences, {
    starPlayerId,
    primaryTraining,
    secondaryTraining,
    primarySkill,
    secondarySkill,
    preferSecondarySlots:
      isScoringSetPiecesTraining(primaryTraining) && secondarySkill !== null,
  });
  return {
    lineup: validOptimizerResult(built.lineup),
    debug: {
      ...built.debug,
      selection: {
        ...built.debug.selection,
        autoSelected,
      },
    },
  };
}

export function optimizeLineupForStar(
  players: OptimizerPlayer[],
  starPlayerId: number | null,
  primaryTraining: TrainingSkillKey | null,
  secondaryTraining: TrainingSkillKey | null,
  autoSelected = false,
  preferences?: Partial<TrainingPreferences>
) {
  if (!starPlayerId || !primaryTraining || !secondaryTraining) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
    };
  }
  if (
    isScoringSetPiecesTraining(primaryTraining) ||
    isScoringSetPiecesTraining(secondaryTraining)
  ) {
    const starPlayer = players.find((player) => player.id === starPlayerId);
    if (!starPlayer) {
      return { lineup: {} as LineupAssignments, debug: null as OptimizerDebug | null };
    }
    return optimizeCombinedLineupForStar(
      players,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelected,
      preferences
    );
  }
  const primary = primaryTraining ? toBaseTrainingSkill(primaryTraining) : null;
  const secondary = secondaryTraining ? toBaseTrainingSkill(secondaryTraining) : null;
  let selection = {
    starPlayerId: starPlayerId ?? 0,
    primarySkill: primary ?? "passing",
    secondarySkill: secondary ?? null,
    autoSelected: false,
  };

  const autoCandidates =
    chooseStarAndTraining(players, preferences)?.candidates ?? null;
  if (!primary || !secondary) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
    };
  }

  selection = {
    starPlayerId,
    primarySkill: primary,
    secondarySkill: secondary,
    autoSelected,
  };

  const starPlayer = players.find(
    (player) => player.id === selection.starPlayerId
  );
  if (!starPlayer) {
    return { lineup: {} as LineupAssignments, debug: null as OptimizerDebug | null };
  }

  const primarySkill = selection.primarySkill;
  const secondarySkill = selection.secondarySkill;
  const trainingInfo = getTrainingSlots(primaryTraining, secondaryTraining);
  const primarySlots = trainingInfo.primarySlots;
  const secondarySlots =
    secondarySkill && secondaryTraining !== primaryTraining
      ? trainingInfo.secondarySlots
      : new Set<(typeof ALL_SLOTS)[number]>();
  const trainingSlots = new Set<(typeof ALL_SLOTS)[number]>([
    ...primarySlots,
    ...secondarySlots,
  ]);
  const primaryFullSlots = trainingInfo.primaryFullSlots;
  const fullSecondarySlots = secondarySkill
    ? trainingInfo.secondaryFullSlots
    : null;

  const baseSlots = new Set<(typeof ALL_SLOTS)[number]>(trainingSlots);
  baseSlots.add("KP");

  const overlapSlots = new Set<(typeof ALL_SLOTS)[number]>();
  if (secondarySkill && fullSecondarySlots) {
    primaryFullSlots.forEach((slot) => {
      if (!fullSecondarySlots.has(slot)) return;
      overlapSlots.add(slot);
    });
  }

  let candidateSlots = overlapSlots.size ? overlapSlots : primaryFullSlots;
  if (!candidateSlots.size) {
    candidateSlots = trainingSlots.size ? trainingSlots : baseSlots;
  }
  const preferredStarSlots = preferStarSlots(primarySkill, [...candidateSlots]);

  const starSlot =
    preferredStarSlots[Math.floor(Math.random() * preferredStarSlots.length)];

  const primaryRanking = buildSkillRanking(players, primarySkill, preferences);
  const secondaryRanking = secondarySkill
    ? buildSkillRanking(players, secondarySkill, preferences)
    : null;

  const lineup: LineupAssignments = {};
  const usedPlayers = new Set<number>();
  assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);
  ensureYouthGoalkeeper(lineup, players, usedPlayers);

  const primaryOrder = [...primarySlots].filter((slot) => slot !== starSlot);
  let primaryIndex = 0;
  const groupedPrimarySlots = splitPrimarySlots(primarySkill, primaryOrder);
  const primarySlotGroups = groupedPrimarySlots.secondary.length
    ? [groupedPrimarySlots.primary, groupedPrimarySlots.secondary]
    : [groupedPrimarySlots.primary];

  primarySlotGroups.forEach((slots) => {
    const remainingPrimarySlots = [...slots];
    while (remainingPrimarySlots.length && hasLineupCapacity(lineup)) {
      while (
        primaryIndex < primaryRanking.ordered.length &&
        usedPlayers.has(primaryRanking.ordered[primaryIndex].playerId)
      ) {
        primaryIndex += 1;
      }
      const entry = primaryRanking.ordered[primaryIndex];
      if (!entry) break;
      const slotIndex = Math.floor(Math.random() * remainingPrimarySlots.length);
      const slot = remainingPrimarySlots.splice(slotIndex, 1)[0];
      assignYouthFieldPlayer(lineup, usedPlayers, slot, entry.playerId);
      primaryIndex += 1;
    }
  });

  if (secondarySkill) {
    const secondaryOrder = [...secondarySlots].filter((slot) => !(slot in lineup));
    let secondaryIndex = 0;
    const remainingSecondarySlots = [...secondaryOrder];
    while (remainingSecondarySlots.length && hasLineupCapacity(lineup)) {
      while (
        secondaryIndex < (secondaryRanking?.ordered.length ?? 0) &&
        usedPlayers.has(secondaryRanking?.ordered[secondaryIndex].playerId ?? 0)
      ) {
        secondaryIndex += 1;
      }
      const entry = secondaryRanking?.ordered[secondaryIndex];
      if (!entry) break;
      const slotIndex = Math.floor(Math.random() * remainingSecondarySlots.length);
      const slot = remainingSecondarySlots.splice(slotIndex, 1)[0];
      assignYouthFieldPlayer(lineup, usedPlayers, slot, entry.playerId);
      secondaryIndex += 1;
    }
  }

  ensureYouthGoalkeeper(lineup, players, usedPlayers);

  const remainingPlayers = players.filter((player) => !usedPlayers.has(player.id));
  const carePlayers = remainingPlayers.filter(
    (player) =>
      skillPotential(player, primarySkill) > 0 ||
      (secondarySkill ? skillPotential(player, secondarySkill) > 0 : false)
  );
  const otherPlayers = remainingPlayers.filter(
    (player) => !carePlayers.includes(player)
  );
  const cappedPlayers = otherPlayers.filter(
    (player) =>
      skillPotential(player, primarySkill) === 0 &&
      (secondarySkill ? skillPotential(player, secondarySkill) === 0 : true)
  );
  const nonCappedPlayers = otherPlayers.filter(
    (player) => !cappedPlayers.includes(player)
  );
  const fillPlayers = [...carePlayers, ...cappedPlayers, ...nonCappedPlayers];

  const totalSlotsNeeded = MAX_YOUTH_FIELD_PLAYERS;
  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = shuffleSlots(orderedRemainingSlots).slice(
    0,
    Math.max(0, totalSlotsNeeded - assignedLineupCount(lineup))
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, player.id);
  });

  return {
    lineup: validOptimizerResult(lineup),
    debug: {
      primary: { skill: primarySkill, list: primaryRanking.debug },
      secondary: secondarySkill
        ? { skill: secondarySkill, list: secondaryRanking?.debug ?? [] }
        : null,
      trainingSlots: {
        primary: [...primarySlots],
        secondary: [...secondarySlots],
        all: [...trainingSlots],
        starSlot,
      },
      selection: {
        starPlayerId: selection.starPlayerId,
        primarySkill,
        secondarySkill,
        autoSelected: selection.autoSelected,
      },
      starSelectionRanks: autoCandidates ?? undefined,
    },
  };
}

export function optimizeRevealPrimaryCurrent(
  players: OptimizerPlayer[],
  starPlayerId: number | null,
  primaryTraining: TrainingSkillKey | null,
  secondaryTraining: TrainingSkillKey | null,
  autoSelected = false,
  preferences?: Partial<TrainingPreferences>
) {
  if (!starPlayerId || !primaryTraining || !secondaryTraining) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_inputs" as const,
    };
  }
  const starPlayer = players.find((player) => player.id === starPlayerId);
  if (!starPlayer) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_star" as const,
    };
  }

  if (
    isScoringSetPiecesTraining(primaryTraining) ||
    isScoringSetPiecesTraining(secondaryTraining)
  ) {
    const resolvedPrimaryRevealSkill = resolvePrimaryCurrentRevealSkill(
      starPlayer,
      primaryTraining
    );
    if (!resolvedPrimaryRevealSkill) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "primary_current_known" as const,
      };
    }
    const built = optimizeCombinedLineupForStar(
      players,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelected,
      preferences
    );
    return {
      ...built,
      debug: built.debug
        ? {
            ...built.debug,
            combinedTraining: {
              ...built.debug.combinedTraining,
              resolvedPrimaryRevealSkill,
            },
          }
        : null,
      error: null as null | "missing_inputs" | "missing_star" | "primary_current_known" | "no_primary_slots",
    };
  }

  const primary = toBaseTrainingSkill(primaryTraining);
  const secondary = toBaseTrainingSkill(secondaryTraining);

  const { current: starCurrent } = skillValues(starPlayer, primary);
  if (starCurrent !== null) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "primary_current_known" as const,
    };
  }

  const trainingInfo = getTrainingSlots(primaryTraining, secondaryTraining);
  const primarySlots = trainingInfo.primarySlots;
  const secondarySlots = trainingInfo.secondarySlots;
  const trainingSlots = new Set<(typeof ALL_SLOTS)[number]>([
    ...primarySlots,
    ...secondarySlots,
  ]);
  const primaryFullSlots = trainingInfo.primaryFullSlots;
  const fullSecondarySlots = trainingInfo.secondaryFullSlots;

  const primarySlotList = [...primarySlots];
  if (!primarySlotList.length) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "no_primary_slots" as const,
    };
  }

  const prefersSharedSlot = canStillBenefitFromSecondaryTraining(
    starPlayer,
    secondary ?? primary
  );
  const starSlot = pickStarTrainingSlot(
    primary,
    primarySlots,
    primaryFullSlots,
    secondary ?? primary,
    fullSecondarySlots,
    prefersSharedSlot
  );

  const primaryRanking = buildSkillRanking(players, primary, preferences);
  const secondaryRanking = secondary
    ? buildSkillRanking(players, secondary, preferences)
    : null;

  const lineup: LineupAssignments = {};
  const usedPlayers = new Set<number>();
  assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);
  ensureYouthGoalkeeper(lineup, players, usedPlayers);
  const playersById = new Map(players.map((player) => [player.id, player]));

  const remainingPrimarySlots = primarySlotList.filter((slot) => slot !== starSlot);
  const eligiblePrimary = sortKnownCurrentRevealCandidates(
    primaryRanking.ordered
      .filter(
        (entry) => !usedPlayers.has(entry.playerId) && entry.current !== null
      )
      .map((entry) => playersById.get(entry.playerId))
      .filter((player): player is OptimizerPlayer => Boolean(player)),
    primary
  ).map((player) => player.id);

  const groupedPrimarySlots = splitPrimarySlots(primary, remainingPrimarySlots);
  const primarySlotGroups = groupedPrimarySlots.secondary.length
    ? [groupedPrimarySlots.primary, groupedPrimarySlots.secondary]
    : [groupedPrimarySlots.primary];

  let primaryIndex = 0;
  primarySlotGroups.forEach((slots) => {
    const freePrimarySlots = [...slots];
    while (freePrimarySlots.length && eligiblePrimary.length) {
      const slotIndex = Math.floor(Math.random() * freePrimarySlots.length);
      const slot = freePrimarySlots.splice(slotIndex, 1)[0];
      const playerId = eligiblePrimary.shift();
      if (!playerId) break;
      assignYouthFieldPlayer(lineup, usedPlayers, slot, playerId);
    }

    while (freePrimarySlots.length) {
      while (
        primaryIndex < primaryRanking.ordered.length &&
        usedPlayers.has(primaryRanking.ordered[primaryIndex].playerId)
      ) {
        primaryIndex += 1;
      }
      const entry = primaryRanking.ordered[primaryIndex];
      if (!entry) break;
      const slotIndex = Math.floor(Math.random() * freePrimarySlots.length);
      const slot = freePrimarySlots.splice(slotIndex, 1)[0];
      assignYouthFieldPlayer(lineup, usedPlayers, slot, entry.playerId);
      primaryIndex += 1;
    }
  });

  if (secondary) {
    const secondaryOrder = [...secondarySlots].filter(
      (slot) => !primarySlots.has(slot) && !(slot in lineup)
    );
    let secondaryIndex = 0;
    const remainingSecondarySlots = [...secondaryOrder];
    while (remainingSecondarySlots.length) {
      while (
        secondaryIndex < (secondaryRanking?.ordered.length ?? 0) &&
        usedPlayers.has(secondaryRanking?.ordered[secondaryIndex].playerId ?? 0)
      ) {
        secondaryIndex += 1;
      }
      const entry = secondaryRanking?.ordered[secondaryIndex];
      if (!entry) break;
      const slotIndex = Math.floor(Math.random() * remainingSecondarySlots.length);
      const slot = remainingSecondarySlots.splice(slotIndex, 1)[0];
      assignYouthFieldPlayer(lineup, usedPlayers, slot, entry.playerId);
      secondaryIndex += 1;
    }
  }

  ensureYouthGoalkeeper(lineup, players, usedPlayers);

  const remainingPlayers = players.filter((player) => !usedPlayers.has(player.id));
  const carePlayers = remainingPlayers.filter(
    (player) =>
      skillPotential(player, primary) > 0 ||
      (secondary ? skillPotential(player, secondary) > 0 : false)
  );
  const otherPlayers = remainingPlayers.filter(
    (player) => !carePlayers.includes(player)
  );
  const cappedPlayers = otherPlayers.filter(
    (player) =>
      skillPotential(player, primary) === 0 &&
      (secondary ? skillPotential(player, secondary) === 0 : true)
  );
  const nonCappedPlayers = otherPlayers.filter(
    (player) => !cappedPlayers.includes(player)
  );
  const fillPlayers = [...carePlayers, ...cappedPlayers, ...nonCappedPlayers];

  const totalSlotsNeeded = 11;
  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = shuffleSlots(orderedRemainingSlots).slice(
    0,
    Math.max(0, totalSlotsNeeded - assignedLineupCount(lineup))
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, player.id);
  });

  return {
    lineup: validOptimizerResult(lineup),
    debug: {
      primary: { skill: primary, list: primaryRanking.debug },
      secondary: secondary
        ? { skill: secondary, list: secondaryRanking?.debug ?? [] }
        : null,
      trainingSlots: {
        primary: [...primarySlots],
        secondary: [...secondarySlots],
        all: [...trainingSlots],
        starSlot,
      },
      selection: {
        starPlayerId,
        primarySkill: primary,
        secondarySkill: secondary,
        autoSelected,
      },
    },
    error: null as null | "missing_inputs" | "missing_star" | "primary_current_known" | "no_primary_slots",
  };
}

export function optimizeRevealSecondaryMax(
  players: OptimizerPlayer[],
  starPlayerId: number | null,
  primaryTraining: TrainingSkillKey | null,
  secondaryTraining: TrainingSkillKey | null,
  autoSelected = false,
  preferences?: Partial<TrainingPreferences>
) {
  if (!starPlayerId || !primaryTraining || !secondaryTraining) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_inputs" as const,
    };
  }
  const starPlayer = players.find((player) => player.id === starPlayerId);
  if (!starPlayer) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_star" as const,
    };
  }

  if (
    isScoringSetPiecesTraining(primaryTraining) ||
    isScoringSetPiecesTraining(secondaryTraining)
  ) {
    const resolvedSecondaryRevealSkill = resolveSecondaryMaxRevealSkill(
      starPlayer,
      secondaryTraining
    );
    if (!resolvedSecondaryRevealSkill) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "secondary_max_known" as const,
      };
    }
    const built = optimizeCombinedLineupForStar(
      players,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelected,
      preferences
    );
    return {
      ...built,
      debug: built.debug
        ? {
            ...built.debug,
            combinedTraining: {
              ...built.debug.combinedTraining,
              resolvedSecondaryRevealSkill,
            },
          }
        : null,
      error: null as null | "missing_inputs" | "missing_star" | "secondary_max_known" | "no_secondary_slots",
    };
  }

  const primary = toBaseTrainingSkill(primaryTraining);
  const secondary = toBaseTrainingSkill(secondaryTraining);

  const { max: starSecondaryMax } = skillValues(starPlayer, secondary);
  if (starSecondaryMax !== null) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "secondary_max_known" as const,
    };
  }

  const trainingInfo = getTrainingSlots(primaryTraining, secondaryTraining);
  const primarySlots = trainingInfo.primarySlots;
  const secondarySlots = trainingInfo.secondarySlots;
  const trainingSlots = new Set<(typeof ALL_SLOTS)[number]>([
    ...primarySlots,
    ...secondarySlots,
  ]);
  const fullSecondarySlots = trainingInfo.secondaryFullSlots;
  const fullPrimarySlots = trainingInfo.primaryFullSlots;

  const secondarySlotList = [...secondarySlots];
  const secondaryFullSlotList = [...fullSecondarySlots];
  if (!secondarySlotList.length) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "no_secondary_slots" as const,
    };
  }

  const { current: starPrimaryCurrent, max: starPrimaryMax } = skillValues(
    starPlayer,
    primary
  );
  const sharedSlots = [...fullSecondarySlots].filter((slot) =>
    fullPrimarySlots.has(slot)
  );
  const prefersSharedSlot =
    sharedSlots.length > 0 &&
    !(
      starPrimaryCurrent !== null &&
      starPrimaryMax !== null &&
      starPrimaryCurrent >= starPrimaryMax
    );
  const starSlotCandidates = prefersSharedSlot
    ? sharedSlots
    : secondaryFullSlotList.length
    ? secondaryFullSlotList
    : secondarySlotList;
  const preferredStarSlots = preferStarSlots(primary, starSlotCandidates);
  const starSlot =
    preferredStarSlots[Math.floor(Math.random() * preferredStarSlots.length)];

  const primaryRanking = buildSkillRanking(players, primary, preferences);
  const secondaryRanking = buildSkillRanking(players, secondary, preferences);

  const lineup: LineupAssignments = {};
  const usedPlayers = new Set<number>();
  assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);
  const playersById = new Map(players.map((player) => [player.id, player]));

  const remainingSecondarySlots = secondarySlotList.filter((slot) => slot !== starSlot);
  const freeSecondarySlots = [...remainingSecondarySlots];
  const eligibleSecondary = sortKnownMaxRevealCandidates(
    secondaryRanking.ordered
      .filter((entry) => !usedPlayers.has(entry.playerId) && entry.max !== null)
      .map((entry) => playersById.get(entry.playerId))
      .filter((player): player is OptimizerPlayer => Boolean(player)),
    secondary
  ).map((player) => player.id);

  while (freeSecondarySlots.length && eligibleSecondary.length) {
    const slotIndex = Math.floor(Math.random() * freeSecondarySlots.length);
    const slot = freeSecondarySlots.splice(slotIndex, 1)[0];
    const playerId = eligibleSecondary.shift();
    if (!playerId) break;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, playerId);
  }

  let secondaryIndex = 0;
  while (freeSecondarySlots.length) {
    while (
      secondaryIndex < secondaryRanking.ordered.length &&
      usedPlayers.has(secondaryRanking.ordered[secondaryIndex].playerId)
    ) {
      secondaryIndex += 1;
    }
    const entry = secondaryRanking.ordered[secondaryIndex];
    if (!entry) break;
    const slotIndex = Math.floor(Math.random() * freeSecondarySlots.length);
    const slot = freeSecondarySlots.splice(slotIndex, 1)[0];
    assignYouthFieldPlayer(lineup, usedPlayers, slot, entry.playerId);
    secondaryIndex += 1;
  }

  const primaryOrder = [...primarySlots].filter(
    (slot) => !secondarySlots.has(slot) && !(slot in lineup)
  );
  let primaryIndex = 0;
  const groupedPrimarySlots = splitPrimarySlots(primary, primaryOrder);
  const primarySlotGroups = groupedPrimarySlots.secondary.length
    ? [groupedPrimarySlots.primary, groupedPrimarySlots.secondary]
    : [groupedPrimarySlots.primary];

  primarySlotGroups.forEach((slots) => {
    const remainingPrimarySlots = [...slots];
    while (remainingPrimarySlots.length) {
      while (
        primaryIndex < primaryRanking.ordered.length &&
        usedPlayers.has(primaryRanking.ordered[primaryIndex].playerId)
      ) {
        primaryIndex += 1;
      }
      const entry = primaryRanking.ordered[primaryIndex];
      if (!entry) break;
      const slotIndex = Math.floor(Math.random() * remainingPrimarySlots.length);
      const slot = remainingPrimarySlots.splice(slotIndex, 1)[0];
      assignYouthFieldPlayer(lineup, usedPlayers, slot, entry.playerId);
      primaryIndex += 1;
    }
  });

  ensureYouthGoalkeeper(lineup, players, usedPlayers);

  const remainingPlayers = players.filter((player) => !usedPlayers.has(player.id));
  const carePlayers = remainingPlayers.filter(
    (player) =>
      skillPotential(player, primary) > 0 || skillPotential(player, secondary) > 0
  );
  const otherPlayers = remainingPlayers.filter(
    (player) => !carePlayers.includes(player)
  );
  const cappedPlayers = otherPlayers.filter(
    (player) =>
      skillPotential(player, primary) === 0 &&
      skillPotential(player, secondary) === 0
  );
  const nonCappedPlayers = otherPlayers.filter(
    (player) => !cappedPlayers.includes(player)
  );
  const fillPlayers = [...carePlayers, ...cappedPlayers, ...nonCappedPlayers];

  const totalSlotsNeeded = 11;
  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = shuffleSlots(orderedRemainingSlots).slice(
    0,
    Math.max(0, totalSlotsNeeded - assignedLineupCount(lineup))
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, player.id);
  });

  return {
    lineup: validOptimizerResult(lineup),
    debug: {
      primary: { skill: primary, list: primaryRanking.debug },
      secondary: { skill: secondary, list: secondaryRanking.debug },
      trainingSlots: {
        primary: [...primarySlots],
        secondary: [...secondarySlots],
        all: [...trainingSlots],
        starSlot,
      },
      selection: {
        starPlayerId,
        primarySkill: primary,
        secondarySkill: secondary,
        autoSelected,
      },
    },
    error: null as null | "missing_inputs" | "missing_star" | "secondary_max_known" | "no_secondary_slots",
  };
}

export function optimizeRevealPrimaryCurrentAndSecondaryMax(
  players: OptimizerPlayer[],
  starPlayerId: number | null,
  secondaryTargetPlayerId: number | null,
  primaryTraining: TrainingSkillKey | null,
  secondaryTraining: TrainingSkillKey | null,
  autoSelected = false,
  preferences?: Partial<TrainingPreferences>
) {
  if (!starPlayerId || !secondaryTargetPlayerId || !primaryTraining || !secondaryTraining) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_inputs" as const,
    };
  }
  const starPlayer = players.find((player) => player.id === starPlayerId);
  const secondaryTargetPlayer = players.find(
    (player) => player.id === secondaryTargetPlayerId
  );
  if (!starPlayer || !secondaryTargetPlayer) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_star" as const,
    };
  }

  if (
    isScoringSetPiecesTraining(primaryTraining) ||
    isScoringSetPiecesTraining(secondaryTraining)
  ) {
    const resolvedPrimaryRevealSkill = resolvePrimaryCurrentRevealSkill(
      starPlayer,
      primaryTraining
    );
    if (!resolvedPrimaryRevealSkill) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "primary_current_known" as const,
      };
    }
    const resolvedSecondaryRevealSkill = resolveSecondaryMaxRevealSkill(
      secondaryTargetPlayer,
      secondaryTraining
    );
    if (!resolvedSecondaryRevealSkill) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "secondary_max_known" as const,
      };
    }
    const built = optimizeCombinedLineupForStar(
      players,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelected,
      preferences,
      [secondaryTargetPlayerId]
    );
    return {
      ...built,
      debug: built.debug
        ? {
            ...built.debug,
            combinedTraining: {
              ...built.debug.combinedTraining,
              resolvedPrimaryRevealSkill,
              resolvedSecondaryRevealSkill,
            },
          }
        : null,
      error: null as
        | null
        | "missing_inputs"
        | "missing_star"
        | "primary_current_known"
        | "secondary_max_known"
        | "no_primary_slots"
        | "no_secondary_slots",
    };
  }

  const primary = toBaseTrainingSkill(primaryTraining);
  const secondary = toBaseTrainingSkill(secondaryTraining);

  const { current: starPrimaryCurrent } = skillValues(starPlayer, primary);
  if (starPrimaryCurrent !== null) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "primary_current_known" as const,
    };
  }

  const { max: targetSecondaryMax } = skillValues(secondaryTargetPlayer, secondary);
  if (targetSecondaryMax !== null) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "secondary_max_known" as const,
    };
  }

  const trainingInfo = getTrainingSlots(primaryTraining, secondaryTraining);
  const primarySlots = trainingInfo.primarySlots;
  const secondarySlots = trainingInfo.secondarySlots;
  const trainingSlots = new Set<(typeof ALL_SLOTS)[number]>([
    ...primarySlots,
    ...secondarySlots,
  ]);
  const fullPrimarySlots = trainingInfo.primaryFullSlots;
  const fullSecondarySlots = trainingInfo.secondaryFullSlots;
  const primarySlotList = [...primarySlots];
  const secondarySlotList = [...secondarySlots];
  const overlapSlots = primarySlotList.filter((slot) => secondarySlots.has(slot));
  const overlapSlotSet = new Set<(typeof ALL_SLOTS)[number]>(overlapSlots);
  const overlapPrimaryFullSlots = new Set<(typeof ALL_SLOTS)[number]>(
    [...fullPrimarySlots].filter((slot) => overlapSlotSet.has(slot))
  );
  const overlapSecondaryFullSlots = new Set<(typeof ALL_SLOTS)[number]>(
    [...fullSecondarySlots].filter((slot) => overlapSlotSet.has(slot))
  );
  const strictPrimarySlots = primarySlotList.filter((slot) => !secondarySlots.has(slot));
  const strictSecondarySlots = secondarySlotList.filter((slot) => !primarySlots.has(slot));

  if (!primarySlotList.length) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "no_primary_slots" as const,
    };
  }
  if (!secondarySlotList.length) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "no_secondary_slots" as const,
    };
  }

  const samePlayerReveal = starPlayer.id === secondaryTargetPlayer.id;
  const primaryRanking = buildSkillRanking(players, primary, preferences);
  const secondaryRanking = buildSkillRanking(players, secondary, preferences);
  const lineup: LineupAssignments = {};
  const usedPlayers = new Set<number>();
  let starSlot: (typeof ALL_SLOTS)[number] | null = null;
  let secondaryTargetSlot: (typeof ALL_SLOTS)[number] | null = null;

  if (overlapSlots.length === 0) {
    if (samePlayerReveal) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "no_secondary_slots" as const,
      };
    }
    const prefersSharedStarSlot = canStillBenefitFromSecondaryTraining(
      starPlayer,
      secondary
    );
    starSlot = pickStarTrainingSlot(
      primary,
      primarySlots,
      fullPrimarySlots,
      secondary,
      fullSecondarySlots,
      prefersSharedStarSlot
    );
    assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);

    const { current: targetPrimaryCurrent, max: targetPrimaryMax } = skillValues(
      secondaryTargetPlayer,
      primary
    );
    const sharedSlots: (typeof ALL_SLOTS)[number][] = [];
    const prefersSharedSecondaryTargetSlot =
      sharedSlots.length > 0 &&
      !(
        targetPrimaryCurrent !== null &&
        targetPrimaryMax !== null &&
        targetPrimaryCurrent >= targetPrimaryMax
      );
    const secondaryTargetSlotCandidates = prefersSharedSecondaryTargetSlot
      ? sharedSlots
      : [...fullSecondarySlots].length
        ? [...fullSecondarySlots]
        : secondarySlotList;
    const secondaryPreferredSlots = preferStarSlots(primary, secondaryTargetSlotCandidates);
    secondaryTargetSlot =
      secondaryPreferredSlots[
        Math.floor(Math.random() * secondaryPreferredSlots.length)
      ] ?? null;
    if (!secondaryTargetSlot) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "no_secondary_slots" as const,
      };
    }
    assignYouthFieldPlayer(lineup, usedPlayers, secondaryTargetSlot, secondaryTargetPlayer.id);
  } else if (samePlayerReveal) {
    starSlot = pickStarTrainingSlot(
      primary,
      overlapSlotSet,
      overlapPrimaryFullSlots,
      secondary,
      overlapSecondaryFullSlots,
      true
    );
    assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);
  } else {
    if (overlapSlots.length < 2) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "no_secondary_slots" as const,
      };
    }
    const allowedOverlapStarSlots = new Set<(typeof ALL_SLOTS)[number]>(
      overlapSlots.filter((slot) => overlapSlots.some((candidate) => candidate !== slot))
    );
    starSlot = pickStarTrainingSlot(
      primary,
      overlapSlotSet,
      overlapPrimaryFullSlots,
      secondary,
      overlapSecondaryFullSlots,
      true,
      allowedOverlapStarSlots
    );
    assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);

    const targetFullSlots = [...overlapSecondaryFullSlots].filter((slot) => slot !== starSlot);
    const targetSlots = overlapSlots.filter((slot) => slot !== starSlot);
    const targetSlotCandidates = targetFullSlots.length ? targetFullSlots : targetSlots;
    if (!targetSlotCandidates.length) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "no_secondary_slots" as const,
      };
    }
    const secondaryPreferredSlots = preferStarSlots(secondary, targetSlotCandidates);
    secondaryTargetSlot =
      secondaryPreferredSlots[
        Math.floor(Math.random() * secondaryPreferredSlots.length)
      ] ?? null;
    if (!secondaryTargetSlot) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "no_secondary_slots" as const,
      };
    }
    assignYouthFieldPlayer(lineup, usedPlayers, secondaryTargetSlot, secondaryTargetPlayer.id);
  }

  ensureYouthGoalkeeper(lineup, players, usedPlayers);
  const playersById = new Map(players.map((player) => [player.id, player]));
  const eligiblePrimary = orderedKnownCurrentRevealIds(
    playersById,
    primaryRanking.ordered,
    usedPlayers,
    primary
  );
  const eligibleSecondary = orderedKnownMaxRevealIds(
    playersById,
    secondaryRanking.ordered,
    usedPlayers,
    secondary
  );

  if (overlapSlots.length === 0) {
    fillPrimaryRevealSlots(
      primary,
      primarySlotList.filter((slot) => !(slot in lineup)),
      eligiblePrimary,
      primaryRanking.ordered,
      lineup,
      usedPlayers
    );
    fillSecondaryRevealSlots(
      secondarySlotList.filter((slot) => !(slot in lineup)),
      eligibleSecondary,
      secondaryRanking.ordered,
      lineup,
      usedPlayers
    );
  } else {
    const overlapKnownBoth = orderedBothRevealKnownIds(
      eligiblePrimary,
      eligibleSecondary
    );
    fillSlotsWithOrderedIds(
      overlapSlots.filter((slot) => !(slot in lineup)),
      overlapKnownBoth,
      lineup,
      usedPlayers
    );
    fillPrimaryRevealSlots(
      primary,
      strictPrimarySlots.filter((slot) => !(slot in lineup)),
      eligiblePrimary,
      primaryRanking.ordered,
      lineup,
      usedPlayers
    );
    fillSecondaryRevealSlots(
      strictSecondarySlots.filter((slot) => !(slot in lineup)),
      eligibleSecondary,
      secondaryRanking.ordered,
      lineup,
      usedPlayers
    );
  }

  ensureYouthGoalkeeper(lineup, players, usedPlayers);

  const remainingPlayers = players.filter((player) => !usedPlayers.has(player.id));
  const carePlayers = remainingPlayers.filter(
    (player) =>
      skillPotential(player, primary) > 0 || skillPotential(player, secondary) > 0
  );
  const otherPlayers = remainingPlayers.filter(
    (player) => !carePlayers.includes(player)
  );
  const cappedPlayers = otherPlayers.filter(
    (player) =>
      skillPotential(player, primary) === 0 &&
      skillPotential(player, secondary) === 0
  );
  const nonCappedPlayers = otherPlayers.filter(
    (player) => !cappedPlayers.includes(player)
  );
  const fillPlayers = [...carePlayers, ...cappedPlayers, ...nonCappedPlayers];

  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = shuffleSlots(orderedRemainingSlots).slice(
    0,
    Math.max(0, 11 - assignedLineupCount(lineup))
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, player.id);
  });

  return {
    lineup: validOptimizerResult(lineup),
    debug: {
      primary: { skill: primary, list: primaryRanking.debug },
      secondary: { skill: secondary, list: secondaryRanking.debug },
      trainingSlots: {
        primary: [...primarySlots],
        secondary: [...secondarySlots],
        all: [...trainingSlots],
        starSlot,
      },
      selection: {
        starPlayerId,
        primarySkill: primary,
        secondarySkill: secondary,
        autoSelected,
      },
    },
    error: null as
      | null
      | "missing_inputs"
      | "missing_star"
      | "primary_current_known"
      | "secondary_max_known"
      | "no_primary_slots"
      | "no_secondary_slots",
  };
}

export function optimizeByRatings(
  players: OptimizerPlayer[],
  ratingsByPlayer: RatingsByPlayer | null,
  starPlayerId: number | null,
  primaryTraining: TrainingSkillKey | null,
  secondaryTraining: TrainingSkillKey | null,
  autoSelected = false,
  preferences?: Partial<TrainingPreferences>
) {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  if (!starPlayerId || !primaryTraining || !secondaryTraining) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_inputs" as const,
    };
  }

  const starPlayer = players.find((player) => player.id === starPlayerId);
  if (!starPlayer) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_star" as const,
    };
  }

  if (
    isScoringSetPiecesTraining(primaryTraining) ||
    isScoringSetPiecesTraining(secondaryTraining)
  ) {
    if (
      isTrainingRegimenBlocked(starPlayer, primaryTraining, preferences) &&
      isTrainingRegimenBlocked(starPlayer, secondaryTraining, preferences)
    ) {
      return {
        lineup: {} as LineupAssignments,
        debug: null as OptimizerDebug | null,
        error: "star_maxed" as const,
      };
    }
    return {
      ...optimizeCombinedLineupForStar(
        players,
        starPlayerId,
        primaryTraining,
        secondaryTraining,
        autoSelected,
        preferences
      ),
      error: null as null | "missing_inputs" | "missing_star" | "star_maxed" | "no_primary_slots",
    };
  }

  const primary = toBaseTrainingSkill(primaryTraining);
  const secondary = toBaseTrainingSkill(secondaryTraining);

  const primaryMaxed = isMaxReached(starPlayer, primary);
  const secondaryMaxed = isMaxReached(starPlayer, secondary);
  if (primaryMaxed && secondaryMaxed) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "star_maxed" as const,
    };
  }

  const trainingInfo = trainingSlotSet(primary, secondary);
  const primarySlots = trainingInfo.primarySlots;
  const secondarySlots = trainingInfo.secondarySlots;
  const trainingSlots = new Set<(typeof ALL_SLOTS)[number]>([
    ...primarySlots,
    ...secondarySlots,
  ]);
  const fullSecondarySlots = slotsForSkillByIntensity(secondary, 1);
  const fullPrimarySlots = slotsForSkillByIntensity(primary, 1);

  const primarySlotList = [...primarySlots];
  if (!primarySlotList.length) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "no_primary_slots" as const,
    };
  }

  const prefersSharedSlot = !secondaryMaxed;
  const starSlot = pickStarTrainingSlot(
    primary,
    primarySlots,
    fullPrimarySlots,
    secondary,
    fullSecondarySlots,
    prefersSharedSlot
  );

  const primaryRanking = buildSkillRanking(players, primary, preferences);
  const secondaryRanking = buildSkillRanking(players, secondary, preferences);

  const lineup: LineupAssignments = {};
  const usedPlayers = new Set<number>();
  assignYouthFieldPlayer(lineup, usedPlayers, starSlot, starPlayer.id);
  ensureYouthGoalkeeper(lineup, players, usedPlayers);

  const fillSlotsWithSlotRatings = (
    slots: (typeof ALL_SLOTS)[number][],
    filterSkill: SkillKey | null
  ) => {
    const availableSlots = shuffleSlots(slots.filter((slot) => !(slot in lineup)));
    availableSlots.forEach((slot) => {
      const skills = slotTrainingSkills(slot, primary, secondary);
      const candidates = players.filter((player) => {
        if (usedPlayers.has(player.id)) return false;
        if (filterSkill && isMaxReached(player, filterSkill)) return false;
        return true;
      });
      candidates.sort((a, b) => {
        const aTier = trainingPriorityTier(
          a,
          filterSkill ? [filterSkill] : skills,
          allowTrainingUntilMaxedOut
        );
        const bTier = trainingPriorityTier(
          b,
          filterSkill ? [filterSkill] : skills,
          allowTrainingUntilMaxedOut
        );
        if (aTier !== bTier) return aTier - bTier;
        const aRating = ratingForSlot(ratingsByPlayer, a.id, slot);
        const bRating = ratingForSlot(ratingsByPlayer, b.id, slot);
        if (aRating === null && bRating === null) return 0;
        if (aRating === null) return 1;
        if (bRating === null) return -1;
        return bRating - aRating;
      });
      const candidate = candidates[0];
      if (!candidate) return;
      assignYouthFieldPlayer(lineup, usedPlayers, slot, candidate.id);
    });
  };

  const primarySlotsToFill = primarySlotList.filter((slot) => slot !== starSlot);
  const groupedPrimarySlots = splitPrimarySlots(primary, primarySlotsToFill);
  fillSlotsWithSlotRatings(groupedPrimarySlots.primary, primary);
  if (groupedPrimarySlots.secondary.length) {
    fillSlotsWithSlotRatings(groupedPrimarySlots.secondary, primary);
  }

  const secondarySlotsToFill = [...secondarySlots].filter(
    (slot) => !(slot in lineup)
  );
  if (secondarySlotsToFill.length) {
    const groupedSecondarySlots = splitPrimarySlots(secondary, secondarySlotsToFill);
    fillSlotsWithSlotRatings(groupedSecondarySlots.primary, secondary);
    if (groupedSecondarySlots.secondary.length) {
      fillSlotsWithSlotRatings(groupedSecondarySlots.secondary, secondary);
    }
  }

  ensureYouthGoalkeeper(lineup, players, usedPlayers);

  const totalSlotsNeeded = 11;
  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = shuffleSlots(orderedRemainingSlots).slice(
    0,
    Math.max(0, totalSlotsNeeded - assignedLineupCount(lineup))
  );

  slotsToFill.forEach((slot) => {
    const candidates = players.filter((player) => !usedPlayers.has(player.id));
    candidates.sort((a, b) => {
      const skills = slotTrainingSkills(slot, primary, secondary);
      const aTier = trainingPriorityTier(
        a,
        skills,
        allowTrainingUntilMaxedOut
      );
      const bTier = trainingPriorityTier(
        b,
        skills,
        allowTrainingUntilMaxedOut
      );
      if (aTier !== bTier) return aTier - bTier;
      const aRating = ratingForSlot(ratingsByPlayer, a.id, slot);
      const bRating = ratingForSlot(ratingsByPlayer, b.id, slot);
      if (aRating === null && bRating === null) return 0;
      if (aRating === null) return 1;
      if (bRating === null) return -1;
      return bRating - aRating;
    });
    const candidate = candidates[0];
    if (!candidate) return;
    assignYouthFieldPlayer(lineup, usedPlayers, slot, candidate.id);
  });

  return {
    lineup: validOptimizerResult(lineup),
    debug: {
      primary: { skill: primary, list: primaryRanking.debug },
      secondary: { skill: secondary, list: secondaryRanking.debug },
      trainingSlots: {
        primary: [...primarySlots],
        secondary: [...secondarySlots],
        all: [...trainingSlots],
        starSlot,
      },
      selection: {
        starPlayerId,
        primarySkill: primary,
        secondarySkill: secondary,
        autoSelected,
      },
    },
    error: null as null | "missing_inputs" | "missing_star" | "star_maxed" | "no_primary_slots",
  };
}
