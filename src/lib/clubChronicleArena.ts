export type ArenaConstructionSnapshot = {
  expandedAvailable?: boolean | null;
};

export function isArenaUnderConstruction(
  snapshot: ArenaConstructionSnapshot | null | undefined
): boolean {
  return snapshot?.expandedAvailable === true;
}
