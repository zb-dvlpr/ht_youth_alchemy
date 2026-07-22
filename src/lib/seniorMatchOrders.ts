export const SENIOR_ORDER_DEFAULT_MINUTE = -1;
export const SENIOR_ORDER_DEFAULT_CONDITION = -1;
export const SENIOR_ORDER_DEFAULT_POSITION = -1;
export const SENIOR_ORDER_DEFAULT_BEHAVIOUR = -1;

export type SeniorManMarkingOrderOrigin = "generated" | "loaded" | "manual";

export type SeniorMatchOrderSubstitution = {
  playerin: number;
  playerout: number;
  orderType: number;
  min: number;
  pos: number;
  beh: number;
  card: number;
  standing: number;
};

export type SeniorMatchOrdersLineupPayload = {
  positions: Array<{ id: number; behaviour: number }>;
  bench: Array<{ id: number; behaviour: number }>;
  kickers: Array<{ id: number; behaviour: number }>;
  captain: number;
  setPieces: number;
  settings: {
    tactic: number;
    speechLevel: number;
    newLineup: string;
    coachModifier: number;
    manMarkerPlayerId: number;
    manMarkingPlayerId: number;
  };
  substitutions: SeniorMatchOrderSubstitution[];
};

export type SeniorEditablePlayerOrder = {
  id: string;
  orderType: 1 | 3 | 4;
  minute: number;
  standing: number;
  card: number;
  subjectPlayerId: number | null;
  objectPlayerId: number | null;
  newPositionId: number;
  newPositionBehaviour: number;
};

export type SeniorEditableOrdersState = {
  matchId: number | null;
  source: "generated" | "loaded" | "manual" | "mixed";
  manMarkingOrigin: SeniorManMarkingOrderOrigin;
  manMarkingTouched: boolean;
  matchAttitude: number | null;
  coachModifier: number | null;
  playerOrders: SeniorEditablePlayerOrder[];
  manMarkingOrder: SeniorEditablePlayerOrder | null;
  penaltyTakerIds: number[];
  captainPlayerId: number | null;
  setPiecesPlayerId: number | null;
};

const normalizeSeniorEditableOrderType = (
  value: number
): SeniorEditablePlayerOrder["orderType"] => {
  if (value === 3 || value === 4) return value;
  return 1;
};

const seniorEditableOrderId = (
  matchId: number | null,
  order: SeniorMatchOrderSubstitution,
  index: number
) =>
  [
    "order",
    matchId ?? "draft",
    index,
    order.orderType,
    order.min,
    order.playerout,
    order.playerin,
    order.pos,
    order.beh,
  ].join("-");

const buildSeniorEditableOrderFromSubstitution = (
  matchId: number | null,
  order: SeniorMatchOrderSubstitution,
  index: number
): SeniorEditablePlayerOrder => ({
  id: seniorEditableOrderId(matchId, order, index),
  orderType: normalizeSeniorEditableOrderType(order.orderType),
  minute: Number.isFinite(order.min) ? order.min : SENIOR_ORDER_DEFAULT_MINUTE,
  standing: Number.isFinite(order.standing)
    ? order.standing
    : SENIOR_ORDER_DEFAULT_CONDITION,
  card: Number.isFinite(order.card) ? order.card : SENIOR_ORDER_DEFAULT_CONDITION,
  subjectPlayerId:
    Number.isFinite(order.playerout) && order.playerout > 0 ? order.playerout : null,
  objectPlayerId:
    Number.isFinite(order.playerin) && order.playerin > 0 ? order.playerin : null,
  newPositionId: Number.isFinite(order.pos) ? order.pos : SENIOR_ORDER_DEFAULT_POSITION,
  newPositionBehaviour: Number.isFinite(order.beh)
    ? order.beh
    : SENIOR_ORDER_DEFAULT_BEHAVIOUR,
});

