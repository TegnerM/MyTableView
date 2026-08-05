import Link from "next/link";
import { ForgotPasswordForm } from "@/components/staff/ForgotPasswordForm";
import { BrandMark } from "@/components/BrandMark";
import "../sign-in/sign-in.css";

/**
 * Forgot password — same card and theme as sign-in, one email field.
 * ?error=expired is where /staff/reset-password sends people whose
 * recovery link was already used or timed out.
 */

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">Reset your password</h1>

        <p className="mtv-signin-sub">
          Enter the email you sign in with and we&apos;ll send you a link
          to choose a new password.
        </p>

        {error === "expired" ? (
          <p className="mtv-signin-error" style={{ marginBottom: "1rem" }}>
            That reset link has expired or was already used. Request a
            fresh one below.
          </p>
        ) : null}

        <ForgotPasswordForm />

        <p className="mtv-signin-alt">
          Remembered it? <Link href="/staff/sign-in">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
