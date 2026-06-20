import {
    ArrowRight,
    BadgeCheck,
    CircleAlert,
    FileCheck2,
    Headphones,
    Play,
    ShieldCheck,
    Sparkles,
    Zap,
} from "lucide-react";
import { LiveCallPreview } from "../features/simulation/components/HeroSubComponents";

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