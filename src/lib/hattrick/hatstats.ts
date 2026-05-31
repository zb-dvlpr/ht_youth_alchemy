export type FoxtrickHatstatsInput = {
  ratingMidfield: number | null;
  ratingRightDef: number | null;
  ratingMidDef: number | null;
  ratingLeftDef: number | null;
  ratingRightAtt: number | null;
  ratingMidAtt: number | null;
  ratingLeftAtt: number | null;
};

export type FoxtrickHatstatsBreakdown = {
  defense: number;
  midfield: number;
  attack: number;
  total: number;
};

export const computeFoxtrickHatstats = (
  input: FoxtrickHatstatsInput
): FoxtrickHatstatsBreakdown | null => {
  const ratings = [
    input.ratingMidfield,
    input.ratingRightDef,
    input.ratingMidDef,
    input.ratingLeftDef,
    input.ratingRightAtt,
    input.ratingMidAtt,
    input.ratingLeftAtt,
  ];

  if (!ratings.every((value): value is number => typeof value === "number")) {
    return null;
  }

  const [
    ratingMidfield,
    ratingRightDef,
    ratingMidDef,
    ratingLeftDef,
    ratingRightAtt,
    ratingMidAtt,
    ratingLeftAtt,
  ] = ratings;

  const defense = ratingRightDef + ratingMidDef + ratingLeftDef;
  const midfield = ratingMidfield * 3;
  const attack = ratingRightAtt + ratingMidAtt + ratingLeftAtt;

  return {
    defense,
    midfield,
    attack,
    total: defense + midfield + attack,
  };
};
