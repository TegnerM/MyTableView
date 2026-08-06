import Link from "next/link";
import { cookies, headers } from "next/headers";
import { ForgotPasswordForm } from "@/components/staff/ForgotPasswordForm";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
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
  const store = await cookies();
  const headerList = await headers();
  const t = getStaffStrings(
    resolveStaffLocale(
      store.get(STAFF_LANG_COOKIE)?.value,
      headerList.get("accept-language")
    )
  );

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">{t.auth.forgotTitle}</h1>

        <p className="mtv-signin-sub">{t.auth.forgotSub}</p>

        {error === "expired" ? (
          <p className="mtv-signin-error" style={{ marginBottom: "1rem" }}>
            {t.auth.linkExpired}
          </p>
        ) : null}

        <ForgotPasswordForm />

        <p className="mtv-signin-alt">
          {t.auth.rememberedIt}{" "}
          <Link href="/staff/sign-in">{t.auth.backToSignIn}</Link>
        </p>
      </div>
    </main>
  );
}
