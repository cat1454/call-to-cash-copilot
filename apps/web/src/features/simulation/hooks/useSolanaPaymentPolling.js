import { useEffect } from "react";

export function scheduleSolanaPaymentPoll(verifyPayment, timers = globalThis) {
  const timer = timers.setTimeout(() => void verifyPayment(), 3_000);
  return () => timers.clearTimeout(timer);
}

export function useSolanaPaymentPolling(state, verifyPayment) {
  useEffect(() => {
    if (
      state.paymentIntent?.provider !== "solana_devnet" ||
      !state.showPaymentDrawer ||
      state.paymentActionPending
    ) {
      return;
    }

    return scheduleSolanaPaymentPoll(verifyPayment);
  }, [
    state.paymentActionPending,
    state.paymentIntent?.provider,
    state.showPaymentDrawer,
    verifyPayment
  ]);
}
