import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
// Ignore missing type declarations for CSS module import
// @ts-ignore
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-roboto-mono", display: "swap" });

export const metadata: Metadata = {
  title: "EscrowFlow — Split expenses & escrow payments onchain",
  description:
    "Shared expense pots for friends and teams, plus time-locked escrow for freelance work — built on Monad.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>
        <div className="flow-line" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
