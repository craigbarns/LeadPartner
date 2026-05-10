import type { Metadata } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://leadpartner.app";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "LeadPartner — l'infrastructure de votre programme d'apporteurs",
    template: "%s · LeadPartner",
  },
  description:
    "Tout l'outillage pour recruter, suivre et rémunérer vos apporteurs d'affaires. Sans tableur Excel.",
  applicationName: "LeadPartner",
  authors: [{ name: "LeadPartner" }],
  keywords: [
    "apporteur d'affaires",
    "programme de parrainage",
    "referral program",
    "SaaS",
    "lead management",
    "commission",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: APP_URL,
    siteName: "LeadPartner",
    title: "LeadPartner — l'infrastructure de votre programme d'apporteurs",
    description:
      "Recrutez, attribuez, suivez et rémunérez vos apporteurs d'affaires depuis un seul outil.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadPartner",
    description:
      "L'infrastructure de votre programme d'apporteurs d'affaires.",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
