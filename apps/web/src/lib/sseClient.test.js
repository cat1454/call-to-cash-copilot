import assert from "node:assert/strict";
import { test } from "node:test";

import { EventName } from "@call-to-cash/shared";

import {
  ACTION,
  makeInitialState,
  reducer
} from "../features/simulation/hooks/serverSimulationState.js";
import { createSseClient, createSseParser } from "./sseClient.js";

test("SSE parser reassembles chunked canonical envelopes and ignores heartbeats", () => {
  const received = [];
  const parser = createSseParser((event, envelope) => received.push({ event, envelope }));

  parser.push(
    `: heartbeat\n\nevent: transcript.turn.created\nid: evt_public1\ndata: {"eventId":"evt_public1","event":"transcript.turn.created","data":{"content":"safe`
  );
  parser.push(' text"}}\n\n');

  assert.equal(received.length, 1);
  assert.equal(received[0].event, "transcript.turn.created");
  assert.equal(received[0].envelope.eventId, "evt_public1");
  assert.equal(received[0].envelope.data.content, "safe text");
  assert.equal(parser.getLastEventId(), "evt_public1");
});

test("SSE parser supports CRLF, multiline data, and skips malformed JSON", () => {
  const received = [];
  const parser = createSseParser((event, envelope) => received.push({ event, envelope }));

  parser.push("event: ignored\r\ndata: not-json\r\n\r\n");
  parser.push('event: message\r\nid: evt_public2\r\ndata: {"value":\r\ndata: 2}\r\n\r\n');

  assert.deepEqual(received, [{ event: "message", envelope: { value: 2 } }]);
  assert.equal(parser.getLastEventId(), "evt_public2");
});

test("SSE client reconnects with Last-Event-ID and exposes lifecycle states", async () => {
  const encoder = new TextEncoder();
  const calls = [];
  const scheduled = [];
  const statuses = [];

  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) {
      let readCount = 0;
      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            return {
              async read() {
                readCount += 1;
                if (readCount === 1) {
                  return {
                    done: false,
                    value: encoder.encode(
                      'event: call.created\nid: evt_cursor1\ndata: {"eventId":"evt_cursor1"}\n\n'
                    )
                  };
                }
                return { done: true };
              }
            };
          }
        }
      };
    }

    return {
      ok: true,
      status: 200,
      body: {
        getReader() {
          return { read: () => new Promise(() => {}) };
        }
      }
    };
  };

  const client = createSseClient({
    baseUrl: "http://localhost:3001",
    callId: "call_public1",
    fetchFn,
    onEvent() {},
    onStatus: (status) => statuses.push(status),
    setTimeoutFn(callback) {
      scheduled.push(callback);
      return scheduled.length;
    },
    clearTimeoutFn() {}
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(statuses.slice(0, 3), ["connecting", "open", "reconnecting"]);
  scheduled[0]();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers["Last-Event-ID"], "evt_cursor1");
  assert.equal(calls[1].init.cache, "no-store");
  assert.equal(statuses.includes("open"), true);

  client.disconnect();
  assert.equal(statuses.at(-1), "closed");
});

test("committed canonical SSE frames feed privacy-safe UI transcript state", async () => {
  const envelope = {
    eventId: "evt_committed1",
    event: EventName.TranscriptTurnCreated,
    version: 1,
    occurredAt: "2026-06-21T10:00:00.000Z",
    callId: "call_public1",
    bookingId: null,
    sequence: 1,
    data: {
      turnId: "turn_public1",
      sequenceNo: 1,
      speaker: "CUSTOMER",
      content: "Liên hệ [PHONE]",
      isFinal: true,
      timestamp: "2026-06-21T10:00:00.000Z"
    }
  };
  const frame = `event: ${envelope.event}\nid: ${envelope.eventId}\ndata: ${JSON.stringify(envelope)}\n\n`;
  const encoder = new TextEncoder();
  let state = makeInitialState();
  let readCount = 0;

  const client = createSseClient({
    baseUrl: "http://localhost:3001",
    callId: envelope.callId,
    fetchFn: async () => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            read() {
              readCount += 1;
              if (readCount === 1) {
                return Promise.resolve({ done: false, value: encoder.encode(frame) });
              }
              return new Promise(() => {});
            }
          };
        }
      }
    }),
    onEvent(_eventName, receivedEnvelope) {
      state = reducer(state, { type: ACTION.SERVER_EVENT, envelope: receivedEnvelope });
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(state.transcript, [
    {
      sender: "customer",
      text: "Liên hệ [PHONE]",
      turnId: "turn_public1",
      timestamp: "2026-06-21T10:00:00.000Z"
    }
  ]);
  assert.equal(JSON.stringify(state).includes("0912345678"), false);
  client.disconnect();
});
