import { CheckCircle2, ClipboardList, Route, Sparkles, TrendingUp } from "lucide-react";

function Step({ icon: Icon, title, children }) {
  return (
    <section className="decision-step">
      <div className="step-title">
        <Icon size={17} />
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function RevenueTwinDecision({ model, accepting = false, onAcceptOffer, lang = "vi" }) {
  const decision = model.decision;
  const booking = model.booking;
  const fields = [
    [lang === "vi" ? "Lộ trình" : "Route", booking.route],
    [lang === "vi" ? "Giờ khách muốn" : "Preferred time", booking.requestedTime],
    [lang === "vi" ? "Số khách đi" : "Passenger count", booking.passengerCount],
    [lang === "vi" ? "Điểm đón/trả" : "Pickup point", booking.pickupPoint],
    [lang === "vi" ? "Cổng thanh toán" : "Payment gate", booking.paymentGate === "UNLOCKED" ? (lang === "vi" ? "MỞ KHÓA" : "UNLOCKED") : (lang === "vi" ? "ĐANG KHÓA" : "LOCKED")]
  ];

  const formatChip = (chip) => {
    if (lang === "vi") {
      return String(chip).replace("Gia", "Giá").replace("Giam", "Giảm").replace("ghe", "ghế");
    }
    return String(chip)
      .replace("Gia", "Price")
      .replace("Giam", "Save")
      .replace("ghe", "seats")
      .replace("ghế", "seats");
  };

  const getOptionStatusText = (status) => {
    if (lang === "vi") {
      return status === "DA CHOT" ? "ĐÃ CHỐT" : status === "DE XUAT" ? "ĐỀ XUẤT" : status === "CAN KIEM TRA" ? "CẦN KIỂM TRA" : status;
    }
    return status === "DA CHOT" ? "CONFIRMED" : status === "DE XUAT" ? "OPTIMIZED" : status === "CAN KIEM TRA" ? "REVIEW" : status;
  };

  const accentClass = booking.paymentGate === "UNLOCKED" ? "accent-green" : "accent-purple";

  return (
    <section className="fleet-card decision-card" aria-labelledby="revenue-twin-decision">
      <div className={`fleet-card-header ${accentClass}`}>
        <div>
          <p className="fleet-eyebrow">{lang === "vi" ? "Công cụ ra quyết định" : "Decision Tool"}</p>
          <h2 id="revenue-twin-decision">{lang === "vi" ? "Đề xuất chốt giá AI Revenue Twin" : "AI Revenue Twin Offer Optimizer"}</h2>
        </div>
        <span className="fleet-badge fleet-badge-green">
          {decision.badge === "Live Decisioning"
            ? (lang === "vi" ? "Đề xuất trực tiếp" : "Live Decisioning")
            : (lang === "vi" ? "Chờ đánh giá" : "Awaiting evaluation")}
        </span>
      </div>

      <div className="decision-body">
        <Step icon={ClipboardList} title={lang === "vi" ? "Yêu cầu của khách hàng" : "Customer Request Details"}>
          <dl className="field-grid">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Step>

        <Step icon={Route} title={lang === "vi" ? "Phân tích & Lựa chọn chuyến tối ưu" : "Optimal Route Analysis"}>
          <div className="analysis-grid">
            <div className="mini-panel">
              <h4>{lang === "vi" ? "Lý do đề xuất" : "Recommendation rationale"}</h4>
              <ul>
                {decision.reasons.map((reason) => {
                  let translatedReason = String(reason);
                  if (lang === "vi") {
                    translatedReason = translatedReason
                      .replace("Trang thai:", "Trạng thái:")
                      .replace("Chua co danh gia Revenue Twin", "Chưa có đánh giá Revenue Twin")
                      .replace("Backend chua tra ve offer", "Máy chủ chưa trả về đề xuất")
                      .replace("Khong dung du lieu suc chua tu trinh duyet", "Không dùng dữ liệu sức chứa từ trình duyệt")
                      .replace("Chap nhan se tai kiem tra ton kho tren server", "Đồng ý đề xuất sẽ tự động đặt chỗ trên máy chủ")
                      .replace("do backend xep hang", "do máy chủ xếp hạng")
                      .replace("tai thoi diem danh gia", "tại thời điểm đánh giá")
                      .replace("ghe", "ghế");
                  } else {
                    translatedReason = translatedReason
                      .replace("Trang thai:", "Status:")
                      .replace("Chua co danh gia Revenue Twin", "No Revenue Twin evaluation yet")
                      .replace("Backend chua tra ve offer", "Server hasn't returned offer")
                      .replace("Khong dung du lieu suc chua tu trinh duyet", "Not using browser capacity data")
                      .replace("Chap nhan se tai kiem tra ton kho tren server", "Accepting will revalidate inventory on-chain")
                      .replace("do backend xep hang", "ranked by backend")
                      .replace("tai thoi diem danh gia", "at evaluation time")
                      .replace("ghe", "seats");
                  }
                  return <li key={reason}>{translatedReason}</li>;
                })}
              </ul>
            </div>
            <div className="mini-panel">
              <h4>{lang === "vi" ? "So sánh các lựa chọn" : "Option comparisons"}</h4>
              <div className="option-list">
                {decision.options.length === 0 && (
                  <div>
                    <strong>-</strong>
                    <span>{lang === "vi" ? "Chưa có đề xuất nào được lưu" : "No recommendations saved yet"}</span>
                    <em>{lang === "vi" ? "CHỜ" : "WAIT"}</em>
                  </div>
                )}
                {decision.options.map((option) => (
                  <div key={option.key} className={option.recommended ? "recommended-option" : ""}>
                    <strong>{option.time}</strong>
                    <span>{String(option.seats).replace(/ghe|ghế/g, lang === "vi" ? "ghế" : "seats")}</span>
                    <em>{getOptionStatusText(option.status)}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Step>

        <Step icon={Sparkles} title={lang === "vi" ? "Đề xuất & Hành động" : "Recommendation & Actions"}>
          <div className="recommendation-panel">
            <div className="recommendation-details">
              <div>
                <span>{lang === "vi" ? "Đề xuất chính" : "Primary offer"}</span>
                <strong>
                  {decision.recommendation
                    .replace("De xuat:", lang === "vi" ? "Đề xuất:" : "Offer:")
                    .replace("Chua co de xuat", lang === "vi" ? "Chưa có đề xuất" : "No offer available")}
                </strong>
              </div>
              <div className="offer-chips">
                {decision.chips.map((chip, index) => (
                  <span key={`${chip}-${index}`}>{formatChip(chip)}</span>
                ))}
              </div>
            </div>
            <button type="button" disabled={!decision.canAccept || accepting} onClick={onAcceptOffer}>
              <TrendingUp size={17} />
              {accepting ? (lang === "vi" ? "Đang chốt..." : "Confirming...") : (lang === "vi" ? "Chốt đề xuất" : "Confirm offer")}
            </button>
          </div>
        </Step>

        <Step icon={CheckCircle2} title={lang === "vi" ? "Kết quả xác nhận từ hệ thống" : "System Confirmation Results"}>
          <div className="confirmation-list">
            {decision.confirmations.map((item) => {
              const CONFIRMATION_LABELS = lang === "vi" ? {
                "Offer persisted": "Đã lưu đề xuất chuyến",
                "Inventory revalidated": "Đã kiểm kho tồn xe",
                "Hold created": "Đã giữ chỗ thành công",
                "Booking saved": "Đã lưu thông tin vé tạm"
              } : {
                "Offer persisted": "Offer persisted on-chain",
                "Inventory revalidated": "Inventory hold revalidated",
                "Hold created": "Booking hold created",
                "Booking saved": "Temporary ticket saved"
              };
              return (
                <div key={item.label} className={item.done ? "" : "confirmation-pending"}>
                  <CheckCircle2 size={16} />
                  <span>{CONFIRMATION_LABELS[item.label] || item.label}</span>
                </div>
              );
            })}
          </div>
        </Step>
      </div>
    </section>
  );
}
