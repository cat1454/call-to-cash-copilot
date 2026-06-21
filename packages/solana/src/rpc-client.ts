import type {
  SolanaAddressSignature,
  SolanaCommitment,
  SolanaParsedTransaction,
  SolanaRpcClient,
  SolanaSignatureStatus
} from "./types.js";

type Fetch = typeof fetch;

type JsonRpcResponse<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

export class SolanaRpcTimeoutError extends Error {}
export class SolanaRpcUnavailableError extends Error {}

export type JsonRpcSolanaClientOptions = {
  rpcUrl: string;
  fetchFn?: Fetch;
  timeoutMs?: number;
};

export class JsonRpcSolanaClient implements SolanaRpcClient {
  readonly #rpcUrl: string;
  readonly #fetch: Fetch;
  readonly #timeoutMs: number;
  #requestId = 0;

  constructor(options: JsonRpcSolanaClientOptions) {
    const url = new URL(options.rpcUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Solana RPC URL must use http or https.");
    }
    this.#rpcUrl = url.toString();
    this.#fetch = options.fetchFn ?? globalThis.fetch;
    this.#timeoutMs = options.timeoutMs ?? 8_000;
  }

  async #request<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(this.#rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++this.#requestId,
          method,
          params
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        throw new SolanaRpcUnavailableError(`Solana RPC returned HTTP ${response.status}.`);
      }
      const payload = (await response.json()) as JsonRpcResponse<T>;
      if (payload.error !== undefined || !("result" in payload)) {
        throw new SolanaRpcUnavailableError(
          payload.error?.message ?? "Solana RPC returned an invalid response."
        );
      }
      return payload.result as T;
    } catch (error) {
      if (error instanceof SolanaRpcUnavailableError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SolanaRpcTimeoutError("Solana RPC request timed out.");
      }
      throw new SolanaRpcUnavailableError("Solana RPC is unavailable.");
    } finally {
      clearTimeout(timer);
    }
  }

  getTransaction(
    signature: string,
    commitment: SolanaCommitment
  ): Promise<SolanaParsedTransaction | null> {
    return this.#request("getTransaction", [
      signature,
      { commitment, encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }
    ]);
  }

  getSignaturesForAddress(
    address: string,
    commitment: SolanaCommitment,
    limit = 10
  ): Promise<SolanaAddressSignature[]> {
    return this.#request("getSignaturesForAddress", [address, { commitment, limit }]);
  }

  async getSignatureStatus(signature: string): Promise<SolanaSignatureStatus | null> {
    const response = await this.#request<{ value: Array<SolanaSignatureStatus | null> }>(
      "getSignatureStatuses",
      [[signature], { searchTransactionHistory: true }]
    );
    return response.value[0] ?? null;
  }
}
