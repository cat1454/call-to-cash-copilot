import type { DatabaseClient } from "@call-to-cash/db";
import type { AiProvider, AiExtractionMode } from "@call-to-cash/config";
import type { BookingExtractor } from "@call-to-cash/ai";
import type { ConfirmBookingRequestSchema } from "@call-to-cash/shared";
import type { z } from "zod";

import { ApiCommandError } from "../../platform/http/api-command-error.js";
import { appendTranscriptTurn } from "./commands/append-transcript-turn.js";
import { createCallSession } from "./commands/create-call-session.js";
import { endCallSession } from "./commands/end-call-session.js";
import { getCallRisk } from "./queries/get-call-risk.js";
import { getCallSession } from "./queries/get-call-session.js";
import { getCallTranscript } from "./queries/get-call-transcript.js";
import type { AppendTranscriptTurnInput, CreateCallSessionInput, ServiceData } from "./types.js";

type ConfirmBookingRequest = z.infer<typeof ConfirmBookingRequestSchema>;

export type CallSessionHandlers = {
  createCall(input: CreateCallSessionInput): Promise<ServiceData>;
  getCall(callId: string): Promise<ServiceData>;
  endCall(callId: string, reason: string, requestId: string): Promise<ServiceData>;
  appendTurn(input: AppendTranscriptTurnInput): Promise<ServiceData>;
  getRisk(callId: string): Promise<ServiceData>;
  getTranscript(callId: string): Promise<ServiceData>;
};

function requireDatabaseClient(databaseClient?: DatabaseClient): DatabaseClient {
  if (databaseClient === undefined) {
    throw new ApiCommandError(
      503,
      "DATABASE_UNAVAILABLE",
      "Database is not configured.",
      undefined,
      true
    );
  }

  return databaseClient;
}

export function createCallSessionHandlers(
  databaseClient?: DatabaseClient,
  aiProvider: AiProvider = "deterministic",
  bookingExtractor?: BookingExtractor,
  aiExtraction?: {
    mode: AiExtractionMode;
    model: string;
    apiKey: string;
    timeoutMs: number;
    promptVersion: string;
  }
): CallSessionHandlers {
  return {
    createCall(input) {
      return createCallSession(requireDatabaseClient(databaseClient), input);
    },
    getCall(callId) {
      return getCallSession(requireDatabaseClient(databaseClient), callId);
    },
    endCall(callId, reason, requestId) {
      return endCallSession(requireDatabaseClient(databaseClient), { callId, reason, requestId });
    },
    appendTurn(input) {
      return appendTranscriptTurn(
        requireDatabaseClient(databaseClient),
        input,
        undefined,
        aiProvider,
        bookingExtractor,
        aiExtraction
      );
    },
    getRisk(callId) {
      return getCallRisk(requireDatabaseClient(databaseClient), callId);
    },
    getTranscript(callId) {
      return getCallTranscript(requireDatabaseClient(databaseClient), callId);
    }
  };
}

export type { ConfirmBookingRequest };
