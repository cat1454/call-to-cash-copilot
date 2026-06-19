import { Mic, RotateCcw } from "lucide-react";

export default function VoiceSimulatorPanel({
  simStatus,
  transcript,
  startSimulation,
  resetSimulation,
  isSimulating,
  readinessScore
}) {
  const getSimStatusLabel = (status) => {
    const mapping = {
      "Sẵn sàng": "🟢 Sẵn sàng đàm thoại",
      "Cuộc gọi đang trực tiếp": "🔴 Đàm thoại đang diễn ra...",
      "Chờ thanh toán cọc": "⏳ Chờ đặt cọc giữ chỗ",
      "Đang cọc (Solana Pay)...": "💸 Đang xử lý giao dịch cọc...",
      "Đã hoàn thành": "✅ Đàm thoại hoàn tất"
    };
    return mapping[status] || status;
  };

  return (
    <div className="console-panel panel">
      <div className="panel-header">
        <h2>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary-blue)" }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          Bảng Thử Nghiệm Cuộc Gọi (Voice Agent Simulator)
        </h2>
        <div className="sim-status-label">{getSimStatusLabel(simStatus)}</div>
      </div>

      {/* Transcript bubbles */}
      <div className="transcript-area">
        {transcript.map((bubble, idx) => (
          <div key={idx} className={`speech-bubble ${bubble.sender} ${bubble.isTyping ? "typing" : ""}`}>
            <div className="bubble-sender">
              {bubble.sender === "ai" ? "Tổng đài viên AI" : "Hành khách"}
            </div>
            {bubble.isTyping ? (
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              bubble.text
            )}
          </div>
        ))}
      </div>

      {/* Microphone button inside dashboard */}
      <div className="mic-button-container">
        <button
          className="mic-button"
          onClick={startSimulation}
          disabled={isSimulating || simStatus === "Đã hoàn thành"}
        >
          {isSimulating && <span className="mic-pulse-ring"></span>}
          <Mic size={24} />
        </button>
        <span className="mic-label-text">
          {isSimulating
            ? "Đang ghi âm..."
            : simStatus === "Đã hoàn thành"
            ? "Cuộc gọi kết thúc"
            : "Bấm để bắt đầu đàm thoại"}
        </span>
      </div>

      {/* Call-to-Cash Readiness Progress Bar */}
      <div className="gauge-row completeness">
        <div className="gauge-meta">
          <span className="gauge-label" style={{ color: "var(--primary-blue)", fontWeight: 700 }}>
            Độ Sẵn Sàng Thanh Toán (Call-to-Cash)
          </span>
          <span className="gauge-value" style={{ color: "var(--primary-blue)", fontWeight: 700 }}>
            {readinessScore}/100
          </span>
        </div>
        <div className="gauge-bar-bg" style={{ height: "8px" }}>
          <div
            className="gauge-bar-fill"
            style={{ width: `${readinessScore}%` }}
          ></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button className="btn-secondary" style={{ flex: 1, display: "flex", gap: "6px" }} onClick={resetSimulation}>
          <RotateCcw size={12} />
          <span>Đặt lại cuộc gọi</span>
        </button>
      </div>
    </div>
  );
}
