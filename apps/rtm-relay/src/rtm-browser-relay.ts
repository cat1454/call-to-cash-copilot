import { createRequire } from "node:module";

import { chromium, type Browser, type Page } from "playwright-core";

import type { RelayConfig } from "./config.js";
import { AssistantTurnBuffer, deliveryModeForRtmFrame } from "./rtm-delivery.js";
import { RelayTranscriptStats } from "./relay-transcript-stats.js";
import {
  parseRtmTranscriptFrame,
  type RtmTranscriptBinding,
  type RtmTranscriptFrame
} from "./rtm-transcript-frame.js";
import { signJsonPayload } from "./signature.js";

const require = createRequire(import.meta.url);
const rtmScriptPath = require.resolve("agora-rtm/agora-rtm.js");

export type RelaySession = RtmTranscriptBinding & { token: string };

type PendingMessage = { rawMessage: string; publisher: unknown };
type ActiveRelay = {
  browser: Browser;
  page: Page;
  binding: RtmTranscriptBinding;
  pending: PendingMessage[];
  assistantTurns: AssistantTurnBuffer;
};
type BrowserRtmClient = {
  login(input: { token: string }): Promise<void>;
  subscribe(
    channelName: string,
    options?: { withMessage?: boolean; withPresence?: boolean }
  ): Promise<void>;
  logout(): Promise<void>;
  addEventListener(
    event: "message",
    listener: (event: { message?: unknown; publisher?: unknown }) => void
  ): void;
};
type BrowserRtmWindow = Window & {
  AgoraRTM?: { RTM: new (appId: string, uid: string) => BrowserRtmClient };
  ctcForwardRtmTranscript: (message: string, publisher: unknown) => Promise<unknown>;
  ctcAgoraRtmClient?: BrowserRtmClient;
};

export class AgoraRtmBrowserRelay {
  private readonly active = new Map<string, ActiveRelay>();
  private readonly transcriptStats = new RelayTranscriptStats();

