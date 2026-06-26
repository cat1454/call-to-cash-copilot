import type { DatabaseClient } from "@call-to-cash/db";

import { createRevenueTwinHandlers } from "./revenue-twin.handlers.js";

export type VoiceSelectableOffer = {
  offerId: string;
  scheduledAt: string;
};

export type RevenueTwinVoiceSelection =
  | { kind: "ACCEPT"; offerId: string }
  | { kind: "WAITLIST" }
  | { kind: "CLARIFY" }
  | { kind: "NONE" };

function normalize(content: string): string {
  return content
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/đ/gu, "d")
    .replace(/\s+/gu, " ")
    .trim();
}

function matchingOfferByTime(content: string, offers: readonly VoiceSelectableOffer[]) {
  const match = content.match(/\b(\d{1,2})\s*(?:gio|h)(?:\s*(\d{1,2}))?\b/u);
  if (match === null) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return undefined;
  }
  return offers.find((offer) => {
    const date = new Date(offer.scheduledAt);
    const vietnamHour = (date.getUTCHours() + 7) % 24;
    return vietnamHour === hours && date.getUTCMinutes() === minutes;
  });
}

/** Avoid treating a stored-offer selection phrase as new booking facts. */
export function mayContainRevenueTwinVoiceSelection(content: string): boolean {
  const normalized = normalize(content);
  return (
    /\b(?:chot|chon) chuyen (?:dau tien|thu nhat)\b/u.test(normalized) ||
    /\b(?:vao )?(?:danh sach cho|waitlist)\b/u.test(normalized) ||
    /\bchuyen nao cung duoc\b/u.test(normalized) ||
    /\b(?:di|chot|chon|lay|doi|qua|sang|chuyen sang)\s+(?:chuyen\s+)?\d{1,2}\s*(?:gio|h)(?:\s*\d{1,2})?\b/u.test(
      normalized
    ) ||
    /\bchuyen\s+\d{1,2}\s*(?:gio|h)(?:\s*\d{1,2})?\b/u.test(normalized) ||
    /^(?:duoc|dong y|ok|okay)[.! ]*$/u.test(normalized)
  );
}

/** Pure, deliberately conservative Vietnamese intent mapping for stored offers only. */
export function resolveRevenueTwinVoiceSelection(
  content: string,
  offers: readonly VoiceSelectableOffer[]
): RevenueTwinVoiceSelection {
  const normalized = normalize(content);
  if (normalized.length === 0) return { kind: "NONE" };
  if (/\b(?:vao )?(?:danh sach cho|waitlist)\b/u.test(normalized)) return { kind: "WAITLIST" };
  if (offers.length === 0) return { kind: "NONE" };
  if (/\bchuyen nao cung duoc\b/u.test(normalized)) return { kind: "CLARIFY" };
  if (/\b(?:chot|chon) chuyen (?:dau tien|thu nhat)\b/u.test(normalized)) {
    return { kind: "ACCEPT", offerId: offers[0]!.offerId };
  }
  const timeMatch = matchingOfferByTime(normalized, offers);
  if (timeMatch !== undefined) return { kind: "ACCEPT", offerId: timeMatch.offerId };
  if (/^(?:duoc|dong y|ok|okay)[.! ]*$/u.test(normalized)) {
    return offers.length === 1
      ? { kind: "ACCEPT", offerId: offers[0]!.offerId }
      : { kind: "CLARIFY" };
  }
  return { kind: "NONE" };
}

/** Applies only an unambiguous selection derived from a persisted final customer turn. */
export async function applyRevenueTwinVoiceSelection(
  client: DatabaseClient,
  input: { callId: string; turnId: string; content: string; requestId: string }
): Promise<RevenueTwinVoiceSelection> {
  const now = new Date();
  const evaluation = await client.revenueTwinEvaluation.findFirst({
    where: { callSession: { publicId: input.callId } },
    include: {
      offers: {
        where: { status: "OPEN", expiresAt: { gt: now } },
        include: { alternativeDeparture: { select: { departureAtUtc: true } } },
        orderBy: { rank: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  });
  if (evaluation === null) return { kind: "NONE" };
  const selection = resolveRevenueTwinVoiceSelection(
    input.content,
    evaluation.offers.map((offer) => ({
      offerId: offer.publicId,
      scheduledAt: offer.alternativeDeparture.departureAtUtc.toISOString()
    }))
  );
  if (selection.kind === "WAITLIST") {
    await createRevenueTwinHandlers(client).joinWaitlist(
      input.callId,
      {
        callId: input.callId,
        evaluationId: evaluation.publicId,
        idempotencyKey: `rtw-wait-${input.turnId}`
      },
      input.requestId
    );
    return selection;
  }
  if (selection.kind !== "ACCEPT") return selection;
  await createRevenueTwinHandlers(client).accept(
    input.callId,
    selection.offerId,
    {
      callId: input.callId,
      evaluationId: evaluation.publicId,
      offerId: selection.offerId,
      idempotencyKey: `rtw-voice-${input.turnId}`
    },
    input.requestId
  );
  return selection;
}
