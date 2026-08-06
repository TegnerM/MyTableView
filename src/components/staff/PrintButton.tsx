"use client";

import { useEffect, useState } from "react";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";

/** window.print needs a client boundary; that is this button's whole job. */
export function PrintButton() {
  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(locale);

  return (
    <button
      type="button"
      className="mtv-qr-print"
      onClick={() => window.print()}
    >
      {t.qr.print}
    </button>
  );
}
