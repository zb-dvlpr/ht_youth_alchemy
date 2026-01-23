import type { Messages } from "@/lib/i18n";

export type PositionKey = "KP" | "WB" | "CD" | "W" | "IM" | "F";

export const POSITION_COLUMNS: number[] = [100, 101, 103, 106, 107, 111];

export function normalizeMatchRoleId(roleId: number | null | undefined): number | null {
  if (roleId === null || roleId === undefined) return null;
  if (roleId === 100) return 100;
  if (roleId === 101 || roleId === 105) return 101;
  if (roleId >= 102 && roleId <= 104) return 103;
  if (roleId === 106 || roleId === 110) return 106;
  if (roleId >= 107 && roleId <= 109) return 107;
  if (roleId >= 111 && roleId <= 113) return 111;
  return null;
}

export function matchRoleIdToPositionKey(roleId: number | null | undefined): PositionKey | null {
  const normalized = normalizeMatchRoleId(roleId);
  switch (normalized) {
    case 100:
      return "KP";
    case 101:
      return "WB";
    case 103:
      return "CD";
    case 106:
      return "W";
    case 107:
      return "IM";
    case 111:
      return "F";
    default:
      return null;
  }
}

export function positionLabel(code: number, messages: Messages): string {
  switch (code) {
    case 100:
      return messages.posKeeper;
    case 101:
      return messages.posBack;
    case 103:
      return messages.posCentralDefender;
    case 106:
      return messages.posWinger;
    case 107:
      return messages.posInnerMidfield;
    case 111:
      return messages.posForward;
    default:
      return `#${code}`;
  }
}
