# Agora live smoke test

Set `VOICE_PROVIDER=agora`, server-only `AGORA_*` values from `.env.example`, and `VITE_VOICE_PROVIDER=agora`. Start PostgreSQL, API, and web.

1. Press the microphone control; grant microphone access and accept live-audio analysis.
2. Confirm `CONNECTED`, a browser RTC join, a CAI agent join, and audible remote audio.
3. Speak a booking phrase. Final customer text must appear through SSE and persist redacted; interim text must not persist.
4. Confirm existing risk/gate updates and the unchanged payment/receipt flow.
5. Stop. Verify browser tracks close, CAI leaves, the call ends, and no secrets/tokens appear in logs.

Do not mark this passed without a real microphone session, CAI response, and final-turn persistence.
