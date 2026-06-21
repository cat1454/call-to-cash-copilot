// REST boundary: never send provider secrets, wallet keys, or full transcript here.

import { VerifyMockPaymentRequestSchema, VerifyPaymentRequestSchema } from "@call-to-cash/shared";

/** @typedef {{ code: string; message: string; details?: unknown; retryable: boolean }} ApiError */

export class ApiClientError extends Error {
  /**
   * @param {number} status
   * @param {ApiError} error
   */
  constructor(status, error) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.retryable = error.retryable;
    this.details = error.details;
  }
}

/**
 * @param {string} baseUrl
 * @param {string} path
 * @param {RequestInit} [init]
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<unknown>}
 */
async function apiFetch(baseUrl, path, init = {}, fetchFn = globalThis.fetch) {
  const url = `${baseUrl}${path}`;
  const response = await fetchFn(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const body = await response.json();

  if (!response.ok || body.success === false) {
    throw new ApiClientError(
      response.status,
      body.error ?? {
        code: "UNKNOWN_ERROR",
        message: `HTTP ${response.status}`,
        retryable: response.status >= 500
      }
    );
  }

  return body.data;
}

/**
 * Build a fully-typed API client bound to a base URL.
 *
 * @param {string} baseUrl — e.g. "http://localhost:3001"
 * @param {typeof fetch} [fetchFn] — injectable for testing, defaults to globalThis.fetch
 */
export function createApiClient(baseUrl, fetchFn = globalThis.fetch) {
  // ─── Utility ─────────────────────────────────────────────────────────────

  function get(path) {
    return apiFetch(baseUrl, path, { method: "GET" }, fetchFn);
  }

  function post(path, body, extraHeaders = {}) {
    return apiFetch(
      baseUrl,
      path,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: extraHeaders
      },
      fetchFn
    );
  }

  // ─── Health ───────────────────────────────────────────────────────────────

  async function health() {
    return get("/health");
  }

  // ─── Calls ────────────────────────────────────────────────────────────────

  async function createCall({ sourceMode = "TRANSCRIPT_REPLAY" } = {}) {
    return post("/v1/calls", {
      channelPurpose: "BOOKING",
      sourceMode
    });
  }

  async function getCall(callId) {
    return get(`/v1/calls/${callId}`);
  }

  async function endCall(callId, reason = "CUSTOMER_ENDED") {
    return post(`/v1/calls/${callId}/end`, { reason });
  }

  async function createVoiceSession(policyVersion = "privacy-v1") {
    return post("/v1/voice-sessions", { consent: { policyVersion } });
  }

  async function startVoiceSession(callId) {
    return post(`/v1/voice-sessions/${callId}/start`, {});
  }

  async function stopVoiceSession(callId) {
    return post(`/v1/voice-sessions/${callId}/stop`, {});
  }

  // ─── Transcript ───────────────────────────────────────────────────────────

  /**
   * POST /v1/calls/:callId/transcript-turns
   *
   * Persists a final transcript turn and triggers risk recomputation.
   * @param {string} callId
   * @param {{ clientTurnId: string; sequenceNo: number; speaker: string; content: string; language?: string; source?: string }} turn
   */
  async function submitTranscriptTurn(callId, turn) {
    return post(`/v1/calls/${callId}/transcript-turns`, {
      turn: {
        language: "vi-VN",
        isFinal: true,
        source: "REPLAY",
        ...turn
      }
    });
  }

  // ─── Risk ─────────────────────────────────────────────────────────────────

  /**
   * GET /v1/calls/:callId/risk
   * @param {string} callId
   */
  async function getRisk(callId) {
    return get(`/v1/calls/${callId}/risk`);
  }

  // ─── Booking ─────────────────────────────────────────────────────────────

  /**
   * GET /v1/bookings/:bookingId
   * @param {string} bookingId
   */
  async function getBooking(bookingId) {
    return get(`/v1/bookings/${bookingId}`);
  }

  /**
   * POST /v1/bookings/:bookingId/confirm
   *
   * Locks a specific agreement version after explicit customer confirmation.
   * Requires Idempotency-Key header.
   *
   * @param {string} bookingId
   * @param {{ agreementVersion: number; confirmation: { method: string; text: string; confirmedTurnId?: string } }} payload
   * @param {string} idempotencyKey
   */
  async function confirmBooking(bookingId, payload, idempotencyKey) {
    return post(`/v1/bookings/${bookingId}/confirm`, payload, {
      "Idempotency-Key": idempotencyKey
    });
  }

  // ─── Mock Payment ─────────────────────────────────────────────────────────

  /**
   * POST /v1/payments/mock/create
   *
   * Creates a server-owned mock payment intent bound to the current locked agreement.
   * Only allowed when payment gate is UNLOCKED.
   *
   * @param {{ bookingId: string }} params
   * @param {string} idempotencyKey
   */
  async function createMockPayment({ bookingId }, idempotencyKey) {
    return post("/v1/payments/mock/create", { bookingId }, { "Idempotency-Key": idempotencyKey });
  }

  async function createPayment({ bookingId }, idempotencyKey) {
    return post("/v1/payments/create", { bookingId }, { "Idempotency-Key": idempotencyKey });
  }

  /**
   * POST /v1/payments/mock/verify
   *
   * Verifies mock payment. Server checks amount, recipient, and reference.
   * Never accepts a client-provided authoritative status.
   *
   * @param {{ paymentIntentId: string; observedAmount: { currency: string; minor: number }; observedRecipient: string; observedReference: string }} payload
   * @param {string} idempotencyKey
   */
  async function verifyMockPayment(payload, idempotencyKey) {
    const parsed = VerifyMockPaymentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError(400, {
        code: "VALIDATION_ERROR",
        message: "Payment verification data is incomplete.",
        retryable: false
      });
    }
    return post("/v1/payments/mock/verify", parsed.data, {
      "Idempotency-Key": idempotencyKey
    });
  }

  async function verifyPayment(payload, idempotencyKey) {
    const parsed = VerifyPaymentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiClientError(400, {
        code: "VALIDATION_ERROR",
        message: "Payment verification data is incomplete.",
        retryable: false
      });
    }
    return post("/v1/payments/verify", parsed.data, {
      "Idempotency-Key": idempotencyKey
    });
  }

  /**
   * GET /v1/payments/:bookingId/status
   * @param {string} bookingId
   */
  async function getPaymentStatus(bookingId) {
    return get(`/v1/payments/${bookingId}/status`);
  }

  /**
   * POST /v1/payments/mock/simulate-failure  (DEMO_MODE only)
   *
   * Forces a payment intent into a specific failure outcome for demo purposes.
   * The server guards this endpoint with DEMO_MODE=true.
   *
   * @param {{ paymentIntentId: string; outcome: "EXPIRED"|"WRONG_AMOUNT"|"WRONG_REFERENCE"|"WRONG_RECIPIENT" }} payload
   */
  async function simulatePaymentFailure(payload) {
    return post("/v1/payments/mock/simulate-failure", payload);
  }

  // ─── Receipts ─────────────────────────────────────────────────────────────

  /**
   * GET /v1/receipts/:receiptId
   * @param {string} receiptId
   */
  async function getReceipt(receiptId) {
    return get(`/v1/receipts/${receiptId}`);
  }

  /**
   * GET /v1/receipts/:receiptId/verify
   *
   * In DEMO_MODE, optionally accepts ?candidateDepositAmountMinor for tamper demo.
   * @param {string} receiptId
   * @param {{ candidateDepositAmountMinor?: number }} [query]
   */
  async function verifyReceipt(receiptId, query = {}) {
    const params = new URLSearchParams();
    if (query.candidateDepositAmountMinor !== undefined) {
      params.set("candidateDepositAmountMinor", String(query.candidateDepositAmountMinor));
    }
    const qs = params.toString();
    return get(`/v1/receipts/${receiptId}/verify${qs ? `?${qs}` : ""}`);
  }

  return {
    health,
    createCall,
    getCall,
    endCall,
    createVoiceSession,
    startVoiceSession,
    stopVoiceSession,
    submitTranscriptTurn,
    getRisk,
    getBooking,
    confirmBooking,
    createPayment,
    createMockPayment,
    verifyPayment,
    verifyMockPayment,
    getPaymentStatus,
    simulatePaymentFailure,
    getReceipt,
    verifyReceipt
  };
}
