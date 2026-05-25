import type { Metadata, Viewport } from "next";
import "./globals.css";
import AnalyticsConsentModal from "./components/AnalyticsConsentModal";
import ConsentGatedVercelAnalytics from "./components/ConsentGatedVercelAnalytics";
import GoogleAnalytics from "./components/GoogleAnalytics";

export const metadata: Metadata = {
  title: "Hattrick Alchemy",
  description: "Optimize youth and senior squads with CHPP-powered insights.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts.css" />
      </head>
      <body>
        {children}
        <AnalyticsConsentModal />
        <GoogleAnalytics />
        <ConsentGatedVercelAnalytics />
      </body>
    </html>
  );
}
