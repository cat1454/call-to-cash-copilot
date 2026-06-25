import { useCallback, useRef } from "react";

import { ACTION } from "./serverSimulationState.js";

export function usePaymentIntentCreation({ apiClient, dispatch, idempotencyKey, stateRef, toError }) {
  const paymentCreatingRef = useRef(false);
  return useCallback(async () => {
    const bookingId = stateRef.current.bookingId;
    if (!apiClient || !bookingId || paymentCreatingRef.current) return;
    paymentCreatingRef.current = true;
    try {
      const intent = await apiClient.createPayment(
        { bookingId },
        idempotencyKey(`payment-${bookingId}`)
      );
      dispatch({ type: ACTION.PAYMENT_INTENT_CREATED, intent });
    } catch (caught) {
      dispatch({ type: ACTION.ERROR, error: toError(caught) });
    } finally {
      paymentCreatingRef.current = false;
    }
  }, [apiClient, dispatch, idempotencyKey, stateRef, toError]);
}
