export function createSingleFlightRecovery(recover) {
  let active = null;
  let queued = null;

  const run = async (request) => {
    try {
      return await recover(request.callId, request.hints);
    } finally {
      const next = queued;
      queued = null;
      active = null;
      if (next !== null) active = run(next);
    }
  };

  return {
    request(callId, hints = {}) {
      if (active !== null) {
        queued = { callId, hints: { ...(queued?.hints ?? {}), ...hints } };
        return active;
      }
      active = run({ callId, hints });
      return active;
    }
  };
}
