import { cn } from "../../lib/cn";

/**
 * IconButton — Tactile icon-only button.
 *
 * - Minimum 44×44px touch target (WCAG 2.5.5)
 * - aria-label required (icon-only controls)
 * - active:scale-[0.96] tactile feedback
 * - focus-visible ring
 * - disabled state
 */
export function IconButton({
  "aria-label": ariaLabel,
  className,
  children,
  variant = "ghost",
  size = "md",
  ...props
}) {
  // eslint-disable-next-line no-undef
  if (!ariaLabel && typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    console.warn("[IconButton] aria-label is required for icon-only controls.");
  }

  const sizeClasses = {
    sm: "h-11 w-11 min-h-[44px] min-w-[44px]",
    md: "h-11 w-11 min-h-[44px] min-w-[44px]",
    lg: "h-12 w-12 min-h-12 min-w-12",
  };

  const variantClasses = {
    ghost:   "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]",
    primary: "bg-[#059669] text-white hover:bg-[#047857] shadow-sm",
    danger:  "text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#f43f5e]",
  };

  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        "transition-transform duration-150 ease-out",
        "active:scale-[0.96]",
        "motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]",
        "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
        "cursor-pointer select-none",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
