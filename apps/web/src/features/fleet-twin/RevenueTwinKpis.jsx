export function RevenueTwinKpis({ model, lang = "vi" }) {
  const getKpiLabel = (label) => {
    if (lang === "vi") {
      return {
        "Revenue recovered": "Doanh thu đã thu hồi",
        "Potential recovery": "Doanh thu tiềm năng",
        "Bookings saved": "Số vé đã giữ chỗ",
        "Fleet fill rate": "Tỷ lệ lấp đầy xe",
        "Dispute Risk": "Rủi ro tranh chấp",
        "Payment Readiness": "Sẵn sàng thanh toán",
        "Offer acceptance": "Tỷ lệ chốt đề xuất"
      }[label] || label;
    }
    return label;
  };

  const getKpiTrend = (trend) => {
    if (lang === "vi") {
      return {
        "secured": "đã khóa cọc",
        "not secured": "chưa khóa cọc",
        "accepted pax": "khách chốt",
        "after holds": "sau khi giữ",
        "server risk": "từ máy chủ",
        "server score": "điểm hệ thống",
        "projection": "dự báo"
      }[trend] || trend;
    }
    return trend;
  };

  return (
    <section className="fleet-card kpi-card" aria-labelledby="fleet-kpi">
      <div className="fleet-card-header compact accent-green">
        <div>
          <p className="fleet-eyebrow">{lang === "vi" ? "Hiệu suất" : "Performance"}</p>
          <h2 id="fleet-kpi">{lang === "vi" ? "Chỉ số KPI Revenue Twin" : "Revenue Twin KPI Metrics"}</h2>
        </div>
      </div>
      <div className="kpi-grid">
        {model.kpis.map(([label, value, trend, tone]) => (
          <div key={label} className={`kpi-tile kpi-${tone}`}>
            <span>{getKpiLabel(label)}</span>
            <strong>{value}</strong>
            <em>{getKpiTrend(trend)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
