export type SeniorManMarkingMarkerRole = "CD" | "WB" | "IM";
export type SeniorManMarkingTargetRole = "F" | "W" | "IM";

export type SeniorManMarkingMarkerCandidate = {
  playerId: number;
  slot: string;
  role: SeniorManMarkingMarkerRole;
  specialty: number | null;
  baseEffectiveDefending: number;
  adjustedMarkingStrength: number;
  normalRoleValue: number;
};

export type SeniorManMarkingTargetCandidate = {
  playerId: number;
  role: SeniorManMarkingTargetRole;
  specialty: number | null;
  estimatedEffectiveMainSkill: number;
};

export type SeniorManMarkingPairEvaluation = {
  markerPlayerId: number;
  markerSlot: string;
  markerRole: SeniorManMarkingMarkerRole;
  targetPlayerId: number;
  targetRole: SeniorManMarkingTargetRole;
  baseEffectiveDefending: number;
  adjustedMarkerStrength: number;
  estimatedEffectiveTargetMainSkill: number;
  adjustedTargetComparisonStrength: number;
  targetLossFraction: number;
  markerSelfPenaltyFraction: number;
  estimatedTargetValueRemoved: number;
  estimatedMarkerValueLost: number;
  normalRoleValue: number;
  netBenefit: number;
};

export type SeniorManMarkingPairDecision = {
  evaluations: SeniorManMarkingPairEvaluation[];
  positiveEvaluations: SeniorManMarkingPairEvaluation[];
  selectedPair: SeniorManMarkingPairEvaluation | null;
  bestRejectedPair: SeniorManMarkingPairEvaluation | null;
  totalEvaluationCount: number;
  positiveEvaluationCount: number;
  nonPositiveEvaluationCount: number;
};

const SPECIALTY_NONE = 0;
const SPECIALTY_TECHNICAL = 1;
const SPECIALTY_POWERFUL = 3;
const SPECIALTY_UNPREDICTABLE = 4;
const MAN_MARKING_EXPONENT = 3.5;
const EPSILON = 1e-9;

const normalizeSpecialty = (specialty: number | null | undefined): number => {
  return typeof specialty === "number" && Number.isFinite(specialty) && specialty > 0
    ? specialty
    : SPECIALTY_NONE;
};

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

export function getSeniorManMarkerSpecialtyMultiplier(
  specialty: number | null | undefined
): number {
  const normalized = normalizeSpecialty(specialty);
  if (normalized === SPECIALTY_POWERFUL) return 1.1;
  if (normalized === SPECIALTY_NONE) return 1.05;
  return 1;
}

export function getSeniorManMarkingTargetSpecialtyMultiplier(
  specialty: number | null | undefined
): number {
  const normalized = normalizeSpecialty(specialty);
  if (normalized === SPECIALTY_TECHNICAL) return 0.92;
  if (normalized === SPECIALTY_UNPREDICTABLE) return 1.08;
  return 1;
}

export function calculateSeniorManMarkingTargetLossFraction(
  markerStrength: number,
  targetStrength: number
): number | null {
  if (!isPositiveFinite(markerStrength) || !isPositiveFinite(targetStrength)) {
    return null;
  }

  const markerPower = Math.pow(markerStrength, MAN_MARKING_EXPONENT);
  const targetPower = Math.pow(targetStrength, MAN_MARKING_EXPONENT);
  const denominator = markerPower + targetPower;
  if (!Number.isFinite(denominator) || denominator <= 0) return null;

  const result = markerPower / denominator;
  if (!Number.isFinite(result) || result < 0 || result > 1) return null;

  return result;
}

export function getSeniorManMarkingSelfPenalty(
  markerRole: SeniorManMarkingMarkerRole,
  targetRole: SeniorManMarkingTargetRole
): 0.5 | 0.65 {
  if (
    (markerRole === "CD" && targetRole === "F") ||
    (markerRole === "WB" && targetRole === "W") ||
    (markerRole === "IM" && targetRole === "IM")
  ) {
    return 0.5;
  }
  return 0.65;
}

