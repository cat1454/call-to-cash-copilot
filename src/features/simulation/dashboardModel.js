export const GATE_THRESHOLDS = {
  completeness: 85,
  readiness: 80,
  dispute: 35
};

const EMPTY_VALUE = "-";

export function maskPhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return EMPTY_VALUE;
  if (digits.length <= 7) return `${digits.slice(0, 2)}***`;

  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

function getMissingBookingFields(bookingData = {}) {
  return [
    ["route", "route"],
    ["time", "travel time"],
    ["seats", "passenger count"],
    ["phone", "contact phone"]
  ]
    .filter(([key]) => !bookingData[key])
    .map(([, label]) => label);
}

function getBrainModeLabel(brainMode) {
  if (brainMode === "slow") return "Slow Path";
  if (brainMode === "human") return "Human Path";
  return "Fast Path";
}

function getLedgerStatus(ledgerLogs = {}, isTampered = false) {
  if (!ledgerLogs.show) return "pending";
  return isTampered ? "mismatch" : "match";
}

function getNextAction({
  scores,
  missingFields,
  ledgerStatus,
  showPaymentDrawer
}) {
  if (ledgerStatus === "mismatch") return "Send to manual review and invalidate ticket.";
  if (ledgerStatus === "match") return "Proof verified; keep receipt available.";
  if (showPaymentDrawer) return "Collect deposit in the payment drawer.";
  if (scores.dispute > GATE_THRESHOLDS.dispute) return "Lower dispute risk before opening payment.";
  if (scores.completeness < GATE_THRESHOLDS.completeness) {
    return `Collect missing ${missingFields[0] || "booking details"}.`;
  }
  if (scores.readiness < GATE_THRESHOLDS.readiness) {
    return "Read terms and capture explicit deposit confirmation.";
  }

  return "Open payment drawer when customer confirms terms.";
}

export function createDashboardModel({
  scores = {},
  performance = {},
  brainMode = "fast",
  prefetchContent = "",
  showPrefetch = false,
  timelineSteps = [],
  ledgerLogs = {},
  bookingData = {},
  simStatus = "Ready",
  isTampered = false,
  showPaymentDrawer = false
} = {}) {
  const normalizedScores = {
    completeness: scores.completeness || 0,
    readiness: scores.readiness || 0,
    dispute: scores.dispute || 0
  };
  const ledgerStatus = getLedgerStatus(ledgerLogs, isTampered);
  const scoreGatePassed =
    normalizedScores.completeness >= GATE_THRESHOLDS.completeness &&
    normalizedScores.readiness >= GATE_THRESHOLDS.readiness &&
    normalizedScores.dispute <= GATE_THRESHOLDS.dispute;
  const gateUnlocked = showPaymentDrawer || ledgerStatus === "match" || scoreGatePassed;
  const missingFields = getMissingBookingFields(bookingData);

  return {
    operator: {
      callStatus: simStatus,
      nextAction: getNextAction({
        scores: normalizedScores,
        missingFields,
        ledgerStatus,
        showPaymentDrawer
      }),
      timelineCount: timelineSteps.length
    },
    gate: {
      status: gateUnlocked ? "unlocked" : "locked",
      label: gateUnlocked ? "Payment Gate Open" : "Payment Gate Locked"
    },
    risk: {
      completeness: {
        label: "Completeness",
        value: normalizedScores.completeness,
        threshold: GATE_THRESHOLDS.completeness,
        passed: normalizedScores.completeness >= GATE_THRESHOLDS.completeness,
        direction: "min"
      },
      readiness: {
        label: "Readiness",
        value: normalizedScores.readiness,
        threshold: GATE_THRESHOLDS.readiness,
        passed: normalizedScores.readiness >= GATE_THRESHOLDS.readiness,
        direction: "min"
      },
      dispute: {
        label: "Dispute Risk",
        value: normalizedScores.dispute,
        threshold: GATE_THRESHOLDS.dispute,
        passed: normalizedScores.dispute <= GATE_THRESHOLDS.dispute,
        direction: "max"
      }
    },
    telemetry: {
      ttfr: performance.ttfr || EMPTY_VALUE,
      turngap: performance.turngap || EMPTY_VALUE,
      clarify: performance.clarify ?? 0,
      brainMode: getBrainModeLabel(brainMode)
    },
    prefetch: {
      label: showPrefetch && prefetchContent ? "Prefetch Ready" : "No Prefetch",
      value: showPrefetch && prefetchContent ? prefetchContent : EMPTY_VALUE
    },
    booking: {
      route: bookingData.route || EMPTY_VALUE,
      time: bookingData.time || EMPTY_VALUE,
      seats: bookingData.seats || EMPTY_VALUE,
      price: bookingData.price || EMPTY_VALUE,
      deposit: bookingData.deposit || EMPTY_VALUE,
      phone: maskPhoneNumber(bookingData.phone)
    },
    ledger: {
      status: ledgerStatus,
      txSig: ledgerLogs.show ? ledgerLogs.txSig : EMPTY_VALUE,
      anchoredHash: ledgerLogs.show ? ledgerLogs.anchoredHash : EMPTY_VALUE,
      computedHash: ledgerLogs.show ? ledgerLogs.computedHash : EMPTY_VALUE
    }
  };
}
