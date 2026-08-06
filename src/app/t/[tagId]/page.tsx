import { headers } from "next/headers";
import type { Metadata } from "next";
import { resolveTag, type ResolveFailure } from "@/lib/guest/resolve-tag";
import { getStaffIdentity } from "@/lib/staff/floor-state";
import { getServiceClient } from "@/lib/supabase/service";
import { RequestPanel } from "@/components/guest/RequestPanel";
import { SessionStatusBar } from "@/components/guest/SessionStatusBar";
import { TagAssignPanel } from "@/components/staff/TagAssignPanel";
import { BrandMark } from "@/components/BrandMark";
import {
  getUiStrings,
  pickLocale,
  resolveGuestLocale,
  UI_LOCALES,
} from "@/lib/i18n/guest";
import "./guest.css";
import "./tag-assign.css";

/**
 * The guest page — Beach Club Luxury theme (external redesign,
 * integrated). Changes from the delivered design, all substance:
 *   - floating bottom navigation removed (owner's call)
 *   - the status strip shows REAL session data, not mock values
 *   - all copy localized (EN/ES) like the rest of the guest surface
 *   - the dead hamburger button dropped; a spacer keeps the title centred
 *   - discreet MyTableView mark at the foot (logo on every page)
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ tagId: string }>;
};

export default async function GuestTagPage({ params }: PageProps) {
  const { tagId } = await params;
  const result = await resolveTag(tagId);

  if (!result.ok) {
    // Tap-to-assign: an UNASSIGNED (but real) tag opened by a signed-in
    // owner/manager becomes the assignment screen — stick the chip on a
    // table, tap it, pick the table, live. Guests and everyone else see
    // the normal error; the tag's existence is all they learn.
    if (result.reason === "tag_not_assigned") {
      const identity = await getStaffIdentity();

      if (
        identity &&
        (identity.role === "owner" || identity.role === "manager")
      ) {
        const service = getServiceClient();
        const { data: tables } = await service
          .from("tables")
          .select("id, label")
          .eq("venue_id", identity.venueId)
          .eq("active", true)
          .order("label", { ascending: true })
          .returns<{ id: string; label: string }[]>();

        return (
          <TagAssignPanel
            tagId={tagId.trim().toLowerCase()}
            venueName={identity.venueName}
            tables={tables ?? []}
          />
        );
      }
    }

    // No venue context on error screens — resolve the language from
    // the phone alone, against every language the UI ships in.
    const errorHeaders = await headers();
    const errorLocale = resolveGuestLocale(
      errorHeaders.get("accept-language"),
      UI_LOCALES,
      "en"
    );
    return <GuestError reason={result.reason} locale={errorLocale} />;
  }

  const { context } = result;
  const headerList = await headers();
  const locale = resolveGuestLocale(
    headerList.get("accept-language"),
    context.venue.locales,
    context.venue.defaultLocale
  );

  const strings = getUiStrings(locale);
  const zoneName = context.table.areaName
    ? pickLocale(context.table.areaName, locale, context.venue.defaultLocale)
    : "";

  return (
    <main className="mtv-guest">
      {/* Hero header with background image */}
      <header
        className="mtv-guest-hero"
        style={{ backgroundImage: `url('/beach-club-hero.jpg')` }}
      >
        <div className="mtv-hero-overlay" />
        <div className="mtv-hero-content-wrapper">
          {/* Language follows the phone automatically; no controls
              stand between the guest and the photo. */}
          <div className="mtv-top-bar">
            <div className="mtv-brand-header">
              <h1 className="mtv-venue-title">{context.venue.name}</h1>
              {zoneName ? (
                <span className="mtv-venue-subtitle">{zoneName}</span>
              ) : null}
            </div>
          </div>

          {/* Welcome copy & table badge */}
          <div className="mtv-welcome-container">
            <h2 className="mtv-welcome-title">{strings.welcome}</h2>
            <p className="mtv-welcome-sub">{strings.howCanWeHelp}</p>
          </div>
        </div>
      </header>

      {/* Main content sheet */}
      <section className="mtv-guest-body">
        <div className="mtv-section-divider">
          <h3 className="mtv-section-title">{strings.makeARequest}</h3>
        </div>

        <RequestPanel
          tagId={context.tagId}
          locale={locale}
          venueDefaultLocale={context.venue.defaultLocale}
          requestTypes={context.requestTypes.map((type) => ({
            id: type.id,
            code: type.code,
            kind: type.kind,
            label: type.label,
            sublabel: type.sublabel,
            icon: type.icon,
            closesSession: type.closesSession,
          }))}
          initiallyOpenTypeIds={context.openRequestTypeIds}
        />

        <SessionStatusBar
          tableLabel={context.table.label}
          areaName={context.table.areaName}
          openedAt={context.session.openedAt}
          guestCount={context.session.guestCount}
          locale={locale}
          venueDefaultLocale={context.venue.defaultLocale}
        />

        <p className="mtv-guest-footer-note">
          {strings.enjoyYourStay.replace("{venue}", context.venue.name)} 💛
        </p>

        <div className="mtv-guest-powered">
          <BrandMark className="mtv-guest-brand" />
        </div>
      </section>
    </main>
  );
}

function GuestError({
  reason,
  locale,
}: {
  reason: ResolveFailure;
  locale: string;
}) {
  const strings = getUiStrings(locale);

  const copy: Record<ResolveFailure, { title: string; body: string }> = {
    invalid_format: {
      title: strings.tagUnknownTitle,
      body: strings.tagUnknownBody,
    },
    unknown_tag: {
      title: strings.tagUnknownTitle,
      body: strings.tagUnknownBody,
    },
    tag_not_assigned: {
      title: strings.tagUnassignedTitle,
      body: strings.tagUnassignedBody,
    },
    venue_hibernating: {
      title: strings.venueClosedTitle,
      body: strings.venueClosedBody,
    },
    venue_unavailable: {
      title: strings.venueUnavailableTitle,
      body: strings.venueUnavailableBody,
    },
    error: { title: strings.somethingWentWrong, body: strings.tryAgain },
  };

  const { title, body } = copy[reason];

  return (
    <main className="mtv-guest mtv-guest-error">
      <div className="mtv-error-card">
        <h1 className="mtv-error-title">{title}</h1>
        <p className="mtv-error-body">{body}</p>
      </div>
    </main>
  );
}
