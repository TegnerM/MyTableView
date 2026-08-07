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
    ctaDemo: "Try the live demo",
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
  pricing: {
    title: "Simple pricing",
    sub: "Every plan includes everything — live floor, insights, unlimited staff. Pick the size that fits, switch or cancel anytime.",
    tier1: "1 restaurant",
    tierN: "Up to {n} restaurants",
    perMonth: "/ month",
    yearlyLine: "or {price} / year — 2 months free",
    cta: "Start your free trial",
    foot: "14-day free trial on every plan — no credit card, cancel anytime.",
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
    ctaDemo: "Prueba la demo en vivo",
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
  pricing: {
    title: "Precios sencillos",
    sub: "Todos los planes lo incluyen todo — sala en vivo, estadísticas y personal ilimitado. Elige el tamaño que encaje, cambia o cancela cuando quieras.",
    tier1: "1 restaurante",
    tierN: "Hasta {n} restaurantes",
    perMonth: "/ mes",
    yearlyLine: "o {price} / año — 2 meses gratis",
    cta: "Empieza tu prueba gratis",
    foot: "14 días de prueba gratis en todos los planes — sin tarjeta, cancela cuando quieras.",
  },
  demo: {
    title: "Ponlo en una mesa y compruébalo",
    body: "Sin demos ni llamadas comerciales. Pruébalo gratis 14 días — imprime un código QR para tu primera mesa y empieza esta noche; las etiquetas NFC llegan por correo. Sin tarjeta, cancela cuando quieras.",
    cta: "Empieza tu prueba gratis",
    mailSubject: "Acceso anticipado a MyTableView",
  },
};


const DA: LandingStrings = {
  nav: { features: "Funktioner", howItWorks: "Sådan virker det", pricing: "Priser", logIn: "Log ind" },
  hero: {
    titleLine1: "Se alle borde",
    titleLine2: "med ét blik.",
    sub: "Ingen gæst skal sidde og vinke ud i luften. Ét tryk på bordet fortæller dit personale, hvem der har brug for hvad — før nogen føler sig glemt.",
    posLine1: "Dit kassesystem styrer ordrerne.",
    posLine2: "MyTableView styrer gæsteoplevelsen.",
    ctaHow: "Se hvordan det virker",
    ctaWho: "Hvem er det til",
    ctaDemo: "Prøv live-demoen",
    trustCard: "14 dages gratis prøve — uden kreditkort",
    trustSetup: "Klar på få minutter",
    trustCancel: "Opsig når som helst",
    photoAlt: "Gæster på en strandterrasse, mens en tjener modtager en forespørgsel på en tablet",
  },
  glance: {
    title: "Service med ét blik", chip: "I dag", statRequests: "Forespørgsler i dag", statResponse: "Gns. svartid",
    statUnder: "Under 2 min", statTwice: "Spurgte to gange", tableStatus: "Bordstatus", legendGood: "Alt vel",
    legendWaiting: "Venter 5–10", legendOverdue: "Over 10 min", legendFree: "Ledigt", topRequests: "Mest efterspurgt",
    itemNapkins: "Ekstra servietter", itemWater: "Mere vand", itemBill: "Regningen", itemRound: "En omgang til",
  },
  floor: {
    title: "Live-oversigt", now: "Nu", twoMin: "2 min", twelveMin: "12 min", table: "Bord",
    askDrinks: "Drikkevarer", askBill: "Bad om regningen", askAssist: "Hjælp · spurgte to gange",
  },
  features: {
    guestsEyebrow: "Til dine gæster",
    guestsTitle: "Nemt fra første tryk",
    guestsCopy: "Se menuen, tilkald en tjener, bed om regningen — fra deres egen telefon, på deres eget sprog.",
    phoneAlt: "Gæstens telefonskærm: send en forespørgsel — drikkevarer, dessertkort, kaffe, bed om regningen, brug for hjælp",
    pairTitle: "Ignorér ikke dine gæster — de er dit levebrød",
    staffEyebrow: "Til dit personale",
    staffCopy: "Se hvem der har brug for hjælp uden konstant at skanne hele lokalet. Den effektivitet gør oplevelsen bedre for dine gæster — og en bedre oplevelse bliver til bedre drikkepenge.",
    bizEyebrow: "Til din forretning",
    bizCopy: "Reel indsigt i hvordan dine gæster oplever servicen viser dig vejen — og når ingen gæst bliver ladt i stikken, går du aldrig glip af et salg. I det øjeblik en gæst beder om regningen, bedømmer to hurtige spørgsmål maden og servicen — du hører om en dårlig oplevelse med det samme, ikke i morgendagens anmeldelse.",
    chartCaption: "Svartid time for time",
  },
  how: {
    title: "Sådan virker det",
    sub: "Fra tryk til betjent bord — ingen app, ingen konto, ingen oplæring.",
    step1Title: "Sæt en brik på hvert bord",
    step1Body: "Hvert bord får en NFC-brik — eller en printet QR-kode, så du kan starte i aften, mens dine brikker er undervejs med posten. Intet at installere, intet gæsterne skal hente.",
    step2Title: "Gæsten trykker, én gang",
    step2Body: "Et tryk med telefonen åbner bordets egen side: drikkevarer, regningen, hjælp — på gæstens sprog. Ét tryk, og det er registreret og tidsstemplet.",
    step3Title: "Dit personale ser det med det samme",
    step3Body: "Forespørgslen dukker op på live-oversigten med bord og ur. Farven viser hvem der har det fint, hvem der venter, og hvem der har spurgt to gange.",
    step4Title: "Tallene holder regnskab",
    step4Body: "Svartider, gentagne forespørgsler, travleste timer — pr. bord, pr. vagt. Service du kan bevise, ikke gætte på.",
    clockTitle: "Uret på hver forespørgsel",
    clockAria: "Hvordan en forespørgsel eskalerer over tid",
    mark0Time: "0:00", mark0Text: "Forespørgsel sendt — bordet bliver grønt på oversigten",
    mark5Time: "5:00", mark5Text: "Stadig åben — gul, et stille vink",
    mark10Time: "10:00", mark10Text: "Forsinket — rød, umulig at overse",
    noteBefore: "Og en gæst der spørger ", noteEm: "anden",
    noteAfter: " gang springer køen over: bordet eskaleres til manageren i det øjeblik tålmodigheden slipper op — med en kulancetid, så en tjener der allerede er på vej, ikke bliver markeret.",
  },
  pos: {
    title: "Ikke endnu et kassesystem",
    line1: "MyTableView kører ved siden af det, du har på disken i dag.",
    line2: "Intet at udskifte, intet at flytte — dit kassesystem slår stadig ordrer ind, mens vi tager os af dem, der bestiller.",
  },
  pricing: {
    title: "Enkle priser",
    sub: "Alle planer indeholder alt — live bordplan, indsigt og ubegrænset personale. Vælg størrelsen der passer, skift eller opsig når som helst.",
    tier1: "1 restaurant",
    tierN: "Op til {n} restauranter",
    perMonth: "/ måned",
    yearlyLine: "eller {price} / år — 2 måneder gratis",
    cta: "Start din gratis prøveperiode",
    foot: "14 dages gratis prøve på alle planer — uden kreditkort, opsig når som helst.",
  },
  demo: {
    title: "Sæt det på ét bord og se selv",
    body: "Ingen demoer, ingen salgsopkald. Prøv gratis i 14 dage — print en QR-kode til dit første bord og start i aften; dine NFC-brikker kommer med posten. Uden kreditkort, opsig når som helst.",
    cta: "Start din gratis prøveperiode",
    mailSubject: "MyTableView tidlig adgang",
  },
};

