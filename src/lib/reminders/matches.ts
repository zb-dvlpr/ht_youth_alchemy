import type { Messages } from "@/lib/i18n";
import { parseChppDate } from "@/lib/chpp/utils";
import {
  formatMatchName,
  hasExistingOrders,
  resolveMatchSourceSystem,
  type MatchLike,
} from "@/lib/matches/visibility";
import type { ReminderCandidate, ReminderRule, ReminderScope } from "./types";

export const MATCH_REMINDER_CONTEXT_EVENT = "ya:match-reminder-context";

const MATCH_LINEUP_MISSING_WINDOW_MS = 48 * 60 * 60 * 1000;

export type MatchReminderScope = Extract<ReminderScope, "senior" | "youth">;

export type MatchReminderContext = {
  scope: MatchReminderScope;
  messages: Messages;
  teamId: number | null;
  visibleMatches: MatchLike[];
  fallbackSourceSystem: string;
};

export type MatchReminderContextEventDetail = MatchReminderContext;

const ruleIdByScope: Record<MatchReminderScope, string> = {
  senior: "senior.match.lineupMissingWithin48h",
  youth: "youth.match.lineupMissingWithin48h",
};

const titleKeyByScope: Record<
  MatchReminderScope,
  "reminderSeniorMatchLineupMissingTitle" | "reminderYouthMatchLineupMissingTitle"
> = {
  senior: "reminderSeniorMatchLineupMissingTitle",
  youth: "reminderYouthMatchLineupMissingTitle",
};

const formatTimeRemaining = (msUntilKickoff: number) => {
  const hours = Math.ceil(msUntilKickoff / (60 * 60 * 1000));
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  if (hours === 24) return "1 day";
  return `${hours} hours`;
};

export const createMissingLineupWithin48hRule = (
  scope: MatchReminderScope
): ReminderRule<MatchReminderContext | undefined> => {
  const ruleId = ruleIdByScope[scope];
  return {
    ruleId,
    version: 1,
    scope,
    suppressionExpiry: { type: "candidateDuration" },
    evaluate: (context) => {
      if (!context || context.scope !== scope || !context.teamId) return [];
      const now = Date.now();
      return context.visibleMatches.flatMap((match): ReminderCandidate[] => {
        const matchId = Number(match.MatchID);
        const matchStart = parseChppDate(match.MatchDate);
        if (!Number.isFinite(matchId) || !matchStart) return [];
        if (match.Status !== "UPCOMING") return [];
        const matchStartTime = matchStart.getTime();
        const msUntilKickoff = matchStartTime - now;
        if (msUntilKickoff <= 0 || msUntilKickoff > MATCH_LINEUP_MISSING_WINDOW_MS) {
          return [];
        }
        if (hasExistingOrders(match)) return [];

        const sourceSystem = resolveMatchSourceSystem(
          match,
          context.fallbackSourceSystem
        );
        const stableKey = `${scope}:${context.teamId}:match-lineup-missing-within48h:v1:${sourceSystem}:${matchId}`;
        const matchName = formatMatchName(
          match,
          context.messages.homeLabel,
          context.messages.awayLabel
        );
        const timeRemaining = formatTimeRemaining(msUntilKickoff);
        return [
          {
            stableKey,
            episodeKey: stableKey,
            triggerKey: stableKey,
            ruleId,
            ruleVersion: 1,
            scope,
            teamId: context.teamId,
            entityType: "match",
            entityId: `${sourceSystem}:${matchId}`,
            severity: "warning",
            title: context.messages[titleKeyByScope[scope]],
            body: context.messages.reminderMatchLineupMissingBody
              .replace("{{matchName}}", matchName)
              .replace("{{timeRemaining}}", timeRemaining),
            payload: {
              scope,
              teamId: context.teamId,
              matchId,
              sourceSystem,
              matchName,
              matchStartTime,
              homeTeamName: match.HomeTeam?.HomeTeamName ?? null,
              awayTeamName: match.AwayTeam?.AwayTeamName ?? null,
              timeRemaining,
            },
            expiresAt: matchStartTime,
            dismissalExpiryDurationMs: msUntilKickoff,
            actions: [
              {
                type: "app.focusTool",
                label: context.messages.reminderActionSetOrders,
                payload: {
                  tool: scope,
                  matchId,
                  teamId: context.teamId,
                  sourceSystem,
                },
              },
            ],
          },
        ];
      });
    },
  };
};
