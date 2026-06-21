export function toError(caught) {
  return caught instanceof Error ? caught : new Error(String(caught));
}

export function idempotencyKey(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
}
