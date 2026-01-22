"use client";

import { useMemo, useState } from "react";
import LineupField, { LineupAssignments } from "./LineupField";
import YouthPlayerList from "./YouthPlayerList";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
};

type LineupBoardProps = {
  players: YouthPlayer[];
};

export default function LineupBoard({ players }: LineupBoardProps) {
  const [assignments, setAssignments] = useState<LineupAssignments>({});

  const playersById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    players.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [players]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as number[]),
    [assignments]
  );

  const assignPlayer = (slotId: string, playerId: number) => {
    setAssignments((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(next)) {
        if (value === playerId) {
          next[key] = null;
        }
      }
      next[slotId] = playerId;
      return next;
    });
  };

  const clearSlot = (slotId: string) => {
    setAssignments((prev) => ({ ...prev, [slotId]: null }));
  };

  const moveSlot = (fromSlot: string, toSlot: string) => {
    if (fromSlot === toSlot) return;
    setAssignments((prev) => {
      const next = { ...prev };
      const movingPlayer = next[fromSlot];
      if (!movingPlayer) return prev;
      const targetPlayer = next[toSlot] ?? null;
      next[toSlot] = movingPlayer;
      next[fromSlot] = targetPlayer;
      return next;
    });
  };

  return (
    <div style={{ display: "contents" }}>
      <YouthPlayerList players={players} assignedIds={assignedIds} />
      <LineupField
        assignments={assignments}
        playersById={playersById}
        onAssign={assignPlayer}
        onClear={clearSlot}
        onMove={moveSlot}
      />
    </div>
  );
}
