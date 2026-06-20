# Design System: Mobile-Optimized Light Theme (V6 Specs)

This document details the visual style, typography, color tokens, and responsive design guidelines for the Call-to-Cash Risk Copilot user experience.

---

## 1. Visual Philosophy
Following the V6 final proposal, the interface moves away from "dark/neon crypto dashboards" and adopts a **customer-first, voice-guided product aesthetic**:
- **Clean Contrast**: Uses white and near-white backgrounds to enhance daytime mobile screen legibility.
- **Voice-First Focus**: Centered around a large, prominent microphone action button.
- **Progressive Disclosure**: Emphasizes the passenger's screen (mockup client) on mobile viewports, hiding the detailed telemetry (Mentor Console) until requested.

---

## 2. Color Tokens (Mobile-Optimized)

Mobile screens (especially OLED displays) require crisp, clear color representation to minimize glare and improve scannability:

| Token | CSS Value | Visual Role |
|-------|-----------|-------------|
| `--bg-color` | `#f8fafc` | Primary app background (near-white slate-50) |
| `--card-bg` | `#ffffff` | Background for tickets, dialog cards, and panels |
| `--card-border` | `#e2e8f0` | Soft grey borders for clear element boundary |
| `--text-main` | `#0f172a` | Highly legible primary text |
| `--text-muted` | `#64748b` | Secondary metadata and label text |
| `--primary-blue` | `#059669` | Primary brand color, circular microphone button, active indicators (Green) |
| `--success-green` | `#10b981` | Successful validation, MATCH stamps, confirmed transactions |
| `--warning-amber` | `#f59e0b` | Pending states, ticking timers, payment gate open notifications |
| `--error-red` | `#f43f5e` | System warnings, tampered data flags, MISMATCH alarms (Rose) |

---

## 3. Spacing & Hit Areas

- **Minimum Tap Size**: All interactive elements (scenarios, mic buttons, payment simulations) maintain a minimum hit area of `44x44px` on mobile viewports to prevent mis-taps.
- **Visual Nesting (Concentric Radii)**: For nested cards, we follow the visual hierarchy:
  `outer radius = inner radius + padding`
  - Panel wrapper: `border-radius: 16px`
  - Inner ticket card: `border-radius: 14px`
  - Elements / Buttons: `border-radius: 10px`

---

## 4. Typography & Numbers

- **Timers and Currency**: All countdowns (`10:00`) and prices (`300.000đ`) utilize tabular numbers:
  `font-variant-numeric: tabular-nums`
  This ensures digits share equal horizontal space and prevents jumpy visual shifts during state changes.
- **Short Texts**: Dialog subtitles use `text-wrap: pretty` to avoid awkward widow words on narrow phone screens.

---

## 5. CSS Motion & Transitions

We avoid `transition: all` to optimize rendering performance on low-spec mobile chipsets. Transition targets are explicitly declared:

```css
.btn-primary, .mic-button {
  transition-property: background-color, transform, box-shadow;
  transition-duration: 0.2s;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```

- **Active State Scale**: To provide visual push feedback, all buttons scale down to `0.96` when pressed:
  `transform: scale(0.96)`
- **Pulse Animation**: The active voice recording state includes a soft pulsing ring expanding outwards from the microphone to indicate listening state.
