import { useEffect, useState } from "react";

/**
 * Reads the safe Revenue Twin aggregate only. It never supplies fare,
 * capacity, policy or offer authority from the browser.
 */
export function useRevenueTwinDashboard(apiClient) {
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState(apiClient ? "loading" : "demo");

  useEffect(() => {
    if (!apiClient) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await apiClient.getRevenueTwinDashboard();
        if (!cancelled) {
          setDashboard(next);
          setStatus("live");
        }
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [apiClient]);

  return { dashboard, status };
}
