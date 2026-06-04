export type EffectiveSkillInput = {
  rawSkill: number | null | undefined;
  loyalty: number | null | undefined;
  motherClubBonus: boolean | null | undefined;
  form: number | null | undefined;
  staminaFactor?: number | null | undefined;
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

export function calculateEffectiveSkill(input: EffectiveSkillInput): number | null {
  const { rawSkill } = input;
  if (typeof rawSkill !== "number" || !Number.isFinite(rawSkill)) return null;

  const formFactor = calculateFormSkillFactor(input.form);
  if (formFactor === null) return null;

  const staminaFactor =
    typeof input.staminaFactor === "number" && Number.isFinite(input.staminaFactor)
      ? input.staminaFactor
      : 1;

  return (
    (rawSkill +
      calculateLoyaltySkillBonus(input.loyalty) +
      calculateMotherClubSkillBonus(input.motherClubBonus)) *
    formFactor *
    staminaFactor
  );
}
