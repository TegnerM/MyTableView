import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * Admin authentication + authorization.
 *
 * The rules, checked server-side on EVERY admin page and API route
 * (the middleware is only the outer layer; nothing trusts it alone):
 *
 *   1. a signed-in Supabase session
 *   2. the user id present in platform_admins (service-role lookup —
 *      the table has RLS enabled with no policies, so it is invisible
 *      to the public API)
 *   3. the session at aal2 — i.e. it passed TOTP this session — once
 *      the user has a verified TOTP factor. A fresh admin with no
 *      factor yet is only allowed into the enrollment flow.
 *
 * Non-admins are indistinguishable from a missing page: pages call
 * notFound(), APIs return 404.
 */

export type AdminGate =
  | { ok: true; userId: string; email: string | null }
  | {
      ok: false;
      reason: "no_session" | "not_admin" | "mfa_required" | "mfa_enroll";
    };

/** Decode the `aal` claim from the session JWT without verification —
 *  the token was already verified by getUser() over the network. */
function aalFromToken(accessToken: string | undefined | null): string {
  if (!accessToken) {
    return "aal1";
  }
  try {
    const payload = accessToken.split(".")[1];
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { aal?: string };
    return decoded.aal ?? "aal1";
  } catch {
    return "aal1";
  }
}

export async function requireAdmin(): Promise<AdminGate> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "no_session" };
  }

  const service = getServiceClient();

  const { data: adminRow, error } = await service
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle<{ user_id: string }>();

  if (error) {
    // Fail CLOSED. Admin is the one place where an outage must deny.
    console.error("requireAdmin: lookup failed", error.message);
    return { ok: false, reason: "not_admin" };
  }

  if (!adminRow) {
    return { ok: false, reason: "not_admin" };
  }

  // MFA posture: enrolled factor => this session must be aal2.
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = (factorData?.totp ?? []).some(
    (f) => f.status === "verified"
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const aal = aalFromToken(session?.access_token);

  if (!hasVerifiedTotp) {
    return { ok: false, reason: "mfa_enroll" };
  }

  if (aal !== "aal2") {
    return { ok: false, reason: "mfa_required" };
  }

  return { ok: true, userId: user.id, email: user.email ?? null };
}

/**
 * Like requireAdmin, but for the MFA enrollment/verification page
 * itself: session + admin membership required, MFA posture returned
 * rather than enforced.
 */
export async function requireAdminForMfa(): Promise<
  | { ok: true; userId: string; needsEnroll: boolean }
  | { ok: false; reason: "no_session" | "not_admin" }
> {
  const gate = await requireAdmin();

  if (gate.ok) {
    return { ok: true, userId: gate.userId, needsEnroll: false };
  }

  const reason = (gate as { ok: false; reason: string }).reason;

  if (reason === "mfa_enroll" || reason === "mfa_required") {
    // Session + admin confirmed; only the factor is missing/unverified.
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return {
      ok: true,
      userId: user?.id ?? "",
      needsEnroll: reason === "mfa_enroll",
    };
  }

  return {
    ok: false,
    reason: reason === "no_session" ? "no_session" : "not_admin",
  };
}

/** Append-only audit trail; failures are logged, never fatal. */
export async function logAudit(
  adminUserId: string,
  action: string,
  target: { type?: string; id?: string } = {},
  detail: Record<string, unknown> = {},
  ip?: string | null
): Promise<void> {
  const service = getServiceClient();

  const { error } = await service.from("admin_audit").insert({
    admin_user_id: adminUserId,
    action,
    target_type: target.type ?? null,
    target_id: target.id ?? null,
    detail,
    ip: ip ?? null,
  });

  if (error) {
    console.error("logAudit: insert failed", error.message);
  }
}