const SV: LandingStrings = {
  nav: { features: "Funktioner", howItWorks: "Så funkar det", pricing: "Priser", logIn: "Logga in" },
  hero: {
    titleLine1: "Se alla bord",
    titleLine2: "med en blick.",
    sub: "Ingen gäst ska sitta och vinka ut i tomma intet. Ett tryck på bordet berättar för din personal vem som behöver vad — innan någon känner sig bortglömd.",
    posLine1: "Ditt kassasystem sköter beställningarna.",
    posLine2: "MyTableView sköter gästupplevelsen.",
    ctaHow: "Se hur det funkar",
    ctaWho: "Vem är det för",
    ctaDemo: "Testa live-demon",
    trustCard: "14 dagar gratis — inget kreditkort",
    trustSetup: "Klart på några minuter",
    trustCancel: "Avsluta när du vill",
    photoAlt: "Gäster på en strandterrass medan en servitör tar emot en förfrågan på en surfplatta",
  },
  glance: {
    title: "Servicen med en blick", chip: "Idag", statRequests: "Förfrågningar idag", statResponse: "Snitt-svarstid",
    statUnder: "Under 2 min", statTwice: "Frågade två gånger", tableStatus: "Bordsstatus", legendGood: "Allt väl",
    legendWaiting: "Väntar 5–10", legendOverdue: "Över 10 min", legendFree: "Ledigt", topRequests: "Vanligaste önskemålen",
    itemNapkins: "Extra servetter", itemWater: "Vattenpåfyllning", itemBill: "Notan", itemRound: "En runda till",
  },
  floor: {
    title: "Live-överblick", now: "Nu", twoMin: "2 min", twelveMin: "12 min", table: "Bord",
    askDrinks: "Drycker", askBill: "Bad om notan", askAssist: "Hjälp · frågade två gånger",
  },
  features: {
    guestsEyebrow: "För dina gäster",
    guestsTitle: "Enkelt från första trycket",
    guestsCopy: "Se menyn, kalla på en servitör, be om notan — från den egna telefonen, på det egna språket.",
    phoneAlt: "Gästens telefonskärm: skicka en förfrågan — drycker, dessertmeny, kaffe, be om notan, behöver hjälp",
    pairTitle: "Ignorera inte dina gäster — de är ditt levebröd",
    staffEyebrow: "För din personal",
    staffCopy: "Se vem som behöver hjälp utan att ständigt skanna hela lokalen. Den effektiviteten gör upplevelsen bättre för dina gäster — och en bättre upplevelse blir bättre dricks.",
    bizEyebrow: "För din verksamhet",
    bizCopy: "Verklig insikt i hur gästerna upplever servicen visar dig rätt väg — och när ingen gäst lämnas hängande missar du aldrig en försäljning. I samma stund som en gäst ber om notan betygsätter två snabba frågor maten och servicen — du hör om en dålig upplevelse direkt, inte i morgondagens recension.",
    chartCaption: "Svarstid per timme",
  },
  how: {
    title: "Så funkar det",
    sub: "Från tryck till betjänat bord — ingen app, inget konto, ingen utbildning.",
    step1Title: "Sätt en bricka på varje bord",
    step1Body: "Varje bord får en NFC-bricka — eller en utskriven QR-kod, så att du kan börja ikväll medan brickorna är på väg med posten. Inget att installera, inget för gästerna att ladda ner.",
    step2Title: "Gästen trycker, en gång",
    step2Body: "Ett tryck med telefonen öppnar bordets egen sida: drycker, notan, hjälp — på gästens språk. Ett tryck, och det är loggat och tidsstämplat.",
    step3Title: "Din personal ser det direkt",
    step3Body: "Förfrågan dyker upp på live-överblicken med sitt bord och sin klocka. Färgen visar vem som har det bra, vem som väntar och vem som frågat två gånger.",
    step4Title: "Siffrorna håller räkningen",
    step4Body: "Svarstider, upprepade önskemål, mest hektiska timmarna — per bord, per pass. Service du kan bevisa, inte gissa.",
    clockTitle: "Klockan på varje förfrågan",
    clockAria: "Hur en förfrågan eskalerar över tid",
    mark0Time: "0:00", mark0Text: "Förfrågan skickad — bordet blir grönt på överblicken",
    mark5Time: "5:00", mark5Text: "Fortfarande öppen — gul, en stilla påminnelse",
    mark10Time: "10:00", mark10Text: "Försenad — röd, omöjlig att missa",
    noteBefore: "Och en gäst som frågar en ", noteEm: "andra",
    noteAfter: " gång går före i kön: bordet eskaleras till chefen i samma stund som tålamodet tar slut — med en respit så att en servitör som redan är på väg inte flaggas.",
  },
  pos: {
    title: "Inte ännu ett kassasystem",
    line1: "MyTableView kör vid sidan av det du har på disken idag.",
    line2: "Inget att byta ut, inget att flytta — ditt kassasystem fortsätter slå in beställningar medan vi tar hand om dem som beställer.",
  },
  pricing: {
    title: "Enkla priser",
    sub: "Alla planer innehåller allt — live bordskarta, insikter och obegränsad personal. Välj storleken som passar, byt eller avsluta när som helst.",
    tier1: "1 restaurang",
    tierN: "Upp till {n} restauranger",
    perMonth: "/ månad",
    yearlyLine: "eller {price} / år — 2 månader gratis",
    cta: "Starta din gratisperiod",
    foot: "14 dagar gratis på alla planer — inget kreditkort, avsluta när som helst.",
  },
  demo: {
    title: "Sätt det på ett bord och se själv",
    body: "Inga demos, inga säljsamtal. Prova gratis i 14 dagar — skriv ut en QR-kod till ditt första bord och börja ikväll; dina NFC-brickor kommer med posten. Inget kreditkort, avsluta när du vill.",
    cta: "Starta din gratisperiod",
    mailSubject: "MyTableView tidig åtkomst",
  },
};

