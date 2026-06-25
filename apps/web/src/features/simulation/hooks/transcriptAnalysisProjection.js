import { formatDepartureTime } from "./bookingDisplayFormatters.js";
import { sanitizePublicText } from "./transcriptDisplayProjection.js";

export function projectTranscriptAnalysisForDecision(analysis) {
  const understood = analysis?.understood ?? {};
  const route = [understood.routeFrom, understood.routeTo].filter(Boolean).join(" → ");
  const parts = [
    route ? `Tuyến: ${sanitizePublicText(route)}` : "",
    understood.departureAt ? `Giờ: ${formatDepartureTime(understood.departureAt)}` : "",
    understood.passengerCount ? `Khách: ${understood.passengerCount}` : "",
    understood.contactPhoneMasked ? `SĐT: ${sanitizePublicText(understood.contactPhoneMasked)}` : ""
  ].filter(Boolean);
  const missingFields = Array.isArray(analysis?.missingFields)
    ? analysis.missingFields.map((field) => sanitizePublicText(field))
    : [];
  return {
    extractionId: analysis.extractionId,
    understood: parts.join(", ") || "Đang nhận diện giọng nói...",
    missingFields,
    missing:
      missingFields.length === 0
        ? "Thông tin đã đủ. Cần khách xác nhận đồng ý đặt cọc."
        : missingFields.join(", "),
    nextQuestion: sanitizePublicText(analysis.nextQuestion),
    contradictions: Array.isArray(analysis.contradictions) ? analysis.contradictions : []
  };
}
