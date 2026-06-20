import { useState } from "react";
import { scenarios } from "../../../data/scenarios";
import {
  createInitialBookingData,
  createInitialLedgerLogs,
  createInitialPerformance,
  createInitialScores,
  createInitialSubtitles,
  createInitialTranscript,
  DEFAULT_PAYMENT_BUTTON,
  DEFAULT_PAYMENT_TIMER,
  DEFAULT_PHONE_STATUS
} from "../simulationDefaults";
import {
  issueBoardingPass,
  resetSimulationState,
  runWalletPaymentSequence,
  startDialogueSimulation,
  tamperAgreement,
  triggerPhonePaySheet
} from "../simulationActions";
import { useCallDurationTimer } from "./useCallDurationTimer";
import { useReservationCountdown } from "./useReservationCountdown";
import { useTimeoutRegistry } from "./useTimeoutRegistry";
import { useViewportMode } from "./useViewportMode";
import { useApiMode } from "./useApiMode";
import useServerSimulation from "./useServerSimulation";

export default function useCallSimulation() {
  const isMobile = useViewportMode();
  const { apiMode, apiBaseUrl, apiClient } = useApiMode();
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);

  // ---- Mock simulation state (used only when apiMode=false) -----------
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState("Sẵn sàng");
  const [mobileTab, setMobileTab] = useState("call");
  const [phoneCallStatusText, setPhoneCallStatusText] = useState(DEFAULT_PHONE_STATUS);
  const [phoneCallColor, setPhoneCallColor] = useState("var(--text-muted)");
  const [isWaveAnimating, setIsWaveAnimating] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [subtitles, setSubtitles] = useState(createInitialSubtitles);
  const [bookingData, setBookingData] = useState(createInitialBookingData);
  const [showBoardingPass, setShowBoardingPass] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [drawerTimerText, setDrawerTimerText] = useState(DEFAULT_PAYMENT_TIMER);
  const [btnPhonePayText, setBtnPhonePayText] = useState(DEFAULT_PAYMENT_BUTTON);
  const [btnPhonePayDisabled, setBtnPhonePayDisabled] = useState(false);
  const [btnPhonePayBg, setBtnPhonePayBg] = useState("var(--primary-blue)");
  const [isTampered, setIsTampered] = useState(false);
  const [transcript, setTranscript] = useState(createInitialTranscript);
  const [scores, setScores] = useState(createInitialScores);
  const [performance, setPerformance] = useState(createInitialPerformance);
  const [brainMode, setBrainMode] = useState("fast");
  const [prefetchContent, setPrefetchContent] = useState("");
  const [showPrefetch, setShowPrefetch] = useState(false);
  const [timelineSteps, setTimelineSteps] = useState([]);
  const [ledgerLogs, setLedgerLogs] = useState(createInitialLedgerLogs);
  const { clearTimeouts, scheduleTimeout } = useTimeoutRegistry();

  const mockSetters = {
    setBookingData,
    setBrainMode,
    setBtnPhonePayBg,
    setBtnPhonePayDisabled,
    setBtnPhonePayText,
    setCallDuration,
    setDrawerTimerText,
    setIsSimulating,
    setIsTampered,
    setIsWaveAnimating,
    setLedgerLogs,
    setMobileTab,
    setPerformance,
    setPhoneCallColor,
    setPhoneCallStatusText,
    setPrefetchContent,
    setScores,
    setShowBoardingPass,
    setShowPaymentDrawer,
    setShowPrefetch,
    setSimStatus,
    setSubtitles,
    setTimelineSteps,
    setTranscript
  };

  useCallDurationTimer({
    isWaveAnimating,
    callDuration,
    setCallDuration,
    setPhoneCallStatusText
  });
  useReservationCountdown({
    showPaymentDrawer,
    setBtnPhonePayBg,
    setBtnPhonePayDisabled,
    setBtnPhonePayText,
    setDrawerTimerText
  });

  // ---- API simulation (always called unconditionally for hook rules) ---
  const server = useServerSimulation(
    apiMode ? apiClient : null,
    apiBaseUrl,
    currentScenarioIdx,
    scenarios
  );

  // ---- Mock simulation actions (apiMode=false) -------------------------
  const mockReset = () => resetSimulationState(mockSetters, clearTimeouts);
  const mockIssueReceipt = (currentBookingData) =>
    issueBoardingPass(currentBookingData, mockSetters);
  const mockTriggerPayment = (depositAmount) =>
    triggerPhonePaySheet(depositAmount, mockSetters);
  const mockSimulateWalletPayment = () => {
    runWalletPaymentSequence({
      bookingData,
      issueReceipt: mockIssueReceipt,
      scheduleTimeout,
      setters: mockSetters
    });
  };
  const mockStartSimulation = () => {
    startDialogueSimulation({
      bookingData,
      currentScenarioIdx,
      isSimulating,
      scenarios,
      scheduleTimeout,
      setters: mockSetters,
      triggerPayment: mockTriggerPayment
    });
  };
  const mockHandleTamper = () => tamperAgreement(bookingData, mockSetters);

  const selectScenario = (idx) => {
    if (apiMode ? server.isSimulating : isSimulating) {
      alert(
        "Vui lòng đợi cuộc gọi hiện tại kết thúc hoặc bấm 'Đặt lại' trước khi chọn kịch bản khác."
      );
      return;
    }
    setCurrentScenarioIdx(idx);
    if (apiMode) server.resetSimulation();
    else mockReset();
  };

  // ---- Unified surface (picks API or mock branch) ----------------------
  if (apiMode) {
    return {
      isMobile,
      currentScenarioIdx,
      isSimulating: server.isSimulating,
      simStatus: server.simStatus,
      mobileTab: "call",
      setMobileTab: () => {},
      phoneCallStatusText: server.simStatus,
      phoneCallColor: server.error ? "var(--danger-red)" : "var(--text-muted)",
      isWaveAnimating: server.isSimulating,
      callDuration: 0,
      subtitles: { speaker: "", text: "" },
      bookingData: createInitialBookingData(),
      showBoardingPass: server.showBoardingPass,
      showPaymentDrawer: server.showPaymentDrawer,
      drawerTimerText: DEFAULT_PAYMENT_TIMER,
      btnPhonePayText: DEFAULT_PAYMENT_BUTTON,
      btnPhonePayDisabled: false,
      btnPhonePayBg: "var(--primary-blue)",
      isTampered: server.isTampered,
      transcript: server.transcript,
      scores: server.scores,
      performance: createInitialPerformance(),
      brainMode: "fast",
      prefetchContent: "",
      showPrefetch: false,
      timelineSteps: server.timelineSteps,
      ledgerLogs: server.ledgerLogs,
      selectScenario,
      startSimulation: server.startSimulation,
      resetSimulation: server.resetSimulation,
      simulateWalletPayment: () =>
        server.simulateWalletPayment(server.paymentIntentId, {
          amount: { currency: "VND", minor: 300000 },
          recipient: "mock-recipient-wallet",
          reference: ""
        }),
      tamperAgreement: () => server.tamperAgreement(server.receiptId),
      // Phase 7 extras exposed for UI
      serverCallId: server.callId,
      serverBookingId: server.bookingId,
      serverReceiptId: server.receiptId,
      serverError: server.error
    };
  }

  // Mock branch — unchanged behaviour
  return {
    isMobile,
    currentScenarioIdx,
    isSimulating,
    simStatus,
    mobileTab,
    setMobileTab,
    phoneCallStatusText,
    phoneCallColor,
    isWaveAnimating,
    callDuration,
    subtitles,
    bookingData,
    showBoardingPass,
    showPaymentDrawer,
    drawerTimerText,
    btnPhonePayText,
    btnPhonePayDisabled,
    btnPhonePayBg,
    isTampered,
    transcript,
    scores,
    performance,
    brainMode,
    prefetchContent,
    showPrefetch,
    timelineSteps,
    ledgerLogs,
    selectScenario,
    startSimulation: mockStartSimulation,
    resetSimulation: mockReset,
    simulateWalletPayment: mockSimulateWalletPayment,
    tamperAgreement: mockHandleTamper
  };
}
