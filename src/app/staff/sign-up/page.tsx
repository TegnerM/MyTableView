import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { SignUpForm } from "@/components/staff/SignUpForm";
import { BrandMark } from "@/components/BrandMark";
import "../sign-in/sign-in.css";

/**
 * Self-serve signup — the landing page's "Start your free trial" lands
 * here. Same visual language as sign-in (it shares the stylesheet).
 *
 * A signed-in user who is already staff somewhere is sent to the floor;
 * a signed-in user with no venue yet (confirmed email, interrupted
 * signup) still sees the form and can finish setting up.
 */

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let alreadySignedIn = false;

  if (user) {
    const resolved = await resolveStaff();
    if (resolved) {
      redirect("/staff/floor");
    }
    // Signed in but no restaurant yet: confirmed email or interrupted
    // signup. The form skips the account step and just creates the venue.
    alreadySignedIn = true;
  }

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">
          {alreadySignedIn
            ? "Almost there — name your restaurant"
            : "Start your 14-day free trial"}
        </h1>
        <p className="mtv-signin-sub">
          No credit card. Print QR codes for your tables and be live tonight.
        </p>

        <SignUpForm alreadySignedIn={alreadySignedIn} />

        <p className="mtv-signin-alt">
          Already have an account?{" "}
          <Link href="/staff/sign-in">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
