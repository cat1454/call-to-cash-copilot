import { Shield, ShieldAlert, Printer } from "lucide-react";

export default function SolanaLedgerCard({
  ledgerLogs,
  isTampered,
  tamperAgreement
}) {
  if (!ledgerLogs.show) return null;

  return (
    <div className="dev-receipt-log">
      <div className="dev-receipt-log-header" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Shield size={13} style={{ color: "var(--primary-blue)" }} />
        <span>Đối Soát Xác Thực Sổ Cái Solana</span>
      </div>

      <div>
        <span>Mã giao dịch (Tx Signature):</span>
        <div className="dev-log-sig">{ledgerLogs.txSig}</div>
      </div>

      <div style={{ marginTop: "4px" }}>
        <span>Mã băm lưu trữ (Anchored Hash):</span>
        <div className="dev-log-hash">{ledgerLogs.anchoredHash}</div>
      </div>

      <div style={{ marginTop: "4px" }}>
        <span>Mã băm đối soát thực tế:</span>
        <div className="dev-log-hash" style={{ color: ledgerLogs.computedHashColor, fontWeight: 700 }}>
          {ledgerLogs.computedHash}
        </div>
      </div>

      {isTampered && (
        <div className="tamper-explanation-banner" style={{ margin: "12px 0" }}>
          <div className="tamper-banner-header">
            <ShieldAlert size={14} />
            <span>PHÁT HIỆN HÀNH VI CAN THIỆP DỮ LIỆU THỎA THUẬN (TAMPER DETECTED)</span>
          </div>
          <p style={{ margin: "6px 0", fontSize: "10.5px" }}>
            <b>Giải thích cơ chế bảo mật (Hackathon Proof):</b>
            <br />
            Mã băm thỏa thuận đặt vé ban đầu đã được ký số và neo băm (Anchored Hash) lên sổ cái blockchain Solana lúc thanh toán cọc.
            <br />
            Khi kẻ tấn công cố tình thay đổi trực tiếp cơ sở dữ liệu (sửa đổi tuyến đường/số ghế), hệ thống đối soát thực tế ngay lập tức tính toán lại mã băm mới và phát hiện sự <b>SAI KHỚP</b> với mã băm đã ký trên sổ cái blockchain.
          </p>
          <div className="tamper-comparison">
            <div className="hash-block archived">
              <span>Mã băm gốc (Solana Ledger)</span>
              <code>{ledgerLogs.anchoredHash.substring(0, 18)}...</code>
            </div>
            <div className="hash-block divider">≠</div>
            <div className="hash-block computed">
              <span>Mã băm hiện tại (Hacked DB)</span>
              <code>{ledgerLogs.computedHash.substring(0, 18)}...</code>
            </div>
          </div>
          <p className="tamper-conclusion" style={{ margin: "4px 0 0 0" }}>
            ❌ TRẠNG THÁI VÉ BỊ KHÓA LẬP TỨC. HỆ THỐNG PHÒNG CHỐNG GIAN LẬN AN TOÀN!
          </p>
        </div>
      )}

      <div className="dev-receipt-actions">
        <button className="btn-danger" style={{ display: "flex", gap: "4px" }} onClick={tamperAgreement}>
          <ShieldAlert size={12} />
          <span>Mô phỏng tấn công dữ liệu vé (Tamper)</span>
        </button>
        <button className="btn-secondary" style={{ display: "flex", gap: "4px" }} onClick={() => window.print()}>
          <Printer size={12} />
          <span>In hóa đơn vé</span>
        </button>
      </div>
    </div>
  );
}
