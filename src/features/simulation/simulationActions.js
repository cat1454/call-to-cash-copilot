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
} from "./simulationDefaults";
import {
  createRandomTamperDetails,
  createTamperPayload,
  createTxSignature,
  generateMockHash
} from "./simulationLedger";

export function resetSimulationState(setters, clearTimeouts) {
  clearTimeouts();
  setters.setIsSimulating(false);
  setters.setSimStatus("Sẵn sàng");
  setters.setMobileTab("call");
  setters.setPhoneCallStatusText(DEFAULT_PHONE_STATUS);
  setters.setPhoneCallColor("var(--text-muted)");
  setters.setIsWaveAnimating(false);
  setters.setCallDuration(0);
  setters.setSubtitles(createInitialSubtitles());
  setters.setBookingData(createInitialBookingData());
  setters.setShowBoardingPass(false);
  setters.setShowPaymentDrawer(false);
  setters.setDrawerTimerText(DEFAULT_PAYMENT_TIMER);
  setters.setBtnPhonePayText(DEFAULT_PAYMENT_BUTTON);
  setters.setBtnPhonePayDisabled(false);
  setters.setBtnPhonePayBg("var(--primary-blue)");
  setters.setIsTampered(false);
  setters.setTranscript(createInitialTranscript());
  setters.setScores(createInitialScores());
  setters.setPerformance(createInitialPerformance());
  setters.setBrainMode("fast");
  setters.setPrefetchContent("");
  setters.setShowPrefetch(false);
  setters.setTimelineSteps([]);
  setters.setLedgerLogs(createInitialLedgerLogs());
}

export function issueBoardingPass(currentBookingData, setters) {
  const anchoredHash = generateMockHash(currentBookingData);
  const txSig = createTxSignature();

  setters.setShowBoardingPass(true);
  setters.setPhoneCallStatusText("Đã cấp vé điện tử thành công");
  setters.setPhoneCallColor("var(--success-green)");
  setters.setMobileTab("receipt");
  setters.setSubtitles({
    speaker: "Hệ thống bảo mật",
    text: "Vé xe khách điện tử đã được ký số và neo băm on-chain bảo mật. Bạn có thể lên xe!"
  });
  setters.setLedgerLogs((prev) => ({
    ...prev,
    txSig: txSig.substring(0, 24) + "...",
    anchoredHash,
    computedHash: anchoredHash,
    computedHashColor: "var(--success-green)",
    show: true
  }));
  setters.setTimelineSteps([1, 2, 3, 4, 5, 6]);
  setters.setScores((prev) => ({ completeness: 100, dispute: prev.dispute, readiness: 100 }));
}

export function triggerPhonePaySheet(depositAmount, setters) {
  setters.setShowPaymentDrawer(true);
  setters.setMobileTab("dashboard");
  setters.setPhoneCallStatusText("Đợi quét mã Solana Pay...");
  setters.setPhoneCallColor("var(--warning-amber)");
  setters.setIsWaveAnimating(false);
  console.log("[Payment] Initializing gate drawer for deposit:", depositAmount);
  setters.setSubtitles({
    speaker: "Hệ thống cọc",
    text: "Vui lòng quét mã QR để chuyển khoản cọc giữ chỗ..."
  });
  setters.setTimelineSteps((prev) => {
    const current = [...prev];
    if (!current.includes(5)) current.push(5);
    return current;
  });
}

export function runWalletPaymentSequence({ bookingData, issueReceipt, scheduleTimeout, setters }) {
  setters.setBtnPhonePayDisabled(true);
  setters.setBtnPhonePayBg("#444");
  setters.setBtnPhonePayText("Đang liên kết ví điện tử...");
  setters.setSubtitles({
    speaker: "Hệ thống cọc",
    text: "Đang kết nối cổng ví bảo mật và truy vấn số dư..."
  });

  const steps = [
    ["Mạng lưới: Phát hiện giao dịch...", "Mạng lưới phát hiện yêu cầu đặt cọc giữ chỗ (Mã 0x3b8a)...", 1000],
    ["Mạng lưới: Đã nhận tiền cọc...", "Mạng lưới blockchain đồng thuận! Giao dịch cọc thành công.", 1200],
    ["Đang neo băm thỏa thuận đặt vé...", "Đang tính toán mã băm SHA-256 và neo biên nhận lên sổ cái Solana...", 1200],
    ["Giao dịch thành công!", "Khóa chỗ và kích hoạt vé điện tử thành công!", 1000]
  ];

  const runStep = (index) => {
    if (index >= steps.length) {
      scheduleTimeout(() => {
        setters.setShowPaymentDrawer(false);
        issueReceipt(bookingData);
      }, 800);
      return;
    }

    const [buttonText, subtitleText, delay] = steps[index];
    scheduleTimeout(() => {
      setters.setBtnPhonePayText(buttonText);
      setters.setSubtitles({ speaker: "Hệ thống cọc", text: subtitleText });
      runStep(index + 1);
    }, delay);
  };

  runStep(0);
}

