import { useEffect } from "react";

const INITIAL_DELAY_MS = 3_000;
const MAX_DELAY_MS = 30_000;

export function getSolanaPollDelayMs(attempt) {
  return Math.min(INITIAL_DELAY_MS * 2 ** Math.max(0, attempt), MAX_DELAY_MS);
}

export function scheduleSolanaPaymentPoll(verifyPayment, attempt = 0, timers = globalThis) {
  const timer = timers.setTimeout(() => void verifyPayment(), getSolanaPollDelayMs(attempt));
  return () => timers.clearTimeout(timer);
}

export function useSolanaPaymentPolling(state, verifyPayment) {
  useEffect(() => {
    if (
      state.paymentIntent?.provider !== "solana_devnet" ||
      !state.showPaymentDrawer ||
      !state.paymentWalletOpened ||
      state.paymentActionPending
    ) {
      return;
    }

    return scheduleSolanaPaymentPoll(verifyPayment, state.paymentPollAttempt);
  }, [
    state.paymentActionPending,
    state.paymentPollAttempt,
    state.paymentIntent?.provider,
    state.paymentWalletOpened,
    state.showPaymentDrawer,
    verifyPayment
  ]);
}
