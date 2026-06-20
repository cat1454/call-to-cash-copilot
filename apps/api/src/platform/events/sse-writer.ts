export function ssePayload(events: unknown[]): string {
  return events
    .map((event) => {
      const envelope = event as { event: string; eventId: string };
      return `event: ${envelope.event}\nid: ${envelope.eventId}\ndata: ${JSON.stringify(event)}\n\n`;
    })
    .join("");
}
