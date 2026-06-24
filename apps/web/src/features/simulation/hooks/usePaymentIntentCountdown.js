import { useEffect, useState } from "react";

function formatRemaining(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1_000));
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  return `Giữ chỗ còn ${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function getPaymentIntentCountdown(expiresAt, now = Date.now()) {
  const expiresAtMs = Date.parse(expiresAt ?? "");
  return Number.isFinite(expiresAtMs) ? formatRemaining(expiresAtMs - now) : "Đang tạo thời hạn giữ chỗ...";
}

export function usePaymentIntentCountdown(expiresAt, active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active, expiresAt]);
  return getPaymentIntentCountdown(expiresAt, now);
}
