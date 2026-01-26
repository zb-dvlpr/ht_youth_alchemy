import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Youth Alchemy",
  description: "Optimize youth training and lineups with CHPP-powered insights.",
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