const NO: LandingStrings = {
  nav: { features: "Funksjoner", howItWorks: "Slik virker det", pricing: "Priser", logIn: "Logg inn" },
  hero: {
    titleLine1: "Se alle bord",
    titleLine2: "med ett blikk.",
    sub: "Ingen gjest skal sitte og vinke ut i lufta. Ett trykk på bordet forteller personalet ditt hvem som trenger hva — før noen føler seg glemt.",
    posLine1: "Kassesystemet ditt styrer bestillingene.",
    posLine2: "MyTableView styrer gjesteopplevelsen.",
    ctaHow: "Se hvordan det virker",
    ctaWho: "Hvem er det for",
    ctaDemo: "Prøv live-demoen",
    trustCard: "14 dager gratis — uten kredittkort",
    trustSetup: "Klart på få minutter",
    trustCancel: "Avslutt når som helst",
    photoAlt: "Gjester på en strandterrasse mens en servitør mottar en forespørsel på et nettbrett",
  },
  glance: {
    title: "Servicen med ett blikk", chip: "I dag", statRequests: "Forespørsler i dag", statResponse: "Snitt svartid",
    statUnder: "Under 2 min", statTwice: "Spurte to ganger", tableStatus: "Bordstatus", legendGood: "Alt vel",
    legendWaiting: "Venter 5–10", legendOverdue: "Over 10 min", legendFree: "Ledig", topRequests: "Mest etterspurt",
    itemNapkins: "Ekstra servietter", itemWater: "Mer vann", itemBill: "Regningen", itemRound: "En runde til",
  },
  floor: {
    title: "Live-oversikt", now: "Nå", twoMin: "2 min", twelveMin: "12 min", table: "Bord",
    askDrinks: "Drikke", askBill: "Ba om regningen", askAssist: "Hjelp · spurte to ganger",
  },
  features: {
    guestsEyebrow: "For gjestene dine",
    guestsTitle: "Enkelt fra første trykk",
    guestsCopy: "Se menyen, tilkall en servitør, be om regningen — fra egen telefon, på eget språk.",
    phoneAlt: "Gjestens telefonskjerm: send en forespørsel — drikke, dessertmeny, kaffe, be om regningen, trenger hjelp",
    pairTitle: "Ikke ignorer gjestene dine — de er levebrødet ditt",
    staffEyebrow: "For personalet ditt",
    staffCopy: "Se hvem som trenger hjelp uten å stadig skanne hele lokalet. Den effektiviteten gjør opplevelsen bedre for gjestene dine — og en bedre opplevelse blir til bedre tips.",
    bizEyebrow: "For virksomheten din",
    bizCopy: "Reell innsikt i hvordan gjestene opplever servicen viser deg veien — og når ingen gjest blir hengende, går du aldri glipp av et salg. I det øyeblikket en gjest ber om regningen, vurderer to raske spørsmål maten og servicen — du hører om en dårlig opplevelse med en gang, ikke i morgendagens anmeldelse.",
    chartCaption: "Svartid time for time",
  },
  how: {
    title: "Slik virker det",
    sub: "Fra trykk til betjent bord — ingen app, ingen konto, ingen opplæring.",
    step1Title: "Sett en brikke på hvert bord",
    step1Body: "Hvert bord får en NFC-brikke — eller en utskrevet QR-kode, så du kan starte i kveld mens brikkene dine er i posten. Ingenting å installere, ingenting gjestene må laste ned.",
    step2Title: "Gjesten trykker, én gang",
    step2Body: "Ett trykk med telefonen åpner bordets egen side: drikke, regningen, hjelp — på gjestens språk. Ett trykk, og det er registrert og tidsstemplet.",
    step3Title: "Personalet ditt ser det umiddelbart",
    step3Body: "Forespørselen dukker opp på live-oversikten med bord og klokke. Fargen viser hvem som har det bra, hvem som venter, og hvem som har spurt to ganger.",
    step4Title: "Tallene holder regnskap",
    step4Body: "Svartider, gjentatte forespørsler, travleste timer — per bord, per vakt. Service du kan bevise, ikke gjette på.",
    clockTitle: "Klokka på hver forespørsel",
    clockAria: "Hvordan en forespørsel eskalerer over tid",
    mark0Time: "0:00", mark0Text: "Forespørsel sendt — bordet blir grønt på oversikten",
    mark5Time: "5:00", mark5Text: "Fortsatt åpen — gul, et stille hint",
    mark10Time: "10:00", mark10Text: "Forsinket — rød, umulig å overse",
    noteBefore: "Og en gjest som spør en ", noteEm: "andre",
    noteAfter: " gang hopper over køen: bordet eskaleres til lederen i det øyeblikket tålmodigheten tar slutt — med en slingringsmonn, så en servitør som allerede er på vei ikke blir flagget.",
  },
  pos: {
    title: "Ikke enda et kassesystem",
    line1: "MyTableView kjører ved siden av det du har på disken i dag.",
    line2: "Ingenting å bytte ut, ingenting å flytte — kassesystemet ditt slår fortsatt inn bestillinger mens vi tar oss av dem som bestiller.",
  },
  pricing: {
    title: "Enkle priser",
    sub: "Alle planer inneholder alt — live bordkart, innsikt og ubegrenset personale. Velg størrelsen som passer, bytt eller avslutt når som helst.",
    tier1: "1 restaurant",
    tierN: "Opptil {n} restauranter",
    perMonth: "/ måned",
    yearlyLine: "eller {price} / år — 2 måneder gratis",
    cta: "Start din gratisperiode",
    foot: "14 dager gratis på alle planer — uten kredittkort, avslutt når som helst.",
  },
  demo: {
    title: "Sett det på ett bord og se selv",
    body: "Ingen demoer, ingen salgssamtaler. Prøv gratis i 14 dager — skriv ut en QR-kode til ditt første bord og start i kveld; NFC-brikkene kommer i posten. Uten kredittkort, avslutt når som helst.",
    cta: "Start din gratisperiode",
    mailSubject: "MyTableView tidlig tilgang",
  },
};

