import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "../../../components/ui/Button";

export function DemoReadinessBanner({ readiness, onRetry }) {
  if (readiness.status === "ready") return null;
  return (
    <section
      className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Demo authoritative chưa sẵn sàng</p>
          <p>{readiness.message}</p>
        </div>
      </div>
      <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden="true" />
        Kiểm tra lại API
      </Button>
    </section>
  );
}
