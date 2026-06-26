import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { EventName } from "@call-to-cash/shared";

import { buildVerificationPayload } from "./serverPayment.js";
import { getSolanaPollDelayMs, scheduleSolanaPaymentPoll } from "./useSolanaPaymentPolling.js";
import { getAIDecision } from "../helpers/appHelpers.js";

import {
  ACTION,
  makeInitialState,
  projectBookingForDisplay,
  reducer
} from "./serverSimulationState.js";

const occurredAt = "2026-06-21T10:00:00.000Z";

test("Solana verification sends only the server-owned payment intent ID", () => {
  assert.deepEqual(
    buildVerificationPayload({ provider: "solana_devnet", paymentIntentId: "pi_public01" }),
    { paymentIntentId: "pi_public01" }
  );
});

test("Solana polling uses bounded backoff and can be cancelled", () => {
  const scheduledDelays = [];
  const clearedTimers = [];
  let verificationCount = 0;
  const timers = {
    setTimeout(callback, delay) {
      scheduledDelays.push(delay);
      callback();
      return 17;
    },
    clearTimeout(timer) {
      clearedTimers.push(timer);
    }
  };

  const cancel = scheduleSolanaPaymentPoll(() => {
    verificationCount += 1;
  }, 2, timers);
  cancel();

  assert.deepEqual(scheduledDelays, [12_000]);
  assert.equal(verificationCount, 1);
  assert.deepEqual(clearedTimers, [17]);
  assert.equal(getSolanaPollDelayMs(0), 3_000);
  assert.equal(getSolanaPollDelayMs(5), 30_000);
});

function envelope(event, data, sequence = 1, overrides = {}) {
  return {
    eventId: `evt_public${sequence}`,
    event,
    version: 1,
    occurredAt,
    callId: "call_public1",
    bookingId: null,
    sequence,
    data,
    ...overrides
  };
}

