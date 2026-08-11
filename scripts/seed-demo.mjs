#!/usr/bin/env node
/**
 * seed-demo.mjs — the permanent MyTableView demo venues.
 *
 *   node scripts/seed-demo.mjs            create / refresh the demos
 *   npm run seed:demo                     same thing
 *
 * Creates (once) and refreshes (every run) three venues owned by a
 * single demo account, one per edition:
 *
 *   Demo Restaurant   — dining room + terrace, full menu, live floor
 *   Demo Bar          — bar floor + beer garden, drinks menu, live floor
 *   Demo Hotel        — two room floors, room service + housekeeping
 *
 * Static data (venues, zones, tables, tags, menus) is created only when
 * missing, so a re-run never duplicates anything and never overwrites a
 * presenter's tweaks. LIVE data (open sessions, guest requests, orders)
 * is wiped and re-staged on every run, so each presentation starts from
 * the same believable mid-service moment.
 *
 * The venues are permanent by construction: trial_ends_at is parked in
 * 2099, which keeps them open under lib/billing/status.ts without ever
 * touching Stripe.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (the same file the app itself uses).
 *
 * Environment overrides:
 *   DEMO_EMAIL      demo owner login   (default demo@mytableview.com)
 *   DEMO_PASSWORD   demo owner password (default DemoTable!2026 —
 *                   re-applied on every run so the login always works)
 *   DEMO_BASE_URL   base for printed guest links (default
 *                   https://mytableview.com)
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------- env

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env.local");

function loadEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (!(key in process.env)) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile(envPath);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_EMAIL = (process.env.DEMO_EMAIL || "demo@mytableview.com").toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "DemoTable!2026";
const BASE_URL = (process.env.DEMO_BASE_URL || "https://mytableview.com").replace(/\/+$/, "");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      `Looked for them in the environment and in ${envPath}`
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ------------------------------------------------------------ helpers

function fail(step, error) {
  console.error(`✗ ${step}:`, error?.message ?? error);
  process.exit(1);
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Same alphabet + length as lib/tags/generate-ids.ts. */
const TAG_ALPHABET = "23456789abcdefghjkmnpqrstvwxyz";
function generateTagId() {
  let id = "";
  for (let i = 0; i < 10; i += 1) {
    id += TAG_ALPHABET[randomInt(TAG_ALPHABET.length)];
  }
  return id;
}

/** Locale-map shorthand: l("Steak", "Filete") → {en, es}. Order:
 *  en, es, de, da — omit trailing ones freely. */
function l(en, es, de, da) {
  const map = { en };
  if (es) map.es = es;
  if (de) map.de = de;
  if (da) map.da = da;
  return map;
}

// ------------------------------------------------- edition defaults
// Mirrors src/lib/edition.ts (applyEdition) and src/lib/stations.ts.
// If those files change, update here too — or better, apply the
// edition once in the UI (Settings → Venue type) after seeding.

const DEFAULT_STATION_NAMES = {
  kitchen: {
    en: "Kitchen", es: "Cocina", da: "Køkken", sv: "Kök",
    no: "Kjøkken", de: "Küche", nl: "Keuken", fr: "Cuisine",
  },
  bar: {
    en: "Bar", es: "Barra", da: "Bar", sv: "Bar",
    no: "Bar", de: "Bar", nl: "Bar", fr: "Bar",
  },
};

const BAR_STATION_NAMES = {
  kitchen: {
    en: "Snack kitchen", es: "Cocina de snacks", da: "Snackkøkken",
    sv: "Snackkök", no: "Snackkjøkken", de: "Snackküche",
    nl: "Snackkeuken", fr: "Cuisine snacks",
  },
  bar: DEFAULT_STATION_NAMES.bar,
};

const HOUSEKEEPING_STATION = {
  slug: "housekeeping",
  sortOrder: 3,
  name: {
    en: "Housekeeping", es: "Limpieza", da: "Housekeeping", sv: "Städning",
    no: "Renhold", de: "Housekeeping", nl: "Housekeeping", fr: "Ménage",
  },
};

const BAR_REQUEST_TYPES = [
  { code: "bar_napkins", icon: "napkin", closes: false, sort: 41,
    label: l("More napkins", "Más servilletas", "Mehr Servietten", "Flere servietter"), sublabel: {} },
  { code: "bar_clean_table", icon: "sparkle", closes: false, sort: 42,
    label: l("Clean the table", "Limpiar la mesa", "Tisch abwischen", "Tør bordet af"),
    sublabel: l("Empty glasses, spills", "Vasos vacíos, derrames", "Leere Gläser, Verschüttetes", "Tomme glas, spild") },
  { code: "bar_bill_table", icon: "bill", closes: true, sort: 51,
    label: l("Bring the bill", "Traer la cuenta", "Die Rechnung bringen", "Kom med regningen"),
    sublabel: l("We'll pay at the table", "Pagamos en la mesa", "Wir zahlen am Tisch", "Vi betaler ved bordet") },
  { code: "bar_bill_bar", icon: "bar", closes: true, sort: 52,
    label: l("We'll pay at the bar", "Pagamos en la barra", "Wir zahlen an der Bar", "Vi betaler i baren"),
    sublabel: l("Just close our tab", "Solo cerrad la cuenta", "Nur unsere Rechnung schließen", "Luk bare vores regning") },
];

