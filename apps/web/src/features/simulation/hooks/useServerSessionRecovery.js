import { useCallback, useEffect, useRef } from "react";

import { ACTION } from "./serverSimulationState.js";
import { clearServerSession, readServerSession, writeServerSession } from "./serverSession.js";

function toError(caught) {
  return caught instanceof Error ? caught : new Error(String(caught));
}

export function useServerSessionRecovery({
  apiClient,
  apiBaseUrl,
  state,
  dispatch,
  connectSse,
  recoverServerState,
  callIdRef,
  sseRef
}) {
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (state.callId) {
      writeServerSession(undefined, {
        callId: state.callId,
        bookingId: state.bookingId,
        paymentIntentId: state.paymentIntentId,
        receiptId: state.receiptId
      });
    }
  }, [state.bookingId, state.callId, state.paymentIntentId, state.receiptId]);

  useEffect(() => {
    if (!apiClient || !apiBaseUrl || attemptedRef.current) return;
    attemptedRef.current = true;
    const snapshot = readServerSession();
    if (snapshot === null) return;

    callIdRef.current = snapshot.callId;
    dispatch({ type: ACTION.RESUME, snapshot });
    connectSse(snapshot.callId);
    void recoverServerState(snapshot.callId, snapshot).catch((caught) => {
      const error = toError(caught);
      if (error.status === 404) {
        clearServerSession();
        sseRef.current?.disconnect();
      }
      dispatch({ type: ACTION.ERROR, error });
    });
  }, [apiBaseUrl, apiClient, callIdRef, connectSse, dispatch, recoverServerState, sseRef]);

  return useCallback(() => clearServerSession(), []);
}
