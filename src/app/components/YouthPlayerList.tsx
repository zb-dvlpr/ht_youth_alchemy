"use client";

import { useMemo, useState } from "react";
import styles from "../page.module.css";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

type YouthPlayerDetails = {
  YouthPlayerID: number;
  FirstName: string;
  NickName?: string;
  LastName: string;
  Age?: number;
  AgeDays?: number;
  ArrivalDate?: string;
  CanBePromotedIn?: number;
  NativeCountryName?: string;
  Specialty?: number;
  OwningYouthTeam?: {
    YouthTeamName?: string;
    SeniorTeam?: {
      SeniorTeamName?: string;
    };
  };
  PlayerSkills?: Record<string, SkillValue>;
};

type PlayerDetailsResponse = {
  data?: Record<string, unknown>;
  error?: string;
  details?: string;
};

type YouthPlayerListProps = {
  players: YouthPlayer[];
  assignedIds?: Set<number>;
};

type CachedDetails = {
  data: Record<string, unknown>;
  fetchedAt: number;
};

const DETAILS_TTL_MS = 5 * 60 * 1000;
const MAX_SKILL_LEVEL = 8;

const SKILL_NAMES = [
  "non-existent",
  "disastrous",
  "wretched",
  "poor",
  "weak",
  "inadequate",
  "passable",
  "solid",
  "excellent",
  "formidable",
  "outstanding",
  "brilliant",
  "magnificent",
  "world class",
  "supernatural",
  "titanic",
  "extra-terrestrial",
  "mythical",
  "magical",
  "utopian",
  "divine",
];

const SPECIALTY_NAMES: Record<number, string> = {
  0: "None",
  1: "Technical",
  2: "Quick",
  3: "Powerful",
  4: "Unpredictable",
  5: "Head",
};

const SPECIALTY_EMOJI: Record<number, string> = {
  0: "—",
  1: "🛠️",
  2: "⚡",
  3: "💪",
  4: "🎲",
  5: "🎯",
};

const SKILL_ROWS = [
  { label: "Keeper", key: "KeeperSkill", maxKey: "KeeperSkillMax" },
  { label: "Defending", key: "DefenderSkill", maxKey: "DefenderSkillMax" },
  { label: "Playmaking", key: "PlaymakerSkill", maxKey: "PlaymakerSkillMax" },
  { label: "Winger", key: "WingerSkill", maxKey: "WingerSkillMax" },
  { label: "Passing", key: "PassingSkill", maxKey: "PassingSkillMax" },
  { label: "Scoring", key: "ScorerSkill", maxKey: "ScorerSkillMax" },
  { label: "Set Pieces", key: "SetPiecesSkill", maxKey: "SetPiecesSkillMax" },
];

