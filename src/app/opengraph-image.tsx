import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "LeadPartner — l'infrastructure de votre programme d'apporteurs d'affaires";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadGoogleFont(family: string, text: string) {
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`;
  try {
    const css = await fetch(url).then((res) => res.text());
    const resource = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!resource) return null;
    const response = await fetch(resource[1]);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const headline = "L'infrastructure tranquille pour vos apporteurs.";
  const corpus =
    "LeadPartner leadpartner.app · est. 2026 Programme d'apporteurs L'infrastructure tranquille pour vos apporteurs · 0123456789";

  const [serif, sans] = await Promise.all([
    loadGoogleFont("Instrument+Serif:ital@1", corpus),
    loadGoogleFont("Geist:wght@400;500", corpus),
  ]);

  const fonts: { name: string; data: ArrayBuffer; style: "italic" | "normal" }[] = [];
  if (serif) fonts.push({ name: "Display", data: serif, style: "italic" });
  if (sans) fonts.push({ name: "Sans", data: sans, style: "normal" });

  return new ImageResponse(
    (
      <div
        style={{
          background: "#FAF7F0",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "56px 72px",
          position: "relative",
          fontFamily: "Sans, sans-serif",
          color: "#1F1B17",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to right, rgba(31,27,23,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(31,27,23,0.06) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            display: "flex",
          }}
        />

        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", display: "flex" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: "#1F1B17",
                }}
              />
              <div
                style={{
                  width: 14,
                  height: 14,
                  background: "#D4FF00",
                  position: "absolute",
                  bottom: -4,
                  right: -4,
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
              <span
                style={{
                  fontFamily: "Display, serif",
                  fontStyle: "italic",
                  fontSize: 38,
                  letterSpacing: "-0.01em",
                }}
              >
                LeadPartner
              </span>
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(31,27,23,0.55)",
                  marginTop: 4,
                }}
              >
                · est. 2026
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(31,27,23,0.55)",
            }}
          >
            § 01 — Index
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            position: "relative",
            marginTop: 24,
          }}
        >
          <div
            style={{
              fontFamily: "Display, serif",
              fontStyle: "italic",
              fontSize: 116,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <span>L&apos;infrastructure</span>
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>tranquille</span>
              <span
                style={{
                  fontSize: 96,
                  color: "#D4FF00",
                  fontFamily: "Sans, sans-serif",
                  fontStyle: "normal",
                  lineHeight: 1,
                  display: "flex",
                  marginLeft: 4,
                  marginTop: -28,
                }}
              >
                *
              </span>
            </span>
            <span>pour vos apporteurs.</span>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            position: "relative",
            borderTop: "1px solid rgba(31,27,23,0.18)",
            paddingTop: 20,
            marginTop: 16,
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontFamily: "Sans, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            leadpartner.app
          </span>
          <span
            style={{
              fontSize: 14,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(31,27,23,0.55)",
            }}
          >
            Programme d&apos;apporteurs · SaaS multi-tenant
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