const DE: LandingStrings = {
  nav: { features: "Funktionen", howItWorks: "So funktioniert es", pricing: "Preise", logIn: "Anmelden" },
  hero: {
    titleLine1: "Alle Tische",
    titleLine2: "auf einen Blick.",
    sub: "Kein Gast sollte je ins Leere winken. Ein Tipp auf den Tisch sagt Ihrem Team, wer was braucht — bevor sich jemand vergessen fühlt.",
    posLine1: "Ihr Kassensystem verwaltet die Bestellungen.",
    posLine2: "MyTableView verwaltet das Gästeerlebnis.",
    ctaHow: "So funktioniert es",
    ctaWho: "Für wen es ist",
    ctaDemo: "Live-Demo ausprobieren",
    trustCard: "14 Tage kostenlos testen — ohne Kreditkarte",
    trustSetup: "In Minuten eingerichtet",
    trustCancel: "Jederzeit kündbar",
    photoAlt: "Gäste auf einer Strandterrasse, während ein Kellner eine Anfrage auf einem Tablet entgegennimmt",
  },
  glance: {
    title: "Der Service auf einen Blick", chip: "Heute", statRequests: "Anfragen heute", statResponse: "Ø Reaktionszeit",
    statUnder: "Unter 2 Min", statTwice: "Zweimal gefragt", tableStatus: "Tischstatus", legendGood: "Alles gut",
    legendWaiting: "Wartet 5–10", legendOverdue: "Über 10 Min", legendFree: "Frei", topRequests: "Häufigste Wünsche",
    itemNapkins: "Extra Servietten", itemWater: "Wasser nachfüllen", itemBill: "Die Rechnung", itemRound: "Noch eine Runde",
  },
  floor: {
    title: "Live-Übersicht", now: "Jetzt", twoMin: "2 Min", twelveMin: "12 Min", table: "Tisch",
    askDrinks: "Getränke", askBill: "Rechnung erbeten", askAssist: "Hilfe · zweimal gefragt",
  },
  features: {
    guestsEyebrow: "Für Ihre Gäste",
    guestsTitle: "Mühelos vom ersten Tipp an",
    guestsCopy: "Speisekarte ansehen, Kellner rufen, Rechnung verlangen — vom eigenen Handy, in der eigenen Sprache.",
    phoneAlt: "Gäste-Handybildschirm: Wunsch senden — Getränke, Dessertkarte, Kaffee, Rechnung, Hilfe",
    pairTitle: "Ignorieren Sie Ihre Gäste nicht — sie sind Ihr Brot und Butter",
    staffEyebrow: "Für Ihr Team",
    staffCopy: "Sehen, wer Hilfe braucht, ohne ständig den ganzen Raum abzusuchen. Diese Effizienz macht das Erlebnis für Ihre Gäste besser — und ein besseres Erlebnis heißt besseres Trinkgeld.",
    bizEyebrow: "Für Ihr Geschäft",
    bizCopy: "Echte Einblicke, wie Ihre Gäste den Service erleben, weisen Ihnen den Weg — und wenn kein Gast hängen gelassen wird, entgeht Ihnen kein Umsatz. In dem Moment, in dem ein Gast die Rechnung verlangt, bewerten zwei kurze Fragen Essen und Service — von einer schlechten Erfahrung erfahren Sie sofort, nicht in der Online-Bewertung von morgen.",
    chartCaption: "Reaktionszeit nach Stunde",
  },
  how: {
    title: "So funktioniert es",
    sub: "Vom Tipp zum bedienten Tisch — keine App, kein Konto, keine Schulung.",
    step1Title: "Jeder Tisch bekommt einen Tag",
    step1Body: "Jeder Tisch erhält einen NFC-Tag — oder einen gedruckten QR-Code, damit Sie heute Abend starten können, während Ihre Tags noch mit der Post unterwegs sind. Nichts zu installieren, nichts herunterzuladen.",
    step2Title: "Gäste tippen, einmal",
    step2Body: "Ein Tipp mit dem Handy öffnet die Seite des Tisches: Getränke, Rechnung, Hilfe — in der Sprache des Gastes. Ein Druck, und alles ist erfasst und mit Zeitstempel versehen.",
    step3Title: "Ihr Team sieht es sofort",
    step3Body: "Die Anfrage erscheint auf der Live-Übersicht mit Tisch und Uhr. Die Farbe zeigt, wem es gut geht, wer wartet und wer zweimal gefragt hat.",
    step4Title: "Die Zahlen führen Buch",
    step4Body: "Reaktionszeiten, wiederholte Anfragen, Stoßzeiten — pro Tisch, pro Schicht. Service, den Sie belegen können, statt zu raten.",
    clockTitle: "Die Uhr auf jeder Anfrage",
    clockAria: "Wie eine Anfrage mit der Zeit eskaliert",
    mark0Time: "0:00", mark0Text: "Anfrage gestellt — der Tisch wird auf der Übersicht grün",
    mark5Time: "5:00", mark5Text: "Noch offen — gelb, ein leiser Hinweis",
    mark10Time: "10:00", mark10Text: "Überfällig — rot, unmöglich zu übersehen",
    noteBefore: "Und ein Gast, der ein ", noteEm: "zweites",
    noteAfter: " Mal fragt, überspringt die Warteschlange: Der Tisch eskaliert zum Manager, sobald die Geduld endet — mit einer Karenzzeit, damit ein Kellner, der schon unterwegs ist, nicht markiert wird.",
  },
  pos: {
    title: "Kein weiteres Kassensystem",
    line1: "MyTableView läuft neben dem, was heute auf Ihrer Theke steht.",
    line2: "Nichts zu ersetzen, nichts zu migrieren — Ihr Kassensystem bucht weiter Bestellungen, während wir uns um die kümmern, die bestellen.",
  },
  pricing: {
    title: "Einfache Preise",
    sub: "Jeder Plan enthält alles — Live-Tischplan, Auswertung und unbegrenztes Personal. Wählen Sie die passende Größe, wechseln oder kündigen Sie jederzeit.",
    tier1: "1 Restaurant",
    tierN: "Bis zu {n} Restaurants",
    perMonth: "/ Monat",
    yearlyLine: "oder {price} / Jahr — 2 Monate gratis",
    cta: "Kostenlos testen",
    foot: "14 Tage kostenlos testen bei jedem Plan — ohne Kreditkarte, jederzeit kündbar.",
  },
  demo: {
    title: "An einem Tisch ausprobieren und selbst sehen",
    body: "Keine Demos, keine Verkaufsanrufe. 14 Tage kostenlos testen — QR-Code für den ersten Tisch drucken und heute Abend starten; Ihre NFC-Tags kommen mit der Post. Ohne Kreditkarte, jederzeit kündbar.",
    cta: "Kostenlos testen",
    mailSubject: "MyTableView Frühzugang",
  },
};

