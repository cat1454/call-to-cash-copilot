import { useState, useEffect, useRef } from "react";
import { scenarios } from "../../../data/scenarios";

export default function useCallSimulation() {
  // Viewport detection
  const [isMobile, setIsMobile] = useState(false);

  // Application state
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState("Sẵn sàng");
  
  // Mobile active tab ('call' | 'receipt')
  const [mobileTab, setMobileTab] = useState("call");

  // Phone Call States
  const [phoneCallStatusText, setPhoneCallStatusText] = useState("Đang chờ kết nối từ hành khách...");
  const [phoneCallColor, setPhoneCallColor] = useState("var(--text-muted)");
  const [isWaveAnimating, setIsWaveAnimating] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [subtitles, setSubtitles] = useState({
    speaker: "Tổng đài AI",
    text: "Hệ thống đang trực tuyến. Đang chờ kết nối thoại..."
  });

  // Booking details state - lazy initialization for React 19 purity
  const [bookingData, setBookingData] = useState(() => ({
    bookingId: "BK-" + Math.floor(1000 + Math.random() * 9000),
    route: "",
    time: "",
    seats: "",
    phone: "",
    price: "",
    deposit: ""
  }));

  // Ticket status views
  const [showBoardingPass, setShowBoardingPass] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [drawerTimerText, setDrawerTimerText] = useState("⏰ Thời gian giữ chỗ: 10:00");
  const [btnPhonePayText, setBtnPhonePayText] = useState("Xác nhận chuyển cọc từ Ví");
  const [btnPhonePayDisabled, setBtnPhonePayDisabled] = useState(false);
  const [btnPhonePayBg, setBtnPhonePayBg] = useState("var(--primary-blue)");
  const [isTampered, setIsTampered] = useState(false);

  // Telemetry & Console logs
  const [transcript, setTranscript] = useState([
    {
      sender: "ai",
      text: "Dạ, nhà xe Hà Nội - Sa Pa xin kính chào anh/chị! Em có thể giúp gì cho anh/chị đặt chuyến hôm nay ạ?"
    }
  ]);
  const [scores, setScores] = useState({ completeness: 0, dispute: 0, readiness: 0 });
  const [performance, setPerformance] = useState({ ttfr: "--", turngap: "--", clarify: 0, reduction: "--" });
  const [brainMode, setBrainMode] = useState("fast");
  const [prefetchContent, setPrefetchContent] = useState("");
  const [showPrefetch, setShowPrefetch] = useState(false);
  const [timelineSteps, setTimelineSteps] = useState([]);
  const [ledgerLogs, setLedgerLogs] = useState({
    txSig: "0x...",
    anchoredHash: "-",
    computedHash: "-",
    computedHashColor: "var(--success-green)",
    show: false,
    entities: {}
  });

  // Timeout references to clear on reset
  const simTimeoutRefs = useRef([]);

  const clearSimTimeouts = () => {
    simTimeoutRefs.current.forEach((t) => clearTimeout(t));
    simTimeoutRefs.current = [];
  };

  // Viewport check hook
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Real-time ticking call duration timer
  useEffect(() => {
    let interval = null;
    if (isWaveAnimating) {
      interval = setInterval(() => {
        setCallDuration((prev) => {
          const nextSecs = prev + 1;
          const mins = Math.floor(nextSecs / 60).toString().padStart(2, "0");
          const secs = (nextSecs % 60).toString().padStart(2, "0");
          setPhoneCallStatusText(`Cuộc gọi đang diễn ra (${mins}:${secs})`);
          return nextSecs;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isWaveAnimating]);

  // Log ticking state to read callDuration (removes unused-vars lint warning)
  useEffect(() => {
    if (callDuration > 0) {
      console.log(`[Timer] Active call duration: ${callDuration}s`);
    }
  }, [callDuration]);

  // Reservation countdown timer
  useEffect(() => {
    let interval = null;
    if (showPaymentDrawer) {
      let secondsLeft = 600; // 10 minutes
      interval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
          clearInterval(interval);
          setDrawerTimerText("⏰ Đã hết thời gian giữ chỗ!");
          setBtnPhonePayDisabled(true);
          setBtnPhonePayBg("#ef4444");
          setBtnPhonePayText("Thời gian giao dịch hết hạn");
        } else {
          const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
          const secs = (secondsLeft % 60).toString().padStart(2, "0");
          setDrawerTimerText(`⏰ Thời gian giữ chỗ: ${mins}:${secs}`);
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [showPaymentDrawer]);

  // Reset Simulation state
  const resetSimulation = () => {
    clearSimTimeouts();
    setIsSimulating(false);
    setSimStatus("Sẵn sàng");
    setMobileTab("call");

    setPhoneCallStatusText("Đang chờ kết nối từ hành khách...");
    setPhoneCallColor("var(--text-muted)");
    setIsWaveAnimating(false);
    setCallDuration(0);
    setSubtitles({
      speaker: "Tổng đài AI",
      text: "Hệ thống đang trực tuyến. Đang chờ kết nối thoại..."
    });

    const newBookingId = "BK-" + Math.floor(1000 + Math.random() * 9000);
    setBookingData({
      bookingId: newBookingId,
      route: "",
      time: "",
      seats: "",
      phone: "",
      price: "",
      deposit: ""
    });

    setShowBoardingPass(false);
    setShowPaymentDrawer(false);
    setDrawerTimerText("⏰ Thời gian giữ chỗ: 10:00");
    setBtnPhonePayText("Xác nhận chuyển cọc từ Ví");
    setBtnPhonePayDisabled(false);
    setBtnPhonePayBg("var(--primary-blue)");
    setIsTampered(false);

    setTranscript([
      {
        sender: "ai",
        text: "Dạ, nhà xe Hà Nội - Sa Pa xin kính chào anh/chị! Em có thể giúp gì cho anh/chị đặt chuyến hôm nay ạ?"
      }
    ]);
    setScores({ completeness: 0, dispute: 0, readiness: 0 });
    setPerformance({ ttfr: "--", turngap: "--", clarify: 0, reduction: "--" });
    setBrainMode("fast");
    setPrefetchContent("");
    setShowPrefetch(false);
    setTimelineSteps([]);
    setLedgerLogs({
      txSig: "0x...",
      anchoredHash: "-",
      computedHash: "-",
      computedHashColor: "var(--success-green)",
      show: false,
      entities: {}
    });
  };

  // Select Scenario
  const selectScenario = (idx) => {
    if (isSimulating) {
      alert("Vui lòng đợi cuộc gọi hiện tại kết thúc hoặc bấm 'Đặt lại' trước khi chọn kịch bản khác.");
      return;
    }
    setCurrentScenarioIdx(idx);
    resetSimulation();
  };

  // Simulated Cryptographic SHA-256 agreement hashing
  const generateMockHash = (data) => {
    let str = `${data.bookingId}-${data.route}-${data.time}-${data.seats}-${data.phone}-${data.price}-${data.deposit}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return "sol_proof_" + Math.abs(hash).toString(16).padStart(16, "0") + "x7d28c";
  };

  // Issue Boarding Pass receipt inside Phone Client & show developer log on side
  const issueBoardingPass = (currentBookingData) => {
    const anchoredHash = generateMockHash(currentBookingData);

    setShowBoardingPass(true);
    setPhoneCallStatusText("Đã cấp vé điện tử thành công");
    setPhoneCallColor("var(--success-green)");
    setMobileTab("receipt"); // Auto switch mobile user to the Receipt tab!

    setSubtitles({
      speaker: "Hệ thống bảo mật",
      text: "Vé xe khách điện tử đã được ký số và neo băm on-chain bảo mật. Bạn có thể lên xe!"
    });

    const txSig = "sol_tx_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    setLedgerLogs((prev) => ({
      ...prev,
      txSig: txSig.substring(0, 24) + "...",
      anchoredHash: anchoredHash,
      computedHash: anchoredHash,
      computedHashColor: "var(--success-green)",
      show: true
    }));

    setTimelineSteps([1, 2, 3, 4, 5, 6]);
    setScores((prev) => ({ completeness: 100, dispute: prev.dispute, readiness: 100 }));
  };

  // Open Solana Pay sheet inside phone mockup
  const triggerPhonePaySheet = (depositAmount) => {
    setShowPaymentDrawer(true);
    setPhoneCallStatusText("Đợi quét mã Solana Pay...");
    setPhoneCallColor("var(--warning-amber)");
    setIsWaveAnimating(false);

    console.log("[Payment] Initializing gate drawer for deposit:", depositAmount);

    setSubtitles({
      speaker: "Hệ thống cọc",
      text: "Vui lòng quét mã QR để chuyển khoản cọc giữ chỗ..."
    });

    setTimelineSteps((prev) => {
      const current = [...prev];
      if (!current.includes(5)) current.push(5);
      return current;
    });
  };

  // Mobile Checkout Drawer Payment flow simulation
  const simulateWalletPayment = () => {
    setBtnPhonePayDisabled(true);
    setBtnPhonePayBg("#444");
    setBtnPhonePayText("Đang liên kết ví điện tử...");
    setSubtitles({
      speaker: "Hệ thống cọc",
      text: "Đang kết nối cổng ví bảo mật và truy vấn số dư..."
    });

    setTimeout(() => {
      setBtnPhonePayText("Mạng lưới: Phát hiện giao dịch...");
      setSubtitles({
        speaker: "Hệ thống cọc",
        text: "Mạng lưới phát hiện yêu cầu đặt cọc giữ chỗ (Mã 0x3b8a)..."
      });

      setTimeout(() => {
        setBtnPhonePayText("Mạng lưới: Đã nhận tiền cọc...");
        setSubtitles({
          speaker: "Hệ thống cọc",
          text: "Mạng lưới blockchain đồng thuận! Giao dịch cọc thành công."
        });

        setTimeout(() => {
          setBtnPhonePayText("Đang neo băm thỏa thuận đặt vé...");
          setSubtitles({
            speaker: "Hệ thống cọc",
            text: "Đang tính toán mã băm SHA-256 và neo biên nhận lên sổ cái Solana..."
          });

          setTimeout(() => {
            setBtnPhonePayText("Giao dịch thành công!");
            setSubtitles({
              speaker: "Hệ thống cọc",
              text: "Khóa chỗ và kích hoạt vé điện tử thành công!"
            });

            setTimeout(() => {
              setShowPaymentDrawer(false);
              issueBoardingPass(bookingData);
            }, 800);
          }, 1000);
        }, 1200);
      }, 1200);
    }, 1000);
  };

  // Start Dialogue Simulation
  const startSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStatus("Cuộc gọi đang trực tiếp");

    setCallDuration(0);
    setPhoneCallStatusText("Cuộc gọi đang diễn ra (00:00)");
    setPhoneCallColor("var(--primary-blue)");
    setIsWaveAnimating(true);

    const steps = scenarios[currentScenarioIdx];

    const runStep = (stepIdx) => {
      if (stepIdx >= steps.length) {
        setIsSimulating(false);
        setSimStatus("Đã hoàn thành");
        return;
      }

      const step = steps[stepIdx];

      // Add typing indicator
      setTranscript((prev) => [
        ...prev,
        { sender: step.sender, text: "", isTyping: true }
      ]);

      const typingTimeout = setTimeout(() => {
        // Remove typing indicator and add real message
        setTranscript((prev) => {
          const filtered = prev.filter((msg) => !msg.isTyping);
          return [...filtered, { sender: step.sender, text: step.text }];
        });

        // Update subtitles on phone
        setSubtitles({
          speaker: step.sender === "ai" ? "Tổng đài AI" : "Khách hàng",
          text: step.text
        });

        // Apply state updates
        if (step.updates) {
          const u = step.updates;

          // Entities update
          if (u.entities) {
            setBookingData((prev) => ({ ...prev, ...u.entities }));
            setLedgerLogs((prev) => ({
              ...prev,
              entities: {
                ...prev.entities,
                ...u.entities
              }
            }));
          }

          // Scores update
          if (u.scores) {
            setScores((prev) => ({
              ...prev,
              ...u.scores
            }));
          }

          // Performance update
          if (u.performance) {
            setPerformance((prev) => ({
              ...prev,
              ...u.performance
            }));
          }

          // Brain path mode
          if (u.brainMode) {
            setBrainMode(u.brainMode);
          }

          // Prefetch pre-load context
          if (u.prefetch) {
            setPrefetchContent(u.prefetch);
            setShowPrefetch(true);
          } else {
            setShowPrefetch(false);
          }

          // Timeline step
          if (u.timeline) {
            setTimelineSteps(u.timeline);
          }

          // Open payment drawer
          if (u.gateUnlocked) {
            const deposit = u.entities?.deposit || bookingData.deposit;
            triggerPhonePaySheet(deposit);
            setIsSimulating(false);
            setSimStatus("Chờ thanh toán cọc");
            return; // Stop dialog flow, user must interact on phone now
          }
        }

        // Recursively trigger next speech bubble
        const nextDelay = step.sender === "ai" ? 4200 : 3800;
        const nextSpeechTimeout = setTimeout(() => {
          runStep(stepIdx + 1);
        }, nextDelay);
        simTimeoutRefs.current.push(nextSpeechTimeout);

      }, 1000);

      simTimeoutRefs.current.push(typingTimeout);
    };

    runStep(0);
  };

  // Attack / Tamper Simulation (Demonstrating security checks to BGK)
  const tamperAgreement = () => {
    setIsTampered(true);

    const routes = ["Đà Nẵng -> Nha Trang", "Hà Nội -> Sài Gòn", "Lào Cai -> Hà Nội"];
    const hackedRoute = routes[Math.floor(Math.random() * routes.length)] + " (HACKED)";
    const hackedSeats = "10 ghế (HACKED)";

    setBookingData((prev) => ({
      ...prev,
      route: hackedRoute,
      seats: hackedSeats
    }));

    // Compute mismatched hash
    const tamperedPayload = {
      ...bookingData,
      route: hackedRoute,
      seats: hackedSeats
    };
    const newComputedHash = generateMockHash(tamperedPayload);

    setLedgerLogs((prev) => ({
      ...prev,
      computedHash: newComputedHash,
      computedHashColor: "var(--error-red)"
    }));

    setSubtitles({
      speaker: "CẢNH BÁO HỆ THỐNG",
      text: "Cảnh báo bảo mật: Phát hiện sai lệch dữ liệu hành trình trên hệ thống đối soát!"
    });

    alert(
      "Cảnh báo bảo mật hệ thống: Phát hiện hành vi can thiệp trái phép vào cơ sở dữ liệu vé xe (thay đổi lộ trình/số ghế). Lớp đối soát chữ ký số (Solana Ledger Proof) phát hiện sự sai lệch với mã băm đã ký lúc thanh toán cọc. Trạng thái vé lập tức bị vô hiệu hóa để bảo vệ an toàn giao dịch!"
    );
  };

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
    tamperAgreement
  };
}
