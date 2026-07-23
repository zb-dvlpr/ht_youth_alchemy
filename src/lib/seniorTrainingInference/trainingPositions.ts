import { matchRoleIdToPositionKey } from "@/lib/positions";
import type { SeniorTrainableMainSkill } from "./types";

export type SeniorPositionGroup =
  | "goalkeeper"
  | "wingback"
  | "centralDefender"
  | "winger"
  | "innerMidfielder"
  | "forward"
  | "other";

export const TRAINING_INFERENCE_MATCH_TYPE_IDS = new Set([
  1, 2, 3, 4, 5, 8, 9,
]);

export function roleIdToSeniorPositionGroup(
  roleId: number | null | undefined
): SeniorPositionGroup {
  switch (matchRoleIdToPositionKey(roleId)) {
    case "KP":
      return "goalkeeper";
    case "WB":
      return "wingback";
    case "CD":
      return "centralDefender";
    case "W":
      return "winger";
    case "IM":
      return "innerMidfielder";
    case "F":
      return "forward";
    default:
      return "other";
  }
}

export function getTrainingPositionWeight(
  mainSkill: SeniorTrainableMainSkill,
  position: SeniorPositionGroup
): 0 | 0.5 | 1 {
  switch (mainSkill) {
    case "keeper":
      return position === "goalkeeper" ? 1 : 0;
    case "defending":
      return position === "wingback" || position === "centralDefender" ? 1 : 0;
    case "winger":
      if (position === "winger") return 1;
      return position === "wingback" ? 0.5 : 0;
    case "playmaking":
      if (position === "innerMidfielder") return 1;
      return position === "winger" ? 0.5 : 0;
    case "passing":
      return position === "winger" ||
        position === "innerMidfielder" ||
        position === "forward"
        ? 1
        : 0;
    case "scoring":
      return position === "forward" ? 1 : 0;
    case "setPieces":
      return position === "other" ? 0 : 1;
  }
}

