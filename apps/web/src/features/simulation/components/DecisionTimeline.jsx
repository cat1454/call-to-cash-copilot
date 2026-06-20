import { cn } from "../../../lib/cn";
import { Card, CardHeader } from "../../../components/ui/Card";
import { SectionHeading } from "../../../components/ui/SectionHeading";

const STEPS_DATA = [
  { step: 1, title: "Nhận diện giọng nói",     desc: "Tiếp nhận và truyền tải âm thanh thực tế qua luồng Agora." },
  { step: 2, title: "Trích xuất thông tin",     desc: "Nhận diện lộ trình, khung giờ, số chỗ và SĐT liên hệ." },
  { step: 3, title: "Đánh giá rủi ro",          desc: "Phân tích nguy cơ hủy vé, rủi ro đàm thoại và hoàn tiền." },
  { step: 4, title: "Chốt điều khoản đặt vé",   desc: "Tóm tắt thỏa thuận đặt cọc giữ chỗ và đọc to cho khách hàng." },
  { step: 5, title: "Mở cổng thanh toán",        desc: "Khởi động cổng Solana Pay chuyển khoản và chờ chữ ký số." },
  { step: 6, title: "Neo băm & Cấp vé",          desc: "Neo băm thỏa thuận giao dịch on-chain và phát hành vé điện tử." },
];

export default function DecisionTimeline({ timelineSteps }) {
  return (
    <Card>
      <CardHeader>
        <SectionHeading>
          Quy Trình Duyệt &amp; Ra Quyết Định Giao Dịch
        </SectionHeading>
      </CardHeader>
      <div className="flex flex-col gap-0 px-5 py-4">
        {STEPS_DATA.map((item) => {
          const isDone   = timelineSteps.includes(item.step) && item.step !== timelineSteps[timelineSteps.length - 1];
          const isActive = item.step === timelineSteps[timelineSteps.length - 1];
          const isPending = !isDone && !isActive;

          return (
            <div key={item.step} className="flex gap-3 pb-3 last:pb-0">
              {/* Connector line + dot */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs leading-4 font-semibold",
                    isDone   && "bg-[#10b981] text-white",
                    isActive && "bg-[#059669] text-white [animation:pulse-primary_2s_ease-in-out_infinite] motion-reduce:animate-none",
                    isPending && "bg-[#f3f4f6] text-[#9ca3af]"
                  )}
                >
                  {isDone ? "✓" : item.step}
                </div>
                {item.step < 6 && (
                  <div
                    className={cn(
                      "w-px flex-1 mt-1",
                      isDone ? "bg-[#10b981]" : "bg-[#e5e7eb]"
                    )}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="flex flex-col gap-0.5 min-w-0 pt-0.5 pb-3 last:pb-0">
                <p
                  className={cn(
                    "text-sm leading-5 font-semibold text-balance",
                    isDone   && "text-[#10b981]",
                    isActive && "text-[#059669]",
                    isPending && "text-[#9ca3af]"
                  )}
                >
                  Bước {item.step} — {item.title}
                </p>
                <p
                  className={cn(
                    "min-w-0 text-xs leading-[18px] font-normal",
                    isPending ? "text-[#d1d5db]" : "text-[#6b7280]"
                  )}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
