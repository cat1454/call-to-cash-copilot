# Codex Agent Guidelines: Call-to-Cash Risk Copilot

This document defines operating boundaries, automated workflows, and delivery standards for Codex coding agents working in this repository.

## Operational Workflows

1. **Planning Mode**: Before implementing new features or making visual changes, document the proposals in `implementation_plan.md` and wait for user approval.
2. **State Syncing**: Ensure that all simulated speech dialogues, telemetry scores, and PWA configurations are documented in structural files and managed via standard React patterns.
3. **PWA Integration**: Maintain caching rules inside [sw.js](public/sw.js) for assets such as `favicon.svg`, `icon-192.png`, and `icon-512.png`.

## Code Quality Standards

- **Functional Cohesion**: Keep components small. Split visual elements into specialized files under `src/components/`.
- **Typographical Safety**: Follow formatting guidelines:
  - Header text wraps: Use `text-wrap: balance` for clean header lines.
  - Descriptive text wraps: Use `text-wrap: pretty` for transcripts, logs, and prefetch content.
  - Tabular Numbers: Ensure `font-variant-numeric: tabular-nums` is assigned to any dynamically updated ticket quantities, amounts, or countdown clocks.
- **Button Sizing**: Interactive tap elements must occupy a minimal area of `44x44px` on mobile viewports.

## Security & Blockchain Anchoring

- **Audit Contract**: Ensure the integrity of the proof verification path in [App.jsx](src/App.jsx). The `tamperAgreement` logic must correctly simulate malicious database tampering and prompt warning mismatch flags on both mobile client passes and the Mentor telemetry ledger.
- **Privacy Policy**: Never expose phone numbers or other sensitive user metadata on-chain. Always mask phone inputs (`0912***678`) before logging off-chain or hashing for Solana anchoring.
