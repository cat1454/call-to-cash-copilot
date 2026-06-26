import { Bus, PhoneCall, Mic } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Button } from "../../../components/ui/Button";
import { IconButton } from "../../../components/ui/IconButton";

export default function PhoneCallView({
  isWaveAnimating,
  agentReplyStatus,
  phoneCallColor,
  phoneCallStatusText,
  subtitles,
  isMobileLayout,
  startSimulation,
  isSimulating,
  simStatus,
  bookingData,
  demoReady,
  agreementConfirmationRequired,
  agreementEditRequested,
  webConfirmationPending,
  confirmAgreementFromWeb,
  requestAgreementEdit,
  lang = "vi"
}) {
  const isCompleted =
    simStatus === "Đã hoàn thành" || simStatus === "Đang đồng bộ hội thoại sau cuộc gọi...";

  const getTranslatedPhoneCallStatus = (text) => {
    if (lang === "vi" || !text) return text || "";
    const m = {
      "Đang đổ chuông": "Ringing...", "Đang kết nối": "Connecting...",
      "Đang chờ kết nối từ hành khách": "Waiting for passenger connection...",
      "Đang chờ cuộc gọi": "Waiting for call...", "Đang chuẩn bị": "Preparing...",
      "Cuộc gọi kết thúc": "Call ended", "Đã kết thúc": "Finished",
      "Đang đồng bộ hội thoại sau cuộc gọi": "Syncing post-call conversation...",
      "Đang đồng bộ hội thoại": "Syncing conversation...", "Đã hoàn thành": "Completed",
      "Lỗi": "Error", "Kết nối thất bại": "Connection failed", "Đang ngắt kết nối": "Disconnecting..."
    };
    for (const [k, v] of Object.entries(m)) {
      if (text.includes(k)) return v;
    }
    return text.replace("Đang đàm thoại", "In call").replace("Cuộc gọi đang diễn ra", "Call in progress");
  };

  const getSpeakerLabel = (s) => lang === "vi" ? s : s === "Khách hàng" ? "Customer" : s === "Tổng đài AI" ? "AI Operator" : s;

  const getBookingLabel = (lbl) => lang === "vi" ? lbl : ({
    "Hành trình:": "Route:", "Ngày đi:": "Departure date:", "Giờ đi:": "Departure time:",
    "Số ghế:": "Seats:", "SĐT liên lạc:": "Contact phone:", "Tổng cộng:": "Total:", "Số tiền cọc:": "Deposit:"
  }[lbl] || lbl);

  const formatValue = (key, val) => !val ? "—" : (key === "Số ghế:" ? String(val).replace(/ghe|ghế/g, lang === "vi" ? " ghế" : " seats") : val);

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
            {lang === "vi" ? "Tổng đài xe ba miền" : "Three Regions Bus Hotline"}
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
            {getTranslatedPhoneCallStatus(phoneCallStatusText)}
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
                "inline-block w-[3px] rounded-full bg-primary",
                isWaveAnimating
                  ? "h-6 [animation:wave-bar_0.8s_ease-in-out_infinite] motion-reduce:animate-none"
                  : "h-1 opacity-30"
              )}
              style={{
                animationDelay: isWaveAnimating ? `${(delay - 0.4) * 0.3}s` : undefined
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
            color: subtitles.speaker === "Khách hàng" ? "#059669" : "#6b7280"
          }}
        >
          {getSpeakerLabel(subtitles.speaker)}
        </p>

        <p
          key={subtitles.text}
          className="text-sm leading-5 font-normal text-[#374151] [animation:fade-in_0.3s_ease-out]"
        >
          {subtitles.text}
        </p>

        {agentReplyStatus !== "idle" && (
          <p
            className="mt-3 flex items-center gap-2 text-xs leading-4 text-[#6b7280]"
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[#059669] [animation:pulse-primary_2s_ease-in-out_infinite] motion-reduce:animate-none"
            />
            {agentReplyStatus === "slow"
              ? (lang === "vi" ? "Phụ đề AI đang chậm; cuộc gọi vẫn tiếp tục." : "AI subtitles are slow; call continues.")
              : (lang === "vi" ? "Tổng đài AI đang xử lý..." : "AI operator is processing...")}
          </p>
        )}
      </div>

      {/* Mic control only appears in real mobile layout */}
      {isMobileLayout && (
        <div className="flex flex-col items-center gap-2 py-4">
          <IconButton
            aria-label={
              isSimulating
                ? (lang === "vi" ? "Đang ghi âm" : "Recording")
                : isCompleted
                ? (lang === "vi" ? "Cuộc gọi kết thúc" : "Call ended")
                : (lang === "vi" ? "Bắt đầu đàm thoại" : "Start call")
            }
            variant="primary"
            size="lg"
            onClick={startSimulation}
            disabled={isSimulating || isCompleted || !demoReady}
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
              ? (lang === "vi" ? "Đang ghi âm..." : "Recording...")
              : isCompleted
                ? (lang === "vi" ? "Cuộc gọi kết thúc" : "Call ended")
                : (lang === "vi" ? "Bấm để bắt đầu đàm thoại" : "Tap to start call")}
          </span>
        </div>
      )}

      {/* Booking summary */}
      <div className="mx-4 mb-8 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="border-b border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-balance text-sm leading-5 font-semibold text-[#059669]">
            {lang === "vi" ? "Thông Tin Hành Trình" : "Booking Summary"}
          </p>
        </div>

        <div className="divide-y divide-[#f3f4f6]">
          {[
            { label: "Hành trình:", val: bookingData.route },
            { label: "Ngày đi:", val: bookingData.date },
            { label: "Giờ đi:", val: bookingData.time },
            { label: "Số ghế:", val: bookingData.seats },
            { label: "SĐT liên lạc:", val: bookingData.phone },
            { label: "Tổng cộng:", val: bookingData.price },
            {
              label: "Số tiền cọc:",
              val: bookingData.deposit,
              accent: true
            }
          ].map(({ label, val, accent }) => (
            <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-xs leading-4 font-normal text-[#6b7280]">{getBookingLabel(label)}</span>

              <span
                className={cn(
                  "text-right font-semibold tabular-nums",
                  accent ? "text-lg leading-6" : "text-sm leading-5",
                  val ? (accent ? "text-[#059669]" : "text-[#111827]") : "text-[#9ca3af]"
                )}
              >
                {formatValue(label, val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {agreementConfirmationRequired && (
        <section
          className="sticky bottom-3 z-10 mx-4 mb-5 rounded-2xl border border-[#a7f3d0] bg-white p-4 shadow-[0_12px_30px_rgba(5,150,105,0.16)]"
          aria-label={lang === "vi" ? "Xác nhận điều khoản đặt cọc" : "Confirm deposit terms"}
        >
          <p className="text-balance text-sm leading-5 font-semibold text-[#111827]">
            {lang === "vi" ? `Xác nhận đặt cọc ${bookingData.deposit || ""}` : `Confirm deposit of ${bookingData.deposit || ""}`}
          </p>
          <p className="mt-1 text-xs leading-4 text-[#6b7280]">
            {lang === "vi" ? (
              <>Bạn đang giữ {formatValue("Số ghế:", bookingData.seats) || "chỗ"}. Xác nhận để khóa điều khoản hiện tại và mở thanh toán.</>
            ) : (
              <>You are holding {formatValue("Số ghế:", bookingData.seats) || "seats"}. Confirm to lock terms and open payment.</>
            )}
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-3 w-full active:scale-[0.96] motion-reduce:transition-none"
            onClick={confirmAgreementFromWeb}
            disabled={webConfirmationPending}
          >
            {webConfirmationPending
              ? (lang === "vi" ? "Đang xác nhận..." : "Confirming...")
              : (lang === "vi" ? "Xác nhận điều khoản & mở thanh toán" : "Confirm terms & open payment")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="mt-2 w-full"
            onClick={requestAgreementEdit}
            disabled={webConfirmationPending}
          >
            {lang === "vi" ? "Sửa thông tin" : "Edit details"}
          </Button>
          <p className="mt-3 text-center text-xs leading-4 text-[#6b7280]">
            {lang === "vi" ? (
              <>Hoặc nói: <span className="font-medium text-[#374151]">“Tôi xác nhận”</span></>
            ) : (
              <>Or say: <span className="font-medium text-[#374151]">“I confirm”</span></>
            )}
          </p>
        </section>
      )}

      {agreementEditRequested && (
        <p className="mx-4 mb-5 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 text-center text-xs leading-4 text-[#92400e]" role="status">
          {lang === "vi"
            ? "Hãy nói thông tin cần chỉnh sửa. Em sẽ đọc lại điều khoản mới trước khi mở thanh toán."
            : "Please state the details you want to edit. I will read back the new terms before opening payment."}
        </p>
      )}
    </div>
  );
}
