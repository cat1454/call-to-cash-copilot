import test from "node:test";
import assert from "node:assert/strict";

import {
  createInitialBookingData,
  createInitialLedgerLogs
} from "./simulationDefaults.js";
import {
  createTamperPayload,
  generateMockHash
} from "./simulationLedger.js";

test("simulation helpers", async (t) => {
  await t.test("creates a complete initial booking shape", () => {
    const booking = createInitialBookingData();

    assert.match(booking.bookingId, /^BK-\d{4}$/);
    assert.deepEqual(Object.keys(booking).sort(), [
      "bookingId",
      "deposit",
      "phone",
      "price",
      "route",
      "seats",
      "time"
    ]);
  });

  await t.test("creates a complete initial ledger shape", () => {
    const ledger = createInitialLedgerLogs();

    assert.equal(ledger.txSig, "0x...");
    assert.equal(ledger.anchoredHash, "-");
    assert.equal(ledger.computedHash, "-");
    assert.equal(ledger.computedHashColor, "var(--success-green)");
    assert.equal(ledger.show, false);
    assert.deepEqual(ledger.entities, {});
  });

  await t.test("generates stable hashes for the same booking payload", () => {
    const booking = {
      bookingId: "BK-1234",
      route: "Hà Nội -> Sa Pa",
      time: "20:00",
      seats: "2 ghế",
      phone: "0912345678",
      price: "700.000đ",
      deposit: "200.000đ"
    };

    assert.equal(generateMockHash(booking), generateMockHash(booking));
  });

  await t.test("creates a tampered payload with a mismatching proof hash", () => {
    const booking = {
      bookingId: "BK-1234",
      route: "Hà Nội -> Sa Pa",
      time: "20:00",
      seats: "2 ghế",
      phone: "0912345678",
      price: "700.000đ",
      deposit: "200.000đ"
    };

    const anchoredHash = generateMockHash(booking);
    const tamperedPayload = createTamperPayload(booking, {
      hackedRoute: "Hà Nội -> Sài Gòn (HACKED)",
      hackedSeats: "10 ghế (HACKED)"
    });

    assert.notEqual(generateMockHash(tamperedPayload), anchoredHash);
  });
});
