import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Lock,
  PhoneCall,
  Shield,
  ShieldAlert,
  Timer,
  Unlock,
  Volume2
} from "lucide-react";
import { createDashboardModel } from "../dashboardModel";

function DashboardSection({ icon: Icon, title, children, tone = "" }) {
  return (
    <section className={`phone-dashboard-section ${tone}`}>
      <div className="phone-dashboard-section-title">
        <Icon size={13} />
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

function ScoreBar({ metric }) {
  return (
    <div className={`phone-dashboard-score ${metric.passed ? "passed" : "failed"}`}>
      <div className="phone-dashboard-score-meta">
        <span>{metric.label}</span>
        <strong>{metric.value}%</strong>
      </div>
      <div className="phone-dashboard-bar-bg">
        <div className="phone-dashboard-bar-fill" style={{ width: `${metric.value}%` }}></div>
      </div>
      <div className="phone-dashboard-threshold">
        {metric.direction === "max" ? "<=" : ">="} {metric.threshold}
      </div>
    </div>
  );
}

function SnapshotRow({ label, value }) {
  return (
    <div className="phone-dashboard-row">
      <span>{label}</span>
      <strong>{value}</strong>
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
  showPaymentDrawer
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
    showPaymentDrawer
  });

  const GateIcon = model.gate.status === "unlocked" ? Unlock : Lock;
  const ledgerTone = model.ledger.status === "mismatch" ? "danger" : model.ledger.status === "match" ? "success" : "";
  const ledgerLabel = model.ledger.status === "mismatch" ? "MISMATCH" : model.ledger.status === "match" ? "MATCH" : "PENDING";

  return (
    <div className="phone-view-content phone-dashboard-view">
      <DashboardSection icon={PhoneCall} title="Operator Status">
        <div className={`phone-dashboard-gate ${model.gate.status}`}>
          <GateIcon size={16} />
          <div>
            <strong>{model.gate.label}</strong>
            <span>{model.operator.callStatus}</span>
          </div>
        </div>
        <div className="phone-dashboard-next">
          <span>Next action</span>
          <strong>{model.operator.nextAction}</strong>
        </div>
        <div className="phone-dashboard-mini-meta">
          Story step {model.operator.timelineCount}/6
        </div>
      </DashboardSection>

      <DashboardSection icon={BarChart3} title="Risk Gate">
        <ScoreBar metric={model.risk.completeness} />
        <ScoreBar metric={model.risk.readiness} />
        <ScoreBar metric={model.risk.dispute} />
      </DashboardSection>

      <DashboardSection icon={Volume2} title="Voice Telemetry">
        <div className="phone-dashboard-metric-grid">
          <SnapshotRow label="TTFR" value={model.telemetry.ttfr} />
          <SnapshotRow label="Turn Gap" value={model.telemetry.turngap} />
          <SnapshotRow label="Clarify" value={model.telemetry.clarify} />
          <SnapshotRow label="Brain" value={model.telemetry.brainMode} />
        </div>
        <div className="phone-dashboard-prefetch">
          <Activity size={12} />
          <span>{model.prefetch.label}</span>
          <strong>{model.prefetch.value}</strong>
        </div>
      </DashboardSection>

      <DashboardSection icon={Database} title="Booking Snapshot">
        <SnapshotRow label="Route" value={model.booking.route} />
        <SnapshotRow label="Time" value={model.booking.time} />
        <SnapshotRow label="Seats" value={model.booking.seats} />
        <SnapshotRow label="Price" value={model.booking.price} />
        <SnapshotRow label="Deposit" value={model.booking.deposit} />
        <SnapshotRow label="Phone" value={model.booking.phone} />
      </DashboardSection>

      <DashboardSection icon={Shield} title="Ledger & Trust" tone={ledgerTone}>
        <div className={`phone-dashboard-ledger-status ${ledgerTone}`}>
          {model.ledger.status === "mismatch" ? <ShieldAlert size={14} /> : <CheckCircle2 size={14} />}
          <span>{ledgerLabel}</span>
        </div>
        {isTampered && (
          <div className="phone-dashboard-warning">
            <AlertTriangle size={13} />
            <span>Booking snapshot changed after proof anchor.</span>
          </div>
        )}
        <SnapshotRow label="Tx Sig" value={model.ledger.txSig} />
        <SnapshotRow label="Anchored" value={model.ledger.anchoredHash} />
        <SnapshotRow label="Computed" value={model.ledger.computedHash} />
        <div className="phone-dashboard-mini-meta">
          <Timer size={11} />
          <span>Proof is generated only after deposit confirmation.</span>
        </div>
      </DashboardSection>
    </div>
  );
}
