import { useCallback, useRef } from "react";

import { ACTION } from "./serverSimulationState.js";

export function useServerEventBatch(dispatch) {
  const eventBatchRef = useRef([]);
  const eventFlushTimerRef = useRef(null);

  const clearQueuedServerEvents = useCallback(() => {
    eventBatchRef.current = [];
    if (eventFlushTimerRef.current !== null) {
      clearTimeout(eventFlushTimerRef.current);
      eventFlushTimerRef.current = null;
    }
  }, []);

  const flushQueuedServerEvents = useCallback(() => {
    const envelopes = eventBatchRef.current;
    clearQueuedServerEvents();
    if (envelopes.length > 0) dispatch({ type: ACTION.SERVER_EVENTS, envelopes });
  }, [clearQueuedServerEvents, dispatch]);

  const queueServerEvent = useCallback(
    (envelope) => {
      eventBatchRef.current.push(envelope);
      if (eventFlushTimerRef.current !== null) return;
      eventFlushTimerRef.current = setTimeout(flushQueuedServerEvents, 16);
    },
    [flushQueuedServerEvents]
  );

  return { clearQueuedServerEvents, flushQueuedServerEvents, queueServerEvent };
}
