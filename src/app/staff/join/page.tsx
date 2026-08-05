import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { JoinForm } from "@/components/staff/JoinForm";
import { BrandMark } from "@/components/BrandMark";
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
          <h1 className="mtv-signin-title">This invite isn&apos;t valid</h1>
          <p className="mtv-signin-sub">
            The link has expired, was already used, or was cancelled. Ask
            the person who invited you to send a fresh one.
          </p>
          <p className="mtv-signin-alt">
            Already on a team? <Link href="/staff/sign-in">Sign in</Link>
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
  const venueName = invite.venues?.name ?? "the restaurant";

  return (
    <main className="mtv-signin">
      <div className="mtv-signin-card">
        <BrandMark className="mtv-signin-brand" />

        <h1 className="mtv-signin-title">
          Join {venueName} as {roleLabel === "manager" ? "a manager" : "a waiter"}
        </h1>

        <p className="mtv-signin-sub">
          This invite is for <strong>{invite.email}</strong>.
          {alreadySignedInMatch
            ? " You're signed in — one tap and you're on the floor."
            : " Set up your login and you're on the floor in seconds."}
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