const HOTEL_REQUEST_TYPES = [
  { code: "hotel_hk_towels", icon: "towel", closes: false, sort: 61,
    label: l("Fresh towels", "Toallas limpias", "Frische Handtücher", "Friske håndklæder"), sublabel: {} },
  { code: "hotel_hk_makeup", icon: "bed", closes: false, sort: 62,
    label: l("Make up my room", "Arreglar mi habitación", "Zimmer aufräumen", "Gør mit værelse rent"),
    sublabel: l("We'll come while you're out", "Iremos mientras estás fuera", "Wir kommen, während Sie unterwegs sind", "Vi kommer, mens du er ude") },
  { code: "hotel_hk_pillows", icon: "pillow", closes: false, sort: 63,
    label: l("Extra pillows & blanket", "Almohadas y manta extra", "Extra Kissen & Decke", "Ekstra puder og tæppe"), sublabel: {} },
  { code: "hotel_hk_amenities", icon: "soap", closes: false, sort: 64,
    label: l("Amenities refill", "Reponer amenities", "Amenities auffüllen", "Genopfyld amenities"),
    sublabel: l("Soap, shampoo, coffee & tea", "Jabón, champú, café y té", "Seife, Shampoo, Kaffee & Tee", "Sæbe, shampoo, kaffe og te") },
  { code: "hotel_hk_coffee", icon: "coffee", closes: false, sort: 65,
    label: l("Extra coffee, tea, sugar & milk", "Más café, té, azúcar y leche", "Mehr Kaffee, Tee, Zucker & Milch", "Mere kaffe, te, sukker og mælk"),
    sublabel: l("Refill the room tray", "Reponer la bandeja de la habitación", "Das Zimmertablett auffüllen", "Genopfyld bakken på værelset") },
  { code: "hotel_maintenance", icon: "wrench", closes: false, sort: 66,
    label: l("Maintenance issue", "Avería / mantenimiento", "Technisches Problem", "Noget virker ikke"),
    sublabel: l("Tell us what's not working", "Cuéntanos qué no funciona", "Sagen Sie uns, was nicht funktioniert", "Fortæl os, hvad der ikke virker") },
  { code: "hotel_book_table", icon: "wine", closes: false, sort: 67,
    label: l("Book a table for dinner", "Reservar mesa para cenar", "Tisch zum Abendessen reservieren", "Book et bord til middag"),
    sublabel: l("At the hotel restaurant", "En el restaurante del hotel", "Im Hotelrestaurant", "På hotellets restaurant") },
  { code: "hotel_taxi", icon: "taxi", closes: false, sort: 68,
    label: l("Book a taxi", "Pedir un taxi", "Ein Taxi bestellen", "Bestil en taxa"),
    sublabel: l("We'll send one to the entrance", "Lo enviamos a la entrada", "Wir schicken eins zum Eingang", "Vi sender en til indgangen") },
  { code: "hotel_concierge", icon: "bell", closes: false, sort: 69,
    label: l("Concierge", "Conserjería", "Concierge", "Concierge"),
    sublabel: l("Recommendations, taxis, anything", "Recomendaciones, taxis, lo que necesites", "Empfehlungen, Taxis, alles Weitere", "Anbefalinger, taxa, hvad som helst") },
  { code: "hotel_late_checkout", icon: "clock", closes: false, sort: 70,
    label: l("Late check-out", "Salida tardía", "Später Check-out", "Sen check-ud"),
    sublabel: l("We'll check availability", "Comprobaremos disponibilidad", "Wir prüfen die Verfügbarkeit", "Vi tjekker, om det er muligt") },
];

// ------------------------------------------------------- venue specs

