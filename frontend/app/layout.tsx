import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AcademicSBT — Verifikasi Ijazah Blockchain",
  description:
    "Sistem Verifikasi Dokumen Akademik Berbasis Blockchain menggunakan Soulbound Token (SBT). Keamanan dan keaslian ijazah yang tidak bisa dipalsukan.",
  keywords: [
    "verifikasi ijazah",
    "blockchain",
    "soulbound token",
    "SBT",
    "smart contract",
    "IPFS",
    "akademik",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
