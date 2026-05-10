import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeadPartner",
    short_name: "LeadPartner",
    description:
      "L'infrastructure de votre programme d'apporteurs d'affaires.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAF7F0",
    theme_color: "#1F1B17",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
