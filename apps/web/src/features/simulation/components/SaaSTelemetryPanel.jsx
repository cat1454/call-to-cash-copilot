import { useState } from "react";
import { Volume2, Activity, BarChart3, Database, FileJson } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { SectionHeading } from "../../../components/ui/SectionHeading";
import { Progress } from "../../../components/ui/Progress";

function MetricCard({ label, value }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[#f9fafb] p-4">
      <span className="text-xs leading-4 font-medium text-[#6b7280]">{label}</span>
      <span className="text-lg leading-6 font-semibold text-[#111827] tabular-nums">{value || "—"}</span>
    </div>
  );
}

export default function SaaSTelemetryPanel({
  performance,
  brainMode,
  showPrefetch,
  prefetchContent,
  scores,
  bookingData,
  ledgerLogs,
}) {
  const [showRawJson, setShowRawJson] = useState(false);

  const disputeTone =
    scores.dispute <= 35 ? "primary" : "warning";

  const riskExplanation =
    scores.completeness < 85
      ? "Thông tin đặt chỗ còn thiếu. Tiếp tục hỏi dữ liệu bắt buộc trước khi xác nhận."
      : scores.readiness < 80
        ? "Khách chưa thể hiện đủ ý định đặt cọc. Cần đọc lại điều khoản và xin xác nhận rõ ràng."
        : scores.dispute > 35
          ? "Rủi ro khiếu nại còn cao. Làm rõ chính sách hoàn cọc trước khi mở thanh toán."
          : "Các ngưỡng hiện tại đã đạt. Tiếp tục kiểm tra xác nhận và giữ chỗ trước thanh toán.";

  return (
    <div className="flex flex-col gap-4">
      {/* Agora RT-Voice telemetry */}
      <Card>
        <CardHeader>
          <SectionHeading icon={<Volume2 size={13} />}>
            Luồng thoại Agora RT-Voice
          </SectionHeading>
          <span className="text-xs leading-4 font-normal text-[#6b7280]">Phân tích hệ thống</span>
        </CardHeader>
        <CardBody className="gap-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Thời gian phản hồi AI (TTFR)" value={performance.ttfr} />
            <MetricCard label="Độ trễ đối đáp (Turn Gap)"   value={performance.turngap} />
            <MetricCard label="Số lần hỏi lại"               value={performance.clarify} />
            <MetricCard label="Mức giảm thiểu rủi ro"        value={performance.reduction} />
          </div>

          {/* Brain mode */}
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs leading-4 font-normal text-[#6b7280]">
              <Activity size={14} />
              Brain Mode
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs leading-4 font-medium",
                brainMode === "fast"
                  ? "bg-[#ecfdf5] text-[#065f46]"
                  : brainMode === "slow"
                  ? "bg-[#fffbeb] text-[#92400e]"
                  : "bg-[#f3f4f6] text-[#374151]"
              )}
            >
              {brainMode === "fast" ? "Fast Path" : brainMode === "slow" ? "Slow Path" : "Human Path"}
            </span>
          </div>

          {/* Predictive prefetch */}
          {showPrefetch && (
            <div className="mt-1 rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] p-4 text-xs leading-[18px] font-normal text-[#065f46]">
              <span className="font-medium">Predictive Prefetch:</span> {prefetchContent}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Risk scores */}
      <Card>
        <CardHeader>
          <SectionHeading icon={<BarChart3 size={13} />}>
            Phân Tích Chỉ Số Rủi Ro Giao Dịch
          </SectionHeading>
        </CardHeader>
        <CardBody className="gap-4 p-5">
          <Progress
            value={scores.completeness}
            tone="primary"
            label="Mức độ hoàn thành thông tin"
            showValue
          />
          <Progress
            value={scores.dispute}
            tone={disputeTone}
            label="Nguy cơ khiếu nại (Dispute Risk)"
            showValue
          />
          <Progress
            value={scores.readiness}
            tone="primary"
            label="Độ sẵn sàng đặt cọc"
            showValue
          />
          <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <h3 className="text-sm leading-5 font-semibold text-[#111827] text-balance">
              Diễn giải và hành động tiếp theo
            </h3>
            <p className="mt-2 text-xs leading-[18px] font-normal text-[#6b7280]">
              {riskExplanation}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Off-chain DB snapshot */}
      <details className="rounded-2xl border border-[#e5e7eb] bg-[#f9fafb]">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-5 py-3 text-sm leading-5 font-semibold text-[#374151] transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none">
          <Database size={16} className="shrink-0 text-[#6b7280]" />
          Nhật ký kỹ thuật và dữ liệu kiểm toán
        </summary>
        <div className="border-t border-[#e5e7eb] p-5">
          <ul className="flex flex-col gap-2 text-xs leading-[18px] font-normal text-[#6b7280]">
            <li>• <b>Lịch sử thoại:</b> Chứa văn bản ghi nhận từ Agora.</li>
            <li>• <b>Turns History JSON:</b> Cấu trúc hội thoại và trạng thái.</li>
            <li>• <b>Hiệu năng thoại JSON:</b> TTFR, Turn Gap, và các chỉ số đo lường.</li>
            <li>
              • <b>Ẩn danh thông tin (PII Masking):</b> SĐT ẩn:{" "}
              <code className="rounded bg-[#f3f4f6] px-1 font-mono text-xs">
                {bookingData.phone
                  ? `${bookingData.phone.substring(0, 4)}***${bookingData.phone.substring(7)}`
                  : "N/A"}
              </code>
            </li>
          </ul>

          {/* Collapsible raw JSON */}
          <button
            onClick={() => setShowRawJson((v) => !v)}
            className={cn(
              "mt-4 flex min-h-11 w-full items-center justify-between rounded-lg bg-white px-4 py-3",
              "text-xs leading-4 font-medium text-[#6b7280]",
              "hover:bg-[#f3f4f6] cursor-pointer",
              "transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
              "focus-visible:outline-2 focus-visible:outline-[#059669] focus-visible:outline-offset-1"
            )}
            aria-expanded={showRawJson}
          >
            <span className="flex items-center gap-1.5">
              <FileJson size={14} />
              {showRawJson ? "Ẩn" : "Hiện"} dữ liệu trích xuất JSON raw
            </span>
            <span>{showRawJson ? "▲" : "▼"}</span>
          </button>

          {showRawJson && (
            <pre className="mt-3 min-w-0 overflow-x-auto rounded-lg bg-[#f3f4f6] p-4 font-mono text-xs leading-[18px] text-[#374151]">
              {JSON.stringify(
                {
                  call_id: "CALL-2026-001",
                  intent: "book_bus_ticket",
                  route_from: bookingData.route?.split("->")[0]?.trim() || "",
                  route_to:   bookingData.route?.split("->")[1]?.trim() || "",
                  departure_time:   bookingData.time,
                  passenger_count:  bookingData.seats,
                  phone_masked: bookingData.phone
                    ? `${bookingData.phone.substring(0, 4)}***${bookingData.phone.substring(7)}`
                    : "",
                  total_amount:    bookingData.price,
                  deposit_amount:  bookingData.deposit,
                  tx_signature:    ledgerLogs.txSig !== "0x..." ? ledgerLogs.txSig : "",
                  proof_hash:      ledgerLogs.anchoredHash !== "-" ? ledgerLogs.anchoredHash : "",
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      </details>
    </div>
  );
}
