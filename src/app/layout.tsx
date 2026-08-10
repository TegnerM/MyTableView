import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces } from "next/font/google";
import "./globals.css";

// The landing hero's serif, exposed as --mtv-serif so staff surfaces
// (overview welcome, etc.) share the same face as the landing page.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--mtv-serif",
});

export const metadata: Metadata = {
  title: "MyTableView",
  description: "See every table. Miss nothing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The guest screen is a one-handed tap target at a dinner table.
  // Locking zoom would fail accessibility, so it stays available.
  maximumScale: 5,
  themeColor: "#1f2c38",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Safari and several extensions add attributes to <html> before
    // React hydrates. This suppresses the resulting attribute-level
    // mismatch on this element only — it does not hide real mismatches
    // in the tree below.
    <html lang="en" suppressHydrationWarning>
      <body className={fraunces.variable}>{children}</body>
    </html>
  );
}
