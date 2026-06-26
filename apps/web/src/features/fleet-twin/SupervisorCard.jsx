import { CheckCircle2, AlertTriangle, Lock, Unlock, Info } from "lucide-react";

export function SupervisorCard({ model, lang = "vi" }) {
  const booking = model.booking;
  const risk = model.risk;

  const isCompletenessPass = risk.completeness >= 85;
  const isReadinessPass = risk.readiness >= 80;
  const isDisputePass = risk.dispute <= 35;

  const isAllPass = isCompletenessPass && isReadinessPass && isDisputePass;
  const isGateUnlocked = booking.paymentGate === "UNLOCKED";

  // Use gate status for header accent color
  const accentClass = isGateUnlocked ? "accent-green" : (isAllPass ? "accent-purple" : "accent-red");

  return (
    <section className="fleet-card supervisor-card" aria-labelledby="ai-supervisor">
      <div className={`fleet-card-header compact ${accentClass}`}>
        <div>
          <p className="fleet-eyebrow">{lang === "vi" ? "Giám sát AI" : "AI Supervision"}</p>
          <h2 id="ai-supervisor">{lang === "vi" ? "Trợ Lý Giám Sát Rủi Ro AI" : "AI Risk Analytics & Supervision"}</h2>
        </div>
        <span className={`fleet-badge ${isGateUnlocked ? "fleet-badge-green" : "fleet-badge-red"}`}>
          {isGateUnlocked 
            ? (lang === "vi" ? "Đủ điều kiện" : "Eligible") 
            : (lang === "vi" ? "Đang khóa" : "Locked")}
        </span>
      </div>

      <div className="telemetry-list">
        {/* Completeness */}
        <div className={`telemetry-item ${isCompletenessPass ? "pass" : "fail"}`}>
          <div className="telemetry-info">
            <span className="telemetry-label">
              {lang === "vi" ? "Độ hoàn chỉnh giao dịch" : "Transaction Completeness"}
            </span>
            <span className="telemetry-value">
              <strong>{risk.completeness}</strong>/100
              <span className="telemetry-threshold">
                {lang === "vi" ? "(Yêu cầu ≥ 85)" : "(Req ≥ 85)"}
              </span>
            </span>
          </div>
          <div className="telemetry-progress-row">
            <div className="telemetry-progress-track">
              <span className="telemetry-progress-fill" style={{ width: `${risk.completeness}%` }} />
            </div>
            {isCompletenessPass ? (
              <CheckCircle2 className="telemetry-status-icon pass" size={16} />
            ) : (
              <AlertTriangle className="telemetry-status-icon fail" size={16} />
            )}
          </div>
        </div>

        {/* Payment Readiness */}
        <div className={`telemetry-item ${isReadinessPass ? "pass" : "fail"}`}>
          <div className="telemetry-info">
            <span className="telemetry-label">
              {lang === "vi" ? "Độ sẵn sàng thanh toán" : "Payment Readiness"}
            </span>
            <span className="telemetry-value">
              <strong>{risk.readiness}</strong>/100
              <span className="telemetry-threshold">
                {lang === "vi" ? "(Yêu cầu ≥ 80)" : "(Req ≥ 80)"}
              </span>
            </span>
          </div>
          <div className="telemetry-progress-row">
            <div className="telemetry-progress-track">
              <span className="telemetry-progress-fill" style={{ width: `${risk.readiness}%` }} />
            </div>
            {isReadinessPass ? (
              <CheckCircle2 className="telemetry-status-icon pass" size={16} />
            ) : (
              <AlertTriangle className="telemetry-status-icon fail" size={16} />
            )}
          </div>
        </div>

        {/* Dispute Risk */}
        <div className={`telemetry-item ${isDisputePass ? "pass" : "fail"}`}>
          <div className="telemetry-info">
            <span className="telemetry-label">
              {lang === "vi" ? "Rủi ro tranh chấp" : "Dispute Risk"}
            </span>
            <span className="telemetry-value">
              <strong>{risk.dispute}</strong>/100
              <span className="telemetry-threshold">
                {lang === "vi" ? "(Yêu cầu ≤ 35)" : "(Req ≤ 35)"}
              </span>
            </span>
          </div>
          <div className="telemetry-progress-row">
            <div className="telemetry-progress-track">
              <span className="telemetry-progress-fill" style={{ width: `${risk.dispute}%` }} />
            </div>
            {isDisputePass ? (
              <CheckCircle2 className="telemetry-status-icon pass" size={16} />
            ) : (
              <AlertTriangle className="telemetry-status-icon fail" size={16} />
            )}
          </div>
        </div>
      </div>

      <div className="gate-status-panel">
        <div className={`gate-status-badge ${isGateUnlocked ? "unlocked" : "locked"}`}>
          {isGateUnlocked ? <Unlock size={18} /> : <Lock size={18} />}
          <div className="gate-status-details">
            <strong>
              {isGateUnlocked 
                ? (lang === "vi" ? "CỔNG THANH TOÁN: MỞ KHÓA" : "PAYMENT GATE: UNLOCKED") 
                : (lang === "vi" ? "CỔNG THANH TOÁN: ĐANG KHÓA" : "PAYMENT GATE: LOCKED")}
            </strong>
            <p>
              {isGateUnlocked
                ? (lang === "vi" ? "Khách hàng có thể quét mã Solana Pay để thanh toán đặt cọc." : "Customer can scan Solana Pay QR to secure the booking deposit.")
                : (lang === "vi" ? "Chưa đủ điều kiện an toàn giao dịch. Cổng cọc bị khóa." : "Transaction security criteria not met. Gate remains locked.")}
            </p>
          </div>
        </div>
      </div>

      <div className="supervisor-info-alert">
        <Info size={14} />
        <p>
          {lang === "vi"
            ? "Mọi chỉ số đều được phân tích trực tiếp từ hội thoại thời gian thực qua Risk Engine."
            : "All metrics are analyzed in real-time from the active voice conversation by the Risk Engine."}
        </p>
      </div>
    </section>
  );
}

