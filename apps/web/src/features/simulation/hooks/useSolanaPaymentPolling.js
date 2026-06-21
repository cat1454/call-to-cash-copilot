import { useEffect } from "react";

export function useSolanaPaymentPolling(state, verifyPayment) {
  useEffect(() => {
    if (
      state.paymentIntent?.provider !== "solana_devnet" ||
      !state.showPaymentDrawer ||
      state.paymentActionPending
    ) {
      return;
    }

    const timer = setTimeout(() => void verifyPayment(), 3_000);
    return () => clearTimeout(timer);
  }, [
    state.paymentActionPending,
    state.paymentIntent?.provider,
    state.showPaymentDrawer,
    verifyPayment
  ]);
}