describe("server simulation event projection", () => {
  test("deduplicates at-least-once delivery and flags sequence gaps for REST recovery", () => {
    const riskEvent = envelope(EventName.RiskScoreUpdated, {
      assessmentId: "risk_public1",
      completenessScore: 90,
      disputeRisk: 20,
      paymentReadiness: 85,
      paymentGate: "READY_FOR_CONFIRMATION",
      nextAction: "ASK_CONFIRMATION",
      missingFields: [],
      reasonCodes: [],
      customerMessage: "Please confirm."
    });
    const once = reducer(makeInitialState(), { type: ACTION.SERVER_EVENT, envelope: riskEvent });
    const duplicate = reducer(once, { type: ACTION.SERVER_EVENT, envelope: riskEvent });
    const gap = reducer(duplicate, {
      type: ACTION.SERVER_EVENT,
      envelope: envelope(
        EventName.RiskPaymentGateUpdated,
        {
          previousDecision: "READY_FOR_CONFIRMATION",
          paymentGate: "UNLOCKED",
          nextAction: "OPEN",
          reasonCodes: [],
          agreementVersion: 1
        },
        3,
        { bookingId: "bk_public01" }
      )
    });

    assert.deepEqual(duplicate, once);
    assert.equal(gap.paymentGate, "UNLOCKED");
    assert.equal(gap.needsRecovery, true);
    assert.equal(gap.bookingId, "bk_public01");
  });

  test("uses only masked booking and receipt fields for display", () => {
    const projected = projectBookingForDisplay({
      bookingId: "bk_public01",
      routeFrom: "Ha Noi",
      routeTo: "Sa Pa",
      departureAt: "2026-06-22T15:30:00.000Z",
      passengerCount: 3,
      contactPhoneMasked: "0912***678",
      contactPhone: "0912345678",
      fareTotalVnd: 1_050_000,
      depositAmountVnd: 300_000,
      canonicalPayload: "private agreement"
    });

    assert.equal(projected.bookingId, "bk_public01");
    assert.equal(projected.date, "22/06/2026");
    assert.equal(projected.time, "22:30");
    assert.equal(projected.phone, "0912***678");
    assert.equal(projected.price, "1.050.000 ₫");
    assert.equal(JSON.stringify(projected).includes("0912345678"), false);
    assert.equal(JSON.stringify(projected).includes("private agreement"), false);

    const receiptProjected = projectBookingForDisplay(
      { fareTotalVnd: 1_050_000 },
      {
        booking: {
          bookingId: "bk_public01",
          route: "Ha Noi → Sa Pa",
          departureAt: "2026-06-22T15:30:00.000Z",
          passengerCount: 3,
          contactPhoneMasked: "0912***678"
        },
        deposit: { amount: { minor: 300_000 } }
      }
    );
    assert.equal(receiptProjected.date, projected.date);
    assert.equal(receiptProjected.time, projected.time);
  });

  test("projects transcript analysis updates into the decision summary without raw PII", () => {
    const analysis = { extractionId: "ext_public01", understood: { routeFrom: "Da Nang", routeTo: "Ha Noi", passengerCount: 4, contactPhoneMasked: "0901***567", contactPhone: "0901567890" }, missingFields: ["refundPolicyConfirmation"], contradictions: [], nextQuestion: "Confirm deposit terms." };
    const state = reducer(makeInitialState(), { type: ACTION.SERVER_EVENT, envelope: envelope(EventName.TranscriptAnalysisUpdated, analysis, 2, { bookingId: "bk_public01" }) });
    const decision = getAIDecision(state);
    assert.equal(state.bookingId, "bk_public01");
    assert.match(decision.understood, /Da Nang.*Ha Noi.*4.*0901\*\*\*567/u);
    assert.deepEqual([decision.missing, decision.next], ["refundPolicyConfirmation", "Confirm deposit terms."]);
    assert.doesNotMatch(JSON.stringify(decision), /0901567890/u);
  });

  test("REST recovery stores only whitelisted booking and receipt projections", () => {
    const bookingState = reducer(makeInitialState(), {
      type: ACTION.BOOKING_SYNCED,
      booking: {
        bookingId: "bk_public01",
        status: "AGREEMENT_READY",
        contactPhoneMasked: "0912***678",
        contactPhone: "0912345678",
        customerEmail: "person@example.com",
        canonicalAgreement: "private agreement"
      }
    });
    const receiptState = reducer(bookingState, {
      type: ACTION.RECEIPT_SYNCED,
      receipt: {
        receiptId: "rcpt_public1",
        bookingId: "bk_public01",
        status: "VERIFIED_MATCH",
        booking: { bookingId: "bk_public01", contactPhoneMasked: "0912***678" },
        deposit: {
          amount: { currency: "VND", minor: 300000, canonicalAgreement: "private agreement" },
          status: "CONFIRMED"
        },
        verification: {
          status: "MATCH",
          agreementVersion: 1,
          canonicalAgreement: "private agreement"
        },
        transcript: "private transcript",
        canonicalAgreement: "private agreement"
      }
    });

    const serialized = JSON.stringify(receiptState);
    assert.doesNotMatch(
      serialized,
      /0912345678|person@example.com|private transcript|private agreement/
    );
    assert.match(serialized, /0912\*\*\*678/);
  });

  test("tracks explicit loading, connected, error, reconnecting and closed stream states", () => {
    let state = makeInitialState();
    for (const status of ["connecting", "open", "error", "reconnecting", "closed"]) {
      state = reducer(state, { type: ACTION.STREAM_STATUS, status });
      assert.equal(state.streamStatus, status);
    }
  });

  test("refresh resume restores only opaque recovery identifiers and disables fixture replay", () => {
    const state = reducer(makeInitialState(), {
      type: ACTION.RESUME,
      snapshot: {
        callId: "call_public1",
        bookingId: "bk_public01",
        paymentIntentId: "pi_public01",
        receiptId: "rcpt_public1"
      }
    });

    assert.equal(state.callId, "call_public1");
    assert.equal(state.bookingId, "bk_public01");
    assert.equal(state.paymentIntentId, "pi_public01");
    assert.equal(state.receiptId, "rcpt_public1");
    assert.equal(state.replayInputEnabled, false);
    assert.equal(state.streamStatus, "connecting");
  });

  test("definitive payment failure closes the drawer and routes the UI to manual review", () => {
    const ready = {
      ...makeInitialState(),
      paymentGate: "UNLOCKED",
      showPaymentDrawer: true,
      paymentActionPending: true,
      booking: { bookingId: "bk_public01", status: "PAYMENT_PENDING" }
    };
    const failed = reducer(ready, {
      type: ACTION.SERVER_EVENT,
      envelope: envelope(
        EventName.PaymentFailed,
        {
          paymentIntentId: "pi_public01",
          status: "REJECTED",
          errorCode: "PAYMENT_REFERENCE_MISMATCH",
          retryable: false,
          customerMessage: "Manual review required."
        },
        2,
        { bookingId: "bk_public01" }
      )
    });

    assert.equal(failed.showPaymentDrawer, false);
    assert.equal(failed.paymentActionPending, false);
    assert.equal(failed.paymentGate, "MANUAL_REVIEW_REQUIRED");
    assert.equal(failed.booking.status, "MANUAL_REVIEW_REQUIRED");
  });

  test("stores only the approved Solana Devnet payment request projection", () => {
    const state = reducer(makeInitialState(), {
      type: ACTION.PAYMENT_INTENT_CREATED,
      intent: {
        paymentIntentId: "pi_public01",
        bookingId: "bk_public01",
        agreementId: "agr_public01",
        status: "CREATED",
        amount: { currency: "VND", minor: 300000 },
        recipient: "11111111111111111111111111111111",
        reference: "11111111111111111111111111111111",
        expiresAt: occurredAt,
        idempotencyKey: "create-key",
        provider: "solana_devnet",
        providerPayment: {
          provider: "solana_devnet",
          cluster: "devnet",
          amountLamports: 1000000,
          amountSol: "0.001",
          solanaPayUrl: "solana:11111111111111111111111111111111?amount=0.001",
          qrPayload: "solana:11111111111111111111111111111111?amount=0.001",
          memo: "ctc:v1:ref:1111111111:proof:aaaaaaaaaaaa:amt:lfls",
          rawPhone: "0912345678",
          transcript: "private transcript"
        }
      }
    });

    assert.equal(state.paymentIntent.provider, "solana_devnet");
    assert.equal(state.paymentIntent.providerPayment.amountLamports, 1000000);
    assert.doesNotMatch(JSON.stringify(state.paymentIntent), /0912345678|private transcript/u);
  });

  test("retryable chain verification keeps the payment drawer open", () => {
    const state = reducer(
      { ...makeInitialState(), showPaymentDrawer: true, paymentActionPending: true },
      {
        type: ACTION.PAYMENT_PENDING,
        error: { code: "PAYMENT_TRANSACTION_UNCONFIRMED", message: "Still confirming." }
      }
    );

    assert.equal(state.showPaymentDrawer, true);
    assert.equal(state.paymentActionPending, false);
    assert.equal(state.simStatus, "Đang chờ giao dịch trên Devnet...");
    assert.equal(state.error, null);
  });
});
