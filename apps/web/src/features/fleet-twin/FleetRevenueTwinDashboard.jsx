import { ShieldCheck, Activity, Check, Mic } from "lucide-react";

import { RevenueTwinDecision } from "./RevenueTwinDecision";
import { RevenueTwinKpis } from "./RevenueTwinKpis";
import { LiveCallCard, Badge } from "./LiveCallCard";
import { SupervisorCard } from "./SupervisorCard";


export default function FleetRevenueTwinDashboard({
  model,
  phone,
  accepting = false,
  onAcceptOffer,
  onStartCall,
  onEndCall,
  lang = "vi"
}) {
  const getAuditLine = (line) => {
    if (lang === "vi") {
      if (line.includes("Server accepted offer")) {
        return "Máy chủ đã duyệt đề xuất, tái kiểm kho và trả về bằng chứng khóa cọc.";
      }
      if (line.includes("Waiting for committed")) {
        return "Đang chờ sự kiện đối soát Revenue Twin và khôi phục trạng thái REST...";
      }
    }
    return line;
  };

  return (
    <main className="fleet-twin-page" aria-label="Call-to-Cash Fleet Revenue Twin dashboard">
      <header className="fleet-hero" aria-label="Hero section">
        {/* Animated background orbs */}
        <span className="hero-orb hero-orb-1" aria-hidden="true" />
        <span className="hero-orb hero-orb-2" aria-hidden="true" />
        <span className="hero-orb hero-orb-3" aria-hidden="true" />

        <div className="hero-inner">
          {/* Left: Brand + headline */}
          <div className="hero-brand">
            {/* Logo pill + badges */}
            <div className="hero-logo-row">
              <div className="hero-logo-pill">
                <span className="hero-logo-dot" aria-hidden="true" />
                <span className="hero-logo-text">Call to Cash</span>
              </div>
              <div className="hero-badges">
                <Badge><Activity size={11} style={{ marginRight: "5px" }} />{lang === "vi" ? "Thoại trực tiếp Agora" : "Agora Live Voice"}</Badge>
              </div>
            </div>

            {/* Powered-by partner logos */}
            <div className="hero-partners">
              <span className="hero-partners-label">Powered by</span>
              {/* Agora logo */}
              <div className="hero-partner-chip" title="Agora">
                <img className="hero-partner-img" src="/agora-logo.svg" alt="Agora Logo" />
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a" }}>Agora</span>
              </div>
              <span className="hero-partners-sep">×</span>
              {/* Solana logo */}
              <div className="hero-partner-chip" title="Solana">
                <img className="hero-partner-img" src="/solana-logo.png" alt="Solana Logo" />
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a" }}>Solana</span>
              </div>
            </div>

            <h1 className="hero-headline">
              {lang === "vi" ? (
                <>Chốt đơn đặt vé<br />
                  <span className="hero-highlight">trước khi</span> họ cúp máy.
                </>
              ) : (
                <>Turn booking calls<br />
                  <span className="hero-highlight">into</span> verified deposits.
                </>
              )}
            </h1>

            <p className="hero-tagline">
              {lang === "vi"
                ? "Giám sát rủi ro hội thoại thời gian thực · Đối soát tự động · Neo băm cọc trên Solana"
                : "Real-time conversational risk scoring · Auto reconciliation · On-chain deposit anchoring"}
            </p>

            <div className="hero-actions">
              <button className="hero-cta-btn" onClick={onStartCall} type="button">
                <Mic size={14} />
                {lang === "vi" ? "Bắt đầu gọi thử nghiệm" : "Start Simulation Call"}
              </button>
            </div>
          </div>

          {/* Right: Live Product Demo (high-contrast dark area) */}
          <div className="hero-demo-panel">
            <div className="demo-panel-header">
              <span className="demo-pulse-dot" />
              <h3>{lang === "vi" ? "TRẠNG THÁI GIAO DỊCH TRỰC TIẾP" : "LIVE PIPELINE DEMO"}</h3>
            </div>
            <div className="demo-steps">
              <div className={`demo-step ${model.connection.connected ? 'active' : ''}`}>
                <span className="step-num">1</span>
                <div>
                  <strong>Agora Voice</strong>
                  <span>{model.connection.statusText || (lang === "vi" ? "Chưa kết nối" : "Disconnected")}</span>
                </div>
              </div>
              <div className={`demo-step ${model.connection.connected && model.risk.completeness > 0 ? 'active' : ''}`}>
                <span className="step-num">2</span>
                <div>
                  <strong>Risk Analytics</strong>
                  <span>{lang === "vi" ? `Hoàn chỉnh: ${model.risk.completeness}%` : `Completeness: ${model.risk.completeness}%`}</span>
                </div>
              </div>
              <div className={`demo-step ${model.booking.paymentGate === "UNLOCKED" ? 'active success' : ''}`}>
                <span className="step-num">3</span>
                <div>
                  <strong>Solana Pay</strong>
                  <span>{model.booking.paymentGate === "UNLOCKED" ? (lang === "vi" ? "Đã mở khóa cọc" : "Deposit Unlocked") : (lang === "vi" ? "Chờ mở khóa" : "Locked")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Technical strip below hero */}
      <section className="technical-strip" aria-label="Technical specifications">
        <div className="technical-card">
          <div className="tech-card-left">
            <span className="tech-card-dot tech-card-dot-green" />
            <div>
              <h3>{lang === "vi" ? "Độ hoàn chỉnh" : "Completeness"}</h3>
              <p>{lang === "vi" ? "Ngưỡng an toàn ≥ 85" : "Safe threshold ≥ 85"}</p>
            </div>
          </div>
          <strong className="tech-card-value">{model.risk.completeness}/100</strong>
        </div>

        <div className="technical-card">
          <div className="tech-card-left">
            <span className="tech-card-dot tech-card-dot-amber" />
            <div>
              <h3>{lang === "vi" ? "Cổng thanh toán" : "Payment Gate"}</h3>
              <p>{lang === "vi" ? "Mở khóa khi sẵn sàng" : "Unlocked when ready"}</p>
            </div>
          </div>
          <strong className="tech-card-value">
            {model.booking.paymentGate === "UNLOCKED" ? "UNLOCKED" : "LOCKED"}
          </strong>
        </div>

        <div className="technical-card">
          <div className="tech-card-left">
            <span className="tech-card-dot tech-card-dot-purple" />
            <div>
              <h3>Solana Devnet</h3>
              <p>{lang === "vi" ? "Băm cọc an toàn on-chain" : "On-chain secure anchoring"}</p>
            </div>
          </div>
          <strong className="tech-card-value">ACTIVE</strong>
        </div>
      </section>

      <div className="fleet-dashboard-grid">
        <aside className="left-column">
          <LiveCallCard model={model} onStartCall={onStartCall} onEndCall={onEndCall} lang={lang} />
          <SupervisorCard model={model} lang={lang} />
          <RevenueTwinKpis model={model} lang={lang} />
        </aside>

        <section className="phone-anchor" aria-label="Customer mobile app preview">
          {phone}
        </section>

        <aside className="right-column">
          <RevenueTwinDecision model={model} accepting={accepting} onAcceptOffer={onAcceptOffer} lang={lang} />
        </aside>
      </div>

      <section className="audit-log-card" aria-labelledby="audit-log">
        <div>
          <p className="fleet-eyebrow">{lang === "vi" ? "Kiểm toán hệ thống" : "System audit"}</p>
          <h2 id="audit-log">{lang === "vi" ? "Nhật ký kỹ thuật & Đối soát" : "Technical Log & Reconciler"}</h2>
        </div>
        <div className="audit-log-line">
          <ShieldCheck size={16} />
          <span>{getAuditLine(model.audit.line)}</span>
        </div>
        <button type="button">{lang === "vi" ? "Thu gọn" : "Collapse"}</button>
      </section>
    </main>
  );
}
