/**
 * Guest-facing locale handling.
 *
 * Two separate concerns:
 *
 *   - Venue content (request type labels, area names, later menu items)
 *     is stored in the database as a locale map, so a venue can operate
 *     in any language without a schema change.
 *   - UI chrome (the strings below) ships with the app.
 *
 * EN and ES at launch. Adding a language is a matter of adding a block
 * to UI_STRINGS and a locale key to the venue's content — no code
 * changes anywhere else.
 */

export type Locale = string;

export const FALLBACK_LOCALE = "en";

export type LocaleMap = Record<string, string>;

/**
 * Picks the best string from a database locale map.
 *
 * Order: exact match, base language (es-MX -> es), venue default,
 * English, then whatever the map has. Never returns undefined, because
 * a missing translation must not blank out a button.
 */
export function pickLocale(
  map: LocaleMap | null | undefined,
  locale: Locale,
  venueDefault?: Locale
): string {
  if (!map) {
    return "";
  }

  if (map[locale]) {
    return map[locale];
  }

  const base = locale.split("-")[0];
  if (base && map[base]) {
    return map[base];
  }

  if (venueDefault && map[venueDefault]) {
    return map[venueDefault];
  }

  if (map[FALLBACK_LOCALE]) {
    return map[FALLBACK_LOCALE];
  }

  const first = Object.values(map)[0];
  return first ?? "";
}

/**
 * Chooses which locale to render for this guest.
 *
 * The guest's browser is the best signal — they tapped a tag, they did
 * not choose a language. If their language is one the venue publishes,
 * use it. Otherwise fall back to the venue's default.
 */
export function resolveGuestLocale(
  acceptLanguage: string | null,
  venueLocales: string[],
  venueDefault: string
): Locale {
  if (!acceptLanguage || venueLocales.length === 0) {
    return venueDefault;
  }

  const preferences = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return {
        tag: tag.trim().toLowerCase(),
        weight: q ? Number.parseFloat(q) : 1,
      };
    })
    .filter((p) => p.tag.length > 0 && !Number.isNaN(p.weight))
    .sort((a, b) => b.weight - a.weight);

  const available = venueLocales.map((l) => l.toLowerCase());

  for (const preference of preferences) {
    if (available.includes(preference.tag)) {
      return preference.tag;
    }

    const base = preference.tag.split("-")[0];
    const match = available.find((l) => l === base || l.startsWith(`${base}-`));
    if (match) {
      return match;
    }
  }

  return venueDefault;
}

type UiStrings = {
  welcome: string;
  howCanWeHelp: string;
  table: string;
  makeARequest: string;
  sending: string;
  requestSent: string;
  onTheWay: string;
  alreadyRequested: string;
  requestAgain: string;
  thankYou: string;
  timeAtTable: string;
  somethingWentWrong: string;
  tryAgain: string;
  tagUnknownTitle: string;
  tagUnknownBody: string;
  tagUnassignedTitle: string;
  tagUnassignedBody: string;
  venueClosedTitle: string;
  venueClosedBody: string;
  venueUnavailableTitle: string;
  venueUnavailableBody: string;
  menuComingSoonTitle: string;
  menuComingSoonBody: string;
  rateTitle: string;
  rateFood: string;
  rateService: string;
  rateThanks: string;
  rateSkip: string;
  enjoyYourStay: string;
  appreciateYou: string;
  guests: string;
};

export const UI_STRINGS: Record<string, UiStrings> = {
  en: {
    welcome: "Welcome!",
    howCanWeHelp: "How can we help you today?",
    table: "Table",
    makeARequest: "Make a request",
    sending: "Sending…",
    requestSent: "Request sent",
    onTheWay: "Someone is on the way",
    alreadyRequested: "Already requested",
    requestAgain: "Request again",
    thankYou: "Thank you",
    timeAtTable: "Time at table",
    somethingWentWrong: "Something went wrong",
    tryAgain: "Try again",
    tagUnknownTitle: "Tag not recognised",
    tagUnknownBody:
      "This tag is not active. Please ask a member of staff for help.",
    tagUnassignedTitle: "Not set up yet",
    tagUnassignedBody:
      "This tag has not been assigned to a table. Please ask a member of staff.",
    venueClosedTitle: "Closed for the season",
    venueClosedBody: "This venue is not currently taking requests.",
    venueUnavailableTitle: "Unavailable",
    venueUnavailableBody: "This service is not available right now.",
    menuComingSoonTitle: "Menu",
    menuComingSoonBody: "The menu is not available yet.",
    rateTitle: "While you wait — how was everything?",
    rateFood: "The food",
    rateService: "The service",
    rateThanks: "Thank you for your feedback!",
    rateSkip: "Skip",
    enjoyYourStay: "Enjoy your time at {venue}",
    appreciateYou: "We appreciate you",
    guests: "Guests",
  },
  es: {
    welcome: "¡Bienvenido!",
    howCanWeHelp: "¿En qué podemos ayudarle hoy?",
    table: "Mesa",
    makeARequest: "Hacer una petición",
    sending: "Enviando…",
    requestSent: "Petición enviada",
    onTheWay: "Alguien viene en camino",
    alreadyRequested: "Ya solicitado",
    requestAgain: "Solicitar de nuevo",
    thankYou: "Gracias",
    timeAtTable: "Tiempo en la mesa",
    somethingWentWrong: "Algo ha salido mal",
    tryAgain: "Inténtelo de nuevo",
    tagUnknownTitle: "Etiqueta no reconocida",
    tagUnknownBody:
      "Esta etiqueta no está activa. Por favor, pida ayuda al personal.",
    tagUnassignedTitle: "Aún no configurado",
    tagUnassignedBody:
      "Esta etiqueta no está asignada a ninguna mesa. Por favor, pida ayuda al personal.",
    venueClosedTitle: "Cerrado por temporada",
    venueClosedBody: "Este local no está aceptando peticiones actualmente.",
    venueUnavailableTitle: "No disponible",
    venueUnavailableBody: "Este servicio no está disponible en este momento.",
    menuComingSoonTitle: "Carta",
    menuComingSoonBody: "La carta aún no está disponible.",
    rateTitle: "Mientras espera — ¿qué tal ha ido todo?",
    rateFood: "La comida",
    rateService: "El servicio",
    rateThanks: "¡Gracias por su opinión!",
    rateSkip: "Omitir",
    enjoyYourStay: "Disfrute de su estancia en {venue}",
    appreciateYou: "Le agradecemos su visita",
    guests: "Comensales",
  },
};

export function getUiStrings(locale: Locale): UiStrings {
  if (UI_STRINGS[locale]) {
    return UI_STRINGS[locale];
  }

  const base = locale.split("-")[0];
  if (base && UI_STRINGS[base]) {
    return UI_STRINGS[base];
  }

  return UI_STRINGS[FALLBACK_LOCALE];
}
