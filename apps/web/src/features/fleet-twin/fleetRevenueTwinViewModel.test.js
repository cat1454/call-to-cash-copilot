import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFleetRevenueTwinViewModel } from "./fleetRevenueTwinViewModel.js";

test("Fleet Twin view model keeps KPI authority in the dashboard projection", () => {
  const vm = buildFleetRevenueTwinViewModel({
    scores: { dispute: 18, readiness: 92 },
    dashboard: {
      metrics: {
        securedRecoveredRevenueAmountMinor: 5200000,
        potentialNetRevenueRecoveredAmountMinor: 8400000,
        acceptedPassengerCount: 24,
        offerAcceptanceRateBasisPoints: 3100
      },
      occupancy: { beforeOccupiedSeats: 70, afterOccupiedSeats: 78, capacitySeats: 100 },
      routing: []
    }
  });

  assert.equal(vm.kpis[0][0], "Revenue recovered");
  assert.match(vm.kpis[0][1], /5\.200\.000/);
  assert.equal(vm.kpis[0][2], "secured");
  assert.equal(vm.kpis[1][0], "Potential recovery");
  assert.match(vm.kpis[1][1], /8\.400\.000/);
  assert.equal(vm.kpis[1][2], "not secured");
  assert.equal(vm.kpis[6][1], "31%");
});

test("Fleet Twin view model renders server offer data without local authority fields", () => {
  const vm = buildFleetRevenueTwinViewModel({
    booking: {
      bookingId: "bk_public01",
      routeFrom: "Hue",
      routeTo: "Nha Trang",
      passengerCount: 3,
      pickupPoint: "Ben xe Hue",
      contactPhoneMasked: "0912***678"
    },
    evaluation: {
      evaluationId: "rtw_eval_public1",
      status: "PROACTIVE_OFFERS_AVAILABLE",
      offers: [
        {
          offerId: "rtw_offer_public1",
          departureId: "dep_public730",
          rank: 1,
          finalFareAmountMinor: 250000,
          discountAmountMinor: 30000,
          status: "OPEN"
        }
      ]
    },
    dashboard: {
      routing: [
        {
          offerId: "rtw_offer_public1",
          scheduledAt: "2026-06-25T00:30:00.000Z",
          availableSeatsAtEvaluation: 12
        }
      ]
    }
  });

  assert.equal(vm.booking.contactPhoneMasked, "0912***678");
  assert.equal(vm.decision.offerId, "rtw_offer_public1");
  assert.equal(vm.decision.options[0].seats, "12 ghe");
  assert.equal(vm.decision.canAccept, true);
});

test("Fleet Twin confirmation requires backend acceptance or hold proof", () => {
  const vm = buildFleetRevenueTwinViewModel({
    evaluation: {
      evaluationId: "rtw_eval_public1",
      offers: [{ offerId: "rtw_offer_public1", rank: 1, status: "ACCEPTED" }]
    },
    decision: {
      status: "ACCEPTED",
      inventoryHoldId: "hold_public1"
    }
  });

  assert.equal(vm.decision.confirmations[1].done, true);
  assert.equal(vm.decision.confirmations[2].done, true);
});
