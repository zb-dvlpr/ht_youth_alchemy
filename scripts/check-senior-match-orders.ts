import assert from "node:assert/strict";
import {
  buildSeniorEditableOrdersFromPayload,
  serializeSeniorEditableOrdersToPayload,
  type SeniorEditableOrdersState,
  type SeniorEditablePlayerOrder,
  type SeniorMatchOrdersLineupPayload,
} from "../src/lib/seniorMatchOrders";

const markerId = 484155761;
const targetId = 488046025;

const basePayload = (
  overrides: Partial<SeniorMatchOrdersLineupPayload> = {}
): SeniorMatchOrdersLineupPayload => ({
  positions: Array.from({ length: 11 }, (_, index) => ({
    id: 1000 + index,
    behaviour: 0,
  })),
  bench: Array.from({ length: 14 }, (_, index) => ({
    id: 2000 + index,
    behaviour: 0,
  })),
  kickers: Array.from({ length: 11 }, () => ({ id: 0, behaviour: 0 })),
  captain: 0,
  setPieces: 0,
  settings: {
    tactic: 0,
    speechLevel: 0,
    newLineup: "",
    coachModifier: 0,
    manMarkerPlayerId: 0,
    manMarkingPlayerId: 0,
  },
  substitutions: [],
  ...overrides,
});

const manMarkingOrder: SeniorEditablePlayerOrder = {
  id: "man-marking",
  orderType: 4,
  subjectPlayerId: markerId,
  objectPlayerId: targetId,
  minute: -1,
  standing: -1,
  card: -1,
  newPositionId: -1,
  newPositionBehaviour: -1,
};

const substitutionOrder: SeniorEditablePlayerOrder = {
  id: "substitution",
  orderType: 1,
  subjectPlayerId: 222,
  objectPlayerId: 111,
  minute: 70,
  standing: -1,
  card: -1,
  newPositionId: -1,
  newPositionBehaviour: -1,
};

const swapOrder: SeniorEditablePlayerOrder = {
  id: "swap",
  orderType: 3,
  subjectPlayerId: 444,
  objectPlayerId: 333,
  minute: 80,
  standing: -1,
  card: -1,
  newPositionId: -1,
  newPositionBehaviour: -1,
};

const editableState = (
  overrides: Partial<SeniorEditableOrdersState> = {}
): SeniorEditableOrdersState => ({
  matchId: 123,
  source: "manual",
  manMarkingOrigin: "manual",
  manMarkingTouched: false,
  matchAttitude: null,
  coachModifier: null,
  playerOrders: [],
  manMarkingOrder: null,
  penaltyTakerIds: [],
  captainPlayerId: null,
  setPiecesPlayerId: null,
  ...overrides,
});

const serialize = (orders: SeniorEditableOrdersState) =>
  serializeSeniorEditableOrdersToPayload(basePayload(), orders, {
    includeMatchAttitude: true,
    includeCoachModifier: true,
  });

{
  const result = serialize(editableState({ manMarkingOrder }));
  assert.equal(result.settings.manMarkerPlayerId, markerId);
  assert.equal(result.settings.manMarkingPlayerId, targetId);
  assert.equal(result.substitutions.length, 0);
}

{
  const result = serialize(
    editableState({
      playerOrders: [substitutionOrder, swapOrder],
      manMarkingOrder,
    })
  );
  assert.equal(result.settings.manMarkerPlayerId, markerId);
  assert.equal(result.settings.manMarkingPlayerId, targetId);
  assert.deepEqual(
    result.substitutions.map((order) => order.orderType),
    [1, 3]
  );
  assert.equal(result.substitutions.some((order) => order.orderType === 4), false);
  assert.deepEqual(result.substitutions[0], {
    playerin: 111,
    playerout: 222,
    orderType: 1,
    min: 70,
    pos: -1,
    beh: -1,
    card: -1,
    standing: -1,
  });
  assert.deepEqual(result.substitutions[1], {
    playerin: 333,
    playerout: 444,
    orderType: 3,
    min: 80,
    pos: -1,
    beh: -1,
    card: -1,
    standing: -1,
  });
}

{
  const result = serialize(
    editableState({
      playerOrders: [substitutionOrder, manMarkingOrder, swapOrder],
      manMarkingOrder,
    })
  );
  assert.equal(result.substitutions.every((order) => order.orderType !== 4), true);
  assert.deepEqual(
    result.substitutions.map((order) => order.orderType),
    [1, 3]
  );
}

{
  const result = serialize(
    editableState({
      playerOrders: [substitutionOrder, swapOrder],
      manMarkingOrder: null,
    })
  );
  assert.equal(result.settings.manMarkerPlayerId, 0);
  assert.equal(result.settings.manMarkingPlayerId, 0);
  assert.deepEqual(
    result.substitutions.map((order) => order.orderType),
    [1, 3]
  );
  assert.equal(result.substitutions.some((order) => order.orderType === 4), false);
}

{
  const loaded = buildSeniorEditableOrdersFromPayload(
    123,
    basePayload({
      substitutions: [
        {
          orderType: 4,
          playerout: markerId,
          playerin: targetId,
          min: -1,
          pos: -1,
          beh: -1,
          card: -1,
          standing: -1,
        },
      ],
    }),
    "loaded"
  );
  assert.notEqual(loaded.manMarkingOrder, null);
  assert.equal(loaded.manMarkingOrder?.subjectPlayerId, markerId);
  assert.equal(loaded.manMarkingOrder?.objectPlayerId, targetId);
  assert.equal(loaded.playerOrders.some((order) => order.orderType === 4), false);
}

{
  const loaded = buildSeniorEditableOrdersFromPayload(
    123,
    basePayload({
      settings: {
        tactic: 0,
        speechLevel: 0,
        newLineup: "",
        coachModifier: 0,
        manMarkerPlayerId: markerId,
        manMarkingPlayerId: targetId,
      },
      substitutions: [],
    }),
    "loaded"
  );
  assert.notEqual(loaded.manMarkingOrder, null);
  assert.equal(loaded.manMarkingOrder?.subjectPlayerId, markerId);
  assert.equal(loaded.manMarkingOrder?.objectPlayerId, targetId);
  assert.equal(loaded.playerOrders.length, 0);
}

console.log("Senior match-order serialization checks passed.");
