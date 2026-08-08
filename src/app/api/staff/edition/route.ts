import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import {
  BAR_EDITION_STATION_NAMES,
  DEFAULT_STATIONS,
  loadVenueStations,
} from "@/lib/stations";
import type { LocaleMap } from "@/lib/menu/types";

/**
 * POST /api/staff/edition — switch a venue between editions.
 *
 * Owner only. Switching is presentation + defaults, never data:
 *   - venues.edition flips (the guest page branches on it)
 *   - station display names adapt (kitchen → "Snack kitchen" on bar)
 *   - bar request types are seeded ONCE (never duplicated, never
 *     removed on switch-back — the owner may have customized them)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITIONS = new Set(["restaurant", "bar"]);

/** The bar's guest buttons. Codes are stable; inserts skip any code the
 *  venue already has, so re-switching never duplicates a button. */
const BAR_REQUEST_TYPES: {
  code: string;
  label: LocaleMap;
  sublabel: LocaleMap;
  icon: string;
  closesSession: boolean;
  sortOrder: number;
}[] = [
  {
    code: "bar_napkins",
    icon: "napkin",
    closesSession: false,
    sortOrder: 41,
    label: {
      en: "More napkins", es: "Más servilletas", da: "Flere servietter",
      sv: "Fler servetter", no: "Flere servietter", de: "Mehr Servietten",
      nl: "Meer servetten", fr: "Plus de serviettes",
    },
    sublabel: {},
  },
  {
    code: "bar_clean_table",
    icon: "sparkle",
    closesSession: false,
    sortOrder: 42,
    label: {
      en: "Clean the table", es: "Limpiar la mesa", da: "Tør bordet af",
      sv: "Torka av bordet", no: "Tørk av bordet", de: "Tisch abwischen",
      nl: "Tafel schoonmaken", fr: "Nettoyer la table",
    },
    sublabel: {
      en: "Empty glasses, spills", es: "Vasos vacíos, derrames",
      da: "Tomme glas, spild", sv: "Tomma glas, spill",
      no: "Tomme glass, søl", de: "Leere Gläser, Verschüttetes",
      nl: "Lege glazen, gemors", fr: "Verres vides, renversements",
    },
  },
  {
    code: "bar_bill_table",
    icon: "bill",
    closesSession: true,
    sortOrder: 51,
    label: {
      en: "Bring the bill", es: "Traer la cuenta", da: "Kom med regningen",
      sv: "Ta hit notan", no: "Kom med regningen", de: "Die Rechnung bringen",
      nl: "Breng de rekening", fr: "Apporter l'addition",
    },
    sublabel: {
      en: "We'll pay at the table", es: "Pagamos en la mesa",
      da: "Vi betaler ved bordet", sv: "Vi betalar vid bordet",
      no: "Vi betaler ved bordet", de: "Wir zahlen am Tisch",
      nl: "We betalen aan tafel", fr: "Nous payons à la table",
    },
  },
  {
    code: "bar_bill_bar",
    icon: "bar",
    closesSession: true,
    sortOrder: 52,
    label: {
      en: "We'll pay at the bar", es: "Pagamos en la barra",
      da: "Vi betaler i baren", sv: "Vi betalar i baren",
      no: "Vi betaler i baren", de: "Wir zahlen an der Bar",
      nl: "We betalen aan de bar", fr: "Nous payons au bar",
    },
    sublabel: {
      en: "Just close our tab", es: "Solo cerrad la cuenta",
      da: "Luk bare vores regning", sv: "Stäng bara vår nota",
      no: "Bare lukk regningen vår", de: "Nur unsere Rechnung schließen",
      nl: "Sluit onze rekening maar", fr: "Fermez notre note",
    },
  },
];

export async function POST(request: Request) {
  let body: { edition?: unknown };
  try {
    body = (await request.json()) as { edition?: unknown };
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const edition = typeof body.edition === "string" ? body.edition : "";
  if (!EDITIONS.has(edition)) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  if (resolved.current.role !== "owner") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }
  const venueId = resolved.current.venueId;

  const service = getServiceClient();

  const { error: venueError } = await service
    .from("venues")
    .update({ edition })
    .eq("id", venueId);

  if (venueError) {
    console.error("edition: venue update failed", venueError.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  // Station display names follow the edition (slugs never change).
  // loadVenueStations first: it seeds the defaults if the venue
  // predates the stations table.
  await loadVenueStations(venueId);
  const names: Record<string, LocaleMap> =
    edition === "bar"
      ? BAR_EDITION_STATION_NAMES
      : Object.fromEntries(
          DEFAULT_STATIONS.map((station) => [station.slug, station.name])
        );
  for (const [slug, name] of Object.entries(names)) {
    const { error: stationError } = await service
      .from("stations")
      .update({ name })
      .eq("venue_id", venueId)
      .eq("slug", slug);
    if (stationError) {
      console.error("edition: station rename failed", stationError.message);
    }
  }

  // Bar request buttons — seed the missing ones only.
  if (edition === "bar") {
    const { data: existing, error: existingError } = await service
      .from("request_types")
      .select("code")
      .eq("venue_id", venueId)
      .returns<{ code: string }[]>();

    if (existingError) {
      console.error("edition: request types read failed", existingError.message);
    } else {
      const have = new Set((existing ?? []).map((row) => row.code));
      const missing = BAR_REQUEST_TYPES.filter((type) => !have.has(type.code));
      if (missing.length > 0) {
        const { error: seedError } = await service.from("request_types").insert(
          missing.map((type) => ({
            venue_id: venueId,
            code: type.code,
            kind: "signal",
            label: type.label,
            sublabel: type.sublabel,
            icon: type.icon,
            closes_session: type.closesSession,
            sort_order: type.sortOrder,
            active: true,
          }))
        );
        if (seedError) {
          console.error("edition: request types seed failed", seedError.message);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, edition });
}
