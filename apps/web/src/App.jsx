import { useMemo, useState } from "react";

import PhoneScreen from "./features/call/components/PhoneScreen";
import FleetRevenueTwinDashboard from "./features/fleet-twin/FleetRevenueTwinDashboard";
import { buildFleetRevenueTwinViewModel } from "./features/fleet-twin/fleetRevenueTwinViewModel";
import useCallSimulation from "./features/simulation/hooks/useCallSimulation";
import { useAgentReplyStatus } from "./features/simulation/hooks/useAgentReplyStatus.js";
import { idempotencyKey } from "./features/simulation/hooks/serverSimulationUtils.js";

function CustomerPhone({ sim, agentReplyStatus, lang, setLang }) {
  return (
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
      lang={lang}
      setLang={setLang}
    />
  );
}

export default function App() {
  const sim = useCallSimulation();
  const [lang, setLang] = useState("vi");
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const agentReplyStatus = useAgentReplyStatus(
    sim.transcript,
    sim.simStatus === "Cuộc gọi đang trực tiếp"
  );
  const model = useMemo(
    () =>
      buildFleetRevenueTwinViewModel({
        booking: sim.serverAuthority.booking,
        transcript: sim.transcript,
        scores: sim.scores,
        paymentGate: sim.paymentGate,
        evaluation: sim.serverAuthority.revenueTwin.evaluation,
        dashboard: sim.serverAuthority.revenueTwin.dashboard,
        decision: null,
        streamStatus: sim.streamStatus,
        simStatus: sim.simStatus
      }),
    [
      sim.paymentGate,
      sim.serverAuthority,
      sim.scores,
      sim.simStatus,
      sim.streamStatus,
      sim.transcript
    ]
  );

  const acceptOffer = async () => {
    if (!model.decision.canAccept || acceptingOffer) return;
    setAcceptingOffer(true);
    try {
      await sim.acceptRevenueTwinOffer({
        evaluationId: model.decision.evaluationId,
        offerId: model.decision.offerId,
        idempotencyKey: idempotencyKey(`rtw-accept-${model.decision.offerId}`)
      });
    } finally {
      setAcceptingOffer(false);
    }
  };

  return (
    <FleetRevenueTwinDashboard
      model={model}
      lang={lang}
      phone={<CustomerPhone sim={sim} agentReplyStatus={agentReplyStatus} lang={lang} setLang={setLang} />}
      accepting={acceptingOffer}
      onAcceptOffer={acceptOffer}
      onStartCall={sim.startSimulation}
      onEndCall={sim.endVoiceSession ?? sim.resetSimulation}
    />
  );
}
