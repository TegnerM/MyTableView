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
  da: {
    welcome: "Velkommen!",
    howCanWeHelp: "Hvad kan vi hjælpe med i dag?",
    table: "Bord",
    makeARequest: "Send en forespørgsel",
    sending: "Sender…",
    requestSent: "Forespørgsel sendt",
    onTheWay: "Der er nogen på vej",
    alreadyRequested: "Allerede bestilt",
    requestAgain: "Bestil igen",
    thankYou: "Tak",
    timeAtTable: "Tid ved bordet",
    somethingWentWrong: "Noget gik galt",
    tryAgain: "Prøv igen",
    tagUnknownTitle: "Ukendt brik",
    tagUnknownBody:
      "Denne brik er ikke aktiv. Spørg venligst personalet om hjælp.",
    tagUnassignedTitle: "Ikke sat op endnu",
    tagUnassignedBody:
      "Denne brik er ikke knyttet til et bord. Spørg venligst personalet.",
    venueClosedTitle: "Lukket for sæsonen",
    venueClosedBody: "Stedet tager ikke imod forespørgsler i øjeblikket.",
    venueUnavailableTitle: "Ikke tilgængelig",
    venueUnavailableBody: "Denne service er ikke tilgængelig lige nu.",
    menuComingSoonTitle: "Menukort",
    menuComingSoonBody: "Menukortet er ikke tilgængeligt endnu.",
    rateTitle: "Mens du venter — hvordan var det hele?",
    rateFood: "Maden",
    rateService: "Betjeningen",
    rateThanks: "Tak for din feedback!",
    rateSkip: "Spring over",
    enjoyYourStay: "Nyd dit besøg på {venue}",
    appreciateYou: "Vi sætter pris på dit besøg",
    guests: "Gæster",
  },
  sv: {
    welcome: "Välkommen!",
    howCanWeHelp: "Vad kan vi hjälpa till med idag?",
    table: "Bord",
    makeARequest: "Skicka en förfrågan",
    sending: "Skickar…",
    requestSent: "Förfrågan skickad",
    onTheWay: "Någon är på väg",
    alreadyRequested: "Redan beställt",
    requestAgain: "Beställ igen",
    thankYou: "Tack",
    timeAtTable: "Tid vid bordet",
    somethingWentWrong: "Något gick fel",
    tryAgain: "Försök igen",
    tagUnknownTitle: "Okänd bricka",
    tagUnknownBody:
      "Den här brickan är inte aktiv. Be gärna personalen om hjälp.",
    tagUnassignedTitle: "Inte klar ännu",
    tagUnassignedBody:
      "Den här brickan är inte kopplad till något bord. Be gärna personalen om hjälp.",
    venueClosedTitle: "Stängt för säsongen",
    venueClosedBody: "Stället tar inte emot förfrågningar just nu.",
    venueUnavailableTitle: "Inte tillgänglig",
    venueUnavailableBody: "Tjänsten är inte tillgänglig just nu.",
    menuComingSoonTitle: "Meny",
    menuComingSoonBody: "Menyn är inte tillgänglig ännu.",
    rateTitle: "Medan du väntar — hur var allt?",
    rateFood: "Maten",
    rateService: "Servicen",
    rateThanks: "Tack för din feedback!",
    rateSkip: "Hoppa över",
    enjoyYourStay: "Njut av din tid på {venue}",
    appreciateYou: "Vi uppskattar ditt besök",
    guests: "Gäster",
  },
  no: {
    welcome: "Velkommen!",
    howCanWeHelp: "Hva kan vi hjelpe deg med i dag?",
    table: "Bord",
    makeARequest: "Send en forespørsel",
    sending: "Sender…",
    requestSent: "Forespørsel sendt",
    onTheWay: "Noen er på vei",
    alreadyRequested: "Allerede bestilt",
    requestAgain: "Bestill igjen",
    thankYou: "Takk",
    timeAtTable: "Tid ved bordet",
    somethingWentWrong: "Noe gikk galt",
    tryAgain: "Prøv igjen",
    tagUnknownTitle: "Ukjent brikke",
    tagUnknownBody:
      "Denne brikken er ikke aktiv. Spør gjerne personalet om hjelp.",
    tagUnassignedTitle: "Ikke satt opp ennå",
    tagUnassignedBody:
      "Denne brikken er ikke knyttet til et bord. Spør gjerne personalet.",
    venueClosedTitle: "Stengt for sesongen",
    venueClosedBody: "Stedet tar ikke imot forespørsler for øyeblikket.",
    venueUnavailableTitle: "Ikke tilgjengelig",
    venueUnavailableBody: "Denne tjenesten er ikke tilgjengelig akkurat nå.",
    menuComingSoonTitle: "Meny",
    menuComingSoonBody: "Menyen er ikke tilgjengelig ennå.",
    rateTitle: "Mens du venter — hvordan var alt?",
    rateFood: "Maten",
    rateService: "Servicen",
    rateThanks: "Takk for tilbakemeldingen!",
    rateSkip: "Hopp over",
    enjoyYourStay: "Nyt tiden din på {venue}",
    appreciateYou: "Vi setter pris på besøket ditt",
    guests: "Gjester",
  },
  de: {
    welcome: "Willkommen!",
    howCanWeHelp: "Womit dürfen wir Ihnen heute helfen?",
    table: "Tisch",
    makeARequest: "Wunsch senden",
    sending: "Wird gesendet…",
    requestSent: "Wunsch gesendet",
    onTheWay: "Jemand ist unterwegs",
    alreadyRequested: "Bereits angefragt",
    requestAgain: "Erneut anfragen",
    thankYou: "Vielen Dank",
    timeAtTable: "Zeit am Tisch",
    somethingWentWrong: "Etwas ist schiefgelaufen",
    tryAgain: "Bitte erneut versuchen",
    tagUnknownTitle: "Chip nicht erkannt",
    tagUnknownBody:
      "Dieser Chip ist nicht aktiv. Bitte wenden Sie sich an das Personal.",
    tagUnassignedTitle: "Noch nicht eingerichtet",
    tagUnassignedBody:
      "Dieser Chip ist keinem Tisch zugeordnet. Bitte wenden Sie sich an das Personal.",
    venueClosedTitle: "Saisonbedingt geschlossen",
    venueClosedBody: "Dieses Lokal nimmt derzeit keine Wünsche entgegen.",
    venueUnavailableTitle: "Nicht verfügbar",
    venueUnavailableBody: "Dieser Service ist im Moment nicht verfügbar.",
    menuComingSoonTitle: "Speisekarte",
    menuComingSoonBody: "Die Speisekarte ist noch nicht verfügbar.",
    rateTitle: "Während Sie warten — wie war alles?",
    rateFood: "Das Essen",
    rateService: "Der Service",
    rateThanks: "Vielen Dank für Ihr Feedback!",
    rateSkip: "Überspringen",
    enjoyYourStay: "Genießen Sie Ihre Zeit im {venue}",
    appreciateYou: "Wir freuen uns über Ihren Besuch",
    guests: "Gäste",
  },
  nl: {
    welcome: "Welkom!",
    howCanWeHelp: "Waarmee kunnen we u vandaag helpen?",
    table: "Tafel",
    makeARequest: "Verzoek versturen",
    sending: "Versturen…",
    requestSent: "Verzoek verstuurd",
    onTheWay: "Er is iemand onderweg",
    alreadyRequested: "Al aangevraagd",
    requestAgain: "Opnieuw aanvragen",
    thankYou: "Dank u wel",
    timeAtTable: "Tijd aan tafel",
    somethingWentWrong: "Er ging iets mis",
    tryAgain: "Probeer het opnieuw",
    tagUnknownTitle: "Tag niet herkend",
    tagUnknownBody:
      "Deze tag is niet actief. Vraag het personeel om hulp.",
    tagUnassignedTitle: "Nog niet ingesteld",
    tagUnassignedBody:
      "Deze tag is niet aan een tafel gekoppeld. Vraag het personeel om hulp.",
    venueClosedTitle: "Gesloten voor het seizoen",
    venueClosedBody: "Deze zaak neemt momenteel geen verzoeken aan.",
    venueUnavailableTitle: "Niet beschikbaar",
    venueUnavailableBody: "Deze service is op dit moment niet beschikbaar.",
    menuComingSoonTitle: "Menukaart",
    menuComingSoonBody: "De menukaart is nog niet beschikbaar.",
    rateTitle: "Terwijl u wacht — hoe was alles?",
    rateFood: "Het eten",
    rateService: "De bediening",
    rateThanks: "Bedankt voor uw feedback!",
    rateSkip: "Overslaan",
    enjoyYourStay: "Geniet van uw tijd bij {venue}",
    appreciateYou: "We waarderen uw bezoek",
    guests: "Gasten",
  },
  fr: {
    welcome: "Bienvenue !",
    howCanWeHelp: "Comment pouvons-nous vous aider aujourd'hui ?",
    table: "Table",
    makeARequest: "Envoyer une demande",
    sending: "Envoi…",
    requestSent: "Demande envoyée",
    onTheWay: "Quelqu'un arrive",
    alreadyRequested: "Déjà demandé",
    requestAgain: "Demander à nouveau",
    thankYou: "Merci",
    timeAtTable: "Temps à table",
    somethingWentWrong: "Un problème est survenu",
    tryAgain: "Veuillez réessayer",
    tagUnknownTitle: "Badge non reconnu",
    tagUnknownBody:
      "Ce badge n'est pas actif. Veuillez demander de l'aide au personnel.",
    tagUnassignedTitle: "Pas encore configuré",
    tagUnassignedBody:
      "Ce badge n'est associé à aucune table. Veuillez demander de l'aide au personnel.",
    venueClosedTitle: "Fermé pour la saison",
    venueClosedBody: "Cet établissement n'accepte pas de demandes actuellement.",
    venueUnavailableTitle: "Indisponible",
    venueUnavailableBody: "Ce service n'est pas disponible pour le moment.",
    menuComingSoonTitle: "Carte",
    menuComingSoonBody: "La carte n'est pas encore disponible.",
    rateTitle: "Pendant que vous patientez — comment était-ce ?",
    rateFood: "La cuisine",
    rateService: "Le service",
    rateThanks: "Merci pour votre retour !",
    rateSkip: "Passer",
    enjoyYourStay: "Profitez de votre moment chez {venue}",
    appreciateYou: "Merci de votre visite",
    guests: "Convives",
  },
};

/** Every language the UI chrome ships in. */
export const UI_LOCALES = Object.keys(UI_STRINGS);

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
