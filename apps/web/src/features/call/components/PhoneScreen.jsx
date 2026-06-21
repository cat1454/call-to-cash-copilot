import { Wifi, Signal, Battery, Smartphone } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Button } from "../../../components/ui/Button";
import { DEMO_MODE } from "../../../config/runtime";
import PhoneCallView from "../../simulation/components/PhoneCallView";
import PhoneDashboardView from "../../simulation/components/PhoneDashboardView";
import PhoneReceiptView from "../../ticket/components/PhoneReceiptView";
import PhonePaymentDrawer from "../../payment/components/PhonePaymentDrawer";

/**
 * PhoneScreen — Customer-facing interface.
 *
 * Mobile (≤768px):
 * - Full-screen app experience
 * - No hardware phone frame
 * - Slider navigation between Call / Booking / Receipt
 *
 * Desktop (≥769px):
 * - iPhone-style device shell
 * - Dark bezel, rounded corners, top notch, home indicator
 * - Customer app rendered inside a realistic phone viewport
 */
export default function PhoneScreen({
  isMobileLayout,
  activeTab,
  setActiveTab,
  isSimulating,
  simStatus,
  phoneCallStatusText,
  phoneCallColor,
  isWaveAnimating,
  subtitles,
  bookingData,
  showBoardingPass,
  showPaymentDrawer,
  paymentIntent,
  drawerTimerText,
  btnPhonePayText,
  btnPhonePayDisabled,
  btnPhonePayBg,
  simulateWalletPayment,
  startSimulation,
  resetSimulation,
  tamperAgreement,
  isTampered,
  scores,
  performance,
  brainMode,
  showPrefetch,
  prefetchContent,
  timelineSteps,
  ledgerLogs,
  paymentGate
}) {
  const renderCallView = () => (
    <PhoneCallView
      isWaveAnimating={isWaveAnimating}
      phoneCallColor={phoneCallColor}
      phoneCallStatusText={phoneCallStatusText}
      subtitles={subtitles}
      isMobileLayout={isMobileLayout}
      startSimulation={startSimulation}
      isSimulating={isSimulating}
      simStatus={simStatus}
      bookingData={bookingData}
    />
  );

  const renderReceiptView = () => (
    <PhoneReceiptView
      showBoardingPass={showBoardingPass}
      isTampered={isTampered}
      bookingData={bookingData}
    />
  );

  const renderDashboardView = () => (
    <PhoneDashboardView
      scores={scores}
      performance={performance}
      brainMode={brainMode}
      showPrefetch={showPrefetch}
      prefetchContent={prefetchContent}
      timelineSteps={timelineSteps}
      ledgerLogs={ledgerLogs}
      bookingData={bookingData}
      simStatus={simStatus}
      isTampered={isTampered}
      showPaymentDrawer={showPaymentDrawer}
      paymentGate={paymentGate}
    />
  );

  const mobileSliderOffset =
    {
      call: "translateX(0%)",
      dashboard: "translateX(-33.333%)",
      receipt: "translateX(-66.666%)"
    }[activeTab] ?? "translateX(0%)";

  if (isMobileLayout) {
    return (
      <div className="relative flex min-h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-white">
        <header className="w-full min-w-0 shrink-0 overflow-hidden border-b border-[#e5e7eb] bg-white px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs leading-4 font-medium text-[#6b7280]">
              {DEMO_MODE ? "Demo mode" : "Live mode"}
            </span>

            <span className="text-xs leading-4 font-normal text-[#6b7280]">Customer app</span>
          </div>

          <nav
            className="flex w-full min-w-0 gap-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-1"
            aria-label="Customer app views"
          >
            {[
              { id: "call", label: "Call" },
              { id: "dashboard", label: "Booking" },
              { id: "receipt", label: "Receipt" }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "min-h-11 min-w-0 flex-1 rounded-lg px-3 text-sm leading-5 font-medium",
                  "transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]",
                  activeTab === tab.id
                    ? "bg-white text-[#059669] shadow-sm"
                    : "text-[#6b7280] hover:text-[#374151]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className="flex h-full min-h-0 min-w-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: "300%",
              transform: mobileSliderOffset
            }}
          >
            <div className="h-full min-w-0 w-1/3 shrink-0 overflow-y-auto">{renderCallView()}</div>

            <div className="h-full min-w-0 w-1/3 shrink-0 overflow-y-auto">
              {renderDashboardView()}
            </div>

            <div className="h-full min-w-0 w-1/3 shrink-0 overflow-y-auto">
              {renderReceiptView()}
            </div>
          </div>
        </div>

        <PhonePaymentDrawer
          key={paymentIntent?.paymentIntentId ?? "no-payment-intent"}
          showPaymentDrawer={showPaymentDrawer}
          bookingData={bookingData}
          paymentIntent={paymentIntent}
          drawerTimerText={drawerTimerText}
          simulateWalletPayment={simulateWalletPayment}
          btnPhonePayDisabled={btnPhonePayDisabled}
          btnPhonePayBg={btnPhonePayBg}
          btnPhonePayText={btnPhonePayText}
        />

        <footer className="flex w-full min-w-0 shrink-0 gap-2 border-t border-[#e5e7eb] bg-white p-4">
          <Button variant="secondary" size="md" className="flex-1" onClick={resetSimulation}>
            Đặt lại
          </Button>

          {showBoardingPass && (
            <Button
              variant="danger"
              size="md"
              className="flex-[1.4] border-[#f43f5e] bg-[#f43f5e] text-white hover:bg-[#e11d48]"
              onClick={tamperAgreement}
            >
              Mô phỏng Tamper
            </Button>
          )}
        </footer>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4">
      {/* iPhone device shell */}
      <div
        className={cn(
          "relative mx-auto h-[748px] w-full max-w-[380px]",
          "rounded-[3.25rem] bg-[#1f2937] p-[10px]",
          "shadow-[0_28px_70px_rgba(15,23,42,0.22)]",
          "ring-1 ring-black/10"
        )}
      >
        {/* Optional side-button visual details */}
        <span
          aria-hidden="true"
          className="absolute -left-[2px] top-28 h-10 w-[3px] rounded-l-full bg-[#111827]"
        />
        <span
          aria-hidden="true"
          className="absolute -left-[2px] top-40 h-16 w-[3px] rounded-l-full bg-[#111827]"
        />
        <span
          aria-hidden="true"
          className="absolute -right-[2px] top-36 h-20 w-[3px] rounded-r-full bg-[#111827]"
        />

        {/* Actual screen */}
        <div className="relative flex h-full overflow-hidden rounded-[2.7rem] bg-white">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f9fafb]">
            {/* iPhone status bar */}
            <div className="relative flex shrink-0 items-center justify-between bg-white px-7 pb-2 pt-3.5 text-xs leading-4 font-semibold text-[#111827] select-none">
              <span className="tabular-nums">9:41</span>

              <div className="flex items-center gap-1.5">
                <Signal size={11} strokeWidth={2.5} />
                <Wifi size={11} strokeWidth={2.5} />
                <Battery size={13} strokeWidth={2.5} />
              </div>
            </div>

            {/* Main app surface */}
            <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#f9fafb]">
              {showBoardingPass ? renderReceiptView() : renderCallView()}
            </div>

            <PhonePaymentDrawer
              key={paymentIntent?.paymentIntentId ?? "no-payment-intent"}
              showPaymentDrawer={showPaymentDrawer}
              bookingData={bookingData}
              paymentIntent={paymentIntent}
              drawerTimerText={drawerTimerText}
              simulateWalletPayment={simulateWalletPayment}
              btnPhonePayDisabled={btnPhonePayDisabled}
              btnPhonePayBg={btnPhonePayBg}
              btnPhonePayText={btnPhonePayText}
            />

            {/* Bottom safe-area so screen content does not collide with home indicator */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-gradient-to-t from-white via-white/95 to-transparent"
            >
              <span className="mt-2 h-1.5 w-28 rounded-full bg-[#111827]/85" />
            </div>
          </div>
        </div>

        {/* iPhone top notch */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-1/2 top-[10px] z-20",
            "h-[29px] w-[126px] -translate-x-1/2",
            "rounded-b-[1.25rem] bg-[#1f2937]"
          )}
        >
          <span className="absolute left-1/2 top-[10px] h-[4px] w-10 -translate-x-1/2 rounded-full bg-black/45" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs leading-4 font-normal text-[#6b7280] select-none">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[#059669] [animation:pulse-primary_2s_ease-in-out_infinite]"
          aria-hidden="true"
        />
        <Smartphone size={14} aria-hidden="true" />
        Customer app — transcript replay
      </div>
    </div>
  );
}
