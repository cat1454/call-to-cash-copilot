import { Sparkles, HelpCircle, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";

export default function AIDecisionPanel({
  decision
}) {
  return (
    <div className="decision-panel">
      <div className="decision-header">Trợ Lý Giám Sát Giao Dịch AI</div>
      
      <div className="decision-row understood">
        <span className="decision-label" style={{ display: "flex", alignItems: "center", gap: "4.5px" }}>
          <Sparkles size={11} style={{ color: "var(--primary-blue)" }} />
          <span>Thông tin hành trình đã nhận diện</span>
        </span>
        <span className="decision-val">{decision.understood}</span>
      </div>
      
      <div className="decision-row missing">
        <span className="decision-label" style={{ display: "flex", alignItems: "center", gap: "4.5px" }}>
          <HelpCircle size={11} style={{ color: "var(--warning-amber)" }} />
          <span>Chi tiết hành trình cần thu thập</span>
        </span>
        <span className="decision-val" style={{ color: decision.missing.includes("Không") ? "var(--success-green)" : "" }}>
          {decision.missing}
        </span>
      </div>
      
      <div className="decision-row risk">
        <span className="decision-label" style={{ display: "flex", alignItems: "center", gap: "4.5px" }}>
          <TrendingUp size={11} style={{ color: "var(--error-red)" }} />
          <span>Độ rủi ro đàm thoại</span>
        </span>
        <span className="decision-val" style={{ fontWeight: 700, color: decision.risk === "LOW" || decision.risk === "AN TOÀN / THẤP" ? "var(--success-green)" : decision.risk === "N/A" ? "" : "var(--error-red)" }}>
          {decision.risk}
        </span>
      </div>
      
      <div className="decision-row gate">
        <span className="decision-label" style={{ display: "flex", alignItems: "center", gap: "4.5px" }}>
          <ShieldCheck size={11} style={{ color: "var(--success-green)" }} />
          <span>Cổng thanh toán cọc</span>
        </span>
        <span className="decision-val" style={{ fontWeight: 800, color: decision.gate === "READY / UNLOCKED" || decision.gate === "ĐÃ MỞ / SẴN SÀNG" || decision.gate === "ĐÃ XÁC THỰC / KHÓA" || decision.gate === "Confirmed / Anchored" ? "var(--success-green)" : "var(--error-red)" }}>
          {decision.gate}
        </span>
      </div>
      
      <div className="decision-row next-action">
        <span className="decision-label" style={{ display: "flex", alignItems: "center", gap: "4.5px" }}>
          <ArrowRight size={11} style={{ color: "var(--accent-cyan)" }} />
          <span>Hành động gợi ý tiếp theo</span>
        </span>
        <span className="decision-val" style={{ fontStyle: "italic" }}>{decision.next}</span>
      </div>
    </div>
  );
}
