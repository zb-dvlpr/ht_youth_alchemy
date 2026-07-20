import type { Match } from "@/app/components/UpcomingMatches";

export type TeamSpiritMatchStatus = "UPCOMING" | "ONGOING" | "FINISHED";

export type TeamSpiritMatch = Omit<Match, "MatchID"> & {
  MatchID: number | null;
  SourceSystem: string;
  sortTime: number;
  derivedStatus: TeamSpiritMatchStatus;
  isSyntheticPlaceholder: boolean;
  syntheticKey?: string;
};

export const TEAM_SPIRIT_MATCH_WINDOW_MS = (45 + 15 + 45 + 10) * 60 * 1000;

const HATTRICK_TIME_ZONE = "Europe/Berlin";
const HATTRICK_WEEK_MS = 7 * 86_400_000;

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function toTeamSpiritNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toTeamSpiritString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    return typeof text === "string" || typeof text === "number" ? String(text) : "";
  }
  return String(value);
}

function parseDateParts(value: unknown) {
  const text = toTeamSpiritString(value).trim();
  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  };
}

const hattrickPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: HATTRICK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function zonedPartsAsUtc(timestamp: number) {
  const parts = Object.fromEntries(
    hattrickPartsFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
}

export function parseHattrickMatchDate(value: unknown): Date | null {
  const parts = parseDateParts(value);
  if (!parts) return null;
  const desiredWallTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  let timestamp = desiredWallTime;
  for (let pass = 0; pass < 2; pass += 1) {
    timestamp += desiredWallTime - zonedPartsAsUtc(timestamp);
  }
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatHattrickMatchDate(value: unknown) {
  const parsed = parseHattrickMatchDate(value);
  if (!parsed) return null;
  const parts = Object.fromEntries(
    hattrickPartsFormatter
      .formatToParts(parsed)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function formatHattrickMatchDateValue(timestamp: number) {
  const parts = Object.fromEntries(
    hattrickPartsFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function deriveTeamSpiritMatchStatus(
  matchTime: number,
  nowMs: number
): TeamSpiritMatchStatus {
  if (nowMs < matchTime) return "UPCOMING";
  if (nowMs < matchTime + TEAM_SPIRIT_MATCH_WINDOW_MS) return "ONGOING";
  return "FINISHED";
}

export function matchKey(match: TeamSpiritMatch) {
  if (match.isSyntheticPlaceholder) return match.syntheticKey ?? `synthetic:${match.sortTime}`;
  const source = match.SourceSystem?.trim() || "Hattrick";
  return `${source}:${match.MatchID}`;
}

export function isUpcomingMatch(match: TeamSpiritMatch) {
  return match.derivedStatus === "UPCOMING";
}

export function isInProgressMatch(match: TeamSpiritMatch) {
  return match.derivedStatus === "ONGOING";
}

export function isFinishedMatch(match: TeamSpiritMatch) {
  return match.derivedStatus === "FINISHED";
}

export function normalizeTeamSpiritMatch(
  match: Match,
  nowMs: number
): TeamSpiritMatch | null {
  const matchId = toTeamSpiritNumber(match.MatchID);
  const matchDate = parseHattrickMatchDate(match.MatchDate);
  if (!matchId || !matchDate) return null;
  const sortTime = matchDate.getTime();
  return {
    ...match,
    MatchID: matchId,
    SourceSystem: match.SourceSystem?.trim() || "Hattrick",
    sortTime,
    derivedStatus: deriveTeamSpiritMatchStatus(sortTime, nowMs),
    isSyntheticPlaceholder: false,
  };
}

export function isActualMainCupMatch(match: Match | TeamSpiritMatch) {
  return toTeamSpiritNumber(match.MatchType) === 3 && toTeamSpiritNumber(match.CupLevel) === 1;
}

export function isQualificationMatch(match: Match | TeamSpiritMatch) {
  return toTeamSpiritNumber(match.MatchType) === 2;
}

export function isTeamSpiritNonLeagueCandidate(match: Match) {
  return isActualMainCupMatch(match) || isQualificationMatch(match);
}

export function normalizeLeagueFixtures(payload: unknown, teamId: number, nowMs: number) {
  const root = (payload as { data?: { HattrickData?: unknown } } | null)?.data
    ?.HattrickData as { Match?: Match[] | Match } | undefined;
  return asArray(root?.Match)
    .filter((match) => {
      const homeId = toTeamSpiritNumber(match.HomeTeam?.HomeTeamID);
      const awayId = toTeamSpiritNumber(match.AwayTeam?.AwayTeamID);
      return homeId === teamId || awayId === teamId;
    })
    .map((match) =>
      normalizeTeamSpiritMatch(
        {
          ...match,
          MatchType: 1,
          CupLevel: 0,
          SourceSystem: match.SourceSystem?.trim() || "Hattrick",
        },
        nowMs
      )
    )
    .filter((match): match is TeamSpiritMatch => Boolean(match));
}

export function filterCurrentSeasonNonLeagueMatches(
  matches: TeamSpiritMatch[],
  firstLeagueTime: number | null,
  lastLeagueTime: number | null
) {
  if (firstLeagueTime === null || lastLeagueTime === null) return [];
  const mainCupSeasonStartBoundary = firstLeagueTime - HATTRICK_WEEK_MS;
  return matches.filter((match) => {
    if (isActualMainCupMatch(match)) return match.sortTime >= mainCupSeasonStartBoundary;
    if (isQualificationMatch(match)) return match.sortTime >= lastLeagueTime;
    return false;
  });
}

export function deduplicateTeamSpiritMatches(matches: TeamSpiritMatch[]) {
  const map = new Map<string, TeamSpiritMatch>();
  for (const match of matches) map.set(matchKey(match), match);
  return [...map.values()];
}

export function sortTeamSpiritMatches(matches: TeamSpiritMatch[]) {
  return [...matches].sort((a, b) => a.sortTime - b.sortTime);
}

export function refreshTeamSpiritStatuses(matches: TeamSpiritMatch[], nowMs: number) {
  return matches.map((match) =>
    match.isSyntheticPlaceholder
      ? { ...match, derivedStatus: "UPCOMING" as const }
      : { ...match, derivedStatus: deriveTeamSpiritMatchStatus(match.sortTime, nowMs) }
  );
}

export function buildMainCupPlaceholder(input: {
  teamId: number;
  latestActualCupMatch: TeamSpiritMatch | null;
  nowMs: number;
}): TeamSpiritMatch | null {
  const latest = input.latestActualCupMatch;
  if (!latest) return null;
  const placeholderTime = latest.sortTime + HATTRICK_WEEK_MS;
  const syntheticKey = `team-spirit-main-cup-placeholder:${input.teamId}:${placeholderTime}`;
  return {
    MatchID: null,
    MatchDate: formatHattrickMatchDateValue(placeholderTime),
    Status: "UPCOMING",
    MatchType: 3,
    CupLevel: 1,
    SourceSystem: "Hattrick",
    HomeTeam: {
      HomeTeamName: latest.HomeTeam?.HomeTeamName,
      HomeTeamID: latest.HomeTeam?.HomeTeamID,
    },
    AwayTeam: {
      AwayTeamName: latest.AwayTeam?.AwayTeamName,
      AwayTeamID: latest.AwayTeam?.AwayTeamID,
    },
    sortTime: placeholderTime,
    derivedStatus: "UPCOMING",
    isSyntheticPlaceholder: true,
    syntheticKey,
  };
}
