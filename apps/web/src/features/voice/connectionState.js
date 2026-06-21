export const VoiceConnectionState = Object.freeze({
  IDLE: "IDLE",
  REQUESTING_PERMISSION: "REQUESTING_PERMISSION",
  CREATING_SESSION: "CREATING_SESSION",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  RECONNECTING: "RECONNECTING",
  STOPPING: "STOPPING",
  ENDED: "ENDED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  FAILED: "FAILED"
});

export function connectionReducer(state, action) {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return VoiceConnectionState.REQUESTING_PERMISSION;
    case "PERMISSION_DENIED":
      return VoiceConnectionState.PERMISSION_DENIED;
    case "CREATE_SESSION":
      return VoiceConnectionState.CREATING_SESSION;
    case "CONNECT":
      return VoiceConnectionState.CONNECTING;
    case "CONNECTED":
      return VoiceConnectionState.CONNECTED;
    case "RECONNECT":
      return VoiceConnectionState.RECONNECTING;
    case "UNAVAILABLE":
      return VoiceConnectionState.PROVIDER_UNAVAILABLE;
    case "STOP":
      return VoiceConnectionState.STOPPING;
    case "ENDED":
      return VoiceConnectionState.ENDED;
    case "FAILED":
      return VoiceConnectionState.FAILED;
    default:
      return state;
  }
}
