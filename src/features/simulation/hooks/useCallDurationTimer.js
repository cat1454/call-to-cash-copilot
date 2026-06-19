import { useEffect } from "react";

export function useCallDurationTimer({
  isWaveAnimating,
  callDuration,
  setCallDuration,
  setPhoneCallStatusText
}) {
  useEffect(() => {
    let interval = null;

    if (isWaveAnimating) {
      interval = setInterval(() => {
        setCallDuration((prev) => {
          const nextSecs = prev + 1;
          const mins = Math.floor(nextSecs / 60).toString().padStart(2, "0");
          const secs = (nextSecs % 60).toString().padStart(2, "0");

          setPhoneCallStatusText(`Cuộc gọi đang diễn ra (${mins}:${secs})`);
          return nextSecs;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isWaveAnimating, setCallDuration, setPhoneCallStatusText]);

  useEffect(() => {
    if (callDuration > 0) {
      console.log(`[Timer] Active call duration: ${callDuration}s`);
    }
  }, [callDuration]);
}
