/**
 * Landing page strings.
 *
 * Every visible word on the marketing page lives here, keyed by
 * locale. Adding a language is adding one dictionary entry — no
 * component changes. The English entry is the source of truth for the
 * shape; TypeScript holds every translation to exactly that shape, so
 * a missing string is a compile error, not a blank spot on the page.
 */

const EN = {
  nav: {
    features: "Features",
    howItWorks: "How it works",
    pricing: "Pricing",
    resources: "Resources",
    logIn: "Log in",
  },
  hero: {
    titleLine1: "See all tables",
    titleLine2: "at a glance.",
    sub: "No guest should ever sit waving at nobody. One tap on the table tells your floor who needs what — before anyone feels forgotten.",
    posLine1: "Your POS manages orders.",
    posLine2: "MyTableView manages the guest experience.",
    ctaHow: "See how it works",
    ctaWho: "Who it's for",
    trustCard: "14-day free trial — no credit card",
    trustSetup: "Setup in minutes",
    trustCancel: "Cancel anytime",
    photoAlt:
      "Guests at a seaside terrace while a waiter takes a request on a tablet",
  },
  glance: {
    title: "Service at a glance",
    chip: "Today",
    statRequests: "Requests today",
    statResponse: "Avg. response",
    statUnder: "Under 2 min",
    statTwice: "Asked twice",
    tableStatus: "Table status",
    legendGood: "All good",
    legendWaiting: "Waiting 5–10",
    legendOverdue: "Over 10 min",
    legendFree: "Free",
    topRequests: "Top requests",
    itemNapkins: "Extra napkins",
    itemWater: "Water refill",
    itemBill: "Bill request",
    itemRound: "Another round",
  },
  floor: {
    title: "Live floor",
    now: "Now",
    twoMin: "2 min",
    twelveMin: "12 min",
    table: "Table",
    askDrinks: "Drinks",
    askBill: "Request the bill",
    askAssist: "Assistance · asked twice",
  },
  features: {
    guestsEyebrow: "For your guests",
    guestsTitle: "Effortless from the first tap",
    guestsCopy:
      "See the menu, call a waiter, ask for the bill — from their own phone, in their own language.",
    phoneAlt:
      "Guest phone screen: make a request — drinks, dessert menu, coffee, request the bill, need assistance",
    pairTitle: "Don't ignore your guests — they are your bread and butter",
    staffEyebrow: "For your staff",
    staffCopy:
      "See who needs help without constantly scanning the whole room. That efficiency makes the experience better for your guests — and a better experience translates into better tips.",
    bizEyebrow: "For your business",
    bizCopy:
      "Real insight into how your guests experience the service guides you in the right direction — and when no guest is left hanging, you never miss a sale. The moment a guest asks for the bill, two quick questions rate the food and the service — you hear about a bad experience instantly, not in tomorrow's online review.",
    chartCaption: "Response time by hour",
  },
  how: {
    title: "How it works",
    sub: "From tap to table served — no app, no account, no training.",
    step1Title: "Tag every table",
    step1Body:
      "Each table gets an NFC tag — or a printed QR code, so you can start tonight while your tags are in the post. Nothing to install, nothing for guests to download.",
    step2Title: "Guests tap, once",
    step2Body:
      "A phone tap opens the table's own page: drinks, the bill, assistance — in the guest's language. One press and it's logged and timed.",
    step3Title: "Your floor sees it instantly",
    step3Body:
      "The request appears on the live floor with its table and its clock. Colour says who's fine, who's waiting, and who has asked twice.",
    step4Title: "The numbers keep score",
    step4Body:
      "Response times, repeat asks, busiest hours — per table, per shift. Service you can prove, not guess at.",
    clockTitle: "The clock on every request",
    clockAria: "How a request escalates over time",
    mark0Time: "0:00",
    mark0Text: "Request made — table turns green on the floor",
    mark5Time: "5:00",
    mark5Text: "Still open — amber, quietly nudging",
    mark10Time: "10:00",
    mark10Text: "Overdue — red, impossible to miss",
    noteBefore: "And a guest who asks a ",
    noteEm: "second",
    noteAfter:
      " time skips the queue: the table escalates to the manager the moment patience runs out — with a grace period so a waiter already on the way isn't flagged.",
  },
  pos: {
    title: "Not another POS",
    line1: "MyTableView runs alongside whatever is on your counter today.",
    line2:
      "Nothing to replace, nothing to migrate — your POS keeps ringing up orders while we look after the people ordering them.",
  },
  demo: {
    title: "Put it on one table and see",
    body: "No demos, no sales calls. Try it free for 14 days — print a QR code for your first table and start tonight, your NFC tags arrive by post. No credit card, cancel anytime.",
    cta: "Start your free trial",
    mailSubject: "MyTableView early access",
  },
};

export type LandingStrings = typeof EN;

