/** Fast-path only; durable idempotency remains the transcript table's unique provider id. */
export class TranscriptDeduplicator {
  private readonly seen = new Set<string>();

  accept(providerTurnId: string): boolean {
    if (this.seen.has(providerTurnId)) return false;
    this.seen.add(providerTurnId);
    return true;
  }
}
