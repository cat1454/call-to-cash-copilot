import assert from "node:assert/strict";
import test from "node:test";

import { EventName, PaymentGateStatus } from "@call-to-cash/shared";

test("web can consume shared payment-gate and event contracts", () => {
  assert.equal(PaymentGateStatus.Unlocked, "UNLOCKED");
  assert.equal(EventName.RiskPaymentGateUpdated, "risk.payment_gate.updated");
});
