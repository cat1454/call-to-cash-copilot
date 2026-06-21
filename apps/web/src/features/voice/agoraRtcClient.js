import AgoraRTC from "agora-rtc-sdk-ng";

export function createAgoraRtcClient(onStateChange = () => {}) {
  const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  let microphoneTrack = null;
  let joined = false;
  client.on("connection-state-change", (current) => onStateChange(current));
  client.on("user-published", async (user, mediaType) => {
    if (mediaType !== "audio") return;
    await client.subscribe(user, mediaType);
    user.audioTrack?.play();
  });
  return {
    async requestPermission() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    },
    async connect({ appId, channelName, token, uid }) {
      await client.join(appId, channelName, token, uid);
      joined = true;
      microphoneTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await client.publish([microphoneTrack]);
    },
    async disconnect() {
      if (microphoneTrack) {
        await client.unpublish([microphoneTrack]);
        microphoneTrack.close();
        microphoneTrack = null;
      }
      if (joined) {
        await client.leave();
        joined = false;
      }
    }
  };
}
