import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#FAF7F0",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div style={{ position: "relative", display: "flex" }}>
          <div
            style={{
              width: 124,
              height: 124,
              background: "#1F1B17",
            }}
          />
          <div
            style={{
              width: 36,
              height: 36,
              background: "#D4FF00",
              position: "absolute",
              bottom: -10,
              right: -10,
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
