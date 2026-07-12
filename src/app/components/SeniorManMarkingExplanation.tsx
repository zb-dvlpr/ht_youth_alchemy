import { ReactNode } from "react";
import { Messages } from "@/lib/i18n";
import { hattrickPlayerUrl } from "@/lib/hattrick/urls";
import {
  SENIOR_MAN_MARKING_EPSILON,
  type SeniorManMarkingMarkerRole,
  type SeniorManMarkingPairDecision,
  type SeniorManMarkingPairEvaluation,
  type SeniorManMarkingTargetRole,
} from "@/lib/seniorManMarking";
import styles from "../page.module.css";

export type SeniorManMarkingExplanationPlayer = {
  id: number;
  name: string;
};

export type SeniorManMarkingExplanationMarker = SeniorManMarkingExplanationPlayer & {
  slot: string;
  role: SeniorManMarkingMarkerRole;
  specialty: number | null;
  specialtyLabel: string;
  specialtyMultiplier: number;
  baseEffectiveDefending: number;
  adjustedMarkingStrength: number;
  normalRoleValue: number;
};

export type SeniorManMarkingExplanationTarget = SeniorManMarkingExplanationPlayer & {
  role: SeniorManMarkingTargetRole;
  specialty: number | null;
  specialtyLabel: string;
  specialtyMultiplier: number;
  observedRoleCount: number;
  analysedMatchCount: number;
  roleConsistencyPercent: number;
  detailsLoaded: boolean;
  estimatedRawMainSkill: number | null;
  estimatedEffectiveMainSkill: number | null;
  adjustedTargetComparisonStrength: number | null;
  mainSkillEstimateKind: "estimated" | "tooOld" | "unavailable" | "detailsUnavailable";
  estimateFailureReason:
    | "detailsUnavailable"
    | "salaryUnavailable"
    | "ageUnavailable"
    | "tooOld"
    | "rawEstimateUnavailable"
    | "formUnavailable"
    | "staminaUnavailable"
    | "effectiveCalculationUnavailable"
    | null;
};

export type SeniorManMarkingExplanationPair = {
  evaluation: SeniorManMarkingPairEvaluation;
  marker: SeniorManMarkingExplanationMarker;
  target: SeniorManMarkingExplanationTarget;
};

export type SeniorManMarkingExplanationSource =
  | "recommended"
  | "noRecommendation"
  | "manual"
  | "loaded"
  | "modifiedRecommendation"
  | "modifiedLoaded";

export type SeniorManMarkingExplanationData = {
  enabled: boolean;
  loading: boolean;
  source: SeniorManMarkingExplanationSource;
  currentMarker: SeniorManMarkingExplanationMarker | null;
  currentTarget: SeniorManMarkingExplanationTarget | null;
  currentPair: SeniorManMarkingExplanationPair | null;
  originalRecommendedPair: SeniorManMarkingExplanationPair | null;
  nextBestPair: SeniorManMarkingExplanationPair | null;
  bestRejectedPair: SeniorManMarkingExplanationPair | null;
  decision: SeniorManMarkingPairDecision | null;
  markerStatus: "noEligiblePosition" | "dataUnavailable" | "validMarkers";
  targetStatus:
    | "noOpponent"
    | "noHistory"
    | "noConsistentTarget"
    | "detailsUnavailable"
    | "estimateUnavailable"
    | "validTargets"
    | "roleUnknown";
  validMarkers: SeniorManMarkingExplanationMarker[];
  validTargets: SeniorManMarkingExplanationTarget[];
  excludedMarkerMessages: string[];
  potentialTargetCount: number;
  analysedMatchCount: number;
  consistencyThreshold: number;
  markerSelected: boolean;
  targetSelected: boolean;
  markerInvalidReason: string | null;
  targetInvalidReason: string | null;
};

