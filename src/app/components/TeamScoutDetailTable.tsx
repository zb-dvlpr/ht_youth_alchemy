"use client";

import { useMemo, type CSSProperties } from "react";

import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";
import { formatSekCurrency, type DisplayCurrency } from "@/lib/currency";
import { normalizeSeniorShirtNumber } from "@/lib/seniorShirtNumber";
import {
  estimateChronicleMainSkillFromWage,
  PLAYING_POSITION_SORT_BUCKET_NO_VALUE,
  resolveChronicleDominantPlayingPosition,
} from "@/lib/clubChronicle/mainSkillEstimation";
import { calculateEffectiveSkill } from "@/lib/seniorEffectiveSkill";
import {
  hattrickMatchUrlWithSourceSystem,
  hattrickPlayerUrl,
} from "@/lib/hattrick/urls";
import {
  positionLabelShortByRoleId,
} from "@/lib/positions";
import { getSpecialtyEmoji } from "@/lib/specialty";
import { isLikelyTraineeForTeamScoutDetail } from "@/lib/clubChronicle/teamScoutDetailRows";
import type {
  TeamScoutForm7RatingEntry,
  TeamScoutLikelyTrainingInfo,
  TeamScoutPlayerRow,
  TeamScoutPlayingPositionEntry,
} from "@/lib/clubChronicle/teamScoutDetailTypes";
import Tooltip from "./Tooltip";
import OriginFlag from "./OriginFlag";
import {
  ChronicleDetailHorizontalScroll,
  ChronicleTable,
  type ChronicleSortValue,
  type ChronicleTableColumn,
} from "./ChronicleTable";
import TeamScoutDetailInfo from "./TeamScoutDetailInfo";

export type TeamScoutDetailMode = "tsi" | "wages";
export type TeamScoutDetailColumnKey =
  | "playerNumber"
  | "player"
  | "age"
  | "tsi"
  | "wage"
  | "playingPosition"
  | "mainSkillEstimation"
  | "form7Rating"
  | "manMarker"
  | "form"
  | "stamina"
  | "experience"
  | "leadership"
  | "loyalty";

export type TeamScoutDetailSortDirection = "asc" | "desc";
export type TeamScoutDetailSortState = {
  key: TeamScoutDetailColumnKey | null;
  direction: TeamScoutDetailSortDirection;
};

export { isLikelyTraineeForTeamScoutDetail };
export type {
  TeamScoutForm7RatingEntry,
  TeamScoutLikelyTrainingInfo,
  TeamScoutPlayerRow,
  TeamScoutPlayingPositionEntry,
};

type TeamScoutDetailTableProps = {
  mode: TeamScoutDetailMode;
  rows: TeamScoutPlayerRow[];
  messages: Messages;
  displayCurrency: DisplayCurrency;
  likelyTraining: TeamScoutLikelyTrainingInfo;
  matchSampleSize: number | null | undefined;
  onShowAnalyzedMatches?: (() => void) | null;
  showMobileLandscapeHint?: boolean;
  showEffectiveMainSkillEstimation: boolean;
  onShowEffectiveMainSkillEstimationChange?: (enabled: boolean) => void;
  sortState: TeamScoutDetailSortState;
  onSortChange: (key: TeamScoutDetailColumnKey) => void;
  maskedTeamId?: number | null;
  maskText?: string;
  isMaskActive?: boolean;
  onMaskedRowClick?: (row: TeamScoutPlayerRow) => void;
};

const CHPP_DAYS_PER_YEAR = 112;

const normalizeSortValue = (value: unknown): ChronicleSortValue => {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSortValue(entry));
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.toLocaleLowerCase();
  return String(value).toLocaleLowerCase();
};

const compareSortValues = (left: unknown, right: unknown): number => {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftArray = Array.isArray(left) ? left : [left];
    const rightArray = Array.isArray(right) ? right : [right];
    const length = Math.max(leftArray.length, rightArray.length);
    for (let i = 0; i < length; i += 1) {
      const result = compareSortValues(leftArray[i], rightArray[i]);
      if (result !== 0) return result;
    }
    return 0;
  }
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

