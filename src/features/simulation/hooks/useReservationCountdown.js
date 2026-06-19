import { useEffect } from "react";

export function useReservationCountdown({
  showPaymentDrawer,
  setBtnPhonePayBg,
  setBtnPhonePayDisabled,
  setBtnPhonePayText,
  setDrawerTimerText
}) {
  useEffect(() => {
    let interval = null;

    if (showPaymentDrawer) {
      let secondsLeft = 600;

      interval = setInterval(() => {
        secondsLeft--;

        if (secondsLeft <= 0) {
          clearInterval(interval);
          setDrawerTimerText("⏰ Đã hết thời gian giữ chỗ!");
          setBtnPhonePayDisabled(true);
          setBtnPhonePayBg("#ef4444");
          setBtnPhonePayText("Thời gian giao dịch hết hạn");
          return;
        }

        const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
        const secs = (secondsLeft % 60).toString().padStart(2, "0");
        setDrawerTimerText(`⏰ Thời gian giữ chỗ: ${mins}:${secs}`);
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [
    showPaymentDrawer,
    setBtnPhonePayBg,
    setBtnPhonePayDisabled,
    setBtnPhonePayText,
    setDrawerTimerText
  ]);
}
