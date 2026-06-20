---
name: call-to-cash-ui-ux
description: Frontend UI/UX design standards, Tailwind CSS v4 patterns, and tactile responsive design policies for Call-to-Cash Risk Copilot.
metadata:
  origin: repo-specific
---

# Call-to-Cash UI/UX Patterns

This document defines repository-specific frontend standards, design tokens, component primitives, and Tailwind CSS v4 guidelines for developers working on the `apps/web` package.

## Color Tokens

We adhere to a strict semantic color system:

| Token | HSL / Hex | Target Audience & Exclusive Usage |
|---|---|---|
| `--color-canvas` | `#FFFFFF` | Core application backdrop / body background. |
| `--color-primary` | `#059669` | Interactive elements, main CTAs, active selectors. |
| `--color-success` | `#10B981` | Successful match, deposit confirmation, verified trust ticket. |
| `--color-warning` | `#F59E0B` | Pending payment, incomplete metadata, warning status. |
| `--color-mismatch` | `#F43F5E` | Cryptographic/tamper mismatch warning badge or ledger banner. |
| `--color-ink` | `#111827` | Primary dark text. |
| `--color-ink-muted` | `#6B7280` | Subtitles, labels, and secondary details. |

> [!IMPORTANT]
> - Do not use generic red (`#EF4444`) for errors. Use `--color-mismatch` (`#F43F5E`) exclusively for tamper/cryptographic mismatches.
> - Do not use dark or neon purple crypto-style accents in the customer flow. Keep interfaces neutral and professional.

## Touch Targets & Tactile Feedback

1. **Touch Targets**: All interactive elements (buttons, inputs) must be at least `44px` in width/height (or use `IconButton` primitive) for comfortable mobile tapping.
2. **Tactile Scales**: Buttons must react to tap/click triggers using a micro-transition scale:
   ```html
   <button class="active:scale-[0.96] transition-transform duration-150 ease-out">
   ```
3. **Reduced Motion**: Respect system motion preferences by adding `motion-reduce:transition-none` to scaled components.

## Typography & Numbers

- **Headline wrapping**: Titles and headings must use `text-wrap: balance` (Tailwind `text-balance`) to prevent layout shift and single-word wrapping.
- **Numbers & Metrics**: Performance stats, financial prices, dates, and times must use `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) to prevent text jump during value updates.

## Responsive Layout Strategy (`WorkspaceLayout`)

We use a CSS-only responsive grid avoiding JS branching:
- **Mobile (`<= 768px`)**: Single column showing the phone screen mockup as full-screen. Desktop chrome (header, scenario selector, sidebar telemetry) is hidden using `max-[768px]:hidden`.
- **Tablet (`769px–1199px`)**: Two columns displaying the centered phone mockup alongside the call console, with telemetry panels spanning below.
- **Desktop (`>= 1200px`)**: Three-zone workspace displaying `[Chat/Transcript] [Phone] [Telemetry]` side-by-side.

## Component Registry

Developers should compose UI using the shared primitives in `src/components/ui/`:
- **`Button`**: Handles variants (`primary`, `secondary`, `danger`, `ghost`) with consistent tactile hover/active states.
- **`Card`**: Standard surface with custom border and shadow cards.
- **`Badge`**: Status indicators for match/mismatch/pending.
- **`Progress`**: Visual bar trackers using brand HSL colors.
- **`EmptyState`**: Centered idle displays for empty lists or tabs.
