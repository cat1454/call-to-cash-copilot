import { cn } from "../../lib/cn";

/**
 * StatusDot — Animated status indicator dot.
 *
 * variant:
 *   active  → primary green pulse (live call)
 *   success → success green pulse (confirmed)
 *   warning → amber pulse (pending)
 *   error   → mismatch red pulse (tamper/critical)
 *   idle    → neutral grey (inactive)
 */
const dotConfig = {
  active:  { color: "bg-[#059669]", pulse: "[animation:pulse-primary_2s_ease-in-out_infinite]" },
  success: { color: "bg-[#10b981]", pulse: "[animation:pulse-success_2s_ease-in-out_infinite]" },
  warning: { color: "bg-[#f59e0b]", pulse: "[animation:pulse-warning_2s_ease-in-out_infinite]" },
  error:   { color: "bg-[#f43f5e]", pulse: "[animation:pulse-mismatch_2s_ease-in-out_infinite]" },
  idle:    { color: "bg-[#d1d5db]", pulse: "" },
};

export function StatusDot({ variant = "idle", className, size = "sm" }) {
  const cfg = dotConfig[variant] ?? dotConfig.idle;
  const sizeCls = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  return (
    <span
      className={cn(
        "inline-block rounded-full shrink-0 motion-reduce:animate-none",
        sizeCls,
        cfg.color,
        cfg.pulse,
        className
      )}
    />
  );
}
