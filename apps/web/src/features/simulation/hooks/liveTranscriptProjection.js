import { applyTranscriptFrame } from "@call-to-cash/shared";

import { projectTranscriptTurnForDisplay, sanitizePublicText } from "./transcriptDisplayProjection.js";

function speakerToSender(speaker) {
  return speaker === "CUSTOMER" ? "customer" : "ai";
}

function speakerLabelForSender(sender) {
  return sender === "customer" ? "Khách hàng" : "Tổng đài AI";
}

function liveTurnToBubble(turn, timestamp) {
  const text = sanitizePublicText(turn.displayText);
  if (text.length === 0) return null;
  return {
    sender: speakerToSender(turn.speaker),
    text,
    turnId: turn.providerTurnId,
    providerTurnId: turn.providerTurnId,
    authoritative: false,
    final: turn.final,
    ...(timestamp === undefined ? {} : { timestamp })
  };
}

function sameDisplayTurn(left, right) {
  return left?.sender === right?.sender && left?.text === right?.text;
}

export function subtitleForBubble(bubble) {
  return {
    speaker: speakerLabelForSender(bubble.sender),
    text: bubble.text
  };
}

export function projectAuthoritativeTranscriptTurn(turn) {
  return projectTranscriptTurnForDisplay(turn);
}

export function projectRecoveredTranscript(turns) {
  return [...turns]
    .sort((left, right) => left.sequenceNo - right.sequenceNo)
    .filter((turn, index, allTurns) => allTurns.findIndex((item) => item.turnId === turn.turnId) === index)
    .map(projectAuthoritativeTranscriptTurn);
}

export function mergeAuthoritativeTranscriptTurn(transcript, turn) {
  const displayTurn = projectAuthoritativeTranscriptTurn(turn);
  const duplicateIndex = transcript.findIndex((bubble) => bubble.turnId === displayTurn.turnId);
  if (duplicateIndex >= 0) return { transcript, displayTurn, changed: false };

  const liveIndex = transcript.findIndex(
    (bubble) => bubble.authoritative === false && sameDisplayTurn(bubble, displayTurn)
  );
  if (liveIndex >= 0) {
    const merged = [...transcript];
    merged[liveIndex] = displayTurn;
    return { transcript: merged, displayTurn, changed: true };
  }

  return { transcript: [...transcript, displayTurn], displayTurn, changed: true };
}

export function applyLiveTranscriptFrame(state, frame) {
  const applied = applyTranscriptFrame(state.liveTranscriptTurns ?? [], frame);
  if (!applied.changed) return state;

  const liveTurn = applied.turns.find(
    (turn) => turn.providerTurnId === frame.providerTurnId && turn.speaker === frame.speaker
  );
  const bubble = liveTurnToBubble(liveTurn, frame.timestamp);
  if (bubble === null) return { ...state, liveTranscriptTurns: applied.turns };

  const existingIndex = state.transcript.findIndex(
    (turn) => turn.providerTurnId === bubble.providerTurnId || turn.turnId === bubble.turnId
  );
  const transcript = [...state.transcript];
  if (existingIndex >= 0) transcript[existingIndex] = { ...transcript[existingIndex], ...bubble };
  else transcript.push(bubble);

  return {
    ...state,
    liveTranscriptTurns: applied.turns,
    transcript,
    subtitles: subtitleForBubble(bubble)
  };
}
