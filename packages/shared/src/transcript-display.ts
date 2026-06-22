export type TranscriptFrameDelivery = "SNAPSHOT" | "DELTA";

export type TranscriptFrameSpeaker = "CUSTOMER" | "AGENT" | "OPERATOR" | "SYSTEM";

export type TranscriptFrame = {
  providerTurnId: string;
  speaker: TranscriptFrameSpeaker;
  sequence?: number;
  delivery?: TranscriptFrameDelivery;
  final: boolean;
  rawText: string;
};

export type LiveTranscriptTurn = {
  providerTurnId: string;
  speaker: TranscriptFrameSpeaker;
  rawText: string;
  displayText: string;
  lastSequence?: number;
  final: boolean;
};

export type TranscriptFrameApplyResult = {
  turns: LiveTranscriptTurn[];
  changed: boolean;
  finalized: boolean;
  duplicateFinal: boolean;
  stale: boolean;
};

const WORD_LIKE = /[\p{L}\p{N}]/u;
const NUMERIC_SEPARATOR = /(\p{N})\s*([:.])\s*(\p{N})/gu;
const SPACE_BEFORE_PUNCTUATION = /\s+([,.!?;:)\]}])/gu;
const SPACE_AFTER_OPENING = /([([{])\s+/gu;

function isWordLike(value: string): boolean {
  return WORD_LIKE.test(value);
}

function shouldInsertBoundary(left: string, right: string): boolean {
  if (left.length === 0 || right.length === 0) return false;
  if (/\s$/u.test(left) || /^\s/u.test(right)) return false;
  if (/^[,.!?;:)\]}]/u.test(right)) return false;
  if (/[([{]$/u.test(left)) return false;
  return isWordLike(left.at(-1) ?? "") && isWordLike(right.at(0) ?? "");
}

function shouldAddSpaceAfterPunctuation(text: string, index: number): boolean {
  const current = text[index];
  const previous = text[index - 1] ?? "";
  const next = text[index + 1] ?? "";
  if (!current || !next || /\s/u.test(next) || /[)\]}]/u.test(next)) return false;
  if (current === ".") return false;
  if (current === ":" && /\p{N}/u.test(previous) && /\p{N}/u.test(next)) {
    return false;
  }
  return /[,!?;:]/u.test(current) && isWordLike(next);
}

export function normalizeTranscriptDisplayText(value: string): string {
  const compact = value
    .normalize("NFC")
    .replace(NUMERIC_SEPARATOR, "$1$2$3")
    .replace(/\s+/gu, " ")
    .replace(SPACE_BEFORE_PUNCTUATION, "$1")
    .replace(SPACE_AFTER_OPENING, "$1")
    .trim();

  let normalized = "";
  for (let index = 0; index < compact.length; index += 1) {
    const current = compact[index] ?? "";
    normalized += current;
    if (shouldAddSpaceAfterPunctuation(compact, index)) normalized += " ";
  }
  return normalized.replace(/\s+/gu, " ").trim();
}

export function joinTranscriptFragments(left: string, right: string): string {
  if (left.length === 0) return normalizeTranscriptDisplayText(right);
  if (right.length === 0) return normalizeTranscriptDisplayText(left);
  const joined = shouldInsertBoundary(left, right) ? `${left} ${right}` : `${left}${right}`;
  return normalizeTranscriptDisplayText(joined);
}

export function applyTranscriptFrame(
  currentTurns: readonly LiveTranscriptTurn[],
  frame: TranscriptFrame
): TranscriptFrameApplyResult {
  const index = currentTurns.findIndex(
    (turn) => turn.providerTurnId === frame.providerTurnId && turn.speaker === frame.speaker
  );
  const existing = index >= 0 ? currentTurns[index] : undefined;

  if (
    existing?.lastSequence !== undefined &&
    frame.sequence !== undefined &&
    frame.sequence < existing.lastSequence
  ) {
    return {
      turns: [...currentTurns],
      changed: false,
      finalized: false,
      duplicateFinal: false,
      stale: true
    };
  }

  if (existing?.final === true) {
    return {
      turns: [...currentTurns],
      changed: false,
      finalized: false,
      duplicateFinal: frame.final,
      stale: !frame.final
    };
  }

  const delivery = frame.delivery ?? "SNAPSHOT";
  const rawText =
    existing === undefined || delivery === "SNAPSHOT"
      ? frame.rawText
      : joinTranscriptFragments(existing.rawText, frame.rawText);
  const nextTurn: LiveTranscriptTurn = {
    providerTurnId: frame.providerTurnId,
    speaker: frame.speaker,
    rawText,
    displayText: normalizeTranscriptDisplayText(rawText),
    ...(frame.sequence === undefined
      ? existing?.lastSequence === undefined
        ? {}
        : { lastSequence: existing.lastSequence }
      : { lastSequence: frame.sequence }),
    final: frame.final
  };

  const turns = [...currentTurns];
  if (index >= 0) turns[index] = nextTurn;
  else turns.push(nextTurn);

  return {
    turns,
    changed: true,
    finalized: frame.final,
    duplicateFinal: false,
    stale: false
  };
}