const formatNumber = (locale: string, value: number, digits = 2) => {
  const normalized = Math.abs(value) <= SENIOR_MAN_MARKING_EPSILON ? 0 : value;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(normalized);
};

const formatPercent = (locale: string, value: number, digits = 1) =>
  `${formatNumber(locale, value * 100, digits)}%`;

const formatConsistencyPercent = (locale: string, value: number) =>
  `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value)}%`;

const playerLink = (player: SeniorManMarkingExplanationPlayer) => (
  <a
    className={styles.chroniclePressLink}
    href={hattrickPlayerUrl(player.id)}
    target="_blank"
    rel="noreferrer"
  >
    {player.name}
  </a>
);

const sourceLabel = (
  messages: Messages,
  source: SeniorManMarkingExplanationSource
) => {
  switch (source) {
    case "recommended":
      return messages.seniorOtherOrdersManMarkingSourceRecommended;
    case "noRecommendation":
      return messages.seniorOtherOrdersManMarkingSourceNoRecommendation;
    case "loaded":
      return messages.seniorOtherOrdersManMarkingSourceLoaded;
    case "modifiedRecommendation":
      return messages.seniorOtherOrdersManMarkingSourceModifiedRecommendation;
    case "modifiedLoaded":
      return messages.seniorOtherOrdersManMarkingSourceModifiedLoaded;
    case "manual":
    default:
      return messages.seniorOtherOrdersManMarkingSourceManual;
  }
};

const roleLabel = (
  messages: Messages,
  role: SeniorManMarkingMarkerRole | SeniorManMarkingTargetRole
) => {
  switch (role) {
    case "CD":
      return messages.seniorOtherOrdersManMarkingRoleCentralDefender;
    case "WB":
      return messages.seniorOtherOrdersManMarkingRoleWingback;
    case "IM":
      return messages.seniorOtherOrdersManMarkingRoleInnerMidfielder;
    case "F":
      return messages.seniorOtherOrdersManMarkingRoleForward;
    case "W":
      return messages.seniorOtherOrdersManMarkingRoleWinger;
  }
};

const pairResultLabel = (messages: Messages, netBenefit: number) => {
  if (netBenefit > SENIOR_MAN_MARKING_EPSILON) {
    return messages.seniorOtherOrdersManMarkingPositiveResult;
  }
  if (netBenefit < -SENIOR_MAN_MARKING_EPSILON) {
    return messages.seniorOtherOrdersManMarkingNegativeResult;
  }
  return messages.seniorOtherOrdersManMarkingNeutralResult;
};

