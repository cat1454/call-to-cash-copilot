import { BadgeCheck, AlertTriangle, CheckCircle2, Ticket } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { cn } from "../../../lib/cn";

export default function PhoneReceiptView({
  showBoardingPass,
  isTampered,
  bookingData
}) {
  if (!showBoardingPass) {
    return (
      <EmptyState
        icon={<Ticket size={32} aria-hidden="true" />}
        title="Chưa có vé xe khách điện tử."
        description="Vui lòng hoàn thành cuộc gọi đàm thoại và cọc tiền để nhận vé bảo mật."
        className="h-full justify-center py-20"
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4 [animation:fade-in_0.35s_ease-out_both]">
      <div className="relative">
        <div
          className={cn(
            "bg-white text-[#1f2937] rounded-2xl p-4 font-mono shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[#e5e7eb] relative",
            "before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-[#059669] before:rounded-t-2xl",
            "[animation:ticket-slide-in_0.4s_cubic-bezier(0.18,0.89,0.32,1.28)_forwards]",
            "text-xs leading-[18px]"
          )}
        >
          {/* Ticket side notches */}
          <div className="absolute top-[100px] left-[-7px] w-3 h-3 bg-[#f9fafb] rounded-full border border-[#e5e7eb] z-10 border-l-transparent border-t-transparent" />
          <div className="absolute top-[100px] right-[-7px] w-3 h-3 bg-[#f9fafb] rounded-full border border-[#e5e7eb] z-10 border-r-transparent border-t-transparent" />
          
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <BadgeCheck size={16} className={isTampered ? "text-[#f43f5e]" : "text-[#10b981]"} />
            <h4 className="m-0 text-sm leading-5 font-semibold text-[#111827] text-balance">
              VÉ XE KHÁCH ĐIỆN TỬ (SECURE TICKET)
            </h4>
          </div>

          <div className="flex justify-between gap-3 py-1">
            <span className="text-[#6b7280]">Mã Booking:</span>
            <span className="font-bold text-[#111827] tabular-nums">{bookingData.bookingId}</span>
          </div>
          
          <div className="flex justify-between gap-3 py-1">
            <span className="text-[#6b7280]">Tuyến xe:</span>
            <span className={cn("font-bold text-[#111827]", isTampered && "text-[#f43f5e]")}>
              {bookingData.route}
            </span>
          </div>
          
          <div className="flex justify-between gap-3 py-1">
            <span className="text-[#6b7280]">Khởi hành:</span>
            <span className="font-bold text-[#111827] tabular-nums">{bookingData.time}</span>
          </div>
          
          <div className="flex justify-between gap-3 py-1">
            <span className="text-[#6b7280]">Số ghế:</span>
            <span className={cn("font-bold text-[#111827]", isTampered && "text-[#f43f5e]")}>
              {bookingData.seats}
            </span>
          </div>

          <div className="border-t border-dashed border-[#e5e7eb] my-2.5" />

          <div className="flex items-end justify-between gap-3 py-1">
            <span className="text-[#6b7280]">Đã thanh toán:</span>
            <span className="text-xl leading-7 font-semibold text-[#065f46] tabular-nums">
              {bookingData.deposit}
            </span>
          </div>

          <div className="flex flex-col items-center mt-3.5 bg-white p-2.5 rounded-xl border border-[#f1f5f9] shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]">
            <svg className="max-w-[220px] h-10 w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
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
            <div className="mt-2 font-mono text-xs leading-4 font-medium tracking-[0.2em] text-[#64748b]">
              {bookingData.bookingId}
            </div>
          </div>

          {isTampered ? (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-[#f43f5e] bg-[#fff1f2] p-3 text-center text-xs leading-[18px] font-semibold text-[#be123c] [animation:shake_0.5s_ease-in-out]">
              <AlertTriangle size={13} className="shrink-0" />
              <span>Dữ liệu bị thay đổi — sai khớp hash</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-[#10b981] bg-[#ecfdf5] p-3 text-center text-xs leading-[18px] font-semibold text-[#065f46]">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Vé Hợp Lệ & Đã Đối Soát</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
