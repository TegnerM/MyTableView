/**
 * Allergen + dietary flags for menu items.
 *
 * The 14 EU-mandated allergens (Regulation 1169/2011) plus the three
 * dietary flags restaurants actually get asked about. Codes are what
 * the database stores (menu_items.allergens text[]); names ship in the
 * app's 8 languages. Pure data — imported by guest and staff surfaces
 * alike, so nothing here may touch server-only APIs.
 */

export type AllergenCode =
  | "gluten" | "crustaceans" | "eggs" | "fish" | "peanuts" | "soy"
  | "milk" | "nuts" | "celery" | "mustard" | "sesame" | "sulphites"
  | "lupin" | "molluscs"
  | "vegetarian" | "vegan" | "spicy";

export type AllergenInfo = {
  code: AllergenCode;
  /** Single letter shown in the compact badge. */
  letter: string;
  /** Small pictogram (emoji keeps the guest page dependency-free). */
  emoji: string;
  /** true = a positive dietary flag (green), not a warning. */
  dietary: boolean;
  names: Record<string, string>;
};

export const ALLERGENS: AllergenInfo[] = [
  { code: "gluten", letter: "G", emoji: "🌾", dietary: false,
    names: { en: "Gluten", es: "Gluten", da: "Gluten", sv: "Gluten", no: "Gluten", de: "Gluten", nl: "Gluten", fr: "Gluten" } },
  { code: "crustaceans", letter: "C", emoji: "🦐", dietary: false,
    names: { en: "Crustaceans", es: "Crustáceos", da: "Krebsdyr", sv: "Kräftdjur", no: "Skalldyr", de: "Krebstiere", nl: "Schaaldieren", fr: "Crustacés" } },
  { code: "eggs", letter: "E", emoji: "🥚", dietary: false,
    names: { en: "Eggs", es: "Huevos", da: "Æg", sv: "Ägg", no: "Egg", de: "Eier", nl: "Eieren", fr: "Œufs" } },
  { code: "fish", letter: "F", emoji: "🐟", dietary: false,
    names: { en: "Fish", es: "Pescado", da: "Fisk", sv: "Fisk", no: "Fisk", de: "Fisch", nl: "Vis", fr: "Poisson" } },
  { code: "peanuts", letter: "P", emoji: "🥜", dietary: false,
    names: { en: "Peanuts", es: "Cacahuetes", da: "Jordnødder", sv: "Jordnötter", no: "Peanøtter", de: "Erdnüsse", nl: "Pinda's", fr: "Arachides" } },
  { code: "soy", letter: "S", emoji: "🫘", dietary: false,
    names: { en: "Soy", es: "Soja", da: "Soja", sv: "Soja", no: "Soya", de: "Soja", nl: "Soja", fr: "Soja" } },
  { code: "milk", letter: "M", emoji: "🥛", dietary: false,
    names: { en: "Milk", es: "Leche", da: "Mælk", sv: "Mjölk", no: "Melk", de: "Milch", nl: "Melk", fr: "Lait" } },
  { code: "nuts", letter: "N", emoji: "🌰", dietary: false,
    names: { en: "Tree nuts", es: "Frutos de cáscara", da: "Nødder", sv: "Nötter", no: "Nøtter", de: "Schalenfrüchte", nl: "Noten", fr: "Fruits à coque" } },
  { code: "celery", letter: "A", emoji: "🥬", dietary: false,
    names: { en: "Celery", es: "Apio", da: "Selleri", sv: "Selleri", no: "Selleri", de: "Sellerie", nl: "Selderij", fr: "Céleri" } },
  { code: "mustard", letter: "D", emoji: "🌭", dietary: false,
    names: { en: "Mustard", es: "Mostaza", da: "Sennep", sv: "Senap", no: "Sennep", de: "Senf", nl: "Mosterd", fr: "Moutarde" } },
  { code: "sesame", letter: "K", emoji: "🫓", dietary: false,
    names: { en: "Sesame", es: "Sésamo", da: "Sesam", sv: "Sesam", no: "Sesam", de: "Sesam", nl: "Sesam", fr: "Sésame" } },
  { code: "sulphites", letter: "U", emoji: "🍷", dietary: false,
    names: { en: "Sulphites", es: "Sulfitos", da: "Sulfitter", sv: "Sulfiter", no: "Sulfitter", de: "Sulfite", nl: "Sulfieten", fr: "Sulfites" } },
  { code: "lupin", letter: "L", emoji: "🌼", dietary: false,
    names: { en: "Lupin", es: "Altramuces", da: "Lupin", sv: "Lupin", no: "Lupin", de: "Lupinen", nl: "Lupine", fr: "Lupin" } },
  { code: "molluscs", letter: "O", emoji: "🐚", dietary: false,
    names: { en: "Molluscs", es: "Moluscos", da: "Bløddyr", sv: "Blötdjur", no: "Bløtdyr", de: "Weichtiere", nl: "Weekdieren", fr: "Mollusques" } },
  { code: "vegetarian", letter: "V", emoji: "🥗", dietary: true,
    names: { en: "Vegetarian", es: "Vegetariano", da: "Vegetarisk", sv: "Vegetariskt", no: "Vegetarisk", de: "Vegetarisch", nl: "Vegetarisch", fr: "Végétarien" } },
  { code: "vegan", letter: "V", emoji: "🌱", dietary: true,
    names: { en: "Vegan", es: "Vegano", da: "Vegansk", sv: "Veganskt", no: "Vegansk", de: "Vegan", nl: "Veganistisch", fr: "Végan" } },
  { code: "spicy", letter: "S", emoji: "🌶", dietary: true,
    names: { en: "Spicy", es: "Picante", da: "Stærk", sv: "Stark", no: "Sterk", de: "Scharf", nl: "Pittig", fr: "Épicé" } },
];

const BY_CODE = new Map(ALLERGENS.map((a) => [a.code, a]));

export function getAllergen(code: string): AllergenInfo | null {
  return BY_CODE.get(code as AllergenCode) ?? null;
}

export function isAllergenCode(value: unknown): value is AllergenCode {
  return typeof value === "string" && BY_CODE.has(value as AllergenCode);
}

export function allergenName(code: string, locale: string): string {
  const info = getAllergen(code);
  if (!info) {
    return code;
  }
  return info.names[locale] ?? info.names[locale.split("-")[0]] ?? info.names.en;
}
