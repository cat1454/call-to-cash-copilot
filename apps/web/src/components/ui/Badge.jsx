import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * Badge — Semantic status badge.
 *
 * Strict color mapping:
 *   success  → #10B981 ONLY for confirmed match/deposit/verified
 *   warning  → #F59E0B ONLY for pending/review/incomplete
 *   mismatch → #F43F5E ONLY for cryptographic mismatch/tamper
 *   primary  → #059669 for brand/active states
 *   neutral  → grey for informational/inactive
 */
const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-4 font-medium",
  {
    variants: {
      variant: {
        success:  "bg-[#ecfdf5] text-[#065f46] border border-[#6ee7b7]",
        warning:  "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]",
        mismatch: "bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]",
        primary:  "bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]",
        neutral:  "bg-[#f3f4f6] text-[#374151] border border-[#e5e7eb]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export function Badge({ variant, className, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}
