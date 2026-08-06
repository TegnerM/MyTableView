/**
 * Shop strings — same pattern as staff.ts, own module so the shop can
 * grow without touching the big dictionary. All 8 languages, typed.
 */

const EN = {
  nav: "Shop",
  title: "Shop",
  sub: "Hardware for your floor — NFC tags, table numbers and more. Shipped to your door, paid by card.",
  buy: "Buy",
  buying: "Opening checkout…",
  empty: "Nothing in the shop right now — check back soon.",
  ordered: "Order received — thank you! You'll get a confirmation from Stripe, and we'll ship as soon as possible.",
  cancelled: "Checkout cancelled — nothing was charged.",
  error: "Could not open checkout. Please try again.",
  shippingNote: "Quantity and shipping address are chosen at checkout.",
};

export type ShopStrings = typeof EN;

const DICTS: Record<string, ShopStrings> = {
  en: EN,
  es: {
    nav: "Tienda", title: "Tienda",
    sub: "Material para tu sala — etiquetas NFC, números de mesa y más. Enviado a tu puerta, pagado con tarjeta.",
    buy: "Comprar", buying: "Abriendo el pago…",
    empty: "No hay nada en la tienda ahora mismo — vuelve pronto.",
    ordered: "Pedido recibido — ¡gracias! Recibirás una confirmación de Stripe y lo enviaremos lo antes posible.",
    cancelled: "Pago cancelado — no se ha cobrado nada.",
    error: "No se pudo abrir el pago. Inténtalo de nuevo.",
    shippingNote: "La cantidad y la dirección de envío se eligen al pagar.",
  },
  da: {
    nav: "Butik", title: "Butik",
    sub: "Udstyr til din restaurant — NFC-brikker, bordnumre og mere. Leveret til døren, betalt med kort.",
    buy: "Køb", buying: "Åbner betaling…",
    empty: "Der er ikke noget i butikken lige nu — kig forbi snart igen.",
    ordered: "Ordre modtaget — tak! Du får en bekræftelse fra Stripe, og vi sender hurtigst muligt.",
    cancelled: "Betaling annulleret — der er ikke trukket noget.",
    error: "Kunne ikke åbne betalingen. Prøv igen.",
    shippingNote: "Antal og leveringsadresse vælges ved betaling.",
  },
  sv: {
    nav: "Butik", title: "Butik",
    sub: "Utrustning till din restaurang — NFC-brickor, bordsnummer och mer. Levererat till dörren, betalat med kort.",
    buy: "Köp", buying: "Öppnar betalning…",
    empty: "Inget i butiken just nu — titta in snart igen.",
    ordered: "Beställning mottagen — tack! Du får en bekräftelse från Stripe och vi skickar så snart som möjligt.",
    cancelled: "Betalningen avbröts — inget har debiterats.",
    error: "Kunde inte öppna betalningen. Försök igen.",
    shippingNote: "Antal och leveransadress väljs vid betalningen.",
  },
  no: {
    nav: "Butikk", title: "Butikk",
    sub: "Utstyr til restauranten din — NFC-brikker, bordnumre og mer. Levert på døren, betalt med kort.",
    buy: "Kjøp", buying: "Åpner betaling…",
    empty: "Ingenting i butikken akkurat nå — kom tilbake snart.",
    ordered: "Bestilling mottatt — takk! Du får en bekreftelse fra Stripe, og vi sender så snart som mulig.",
    cancelled: "Betaling avbrutt — ingenting er belastet.",
    error: "Kunne ikke åpne betalingen. Prøv igjen.",
    shippingNote: "Antall og leveringsadresse velges ved betaling.",
  },
  de: {
    nav: "Shop", title: "Shop",
    sub: "Ausstattung für Ihren Betrieb — NFC-Tags, Tischnummern und mehr. Geliefert bis zur Tür, bezahlt per Karte.",
    buy: "Kaufen", buying: "Kasse wird geöffnet…",
    empty: "Derzeit nichts im Shop — schauen Sie bald wieder vorbei.",
    ordered: "Bestellung eingegangen — vielen Dank! Sie erhalten eine Bestätigung von Stripe, wir versenden so schnell wie möglich.",
    cancelled: "Kauf abgebrochen — es wurde nichts abgebucht.",
    error: "Kasse konnte nicht geöffnet werden. Bitte erneut versuchen.",
    shippingNote: "Menge und Lieferadresse werden an der Kasse gewählt.",
  },
  nl: {
    nav: "Winkel", title: "Winkel",
    sub: "Materiaal voor je zaak — NFC-tags, tafelnummers en meer. Thuisbezorgd, betaald met kaart.",
    buy: "Kopen", buying: "Afrekenen openen…",
    empty: "Op dit moment niets in de winkel — kom snel terug.",
    ordered: "Bestelling ontvangen — bedankt! Je krijgt een bevestiging van Stripe en we verzenden zo snel mogelijk.",
    cancelled: "Afrekenen geannuleerd — er is niets afgeschreven.",
    error: "Kon het afrekenen niet openen. Probeer het opnieuw.",
    shippingNote: "Aantal en verzendadres kies je bij het afrekenen.",
  },
  fr: {
    nav: "Boutique", title: "Boutique",
    sub: "Du matériel pour votre salle — badges NFC, numéros de table et plus. Livré chez vous, payé par carte.",
    buy: "Acheter", buying: "Ouverture du paiement…",
    empty: "Rien en boutique pour le moment — revenez bientôt.",
    ordered: "Commande reçue — merci ! Vous recevrez une confirmation de Stripe et nous expédierons au plus vite.",
    cancelled: "Paiement annulé — rien n'a été débité.",
    error: "Impossible d'ouvrir le paiement. Veuillez réessayer.",
    shippingNote: "La quantité et l'adresse de livraison se choisissent au paiement.",
  },
};

export function getShopStrings(locale: string): ShopStrings {
  return DICTS[locale] ?? DICTS[locale.split("-")[0]] ?? EN;
}
