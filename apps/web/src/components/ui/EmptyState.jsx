import { cn } from "../../lib/cn";

/**
 * EmptyState — Centered idle/empty state display.
 */
export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 px-6 text-center",
        className
      )}
    >
      {icon && (
        <span className="text-3xl text-[#9ca3af]">{icon}</span>
      )}
      {title && (
        <p className="text-sm font-semibold text-[#374151] text-balance">{title}</p>
      )}
      {description && (
        <p className="max-w-[280px] text-xs leading-[18px] font-normal text-[#6b7280] text-balance">{description}</p>
      )}
      {action}
    </div>
  );
}
