import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Providers from "@/app/providers";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Spitzone - Live Audio Battle Arena",
  description: "Spitzone is a live audio battle arena for real matchups, real beats, and real competitive rooms.",
  keywords: ["hip-hop", "rap battles", "beats", "music battles", "trap", "drill", "battle arena"],
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
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://battlearena-poon.onrender.com",
    title: "Spitzone - Live Audio Battle Arena",
    description: "Live audio battles, real matchmaking, and competitive rooms built for performance.",
    siteName: "Spitzone",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Spitzone - Live Audio Battle Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spitzone - Live Audio Battle Arena",
    description: "Live audio battles, real matchmaking, and competitive rooms built for performance.",
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
      <body className={`${geist.className} bg-black text-white overflow-x-hidden`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
