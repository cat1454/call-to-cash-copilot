import { QrCode, Timer } from "lucide-react";
import { REFUND_POLICY } from "../../../data/refundPolicy";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/cn";

export default function PhonePaymentDrawer({
  showPaymentDrawer,
  bookingData,
  drawerTimerText,
  simulateWalletPayment,
  btnPhonePayDisabled,
  btnPhonePayBg,
  btnPhonePayText
}) {
  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-99",
        "flex flex-col gap-4 rounded-t-[24px] border-t border-[#e5e7eb] bg-white px-4 pb-4 pt-5",
        "shadow-[0_-8px_30px_rgba(0,0,0,0.06)]",
        "transition-transform duration-400 ease-[cubic-bezier(0.25,0.8,0.25,1)]",
        showPaymentDrawer ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="w-9 h-1 bg-[#d1d5db] rounded-full self-center mb-1" />

      <div className="flex items-center justify-center gap-2 text-center text-sm leading-5 font-semibold text-[#111827] text-balance">
        <QrCode size={16} className="text-[#059669]" />
        <span>
          Cọc bằng <span className="text-[#059669]">Solana Pay</span>
        </span>
      </div>

      <div className="flex items-end justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
        <span className="text-xs leading-4 font-medium text-[#6b7280]">Tiền cọc:</span>
        <span className="text-xl leading-7 font-semibold text-[#059669] tabular-nums">{bookingData.deposit}</span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="w-[125px] h-[125px] bg-white rounded-lg border border-[#e5e7eb] p-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2.5px] bg-[#059669] shadow-[0_0_6px_rgba(5,150,105,0.4)] [animation:scan_2s_linear_infinite]" />
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=115x115&data=solana:pubkey?amount=0.05%26label=CallToCash%26message=Booking_Deposit`}
            alt="Solana Pay QR"
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center gap-2 text-xs leading-4 font-medium text-[#92400e] tabular-nums">
          <Timer size={14} className="shrink-0" />
          <span>{drawerTimerText}</span>
        </div>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={simulateWalletPayment}
        disabled={btnPhonePayDisabled}
        style={btnPhonePayBg ? { background: btnPhonePayBg } : undefined}
        className="w-full"
      >
        {btnPhonePayText}
      </Button>

      <p className="text-center text-xs leading-[18px] font-normal text-[#6b7280] text-balance">
        * {REFUND_POLICY.customerSummary} Chính sách {REFUND_POLICY.id} v{REFUND_POLICY.version}.
      </p>
    </div>
  );
}
