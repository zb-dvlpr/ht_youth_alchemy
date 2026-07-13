import type { Messages } from "@/lib/i18n";
import { resolveInjuryStatus } from "@/lib/injuries";
import { hattrickPlayerUrl } from "@/lib/hattrick/urls";
import { formatSekCurrency, SEK_DISPLAY_CURRENCY } from "@/lib/currency";
import { formatSeniorPlayerName } from "@/lib/seniorPlayerName";
import type { ReminderCandidate, ReminderRule } from "./types";
import {
  seniorSalaryIncreaseEpisodeKey,
  type SeniorSalaryIncreaseEvent,
} from "./seniorSalaryBaseline";

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
  Salary?: number;
};

export type SeniorReminderTeamContext = {
  teamId: number | null;
  players: SeniorReminderPlayer[];
  detailsCache: Record<
    number,
    { data?: { InjuryLevel?: number; Salary?: number } | null }
  >;
  salaryIncreaseEvents?: SeniorSalaryIncreaseEvent[];
};

export type SeniorReminderContext = {
  messages: Messages;
  teamContexts?: SeniorReminderTeamContext[];
  teamId: number | null;
  players: SeniorReminderPlayer[];
  detailsCache: Record<
    number,
    { data?: { InjuryLevel?: number; Salary?: number } | null }
  >;
  salaryIncreaseEvents?: SeniorSalaryIncreaseEvent[];
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
  formatSeniorPlayerName(player) || String(player.PlayerID);

const formatReminderSalaryFromSek = (salarySek: number) =>
  formatSekCurrency(salarySek, SEK_DISPLAY_CURRENCY);

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
      salaryIncreaseEvents: context.salaryIncreaseEvents,
    },
  ];
};

export const SENIOR_PLAYER_SALARY_INCREASE_RULE: ReminderRule<
  SeniorReminderContext | undefined
> = {
  ruleId: "senior.player.salaryIncrease.gt100kSek",
  version: 1,
  scope: "senior",
  suppressionExpiry: { type: "candidateDuration" },
  evaluate: (context) => {
    if (!context) return [];
    return getSeniorReminderTeamContexts(context).flatMap((teamContext) => {
      if (!teamContext.teamId) return [];
      return (teamContext.salaryIncreaseEvents ?? []).flatMap(
        (event): ReminderCandidate[] => {
          if (event.teamId !== teamContext.teamId) return [];
          const previousSalary = formatReminderSalaryFromSek(event.previousSalarySek);
          const currentSalary = formatReminderSalaryFromSek(event.currentSalarySek);
          const stableKey = `senior:${event.teamId}:player-salary-increase:v1:${event.playerId}`;
          const episodeKey = seniorSalaryIncreaseEpisodeKey(
            event.teamId,
            event.playerId,
            event.previousSalarySek,
            event.currentSalarySek
          );
          return [
            {
              stableKey,
              episodeKey,
              triggerKey: episodeKey,
              ruleId: "senior.player.salaryIncrease.gt100kSek",
              ruleVersion: 1,
              scope: "senior",
              teamId: event.teamId,
              entityType: "seniorPlayer",
              entityId: String(event.playerId),
              severity: "warning",
              title: context.messages.reminderSeniorSalaryIncreaseTitle,
              body: context.messages.reminderSeniorSalaryIncreaseBody
                .replace("{{playerName}}", event.playerName)
                .replace("{{previousSalary}}", previousSalary)
                .replace("{{currentSalary}}", currentSalary),
              payload: {
                scope: "senior",
                teamId: event.teamId,
                playerId: event.playerId,
                playerName: event.playerName,
                previousSalarySek: event.previousSalarySek,
                currentSalarySek: event.currentSalarySek,
                increaseSek: event.increaseSek,
                previousSalary,
                currentSalary,
              },
              expiresAtFromFirstSeenMs: WEEK_MS,
              actions: [
                {
                  type: "openExternalUrl",
                  label: context.messages.reminderActionSellPlayer,
                  payload: {
                    url: hattrickPlayerUrl(event.playerId),
                    playerId: event.playerId,
                    teamId: event.teamId,
                  },
                },
              ],
            },
          ];
        }
      );
    });
  },
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
