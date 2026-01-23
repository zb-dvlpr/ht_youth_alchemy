import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { matchRoleIdToPositionKey } from "@/lib/positions";

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
  onRefresh: () => void;
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
  { key: "KeeperSkill", maxKey: "KeeperSkillMax", labelKey: "skillKeeper" },
  { key: "DefenderSkill", maxKey: "DefenderSkillMax", labelKey: "skillDefending" },
  { key: "PlaymakerSkill", maxKey: "PlaymakerSkillMax", labelKey: "skillPlaymaking" },
  { key: "WingerSkill", maxKey: "WingerSkillMax", labelKey: "skillWinger" },
  { key: "PassingSkill", maxKey: "PassingSkillMax", labelKey: "skillPassing" },
  { key: "ScorerSkill", maxKey: "ScorerSkillMax", labelKey: "skillScoring" },
  { key: "SetPiecesSkill", maxKey: "SetPiecesSkillMax", labelKey: "skillSetPieces" },
];

function formatPlayerName(player?: YouthPlayer | null) {
  if (!player) return "";
  return [player.FirstName, player.NickName || null, player.LastName]
    .filter(Boolean)
    .join(" ");
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

function formatMatchDate(dateString?: string) {
  if (!dateString) return null;
  const parsed = new Date(dateString.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const yyyy = parsed.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default function PlayerDetailsPanel({
  selectedPlayer,
  detailsData,
  loading,
  error,
  lastUpdated,
  onRefresh,
  messages,
}: PlayerDetailsPanelProps) {
  return (
    <div className={styles.card}>
      <div className={styles.detailsHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{messages.playerDetails}</h2>
          {selectedPlayer ? (
            <p className={styles.detailsSubtitle}>
              {formatPlayerName(selectedPlayer)}
            </p>
          ) : null}
          {lastUpdated ? (
            <p className={styles.detailsTimestamp}>
              {messages.lastUpdated}: {new Date(lastUpdated).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={onRefresh}
          disabled={!selectedPlayer || loading}
        >
          {messages.refresh}
        </button>
      </div>

      {loading ? (
        <p className={styles.muted}>{messages.loadingDetails}</p>
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
                    {detailsData.Age} {messages.yearsLabel}
                    {detailsData.AgeDays !== undefined
                      ? ` ${detailsData.AgeDays} ${messages.daysLabel}`
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
                {detailsData.CanBePromotedIn <= 0
                  ? messages.promotableNow
                  : `${messages.promotableIn} ${detailsData.CanBePromotedIn} ${messages.daysLabel}`}
              </span>
            ) : null}
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
                  {formatArrival(detailsData.ArrivalDate)}
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
                  {SPECIALTY_EMOJI[detailsData.Specialty] ?? "—"}{" "}
                  {SPECIALTY_NAMES[detailsData.Specialty] ??
                    `Specialty ${detailsData.Specialty}`}
                </div>
              </div>
            ) : null}
            {detailsData.LastMatch ? (
              <div>
                <div className={styles.infoLabel}>
                  {messages.lastMatchRatingLabel}
                </div>
                <div className={styles.infoValue}>
                  {detailsData.LastMatch.Rating ?? messages.unknownLabel}{" "}
                  {matchRoleIdToPositionKey(detailsData.LastMatch.PositionCode)
                    ? `(${matchRoleIdToPositionKey(detailsData.LastMatch.PositionCode)})`
                    : ""}{" "}
                  {formatMatchDate(detailsData.LastMatch.Date) ??
                    messages.unknownDate}
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.sectionDivider} />

          <div>
            <h5 className={styles.sectionHeading}>{messages.skillsLabel}</h5>
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
                      {!hasCurrent && !hasMax
                        ? messages.unknownLabel
                        : hasCurrent && hasMax
                        ? `${getSkillName(current)} ${current}/${max}`
                        : hasCurrent
                        ? `${getSkillName(current)} ${current}`
                        : `${messages.potentialLabel} ${max}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className={styles.muted}>{messages.selectPlayerPrompt}</p>
      )}
    </div>
  );
}
