import { MapPin, Users, Phone, Lock, Unlock, Info } from "lucide-react";

export function SupervisorCard({ model, lang = "vi" }) {
  const booking = model.booking;
  const risk = model.risk;

  const isSafe = risk.status === "An toan" || risk.status === "An toàn";
  const accentClass = isSafe ? "accent-green" : "accent-red";

  return (
    <section className="fleet-card supervisor-card" aria-labelledby="ai-supervisor">
      <div className={`fleet-card-header compact ${accentClass}`}>
        <div>
          <p className="fleet-eyebrow">{lang === "vi" ? "Giám sát AI" : "AI Supervision"}</p>
          <h2 id="ai-supervisor">{lang === "vi" ? "Trợ Lý Giám Sát Giao Dịch AI" : "AI Transaction Supervisor Assistant"}</h2>
        </div>
      </div>
      <dl className="recognized-grid">
        <div>
          <dt><MapPin size={12} /> {lang === "vi" ? "Lộ trình" : "Route"}</dt>
          <dd>{booking.route}</dd>
        </div>
        <div>
          <dt><Users size={12} /> {lang === "vi" ? "Nhóm khách" : "Passenger count"}</dt>
          <dd>{booking.passengerCount}</dd>
        </div>
        <div>
          <dt><Phone size={12} /> {lang === "vi" ? "SĐT" : "Phone"}</dt>
          <dd>{booking.contactPhoneMasked}</dd>
        </div>
        <div>
          <dt>
            {booking.paymentGate === "UNLOCKED" ? <Unlock size={12} /> : <Lock size={12} />} {lang === "vi" ? "Cổng thanh toán" : "Payment gate"}
          </dt>
          <dd className={booking.paymentGate === "UNLOCKED" ? "gate-unlocked" : "gate-locked"}>
            {booking.paymentGate === "UNLOCKED" ? (lang === "vi" ? "MỞ KHÓA" : "UNLOCKED") : (lang === "vi" ? "ĐANG KHÓA" : "LOCKED")}
          </dd>
        </div>
      </dl>
      <div className="supervisor-info-alert">
        <Info size={14} />
        <p>
          {lang === "vi"
            ? "Dữ liệu đặt vé được đồng bộ trực tiếp từ server read models và evaluation state."
            : "Booking data is synced directly from server read models and evaluation state."}
        </p>
      </div>
      <div className="readiness-row">
        <div className={risk.status === "An toan" || risk.status === "An toàn" ? "status-safe" : "status-locked"}>
          <span>{lang === "vi" ? "Trạng thái rủi ro" : "Risk status"}</span>
          <strong>
            {risk.status === "An toan" || risk.status === "An toàn"
              ? (lang === "vi" ? "An toàn" : "Safe")
              : (risk.status === "Dang khoa" || risk.status === "Đang khóa"
              ? (lang === "vi" ? "Đang khóa" : "Locked")
              : risk.status)}
          </strong>
        </div>
        <div className="readiness-score-tile">
          <span>{lang === "vi" ? "Độ sẵn sàng thanh toán" : "Payment readiness"}</span>
          <strong>{risk.readiness}/100</strong>
        </div>
      </div>
      <div className="progress-track" aria-label="Payment readiness score">
        <span style={{ width: `${risk.readiness}%` }} />
      </div>
    </section>
  );
}
