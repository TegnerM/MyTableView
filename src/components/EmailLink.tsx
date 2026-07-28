"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Crawler-protected email link.
 *
 * The address is assembled in the browser after hydration, from parts
 * that never form an email pattern in the served HTML or the JS
 * bundle. Harvesters scraping source or running regexes over assets
 * find nothing; a human clicking gets a normal mailto.
 *
 * Not absolute protection — a scraper driving a real browser sees the
 * final DOM — but that class of scraper is rare, and info@ on a live
 * domain is guessable anyway. This closes the cheap, common vector.
 */

const PARTS = ["in", "fo"]; // local part
const HOST = ["mytable", "view"]; // domain name
const TLD = "com";

type Props = {
  subject?: string;
  className?: string;
  /** Render the address itself as the link text. */
  showAddress?: boolean;
  children?: ReactNode;
};

export function EmailLink({ subject, className, showAddress, children }: Props) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    setAddress(`${PARTS.join("")}@${HOST.join("")}.${TLD}`);
  }, []);

  const href = address
    ? `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`
    : undefined;

  return (
    <a href={href} className={className}>
      {children ?? (showAddress ? (address ?? "…") : null)}
    </a>
  );
}
