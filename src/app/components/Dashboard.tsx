"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../page.module.css";
import YouthPlayerList from "./YouthPlayerList";
import PlayerDetailsPanel, {
  YouthPlayerDetails,
} from "./PlayerDetailsPanel";
import LineupField, { LineupAssignments } from "./LineupField";
import UpcomingMatches from "./UpcomingMatches";
import { Messages } from "@/lib/i18n";
import RatingsMatrix, { RatingsMatrixResponse } from "./RatingsMatrix";
import {
  getAutoSelection,
  getTrainingSlots,
  optimizeLineupForStar,
  type OptimizerPlayer,
  type OptimizerDebug,
} from "@/lib/optimizer";
import { useNotifications } from "./notifications/NotificationsProvider";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
  Age?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  PlayerSkills?: Record<string, unknown>;
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
  const [starPlayerId, setStarPlayerId] = useState<number | null>(null);
  const [primaryTraining, setPrimaryTraining] = useState<string>("");
  const [secondaryTraining, setSecondaryTraining] = useState<string>("");
  const [optimizerDebug, setOptimizerDebug] = useState<OptimizerDebug | null>(
    null
  );
  const [showOptimizerDebug, setShowOptimizerDebug] = useState(false);
  const [autoSelectionApplied, setAutoSelectionApplied] = useState(false);
  const { addNotification } = useNotifications();
  const isDev = process.env.NODE_ENV !== "production";

  const playersById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    players.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [players]);

  const playerDetailsById = useMemo(() => {
    const map = new Map<number, YouthPlayerDetails>();
    Object.entries(cache).forEach(([id, entry]) => {
      const resolved = resolveDetails(entry.data);
      if (resolved) {
        map.set(Number(id), resolved);
      }
    });
    return map;
  }, [cache]);

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

  const ensureDetails = async (playerId: number) => {
    const cached = cache[playerId];
    const isFresh =
      cached && Date.now() - cached.fetchedAt < DETAILS_TTL_MS;
    if (cached && isFresh) return;

    try {
      const response = await fetch(
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}&showLastMatch=true`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as PlayerDetailsResponse;
      if (!response.ok || payload.error) {
        return;
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
    } catch {
      // ignore hover failures
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
    if (!players.length) return;
    const outfieldSlots = [
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
    const shuffledIds = [...ids].sort(() => Math.random() - 0.5);
    const keeperId = shuffledIds.shift() ?? null;
    const outfieldIds = shuffledIds.slice(0, 10);
    const shuffledSlots = [...outfieldSlots].sort(() => Math.random() - 0.5);

    const next: LineupAssignments = {
      KP: keeperId,
    };
    shuffledSlots.slice(0, outfieldIds.length).forEach((slot, index) => {
      next[slot] = outfieldIds[index] ?? null;
    });
    setAssignments(next);
    setLoadedMatchId(null);
    addNotification(messages.notificationLineupRandomized);
  };

  const resetLineup = () => {
    setAssignments({});
    setLoadedMatchId(null);
    addNotification(messages.notificationLineupReset);
  };

  const handleOptimize = () => {
    if (!starPlayerId || !primaryTraining || !secondaryTraining) {
      return;
    }

    const optimizerPlayers: OptimizerPlayer[] = players.map((player) => ({
      id: player.YouthPlayerID,
      name: [player.FirstName, player.NickName || null, player.LastName]
        .filter(Boolean)
        .join(" "),
      age:
        player.Age ??
        playerDetailsById.get(player.YouthPlayerID)?.Age ??
        null,
      skills:
        playerDetailsById.get(player.YouthPlayerID)?.PlayerSkills ??
        (player.PlayerSkills as OptimizerPlayer["skills"]) ??
        null,
    }));

    const result = optimizeLineupForStar(
      optimizerPlayers,
      starPlayerId,
      primaryTraining as "keeper" | "defending" | "playmaking" | "winger" | "passing" | "scoring" | "setpieces",
      secondaryTraining as "keeper" | "defending" | "playmaking" | "winger" | "passing" | "scoring" | "setpieces",
      autoSelectionApplied
    );
    setAssignments(result.lineup);
    setOptimizerDebug(result.debug ?? null);
    setLoadedMatchId(null);
    if (Object.keys(result.lineup).length) {
      addNotification(messages.notificationOptimizeApplied);
    }
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

  const optimizerPlayers = useMemo<OptimizerPlayer[]>(
    () =>
      players.map((player) => ({
        id: player.YouthPlayerID,
        name: [player.FirstName, player.NickName || null, player.LastName]
          .filter(Boolean)
          .join(" "),
        age:
          player.Age ??
          playerDetailsById.get(player.YouthPlayerID)?.Age ??
          null,
        skills:
          playerDetailsById.get(player.YouthPlayerID)?.PlayerSkills ??
          (player.PlayerSkills as OptimizerPlayer["skills"]) ??
          null,
      })),
    [players, playerDetailsById]
  );

  const autoSelection = useMemo(
    () => getAutoSelection(optimizerPlayers),
    [optimizerPlayers]
  );

  useEffect(() => {
    if (starPlayerId || primaryTraining || secondaryTraining) return;
    if (!autoSelection) return;
    setStarPlayerId(autoSelection.starPlayerId);
    setPrimaryTraining(autoSelection.primarySkill);
    setSecondaryTraining(autoSelection.secondarySkill ?? "");
    setAutoSelectionApplied(true);
    const playerName =
      optimizerPlayers.find(
        (player) => player.id === autoSelection.starPlayerId
      )?.name ?? autoSelection.starPlayerId;
    const primaryLabel = trainingLabel(autoSelection.primarySkill);
    const secondaryLabel = trainingLabel(autoSelection.secondarySkill);
    addNotification(
      `${messages.notificationAutoSelection} ${playerName} · ${primaryLabel} / ${secondaryLabel}`
    );
  }, [
    addNotification,
    autoSelection,
    messages.notificationAutoSelection,
    optimizerPlayers,
    primaryTraining,
    secondaryTraining,
    starPlayerId,
  ]);

  useEffect(() => {
    if (!isDev) return;
    if (!starPlayerId || !primaryTraining || !secondaryTraining) {
      setOptimizerDebug(null);
      return;
    }
    const result = optimizeLineupForStar(
      optimizerPlayers,
      starPlayerId,
      primaryTraining,
      secondaryTraining,
      autoSelectionApplied
    );
    setOptimizerDebug(result.debug ?? null);
  }, [
    autoSelectionApplied,
    isDev,
    optimizerPlayers,
    primaryTraining,
    secondaryTraining,
    starPlayerId,
  ]);

  const manualReady = Boolean(starPlayerId && primaryTraining && secondaryTraining);

  const optimizeDisabledReason = !starPlayerId
    ? messages.optimizeLineupNeedsStar
    : !primaryTraining || !secondaryTraining
    ? messages.optimizeLineupNeedsTraining
    : messages.optimizeLineupTitle;

  const optimizerCategoryLabel = (category: OptimizerDebug["primary"]["list"][number]["category"]) => {
    switch (category) {
      case "cat1":
        return messages.optimizerCat1;
      case "cat2":
        return messages.optimizerCat2;
      case "cat3":
        return messages.optimizerCat3;
      case "cat4":
        return messages.optimizerCat4;
      case "dontCare":
      default:
        return messages.optimizerCatDontCare;
    }
  };

  const trainingLabel = (skill: string | null) => {
    switch (skill) {
      case "keeper":
        return messages.trainingKeeper;
      case "defending":
        return messages.trainingDefending;
      case "playmaking":
        return messages.trainingPlaymaking;
      case "winger":
        return messages.trainingWinger;
      case "passing":
        return messages.trainingPassing;
      case "scoring":
        return messages.trainingScoring;
      case "setpieces":
        return messages.trainingSetPieces;
      default:
        return messages.unknownShort;
    }
  };

  const trainingSlots = useMemo(() => {
    if (!primaryTraining || !secondaryTraining) {
      return {
        primary: new Set<string>(),
        secondary: new Set<string>(),
        all: new Set<string>(),
      };
    }
    const slots = getTrainingSlots(
      primaryTraining as
        | "keeper"
        | "defending"
        | "playmaking"
        | "winger"
        | "passing"
        | "scoring"
        | "setpieces",
      secondaryTraining as
        | "keeper"
        | "defending"
        | "playmaking"
        | "winger"
        | "passing"
        | "scoring"
        | "setpieces"
    );
    return {
      primary: slots.primarySlots,
      secondary: slots.secondarySlots,
      all: slots.allSlots,
    };
  }, [primaryTraining, secondaryTraining]);

  return (
    <div className={styles.dashboardGrid}>
      <YouthPlayerList
        players={players}
        assignedIds={assignedIds}
        selectedId={selectedId}
        starPlayerId={starPlayerId}
        onToggleStar={(playerId) => {
          setStarPlayerId((prev) => (prev === playerId ? null : playerId));
          setAutoSelectionApplied(false);
        }}
        onSelect={handleSelect}
        onAutoSelect={() => {
          if (!autoSelection) return;
          setStarPlayerId(autoSelection.starPlayerId);
          setPrimaryTraining(autoSelection.primarySkill);
          setSecondaryTraining(autoSelection.secondarySkill ?? "");
          setAutoSelectionApplied(true);
          const playerName =
            optimizerPlayers.find(
              (player) => player.id === autoSelection.starPlayerId
            )?.name ?? autoSelection.starPlayerId;
          const primaryLabel = trainingLabel(autoSelection.primarySkill);
          const secondaryLabel = trainingLabel(autoSelection.secondarySkill);
          addNotification(
            `${messages.notificationAutoSelection} ${playerName} · ${primaryLabel} / ${secondaryLabel}`
          );
        }}
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
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>{messages.trainingTitle}</h2>
          <div className={styles.trainingControls}>
            <label className={styles.trainingRow}>
              <span className={styles.trainingLabel}>
                {messages.primaryTrainingLabel}
              </span>
              <select
                className={styles.trainingSelect}
                value={primaryTraining}
                onChange={(event) => {
                  const value = event.target.value;
                  setPrimaryTraining(value);
                  setAutoSelectionApplied(false);
                  if (value) {
                    addNotification(
                      `${messages.notificationPrimaryTrainingSet} ${trainingLabel(
                        value
                      )}`
                    );
                  } else {
                    addNotification(
                      `${messages.notificationTrainingCleared} ${messages.primaryTrainingLabel}`
                    );
                  }
                }}
              >
                <option value="">{messages.trainingUnset}</option>
                <option value="keeper">{messages.trainingKeeper}</option>
                <option value="defending">{messages.trainingDefending}</option>
                <option value="playmaking">{messages.trainingPlaymaking}</option>
                <option value="winger">{messages.trainingWinger}</option>
                <option value="passing">{messages.trainingPassing}</option>
                <option value="scoring">{messages.trainingScoring}</option>
                <option value="setpieces">{messages.trainingSetPieces}</option>
              </select>
            </label>
            <label className={styles.trainingRow}>
              <span className={styles.trainingLabel}>
                {messages.secondaryTrainingLabel}
              </span>
              <select
                className={styles.trainingSelect}
                value={secondaryTraining}
                onChange={(event) => {
                  const value = event.target.value;
                  setSecondaryTraining(value);
                  setAutoSelectionApplied(false);
                  if (value) {
                    addNotification(
                      `${messages.notificationSecondaryTrainingSet} ${trainingLabel(
                        value
                      )}`
                    );
                  } else {
                    addNotification(
                      `${messages.notificationTrainingCleared} ${messages.secondaryTrainingLabel}`
                    );
                  }
                }}
              >
                <option value="">{messages.trainingUnset}</option>
                <option value="keeper">{messages.trainingKeeper}</option>
                <option value="defending">{messages.trainingDefending}</option>
                <option value="playmaking">{messages.trainingPlaymaking}</option>
                <option value="winger">{messages.trainingWinger}</option>
                <option value="passing">{messages.trainingPassing}</option>
                <option value="scoring">{messages.trainingScoring}</option>
                <option value="setpieces">{messages.trainingSetPieces}</option>
              </select>
            </label>
          </div>
        </div>
        <LineupField
          assignments={assignments}
          playersById={playersById}
          playerDetailsById={playerDetailsById}
          onAssign={assignPlayer}
          onClear={clearSlot}
          onMove={moveSlot}
          onRandomize={randomizeLineup}
          onReset={resetLineup}
          onOptimize={handleOptimize}
          optimizeDisabled={!manualReady}
          optimizeDisabledReason={optimizeDisabledReason}
          trainedSlots={trainingSlots}
          onHoverPlayer={ensureDetails}
          messages={messages}
        />
        {isDev ? (
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>{messages.optimizerDebugTitle}</h2>
            <button
              type="button"
              className={styles.optimizerOpen}
              onClick={() => setShowOptimizerDebug(true)}
              disabled={!optimizerDebug}
              title={
                optimizerDebug
                  ? messages.optimizerDebugOpen
                  : messages.optimizerDebugUnavailable
              }
              aria-label={
                optimizerDebug
                  ? messages.optimizerDebugOpen
                  : messages.optimizerDebugUnavailable
              }
            >
              {messages.optimizerDebugOpen}
            </button>
          </div>
        ) : null}
        {isDev && optimizerDebug && showOptimizerDebug ? (
          <div
            className={styles.optimizerOverlay}
            role="dialog"
            aria-modal="true"
            aria-label={messages.optimizerDebugTitle}
          >
            <div className={styles.optimizerModal}>
              <div className={styles.optimizerModalHeader}>
                <h3 className={styles.optimizerModalTitle}>
                  {messages.optimizerDebugTitle}
                </h3>
                <button
                  type="button"
                  className={styles.optimizerClose}
                  onClick={() => setShowOptimizerDebug(false)}
                >
                  {messages.closeLabel}
                </button>
              </div>
              <div className={styles.optimizerModalBody}>
                <div className={styles.optimizerSection}>
                  <h4 className={styles.optimizerHeading}>
                    {messages.optimizerSelectionLabel}
                  </h4>
                  <table className={styles.optimizerTable}>
                    <tbody>
                      <tr>
                        <th>{messages.optimizerSelectionStar}</th>
                        <td>
                          {optimizerDebug.primary.list.find(
                            (entry) =>
                              entry.playerId === optimizerDebug.selection.starPlayerId
                          )?.name ?? optimizerDebug.selection.starPlayerId}
                        </td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSelectionPrimary}</th>
                        <td>{trainingLabel(optimizerDebug.selection.primarySkill)}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSelectionSecondary}</th>
                        <td>
                          {trainingLabel(optimizerDebug.selection.secondarySkill)}
                        </td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSelectionAuto}</th>
                        <td>
                          {optimizerDebug.selection.autoSelected
                            ? messages.yesLabel
                            : messages.noLabel}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {optimizerDebug.starSelectionRanks ? (
                  <div className={styles.optimizerSection}>
                    <h4 className={styles.optimizerHeading}>
                      {messages.optimizerStarRanksLabel}
                    </h4>
                    <table className={styles.optimizerTable}>
                      <thead>
                        <tr>
                          <th>{messages.optimizerColumnPlayer}</th>
                          <th>{messages.optimizerColumnCategory}</th>
                          <th>{messages.optimizerColumnValue}</th>
                          <th>{messages.optimizerColumnRank}</th>
                          <th>{messages.optimizerColumnAge}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...optimizerDebug.starSelectionRanks]
                          .sort((a, b) => {
                            if (b.score !== a.score) return b.score - a.score;
                            if (a.age === null || a.age === undefined) return 1;
                            if (b.age === null || b.age === undefined) return -1;
                            return a.age - b.age;
                          })
                          .map((entry) => (
                            <tr key={`${entry.playerId}-${entry.skill}`}>
                              <td>{entry.name ?? entry.playerId}</td>
                              <td>{trainingLabel(entry.skill)}</td>
                              <td>
                                {(entry.current ?? messages.unknownShort).toString()}/
                                {(entry.max ?? messages.unknownShort).toString()}
                              </td>
                              <td>{entry.score}</td>
                              <td>{entry.age ?? messages.unknownShort}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className={styles.optimizerSection}>
                  <h4 className={styles.optimizerHeading}>
                    {messages.optimizerPrimaryLabel}
                  </h4>
                  <table className={styles.optimizerTable}>
                    <thead>
                      <tr>
                        <th>{messages.optimizerColumnPlayer}</th>
                        <th>{messages.optimizerColumnCategory}</th>
                        <th>{messages.optimizerColumnCurrent}</th>
                        <th>{messages.optimizerColumnMax}</th>
                        <th>{messages.optimizerColumnRank}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optimizerDebug.primary.list.map((entry) => (
                        <tr key={entry.playerId}>
                          <td>{entry.name ?? entry.playerId}</td>
                          <td>{optimizerCategoryLabel(entry.category)}</td>
                          <td>{entry.current ?? messages.unknownShort}</td>
                          <td>{entry.max ?? messages.unknownShort}</td>
                          <td>{entry.rankValue ?? messages.unknownShort}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {optimizerDebug.secondary ? (
                  <div className={styles.optimizerSection}>
                    <h4 className={styles.optimizerHeading}>
                      {messages.optimizerSecondaryLabel}
                    </h4>
                    <table className={styles.optimizerTable}>
                      <thead>
                        <tr>
                          <th>{messages.optimizerColumnPlayer}</th>
                          <th>{messages.optimizerColumnCategory}</th>
                          <th>{messages.optimizerColumnCurrent}</th>
                          <th>{messages.optimizerColumnMax}</th>
                          <th>{messages.optimizerColumnRank}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizerDebug.secondary.list.map((entry) => (
                          <tr key={entry.playerId}>
                            <td>{entry.name ?? entry.playerId}</td>
                            <td>{optimizerCategoryLabel(entry.category)}</td>
                            <td>{entry.current ?? messages.unknownShort}</td>
                            <td>{entry.max ?? messages.unknownShort}</td>
                            <td>{entry.rankValue ?? messages.unknownShort}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className={styles.optimizerSection}>
                  <h4 className={styles.optimizerHeading}>
                    {messages.optimizerSlotsLabel}
                  </h4>
                  <table className={styles.optimizerTable}>
                    <tbody>
                      <tr>
                        <th>{messages.optimizerSlotsPrimary}</th>
                        <td>{optimizerDebug.trainingSlots.primary.join(", ")}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSlotsSecondary}</th>
                        <td>{optimizerDebug.trainingSlots.secondary.join(", ")}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSlotsAll}</th>
                        <td>{optimizerDebug.trainingSlots.all.join(", ")}</td>
                      </tr>
                      <tr>
                        <th>{messages.optimizerSlotsStar}</th>
                        <td>{optimizerDebug.trainingSlots.starSlot}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