const VENUES = [
  {
    key: "restaurant",
    name: "Demo Restaurant",
    edition: "restaurant",
    zones: [
      {
        name: "Dining room", widthM: 14, depthM: 10,
        tables: [
          { seats: 2, shape: "round", x: 1.6, y: 1.6 },
          { seats: 2, shape: "round", x: 1.6, y: 4.2 },
          { seats: 4, shape: "round", x: 4.6, y: 1.8 },
          { seats: 4, shape: "round", x: 4.6, y: 4.8 },
          { seats: 4, shape: "round", x: 8.0, y: 1.8 },
          { seats: 4, shape: "round", x: 8.0, y: 4.8 },
          { seats: 6, shape: "square", x: 11.6, y: 2.2 },
          { seats: 6, shape: "square", x: 11.6, y: 5.6 },
          { seats: 8, shape: "round", x: 5.6, y: 8.0 },
        ],
      },
      {
        name: "Terrace", widthM: 12, depthM: 8,
        tables: [
          { seats: 2, shape: "round", x: 1.5, y: 1.5 },
          { seats: 2, shape: "round", x: 4.0, y: 1.5 },
          { seats: 2, shape: "round", x: 6.5, y: 1.5 },
          { seats: 2, shape: "round", x: 9.0, y: 1.5 },
          { seats: 4, shape: "square", x: 3.0, y: 5.0 },
          { seats: 4, shape: "square", x: 8.0, y: 5.0 },
        ],
      },
    ],
    menu: [
      {
        name: l("Starters", "Entrantes", "Vorspeisen", "Forretter"), station: "kitchen",
        items: [
          { name: l("Garlic prawns", "Gambas al ajillo", "Knoblauchgarnelen", "Hvidløgsrejer"),
            desc: l("Sizzling in olive oil and chilli", "En aceite de oliva y guindilla", "In Olivenöl und Chili", "I olivenolie og chili"), cents: 1250, alsoOnBar: true },
          { name: l("Burrata & tomatoes", "Burrata con tomate", "Burrata & Tomaten", "Burrata og tomater"),
            desc: l("Heritage tomatoes, basil oil", "Tomate de temporada, aceite de albahaca", "Alte Tomatensorten, Basilikumöl", "Tomater, basilikumolie"), cents: 1150 },
          { name: l("Crispy calamari", "Calamares crujientes", "Knusprige Calamari", "Sprøde blæksprutteringe"),
            desc: l("Lemon aioli", "Alioli de limón", "Zitronen-Aioli", "Citronaioli"), cents: 990, alsoOnBar: true },
        ],
      },
      {
        name: l("Mains", "Principales", "Hauptgerichte", "Hovedretter"), station: "kitchen",
        items: [
          { name: l("Grilled sea bass", "Lubina a la plancha", "Gegrillter Wolfsbarsch", "Grillet havbars"),
            desc: l("With saffron rice", "Con arroz al azafrán", "Mit Safranreis", "Med safranris"), cents: 2350 },
          { name: l("Ribeye 300 g", "Chuletón 300 g", "Ribeye 300 g", "Ribeye 300 g"),
            desc: l("Chimichurri, fries", "Chimichurri, patatas", "Chimichurri, Pommes", "Chimichurri, fritter"), cents: 2890 },
          { name: l("Wild mushroom risotto", "Risotto de setas", "Pilzrisotto", "Svamperisotto"),
            desc: l("Parmesan, truffle oil", "Parmesano, aceite de trufa", "Parmesan, Trüffelöl", "Parmesan, trøffelolie"), cents: 1750 },
          { name: l("Paella for two", "Paella para dos", "Paella für zwei", "Paella for to"),
            desc: l("25 minutes — worth it", "25 minutos — merece la pena", "25 Minuten — es lohnt sich", "25 minutter — det er det værd"), cents: 3900 },
        ],
      },
      {
        name: l("Desserts", "Postres", "Desserts", "Desserter"), station: "kitchen",
        items: [
          { name: l("Crema catalana", "Crema catalana", "Crema catalana", "Crema catalana"),
            desc: l("Burnt sugar crust", "Azúcar caramelizado", "Karamellisierte Zuckerkruste", "Karamelliseret sukker"), cents: 690 },
          { name: l("Chocolate fondant", "Coulant de chocolate", "Schokoladenfondant", "Chokoladefondant"),
            desc: l("Vanilla ice cream", "Con helado de vainilla", "Mit Vanilleeis", "Med vaniljeis"), cents: 790 },
        ],
      },
      {
        name: l("Drinks", "Bebidas", "Getränke", "Drikkevarer"), station: "bar",
        items: [
          { name: l("House red / white", "Vino de la casa", "Hauswein", "Husets vin"),
            desc: l("Glass", "Copa", "Glas", "Glas"), cents: 450 },
          { name: l("Sangría (1 L)", "Sangría (1 L)", "Sangría (1 L)", "Sangria (1 L)"), desc: {}, cents: 1400 },
          { name: l("Draft beer", "Caña", "Bier vom Fass", "Fadøl"), desc: {}, cents: 380 },
          { name: l("Sparkling water", "Agua con gas", "Sprudelwasser", "Danskvand"), desc: {}, cents: 290 },
        ],
      },
    ],
  },
  {
    key: "bar",
    name: "Demo Bar",
    edition: "bar",
    zones: [
      {
        name: "Bar floor", widthM: 12, depthM: 9,
        tables: [
          { seats: 2, shape: "round", x: 1.5, y: 1.5 },
          { seats: 2, shape: "round", x: 4.0, y: 1.5 },
          { seats: 2, shape: "round", x: 6.5, y: 1.5 },
          { seats: 2, shape: "round", x: 9.0, y: 1.5 },
          { seats: 4, shape: "round", x: 2.5, y: 4.5 },
          { seats: 4, shape: "round", x: 6.0, y: 4.5 },
          { seats: 6, shape: "square", x: 3.0, y: 7.3 },
          { seats: 6, shape: "square", x: 8.0, y: 7.3 },
        ],
      },
      {
        name: "Beer garden", widthM: 10, depthM: 8,
        tables: [
          { seats: 6, shape: "square", x: 2.2, y: 2.0 },
          { seats: 6, shape: "square", x: 7.0, y: 2.0 },
          { seats: 6, shape: "square", x: 2.2, y: 5.8 },
          { seats: 6, shape: "square", x: 7.0, y: 5.8 },
        ],
      },
    ],
    menu: [
      {
        name: l("Cocktails", "Cócteles", "Cocktails", "Cocktails"), station: "bar",
        items: [
          { name: l("Margarita", "Margarita", "Margarita", "Margarita"),
            desc: l("Tequila, lime, triple sec", "Tequila, lima, triple seco", "Tequila, Limette, Triple Sec", "Tequila, lime, triple sec"), cents: 950 },
          { name: l("Espresso martini", "Espresso martini", "Espresso Martini", "Espresso martini"), desc: {}, cents: 1050 },
          { name: l("Aperol spritz", "Aperol spritz", "Aperol Spritz", "Aperol spritz"), desc: {}, cents: 850 },
          { name: l("Mojito", "Mojito", "Mojito", "Mojito"), desc: {}, cents: 900 },
        ],
      },
      {
        name: l("Beer & wine", "Cerveza y vino", "Bier & Wein", "Øl og vin"), station: "bar",
        items: [
          { name: l("IPA (draft)", "IPA (de barril)", "IPA (vom Fass)", "IPA (fadøl)"), desc: {}, cents: 650 },
          { name: l("Lager (draft)", "Lager (de barril)", "Lager (vom Fass)", "Pilsner (fadøl)"), desc: {}, cents: 550 },
          { name: l("Glass of cava", "Copa de cava", "Glas Cava", "Glas cava"), desc: {}, cents: 600 },
        ],
      },
      {
        name: l("Soft drinks", "Refrescos", "Alkoholfrei", "Sodavand"), station: "bar",
        items: [
          { name: l("Cola / lemon / orange", "Cola / limón / naranja", "Cola / Zitrone / Orange", "Cola / citron / appelsin"), desc: {}, cents: 350 },
          { name: l("Fresh orange juice", "Zumo de naranja natural", "Frischer Orangensaft", "Friskpresset appelsinjuice"), desc: {}, cents: 480 },
        ],
      },
      {
        name: l("Bar snacks", "Para picar", "Snacks", "Snacks"), station: "kitchen",
        items: [
          { name: l("Nachos", "Nachos", "Nachos", "Nachos"),
            desc: l("Cheese, jalapeños, salsa", "Queso, jalapeños, salsa", "Käse, Jalapeños, Salsa", "Ost, jalapeños, salsa"), cents: 890 },
          { name: l("Patatas bravas", "Patatas bravas", "Patatas bravas", "Patatas bravas"), desc: {}, cents: 650 },
          { name: l("Chicken wings", "Alitas de pollo", "Chicken Wings", "Kyllingevinger"),
            desc: l("BBQ or hot", "BBQ o picantes", "BBQ oder scharf", "BBQ eller stærke"), cents: 950 },
          { name: l("Padrón peppers", "Pimientos de Padrón", "Padrón-Paprika", "Padrón-peberfrugter"),
            desc: l("Flaky sea salt", "Con sal en escamas", "Mit Meersalzflocken", "Med flagesalt"), cents: 590 },
          { name: l("Croquettes", "Croquetas", "Kroketten", "Kroketter"),
            desc: l("Ham or mushroom, 6 pcs", "Jamón o setas, 6 uds", "Schinken oder Pilze, 6 Stk", "Skinke eller svampe, 6 stk"), cents: 780 },
        ],
      },
      {
        name: l("Kitchen", "Cocina", "Küche", "Køkken"), station: "kitchen",
        items: [
          { name: l("Smash burger & fries", "Smash burger con patatas", "Smash Burger & Pommes", "Smash burger med fritter"),
            desc: l("Double patty, cheddar, pickles", "Doble carne, cheddar, pepinillos", "Doppelt Fleisch, Cheddar, Gurken", "Dobbelt bøf, cheddar, syltede agurker"), cents: 1390 },
          { name: l("Club sandwich", "Sándwich club", "Club Sandwich", "Club sandwich"),
            desc: l("Chicken, bacon, egg, fries", "Pollo, bacon, huevo, patatas", "Hähnchen, Bacon, Ei, Pommes", "Kylling, bacon, æg, fritter"), cents: 1190 },
          { name: l("Fish & chips", "Fish & chips", "Fish & Chips", "Fish & chips"),
            desc: l("Tartare sauce, lemon", "Salsa tártara, limón", "Remoulade, Zitrone", "Remoulade, citron"), cents: 1450 },
          { name: l("Chicken quesadilla", "Quesadilla de pollo", "Hähnchen-Quesadilla", "Kyllinge-quesadilla"),
            desc: l("Sour cream, guacamole", "Crema agria, guacamole", "Sauerrahm, Guacamole", "Creme fraiche, guacamole"), cents: 1090 },
          { name: l("Loaded fries", "Patatas cargadas", "Loaded Fries", "Loaded fries"),
            desc: l("Cheese sauce, bacon, jalapeños", "Salsa de queso, bacon, jalapeños", "Käsesauce, Bacon, Jalapeños", "Ostesauce, bacon, jalapeños"), cents: 850 },
          { name: l("Caesar wrap", "Wrap César", "Caesar Wrap", "Cæsar wrap"),
            desc: {}, cents: 990 },
        ],
      },
    ],
  },
  {
    key: "hotel",
    name: "Demo Hotel",
    edition: "hotel",
    zones: [
      {
        name: "Floor 1", widthM: 16, depthM: 4,
        tables: [
          { seats: 2, shape: "square", x: 1.6, y: 2.0, label: "101" },
          { seats: 2, shape: "square", x: 4.2, y: 2.0, label: "102" },
          { seats: 2, shape: "square", x: 6.8, y: 2.0, label: "103" },
          { seats: 2, shape: "square", x: 9.4, y: 2.0, label: "104" },
          { seats: 2, shape: "square", x: 12.0, y: 2.0, label: "105" },
          { seats: 2, shape: "square", x: 14.4, y: 2.0, label: "106" },
        ],
      },
      {
        name: "Floor 2", widthM: 16, depthM: 4,
        tables: [
          { seats: 2, shape: "square", x: 1.6, y: 2.0, label: "201" },
          { seats: 2, shape: "square", x: 4.2, y: 2.0, label: "202" },
          { seats: 2, shape: "square", x: 6.8, y: 2.0, label: "203" },
          { seats: 2, shape: "square", x: 9.4, y: 2.0, label: "204" },
          { seats: 2, shape: "square", x: 12.0, y: 2.0, label: "205" },
          { seats: 2, shape: "square", x: 14.4, y: 2.0, label: "206" },
        ],
      },
    ],
    menu: [
      {
        name: l("Breakfast in bed", "Desayuno en la habitación", "Frühstück aufs Zimmer", "Morgenmad på værelset"), station: "kitchen",
        items: [
          { name: l("Continental breakfast", "Desayuno continental", "Kontinentales Frühstück", "Kontinental morgenmad"),
            desc: l("Croissant, juice, fruit, coffee", "Cruasán, zumo, fruta, café", "Croissant, Saft, Obst, Kaffee", "Croissant, juice, frugt, kaffe"), cents: 1450 },
          { name: l("Full English", "Desayuno inglés", "Englisches Frühstück", "Engelsk morgenmad"), desc: {}, cents: 1750 },
          { name: l("Pancakes & berries", "Tortitas con frutos rojos", "Pancakes & Beeren", "Pandekager med bær"), desc: {}, cents: 1150 },
        ],
      },
      {
        name: l("All-day room service", "Room service", "Room Service", "Roomservice"), station: "kitchen",
        items: [
          { name: l("Club sandwich", "Sándwich club", "Club Sandwich", "Club sandwich"),
            desc: l("With fries", "Con patatas", "Mit Pommes", "Med fritter"), cents: 1550 },
          { name: l("Caesar salad", "Ensalada César", "Caesar Salad", "Cæsarsalat"), desc: {}, cents: 1350 },
          { name: l("Margherita pizza", "Pizza margarita", "Pizza Margherita", "Pizza margherita"), desc: {}, cents: 1250 },
        ],
      },
      {
        name: l("Drinks", "Bebidas", "Getränke", "Drikkevarer"), station: "bar",
        items: [
          { name: l("Bottle of cava", "Botella de cava", "Flasche Cava", "Flaske cava"), desc: {}, cents: 2900 },
          { name: l("Minibar restock", "Reponer minibar", "Minibar auffüllen", "Minibar genopfyldning"), desc: {}, cents: 1800 },
          { name: l("Fresh juice", "Zumo natural", "Frischer Saft", "Friskpresset juice"), desc: {}, cents: 480 },
        ],
      },
      {
        name: l("Housekeeping shop", "Housekeeping", "Housekeeping", "Housekeeping"), station: "housekeeping",
        items: [
          { name: l("Extra bathrobe & slippers", "Albornoz y zapatillas extra", "Extra Bademantel & Slipper", "Ekstra badekåbe og hjemmesko"), desc: {}, cents: 0 },
          { name: l("Baby cot", "Cuna", "Babybett", "Barneseng"), desc: {}, cents: 0 },
        ],
      },
    ],
  },
];

