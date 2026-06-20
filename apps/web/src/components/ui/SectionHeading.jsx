import { cn } from "../../lib/cn";

/**
 * SectionHeading — Panel/card section title.
 * Uses text-balance to prevent awkward line breaks.
 * Left border accent (primary green).
 */
export function SectionHeading({ className, children, icon, action, ...props }) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      <h2
        className={cn(
          "flex items-center gap-2",
          "text-sm leading-5 font-semibold",
          "text-[#111827]",
          "text-balance",
          "border-l-[3px] border-[#059669] pl-2"
        )}
      >
        {icon && <span className="text-[#059669] shrink-0">{icon}</span>}
        {children}
      </h2>
      {action && (
        <span className="text-xs leading-4 font-medium text-[#059669] cursor-pointer hover:text-[#047857] transition-colors">
          {action}
        </span>
      )}
    </div>
  );
}
