import type { CoachLeadership } from "@/lib/teamSpirit";

const LEADERSHIP_BY_SKILL_VALUE: Record<number, CoachLeadership> = {
  7: "solid",
  6: "passable",
  5: "inadequate",
  4: "weak",
  3: "poor",
  2: "wretched",
  1: "disastrous",
  0: "non-existent",
};

export function parseCoachNumberNode(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    const parsedText = Number(text);
    return Number.isFinite(parsedText) ? parsedText : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCoachLeadershipSkillValue(value: unknown): number | null {
  const parsed = parseCoachNumberNode(value);
  if (parsed === null) return null;
  const normalized = Math.floor(parsed);
  return normalized >= 0 && normalized <= 7 ? normalized : null;
}

export function parseCoachLeadership(value: unknown): CoachLeadership | null {
  const skillValue = parseCoachLeadershipSkillValue(value);
  return skillValue === null ? null : LEADERSHIP_BY_SKILL_VALUE[skillValue] ?? null;
}
