function required(name: string, value: string | undefined): string {
  const result = value?.trim() ?? "";
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function positiveInt(name: string, value: string | undefined): number {
  const result = Number(required(name, value));
  if (!Number.isInteger(result) || result < 1 || result > 4_294_967_295) {
    throw new Error(`${name} must be a positive Agora UID`);
  }
  return result;
}

function httpUrl(name: string, value: string | undefined): string {
  try {
    const url = new URL(required(name, value));
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("scheme");
    return url.toString();
  } catch {
    throw new Error(`${name} must be an http(s) URL`);
  }
}

export type RelayConfig = {
  host: string;
  port: number;
  agoraAppId: string;
  relayUid: number;
  controlSecret: string;
  providerEventSecret: string;
  apiBaseUrl: string;
  browserExecutablePath: string;
};

export function readRelayConfig(
  env: Readonly<Record<string, string | undefined>> = process.env
): RelayConfig {
  const port = Number(env.RTM_RELAY_PORT ?? 3011);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("RTM_RELAY_PORT must be an integer between 1 and 65535");
  }
  return {
    host: env.RTM_RELAY_HOST?.trim() || "127.0.0.1",
    port,
    agoraAppId: required("AGORA_APP_ID", env.AGORA_APP_ID),
    relayUid: positiveInt("AGORA_RTM_RELAY_UID", env.AGORA_RTM_RELAY_UID),
    controlSecret: required("AGORA_RTM_RELAY_CONTROL_SECRET", env.AGORA_RTM_RELAY_CONTROL_SECRET),
    providerEventSecret: required("AGORA_PROVIDER_EVENT_SECRET", env.AGORA_PROVIDER_EVENT_SECRET),
    apiBaseUrl: httpUrl("RTM_RELAY_API_BASE_URL", env.RTM_RELAY_API_BASE_URL),
    browserExecutablePath: required(
      "RTM_RELAY_BROWSER_EXECUTABLE_PATH",
      env.RTM_RELAY_BROWSER_EXECUTABLE_PATH
    )
  };
}
