import { AlertTriangle, Radio } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { getVoiceConnectionPresentation } from "./connectionState";

export function LiveVoiceStatus({ state, onRetry, onReplay, onEnd }) {
  const status = getVoiceConnectionPresentation(state);
  return (
    <section
      className={`rounded-xl border p-3 text-xs ${
        status.failed
          ? "border-[#fcd34d] bg-[#fffbeb] text-[#78350f]"
          : "border-[#d1fae5] bg-[#ecfdf5] text-[#065f46]"
      }`}
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {status.failed ? <AlertTriangle size={16} /> : <Radio size={16} />}
        <div className="min-w-0">
          <p className="font-semibold">{status.title}</p>
          <p className="mt-1 leading-[18px]">{status.action}</p>
          <p className="mt-1 leading-[18px] opacity-80">{status.safety}</p>
        </div>
      </div>
      {status.failed && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Button size="sm" onClick={onRetry}>Thử lại thoại trực tiếp</Button>
          <Button size="sm" variant="secondary" onClick={onReplay}>Dùng bản phát lại</Button>
          <Button size="sm" variant="ghost" onClick={onEnd}>Kết thúc phiên</Button>
        </div>
      )}
    </section>
  );
}
