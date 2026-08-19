import type { Metadata, Viewport } from "next";
import "./globals.css";
import { assertProductionConfig } from "@/lib/env";

// Runs once when the server module is first evaluated.
assertProductionConfig();

export const metadata: Metadata = {
  title: {
    default: "Deposit Book",
    template: "%s · Deposit Book",
  },
  description:
    "Daily store deposit records for 13 stores across 3 cities. Built by Aethon Core.",
  applicationName: "Deposit Book",
  authors: [{ name: "Aethon Core", url: "https://aethoncore.com" }],
  creator: "Aethon Core",
  publisher: "Aethon Core",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131b1e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
