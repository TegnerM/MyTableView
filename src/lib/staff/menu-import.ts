import * as XLSX from "xlsx";
import { getServiceClient } from "@/lib/supabase/service";
import { ALLERGENS, type AllergenCode } from "@/lib/menu/allergens";
import type { Station } from "@/lib/menu/types";

/**
 * Menu import from the restaurant's spreadsheet templates.
 *
 * Expected sheet ("Template", or the first sheet): columns
 *   Dish Name | Category | Default Description | Allergens | Diet Tags
 *   | Restaurant Price | Active
 *
 * Idempotent on purpose: categories match by name, dishes match by
 * (category, name) — re-importing a corrected file UPDATES rows
 * instead of duplicating the menu. Rows the parser can't read are
 * skipped and reported with their row number; one bad row never sinks
 * the file.
 */

export type ImportSummary = {
  categoriesCreated: number;
  itemsCreated: number;
  itemsUpdated: number;
  /** Rows imported without a usable price → available=false at 0.00. */
  needsPrice: number;
  skipped: { file: string; row: number; reason: string }[];
  /** Item ids whose text changed — fed to the batch translator. */
  touched: { id: string; name: string; description: string | null }[];
};

type ParsedRow = {
  rowNumber: number;
  name: string;
  category: string;
  description: string | null;
  allergens: AllergenCode[];
  priceCents: number | null;
  active: boolean;
};

const HEADER_ALIASES: Record<string, string> = {
  "dish name": "name",
  name: "name",
  category: "category",
  "default description": "description",
  description: "description",
  allergens: "allergens",
  "diet tags": "diet",
  "dietary tags": "diet",
  "restaurant price": "price",
  price: "price",
  active: "active",
};

/** Category names that route to the bar station. */
const BAR_HINTS = [
  "drink", "drinks", "bebida", "bebidas", "bar", "cocktail", "cocktails",
  "cóctel", "cocteles", "wine", "wines", "vino", "vinos", "beer", "beers",
  "cerveza", "cervezas", "coffee", "café", "cafés", "juice", "juices",
  "zumo", "zumos", "spirits", "getränke", "boissons", "dranken",
];

/** Tolerant text → allergen/dietary code matching (EN + ES + codes). */
const ALLERGEN_ALIASES: Record<string, AllergenCode> = {
  gluten: "gluten", wheat: "gluten", trigo: "gluten", cereal: "gluten",
  crustaceans: "crustaceans", crustacean: "crustaceans", crustáceos: "crustaceans",
  shellfish: "crustaceans", marisco: "crustaceans", prawns: "crustaceans",
  shrimp: "crustaceans", gambas: "crustaceans",
  eggs: "eggs", egg: "eggs", huevo: "eggs", huevos: "eggs",
  fish: "fish", pescado: "fish",
  peanuts: "peanuts", peanut: "peanuts", cacahuete: "peanuts", cacahuetes: "peanuts",
  soy: "soy", soya: "soy", soja: "soy", soybeans: "soy",
  milk: "milk", dairy: "milk", leche: "milk", lactose: "milk", lácteos: "milk",
  nuts: "nuts", nut: "nuts", "tree nuts": "nuts", frutos: "nuts",
  "frutos secos": "nuts", almonds: "nuts", walnuts: "nuts",
  celery: "celery", apio: "celery",
  mustard: "mustard", mostaza: "mustard",
  sesame: "sesame", sésamo: "sesame", sesamo: "sesame",
  sulphites: "sulphites", sulfites: "sulphites", sulfitos: "sulphites",
  so2: "sulphites",
  lupin: "lupin", lupine: "lupin", altramuz: "lupin", altramuces: "lupin",
  molluscs: "molluscs", mollusc: "molluscs", mollusks: "molluscs",
  moluscos: "molluscs", squid: "molluscs", calamar: "molluscs",
  // dietary flags (Diet Tags column, but tolerated in Allergens too)
  vegetarian: "vegetarian", vegetariano: "vegetarian", veggie: "vegetarian",
  vegan: "vegan", vegano: "vegan", "plant-based": "vegan",
  spicy: "spicy", picante: "spicy", hot: "spicy",
};

