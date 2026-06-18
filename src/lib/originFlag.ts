export type OriginFlagDisplay =
  | { kind: "emoji"; value: string; label: string }
  | { kind: "text"; value: string; label: string };

const ENGLAND_FLAG_EMOJI =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCOTLAND_FLAG_EMOJI =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
const WALES_FLAG_EMOJI =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";

const HATTRICK_LEAGUE_FLAG_OVERRIDES: Record<number, OriginFlagDisplay> = {
  2: { kind: "emoji", value: ENGLAND_FLAG_EMOJI, label: "England" },
  26: { kind: "emoji", value: SCOTLAND_FLAG_EMOJI, label: "Scotland" },
  61: { kind: "emoji", value: WALES_FLAG_EMOJI, label: "Wales" },
  93: { kind: "text", value: "NI", label: "Northern Ireland" },
  1000: { kind: "text", value: "INT", label: "Hattrick International" },
  1001: { kind: "text", value: "APL", label: "Apache League" },
  1002: { kind: "text", value: "ANN", label: "Hattrick Anniversary League" },
  1003: { kind: "text", value: "HG", label: "Homegrown League" },
  3000: { kind: "text", value: "FEM", label: "Hattrick Femme International" },
};

const countryCodeToFlagEmoji = (input: unknown): string | undefined => {
  if (typeof input !== "string") return undefined;
  const code = input.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return undefined;
  return Array.from(code)
    .map((char) => String.fromCodePoint(char.charCodeAt(0) - 65 + 0x1f1e6))
    .join("");
};

export const resolveLeagueOriginFlagDisplay = (
  leagueId: number,
  leagueName: string,
  countryCode?: string
): OriginFlagDisplay | undefined => {
  const override = HATTRICK_LEAGUE_FLAG_OVERRIDES[leagueId];
  if (override) return override;

  const emoji = countryCodeToFlagEmoji(countryCode);
  return emoji ? { kind: "emoji", value: emoji, label: leagueName } : undefined;
};

export const isOriginFlagDisplay = (value: unknown): value is OriginFlagDisplay => {
  if (!value || typeof value !== "object") return false;
  const display = value as Record<string, unknown>;
  return (
    (display.kind === "emoji" || display.kind === "text") &&
    typeof display.value === "string" &&
    display.value.trim().length > 0 &&
    typeof display.label === "string" &&
    display.label.trim().length > 0
  );
};
