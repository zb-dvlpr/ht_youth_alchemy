import { NextResponse } from "next/server";
import { mapWithConcurrency } from "@/lib/async";
import {
  buildChppErrorPayload,
  chppErrorHttpStatus,
  fetchChppXml,
  getChppAuth,
} from "@/lib/chpp/server";
import { normalizeArray, parseChppDate } from "@/lib/chpp/utils";
import {
  reconstructPlayerPositionSegments,
  calculateWeightedTrainingMinutesForPlayer,
  type MatchLineupPlayerLike,
  type MatchOrderLike,
} from "@/lib/seniorTrainingInference/matchTimeline";
import {
  TRAINING_INFERENCE_MATCH_TYPE_IDS,
} from "@/lib/seniorTrainingInference/trainingPositions";
import {
  SENIOR_TRAINABLE_MAIN_SKILLS,
} from "@/lib/seniorTrainingInference/mainSkill";
import {
  SENIOR_TRAINING_HISTORY_ALGORITHM_VERSION,
  type SeniorTrainableMainSkill,
} from "@/lib/seniorTrainingInference/types";
import { resolveLastBirthdayCutoff } from "@/lib/seniorTrainingInference/birthday";
import {
  summarizeWeeklyTraining,
  type WeightedTrainingMinuteEntry,
} from "@/lib/seniorTrainingInference/weeklyTraining";

const MAX_BATCH_PLAYERS = 4;
const PLAYER_ANALYSIS_CONCURRENCY = 4;
const MATCH_FETCH_CONCURRENCY = 5;
const MATCHESARCHIVE_VERSION = "1.5";
const MATCHLINEUP_VERSION = "2.1";
const MATCHDETAILS_VERSION = "3.1";
const TRANSFER_HISTORY_VERSION = "1.2";

type SeniorTrainingHistoryRequestPlayer = {
  playerId: number;
  ageYears: number;
  ageDays: number;
  mainSkill: SeniorTrainableMainSkill;
  currentTeamId?: number | null;
  currentLeagueId?: number | null;
};

type SeniorTrainingHistoryResult =
  | {
      status: "available";
      playerId: number;
      mainSkill: SeniorTrainableMainSkill;
      birthdayCutoff: string;
      rawWeightedMinutes: number;
      weeklyCappedMinutes: number;
      equivalentTrainingWeeks: number;
      matchesConsidered: number;
      matchesPlayed: number;
      weeks: Array<{
        weekKey: string;
        rawWeightedMinutes: number;
        creditedMinutes: number;
      }>;
      latestRelevantMatchDate: string | null;
      sourceTeamIds: number[];
      algorithmVersion: number;
    }
  | {
      status: "unavailable";
      playerId: number;
      reason:
        | "invalid-input"
        | "team-history-unavailable"
        | "match-history-unavailable"
        | "lineup-unavailable"
        | "timeline-unavailable"
        | "unsupported-age"
        | "unknown";
      algorithmVersion: number;
    };

type TransferRecord = {
  Deadline?: unknown;
  Buyer?: { BuyerTeamID?: unknown } | unknown;
  Seller?: { SellerTeamID?: unknown } | unknown;
  BuyerTeamID?: unknown;
  SellerTeamID?: unknown;
};

type MatchArchiveEntry = {
  MatchID?: unknown;
  MatchDate?: unknown;
  MatchType?: unknown;
  MatchTypeID?: unknown;
  Status?: unknown;
  SourceSystem?: unknown;
};

type PlayerTeamInterval = {
  teamId: number;
  startsAt: Date;
  endsAt: Date;
  source: "current-team" | "transfer-history";
};

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parseMainSkill(value: unknown): SeniorTrainableMainSkill | null {
  return typeof value === "string" &&
    (SENIOR_TRAINABLE_MAIN_SKILLS as readonly string[]).includes(value)
    ? (value as SeniorTrainableMainSkill)
    : null;
}

function unavailable(
  playerId: number,
  reason: SeniorTrainingHistoryResult extends infer Result
    ? Result extends { status: "unavailable"; reason: infer Reason }
      ? Reason
      : never
    : never
): SeniorTrainingHistoryResult {
  return {
    status: "unavailable",
    playerId,
    reason,
    algorithmVersion: SENIOR_TRAINING_HISTORY_ALGORITHM_VERSION,
  };
}

