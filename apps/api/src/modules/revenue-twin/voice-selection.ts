export type VoiceSelectableOffer = {
  offerId: string;
  scheduledAt: string;
};

export type RevenueTwinVoiceSelection =
  | { kind: "ACCEPT"; offerId: string }
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
    return date.getUTCHours() === hours && date.getUTCMinutes() === minutes;
  });
}

/** Avoid treating a stored-offer selection phrase as new booking facts. */
export function mayContainRevenueTwinVoiceSelection(content: string): boolean {
  const normalized = normalize(content);
  return (
    /\b(?:chot|chon) chuyen (?:dau tien|thu nhat)\b/u.test(normalized) ||
    /\bchuyen nao cung duoc\b/u.test(normalized) ||
    /\b\d{1,2}\s*(?:gio|h)(?:\s*\d{1,2})?\b/u.test(normalized) ||
    /^(?:duoc|dong y|ok|okay)[.! ]*$/u.test(normalized)
  );
}

/** Pure, deliberately conservative Vietnamese intent mapping for stored offers only. */
export function resolveRevenueTwinVoiceSelection(
  content: string,
  offers: readonly VoiceSelectableOffer[]
): RevenueTwinVoiceSelection {
  const normalized = normalize(content);
  if (offers.length === 0 || normalized.length === 0) return { kind: "NONE" };
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
    where: {
      callSession: { publicId: input.callId },
      offers: { some: { status: "OPEN", expiresAt: { gt: now } } }
    },
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
import type { DatabaseClient } from "@call-to-cash/db";

import { createRevenueTwinHandlers } from "./revenue-twin.handlers.js";
