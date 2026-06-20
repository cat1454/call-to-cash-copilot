import {
  CheckCircle2,
  FileCode2,
  Printer,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { SectionHeading } from "../../../components/ui/SectionHeading";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";

function ProofRow({ label, value, tone = "neutral" }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs leading-4 font-medium text-[#6b7280]">{label}</span>
      <code
        className={cn(
          "min-w-0 break-all rounded-lg border border-[#e5e7eb] bg-white p-3 font-mono text-xs leading-[18px]",
          tone === "primary" ? "text-[#047857]" : "text-[#374151]"
        )}
      >
        {value}
      </code>
    </div>
  );
}

export default function SolanaLedgerCard({
  ledgerLogs,
  isTampered,
  tamperAgreement,
}) {
  if (!ledgerLogs.show) return null;

  return (
    <Card className="bg-[#f9fafb]">
      <CardHeader>
        <SectionHeading icon={<Shield size={16} />}>
          Tóm tắt bằng chứng giao dịch
        </SectionHeading>
      </CardHeader>

      <CardBody className="gap-4 p-5">
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            isTampered
              ? "border-[#f43f5e] bg-[#fff1f2] text-[#be123c]"
              : "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]"
          )}
          role="status"
        >
          {isTampered ? (
            <ShieldAlert size={20} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="text-sm leading-5 font-semibold text-balance">
              {isTampered ? "Cryptographic mismatch detected" : "Payment proof verified"}
            </h3>
            <p className="mt-1 text-xs leading-[18px] font-normal">
              {isTampered
                ? "Agreement data changed after the original proof was anchored. Manual review is required."
                : "The current agreement hash matches the proof captured after deposit confirmation."}
            </p>
          </div>
        </div>

        <details className="rounded-xl border border-[#e5e7eb] bg-[#f3f4f6]">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 text-sm leading-5 font-medium text-[#374151] transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none">
            <FileCode2 size={16} className="shrink-0 text-[#6b7280]" />
            Xem chữ ký và mã băm kỹ thuật
          </summary>
          <div className="flex flex-col gap-4 border-t border-[#e5e7eb] p-4">
            <ProofRow
              label="Mã giao dịch (Tx Signature)"
              value={ledgerLogs.txSig}
              tone="primary"
            />
            <ProofRow
              label="Mã băm lưu trữ (Anchored Hash)"
              value={ledgerLogs.anchoredHash}
            />
            <ProofRow
              label="Mã băm đối soát thực tế"
              value={ledgerLogs.computedHash}
            />
          </div>
        </details>

        <div className="flex flex-col gap-2 min-[420px]:flex-row">
          <Button
            variant="danger"
            size="sm"
            onClick={tamperAgreement}
            className="flex-1 border-[#f43f5e] bg-[#f43f5e] text-white hover:bg-[#e11d48]"
          >
            <ShieldAlert size={14} className="shrink-0" />
            Mô phỏng Tamper
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            className="flex-1"
          >
            <Printer size={14} className="shrink-0" />
            In hóa đơn vé
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
