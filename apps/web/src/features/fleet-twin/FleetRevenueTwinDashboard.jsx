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
                <span className="hero-logo-text">Call-to-Cash</span>
                <span className="hero-logo-sub">Risk Copilot</span>
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
                <svg height="18" viewBox="0 0 80 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Agora">
                  <circle cx="12" cy="12" r="10" fill="#00C2FF" opacity="0.15"/>
                  <circle cx="12" cy="12" r="6" fill="#00C2FF" opacity="0.4"/>
                  <circle cx="12" cy="12" r="3" fill="#00C2FF"/>
                  <text x="27" y="17" fontFamily="system-ui,sans-serif" fontWeight="700" fontSize="13" fill="white" letterSpacing="-0.3">Agora</text>
                </svg>
              </div>
              <span className="hero-partners-sep">×</span>
              {/* Solana logo */}
              <div className="hero-partner-chip" title="Solana">
                <svg height="18" viewBox="0 0 96 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Solana">
                  {/* Solana icon - 3 stacked parallelogram bars */}
                  <g transform="translate(0,2)">
                    <rect x="0" y="0" width="18" height="4" rx="1" fill="url(#sol-grad1)" transform="skewX(-10)"/>
                    <rect x="0" y="7" width="18" height="4" rx="1" fill="url(#sol-grad2)" transform="skewX(-10)"/>
                    <rect x="0" y="14" width="18" height="4" rx="1" fill="url(#sol-grad3)" transform="skewX(-10)"/>
                    <defs>
                      <linearGradient id="sol-grad1" x1="0" y1="0" x2="18" y2="0">
                        <stop offset="0%" stopColor="#9945FF"/>
                        <stop offset="100%" stopColor="#14F195"/>
                      </linearGradient>
                      <linearGradient id="sol-grad2" x1="0" y1="0" x2="18" y2="0">
                        <stop offset="0%" stopColor="#9945FF"/>
                        <stop offset="100%" stopColor="#14F195"/>
                      </linearGradient>
                      <linearGradient id="sol-grad3" x1="0" y1="0" x2="18" y2="0">
                        <stop offset="0%" stopColor="#9945FF"/>
                        <stop offset="100%" stopColor="#14F195"/>
                      </linearGradient>
                    </defs>
                  </g>
                  <text x="26" y="17" fontFamily="system-ui,sans-serif" fontWeight="700" fontSize="13" fill="white" letterSpacing="-0.3">Solana</text>
                </svg>
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
