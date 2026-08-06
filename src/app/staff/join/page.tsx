import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { JoinForm } from "@/components/staff/JoinForm";
import { BrandMark } from "@/components/BrandMark";
import {
  getStaffStrings,
  resolveStaffLocale,
  STAFF_LANG_COOKIE,
} from "@/lib/i18n/staff";
import "../sign-in/sign-in.css";

/**
 * /staff/join?token= — where a staff invite email lands.
 *
 * The page only READS the invite (nothing is consumed by loading it,
 * so mail scanners can't burn the link). The token is spent in
 * /api/staff/join when the person actually joins.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InviteRow = {
  email: string;
  role: "waiter" | "manager";
  display_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  venues: { name: string } | null;
};

const TOKEN = /^[0-9a-f]{16,64}$/;

export default async function StaffJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: rawToken } = await searchParams;
  const store = await cookies();
  const headerList = await headers();
  const t = getStaffStrings(
    resolveStaffLocale(
      store.get(STAFF_LANG_COOKIE)?.value,
      headerList.get("accept-language")
    )
  );
  const token = rawToken && TOKEN.test(rawToken) ? rawToken : null;

  let invite: InviteRow | null = null;

  if (token) {
    const service = getServiceClient();
    const { data } = await service
      .from("staff_invites")
      .select(
        "email, role, display_name, expires_at, accepted_at, revoked_at, venues:venue_id ( name )"
      )
      .eq("token", token)
      .maybeSingle<InviteRow>();
    invite = data ?? null;
  }

  const valid =
    invite !== null &&
    invite.revoked_at === null &&
    invite.accepted_at === null &&
    new Date(invite.expires_at).getTime() > Date.now();

  if (!token || !invite || !valid) {
    return (
      <main className="mtv-signin">
        <div className="mtv-signin-card">
          <BrandMark className="mtv-signin-brand" />
          <h1 className="mtv-signin-title">{t.join.invalidTitle}</h1>
          <p className="mtv-signin-sub">{t.join.invalidSub}</p>
          <p className="mtv-signin-alt">
            {t.join.alreadyOnTeam}{" "}
            <Link href="/staff/sign-in">{t.auth.signIn}</Link>
          </p>
        </div>
      </main>
    );
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const alreadySignedInMatch =
    user?.email?.toLowerCase() === invite.email.toLowerCase();

  const roleLabel = invite.role === "manager" ? "manager" : "waiter";
  const venueName = invite.venues?.name ?? t.join.venueFallback;

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">
          {(roleLabel === "manager"
            ? t.join.titleManager
            : t.join.titleWaiter
          ).replace("{venue}", venueName)}
        </h1>

        <p className="mtv-signin-sub">
          {t.join.inviteForBefore} <strong>{invite.email}</strong>.{" "}
          {alreadySignedInMatch ? t.join.signedInHint : t.join.setupHint}
        </p>

        <JoinForm
          token={token}
          email={invite.email}
          suggestedName={invite.display_name ?? ""}
          alreadySignedInMatch={alreadySignedInMatch}
        />
      </div>
    </main>
  );
}
