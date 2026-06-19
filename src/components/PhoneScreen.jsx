import PhoneCallView from "../features/simulation/components/PhoneCallView";
import PhoneReceiptView from "../features/ticket/components/PhoneReceiptView";
import PhonePaymentDrawer from "../features/payment/components/PhonePaymentDrawer";

export default function PhoneScreen({
  isMobileLayout, // true if screen <= 768px
  activeTab, // 'call' | 'receipt' (only applicable for mobile view switcher)
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
  isTampered
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

  return (
    <div className={`phone-mockup-wrapper ${isMobileLayout ? "is-mobile-native" : ""}`}>
      <div className="phone-mockup">
        {/* Phone Screen Container */}
        <div className="phone-screen">
          {isMobileLayout ? (
            /* Slide transitions between Call and Receipt tabs on Mobile */
            <div className="phone-slider-viewport">
              <div
                className="phone-slider-track"
                style={{
                  transform: activeTab === "receipt" ? "translateX(-50%)" : "translateX(0)"
                }}
              >
                <div className="phone-slide-pane">{renderCallView()}</div>
                <div className="phone-slide-pane">{renderReceiptView()}</div>
              </div>
            </div>
          ) : (
            /* Desktop Mockup transitions: Switch views smoothly depending on showBoardingPass */
            <div className="desktop-view-container">
              {showBoardingPass ? renderReceiptView() : renderCallView()}
            </div>
          )}

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
    </div>
  );
}
