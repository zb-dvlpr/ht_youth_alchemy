import { useEffect, useMemo, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { formatChppDate, formatDateTime } from "@/lib/datetime";
import Tooltip from "./Tooltip";
import RatingsMatrix, { RatingsMatrixResponse } from "./RatingsMatrix";
import { positionLabelShortByRoleId } from "@/lib/positions";
import { SPECIALTY_EMOJI } from "@/lib/specialty";

type YouthPlayer = {
  YouthPlayerID: number;
  FirstName: string;
  NickName: string;
  LastName: string;
  Specialty?: number;
  PlayerSkills?: Record<string, SkillValue | number | string>;
};

type SkillValue = {
  "#text"?: number | string;
  "@_IsAvailable"?: string;
  "@_IsMaxReached"?: string;
  "@_MayUnlock"?: string;
};

export type YouthPlayerDetails = {
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
  LastMatch?: {
    Date?: string;
    YouthMatchID?: number;
    PositionCode?: number;
    PlayedMinutes?: number;
    Rating?: number;
  };
};

type PlayerDetailsPanelProps = {
  selectedPlayer: YouthPlayer | null;
  detailsData: YouthPlayerDetails | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  unlockStatus: "success" | "denied" | null;
  onRefresh: () => void;
  players: YouthPlayer[];
  playerDetailsById: Map<number, YouthPlayerDetails>;
  skillsMatrixRows: { id: number | null; name: string }[];
  ratingsMatrixResponse: RatingsMatrixResponse | null;
  ratingsMatrixSelectedName: string | null;
  ratingsMatrixSpecialtyByName: Record<string, number | undefined>;
  onSelectRatingsPlayer: (playerName: string) => void;
  messages: Messages;
};

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

 

const SKILL_ROWS = [
  {
    key: "KeeperSkill",
    maxKey: "KeeperSkillMax",
    labelKey: "skillKeeper",
    shortLabelKey: "skillKeeperShort",
  },
  {
    key: "DefenderSkill",
    maxKey: "DefenderSkillMax",
    labelKey: "skillDefending",
    shortLabelKey: "skillDefendingShort",
  },
  {
    key: "PlaymakerSkill",
    maxKey: "PlaymakerSkillMax",
    labelKey: "skillPlaymaking",
    shortLabelKey: "skillPlaymakingShort",
  },
  {
    key: "WingerSkill",
    maxKey: "WingerSkillMax",
    labelKey: "skillWinger",
    shortLabelKey: "skillWingerShort",
  },
  {
    key: "PassingSkill",
    maxKey: "PassingSkillMax",
    labelKey: "skillPassing",
    shortLabelKey: "skillPassingShort",
  },
  {
    key: "ScorerSkill",
    maxKey: "ScorerSkillMax",
    labelKey: "skillScoring",
    shortLabelKey: "skillScoringShort",
  },
  {
    key: "SetPiecesSkill",
    maxKey: "SetPiecesSkillMax",
    labelKey: "skillSetPieces",
    shortLabelKey: "skillSetPiecesShort",
  },
];

function formatPlayerName(player?: YouthPlayer | null) {
  if (!player) return "";
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
}

function getSkillLevel(skill?: SkillValue | number | string | null): number | null {
  if (!skill) return null;
  if (typeof skill === "number") return skill;
  if (typeof skill === "string") {
    const numeric = Number(skill);
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

function getSkillMax(skill?: SkillValue | number | string | null): number | null {
  if (!skill) return null;
  if (typeof skill === "number") return skill;
  if (typeof skill === "string") {
    const numeric = Number(skill);
    return Number.isNaN(numeric) ? null : numeric;
  }
  if (skill["@_IsAvailable"] !== "True") return null;
  if (skill["#text"] === undefined || skill["#text"] === null) return null;
  const numeric = Number(skill["#text"]);
  return Number.isNaN(numeric) ? null : numeric;
}

function getSkillName(level: number | null) {
  if (level === null) return "unknown";
  return SKILL_NAMES[level] ?? `level ${level}`;
}

function skillCellColor(value: number | null) {
  if (value === null || value === undefined) {
    return undefined;
  }
  const normalized = Math.min(Math.max((value - 1) / 6, 0), 1);
  const hue = 120 * normalized;
  const alpha = 0.2 + normalized * 0.35;
  return `hsla(${hue}, 70%, 38%, ${alpha})`;
}

function daysSince(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function PlayerDetailsPanel({
  selectedPlayer,
  detailsData,
  loading,
  error,
  lastUpdated,
  unlockStatus,
  onRefresh,
  players,
  playerDetailsById,
  skillsMatrixRows,
  ratingsMatrixResponse,
  ratingsMatrixSelectedName,
  ratingsMatrixSpecialtyByName,
  onSelectRatingsPlayer,
  messages,
}: PlayerDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<
    "details" | "skillsMatrix" | "ratingsMatrix"
  >("details");
  const [skillsSortKey, setSkillsSortKey] = useState<string | null>(null);
  const [skillsSortDir, setSkillsSortDir] = useState<"asc" | "desc">("desc");

  const playerById = useMemo(() => {
    const map = new Map<number, YouthPlayer>();
    players.forEach((player) => map.set(player.YouthPlayerID, player));
    return map;
  }, [players]);

  useEffect(() => {
    if (selectedPlayer?.YouthPlayerID) {
      setActiveTab("details");
    }
  }, [selectedPlayer?.YouthPlayerID]);

  const sortedSkillsRows = useMemo(() => {
    if (!skillsSortKey) return skillsMatrixRows;
    const direction = skillsSortDir === "asc" ? 1 : -1;
    return [...skillsMatrixRows].sort((a, b) => {
      const detailsA = a.id ? playerDetailsById.get(a.id) : null;
      const detailsB = b.id ? playerDetailsById.get(b.id) : null;
      const playerA = a.id ? playerById.get(a.id) : null;
      const playerB = b.id ? playerById.get(b.id) : null;
      const skillsA = detailsA?.PlayerSkills ?? playerA?.PlayerSkills ?? null;
      const skillsB = detailsB?.PlayerSkills ?? playerB?.PlayerSkills ?? null;
      const currentA = getSkillLevel(skillsA?.[skillsSortKey]);
      const maxA = getSkillMax(skillsA?.[`${skillsSortKey}Max`]);
      const currentB = getSkillLevel(skillsB?.[skillsSortKey]);
      const maxB = getSkillMax(skillsB?.[`${skillsSortKey}Max`]);
      const sumA = (currentA ?? 0) + (maxA ?? 0);
      const sumB = (currentB ?? 0) + (maxB ?? 0);
      if (sumA === sumB) return 0;
      return (sumA - sumB) * direction;
    });
  }, [
    playerById,
    playerDetailsById,
    skillsMatrixRows,
    skillsSortDir,
    skillsSortKey,
  ]);

  const handleSkillsSort = (key: string) => {
    if (skillsSortKey === key) {
      setSkillsSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSkillsSortKey(key);
      setSkillsSortDir("desc");
    }
  };

  const specialtyName = (value?: number) => {
    switch (value) {
      case 0:
        return messages.specialtyNone;
      case 1:
        return messages.specialtyTechnical;
      case 2:
        return messages.specialtyQuick;
      case 3:
        return messages.specialtyPowerful;
      case 4:
        return messages.specialtyUnpredictable;
      case 5:
        return messages.specialtyHeadSpecialist;
      case 6:
        return messages.specialtyResilient;
      case 8:
        return messages.specialtySupport;
      default:
        return null;
    }
  };

  const playerId =
    detailsData?.YouthPlayerID ?? selectedPlayer?.YouthPlayerID ?? null;
  const lastMatchDate = detailsData?.LastMatch
    ? formatChppDate(detailsData.LastMatch.Date) ?? messages.unknownDate
    : null;
  const lastMatchRating = detailsData?.LastMatch
    ? detailsData.LastMatch.Rating ?? messages.unknownLabel
    : null;
  const lastMatchPosition = detailsData?.LastMatch
    ? positionLabelShortByRoleId(detailsData.LastMatch.PositionCode, messages)
    : null;
  const promotionAge =
    detailsData?.Age !== undefined &&
    detailsData?.AgeDays !== undefined &&
    detailsData?.CanBePromotedIn !== undefined
      ? (() => {
          const daysPerYear = 112;
          const totalDays =
            detailsData.Age * daysPerYear +
            detailsData.AgeDays +
            Math.max(0, detailsData.CanBePromotedIn);
          const promoYears = Math.floor(totalDays / daysPerYear);
          const promoDays = totalDays % daysPerYear;
          return {
            label: `${promoYears} ${messages.yearsLabel} ${promoDays} ${messages.daysLabel}`,
            totalDays,
          };
        })()
      : null;

  const renderDetails = () => {
    if (loading) {
      return (
        <div className={styles.loadingRow}>
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.muted}>{messages.loadingDetails}</span>
        </div>
      );
    }

    if (error) {
      return <p className={styles.errorText}>{error}</p>;
    }

    if (!detailsData) {
      return <p className={styles.muted}>{messages.selectPlayerPrompt}</p>;
    }

    return (
      <div className={styles.profileCard}>
        <div className={styles.detailsRefreshCorner}>
          <Tooltip content={messages.refreshTooltip}>
            <button
              type="button"
              className={`${styles.sortToggle} ${styles.detailsRefresh}`}
              onClick={onRefresh}
              disabled={!selectedPlayer || loading}
              aria-label={messages.refreshTooltip}
            >
              ↻
            </button>
          </Tooltip>
        </div>
        <div className={styles.profileHeader}>
          <div>
            <div className={styles.profileNameRow}>
              <h4 className={styles.profileName}>
                {detailsData.FirstName} {detailsData.LastName}
              </h4>
              {lastUpdated ? (
                <span className={styles.profileUpdated}>
                  {messages.lastUpdated}: {formatDateTime(lastUpdated)}
                </span>
              ) : null}
            </div>
            <p className={styles.profileMeta}>
              {detailsData.Age !== undefined ? (
                <span className={styles.metaItem}>
                  {detailsData.Age} {messages.yearsLabel}
                  {detailsData.AgeDays !== undefined
                    ? ` ${detailsData.AgeDays} ${messages.daysLabel}`
                    : ""}
                  {promotionAge ? (
                    <>
                      {" "}
                      (
                      {messages.ageAtPromotionLabel}:{" "}
                      <span
                        className={
                          promotionAge.totalDays < 17 * 112 + 1
                            ? styles.agePromotionGood
                            : styles.agePromotionBad
                        }
                      >
                        {promotionAge.label}
                      </span>
                      )
                    </>
                  ) : null}
                </span>
              ) : null}
              {detailsData.CanBePromotedIn !== undefined ? (
                <span
                  className={`${styles.tag} ${styles.metaTag} ${
                    detailsData.CanBePromotedIn <= 0
                      ? styles.tagDanger
                      : styles.tagSuccess
                  }`}
                >
                  {detailsData.CanBePromotedIn <= 0
                    ? messages.promotableNow
                    : `${messages.promotableIn} ${detailsData.CanBePromotedIn} ${messages.daysLabel}`}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className={styles.profileInfoRow}>
          {detailsData.OwningYouthTeam?.YouthTeamName ? (
            <div>
              <div className={styles.infoLabel}>{messages.youthTeamLabel}</div>
              <div className={styles.infoValue}>
                {detailsData.OwningYouthTeam.YouthTeamName}
              </div>
            </div>
          ) : null}
          {detailsData.OwningYouthTeam?.SeniorTeam?.SeniorTeamName ? (
            <div>
              <div className={styles.infoLabel}>{messages.seniorTeamLabel}</div>
              <div className={styles.infoValue}>
                {detailsData.OwningYouthTeam.SeniorTeam.SeniorTeamName}
              </div>
            </div>
          ) : null}
          {detailsData.ArrivalDate ? (
            <div>
              <div className={styles.infoLabel}>{messages.arrivedLabel}</div>
              <div className={styles.infoValue}>
                {formatChppDate(detailsData.ArrivalDate)}
                {daysSince(detailsData.ArrivalDate) !== null
                  ? ` (${daysSince(detailsData.ArrivalDate)} days ago)`
                  : ""}
              </div>
            </div>
          ) : null}
          {detailsData.Specialty !== undefined ? (
            <div>
              <div className={styles.infoLabel}>{messages.specialtyLabel}</div>
              <div className={styles.infoValue}>
                <span className={styles.playerSpecialty}>
                  {SPECIALTY_EMOJI[detailsData.Specialty] ?? "—"}
                </span>{" "}
                {specialtyName(detailsData.Specialty) ??
                  `${messages.specialtyLabel} ${detailsData.Specialty}`}
              </div>
            </div>
          ) : null}
          {playerId ? (
            <div>
              <div className={styles.infoLabel}>{messages.playerIdLabel}</div>
              <div className={styles.infoValue}>
                {playerId}
                <a
                  className={styles.infoLinkIcon}
                  href={`https://www82.hattrick.org/Club/Players/YouthPlayer.aspx?YouthPlayerID=${playerId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={messages.playerLinkLabel}
                >
                  ↗
                </a>
              </div>
            </div>
          ) : null}
          {detailsData.LastMatch ? (
            <div>
              <div className={styles.infoLabel}>
                {messages.lastMatchRatingLabel}
              </div>
              <div className={`${styles.infoValue} ${styles.lastMatchValue}`}>
                {lastMatchDate}: {lastMatchRating}
                {lastMatchPosition ? ` (${lastMatchPosition})` : ""}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.sectionDivider} />

        <div>
          <div className={styles.sectionHeadingRow}>
            <h5 className={styles.sectionHeading}>{messages.skillsLabel}</h5>
            {unlockStatus === "success" ? (
              <span
                className={`${styles.detailsBadge} ${styles.detailsBadgeSuccess}`}
              >
                {messages.unlockedLabel}
              </span>
            ) : null}
          </div>
          <div className={styles.skillsGrid}>
            {SKILL_ROWS.map((row) => {
              const current = getSkillLevel(detailsData.PlayerSkills?.[row.key]);
              const max = getSkillMax(detailsData.PlayerSkills?.[row.maxKey]);
              const hasCurrent = current !== null;
              const hasMax = max !== null;
              const currentText = hasCurrent
                ? String(current)
                : messages.unknownShort;
              const maxText = hasMax ? String(max) : messages.unknownShort;
              const currentPct = hasCurrent
                ? Math.min(100, (current / MAX_SKILL_LEVEL) * 100)
                : null;
              const maxPct = hasMax
                ? Math.min(100, (max / MAX_SKILL_LEVEL) * 100)
                : null;

              return (
                <div key={row.key} className={styles.skillRow}>
                  <div className={styles.skillLabel}>
                    {messages[row.labelKey as keyof Messages]}
                  </div>
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
                    {currentText}/{maxText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderSkillsMatrix = () => {
    if (skillsMatrixRows.length === 0) {
      return <p className={styles.muted}>{messages.noYouthPlayers}</p>;
    }

    return (
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.matrixIndexHeader}>
                {messages.ratingsIndexLabel}
              </th>
              <th className={styles.matrixPlayerHeader}>
                {messages.ratingsPlayerLabel}
              </th>
              <th className={styles.matrixSpecialtyHeader}>
                {messages.ratingsSpecialtyLabel}
              </th>
              {SKILL_ROWS.map((row) => {
                const isActive = skillsSortKey === row.key;
                const direction = isActive ? skillsSortDir : "desc";
                return (
                  <th key={row.key}>
                    <button
                      type="button"
                      className={styles.matrixSortButton}
                      onClick={() => handleSkillsSort(row.key)}
                      aria-label={`${messages.ratingsSortBy} ${messages[row.labelKey as keyof Messages]}`}
                    >
                      {messages[row.shortLabelKey as keyof Messages]}
                      <span className={styles.matrixSortIcon}>
                        {isActive ? (direction === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedSkillsRows.map((row, index) => {
              const player = row.id ? playerById.get(row.id) : null;
              const details = row.id ? playerDetailsById.get(row.id) : null;
              const skills = details?.PlayerSkills ?? player?.PlayerSkills ?? null;

              return (
                <tr key={`${row.name}-${row.id ?? "unknown"}`}>
                  <td className={styles.matrixIndex}>{index + 1}</td>
                  <td className={styles.matrixPlayer}>{row.name}</td>
                  <td className={styles.matrixSpecialty}>
                    {player?.Specialty !== undefined ? (
                      <Tooltip
                        content={
                          specialtyName(player.Specialty) ?? messages.specialtyLabel
                        }
                      >
                        <span className={styles.playerSpecialty}>
                          {SPECIALTY_EMOJI[player.Specialty] ?? "—"}
                        </span>
                      </Tooltip>
                    ) : (
                      "—"
                    )}
                  </td>
                  {SKILL_ROWS.map((skill) => {
                    const current = getSkillLevel(skills?.[skill.key]);
                    const max = getSkillMax(skills?.[skill.maxKey]);
                    const currentText =
                      current === null ? messages.unknownShort : String(current);
                    const maxText = max === null ? messages.unknownShort : String(max);
                    const currentColor = skillCellColor(current);
                    const maxColor = skillCellColor(max);
                    return (
                      <td key={skill.key} className={styles.matrixCell}>
                        <div className={styles.skillsMatrixSplit}>
                          <span
                            className={`${styles.skillsMatrixHalf} ${styles.skillsMatrixHalfLeft}`}
                            style={
                              currentColor
                                ? { backgroundColor: currentColor }
                                : undefined
                            }
                          >
                            {currentText}
                          </span>
                          <span className={styles.skillsMatrixDivider}>/</span>
                          <span
                            className={`${styles.skillsMatrixHalf} ${styles.skillsMatrixHalfRight}`}
                            style={
                              maxColor ? { backgroundColor: maxColor } : undefined
                            }
                          >
                            {maxText}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={styles.card}>
      <div className={styles.detailsHeader}>
        <div className={styles.detailsTabs}>
          <button
            type="button"
            className={`${styles.detailsTabButton} ${
              activeTab === "details" ? styles.detailsTabActive : ""
            }`}
            onClick={() => setActiveTab("details")}
          >
            {messages.detailsTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.detailsTabButton} ${
              activeTab === "skillsMatrix" ? styles.detailsTabActive : ""
            }`}
            onClick={() => setActiveTab("skillsMatrix")}
          >
            {messages.skillsMatrixTabLabel}
          </button>
          <button
            type="button"
            className={`${styles.detailsTabButton} ${
              activeTab === "ratingsMatrix" ? styles.detailsTabActive : ""
            }`}
            onClick={() => setActiveTab("ratingsMatrix")}
          >
            {messages.ratingsMatrixTabLabel}
          </button>
        </div>
      </div>

      {activeTab === "details" ? (
        renderDetails()
      ) : activeTab === "skillsMatrix" ? (
        renderSkillsMatrix()
      ) : (
        <RatingsMatrix
          response={ratingsMatrixResponse}
          showTitle={false}
          messages={messages}
          specialtyByName={ratingsMatrixSpecialtyByName}
          selectedName={ratingsMatrixSelectedName}
          onSelectPlayer={onSelectRatingsPlayer}
        />
      )}
    </div>
  );
}
