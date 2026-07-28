import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

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
  themeColor: "#16293d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Safari and several extensions add attributes to <html> before
    // React hydrates. This suppresses the resulting attribute-level
    // mismatch on this element only — it does not hide real mismatches
    // in the tree below.
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