// -------------------------------------------------------- demo owner

async function ensureDemoOwner() {
  const { data: created, error } = await db.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { demo: true },
  });

  if (!error && created?.user) {
    console.log(`• Demo owner created: ${DEMO_EMAIL}`);
    return created.user;
  }

  // Already exists — find it and re-apply the password so the printed
  // credentials are always valid.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error: listError } = await db.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError) fail("listing users", listError);
    const match = data.users.find(
      (u) => (u.email || "").toLowerCase() === DEMO_EMAIL
    );
    if (match) {
      await db.auth.admin.updateUserById(match.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      console.log(`• Demo owner exists: ${DEMO_EMAIL} (password refreshed)`);
      return match;
    }
    if (data.users.length < 200) break;
  }

  fail("creating demo owner", error);
}

// ------------------------------------------------------ venue shell

async function findOwnedVenue(userId, venueName) {
  const { data, error } = await db
    .from("staff")
    .select("venue_id, venues:venue_id ( id, name )")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) fail("reading demo memberships", error);
  const row = (data ?? []).find((r) => r.venues?.name === venueName);
  return row?.venues?.id ?? null;
}

async function hasAnyMembership(userId) {
  const { data, error } = await db
    .from("staff")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1);
  if (error) fail("reading memberships", error);
  return (data ?? []).length > 0;
}

