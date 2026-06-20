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

export default function useCallSimulation() {
  const isMobile = useViewportMode();
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);
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

  const setters = {
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

  const resetSimulation = () => resetSimulationState(setters, clearTimeouts);
  const issueReceipt = (currentBookingData) => issueBoardingPass(currentBookingData, setters);
  const triggerPayment = (depositAmount) => triggerPhonePaySheet(depositAmount, setters);
  const simulateWalletPayment = () => {
    runWalletPaymentSequence({ bookingData, issueReceipt, scheduleTimeout, setters });
  };
  const startSimulation = () => {
    startDialogueSimulation({
      bookingData,
      currentScenarioIdx,
      isSimulating,
      scenarios,
      scheduleTimeout,
      setters,
      triggerPayment
    });
  };
  const selectScenario = (idx) => {
    if (isSimulating) {
      alert("Vui lòng đợi cuộc gọi hiện tại kết thúc hoặc bấm 'Đặt lại' trước khi chọn kịch bản khác.");
      return;
    }

    setCurrentScenarioIdx(idx);
    resetSimulation();
  };
  const handleTamperAgreement = () => tamperAgreement(bookingData, setters);

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
    startSimulation,
    resetSimulation,
    simulateWalletPayment,
    tamperAgreement: handleTamperAgreement
  };
}
