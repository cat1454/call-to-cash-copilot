import { ArrowRightLeft, BadgeDollarSign, Route, ShieldCheck, Users } from "lucide-react";

import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { SectionHeading } from "../../../components/ui/SectionHeading";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

function Metric({ label, value, tone = "text-[#111827]" }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-3">
      <p className="text-xs font-medium text-[#6b7280]">{label}</p>
      <p className={`mt-1 truncate text-base font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** Safe read model: the panel never submits fare, capacity, policy, or booking authority. */
export default function RevenueTwinJudgePanel({ dashboard = null, status = "demo" }) {
  const metrics = dashboard?.metrics;
  const isLive = status === "live" && metrics !== undefined;

  const priority = isLive ? `${metrics.recoverablePassengerCount} pax` : "5 / 20";
  const saved = isLive ? `${metrics.acceptedPassengerCount} pax` : "2 groups";
  const overflow = isLive ? `${metrics.offersGenerated} offers` : "8 requests";
  const gross = currency.format(isLive ? metrics.potentialGrossRevenueAmountMinor : 200_000);
  const discount = currency.format(isLive ? metrics.potentialDiscountCostAmountMinor : 30_000);
  const revenue = currency.format(isLive ? metrics.securedRecoveredRevenueAmountMinor : 170_000);
  const occupancy = dashboard?.occupancy;
  const fillRate =
    isLive && occupancy?.capacitySeats
      ? `${Math.round((occupancy.afterOccupiedSeats * 100) / occupancy.capacitySeats)}%`
      : "35%";
  const acceptanceRate = isLive
    ? `${Math.round(metrics.offerAcceptanceRateBasisPoints / 100)}%`
    : "70%";
  const routing = isLive
    ? dashboard.routing.map((offer) => [
        String(offer.rank),
        new Date(offer.scheduledAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit"
        }),
        `${offer.availableSeatsAtEvaluation} seats`,
        `-${offer.discountAmountMinor.toLocaleString("vi-VN")} VND`
      ])
    : [
        ["1", "07:30", "12 seats", "-30,000 VND"],
        ["2", "08:00", "15 seats", "-20,000 VND"]
      ];

  return (
    <section aria-labelledby="revenue-twin-heading">
      <Card>
        <CardHeader>
          <SectionHeading icon={<Route size={14} />}>Fleet Revenue Twin</SectionHeading>
          <span className="rounded-full bg-[#ecfdf5] px-2 py-1 text-xs font-semibold text-[#065f46]">
            Scenario-Robust Revenue Rebalancing Optimizer
          </span>
        </CardHeader>
        <CardBody className="gap-4 p-5">
          <div className="rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] p-3 text-xs leading-[18px] text-[#065f46]">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={14} /> {isLive ? "LIVE SAFE PROJECTION" : "DEMO FIXTURE"} · server
              policy bounded
            </div>
            <p className="mt-1">
              No pre-hold, no group split, and no browser or LLM authority over price or capacity.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Revenue recovery KPIs">
            <Metric label="Revenue recovered" value={revenue} tone="text-[#059669]" />
            <Metric label="Bookings saved" value={saved} tone="text-[#059669]" />
            <Metric label="Fleet fill rate" value={fillRate} />
            <Metric label="Offer acceptance" value={acceptanceRate} />
          </div>

          <div>
            <h2
              id="revenue-twin-heading"
              className="text-balance text-sm font-semibold text-[#111827]"
            >
              Priority Allocation
            </h2>
            <p className="mt-1 text-xs leading-[18px] text-[#6b7280]">
              FCFS protects scarce hot-departure seats. A later departure is only a voluntary,
              policy-bounded offer; it never revokes an existing hold.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label={isLive ? "Recoverable" : "07:00"} value={priority} />
              <Metric
                label={isLive ? "Bookings saved" : "FCFS served"}
                value={saved}
                tone="text-[#059669]"
              />
              <Metric label="Overflow" value={overflow} tone="text-[#92400e]" />
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] pt-4">
            <h2 className="flex items-center gap-2 text-balance text-sm font-semibold text-[#111827]">
              <BadgeDollarSign size={14} className="text-[#059669]" /> Dynamic Incentive
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label={isLive ? "Potential gross" : "Fare"} value={gross} />
              <Metric label={isLive ? "Discount cost" : "Policy cap"} value={discount} />
              <Metric
                label={isLive ? "Secured revenue" : "Final offer"}
                value={revenue}
                tone="text-[#059669]"
              />
            </div>
            <p className="mt-2 text-xs leading-[18px] text-[#6b7280]">
              Time-shift and fill-rate tiers are capped by policy, percentage limit, and VND fare
              floor.
            </p>
          </div>

          <div className="border-t border-[#e5e7eb] pt-4">
            <h2 className="flex items-center gap-2 text-balance text-sm font-semibold text-[#111827]">
              <ArrowRightLeft size={14} className="text-[#059669]" /> Overflow Routing
            </h2>
            <ol className="mt-3 space-y-2" aria-label="Ranked overflow alternatives">
              {routing.map(([rank, time, seats, incentive]) => (
                <li
                  key={rank}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[#374151]">
                    <Users size={13} className="shrink-0 text-[#6b7280]" /> #{rank} · {time} ·{" "}
                    {seats}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-[#059669]">
                    {incentive}
                  </span>
                </li>
              ))}
            </ol>
            {isLive && occupancy && (
              <p className="mt-2 text-xs leading-[18px] text-[#6b7280]">
                Occupancy: {occupancy.beforeOccupiedSeats} → {occupancy.afterOccupiedSeats} /{" "}
                {occupancy.capacitySeats} seats.
              </p>
            )}
            <p className="mt-2 text-xs leading-[18px] text-[#6b7280]">
              Same route → verified fleet → full-group capacity → flexibility → policy. Acceptance
              revalidates inventory.
            </p>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
