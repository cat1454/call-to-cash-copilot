import assert from "node:assert/strict";
import test from "node:test";

import {
  WEB_CONFIRMATION_TEXT,
  isReadyForWebAgreementConfirmation,
  webAgreementConfirmationPayload
} from "./agreementConfirmation.js";

test("web agreement confirmation is available only for the current ready agreement", () => {
  const booking = { bookingId: "bk_public01", status: "AGREEMENT_READY", agreementVersion: 2 };
  assert.equal(isReadyForWebAgreementConfirmation(booking, "READY_FOR_CONFIRMATION"), true);
  assert.equal(isReadyForWebAgreementConfirmation(booking, "LOCKED"), false);
  assert.equal(
    isReadyForWebAgreementConfirmation({ ...booking, status: "AGREEMENT_LOCKED" }, "READY_FOR_CONFIRMATION"),
    false
  );
  assert.deepEqual(webAgreementConfirmationPayload(booking), {
    agreementVersion: 2,
    confirmation: { method: "WEB", text: WEB_CONFIRMATION_TEXT }
  });
});
