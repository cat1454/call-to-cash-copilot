import { cn } from "../../../lib/cn";
import { Badge } from "../../../components/ui/Badge";

const SCENARIOS = [
  {
    idx: 0,
    title: "Kịch bản 1: Đặt chỗ bình thường",
    badge: "Thành công nhanh",
    type: "success",
    desc: "Hành khách đặt xe Hà Nội đi Sa Pa tối nay, thông tin đầy đủ rõ ràng, thanh toán cọc nhanh chóng."
  },
  {
    idx: 1,
    title: "Kịch bản 2: Kỳ kèo cọc & Nghi ngờ Crypto",
    badge: "Dispute Risk cao",
    type: "warning",
    desc: "Khách nghi ngại cọc tiền, hỏi Solana có phải coin lừa đảo không, xác nhận mơ hồ. AI xử lý kéo giảm rủi ro."
  },
  {
    idx: 2,
    title: "Kịch bản 3: Thay đổi số ghế giữa cuộc thoại",
    badge: "Sửa đổi Draft vé",
    type: "neutral",
    desc: "Khách đổi ý đặt 2 người rồi đổi sang 4 người, kỳ kèo chính sách và yêu cầu thay đổi giá tiền vé."
  },
  {
    idx: 3,
    title: "Happy path: Đà Nẵng → Hà Nội 28/06",
    badge: "3 → 4 khách",
    type: "success",
    desc: "Chuyến 19:00 ngày 28/06 được cập nhật từ 3 sang 4 khách trước khi xác nhận lại điều khoản."
  }
];

export default function ScenarioSelector({ currentScenarioIdx, selectScenario }) {
  return (
    <section
      aria-label="Chọn kịch bản mô phỏng"
      className="bg-white border border-[#f1f5f9] rounded-2xl p-5 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.03),0_8px_16px_-6px_rgba(15,23,42,0.03)]"
    >
      <h2 className="mb-4 border-l-[3px] border-[#059669] pl-2 text-sm leading-5 font-semibold text-[#374151] text-balance select-none">
        Chọn Kịch Bản Mô Phỏng Thuyết Trình
      </h2>
      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3">
        {SCENARIOS.map((sc) => (
          <button
            key={sc.idx}
            onClick={() => selectScenario(sc.idx)}
            className={cn(
              "flex min-h-11 flex-col gap-2 rounded-xl border p-4 text-left min-[1200px]:p-5",
              "transition-all duration-150 ease-out",
              "focus-visible:outline-2 focus-visible:outline-[#059669] focus-visible:outline-offset-1",
              "active:scale-[0.98] motion-reduce:transition-none cursor-pointer",
              currentScenarioIdx === sc.idx
                ? "border-[#059669] bg-gradient-to-tr from-[#f0fdf4] to-white shadow-[0_4px_12px_rgba(5,150,105,0.05)] font-medium"
                : "border-[#f1f5f9] bg-white hover:border-[#059669]/40 hover:bg-[#f8fafc]"
            )}
            aria-pressed={currentScenarioIdx === sc.idx}
          >
            <div className="flex items-start justify-between gap-2 w-full">
              <span
                className={cn(
                  "text-sm leading-5 font-semibold text-balance",
                  currentScenarioIdx === sc.idx ? "text-[#059669]" : "text-[#111827]"
                )}
              >
                {sc.title}
              </span>
              <Badge variant={sc.type} className="shrink-0">
                {sc.badge}
              </Badge>
            </div>
            <p className="text-xs leading-[18px] font-normal text-[#6b7280]">{sc.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