  constructor(
    private readonly config: RelayConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async start(session: RelaySession): Promise<void> {
    const existing = this.active.get(session.callId);
    if (existing !== undefined) {
      if (existing.binding.channelName === session.channelName) {
        if (existing.binding.sessionId === session.sessionId) return;
        if (
          existing.binding.sessionId === "PENDING_AGENT" &&
          session.sessionId !== "PENDING_AGENT"
        ) {
          existing.binding.sessionId = session.sessionId;
          existing.binding.agentUid = session.agentUid;
          const pending = existing.pending.splice(0);
          for (const message of pending) {
            this.handleMessage(
              message.rawMessage,
              message.publisher,
              existing.binding,
              existing.assistantTurns
            );
          }
          return;
        }
      }
      await this.stop(session.callId);
    }
    const binding: RtmTranscriptBinding = {
      callId: session.callId,
      channelName: session.channelName,
      sessionId: session.sessionId,
      agentUid: session.agentUid
    };
    const pending: PendingMessage[] = [];
    const assistantTurns = new AssistantTurnBuffer(
      (event) => this.forward(event),
      500,
      undefined,
      undefined,
      (error) => {
        this.transcriptStats.recordForwardFailed("AGENT");
        console.error("RTM transcript forwarding failed", error);
      }
    );
    const browser = await chromium.launch({
      headless: true,
      executablePath: this.config.browserExecutablePath
    });
    try {
      const page = await browser.newPage();
      page.on("console", (msg) => console.log(`[BROWSER LOG] ${msg.type()}: ${msg.text()}`));
      // Agora RTM stores session configuration in localStorage. setContent()
      // creates an opaque about:blank origin, where localStorage is blocked.
      await page.goto(`http://127.0.0.1:${this.config.port}/health`, {
        waitUntil: "domcontentloaded"
      });
      await page.addScriptTag({ path: rtmScriptPath });
      await page.exposeBinding(
        "ctcForwardRtmTranscript",
        async (_source, rawMessage: unknown, publisher: unknown) => {
          this.transcriptStats.recordReceived(rawMessage);
          if (binding.sessionId === "PENDING_AGENT") {
            if (typeof rawMessage === "string" && pending.length < 50) {
              pending.push({ rawMessage, publisher });
            }
            return { accepted: false };
          }
          return { accepted: this.handleMessage(rawMessage, publisher, binding, assistantTurns) };
        }
      );
      await page.evaluate(
        async ({ appId, relayUid, token, channelName }) => {
          const relayWindow = window as unknown as BrowserRtmWindow;
          const agora = relayWindow.AgoraRTM;
          if (agora === undefined) throw new Error("Agora RTM SDK failed to load");
          const client = new agora.RTM(appId, String(relayUid));
          await client.login({ token });
          client.addEventListener(
            "message",
            (event: { message?: unknown; publisher?: unknown }) => {
              const rawMessage =
                typeof event.message === "string"
                  ? event.message
                  : event.message instanceof Uint8Array
                    ? new TextDecoder().decode(event.message)
                    : undefined;
              if (rawMessage !== undefined) {
                void relayWindow.ctcForwardRtmTranscript(rawMessage, event.publisher);
              }
            }
          );

          let subscribed = false;
          for (let i = 0; i < 10; i++) {
            try {
              await client.subscribe(channelName, { withMessage: true, withPresence: false });
              subscribed = true;
              console.log("[BROWSER LOG] Successfully subscribed to RTM channel");
              break;
            } catch {
              console.log(`[BROWSER LOG] Subscribe failed, retrying (${i + 1}/10)...`);
              await new Promise((r) => setTimeout(r, 500));
            }
          }
          if (!subscribed)
            console.log("[BROWSER LOG] ERROR: Failed to subscribe to RTM channel after retries.");

          relayWindow.ctcAgoraRtmClient = client;
        },
        {
          appId: this.config.agoraAppId,
          relayUid: this.config.relayUid,
          token: session.token,
          channelName: session.channelName
        }
      );
      this.active.set(session.callId, { browser, page, binding, pending, assistantTurns });
    } catch (error) {
      await browser.close().catch(() => undefined);
      throw error;
    }
  }

  async stop(callId: string): Promise<void> {
    const active = this.active.get(callId);
    if (active === undefined) return;
    this.active.delete(callId);
    await active.assistantTurns.flush().catch(() => undefined);
    await active.page
      .evaluate(async () => {
        const client = (window as unknown as BrowserRtmWindow).ctcAgoraRtmClient;
        if (client === undefined) return;
        await client.logout().catch(() => undefined);
      })
      .catch(() => undefined);
    await active.browser.close().catch(() => undefined);
  }

  async close(): Promise<void> {
    await Promise.all([...this.active.keys()].map((callId) => this.stop(callId)));
  }

  getStats() {
    return this.transcriptStats.snapshot(this.active.size);
  }

  private handleMessage(
    rawMessage: unknown,
    publisher: unknown,
    binding: RtmTranscriptBinding,
    assistantTurns: AssistantTurnBuffer
  ): boolean {
    const parsed = parseRtmTranscriptFrame(rawMessage, publisher, binding);
    if (!parsed.accepted) {
      this.transcriptStats.recordRejected(parsed.reason, rawMessage);
      return false;
    }
    this.transcriptStats.recordAccepted(parsed.event.turn.speaker);
    if (parsed.event.turn.speaker === "AGENT") {
      assistantTurns.push(parsed.event, deliveryModeForRtmFrame(rawMessage));
    } else {
      void this.forward(parsed.event).catch((error) => {
        this.transcriptStats.recordForwardFailed("CUSTOMER");
        console.error("RTM transcript forwarding failed", error);
      });
    }
    return true;
  }

  private async forward(event: RtmTranscriptFrame): Promise<void> {
    const payload = {
      type: "transcript.turn" as const,
      eventId: event.eventId,
      callId: event.callId,
      channelName: event.channelName,
      sessionId: event.sessionId,
      occurredAt: event.occurredAt,
      turn: event.turn
    };
    const response = await this.fetchImpl(
      new URL(
        `/v1/voice-sessions/${encodeURIComponent(event.callId)}/provider-events`,
        this.config.apiBaseUrl
      ),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-agora-signature": signJsonPayload(this.config.providerEventSecret, payload)
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000)
      }
    );
    if (!response.ok) throw new Error("Authoritative transcript ingress rejected RTM frame");
  }
}
