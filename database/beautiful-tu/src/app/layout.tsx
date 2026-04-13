import type { Metadata, Viewport } from "next";
import { Bebas_Neue, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

import Providers from "@/app/providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bebas-neue",
});
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://battlearena-poon.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "Spitzone - Live Freestyle Battles",
  description: "Spitzone is a live freestyle battle network for real matchups, real beats, and real competitive rooms.",
  keywords: ["hip-hop", "rap battles", "freestyle battles", "beats", "music battles", "trap", "drill", "spitzone"],
  authors: [{ name: "Spitzone" }],
  creator: "Spitzone",
  publisher: "Spitzone",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: appUrl,
    title: "Spitzone - Live Freestyle Battles",
    description: "Live freestyle battles, real matchmaking, and competitive rooms built for performance.",
    siteName: "Spitzone",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Spitzone - Live Freestyle Battles",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spitzone - Live Freestyle Battles",
    description: "Live freestyle battles, real matchmaking, and competitive rooms built for performance.",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} ${bebasNeue.variable} overflow-x-hidden bg-black text-white antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

