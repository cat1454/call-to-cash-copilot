import {
    ArrowRight,
    BadgeCheck,
    CheckCircle2,
    CircleAlert,
    FileCheck2,
    Headphones,
    Play,
    Radio,
    ShieldCheck,
    Sparkles,
    WalletCards,
    Zap,
} from "lucide-react";

const verifiedSignals = [
    "Tuyến đường và giờ đi đã được xác nhận",
    "SĐT liên hệ khớp với booking đang tạo",
    "Khách nói rõ ý định đồng ý đặt cọc",
    "Không phát hiện chi tiết mâu thuẫn",
];

const proofPills = [
    {
        icon: Headphones,
        label: "Nghe ý định khách hàng",
    },
    {
        icon: ShieldCheck,
        label: "Xác minh trước khi cọc",
    },
    {
        icon: FileCheck2,
        label: "Biên nhận có thể truy vết",
    },
];

function ScoreRing({ value = 86 }) {
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

function LiveCallPreview() {
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

export default function Hook({
    onPrimaryAction,
    onSecondaryAction,
    onProofAction,
    onCampaignAction,
    campaignText = "1.000 cuộc gọi đầu tiên miễn phí trước khi tính phí theo cuộc.",
}) {
    return (
        <section
            id="hook"
            aria-labelledby="hook-heading"
            className="border-b border-[#e5e7eb] bg-white"
        >
            <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
                <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-10 xl:gap-14">
                    {/* Left: product hook and CTA */}
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-2.5 py-1 text-[11px] leading-4 font-medium text-[#047857]">
                            <Sparkles size={13} strokeWidth={2.2} aria-hidden="true" />
                            Voice-to-deposit intelligence
                        </div>

                        <h1
                            id="hook-heading"
                            className="mt-4 max-w-5xl text-[clamp(2.35rem,4.15vw,4.25rem)] leading-[0.98] font-bold tracking-[-0.055em] text-[#111827]"
                        >
                            {/* Đừng để khách nói{" "}
                            <span className="text-[#059669]"> “để xem đã” </span>

                            rồi biến mất.
                            <br /> */}
                            Chốt đơn đặt vé{" "}
                            <br />
                            <span className="text-[#059669]">
                                trước khi{" "}
                            </span>
                            họ cúp máy.
                        </h1>

                        <p className="mt-5 max-w-[610px] text-sm leading-6 text-[#4b5563] sm:text-[15px] sm:leading-6">
                            Call-to-Cash nghe cuộc gọi, nhận diện ý định, kiểm tra chi tiết
                            booking và chỉ mở yêu cầu cọc khi khách đã xác nhận rõ ràng.
                            Mỗi quyết định đều có bằng chứng để đội vận hành đối chiếu.
                        </p>

                        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                            <button
                                type="button"
                                onClick={onPrimaryAction}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#059669] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(5,150,105,0.18)] transition-[background-color,transform,box-shadow] duration-200 hover:bg-[#047857] hover:shadow-[0_10px_22px_rgba(5,150,105,0.24)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]"
                            >
                                Chạy thử cuộc gọi
                                <ArrowRight size={15} strokeWidth={2.4} aria-hidden="true" />
                            </button>

                            <button
                                type="button"
                                onClick={onSecondaryAction}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#d1d5db] bg-white px-4 text-[13px] font-semibold text-[#374151] transition-[background-color,transform,border-color] duration-200 hover:border-[#9ca3af] hover:bg-[#f9fafb] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]"
                            >
                                <Play size={15} strokeWidth={2.3} aria-hidden="true" />
                                Xem demo luồng cọc
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={onProofAction}
                            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3.5 text-[13px] font-semibold text-[#374151] transition-[background-color,transform,border-color] duration-200 hover:border-[#a7f3d0] hover:bg-[#f0fdf4] hover:text-[#047857] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]"
                        >
                            <BadgeCheck size={15} strokeWidth={2.2} aria-hidden="true" />
                            Xem bằng chứng xác thực
                        </button>
                    </div>

                    {/* Right: compact proof panel */}
                    <div className="min-w-0">
                        <LiveCallPreview />
                    </div>
                </div>

                {/* Trust chips */}
                <div className="mt-7 flex flex-wrap gap-2 lg:mt-8">
                    {proofPills.map(({ icon: Icon, label }) => (
                        <div
                            key={label}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 text-[11px] leading-4 font-medium text-[#4b5563] shadow-[0_3px_10px_rgba(15,23,42,0.025)]"
                        >
                            <Icon
                                size={14}
                                strokeWidth={2.2}
                                className="text-[#059669]"
                                aria-hidden="true"
                            />
                            {label}
                        </div>
                    ))}
                </div>

                {/* Compact founder offer */}
                <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#d1fae5] bg-[#f0fdf4] p-4 sm:p-5 lg:mt-8 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#059669] shadow-sm">
                            <Zap size={18} strokeWidth={2.2} aria-hidden="true" />
                        </span>

                        <div>
                            <p className="text-[13px] leading-5 font-semibold text-[#047857]">
                                Founding operator program
                            </p>

                            <p className="mt-0.5 text-xs leading-5 text-[#374151]">
                                {campaignText}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onCampaignAction}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#059669] bg-white px-3.5 text-[13px] font-semibold text-[#047857] transition-[background-color,transform,color] duration-200 hover:bg-[#059669] hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669]"
                    >
                        Đăng ký batch đầu
                        <ArrowRight size={15} strokeWidth={2.3} aria-hidden="true" />
                    </button>
                </div>

                {/* Safety signal */}
                <div className="mt-4 flex items-start gap-1.5 text-[11px] leading-4 text-[#6b7280]">
                    <CircleAlert
                        size={14}
                        strokeWidth={2}
                        className="mt-0.5 shrink-0 text-[#f59e0b]"
                        aria-hidden="true"
                    />
                    <span>
                        Không tự động thu tiền. Hệ thống chỉ tạo yêu cầu cọc sau khi điều
                        kiện đã được xác thực trong cuộc gọi.
                    </span>
                </div>
            </div>
        </section>
    );
}