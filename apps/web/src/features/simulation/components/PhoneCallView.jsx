import { Bus, PhoneCall } from "lucide-react";

export default function PhoneCallView({
  isWaveAnimating,
  phoneCallColor,
  phoneCallStatusText,
  subtitles,
  isMobileLayout,
  startSimulation,
  isSimulating,
  simStatus,
  bookingData
}) {
  return (
    <div className="phone-view-content call-view-layout">
      {/* Active Calling Screen Header */}
      <div className="phone-call-header">
        <div className="phone-avatar-glow" style={{ position: "relative" }}>
          {/* Rippling effects behind avatar when active calling */}
          {isWaveAnimating && (
            <>
              <div className="ripple-avatar-ring"></div>
              <div className="ripple-avatar-ring delay-1"></div>
              <div className="ripple-avatar-ring delay-2"></div>
            </>
          )}
          <div className="phone-avatar" style={{ zIndex: 5, color: "var(--primary-blue)", display: "flex" }}>
            <Bus size={24} />
          </div>
        </div>
        <div className="caller-name">Tổng đài xe khách Sa Pa</div>
        <div className="call-status" style={{ color: phoneCallColor }}>
          <span style={{ display: "inline-flex", alignItems: "center", marginRight: "4px" }}>
            <PhoneCall size={10} className={isWaveAnimating ? "animate-phone-ring" : ""} />
          </span>
          {phoneCallStatusText}
        </div>
      </div>

      {/* Voice Waves */}
      <div className="phone-wave-box">
        <div className={`sound-wave ${isWaveAnimating ? "animating" : ""}`}>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
          <span className="wave-bar"></span>
        </div>
      </div>

      {/* Live Subtitles Box */}
      <div className="phone-subtitles">
        <div
          className="subtitle-speaker"
          style={{
            color:
              subtitles.speaker === "Khách hàng"
                ? "var(--primary-blue)"
                : subtitles.speaker === "Hệ thống cọc"
                ? "var(--warning-amber)"
                : subtitles.speaker === "CẢNH BÁO HỆ THỐNG" || subtitles.speaker === "Hệ thống bảo mật"
                ? "var(--success-green)"
                : "var(--primary-blue)"
          }}
        >
          {subtitles.speaker}
        </div>
        <div className="subtitle-text" key={subtitles.text}>{subtitles.text}</div>
      </div>

      {/* Guided Microphone button inside Phone Screen (For Mobile Call Tab or general convenience) */}
      {isMobileLayout && (
        <div className="mic-button-container">
          <button
            className={`mic-button ${isSimulating ? "animating" : ""}`}
            onClick={startSimulation}
            disabled={isSimulating || simStatus === "Đã hoàn thành"}
          >
            {isSimulating && <span className="mic-pulse-ring"></span>}
            🎙️
          </button>
          <span className="mic-label-text">
            {isSimulating
              ? "Đang ghi âm..."
              : simStatus === "Đã hoàn thành"
              ? "Cuộc gọi kết thúc"
              : "Bấm để bắt đầu đàm thoại"}
          </span>
        </div>
      )}

      {/* Live Ticket Draft */}
      <div className="phone-ticket">
        <div className="phone-ticket-title">Thông Tin Hành Trình (Booking Summary)</div>
        <div className="phone-ticket-row">
          <span className="label">Hành trình:</span>
          <span className="val" style={{ color: bookingData.route ? "var(--primary-blue)" : "" }}>
            {bookingData.route || "-"}
          </span>
        </div>
        <div className="phone-ticket-row">
          <span className="label">Giờ đi:</span>
          <span className="val" style={{ color: bookingData.time ? "var(--primary-blue)" : "" }}>
            {bookingData.time || "-"}
          </span>
        </div>
        <div className="phone-ticket-row">
          <span className="label">Số ghế:</span>
          <span className="val" style={{ color: bookingData.seats ? "var(--primary-blue)" : "" }}>
            {bookingData.seats || "-"}
          </span>
        </div>
        <div className="phone-ticket-row">
          <span className="label">SĐT liên lạc:</span>
          <span className="val" style={{ color: bookingData.phone ? "var(--primary-blue)" : "" }}>
            {bookingData.phone || "-"}
          </span>
        </div>
        <div className="phone-ticket-row price-row">
          <span className="label">Tổng cộng:</span>
          <span className="val" style={{ color: bookingData.price ? "var(--primary-blue)" : "" }}>
            {bookingData.price || "-"}
          </span>
        </div>
        <div className="phone-ticket-row" style={{ color: "var(--primary-blue)" }}>
          <span className="label" style={{ color: "rgba(5, 150, 105, 0.7)" }}>Số tiền cọc:</span>
          <span className="val" style={{ color: bookingData.deposit ? "var(--primary-blue)" : "" }}>
            {bookingData.deposit || "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
