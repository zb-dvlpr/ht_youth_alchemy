import type { Messages } from "@/lib/i18n";
import { hattrickYouthPlayerUrl } from "@/lib/hattrick/urls";
import { resolveYouthPromotionStatus } from "@/lib/youthPromotion";
import type { ReminderCandidate, ReminderRule } from "./types";

export const YOUTH_PROMOTION_REMINDER_CONTEXT_EVENT =
  "ya:youth-promotion-reminder-context";

const PROMOTION_WINDOW_MS = 48 * 60 * 60 * 1000;
const PROMOTION_EXPIRY_AFTER_ELIGIBLE_MS = 7 * 24 * 60 * 60 * 1000;

export type YouthPromotionReminderPlayer = {
  YouthPlayerID: number;
  FirstName?: string;
  NickName?: string;
  LastName?: string;
  CanBePromotedIn?: number;
};

export type YouthPromotionReminderDetails = {
  CanBePromotedIn?: number;
};

export type YouthPromotionReminderTeamContext = {
  youthTeamId: number | null;
  players: YouthPromotionReminderPlayer[];
  detailsById: Record<number, YouthPromotionReminderDetails | null | undefined>;
};

export type YouthPromotionReminderContext = {
  messages: Messages;
  teamContexts?: YouthPromotionReminderTeamContext[];
} & YouthPromotionReminderTeamContext;

export type YouthPromotionReminderContextEventDetail =
  YouthPromotionReminderContext;

const formatYouthPlayerName = (player: YouthPromotionReminderPlayer) =>
  [player.FirstName, player.NickName, player.LastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim() || String(player.YouthPlayerID);

const formatTimeRemaining = (timeUntilPromotionMs: number) => {
  const hours = Math.ceil(timeUntilPromotionMs / (60 * 60 * 1000));
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  if (hours === 24) return "1 day";
  return `${hours} hours`;
};

const getYouthPromotionTeamContexts = (
  context: YouthPromotionReminderContext | undefined
): YouthPromotionReminderTeamContext[] => {
  if (!context) return [];
  if (context.teamContexts?.length) return context.teamContexts;
  return [
    {
      youthTeamId: context.youthTeamId,
      players: context.players,
      detailsById: context.detailsById,
    },
  ];
};

export const YOUTH_PLAYER_PROMOTION_WITHIN48H_RULE: ReminderRule<
  YouthPromotionReminderContext | undefined
> = {
  ruleId: "youth.player.canBePromoted.within48h",
  version: 1,
  scope: "youth",
  suppressionExpiry: { type: "candidateDuration" },
  evaluate: (context) => {
    if (!context) return [];
    const now = Date.now();
    return getYouthPromotionTeamContexts(context).flatMap((teamContext) => {
      const youthTeamId = teamContext.youthTeamId;
      if (!youthTeamId) return [];
      return teamContext.players.flatMap((player): ReminderCandidate[] => {
        const playerId = player.YouthPlayerID;
        const canBePromotedIn =
          teamContext.detailsById[playerId]?.CanBePromotedIn ??
          player.CanBePromotedIn;
        const status = resolveYouthPromotionStatus(canBePromotedIn, now);
        const timeUntilPromotionMs = status.timeUntilPromotionMs;
        if (
          !status.isKnown ||
          status.isPromotableNowOrPast ||
          !timeUntilPromotionMs ||
          timeUntilPromotionMs > PROMOTION_WINDOW_MS ||
          !status.promotionAt
        ) {
          return [];
        }
        const expiresAt =
          status.promotionAt + PROMOTION_EXPIRY_AFTER_ELIGIBLE_MS;
        const stableKey = `youth:${youthTeamId}:player-can-be-promoted-within48h:v1:${playerId}`;
        const playerName = formatYouthPlayerName(player);
        const timeRemaining = formatTimeRemaining(timeUntilPromotionMs);
        const url = hattrickYouthPlayerUrl(playerId);
        return [
          {
            stableKey,
            episodeKey: stableKey,
            triggerKey: stableKey,
            ruleId: "youth.player.canBePromoted.within48h",
            ruleVersion: 1,
            scope: "youth",
            teamId: youthTeamId,
            entityType: "youthPlayer",
            entityId: String(playerId),
            severity: "info",
            title: context.messages.reminderYouthPromotionTitle,
            body: context.messages.reminderYouthPromotionBody
              .replace("{{playerName}}", playerName)
              .replace("{{timeRemaining}}", timeRemaining),
            payload: {
              scope: "youth",
              youthTeamId,
              playerId,
              playerName,
              canBePromotedIn,
              timeUntilPromotionMs,
              promotionAt: status.promotionAt,
              expiresAt,
              timeRemaining,
              url,
            },
            expiresAt,
            dismissalExpiryDurationMs: Math.max(1, expiresAt - now),
            actions: [
              {
                type: "openExternalUrl",
                label: context.messages.reminderActionViewPlayerInHattrick,
                payload: {
                  url,
                  playerId,
                  youthTeamId,
                },
              },
            ],
          },
        ];
      });
    });
  },
};
