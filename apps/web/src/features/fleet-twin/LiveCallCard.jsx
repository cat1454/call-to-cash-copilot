import { Mic, Activity, PhoneOff } from "lucide-react";
import { cn } from "../../lib/cn";

export function Badge({ children, tone = "green" }) {
  return <span className={`fleet-badge fleet-badge-${tone}`}>{children}</span>;
}

export function LiveCallCard({ model, onStartCall, onEndCall, lang = "vi" }) {
  const turns = model.transcriptTurns;
  const hasTurns = turns.length > 0;

  return (
    <section className="fleet-card live-call-card" aria-labelledby="agora-live-call">
      <div className="fleet-card-header accent-blue">
        <div>
          <p className="fleet-eyebrow">{lang === "vi" ? "Điều khiển cuộc gọi" : "Call control"}</p>
          <h2 id="agora-live-call">{lang === "vi" ? "Cuộc thoại trực tiếp Agora" : "Agora Live Voice Call"}</h2>
        </div>
        <Badge>Agora Live</Badge>
      </div>

      <div className="connection-panel">
        <span className="status-dot-pulse" aria-hidden="true" />
        <div>
          <strong>
            {model.connection.statusText === "Đã kết nối"
              ? (lang === "vi" ? "Đã kết nối" : "Connected")
              : model.connection.statusText === "Sẵn sàng"
              ? (lang === "vi" ? "Sẵn sàng" : "Ready")
              : model.connection.statusText}
          </strong>
          <span>{lang === "vi" ? "Đang kết nối RTC & truyền phụ đề" : "Connecting RTC & streaming subtitles"}</span>
        </div>
      </div>

      <div className="transcript-window" aria-label="Live transcript">
        {hasTurns ? (
          turns.map((turn, index) => (
            <div
              key={turn.turnId ?? `${turn.sender}-${index}`}
              className={turn.sender === "agent" ? "bubble bubble-ai" : "bubble bubble-customer"}
            >
              <span className="bubble-sender">
                {turn.sender === "agent"
                  ? (lang === "vi" ? "Tổng đài AI" : "AI Operator")
                  : (lang === "vi" ? "Khách hàng" : "Customer")}
              </span>
              <span className="bubble-text">{turn.text}</span>
            </div>
          ))
        ) : (
          <div className="transcript-empty-state">
            <Activity size={20} />
            <p>{lang === "vi" ? "Chưa có hội thoại trực tiếp..." : "No live conversation yet..."}</p>
            <span>{lang === "vi" ? "Hãy bắt đầu cuộc gọi để xem phụ đề thời gian thực" : "Start call to view real-time subtitles"}</span>
          </div>
        )}
      </div>

      <div className="call-actions">
        <button
          className={cn("mic-button", model.connection.connected && "connected")}
          type="button"
          aria-label={model.connection.connected ? "Stop listening" : "Start listening"}
          onClick={onStartCall}
        >
          <Mic size={28} />
        </button>
        <span>
          {model.connection.connected
            ? (lang === "vi" ? "Đang lắng nghe..." : "Listening...")
            : (lang === "vi" ? "Sẵn sàng nhận âm thanh / Phát lại" : "Ready to receive audio / Replay")}
        </span>
        <button className="end-call-button" type="button" onClick={onEndCall}>
          <PhoneOff size={15} />
          {lang === "vi" ? "Kết thúc cuộc gọi" : "End call"}
        </button>
      </div>
    </section>
  );
}
