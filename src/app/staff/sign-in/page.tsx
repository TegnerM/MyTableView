import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { SignInForm } from "@/components/staff/SignInForm";
import { BrandMark } from "@/components/BrandMark";
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

        <h1 className="mtv-signin-title">Staff sign in</h1>

        <SignInForm />

        <p className="mtv-signin-alt">
          <Link href="/staff/forgot-password">Forgot your password?</Link>
        </p>

        <p className="mtv-signin-alt">
          New here?{" "}
          <Link href="/staff/sign-up">Start your 14-day free trial</Link>
        </p>
      </div>
    </main>
  );
}
