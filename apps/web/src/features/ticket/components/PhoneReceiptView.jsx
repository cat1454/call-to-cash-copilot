import { BadgeCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function PhoneReceiptView({
  showBoardingPass,
  isTampered,
  bookingData
}) {
  if (!showBoardingPass) {
    return (
      <div className="empty-receipt-view">
        <div className="empty-receipt-icon">🎟️</div>
        <p>Chưa có vé xe khách điện tử.</p>
        <p className="subtext">
          Vui lòng hoàn thành cuộc gọi đàm thoại và cọc tiền để nhận vé bảo mật.
        </p>
      </div>
    );
  }

  return (
    <div className="phone-view-content receipt-view-layout">
      <div className="phone-pass-container" style={{ position: "relative" }}>
        <div className="phone-boarding-pass">
          <div className="ticket-notch-left"></div>
          <div className="ticket-notch-right"></div>
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "8px" }}>
            <BadgeCheck size={16} style={{ color: isTampered ? "var(--error-red)" : "var(--success-green)" }} />
            <h4 style={{ margin: 0 }}>VÉ XE KHÁCH ĐIỆN TỬ (SECURE TICKET)</h4>
          </div>

          <div className="phone-boarding-row">
            <span className="lbl">Mã Booking:</span>
            <span className="val">{bookingData.bookingId}</span>
          </div>
          
          <div className="phone-boarding-row">
            <span className="lbl">Tuyến xe:</span>
            <span className="val" style={{ color: isTampered ? "var(--error-red)" : "" }}>
              {bookingData.route}
            </span>
          </div>
          
          <div className="phone-boarding-row">
            <span className="lbl">Khởi hành:</span>
            <span className="val">{bookingData.time}</span>
          </div>
          
          <div className="phone-boarding-row">
            <span className="lbl">Số ghế:</span>
            <span className="val" style={{ color: isTampered ? "var(--error-red)" : "" }}>
              {bookingData.seats}
            </span>
          </div>

          <div className="boarding-divider"></div>

          <div className="phone-boarding-row">
            <span className="lbl">Đã thanh toán:</span>
            <span className="val" style={{ color: "#065f46" }}>
              {bookingData.deposit}
            </span>
          </div>

          <div className="ticket-barcode-section">
            <svg className="ticket-barcode" width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
              <g fill="black">
                <rect x="5" y="0" width="2" height="40" />
                <rect x="9" y="0" width="1" height="40" />
                <rect x="12" y="0" width="3" height="40" />
                <rect x="17" y="0" width="1" height="40" />
                <rect x="20" y="0" width="2" height="40" />
                <rect x="24" y="0" width="4" height="40" />
                <rect x="30" y="0" width="1" height="40" />
                <rect x="33" y="0" width="2" height="40" />
                <rect x="37" y="0" width="3" height="40" />
                <rect x="42" y="0" width="1" height="40" />
                <rect x="45" y="0" width="2" height="40" />
                <rect x="49" y="0" width="4" height="40" />
                <rect x="55" y="0" width="1" height="40" />
                <rect x="58" y="0" width="3" height="40" />
                <rect x="63" y="0" width="2" height="40" />
                <rect x="67" y="0" width="1" height="40" />
                <rect x="70" y="0" width="4" height="40" />
                <rect x="76" y="0" width="2" height="40" />
                <rect x="80" y="0" width="1" height="40" />
                <rect x="83" y="0" width="3" height="40" />
                <rect x="88" y="0" width="2" height="40" />
                <rect x="92" y="0" width="1" height="40" />
                <rect x="95" y="0" width="2" height="40" />
              </g>
            </svg>
            <div className="barcode-number">{bookingData.bookingId}</div>
          </div>

          {isTampered ? (
            <div className="phone-boarding-status mismatch" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <AlertTriangle size={13} />
              <span>🚨 DỮ LIỆU BỊ THAY ĐỔI (SAI KHỚP HASH)</span>
            </div>
          ) : (
            <div className="phone-boarding-status verified" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <CheckCircle2 size={13} />
              <span>Vé Hợp Lệ & Đã Đối Soát</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