const NL: LandingStrings = {
  nav: { features: "Functies", howItWorks: "Hoe het werkt", pricing: "Prijzen", logIn: "Inloggen" },
  hero: {
    titleLine1: "Zie alle tafels",
    titleLine2: "in één oogopslag.",
    sub: "Geen gast zou ooit naar niemand moeten zwaaien. Eén tik op de tafel vertelt je team wie wat nodig heeft — voordat iemand zich vergeten voelt.",
    posLine1: "Je kassasysteem beheert de bestellingen.",
    posLine2: "MyTableView beheert de gastbeleving.",
    ctaHow: "Zie hoe het werkt",
    ctaWho: "Voor wie het is",
    ctaDemo: "Probeer de live demo",
    trustCard: "14 dagen gratis — geen creditcard",
    trustSetup: "In minuten opgezet",
    trustCancel: "Altijd opzegbaar",
    photoAlt: "Gasten op een strandterras terwijl een ober een verzoek aanneemt op een tablet",
  },
  glance: {
    title: "De service in één oogopslag", chip: "Vandaag", statRequests: "Verzoeken vandaag", statResponse: "Gem. reactietijd",
    statUnder: "Onder 2 min", statTwice: "Twee keer gevraagd", tableStatus: "Tafelstatus", legendGood: "Alles goed",
    legendWaiting: "Wacht 5–10", legendOverdue: "Meer dan 10 min", legendFree: "Vrij", topRequests: "Meest gevraagd",
    itemNapkins: "Extra servetten", itemWater: "Water bijvullen", itemBill: "De rekening", itemRound: "Nog een rondje",
  },
  floor: {
    title: "Live overzicht", now: "Nu", twoMin: "2 min", twelveMin: "12 min", table: "Tafel",
    askDrinks: "Drankjes", askBill: "Vroeg om de rekening", askAssist: "Hulp · twee keer gevraagd",
  },
  features: {
    guestsEyebrow: "Voor je gasten",
    guestsTitle: "Moeiteloos vanaf de eerste tik",
    guestsCopy: "De kaart bekijken, een ober roepen, om de rekening vragen — vanaf hun eigen telefoon, in hun eigen taal.",
    phoneAlt: "Telefoonscherm van de gast: verzoek versturen — drankjes, dessertkaart, koffie, de rekening, hulp nodig",
    pairTitle: "Negeer je gasten niet — zij zijn je brood en boter",
    staffEyebrow: "Voor je team",
    staffCopy: "Zie wie hulp nodig heeft zonder constant de hele zaak af te speuren. Die efficiëntie maakt de beleving beter voor je gasten — en een betere beleving vertaalt zich in betere fooien.",
    bizEyebrow: "Voor je zaak",
    bizCopy: "Echt inzicht in hoe je gasten de service ervaren wijst je de weg — en als geen gast blijft hangen, mis je nooit een verkoop. Zodra een gast om de rekening vraagt, beoordelen twee snelle vragen het eten en de bediening — je hoort meteen van een slechte ervaring, niet in de review van morgen.",
    chartCaption: "Reactietijd per uur",
  },
  how: {
    title: "Hoe het werkt",
    sub: "Van tik tot bediende tafel — geen app, geen account, geen training.",
    step1Title: "Geef elke tafel een tag",
    step1Body: "Elke tafel krijgt een NFC-tag — of een geprinte QR-code, zodat je vanavond kunt beginnen terwijl je tags onderweg zijn met de post. Niets te installeren, niets voor gasten te downloaden.",
    step2Title: "Gasten tikken, één keer",
    step2Body: "Een tik met de telefoon opent de eigen pagina van de tafel: drankjes, de rekening, hulp — in de taal van de gast. Eén druk en het is geregistreerd en getimed.",
    step3Title: "Je team ziet het direct",
    step3Body: "Het verzoek verschijnt op het live overzicht met tafel en klok. De kleur zegt wie het goed heeft, wie wacht en wie twee keer heeft gevraagd.",
    step4Title: "De cijfers houden de score bij",
    step4Body: "Reactietijden, herhaalde verzoeken, drukste uren — per tafel, per dienst. Service die je kunt bewijzen, niet hoeft te gokken.",
    clockTitle: "De klok op elk verzoek",
    clockAria: "Hoe een verzoek in de loop van de tijd escaleert",
    mark0Time: "0:00", mark0Text: "Verzoek gedaan — de tafel kleurt groen op het overzicht",
    mark5Time: "5:00", mark5Text: "Nog open — oranje, een stille hint",
    mark10Time: "10:00", mark10Text: "Te laat — rood, onmogelijk te missen",
    noteBefore: "En een gast die een ", noteEm: "tweede",
    noteAfter: " keer vraagt slaat de rij over: de tafel escaleert naar de manager zodra het geduld op is — met een respijtperiode zodat een ober die al onderweg is niet wordt gemarkeerd.",
  },
  pos: {
    title: "Niet wéér een kassasysteem",
    line1: "MyTableView draait naast wat er vandaag op je toonbank staat.",
    line2: "Niets te vervangen, niets te migreren — je kassasysteem blijft bestellingen aanslaan terwijl wij zorgen voor de mensen die bestellen.",
  },
  pricing: {
    title: "Eenvoudige prijzen",
    sub: "Elk abonnement bevat alles — live plattegrond, inzichten en onbeperkt personeel. Kies de maat die past, wissel of zeg op wanneer je wilt.",
    tier1: "1 restaurant",
    tierN: "Tot {n} restaurants",
    perMonth: "/ maand",
    yearlyLine: "of {price} / jaar — 2 maanden gratis",
    cta: "Start je gratis proefperiode",
    foot: "14 dagen gratis bij elk abonnement — geen creditcard, opzeggen wanneer je wilt.",
  },
  demo: {
    title: "Zet het op één tafel en zie het zelf",
    body: "Geen demo's, geen verkoopgesprekken. Probeer het 14 dagen gratis — print een QR-code voor je eerste tafel en begin vanavond; je NFC-tags komen met de post. Geen creditcard, altijd opzegbaar.",
    cta: "Start je gratis proefperiode",
    mailSubject: "MyTableView vroege toegang",
  },
};