async function createVenue(userId, name, isFirst) {
  const rpc = isFirst ? "signup_create_venue" : "add_venue_for_owner";
  const { data: venueId, error } = await db.rpc(rpc, {
    p_user_id: userId,
    p_venue_name: name,
    p_display_name: "Demo Team",
    p_timezone: "Europe/Madrid",
    p_locale: "en",
  });
  if (error || !venueId) fail(`creating venue "${name}" via ${rpc}`, error);
  console.log(`  ✚ Venue created: ${name}`);
  return String(venueId);
}

/** Permanent-demo venue settings + edition (mirrors applyEdition). */
async function applyVenueSettings(venueId, spec) {
  const { error } = await db
    .from("venues")
    .update({
      edition: spec.edition,
      trial_ends_at: "2099-01-01T00:00:00Z", // permanent by trial clock
      ordering_active: true,
      service_charge_pct: 0,
      locales: ["en", "es", "de", "da"],
      default_locale: "en",
    })
    .eq("id", venueId);
  if (error) fail("updating venue settings", error);

  // Stations: seed the defaults if missing, rename per edition.
  const { data: stations } = await db
    .from("stations")
    .select("slug")
    .eq("venue_id", venueId);
  const have = new Set((stations ?? []).map((s) => s.slug));

  const wanted = [
    { slug: "kitchen", sort_order: 1 },
    { slug: "bar", sort_order: 2 },
  ];
  for (const st of wanted) {
    if (!have.has(st.slug)) {
      await db.from("stations").insert({
        venue_id: venueId,
        slug: st.slug,
        name: DEFAULT_STATION_NAMES[st.slug],
        sort_order: st.sort_order,
      });
    }
  }

  const names = spec.edition === "bar" ? BAR_STATION_NAMES : DEFAULT_STATION_NAMES;
  for (const [slug, name] of Object.entries(names)) {
    await db.from("stations").update({ name }).eq("venue_id", venueId).eq("slug", slug);
  }

  if (spec.edition === "hotel") {
    const { error: hkError } = await db.from("stations").upsert(
      {
        venue_id: venueId,
        slug: HOUSEKEEPING_STATION.slug,
        name: HOUSEKEEPING_STATION.name,
        sort_order: HOUSEKEEPING_STATION.sortOrder,
        active: true,
      },
      { onConflict: "venue_id,slug" }
    );
    if (hkError) console.warn("  ! housekeeping station:", hkError.message);
  }

  // Edition guest buttons — insert only the missing codes.
  const seeds =
    spec.edition === "bar" ? BAR_REQUEST_TYPES
    : spec.edition === "hotel" ? HOTEL_REQUEST_TYPES
    : [];
  if (seeds.length > 0) {
    const { data: existing } = await db
      .from("request_types")
      .select("code")
      .eq("venue_id", venueId);
    const haveCodes = new Set((existing ?? []).map((r) => r.code));
    const missing = seeds.filter((t) => !haveCodes.has(t.code));

    // The schema allows one session-closing button per venue
    // (request_types_one_closer_per_venue). If the edition brings its
    // own closer (the bar's "Bring the bill"), retire the default one
    // so the edition button can take its place; any further closers in
    // the seed list land as ordinary signals.
    if (missing.some((t) => t.closes)) {
      await db
        .from("request_types")
        .update({ active: false, closes_session: false })
        .eq("venue_id", venueId)
        .eq("closes_session", true);
    }

    let usedCloser = false;
    for (const t of missing) {
      let closes = t.closes;
      if (closes && usedCloser) closes = false;
      const { error: seedError } = await db.from("request_types").insert({
        venue_id: venueId,
        code: t.code,
        kind: "signal",
        label: t.label,
        sublabel: t.sublabel,
        icon: t.icon,
        closes_session: closes,
        sort_order: t.sort,
        active: true,
      });
      if (seedError) {
        console.warn(`  ! request type ${t.code}:`, seedError.message);
      } else if (closes) {
        usedCloser = true;
      }
    }
  }
}

// ------------------------------------------------ zones and tables

async function ensureZones(venueId, spec) {
  const { data: areas, error } = await db
    .from("areas")
    .select("id, name, sort_order")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) fail("reading zones", error);

  const zoneIds = [];
  const existing = areas ?? [];

  for (let i = 0; i < spec.zones.length; i += 1) {
    const zone = spec.zones[i];
    let match = existing.find((a) => (a.name?.en ?? "") === zone.name);

    // The signup RPC creates one starter zone — claim it for zone #1
    // rather than leaving an empty duplicate behind.
    if (!match && i === 0 && existing.length > 0) {
      match = existing[0];
    }

    if (match) {
      await db
        .from("areas")
        .update({
          name: { en: zone.name },
          width_m: zone.widthM,
          depth_m: zone.depthM,
        })
        .eq("id", match.id);
      zoneIds.push(match.id);
      continue;
    }

    const { data: inserted, error: insertError } = await db
      .from("areas")
      .insert({
        venue_id: venueId,
        name: { en: zone.name },
        sort_order: i,
        width_m: zone.widthM,
        depth_m: zone.depthM,
      })
      .select("id")
      .single();
    if (insertError || !inserted) fail(`creating zone "${zone.name}"`, insertError);
    zoneIds.push(inserted.id);
  }

  return zoneIds;
}

