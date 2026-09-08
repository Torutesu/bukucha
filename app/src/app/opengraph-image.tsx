import { ImageResponse } from "next/og";

export const alt = "Bukucha — あなたの妄想が、物語になる";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "90px", background: "linear-gradient(135deg, #faf7f4, #f6e3ea)", color: "#2b2126" }}>
      <div style={{ display: "flex", fontSize: 100, fontWeight: 700, color: "#b4436c", letterSpacing: "-4px" }}>Bukucha</div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 36 }}>Your imagination. Your story.</div>
      <div style={{ display: "flex", marginTop: 60, fontSize: 22, color: "#725867" }}>NOVEL AI CHAT</div>
    </div>,
    size,
  );
}
