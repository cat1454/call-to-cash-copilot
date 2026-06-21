export class AgentStartBlockedError extends Error {
  constructor() {
    super("Agent start requires an RTC-connected, microphone-published browser.");
  }
}

export function isAgentStartReady(readiness) {
  return readiness?.rtcConnected === true && readiness?.microphonePublished === true;
}

export function createAgentStartGate() {
  let pending = null;
  let completed = false;
  let result;

  return {
    async start(readiness, startAgent) {
      if (!isAgentStartReady(readiness)) throw new AgentStartBlockedError();
      if (completed) return result;
      if (pending) return pending;
      pending = Promise.resolve(startAgent()).then((value) => {
        completed = true;
        result = value;
        return value;
      });
      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
    reset() {
      pending = null;
      completed = false;
      result = undefined;
    }
  };
}
