import { useCallback, useEffect } from "react";

import { ACTION } from "./serverSimulationState.js";

export function useRevenueTwinDashboardSync(apiClient, dispatch) {
  useEffect(() => {
    if (!apiClient?.getRevenueTwinDashboard) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const dashboard = await apiClient.getRevenueTwinDashboard();
        if (!cancelled) dispatch({ type: ACTION.REVENUE_TWIN_SYNCED, revenueTwin: { dashboard } });
      } catch {
        // Auxiliary projection; call recovery owns blocking errors.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [apiClient, dispatch]);
}

export function useAcceptRevenueTwinOffer({ apiClient, callIdRef, requestRecovery, stateRef }) {
  return useCallback(
    async ({ evaluationId, offerId, idempotencyKey }) => {
      const callId = callIdRef.current ?? stateRef.current.callId;
      if (!apiClient || !callId || !evaluationId || !offerId || !idempotencyKey) return null;
      const decision = await apiClient.acceptRevenueTwinOffer(
        callId,
        offerId,
        { callId, evaluationId, offerId, idempotencyKey },
        idempotencyKey
      );
      await requestRecovery(callId, { bookingId: stateRef.current.bookingId });
      return decision;
    },
    [apiClient, callIdRef, requestRecovery, stateRef]
  );
}

export function useDeclineRevenueTwinOffer({ apiClient, callIdRef, requestRecovery, stateRef }) {
  return useCallback(
    async ({ evaluationId, offerId }) => {
      const callId = callIdRef.current ?? stateRef.current.callId;
      if (!apiClient || !callId || !evaluationId || !offerId) return null;
      const decision = await apiClient.declineRevenueTwinOffer(callId, offerId, {
        callId,
        evaluationId,
        offerId
      });
      await requestRecovery(callId, { bookingId: stateRef.current.bookingId });
      return decision;
    },
    [apiClient, callIdRef, requestRecovery, stateRef]
  );
}