export const buildSeniorEditableOrdersFromPayload = (
  matchId: number | null,
  payload: SeniorMatchOrdersLineupPayload,
  source: SeniorManMarkingOrderOrigin,
  options: {
    manMarkingOrigin?: SeniorManMarkingOrderOrigin;
    manMarkingTouched?: boolean;
  } = {}
): SeniorEditableOrdersState => {
  const editableOrders = (payload.substitutions ?? []).map((order, index) =>
    buildSeniorEditableOrderFromSubstitution(matchId, order, index)
  );
  const loadedManMarkingOrder =
    editableOrders.find((order) => order.orderType === 4) ??
    (payload.settings.manMarkerPlayerId > 0 || payload.settings.manMarkingPlayerId > 0
      ? {
          id: `man-marking-${matchId ?? "draft"}`,
          orderType: 4,
          minute: SENIOR_ORDER_DEFAULT_MINUTE,
          standing: SENIOR_ORDER_DEFAULT_CONDITION,
          card: SENIOR_ORDER_DEFAULT_CONDITION,
          subjectPlayerId:
            payload.settings.manMarkerPlayerId > 0
              ? payload.settings.manMarkerPlayerId
              : null,
          objectPlayerId:
            payload.settings.manMarkingPlayerId > 0
              ? payload.settings.manMarkingPlayerId
              : null,
          newPositionId: SENIOR_ORDER_DEFAULT_POSITION,
          newPositionBehaviour: SENIOR_ORDER_DEFAULT_BEHAVIOUR,
        }
      : null);
  return {
    matchId,
    source,
    manMarkingOrigin: options.manMarkingOrigin ?? source,
    manMarkingTouched: options.manMarkingTouched ?? false,
    matchAttitude:
      typeof payload.settings?.speechLevel === "number" ? payload.settings.speechLevel : null,
    coachModifier:
      typeof payload.settings?.coachModifier === "number"
        ? payload.settings.coachModifier
        : null,
    playerOrders: editableOrders.filter((order) => order.orderType !== 4),
    manMarkingOrder: loadedManMarkingOrder,
    penaltyTakerIds: (payload.kickers ?? [])
      .map((kicker) => Number(kicker.id) || 0)
      .slice(0, 11),
    captainPlayerId: payload.captain > 0 ? payload.captain : null,
    setPiecesPlayerId: payload.setPieces > 0 ? payload.setPieces : null,
  };
};

export const serializeSeniorEditableOrdersToPayload = (
  payload: SeniorMatchOrdersLineupPayload,
  orders: SeniorEditableOrdersState,
  options: {
    includeMatchAttitude: boolean;
    includeCoachModifier: boolean;
  }
): SeniorMatchOrdersLineupPayload => {
  const serializeEditableOrder = (order: SeniorEditablePlayerOrder) => ({
    playerin: Number(order.objectPlayerId ?? 0) || 0,
    playerout: Number(order.subjectPlayerId ?? 0) || 0,
    orderType: order.orderType,
    min: Number.isFinite(order.minute) ? order.minute : SENIOR_ORDER_DEFAULT_MINUTE,
    pos: Number.isFinite(order.newPositionId)
      ? order.newPositionId
      : SENIOR_ORDER_DEFAULT_POSITION,
    beh: Number.isFinite(order.newPositionBehaviour)
      ? order.newPositionBehaviour
      : SENIOR_ORDER_DEFAULT_BEHAVIOUR,
    card: Number.isFinite(order.card) ? order.card : SENIOR_ORDER_DEFAULT_CONDITION,
    standing: Number.isFinite(order.standing)
      ? order.standing
      : SENIOR_ORDER_DEFAULT_CONDITION,
  });
  return {
    ...payload,
    kickers: Array.from({ length: 11 }, (_, index) => ({
      id: Number(orders.penaltyTakerIds[index] ?? 0) || 0,
      behaviour: 0,
    })),
    captain: Number(orders.captainPlayerId ?? 0) || 0,
    setPieces: Number(orders.setPiecesPlayerId ?? 0) || 0,
    settings: {
      ...payload.settings,
      speechLevel: options.includeMatchAttitude
        ? Number(orders.matchAttitude ?? 0) || 0
        : payload.settings.speechLevel,
      coachModifier: options.includeCoachModifier
        ? Number(orders.coachModifier ?? 0) || 0
        : payload.settings.coachModifier,
      manMarkerPlayerId: Number(orders.manMarkingOrder?.subjectPlayerId ?? 0) || 0,
      manMarkingPlayerId: Number(orders.manMarkingOrder?.objectPlayerId ?? 0) || 0,
    },
    substitutions: orders.playerOrders
      .filter((order) => order.orderType !== 4)
      .map(serializeEditableOrder),
  };
};
