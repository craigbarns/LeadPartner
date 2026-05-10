import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://leadpartner.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/p/", "/login", "/signup"],
        disallow: [
          "/dashboard",
          "/opportunities",
          "/commissions",
          "/team",
          "/referrers",
          "/program",
          "/settings",
          "/account",
          "/super-admin",
          "/onboarding",
          "/invite/",
          "/auth/",
          "/api/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
