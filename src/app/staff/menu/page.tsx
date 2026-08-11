import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getVenueBilling } from "@/lib/staff/billing";
import { getServiceClient } from "@/lib/supabase/service";
import { loadStaffMenu } from "@/lib/staff/menu-data";
import { loadVenueStations } from "@/lib/stations";
import { linkedBarVenue } from "@/lib/menu/bar-share";
import { MenuEditor } from "@/components/staff/MenuEditor";
import { StaffShell } from "@/components/staff/StaffShell";
import { TrialLocked } from "@/components/staff/TrialLocked";
import { resolveStaffLocale, STAFF_LANG_COOKIE } from "@/lib/i18n/staff";
import { getOrderingStrings } from "@/lib/i18n/ordering";
import "../floor/floor.css";
import "./menu-editor.css";
import "../trial-locked.css";

/**
 * /staff/menu — the menu editor. Managers and owners only.
 *
 * Editable whether or not the Ordering module is switched on: an owner
 * builds the menu first, then flips the switch in Settings → Billing.
 * A banner points there while it's off.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StaffMenuPage() {
  const identity = await getStaffIdentity();

  if (!identity) {
    redirect("/staff/sign-in");
  }
  if (identity.role !== "owner" && identity.role !== "manager") {
    redirect("/staff/floor");
  }

  const billing = await getVenueBilling(identity.venueId);

  if (billing.locked) {
    return (
      <TrialLocked
        hasHotel={billing.hasHotel}
        venueName={identity.venueName}
        isOwner={identity.role === "owner"}
        reason={billing.lockReason}
        venueCount={identity.venues?.length ?? 1}
      />
    );
  }

  const store = await cookies();
  const headerList = await headers();
  const locale = resolveStaffLocale(
    store.get(STAFF_LANG_COOKIE)?.value,
    headerList.get("accept-language")
  );
  const t = getOrderingStrings(locale);

  const service = getServiceClient();
  const [{ data: venue }, menu, stations, linkedBar] = await Promise.all([
    service
      .from("venues")
      .select("locales, default_locale, menu_auto_translate")
      .eq("id", identity.venueId)
      .maybeSingle<{
        locales: string[] | null;
        default_locale: string | null;
        menu_auto_translate: boolean | null;
      }>(),
    loadStaffMenu(identity.venueId),
    loadVenueStations(identity.venueId),
    // "Also on the bar menu" — only offered on full menus with a bar
    // on the same account to publish to.
    identity.edition === "bar"
      ? Promise.resolve(null)
      : linkedBarVenue(identity.venueId),
  ]);

  const venueLocales =
    venue?.locales && venue.locales.length > 0
      ? venue.locales
      : [venue?.default_locale ?? "en"];

  return (
    <StaffShell
      active="menu"
      displayName={identity.displayName}
      role={identity.role}
      venueId={identity.venueId}
      venues={identity.venues}
    >
      <main className="mtv-menued-page">
        <header className="mtv-menued-header">
          <div>
            <h1>{t.editor.title}</h1>
            <p>{t.editor.sub}</p>
          </div>
        </header>

        {!billing.orderingLive ? (
          <p className="mtv-menued-banner">
            {billing.orderingActive ? t.billing.statusBlocked : t.billing.statusOff}{" "}
            {identity.role === "owner" ? (
              <Link href="/staff/settings" className="mtv-billing-link">
                {t.billing.title} →
              </Link>
            ) : null}
          </p>
        ) : null}

        <MenuEditor
          initialMenu={menu}
          venueLocales={venueLocales}
          defaultLocale={venue?.default_locale ?? venueLocales[0] ?? "en"}
          autoTranslate={venue?.menu_auto_translate ?? true}
          stations={stations}
          barShareName={linkedBar?.name ?? null}
        />
      </main>
    </StaffShell>
  );
}
