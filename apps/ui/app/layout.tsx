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

// Without this, Next serves no viewport meta and the app renders zoomed-out on phones.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${dmMono.variable} ${caveat.variable}`}>
      {/* text-sm (0.875rem) rather than a fixed 14px so browser font-size settings are honoured */}
      <body className="min-h-screen bg-background font-sans text-sm text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-ht-md focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
