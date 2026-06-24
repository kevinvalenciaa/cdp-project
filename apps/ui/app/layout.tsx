import "./globals.css";
import type { ReactNode } from "react";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});
const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata = {
  title: "Lift Compass — Agentic CDP",
  description: "An Agentic CDP for marketers: a self-refilling inbox of proven, holdout-tested opportunities.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${firaSans.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
