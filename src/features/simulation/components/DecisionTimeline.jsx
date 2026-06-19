export default function DecisionTimeline({
  timelineSteps
}) {
  const stepsData = [
    { step: 1, title: "Nhận diện giọng nói", desc: "Tiếp nhận và truyền tải âm thanh thực tế qua luồng Agora." },
    { step: 2, title: "Trích xuất thông tin", desc: "Nhận diện lộ trình, khung giờ, số chỗ và SĐT liên hệ." },
    { step: 3, title: "Đánh giá rủi ro", desc: "Phân tích nguy cơ hủy vé, rủi ro đàm thoại và hoàn tiền." },
    { step: 4, title: "Chốt điều khoản đặt vé", desc: "Tóm tắt thỏa thuận đặt cọc giữ chỗ và đọc to cho khách hàng." },
    { step: 5, title: "Mở cổng thanh toán", desc: "Khởi động cổng Solana Pay chuyển khoản và chờ chữ ký số." },
    { step: 6, title: "Neo băm & Cấp vé", desc: "Neo băm thỏa thuận giao dịch on-chain và phát hành vé điện tử." }
  ];

  return (
    <div className="panel timeline-panel">
      <div className="panel-header">
        <h2>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary-blue)" }}>
            <line x1="4" y1="9" x2="20" y2="9"></line>
            <line x1="4" y1="15" x2="20" y2="15"></line>
            <line x1="10" y1="3" x2="8" y2="21"></line>
            <line x1="16" y1="3" x2="14" y2="21"></line>
          </svg>
          Quy Trình Duyệt & Ra Quyết Định Giao Dịch
        </h2>
      </div>
      <div className="timeline-steps">
        {stepsData.map((item) => {
          let className = "timeline-step";
          if (timelineSteps.includes(item.step)) {
            if (item.step === timelineSteps[timelineSteps.length - 1]) {
              className = "timeline-step active";
            } else {
              className = "timeline-step done";
            }
          }
          return (
            <div key={item.step} className={className}>
              <span className="timeline-step-num">BƯỚC {item.step}</span>
              <span className="timeline-step-title">{item.title}</span>
              <span className="timeline-step-desc">{item.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
