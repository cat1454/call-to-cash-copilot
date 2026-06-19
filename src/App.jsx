import PhoneScreen from "./components/PhoneScreen";
import DesktopConsole from "./components/DesktopConsole";
import useCallSimulation from "./features/simulation/hooks/useCallSimulation";

export default function App() {
  const sim = useCallSimulation();

  // Main Render
  if (sim.isMobile) {
    // Mobile layout: render ONLY the PhoneScreen (no borders, native experience)
    return (
      <div className="mobile-native-container">
        {/* Top Tab Bar Switcher */}
        <div className="mobile-tabs-container">
          <div className="view-tabs">
            <button
              className={`view-tab ${sim.mobileTab === "call" ? "active" : ""}`}
              onClick={() => sim.setMobileTab("call")}
            >
              Call
            </button>
            <button
              className={`view-tab ${sim.mobileTab === "dashboard" ? "active" : ""}`}
              onClick={() => sim.setMobileTab("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={`view-tab ${sim.mobileTab === "receipt" ? "active" : ""}`}
              onClick={() => sim.setMobileTab("receipt")}
            >
              Receipt
            </button>
          </div>
        </div>

        <PhoneScreen
          isMobileLayout={true}
          activeTab={sim.mobileTab}
          isSimulating={sim.isSimulating}
          simStatus={sim.simStatus}
          phoneCallStatusText={sim.phoneCallStatusText}
          phoneCallColor={sim.phoneCallColor}
          isWaveAnimating={sim.isWaveAnimating}
          subtitles={sim.subtitles}
          bookingData={sim.bookingData}
          showBoardingPass={sim.showBoardingPass}
          showPaymentDrawer={sim.showPaymentDrawer}
          drawerTimerText={sim.drawerTimerText}
          btnPhonePayText={sim.btnPhonePayText}
          btnPhonePayDisabled={sim.btnPhonePayDisabled}
          btnPhonePayBg={sim.btnPhonePayBg}
          simulateWalletPayment={sim.simulateWalletPayment}
          startSimulation={sim.startSimulation}
          resetSimulation={sim.resetSimulation}
          isTampered={sim.isTampered}
          scores={sim.scores}
          performance={sim.performance}
          brainMode={sim.brainMode}
          showPrefetch={sim.showPrefetch}
          prefetchContent={sim.prefetchContent}
          timelineSteps={sim.timelineSteps}
          ledgerLogs={sim.ledgerLogs}
        />

        {/* Bottom fixed control action bar on mobile */}
        <div className="mobile-action-bar">
          <button className="btn-secondary" style={{ flex: 1 }} onClick={sim.resetSimulation}>
            Đặt Lại Đàm Thoại
          </button>
          {sim.showBoardingPass && (
            <button className="btn-danger" style={{ flex: 1.5 }} onClick={sim.tamperAgreement}>
              Mô Phỏng Tấn Công (Tamper)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Desktop layout: Full side-by-side presentation console
  return (
    <div className="app-container">
      {/* HEADER */}
      <header>
        <div className="logo-section">
          <h1>
            Call-to-Cash <span>Risk Copilot</span>
          </h1>
          <p className="tagline">
            Agora x Solana: Trợ lý AI giám sát rủi ro hội thoại, tự động đối soát và neo băm khóa cọc giao dịch thời gian thực
          </p>
        </div>
        <div className="connection-status">
          <div className="status-badge agora">
            <span className="indicator"></span>
            <span>Mạng Agora RT-Voice: Hoạt động</span>
          </div>
          <div className="status-badge solana">
            <span className="indicator"></span>
            <span>Sổ cái Solana Ledger: Đã kết nối</span>
          </div>
        </div>
      </header>

      {/* DASHBOARD GRID */}
      <div className="dashboard-grid">
        {/* COLUMN 1: SMARTPHONE CLIENT MOCKUP */}
        <div className="smartphone-container">
          <PhoneScreen
            isMobileLayout={false}
            isSimulating={sim.isSimulating}
            simStatus={sim.simStatus}
            phoneCallStatusText={sim.phoneCallStatusText}
            phoneCallColor={sim.phoneCallColor}
            isWaveAnimating={sim.isWaveAnimating}
            subtitles={sim.subtitles}
            bookingData={sim.bookingData}
            showBoardingPass={sim.showBoardingPass}
            showPaymentDrawer={sim.showPaymentDrawer}
            drawerTimerText={sim.drawerTimerText}
            btnPhonePayText={sim.btnPhonePayText}
            btnPhonePayDisabled={sim.btnPhonePayDisabled}
            btnPhonePayBg={sim.btnPhonePayBg}
            simulateWalletPayment={sim.simulateWalletPayment}
            startSimulation={sim.startSimulation}
            resetSimulation={sim.resetSimulation}
            isTampered={sim.isTampered}
            scores={sim.scores}
            performance={sim.performance}
            brainMode={sim.brainMode}
            showPrefetch={sim.showPrefetch}
            prefetchContent={sim.prefetchContent}
            timelineSteps={sim.timelineSteps}
            ledgerLogs={sim.ledgerLogs}
          />
        </div>

        {/* COLUMN 2 & 3: TELEMETRY & CONSOLE & REPLAY */}
        <div className="desktop-console-wrapper">
          <DesktopConsole
            currentScenarioIdx={sim.currentScenarioIdx}
            selectScenario={sim.selectScenario}
            transcript={sim.transcript}
            simStatus={sim.simStatus}
            isSimulating={sim.isSimulating}
            startSimulation={sim.startSimulation}
            resetSimulation={sim.resetSimulation}
            scores={sim.scores}
            performance={sim.performance}
            brainMode={sim.brainMode}
            prefetchContent={sim.prefetchContent}
            showPrefetch={sim.showPrefetch}
            ledgerLogs={sim.ledgerLogs}
            tamperAgreement={sim.tamperAgreement}
            timelineSteps={sim.timelineSteps}
            bookingData={sim.bookingData}
            isTampered={sim.isTampered}
          />
        </div>
      </div>
    </div>
  );
}
