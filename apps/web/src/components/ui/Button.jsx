import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * Button — Shared tactile button primitive.
 *
 * Variants:
 *   primary  → #059669 (CTAs, active call control, main actions)
 *   secondary → neutral outline (reset, secondary actions)
 *   danger   → neutral destructive (not mismatch-red — that's for tamper only)
 *   ghost    → transparent, text-only
 *
 * All variants include:
 *   - tactile active:scale-[0.96]
 *   - visible focus-visible ring
 *   - disabled opacity + pointer-events-none
 *   - motion-reduce safe
 */
const buttonVariants = cva(
  // Base
  [
    "inline-flex items-center justify-center gap-2",
    "min-h-11 rounded-lg font-semibold text-sm",
    "transition-transform duration-150 ease-out",
    "active:scale-[0.96]",
    "motion-reduce:transition-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]",
    "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
    "select-none cursor-pointer",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[#059669] text-white",
          "hover:bg-[#047857]",
          "shadow-sm",
        ],
        secondary: [
          "bg-white text-[#374151]",
          "border border-[#e5e7eb]",
          "hover:bg-[#f9fafb] hover:border-[#d1d5db]",
        ],
        danger: [
          "bg-[#f9fafb] text-[#6b7280]",
          "border border-[#e5e7eb]",
          "hover:bg-[#f3f4f6] hover:text-[#374151]",
        ],
        ghost: [
          "text-[#6b7280]",
          "hover:bg-[#f3f4f6] hover:text-[#374151]",
        ],
      },
      size: {
        sm:   "h-11 px-4 text-xs rounded-lg",
        md:   "h-11 px-4 text-sm",
        lg:   "h-12 px-6 text-base",
        full: "h-12 px-6 text-base w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export function Button({ variant, size, className, children, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
}
