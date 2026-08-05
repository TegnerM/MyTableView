import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/staff/ResetPasswordForm";
import { BrandMark } from "@/components/BrandMark";
import "../sign-in/sign-in.css";

/**
 * Reset password — reachable only through a verified recovery link.
 * /auth/confirm (type=recovery) writes the session cookie and 303s
 * here; anyone arriving without a session gets sent back to request
 * a fresh link instead of seeing a form that can only fail.
 */

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/staff/forgot-password?error=expired");
  }

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">Choose a new password</h1>

        <p className="mtv-signin-sub">
          Setting a new password for <strong>{user.email}</strong>. At
          least 8 characters.
        </p>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
