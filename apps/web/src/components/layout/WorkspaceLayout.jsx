import { cn } from "../../lib/cn";

/**
 * WorkspaceLayout — Responsive Call-to-Cash product workspace.
 *
 * Desktop order:
 * 1. Product header / live status
 * 2. Hero hook
 * 3. Scenario selector
 * 4. Interactive workspace
 *
 * Responsive breakpoints:
 *   <=768px   : Phone-only full-screen customer flow
 *   769-1199px: 2-column layout (phone + console, telemetry below)
 *   >=1200px  : 3-zone workspace [Chat] [Phone] [Telemetry]
 */
export function WorkspaceLayout({
  left,
  center,
  right,
  header,
  hero,
  scenarios,
}) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-surface-muted font-sans text-[#111827] antialiased">
      {/* Product header — desktop/tablet only */}
      {header && (
        <div className="hidden w-full shrink-0 min-[769px]:block">
          {header}
        </div>
      )}

      {/* Hero hook — desktop/tablet only.
          Mobile keeps the original phone-only customer experience. */}
      {hero && (
        <section
          id="product-hero"
          className="hidden w-full shrink-0 bg-white min-[769px]:block"
          aria-label="Call-to-Cash introduction"
        >
          {hero}
        </section>
      )}

      {/* Interactive simulation workspace */}
      <main
        id="simulation-workspace"
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-0 py-0 min-[769px]:scroll-mt-6 min-[769px]:px-5 min-[769px]:py-5 min-[1024px]:px-8 min-[1200px]:gap-6 min-[1200px]:px-10 min-[1200px]:py-6"
        aria-label="Call-to-Cash interactive workspace"
      >
        {/* Scenario selector — desktop/tablet only */}
        {scenarios && (
          <div className="hidden w-full min-[769px]:block">
            {scenarios}
          </div>
        )}

        {/* Main workspace grid */}
        <div
          className={cn(
            "w-full flex-1",
            "min-[769px]:grid min-[769px]:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)] min-[769px]:gap-5",
            "min-[1200px]:grid-cols-[minmax(300px,0.92fr)_minmax(360px,0.78fr)_minmax(340px,0.92fr)] min-[1200px]:gap-6"
          )}
        >
          {/* LEFT — Transcript and AI decision */}
          <div
            className={cn(
              "min-w-0 max-[768.99px]:hidden",
              "min-[769px]:col-start-2 min-[769px]:row-start-1 min-[769px]:flex min-[769px]:flex-col min-[769px]:gap-5",
              "min-[1200px]:col-start-1 min-[1200px]:row-start-1 min-[1200px]:gap-6"
            )}
          >
            {left}
          </div>

          {/* CENTER — Customer phone */}
          <div
            className={cn(
              "min-w-0 max-[768.99px]:min-h-[100dvh] max-[768.99px]:w-full",
              "min-[769px]:col-start-1 min-[769px]:row-start-1 min-[769px]:self-start",
              "min-[1200px]:sticky min-[1200px]:top-6 min-[1200px]:col-start-2 min-[1200px]:row-start-1"
            )}
          >
            {center}
          </div>

          {/* RIGHT — Telemetry, ledger, decision timeline */}
          <div
            className={cn(
              "min-w-0 max-[768.99px]:hidden",
              "min-[769px]:col-span-2 min-[769px]:row-start-2 min-[769px]:mt-5 min-[769px]:flex min-[769px]:flex-col min-[769px]:gap-5",
              "min-[1200px]:col-span-1 min-[1200px]:col-start-3 min-[1200px]:row-start-1 min-[1200px]:mt-0 min-[1200px]:gap-6"
            )}
          >
            {right}
          </div>
        </div>
      </main>
    </div>
  );
}