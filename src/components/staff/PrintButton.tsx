"use client";

/** window.print needs a client boundary; that is this button's whole job. */
export function PrintButton() {
  return (
    <button
      type="button"
      className="mtv-qr-print"
      onClick={() => window.print()}
    >
      Print
    </button>
  );
}
