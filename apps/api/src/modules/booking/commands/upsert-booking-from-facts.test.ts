import assert from "node:assert/strict";
import test from "node:test";

import { resolveDepartureRoute } from "./upsert-booking-from-facts.js";

test("reuses the persisted route when date and time arrive in later Agora turns", () => {
  assert.deepEqual(
    resolveDepartureRoute(
      { departureDay: 28, departureMonth: 6 },
      { routeFrom: "Da Nang", routeTo: "Ha Noi" }
    ),
    { routeFrom: "Da Nang", routeTo: "Ha Noi" }
  );
});