const ES: LandingStrings = {
  nav: {
    features: "Funciones",
    howItWorks: "Cómo funciona",
    pricing: "Precios",
    resources: "Recursos",
    logIn: "Entrar",
  },
  hero: {
    titleLine1: "Todas tus mesas",
    titleLine2: "de un vistazo.",
    sub: "Ningún cliente debería quedarse haciendo señas a nadie. Un toque en la mesa le dice a tu sala quién necesita qué — antes de que alguien se sienta olvidado.",
    posLine1: "Tu TPV gestiona los pedidos.",
    posLine2: "MyTableView gestiona la experiencia del cliente.",
    ctaHow: "Mira cómo funciona",
    ctaWho: "Para quién es",
    trustCard: "14 días gratis — sin tarjeta",
    trustSetup: "Listo en minutos",
    trustCancel: "Cancela cuando quieras",
    photoAlt:
      "Clientes en una terraza junto al mar mientras un camarero atiende una petición en su tableta",
  },
  glance: {
    title: "El servicio de un vistazo",
    chip: "Hoy",
    statRequests: "Peticiones hoy",
    statResponse: "Respuesta media",
    statUnder: "En menos de 2 min",
    statTwice: "Pidieron dos veces",
    tableStatus: "Estado de las mesas",
    legendGood: "Todo bien",
    legendWaiting: "Esperando 5–10",
    legendOverdue: "Más de 10 min",
    legendFree: "Libre",
    topRequests: "Peticiones frecuentes",
    itemNapkins: "Servilletas extra",
    itemWater: "Rellenar el agua",
    itemBill: "Pedir la cuenta",
    itemRound: "Otra ronda",
  },
  floor: {
    title: "Sala en directo",
    now: "Ahora",
    twoMin: "2 min",
    twelveMin: "12 min",
    table: "Mesa",
    askDrinks: "Bebidas",
    askBill: "Pedir la cuenta",
    askAssist: "Asistencia · pidieron dos veces",
  },
  features: {
    guestsEyebrow: "Para tus clientes",
    guestsTitle: "Sin esfuerzo desde el primer toque",
    guestsCopy:
      "Ver la carta, llamar al camarero, pedir la cuenta — desde su propio móvil, en su propio idioma.",
    phoneAlt:
      "Pantalla del cliente: hacer una petición — bebidas, carta de postres, café, pedir la cuenta, asistencia",
    pairTitle: "No ignores a tus clientes: son tu pan de cada día",
    staffEyebrow: "Para tu equipo",
    staffCopy:
      "Ve quién necesita ayuda sin tener que vigilar toda la sala. Esa eficiencia mejora la experiencia de tus clientes — y una mejor experiencia se traduce en mejores propinas.",
    bizEyebrow: "Para tu negocio",
    bizCopy:
      "Conocer de verdad la experiencia de tus clientes te guía en la dirección correcta — y si ningún cliente se queda esperando, nunca pierdes una venta. En cuanto piden la cuenta, dos preguntas rápidas puntúan la comida y el servicio — te enteras al instante, no en la reseña del día siguiente.",
    chartCaption: "Tiempo de respuesta por hora",
  },
  how: {
    title: "Cómo funciona",
    sub: "Del toque a la mesa atendida — sin app, sin cuenta, sin formación.",
    step1Title: "Etiqueta cada mesa",
    step1Body:
      "Cada mesa lleva una etiqueta NFC — o un código QR impreso, para empezar esta misma noche mientras llegan tus etiquetas. Nada que instalar ni nada que el cliente deba descargar.",
    step2Title: "El cliente toca, una vez",
    step2Body:
      "Un toque con el móvil abre la página de esa mesa: bebidas, la cuenta, asistencia — en el idioma del cliente. Una pulsación y queda registrada y cronometrada.",
    step3Title: "Tu sala lo ve al instante",
    step3Body:
      "La petición aparece en la sala en directo con su mesa y su reloj. El color dice quién está bien, quién espera y quién ya pidió dos veces.",
    step4Title: "Los números llevan la cuenta",
    step4Body:
      "Tiempos de respuesta, peticiones repetidas, horas punta — por mesa y por turno. Un servicio que puedes demostrar, no suponer.",
    clockTitle: "El reloj de cada petición",
    clockAria: "Cómo escala una petición con el tiempo",
    mark0Time: "0:00",
    mark0Text: "Petición hecha — la mesa se pone verde en la sala",
    mark5Time: "5:00",
    mark5Text: "Sigue abierta — ámbar, avisando sin molestar",
    mark10Time: "10:00",
    mark10Text: "Fuera de plazo — rojo, imposible de ignorar",
    noteBefore: "Y el cliente que pide una ",
    noteEm: "segunda",
    noteAfter:
      " vez se salta la cola: la mesa se escala al encargado en cuanto se agota la paciencia — con un margen de gracia para no señalar al camarero que ya va de camino.",
  },
  pos: {
    title: "No somos otro TPV",
    line1: "MyTableView funciona junto a lo que ya tienes en el mostrador.",
    line2:
      "Nada que sustituir, nada que migrar — tu TPV sigue cobrando los pedidos mientras nosotros cuidamos de quienes los piden.",
  },
  demo: {
    title: "Ponlo en una mesa y compruébalo",
    body: "Sin demos ni llamadas comerciales. Pruébalo gratis 14 días — imprime un código QR para tu primera mesa y empieza esta noche; las etiquetas NFC llegan por correo. Sin tarjeta, cancela cuando quieras.",
    cta: "Empieza tu prueba gratis",
    mailSubject: "Acceso anticipado a MyTableView",
  },
};

const DICTIONARIES: Record<string, LandingStrings> = {
  en: EN,
  es: ES,
};

export const LANDING_LOCALES = Object.keys(DICTIONARIES);
export const DEFAULT_LANDING_LOCALE = "en";

export function getLandingStrings(locale: string): LandingStrings {
  return DICTIONARIES[locale] ?? EN;
}

/**
 * Locale resolution: an explicit ?lang= wins (and is how a future
 * language switcher will work), otherwise the browser's own
 * Accept-Language, otherwise English.
 */
export function resolveLandingLocale(
  langParam: string | undefined,
  acceptLanguage: string | null
): string {
  if (langParam && DICTIONARIES[langParam.toLowerCase()]) {
    return langParam.toLowerCase();
  }

  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (code && DICTIONARIES[code]) {
      return code;
    }
  }

  return DEFAULT_LANDING_LOCALE;
}
