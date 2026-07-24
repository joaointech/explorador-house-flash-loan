import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// Sora — single brand typeface (variable, weight axis 100–800), self-hosted
// (OFL). Drives both --font-sans and --font-display via --font-sora
// (mapped in globals.css). Same wiring as the explorador app.
const sora = localFont({
  src: "./fonts/Sora.ttf",
  variable: "--font-sora",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bridge.explorador.pt"),
  title: "explorador Bridge",
  description:
    "Liquidez-ponte imobiliária: colateralize a casa que está a vender e levante fundos para o CPCV da casa nova. On-chain na Sui, com Walrus, Seal e World ID.",
  applicationName: "explorador Bridge",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt" className={`${sora.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Render-blocking no-flash theme boot — sets .dark before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-[var(--color-bg)]">{children}</body>
    </html>
  );
}
