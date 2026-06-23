import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Lift Compass — Agentic CDP",
  description: "A causally-credible Agentic CDP prototype: ranks opportunities by uplift, proves each with a holdout.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
