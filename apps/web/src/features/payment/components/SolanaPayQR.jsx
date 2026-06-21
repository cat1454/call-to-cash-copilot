import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

/**
 * SolanaPayQR — renders the `solana:` URL as a QR code on a <canvas>.
 *
 * Phantom mobile: tap the camera/QR icon inside the app → scan this QR.
 * The wallet auto-fills recipient, amount, reference, and memo from the URL.
 *
 * No external service calls — the QR is generated entirely in-browser.
 */
export function SolanaPayQR({ url, size = 200 }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    setError(null);
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M"
    }).catch((err) => {
      console.error("[SolanaPayQR] Failed to render QR:", err);
      setError("Không thể tạo QR code.");
    });
  }, [url, size]);

  if (error) {
    return (
      <p className="text-center text-xs text-[#f43f5e]">{error}</p>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      aria-label="Solana Pay QR code — scan with Phantom mobile"
      className="rounded-xl"
    />
  );
}
