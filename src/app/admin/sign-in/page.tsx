import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { AdminSignInForm } from "@/components/admin/AdminSignInForm";
import { BrandMark } from "@/components/BrandMark";
import "../admin.css";

/**
 * Dedicated admin sign-in. Reveals nothing: it looks like a plain
 * login card, and failed attempts get one generic message regardless
 * of cause. A signed-in user is sent to /admin, where the real gate
 * (admin membership + TOTP) decides.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminSignInPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/admin");
  }

  return (
    <main className="mtv-adminauth">
      <div className="mtv-adminauth-card">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BrandMark className="mtv-brand" />
        </div>
        <h1>Administration</h1>
        <p className="mtv-adminauth-sub">Authorized personnel only.</p>
        <AdminSignInForm />
      </div>
    </main>
  );
}
