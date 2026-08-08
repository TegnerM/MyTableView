import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { SignUpForm } from "@/components/staff/SignUpForm";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
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

type PageProps = {
  searchParams: Promise<{ invite?: string }>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const { invite } = await searchParams;
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

  let alreadySignedIn = false;
  let initialVenueType: "restaurant" | "bar" | "hotel" = "restaurant";
  let initialVenueName = "";
  let initialDisplayName = "";
  let initialIncludeRestaurant = true;
  let initialIncludeBar = true;

  if (user) {
    const resolved = await resolveStaff();
    if (resolved) {
      redirect("/staff/floor");
    }
    // Signed in but no restaurant yet: confirmed email or interrupted
    // signup. The form skips the account step and just creates the
    // venue — restored from the metadata the first form stamped on
    // the auth user, so a bar signup comes back as a bar signup.
    alreadySignedIn = true;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (meta.venue_type === "bar" || meta.venue_type === "hotel") {
      initialVenueType = meta.venue_type;
    }
    if (typeof meta.venue_name === "string") {
      initialVenueName = meta.venue_name.slice(0, 80);
    }
    if (typeof meta.display_name === "string") {
      initialDisplayName = meta.display_name.slice(0, 80);
    }
    if (typeof meta.include_restaurant === "boolean") {
      initialIncludeRestaurant = meta.include_restaurant;
    }
    if (typeof meta.include_bar === "boolean") {
      initialIncludeBar = meta.include_bar;
    }
  }

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">
          {alreadySignedIn ? t.auth.almostThere : t.auth.startTrial}
        </h1>
        <p className="mtv-signin-sub">{t.auth.signUpSub}</p>

        <SignUpForm
          alreadySignedIn={alreadySignedIn}
          inviteToken={invite ?? null}
          initialVenueType={initialVenueType}
          initialVenueName={initialVenueName}
          initialDisplayName={initialDisplayName}
          initialIncludeRestaurant={initialIncludeRestaurant}
          initialIncludeBar={initialIncludeBar}
        />

        <p className="mtv-signin-alt">
          {t.auth.alreadyHaveAccount}{" "}
          <Link href="/staff/sign-in">{t.auth.signIn}</Link>
        </p>
      </div>
    </main>
  );
}
