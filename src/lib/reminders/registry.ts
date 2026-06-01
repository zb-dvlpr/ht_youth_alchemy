import type { ReminderCandidate, ReminderRule } from "./types";
import { evaluateReminderRules } from "./engine";
import {
  SENIOR_PLAYER_INJURY_GTE2W_RULE,
  type SeniorReminderContext,
} from "./senior";

export type YouthReminderContext = unknown;
export type ClubChronicleReminderContext = unknown;
export type SharedReminderContext = unknown;

export type GlobalReminderContext = {
  senior?: SeniorReminderContext;
  youth?: YouthReminderContext;
  clubChronicle?: ClubChronicleReminderContext;
  shared?: SharedReminderContext;
};

export const SENIOR_REMINDER_RULES: ReminderRule<
  SeniorReminderContext | undefined
>[] = [
  SENIOR_PLAYER_INJURY_GTE2W_RULE,
];
export const YOUTH_REMINDER_RULES: ReminderRule<YouthReminderContext>[] = [];
export const CLUB_CHRONICLE_REMINDER_RULES: ReminderRule<ClubChronicleReminderContext>[] = [];
export const SHARED_REMINDER_RULES: ReminderRule<SharedReminderContext>[] = [];

export const ALL_REMINDER_RULES: ReminderRule[] = [
  ...(SENIOR_REMINDER_RULES as ReminderRule[]),
  ...(YOUTH_REMINDER_RULES as ReminderRule[]),
  ...(CLUB_CHRONICLE_REMINDER_RULES as ReminderRule[]),
  ...(SHARED_REMINDER_RULES as ReminderRule[]),
];

export const evaluateRegisteredReminderCandidates = (
  context: GlobalReminderContext
): ReminderCandidate[] => [
  ...evaluateReminderRules(SENIOR_REMINDER_RULES, context.senior),
  ...evaluateReminderRules(YOUTH_REMINDER_RULES, context.youth),
  ...evaluateReminderRules(
    CLUB_CHRONICLE_REMINDER_RULES,
    context.clubChronicle
  ),
  ...evaluateReminderRules(SHARED_REMINDER_RULES, context.shared),
];

export const evaluateRegisteredReminderEpisodes = (
  context: GlobalReminderContext
): Array<{ stableKey: string; episodeKey: string }> => [
  ...SENIOR_REMINDER_RULES.flatMap(
    (rule) => rule.evaluateActiveEpisodes?.(context.senior) ?? []
  ),
  ...YOUTH_REMINDER_RULES.flatMap(
    (rule) => rule.evaluateActiveEpisodes?.(context.youth) ?? []
  ),
  ...CLUB_CHRONICLE_REMINDER_RULES.flatMap(
    (rule) => rule.evaluateActiveEpisodes?.(context.clubChronicle) ?? []
  ),
  ...SHARED_REMINDER_RULES.flatMap(
    (rule) => rule.evaluateActiveEpisodes?.(context.shared) ?? []
  ),
];