export const sortTeamScoutRows = (
  rows: TeamScoutPlayerRow[],
  columns: ChronicleTableColumn<TeamScoutPlayerRow, TeamScoutPlayerRow>[],
  sortState: TeamScoutDetailSortState
) => {
  if (!sortState.key) return rows;
  const column = columns.find((item) => item.key === sortState.key);
  if (!column) return rows;
  const direction = sortState.direction === "desc" ? -1 : 1;
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = normalizeSortValue(
        column.getSortValue?.(left.row, left.row) ??
          column.getValue(left.row, left.row)
      );
      const rightValue = normalizeSortValue(
        column.getSortValue?.(right.row, right.row) ??
          column.getValue(right.row, right.row)
      );
      const result = compareSortValues(leftValue, rightValue);
      if (result !== 0) return result * direction;
      return left.index - right.index;
    })
    .map((item) => item.row);
};

export const resolveTeamScoutPlayingPositionSortBucket = (
  entries: TeamScoutPlayingPositionEntry[] | null | undefined
): number => {
  return (
    resolveChronicleDominantPlayingPosition(entries)?.sortBucket ??
    PLAYING_POSITION_SORT_BUCKET_NO_VALUE
  );
};

export const formatTeamScoutPlayingPositionEntries = (
  entries: TeamScoutPlayingPositionEntry[] | null | undefined,
  messages: Messages
) => {
  if (!entries || entries.length === 0) return null;
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + Math.max(0, entry.minutes ?? 0),
    0
  );
  if (totalMinutes <= 0) return null;
  return entries
    .map((entry) => {
      const label = positionLabelShortByRoleId(entry.roleId, messages);
      if (!label) return null;
      const pct = Math.round((Math.max(0, entry.minutes) / totalMinutes) * 100);
      return `${label} ${pct}%`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join(", ");
};

const normalizeInjuryLevel = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
};

const formatInjuryWeeksValue = (value: number) =>
  value === 999 ? "∞" : String(value);

const renderInjuryStatusInline = (
  value: number | null | undefined,
  messages: Messages
) => {
  const injuryLevel = normalizeInjuryLevel(value);
  if (injuryLevel === null || injuryLevel < 0) return null;
  if (injuryLevel === 0) {
    return (
      <span
        className={`${styles.chronicleInjuryBruised} ${styles.chronicleInjuryInline}`}
        title={messages.clubChronicleInjuryBruised}
        aria-label={messages.clubChronicleInjuryBruised}
      >
        🩹
      </span>
    );
  }
  const injuryWeeks = formatInjuryWeeksValue(injuryLevel);
  const injuryLabel = messages.clubChronicleInjuryInjuredWeeks.replace(
    "{{weeks}}",
    injuryWeeks
  );
  return (
    <span
      className={`${styles.chronicleInjuryInjured} ${styles.chronicleInjuryInline}`}
      title={injuryLabel}
      aria-label={injuryLabel}
    >
      <span className={styles.chronicleInjuryCross}>✚</span>
      <sub className={styles.chronicleInjuryWeeks}>{injuryWeeks}</sub>
    </span>
  );
};

const resolveSpecialtyLabel = (
  value: number | null | undefined,
  messages: Messages
) => {
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
      return messages.specialtyLabel;
  }
};

const buildCardStatus = (cards: number | null, messages: Messages) => {
  if (typeof cards !== "number") return null;
  if (cards >= 3) {
    return { display: "🟥", label: messages.sortCards };
  }
  if (cards === 2) {
    return { display: "🟨🟨", label: messages.sortCards };
  }
  if (cards === 1) {
    return { display: "🟨", label: messages.sortCards };
  }
  return null;
};

const resolveWeatherLabel = (
  weatherId: number | null | undefined,
  messages: Messages
) => {
  switch (weatherId) {
    case 0:
      return messages.clubChronicleWeatherRain;
    case 1:
      return messages.clubChronicleWeatherOvercast;
    case 2:
      return messages.clubChronicleWeatherPartiallyCloudy;
    case 3:
      return messages.clubChronicleWeatherSunny;
    default:
      return messages.unknownShort;
  }
};

const resolveWeatherEmoji = (weatherId: number | null | undefined) => {
  switch (weatherId) {
    case 0:
      return "🌧️";
    case 1:
      return "☁️";
    case 2:
      return "⛅";
    case 3:
      return "☀️";
    default:
      return "❔";
  }
};

