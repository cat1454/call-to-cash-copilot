import { useCallback } from "react";

import { ACTION } from "./serverSimulationState.js";

export function useServerSimulationReset({
  apiClient,
  callIdRef,
  clearSession,
  dispatch,
  postCallTranscriptSync,
  sequenceRef,
  setCurrentTurnIdx,
  sseRef,
  stateRef
}) {
  return useCallback(() => {
    const current = stateRef.current;
    sseRef.current?.disconnect();
    sseRef.current = null;
    postCallTranscriptSync.cancel();
    if (
      apiClient &&
      current.callId &&
      !["ENDED", "CANCELLED", "FAILED"].includes(current.callStatus)
    ) {
      void apiClient.endCall(current.callId, "OPERATOR_ENDED").catch(() => {});
    }
    callIdRef.current = null;
    clearSession();
    sequenceRef.current = 1;
    setCurrentTurnIdx(0);
    dispatch({ type: ACTION.RESET });
  }, [apiClient, callIdRef, clearSession, dispatch, postCallTranscriptSync, sequenceRef, setCurrentTurnIdx, sseRef, stateRef]);
}
