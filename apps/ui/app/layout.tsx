import "./globals.css";
import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

// One family across sans, serif and mono - the reference system maps all three
// to Outfit, and the tokens in globals.css point at this single variable.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata = {
  title: "Proofloop - Agentic CDP",
  description: "An Agentic CDP for marketers: a self-refilling inbox of proven, holdout-tested opportunities.",
};

// Without this, Next serves no viewport meta and the app renders zoomed-out on phones.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      {/* text-sm (0.875rem) rather than a fixed 14px so browser font-size settings are honoured */}
      {/* No base font-size: the reference system leaves the browser default at
          16px and every component states its own size. */}
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
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
