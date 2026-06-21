import { Check, Copy, ExternalLink, LoaderCircle, QrCode, Timer } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/Button";
import { REFUND_POLICY } from "../../../data/refundPolicy";
import { cn } from "../../../lib/cn";
import { SolanaPayQR } from "./SolanaPayQR";

function SolanaDevnetSection({ providerPayment }) {
  const [copied, setCopied] = useState(false);
  const solanaPayUrl = providerPayment?.solanaPayUrl ?? "";

  const handleCopy = async () => {
    if (!solanaPayUrl) return;
    try {
      await navigator.clipboard.writeText(solanaPayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-[#fcd34d] bg-[#fffbeb] p-3 text-xs leading-[18px] text-[#92400e]">
        <span>Chỉ là giao dịch chứng minh trên Devnet, không phải thanh toán thật.</span>
        <strong className="shrink-0 whitespace-nowrap tabular-nums">
          {providerPayment?.amountSol} SOL
        </strong>
      </div>

      <section className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#374151]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#059669] text-[10px] text-white">
            1
          </span>
          Gửi giao dịch bằng Phantom
        </div>

        <a
          href={solanaPayUrl || undefined}
          aria-disabled={!solanaPayUrl}
          className={cn(
            "hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 text-sm font-semibold text-white",
            "active:scale-[0.96] transition-transform duration-150 motion-reduce:transition-none",
            "max-[768px]:flex",
            !solanaPayUrl && "pointer-events-none opacity-50"
          )}
        >
          <ExternalLink size={16} aria-hidden="true" />
          Mở trong Phantom
        </a>

        <div className="flex flex-col items-center gap-2 max-[768px]:hidden">
          <p className="text-center text-xs text-[#6b7280]">Quét bằng Phantom trên điện thoại</p>
          {solanaPayUrl ? (
            <SolanaPayQR url={solanaPayUrl} size={148} />
          ) : (
            <div className="flex h-[148px] w-[148px] items-center justify-center rounded-xl bg-[#e5e7eb] text-xs text-[#9ca3af]">
              Đang tạo QR…
            </div>
          )}
        </div>

        <details className="mt-3 text-xs text-[#6b7280]">
          <summary className="min-h-11 cursor-pointer content-center text-center font-medium">
            Không mở được Phantom?
          </summary>
          <button
            type="button"
            id="copy-solana-pay-url"
            onClick={handleCopy}
            className={cn(
              "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3",
              "font-medium transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
              copied
                ? "border-[#10b981]/40 bg-[#ecfdf5] text-[#059669]"
                : "border-[#d1d5db] bg-white text-[#6b7280]"
            )}
          >
            {copied ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            {copied ? "Đã sao chép liên kết" : "Sao chép liên kết thanh toán"}
          </button>
        </details>
      </section>

      <section className="flex items-center gap-3 rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] p-3 text-xs text-[#065f46]">
        <LoaderCircle
          size={18}
          aria-hidden="true"
          className="shrink-0 animate-spin motion-reduce:animate-none"
        />
        <div>
          <strong className="block font-semibold">Tự động chờ xác nhận</strong>
          <span className="leading-[18px]">Bạn không cần sao chép mã giao dịch.</span>
        </div>
      </section>
    </div>
  );
}

export default function PhonePaymentDrawer({
  showPaymentDrawer,
  bookingData,
  paymentIntent,
  drawerTimerText,
  simulateWalletPayment,
  btnPhonePayDisabled,
  btnPhonePayBg,
  btnPhonePayText
}) {
  const isSolanaDevnet = paymentIntent?.provider === "solana_devnet";
  const providerPayment = paymentIntent?.providerPayment;

  const submitPayment = () => {
    void simulateWalletPayment();
  };

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-99 flex max-h-full flex-col overflow-hidden",
        "rounded-t-[24px] border-t border-[#e5e7eb] bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.06)]",
        "transition-transform duration-400 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
        showPaymentDrawer ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="min-h-0 overflow-y-auto px-4 pb-3 pt-4">
        <div className="mb-3 h-1 w-9 rounded-full bg-[#d1d5db] mx-auto" />
        <div className="mb-3 flex items-center justify-center gap-2 text-center text-sm font-semibold leading-5 text-[#111827] text-balance">
          <QrCode size={16} className="text-[#059669]" />
          <span>{isSolanaDevnet ? "Xác minh thanh toán Devnet" : "Thanh toán mô phỏng"}</span>
        </div>
        <div className="mb-3 flex items-end justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
          <span className="text-xs font-medium leading-4 text-[#6b7280]">Tiền cọc đơn hàng:</span>
          <span className="text-xl font-semibold leading-7 text-[#059669] tabular-nums">
            {bookingData.deposit}
          </span>
        </div>

        {isSolanaDevnet ? (
          <SolanaDevnetSection providerPayment={providerPayment} />
        ) : (
          <p className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3 text-center text-xs leading-[18px] text-[#6b7280]">
            Máy chủ sẽ xác minh số tiền, người nhận và mã tham chiếu.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-[#e5e7eb] bg-white px-4 pb-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <div className="mb-2 flex items-center justify-center gap-2 text-xs font-medium leading-4 text-[#92400e] tabular-nums">
          <Timer size={14} className="shrink-0" />
          <span>{drawerTimerText}</span>
        </div>
        {!isSolanaDevnet && (
          <Button
            variant="primary"
            size="lg"
            onClick={submitPayment}
            disabled={btnPhonePayDisabled}
            style={btnPhonePayBg ? { background: btnPhonePayBg } : undefined}
            className="w-full"
          >
            {btnPhonePayText || "Mô phỏng thanh toán"}
          </Button>
        )}
        <p className="mt-2 text-center text-[10px] leading-[14px] text-[#6b7280] text-balance">
          {REFUND_POLICY.customerSummary} · {REFUND_POLICY.id} v{REFUND_POLICY.version}
        </p>
      </div>
    </div>
  );
}