const formatAgeWithDays = (
  age: number | null | undefined,
  ageDays: number | null | undefined,
  messages: Messages
) => {
  if (age === null || age === undefined) return null;
  if (ageDays === null || ageDays === undefined) return `${age}`;
  return `${age}${messages.ageYearsShort} ${ageDays}${messages.ageDaysShort}`;
};

const renderMotherClubBonusIndicator = (
  motherClubBonus: boolean | null | undefined,
  messages: Messages
) =>
  motherClubBonus === true ? (
    <Tooltip content={messages.motherClubBonusTooltip}>
      <span
        className={styles.seniorMotherClubHeart}
        aria-label={messages.motherClubBonusTooltip}
      >
        ❤
      </span>
    </Tooltip>
  ) : null;

const formatEffectiveMainSkillValue = (
  value: number,
  messages: Messages
) => {
  if (!Number.isFinite(value)) return messages.unknownShort;
  if (Number.isInteger(value)) return String(value);
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
};

const resolveMainSkillDisplayLevel = (
  row: TeamScoutPlayerRow | null | undefined,
  showEffectiveMainSkillEstimation: boolean
) => {
  const estimation = estimateChronicleMainSkillFromWage({
    salarySek: row?.salarySek,
    ageYears: row?.age,
    specialty: row?.specialty,
    wageIncludesForeignBonus: row?.wageIncludesForeignBonus,
    playingPositions: row?.playingPositions,
  });
  if (estimation.kind !== "estimated") return { estimation, value: null };
  if (!showEffectiveMainSkillEstimation) {
    return { estimation, value: estimation.level };
  }
  return {
    estimation,
    value: calculateEffectiveSkill({
      rawSkill: estimation.level,
      loyalty: row?.loyalty,
      motherClubBonus: row?.motherClubBonus === true,
      form: row?.form,
      stamina: row?.stamina,
    }),
  };
};

const formatMainSkillEstimation = (
  row: TeamScoutPlayerRow | null | undefined,
  messages: Messages,
  showEffectiveMainSkillEstimation: boolean
) => {
  const { estimation, value } = resolveMainSkillDisplayLevel(
    row,
    showEffectiveMainSkillEstimation
  );
  if (estimation.kind === "tooOld") {
    return messages.clubChronicleMainSkillEstimationTooOld;
  }
  if (estimation.kind !== "estimated" || value === null) {
    return messages.unknownShort;
  }
  const levelLabel = showEffectiveMainSkillEstimation
    ? formatEffectiveMainSkillValue(value, messages)
    : String(value);
  return `${levelLabel} (${estimation.mainSkill})`;
};

const resolveMainSkillSortValue = (
  row: TeamScoutPlayerRow | null | undefined,
  showEffectiveMainSkillEstimation: boolean
) => {
  const { estimation, value } = resolveMainSkillDisplayLevel(
    row,
    showEffectiveMainSkillEstimation
  );
  if (estimation.kind === "estimated") return value ?? 1001;
  if (estimation.kind === "tooOld") return 1000;
  return 1001;
};