async function ensureTables(venueId, spec, zoneIds) {
  const { data: existing, error } = await db
    .from("tables")
    .select("id, label")
    .eq("venue_id", venueId)
    .eq("active", true);
  if (error) fail("reading tables", error);

  if ((existing ?? []).length > 0) {
    console.log(`  = Tables already in place (${existing.length})`);
    return;
  }

  // Direct inserts: the staff_add_table RPC insists on a signed-in
  // manager (auth.uid()), which a service-role script doesn't have.
  // Footprints mirror table_default_footprint / the layout route.
  const footprint = (seats, shape) => {
    const widthM = Math.round((0.6 + 0.15 * seats) * 100) / 100;
    const depthM =
      shape === "square"
        ? Math.round((0.5 + 0.1 * seats) * 100) / 100
        : widthM;
    return { widthM, depthM };
  };

  let created = 0;
  let nextLabel = 1;
  for (let i = 0; i < spec.zones.length; i += 1) {
    const zone = spec.zones[i];
    for (const t of zone.tables) {
      const fp = footprint(t.seats, t.shape);
      const label = t.label ?? String(nextLabel);
      nextLabel += 1;
      const { error: addError } = await db.from("tables").insert({
        venue_id: venueId,
        area_id: zoneIds[i],
        label,
        seats: t.seats,
        shape: t.shape,
        pos_x: t.x,
        pos_y: t.y,
        width_m: fp.widthM,
        depth_m: fp.depthM,
        rotation: 0,
        active: true,
      });
      if (addError) fail(`adding table ${label}`, addError);
      created += 1;
    }
  }
  console.log(`  ✚ Tables created: ${created}`);
}

async function ensureTags(venueId, spec) {
  const { data: tables, error } = await db
    .from("tables")
    .select("id, label")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("label", { ascending: true });
  if (error) fail("reading tables for tags", error);

  const { data: tags, error: tagsError } = await db
    .from("tags")
    .select("id, table_id, status")
    .eq("venue_id", venueId);
  if (tagsError) fail("reading tags", tagsError);

  const tagged = new Set(
    (tags ?? [])
      .filter((t) => t.status === "active" && t.table_id)
      .map((t) => t.table_id)
  );

  let created = 0;
  for (const table of tables ?? []) {
    if (tagged.has(table.id)) continue;
    const { error: insertError } = await db.from("tags").insert({
      id: generateTagId(),
      printed_ref: `demo-${spec.key}-${table.label}`,
      batch: "demo",
      status: "active",
      venue_id: venueId,
      table_id: table.id,
      assigned_at: new Date().toISOString(),
    });
    if (insertError) fail(`creating tag for table ${table.label}`, insertError);
    created += 1;
  }
  if (created > 0) console.log(`  ✚ Tags created: ${created}`);
}

// --------------------------------------------------------------- menu

/** Categories and items are matched by their English name, so adding a
 *  dish to the spec and re-running adds just that dish — existing rows
 *  (and any tweaks made in the menu editor) are left alone. */
async function ensureMenu(venueId, spec) {
  const { data: existingCats, error } = await db
    .from("menu_categories")
    .select("id, name")
    .eq("venue_id", venueId)
    .eq("active", true);
  if (error) fail("reading menu", error);

  let newCats = 0;
  let newItems = 0;

  for (let c = 0; c < spec.menu.length; c += 1) {
    const category = spec.menu[c];
    let cat = (existingCats ?? []).find(
      (row) => (row.name?.en ?? "") === category.name.en
    );

    if (!cat) {
      const { data: inserted, error: catError } = await db
        .from("menu_categories")
        .insert({
          venue_id: venueId,
          name: category.name,
          station: category.station,
          sort_order: c,
          active: true,
        })
        .select("id, name")
        .single();
      if (catError || !inserted) fail("creating menu category", catError);
      cat = inserted;
      newCats += 1;
    }

    const { data: existingItems, error: itemsReadError } = await db
      .from("menu_items")
      .select("id, name")
      .eq("category_id", cat.id)
      .eq("active", true);
    if (itemsReadError) fail("reading menu items", itemsReadError);

    const have = new Set(
      (existingItems ?? []).map((item) => item.name?.en ?? "")
    );
    const missing = category.items.filter((item) => !have.has(item.name.en));

    if (missing.length > 0) {
      const base = (existingItems ?? []).length;
      const { error: itemsError } = await db.from("menu_items").insert(
        missing.map((item, index) => ({
          venue_id: venueId,
          category_id: cat.id,
          name: item.name,
          description: item.desc ?? {},
          price_cents: item.cents,
          allergens: [],
          available: true,
          sort_order: base + index,
          active: true,
        }))
      );
      if (itemsError) fail("creating menu items", itemsError);
      newItems += missing.length;
    }
  }

  if (newCats > 0 || newItems > 0) {
    console.log(`  ✚ Menu updated: +${newCats} categories, +${newItems} items`);
  } else {
    console.log("  = Menu already in place");
  }
}

/** "Also on the bar menu": flag the spec's shared dishes so the Demo
 *  Restaurant publishes them onto Demo Bar's guest menu (same account).
 *  Warns instead of failing until the 2026-08-11 migration has run. */
async function ensureBarSharing(venueId, spec) {
  const wanted = [];
  for (const category of spec.menu) {
    for (const item of category.items) {
      if (item.alsoOnBar) wanted.push(item.name.en);
    }
  }
  if (wanted.length === 0) return;

  const { data: items, error } = await db
    .from("menu_items")
    .select("id, name")
    .eq("venue_id", venueId)
    .eq("active", true);
  if (error) {
    console.warn("  ! bar sharing read:", error.message);
    return;
  }

  const ids = (items ?? [])
    .filter((item) => wanted.includes(item.name?.en ?? ""))
    .map((item) => item.id);
  if (ids.length === 0) return;

  const { error: updateError } = await db
    .from("menu_items")
    .update({ also_on_bar: true })
    .in("id", ids);
  if (updateError) {
    console.warn(
      `  ! bar sharing: ${updateError.message}\n` +
        "    → run src/sql/2026-08-11_bar_menu_sharing.sql in Supabase, then re-run this seed"
    );
  } else {
    console.log(`  ✎ Shared onto the bar menu: ${ids.length} dishes`);
  }
}