const metric = (label: string, value: ReactNode) => (
  <div className={styles.seniorManMarkingMetric}>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const pairMetrics = (
  messages: Messages,
  locale: string,
  pair: SeniorManMarkingExplanationPair
) => {
  const { evaluation } = pair;
  return (
    <dl className={styles.seniorManMarkingMetrics}>
      {metric(
        messages.seniorOtherOrdersManMarkingTargetLoss,
        formatPercent(locale, evaluation.targetLossFraction)
      )}
      {metric(
        messages.seniorOtherOrdersManMarkingTargetRetained,
        formatPercent(locale, 1 - evaluation.targetLossFraction)
      )}
      {metric(
        messages.seniorOtherOrdersManMarkingMarkerPenalty,
        formatPercent(locale, evaluation.markerSelfPenaltyFraction)
      )}
      {metric(
        messages.seniorOtherOrdersManMarkingTargetValueRemoved,
        formatNumber(locale, evaluation.estimatedTargetValueRemoved)
      )}
      {metric(
        messages.seniorOtherOrdersManMarkingMarkerValueLost,
        formatNumber(locale, evaluation.estimatedMarkerValueLost)
      )}
      {metric(
        messages.seniorOtherOrdersManMarkingNetBenefit,
        formatNumber(locale, evaluation.netBenefit)
      )}
    </dl>
  );
};

function renderMarkerSummary(
  messages: Messages,
  locale: string,
  marker: SeniorManMarkingExplanationMarker
) {
  return (
    <li key={marker.id}>
      {playerLink(marker)} · {roleLabel(messages, marker.role)} ·{" "}
      {messages.seniorOtherOrdersManMarkingEffectiveDefending}:{" "}
      {formatNumber(locale, marker.baseEffectiveDefending)} ·{" "}
      {messages.seniorOtherOrdersManMarkingAdjustedStrength}:{" "}
      {formatNumber(locale, marker.adjustedMarkingStrength)} ·{" "}
      {messages.seniorOtherOrdersManMarkingNormalRoleValue}:{" "}
      {formatNumber(locale, marker.normalRoleValue)}
    </li>
  );
}

function renderTargetSummary(
  messages: Messages,
  locale: string,
  target: SeniorManMarkingExplanationTarget
) {
  return (
    <li key={`${target.id}:${target.role}`}>
      {playerLink(target)} · {roleLabel(messages, target.role)} ·{" "}
      {target.observedRoleCount}/{target.analysedMatchCount} (
      {formatConsistencyPercent(locale, target.roleConsistencyPercent)}) ·{" "}
      {messages.seniorOtherOrdersManMarkingEstimatedEffectiveMainSkill}:{" "}
      {target.estimatedEffectiveMainSkill === null
        ? messages.unknownShort
        : formatNumber(locale, target.estimatedEffectiveMainSkill)}
    </li>
  );
}

export default function SeniorManMarkingExplanation({
  data,
  messages,
  locale,
}: {
  data: SeniorManMarkingExplanationData | null;
  messages: Messages;
  locale: string;
}) {
  if (!data?.enabled) return null;

  const currentPair = data.currentPair;
  const selectedPair = data.decision?.selectedPair ?? null;
  const isRecommendedCurrent =
    currentPair !== null &&
    selectedPair !== null &&
    currentPair.evaluation.markerPlayerId === selectedPair.markerPlayerId &&
    currentPair.evaluation.targetPlayerId === selectedPair.targetPlayerId &&
    currentPair.evaluation.targetRole === selectedPair.targetRole;

  return (
    <aside className={styles.seniorManMarkingExplanation} aria-live="polite">
      <div className={styles.seniorManMarkingExplanationHeader}>
        <h4>{messages.seniorOtherOrdersManMarkingExplanationTitle}</h4>
        <span className={styles.seniorManMarkingSourceBadge}>
          {sourceLabel(messages, data.source)}
        </span>
      </div>

      {data.loading ? (
        <p className={styles.seniorOtherOrdersEmpty}>
          {messages.seniorOtherOrdersManMarkingLoading}
        </p>
      ) : null}

      {!data.loading && currentPair ? (
        <>
          <section className={styles.seniorManMarkingExplanationSection}>
            <h5>{messages.seniorOtherOrdersManMarkingRecommendationTitle}</h5>
            <p>
              {isRecommendedCurrent
                ? messages.seniorOtherOrdersManMarkingRecommendationSummary
                    .replace(
                      "{{count}}",
                      String(data.decision?.totalEvaluationCount ?? 0)
                    )
                : messages.seniorOtherOrdersManMarkingCurrentPairSummary}
            </p>
            <p>
              {playerLink(currentPair.marker)} {" → "} {playerLink(currentPair.target)} (
              {roleLabel(messages, currentPair.target.role)})
            </p>
          </section>

          <section className={styles.seniorManMarkingExplanationSection}>
            <h5>{messages.seniorOtherOrdersManMarkingWhyTargetTitle}</h5>
            <p>
              {messages.seniorOtherOrdersManMarkingTargetConsistency
                .replace("{{role}}", roleLabel(messages, currentPair.target.role))
                .replace("{{count}}", String(currentPair.target.observedRoleCount))
                .replace("{{total}}", String(currentPair.target.analysedMatchCount))
                .replace(
                  "{{percent}}",
                  formatConsistencyPercent(locale, currentPair.target.roleConsistencyPercent)
                )}
            </p>
            <dl className={styles.seniorManMarkingMetrics}>
              {metric(
                messages.seniorOtherOrdersManMarkingEstimatedRawMainSkill,
                currentPair.target.estimatedRawMainSkill === null
                  ? messages.unknownShort
                  : formatNumber(locale, currentPair.target.estimatedRawMainSkill)
              )}
              {metric(
                messages.seniorOtherOrdersManMarkingEstimatedEffectiveMainSkill,
                currentPair.target.estimatedEffectiveMainSkill === null
                  ? messages.unknownShort
                  : formatNumber(locale, currentPair.target.estimatedEffectiveMainSkill)
              )}
              {metric(
                messages.seniorOtherOrdersManMarkingSpecialty,
                currentPair.target.specialtyLabel
              )}
              {metric(
                messages.seniorOtherOrdersManMarkingTargetSpecialtyMultiplier,
                `${formatNumber(locale, currentPair.target.specialtyMultiplier, 2)}×`
              )}
              {metric(
                messages.seniorOtherOrdersManMarkingAdjustedTargetStrength,
                currentPair.target.adjustedTargetComparisonStrength === null
                  ? messages.unknownShort
                  : formatNumber(locale, currentPair.target.adjustedTargetComparisonStrength)
              )}
            </dl>
            <p>{messages.seniorOtherOrdersManMarkingTargetChosenAsPair}</p>
          </section>

          <section className={styles.seniorManMarkingExplanationSection}>
            <h5>{messages.seniorOtherOrdersManMarkingWhyMarkerTitle}</h5>
            <p>
              {messages.seniorOtherOrdersManMarkingMarkerSummary
                .replace("{{role}}", roleLabel(messages, currentPair.marker.role))
                .replace(
                  "{{defending}}",
                  formatNumber(locale, currentPair.marker.baseEffectiveDefending)
                )
                .replace(
                  "{{adjusted}}",
                  formatNumber(locale, currentPair.marker.adjustedMarkingStrength)
                )
                .replace(
                  "{{normal}}",
                  formatNumber(locale, currentPair.marker.normalRoleValue)
                )}
            </p>
            <p>
              {messages.seniorOtherOrdersManMarkingMarkerSpecialtyEffect
                .replace("{{specialty}}", currentPair.marker.specialtyLabel)
                .replace(
                  "{{multiplier}}",
                  `${formatNumber(locale, currentPair.marker.specialtyMultiplier, 2)}×`
                )}
            </p>
          </section>

          <section className={styles.seniorManMarkingExplanationSection}>
            <h5>{messages.seniorOtherOrdersManMarkingExpectedEffectTitle}</h5>
            <p>{pairResultLabel(messages, currentPair.evaluation.netBenefit)}</p>
            <p>
              {currentPair.evaluation.markerSelfPenaltyFraction === 0.5
                ? messages.seniorOtherOrdersManMarkingClosePenaltyReason
                : messages.seniorOtherOrdersManMarkingDistantPenaltyReason}
            </p>
            {pairMetrics(messages, locale, currentPair)}
          </section>

          {data.nextBestPair ? (
            <section className={styles.seniorManMarkingExplanationSection}>
              <h5>{messages.seniorOtherOrdersManMarkingAlternativesTitle}</h5>
              <p>
                {messages.seniorOtherOrdersManMarkingAlternativeSummary
                  .replace(
                    "{{net}}",
                    formatNumber(locale, data.nextBestPair.evaluation.netBenefit)
                  )
                  .replace(
                    "{{difference}}",
                    formatNumber(
                      locale,
                      currentPair.evaluation.netBenefit -
                        data.nextBestPair.evaluation.netBenefit
                    )
                  )}
              </p>
              <p>
                {playerLink(data.nextBestPair.marker)} {" → "}{" "}
                {playerLink(data.nextBestPair.target)}
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {!data.loading && !currentPair ? (
        <>
          <section className={styles.seniorManMarkingExplanationSection}>
            <h5>{messages.seniorOtherOrdersManMarkingTargetAssessmentTitle}</h5>
            <p>
              {data.targetInvalidReason ??
                (data.targetStatus === "noOpponent"
                  ? messages.seniorOtherOrdersManMarkingNoOpponent
                  : data.targetStatus === "noHistory"
                    ? messages.seniorOtherOrdersManMarkingNoHistory
                    : data.targetStatus === "noConsistentTarget"
                      ? messages.seniorOtherOrdersManMarkingNoConsistentTarget
                      : data.targetStatus === "detailsUnavailable"
                        ? messages.seniorOtherOrdersManMarkingTargetDetailsUnavailable
                        : data.targetStatus === "estimateUnavailable"
                          ? messages.seniorOtherOrdersManMarkingTargetEstimateUnavailable
                          : data.targetStatus === "roleUnknown"
                            ? messages.seniorOtherOrdersManMarkingTargetRoleUnknown
                            : messages.seniorOtherOrdersManMarkingValidTargets)}
            </p>
            {data.validTargets.length ? (
              <ul className={styles.seniorManMarkingCompactList}>
                {data.validTargets.slice(0, 5).map((target) =>
                  renderTargetSummary(messages, locale, target)
                )}
              </ul>
            ) : null}
          </section>

          <section className={styles.seniorManMarkingExplanationSection}>
            <h5>{messages.seniorOtherOrdersManMarkingMarkerAssessmentTitle}</h5>
            <p>
              {data.markerInvalidReason ??
                (data.markerStatus === "noEligiblePosition"
                  ? messages.seniorOtherOrdersManMarkingNoEligibleMarker
                  : data.markerStatus === "dataUnavailable"
                    ? messages.seniorOtherOrdersManMarkingMarkerDataUnavailable
                    : messages.seniorOtherOrdersManMarkingValidMarkers)}
            </p>
            {data.validMarkers.length ? (
              <ul className={styles.seniorManMarkingCompactList}>
                {data.validMarkers.slice(0, 5).map((marker) =>
                  renderMarkerSummary(messages, locale, marker)
                )}
              </ul>
            ) : null}
            {data.excludedMarkerMessages.length ? (
              <ul className={styles.seniorManMarkingCompactList}>
                {data.excludedMarkerMessages.slice(0, 4).map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className={styles.seniorManMarkingExplanationSection}>
            <h5>{messages.seniorOtherOrdersManMarkingPairAssessmentTitle}</h5>
            {!data.markerSelected ? (
              <p>{messages.seniorOtherOrdersManMarkingNoMarkerSelected}</p>
            ) : null}
            {!data.targetSelected ? (
              <p>{messages.seniorOtherOrdersManMarkingNoTargetSelected}</p>
            ) : null}
            {data.bestRejectedPair ? (
              <>
                <p>{messages.seniorOtherOrdersManMarkingNoPositivePair}</p>
                <p>
                  {messages.seniorOtherOrdersManMarkingBestRejectedPair}{" "}
                  {playerLink(data.bestRejectedPair.marker)} {" → "}{" "}
                  {playerLink(data.bestRejectedPair.target)}
                </p>
                {pairMetrics(messages, locale, data.bestRejectedPair)}
              </>
            ) : null}
          </section>
        </>
      ) : null}

      <section className={styles.seniorManMarkingCaveat}>
        <h5>{messages.seniorOtherOrdersManMarkingLimitationsTitle}</h5>
        <p>
          {currentPair
            ? messages.seniorOtherOrdersManMarkingRecommendationCaveat
            : messages.seniorOtherOrdersManMarkingNoRecommendationCaveat}
        </p>
      </section>
    </aside>
  );
}
