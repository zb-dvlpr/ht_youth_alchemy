import { Fragment, ReactNode } from "react";
import { Messages } from "@/lib/i18n";
import { hattrickPlayerUrl } from "@/lib/hattrick/urls";
import {
  SENIOR_MAN_MARKING_EPSILON,
  isSeniorManMarkingCloseRolePair,
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

export type SeniorManMarkingExplanationTargetDiagnostic =
  SeniorManMarkingExplanationPlayer & {
    role: SeniorManMarkingTargetRole;
    observedRoleCount: number;
    analysedMatchCount: number;
    roleConsistencyPercent: number;
    detailsLoaded: boolean;
    estimatedRawMainSkill: number | null;
    estimatedEffectiveMainSkill: number | null;
    failureReason: SeniorManMarkingExplanationTarget["estimateFailureReason"];
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
  failedTargets: SeniorManMarkingExplanationTargetDiagnostic[];
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

const renderTemplateWithPlayer = (
  template: string,
  player: SeniorManMarkingExplanationPlayer,
  replacements: Record<string, string>
) => {
  const parts: ReactNode[] = [];
  const pattern = /{{(player|[a-zA-Z0-9_]+)}}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index));
    }
    const token = match[1];
    if (token === "player") {
      parts.push(playerLink(player));
    } else {
      parts.push(replacements[token] ?? "");
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex));
  }
  return parts.map((part, index) => (
    <Fragment key={`${typeof part === "string" ? part : "node"}-${index}`}>
      {part}
    </Fragment>
  ));
};

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

const targetSkillLabel = (
  messages: Messages,
  role: SeniorManMarkingTargetRole
) => {
  switch (role) {
    case "F":
      return messages.skillScoring;
    case "W":
      return messages.skillWinger;
    case "IM":
      return messages.skillPlaymaking;
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

type MetricVariant = "default" | "positive" | "negative";

const metric = (label: string, value: ReactNode, variant: MetricVariant = "default") => (
  <div
    className={`${styles.seniorManMarkingMetric} ${
      variant === "positive"
        ? styles.seniorManMarkingMetricPositive
        : variant === "negative"
          ? styles.seniorManMarkingMetricNegative
          : ""
    }`}
  >
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const netBenefitVariant = (netBenefit: number): MetricVariant => {
  if (netBenefit > SENIOR_MAN_MARKING_EPSILON) return "positive";
  if (netBenefit < -SENIOR_MAN_MARKING_EPSILON) return "negative";
  return "default";
};

const formatAlternativeSummary = (
  messages: Messages,
  locale: string,
  recommendedPair: SeniorManMarkingExplanationPair,
  alternativePair: SeniorManMarkingExplanationPair
) => {
  const recommendedNetBenefit = recommendedPair.evaluation.netBenefit;
  const alternativeNetBenefit = alternativePair.evaluation.netBenefit;
  const difference = recommendedNetBenefit - alternativeNetBenefit;
  const formattedNetBenefit = formatNumber(locale, alternativeNetBenefit);

  if (Math.abs(difference) <= SENIOR_MAN_MARKING_EPSILON) {
    return messages.seniorOtherOrdersManMarkingAlternativeSummaryEqual.replace(
      "{{net}}",
      formattedNetBenefit
    );
  }

  const template =
    difference > SENIOR_MAN_MARKING_EPSILON
      ? messages.seniorOtherOrdersManMarkingAlternativeSummaryLower
      : messages.seniorOtherOrdersManMarkingAlternativeSummaryHigher;

  return template
    .replace("{{net}}", formattedNetBenefit)
    .replace("{{difference}}", formatNumber(locale, Math.abs(difference)));
};

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
        formatNumber(locale, evaluation.netBenefit),
        netBenefitVariant(evaluation.netBenefit)
      )}
    </dl>
  );
};

function targetFailureReasonMessage(
  messages: Messages,
  target: SeniorManMarkingExplanationTargetDiagnostic,
  locale: string
) {
  const rawSkill =
    target.estimatedRawMainSkill === null
      ? messages.unknownShort
      : formatNumber(locale, target.estimatedRawMainSkill);
  const replacements = {
    skill: targetSkillLabel(messages, target.role),
    rawSkill,
  };
  switch (target.failureReason) {
    case "detailsUnavailable":
      return messages.seniorOtherOrdersManMarkingTargetFailureDetails;
    case "salaryUnavailable":
      return messages.seniorOtherOrdersManMarkingTargetFailureSalary.replace(
        "{{skill}}",
        replacements.skill
      );
    case "ageUnavailable":
      return messages.seniorOtherOrdersManMarkingTargetFailureAge.replace(
        "{{skill}}",
        replacements.skill
      );
    case "tooOld":
      return messages.seniorOtherOrdersManMarkingTargetFailureTooOld;
    case "rawEstimateUnavailable":
      return messages.seniorOtherOrdersManMarkingTargetFailureRawEstimate.replace(
        "{{skill}}",
        replacements.skill
      );
    case "formUnavailable":
      return messages.seniorOtherOrdersManMarkingTargetFailureForm
        .replace("{{skill}}", replacements.skill)
        .replace("{{rawSkill}}", replacements.rawSkill);
    case "staminaUnavailable":
      return messages.seniorOtherOrdersManMarkingTargetFailureStamina
        .replace("{{skill}}", replacements.skill)
        .replace("{{rawSkill}}", replacements.rawSkill);
    case "effectiveCalculationUnavailable":
      return messages.seniorOtherOrdersManMarkingTargetFailureEffective
        .replace("{{skill}}", replacements.skill)
        .replace("{{rawSkill}}", replacements.rawSkill);
    case null:
      return messages.seniorOtherOrdersManMarkingTargetEstimateUnavailable;
  }
}

