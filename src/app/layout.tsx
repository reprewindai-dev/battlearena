import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Providers from "@/app/providers";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BattleArena - Where Beats Meet Battles",
  description: "The ultimate hip-hop battle platform. Compete in rap battles, showcase your beats, and win prizes.",
  keywords: ["hip-hop", "rap battles", "beats", "music battles", "trap", "drill", "battle arena"],
  authors: [{ name: "BattleArena" }],
  creator: "BattleArena",
  publisher: "BattleArena",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://battlearena.com",
    title: "BattleArena - Where Beats Meet Battles",
    description: "The ultimate hip-hop battle platform. Compete in rap battles, showcase your beats, and win prizes.",
    siteName: "BattleArena",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "BattleArena - Hip-Hop Battle Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BattleArena - Where Beats Meet Battles",
    description: "The ultimate hip-hop battle platform. Compete in rap battles, showcase your beats, and win prizes.",
    images: ["/og-image.jpg"],
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
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
