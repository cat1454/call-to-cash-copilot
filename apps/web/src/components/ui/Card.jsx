import { cn } from "../../lib/cn";

/**
 * Card — Surface container with subtle shadow and border.
 * White background, neutral border, rounded-card.
 */
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "bg-white border border-[#f1f5f9] rounded-2xl",
        "shadow-[0_10px_25px_-5px_rgba(15,23,42,0.03),0_8px_16px_-6px_rgba(15,23,42,0.03)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader — Top section of a Card with bottom border.
 */
export function CardHeader({ className, children, noBorder = false, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 py-3.5",
        !noBorder && "border-b border-[#f1f5f9]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardBody — Content area of a Card.
 */
export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn("px-5 py-4 flex flex-col gap-3.5", className)} {...props}>
      {children}
    </div>
  );
}
