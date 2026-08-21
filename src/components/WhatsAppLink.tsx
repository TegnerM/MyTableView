"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Crawler-protected WhatsApp link (same idea as EmailLink): the
 * wa.me address is assembled in the browser after hydration from
 * fragments that never form a phone-number pattern in the served
 * HTML or the JS bundle.
 */

const PARTS = ["34", "634", "329", "788"];

type Props = {
  className?: string;
  children?: ReactNode;
};

export function WhatsAppLink({ className, children }: Props) {
  const [href, setHref] = useState<string | undefined>(undefined);

  useEffect(() => {
    setHref(`https://wa.me/${PARTS.join("")}`);
  }, []);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <svg
        viewBox="0 0 24 24"
        className="lp-wa-icon"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M12 2a9.9 9.9 0 0 0-8.5 15L2.2 21.4a.6.6 0 0 0 .74.74l4.5-1.3A9.9 9.9 0 1 0 12 2Zm0 1.8a8.1 8.1 0 1 1-4.1 15.1.9.9 0 0 0-.71-.09l-2.8.81.83-2.75a.9.9 0 0 0-.1-.73A8.1 8.1 0 0 1 12 3.8Zm-3 3.9c-.2 0-.5.07-.72.32-.22.24-.85.83-.85 2s.87 2.32 1 2.48c.12.16 1.7 2.72 4.2 3.7 2.08.82 2.5.66 2.95.62.45-.04 1.45-.6 1.66-1.17.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28s-1.45-.71-1.67-.8c-.22-.08-.39-.12-.55.13-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06a6.7 6.7 0 0 1-1.97-1.21 7.4 7.4 0 0 1-1.36-1.7c-.14-.24-.02-.38.1-.5.12-.11.25-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.43-.06-.12-.54-1.34-.76-1.83-.2-.48-.4-.41-.55-.42Z" />
      </svg>
      {children}
    </a>
  );
}
