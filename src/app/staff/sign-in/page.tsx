import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { SignInForm } from "@/components/staff/SignInForm";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
import "./sign-in.css";

/**
 * Staff sign-in.
 *
 * Email and password rather than a magic link: a waiter starting a
 * shift on a shared handheld cannot wait for an email, and often has no
 * personal inbox on that device.
 */

export const dynamic = "force-dynamic";

export default async function SignInPage() {
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

  if (user) {
    // Signed in AND staff somewhere → the floor. Signed in but staff
    // nowhere (an admin account, or an interrupted signup) → show the
    // FORM, so a different account can sign in. Redirecting these
    // sessions to sign-up trapped admin users in a sign-in/sign-up
    // loop; the "start your free trial" link below still leads anyone
    // mid-signup to finish setup.
    const resolved = await resolveStaff();
    if (resolved) {
      redirect("/staff/floor");
    }
  }

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">{t.auth.staffSignInTitle}</h1>

        <SignInForm />

        <p className="mtv-signin-alt">
          <Link href="/staff/forgot-password">{t.auth.forgotPassword}</Link>
        </p>

        <p className="mtv-signin-alt">
          {t.auth.newHere}{" "}
          <Link href="/staff/sign-up">{t.auth.startTrial}</Link>
        </p>
      </div>
    </main>
  );
}