function validatePlayer(value: unknown): SeniorTrainingHistoryRequestPlayer | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const playerId = parsePositiveInteger(record.playerId);
  const ageYears = Number(record.ageYears);
  const ageDays = Number(record.ageDays);
  const mainSkill = parseMainSkill(record.mainSkill);
  const currentTeamId =
    record.currentTeamId === null || record.currentTeamId === undefined
      ? null
      : parsePositiveInteger(record.currentTeamId);
  const currentLeagueId =
    record.currentLeagueId === null || record.currentLeagueId === undefined
      ? null
      : parsePositiveInteger(record.currentLeagueId);
  if (
    playerId === null ||
    mainSkill === null ||
    !Number.isInteger(ageYears) ||
    ageYears < 17 ||
    ageYears > 45 ||
    !Number.isInteger(ageDays) ||
    ageDays < 0 ||
    ageDays > 111
  ) {
    return null;
  }
  if (
    record.currentTeamId !== null &&
    record.currentTeamId !== undefined &&
    currentTeamId === null
  ) {
    return null;
  }
  return {
    playerId,
    ageYears,
    ageDays,
    mainSkill,
    currentTeamId,
    currentLeagueId,
  };
}

function formatChppQueryDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nestedTeamId(value: unknown, key: "BuyerTeamID" | "SellerTeamID") {
  if (!value || typeof value !== "object") return null;
  return parsePositiveInteger((value as Record<string, unknown>)[key]);
}

function transferBuyerTeamId(transfer: TransferRecord) {
  return (
    nestedTeamId(transfer.Buyer, "BuyerTeamID") ??
    parsePositiveInteger(transfer.BuyerTeamID)
  );
}

function transferSellerTeamId(transfer: TransferRecord) {
  return (
    nestedTeamId(transfer.Seller, "SellerTeamID") ??
    parsePositiveInteger(transfer.SellerTeamID)
  );
}

function inferSeniorMatchMinutes(matchDetails: Record<string, unknown> | null) {
  const added = Math.max(0, Number(matchDetails?.AddedMinutes) || 0);
  const baselineElapsedMinutes = 45 + 15 + 45 + added;
  const startedAt = parseChppDate(matchDetails?.MatchDate);
  const finishedAt = parseChppDate(matchDetails?.FinishedDate);
  const elapsedMinutes =
    startedAt && finishedAt
      ? Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000))
      : baselineElapsedMinutes;
  return 90 + added + (elapsedMinutes > baselineElapsedMinutes ? 30 : 0);
}

async function resolveTeamIntervals(input: {
  auth: Awaited<ReturnType<typeof getChppAuth>>;
  player: SeniorTrainingHistoryRequestPlayer;
  cutoff: Date;
  now: Date;
}): Promise<PlayerTeamInterval[] | null> {
  if (!input.player.currentTeamId) return null;
  const params = new URLSearchParams({
    file: "transferHistory",
    version: TRANSFER_HISTORY_VERSION,
    actionType: "player",
    playerID: String(input.player.playerId),
  });
  const { parsed } = await fetchChppXml(input.auth, params);
  const transfers = normalizeArray<TransferRecord>(
    parsed?.HattrickData?.Transfers?.Transfer as
      | TransferRecord
      | TransferRecord[]
      | undefined
  )
    .map((transfer) => ({
      transfer,
      deadline: parseChppDate(transfer.Deadline),
      buyerTeamId: transferBuyerTeamId(transfer),
      sellerTeamId: transferSellerTeamId(transfer),
    }))
    .filter(({ deadline }) => deadline !== null)
    .sort((left, right) => right.deadline!.getTime() - left.deadline!.getTime());

  const intervals: PlayerTeamInterval[] = [];
  let activeTeamId: number | null = input.player.currentTeamId;
  let intervalEnd = input.now;

  for (const entry of transfers) {
    const deadline = entry.deadline!;
    if (deadline <= input.cutoff || deadline >= intervalEnd) continue;
    if (activeTeamId === null) return null;
    intervals.push({
      teamId: activeTeamId,
      startsAt: deadline,
      endsAt: intervalEnd,
      source: "transfer-history",
    });
    activeTeamId = entry.sellerTeamId;
    intervalEnd = deadline;
  }

  if (activeTeamId === null) return null;
  intervals.push({
    teamId: activeTeamId,
    startsAt: input.cutoff,
    endsAt: intervalEnd,
    source: "current-team",
  });

  return intervals.filter(
    (interval) => interval.endsAt.getTime() > interval.startsAt.getTime()
  );
}

