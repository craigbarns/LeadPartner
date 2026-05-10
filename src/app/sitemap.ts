import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://leadpartner.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: APP_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${APP_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
