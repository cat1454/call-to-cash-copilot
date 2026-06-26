import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Lock,
  PhoneCall,
  Shield,
  ShieldAlert,
  Unlock
} from "lucide-react";
import { cn } from "../../../lib/cn";
import { createDashboardModel } from "../dashboardModel";

function DashboardSection({ icon: Icon, title, children, tone = "" }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)]",
        tone === "success" && "border-[#10b981]/35",
        tone === "danger" && "border-[#f43f5e]/40"
      )}
    >
      <div className="flex items-center gap-2 text-sm leading-5 font-semibold text-[#111827] text-balance">
        <Icon size={16} className="shrink-0 text-[#059669]" />
        <span className="text-balance">{title}</span>
      </div>
      {children}
    </section>
  );
}

function ScoreBar({ metric, lang = "vi" }) {
  const RISK_LABELS = {
    "Completeness": lang === "vi" ? "Độ đầy đủ" : "Completeness",
    "Readiness": lang === "vi" ? "Độ sẵn sàng" : "Payment Readiness",
    "Dispute Risk": lang === "vi" ? "Rủi ro tranh chấp" : "Dispute Risk"
  };
  const labelTranslated = RISK_LABELS[metric.label] || metric.label;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <span className="text-xs leading-4 font-medium text-[#6b7280]">{labelTranslated}</span>
        <strong className="text-lg leading-6 font-semibold text-[#111827] tabular-nums">
          {metric.value}%
        </strong>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-[#e5e7eb]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            metric.passed ? "bg-[#10b981]" : "bg-[#f59e0b]"
          )}
          style={{ width: `${metric.value}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs leading-4 font-normal text-[#6b7280]">
        <span>
          {metric.passed
            ? (lang === "vi" ? "Đạt ngưỡng an toàn" : "Safe threshold reached")
            : (lang === "vi" ? "Cần bổ sung hoặc xác nhận" : "Needs review or confirmation")}
        </span>
        <span className="tabular-nums">
          {metric.direction === "max" ? "≤" : "≥"} {metric.threshold}%
        </span>
      </div>
    </div>
  );
}

function SnapshotRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-xs leading-4 font-normal text-[#6b7280]">{label}</span>
      <strong className="min-w-0 break-words text-right text-sm leading-5 font-semibold text-[#111827] tabular-nums">
        {value}
      </strong>
    </div>
  );
}

export default function PhoneDashboardView({
  scores,
  performance,
  brainMode,
  showPrefetch,
  prefetchContent,
  timelineSteps,
  ledgerLogs,
  bookingData,
  simStatus,
  isTampered,
  showPaymentDrawer,
  paymentGate,
  lang = "vi"
}) {
  const model = createDashboardModel({
    scores,
    performance,
    brainMode,
    showPrefetch,
    prefetchContent,
    timelineSteps,
    ledgerLogs,
    bookingData,
    simStatus,
    isTampered,
    showPaymentDrawer,
    paymentGate
  });

  const GateIcon = model.gate.status === "unlocked" ? Unlock : Lock;
  const ledgerTone =
    model.ledger.status === "mismatch"
      ? "danger"
      : model.ledger.status === "match"
        ? "success"
        : "";
  const ledgerLabel =
    model.ledger.status === "mismatch"
      ? (lang === "vi" ? "SAI KHỚP HASH" : "HASH MISMATCH")
      : model.ledger.status === "match"
        ? (lang === "vi" ? "KHỚP HASH" : "HASH MATCHED")
        : (lang === "vi" ? "CHỜ THANH TOÁN" : "PENDING");

  const GATE_LABELS = {
    "Payment Gate Open": lang === "vi" ? "Cổng thanh toán mở" : "Payment Gate Unlocked",
    "Payment Gate Locked": lang === "vi" ? "Cổng thanh toán khóa" : "Payment Gate Locked"
  };

  const NEXT_ACTION_LABELS = lang === "vi" ? {
    "Send to manual review and invalidate ticket.": "Chuyển sang soát vé thủ công và hủy vé xe khách.",
    "Proof verified; keep receipt available.": "Bằng chứng hợp lệ; hiển thị vé điện tử cho khách.",
    "Collect deposit in the payment drawer.": "Thu tiền đặt cọc từ giao diện khách hàng.",
    "Lower dispute risk before opening payment.": "Hạ thấp rủi ro tranh chấp trước khi mở cổng thanh toán.",
    "Open payment drawer when customer confirms terms.": "Mở cổng thanh toán khi khách hàng xác nhận điều khoản."
  } : {
    "Send to manual review and invalidate ticket.": "Send to manual review and invalidate ticket.",
    "Proof verified; keep receipt available.": "Proof verified; keep receipt available.",
    "Collect deposit in the payment drawer.": "Collect deposit in the payment drawer.",
    "Lower dispute risk before opening payment.": "Lower dispute risk before opening payment.",
    "Open payment drawer when customer confirms terms.": "Open payment drawer when customer confirms terms."
  };

  function translateNextAction(action) {
    if (!action) return "";
    if (NEXT_ACTION_LABELS[action]) return NEXT_ACTION_LABELS[action];
    if (action.startsWith("Collect missing ")) {
      const field = action.replace("Collect missing ", "").replace(".", "");
      if (lang === "vi") {
        const fieldTranslations = {
          "route": "lộ trình",
          "travel time": "giờ khởi hành",
          "passenger count": "số khách đi",
          "contact phone": "số điện thoại",
          "booking details": "thông tin đặt vé"
        };
        return `Thu thập thêm thông tin ${fieldTranslations[field] || field} còn thiếu.`;
      } else {
        return `Collect missing ${field}.`;
      }
    }
    if (action.startsWith("Read terms and capture")) {
      return lang === "vi"
        ? "Đọc điều khoản để ghi nhận xác nhận đặt cọc từ khách hàng."
        : "Read terms and capture explicit deposit confirmation.";
    }
    return action;
  }

  const callStatusText = lang === "vi"
    ? model.operator.callStatus
        .replace("Cuoc goi dang truc tiep", "Cuộc thoại đang hoạt động")
        .replace("Cho thanh toan coc", "Đang chờ thanh toán cọc")
        .replace("Da hoan thanh", "Cuộc thoại đã hoàn thành")
        .replace("Đang cọc (Solana Pay)...", "Đang xử lý giao dịch cọc...")
    : model.operator.callStatus
        .replace("Cuoc goi dang truc tiep", "Call is live")
        .replace("Cho thanh toan coc", "Awaiting deposit payment")
        .replace("Da hoan thanh", "Call completed")
        .replace("Đang cọc (Solana Pay)...", "Processing Solana Pay deposit...");

  return (
    <div className="flex w-full flex-col gap-4 p-4 pb-24 [animation:fade-in_0.35s_ease-out_both]">
      <DashboardSection icon={PhoneCall} title={lang === "vi" ? "Trạng thái tổng đài viên" : "AI Operator Status"}>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border p-4 transition-colors",
            model.gate.status === "unlocked"
              ? "bg-[#ecfdf5] border-[#10b981]/30 text-[#10b981]"
              : "bg-[#fffbeb] border-[#fde68a] text-[#f59e0b]"
          )}
        >
          <GateIcon size={18} className="shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <strong className="text-sm leading-5 font-semibold text-[#111827]">
              {GATE_LABELS[model.gate.label] || model.gate.label}
            </strong>
            <span className="break-words text-xs leading-[18px] font-normal text-[#6b7280]">
              {callStatusText}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <span className="text-xs leading-4 font-medium text-[#6b7280]">{lang === "vi" ? "Hành động tiếp theo" : "Next action"}</span>
          <strong className="text-sm leading-5 font-semibold text-[#111827] text-balance">
            {translateNextAction(model.operator.nextAction)}
          </strong>
        </div>
        <div className="flex items-center gap-2 text-xs leading-4 font-normal text-[#6b7280] tabular-nums">
          {lang === "vi" ? `Tiến trình cuộc thoại: ${model.operator.timelineCount}/6` : `Call progress: ${model.operator.timelineCount}/6`}
        </div>
      </DashboardSection>

      <DashboardSection icon={BarChart3} title={lang === "vi" ? "Cổng kiểm soát rủi ro" : "Risk Control Gate"}>
        <div className="flex flex-col gap-3">
          <ScoreBar metric={model.risk.completeness} lang={lang} />
          <ScoreBar metric={model.risk.readiness} lang={lang} />
          <ScoreBar metric={model.risk.dispute} lang={lang} />
        </div>
      </DashboardSection>

      <DashboardSection icon={Database} title={lang === "vi" ? "Thông tin vé tạm" : "Temporary Ticket Info"}>
        <div className="flex flex-col gap-2">
          <SnapshotRow label={lang === "vi" ? "Tuyến xe" : "Route"} value={model.booking.route} />
          <SnapshotRow label={lang === "vi" ? "Giờ đi" : "Departure time"} value={model.booking.time} />
          <SnapshotRow label={lang === "vi" ? "Số ghế" : "Seats"} value={model.booking.seats} />
          <SnapshotRow label={lang === "vi" ? "Tổng tiền" : "Total price"} value={model.booking.price} />
          <SnapshotRow label={lang === "vi" ? "Tiền cọc" : "Deposit"} value={model.booking.deposit} />
          <SnapshotRow label={lang === "vi" ? "Số điện thoại" : "Phone number"} value={model.booking.phone} />
        </div>
      </DashboardSection>

      <DashboardSection icon={Shield} title={lang === "vi" ? "Sổ cái & Độ tin cậy" : "Ledger & Trust Verification"} tone={ledgerTone}>
        <div
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border p-3 text-sm leading-5 font-semibold",
            model.ledger.status === "mismatch"
              ? "bg-[#fff1f2] border-[#fecdd3] text-[#f43f5e]"
              : model.ledger.status === "match"
                ? "bg-[#ecfdf5] border-[#10b981]/28 text-[#10b981]"
                : "bg-[#fffbeb] border-[#fde68a] text-[#92400e]"
          )}
        >
          {model.ledger.status === "mismatch" ? (
            <ShieldAlert size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          <span>{ledgerLabel}</span>
        </div>
        {isTampered && (
          <div className="flex items-center gap-2 rounded-lg border border-[#f43f5e]/24 bg-[#fff1f2] p-3 text-[#f43f5e]">
            <AlertTriangle size={13} className="shrink-0" />
            <span className="text-xs leading-[18px] font-medium text-[#991b1b]">
              {lang === "vi"
                ? "Thông tin đặt vé bị thay đổi sau khi ghi nhận bằng chứng cọc."
                : "Booking details changed after deposit proof was anchored."}
            </span>
          </div>
        )}
        <p className="text-xs leading-[18px] font-normal text-[#6b7280]">
          {lang === "vi"
            ? "Bằng chứng kỹ thuật chỉ xuất hiện trong bảng kiểm toán dành cho nhân viên."
            : "Technical proof is only visible on the operator audit dashboard."}
        </p>
      </DashboardSection>
    </div>
  );
}
