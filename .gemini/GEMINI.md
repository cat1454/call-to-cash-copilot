# Gemini CLI Developer Guidelines for Call-to-Cash Risk Copilot

This guide outlines baseline workflows, coding standards, and visual compliance rules for Gemini CLI operating in this repository.

## Visual Compliance & Mobile UX (V6 Specs)

- **Strict Color Tokens**: Maintain a clean light-mode visual design:
  - Background is white (`#FFFFFF`) / light grey (`#F9FAFB`).
  - Primary color is green (`#059669`).
  - Green (`#10B981`) is reserved exclusively for successful matches or confirmed cọc.
  - Amber (`#F59E0B`) represents warnings or pending states.
  - Red (`#F43F5E`) represents cryptographic mismatch warnings.
  - No dark, neon purple, or overly complex crypto graphs in the customer flow.
- **Mobile Responsive Design**: Ensure all controls and components collapse correctly on screens `<= 768px` to render only the smartphone screen as a full-screen layout.
- **Tactile Transitions**: Buttons must react to click/tap events using an active transition `transform: scale(0.96)`.
- **Text & Numeric Wrapping**: Headline titles must use `text-wrap: balance` and counters/financial metrics must use `font-variant-numeric: tabular-nums` to prevent visual shifting.

## Core Code Architecture

- **Lifting State Up**: Shared simulation states (scenarios, speech transcript lists, and Solana security receipt hashes) must be managed inside [App.jsx](src/App.jsx) and passed down cleanly to [PhoneScreen.jsx](src/components/PhoneScreen.jsx) and [DesktopConsole.jsx](src/components/DesktopConsole.jsx).
- **Immutability**: Avoid direct state mutation. Always return fresh copied objects when applying changes using React's hook setters.
- **Service Worker & Manifest**: Do not break the PWA configuration:
  - Keep the web manifest link (`manifest.json`) and service worker (`sw.js`) registration in `main.jsx` and `index.html`.

## Security & Verification Ledger

- **Verification Contract**:
  - The off-chain draft agreement payload (route, seats, phone, price, and deposit) must be hashed to construct a verifiable reference.
  - The computed hash must be checked against the anchored proof hash.
  - If they do not match, the transaction must fail with a `mismatch` warning stamp and block the booking receipt.
- **Secret Management**: Never write hardcoded API keys or Solana private credentials into the client-facing codebase.
