import { useCallback, useEffect, useRef } from "react";

import { ACTION } from "./serverSimulationState.js";
import { hasCustomerAndAgentTurns } from "./transcriptCompleteness.js";

const SYNC_DELAY_MS = 1_000;
const SYNC_ATTEMPTS = 12;

export function usePostCallTranscriptSync({
  apiClient,
  callIdRef,
  dispatch,
  recoverServerState,
  status
}) {
  const timerRef = useRef(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const callId = callIdRef.current;
    if (!apiClient || !callId) return;
    cancel();
    dispatch({ type: ACTION.POST_CALL_TRANSCRIPT_SYNC_STARTED });
    let attempts = 0;
    const recover = async () => {
      try {
        const result = await recoverServerState(callId);
        if (hasCustomerAndAgentTurns(result.transcript?.turns)) return;
      } catch {
        // The SSE stream remains connected while a delayed provider history is retried.
      }
      attempts += 1;
      if (attempts >= SYNC_ATTEMPTS) {
        dispatch({ type: ACTION.POST_CALL_TRANSCRIPT_SYNC_TIMED_OUT });
        return;
      }
      timerRef.current = setTimeout(() => void recover(), SYNC_DELAY_MS);
    };
    void recover();
  }, [apiClient, callIdRef, cancel, dispatch, recoverServerState]);

  useEffect(() => {
    if (status !== "PENDING") cancel();
  }, [cancel, status]);

  useEffect(() => cancel, [cancel]);

  return { cancel, start };
}