export function startDialogueSimulation({
  bookingData,
  currentScenarioIdx,
  isSimulating,
  scenarios,
  scheduleTimeout,
  setters,
  triggerPayment
}) {
  if (isSimulating) return;

  setters.setIsSimulating(true);
  setters.setSimStatus("Cuộc gọi đang trực tiếp");
  setters.setCallDuration(0);
  setters.setPhoneCallStatusText("Cuộc gọi đang diễn ra (00:00)");
  setters.setPhoneCallColor("var(--primary-blue)");
  setters.setIsWaveAnimating(true);

  const steps = scenarios[currentScenarioIdx];

  const runStep = (stepIdx) => {
    if (stepIdx >= steps.length) {
      setters.setIsSimulating(false);
      setters.setSimStatus("Đã hoàn thành");
      return;
    }

    const step = steps[stepIdx];
    setters.setTranscript((prev) => [...prev, { sender: step.sender, text: "", isTyping: true }]);

    scheduleTimeout(() => {
      setters.setTranscript((prev) => {
        const filtered = prev.filter((msg) => !msg.isTyping);
        return [...filtered, { sender: step.sender, text: step.text }];
      });
      setters.setSubtitles({
        speaker: step.sender === "ai" ? "Tổng đài AI" : "Khách hàng",
        text: step.text
      });

      if (applyStepUpdates(step.updates, { bookingData, setters, triggerPayment })) return;

      scheduleTimeout(() => runStep(stepIdx + 1), step.sender === "ai" ? 4200 : 3800);
    }, 1000);
  };

  runStep(0);
}

function applyStepUpdates(updates, { bookingData, setters, triggerPayment }) {
  if (!updates) return false;

  if (updates.entities) {
    setters.setBookingData((prev) => ({ ...prev, ...updates.entities }));
    setters.setLedgerLogs((prev) => ({
      ...prev,
      entities: { ...prev.entities, ...updates.entities }
    }));
  }
  if (updates.scores) setters.setScores((prev) => ({ ...prev, ...updates.scores }));
  if (updates.performance) setters.setPerformance((prev) => ({ ...prev, ...updates.performance }));
  if (updates.brainMode) setters.setBrainMode(updates.brainMode);
  if (updates.prefetch) {
    setters.setPrefetchContent(updates.prefetch);
    setters.setShowPrefetch(true);
  } else {
    setters.setShowPrefetch(false);
  }
  if (updates.timeline) setters.setTimelineSteps(updates.timeline);
  if (!updates.gateUnlocked) return false;

  triggerPayment(updates.entities?.deposit || bookingData.deposit);
  setters.setIsSimulating(false);
  setters.setSimStatus("Chờ thanh toán cọc");
  return true;
}

export function tamperAgreement(bookingData, setters) {
  const { hackedRoute, hackedSeats } = createRandomTamperDetails();
  const tamperedPayload = createTamperPayload(bookingData, { hackedRoute, hackedSeats });

  setters.setIsTampered(true);
  setters.setBookingData((prev) => ({ ...prev, route: hackedRoute, seats: hackedSeats }));
  setters.setLedgerLogs((prev) => ({
    ...prev,
    computedHash: generateMockHash(tamperedPayload),
    computedHashColor: "var(--error-red)"
  }));
  setters.setSubtitles({
    speaker: "CẢNH BÁO HỆ THỐNG",
    text: "Cảnh báo bảo mật: Phát hiện sai lệch dữ liệu hành trình trên hệ thống đối soát!"
  });
  alert(
    "Cảnh báo bảo mật hệ thống: Phát hiện hành vi can thiệp trái phép vào cơ sở dữ liệu vé xe (thay đổi lộ trình/số ghế). Lớp đối soát chữ ký số (Solana Ledger Proof) phát hiện sự sai lệch với mã băm đã ký lúc thanh toán cọc. Trạng thái vé lập tức bị vô hiệu hóa để bảo vệ an toàn giao dịch!"
  );
}
