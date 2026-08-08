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

export type UiStrings = {
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
  menuViewTitle: string;
  menuViewSub: string;
  menuTitle: string;
  menuSoldOut: string;
  menuOptions: string;
  menuAddToOrder: string;
  menuViewOrder: string;
  menuYourOrder: string;
  menuAddNote: string;
  menuSubtotal: string;
  menuService: string;
  menuTotal: string;
  menuPayAtTable: string;
  menuPlaceOrder: string;
  menuOrderSentTitle: string;
  menuOrderSentBody: string;
  menuKeepOrdering: string;
  menuBackToStart: string;
  menuOrderFailed: string;
  menuOrderRateLimited: string;
  menuItemUnavailable: string;
  menuBack: string;
  barOrderDrinks: string;
  barOrderDrinksSub: string;
  barAnotherRound: string;
  barAnotherRoundSub: string;
  barSnacks: string;
  barSnacksSub: string;
  barCallStaff: string;
  barCallStaffSub: string;
  barCallStaffPrompt: string;
  barAskBill: string;
  barAskBillSub: string;
  barAskBillPrompt: string;
  barYourOrderIs: string;
  barStatusChip: string;
  barQuickAdd: string;
  barRepeatLast: string;
  barSendRound: string;
  barViewFullMenu: string;
  barRequestSentTitle: string;
  barRequestSentBody: string;
  barBackToHome: string;
  statusReceived: string;
  statusPreparing: string;
  statusOnTheWay: string;
  statusDelivered: string;
  statusOrderTitle: string;
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
    menuViewTitle: "View menu & order",
    menuViewSub: "Food & drinks, straight to your table",
    menuTitle: "Menu",
    menuSoldOut: "Sold out today",
    menuOptions: "Options",
    menuAddToOrder: "Add to order",
    menuViewOrder: "View order",
    menuYourOrder: "Your order",
    menuAddNote: "Add a note for the kitchen… (optional)",
    menuSubtotal: "Subtotal",
    menuService: "Service {pct}%",
    menuTotal: "Total",
    menuPayAtTable: "You pay at the table, as usual — nothing is charged online.",
    menuPlaceOrder: "Place order",
    menuOrderSentTitle: "Order sent!",
    menuOrderSentBody: "We've received your order for {table}. Your waiter is on it.",
    menuKeepOrdering: "Keep ordering",
    menuBackToStart: "Back to start",
    menuOrderFailed: "Could not send your order. Please try again.",
    menuOrderRateLimited: "Please wait a moment before ordering again.",
    menuItemUnavailable: "Sorry — something in your order just sold out. Please review it.",
    menuBack: "Back",
    barOrderDrinks: "Order drinks",
    barOrderDrinksSub: "Your favourites, one tap away",
    barAnotherRound: "Another round",
    barAnotherRoundSub: "Repeat your last order",
    barSnacks: "Snacks",
    barSnacksSub: "Light bites",
    barCallStaff: "Call staff",
    barCallStaffSub: "We're here",
    barCallStaffPrompt: "What do you need?",
    barAskBill: "Ask for bill",
    barAskBillSub: "We'll settle it up",
    barAskBillPrompt: "How would you like it?",
    barYourOrderIs: "Your order is",
    barStatusChip: "Your order:",
    barQuickAdd: "Quick-add your favourites",
    barRepeatLast: "Repeat last round",
    barSendRound: "Send round",
    barViewFullMenu: "View full menu",
    barRequestSentTitle: "Request sent!",
    barRequestSentBody: "We've notified our staff. They'll be with you shortly.",
    barBackToHome: "Back to home",
    statusReceived: "Received",
    statusPreparing: "Preparing",
    statusOnTheWay: "On the way",
    statusDelivered: "Delivered",
    statusOrderTitle: "Order status",
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
    menuViewTitle: "Ver carta y pedir",
    menuViewSub: "Comida y bebida, directo a su mesa",
    menuTitle: "Carta",
    menuSoldOut: "Agotado hoy",
    menuOptions: "Opciones",
    menuAddToOrder: "Añadir al pedido",
    menuViewOrder: "Ver pedido",
    menuYourOrder: "Su pedido",
    menuAddNote: "Añadir una nota para la cocina… (opcional)",
    menuSubtotal: "Subtotal",
    menuService: "Servicio {pct}%",
    menuTotal: "Total",
    menuPayAtTable: "Paga en la mesa, como siempre — no se cobra nada online.",
    menuPlaceOrder: "Enviar pedido",
    menuOrderSentTitle: "¡Pedido enviado!",
    menuOrderSentBody: "Hemos recibido su pedido para {table}. Su camarero se encarga.",
    menuKeepOrdering: "Seguir pidiendo",
    menuBackToStart: "Volver al inicio",
    menuOrderFailed: "No se pudo enviar el pedido. Inténtelo de nuevo.",
    menuOrderRateLimited: "Espere un momento antes de pedir de nuevo.",
    menuItemUnavailable: "Lo sentimos — algo de su pedido se acaba de agotar. Revíselo.",
    menuBack: "Atrás",
    barOrderDrinks: "Pedir bebidas",
    barOrderDrinksSub: "Tus favoritas, a un toque",
    barAnotherRound: "Otra ronda",
    barAnotherRoundSub: "Repite tu último pedido",
    barSnacks: "Snacks",
    barSnacksSub: "Para picar",
    barCallStaff: "Llamar al personal",
    barCallStaffSub: "Estamos aquí",
    barCallStaffPrompt: "¿Qué necesitas?",
    barAskBill: "Pedir la cuenta",
    barAskBillSub: "Lo arreglamos",
    barAskBillPrompt: "¿Cómo la quieres?",
    barYourOrderIs: "Tu pedido está",
    barStatusChip: "Tu pedido:",
    barQuickAdd: "Añade tus favoritas",
    barRepeatLast: "Repetir última ronda",
    barSendRound: "Enviar ronda",
    barViewFullMenu: "Ver carta completa",
    barRequestSentTitle: "¡Aviso enviado!",
    barRequestSentBody: "Hemos avisado al personal. Enseguida están contigo.",
    barBackToHome: "Volver al inicio",
    statusReceived: "Recibido",
    statusPreparing: "Preparando",
    statusOnTheWay: "En camino",
    statusDelivered: "Entregado",
    statusOrderTitle: "Estado del pedido",
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
    menuViewTitle: "Se menu & bestil",
    menuViewSub: "Mad og drikke, direkte til dit bord",
    menuTitle: "Menu",
    menuSoldOut: "Udsolgt i dag",
    menuOptions: "Tilvalg",
    menuAddToOrder: "Læg i bestilling",
    menuViewOrder: "Se bestilling",
    menuYourOrder: "Din bestilling",
    menuAddNote: "Tilføj en note til køkkenet… (valgfrit)",
    menuSubtotal: "Subtotal",
    menuService: "Service {pct}%",
    menuTotal: "I alt",
    menuPayAtTable: "Du betaler ved bordet som altid — intet trækkes online.",
    menuPlaceOrder: "Send bestilling",
    menuOrderSentTitle: "Bestilling sendt!",
    menuOrderSentBody: "Vi har modtaget din bestilling til {table}. Din tjener er i gang.",
    menuKeepOrdering: "Bestil mere",
    menuBackToStart: "Tilbage til start",
    menuOrderFailed: "Bestillingen kunne ikke sendes. Prøv igen.",
    menuOrderRateLimited: "Vent et øjeblik, før du bestiller igen.",
    menuItemUnavailable: "Beklager — noget i din bestilling er lige udsolgt. Se den efter.",
    menuBack: "Tilbage",
    barOrderDrinks: "Bestil drikkevarer",
    barOrderDrinksSub: "Dine favoritter, ét tryk væk",
    barAnotherRound: "En omgang til",
    barAnotherRoundSub: "Gentag din seneste bestilling",
    barSnacks: "Snacks",
    barSnacksSub: "Lette bidder",
    barCallStaff: "Tilkald personale",
    barCallStaffSub: "Vi er her",
    barCallStaffPrompt: "Hvad har du brug for?",
    barAskBill: "Bed om regningen",
    barAskBillSub: "Vi ordner det",
    barAskBillPrompt: "Hvordan vil du have den?",
    barYourOrderIs: "Din bestilling er",
    barStatusChip: "Din bestilling:",
    barQuickAdd: "Hurtig-tilføj dine favoritter",
    barRepeatLast: "Gentag seneste omgang",
    barSendRound: "Send omgang",
    barViewFullMenu: "Se hele menuen",
    barRequestSentTitle: "Anmodning sendt!",
    barRequestSentBody: "Vi har givet personalet besked. De er hos dig om lidt.",
    barBackToHome: "Tilbage til start",
    statusReceived: "Modtaget",
    statusPreparing: "Tilberedes",
    statusOnTheWay: "På vej",
    statusDelivered: "Leveret",
    statusOrderTitle: "Bestillingsstatus",
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
    menuViewTitle: "Se meny & beställ",
    menuViewSub: "Mat och dryck, direkt till ditt bord",
    menuTitle: "Meny",
    menuSoldOut: "Slutsåld idag",
    menuOptions: "Tillval",
    menuAddToOrder: "Lägg till i beställningen",
    menuViewOrder: "Visa beställning",
    menuYourOrder: "Din beställning",
    menuAddNote: "Lägg till en notering till köket… (valfritt)",
    menuSubtotal: "Delsumma",
    menuService: "Service {pct}%",
    menuTotal: "Totalt",
    menuPayAtTable: "Du betalar vid bordet som vanligt — inget dras online.",
    menuPlaceOrder: "Skicka beställning",
    menuOrderSentTitle: "Beställning skickad!",
    menuOrderSentBody: "Vi har tagit emot din beställning för {table}. Din servitör är på gång.",
    menuKeepOrdering: "Fortsätt beställa",
    menuBackToStart: "Tillbaka till start",
    menuOrderFailed: "Beställningen kunde inte skickas. Försök igen.",
    menuOrderRateLimited: "Vänta en stund innan du beställer igen.",
    menuItemUnavailable: "Tyvärr — något i din beställning tog just slut. Se över den.",
    menuBack: "Tillbaka",
    barOrderDrinks: "Beställ drycker",
    barOrderDrinksSub: "Dina favoriter, ett tryck bort",
    barAnotherRound: "En runda till",
    barAnotherRoundSub: "Upprepa din senaste beställning",
    barSnacks: "Snacks",
    barSnacksSub: "Enkla tilltugg",
    barCallStaff: "Kalla på personal",
    barCallStaffSub: "Vi är här",
    barCallStaffPrompt: "Vad behöver du?",
    barAskBill: "Be om notan",
    barAskBillSub: "Vi fixar det",
    barAskBillPrompt: "Hur vill du ha den?",
    barYourOrderIs: "Din beställning är",
    barStatusChip: "Din beställning:",
    barQuickAdd: "Snabblägg till favoriter",
    barRepeatLast: "Upprepa senaste rundan",
    barSendRound: "Skicka runda",
    barViewFullMenu: "Se hela menyn",
    barRequestSentTitle: "Förfrågan skickad!",
    barRequestSentBody: "Vi har meddelat personalen. De kommer strax.",
    barBackToHome: "Tillbaka till start",
    statusReceived: "Mottagen",
    statusPreparing: "Förbereds",
    statusOnTheWay: "På väg",
    statusDelivered: "Levererad",
    statusOrderTitle: "Beställningsstatus",
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
    menuViewTitle: "Se meny & bestill",
    menuViewSub: "Mat og drikke, rett til bordet ditt",
    menuTitle: "Meny",
    menuSoldOut: "Utsolgt i dag",
    menuOptions: "Tilvalg",
    menuAddToOrder: "Legg i bestillingen",
    menuViewOrder: "Se bestilling",
    menuYourOrder: "Din bestilling",
    menuAddNote: "Legg til en beskjed til kjøkkenet… (valgfritt)",
    menuSubtotal: "Delsum",
    menuService: "Service {pct}%",
    menuTotal: "Totalt",
    menuPayAtTable: "Du betaler ved bordet som vanlig — ingenting trekkes på nett.",
    menuPlaceOrder: "Send bestilling",
    menuOrderSentTitle: "Bestilling sendt!",
    menuOrderSentBody: "Vi har mottatt bestillingen din for {table}. Servitøren din er i gang.",
    menuKeepOrdering: "Bestill mer",
    menuBackToStart: "Tilbake til start",
    menuOrderFailed: "Bestillingen kunne ikke sendes. Prøv igjen.",
    menuOrderRateLimited: "Vent litt før du bestiller igjen.",
    menuItemUnavailable: "Beklager — noe i bestillingen din ble nettopp utsolgt. Se over den.",
    menuBack: "Tilbake",
    barOrderDrinks: "Bestill drikke",
    barOrderDrinksSub: "Favorittene dine, ett trykk unna",
    barAnotherRound: "En runde til",
    barAnotherRoundSub: "Gjenta forrige bestilling",
    barSnacks: "Snacks",
    barSnacksSub: "Lette biter",
    barCallStaff: "Tilkall personale",
    barCallStaffSub: "Vi er her",
    barCallStaffPrompt: "Hva trenger du?",
    barAskBill: "Be om regningen",
    barAskBillSub: "Vi ordner det",
    barAskBillPrompt: "Hvordan vil du ha den?",
    barYourOrderIs: "Bestillingen din er",
    barStatusChip: "Din bestilling:",
    barQuickAdd: "Hurtiglegg til favoritter",
    barRepeatLast: "Gjenta forrige runde",
    barSendRound: "Send runde",
    barViewFullMenu: "Se hele menyen",
    barRequestSentTitle: "Forespørsel sendt!",
    barRequestSentBody: "Vi har varslet personalet. De kommer straks.",
    barBackToHome: "Tilbake til start",
    statusReceived: "Mottatt",
    statusPreparing: "Tilberedes",
    statusOnTheWay: "På vei",
    statusDelivered: "Levert",
    statusOrderTitle: "Bestillingsstatus",
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
    menuViewTitle: "Karte ansehen & bestellen",
    menuViewSub: "Essen & Getränke, direkt an Ihren Tisch",
    menuTitle: "Karte",
    menuSoldOut: "Heute ausverkauft",
    menuOptions: "Optionen",
    menuAddToOrder: "Zur Bestellung hinzufügen",
    menuViewOrder: "Bestellung ansehen",
    menuYourOrder: "Ihre Bestellung",
    menuAddNote: "Notiz für die Küche hinzufügen… (optional)",
    menuSubtotal: "Zwischensumme",
    menuService: "Service {pct}%",
    menuTotal: "Gesamt",
    menuPayAtTable: "Sie zahlen wie gewohnt am Tisch — online wird nichts abgebucht.",
    menuPlaceOrder: "Bestellung senden",
    menuOrderSentTitle: "Bestellung gesendet!",
    menuOrderSentBody: "Wir haben Ihre Bestellung für {table} erhalten. Ihr Kellner kümmert sich.",
    menuKeepOrdering: "Weiter bestellen",
    menuBackToStart: "Zurück zum Start",
    menuOrderFailed: "Bestellung konnte nicht gesendet werden. Bitte erneut versuchen.",
    menuOrderRateLimited: "Bitte warten Sie einen Moment, bevor Sie erneut bestellen.",
    menuItemUnavailable: "Entschuldigung — etwas aus Ihrer Bestellung ist gerade ausverkauft. Bitte prüfen.",
    menuBack: "Zurück",
    barOrderDrinks: "Getränke bestellen",
    barOrderDrinksSub: "Ihre Favoriten, ein Tipp entfernt",
    barAnotherRound: "Noch eine Runde",
    barAnotherRoundSub: "Letzte Bestellung wiederholen",
    barSnacks: "Snacks",
    barSnacksSub: "Kleine Happen",
    barCallStaff: "Personal rufen",
    barCallStaffSub: "Wir sind da",
    barCallStaffPrompt: "Was brauchen Sie?",
    barAskBill: "Rechnung bitte",
    barAskBillSub: "Wir kümmern uns",
    barAskBillPrompt: "Wie möchten Sie zahlen?",
    barYourOrderIs: "Ihre Bestellung ist",
    barStatusChip: "Ihre Bestellung:",
    barQuickAdd: "Favoriten schnell hinzufügen",
    barRepeatLast: "Letzte Runde wiederholen",
    barSendRound: "Runde senden",
    barViewFullMenu: "Ganze Karte ansehen",
    barRequestSentTitle: "Anfrage gesendet!",
    barRequestSentBody: "Wir haben das Personal informiert. Gleich ist jemand da.",
    barBackToHome: "Zurück zum Start",
    statusReceived: "Eingegangen",
    statusPreparing: "In Zubereitung",
    statusOnTheWay: "Unterwegs",
    statusDelivered: "Geliefert",
    statusOrderTitle: "Bestellstatus",
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
    menuViewTitle: "Bekijk menu & bestel",
    menuViewSub: "Eten en drinken, rechtstreeks aan je tafel",
    menuTitle: "Menu",
    menuSoldOut: "Vandaag uitverkocht",
    menuOptions: "Opties",
    menuAddToOrder: "Toevoegen aan bestelling",
    menuViewOrder: "Bekijk bestelling",
    menuYourOrder: "Je bestelling",
    menuAddNote: "Voeg een notitie voor de keuken toe… (optioneel)",
    menuSubtotal: "Subtotaal",
    menuService: "Service {pct}%",
    menuTotal: "Totaal",
    menuPayAtTable: "Je betaalt aan tafel, zoals altijd — online wordt niets afgeschreven.",
    menuPlaceOrder: "Bestelling versturen",
    menuOrderSentTitle: "Bestelling verzonden!",
    menuOrderSentBody: "We hebben je bestelling voor {table} ontvangen. Je ober gaat ermee aan de slag.",
    menuKeepOrdering: "Verder bestellen",
    menuBackToStart: "Terug naar start",
    menuOrderFailed: "Bestelling kon niet worden verzonden. Probeer het opnieuw.",
    menuOrderRateLimited: "Wacht even voordat je opnieuw bestelt.",
    menuItemUnavailable: "Sorry — iets uit je bestelling is net uitverkocht. Controleer je bestelling.",
    menuBack: "Terug",
    barOrderDrinks: "Drankjes bestellen",
    barOrderDrinksSub: "Je favorieten, één tik verwijderd",
    barAnotherRound: "Nog een rondje",
    barAnotherRoundSub: "Herhaal je laatste bestelling",
    barSnacks: "Snacks",
    barSnacksSub: "Kleine hapjes",
    barCallStaff: "Personeel roepen",
    barCallStaffSub: "We zijn er",
    barCallStaffPrompt: "Wat heb je nodig?",
    barAskBill: "Rekening vragen",
    barAskBillSub: "We regelen het",
    barAskBillPrompt: "Hoe wil je hem?",
    barYourOrderIs: "Je bestelling is",
    barStatusChip: "Je bestelling:",
    barQuickAdd: "Favorieten snel toevoegen",
    barRepeatLast: "Laatste rondje herhalen",
    barSendRound: "Rondje versturen",
    barViewFullMenu: "Bekijk het hele menu",
    barRequestSentTitle: "Verzoek verzonden!",
    barRequestSentBody: "We hebben het personeel op de hoogte gebracht. Ze komen zo.",
    barBackToHome: "Terug naar start",
    statusReceived: "Ontvangen",
    statusPreparing: "Wordt bereid",
    statusOnTheWay: "Onderweg",
    statusDelivered: "Bezorgd",
    statusOrderTitle: "Bestelstatus",
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
    menuViewTitle: "Voir la carte & commander",
    menuViewSub: "Plats et boissons, directement à votre table",
    menuTitle: "Carte",
    menuSoldOut: "Épuisé aujourd'hui",
    menuOptions: "Options",
    menuAddToOrder: "Ajouter à la commande",
    menuViewOrder: "Voir la commande",
    menuYourOrder: "Votre commande",
    menuAddNote: "Ajouter une note pour la cuisine… (facultatif)",
    menuSubtotal: "Sous-total",
    menuService: "Service {pct}%",
    menuTotal: "Total",
    menuPayAtTable: "Vous payez à table, comme d'habitude — rien n'est débité en ligne.",
    menuPlaceOrder: "Envoyer la commande",
    menuOrderSentTitle: "Commande envoyée !",
    menuOrderSentBody: "Nous avons bien reçu votre commande pour {table}. Votre serveur s'en occupe.",
    menuKeepOrdering: "Continuer à commander",
    menuBackToStart: "Retour à l'accueil",
    menuOrderFailed: "Impossible d'envoyer la commande. Veuillez réessayer.",
    menuOrderRateLimited: "Patientez un instant avant de commander à nouveau.",
    menuItemUnavailable: "Désolé — un article de votre commande vient d'être épuisé. Vérifiez-la.",
    menuBack: "Retour",
    barOrderDrinks: "Commander des boissons",
    barOrderDrinksSub: "Vos favoris, à un geste",
    barAnotherRound: "Une autre tournée",
    barAnotherRoundSub: "Répéter votre dernière commande",
    barSnacks: "Snacks",
    barSnacksSub: "Petites bouchées",
    barCallStaff: "Appeler le personnel",
    barCallStaffSub: "Nous sommes là",
    barCallStaffPrompt: "De quoi avez-vous besoin ?",
    barAskBill: "Demander l'addition",
    barAskBillSub: "On s'en occupe",
    barAskBillPrompt: "Comment la souhaitez-vous ?",
    barYourOrderIs: "Votre commande est",
    barStatusChip: "Votre commande :",
    barQuickAdd: "Ajoutez vos favoris",
    barRepeatLast: "Répéter la dernière tournée",
    barSendRound: "Envoyer la tournée",
    barViewFullMenu: "Voir toute la carte",
    barRequestSentTitle: "Demande envoyée !",
    barRequestSentBody: "Le personnel est prévenu. On arrive tout de suite.",
    barBackToHome: "Retour à l'accueil",
    statusReceived: "Reçue",
    statusPreparing: "En préparation",
    statusOnTheWay: "En route",
    statusDelivered: "Livrée",
    statusOrderTitle: "Statut de la commande",
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

/** Alias for client components that receive the strings as props. */
export type UiStringsShape = UiStrings;
