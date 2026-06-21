import { useCallback, useEffect, useReducer, useRef } from "react";
import { createAgoraRtcClient } from "./agoraRtcClient.js";
import { VoiceConnectionState, connectionReducer } from "./connectionState.js";

export function useLiveVoiceSession(apiClient, onCreated) {
  const [connectionState, dispatch] = useReducer(connectionReducer, VoiceConnectionState.IDLE);
  const clientRef = useRef(null);
  const callIdRef = useRef(null);
  const start = useCallback(async () => {
    if (!apiClient) return;
    dispatch({ type: "REQUEST_PERMISSION" });
    const client = createAgoraRtcClient((state) => {
      if (state === "RECONNECTING") dispatch({ type: "RECONNECT" });
      if (state === "CONNECTED") dispatch({ type: "CONNECTED" });
    });
    clientRef.current = client;
    try {
      await client.requestPermission();
    } catch {
      dispatch({ type: "PERMISSION_DENIED" });
      return;
    }
    try {
      dispatch({ type: "CREATE_SESSION" });
      const voice = await apiClient.createVoiceSession();
      callIdRef.current = voice.callId;
      onCreated?.(voice);
      const started = await apiClient.startVoiceSession(voice.callId);
      dispatch({ type: "CONNECT" });
      await client.connect(started.rtc);
      dispatch({ type: "CONNECTED" });
    } catch (error) {
      dispatch({ type: error?.code === "AGORA_CHANNEL_UNAVAILABLE" ? "UNAVAILABLE" : "FAILED" });
      await client.disconnect().catch(() => {});
    }
  }, [apiClient, onCreated]);
  const stop = useCallback(async () => {
    dispatch({ type: "STOP" });
    await clientRef.current?.disconnect().catch(() => {});
    if (apiClient && callIdRef.current)
      await apiClient.stopVoiceSession(callIdRef.current).catch(() => {});
    dispatch({ type: "ENDED" });
  }, [apiClient]);
  useEffect(
    () => () => {
      void stop();
    },
    [stop]
  );
  return { connectionState, start, stop, callId: callIdRef.current };
}
