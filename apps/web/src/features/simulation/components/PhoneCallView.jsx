import { Bus, PhoneCall, Mic } from "lucide-react";
import { cn } from "../../../lib/cn";
import { IconButton } from "../../../components/ui/IconButton";

export default function PhoneCallView({
  isWaveAnimating,
  phoneCallColor,
  phoneCallStatusText,
  subtitles,
  isMobileLayout,
  startSimulation,
  isSimulating,
  simStatus,
  bookingData,
}) {
  const isCompleted = simStatus === "Đã hoàn thành";

  return (
    <div className="flex min-h-full flex-col overflow-y-auto">
      {/* Active calling header */}
      <div className="flex flex-col items-center gap-3 bg-white px-4 pb-5 pt-6">
        <div className="relative flex items-center justify-center">
          {isWaveAnimating && (
            <>
              <span className="absolute inline-block h-16 w-16 rounded-full border border-[#059669]/30 [animation:ripple-out_2s_ease-out_infinite] motion-reduce:animate-none" />
              <span className="absolute inline-block h-16 w-16 rounded-full border border-[#059669]/20 [animation:ripple-out_2s_ease-out_0.5s_infinite] motion-reduce:animate-none" />
              <span className="absolute inline-block h-16 w-16 rounded-full border border-[#059669]/10 [animation:ripple-out_2s_ease-out_1s_infinite] motion-reduce:animate-none" />
            </>
          )}

          <div
            className={cn(
              "relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2",
              isWaveAnimating
                ? "border-[#059669] bg-[#ecfdf5] text-[#059669]"
                : "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]"
            )}
          >
            <Bus size={24} />
          </div>
        </div>

        <div>
          <p className="text-balance text-center text-base leading-6 font-semibold text-[#111827]">
            Tổng đài xe khách Sa Pa
          </p>

          <p
            className="mt-1 flex items-center justify-center gap-2 text-center text-xs leading-[18px] font-normal"
            style={{ color: phoneCallColor }}
          >
            <PhoneCall
              size={14}
              className={
                isWaveAnimating
                  ? "[animation:phone-ring_0.8s_ease-in-out_infinite] motion-reduce:animate-none"
                  : ""
              }
            />
            {phoneCallStatusText}
          </p>
        </div>
      </div>

      {/* Voice wave visualizer */}
      <div className="flex items-center justify-center bg-white py-3">
        <div className="flex h-8 items-end gap-[3px]">
          {[0.4, 0.7, 1, 0.7, 0.4, 0.7].map((delay, index) => (
            <span
              key={index}
              className={cn(
                "w-[3px] rounded-full bg-[#059669]",
                isWaveAnimating
                  ? "[animation:wave-bar_0.8s_ease-in-out_infinite] motion-reduce:animate-none"
                  : "h-[4px] opacity-30"
              )}
              style={{
                height: isWaveAnimating ? undefined : "4px",
                animationDelay: isWaveAnimating
                  ? `${(delay - 0.4) * 0.3}s`
                  : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* Live subtitles */}
      <div className="mx-4 my-3 min-h-[76px] rounded-xl border border-[#e5e7eb] bg-white p-4">
        <p
          className="mb-2 text-xs leading-4 font-medium"
          style={{
            color:
              subtitles.speaker === "Khách hàng" ? "#059669" : "#6b7280",
          }}
        >
          {subtitles.speaker}
        </p>

        <p
          key={subtitles.text}
          className="text-sm leading-5 font-normal text-[#374151] [animation:fade-in_0.3s_ease-out]"
        >
          {subtitles.text}
        </p>
      </div>

      {/* Mic control only appears in real mobile layout */}
      {isMobileLayout && (
        <div className="flex flex-col items-center gap-2 py-4">
          <IconButton
            aria-label={
              isSimulating
                ? "Đang ghi âm"
                : isCompleted
                  ? "Cuộc gọi kết thúc"
                  : "Bắt đầu đàm thoại"
            }
            variant="primary"
            size="lg"
            onClick={startSimulation}
            disabled={isSimulating || isCompleted}
            className={cn(
              "h-16 w-16 rounded-full",
              isSimulating &&
              "[animation:pulse-primary_2s_ease-in-out_infinite] motion-reduce:animate-none"
            )}
          >
            <Mic size={24} />
          </IconButton>

          <span className="text-xs leading-[18px] font-normal text-[#6b7280]">
            {isSimulating
              ? "Đang ghi âm..."
              : isCompleted
                ? "Cuộc gọi kết thúc"
                : "Bấm để bắt đầu đàm thoại"}
          </span>
        </div>
      )}

      {/* Booking summary */}
      <div className="mx-4 mb-8 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-balance text-sm leading-5 font-semibold text-[#059669]">
            Thông Tin Hành Trình (Booking Summary)
          </p>
        </div>

        <div className="divide-y divide-[#f3f4f6]">
          {[
            { label: "Hành trình:", val: bookingData.route },
            { label: "Giờ đi:", val: bookingData.time },
            { label: "Số ghế:", val: bookingData.seats },
            { label: "SĐT liên lạc:", val: bookingData.phone },
            { label: "Tổng cộng:", val: bookingData.price },
            {
              label: "Số tiền cọc:",
              val: bookingData.deposit,
              accent: true,
            },
          ].map(({ label, val, accent }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="text-xs leading-4 font-normal text-[#6b7280]">
                {label}
              </span>

              <span
                className={cn(
                  "text-right font-semibold tabular-nums",
                  accent ? "text-lg leading-6" : "text-sm leading-5",
                  val
                    ? accent
                      ? "text-[#059669]"
                      : "text-[#111827]"
                    : "text-[#9ca3af]"
                )}
              >
                {val || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}