function renderFailedTargetDiagnostic(
  messages: Messages,
  locale: string,
  target: SeniorManMarkingExplanationTargetDiagnostic
) {
  const consistency = renderTemplateWithPlayer(
    messages.seniorOtherOrdersManMarkingTargetFailureConsistency,
    target,
    {
      role: roleLabel(messages, target.role),
      count: String(target.observedRoleCount),
      total: String(target.analysedMatchCount),
      percent: formatConsistencyPercent(locale, target.roleConsistencyPercent),
    }
  );
  return (
    <li key={`${target.id}:${target.role}`}>
      {consistency} {targetFailureReasonMessage(messages, target, locale)}
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
    data.source === "recommended" &&
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
            <h5>
              {isRecommendedCurrent
                ? messages.seniorOtherOrdersManMarkingRecommendationTitle
                : messages.seniorOtherOrdersManMarkingSelectedPairTitle}
            </h5>
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
            {isRecommendedCurrent ? (
              <p>{messages.seniorOtherOrdersManMarkingTargetChosenAsPair}</p>
            ) : null}
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
              {(isSeniorManMarkingCloseRolePair(
                currentPair.marker.role,
                currentPair.target.role
              )
                ? messages.seniorOtherOrdersManMarkingClosePenaltyReason
                : messages.seniorOtherOrdersManMarkingDistantPenaltyReason
              )
                .replace("{{markerRole}}", roleLabel(messages, currentPair.marker.role))
                .replace("{{targetRole}}", roleLabel(messages, currentPair.target.role))
                .replace(
                  "{{penalty}}",
                  formatPercent(locale, currentPair.evaluation.markerSelfPenaltyFraction)
                )}
            </p>
            {pairMetrics(messages, locale, currentPair)}
          </section>

          {isRecommendedCurrent && data.nextBestPair ? (
            <section className={styles.seniorManMarkingExplanationSection}>
              <h5>{messages.seniorOtherOrdersManMarkingAlternativesTitle}</h5>
              <p>
                {formatAlternativeSummary(
                  messages,
                  locale,
                  currentPair,
                  data.nextBestPair
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
          {data.markerInvalidReason || data.targetInvalidReason ? (
            <section className={styles.seniorManMarkingExplanationSection}>
              <h5>{messages.seniorOtherOrdersManMarkingSelectedPairTitle}</h5>
              {data.markerInvalidReason ? <p>{data.markerInvalidReason}</p> : null}
              {data.targetInvalidReason ? <p>{data.targetInvalidReason}</p> : null}
            </section>
          ) : (
            <>
              <section className={styles.seniorManMarkingExplanationSection}>
                <h5>{messages.seniorOtherOrdersManMarkingTargetAssessmentTitle}</h5>
                <p>
                  {data.targetStatus === "noOpponent"
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
                              : messages.seniorOtherOrdersManMarkingValidTargets}
                </p>
                {!data.validTargets.length && data.failedTargets.length ? (
                  <>
                    <p>
                      {messages.seniorOtherOrdersManMarkingTargetFailuresIntro.replace(
                        "{{count}}",
                        String(data.failedTargets.length)
                      )}
                    </p>
                    <ul className={styles.seniorManMarkingCompactList}>
                      {data.failedTargets.slice(0, 6).map((target) =>
                        renderFailedTargetDiagnostic(messages, locale, target)
                      )}
                    </ul>
                  </>
                ) : null}
              </section>

              <section className={styles.seniorManMarkingExplanationSection}>
                <h5>{messages.seniorOtherOrdersManMarkingMarkerAssessmentTitle}</h5>
                <p>
                  {data.markerStatus === "noEligiblePosition"
                    ? messages.seniorOtherOrdersManMarkingNoEligibleMarker
                    : data.markerStatus === "dataUnavailable"
                      ? messages.seniorOtherOrdersManMarkingMarkerDataUnavailable
                      : messages.seniorOtherOrdersManMarkingValidMarkers}
                </p>
                {data.excludedMarkerMessages.length ? (
                  <ul className={styles.seniorManMarkingCompactList}>
                    {data.excludedMarkerMessages.slice(0, 4).map((message, index) => (
                      <li key={`${message}-${index}`}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            </>
          )}

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
                {data.decision &&
                data.decision.totalEvaluationCount > 0 &&
                data.decision.positiveEvaluationCount === 0 ? (
                  <p>{messages.seniorOtherOrdersManMarkingNoPositivePair}</p>
                ) : null}
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
