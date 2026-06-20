import {
  CheckCircle2,
  Radio,
  WalletCards,
} from "lucide-react";

const verifiedSignals = [
  "Tuyến đường và giờ đi đã được xác nhận",
  "SĐT liên hệ khớp với booking đang tạo",
  "Khách nói rõ ý định đồng ý đặt cọc",
  "Không phát hiện chi tiết mâu thuẫn",
];

export function ScoreRing({ value = 86 }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex h-[104px] w-[104px] shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 112 112"
        className="h-full w-full -rotate-90"
        aria-label={`Điểm tin cậy ${value} trên 100`}
        role="img"
      >
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="8"
        />

        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#059669"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[27px] leading-none font-bold tracking-[-0.06em] text-[#111827]">
          {value}
        </span>

        <span className="mt-0.5 text-[10px] leading-3 font-medium text-[#6b7280]">
          /100
        </span>
      </div>
    </div>
  );
}

export function LiveCallPreview() {
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-[#e5e7eb] bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_64%)]"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5] text-[#059669]">
              <Radio size={14} strokeWidth={2.4} />
            </span>

            <div className="min-w-0">
              <p className="text-[10px] leading-3 font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
                Live call preview
              </p>

              <p className="mt-0.5 truncate text-[13px] leading-5 font-semibold text-[#111827]">
                Tổng đài xe khách Sa Pa
              </p>
            </div>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-2 py-1 text-[10px] leading-3 font-semibold text-[#047857]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
            Đủ điều kiện cọc
          </span>
        </div>

        <div className="mt-4 grid gap-4 border-b border-[#e5e7eb] pb-4 sm:grid-cols-[104px_minmax(0,1fr)] sm:items-center">
          <div className="flex justify-center sm:justify-start">
            <ScoreRing value={86} />
          </div>

          <div>
            <p className="text-[10px] leading-3 font-semibold uppercase tracking-[0.1em] text-[#6b7280]">
              Tín hiệu đã xác thực
            </p>

            <ul className="mt-2.5 space-y-2">
              {verifiedSignals.map((signal) => (
                <li
                  key={signal}
                  className="flex items-start gap-1.5 text-xs leading-4 text-[#374151]"
                >
                  <CheckCircle2
                    size={14}
                    strokeWidth={2.4}
                    className="mt-0.5 shrink-0 text-[#059669]"
                    aria-hidden="true"
                  />

                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-[#d1fae5] bg-[#f0fdf4] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <WalletCards
              size={16}
              strokeWidth={2.2}
              className="mt-0.5 shrink-0 text-[#059669]"
              aria-hidden="true"
            />

            <p className="text-xs leading-4 text-[#374151]">
              Sau xác minh:
              <span className="ml-1 font-semibold text-[#047857]">
                gửi yêu cầu cọc đúng ngữ cảnh.
              </span>
            </p>
          </div>

          <span className="shrink-0 text-[11px] leading-4 font-semibold text-[#059669]">
            02:14 call time
          </span>
        </div>
      </div>
    </div>
  );
}
