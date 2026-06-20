# CLAUDE.md — Operating Guidelines for Claude Code CLI

This file outlines build commands, styling rules, and security guidelines for Claude Code working in this repository.

## Commands

- **Install dependencies**: `corepack pnpm install`
- **Local Dev Server**: `corepack pnpm dev`
- **Build compilation**: `corepack pnpm build`
- **Project linting**: `corepack pnpm lint`
- **Project tests**: `corepack pnpm test`

## Visual Styling Compliance (V6 Specs)

- **Strict Color Tokens**:
  - Background is white (`#FFFFFF`) / light grey (`#F9FAFB`).
  - Primary color is green (`#059669`).
  - Green (`#10B981`) is reserved exclusively for successful matches or confirmed cọc.
  - Amber (`#F59E0B`) represents warnings or pending states.
  - Red (`#F43F5E`) represents cryptographic mismatch warnings.
  - No dark, neon purple, or complex crypto visual elements in the customer flow.
- **Mobile Responsive Design**: Ensure all controls and components collapse correctly on screens `<= 768px` to render only the smartphone screen as a full-screen layout.
- **Tactile Transitions**: Buttons must react to click/tap events using an active transition `transform: scale(0.96)`.
- **Text & Numeric Wrapping**: Headline titles must use `text-wrap: balance` and counters/financial metrics must use `font-variant-numeric: tabular-nums` to prevent visual shifting.

## Core Code Architecture

- **Lifting State Up**: Shared simulation states (scenarios, speech transcript lists, and Solana security receipt hashes) must be managed inside [App.jsx](apps/web/src/App.jsx) and passed down cleanly to [PhoneScreen.jsx](apps/web/src/components/PhoneScreen.jsx) and [DesktopConsole.jsx](apps/web/src/components/DesktopConsole.jsx).
- **Immutability**: Avoid direct state mutation. Always return fresh copied objects when applying changes using React's hook setters.
- **Service Worker & Manifest**: Do not break the PWA configuration inside `apps/web/index.html` and `apps/web/src/main.jsx`.

## Security & Verification Ledger

- **Verification Contract**:
  - The off-chain draft agreement payload (route, seats, phone, price, and deposit) must be hashed to construct a verifiable reference.
  - The computed hash must be checked against the anchored proof hash.
  - If they do not match, the transaction must fail with a `mismatch` warning stamp and block the booking receipt.
- **Secret Management**: Never write hardcoded API keys or Solana private credentials into the client-facing codebase.
