import ScenarioSelector from "../features/simulation/components/ScenarioSelector";
import VoiceSimulatorPanel from "../features/simulation/components/VoiceSimulatorPanel";
import AIDecisionPanel from "../features/simulation/components/AIDecisionPanel";
import SaaSTelemetryPanel from "../features/simulation/components/SaaSTelemetryPanel";
import SolanaLedgerCard from "../features/payment/components/SolanaLedgerCard";
import DecisionTimeline from "../features/simulation/components/DecisionTimeline";

export default function DesktopConsole({
  currentScenarioIdx,
  selectScenario,
  transcript,
  simStatus,
  isSimulating,
  startSimulation,
  resetSimulation,
  scores,
  performance,
  brainMode,
  prefetchContent,
  showPrefetch,
  ledgerLogs,
  tamperAgreement,
  timelineSteps,
  bookingData,
  isTampered
}) {
  // Computes the single Call-to-Cash Readiness score for the progress bar based on simulation states
  const getReadinessScore = () => {
    if (simStatus === "Sẵn sàng") return 0;
    if (ledgerLogs.show) return 98;
    if (simStatus === "Chờ thanh toán cọc" || simStatus === "Đang cọc (Solana Pay)...") return 94;
    
    if (scores.completeness >= 85) return 88;
    if (bookingData.phone) return 76;
    if (bookingData.seats) return 58;
    return 20;
  };

  const readinessScore = getReadinessScore();

  // Dynamic AI Decision values based on conversation step updates
  const getAIDecision = () => {
    if (simStatus === "Sẵn sàng") {
      return {
        understood: "Chưa bắt đầu cuộc đàm thoại.",
        missing: "Yêu cầu đầy đủ: lộ trình, giờ chạy, số lượng hành khách, SĐT liên hệ, xác nhận cọc.",
        risk: "N/A",
        gate: "ĐÃ KHÓA / CHƯA ĐỦ ĐIỀU KIỆN",
        next: "Bấm nút micro để tiếp nhận kết nối cuộc gọi."
      };
    }
    
    if (ledgerLogs.show) {
      return {
        understood: `${bookingData.route || "Sa Pa"}, ${bookingData.time}, ${bookingData.seats}, SĐT: ${bookingData.phone || "0912***678"}`,
        missing: "Không. Giao dịch đã hoàn tất thành công.",
        risk: isTampered ? "NGUY HIỂM (SAI KHỚP HASH)" : "AN TOÀN / THẤP",
        gate: "ĐÃ XÁC THỰC / KHÓA",
        next: isTampered ? "⚠ Từ chối vé xe. Yêu cầu bộ phận an ninh can thiệp và kiểm tra thủ công." : "Cấp biên nhận xác minh. Chúc khách hàng thượng lộ bình an!"
      };
    }

    if (simStatus === "Chờ thanh toán cọc" || simStatus === "Đang cọc (Solana Pay)...") {
      return {
        understood: `${bookingData.route || "Hà Nội -> Sa Pa"}, ${bookingData.time}, ${bookingData.seats}, SĐT: ${bookingData.phone || "0912***678"}`,
        missing: "Không. Đang đợi hành khách quét mã chuyển tiền cọc.",
        risk: "AN TOÀN / THẤP",
        gate: "ĐÃ MỞ / SẴN SÀNG",
        next: "Đang kiểm tra xác thực mạng lưới Solana & neo băm thỏa thuận đặt vé."
      };
    }

    let understood = [];
    if (bookingData.route) understood.push(`Tuyến: ${bookingData.route}`);
    if (bookingData.time) understood.push(`Giờ: ${bookingData.time}`);
    if (bookingData.seats) understood.push(`Khách: ${bookingData.seats}`);
    if (bookingData.phone) understood.push(`SĐT: ${bookingData.phone}`);

    let missing = [];
    if (!bookingData.route) missing.push("lộ trình");
    if (!bookingData.time) missing.push("giờ chạy");
    if (!bookingData.seats) missing.push("số khách");
    if (!bookingData.phone) missing.push("số điện thoại");

    let next;
    if (missing.length > 0) {
      const transMissing = {
        "lộ trình": "lộ trình hành trình",
        "giờ chạy": "khung giờ khởi hành",
        "số khách": "số lượng hành khách đi cùng",
        "số điện thoại": "số điện thoại liên hệ"
      };
      next = `Đặt câu hỏi để lấy thông tin về ${transMissing[missing[0]] || missing[0]}.`;
    } else {
      next = "Đọc to điều khoản cọc bảo lưu và yêu cầu khách hàng xác nhận sự đồng ý.";
    }

    return {
      understood: understood.join(", ") || "Đang nhận diện giọng nói...",
      missing: missing.join(", ") || "Thông tin đã đủ. Cần khách xác nhận đồng ý đặt cọc.",
      risk: scores.dispute > 50 ? "TRUNG BÌNH / CAO" : "AN TOÀN / THẤP",
      gate: scores.completeness >= 85 && scores.readiness >= 80 && scores.dispute <= 35 ? "ĐÃ MỞ / SẴN SÀNG" : "ĐÃ KHÓA / CHƯA ĐỦ ĐIỀU KIỆN",
      next: next
    };
  };

  const decision = getAIDecision();

  return (
    <div className="desktop-console-container">
      {/* SCENARIOS SELECTION */}
      <ScenarioSelector
        currentScenarioIdx={currentScenarioIdx}
        selectScenario={selectScenario}
      />

      {/* DASHBOARD GRID */}
      <div className="desktop-middle-grid">
        {/* MIDDLE COLUMN: Guided Voice Demo */}
        <VoiceSimulatorPanel
          simStatus={simStatus}
          transcript={transcript}
          startSimulation={startSimulation}
          resetSimulation={resetSimulation}
          isSimulating={isSimulating}
          readinessScore={readinessScore}
        />

        {/* RIGHT COLUMN: Mentor Console & Telemetry */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <SaaSTelemetryPanel
            performance={performance}
            brainMode={brainMode}
            showPrefetch={showPrefetch}
            prefetchContent={prefetchContent}
            scores={scores}
            bookingData={bookingData}
            ledgerLogs={ledgerLogs}
          />

          <SolanaLedgerCard
            ledgerLogs={ledgerLogs}
            isTampered={isTampered}
            bookingData={bookingData}
            tamperAgreement={tamperAgreement}
          />
        </div>
      </div>

      {/* DECISION TIMELINE / JUDGE REPLAY */}
      <DecisionTimeline timelineSteps={timelineSteps} />
      
      {/* AI Guided Decision Panel underneath Voice panel */}
      <AIDecisionPanel decision={decision} scores={scores} />
    </div>
  );
}
