import PhoneScreen from "./features/call/components/PhoneScreen";
import ScenarioSelector from "./features/simulation/components/ScenarioSelector";
import VoiceSimulatorPanel from "./features/simulation/components/VoiceSimulatorPanel";
import AIDecisionPanel from "./features/simulation/components/AIDecisionPanel";
import SaaSTelemetryPanel from "./features/simulation/components/SaaSTelemetryPanel";
import SolanaLedgerCard from "./features/payment/components/SolanaLedgerCard";
import DecisionTimeline from "./features/simulation/components/DecisionTimeline";
import RevenueTwinJudgePanel from "./features/simulation/components/RevenueTwinJudgePanel";
import useCallSimulation from "./features/simulation/hooks/useCallSimulation";
import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import Hook from "./components/Hook";
import { DEMO_MODE, getVoiceModeLabel } from "./config/runtime";
import { getAIDecision, getReadinessScore } from "./features/simulation/helpers/appHelpers";
import { useAgentReplyStatus } from "./features/simulation/hooks/useAgentReplyStatus.js";
import { useRevenueTwinDashboard } from "./features/simulation/hooks/useRevenueTwinDashboard.js";

export default function App() {
  const sim = useCallSimulation();
  const agentReplyStatus = useAgentReplyStatus(
    sim.transcript,
    sim.simStatus === "Cuộc gọi đang trực tiếp"
  );
  const revenueTwin = useRevenueTwinDashboard(sim.apiClient);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  };

  const handleStartCallFromHero = () => {
    sim.setMobileTab("call");
    scrollToSection("simulation-workspace");

    // Không reset hoặc làm gián đoạn demo đang chạy.
    if (sim.demoReady && sim.simStatus === "Sẵn sàng" && !sim.isSimulating) {
      setTimeout(() => {
        sim.startSimulation();
      }, 420);
    }
  };

  const handleDemoFlowFromHero = () => {
    sim.setMobileTab("call");
    scrollToSection("simulation-workspace");
  };

  const handleProofFromHero = () => {
    scrollToSection("verification-proof");
  };

  const handleCampaignFromHero = () => {
    scrollToSection("scenario-selector");
  };

  const decision = getAIDecision(sim);
  const readinessScore = getReadinessScore(sim);
  const pageContainer = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10";

  // Product header: desktop/tablet only.
  const headerContent = (
    <header className="w-full border-b border-[#e5e7eb] bg-white">
      <div
        className={`${pageContainer} flex flex-col items-start justify-between gap-4 py-5 min-[1024px]:flex-row min-[1024px]:items-center`}
      >
        <div>
          <h1 className="text-balance text-xl font-bold tracking-tight text-[#111827]">
            Call-to-Cash <span className="text-[#059669]">Risk Copilot</span>
          </h1>

          <p className="mt-1 max-w-2xl text-balance text-xs leading-[18px] font-normal text-[#6b7280]">
            Agora x Solana: Trợ lý AI giám sát rủi ro hội thoại, tự động đối soát và neo băm khóa
            cọc giao dịch thời gian thực
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="min-h-6 whitespace-nowrap rounded-full bg-[#f3f4f6] px-2.5 py-1 text-xs leading-4 font-medium text-[#6b7280]">
            {getVoiceModeLabel(sim.voiceMode)}
          </span>

          <div
            className={`flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-4 font-medium ${
              sim.demoReady
                ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${sim.demoReady ? "animate-pulse bg-[#10b981]" : "bg-amber-500"}`} />
            <span>{sim.demoReady ? "Demo authoritative sẵn sàng" : "Demo đang bị khóa"}</span>
          </div>

          <div className="flex min-h-6 items-center gap-1.5 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-1 text-xs leading-4 font-medium text-[#065f46]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10b981]" />
            <span>
              {sim.paymentIntent?.provider === "solana_devnet"
                ? "Solana: Devnet demo"
                : !sim.demoReady
                  ? "Payment: chờ API"
                  : DEMO_MODE
                  ? "Payment: Deterministic Mock"
                  : "Payment: Server verified"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );

  // Hero must be passed separately from header.
  // WorkspaceLayout renders it after the product header.
  const heroContent = (
    <Hook
      onPrimaryAction={handleStartCallFromHero}
      onSecondaryAction={handleDemoFlowFromHero}
      onProofAction={handleProofFromHero}
      onCampaignAction={handleCampaignFromHero}
      campaignText="Trải nghiệm pilot Call-to-Cash với các kịch bản đặt vé và cọc mô phỏng trước khi triển khai vận hành thật."
    />
  );

  // Left Column Content: transcript + AI decision
  const leftContent = (
    <>
      <VoiceSimulatorPanel
        simStatus={sim.simStatus}
        streamStatus={sim.streamStatus}
        transcript={sim.transcript}
        agentReplyStatus={agentReplyStatus}
        startSimulation={sim.startSimulation}
        resetSimulation={sim.resetSimulation}
        isSimulating={sim.isSimulating}
        readinessScore={readinessScore}
        voiceConnectionState={sim.voiceConnectionState}
        stopLiveVoice={sim.stopLiveVoice}
        voiceMode={sim.voiceMode}
        retryLiveVoice={sim.retryLiveVoice}
        continueInReplayMode={sim.continueInReplayMode}
        endVoiceSession={sim.endVoiceSession}
        postCallTranscriptSync={sim.postCallTranscriptSync}
        demoReady={sim.demoReady}
        demoReadiness={sim.demoReadiness}
        retryDemoReadiness={sim.retryDemoReadiness}
      />

      <AIDecisionPanel decision={decision} scores={sim.scores} />
    </>
  );

  // Center Column Content: customer phone app
  const centerContent = (
    <PhoneScreen
      isMobileLayout={sim.isMobile}
      activeTab={sim.mobileTab}
      setActiveTab={sim.setMobileTab}
      isSimulating={sim.isSimulating}
      simStatus={sim.simStatus}
      phoneCallStatusText={sim.phoneCallStatusText}
      phoneCallColor={sim.phoneCallColor}
      isWaveAnimating={sim.isWaveAnimating}
      agentReplyStatus={agentReplyStatus}
      subtitles={sim.subtitles}
      bookingData={sim.bookingData}
      showBoardingPass={sim.showBoardingPass}
      showPaymentDrawer={sim.showPaymentDrawer}
      paymentIntent={sim.paymentIntent}
      drawerTimerText={sim.drawerTimerText}
      btnPhonePayText={sim.btnPhonePayText}
      btnPhonePayDisabled={sim.btnPhonePayDisabled}
      btnPhonePayBg={sim.btnPhonePayBg}
      simulateWalletPayment={sim.simulateWalletPayment}
      startSimulation={sim.startSimulation}
      resetSimulation={sim.resetSimulation}
      tamperAgreement={sim.tamperAgreement}
      isTampered={sim.isTampered}
      scores={sim.scores}
      performance={sim.performance}
      brainMode={sim.brainMode}
      showPrefetch={sim.showPrefetch}
      prefetchContent={sim.prefetchContent}
      timelineSteps={sim.timelineSteps}
      ledgerLogs={sim.ledgerLogs}
      paymentGate={sim.paymentGate}
      voiceMode={sim.voiceMode}
      demoReady={sim.demoReady}
      markPaymentWalletOpened={sim.markPaymentWalletOpened}
      agreementConfirmation={sim.agreementConfirmation}
    />
  );

  // Right Column Content: telemetry + immutable ledger proof + timeline
  const rightContent = (
    <>
      <SaaSTelemetryPanel
        performance={sim.performance}
        brainMode={sim.brainMode}
        showPrefetch={sim.showPrefetch}
        prefetchContent={sim.prefetchContent}
        scores={sim.scores}
        bookingData={sim.bookingData}
        ledgerLogs={sim.ledgerLogs}
      />

      <RevenueTwinJudgePanel dashboard={revenueTwin.dashboard} status={revenueTwin.status} />

      <div
        id="verification-proof"
        className="scroll-mt-6"
        aria-label="Bằng chứng xác thực giao dịch"
      >
        <SolanaLedgerCard
          ledgerLogs={sim.ledgerLogs}
          isTampered={sim.isTampered}
          bookingData={sim.bookingData}
          tamperAgreement={sim.tamperAgreement}
        />
      </div>

      <DecisionTimeline timelineSteps={sim.timelineSteps} />
    </>
  );

  // Scenario Selector: desktop/tablet only through WorkspaceLayout.
  const scenarioSelectorContent = (
    <div id="scenario-selector" className="scroll-mt-6">
      <ScenarioSelector
        currentScenarioIdx={sim.currentScenarioIdx}
        selectScenario={sim.selectScenario}
      />
    </div>
  );

  return (
    <WorkspaceLayout
      header={headerContent}
      hero={heroContent}
      scenarios={scenarioSelectorContent}
      left={leftContent}
      center={centerContent}
      right={rightContent}
    />
  );
}