export function evaluateSeniorManMarkingPair(
  marker: SeniorManMarkingMarkerCandidate,
  target: SeniorManMarkingTargetCandidate
): SeniorManMarkingPairEvaluation | null {
  if (
    !isPositiveFinite(marker.baseEffectiveDefending) ||
    !isPositiveFinite(marker.adjustedMarkingStrength) ||
    !isPositiveFinite(marker.normalRoleValue) ||
    !isPositiveFinite(target.estimatedEffectiveMainSkill)
  ) {
    return null;
  }

  const adjustedTargetComparisonStrength =
    target.estimatedEffectiveMainSkill *
    getSeniorManMarkingTargetSpecialtyMultiplier(target.specialty);
  const targetLossFraction = calculateSeniorManMarkingTargetLossFraction(
    marker.adjustedMarkingStrength,
    adjustedTargetComparisonStrength
  );
  if (targetLossFraction === null) return null;

  const markerSelfPenaltyFraction = getSeniorManMarkingSelfPenalty(
    marker.role,
    target.role
  );
  const estimatedTargetValueRemoved =
    target.estimatedEffectiveMainSkill * targetLossFraction;
  const estimatedMarkerValueLost =
    marker.normalRoleValue * markerSelfPenaltyFraction;
  const netBenefit = estimatedTargetValueRemoved - estimatedMarkerValueLost;

  return {
    markerPlayerId: marker.playerId,
    markerSlot: marker.slot,
    markerRole: marker.role,
    targetPlayerId: target.playerId,
    targetRole: target.role,
    baseEffectiveDefending: marker.baseEffectiveDefending,
    adjustedMarkerStrength: marker.adjustedMarkingStrength,
    estimatedEffectiveTargetMainSkill: target.estimatedEffectiveMainSkill,
    adjustedTargetComparisonStrength,
    targetLossFraction,
    markerSelfPenaltyFraction,
    estimatedTargetValueRemoved,
    estimatedMarkerValueLost,
    normalRoleValue: marker.normalRoleValue,
    netBenefit,
  };
}

export const SENIOR_MAN_MARKING_EPSILON = EPSILON;

const compareFloating = (left: number, right: number): number => {
  const difference = left - right;
  return Math.abs(difference) <= EPSILON ? 0 : difference;
};

export function compareSeniorManMarkingPairEvaluations(
  left: SeniorManMarkingPairEvaluation,
  right: SeniorManMarkingPairEvaluation
): number {
  const netBenefit = compareFloating(right.netBenefit, left.netBenefit);
  if (netBenefit !== 0) return netBenefit;
  const targetRemoved = compareFloating(
    right.estimatedTargetValueRemoved,
    left.estimatedTargetValueRemoved
  );
  if (targetRemoved !== 0) return targetRemoved;
  const targetLoss = compareFloating(right.targetLossFraction, left.targetLossFraction);
  if (targetLoss !== 0) return targetLoss;
  const selfPenalty = compareFloating(
    left.markerSelfPenaltyFraction,
    right.markerSelfPenaltyFraction
  );
  if (selfPenalty !== 0) return selfPenalty;
  const targetSkill = compareFloating(
    right.estimatedEffectiveTargetMainSkill,
    left.estimatedEffectiveTargetMainSkill
  );
  if (targetSkill !== 0) return targetSkill;
  const markerStrength = compareFloating(
    right.adjustedMarkerStrength,
    left.adjustedMarkerStrength
  );
  if (markerStrength !== 0) return markerStrength;
  const normalRoleValue = compareFloating(right.normalRoleValue, left.normalRoleValue);
  if (normalRoleValue !== 0) return normalRoleValue;
  if (left.targetPlayerId !== right.targetPlayerId) {
    return left.targetPlayerId - right.targetPlayerId;
  }
  if (left.markerPlayerId !== right.markerPlayerId) {
    return left.markerPlayerId - right.markerPlayerId;
  }
  return left.markerSlot.localeCompare(right.markerSlot);
}

export function buildSeniorManMarkingPairDecision(
  markers: SeniorManMarkingMarkerCandidate[],
  targets: SeniorManMarkingTargetCandidate[]
): SeniorManMarkingPairDecision {
  const evaluations = markers
    .flatMap((marker) =>
      targets.map((target) => evaluateSeniorManMarkingPair(marker, target))
    )
    .filter(
      (evaluation): evaluation is SeniorManMarkingPairEvaluation =>
        evaluation !== null
    );
  const positiveEvaluations = evaluations
    .filter(
      (evaluation): evaluation is SeniorManMarkingPairEvaluation =>
        evaluation.netBenefit > EPSILON
    )
    .sort(compareSeniorManMarkingPairEvaluations);
  const rejectedEvaluations = evaluations
    .filter((evaluation) => evaluation.netBenefit <= EPSILON)
    .sort(compareSeniorManMarkingPairEvaluations);

  return {
    evaluations: [...evaluations].sort(compareSeniorManMarkingPairEvaluations),
    positiveEvaluations,
    selectedPair: positiveEvaluations[0] ?? null,
    bestRejectedPair: rejectedEvaluations[0] ?? null,
    totalEvaluationCount: evaluations.length,
    positiveEvaluationCount: positiveEvaluations.length,
    nonPositiveEvaluationCount: rejectedEvaluations.length,
  };
}

export function selectBestSeniorManMarkingPair(
  markers: SeniorManMarkingMarkerCandidate[],
  targets: SeniorManMarkingTargetCandidate[]
): SeniorManMarkingPairEvaluation | null {
  return buildSeniorManMarkingPairDecision(markers, targets).selectedPair;
}
