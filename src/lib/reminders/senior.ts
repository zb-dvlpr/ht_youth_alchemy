import type { Messages } from "@/lib/i18n";
import { resolveInjuryStatus } from "@/lib/injuries";
import type { ReminderCandidate, ReminderRule } from "./types";

export const SENIOR_OPEN_FIND_SIMILAR_PLAYERS_EVENT =
  "ya:senior-open-find-similar-players";
export const SENIOR_REMINDER_CONTEXT_EVENT = "ya:senior-reminder-context";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type SeniorReminderPlayer = {
  PlayerID: number;
  FirstName?: string;
  NickName?: string;
  LastName?: string;
  InjuryLevel?: number;
};

export type SeniorReminderTeamContext = {
  teamId: number | null;
  players: SeniorReminderPlayer[];
  detailsCache: Record<number, { data?: { InjuryLevel?: number } | null }>;
};

export type SeniorReminderContext = {
  messages: Messages;
  teamContexts?: SeniorReminderTeamContext[];
  teamId: number | null;
  players: SeniorReminderPlayer[];
  detailsCache: Record<number, { data?: { InjuryLevel?: number } | null }>;
};

export type SeniorFindSimilarPlayersEventDetail = {
  teamId?: number | null;
  playerId: number;
  onHandled?: (opened: boolean) => void;
};

export type SeniorReminderContextEventDetail = {
  context: SeniorReminderContext;
};

export const formatSeniorReminderPlayerName = (player: SeniorReminderPlayer) =>
  [player.FirstName, player.NickName, player.LastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim() || String(player.PlayerID);

const getSeniorReminderTeamContexts = (
  context: SeniorReminderContext | undefined
): SeniorReminderTeamContext[] => {
  if (!context) return [];
  if (context.teamContexts?.length) return context.teamContexts;
  return [
    {
      teamId: context.teamId,
      players: context.players,
      detailsCache: context.detailsCache,
    },
  ];
};

export const buildSeniorInjuryReminderEpisodes = (
  context: SeniorReminderContext | undefined
) =>
  getSeniorReminderTeamContexts(context).flatMap((teamContext) => {
    if (!teamContext.teamId) return [];
    return teamContext.players.flatMap((player) => {
      const playerId = player.PlayerID;
      const injuryStatus = resolveInjuryStatus(
        teamContext.detailsCache[playerId]?.data?.InjuryLevel ??
          player.InjuryLevel
      );
      if (!injuryStatus.injuryWeeks || injuryStatus.injuryWeeks < 1) return [];
      return [
        {
          stableKey: `senior:${teamContext.teamId}:player-injury-gte2w:v1:${playerId}`,
          episodeKey: `senior:${teamContext.teamId}:player-injury-active:v1:${playerId}`,
        },
      ];
    });
  });

export const SENIOR_PLAYER_INJURY_GTE2W_RULE: ReminderRule<
  SeniorReminderContext | undefined
> = {
  ruleId: "senior.player.injury.gte2w",
  version: 1,
  scope: "senior",
  suppressionExpiry: { type: "candidateDuration" },
  evaluateActiveEpisodes: buildSeniorInjuryReminderEpisodes,
  evaluate: (context) => {
    if (!context) return [];
    return getSeniorReminderTeamContexts(context).flatMap((teamContext) => {
      if (!teamContext.teamId) return [];
      const teamId = teamContext.teamId;
      return teamContext.players.flatMap((player): ReminderCandidate[] => {
        const playerId = player.PlayerID;
        const injuryStatus = resolveInjuryStatus(
          teamContext.detailsCache[playerId]?.data?.InjuryLevel ??
            player.InjuryLevel
        );
        const injuryWeeks = injuryStatus.injuryWeeks;
        if (!injuryWeeks || injuryWeeks < 2) return [];
        const playerName = formatSeniorReminderPlayerName(player);
        const stableKey = `senior:${teamId}:player-injury-gte2w:v1:${playerId}`;
        return [
          {
            stableKey,
            episodeKey: `senior:${teamId}:player-injury-active:v1:${playerId}`,
            triggerKey: stableKey,
            ruleId: "senior.player.injury.gte2w",
            ruleVersion: 1,
            scope: "senior",
            teamId,
            entityType: "seniorPlayer",
            entityId: String(playerId),
            severity: "warning",
            title: context.messages.reminderSeniorInjuryTitle,
            body: context.messages.reminderSeniorInjuryBody
              .replace("{{playerName}}", playerName)
              .replace("{{weeks}}", String(injuryWeeks)),
            payload: {
              playerId,
              playerName,
              injuryWeeks,
              teamId,
            },
            dismissalExpiryDurationMs: (injuryWeeks + 1) * WEEK_MS,
            actions: [
              {
                type: "senior.openFindSimilarPlayers",
                label: context.messages.reminderActionFindSimilarPlayers,
                payload: {
                  teamId,
                  playerId,
                },
              },
            ],
          },
        ];
      });
    });
  },
};
