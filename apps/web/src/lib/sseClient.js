const MIN_RETRY_MS = 500;
const MAX_RETRY_MS = 30_000;

function parseBlock(block, onEvent, setLastEventId) {
  const lines = block.split("\n");
  let eventName = "message";
  let eventId = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") eventName = value;
    if (field === "id" && !value.includes("\0")) eventId = value;
    if (field === "data") dataLines.push(value);
  }

  if (eventId) setLastEventId(eventId);
  if (dataLines.length === 0) return;

  try {
    onEvent(eventName, JSON.parse(dataLines.join("\n")));
  } catch {
    // A malformed frame is ignored; the stream remains available for later events.
  }
}

export function createSseParser(onEvent, initialLastEventId) {
  let buffer = "";
  let lastEventId = initialLastEventId;

  function drain(complete) {
    buffer = buffer.replace(/\r\n/gu, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (block.trim())
        parseBlock(block, onEvent, (id) => {
          lastEventId = id;
        });
      boundary = buffer.indexOf("\n\n");
    }

    if (complete && buffer.trim()) {
      parseBlock(buffer, onEvent, (id) => {
        lastEventId = id;
      });
      buffer = "";
    }
  }

  return {
    push(chunk) {
      buffer += chunk;
      drain(false);
    },
    end() {
      drain(true);
    },
    getLastEventId() {
      return lastEventId;
    }
  };
}

export function createSseClient(options) {
  const {
    baseUrl,
    callId,
    onEvent,
    onError,
    onOpen,
    onClose,
    onStatus,
    fetchFn = globalThis.fetch,
    setTimeoutFn = globalThis.setTimeout,
    clearTimeoutFn = globalThis.clearTimeout
  } = options;

  let lastEventId;
  let retryMs = MIN_RETRY_MS;
  let destroyed = false;
  let connected = false;
  let retryTimer = null;
  let controller = null;

  function updateStatus(status) {
    onStatus?.(status);
  }

  function scheduleReconnect() {
    if (destroyed) return;
    retryTimer = setTimeoutFn(() => {
      retryTimer = null;
      void connect(true);
    }, retryMs);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }

  async function connect(isReconnect = false) {
    if (destroyed) return;
    updateStatus(isReconnect ? "reconnecting" : "connecting");
    controller = new AbortController();

    const headers = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache"
    };
    if (lastEventId) headers["Last-Event-ID"] = lastEventId;

    try {
      const response = await fetchFn(`${baseUrl}/v1/calls/${callId}/events`, {
        method: "GET",
        cache: "no-store",
        headers,
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: HTTP ${response.status}`);
      }

      connected = true;
      retryMs = MIN_RETRY_MS;
      updateStatus("open");
      onOpen?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser(onEvent, lastEventId);
      while (!destroyed) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
        lastEventId = parser.getLastEventId();
      }
      parser.push(decoder.decode());
      parser.end();
      lastEventId = parser.getLastEventId();

      if (!destroyed) {
        connected = false;
        updateStatus("reconnecting");
        scheduleReconnect();
      }
    } catch (caught) {
      connected = false;
      if (destroyed || (caught instanceof Error && caught.name === "AbortError")) return;
      const error = caught instanceof Error ? caught : new Error(String(caught));
      updateStatus("error");
      onError?.(error);
      scheduleReconnect();
    }
  }

  void connect();

  return {
    disconnect() {
      if (destroyed) return;
      destroyed = true;
      connected = false;
      if (retryTimer !== null) clearTimeoutFn(retryTimer);
      controller?.abort();
      updateStatus("closed");
      onClose?.();
    },
    isConnected() {
      return connected;
    }
  };
}
