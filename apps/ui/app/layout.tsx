import "./globals.css";
import type { ReactNode } from "react";
import { Inter, DM_Mono, Caveat } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-caveat", display: "swap" });

export const metadata = {
  title: "Lift Compass — Agentic CDP",
  description: "An Agentic CDP for marketers: a self-refilling inbox of proven, holdout-tested opportunities.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${dmMono.variable} ${caveat.variable}`}>
      <body className="min-h-screen bg-background font-sans text-[14px] text-foreground antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
