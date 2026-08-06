import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/staff/ResetPasswordForm";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
import "../sign-in/sign-in.css";

/**
 * Reset password — reachable only through a verified recovery link.
 * /auth/confirm (type=recovery) writes the session cookie and 303s
 * here; anyone arriving without a session gets sent back to request
 * a fresh link instead of seeing a form that can only fail.
 */

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const store = await cookies();
  const headerList = await headers();
  const t = getStaffStrings(
    resolveStaffLocale(
      store.get(STAFF_LANG_COOKIE)?.value,
      headerList.get("accept-language")
    )
  );

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

        <h1 className="mtv-signin-title">{t.auth.resetTitle}</h1>

        <p className="mtv-signin-sub">
          {t.auth.resetSubBefore} <strong>{user.email}</strong>
          {t.auth.resetSubAfter}
        </p>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
