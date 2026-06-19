import { useCallback, useEffect, useRef } from "react";

export function useTimeoutRegistry() {
  const timeoutRefs = useRef([]);

  const clearTimeouts = useCallback(() => {
    timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutRefs.current = [];
  }, []);

  const scheduleTimeout = useCallback((callback, delay) => {
    const timeoutId = setTimeout(callback, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  }, []);

  useEffect(() => clearTimeouts, [clearTimeouts]);

  return { clearTimeouts, scheduleTimeout };
}
