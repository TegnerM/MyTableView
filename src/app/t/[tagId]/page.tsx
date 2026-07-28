import { headers } from "next/headers";
import type { Metadata } from "next";
import { resolveTag, type ResolveFailure } from "@/lib/guest/resolve-tag";
import { RequestPanel } from "@/components/guest/RequestPanel";
import { SessionStatusBar } from "@/components/guest/SessionStatusBar";
import { BrandMark } from "@/components/BrandMark";
import {
  getUiStrings,
  pickLocale,
  resolveGuestLocale,
} from "@/lib/i18n/guest";
import "./guest.css";

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
    return <GuestError reason={result.reason} />;
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

function GuestError({ reason }: { reason: ResolveFailure }) {
  const strings = getUiStrings("en");

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
