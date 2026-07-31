import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { requireAdminForMfa } from "@/lib/admin/auth";
import { AdminMfa } from "@/components/admin/AdminMfa";
import { BrandMark } from "@/components/BrandMark";
import "../admin.css";

/**
 * Two-factor step for admins: enrollment on first login, the code
 * challenge on every later session. Only reachable with a session that
 * IS a platform admin — everyone else sees a 404.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminMfaPage() {
  const gate = await requireAdminForMfa();

  if (!gate.ok) {
    if (gate.reason === "no_session") {
      redirect("/admin/sign-in");
    }
    notFound();
  }

  return (
    <main className="mtv-adminauth">
      <div className="mtv-adminauth-card">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BrandMark className="mtv-brand" />
        </div>
        <h1>
          {gate.needsEnroll ? "Set up two-factor" : "Two-factor code"}
        </h1>
        <p className="mtv-adminauth-sub">
          {gate.needsEnroll
            ? "Scan the QR code with your authenticator app (Google Authenticator, 1Password, …), then enter the 6-digit code it shows."
            : "Enter the current code from your authenticator app."}
        </p>
        <AdminMfa needsEnroll={gate.needsEnroll} />
      </div>
    </main>
  );
}
