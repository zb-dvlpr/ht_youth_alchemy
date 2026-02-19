import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hattrick Alchemy",
  description: "Optimize youth and senior squads with CHPP-powered insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/fonts.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
