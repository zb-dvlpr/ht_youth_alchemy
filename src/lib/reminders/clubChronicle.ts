import { isArenaUnderConstruction } from "@/lib/clubChronicleArena";
import { hattrickStadiumUrl } from "@/lib/hattrick/urls";
import type { Messages } from "@/lib/i18n";
import type { ReminderCandidate, ReminderRule } from "./types";

export const CLUB_CHRONICLE_REMINDER_CONTEXT_EVENT =
  "ya:club-chronicle-reminder-context";

const HIGH_OCCUPANCY_THRESHOLD = 90;
const ARENA_OCCUPANCY_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

export type ClubChronicleArenaReminderSnapshot = {
  arenaName?: string | null;
  currentTotalCapacity?: number | null;
  latestOccupancyPct?: number | null;
  latestOccupancySoldTotal?: number | null;
  latestOccupancyMatchId?: number | null;
  latestOccupancyMatchDate?: string | null;
  latestOccupancySourceSystem?: string | null;
  expandedAvailable?: boolean | null;
};

export type ClubChronicleArenaReminderTeam = {
  teamId: number;
  teamName?: string | null;
  arenaId?: number | null;
  arenaName?: string | null;
  isOwnSeniorTeam?: boolean;
  arena?: {
    current?: ClubChronicleArenaReminderSnapshot | null;
  } | null;
};

export type ClubChronicleReminderContext = {
  messages: Messages;
  teams: ClubChronicleArenaReminderTeam[];
};

export type ClubChronicleReminderContextEventDetail =
  ClubChronicleReminderContext;

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

export const CLUB_CHRONICLE_OWN_ARENA_OCCUPANCY_GTE90_RULE: ReminderRule<
  ClubChronicleReminderContext | undefined
> = {
  ruleId: "clubChronicle.ownArena.occupancy.gte90",
  version: 1,
  scope: "clubChronicle",
  suppressionExpiry: { type: "fixedDuration", durationMs: ARENA_OCCUPANCY_EXPIRY_MS },
  evaluate: (context) => {
    if (!context) return [];
    return context.teams.flatMap((team): ReminderCandidate[] => {
      if (!team.isOwnSeniorTeam) return [];
      const arenaId = team.arenaId;
      const snapshot = team.arena?.current;
      if (
        typeof arenaId !== "number" ||
        !Number.isFinite(arenaId) ||
        arenaId <= 0 ||
        !snapshot ||
        isArenaUnderConstruction(snapshot)
      ) {
        return [];
      }
      const latestOccupancyPct = snapshot.latestOccupancyPct;
      const currentTotalCapacity = snapshot.currentTotalCapacity;
      if (
        typeof latestOccupancyPct !== "number" ||
        !Number.isFinite(latestOccupancyPct) ||
        latestOccupancyPct < HIGH_OCCUPANCY_THRESHOLD ||
        typeof currentTotalCapacity !== "number" ||
        !Number.isFinite(currentTotalCapacity) ||
        currentTotalCapacity <= 0
      ) {
        return [];
      }

      const stableKey = `clubChronicle:${team.teamId}:arena-occupancy-gte90:v1:${arenaId}`;
      const episodeKey = `${stableKey}:capacity:${currentTotalCapacity}`;
      const soldTotal = snapshot.latestOccupancySoldTotal;
      const hasSoldTotal =
        typeof soldTotal === "number" &&
        Number.isFinite(soldTotal) &&
        soldTotal >= 0;
      const body = hasSoldTotal
        ? context.messages.reminderClubChronicleArenaOccupancyBodyWithSoldTotal
            .replace("{{occupancyPct}}", String(latestOccupancyPct))
            .replace("{{soldTotal}}", formatNumber(soldTotal))
            .replace("{{capacity}}", formatNumber(currentTotalCapacity))
        : context.messages.reminderClubChronicleArenaOccupancyBody.replace(
            "{{occupancyPct}}",
            String(latestOccupancyPct)
          );
      const url = hattrickStadiumUrl(arenaId);
      return [
        {
          stableKey,
          episodeKey,
          triggerKey: episodeKey,
          ruleId: "clubChronicle.ownArena.occupancy.gte90",
          ruleVersion: 1,
          scope: "clubChronicle",
          teamId: team.teamId,
          entityType: "arena",
          entityId: String(arenaId),
          severity: "info",
          title: context.messages.reminderClubChronicleArenaOccupancyTitle,
          body,
          payload: {
            scope: "clubChronicle",
            teamId: team.teamId,
            teamName: team.teamName ?? null,
            arenaId,
            arenaName: snapshot.arenaName ?? team.arenaName ?? null,
            currentTotalCapacity,
            latestOccupancyPct,
            latestOccupancySoldTotal: hasSoldTotal ? soldTotal : null,
            latestOccupancyMatchId: snapshot.latestOccupancyMatchId ?? null,
            latestOccupancyMatchDate: snapshot.latestOccupancyMatchDate ?? null,
            latestOccupancySourceSystem:
              snapshot.latestOccupancySourceSystem ?? null,
          },
          expiresAtFromFirstSeenMs: ARENA_OCCUPANCY_EXPIRY_MS,
          dismissalExpiryDurationMs: ARENA_OCCUPANCY_EXPIRY_MS,
          actions: [
            {
              type: "openExternalUrl",
              label: context.messages.reminderActionExpandArena,
              payload: {
                url,
                teamId: team.teamId,
                arenaId,
              },
            },
          ],
        },
      ];
    });
  },
};