async function fetchIntervalMatches(input: {
  auth: Awaited<ReturnType<typeof getChppAuth>>;
  interval: PlayerTeamInterval;
}) {
  const params = new URLSearchParams({
    file: "matchesarchive",
    version: MATCHESARCHIVE_VERSION,
    isYouth: "false",
    includeHTO: "true",
    teamID: String(input.interval.teamId),
    FirstMatchDate: formatChppQueryDate(input.interval.startsAt),
    LastMatchDate: formatChppQueryDate(input.interval.endsAt),
  });
  const { parsed } = await fetchChppXml(input.auth, params);
  return normalizeArray<MatchArchiveEntry>(
    parsed?.HattrickData?.Team?.MatchList?.Match as
      | MatchArchiveEntry
      | MatchArchiveEntry[]
      | undefined
  ).map((match) => ({ ...match, teamId: input.interval.teamId }));
}

async function analyzeMatch(input: {
  auth: Awaited<ReturnType<typeof getChppAuth>>;
  match: MatchArchiveEntry & { teamId: number };
  player: SeniorTrainingHistoryRequestPlayer;
}) {
  const matchId = parsePositiveInteger(input.match.MatchID);
  const sourceSystem =
    typeof input.match.SourceSystem === "string" && input.match.SourceSystem
      ? input.match.SourceSystem
      : "Hattrick";
  if (matchId === null) return null;
  const lineupParams = new URLSearchParams({
    file: "matchlineup",
    version: MATCHLINEUP_VERSION,
    matchID: String(matchId),
    teamID: String(input.match.teamId),
    sourceSystem,
  });
  const detailsParams = new URLSearchParams({
    file: "matchdetails",
    version: MATCHDETAILS_VERSION,
    matchID: String(matchId),
    sourceSystem,
    matchEvents: "true",
  });
  const [{ parsed: lineupParsed }, { parsed: detailsParsed }] = await Promise.all([
    fetchChppXml(input.auth, lineupParams),
    fetchChppXml(input.auth, detailsParams),
  ]);
  const matchDetails =
    detailsParsed?.HattrickData?.Match &&
    typeof detailsParsed.HattrickData.Match === "object"
      ? (detailsParsed.HattrickData.Match as Record<string, unknown>)
      : null;
  const segments = reconstructPlayerPositionSegments({
    startingLineup: normalizeArray<MatchLineupPlayerLike>(
      lineupParsed?.HattrickData?.Team?.StartingLineup?.Player as
        | MatchLineupPlayerLike
        | MatchLineupPlayerLike[]
        | undefined
    ),
    orders: normalizeArray<MatchOrderLike>(
      lineupParsed?.HattrickData?.Team?.Substitutions?.Substitution as
        | MatchOrderLike
        | MatchOrderLike[]
        | undefined
    ),
    totalMatchMinutes: inferSeniorMatchMinutes(matchDetails),
  });
  const weightedMinutes = calculateWeightedTrainingMinutesForPlayer({
    segments,
    playerId: input.player.playerId,
    mainSkill: input.player.mainSkill,
  });
  return {
    weightedMinutes,
    played: segments.some((segment) => segment.playerId === input.player.playerId),
  };
}