// ---------------------------------------------------- live floor data

/** Wipe sessions / requests / orders so every run stages the same
 *  believable mid-service moment. Static data is never touched. */
async function clearLiveData(venueId) {
  const { data: sessions } = await db
    .from("sessions")
    .select("id")
    .eq("venue_id", venueId);
  const sessionIds = (sessions ?? []).map((s) => s.id);

  const warn = (step) => (result) => {
    if (result?.error) console.warn(`  ! clearing ${step}:`, result.error.message);
    return result;
  };

  await db.from("request_taps").delete().eq("venue_id", venueId).then(warn("taps"));
  await db.from("requests").delete().eq("venue_id", venueId).then(warn("requests"));
  // Orders cascade their tickets and items.
  await db.from("orders").delete().eq("venue_id", venueId).then(warn("orders"));
  if (sessionIds.length > 0) {
    await db
      .from("session_tables")
      .delete()
      .in("session_id", sessionIds)
      .then(warn("session links"));
    const { error } = await db.from("sessions").delete().eq("venue_id", venueId);
    if (error) {
      // Some history table may reference old sessions — close them
      // instead so they at least leave the live floor.
      console.warn("  ! deleting sessions:", error.message, "— closing instead");
      await db.from("sessions").update({ state: "closed" }).eq("venue_id", venueId);
    }
  }
}

/** Find a table by label; if the venue numbers its tables differently
 *  (the add-table RPC owns labelling), fall back to the next unused
 *  table so the live demo still stages. */
async function tableByLabel(venueId, label, used) {
  const { data, error } = await db
    .from("tables")
    .select("id, label")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("label", { ascending: true });
  if (error || !data || data.length === 0) fail("reading tables", error);

  const match = data.find((t) => t.label === label && !used.has(t.id));
  if (match) {
    used.add(match.id);
    return match;
  }

  const fallback = data.find((t) => !used.has(t.id));
  if (!fallback) fail(`no free table for "${label}"`, null);
  console.warn(`  ! table "${label}" not found — using "${fallback.label}"`);
  used.add(fallback.id);
  return fallback;
}

