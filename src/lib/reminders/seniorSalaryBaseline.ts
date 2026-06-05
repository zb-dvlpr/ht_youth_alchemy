const SENIOR_SALARY_BASELINE_SCHEMA_VERSION = 1;
export const SENIOR_SALARY_BASELINE_STORAGE_KEY =
  "ya_senior_salary_baseline_v1";

const SIGNIFICANT_SALARY_INCREASE_SEK = 100_000;
const PENDING_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type SeniorSalaryBaselinePlayerInput = {
  playerId: number;
  salarySek: number | null | undefined;
  playerName?: string;
};

export type SeniorSalaryIncreaseEvent = {
  teamId: number;
  playerId: number;
  playerName: string;
  previousSalarySek: number;
  currentSalarySek: number;
  increaseSek: number;
  detectedAt: number;
};

type SeniorSalaryBaselinePlayerEntry = {
  salarySek: number;
  playerName?: string;
  updatedAt: number;
};

type SeniorSalaryBaselineState = {
  schemaVersion: 1;
  teams: Record<string, Record<string, SeniorSalaryBaselinePlayerEntry>>;
  pendingEvents: Record<string, SeniorSalaryIncreaseEvent>;
};

const emptySeniorSalaryBaselineState = (): SeniorSalaryBaselineState => ({
  schemaVersion: SENIOR_SALARY_BASELINE_SCHEMA_VERSION,
  teams: {},
  pendingEvents: {},
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isValidSalary = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const normalizeSalary = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  return null;
};

export const seniorSalaryIncreaseEpisodeKey = (
  teamId: number,
  playerId: number,
  previousSalarySek: number,
  currentSalarySek: number
) =>
  `senior:${teamId}:player-salary-increase:v1:${playerId}:${previousSalarySek}:${currentSalarySek}`;

const sanitizeSeniorSalaryIncreaseEvent = (
  value: unknown
): SeniorSalaryIncreaseEvent | null => {
  if (!isObject(value)) return null;
  const teamId = Number(value.teamId);
  const playerId = Number(value.playerId);
  const previousSalarySek = normalizeSalary(value.previousSalarySek);
  const currentSalarySek = normalizeSalary(value.currentSalarySek);
  const increaseSek =
    typeof value.increaseSek === "number" && Number.isFinite(value.increaseSek)
      ? Math.round(value.increaseSek)
      : previousSalarySek !== null && currentSalarySek !== null
        ? currentSalarySek - previousSalarySek
        : null;
  const detectedAt = Number(value.detectedAt);
  if (
    !Number.isFinite(teamId) ||
    !Number.isFinite(playerId) ||
    previousSalarySek === null ||
    currentSalarySek === null ||
    increaseSek === null ||
    !Number.isFinite(detectedAt)
  ) {
    return null;
  }
  return {
    teamId,
    playerId,
    playerName:
      typeof value.playerName === "string" && value.playerName.trim()
        ? value.playerName.trim()
        : String(playerId),
    previousSalarySek,
    currentSalarySek,
    increaseSek,
    detectedAt,
  };
};

const readSeniorSalaryBaselineState = (): SeniorSalaryBaselineState => {
  if (typeof window === "undefined") return emptySeniorSalaryBaselineState();
  try {
    const raw = window.localStorage.getItem(SENIOR_SALARY_BASELINE_STORAGE_KEY);
    if (!raw) return emptySeniorSalaryBaselineState();
    const parsed = JSON.parse(raw);
    if (
      !isObject(parsed) ||
      parsed.schemaVersion !== SENIOR_SALARY_BASELINE_SCHEMA_VERSION
    ) {
      return emptySeniorSalaryBaselineState();
    }
    const teams: SeniorSalaryBaselineState["teams"] = {};
    if (isObject(parsed.teams)) {
      Object.entries(parsed.teams).forEach(([teamId, teamValue]) => {
        if (!isObject(teamValue)) return;
        const players: Record<string, SeniorSalaryBaselinePlayerEntry> = {};
        Object.entries(teamValue).forEach(([playerId, playerValue]) => {
          if (!isObject(playerValue) || !isValidSalary(playerValue.salarySek)) {
            return;
          }
          const updatedAt = Number(playerValue.updatedAt);
          players[playerId] = {
            salarySek: Math.round(playerValue.salarySek),
            playerName:
              typeof playerValue.playerName === "string"
                ? playerValue.playerName
                : undefined,
            updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
          };
        });
        teams[teamId] = players;
      });
    }
    const pendingEvents: SeniorSalaryBaselineState["pendingEvents"] = {};
    if (isObject(parsed.pendingEvents)) {
      Object.entries(parsed.pendingEvents).forEach(([key, value]) => {
        const event = sanitizeSeniorSalaryIncreaseEvent(value);
        if (!event) return;
        const expectedKey = seniorSalaryIncreaseEpisodeKey(
          event.teamId,
          event.playerId,
          event.previousSalarySek,
          event.currentSalarySek
        );
        if (key === expectedKey) {
          pendingEvents[key] = event;
        }
      });
    }
    return { schemaVersion: SENIOR_SALARY_BASELINE_SCHEMA_VERSION, teams, pendingEvents };
  } catch {
    return emptySeniorSalaryBaselineState();
  }
};

const writeSeniorSalaryBaselineState = (state: SeniorSalaryBaselineState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SENIOR_SALARY_BASELINE_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Ignore baseline persistence failures; reminders should not block the app.
  }
};

