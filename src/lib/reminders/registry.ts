import type { ReminderCandidate, ReminderRule } from "./types";
import { evaluateReminderRules } from "./engine";
import {
  SENIOR_PLAYER_SALARY_INCREASE_RULE,
  SENIOR_PLAYER_INJURY_GTE2W_RULE,
  type SeniorReminderContext,
} from "./senior";
import {
  createMissingLineupWithin48hRule,
  type MatchReminderContext,
} from "./matches";
import {
  YOUTH_PLAYER_PROMOTION_WITHIN48H_RULE,
  type YouthPromotionReminderContext,
} from "./youthPromotion";
import {
  CLUB_CHRONICLE_OWN_ARENA_OCCUPANCY_GTE90_RULE,
  type ClubChronicleReminderContext,
} from "./clubChronicle";

export type YouthReminderContext = MatchReminderContext | undefined;
export type SharedReminderContext = unknown;

export type GlobalReminderContext = {
  senior?: SeniorReminderContext;
  seniorMatches?: MatchReminderContext;
  youth?: YouthReminderContext;
  youthPromotion?: YouthPromotionReminderContext;
  clubChronicle?: ClubChronicleReminderContext;
  shared?: SharedReminderContext;
};

export const SENIOR_INJURY_REMINDER_RULES: ReminderRule<
  SeniorReminderContext | undefined
>[] = [
  SENIOR_PLAYER_INJURY_GTE2W_RULE,
];
export const SENIOR_SALARY_REMINDER_RULES: ReminderRule<
  SeniorReminderContext | undefined
>[] = [
  SENIOR_PLAYER_SALARY_INCREASE_RULE,
];
export const SENIOR_MATCH_REMINDER_RULES: ReminderRule<
  MatchReminderContext | undefined
>[] = [
  createMissingLineupWithin48hRule("senior"),
];
export const SENIOR_REMINDER_RULES: ReminderRule[] = [
  ...(SENIOR_INJURY_REMINDER_RULES as ReminderRule[]),
  ...(SENIOR_SALARY_REMINDER_RULES as ReminderRule[]),
  ...(SENIOR_MATCH_REMINDER_RULES as ReminderRule[]),
];
export const YOUTH_REMINDER_RULES: ReminderRule<YouthReminderContext>[] = [
  createMissingLineupWithin48hRule("youth"),
];
export const YOUTH_PROMOTION_REMINDER_RULES: ReminderRule<
  YouthPromotionReminderContext | undefined
>[] = [YOUTH_PLAYER_PROMOTION_WITHIN48H_RULE];
export const CLUB_CHRONICLE_REMINDER_RULES: ReminderRule<
  ClubChronicleReminderContext | undefined
>[] = [CLUB_CHRONICLE_OWN_ARENA_OCCUPANCY_GTE90_RULE];
export const SHARED_REMINDER_RULES: ReminderRule<SharedReminderContext>[] = [];

export const ALL_REMINDER_RULES: ReminderRule[] = [
  ...(SENIOR_REMINDER_RULES as ReminderRule[]),
  ...(YOUTH_REMINDER_RULES as ReminderRule[]),
  ...(YOUTH_PROMOTION_REMINDER_RULES as ReminderRule[]),
  ...(CLUB_CHRONICLE_REMINDER_RULES as ReminderRule[]),
  ...(SHARED_REMINDER_RULES as ReminderRule[]),
];

export const evaluateRegisteredReminderCandidates = (
  context: GlobalReminderContext
): ReminderCandidate[] => [
  ...evaluateReminderRules(SENIOR_INJURY_REMINDER_RULES, context.senior),
  ...evaluateReminderRules(SENIOR_SALARY_REMINDER_RULES, context.senior),
  ...evaluateReminderRules(SENIOR_MATCH_REMINDER_RULES, context.seniorMatches),
  ...evaluateReminderRules(YOUTH_REMINDER_RULES, context.youth),
  ...evaluateReminderRules(
    YOUTH_PROMOTION_REMINDER_RULES,
    context.youthPromotion
  ),
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
  ...YOUTH_PROMOTION_REMINDER_RULES.flatMap(
    (rule) => rule.evaluateActiveEpisodes?.(context.youthPromotion) ?? []
  ),
  ...CLUB_CHRONICLE_REMINDER_RULES.flatMap(
    (rule) => rule.evaluateActiveEpisodes?.(context.clubChronicle) ?? []
  ),
  ...SHARED_REMINDER_RULES.flatMap(
    (rule) => rule.evaluateActiveEpisodes?.(context.shared) ?? []
  ),
];
