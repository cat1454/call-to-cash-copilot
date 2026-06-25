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