function formatPlayerName(player?: YouthPlayer | null) {
  if (!player) return "";
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

function resolveDetails(
  data: Record<string, unknown> | null
): YouthPlayerDetails | null {
  if (!data) return null;
  const hattrickData = data.HattrickData as Record<string, unknown> | undefined;
  if (!hattrickData) return null;
  const youthPlayer = hattrickData.YouthPlayer as YouthPlayerDetails | undefined;
  return youthPlayer ?? null;
}

function getSkillLevel(skill?: SkillValue): number | null {
  if (!skill) return null;
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

function getSkillMax(skill?: SkillValue): number | null {
  if (!skill) return null;
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

function getSkillName(level: number | null) {
  if (level === null) return "unknown";
  return SKILL_NAMES[level] ?? `level ${level}`;
}

function formatArrival(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString();
}

function daysSince(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function YouthPlayerList({
  players,
  assignedIds,
}: YouthPlayerListProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [cache, setCache] = useState<Record<number, CachedDetails>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        `/api/chpp/youth/player-details?youthPlayerID=${playerId}`,
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

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    playerId: number
  ) => {
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "player", playerId })
    );
    event.dataTransfer.setData("text/plain", String(playerId));
    event.dataTransfer.effectAllowed = "move";
  };

  const detailsData = resolveDetails(details);
  const cachedDetails = selectedId ? cache[selectedId] : undefined;

  return (
    <div className={styles.card}>
      <h2 className={styles.sectionTitle}>Youth Player List</h2>
      {players.length === 0 ? (
        <p className={styles.muted}>No youth players returned.</p>
      ) : (
        <ul className={styles.list}>
          {players.map((player) => {
            const fullName = formatPlayerName(player);
            const isSelected = selectedId === player.YouthPlayerID;
            const isAssigned = assignedIds?.has(player.YouthPlayerID) ?? false;

            return (
              <li key={player.YouthPlayerID} className={styles.listItem}>
                <div className={styles.playerRow}>
                  <button
                    type="button"
                    className={`${styles.playerButton} ${
                      isAssigned ? styles.playerAssigned : ""
                    }`}
                    onClick={() => handleSelect(player.YouthPlayerID)}
                    onDragStart={(event) =>
                      handleDragStart(event, player.YouthPlayerID)
                    }
                    draggable
                    aria-pressed={isSelected}
                  >
                    <span className={styles.playerName}>{fullName}</span>
                    <span className={styles.playerId}>
                      ID: {player.YouthPlayerID}
                    </span>
                    {isAssigned ? (
                      <span className={styles.assignedTag}>Assigned</span>
                    ) : null}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.detailsPanel}>
        <div className={styles.detailsHeader}>
          <div>
            <h3 className={styles.detailsTitle}>Player details</h3>
            {selectedPlayer ? (
              <p className={styles.detailsSubtitle}>
                {formatPlayerName(selectedPlayer)}
              </p>
            ) : null}
            {cachedDetails ? (
              <p className={styles.detailsTimestamp}>
                Last updated: {new Date(cachedDetails.fetchedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() =>
              selectedId ? loadDetails(selectedId, true) : undefined
            }
            disabled={!selectedId || loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className={styles.muted}>Loading details…</p>
        ) : error ? (
          <p className={styles.errorText}>{error}</p>
        ) : detailsData ? (
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div>
                <h4 className={styles.profileName}>
                  {detailsData.FirstName} {detailsData.LastName}
                </h4>
                <p className={styles.profileMeta}>
                  {detailsData.Age !== undefined ? (
                    <span className={styles.metaItem}>
                      {detailsData.Age} years
                      {detailsData.AgeDays !== undefined
                        ? ` ${detailsData.AgeDays} days`
                        : ""}
                    </span>
                  ) : null}
                  {detailsData.NativeCountryName ? (
                    <span className={styles.metaItem}>
                      {detailsData.NativeCountryName}
                    </span>
                  ) : null}
                </p>
              </div>
              {detailsData.CanBePromotedIn !== undefined ? (
                <span className={styles.tag}>
                  {detailsData.CanBePromotedIn === 0
                    ? "Can be promoted now"
                    : `Promotable in ${detailsData.CanBePromotedIn} days`}
                </span>
              ) : null}
            </div>

            <div className={styles.profileInfoRow}>
              {detailsData.OwningYouthTeam?.YouthTeamName ? (
                <div>
                  <div className={styles.infoLabel}>Youth team</div>
                  <div className={styles.infoValue}>
                    {detailsData.OwningYouthTeam.YouthTeamName}
                  </div>
                </div>
              ) : null}
              {detailsData.OwningYouthTeam?.SeniorTeam?.SeniorTeamName ? (
                <div>
                  <div className={styles.infoLabel}>Senior team</div>
                  <div className={styles.infoValue}>
                    {detailsData.OwningYouthTeam.SeniorTeam.SeniorTeamName}
                  </div>
                </div>
              ) : null}
              {detailsData.ArrivalDate ? (
                <div>
                  <div className={styles.infoLabel}>Arrived</div>
                  <div className={styles.infoValue}>
                    {formatArrival(detailsData.ArrivalDate)}
                    {daysSince(detailsData.ArrivalDate) !== null
                      ? ` (${daysSince(detailsData.ArrivalDate)} days ago)`
                      : ""}
                  </div>
                </div>
              ) : null}
              {detailsData.Specialty !== undefined ? (
                <div>
                  <div className={styles.infoLabel}>Specialty</div>
                  <div className={styles.infoValue}>
                    {SPECIALTY_EMOJI[detailsData.Specialty] ?? "—"}{" "}
                    {SPECIALTY_NAMES[detailsData.Specialty] ??
                      `Specialty ${detailsData.Specialty}`}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.sectionDivider} />

            <div>
              <h5 className={styles.sectionHeading}>Skills</h5>
              <div className={styles.skillsGrid}>
                {SKILL_ROWS.map((row) => {
                  const current = getSkillLevel(
                    detailsData.PlayerSkills?.[row.key]
                  );
                  const max = getSkillMax(
                    detailsData.PlayerSkills?.[row.maxKey]
                  );
                  const hasCurrent = current !== null;
                  const hasMax = max !== null;
                  const currentPct = hasCurrent
                    ? Math.min(100, (current / MAX_SKILL_LEVEL) * 100)
                    : null;
                  const maxPct = hasMax
                    ? Math.min(100, (max / MAX_SKILL_LEVEL) * 100)
                    : null;

                  return (
                    <div key={row.key} className={styles.skillRow}>
                      <div className={styles.skillLabel}>{row.label}</div>
                      <div className={styles.skillBar}>
                        {hasMax ? (
                          <div
                            className={styles.skillFillMax}
                            style={{ width: `${maxPct}%` }}
                          />
                        ) : null}
                        {hasCurrent ? (
                          <div
                            className={styles.skillFillCurrent}
                            style={{ width: `${currentPct}%` }}
                          />
                        ) : null}
                      </div>
                      <div className={styles.skillValue}>
                        {!hasCurrent && !hasMax
                          ? "unknown"
                          : hasCurrent && hasMax
                          ? `${getSkillName(current)} ${current}/${max}`
                          : hasCurrent
                          ? `${getSkillName(current)} ${current}`
                          : `potential ${max}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.sectionDivider} />

            <div className={styles.detailsJsonWrapper}>
              <div className={styles.detailsJsonTitle}>Raw details</div>
              <pre className={styles.detailsJson}>
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className={styles.muted}>Select a player to load details.</p>
        )}
      </div>
    </div>
  );
}
