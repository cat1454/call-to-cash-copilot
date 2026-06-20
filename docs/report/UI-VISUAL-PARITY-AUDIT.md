# UI Visual Parity Audit

> **Audit date:** 2026-06-20  
> **Branch:** `chore/ui-desktop`  
> **Pre-migration source of truth:** `HEAD 57e8774`  
> **State:** broad Tailwind migration paused; visual regression confirmed at 100% browser scale.

## 1. Evidence captured before editing

- Chrome headless was launched with `--force-device-scale-factor=1` and a 1440x1200 viewport.
- The rendered regression was captured at `D:\tmp\ctc-current-1440.png`.
- No `zoom`, root `font-size`, or root `transform: scale(...)` rule affects `html`, `body`, `#root`, or the app shell.
- The apparent global shrink is caused by migrated utility values and composition, not browser zoom.
- Current compact-utility scan:

| Pattern | Occurrences |
|---|---:|
| `text-[10px]` | 17 |
| `text-[11px]` | 20 |
| `text-xs` | 17 |
| `p-1` | 4 |
| `p-2` | 10 |
| `gap-1` | 36 |
| `gap-2` | 19 |
| `scale-*` | 12 |

The 1440px render confirms the reported symptoms: tiny/dense copy, weak panel hierarchy, a narrow 320px phone, raw audit data competing with actions, compressed cards, and excessive uppercase/bold text.

## 2. Changed styling and ownership

### Import and build changes

| Area | Before migration | Failed migration state | Finding |
|---|---|---|---|
| Main CSS import | `main.jsx -> index.css -> 15 modular CSS files` | `main.jsx -> styles/globals.css -> Tailwind` | All legacy spacing/type/layout rules disappeared at once. |
| Vite | React plugin | React + Tailwind plugin | Build integration is valid; visual mapping is incomplete. |
| App composition | `App -> PhoneScreen + DesktopConsole` | App inlines header, three zones, decisions, and mobile chrome | Presentation ownership moved while product-derived display logic was duplicated. |
| Phone component | `components/PhoneScreen.jsx` | `features/call/components/PhoneScreen.jsx` | New frame is only 320px wide and internal type is undersized. |
| Desktop component | `components/DesktopConsole.jsx` | deleted; content spread through `App.jsx` | Hierarchy and spacing became harder to reason about. |

### Legacy CSS removed in the failed state

`index.css`, `base.css`, `call-animations.css`, `controls-transcript.css`,
`decision-panels.css`, `desktop-layout.css`, `extra-animations.css`,
`mobile-overrides.css`, `payment-ticket.css`, `phone-call.css`,
`phone-dashboard.css`, `phone-shell.css`, `receipt-empty.css`,
`security-tamper.css`, `telemetry-ledger.css`, and
`timeline-receipt.css`.

These files must remain available until parity is accepted. They are reference
sources even while individual rules are translated into Tailwind.

## 3. Legacy selector to Tailwind parity map

| Legacy selector / rule | Legacy values | Current owner | Required Tailwind replacement | Pre-fix status |
|---|---|---|---|---|
| `body`, `.app-container` | 24px page padding; centered max 1440px; 20px rhythm | `WorkspaceLayout` | `mx-auto w-full max-w-[1600px] px-6 py-5 min-[1200px]:px-8 min-[1200px]:py-6` | Failed |
| `header` | white surface, border, 16/24px padding, radius/shadow | `App.jsx` header | primary white surface; `p-5`; clear border; wordmark `text-xl font-bold` | Partial |
| `.logo-section h1`, `.tagline` | 22px/800 and 12px normal | `App.jsx` header | `text-xl font-bold tracking-tight`; subtitle `text-xs leading-[18px] font-normal` | Partial |
| `.scenarios-container` | 16px padding; 12px gap; surfaced card | `ScenarioSelector` | primary/supporting card `p-5 space-y-4` | Failed |
| `.scenario-card` | 14px padding; 12px radius; 6px internal gap | `ScenarioSelector` | `p-4 min-[1200px]:p-5`; title `text-sm leading-5 font-semibold`; body `text-xs leading-[18px]` | Failed |
| `.dashboard-grid`, `.desktop-middle-grid` | explicit centered columns and 20px gaps | `WorkspaceLayout` | at 1200px: `grid-cols-[minmax(300px,0.92fr)_minmax(360px,0.78fr)_minmax(340px,0.92fr)] gap-6` | Failed |
| `.panel` | 20px padding; 16px gap; white/border/shadow | `Card` and feature panels | primary `p-5 space-y-4 shadow-card`; supporting lighter shadow | Failed |
| `.panel-header h2` | 13px/700 uppercase | `SectionHeading` | `text-sm leading-5 font-semibold text-balance`, no forced uppercase | Failed |
| `.transcript-area` | 16px padding; 12px gap; 250px height | `VoiceSimulatorPanel` | `p-4 space-y-3`; transcript `text-sm leading-5` | Failed |
| `.speech-bubble` | 10/14px padding; 12.5px; line-height 1.45 | `VoiceSimulatorPanel` | `px-4 py-3 text-sm leading-5 font-normal` | Failed |
| `.decision-panel`, `.decision-row` | 16px panel; 12/14px row; 12px body | `AIDecisionPanel` | supporting `p-5 space-y-4`; body `text-sm leading-5`; labels `text-xs font-medium` | Failed |
| `.gauge-meta`, `.metric-card` | 11px labels; small numeric cards | `SaaSTelemetryPanel`, `Progress` | labels `text-xs leading-4 font-medium`; values `text-lg leading-6 font-semibold tabular-nums`; explanation/next action | Failed |
| `.ledger-console`, proof rows | raw hashes shown as primary content | `SolanaLedgerCard` | utility surface; muted `details`, collapsed by default; mismatch summary remains visible | Failed |
| `.phone-mockup` | 340x610px, strong frame | `PhoneScreen` | desktop `mx-auto w-full max-w-[380px] ... rounded-[2rem] border ... shadow-float`; no dark bezel | Failed (320px) |
| `.phone-screen` | 16px padding; 12px gap | Phone views | readable mobile `p-4 space-y-4`; no important text below 12px | Failed |
| `mobile-overrides.css` | <=768px strips bezel and desktop panels | `WorkspaceLayout`, `PhoneScreen` | only phone customer surface, `w-full min-h-[100dvh]`; no desktop telemetry/chrome | Partial |
| button selectors | 10/16px padding; active 0.96 | `Button`, `IconButton` | min 44x44; tactile transition; disabled controls never scale; visible focus | Partial |

## 4. Root causes

1. All legacy CSS was disconnected in one change before selector-level parity was complete.
2. Many former 12-13px labels/body values were translated to 9-11px utilities.
3. Former 16-20px panel padding was frequently translated to `p-2`/`p-3`.
4. App composition and component ownership changed simultaneously with styling.
5. The phone changed from a 340px visual anchor to a fixed 320px column while surrounding panels gained equal prominence.
6. Raw proof data remained expanded instead of becoming a utility-level disclosure.
7. Uppercase and heavy font weights were applied as generic hierarchy substitutes.

## 5. Recovery rule

No additional legacy CSS or component path may be deleted during this recovery.
Restore the deleted reference files, repair the active Tailwind implementation
against the mapping above, and pass the six-width visual gate before resuming any
migration cleanup.