export const updateSeniorSalaryBaseline = ({
  teamId,
  players,
  createReminderEvents,
  now = Date.now(),
}: {
  teamId: number | null | undefined;
  players: SeniorSalaryBaselinePlayerInput[];
  createReminderEvents: boolean;
  now?: number;
}): SeniorSalaryIncreaseEvent[] => {
  if (!teamId || !Number.isFinite(teamId)) return [];
  const state = readSeniorSalaryBaselineState();
  const teamKey = String(teamId);
  const previousTeam = state.teams[teamKey] ?? {};
  const nextTeam: Record<string, SeniorSalaryBaselinePlayerEntry> = {};
  const currentPlayerIds = new Set<string>();
  const nextPendingEvents = { ...state.pendingEvents };

  Object.entries(nextPendingEvents).forEach(([key, event]) => {
    if (
      now - event.detectedAt > PENDING_EVENT_RETENTION_MS ||
      (!createReminderEvents && event.teamId === teamId)
    ) {
      delete nextPendingEvents[key];
    }
  });

  players.forEach((player) => {
    if (!Number.isFinite(player.playerId)) return;
    const playerKey = String(player.playerId);
    currentPlayerIds.add(playerKey);
    const salarySek = normalizeSalary(player.salarySek);
    const previous = previousTeam[playerKey];
    if (salarySek === null) {
      if (previous) {
        nextTeam[playerKey] = previous;
      }
      return;
    }
    const playerName = player.playerName?.trim() || previous?.playerName || playerKey;
    if (previous && isValidSalary(previous.salarySek)) {
      const increaseSek = salarySek - previous.salarySek;
      if (createReminderEvents && increaseSek > SIGNIFICANT_SALARY_INCREASE_SEK) {
        Object.entries(nextPendingEvents).forEach(([key, event]) => {
          if (event.teamId === teamId && event.playerId === player.playerId) {
            delete nextPendingEvents[key];
          }
        });
        const event: SeniorSalaryIncreaseEvent = {
          teamId,
          playerId: player.playerId,
          playerName,
          previousSalarySek: previous.salarySek,
          currentSalarySek: salarySek,
          increaseSek,
          detectedAt: now,
        };
        nextPendingEvents[
          seniorSalaryIncreaseEpisodeKey(
            teamId,
            player.playerId,
            previous.salarySek,
            salarySek
          )
        ] = event;
      }
    }
    nextTeam[playerKey] = {
      salarySek,
      playerName,
      updatedAt: now,
    };
  });

  Object.keys(previousTeam).forEach((playerKey) => {
    if (!currentPlayerIds.has(playerKey)) {
      delete nextTeam[playerKey];
    }
  });

  const nextState: SeniorSalaryBaselineState = {
    ...state,
    teams: {
      ...state.teams,
      [teamKey]: nextTeam,
    },
    pendingEvents: nextPendingEvents,
  };
  writeSeniorSalaryBaselineState(nextState);

  return createReminderEvents
    ? Object.values(nextPendingEvents).filter((event) => event.teamId === teamId)
    : [];
};
