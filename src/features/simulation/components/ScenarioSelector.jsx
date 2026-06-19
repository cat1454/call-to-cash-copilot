export default function ScenarioSelector({
  currentScenarioIdx,
  selectScenario
}) {
  const scenariosList = [
    {
      idx: 0,
      title: "Kịch bản 1: Đặt chỗ bình thường",
      badge: "Thành công nhanh",
      type: "normal",
      desc: "Hành khách đặt xe Hà Nội đi Sa Pa tối nay, thông tin đầy đủ rõ ràng, thanh toán cọc nhanh chóng."
    },
    {
      idx: 1,
      title: "Kịch bản 2: Kỳ kèo cọc & Nghi ngờ Crypto",
      badge: "Dispute Risk cao",
      type: "dispute",
      desc: "Khách nghi ngại cọc tiền, hỏi Solana có phải coin lừa đảo không, xác nhận mơ hồ. AI xử lý kéo giảm rủi ro."
    },
    {
      idx: 2,
      title: "Kịch bản 3: Thay đổi số ghế giữa cuộc thoại",
      badge: "Sửa đổi Draft vé",
      type: "change",
      desc: "Khách đổi ý đặt 2 người rồi đổi sang 4 người, kỳ kèo chính sách và yêu cầu thay đổi giá tiền vé."
    }
  ];

  return (
    <div className="scenarios-container">
      <h2>Chọn Kịch Bản Mô Phỏng Thuyết Trình</h2>
      <div className="scenario-list">
        {scenariosList.map((sc) => (
          <div
            key={sc.idx}
            className={`scenario-card ${currentScenarioIdx === sc.idx ? "active" : ""}`}
            onClick={() => selectScenario(sc.idx)}
          >
            <div className="scenario-card-header">
              <h3>{sc.title}</h3>
              <span className={`badge ${sc.type}`}>{sc.badge}</span>
            </div>
            <p>{sc.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
