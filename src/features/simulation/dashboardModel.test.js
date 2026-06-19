import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createDashboardModel,
  maskPhoneNumber
} from "./dashboardModel.js";

describe("mobile operator dashboard model", () => {
  it("keeps the gate locked when dispute risk is above threshold", () => {
    const model = createDashboardModel({
      scores: { completeness: 95, readiness: 90, dispute: 55 },
      performance: { ttfr: "320ms", turngap: "1.2s", clarify: 1 },
      brainMode: "slow",
      prefetchContent: "",
      showPrefetch: false,
      timelineSteps: [1, 2, 3],
      ledgerLogs: { show: false, txSig: "0x...", anchoredHash: "-", computedHash: "-" },
      bookingData: { route: "Ha Noi -> Sa Pa", time: "22:30", seats: "3", phone: "0912345678" },
      simStatus: "Cuoc goi dang truc tiep",
      isTampered: false,
      showPaymentDrawer: false
    });

    assert.equal(model.gate.status, "locked");
    assert.equal(model.risk.dispute.passed, false);
    assert.match(model.operator.nextAction, /Lower dispute/i);
  });

  it("marks the gate open when the payment drawer is active", () => {
    const model = createDashboardModel({
      scores: { completeness: 100, readiness: 95, dispute: 5 },
      performance: { ttfr: "240ms", turngap: "0.9s", clarify: 0 },
      brainMode: "fast",
      prefetchContent: "Seat map loaded",
      showPrefetch: true,
      timelineSteps: [1, 2, 3, 4, 5],
      ledgerLogs: { show: false, txSig: "0x...", anchoredHash: "-", computedHash: "-" },
      bookingData: { route: "Ha Noi -> Sa Pa", time: "22:30", seats: "3", phone: "0912345678" },
      simStatus: "Cho thanh toan coc",
      isTampered: false,
      showPaymentDrawer: true
    });

    assert.equal(model.gate.status, "unlocked");
    assert.equal(model.prefetch.value, "Seat map loaded");
    assert.match(model.operator.nextAction, /Collect deposit/i);
  });

  it("masks phone numbers before exposing booking snapshots", () => {
    assert.equal(maskPhoneNumber("0912345678"), "0912***678");
    assert.equal(maskPhoneNumber(""), "-");
  });

  it("surfaces mismatch status after tamper", () => {
    const model = createDashboardModel({
      scores: { completeness: 100, readiness: 100, dispute: 5 },
      performance: { ttfr: "240ms", turngap: "0.9s", clarify: 0 },
      brainMode: "fast",
      prefetchContent: "",
      showPrefetch: false,
      timelineSteps: [1, 2, 3, 4, 5, 6],
      ledgerLogs: {
        show: true,
        txSig: "sol_tx_123",
        anchoredHash: "sol_proof_a",
        computedHash: "sol_proof_b"
      },
      bookingData: { route: "HACKED", time: "22:30", seats: "10", phone: "0912345678" },
      simStatus: "Da hoan thanh",
      isTampered: true,
      showPaymentDrawer: false
    });

    assert.equal(model.ledger.status, "mismatch");
    assert.match(model.operator.nextAction, /manual review/i);
  });
});
