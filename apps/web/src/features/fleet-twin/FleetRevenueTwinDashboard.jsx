import { ShieldCheck, Activity, Check } from "lucide-react";

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
                <Badge><Activity size={11} style={{ marginRight: "5px" }} />{lang === "vi" ? "Thoại trực tiếp" : "Live voice"}</Badge>
                <Badge tone="slate"><Check size={11} style={{ marginRight: "5px" }} />{lang === "vi" ? "Đã xác thực" : "Verified"}</Badge>
                <Badge tone="amber"><ShieldCheck size={11} style={{ marginRight: "5px" }} />{lang === "vi" ? "Demo" : "Demo"}</Badge>
              </div>
            </div>

            {/* Powered-by partner logos */}
            <div className="hero-partners">
              <span className="hero-partners-label">Powered by</span>
              {/* Agora logo */}
              <div className="hero-partner-chip" title="Agora">
                <img className="hero-partner-img" src="/agora-logo.svg" alt="Agora Logo" />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>Agora</span>
              </div>
              <span className="hero-partners-sep">×</span>
              {/* Solana logo */}
              <div className="hero-partner-chip" title="Solana">
                <img className="hero-partner-img" src="/solana-logo.png" alt="Solana Logo" />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>Solana</span>
              </div>
            </div>

            <h1 className="hero-headline">
              {lang === "vi" ? (
                <>Chốt đơn đặt vé{" "}
                  <span className="hero-highlight">trước khi</span>{" "}
                  họ cúp máy.
                </>
              ) : (
                <>Turn booking call{" "}
                  <span className="hero-highlight">into</span>{" "}
                  verified deposits.
                </>
              )}
            </h1>

            <p className="hero-tagline">
              {lang === "vi"
                ? "Giám sát rủi ro hội thoại thời gian thực · Đối soát tự động · Neo băm cọc trên Solana"
                : "Real-time conversational risk scoring · Auto reconciliation · On-chain deposit anchoring"}
            </p>
          </div>

          {/* Right: metric cards */}
          <div className="hero-metrics">
            <div className="hero-metric-card">
              <span className="hero-metric-dot hero-metric-dot-green" aria-hidden="true" />
              <div>
                <strong>{lang === "vi" ? "Độ hoàn chỉnh" : "Completeness"}</strong>
                <span>{lang === "vi" ? "Ngưỡng an toàn ≥ 85" : "Safe threshold ≥ 85"}</span>
              </div>
            </div>
            <div className="hero-metric-card">
              <span className="hero-metric-dot hero-metric-dot-amber" aria-hidden="true" />
              <div>
                <strong>{lang === "vi" ? "Cổng thanh toán" : "Payment Gate"}</strong>
                <span>{lang === "vi" ? "Tự động mở khi đủ điều kiện" : "Auto-unlocked on ready"}</span>
              </div>
            </div>
            <div className="hero-metric-card">
              <span className="hero-metric-dot hero-metric-dot-purple" aria-hidden="true" />
              <div>
                <strong>Solana Devnet</strong>
                <span>{lang === "vi" ? "Băm cọc bất biến on-chain" : "Immutable deposit hash"}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

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