function buildColumns({
  mode,
  messages,
  displayCurrency,
  showEffectiveMainSkillEstimation,
  onShowEffectiveMainSkillEstimationChange,
}: {
  mode: TeamScoutDetailMode;
  messages: Messages;
  displayCurrency: DisplayCurrency;
  showEffectiveMainSkillEstimation: boolean;
  onShowEffectiveMainSkillEstimationChange?: (enabled: boolean) => void;
}) {
  const formatCurrencyFromSek = (valueSek: number | null | undefined) =>
    formatSekCurrency(valueSek, displayCurrency, {
      fallback: messages.unknownShort,
    });
  const effectiveToggle = onShowEffectiveMainSkillEstimationChange ? (
    <Tooltip content={messages.seniorSkillsMatrixBonusToggleTooltip}>
      <label className={styles.chronicleMainSkillHeaderToggle}>
        <input
          type="checkbox"
          className={styles.chronicleMainSkillHeaderToggleInput}
          checked={showEffectiveMainSkillEstimation}
          onChange={(event) =>
            onShowEffectiveMainSkillEstimationChange(event.target.checked)
          }
        />
        <span
          className={styles.chronicleMainSkillHeaderToggleTrack}
          aria-hidden="true"
        />
        <span className={styles.chronicleMainSkillHeaderToggleLabel}>
          {messages.seniorSkillsMatrixBonusToggleLabel}
        </span>
      </label>
    </Tooltip>
  ) : null;

  const valueColumn: ChronicleTableColumn<
    TeamScoutPlayerRow,
    TeamScoutPlayerRow
  > =
    mode === "wages"
      ? {
          key: "wage",
          label: messages.clubChronicleWagesValueColumn,
          getValue: (snapshot) =>
            snapshot
              ? `${formatCurrencyFromSek(snapshot.salarySek)}${
                  snapshot.wageIncludesForeignBonus ? "²" : ""
                }`
              : null,
          getSortValue: (snapshot) => snapshot?.salarySek ?? null,
          renderCell: (snapshot) =>
            `${formatCurrencyFromSek(snapshot?.salarySek ?? null)}${
              snapshot?.wageIncludesForeignBonus ? "²" : ""
            }`,
        }
      : {
          key: "tsi",
          label: messages.clubChronicleTsiValueColumn,
          getValue: (snapshot) => snapshot?.tsi ?? null,
        };

  return [
    {
      key: "playerNumber",
      label:
        mode === "wages"
          ? messages.clubChronicleWagesPlayerIndexColumn
          : messages.clubChronicleTsiPlayerIndexColumn,
      getValue: (snapshot) =>
        normalizeSeniorShirtNumber(snapshot?.playerNumber) ?? null,
      getSortValue: (snapshot) =>
        normalizeSeniorShirtNumber(snapshot?.playerNumber) ?? null,
      renderCell: (snapshot) => {
        const playerNumber = normalizeSeniorShirtNumber(snapshot?.playerNumber);
        return playerNumber === null ? "" : String(playerNumber);
      },
    },
    {
      key: "player",
      label:
        mode === "wages"
          ? messages.clubChronicleWagesPlayerColumn
          : messages.clubChronicleTsiPlayerColumn,
      getValue: (snapshot) => snapshot?.playerName ?? null,
      renderCell: (snapshot, _row, fallbackFormat) => {
        const playerId = snapshot?.playerId ?? 0;
        const playerName = snapshot?.playerName ?? null;
        const specialtyEmoji = getSpecialtyEmoji(snapshot?.specialty);
        const specialtyLabel = resolveSpecialtyLabel(
          snapshot?.specialty,
          messages
        );
        const cardStatus = buildCardStatus(snapshot?.cards ?? null, messages);
        const injuryIndicator = renderInjuryStatusInline(
          snapshot?.injuryLevel,
          messages
        );
        if (!playerId) return fallbackFormat(playerName);
        return (
          <>
            <a
              className={styles.chroniclePressLink}
              href={hattrickPlayerUrl(playerId)}
              target="_blank"
              rel="noreferrer"
            >
              {playerName ?? `${playerId}`}
            </a>
            <OriginFlag
              display={snapshot?.originFlagDisplay}
              className={styles.chronicleInjuryInline}
            />
            {specialtyEmoji ? (
              <Tooltip content={specialtyLabel}>
                <span
                  className={styles.chronicleInjuryInline}
                  aria-label={specialtyLabel}
                >
                  {specialtyEmoji}
                </span>
              </Tooltip>
            ) : null}
            {renderMotherClubBonusIndicator(snapshot?.motherClubBonus, messages)}
            {cardStatus ? (
              <span
                className={styles.playerCardStatusInline}
                title={cardStatus.label}
                aria-label={cardStatus.label}
              >
                {cardStatus.display}
              </span>
            ) : null}
            {injuryIndicator}
          </>
        );
      },
    },
    {
      key: "age",
      label: messages.clubChronicleTransferListedAgeColumn,
      getValue: (snapshot) =>
        formatAgeWithDays(snapshot?.age, snapshot?.ageDays, messages),
      getSortValue: (snapshot) => {
        const age = snapshot?.age;
        if (age === null || age === undefined) return null;
        return age * CHPP_DAYS_PER_YEAR + (snapshot?.ageDays ?? 0);
      },
    },
    valueColumn,
    {
      key: "playingPosition",
      label: messages.clubChroniclePlayingPositionColumn,
      getValue: (snapshot) =>
        formatTeamScoutPlayingPositionEntries(
          snapshot?.playingPositions,
          messages
        ),
      getSortValue: (snapshot) =>
        resolveTeamScoutPlayingPositionSortBucket(snapshot?.playingPositions),
      renderCell: (snapshot) =>
        formatTeamScoutPlayingPositionEntries(
          snapshot?.playingPositions,
          messages
        ) ?? messages.unknownShort,
    },
    {
      key: "mainSkillEstimation",
      label: messages.clubChronicleMainSkillEstimationColumn,
      headerAccessory: effectiveToggle,
      getValue: (snapshot) =>
        formatMainSkillEstimation(
          snapshot,
          messages,
          showEffectiveMainSkillEstimation
        ),
      getSortValue: (snapshot) =>
        resolveMainSkillSortValue(snapshot, showEffectiveMainSkillEstimation),
      renderCell: (snapshot) =>
        formatMainSkillEstimation(
          snapshot,
          messages,
          showEffectiveMainSkillEstimation
        ),
    },
    {
      key: "form7Rating",
      label: messages.clubChronicleForm7RatingColumn,
      headerTooltipContent: messages.clubChronicleForm7RatingInfoTooltip,
      getValue: (snapshot) =>
        snapshot?.form7Ratings
          ?.map((entry) => {
            const positionLabel = positionLabelShortByRoleId(
              entry.roleId,
              messages
            );
            const weatherEmoji = resolveWeatherEmoji(entry.weatherId);
            return positionLabel
              ? `${entry.ratingStarsEndOfMatch} (${positionLabel}) ${weatherEmoji}`
              : `${entry.ratingStarsEndOfMatch} ${weatherEmoji}`;
          })
          .join(", ") ?? null,
      getSortValue: (snapshot) =>
        snapshot?.form7Ratings?.[0]?.ratingStarsEndOfMatch ?? null,
      renderCell: (snapshot) =>
        snapshot?.form7Ratings && snapshot.form7Ratings.length > 0 ? (
          <span className={styles.chronicleForm7RatingList}>
            {snapshot.form7Ratings.map((entry, index) => {
              const weatherLabel = resolveWeatherLabel(
                entry.weatherId,
                messages
              );
              const positionLabel = positionLabelShortByRoleId(
                entry.roleId,
                messages
              );
              return (
                <span
                  key={`${entry.matchId}:${entry.sourceSystem}:${entry.ratingStarsEndOfMatch}:${entry.weatherId}`}
                  className={styles.chronicleForm7RatingItem}
                >
                  <a
                    className={styles.chroniclePressLink}
                    href={hattrickMatchUrlWithSourceSystem(
                      entry.matchId,
                      entry.sourceSystem
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {entry.ratingStarsEndOfMatch}
                  </a>
                  {positionLabel ? ` (${positionLabel}) ` : " "}
                  <Tooltip content={weatherLabel}>
                    <span
                      className={styles.chronicleForm7WeatherEmoji}
                      aria-label={weatherLabel}
                    >
                      {resolveWeatherEmoji(entry.weatherId)}
                    </span>
                  </Tooltip>
                  {index < snapshot.form7Ratings.length - 1 ? ", " : null}
                </span>
              );
            })}
          </span>
        ) : (
          messages.unknownShort
        ),
    },
    {
      key: "manMarker",
      label: messages.clubChronicleManMarkerColumn,
      headerTooltipContent: messages.clubChronicleManMarkerTooltip,
      getValue: (snapshot) => (snapshot?.usedAsManMarker ? "✓" : null),
      getSortValue: (snapshot) => (snapshot?.usedAsManMarker ? 1 : 0),
      renderCell: (snapshot) => (snapshot?.usedAsManMarker ? "✓" : ""),
    },
    {
      key: "form",
      label: messages.clubChroniclePlayerFormColumn,
      getValue: (snapshot) => snapshot?.form ?? null,
    },
    {
      key: "stamina",
      label: messages.clubChroniclePlayerStaminaColumn,
      getValue: (snapshot) => snapshot?.stamina ?? null,
    },
    {
      key: "experience",
      label: messages.clubChroniclePlayerExperienceColumn,
      getValue: (snapshot) => snapshot?.experience ?? null,
    },
    {
      key: "leadership",
      label: messages.clubChroniclePlayerLeadershipColumn,
      getValue: (snapshot) => snapshot?.leadership ?? null,
    },
    {
      key: "loyalty",
      label: messages.clubChroniclePlayerLoyaltyColumn,
      getValue: (snapshot) => snapshot?.loyalty ?? null,
    },
  ] satisfies ChronicleTableColumn<TeamScoutPlayerRow, TeamScoutPlayerRow>[];
}

const formatDefaultValue = (
  value: string | number | null | undefined,
  messages: Messages
) => {
  if (value === null || value === undefined || value === "") {
    return messages.unknownShort;
  }
  return String(value);
};

export default function TeamScoutDetailTable({
  mode,
  rows,
  messages,
  displayCurrency,
  likelyTraining,
  matchSampleSize,
  onShowAnalyzedMatches = null,
  showMobileLandscapeHint = false,
  showEffectiveMainSkillEstimation,
  onShowEffectiveMainSkillEstimationChange,
  sortState,
  onSortChange,
  maskedTeamId = null,
  maskText,
  isMaskActive = false,
  onMaskedRowClick,
}: TeamScoutDetailTableProps) {
  const columns = useMemo(
    () =>
      buildColumns({
        mode,
        messages,
        displayCurrency,
        showEffectiveMainSkillEstimation,
        onShowEffectiveMainSkillEstimationChange,
      }),
    [
      displayCurrency,
      messages,
      mode,
      onShowEffectiveMainSkillEstimationChange,
      showEffectiveMainSkillEstimation,
    ]
  );
  const sortedRows = useMemo(
    () => sortTeamScoutRows(rows, columns, sortState),
    [columns, rows, sortState]
  );
  const hasForeignWageBonus =
    mode === "wages" && rows.some((row) => row.wageIncludesForeignBonus === true);
  const columnTemplate =
    mode === "wages"
      ? {
          "--cc-columns": columns.length,
          "--cc-template-desktop":
            "60px 164px 82px 102px 168px 142px 150px 56px 68px 74px 66px 82px 78px",
          "--cc-template-mobile":
            "44px 144px 72px 104px 126px 138px 148px 52px 56px 64px 76px 72px 64px",
          "--cc-freeze-second-left-desktop": "60px",
          "--cc-freeze-second-left-mobile": "44px",
        }
      : {
          "--cc-columns": columns.length,
          "--cc-template-desktop":
            "60px 164px 82px 94px 168px 142px 150px 56px 68px 74px 66px 82px 78px",
          "--cc-template-mobile":
            "44px 144px 72px 86px 126px 138px 148px 52px 56px 64px 76px 72px 64px",
          "--cc-freeze-second-left-desktop": "60px",
          "--cc-freeze-second-left-mobile": "44px",
        };

  if (rows.length === 0) {
    return (
      <div className={styles.teamScoutDetailTableLayout}>
        <p className={styles.chronicleEmpty}>{messages.unknownShort}</p>
      </div>
    );
  }

  return (
    <div className={styles.teamScoutDetailTableLayout}>
      {showMobileLandscapeHint ? (
        <span className={styles.mobileYouthLandscapeHint}>
          {messages.mobileChronicleLandscapeHint}
        </span>
      ) : null}
      <ChronicleDetailHorizontalScroll
        refreshKey={`team-scout:${mode}:${columns.length}:${sortedRows.length}`}
        fillHeight
        viewportClassName={styles.chronicleTsiWagesDetailModalTableScroll}
      >
        <ChronicleTable
          columns={columns}
          rows={sortedRows}
          getRowKey={(row) => row.playerId}
          getSnapshot={(row) => row}
          freezeFirstColumnsCount={2}
          className={styles.chronicleTsiWagesDetailTable}
          getRowClassName={(row) =>
            row.isLikelyTrainee ? styles.chronicleLikelyTraineeRow : undefined
          }
          formatValue={(value) => formatDefaultValue(value, messages)}
          style={columnTemplate as CSSProperties}
          sortKey={sortState.key}
          sortDirection={sortState.direction}
          onSort={(key) => onSortChange(key as TeamScoutDetailColumnKey)}
          maskedTeamId={maskedTeamId}
          maskText={maskText}
          isMaskActive={isMaskActive}
          onMaskedRowClick={onMaskedRowClick}
        />
      </ChronicleDetailHorizontalScroll>
      <TeamScoutDetailInfo
        messages={messages}
        likelyTraining={likelyTraining}
        matchSampleSize={matchSampleSize}
        onShowAnalyzedMatches={onShowAnalyzedMatches}
        showForeignWageBonusNote={hasForeignWageBonus}
        variant="footer"
      />
    </div>
  );
}
