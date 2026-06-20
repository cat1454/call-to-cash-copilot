import { QrCode, Timer } from "lucide-react";

export default function PhonePaymentDrawer({
  showPaymentDrawer,
  bookingData,
  drawerTimerText,
  simulateWalletPayment,
  btnPhonePayDisabled,
  btnPhonePayBg,
  btnPhonePayText
}) {
  return (
    <div className={`phone-payment-drawer ${showPaymentDrawer ? "active" : ""}`}>
      <div className="drawer-drag-handle"></div>
      
      <div className="drawer-header" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        <QrCode size={14} style={{ color: "var(--primary-blue)" }} />
        <span>Cọc bằng <span>Solana Pay</span></span>
      </div>
      
      <div className="drawer-deposit-summary">
        <span style={{ color: "var(--text-muted)" }}>Tiền cọc:</span>
        <span className="drawer-deposit-amount">{bookingData.deposit}</span>
      </div>

      <div className="drawer-qr-section">
        <div className="drawer-qr-box">
          <div className="qr-scan-line"></div>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=115x115&data=solana:pubkey?amount=0.05%26label=CallToCash%26message=Booking_Deposit`}
            alt="Solana Pay QR"
          />
        </div>
        
        <div className="drawer-timer" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Timer size={12} />
          <span>{drawerTimerText}</span>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={simulateWalletPayment}
        disabled={btnPhonePayDisabled}
        style={{ background: btnPhonePayBg }}
      >
        {btnPhonePayText}
      </button>
      
      <p className="drawer-disclaimer">
        * Cọc được hoàn tự động 100% nếu bạn báo hủy xe trước giờ đi ít nhất 2 tiếng.
      </p>
    </div>
  );
}
