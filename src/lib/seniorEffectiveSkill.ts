export type EffectiveSkillInput = {
  rawSkill: number | null | undefined;
  loyalty: number | null | undefined;
  motherClubBonus: boolean | null | undefined;
  form: number | null | undefined;
  stamina: number | null | undefined;
};

export function calculateLoyaltySkillBonus(
  loyalty: number | null | undefined
): number {
  return typeof loyalty === "number" && Number.isFinite(loyalty) ? loyalty / 20 : 0;
}

export function calculateMotherClubSkillBonus(
  motherClubBonus: boolean | null | undefined
): number {
  return motherClubBonus === true ? 0.5 : 0;
}

export function calculateFormSkillFactor(
  form: number | null | undefined
): number | null {
  if (typeof form !== "number" || !Number.isFinite(form)) return null;
  return Math.pow((form - 0.5) / 7, 0.45);
}

export function calculateStaminaSkillFactor(
  stamina: number | null | undefined
): number | null {
  if (typeof stamina !== "number" || !Number.isFinite(stamina)) return null;
  return Math.pow((stamina + 6.5) / 14, 0.6);
}

export function calculateEffectiveSkill(input: EffectiveSkillInput): number | null {
  const { rawSkill } = input;
  if (typeof rawSkill !== "number" || !Number.isFinite(rawSkill)) return null;

  const formFactor = calculateFormSkillFactor(input.form);
  if (formFactor === null) return null;

  const staminaSkillFactor = calculateStaminaSkillFactor(input.stamina);
  if (staminaSkillFactor === null) return null;

  return (
    (rawSkill +
      calculateLoyaltySkillBonus(input.loyalty) +
      calculateMotherClubSkillBonus(input.motherClubBonus)) *
    formFactor *
    staminaSkillFactor
  );
}
