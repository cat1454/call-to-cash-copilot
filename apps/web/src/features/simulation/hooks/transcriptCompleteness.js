export function hasCustomerAndAgentTurns(turns) {
  if (!Array.isArray(turns)) return false;
  const hasCustomer = turns.some(
    (turn) => turn?.speaker === "CUSTOMER" || turn?.sender === "customer"
  );
  const hasAgent = turns.some((turn) => turn?.speaker === "AGENT" || turn?.sender === "ai");
  return hasCustomer && hasAgent;
}

export function shouldShowAgentReplyPending(turns, isActive) {
  if (!isActive || !Array.isArray(turns) || turns.length === 0) return false;

  const lastTurn = turns.at(-1);
  return lastTurn?.speaker === "CUSTOMER" || lastTurn?.sender === "customer";
}

export const AGENT_REPLY_SLOW_MS = 8_000;

export function getAgentReplyStatus(turns, isActive, now = Date.now()) {
  if (!shouldShowAgentReplyPending(turns, isActive)) return "idle";
  const timestamp = Date.parse(turns.at(-1)?.timestamp ?? "");
  if (!Number.isFinite(timestamp)) return "pending";
  return now - timestamp >= AGENT_REPLY_SLOW_MS ? "slow" : "pending";
}
