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

function ScoreBar({ metric }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <span className="text-xs leading-4 font-medium text-[#6b7280]">{metric.label}</span>
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
        <span>{metric.passed ? "Đạt ngưỡng an toàn" : "Cần bổ sung hoặc xác nhận"}</span>
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
  paymentGate
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
      ? "MISMATCH"
      : model.ledger.status === "match"
        ? "MATCH"
        : "PENDING";

  return (
    <div className="flex w-full flex-col gap-4 p-4 pb-24 [animation:fade-in_0.35s_ease-out_both]">
      <DashboardSection icon={PhoneCall} title="Operator Status">
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
              {model.gate.label}
            </strong>
            <span className="break-words text-xs leading-[18px] font-normal text-[#6b7280]">
              {model.operator.callStatus}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <span className="text-xs leading-4 font-medium text-[#6b7280]">Hành động tiếp theo</span>
          <strong className="text-sm leading-5 font-semibold text-[#111827] text-balance">
            {model.operator.nextAction}
          </strong>
        </div>
        <div className="flex items-center gap-2 text-xs leading-4 font-normal text-[#6b7280] tabular-nums">
          Tiến trình kịch bản: {model.operator.timelineCount}/6
        </div>
      </DashboardSection>

      <DashboardSection icon={BarChart3} title="Risk Gate">
        <div className="flex flex-col gap-3">
          <ScoreBar metric={model.risk.completeness} />
          <ScoreBar metric={model.risk.readiness} />
          <ScoreBar metric={model.risk.dispute} />
        </div>
      </DashboardSection>

      <DashboardSection icon={Database} title="Booking Snapshot">
        <div className="flex flex-col gap-2">
          <SnapshotRow label="Route" value={model.booking.route} />
          <SnapshotRow label="Time" value={model.booking.time} />
          <SnapshotRow label="Seats" value={model.booking.seats} />
          <SnapshotRow label="Price" value={model.booking.price} />
          <SnapshotRow label="Deposit" value={model.booking.deposit} />
          <SnapshotRow label="Phone" value={model.booking.phone} />
        </div>
      </DashboardSection>

      <DashboardSection icon={Shield} title="Ledger & Trust" tone={ledgerTone}>
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
              Booking snapshot changed after proof anchor.
            </span>
          </div>
        )}
        <p className="text-xs leading-[18px] font-normal text-[#6b7280]">
          Bằng chứng kỹ thuật chỉ xuất hiện trong bảng kiểm toán dành cho nhân viên.
        </p>
      </DashboardSection>
    </div>
  );
}
