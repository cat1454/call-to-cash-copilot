import { Mic, RotateCcw, MessageSquare } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Button } from "../../../components/ui/Button";
import { IconButton } from "../../../components/ui/IconButton";
import { Progress } from "../../../components/ui/Progress";
import { SectionHeading } from "../../../components/ui/SectionHeading";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";

const STATUS_LABELS = {
  "Sẵn sàng": "Sẵn sàng đàm thoại",
  "Cuộc gọi đang trực tiếp": "Đàm thoại đang diễn ra",
  "Chờ thanh toán cọc": "Chờ đặt cọc giữ chỗ",
  "Đang cọc (Solana Pay)...": "Đang xử lý giao dịch cọc",
  "Đã hoàn thành": "Đàm thoại hoàn tất"
};

const STREAM_LABELS = {
  connecting: "SSE: Đang kết nối",
  open: "SSE: Trực tuyến",
  reconnecting: "SSE: Đang kết nối lại",
  error: "SSE: Lỗi kết nối",
  closed: "SSE: Đã đóng",
  demo: "Replay: Cục bộ",
  idle: "SSE: Chưa kết nối"
};

export default function VoiceSimulatorPanel({
  simStatus,
  streamStatus,
  transcript,
  startSimulation,
  resetSimulation,
  isSimulating,
  readinessScore
}) {
  const statusLabel = STATUS_LABELS[simStatus] ?? simStatus;
  const isCompleted = simStatus === "Đã hoàn thành";
  const isActive = simStatus === "Cuộc gọi đang trực tiếp";

  return (
    <Card>
      <CardHeader>
        <SectionHeading icon={<MessageSquare size={13} />}>
          Bảng Thử Nghiệm Cuộc Gọi (Voice Agent Simulator)
        </SectionHeading>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs leading-4 font-medium",
              streamStatus === "error"
                ? "bg-[#fff1f2] text-[#be123c]"
                : streamStatus === "open"
                  ? "bg-[#ecfdf5] text-[#047857]"
                  : "bg-[#f3f4f6] text-[#6b7280]"
            )}
            role="status"
          >
            {STREAM_LABELS[streamStatus] ?? STREAM_LABELS.idle}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs leading-4 font-medium",
              isActive
                ? "bg-[#ecfdf5] text-[#047857]"
                : isCompleted
                  ? "bg-[#ecfdf5] text-[#065f46]"
                  : "bg-[#f3f4f6] text-[#6b7280]"
            )}
          >
            {statusLabel}
          </span>
        </div>
      </CardHeader>

      <CardBody className="gap-4 p-5">
        {/* Transcript area */}
        <section
          aria-label="Transcript cuộc gọi"
          className="flex max-h-64 flex-col gap-3 overflow-y-auto pr-1"
        >
          {transcript.length === 0 ? (
            <p className="py-8 text-center text-sm leading-5 font-normal text-[#6b7280]">
              Chưa có hội thoại. Nhấn micro để bắt đầu.
            </p>
          ) : (
            transcript.map((bubble, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex max-w-[88%] flex-col gap-1 [animation:fade-in_0.3s_ease-out]",
                  bubble.sender === "ai" ? "self-start" : "self-end items-end"
                )}
              >
                <span className="text-xs leading-4 font-medium text-[#6b7280]">
                  {bubble.sender === "ai" ? "Tổng đài viên AI" : "Hành khách"}
                </span>
                <div
                  className={cn(
                    "min-w-0 rounded-2xl px-4 py-3 text-sm leading-5 font-normal shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                    bubble.sender === "ai"
                      ? "bg-slate-100 text-[#374151] rounded-tl-none border border-slate-200/50"
                      : "bg-[#059669] text-white rounded-tr-none shadow-[0_2px_8px_rgba(5,150,105,0.15)]",
                    bubble.isTyping && "opacity-60"
                  )}
                >
                  {bubble.isTyping ? (
                    <span className="flex gap-1 py-1 px-0.5">
                      {[0, 0.2, 0.4].map((d) => (
                        <span
                          key={d}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full [animation:typing-dot_1.2s_ease-in-out_infinite] motion-reduce:animate-none",
                            bubble.sender === "ai" ? "bg-[#6b7280]" : "bg-white"
                          )}
                          style={{ animationDelay: `${d}s` }}
                        />
                      ))}
                    </span>
                  ) : (
                    bubble.text
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Mic button */}
        <div className="flex flex-col items-center gap-3 py-4">
          <IconButton
            aria-label={
              isSimulating ? "Đang ghi âm" : isCompleted ? "Cuộc gọi kết thúc" : "Bắt đầu đàm thoại"
            }
            onClick={startSimulation}
            disabled={isSimulating || isCompleted}
            className={cn(
              "w-16 h-16 rounded-full border-0 transition-all duration-200 ease-out select-none active:scale-[0.95]",
              isSimulating
                ? "bg-[#059669] text-white shadow-[0_4px_24px_rgba(5,150,105,0.35)] [animation:pulse-primary_2s_ease-in-out_infinite]"
                : isCompleted
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                  : "bg-[#059669] text-white shadow-[0_6px_24px_rgba(5,150,105,0.25)] hover:bg-[#047857] hover:shadow-[0_8px_32px_rgba(5,150,105,0.3)]"
            )}
          >
            <Mic
              size={24}
              className={cn("transition-transform duration-200", isSimulating && "scale-110")}
            />
          </IconButton>
          <span className="text-xs leading-[18px] font-normal text-[#6b7280]">
            {isSimulating
              ? "Đang đàm thoại thoại..."
              : isCompleted
                ? "Cuộc gọi đã kết thúc"
                : "Bấm để bắt đầu đàm thoại"}
          </span>
        </div>

        {/* Call-to-Cash Readiness Progress */}
        <Progress
          value={readinessScore}
          max={100}
          tone="primary"
          label="Độ Sẵn Sàng Thanh Toán (Call-to-Cash)"
          showValue
        />

        {/* Reset button */}
        <Button variant="secondary" size="sm" onClick={resetSimulation} className="w-full gap-1.5">
          <RotateCcw size={12} />
          Đặt lại cuộc gọi
        </Button>
      </CardBody>
    </Card>
  );
}
