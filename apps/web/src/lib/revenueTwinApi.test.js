import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { createApiClient } from "./apiClient.js";

test("Revenue Twin client reads only the safe dashboard projection", async () => {
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: { schemaVersion: "ctc.revenue-twin.dashboard.v1", metrics: { offersGenerated: 2 } },
      meta: { requestId: "rtw-dashboard" }
    })
  }));
  const client = createApiClient("http://localhost:3001", fetchMock);
  const result = await client.getRevenueTwinDashboard();

  assert.equal(result.metrics.offersGenerated, 2);
  assert.equal(fetchMock.mock.calls[0].arguments[0], "http://localhost:3001/v1/revenue-twin/dashboard");
  assert.equal(fetchMock.mock.calls[0].arguments[1].method, "GET");
});

test("Revenue Twin client accepts an offer with identifiers and idempotency only", async () => {
  const fetchMock = mock.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      data: {
        callId: "call_public1",
        evaluationId: "rtw_eval_public1",
        offerId: "rtw_offer_public1",
        status: "ACCEPTED",
        nextAction: "CONFIRM_AGREEMENT"
      },
      meta: { requestId: "rtw-accept" }
    })
  }));
  const client = createApiClient("http://localhost:3001", fetchMock);
  const command = {
    callId: "call_public1",
    evaluationId: "rtw_eval_public1",
    offerId: "rtw_offer_public1",
    idempotencyKey: "accept-rtw-offer-public1"
  };
  await client.acceptRevenueTwinOffer(
    "call_public1",
    "rtw_offer_public1",
    command,
    command.idempotencyKey
  );

  const [, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    "http://localhost:3001/v1/calls/call_public1/revenue-twin/offers/rtw_offer_public1/accept"
  );
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Idempotency-Key"], "accept-rtw-offer-public1");
  assert.deepEqual(JSON.parse(init.body), command);
  assert.equal("finalFareAmountMinor" in JSON.parse(init.body), false);
  assert.equal("availableSeatsAtEvaluation" in JSON.parse(init.body), false);
});
