import { Sparkles, HelpCircle, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Card, CardBody } from "../../../components/ui/Card";
import { SectionHeading } from "../../../components/ui/SectionHeading";

function DecisionRow({ icon: Icon, iconColor, label, value, valueStyle }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#f3f4f6] py-3 last:border-0">
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: iconColor }} />
        <span className="text-xs leading-4 font-medium text-[#6b7280]">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "min-w-0 break-words text-sm leading-5 font-normal text-[#374151]",
          valueStyle
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function AIDecisionPanel({ decision }) {
  const gateIsOpen =
    decision.gate === "ĐÃ MỞ / SẴN SÀNG" ||
    decision.gate === "ĐÃ XÁC THỰC / KHÓA" ||
    decision.gate === "Confirmed / Anchored";

  const riskIsHigh =
    decision.risk !== "AN TOÀN / THẤP" && decision.risk !== "N/A";

  return (
    <Card>
      <div className="px-5 pb-2 pt-5">
        <SectionHeading icon={<Sparkles size={13} />}>
          Trợ Lý Giám Sát Giao Dịch AI
        </SectionHeading>
      </div>
      <CardBody className="gap-0 px-5 pb-5 pt-0">
        <DecisionRow
          icon={Sparkles}
          iconColor="#059669"
          label="Thông tin hành trình đã nhận diện"
          value={decision.understood}
        />
        <DecisionRow
          icon={HelpCircle}
          iconColor="#f59e0b"
          label="Chi tiết hành trình cần thu thập"
          value={decision.missing}
          valueStyle={decision.missing.includes("Không") ? "text-[#10b981] font-semibold" : ""}
        />
        <DecisionRow
          icon={TrendingUp}
          iconColor={riskIsHigh ? "#f59e0b" : "#059669"}
          label="Độ rủi ro đàm thoại"
          value={decision.risk}
          valueStyle={cn(
            "font-bold",
            riskIsHigh ? "text-[#92400e]" : decision.risk === "N/A" ? "text-[#9ca3af]" : "text-[#10b981]"
          )}
        />
        <DecisionRow
          icon={ShieldCheck}
          iconColor={gateIsOpen ? "#10b981" : "#f59e0b"}
          label="Cổng thanh toán cọc"
          value={decision.gate}
          valueStyle={cn(
            "text-sm leading-5 font-semibold",
            gateIsOpen ? "text-[#10b981]" : "text-[#92400e]"
          )}
        />
        <DecisionRow
          icon={ArrowRight}
          iconColor="#6b7280"
          label="Hành động gợi ý tiếp theo"
          value={decision.next}
          valueStyle="italic text-[#6b7280]"
        />
      </CardBody>
    </Card>
  );
}
