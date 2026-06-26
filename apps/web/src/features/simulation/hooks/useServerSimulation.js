import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createSseClient } from "../../../lib/sseClient";
import { isDefinitivePaymentMismatch, isRetryablePaymentPending, recoveryHintsForEvent, recoverServerState as recoverAuthoritativeState } from "./serverRecovery.js";
import { getReplayDelayMs } from "./replayPacing.js";
import { createSingleFlightRecovery } from "./serverRecoveryCoordinator.js";
import { ACTION, makeInitialState, reducer } from "./serverSimulationState";
import { buildVerificationPayload } from "./serverPayment.js";
import { useServerSessionRecovery } from "./useServerSessionRecovery.js";
import { useSolanaPaymentPolling } from "./useSolanaPaymentPolling.js";
import { idempotencyKey, toError } from "./serverSimulationUtils.js";
import { usePostCallTranscriptSync } from "./usePostCallTranscriptSync.js";
import { useAgreementConfirmation } from "./useAgreementConfirmation.js";
import { useServerSimulationReset } from "./useServerSimulationReset.js";
import { usePaymentIntentCreation } from "./usePaymentIntentCreation.js";
import { useServerEventBatch } from "./useServerEventBatch.js";
import { useAcceptRevenueTwinOffer, useDeclineRevenueTwinOffer, useRevenueTwinDashboardSync } from "./useRevenueTwinServerIntegration.js";
export default function useServerSimulation(apiClient, apiBaseUrl, scenarioIdx, scenarios) {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const stateRef = useRef(state), sseRef = useRef(null), callIdRef = useRef(null);
  const sequenceRef = useRef(1), recoveryCoordinatorRef = useRef(null);
  useEffect(() => { stateRef.current = state; }, [state]);
  useRevenueTwinDashboardSync(apiClient, dispatch);
  const { clearQueuedServerEvents, flushQueuedServerEvents, queueServerEvent } = useServerEventBatch(dispatch);
  const recoverServerState = useCallback(
    (callId, hints = {}) => {
      if (!apiClient || !callId) return Promise.resolve({});
      return recoverAuthoritativeState(apiClient, dispatch, stateRef.current, callId, hints);
    },
    [apiClient]
  );
  const requestRecovery = useCallback(
    (callId, hints = {}) => {
      if (recoveryCoordinatorRef.current?.recover !== recoverServerState) {
        recoveryCoordinatorRef.current = {
          recover: recoverServerState,
          coordinator: createSingleFlightRecovery(recoverServerState)
        };
      }
      return recoveryCoordinatorRef.current.coordinator.request(callId, hints);
    },
    [recoverServerState]
  );
  const connectSse = useCallback(
    (callId) => {
      if (!apiBaseUrl) return;
      clearQueuedServerEvents();
      sseRef.current?.disconnect();
      sseRef.current = createSseClient({
        baseUrl: apiBaseUrl,
        callId,
        onEvent(eventName, envelope) {
          queueServerEvent(envelope);
          const hints = recoveryHintsForEvent(eventName, envelope);
          if (hints !== null) {
            flushQueuedServerEvents();
            void requestRecovery(callId, hints).catch((caught) => {
              dispatch({ type: ACTION.ERROR, error: toError(caught) });
            });
          }
        },
        onOpen({ reconnected } = {}) {
          if (reconnected) void requestRecovery(callId).catch((caught) => {
            dispatch({ type: ACTION.ERROR, error: toError(caught) });
          });
        },
        onError(error) {
          dispatch({ type: ACTION.STREAM_STATUS, status: "error", error });
        },
        onStatus(status) {
          dispatch({ type: ACTION.STREAM_STATUS, status });
        }
      });
    },
    [apiBaseUrl, clearQueuedServerEvents, flushQueuedServerEvents, queueServerEvent, requestRecovery]
  );
  const clearSession = useServerSessionRecovery({
    apiClient,
    apiBaseUrl,
    state,
    dispatch,
    connectSse,
    recoverServerState: requestRecovery,
    callIdRef,
    sseRef
  });
  const postCallTranscriptSync = usePostCallTranscriptSync({
    apiClient,
    callIdRef,
    dispatch,
    recoverServerState: requestRecovery,
    status: state.postCallTranscriptSync
  });
  const finishReplay = useCallback(
    async (callId, confirmedTurnId) => {
      if (!apiClient) return;
      const recovered = await requestRecovery(callId);
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
    [apiClient, requestRecovery]
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
  const connectLiveCall = useCallback(
    (call) => {
      callIdRef.current = call.callId;
      dispatch({ type: ACTION.START });
      dispatch({ type: ACTION.CALL_CREATED, call, live: true });
      connectSse(call.callId);
    },
    [connectSse]
  );
  const applyLiveTranscriptFrame = useCallback((frame) => {
    dispatch({ type: ACTION.LIVE_TRANSCRIPT_FRAME, frame });
  }, []);
  const triggerPayment = usePaymentIntentCreation({ apiClient, dispatch, idempotencyKey, stateRef, toError });
  const agreementConfirmation = useAgreementConfirmation({
    apiClient,
    callIdRef,
    dispatch,
    idempotencyKey,
    requestRecovery,
    stateRef,
    toError,
    booking: state.booking,
    paymentGate: state.paymentGate
  });
  const simulateWalletPayment = useCallback(async () => {
    const intent = stateRef.current.paymentIntent;
    if (!apiClient || !intent || stateRef.current.paymentActionPending) return;
    dispatch({ type: ACTION.PAYMENT_ACTION_STARTED });
    try {
      const verificationPayload = buildVerificationPayload(intent);
      const result = await apiClient.verifyPayment(
        verificationPayload,
        idempotencyKey(`${intent.provider}-verify-${intent.paymentIntentId}`)
      );
      dispatch({ type: ACTION.PAYMENT_VERIFIED, result });
      await requestRecovery(callIdRef.current, {
        bookingId: result.bookingId,
        receiptId: result.receiptId,
        paymentIntentId: result.paymentIntentId
      });
    } catch (caught) {
      const error = toError(caught);
      if (isDefinitivePaymentMismatch(error)) {
        dispatch({ type: ACTION.PAYMENT_REJECTED, error });
        await requestRecovery(callIdRef.current, {
          bookingId: intent.bookingId,
          paymentIntentId: intent.paymentIntentId
        }).catch(() => {});
      } else if (isRetryablePaymentPending(error)) {
        dispatch({ type: ACTION.PAYMENT_PENDING, error });
      } else dispatch({ type: ACTION.ERROR, error });
    }
  }, [apiClient, requestRecovery]);
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
  const markPaymentWalletOpened = useCallback(() => {
    if (stateRef.current.paymentIntent?.provider === "solana_devnet") dispatch({ type: ACTION.PAYMENT_WALLET_OPENED });
  }, []);

  const acceptRevenueTwinOffer = useAcceptRevenueTwinOffer({ apiClient, callIdRef, requestRecovery, stateRef });
  const declineRevenueTwinOffer = useDeclineRevenueTwinOffer({ apiClient, callIdRef, requestRecovery, stateRef });
  const resetServerSimulation = useServerSimulationReset({
    apiClient,
    callIdRef,
    clearSession,
    dispatch,
    postCallTranscriptSync,
    sequenceRef,
    setCurrentTurnIdx,
    sseRef,
    stateRef
  });
  const resetSimulation = useCallback(() => {
    clearQueuedServerEvents();
    resetServerSimulation();
  }, [clearQueuedServerEvents, resetServerSimulation]);
  useEffect(() => {
    if (!state.isSimulating || !state.replayInputEnabled || !state.callId || !apiClient) return;
    const turns = scenarios[scenarioIdx] ?? [];
    if (currentTurnIdx >= turns.length) return;
    const delay = getReplayDelayMs({ turnIndex: currentTurnIdx, speaker: turns[currentTurnIdx]?.sender });
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
    if (state.needsRecovery && state.callId) void requestRecovery(state.callId).catch((caught) => {
      dispatch({ type: ACTION.ERROR, error: toError(caught) });
    });
  }, [requestRecovery, state.callId, state.needsRecovery]);
  useSolanaPaymentPolling(state, simulateWalletPayment);
  useEffect(
    () => () => {
      clearQueuedServerEvents();
      sseRef.current?.disconnect();
    },
    [clearQueuedServerEvents]
  );

  return {
    ...state,
    currentTurnIdx, startSimulation, connectLiveCall, applyLiveTranscriptFrame,
    startPostCallTranscriptSync: postCallTranscriptSync.start,
    agreementConfirmation,
    acceptRevenueTwinOffer,
    declineRevenueTwinOffer,
    simulateWalletPayment,
    markPaymentWalletOpened,
    tamperAgreement, resetSimulation
  };
}
