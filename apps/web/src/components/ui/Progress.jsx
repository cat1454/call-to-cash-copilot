import { cn } from "../../lib/cn";

/**
 * Progress — Animated progress bar with tabular-nums value display.
 *
 * tone variants:
 *   primary → #059669 (call readiness, general progress)
 *   success → #10B981 (confirmed completion)
 *   warning → #F59E0B (partial, pending)
 *   mismatch → #F43F5E (risk/tamper — use sparingly)
 */
const toneBar = {
  primary:  "bg-[#059669]",
  success:  "bg-[#10b981]",
  warning:  "bg-[#f59e0b]",
  mismatch: "bg-[#f43f5e]",
};

export function Progress({
  value = 0,
  max = 100,
  tone = "primary",
  label,
  showValue = false,
  className,
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {(label || showValue) && (
        <div className="flex items-end justify-between gap-3">
          {label && (
            <span className="text-xs leading-4 font-medium text-[#374151]">{label}</span>
          )}
          {showValue && (
            <span className="tabular-nums text-lg leading-6 font-semibold text-[#111827]">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className="h-2.5 w-full bg-[#f3f4f6] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            toneBar[tone] ?? toneBar.primary
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
