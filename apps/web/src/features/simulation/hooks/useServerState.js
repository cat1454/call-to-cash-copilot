/**
 * useServerState — Phase 7 server read-model hooks.
 *
 * Provides lightweight polling hooks that keep local React state
 * synchronised with server authority. All hooks activate only when
 * apiMode is true; when false they return { data: null, loading: false }.
 *
 * Boundary:
 *  - These hooks never own any business-rule logic.
 *  - They never call payment, proof, or booking commands.
 *  - Commands are sent via REST through apiClient (see useServerSimulation).
 *
 * @module useServerState
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const POLL_INTERVAL_MS = 2000;
const STALE_TIMEOUT_MS = 30_000;

/**
 * Generic polling hook.
 *
 * @param {Function|null} fetcher  - Async () => data, or null to skip.
 * @param {number}        interval - Poll period in ms (default 2000).
 * @returns {{ data: unknown, loading: boolean, error: Error|null, refresh: Function }}
 */
function usePolledResource(fetcher, interval = POLL_INTERVAL_MS) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const lastFetchRef = useRef(0);

  const fetch_ = useCallback(async () => {
    if (fetcher === null) return;
    setLoading(true);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
        setError(null);
        lastFetchRef.current = Date.now();
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (fetcher === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    mountedRef.current = true;
    void fetch_();

    timerRef.current = setInterval(() => {
      const stale = Date.now() - lastFetchRef.current > STALE_TIMEOUT_MS;
      if (!stale) void fetch_();
    }, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
    };
  }, [fetcher, interval, fetch_]);

  return { data, loading, error, refresh: fetch_ };
}

/**
 * useCallSession — polls GET /v1/calls/:callId.
 *
 * @param {string|null}   callId    - Server call ID (call_...) or null.
 * @param {object|null}   apiClient - Client from useApiMode, or null when offline.
 * @returns {{ session: object|null, loading: boolean, error: Error|null, refresh: Function }}
 */
export function useCallSession(callId, apiClient) {
  const fetcher = useMemo(
    () => (callId && apiClient ? () => apiClient.getCall(callId) : null),
    [callId, apiClient]
  );
  const { data, loading, error, refresh } = usePolledResource(fetcher);
  return { session: data, loading, error, refresh };
}

/**
 * useBookingReadModel — polls GET /v1/bookings/:bookingId.
 *
 * @param {string|null}   bookingId - Server booking ID (bk_...) or null.
 * @param {object|null}   apiClient
 * @returns {{ booking: object|null, loading: boolean, error: Error|null, refresh: Function }}
 */
export function useBookingReadModel(bookingId, apiClient) {
  const fetcher = useMemo(
    () => (bookingId && apiClient ? () => apiClient.getBooking(bookingId) : null),
    [bookingId, apiClient]
  );
  const { data, loading, error, refresh } = usePolledResource(fetcher);
  return { booking: data, loading, error, refresh };
}

/**
 * useReceiptVerification — polls GET /v1/receipts/:receiptId/verify.
 *
 * Returns server-computed proof hash and MATCH / MISMATCH status.
 * Never uses client-side hash (generateMockHash is not called here).
 *
 * @param {string|null}   receiptId
 * @param {object|null}   apiClient
 * @returns {{ verification: object|null, loading: boolean, error: Error|null, refresh: Function }}
 */
export function useReceiptVerification(receiptId, apiClient) {
  const fetcher = useMemo(
    () => (receiptId && apiClient ? () => apiClient.verifyReceipt(receiptId, {}) : null),
    [receiptId, apiClient]
  );
  const { data, loading, error, refresh } = usePolledResource(fetcher, 5000);
  return { verification: data, loading, error, refresh };
}

/**
 * usePaymentStatus — polls GET /v1/payments/:bookingId/status.
 *
 * @param {string|null}   bookingId
 * @param {object|null}   apiClient
 * @returns {{ paymentStatus: object|null, loading: boolean, error: Error|null, refresh: Function }}
 */
export function usePaymentStatus(bookingId, apiClient) {
  const fetcher = useMemo(
    () => (bookingId && apiClient ? () => apiClient.getPaymentStatus(bookingId) : null),
    [bookingId, apiClient]
  );
  const { data, loading, error, refresh } = usePolledResource(fetcher, 3000);
  return { paymentStatus: data, loading, error, refresh };
}
