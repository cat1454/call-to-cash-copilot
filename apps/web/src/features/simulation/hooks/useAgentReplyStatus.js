import { useEffect, useState } from "react";

import {
  AGENT_REPLY_SLOW_MS,
  getAgentReplyStatus,
  shouldShowAgentReplyPending
} from "./transcriptCompleteness.js";

export function useAgentReplyStatus(turns, isActive) {
  const [clock, setClock] = useState(() => Date.now());
  const lastTurn = turns.at(-1);
  const pending = shouldShowAgentReplyPending(turns, isActive);

  useEffect(() => {
    if (!pending) return undefined;
    const timestamp = Date.parse(lastTurn?.timestamp ?? "");
    const elapsed = Number.isFinite(timestamp) ? Date.now() - timestamp : 0;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.max(0, AGENT_REPLY_SLOW_MS - elapsed)
    );
    return () => clearTimeout(timer);
  }, [isActive, lastTurn?.turnId, lastTurn?.timestamp, pending]);

  return getAgentReplyStatus(turns, isActive, clock);
}
