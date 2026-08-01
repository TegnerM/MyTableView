import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
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

  // Only forward sessions that ARE admins. Any other session (e.g. a
  // restaurant-owner login in the same browser) sees the form, so an
  // admin can always switch accounts here instead of dead-ending on
  // the non-admin 404.
  if (user) {
    const { data: adminRow } = await getServiceClient()
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle<{ user_id: string }>();

    if (adminRow) {
      redirect("/admin");
    }
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
