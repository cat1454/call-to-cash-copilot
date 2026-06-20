import { EventName } from "@call-to-cash/shared";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { createSseClient } from "../../../lib/sseClient";
import {
  isDefinitivePaymentMismatch,
  recoverServerState as recoverAuthoritativeState,
  recoveryEvents
} from "./serverRecovery.js";
import { ACTION, makeInitialState, reducer } from "./serverSimulationState";
import { useServerSessionRecovery } from "./useServerSessionRecovery.js";

function toError(caught) {
  return caught instanceof Error ? caught : new Error(String(caught));
}

function idempotencyKey(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
}

export default function useServerSimulation(apiClient, apiBaseUrl, scenarioIdx, scenarios) {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const stateRef = useRef(state);
  const sseRef = useRef(null);
  const callIdRef = useRef(null);
  const sequenceRef = useRef(1);
  const recoveryTimerRef = useRef(null);
  const paymentCreatingRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const recoverServerState = useCallback(
    (callId, hints = {}) => {
      if (!apiClient || !callId) return Promise.resolve({});
      return recoverAuthoritativeState(apiClient, dispatch, stateRef.current, callId, hints);
    },
    [apiClient]
  );

  const scheduleRecovery = useCallback(
    (callId, hints = {}) => {
      if (recoveryTimerRef.current !== null) clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null;
        void recoverServerState(callId, hints).catch((caught) => {
          dispatch({ type: ACTION.ERROR, error: toError(caught) });
        });
      }, 50);
    },
    [recoverServerState]
  );

  const connectSse = useCallback(
    (callId) => {
      if (!apiBaseUrl) return;
      sseRef.current?.disconnect();
      sseRef.current = createSseClient({
        baseUrl: apiBaseUrl,
        callId,
        onEvent(eventName, envelope) {
          dispatch({ type: ACTION.SERVER_EVENT, envelope });
          if (eventName === EventName.ReceiptCreated) {
            scheduleRecovery(callId, { receiptId: envelope?.data?.receiptId });
          } else if (recoveryEvents.has(eventName)) {
            scheduleRecovery(callId, { bookingId: envelope?.bookingId });
          }
        },
        onOpen() {
          scheduleRecovery(callId);
        },
        onError(error) {
          dispatch({ type: ACTION.STREAM_STATUS, status: "error", error });
        },
        onStatus(status) {
          dispatch({ type: ACTION.STREAM_STATUS, status });
        }
      });
    },
    [apiBaseUrl, scheduleRecovery]
  );

  const clearSession = useServerSessionRecovery({
    apiClient,
    apiBaseUrl,
    state,
    dispatch,
    connectSse,
    recoverServerState,
    callIdRef,
    sseRef
  });

  const finishReplay = useCallback(
    async (callId, confirmedTurnId) => {
      if (!apiClient) return;
      const recovered = await recoverServerState(callId);
      const booking = recovered.booking;
      if (booking?.status === "AGREEMENT_READY" && booking.agreementVersion) {
        const confirmation = await apiClient.confirmBooking(
          booking.bookingId,
          {
            agreementVersion: booking.agreementVersion,
            confirmation: { method: "VOICE", confirmedTurnId }
          },
          idempotencyKey(`confirm-${booking.bookingId}-v${booking.agreementVersion}`)
        );
        dispatch({ type: ACTION.BOOKING_CONFIRMED, confirmation });
        const lockedBooking = await apiClient.getBooking(booking.bookingId);
        dispatch({ type: ACTION.BOOKING_SYNCED, booking: lockedBooking });
      }

      const endedCall = await apiClient.endCall(callId, "CUSTOMER_ENDED");
      dispatch({ type: ACTION.CALL_SYNCED, call: endedCall });
    },
    [apiClient, recoverServerState]
  );

  const submitNextTurn = useCallback(
    async (callId) => {
      if (!apiClient) return false;
      const turns = scenarios[scenarioIdx] ?? [];
      const scenarioTurn = turns[currentTurnIdx];
      if (!scenarioTurn) return false;

      try {
        const response = await apiClient.submitTranscriptTurn(callId, {
          clientTurnId: `replay-${scenarioIdx}-${currentTurnIdx}-${Date.now()}`,
          sequenceNo: sequenceRef.current++,
          speaker: scenarioTurn.sender === "customer" ? "CUSTOMER" : "AGENT",
          content: scenarioTurn.text
        });
        const nextIndex = currentTurnIdx + 1;
        setCurrentTurnIdx(nextIndex);
        if (nextIndex === turns.length) await finishReplay(callId, response.turnId);
        return true;
      } catch (caught) {
        dispatch({ type: ACTION.ERROR, error: toError(caught) });
        return false;
      }
    },
    [apiClient, currentTurnIdx, finishReplay, scenarioIdx, scenarios]
  );

  const startSimulation = useCallback(async () => {
    if (!apiClient || stateRef.current.isSimulating) return;
    dispatch({ type: ACTION.START });
    try {
      const call = await apiClient.createCall({ sourceMode: "TRANSCRIPT_REPLAY" });
      callIdRef.current = call.callId;
      setCurrentTurnIdx(0);
      sequenceRef.current = 1;
      dispatch({ type: ACTION.CALL_CREATED, call });
      connectSse(call.callId);
    } catch (caught) {
      dispatch({ type: ACTION.ERROR, error: toError(caught) });
    }
  }, [apiClient, connectSse]);

  const triggerPayment = useCallback(async () => {
    const bookingId = stateRef.current.bookingId;
    if (!apiClient || !bookingId || paymentCreatingRef.current) return;
    paymentCreatingRef.current = true;
    try {
      const intent = await apiClient.createMockPayment(
        { bookingId },
        idempotencyKey(`mock-payment-${bookingId}`)
      );
      dispatch({ type: ACTION.PAYMENT_INTENT_CREATED, intent });
    } catch (caught) {
      dispatch({ type: ACTION.ERROR, error: toError(caught) });
    } finally {
      paymentCreatingRef.current = false;
    }
  }, [apiClient]);

  const simulateWalletPayment = useCallback(async () => {
    const intent = stateRef.current.paymentIntent;
    if (!apiClient || !intent || stateRef.current.paymentActionPending) return;
    dispatch({ type: ACTION.PAYMENT_ACTION_STARTED });
    try {
      const result = await apiClient.verifyMockPayment(
        {
          paymentIntentId: intent.paymentIntentId,
          observedAmount: intent.amount,
          observedRecipient: intent.recipient,
          observedReference: intent.reference
        },
        idempotencyKey(`mock-verify-${intent.paymentIntentId}`)
      );
      dispatch({ type: ACTION.PAYMENT_VERIFIED, result });
      await recoverServerState(callIdRef.current, {
        bookingId: result.bookingId,
        receiptId: result.receiptId,
        paymentIntentId: result.paymentIntentId
      });
    } catch (caught) {
      const error = toError(caught);
      if (isDefinitivePaymentMismatch(error)) {
        dispatch({ type: ACTION.PAYMENT_REJECTED, error });
        await recoverServerState(callIdRef.current, {
          bookingId: intent.bookingId,
          paymentIntentId: intent.paymentIntentId
        }).catch(() => {});
      } else dispatch({ type: ACTION.ERROR, error });
    }
  }, [apiClient, recoverServerState]);

  const tamperAgreement = useCallback(async () => {
    const receiptId = stateRef.current.receiptId;
    if (!apiClient || !receiptId) return;
    try {
      const verification = await apiClient.verifyReceipt(receiptId, {
        candidateDepositAmountMinor: 1
      });
      dispatch({ type: ACTION.VERIFICATION_SYNCED, verification });
      const receipt = await apiClient.getReceipt(receiptId);
      dispatch({ type: ACTION.RECEIPT_SYNCED, receipt });
    } catch (caught) {
      dispatch({ type: ACTION.ERROR, error: toError(caught) });
    }
  }, [apiClient]);

  const resetSimulation = useCallback(() => {
    const current = stateRef.current;
    sseRef.current?.disconnect();
    sseRef.current = null;
    if (recoveryTimerRef.current !== null) clearTimeout(recoveryTimerRef.current);
    if (
      apiClient &&
      current.callId &&
      !["ENDED", "CANCELLED", "FAILED"].includes(current.callStatus)
    ) {
      void apiClient.endCall(current.callId, "OPERATOR_ENDED").catch(() => {});
    }
    callIdRef.current = null;
    clearSession();
    sequenceRef.current = 1;
    setCurrentTurnIdx(0);
    dispatch({ type: ACTION.RESET });
  }, [apiClient, clearSession]);

  useEffect(() => {
    if (!state.isSimulating || !state.replayInputEnabled || !state.callId || !apiClient) return;
    const turns = scenarios[scenarioIdx] ?? [];
    if (currentTurnIdx >= turns.length) return;
    const delay = currentTurnIdx === 0 ? 1000 : 3800;
    const timer = setTimeout(() => void submitNextTurn(state.callId), delay);
    return () => clearTimeout(timer);
  }, [
    apiClient,
    currentTurnIdx,
    scenarioIdx,
    scenarios,
    state.callId,
    state.isSimulating,
    state.replayInputEnabled,
    submitNextTurn
  ]);

  useEffect(() => {
    if (
      state.booking?.status === "AGREEMENT_LOCKED" &&
      state.paymentGate === "UNLOCKED" &&
      !state.paymentIntentId
    ) {
      void triggerPayment();
    }
  }, [state.booking?.status, state.paymentGate, state.paymentIntentId, triggerPayment]);

  useEffect(() => {
    if (state.needsRecovery && state.callId) scheduleRecovery(state.callId);
  }, [scheduleRecovery, state.callId, state.needsRecovery]);

  useEffect(
    () => () => {
      sseRef.current?.disconnect();
      if (recoveryTimerRef.current !== null) clearTimeout(recoveryTimerRef.current);
    },
    []
  );

  return {
    ...state,
    currentTurnIdx,
    startSimulation,
    simulateWalletPayment,
    tamperAgreement,
    resetSimulation
  };
}
