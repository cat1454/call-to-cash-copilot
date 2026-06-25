export function getReplayDelayMs({ turnIndex, speaker }) {
  if (turnIndex === 0) return 700;
  return speaker === "agent" ? 1_100 : 650;
}
