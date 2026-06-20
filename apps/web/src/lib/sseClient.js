/**
 * Phase 6 SSE Client
 *
 * Connects to GET /v1/calls/:callId/events and dispatches domain events
 * to registered handlers. Supports Last-Event-ID reconnect cursor and
 * exponential back-off on connection failure.
 *
 * Contract reference: docs/contracts/EVENT-CONTRACT.md
 *
 * Architecture note: The browser sends commands via REST (apiClient.js).
 * This file handles server → browser event delivery only (one-way SSE).
 */

const MIN_RETRY_MS = 500;
const MAX_RETRY_MS = 30_000;
const BACKOFF_FACTOR = 2;

/**
 * @typedef {Object} SseClientOptions
 * @property {string} baseUrl — API base URL, e.g. "http://localhost:3001"
 * @property {string} callId — call session public ID
 * @property {(event: string, data: unknown) => void} onEvent — called for every SSE event
 * @property {(error: Error) => void} [onError] — called when connection fails permanently
 * @property {() => void} [onOpen] — called when SSE stream connects
 * @property {() => void} [onClose] — called when disconnect() is called
 */

/**
 * Creates and manages an SSE connection to the call event stream.
 *
 * @param {SseClientOptions} options
 * @returns {{ disconnect: () => void; isConnected: () => boolean }}
 */
export function createSseClient(options) {
  const { baseUrl, callId, onEvent, onError, onOpen, onClose } = options;

  let lastEventId = /** @type {string | undefined} */ (undefined);
  let retryMs = MIN_RETRY_MS;
  let destroyed = false;
  let connected = false;
  let retryTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
  let controller = /** @type {AbortController | null} */ (null);

  function buildUrl() {
    const url = new URL(`${baseUrl}/v1/calls/${callId}/events`);
    return url.toString();
  }

  async function connect() {
    if (destroyed) return;

    const abortController = new AbortController();
    controller = abortController;

    const headers = /** @type {Record<string, string>} */ ({
      Accept: "text/event-stream",
      "Cache-Control": "no-cache"
    });
    if (lastEventId !== undefined) {
      headers["Last-Event-ID"] = lastEventId;
    }

    try {
      const response = await fetch(buildUrl(), {
        method: "GET",
        headers,
        signal: abortController.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: HTTP ${response.status}`);
      }

      connected = true;
      retryMs = MIN_RETRY_MS;
      onOpen?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (destroyed) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.trim()) continue;
          // Skip heartbeat comments (": heartbeat")
          if (chunk.startsWith(":")) continue;

          const lines = chunk.split("\n");
          let eventName = "message";
          let data = "";
          let id = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventName = line.slice("event: ".length).trim();
            } else if (line.startsWith("data: ")) {
              data = line.slice("data: ".length);
            } else if (line.startsWith("id: ")) {
              id = line.slice("id: ".length).trim();
            }
          }

          if (id) lastEventId = id;

          if (data) {
            try {
              const parsed = JSON.parse(data);
              onEvent(eventName, parsed);
            } catch {
              // Malformed SSE data — skip silently, do not crash the stream.
            }
          }
        }
      }
    } catch (err) {
      if (destroyed) return;
      connected = false;

      // AbortError means we intentionally disconnected — do not retry.
      if (err instanceof Error && err.name === "AbortError") return;

      onError?.(err instanceof Error ? err : new Error(String(err)));
    }

    // Schedule reconnect with exponential back-off.
    if (!destroyed) {
      connected = false;
      retryTimer = setTimeout(() => {
        retryMs = Math.min(retryMs * BACKOFF_FACTOR, MAX_RETRY_MS);
        void connect();
      }, retryMs);
    }
  }

  // Start connection immediately.
  void connect();

  return {
    disconnect() {
      destroyed = true;
      connected = false;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      controller?.abort();
      onClose?.();
    },
    isConnected() {
      return connected;
    }
  };
}

/**
 * Named SSE event → UI state mapping helper.
 *
 * Returns a set of handler keys that the simulation hook can subscribe to.
 * Mapping defined in docs/BACKEND_ROADMAP_2026.md §6.
 */
export const SSE_EVENT_MAP = /** @type {const} */ ({
  /** transcript.turn.created → transcript / subtitles */
  TRANSCRIPT_TURN: "transcript.turn.created",
  /** booking.updated → bookingData */
  BOOKING_UPDATED: "booking.updated",
  /** risk.score.updated → scores / performance / decision */
  RISK_SCORE_UPDATED: "risk.score.updated",
  /** risk.payment_gate.updated → paymentGate status */
  RISK_GATE_UPDATED: "risk.payment_gate.updated",
  /** payment.created → paymentIntent created */
  PAYMENT_CREATED: "payment.created",
  /** payment.confirmed → showBoardingPass trigger */
  PAYMENT_CONFIRMED: "payment.confirmed",
  /** receipt.issued → showBoardingPass */
  RECEIPT_ISSUED: "receipt.issued",
  /** proof.mismatch → isTampered + ledgerLogs mismatch */
  PROOF_MISMATCH: "proof.mismatch",
  /** call.ended → isSimulating = false */
  CALL_ENDED: "call.ended"
});
