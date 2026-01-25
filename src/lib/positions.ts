import type { Messages } from "@/lib/i18n";

export type PositionKey = "KP" | "WB" | "CD" | "W" | "IM" | "F";
export type SlotId =
  | "KP"
  | "WB_L"
  | "WB_R"
  | "CD_L"
  | "CD_C"
  | "CD_R"
  | "W_L"
  | "W_R"
  | "IM_L"
  | "IM_C"
  | "IM_R"
  | "F_L"
  | "F_C"
  | "F_R";

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

export function positionLabelFull(code: number, messages: Messages): string {
  switch (code) {
    case 100:
      return messages.posKeeperFull;
    case 101:
      return messages.posBackFull;
    case 103:
      return messages.posCentralDefenderFull;
    case 106:
      return messages.posWingerFull;
    case 107:
      return messages.posInnerMidfieldFull;
    case 111:
      return messages.posForwardFull;
    default:
      return `#${code}`;
  }
}

export function positionLabelFullByRoleId(
  roleId: number | null | undefined,
  messages: Messages
) {
  const normalized = normalizeMatchRoleId(roleId);
  if (!normalized) return null;
  return positionLabelFull(normalized, messages);
}

export function roleIdToSlotId(roleId: number | null | undefined): SlotId | null {
  switch (roleId) {
    case 100:
      return "KP";
    case 101:
      return "WB_R";
    case 105:
      return "WB_L";
    case 102:
      return "CD_R";
    case 103:
      return "CD_C";
    case 104:
      return "CD_L";
    case 106:
      return "W_R";
    case 110:
      return "W_L";
    case 107:
      return "IM_R";
    case 108:
      return "IM_C";
    case 109:
      return "IM_L";
    case 111:
      return "F_R";
    case 112:
      return "F_C";
    case 113:
      return "F_L";
    default:
      return null;
  }
}
