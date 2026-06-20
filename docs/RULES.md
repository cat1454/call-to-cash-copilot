# Development Rules: Call-to-Cash Risk Copilot

This document outlines mandatory rules and coding constraints for developers and AI agents contributing to the Call-to-Cash project.

---

## 1. Core Principles
1. **Security-First**: Never compromise on payment and receipt security.
2. **User-Friendly Language**: Avoid presenting raw technical terms (hashes, memos, signatures, blockchain) to the customer. Use consumer-friendly terminology: "cọc tiền", "giữ chỗ", "biên nhận xác minh".
3. **Plan Before Build**: Create an `implementation_plan.md` and wait for user approval for any complex visual or logic updates.
4. **Offline Resilience**: The app must function offline as a Progressive Web App (PWA). All updates must respect the service worker caching rules.

---

## 2. Coding & React Standards
- **Lifting State**: All active call transcript sequences, customer extraction metrics, and cryptographic hashes must be managed centrally inside `apps/web/src/App.jsx` to ensure perfect synchrony between the client (mockup) and the Auditor console.
- **State Mutability**: Direct modification of React state arrays/objects is forbidden. Always use shallow copies (`[...]`, `{...}`) inside set hooks.
- **Component Limits**: Keep visual components modular. View layout, phone simulator screen, and developer consoles must live in separate files under `apps/web/src/components/`.

---

## 3. Risk Scoring & Payment Gate Rules
The application enforces a strict gate decision model before unlocking a deposit request.

```javascript
IF (completeness >= 85 && readiness >= 80 && dispute_risk <= 35 && explicit_confirmation === true) {
  unlock_payment_gate();
} ELSE {
  keep_gate_locked();
}
```

- **Completeness Bounds**: Requires route, departure time, seats, and phone to be trích xuất (extracted).
- **Explicit Confirmation**: The user must explicitly confirm the verbal agreement statement before the payment drawer slides up.

---

## 4. Solana Security & Receipt Ledger Rules
- **Reference Integrity**: Every checkout session must generate a unique reference code (`BK-` + random 4-digit ID).
- **Agreement Proof Hash**: 
  - Create a mock transaction hash based on the exact payload of the agreed ticket.
  - On ticket receipt verification, recalculate the hash of the current ticket details.
  - If the computed hash does not match the anchored proof hash (e.g., during database tampering), flag a red `MISMATCH` warning stamp and block the boarding pass.
- **Privacy Policy**: Never expose unmasked phone numbers or personally identifiable information (PII) on the blockchain. Always hash or mask values before logging or anchoring.