async function analyzePlayer(input: {
  auth: Awaited<ReturnType<typeof getChppAuth>>;
  player: SeniorTrainingHistoryRequestPlayer;
  now: Date;
}): Promise<SeniorTrainingHistoryResult> {
  const cutoff = resolveLastBirthdayCutoff({
    ageYears: input.player.ageYears,
    ageDays: input.player.ageDays,
    referenceDate: input.now,
  });
  if (!Number.isFinite(cutoff.getTime())) {
    return unavailable(input.player.playerId, "unsupported-age");
  }

  let intervals: PlayerTeamInterval[] | null;
  try {
    intervals = await resolveTeamIntervals({
      auth: input.auth,
      player: input.player,
      cutoff,
      now: input.now,
    });
  } catch {
    return unavailable(input.player.playerId, "team-history-unavailable");
  }
  if (!intervals || intervals.length === 0) {
    return unavailable(input.player.playerId, "team-history-unavailable");
  }

  let matches: Array<MatchArchiveEntry & { teamId: number }>;
  try {
    const intervalMatches = await mapWithConcurrency(
      intervals,
      MATCH_FETCH_CONCURRENCY,
      async (interval) => fetchIntervalMatches({ auth: input.auth, interval })
    );
    const deduped = new Map<string, MatchArchiveEntry & { teamId: number }>();
    for (const match of intervalMatches.flat()) {
      const matchId = parsePositiveInteger(match.MatchID);
      const matchDate = parseChppDate(match.MatchDate);
      const matchType = Number(match.MatchTypeID ?? match.MatchType);
      const status = typeof match.Status === "string" ? match.Status : "FINISHED";
      if (
        matchId === null ||
        !matchDate ||
        status !== "FINISHED" ||
        !TRAINING_INFERENCE_MATCH_TYPE_IDS.has(matchType) ||
        matchDate < cutoff ||
        matchDate > input.now
      ) {
        continue;
      }
      const sourceSystem =
        typeof match.SourceSystem === "string" && match.SourceSystem
          ? match.SourceSystem
          : "Hattrick";
      deduped.set(`${sourceSystem}:${matchId}`, match);
    }
    matches = [...deduped.values()].sort(
      (left, right) =>
        (parseChppDate(left.MatchDate)?.getTime() ?? 0) -
        (parseChppDate(right.MatchDate)?.getTime() ?? 0)
    );
  } catch {
    return unavailable(input.player.playerId, "match-history-unavailable");
  }

  const weightedEntries: WeightedTrainingMinuteEntry[] = [];
  let matchesPlayed = 0;
  try {
    const analyses = await mapWithConcurrency(
      matches,
      MATCH_FETCH_CONCURRENCY,
      async (match) => analyzeMatch({ auth: input.auth, match, player: input.player })
    );
    analyses.forEach((analysis, index) => {
      if (!analysis) return;
      if (analysis.played) matchesPlayed += 1;
      const matchDate = parseChppDate(matches[index].MatchDate);
      if (matchDate && analysis.weightedMinutes > 0) {
        weightedEntries.push({
          matchDate,
          weightedMinutes: analysis.weightedMinutes,
        });
      }
    });
  } catch {
    return unavailable(input.player.playerId, "lineup-unavailable");
  }

  const weekly = summarizeWeeklyTraining(weightedEntries);
  return {
    status: "available",
    playerId: input.player.playerId,
    mainSkill: input.player.mainSkill,
    birthdayCutoff: cutoff.toISOString(),
    rawWeightedMinutes: weekly.rawWeightedMinutes,
    weeklyCappedMinutes: weekly.weeklyCappedMinutes,
    equivalentTrainingWeeks: weekly.equivalentTrainingWeeks,
    matchesConsidered: matches.length,
    matchesPlayed,
    weeks: weekly.weeks,
    latestRelevantMatchDate:
      matches.length > 0
        ? (parseChppDate(matches[matches.length - 1].MatchDate)?.toISOString() ?? null)
        : null,
    sourceTeamIds: [...new Set(intervals.map((interval) => interval.teamId))],
    algorithmVersion: SENIOR_TRAINING_HISTORY_ALGORITHM_VERSION,
  };
}

export async function POST(request: Request) {
  try {
    const auth = await getChppAuth();
    const body = (await request.json().catch(() => null)) as
      | { players?: unknown }
      | null;
    const rawPlayers = Array.isArray(body?.players) ? body.players : null;
    if (!rawPlayers || rawPlayers.length === 0 || rawPlayers.length > MAX_BATCH_PLAYERS) {
      return NextResponse.json(
        { error: "Invalid senior training history request" },
        { status: 400 }
      );
    }
    const players = rawPlayers.map(validatePlayer);
    if (players.some((player) => player === null)) {
      return NextResponse.json(
        { error: "Invalid senior training history player input" },
        { status: 400 }
      );
    }

    const now = new Date();
    const results = await mapWithConcurrency(
      players as SeniorTrainingHistoryRequestPlayer[],
      PLAYER_ANALYSIS_CONCURRENCY,
      async (player) => {
        try {
          return await analyzePlayer({ auth, player, now });
        } catch {
          return unavailable(player.playerId, "unknown");
        }
      }
    );

    return NextResponse.json({
      algorithmVersion: SENIOR_TRAINING_HISTORY_ALGORITHM_VERSION,
      generatedAt: now.toISOString(),
      players: results,
    });
  } catch (error) {
    const payload = buildChppErrorPayload(
      "Failed to fetch senior training history",
      error
    );
    return NextResponse.json(payload, { status: chppErrorHttpStatus(payload) });
  }
}