async function tagForTable(tableId) {
  const { data } = await db
    .from("tags")
    .select("id")
    .eq("table_id", tableId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function openSession(venueId, tableId, { minutesOpen, guests }) {
  const { data, error } = await db
    .rpc("guest_open_session", { p_venue_id: venueId, p_table_id: tableId })
    .maybeSingle();
  if (error || !data) fail("opening session", error);
  const sessionId = data.session_id;

  const patch = { opened_at: minutesAgo(minutesOpen) };
  if (guests) patch.guest_count = guests;
  await db.from("sessions").update(patch).eq("id", sessionId);
  return sessionId;
}

/** Pick a request type: first matching code wins, else any active
 *  signal button (optionally one that closes the session). */
async function pickRequestType(venueId, preferredCodes, { closes = false } = {}) {
  const { data, error } = await db
    .from("request_types")
    .select("id, code, closes_session, kind, active, sort_order")
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) fail("reading request types", error);
  const rows = data ?? [];

  for (const code of preferredCodes) {
    const match = rows.find((r) => r.code === code);
    if (match) return match;
  }
  return (
    rows.find((r) => r.kind === "signal" && r.closes_session === closes) ??
    rows.find((r) => r.kind === "signal") ??
    null
  );
}

async function createRequest(venueId, session, table, tagId, requestType, {
  minutesAgo: mins,
  taps = 1,
}) {
  if (!requestType) return;
  const createdAt = minutesAgo(mins);

  const { data: request, error } = await db
    .from("requests")
    .insert({
      venue_id: venueId,
      session_id: session,
      table_id: table,
      tag_id: tagId,
      request_type_id: requestType.id,
      state: "open",
      created_at: createdAt,
    })
    .select("id")
    .single();
  if (error || !request) fail("creating request", error);

  // Tap log — what drives the repeat-ask escalation on the floor.
  const tapRows = [];
  for (let n = 1; n <= taps; n += 1) {
    const secondsSinceFirst = n === 1 ? 0 : (n - 1) * 120;
    tapRows.push({
      venue_id: venueId,
      session_id: session,
      table_id: table,
      request_type_id: requestType.id,
      request_id: request.id,
      tag_id: tagId,
      tap_number: n,
      seconds_since_first: secondsSinceFirst,
      created_at: new Date(
        new Date(createdAt).getTime() + secondsSinceFirst * 1000
      ).toISOString(),
    });
  }
  const { error: tapsError } = await db.from("request_taps").insert(tapRows);
  if (tapsError) console.warn("  ! request taps:", tapsError.message);

  if (requestType.closes_session) {
    await db
      .from("sessions")
      .update({ state: "closing", bill_requested_at: new Date().toISOString() })
      .eq("id", session)
      .eq("state", "open");
  }
}

/** Order a couple of real menu items through the same RPC the guest
 *  page uses, so tickets land on the kitchen/bar boards. */
async function placeOrder(venueId, session, table, tagId, wantedNames) {
  const { data: items, error } = await db
    .from("menu_items")
    .select("id, name, price_cents, category_id, menu_categories:category_id ( station )")
    .eq("venue_id", venueId)
    .eq("active", true);
  if (error) fail("reading menu for order", error);

  const chosen = [];
  for (const wanted of wantedNames) {
    const match = (items ?? []).find((i) => (i.name?.en ?? "") === wanted.en);
    if (match) chosen.push({ item: match, quantity: wanted.quantity ?? 1 });
  }
  if (chosen.length === 0) return;

  const byStation = new Map();
  for (const { item, quantity } of chosen) {
    const station = item.menu_categories?.station ?? "kitchen";
    const list = byStation.get(station) ?? [];
    list.push({
      menu_item_id: item.id,
      name: item.name,
      unit_price_cents: item.price_cents,
      options: [],
      quantity,
      line_total_cents: item.price_cents * quantity,
    });
    byStation.set(station, list);
  }

  const tickets = Array.from(byStation.entries()).map(([station, list]) => ({
    station,
    items: list,
  }));

  const { error: orderError } = await db.rpc("guest_place_order", {
    p_venue_id: venueId,
    p_session_id: session,
    p_table_id: table,
    p_tag_id: tagId,
    p_note: null,
    p_service_pct: 0,
    p_tickets: tickets,
  });
  if (orderError) console.warn("  ! placing order:", orderError.message);
}

async function stageLiveData(venueId, spec) {
  await clearLiveData(venueId);

  const used = new Set();
  const occupy = async (label, opts) => {
    const table = await tableByLabel(venueId, label, used);
    const tagId = await tagForTable(table.id);
    const session = await openSession(venueId, table.id, opts);
    return { table, tagId, session };
  };

  if (spec.key === "restaurant") {
    // A quiet green table with guests just seated.
    await occupy("1", { minutesOpen: 8, guests: 2 });

    // A fresh food order — kitchen and bar tickets on the boards.
    const t3 = await occupy("3", { minutesOpen: 24, guests: 4 });
    await placeOrder(venueId, t3.session, t3.table.id, t3.tagId, [
      { en: "Garlic prawns" },
      { en: "Grilled sea bass" },
      { en: "House red / white", quantity: 2 },
    ]);

    // Waiting ~6 minutes (amber on the floor).
    const t5 = await occupy("5", { minutesOpen: 40, guests: 2 });
    const drinks = await pickRequestType(venueId, ["drinks", "call_waiter", "waiter"]);
    await createRequest(venueId, t5.session, t5.table.id, t5.tagId, drinks, {
      minutesAgo: 6,
    });

    // Asked twice, 12 minutes — escalated red table for the manager.
    const t7 = await occupy("7", { minutesOpen: 55, guests: 3 });
    const again = await pickRequestType(venueId, ["call_waiter", "waiter", "drinks"]);
    await createRequest(venueId, t7.session, t7.table.id, t7.tagId, again, {
      minutesAgo: 12,
      taps: 2,
    });

    // Bill requested — session in its closing phase.
    const t9 = await occupy("9", { minutesOpen: 92, guests: 5 });
    const bill = await pickRequestType(venueId, ["bill", "bill_table"], { closes: true });
    await createRequest(venueId, t9.session, t9.table.id, t9.tagId, bill, {
      minutesAgo: 2,
    });
  }

  if (spec.key === "bar") {
    const t2 = await occupy("2", { minutesOpen: 35, guests: 3 });
    await placeOrder(venueId, t2.session, t2.table.id, t2.tagId, [
      { en: "Margarita", quantity: 2 },
      { en: "Nachos" },
    ]);

    const t5 = await occupy("5", { minutesOpen: 50, guests: 6 });
    const napkins = await pickRequestType(venueId, ["bar_napkins", "bar_clean_table"]);
    await createRequest(venueId, t5.session, t5.table.id, t5.tagId, napkins, {
      minutesAgo: 4,
    });

    const t7 = await occupy("7", { minutesOpen: 75, guests: 5 });
    const tab = await pickRequestType(venueId, ["bar_bill_bar", "bar_bill_table"], { closes: true });
    await createRequest(venueId, t7.session, t7.table.id, t7.tagId, tab, {
      minutesAgo: 1,
    });
  }

  if (spec.key === "hotel") {
    const r103 = await occupy("103", { minutesOpen: 60, guests: 2 });
    const towels = await pickRequestType(venueId, ["hotel_hk_towels", "hotel_hk_amenities"]);
    await createRequest(venueId, r103.session, r103.table.id, r103.tagId, towels, {
      minutesAgo: 4,
    });

    const r104 = await occupy("104", { minutesOpen: 20, guests: 1 });
    const taxi = await pickRequestType(venueId, ["hotel_taxi", "hotel_concierge"]);
    await createRequest(venueId, r104.session, r104.table.id, r104.tagId, taxi, {
      minutesAgo: 1,
    });

    const r205 = await occupy("205", { minutesOpen: 30, guests: 2 });
    await placeOrder(venueId, r205.session, r205.table.id, r205.tagId, [
      { en: "Club sandwich" },
      { en: "Fresh juice", quantity: 2 },
    ]);
  }

  console.log("  ↻ Live floor staged");
}

// ---------------------------------------------------------------- run

async function main() {
  console.log(`MyTableView demo seed → ${SUPABASE_URL}\n`);

  const owner = await ensureDemoOwner();
  const summary = [];

  for (const spec of VENUES) {
    console.log(`\n${spec.name}`);

    let venueId = await findOwnedVenue(owner.id, spec.name);
    if (!venueId) {
      const isFirst = !(await hasAnyMembership(owner.id));
      venueId = await createVenue(owner.id, spec.name, isFirst);
    } else {
      console.log("  = Venue exists");
    }

    await applyVenueSettings(venueId, spec);
    const zoneIds = await ensureZones(venueId, spec);
    await ensureTables(venueId, spec, zoneIds);
    await ensureTags(venueId, spec);
    await ensureMenu(venueId, spec);
    await ensureBarSharing(venueId, spec);
    await stageLiveData(venueId, spec);

    // A few guest links for the pitch.
    const { data: sampleTags } = await db
      .from("tags")
      .select("id, tables:table_id ( label )")
      .eq("venue_id", venueId)
      .eq("status", "active")
      .limit(3);
    summary.push({
      name: spec.name,
      tags: (sampleTags ?? []).map((t) => ({
        label: t.tables?.label ?? "?",
        url: `${BASE_URL}/t/${t.id}`,
      })),
    });
  }

  console.log("\n──────────────────────────────────────────────");
  console.log("Demo ready.\n");
  console.log(`Staff sign-in:  ${BASE_URL}/staff/sign-in`);
  console.log(`  Email:        ${DEMO_EMAIL}`);
  console.log(`  Password:     ${DEMO_PASSWORD}`);
  console.log("  (one login, three venues — switch in the top-left venue menu)\n");
  for (const venue of summary) {
    console.log(`${venue.name} — guest links (open on a phone):`);
    for (const tag of venue.tags) {
      console.log(`  ${tag.label.padEnd(4)} ${tag.url}`);
    }
  }
  console.log(
    "\nInvite colleagues from Staff → Settings → Team (owner login above),\n" +
      "or just share the demo login. Re-run this script before any\n" +
      "presentation to reset the live floor."
  );
}

main().catch((error) => fail("unexpected", error));
