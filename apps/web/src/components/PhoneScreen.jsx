import PhoneCallView from "../features/simulation/components/PhoneCallView";
import PhoneDashboardView from "../features/simulation/components/PhoneDashboardView";
import PhoneReceiptView from "../features/ticket/components/PhoneReceiptView";
import PhonePaymentDrawer from "../features/payment/components/PhonePaymentDrawer";

export default function PhoneScreen({
  isMobileLayout, // true if screen <= 768px
  activeTab, // 'call' | 'dashboard' | 'receipt' (only applicable for mobile view switcher)
  isSimulating,
  simStatus,
  phoneCallStatusText,
  phoneCallColor,
  isWaveAnimating,
  subtitles,
  bookingData,
  showBoardingPass,
  showPaymentDrawer,
  drawerTimerText,
  btnPhonePayText,
  btnPhonePayDisabled,
  btnPhonePayBg,
  simulateWalletPayment,
  startSimulation,
  isTampered,
  scores,
  performance,
  brainMode,
  showPrefetch,
  prefetchContent,
  timelineSteps,
  ledgerLogs
}) {
  
  // Render Call View content
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

  // Render Boarding Pass / Receipt View content
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
    />
  );

  const mobileSliderOffset = {
    call: "translateX(0)",
    dashboard: "translateX(-33.333%)",
    receipt: "translateX(-66.666%)"
  }[activeTab] || "translateX(0)";

  return (
    <div className={`phone-mockup-wrapper ${isMobileLayout ? "is-mobile-native" : ""}`}>
      <div className="phone-mockup">
        {/* Phone Screen Container */}
        <div className="phone-screen">
          {isMobileLayout ? (
            <div className="phone-slider-viewport">
              <div
                className="phone-slider-track"
                style={{
                  transform: mobileSliderOffset
                }}
              >
                <div className="phone-slide-pane">{renderCallView()}</div>
                <div className="phone-slide-pane">{renderDashboardView()}</div>
                <div className="phone-slide-pane">{renderReceiptView()}</div>
              </div>
            </div>
          ) : (
            /* Desktop Mockup transitions: Switch views smoothly depending on showBoardingPass */
            <div className="desktop-view-container">
              {showBoardingPass ? renderReceiptView() : renderCallView()}
            </div>
          )}
        </div>

        {/* Solana Pay style slide-up checkout sheet */}
        <PhonePaymentDrawer
          showPaymentDrawer={showPaymentDrawer}
          bookingData={bookingData}
          drawerTimerText={drawerTimerText}
          simulateWalletPayment={simulateWalletPayment}
          btnPhonePayDisabled={btnPhonePayDisabled}
          btnPhonePayBg={btnPhonePayBg}
          btnPhonePayText={btnPhonePayText}
        />
      </div>
    </div>
  );
}
