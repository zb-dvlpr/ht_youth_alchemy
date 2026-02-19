export type SkillValue = number | string | { "#text"?: number | string; "@_IsMaxReached"?: string };

export function getSkillMaxReached(
  skill?: SkillValue | null
): boolean {
  if (skill === null || skill === undefined) return false;
  if (typeof skill === "object" && "@_IsMaxReached" in skill) {
    return String(skill["@_IsMaxReached"]).trim().toLowerCase() === "true";
  }
  return false;
}
