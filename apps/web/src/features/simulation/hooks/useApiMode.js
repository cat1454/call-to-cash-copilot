/**
 * Phase 6 API Mode Hook
 *
 * Determines whether the web app should use the real backend API
 * or fall back to the built-in mock simulation.
 *
 * Decision flow:
 *   1. If VITE_API_BASE_URL is not set → mock mode always.
 *   2. Probe GET /health on mount.
 *   3. If /health responds with status=ok → API mode.
 *   4. If probe fails (network error, timeout, unexpected status) → mock mode.
 *      A console.warn is emitted so developers can diagnose the fallback.
 *
 * The hook intentionally re-probes on visibility change (document becomes
 * visible after tab switch) so long-lived sessions can recover API mode
 * when the backend comes back up.
 *
 * Security: No API secrets, wallet keys, or PII are stored here.
 * Only the base URL (already in VITE_* env var) is used.
 */

import { useCallback, useEffect, useState } from "react";

import { API_BASE_URL } from "../../../config/runtime.js";
import { createApiClient } from "../../../lib/apiClient.js";

const PROBE_TIMEOUT_MS = 3000;

/**
 * @typedef {Object} ApiModeState
 * @property {boolean} apiMode — true when the real API is reachable
 * @property {string | null} apiBaseUrl — base URL used for API calls, or null in mock mode
 * @property {boolean} isProbing — true while the /health probe is in flight
 * @property {ReturnType<typeof createApiClient> | null} apiClient — ready client, or null in mock mode
 */

/**
 * @returns {ApiModeState}
 */
export function useApiMode() {
  const [apiMode, setApiMode] = useState(false);
  const [isProbing, setIsProbing] = useState(API_BASE_URL !== null);

  const probe = useCallback(async () => {
    if (API_BASE_URL === null) {
      setIsProbing(false);
      return;
    }

    setIsProbing(true);

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: abortController.signal
      });

      if (response.ok) {
        const body = await response.json();
        if (body?.data?.status === "ok") {
          setApiMode(true);
          return;
        }
      }

      console.warn(
        "[useApiMode] API health probe returned unexpected response. Falling back to mock simulation.",
        { status: response.status }
      );
      setApiMode(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(
          `[useApiMode] API health probe timed out after ${PROBE_TIMEOUT_MS}ms. Falling back to mock simulation.`
        );
      } else {
        console.warn(
          "[useApiMode] API health probe failed. Falling back to mock simulation.",
          err
        );
      }
      setApiMode(false);
    } finally {
      clearTimeout(timeout);
      setIsProbing(false);
    }
  }, []);

  // Initial probe on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void probe();
  }, [probe]);

  // Re-probe when tab becomes visible (recovery after backend restart).
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void probe();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [probe]);

  const apiClient = apiMode && API_BASE_URL !== null ? createApiClient(API_BASE_URL) : null;

  return { apiMode, apiBaseUrl: apiMode ? API_BASE_URL : null, isProbing, apiClient };
}
