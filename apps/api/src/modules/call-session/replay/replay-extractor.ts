import { maskPhone } from "../call-session.presenter.js";
import type { ExtractedFacts } from "../types.js";
import { normalizeForSearch } from "./replay-normalizer.js";

export function extractReplayFacts(content: string): ExtractedFacts {
  const normalized = normalizeForSearch(content);
  const phone = content.match(/\b0\d{8,10}\b/u)?.[0];
  const passengerCount =
    normalized.match(/(\d+)\s*(ve|khach|nguoi|cho)/u)?.[1] ??
    normalized
      .match(/\b\d{1,2}\b/gu)
      ?.map(Number)
      .find((value) => value > 0 && value <= 36)
      ?.toString();
  const mentionsSapa = /sa\s*pa|sapa/u.test(normalized);
  const mentionsMyDinh =
    normalized.includes("my dinh") ||
    normalized.includes("m? ??nh") ||
    (normalized.includes("m") && normalized.includes("nh") && normalized.includes("?"));

  return {
    ...(normalized.includes("ha noi") || normalized.includes("hanoi") || mentionsSapa
      ? { routeFrom: "Ha Noi" }
      : {}),
    ...(mentionsSapa ? { routeTo: "Sa Pa" } : {}),
    ...(passengerCount !== undefined ? { passengerCount: Number(passengerCount) } : {}),
    ...(mentionsMyDinh ? { pickupPoint: "My Dinh" } : {}),
    ...(phone !== undefined ? { contactPhoneMasked: maskPhone(phone) } : {}),
    ...(/22[:h ]?30/u.test(normalized) ? { departureHint: "22:30" as const } : {})
  };
}
