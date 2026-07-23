import { normalizeMatchRoleId } from "@/lib/positions";
import {
  getTrainingPositionWeight,
  roleIdToSeniorPositionGroup,
  type SeniorPositionGroup,
} from "./trainingPositions";
import type { SeniorTrainableMainSkill } from "./types";

export type MatchLineupPlayerLike = {
  PlayerID?: unknown;
  RoleID?: unknown;
};

export type MatchOrderLike = {
  OrderType?: unknown;
  SubjectPlayerID?: unknown;
  ObjectPlayerID?: unknown;
  MatchMinute?: unknown;
  NewPositionId?: unknown;
  NewPositionID?: unknown;
};

export type PlayerPositionSegment = {
  playerId: number;
  startsAtMinute: number;
  endsAtMinute: number;
  roleId: number | null;
  positionGroup: SeniorPositionGroup;
};

type ActivePlayerPosition = {
  playerId: number;
  roleId: number;
  startsAtMinute: number;
};

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parseRoleId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return normalizeMatchRoleId(Math.floor(parsed));
}

function parseMinute(value: unknown, totalMatchMinutes: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return totalMatchMinutes;
  return Math.min(totalMatchMinutes, Math.max(0, Math.floor(parsed)));
}

function closeActiveSegment(
  segments: PlayerPositionSegment[],
  active: Map<number, ActivePlayerPosition>,
  playerId: number,
  minute: number
) {
  const current = active.get(playerId);
  if (!current) return null;
  if (minute > current.startsAtMinute) {
    segments.push({
      playerId,
      startsAtMinute: current.startsAtMinute,
      endsAtMinute: minute,
      roleId: current.roleId,
      positionGroup: roleIdToSeniorPositionGroup(current.roleId),
    });
  }
  active.delete(playerId);
  return current;
}

export function reconstructPlayerPositionSegments(input: {
  startingLineup: MatchLineupPlayerLike[];
  orders: MatchOrderLike[];
  totalMatchMinutes: number;
}): PlayerPositionSegment[] {
  const totalMatchMinutes = Math.max(0, Math.floor(input.totalMatchMinutes));
  const active = new Map<number, ActivePlayerPosition>();
  const segments: PlayerPositionSegment[] = [];

  for (const player of input.startingLineup) {
    const playerId = parsePositiveInteger(player.PlayerID);
    const roleId = parseRoleId(player.RoleID);
    if (playerId === null || roleId === null) continue;
    if (!active.has(playerId)) {
      active.set(playerId, { playerId, roleId, startsAtMinute: 0 });
    }
  }

  input.orders
    .map((order, sourceIndex) => ({
      orderType: Number(order.OrderType),
      subjectPlayerId: parsePositiveInteger(order.SubjectPlayerID),
      objectPlayerId: parsePositiveInteger(order.ObjectPlayerID),
      minute: parseMinute(order.MatchMinute, totalMatchMinutes),
      newRoleId: parseRoleId(order.NewPositionID ?? order.NewPositionId),
      sourceIndex,
    }))
    .filter(
      (order) =>
        (order.orderType === 1 || order.orderType === 3) &&
        order.subjectPlayerId !== null
    )
    .sort((left, right) => left.minute - right.minute || left.sourceIndex - right.sourceIndex)
    .forEach((order) => {
      const subjectPlayerId = order.subjectPlayerId;
      if (subjectPlayerId === null) return;
      if (order.orderType === 3) {
        const objectPlayerId = order.objectPlayerId;
        if (objectPlayerId === null) return;
        const subject = closeActiveSegment(
          segments,
          active,
          subjectPlayerId,
          order.minute
        );
        const object = closeActiveSegment(
          segments,
          active,
          objectPlayerId,
          order.minute
        );
        if (subject) {
          active.set(subject.playerId, {
            ...subject,
            roleId: object?.roleId ?? subject.roleId,
            startsAtMinute: order.minute,
          });
        }
        if (object) {
          active.set(object.playerId, {
            ...object,
            roleId: subject?.roleId ?? object.roleId,
            startsAtMinute: order.minute,
          });
        }
        return;
      }

      const subject = closeActiveSegment(
        segments,
        active,
        subjectPlayerId,
        order.minute
      );
      const targetRoleId = order.newRoleId ?? subject?.roleId ?? null;
      if (order.objectPlayerId !== null && order.objectPlayerId !== subjectPlayerId) {
        if (targetRoleId !== null) {
          active.set(order.objectPlayerId, {
            playerId: order.objectPlayerId,
            roleId: targetRoleId,
            startsAtMinute: order.minute,
          });
        }
        return;
      }
      if (targetRoleId !== null) {
        active.set(subjectPlayerId, {
          playerId: subjectPlayerId,
          roleId: targetRoleId,
          startsAtMinute: order.minute,
        });
      }
    });

  active.forEach((current, playerId) => {
    closeActiveSegment(segments, active, playerId, totalMatchMinutes);
  });

  return segments.sort(
    (left, right) =>
      left.startsAtMinute - right.startsAtMinute ||
      left.endsAtMinute - right.endsAtMinute ||
      left.playerId - right.playerId
  );
}

export function calculateWeightedTrainingMinutesForPlayer(input: {
  segments: PlayerPositionSegment[];
  playerId: number;
  mainSkill: SeniorTrainableMainSkill;
}) {
  return input.segments
    .filter((segment) => segment.playerId === input.playerId)
    .reduce((sum, segment) => {
      const minutes = Math.max(0, segment.endsAtMinute - segment.startsAtMinute);
      return (
        sum +
        minutes *
          getTrainingPositionWeight(input.mainSkill, segment.positionGroup)
      );
    }, 0);
}
