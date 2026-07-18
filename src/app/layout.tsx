import type { Metadata, Viewport } from "next";
import "./globals.css";
import AnalyticsConsentModal from "./components/AnalyticsConsentModal";
import AnalyticsAppLoadedTracker from "./components/AnalyticsAppLoadedTracker";
import ConsentGatedVercelAnalytics from "./components/ConsentGatedVercelAnalytics";
import GoogleAnalytics from "./components/GoogleAnalytics";
import MobileLayoutBootstrap from "./components/MobileLayoutBootstrap";
import PwaRegistration from "./components/PwaRegistration";

export const metadata: Metadata = {
  title: "Hattrick Alchemy",
  description: "Optimize youth and senior squads with CHPP-powered insights.",
  applicationName: "Hattrick Alchemy",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HT Alchemy",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      {
        url: "/icons/ht-alchemy-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/ht-alchemy-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/ht-alchemy-apple-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2f5130",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <MobileLayoutBootstrap />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts.css" />
      </head>
      <body>
        {children}
        <PwaRegistration />
        <AnalyticsConsentModal />
        <GoogleAnalytics />
        <AnalyticsAppLoadedTracker />
        <ConsentGatedVercelAnalytics />
      </body>
    </html>
  );
}
