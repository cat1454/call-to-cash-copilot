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
  MICROPHONE_UNAVAILABLE: "MICROPHONE_UNAVAILABLE",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  FAILED: "FAILED"
});

export const LIVE_VOICE_FAILURE_STATES = new Set([
  VoiceConnectionState.PERMISSION_DENIED,
  VoiceConnectionState.MICROPHONE_UNAVAILABLE,
  VoiceConnectionState.PROVIDER_UNAVAILABLE,
  VoiceConnectionState.FAILED
]);

const PRESENTATIONS = {
  IDLE: ["Sẵn sàng kết nối Agora", "Cho phép dùng micro để bắt đầu.", "Chưa có dữ liệu đặt chỗ nào bị thay đổi."],
  REQUESTING_PERMISSION: ["Đang xin quyền dùng micro", "Chọn Cho phép trong trình duyệt.", "Thông tin đặt chỗ vẫn an toàn."],
  CREATING_SESSION: ["Đang tạo phiên trò chuyện", "Vui lòng chờ trong giây lát.", "Phiên được lưu bởi máy chủ."],
  CONNECTING: ["Đang kết nối Agora", "Giữ trang này mở trong lúc kết nối.", "Thông tin đặt chỗ vẫn an toàn."],
  CONNECTED: ["Agora đã kết nối", "Bạn có thể bắt đầu nói.", "Chỉ câu nói hoàn chỉnh mới được lưu."],
  RECONNECTING: ["Đang khôi phục cuộc trò chuyện", "Giữ trang mở hoặc thử kết nối lại.", "Thông tin đã lưu không bị mất."],
  STOPPING: ["Đang kết thúc cuộc trò chuyện", "Vui lòng chờ một chút.", "Dữ liệu đã xác nhận vẫn được giữ."],
  ENDED: ["Cuộc trò chuyện đã kết thúc", "Bạn có thể xem lại trạng thái đã lưu.", "Thông tin đã lưu không bị mất."],
  PERMISSION_DENIED: ["Trình duyệt chưa được dùng micro", "Cho phép micro rồi thử lại, hoặc dùng bản phát lại.", "Chưa có dữ liệu đặt chỗ nào bị mất."],
  MICROPHONE_UNAVAILABLE: ["Không tìm thấy micro", "Kết nối micro rồi thử lại, hoặc dùng bản phát lại.", "Chưa có dữ liệu đặt chỗ nào bị mất."],
  PROVIDER_UNAVAILABLE: ["Chưa thể kết nối dịch vụ thoại", "Thử lại hoặc tiếp tục bằng bản phát lại.", "Thông tin đã lưu vẫn an toàn."],
  FAILED: ["Kết nối thoại gặp sự cố", "Thử lại hoặc tiếp tục bằng bản phát lại.", "Thông tin đã lưu vẫn an toàn."]
};

export function getVoiceConnectionPresentation(state) {
  const [title, action, safety] = PRESENTATIONS[state] ?? PRESENTATIONS.FAILED;
  return { title, action, safety, failed: LIVE_VOICE_FAILURE_STATES.has(state) };
}

export function connectionReducer(state, action) {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return VoiceConnectionState.REQUESTING_PERMISSION;
    case "PERMISSION_DENIED":
      return VoiceConnectionState.PERMISSION_DENIED;
    case "MICROPHONE_UNAVAILABLE":
      return VoiceConnectionState.MICROPHONE_UNAVAILABLE;
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
