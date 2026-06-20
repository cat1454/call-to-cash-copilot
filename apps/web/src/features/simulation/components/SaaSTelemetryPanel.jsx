import { useState } from "react";
import { Volume2, Activity, BarChart3, Database, FileJson } from "lucide-react";

export default function SaaSTelemetryPanel({
  performance,
  brainMode,
  showPrefetch,
  prefetchContent,
  scores,
  bookingData,
  ledgerLogs
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <div className="right-sidebar panel">
      <div className="panel-header">
        <h2>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--success-green)" }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Trình Quản Trị Hệ Thống (SaaS Telemetry)
        </h2>
        <div className="sim-status-label" style={{ color: "var(--success-green)" }}>Phân tích hệ thống</div>
      </div>

      {/* Agora performance metrics */}
      <div className="decision-panel">
        <div className="decision-header" style={{ color: "var(--accent-cyan)", borderBottomColor: "rgba(6, 182, 212, 0.1)", display: "flex", alignItems: "center", gap: "6px" }}>
          <Volume2 size={13} />
          <span>Luồng thoại Agora RT-Voice</span>
        </div>
        
        <div className="performance-grid">
          <div className="metric-card">
            <span className="metric-label">Thời gian phản hồi AI (TTFR)</span>
            <span className="metric-value">{performance.ttfr}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Độ trễ đối đáp (Turn Gap)</span>
            <span className="metric-value">{performance.turngap}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Số lần hỏi lại</span>
            <span className="metric-value">{performance.clarify}</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Mức giảm thiểu rủi ro</span>
            <span className="metric-value">{performance.reduction}</span>
          </div>
        </div>
        
        <div className="brain-mode-row" style={{ marginTop: "4px" }}>
          <span className="metric-label" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Activity size={12} />
            <span>Brain Mode</span>
          </span>
          <div className={`brain-mode-badge ${brainMode}`}>
            {brainMode === "fast" ? "Fast Path" : brainMode === "slow" ? "Slow Path" : "Human Path"}
          </div>
        </div>

        {/* Prefetch Context Widget */}
        <div className={`prefetch-card ${showPrefetch ? "active" : ""}`} style={{ marginTop: "6px" }}>
          <div className="prefetch-header">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            Dữ liệu tải trước (Predictive Prefetch)
          </div>
          <div className="prefetch-content">{prefetchContent}</div>
        </div>
      </div>

      {/* Detailed risk score metrics */}
      <div className="decision-panel">
        <div className="decision-header" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <BarChart3 size={13} style={{ color: "var(--primary-blue)" }} />
          <span>Phân Tích Chỉ Số Rủi Ro Giao Dịch</span>
        </div>
        <div className="gauges-container">
          <div className="gauge-row completeness">
            <div className="gauge-meta"><span className="gauge-label">Mức độ hoàn thành thông tin</span><span className="gauge-value">{scores.completeness}%</span></div>
            <div className="gauge-bar-bg"><div className="gauge-bar-fill" style={{ width: `${scores.completeness}%` }}></div></div>
          </div>
          <div className="gauge-row dispute-risk">
            <div className="gauge-meta"><span className="gauge-label">Nguy cơ khiếu nại (Dispute Risk)</span><span className="gauge-value">{scores.dispute}%</span></div>
            <div className="gauge-bar-bg">
              <div
                className={`gauge-bar-fill ${scores.dispute <= 35 ? "low-risk" : scores.dispute <= 65 ? "medium-risk" : "high-risk"}`}
                style={{ width: `${scores.dispute}%` }}
              ></div>
            </div>
          </div>
          <div className="gauge-row payment-readiness">
            <div className="gauge-meta"><span className="gauge-label">Độ sẵn sàng đặt cọc</span><span className="gauge-value">{scores.readiness}%</span></div>
            <div className="gauge-bar-bg"><div className="gauge-bar-fill" style={{ width: `${scores.readiness}%` }}></div></div>
          </div>
        </div>
      </div>

      {/* Off-chain Database Data Capture block */}
      <div className="decision-panel">
        <div className="decision-header" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Database size={13} />
          <span>Nhật Ký Lưu Trữ Hội Thoại (Off-chain DB)</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
          <div>• <b>Lịch sử thoại:</b> Chứa văn bản ghi nhận từ Agora.</div>
          <div>• <b>Turns History JSON:</b> Cấu trúc hội thoại và trạng thái.</div>
          <div>• <b>Hiệu năng thoại JSON:</b> TTFR, Turn Gap, và các chỉ số đo lường.</div>
          <div>• <b>Ẩn danh thông tin (PII Masking):</b> SĐT ẩn: <code>{bookingData.phone ? `${bookingData.phone.substring(0, 4)}***${bookingData.phone.substring(7)}` : "N/A"}</code>.</div>
        </div>
        
        {/* Raw JSON Extracted Entity block */}
        <div className="collapsible-header" onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <FileJson size={11} />
            <span>{showTechnicalDetails ? "Ẩn" : "Hiện"} dữ liệu trích xuất JSON raw</span>
          </span>
          <span>{showTechnicalDetails ? "▲" : "▼"}</span>
        </div>
        {showTechnicalDetails && (
          <pre style={{ background: "#f3f4f6", padding: "8px", borderRadius: "8px", fontSize: "9px", fontFamily: "monospace", overflowX: "auto" }}>
            {JSON.stringify({
              call_id: "CALL-2026-001",
              intent: "book_bus_ticket",
              route_from: bookingData.route?.split("->")[0]?.trim() || "",
              route_to: bookingData.route?.split("->")[1]?.trim() || "",
              departure_time: bookingData.time,
              passenger_count: bookingData.seats,
              phone_masked: bookingData.phone ? `${bookingData.phone.substring(0, 4)}***${bookingData.phone.substring(7)}` : "",
              total_amount: bookingData.price,
              deposit_amount: bookingData.deposit,
              tx_signature: ledgerLogs.txSig !== "0x..." ? ledgerLogs.txSig : "",
              proof_hash: ledgerLogs.anchoredHash !== "-" ? ledgerLogs.anchoredHash : ""
            }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