const VALID_CODES = new Set(ALLERGENS.map((a) => a.code));

function parseAllergenList(...cells: (string | null)[]): AllergenCode[] {
  const found: AllergenCode[] = [];
  for (const cell of cells) {
    if (!cell) continue;
    for (const part of cell.split(/[,;/|]+/)) {
      const key = part.trim().toLowerCase();
      if (key === "") continue;
      const code =
        ALLERGEN_ALIASES[key] ??
        (VALID_CODES.has(key as AllergenCode) ? (key as AllergenCode) : null);
      if (code && !found.includes(code)) {
        found.push(code);
      }
    }
  }
  return found;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[€\s]/g, "").replace(",", ".");
    if (cleaned === "") return null;
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed * 100);
    }
  }
  return null;
}

function parseActive(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return !["no", "n", "false", "0", "inactive", "off"].includes(
      value.trim().toLowerCase()
    );
  }
  return true;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/** Parses one workbook into rows; unreadable rows land in `skipped`. */
export function parseWorkbook(
  fileName: string,
  buffer: ArrayBuffer,
  skipped: ImportSummary["skipped"]
): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames.includes("Template")
    ? "Template"
    : workbook.SheetNames[0];
  if (!sheetName) {
    skipped.push({ file: fileName, row: 0, reason: "no sheet" });
    return [];
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
  });

  const headerRow = grid[0] ?? [];
  const columns = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const key = HEADER_ALIASES[String(cell ?? "").trim().toLowerCase()];
    if (key && !columns.has(key)) {
      columns.set(key, index);
    }
  });

  if (!columns.has("name") || !columns.has("category")) {
    skipped.push({
      file: fileName,
      row: 1,
      reason: "missing 'Dish Name' / 'Category' header",
    });
    return [];
  }

  const rows: ParsedRow[] = [];

  grid.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2; // 1-based, after the header
    const get = (key: string) =>
      columns.has(key) ? (cells[columns.get(key)!] ?? null) : null;

    const name = text(get("name"));
    const category = text(get("category"));

    if (!name && !category) {
      return; // blank spacer row — not worth reporting
    }
    if (!name || !category) {
      skipped.push({ file: fileName, row: rowNumber, reason: "missing name or category" });
      return;
    }
    if (name.length > 120 || category.length > 120) {
      skipped.push({ file: fileName, row: rowNumber, reason: "name too long" });
      return;
    }

    rows.push({
      rowNumber,
      name,
      category,
      description: text(get("description"))?.slice(0, 400) ?? null,
      allergens: parseAllergenList(
        text(get("allergens")),
        text(get("diet"))
      ),
      priceCents: parsePrice(get("price")),
      active: parseActive(get("active")),
    });
  });

  return rows;
}

/**
 * Imports parsed rows into a venue's menu. Categories and items match
 * case-insensitively on the venue's primary-language name.
 */
