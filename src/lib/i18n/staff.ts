"use client";

/**
 * Staff app i18n — the same dictionary pattern as the landing page and
 * guest surface, applied to the staff side.
 *
 * The locale lives in the `mtv-staff-lang` cookie (1 year, per device):
 * server pages read it via cookies(), client components via
 * document.cookie. No cookie → the browser's language decides. The
 * picker sits in the staff sidebar next to the theme toggle.
 *
 * GROWTH RULE (the debt-never-again rule): every new staff string is
 * added HERE first, in all languages, and referenced — never written
 * inline in a component. The STAFF_EN type makes a missing translation
 * a compile error.
 */

export const STAFF_LANG_COOKIE = "mtv-staff-lang";

const EN = {
  shell: {
    overview: "Overview",
    layout: "Layout",
    insights: "Insights",
    settings: "Settings",
    venue: "Venue",
    addRestaurant: "+ Add restaurant",
    dayMode: "Day mode",
    nightMode: "Night mode",
    logOut: "Log out",
    language: "Language",
    roleOwner: "owner",
    roleManager: "manager",
    roleWaiter: "waiter",
  },
};

export type StaffStrings = typeof EN;

const DICTS: Record<string, StaffStrings> = {
  en: EN,
  es: {
    shell: {
      overview: "Vista general", layout: "Plano", insights: "Estadísticas",
      settings: "Ajustes", venue: "Local", addRestaurant: "+ Añadir restaurante",
      dayMode: "Modo día", nightMode: "Modo noche", logOut: "Cerrar sesión",
      language: "Idioma", roleOwner: "propietario", roleManager: "encargado", roleWaiter: "camarero",
    },
  },
  da: {
    shell: {
      overview: "Oversigt", layout: "Bordplan", insights: "Indsigt",
      settings: "Indstillinger", venue: "Sted", addRestaurant: "+ Tilføj restaurant",
      dayMode: "Dagtilstand", nightMode: "Nattilstand", logOut: "Log ud",
      language: "Sprog", roleOwner: "ejer", roleManager: "manager", roleWaiter: "tjener",
    },
  },
  sv: {
    shell: {
      overview: "Översikt", layout: "Bordskarta", insights: "Insikter",
      settings: "Inställningar", venue: "Ställe", addRestaurant: "+ Lägg till restaurang",
      dayMode: "Dagläge", nightMode: "Nattläge", logOut: "Logga ut",
      language: "Språk", roleOwner: "ägare", roleManager: "chef", roleWaiter: "servitör",
    },
  },
  no: {
    shell: {
      overview: "Oversikt", layout: "Bordkart", insights: "Innsikt",
      settings: "Innstillinger", venue: "Sted", addRestaurant: "+ Legg til restaurant",
      dayMode: "Dagmodus", nightMode: "Nattmodus", logOut: "Logg ut",
      language: "Språk", roleOwner: "eier", roleManager: "leder", roleWaiter: "servitør",
    },
  },
  de: {
    shell: {
      overview: "Übersicht", layout: "Tischplan", insights: "Auswertung",
      settings: "Einstellungen", venue: "Lokal", addRestaurant: "+ Restaurant hinzufügen",
      dayMode: "Tagmodus", nightMode: "Nachtmodus", logOut: "Abmelden",
      language: "Sprache", roleOwner: "Inhaber", roleManager: "Manager", roleWaiter: "Kellner",
    },
  },
  nl: {
    shell: {
      overview: "Overzicht", layout: "Plattegrond", insights: "Inzichten",
      settings: "Instellingen", venue: "Zaak", addRestaurant: "+ Restaurant toevoegen",
      dayMode: "Dagmodus", nightMode: "Nachtmodus", logOut: "Uitloggen",
      language: "Taal", roleOwner: "eigenaar", roleManager: "manager", roleWaiter: "ober",
    },
  },
  fr: {
    shell: {
      overview: "Vue d'ensemble", layout: "Plan de salle", insights: "Statistiques",
      settings: "Réglages", venue: "Établissement", addRestaurant: "+ Ajouter un restaurant",
      dayMode: "Mode jour", nightMode: "Mode nuit", logOut: "Se déconnecter",
      language: "Langue", roleOwner: "propriétaire", roleManager: "responsable", roleWaiter: "serveur",
    },
  },
};

export const STAFF_LOCALES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "da", label: "Dansk" },
  { code: "sv", label: "Svenska" },
  { code: "no", label: "Norsk" },
  { code: "de", label: "Deutsch" },
  { code: "nl", label: "Nederlands" },
  { code: "fr", label: "Français" },
];

export function getStaffStrings(locale: string): StaffStrings {
  if (DICTS[locale]) return DICTS[locale];
  const base = locale.split("-")[0];
  return DICTS[base] ?? EN;
}

/** Client side: cookie override, else the browser's language. */
export function readStaffLocale(): string {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${STAFF_LANG_COOKIE}=([a-z-]{2,10})`)
    );
    if (match && DICTS[match[1].split("-")[0]]) return match[1].split("-")[0];
    const nav = navigator.language?.split("-")[0];
    if (nav && DICTS[nav]) return nav;
  } catch {
    // SSR or blocked cookies: English.
  }
  return "en";
}

/** Client side: persist the picker's choice for a year. */
export function storeStaffLocale(locale: string): void {
  try {
    document.cookie = `${STAFF_LANG_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Best effort only.
  }
}

/** Server side: same resolution from a cookie value + Accept-Language. */
export function resolveStaffLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null
): string {
  if (cookieValue && DICTS[cookieValue.split("-")[0]]) {
    return cookieValue.split("-")[0];
  }
  for (const part of (acceptLanguage ?? "").split(",")) {
    const base = part.trim().split(";")[0].split("-")[0].toLowerCase();
    if (DICTS[base]) return base;
  }
  return "en";
}
