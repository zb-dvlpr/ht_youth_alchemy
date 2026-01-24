"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";
import YouthPlayerList from "./YouthPlayerList";
import PlayerDetailsPanel, {
  YouthPlayerDetails,
} from "./PlayerDetailsPanel";
import LineupField, { LineupAssignments } from "./LineupField";
import UpcomingMatches from "./UpcomingMatches";
import { Messages } from "@/lib/i18n";
import RatingsMatrix, { RatingsMatrixResponse } from "./RatingsMatrix";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
};

type PlayerDetailsResponse = {
  data?: Record<string, unknown>;
  error?: string;
  details?: string;
};

type MatchesResponse = {
  data?: {
    HattrickData?: {
      MatchList?: {
        Match?: unknown;
      };
      Team?: {
        MatchList?: {
          Match?: unknown;
        };
      };
    };
  };
  error?: string;
  details?: string;
};

type DashboardProps = {
  players: YouthPlayer[];
  matchesResponse: MatchesResponse;
  ratingsResponse: RatingsMatrixResponse | null;
  messages: Messages;
};

type CachedDetails = {
  data: Record<string, unknown>;
  fetchedAt: number;
};

const DETAILS_TTL_MS = 5 * 60 * 1000;

function resolveDetails(data: Record<string, unknown> | null) {
  if (!data) return null;
  const hattrickData = data.HattrickData as Record<string, unknown> | undefined;
  if (!hattrickData) return null;
  return (hattrickData.YouthPlayer as YouthPlayerDetails) ?? null;
}

export default function Dashboard({
  players,
  matchesResponse,
  ratingsResponse,
  messages,
}: DashboardProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [cache, setCache] = useState<Record<number, CachedDetails>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<LineupAssignments>({});
  const [matchesState, setMatchesState] =
    useState<MatchesResponse>(matchesResponse);
  const [loadedMatchId, setLoadedMatchId] = useState<number | null>(null);

  const playersById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    players.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [players]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as number[]),
    [assignments]
  );

  const selectedPlayer = useMemo(
    () => players.find((player) => player.YouthPlayerID === selectedId) ?? null,
    [players, selectedId]
  );

  const loadDetails = async (playerId: number, forceRefresh = false) => {
    const cached = cache[playerId];
    const isFresh =
      cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS;

    if (!forceRefresh && cached && isFresh) {
      setDetails(cached.data);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setDetails(null);

    try {
      const response = await fetch(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PlayerDetailsResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to fetch player details");
      }

      const resolved = payload.data ?? null;
      if (resolved) {
        setCache((prev) => ({
          ...prev,
          [playerId]: {
            data: resolved,
            fetchedAt: Date.now(),
          },
        }));
      }
      setDetails(resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (playerId: number) => {
    setSelectedId(playerId);
    await loadDetails(playerId);
  };

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
    setLoadedMatchId(null);
  };

  const clearSlot = (slotId: string) => {
    setAssignments((prev) => ({ ...prev, [slotId]: null }));
    setLoadedMatchId(null);
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
    setLoadedMatchId(null);
  };

  const randomizeLineup = () => {
    const slots = [
      "KP",
      "WB_R",
      "CD_R",
      "CD_C",
      "CD_L",
      "WB_L",
      "W_R",
      "IM_R",
      "IM_C",
      "IM_L",
      "W_L",
      "F_R",
      "F_C",
      "F_L",
    ];
    const ids = players.map((player) => player.YouthPlayerID);
    const shuffled = [...ids].sort(() => Math.random() - 0.5).slice(0, 11);
    const next: LineupAssignments = {};
    slots.forEach((slot, index) => {
      next[slot] = shuffled[index] ?? null;
    });
    setAssignments(next);
    setLoadedMatchId(null);
  };

  const refreshMatches = async () => {
    try {
      const response = await fetch("/api/chpp/matches?isYouth=true", {
        cache: "no-store",
      });
      const payload = (await response.json()) as MatchesResponse;
      setMatchesState(payload);
    } catch {
      // keep existing data
    }
  };

  const loadLineup = (nextAssignments: LineupAssignments, matchId: number) => {
    setAssignments(nextAssignments);
    setLoadedMatchId(matchId);
  };

  const detailsData = resolveDetails(details);
  const lastUpdated = selectedId ? cache[selectedId]?.fetchedAt ?? null : null;

  return (
    <div className={styles.dashboardGrid}>
      <YouthPlayerList
        players={players}
        assignedIds={assignedIds}
        selectedId={selectedId}
        onSelect={handleSelect}
        messages={messages}
      />
      <div className={styles.columnStack}>
        <PlayerDetailsPanel
          selectedPlayer={selectedPlayer}
          detailsData={detailsData}
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          onRefresh={() =>
            selectedId ? loadDetails(selectedId, true) : undefined
          }
          messages={messages}
        />
        <RatingsMatrix response={ratingsResponse} messages={messages} />
      </div>
      <div className={styles.columnStack}>
        <LineupField
          assignments={assignments}
          playersById={playersById}
          onAssign={assignPlayer}
          onClear={clearSlot}
          onMove={moveSlot}
          onRandomize={randomizeLineup}
          messages={messages}
        />
        <UpcomingMatches
          response={matchesState}
          messages={messages}
          assignments={assignments}
          onRefresh={refreshMatches}
          onLoadLineup={loadLineup}
          loadedMatchId={loadedMatchId}
        />
      </div>
    </div>
  );
}