const FR: LandingStrings = {
  nav: { features: "Fonctionnalités", howItWorks: "Comment ça marche", pricing: "Tarifs", logIn: "Se connecter" },
  hero: {
    titleLine1: "Toutes vos tables",
    titleLine2: "d'un seul coup d'œil.",
    sub: "Aucun client ne devrait faire signe dans le vide. Un simple contact sur la table indique à votre équipe qui a besoin de quoi — avant que quiconque ne se sente oublié.",
    posLine1: "Votre caisse gère les commandes.",
    posLine2: "MyTableView gère l'expérience client.",
    ctaHow: "Voir comment ça marche",
    ctaWho: "Pour qui c'est fait",
    ctaDemo: "Essayer la démo live",
    trustCard: "14 jours d'essai gratuit — sans carte bancaire",
    trustSetup: "Installé en quelques minutes",
    trustCancel: "Résiliable à tout moment",
    photoAlt: "Des clients sur une terrasse en bord de mer pendant qu'un serveur reçoit une demande sur une tablette",
  },
  glance: {
    title: "Le service d'un coup d'œil", chip: "Aujourd'hui", statRequests: "Demandes aujourd'hui", statResponse: "Réponse moy.",
    statUnder: "Moins de 2 min", statTwice: "Demandé deux fois", tableStatus: "État des tables", legendGood: "Tout va bien",
    legendWaiting: "Attend 5–10", legendOverdue: "Plus de 10 min", legendFree: "Libre", topRequests: "Demandes fréquentes",
    itemNapkins: "Serviettes en plus", itemWater: "De l'eau", itemBill: "L'addition", itemRound: "Une autre tournée",
  },
  floor: {
    title: "Salle en direct", now: "Maintenant", twoMin: "2 min", twelveMin: "12 min", table: "Table",
    askDrinks: "Boissons", askBill: "A demandé l'addition", askAssist: "Assistance · demandé deux fois",
  },
  features: {
    guestsEyebrow: "Pour vos clients",
    guestsTitle: "Simple dès le premier contact",
    guestsCopy: "Consulter la carte, appeler un serveur, demander l'addition — depuis leur propre téléphone, dans leur propre langue.",
    phoneAlt: "Écran du téléphone du client : envoyer une demande — boissons, carte des desserts, café, l'addition, besoin d'aide",
    pairTitle: "N'ignorez pas vos clients — ils sont votre gagne-pain",
    staffEyebrow: "Pour votre équipe",
    staffCopy: "Voir qui a besoin d'aide sans balayer la salle en permanence. Cette efficacité améliore l'expérience de vos clients — et une meilleure expérience se traduit par de meilleurs pourboires.",
    bizEyebrow: "Pour votre établissement",
    bizCopy: "Une vraie connaissance de la façon dont vos clients vivent le service vous guide dans la bonne direction — et quand aucun client n'est laissé en attente, vous ne manquez jamais une vente. Dès qu'un client demande l'addition, deux questions rapides notent la cuisine et le service — vous apprenez une mauvaise expérience immédiatement, pas dans l'avis en ligne de demain.",
    chartCaption: "Temps de réponse par heure",
  },
  how: {
    title: "Comment ça marche",
    sub: "Du contact à la table servie — pas d'appli, pas de compte, pas de formation.",
    step1Title: "Équipez chaque table",
    step1Body: "Chaque table reçoit un badge NFC — ou un QR code imprimé, pour commencer ce soir pendant que vos badges arrivent par la poste. Rien à installer, rien à télécharger pour les clients.",
    step2Title: "Le client touche, une fois",
    step2Body: "Un contact du téléphone ouvre la page de la table : boissons, addition, assistance — dans la langue du client. Une pression, et c'est enregistré et chronométré.",
    step3Title: "Votre équipe le voit instantanément",
    step3Body: "La demande apparaît sur la salle en direct avec sa table et son chrono. La couleur dit qui va bien, qui attend, et qui a demandé deux fois.",
    step4Title: "Les chiffres tiennent le score",
    step4Body: "Temps de réponse, demandes répétées, heures de pointe — par table, par service. Un service que vous pouvez prouver, pas deviner.",
    clockTitle: "Le chrono sur chaque demande",
    clockAria: "Comment une demande s'aggrave avec le temps",
    mark0Time: "0:00", mark0Text: "Demande envoyée — la table passe au vert sur la salle",
    mark5Time: "5:00", mark5Text: "Toujours ouverte — orange, un rappel discret",
    mark10Time: "10:00", mark10Text: "En retard — rouge, impossible à manquer",
    noteBefore: "Et un client qui demande une ", noteEm: "deuxième",
    noteAfter: " fois passe devant : la table remonte au manager dès que la patience s'épuise — avec un délai de grâce pour qu'un serveur déjà en route ne soit pas signalé.",
  },
  pos: {
    title: "Pas une caisse de plus",
    line1: "MyTableView fonctionne à côté de ce qui est sur votre comptoir aujourd'hui.",
    line2: "Rien à remplacer, rien à migrer — votre caisse continue d'encaisser les commandes pendant que nous nous occupons de ceux qui les passent.",
  },
  pricing: {
    title: "Des tarifs simples",
    sub: "Chaque formule comprend tout — plan de salle en direct, statistiques et personnel illimité. Choisissez la taille qui convient, changez ou résiliez à tout moment.",
    tier1: "1 restaurant",
    tierN: "Jusqu'à {n} restaurants",
    perMonth: "/ mois",
    yearlyLine: "ou {price} / an — 2 mois offerts",
    cta: "Commencer l'essai gratuit",
    foot: "14 jours d'essai gratuit sur chaque formule — sans carte bancaire, résiliez à tout moment.",
  },
  demo: {
    title: "Installez-le sur une table et voyez",
    body: "Pas de démos, pas d'appels commerciaux. Essayez gratuitement pendant 14 jours — imprimez un QR code pour votre première table et commencez ce soir ; vos badges NFC arrivent par la poste. Sans carte bancaire, résiliable à tout moment.",
    cta: "Commencer l'essai gratuit",
    mailSubject: "Accès anticipé MyTableView",
  },
};

const DICTIONARIES: Record<string, LandingStrings> = {
  en: EN,
  es: ES,
  da: DA,
  sv: SV,
  no: NO,
  nb: NO,
  de: DE,
  nl: NL,
  fr: FR,
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