export async function importRows(
  venueId: string,
  primaryLocale: string,
  files: { name: string; rows: ParsedRow[] }[],
  summary: ImportSummary
): Promise<void> {
  const service = getServiceClient();

  // Current menu, for matching.
  const [{ data: categories }, { data: items }] = await Promise.all([
    service
      .from("menu_categories")
      .select("id, name, sort_order")
      .eq("venue_id", venueId)
      .eq("active", true)
      .returns<{ id: string; name: Record<string, string>; sort_order: number }[]>(),
    service
      .from("menu_items")
      .select("id, category_id, name, sort_order")
      .eq("venue_id", venueId)
      .eq("active", true)
      .returns<
        { id: string; category_id: string; name: Record<string, string>; sort_order: number }[]
      >(),
  ]);

  const normalize = (value: string) => value.trim().toLowerCase();

  const categoryByName = new Map<string, { id: string }>();
  let maxCategorySort = 0;
  for (const category of categories ?? []) {
    const label = category.name?.[primaryLocale] ?? Object.values(category.name ?? {})[0];
    if (label) {
      categoryByName.set(normalize(label), { id: category.id });
    }
    maxCategorySort = Math.max(maxCategorySort, category.sort_order);
  }

  const itemKey = (categoryId: string, name: string) =>
    `${categoryId}|${normalize(name)}`;
  const itemByKey = new Map<string, string>();
  const maxItemSort = new Map<string, number>();
  for (const item of items ?? []) {
    const label = item.name?.[primaryLocale] ?? Object.values(item.name ?? {})[0];
    if (label) {
      itemByKey.set(itemKey(item.category_id, label), item.id);
    }
    maxItemSort.set(
      item.category_id,
      Math.max(maxItemSort.get(item.category_id) ?? 0, item.sort_order)
    );
  }

  for (const file of files) {
    for (const row of file.rows) {
      // ---- category: find or create -----------------------------------
      let category = categoryByName.get(normalize(row.category));
      if (!category) {
        const station: Station = BAR_HINTS.some((hint) =>
          normalize(row.category).includes(hint)
        )
          ? "bar"
          : "kitchen";

        maxCategorySort += 1;
        const { data: created, error } = await service
          .from("menu_categories")
          .insert({
            venue_id: venueId,
            name: { [primaryLocale]: row.category },
            station,
            sort_order: maxCategorySort,
          })
          .select("id")
          .single<{ id: string }>();

        if (error || !created) {
          summary.skipped.push({
            file: file.name,
            row: row.rowNumber,
            reason: "category create failed",
          });
          continue;
        }
        category = { id: created.id };
        categoryByName.set(normalize(row.category), category);
        summary.categoriesCreated += 1;
      }

      // ---- price: a blank price imports as sold-out at 0 --------------
      const priceCents = row.priceCents ?? 0;
      const available = row.priceCents === null ? false : row.active;
      if (row.priceCents === null) {
        summary.needsPrice += 1;
      }

      // ---- item: update or insert -------------------------------------
      const existingId = itemByKey.get(itemKey(category.id, row.name));

      if (existingId) {
        const { error } = await service
          .from("menu_items")
          .update({
            name: { [primaryLocale]: row.name },
            description: row.description
              ? { [primaryLocale]: row.description }
              : {},
            price_cents: priceCents,
            allergens: row.allergens,
            available,
          })
          .eq("id", existingId)
          .eq("venue_id", venueId);

        if (error) {
          summary.skipped.push({
            file: file.name,
            row: row.rowNumber,
            reason: "update failed",
          });
          continue;
        }
        summary.itemsUpdated += 1;
        summary.touched.push({
          id: existingId,
          name: row.name,
          description: row.description,
        });
      } else {
        const nextSort = (maxItemSort.get(category.id) ?? 0) + 1;
        maxItemSort.set(category.id, nextSort);

        const { data: created, error } = await service
          .from("menu_items")
          .insert({
            venue_id: venueId,
            category_id: category.id,
            name: { [primaryLocale]: row.name },
            description: row.description
              ? { [primaryLocale]: row.description }
              : {},
            price_cents: priceCents,
            allergens: row.allergens,
            available,
            sort_order: nextSort,
          })
          .select("id")
          .single<{ id: string }>();

        if (error || !created) {
          summary.skipped.push({
            file: file.name,
            row: row.rowNumber,
            reason: "insert failed",
          });
          continue;
        }
        itemByKey.set(itemKey(category.id, row.name), created.id);
        summary.itemsCreated += 1;
        summary.touched.push({
          id: created.id,
          name: row.name,
          description: row.description,
        });
      }
    }
  }
}
