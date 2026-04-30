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
  | "passing_defenders_midfielders";

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
    primarySkill: SkillKey;
    secondarySkill: SkillKey | null;
    autoSelected: boolean;
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

const MAX_LINEUP_PLAYERS = 11;
const AUTO_STAR_MAX_AGE_DAYS = 17 * 112;

function assignedLineupCount(lineup: LineupAssignments) {
  return Object.values(lineup).filter((playerId) => playerId !== null).length;
}

function hasLineupCapacity(lineup: LineupAssignments) {
  return assignedLineupCount(lineup) < MAX_LINEUP_PLAYERS;
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
};

const TRAINING_BASE_SKILL_MAP: Record<TrainingSkillKey, SkillKey> = {
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

function toBaseTrainingSkill(value: TrainingSkillKey): SkillKey {
  return TRAINING_BASE_SKILL_MAP[value];
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
  primary: SkillKey | null,
  secondary: SkillKey | null,
  preferences?: Partial<TrainingPreferences>,
  excludedPlayerIds?: Iterable<number>
) {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  const excluded = excludedPlayerIds ? new Set<number>(excludedPlayerIds) : null;
  const isFieldSlot = (ALL_SLOTS as readonly string[]).includes(slotId);
  const candidates = players.filter((player) => !excluded?.has(player.id));
  candidates.sort((left, right) => {
    const skills = isFieldSlot
      ? slotTrainingSkills(slotId as FieldSlotId, primary ?? "keeper", secondary)
      : benchTrainingSkills(slotId as BenchSlotId, primary, secondary);
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
    lineup[slot] = playerId;
    usedPlayers.add(playerId);
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
    lineup[slot] = entry.playerId;
    usedPlayers.add(entry.playerId);
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

export function optimizeLineupForStar(
  players: OptimizerPlayer[],
  starPlayerId: number | null,
  primaryTraining: TrainingSkillKey | null,
  secondaryTraining: TrainingSkillKey | null,
  autoSelected = false,
  preferences?: Partial<TrainingPreferences>
) {
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
  if (!starPlayerId || !primaryTraining || !secondaryTraining || !primary || !secondary) {
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

  const lineup: LineupAssignments = {
    [starSlot]: starPlayer.id,
  };
  const usedPlayers = new Set<number>([starPlayer.id]);

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
      lineup[slot] = entry.playerId;
      usedPlayers.add(entry.playerId);
      primaryIndex += 1;
    }
  });

  if (!lineup.KP && hasLineupCapacity(lineup)) {
    const nextKeeper =
      primaryRanking.ordered.find((entry) => !usedPlayers.has(entry.playerId)) ??
      secondaryRanking?.ordered.find((entry) => !usedPlayers.has(entry.playerId));
    if (nextKeeper) {
      lineup.KP = nextKeeper.playerId;
      usedPlayers.add(nextKeeper.playerId);
    }
  }

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
      lineup[slot] = entry.playerId;
      usedPlayers.add(entry.playerId);
      secondaryIndex += 1;
    }
  }

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

  const totalSlotsNeeded = MAX_LINEUP_PLAYERS;
  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = shuffleSlots(orderedRemainingSlots).slice(
    0,
    Math.max(0, totalSlotsNeeded - assignedLineupCount(lineup))
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    lineup[slot] = player.id;
    usedPlayers.add(player.id);
  });

  return {
    lineup,
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
  const primary = toBaseTrainingSkill(primaryTraining);
  const secondary = toBaseTrainingSkill(secondaryTraining);

  const starPlayer = players.find((player) => player.id === starPlayerId);
  if (!starPlayer) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_star" as const,
    };
  }

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

  const lineup: LineupAssignments = {
    [starSlot]: starPlayer.id,
  };
  const usedPlayers = new Set<number>([starPlayer.id]);
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
      lineup[slot] = playerId;
      usedPlayers.add(playerId);
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
      lineup[slot] = entry.playerId;
      usedPlayers.add(entry.playerId);
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
      lineup[slot] = entry.playerId;
      usedPlayers.add(entry.playerId);
      secondaryIndex += 1;
    }
  }

  if (!lineup.KP) {
    const nextKeeper =
      primaryRanking.ordered.find((entry) => !usedPlayers.has(entry.playerId)) ??
      secondaryRanking?.ordered.find((entry) => !usedPlayers.has(entry.playerId));
    if (nextKeeper) {
      lineup.KP = nextKeeper.playerId;
      usedPlayers.add(nextKeeper.playerId);
    }
  }

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
    Math.max(0, totalSlotsNeeded - Object.keys(lineup).length)
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    lineup[slot] = player.id;
    usedPlayers.add(player.id);
  });

  return {
    lineup,
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
  const primary = toBaseTrainingSkill(primaryTraining);
  const secondary = toBaseTrainingSkill(secondaryTraining);

  const starPlayer = players.find((player) => player.id === starPlayerId);
  if (!starPlayer) {
    return {
      lineup: {} as LineupAssignments,
      debug: null as OptimizerDebug | null,
      error: "missing_star" as const,
    };
  }

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

  const lineup: LineupAssignments = {
    [starSlot]: starPlayer.id,
  };
  const usedPlayers = new Set<number>([starPlayer.id]);
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
    lineup[slot] = playerId;
    usedPlayers.add(playerId);
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
    lineup[slot] = entry.playerId;
    usedPlayers.add(entry.playerId);
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
      lineup[slot] = entry.playerId;
      usedPlayers.add(entry.playerId);
      primaryIndex += 1;
    }
  });

  if (!lineup.KP) {
    const nextKeeper =
      primaryRanking.ordered.find((entry) => !usedPlayers.has(entry.playerId)) ??
      secondaryRanking.ordered.find((entry) => !usedPlayers.has(entry.playerId));
    if (nextKeeper) {
      lineup.KP = nextKeeper.playerId;
      usedPlayers.add(nextKeeper.playerId);
    }
  }

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
    Math.max(0, totalSlotsNeeded - Object.keys(lineup).length)
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    lineup[slot] = player.id;
    usedPlayers.add(player.id);
  });

  return {
    lineup,
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
  const primary = toBaseTrainingSkill(primaryTraining);
  const secondary = toBaseTrainingSkill(secondaryTraining);

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
    lineup[starSlot] = starPlayer.id;

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
    lineup[secondaryTargetSlot] = secondaryTargetPlayer.id;
  } else if (samePlayerReveal) {
    starSlot = pickStarTrainingSlot(
      primary,
      overlapSlotSet,
      overlapPrimaryFullSlots,
      secondary,
      overlapSecondaryFullSlots,
      true
    );
    lineup[starSlot] = starPlayer.id;
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
    lineup[starSlot] = starPlayer.id;

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
    lineup[secondaryTargetSlot] = secondaryTargetPlayer.id;
  }

  const usedPlayers = new Set<number>([starPlayer.id]);
  if (secondaryTargetPlayer.id !== starPlayer.id) {
    usedPlayers.add(secondaryTargetPlayer.id);
  }
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

  if (!lineup.KP) {
    const nextKeeper =
      primaryRanking.ordered.find((entry) => !usedPlayers.has(entry.playerId)) ??
      secondaryRanking.ordered.find((entry) => !usedPlayers.has(entry.playerId));
    if (nextKeeper) {
      lineup.KP = nextKeeper.playerId;
      usedPlayers.add(nextKeeper.playerId);
    }
  }

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
    Math.max(0, 11 - Object.keys(lineup).length)
  );

  slotsToFill.forEach((slot, index) => {
    const player = fillPlayers[index];
    if (!player) return;
    lineup[slot] = player.id;
    usedPlayers.add(player.id);
  });

  return {
    lineup,
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
  primary: SkillKey | null,
  secondary: SkillKey | null,
  autoSelected = false,
  preferences?: Partial<TrainingPreferences>
) {
  const { allowTrainingUntilMaxedOut } = resolveTrainingPreferences(preferences);
  if (!starPlayerId || !primary || !secondary) {
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

  const lineup: LineupAssignments = {
    [starSlot]: starPlayer.id,
  };
  const usedPlayers = new Set<number>([starPlayer.id]);

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
      lineup[slot] = candidate.id;
      usedPlayers.add(candidate.id);
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

  if (!lineup.KP) {
    const keeperCandidates = players.filter((player) => !usedPlayers.has(player.id));
    keeperCandidates.sort((a, b) => {
      const aTier = trainingPriorityTier(
        a,
        slotTrainingSkills("KP", primary, secondary),
        allowTrainingUntilMaxedOut
      );
      const bTier = trainingPriorityTier(
        b,
        slotTrainingSkills("KP", primary, secondary),
        allowTrainingUntilMaxedOut
      );
      if (aTier !== bTier) return aTier - bTier;
      const aRating = ratingForSlot(ratingsByPlayer, a.id, "KP");
      const bRating = ratingForSlot(ratingsByPlayer, b.id, "KP");
      if (aRating === null && bRating === null) return 0;
      if (aRating === null) return 1;
      if (bRating === null) return -1;
      return bRating - aRating;
    });
    if (keeperCandidates[0]) {
      lineup.KP = keeperCandidates[0].id;
      usedPlayers.add(keeperCandidates[0].id);
    }
  }

  const totalSlotsNeeded = 11;
  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = shuffleSlots(orderedRemainingSlots).slice(
    0,
    Math.max(0, totalSlotsNeeded - Object.keys(lineup).length)
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
    lineup[slot] = candidate.id;
    usedPlayers.add(candidate.id);
  });

  return {
    lineup,
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
