import assert from "node:assert/strict";
import test from "node:test";

import { EventName } from "@call-to-cash/shared";

import { ACTION, makeInitialState, reducer } from "./serverSimulationState.js";
import {
  getAgentReplyStatus,
  hasCustomerAndAgentTurns,
  shouldShowAgentReplyPending
} from "./transcriptCompleteness.js";

const occurredAt = "2026-06-22T10:00:00.000Z";

test("keeps the live transcript surface available while post-call history is reconciled", () => {
  const syncing = reducer(
    { ...makeInitialState(), callId: "call_public1", isSimulating: true },
    { type: ACTION.POST_CALL_TRANSCRIPT_SYNC_STARTED }
  );
  const ended = reducer(syncing, {
    type: ACTION.SERVER_EVENT,
    envelope: {
      eventId: "evt_public1",
      event: EventName.CallEnded,
      version: 1,
      occurredAt,
      callId: "call_public1",
      bookingId: null,
      sequence: 1,
      data: { status: "ENDED", reason: "CUSTOMER_ENDED", endedAt: occurredAt }
    }
  });
  const completed = reducer(ended, {
    type: ACTION.TRANSCRIPT_SYNCED,
    transcript: {
      turns: [
        { turnId: "turn_public1", sequenceNo: 1, speaker: "CUSTOMER", content: "Xin chào" },
        {
          turnId: "turn_agent1",
          sequenceNo: 2,
          speaker: "AGENT",
          content: "Mình có thể hỗ trợ bạn đặt chuyến nào?"
        }
      ]
    }
  });

  assert.equal(ended.postCallTranscriptSync, "PENDING");
  assert.equal(ended.simStatus, "Đang đồng bộ hội thoại sau cuộc gọi...");
  assert.equal(completed.postCallTranscriptSync, "COMPLETE");
  assert.equal(completed.simStatus, "Đã hoàn thành");
  assert.deepEqual(completed.transcript, [
    { sender: "customer", text: "Xin chào", turnId: "turn_public1" },
    {
      sender: "ai",
      text: "Mình có thể hỗ trợ bạn đặt chuyến nào?",
      turnId: "turn_agent1"
    }
  ]);
});

test("REST transcript sync updates phone subtitles to the latest recovered turn", () => {
  const state = reducer(makeInitialState(), {
    type: ACTION.TRANSCRIPT_SYNCED,
    transcript: {
      turns: [
        { turnId: "turn_public1", sequenceNo: 1, speaker: "CUSTOMER", content: "Hello" },
        { turnId: "turn_agent1", sequenceNo: 2, speaker: "AGENT", content: "I can help." }
      ]
    }
  });

  assert.equal(state.subtitles.speaker, "Tổng đài AI");
  assert.equal(state.subtitles.text, "I can help.");
});

test("projects an AI transcript turn into the left-side AI conversation surface", () => {
  const state = reducer(makeInitialState(), {
    type: ACTION.SERVER_EVENT,
    envelope: {
      eventId: "evt_agent1",
      event: EventName.TranscriptTurnCreated,
      version: 1,
      occurredAt,
      callId: "call_public1",
      bookingId: null,
      sequence: 1,
      data: {
        turnId: "turn_agent1",
        sequenceNo: 1,
        speaker: "AGENT",
        content: "Mình đã ghi nhận, bạn muốn đi lúc mấy giờ?",
        isFinal: true,
        timestamp: occurredAt
      }
    }
  });

  assert.deepEqual(state.transcript, [
    {
      sender: "ai",
      text: "Mình đã ghi nhận, bạn muốn đi lúc mấy giờ?",
      turnId: "turn_agent1",
      timestamp: occurredAt
    }
  ]);
  assert.equal(state.subtitles.speaker, "Tổng đài AI");
});

test("post-call sync waits until both customer and AI turns are available", () => {
  assert.equal(hasCustomerAndAgentTurns([{ speaker: "CUSTOMER" }]), false);
  assert.equal(hasCustomerAndAgentTurns([{ speaker: "CUSTOMER" }, { speaker: "AGENT" }]), true);
});

test("shows an AI pending state only while an active call waits after a customer turn", () => {
  assert.equal(shouldShowAgentReplyPending([{ sender: "customer" }], true), true);
  assert.equal(
    shouldShowAgentReplyPending([{ sender: "customer" }, { sender: "ai" }], true),
    false
  );
  assert.equal(shouldShowAgentReplyPending([{ sender: "customer" }], false), false);
});

test("marks an unanswered customer turn as slow after eight seconds", () => {
  const customerTurn = [{ sender: "customer", timestamp: "2026-06-22T10:00:00.000Z" }];
  assert.equal(
    getAgentReplyStatus(customerTurn, true, Date.parse("2026-06-22T10:00:07Z")),
    "pending"
  );
  assert.equal(getAgentReplyStatus(customerTurn, true, Date.parse("2026-06-22T10:00:08Z")), "slow");
  assert.equal(
    getAgentReplyStatus(
      [...customerTurn, { sender: "ai", timestamp: "2026-06-22T10:00:09Z" }],
      true
    ),
    "idle"
  );
});
