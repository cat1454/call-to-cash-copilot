import { useCallback, useState } from "react";

import { ACTION } from "./serverSimulationState.js";
import {
  agreementConfirmationKey,
  isReadyForWebAgreementConfirmation,
  webAgreementConfirmationPayload
} from "./agreementConfirmation.js";

export function useAgreementConfirmation({
  apiClient,
  callIdRef,
  dispatch,
  idempotencyKey,
  requestRecovery,
  stateRef,
  toError,
  booking,
  paymentGate
}) {
  const [dismissedAgreementKey, setDismissedAgreementKey] = useState(null);
  const [editingAgreementKey, setEditingAgreementKey] = useState(null);
  const [webConfirmationPending, setWebConfirmationPending] = useState(false);
  const agreementKey = agreementConfirmationKey(booking);
  const confirmationReady = isReadyForWebAgreementConfirmation(booking, paymentGate);

  const requestAgreementEdit = useCallback(() => {
    const current = stateRef.current.booking;
    if (!current) return;
    const key = agreementConfirmationKey(current);
    setDismissedAgreementKey(key);
    setEditingAgreementKey(key);
  }, [stateRef]);

  const confirmAgreementFromWeb = useCallback(async () => {
    const current = stateRef.current.booking;
    if (
      !apiClient ||
      webConfirmationPending ||
      !isReadyForWebAgreementConfirmation(current, stateRef.current.paymentGate)
    ) {
      return;
    }
    setWebConfirmationPending(true);
    try {
      const confirmation = await apiClient.confirmBooking(
        current.bookingId,
        webAgreementConfirmationPayload(current),
        idempotencyKey(`web-confirm-${current.bookingId}-v${current.agreementVersion}`)
      );
      dispatch({ type: ACTION.BOOKING_CONFIRMED, confirmation });
      await requestRecovery(callIdRef.current, { bookingId: current.bookingId });
    } catch (caught) {
      dispatch({ type: ACTION.ERROR, error: toError(caught) });
    } finally {
      setWebConfirmationPending(false);
    }
  }, [apiClient, callIdRef, dispatch, idempotencyKey, requestRecovery, stateRef, toError, webConfirmationPending]);

  return {
    required: confirmationReady && dismissedAgreementKey !== agreementKey,
    editRequested: confirmationReady && editingAgreementKey === agreementKey,
    pending: webConfirmationPending,
    confirm: confirmAgreementFromWeb,
    requestEdit: requestAgreementEdit
  };
}
