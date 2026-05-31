import type { ReminderCandidate, ReminderRule } from "./types";
import { evaluateReminderRules } from "./engine";

export type SeniorReminderContext = unknown;
export type YouthReminderContext = unknown;
export type ClubChronicleReminderContext = unknown;
export type SharedReminderContext = unknown;

export type GlobalReminderContext = {
  senior?: SeniorReminderContext;
  youth?: YouthReminderContext;
  clubChronicle?: ClubChronicleReminderContext;
  shared?: SharedReminderContext;
};

export const SENIOR_REMINDER_RULES: ReminderRule<SeniorReminderContext>[] = [];
export const YOUTH_REMINDER_RULES: ReminderRule<YouthReminderContext>[] = [];
export const CLUB_CHRONICLE_REMINDER_RULES: ReminderRule<ClubChronicleReminderContext>[] = [];
export const SHARED_REMINDER_RULES: ReminderRule<SharedReminderContext>[] = [];

export const ALL_REMINDER_RULES: ReminderRule[] = [
  ...SENIOR_REMINDER_RULES,
  ...YOUTH_REMINDER_RULES,
  ...CLUB_CHRONICLE_REMINDER_RULES,
  ...SHARED_REMINDER_RULES,
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
