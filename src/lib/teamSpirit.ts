export type TeamSpiritAttitude = "PIC" | "PIN" | "MOTS";

export type CoachLeadership =
  | "solid"
  | "passable"
  | "inadequate"
  | "weak"
  | "poor"
  | "wretched"
  | "disastrous"
  | "non-existent";

export const TEAM_SPIRIT_LABELS = [
  { label: "like the cold war", value: 0.5 },
  { label: "murderous", value: 1.5 },
  { label: "furious", value: 2.5 },
  { label: "irritated", value: 3.5 },
  { label: "composed", value: 4.5 },
  { label: "calm", value: 5.5 },
  { label: "content", value: 6.5 },
  { label: "satisfied", value: 7.5 },
  { label: "delirious", value: 8.5 },
  { label: "walking on clouds", value: 9.5 },
  { label: "paradise on earth", value: 10.5 },
];

export const MIDFIELD_NORMAL_POINTS = [
  [0.5, 0.45],
  [1.5, 0.72],
  [2.5, 0.86],
  [3.5, 0.93],
  [4.5, 1.0],
  [5.5, 1.07],
  [6.5, 1.14],
  [7.5, 1.21],
  [8.5, 1.28],
  [9.5, 1.35],
  [10.5, 1.42],
] as const;

export const COACH_LEADERSHIP_VALUES: ReadonlyArray<{
  key: CoachLeadership;
  value: number;
}> = [
  { key: "solid", value: 7 },
  { key: "passable", value: 6 },
  { key: "inadequate", value: 5 },
  { key: "weak", value: 4 },
  { key: "poor", value: 3 },
  { key: "wretched", value: 2 },
  { key: "disastrous", value: 1 },
  { key: "non-existent", value: 0 },
];

export const LEADERSHIP_DAILY: Record<CoachLeadership, number> = {
  solid: 0.045,
  passable: 0.06,
  inadequate: 0.078,
  weak: 0.1,
  poor: 0.13,
  wretched: 0.169,
  disastrous: 0.22,
  "non-existent": 0.286,
};

const ATTITUDE_MIDFIELD_FACTOR: Record<TeamSpiritAttitude, number> = {
  PIC: 0.83945,
  PIN: 1,
  MOTS: 1.1149,
};

export function clampTeamSpirit(value: number): number {
  return Math.max(0.01, Math.min(10.99, value));
}

export function getTeamSpiritLabel(value: number): string {
  const clamped = clampTeamSpirit(value);
  let closest = TEAM_SPIRIT_LABELS[0];
  for (const candidate of TEAM_SPIRIT_LABELS) {
    if (Math.abs(candidate.value - clamped) < Math.abs(closest.value - clamped)) {
      closest = candidate;
    }
  }
  return closest.label;
}

export function formatTeamSpirit(value: number): string {
  const clamped = clampTeamSpirit(value);
  return `${getTeamSpiritLabel(clamped)} (${clamped.toFixed(2)})`;
}

export function applyTeamSpiritAttitude(
  currentTeamSpirit: number,
  attitude: TeamSpiritAttitude
): number {
  if (attitude === "PIC") return clampTeamSpirit((currentTeamSpirit * 4) / 3);
  if (attitude === "MOTS") return clampTeamSpirit(currentTeamSpirit / 2);
  return clampTeamSpirit(currentTeamSpirit);
}

export function driftTeamSpiritOneDay(
  currentTeamSpirit: number,
  coachLeadership: CoachLeadership,
  sportsPsychologistLevel: number
): number {
  const base = 4.5;
  const psychoReduction = Math.max(0, sportsPsychologistLevel) * 0.0075;
  const leadershipRate = LEADERSHIP_DAILY[coachLeadership];
  const rate = Math.max(0.01, leadershipRate - psychoReduction);
  return clampTeamSpirit(currentTeamSpirit + (base - currentTeamSpirit) * rate);
}

export function driftTeamSpiritDays(
  currentTeamSpirit: number,
  days: number,
  coachLeadership: CoachLeadership,
  sportsPsychologistLevel: number
): number {
  const fullDays = Math.max(0, Math.floor(days));
  let next = clampTeamSpirit(currentTeamSpirit);
  for (let day = 0; day < fullDays; day += 1) {
    next = driftTeamSpiritOneDay(next, coachLeadership, sportsPsychologistLevel);
  }
  return next;
}

export function calculateMidfieldPercent(
  currentTeamSpirit: number,
  attitude: TeamSpiritAttitude
): number {
  const clamped = clampTeamSpirit(currentTeamSpirit);
  const points = MIDFIELD_NORMAL_POINTS;
  let normalFactor: number = points[0][1];
  if (clamped >= points[points.length - 1][0]) {
    normalFactor = points[points.length - 1][1];
  } else {
    for (let index = 0; index < points.length - 1; index += 1) {
      const [x1, y1] = points[index];
      const [x2, y2] = points[index + 1];
      if (clamped >= x1 && clamped <= x2) {
        const ratio = (clamped - x1) / (x2 - x1);
        normalFactor = y1 + (y2 - y1) * ratio;
        break;
      }
    }
  }
  return Math.round(normalFactor * ATTITUDE_MIDFIELD_FACTOR[attitude] * 100);
}

export function parseApiTeamAttitude(value: unknown): TeamSpiritAttitude | null {
  const parsed =
    typeof value === "object" && value !== null
      ? Number((value as Record<string, unknown>)["#text"])
      : Number(value);
  if (parsed === -1) return "PIC";
  if (parsed === 0) return "PIN";
  if (parsed === 1) return "MOTS";
  return null;
}
