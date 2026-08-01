"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget visit beacon. Renders nothing, sends one POST after
 * mount so tracking never delays the landing page's paint. keepalive
 * lets the request finish even if the visitor navigates immediately.
 */

export function TrackBeacon() {
  useEffect(() => {
    try {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          path: window.location.pathname,
          search: window.location.search,
          referrer: document.referrer,
        }),
      });
    } catch {
      // Tracking must never surface to the visitor.
    }
  }, []);

  return null;
}
