export const SPECIALTY_EMOJI: Record<number, string> = {
  0: "—",
  1: "⚙️",
  2: "🏃",
  3: "💪",
  4: "🎲",
  5: "👤",
  6: "🛡️",
  8: "🤝",
};

export const SPECIALTY_NAMES: Record<number, string> = {
  0: "None",
  1: "Technical",
  2: "Quick",
  3: "Powerful",
  4: "Unpredictable",
  5: "Head specialist",
  6: "Resilient",
  8: "Support",
};

export function getSpecialtyEmoji(value?: number | null) {
  if (value === null || value === undefined) return null;
  if (value === 0) return null;
  return SPECIALTY_EMOJI[value] ?? null;
}
