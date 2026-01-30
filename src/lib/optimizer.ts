import type { LineupAssignments } from "@/app/components/LineupField";

export type SkillKey =
  | "keeper"
  | "defending"
  | "playmaking"
  | "winger"
  | "passing"
  | "scoring"
  | "setpieces";

export type TrainingSkillKey = SkillKey;

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
  skills?: PlayerSkillSet | null;
};

type RoleGroup = "GK" | "DEF" | "WB" | "IM" | "W" | "F";

type RankingCategory = "cat1" | "cat2" | "cat3" | "cat4" | "dontCare";

export type RankingEntry = {
  playerId: number;
  name?: string;
  category: RankingCategory;
  current: number | null;
  max: number | null;
  rankValue: number | null;
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

const ROLE_EFFECTS: Record<SkillKey, Partial<Record<RoleGroup, number>>> = {
  keeper: { GK: 1 },
  defending: { DEF: 1, WB: 1 },
  playmaking: { IM: 1, W: 0.5 },
  winger: { W: 1, WB: 0.5 },
  passing: { IM: 1, W: 1, F: 1 },
  scoring: { F: 1 },
  setpieces: { GK: 1, DEF: 1, WB: 1, IM: 1, W: 1, F: 1 },
};

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
  scoring: ["passing"],
  passing: ["scoring", "playmaking", "defending"],
  playmaking: ["passing", "winger", "defending"],
  winger: ["playmaking"],
  defending: ["passing", "playmaking"],
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

function trainingSlotSet(primary: SkillKey, secondary: SkillKey) {
  const primarySlots = slotsForSkill(primary);
  const secondarySlots = slotsForSkill(secondary);
  const union = new Set([...primarySlots, ...secondarySlots]);

  const primaryOvershoots = primarySlots.size > 11;
  const secondaryOvershoots = secondarySlots.size > 11;

  if (primary === secondary) {
    return {
      primarySkill: primary,
      secondarySkill: null as SkillKey | null,
      primarySlots,
      secondarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
    };
  }

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
  if (union.size > 11) {
    return {
      primarySkill: primary,
      secondarySkill: secondary,
      primarySlots,
      secondarySlots,
    };
  }
  return {
    primarySkill: primary,
    secondarySkill: secondary,
    primarySlots,
    secondarySlots,
  };
}

export function getTrainingSlots(primary: SkillKey | null, secondary: SkillKey | null) {
  if (!primary) {
    return {
      primarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
      secondarySlots: new Set<(typeof ALL_SLOTS)[number]>(),
      allSlots: new Set<(typeof ALL_SLOTS)[number]>(),
    };
  }
  const primarySlots = slotsForSkill(primary);
  if (!secondary || secondary === primary) {
    return {
      primarySlots,
      secondarySlots: new Set(primarySlots),
      allSlots: new Set(primarySlots),
    };
  }
  const secondarySlots = slotsForSkill(secondary);
  return {
    primarySlots,
    secondarySlots,
    allSlots: new Set<(typeof ALL_SLOTS)[number]>([
      ...primarySlots,
      ...secondarySlots,
    ]),
  };
}

function chooseStarAndTraining(
  players: OptimizerPlayer[]
): {
  starPlayerId: number;
  primarySkill: SkillKey;
  secondarySkill: SkillKey | null;
  candidates: OptimizerDebug["starSelectionRanks"];
} | null {
  let best: {
    playerId: number;
    skill: SkillKey;
    score: number;
    age?: number | null;
  } | null = null;
  const candidates: Array<{
    playerId: number;
    name?: string;
    skill: SkillKey;
    score: number;
    age?: number | null;
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
    skillKeys.forEach((skill) => {
      const { current, max } = skillValues(player, skill);
      if (current === null) return;
      if (max !== null && current === max) return;
      const score = current * 100 + (max !== null ? 50 + max : 0);
      candidates.push({
        playerId: player.id,
        name: player.name,
        skill,
        score,
        age: player.age ?? null,
        current,
        max,
      });
      if (!best || score > best.score) {
        best = { playerId: player.id, skill, score, age: player.age };
      } else if (best && score === best.score) {
        const currentAge = player.age ?? null;
        const bestAge = best.age ?? null;
        if (currentAge !== null && (bestAge === null || currentAge < bestAge)) {
          best = { playerId: player.id, skill, score, age: currentAge };
        }
      }
    });
  });

  if (!best) return null;

  const bestCandidate: {
    playerId: number;
    skill: SkillKey;
    score: number;
    age?: number | null;
  } = best;
  const primarySkill: SkillKey = bestCandidate.skill;
  const starPlayer = players.find(
    (player) => player.id === bestCandidate.playerId
  );
  let secondarySkill: SkillKey | null = null;

  if (starPlayer) {
    const candidates = SKILL_PAIRS[primarySkill] ?? [];
    for (const candidate of candidates) {
      const { current, max } = skillValues(starPlayer, candidate);
      if (current !== null && max !== null && current === max) {
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
      const ranking = buildSkillRanking(players, skill).ordered;
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
  players: OptimizerPlayer[]
): { starPlayerId: number; primarySkill: SkillKey; secondarySkill: SkillKey | null } | null {
  const auto = chooseStarAndTraining(players);
  if (!auto) return null;
  return {
    starPlayerId: auto.starPlayerId,
    primarySkill: auto.primarySkill,
    secondarySkill: auto.secondarySkill,
  };
}

export type AutoSelection = ReturnType<typeof getAutoSelection>;

export function buildSkillRanking(players: OptimizerPlayer[], skill: SkillKey) {
  const entries: RankingEntry[] = players.map((player) => {
    const { current, max } = skillValues(player, skill);
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
    if (category === "cat1") {
      if (current === max) dontCare = true;
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

  const cat1 = entries.filter((entry) => entry.category === "cat1").sort(byRankDesc);
  const cat4 = entries.filter((entry) => entry.category === "cat4").sort(byRankDesc);
  const cat3 = entries.filter((entry) => entry.category === "cat3").sort(byRankDesc);
  const cat2 = entries.filter((entry) => entry.category === "cat2");
  const dontCare = entries
    .filter((entry) => entry.category === "dontCare")
    .sort((a, b) => {
      const aCapped = a.current !== null && a.max !== null && a.current === a.max;
      const bCapped = b.current !== null && b.max !== null && b.current === b.max;
      if (aCapped && !bCapped) return -1;
      if (!aCapped && bCapped) return 1;
      return byRankDesc(a, b);
    });

  const ordered = [...cat1, ...cat4, ...cat3, ...cat2, ...dontCare];
  return { ordered, debug: ordered };
}

function slotSkillScore(
  player: OptimizerPlayer,
  slot: (typeof ALL_SLOTS)[number],
  primary: SkillKey,
  secondary: SkillKey
) {
  const role = ROLE_BY_SLOT[slot];
  const primaryTrained = (ROLE_EFFECTS[primary][role] ?? 0) > 0;
  const secondaryTrained = (ROLE_EFFECTS[secondary][role] ?? 0) > 0;
  if (!primaryTrained && !secondaryTrained) return 0;
  if (primaryTrained && secondaryTrained) {
    return Math.max(
      skillPotential(player, primary),
      skillPotential(player, secondary)
    );
  }
  return primaryTrained
    ? skillPotential(player, primary)
    : skillPotential(player, secondary);
}

function skillPotential(player: OptimizerPlayer, skill: SkillKey) {
  const { current, max } = skillValues(player, skill);
  if (current === null || max === null) return 0;
  if (current >= max) return 0;
  if (current < 5 || max < 6) return 0;
  return max;
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

export function optimizeLineupForStar(
  players: OptimizerPlayer[],
  starPlayerId: number | null,
  primary: SkillKey | null,
  secondary: SkillKey | null,
  autoSelected = false
) {
  let selection = {
    starPlayerId: starPlayerId ?? 0,
    primarySkill: primary ?? "passing",
    secondarySkill: secondary ?? null,
    autoSelected: false,
  };

  const autoCandidates = chooseStarAndTraining(players)?.candidates ?? null;
  if (!starPlayerId || !primary || !secondary) {
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

  const trainingInfo = trainingSlotSet(
    selection.primarySkill,
    selection.secondarySkill ?? selection.primarySkill
  );
  const primarySkill = trainingInfo.primarySkill;
  const secondarySkill = trainingInfo.secondarySkill;
  const primarySlots = trainingInfo.primarySlots;
  const secondarySlots = trainingInfo.secondarySlots;
  const trainingSlots = new Set<(typeof ALL_SLOTS)[number]>([
    ...primarySlots,
    ...secondarySlots,
  ]);

  const baseSlots = new Set<(typeof ALL_SLOTS)[number]>(trainingSlots);
  baseSlots.add("KP");

  const overlapSlots = new Set<(typeof ALL_SLOTS)[number]>();
  if (secondarySkill) {
    trainingSlots.forEach((slot) => {
      const role = ROLE_BY_SLOT[slot];
      if (
        (ROLE_EFFECTS[primarySkill][role] ?? 0) > 0 &&
        (ROLE_EFFECTS[secondarySkill][role] ?? 0) > 0
      ) {
        overlapSlots.add(slot);
      }
    });
  }

  let candidateSlots = overlapSlots.size ? overlapSlots : primarySlots;
  if (!candidateSlots.size) {
    candidateSlots = trainingSlots.size ? trainingSlots : baseSlots;
  }

  let starSlot = [...candidateSlots][0];
  let starBest = -1;
  candidateSlots.forEach((slot) => {
    const score = slotSkillScore(
      starPlayer,
      slot,
      primarySkill,
      secondarySkill ?? primarySkill
    );
    if (score > starBest) {
      starBest = score;
      starSlot = slot;
    }
  });

  const primaryRanking = buildSkillRanking(players, primarySkill);
  const secondaryRanking = secondarySkill
    ? buildSkillRanking(players, secondarySkill)
    : null;

  const lineup: LineupAssignments = {
    [starSlot]: starPlayer.id,
  };
  const usedPlayers = new Set<number>([starPlayer.id]);

  const primaryOrder = [...primarySlots].filter((slot) => slot !== starSlot);
  let primaryIndex = 0;
  primaryOrder.forEach((slot) => {
    while (
      primaryIndex < primaryRanking.ordered.length &&
      usedPlayers.has(primaryRanking.ordered[primaryIndex].playerId)
    ) {
      primaryIndex += 1;
    }
    const entry = primaryRanking.ordered[primaryIndex];
    if (!entry) return;
    lineup[slot] = entry.playerId;
    usedPlayers.add(entry.playerId);
    primaryIndex += 1;
  });

  if (secondarySkill) {
    const secondaryOrder = [...secondarySlots].filter((slot) => !(slot in lineup));
    let secondaryIndex = 0;
    secondaryOrder.forEach((slot) => {
      while (
        secondaryIndex < (secondaryRanking?.ordered.length ?? 0) &&
        usedPlayers.has(secondaryRanking?.ordered[secondaryIndex].playerId ?? 0)
      ) {
        secondaryIndex += 1;
      }
      const entry = secondaryRanking?.ordered[secondaryIndex];
      if (!entry) return;
      lineup[slot] = entry.playerId;
      usedPlayers.add(entry.playerId);
      secondaryIndex += 1;
    });
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

  const totalSlotsNeeded = 11;
  const remainingSlots = ALL_SLOTS.filter((slot) => !(slot in lineup));
  const orderedRemainingSlots = buildRemainingSlotOrder(remainingSlots);
  const slotsToFill = orderedRemainingSlots.slice(
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
