import { useEffect, useState } from "react";
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
import { VOICE_PROVIDER } from "../../../config/runtime";
import { useLiveVoiceSession } from "../../voice/useLiveVoiceSession";

export default function useCallSimulation() {
  const isMobile = useViewportMode();
  const { apiMode, apiBaseUrl, apiClient, isProbing } = useApiMode();
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);
  const [voiceMode, setVoiceMode] = useState(VOICE_PROVIDER);

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
  const liveVoice = useLiveVoiceSession(
    apiMode && voiceMode === "agora" ? apiClient : null,
    (call) => server.connectLiveCall(call)
  );

  useEffect(() => {
    if (!apiMode || !server.showBoardingPass) return;
    const timer = setTimeout(() => setMobileTab("ticket"), 0);
    return () => clearTimeout(timer);
  }, [apiMode, server.showBoardingPass]);

  // ---- Mock simulation actions (apiMode=false) -------------------------
  const mockReset = () => resetSimulationState(mockSetters, clearTimeouts);
  const mockIssueReceipt = (currentBookingData) =>
    issueBoardingPass(currentBookingData, mockSetters);
  const mockTriggerPayment = (depositAmount) => triggerPhonePaySheet(depositAmount, mockSetters);
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
    const retryLiveVoice = async () => {
      await liveVoice.stop();
      await liveVoice.start();
    };
    const continueInReplayMode = async () => {
      await liveVoice.stop();
      server.resetSimulation();
      setVoiceMode("replay");
      setTimeout(() => void server.startSimulation(), 0);
    };
    const endVoiceSession = async () => {
      await liveVoice.stop();
      server.resetSimulation();
    };
    const stopLiveVoice = async () => {
      await liveVoice.stop();
      server.startPostCallTranscriptSync();
    };
    return {
      apiMode,
      isProbing,
      streamStatus: server.streamStatus,
      paymentGate: server.paymentGate,
      isMobile,
      currentScenarioIdx,
      isSimulating: server.isSimulating,
      simStatus: server.simStatus,
      mobileTab,
      setMobileTab,
      phoneCallStatusText: server.simStatus,
      phoneCallColor: server.error ? "var(--danger-red)" : "var(--text-muted)",
      isWaveAnimating: server.isSimulating,
      callDuration: 0,
      subtitles: server.subtitles,
      bookingData: server.bookingData,
      showBoardingPass: server.showBoardingPass,
      showPaymentDrawer: server.showPaymentDrawer,
      paymentIntent: server.paymentIntent,
      drawerTimerText: DEFAULT_PAYMENT_TIMER,
      btnPhonePayText: server.paymentActionPending
        ? "Đang xác minh thanh toán..."
        : DEFAULT_PAYMENT_BUTTON,
      btnPhonePayDisabled: server.paymentActionPending,
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
      startSimulation: voiceMode === "agora" ? liveVoice.start : server.startSimulation,
      resetSimulation: () => {
        setMobileTab("call");
        server.resetSimulation();
      },
      simulateWalletPayment: server.simulateWalletPayment,
      tamperAgreement: server.tamperAgreement,
      serverCallId: server.callId,
      serverBookingId: server.bookingId,
      serverReceiptId: server.receiptId,
      serverError: server.error,
      voiceMode,
      voiceConnectionState: voiceMode === "agora" ? liveVoice.connectionState : null,
      stopLiveVoice,
      postCallTranscriptSync: server.postCallTranscriptSync,
      retryLiveVoice,
      continueInReplayMode,
      endVoiceSession
    };
  }

  // Mock branch — unchanged behaviour
  return {
    apiMode,
    isProbing,
    streamStatus: isProbing ? "connecting" : "demo",
    paymentGate: null,
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
    paymentIntent: null,
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
    tamperAgreement: mockHandleTamper,
    voiceConnectionState: null,
    voiceMode: "replay",
    stopLiveVoice: () => {},
    postCallTranscriptSync: "IDLE",
    retryLiveVoice: () => {},
    continueInReplayMode: () => {},
    endVoiceSession: () => {}
  };
}
