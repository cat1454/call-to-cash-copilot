import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — Merge Tailwind classes safely.
 * Combines clsx conditional logic with tailwind-merge deduplication.
 *
 * @example
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
