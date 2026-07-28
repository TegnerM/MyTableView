import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
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
    redirect("/staff/floor");
  }

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">Staff sign in</h1>

        <SignInForm />
      </div>
    </main>
  );
}
