import { getServiceClient } from "@/lib/supabase/service";
import {
  BAR_EDITION_STATION_NAMES,
  DEFAULT_STATIONS,
  HOUSEKEEPING_STATION,
  loadVenueStations,
} from "@/lib/stations";
import type { LocaleMap } from "@/lib/menu/types";

/**
 * Edition application — shared by signup (a venue born as a bar) and
 * Settings → Venue type (a venue switched later). One implementation,
 * so the two paths can never drift.
 *
 * Applying an edition is presentation + defaults, never data:
 *   - venues.edition (the guest page branches on it)
 *   - station display names (kitchen → "Snack kitchen" on bar)
 *   - bar request types, seeded ONCE by code (never duplicated,
 *     never removed on switch-back — the owner may have customized)
 */

export const EDITIONS = new Set(["restaurant", "bar", "hotel"]);

/** The bar's guest buttons. Codes are stable; inserts skip any code the
 *  venue already has, so re-applying never duplicates a button. */
export const BAR_REQUEST_TYPES: {
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

/** The hotel's guest buttons — housekeeping codes carry the hotel_hk_
 *  prefix so the guest page can group them onto one sheet. */
export const HOTEL_REQUEST_TYPES: {
  code: string;
  label: LocaleMap;
  sublabel: LocaleMap;
  icon: string;
  closesSession: boolean;
  sortOrder: number;
}[] = [
  {
    code: "hotel_hk_towels",
    icon: "towel",
    closesSession: false,
    sortOrder: 61,
    label: {
      en: "Fresh towels", es: "Toallas limpias", da: "Friske håndklæder",
      sv: "Rena handdukar", no: "Rene håndklær", de: "Frische Handtücher",
      nl: "Verse handdoeken", fr: "Serviettes propres",
    },
    sublabel: {},
  },
  {
    code: "hotel_hk_makeup",
    icon: "bed",
    closesSession: false,
    sortOrder: 62,
    label: {
      en: "Make up my room", es: "Arreglar mi habitación",
      da: "Gør mit værelse rent", sv: "Städa mitt rum",
      no: "Gjør i stand rommet mitt", de: "Zimmer aufräumen",
      nl: "Kamer opmaken", fr: "Faire ma chambre",
    },
    sublabel: {
      en: "We'll come while you're out", es: "Iremos mientras estás fuera",
      da: "Vi kommer, mens du er ude", sv: "Vi kommer medan du är ute",
      no: "Vi kommer mens du er ute",
      de: "Wir kommen, während Sie unterwegs sind",
      nl: "We komen terwijl je weg bent",
      fr: "Nous passons pendant votre absence",
    },
  },
  {
    code: "hotel_hk_pillows",
    icon: "pillow",
    closesSession: false,
    sortOrder: 63,
    label: {
      en: "Extra pillows & blanket", es: "Almohadas y manta extra",
      da: "Ekstra puder og tæppe", sv: "Extra kuddar och filt",
      no: "Ekstra puter og teppe", de: "Extra Kissen & Decke",
      nl: "Extra kussens en deken", fr: "Oreillers et couverture en plus",
    },
    sublabel: {},
  },
  {
    code: "hotel_hk_amenities",
    icon: "soap",
    closesSession: false,
    sortOrder: 64,
    label: {
      en: "Amenities refill", es: "Reponer amenities",
      da: "Genopfyld amenities", sv: "Påfyllning av amenities",
      no: "Etterfyll amenities", de: "Amenities auffüllen",
      nl: "Toiletartikelen aanvullen", fr: "Recharge d'articles de toilette",
    },
    sublabel: {
      en: "Soap, shampoo, coffee & tea", es: "Jabón, champú, café y té",
      da: "Sæbe, shampoo, kaffe og te", sv: "Tvål, schampo, kaffe och te",
      no: "Såpe, sjampo, kaffe og te", de: "Seife, Shampoo, Kaffee & Tee",
      nl: "Zeep, shampoo, koffie en thee", fr: "Savon, shampoing, café et thé",
    },
  },
  {
    code: "hotel_hk_coffee",
    icon: "coffee",
    closesSession: false,
    sortOrder: 65,
    label: {
      en: "Extra coffee, tea, sugar & milk", es: "Más café, té, azúcar y leche",
      da: "Mere kaffe, te, sukker og mælk", sv: "Mer kaffe, te, socker och mjölk",
      no: "Mer kaffe, te, sukker og melk", de: "Mehr Kaffee, Tee, Zucker & Milch",
      nl: "Extra koffie, thee, suiker en melk", fr: "Plus de café, thé, sucre et lait",
    },
    sublabel: {
      en: "Refill the room tray", es: "Reponer la bandeja de la habitación",
      da: "Genopfyld bakken på værelset", sv: "Fyll på rummets bricka",
      no: "Etterfyll brettet på rommet", de: "Das Zimmertablett auffüllen",
      nl: "Het blad op de kamer aanvullen", fr: "Recharger le plateau de la chambre",
    },
  },
  {
    code: "hotel_maintenance",
    icon: "wrench",
    closesSession: false,
    sortOrder: 66,
    label: {
      en: "Maintenance issue", es: "Avería / mantenimiento",
      da: "Noget virker ikke", sv: "Något är trasigt",
      no: "Noe virker ikke", de: "Technisches Problem",
      nl: "Storing / defect", fr: "Problème technique",
    },
    sublabel: {
      en: "Tell us what's not working", es: "Cuéntanos qué no funciona",
      da: "Fortæl os, hvad der ikke virker", sv: "Berätta vad som inte fungerar",
      no: "Fortell oss hva som ikke virker",
      de: "Sagen Sie uns, was nicht funktioniert",
      nl: "Vertel ons wat er niet werkt",
      fr: "Dites-nous ce qui ne fonctionne pas",
    },
  },
  {
    code: "hotel_book_table",
    icon: "wine",
    closesSession: false,
    sortOrder: 67,
    label: {
      en: "Book a table for dinner", es: "Reservar mesa para cenar",
      da: "Book et bord til middag", sv: "Boka bord till middag",
      no: "Bestill bord til middag", de: "Tisch zum Abendessen reservieren",
      nl: "Tafel reserveren voor het diner", fr: "Réserver une table pour le dîner",
    },
    sublabel: {
      en: "At the hotel restaurant", es: "En el restaurante del hotel",
      da: "På hotellets restaurant", sv: "På hotellets restaurang",
      no: "På hotellets restaurant", de: "Im Hotelrestaurant",
      nl: "In het hotelrestaurant", fr: "Au restaurant de l'hôtel",
    },
  },
  {
    code: "hotel_taxi",
    icon: "taxi",
    closesSession: false,
    sortOrder: 68,
    label: {
      en: "Book a taxi", es: "Pedir un taxi", da: "Bestil en taxa",
      sv: "Boka en taxi", no: "Bestill en taxi", de: "Ein Taxi bestellen",
      nl: "Een taxi boeken", fr: "Réserver un taxi",
    },
    sublabel: {
      en: "We'll send one to the entrance", es: "Lo enviamos a la entrada",
      da: "Vi sender en til indgangen", sv: "Vi skickar en till entrén",
      no: "Vi sender en til inngangen", de: "Wir schicken eins zum Eingang",
      nl: "We sturen er een naar de ingang", fr: "Nous l'envoyons à l'entrée",
    },
  },
  {
    code: "hotel_concierge",
    icon: "bell",
    closesSession: false,
    sortOrder: 69,
    label: {
      en: "Concierge", es: "Conserjería", da: "Concierge", sv: "Concierge",
      no: "Concierge", de: "Concierge", nl: "Concierge", fr: "Conciergerie",
    },
    sublabel: {
      en: "Recommendations, taxis, anything",
      es: "Recomendaciones, taxis, lo que necesites",
      da: "Anbefalinger, taxa, hvad som helst",
      sv: "Tips, taxi, vad som helst",
      no: "Anbefalinger, taxi, hva som helst",
      de: "Empfehlungen, Taxis, alles Weitere",
      nl: "Tips, taxi's, van alles",
      fr: "Conseils, taxis, tout ce qu'il vous faut",
    },
  },
  {
    code: "hotel_late_checkout",
    icon: "clock",
    closesSession: false,
    sortOrder: 70,
    label: {
      en: "Late check-out", es: "Salida tardía", da: "Sen check-ud",
      sv: "Sen utcheckning", no: "Sen utsjekk", de: "Später Check-out",
      nl: "Late check-out", fr: "Départ tardif",
    },
    sublabel: {
      en: "We'll check availability", es: "Comprobaremos disponibilidad",
      da: "Vi tjekker, om det er muligt", sv: "Vi kollar om det går",
      no: "Vi sjekker om det er mulig", de: "Wir prüfen die Verfügbarkeit",
      nl: "We kijken of het kan", fr: "Nous vérifions la disponibilité",
    },
  },
];

/**
 * Set a venue's edition and apply its defaults. Returns false only
 * when the edition value itself is invalid or the venue update fails;
 * station/request-type seeding is best-effort and logged.
 */
export async function applyEdition(
  venueId: string,
  edition: string
): Promise<boolean> {
  if (!EDITIONS.has(edition)) {
    return false;
  }

  const service = getServiceClient();

  const { error: venueError } = await service
    .from("venues")
    .update({ edition })
    .eq("id", venueId);

  if (venueError) {
    console.error("applyEdition: venue update failed", venueError.message);
    return false;
  }

  // Station display names follow the edition (slugs never change).
  // loadVenueStations first: it seeds the defaults if the venue
  // predates the stations table (or was created seconds ago).
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
      console.error("applyEdition: station rename failed", stationError.message);
    }
  }

  // The housekeeping station exists (and is active) only on hotels.
  if (edition === "hotel") {
    const { error: hkError } = await service
      .from("stations")
      .upsert(
        {
          venue_id: venueId,
          slug: HOUSEKEEPING_STATION.slug,
          name: HOUSEKEEPING_STATION.name,
          sort_order: HOUSEKEEPING_STATION.sortOrder,
          active: true,
        },
        { onConflict: "venue_id,slug" }
      );
    if (hkError) {
      console.error("applyEdition: housekeeping station failed", hkError.message);
    }
  } else {
    const { error: hkError } = await service
      .from("stations")
      .update({ active: false })
      .eq("venue_id", venueId)
      .eq("slug", HOUSEKEEPING_STATION.slug);
    if (hkError) {
      console.error("applyEdition: housekeeping retire failed", hkError.message);
    }
    // Categories still routed to the retired station would create
    // tickets no board can see — re-route them to the kitchen.
    const { error: rerouteError } = await service
      .from("menu_categories")
      .update({ station: "kitchen" })
      .eq("venue_id", venueId)
      .eq("station", HOUSEKEEPING_STATION.slug);
    if (rerouteError) {
      console.error("applyEdition: category re-route failed", rerouteError.message);
    }
  }

  // Edition guest buttons — seed the missing ones only (by code, so
  // re-applying never duplicates and owner customizations survive).
  const seeds =
    edition === "bar"
      ? BAR_REQUEST_TYPES
      : edition === "hotel"
        ? HOTEL_REQUEST_TYPES
        : [];

  if (seeds.length > 0) {
    const { data: existing, error: existingError } = await service
      .from("request_types")
      .select("code")
      .eq("venue_id", venueId)
      .returns<{ code: string }[]>();

    if (existingError) {
      console.error(
        "applyEdition: request types read failed",
        existingError.message
      );
    } else {
      const have = new Set((existing ?? []).map((row) => row.code));
      const missing = seeds.filter((type) => !have.has(type.code));

      // The schema allows ONE session-closing button per venue
      // (request_types_one_closer_per_venue). When the edition brings
      // its own closer (the bar's "Bring the bill"), the default
      // "Request the Bill" must hand over the role first — retire it
      // (off + no longer a closer) so the edition button can take its
      // place. Any further closers in the seed list land as ordinary
      // signals. The old batch insert tripped the constraint and lost
      // the WHOLE batch, so bar signups ended up with no bar buttons
      // at all.
      if (missing.some((type) => type.closesSession)) {
        const { error: retireError } = await service
          .from("request_types")
          .update({ active: false, closes_session: false })
          .eq("venue_id", venueId)
          .eq("closes_session", true);
        if (retireError) {
          console.error(
            "applyEdition: retiring default closer failed",
            retireError.message
          );
        }
      }

      let closerAssigned = false;
      for (const type of missing) {
        const closes = type.closesSession && !closerAssigned;
        const { error: seedError } = await service.from("request_types").insert({
          venue_id: venueId,
          code: type.code,
          kind: "signal",
          label: type.label,
          sublabel: type.sublabel,
          icon: type.icon,
          closes_session: closes,
          sort_order: type.sortOrder,
          active: true,
        });
        if (seedError) {
          console.error(
            "applyEdition: request type seed failed",
            type.code,
            seedError.message
          );
        } else if (closes) {
          closerAssigned = true;
        }
      }
    }
  }

  return true;
}
