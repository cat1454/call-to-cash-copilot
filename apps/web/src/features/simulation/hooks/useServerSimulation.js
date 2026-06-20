/**
 * useServerSimulation — Phase 7 API-driven simulation loop.
 *
 * Replaces the client-side mock simulation when apiMode=true.
 * Drives the full Call → Transcript → Risk → Booking → Payment → Receipt
 * flow through the API; listens to SSE for server-pushed state changes.
 *
 * When apiMode=false, this hook is NOT used — useCallSimulation keeps
 * the existing pure-mock loop. Reducer and ACTION constants live in
 * serverSimulationState.js to keep this file under 300 lines.
 *
 * @module useServerSimulation
 */

import { useCallback, useReducer, useRef, useState, useEffect } from "react";
import { createSseClient } from "../../../lib/sseClient";
import { ACTION, makeInitialState, reducer } from "./serverSimulationState";

function toError(err) {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * useServerSimulation
 *
 * @param {object|null} apiClient   - REST client (null when offline / apiMode=false).
 * @param {string}      apiBaseUrl  - Base URL for SSE connection.
 * @param {number}      scenarioIdx - Selected scenario index (0-2).
 * @param {Array}       scenarios   - Scenario fixtures from data/scenarios.
 * @returns {object} Flat state bag + action functions.
 */
export default function useServerSimulation(apiClient, apiBaseUrl, scenarioIdx, scenarios) {
  const [state, dispatch] = useReducer(reducer, undefined, makeInitialState);
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const sseRef = useRef(null);
  const seqRef = useRef(1);

  // ---- SSE listener ---------------------------------------------------

  const connectSse = useCallback(
    (callId) => {
      if (!apiBaseUrl) return;
      const sse = createSseClient({
        baseUrl: apiBaseUrl,
        callId,
        onEvent(name, data) {
          if (name === "risk.score.updated") {
            dispatch({
              type: ACTION.RISK_UPDATED,
              completenessScore: data.completenessScore ?? 0,
              disputeRisk: data.disputeRisk ?? 0,
              paymentReadiness: data.paymentReadiness ?? 0
            });
          } else if (name === "risk.payment_gate.updated") {
            dispatch({ type: ACTION.GATE_UPDATED, gate: data.gate, bookingId: data.bookingId });
          } else if (name === "booking.updated") {
            dispatch({ type: ACTION.BOOKING_UPDATED, bookingId: data.bookingId });
          } else if (name === "payment.confirmed") {
            dispatch({ type: ACTION.PAYMENT_CONFIRMED });
          } else if (name === "receipt.created") {
            dispatch({ type: ACTION.RECEIPT_CREATED, receiptId: data.receiptId });
          } else if (name === "receipt.verified") {
            dispatch({ type: ACTION.RECEIPT_VERIFIED, proofHash: data.proofHash, status: data.status, txSig: null });
          }
        },
        onError(err) {
          console.warn("[useServerSimulation] SSE error", err);
        }
      });
      sseRef.current = sse;
    },
    [apiBaseUrl]
  );

  // ---- Actions --------------------------------------------------------

  /** Start a new server-authoritative simulation run. */
  const startSimulation = useCallback(async () => {
    if (!apiClient || state.isSimulating) return;
    dispatch({ type: ACTION.START });
    try {
      const call = await apiClient.createCall({ sourceMode: "TRANSCRIPT_REPLAY" });
      dispatch({ type: ACTION.CALL_CREATED, callId: call.callId });
      connectSse(call.callId);
      setCurrentTurnIdx(0);
    } catch (err) {
      dispatch({ type: ACTION.ERROR, error: toError(err) });
    }
  }, [apiClient, connectSse, state.isSimulating]);

  /** Submit the next scenario turn to the API. Called by the animation loop. */
  const submitNextTurn = useCallback(
    async (callId) => {
      if (!apiClient) return false;
      const turns = scenarios[scenarioIdx] ?? [];
      if (currentTurnIdx >= turns.length) return false;
      const scenarioTurn = turns[currentTurnIdx];
      if (!scenarioTurn) return false;
      const speaker = scenarioTurn.sender === "customer" ? "CUSTOMER" : "AGENT";
      try {
        const resp = await apiClient.submitTranscriptTurn(callId, {
          clientTurnId: `client-turn-${scenarioIdx}-${currentTurnIdx}-${Date.now()}`,
          sequenceNo: seqRef.current++,
          speaker,
          content: scenarioTurn.text,
          language: "vi-VN",
          isFinal: true,
          source: "REPLAY"
        });
        dispatch({ type: ACTION.TURN_ADDED, speaker: scenarioTurn.sender, text: scenarioTurn.text, turnId: resp.turnId });
        setCurrentTurnIdx((idx) => idx + 1);
        return true;
      } catch (err) {
        dispatch({ type: ACTION.ERROR, error: toError(err) });
        return false;
      }
    },
    [apiClient, scenarioIdx, scenarios, currentTurnIdx]
  );

  /** Open the mock payment drawer after gate unlocks. */
  const triggerPayment = useCallback(
    async (bookingId) => {
      if (!apiClient || !bookingId) return;
      try {
        const idempotencyKey = `mock-pi-${bookingId}-v1-${Date.now()}`;
        const intent = await apiClient.createMockPayment({ bookingId }, idempotencyKey);
        dispatch({ type: ACTION.PAYMENT_DRAWER_OPEN, paymentIntentId: intent.paymentIntentId });
      } catch (err) {
        dispatch({ type: ACTION.ERROR, error: toError(err) });
      }
    },
    [apiClient]
  );

  /** Simulate wallet payment (happy path). */
  const simulateWalletPayment = useCallback(
    async (paymentIntentId, paymentData) => {
      if (!apiClient || !paymentIntentId || !paymentData) return;
      try {
        const idempotencyKey = `mock-verify-${paymentIntentId}-${Date.now()}`;
        await apiClient.verifyMockPayment(
          {
            paymentIntentId,
            observedAmount: paymentData.amount,
            observedRecipient: paymentData.recipient,
            observedReference: paymentData.reference
          },
          idempotencyKey
        );
      } catch (err) {
        dispatch({ type: ACTION.ERROR, error: toError(err) });
      }
    },
    [apiClient]
  );

  /** Tamper: verify with wrong candidate amount to trigger MISMATCH. */
  const tamperAgreement = useCallback(
    async (receiptId) => {
      if (!apiClient || !receiptId) return;
      dispatch({ type: ACTION.TAMPER_APPLIED });
      try {
        await apiClient.verifyReceipt(receiptId, { candidateDepositAmountMinor: 1 });
      } catch {
        // MISMATCH error is expected; server has already persisted the mismatch.
      }
    },
    [apiClient]
  );

  /** Reset to initial state and disconnect SSE. */
  const resetSimulation = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.disconnect();
      sseRef.current = null;
    }
    seqRef.current = 1;
    setCurrentTurnIdx(0);
    dispatch({ type: ACTION.RESET });
  }, []);

  // ---- Effects --------------------------------------------------------

  // Auto-submit turns when simulating
  useEffect(() => {
    if (!state.isSimulating || !state.callId || !apiClient || state.paymentGate !== "LOCKED") return;

    const turns = scenarios[scenarioIdx] ?? [];
    if (currentTurnIdx >= turns.length) return;

    const delay = currentTurnIdx === 0 ? 1000 : (turns[currentTurnIdx - 1]?.sender === "ai" ? 4200 : 3800);

    const timer = setTimeout(() => {
      void submitNextTurn(state.callId);
    }, delay);

    return () => clearTimeout(timer);
  }, [state.isSimulating, state.callId, currentTurnIdx, scenarioIdx, scenarios, apiClient, state.paymentGate, submitNextTurn]);

  // Auto-trigger payment drawer when gate unlocks
  useEffect(() => {
    if (state.paymentGate === "UNLOCKED" && state.bookingId && !state.paymentIntentId && !state.showPaymentDrawer && apiClient) {
      void triggerPayment(state.bookingId);
    }
  }, [state.paymentGate, state.bookingId, state.paymentIntentId, state.showPaymentDrawer, apiClient, triggerPayment]);

  return {
    ...state,
    currentTurnIdx,
    submitNextTurn,
    startSimulation,
    triggerPayment,
    simulateWalletPayment,
    tamperAgreement,
    resetSimulation
  };
}
