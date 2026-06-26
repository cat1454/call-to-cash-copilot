import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDepartureRoute,
  selectUniqueCatalogueDeparture
} from "./upsert-booking-from-facts.js";

test("reuses the persisted route when date and time arrive in later Agora turns", () => {
  assert.deepEqual(
    resolveDepartureRoute(
      { departureDay: 28, departureMonth: 6 },
      { routeFrom: "Da Nang", routeTo: "Ha Noi" }
    ),
    { routeFrom: "Da Nang", routeTo: "Ha Noi" }
  );
});

test("selects a catalogue departure only when the schedule match is unique", () => {
  const candidates = [
    { id: "dep_0700_day1", departureAtUtc: new Date("2030-06-20T00:00:00.000Z") },
    { id: "dep_0700_day2", departureAtUtc: new Date("2030-06-21T00:00:00.000Z") },
    { id: "dep_0730_day1", departureAtUtc: new Date("2030-06-20T00:30:00.000Z") }
  ];

  assert.equal(
    selectUniqueCatalogueDeparture(candidates, {
      departureDay: 20,
      departureMonth: 6,
      departureLocalTime: "07:00"
    })?.id,
    "dep_0700_day1"
  );
  assert.equal(selectUniqueCatalogueDeparture(candidates, { departureLocalTime: "07:00" }), null);
  assert.equal(
    selectUniqueCatalogueDeparture(candidates, {
      departureDay: 20,
      departureMonth: 6
    }),
    null
  );
});
