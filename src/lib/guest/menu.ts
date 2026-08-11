import { getServiceClient } from "@/lib/supabase/service";
import { barShareSourceVenueIds } from "@/lib/menu/bar-share";
import type {
  MenuCategory,
  MenuItem,
  MenuOption,
  Station,
  VenueMenu,
} from "@/lib/menu/types";

/**
 * Loads a venue's guest-facing menu: active categories with their
 * active items and options, in the owner's order.
 *
 * Two different kinds of "not orderable", handled differently:
 *   - UNPRICED dishes (imported, price not set yet) are invisible to
 *     guests — a menu full of "sold out" placeholders looks broken.
 *   - 86'd dishes (owner flipped availability off mid-service) DO show
 *     as "sold out today" — a dish vanishing mid-browse is worse.
 *
 * Service-role read, same as the rest of the guest surface.
 */

type CategoryRow = {
  id: string;
  name: Record<string, string> | null;
  station: string;
  sort_order: number;
};

type ItemRow = {
  id: string;
  category_id: string;
  name: Record<string, string> | null;
  description: Record<string, string> | null;
  price_cents: number;
  photo: string | null;
  allergens: string[] | null;
  available: boolean;
  sort_order: number;
};

type OptionRow = {
  id: string;
  item_id: string;
  name: Record<string, string> | null;
  surcharge_cents: number;
  sort_order: number;
};

export async function loadGuestMenu(venueId: string): Promise<VenueMenu> {
  const supabase = getServiceClient();

  const [categoriesResult, itemsResult, optionsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, station, sort_order")
      .eq("venue_id", venueId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .returns<CategoryRow[]>(),
    supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price_cents, photo, allergens, available, sort_order"
      )
      .eq("venue_id", venueId)
      .eq("active", true)
      .gt("price_cents", 0)
      .order("sort_order", { ascending: true })
      .returns<ItemRow[]>(),
    supabase
      .from("menu_item_options")
      .select("id, item_id, name, surcharge_cents, sort_order")
      .eq("venue_id", venueId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .returns<OptionRow[]>(),
  ]);

  if (categoriesResult.error) {
    console.error("loadGuestMenu: categories failed", categoriesResult.error.message);
  }
  if (itemsResult.error) {
    console.error("loadGuestMenu: items failed", itemsResult.error.message);
  }
  if (optionsResult.error) {
    console.error("loadGuestMenu: options failed", optionsResult.error.message);
  }

  const optionsByItem = new Map<string, MenuOption[]>();
  for (const row of optionsResult.data ?? []) {
    const list = optionsByItem.get(row.item_id) ?? [];
    list.push({
      id: row.id,
      name: row.name ?? {},
      surchargeCents: row.surcharge_cents,
      sortOrder: row.sort_order,
    });
    optionsByItem.set(row.item_id, list);
  }

  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const row of itemsResult.data ?? []) {
    const list = itemsByCategory.get(row.category_id) ?? [];
    list.push({
      id: row.id,
      categoryId: row.category_id,
      name: row.name ?? {},
      description: row.description ?? {},
      priceCents: row.price_cents,
      photo: row.photo,
      allergens: row.allergens ?? [],
      available: row.available,
      sortOrder: row.sort_order,
      options: optionsByItem.get(row.id) ?? [],
    });
    itemsByCategory.set(row.category_id, list);
  }

  const categories: MenuCategory[] = (categoriesResult.data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name ?? {},
      station: (row.station || "kitchen") as Station,
      sortOrder: row.sort_order,
      items: itemsByCategory.get(row.id) ?? [],
    }))
    // Empty categories would render as a dead chip.
    .filter((category) => category.items.length > 0);

  // "Also on the bar menu": bar venues append the dishes a linked
  // full-menu venue has ticked for sharing. Best-effort — an error
  // (or a not-yet-migrated database) leaves the bar's own menu as-is.
  let shared: MenuCategory[] = [];
  try {
    shared = await loadSharedBarCategories(venueId, categories.length);
  } catch (error) {
    console.error("loadGuestMenu: bar share failed", error);
  }

  return { categories: [...categories, ...shared] };
}

type SharedItemRow = ItemRow & {
  venue_id: string;
  menu_categories: {
    id: string;
    name: Record<string, string> | null;
    station: string;
    sort_order: number;
    active: boolean;
  } | null;
};

/**
 * The dishes shared onto a bar's menu, grouped under their source
 * categories, appended after the bar's own categories. Empty for
 * non-bar venues and for accounts with nothing ticked.
 */
async function loadSharedBarCategories(
  barVenueId: string,
  baseSortOrder: number
): Promise<MenuCategory[]> {
  const sourceIds = await barShareSourceVenueIds(barVenueId);
  if (sourceIds.length === 0) {
    return [];
  }

  const supabase = getServiceClient();

  const { data: rows, error } = await supabase
    .from("menu_items")
    .select(
      "id, venue_id, category_id, name, description, price_cents, photo, allergens, available, sort_order, menu_categories:category_id ( id, name, station, sort_order, active )"
    )
    .in("venue_id", sourceIds)
    .eq("active", true)
    .eq("also_on_bar", true)
    .gt("price_cents", 0)
    .order("sort_order", { ascending: true })
    .returns<SharedItemRow[]>();

  if (error) {
    // Pre-migration database (no also_on_bar column yet): the guest
    // page must keep working — sharing simply stays off.
    console.error("loadSharedBarCategories: failed", error.message);
    return [];
  }

  const shared = (rows ?? []).filter((row) => row.menu_categories?.active);
  if (shared.length === 0) {
    return [];
  }

  // Options still apply to a shared dish (a burger keeps its extras).
  const optionsByItem = new Map<string, MenuOption[]>();
  const { data: options, error: optionsError } = await supabase
    .from("menu_item_options")
    .select("id, item_id, name, surcharge_cents, sort_order")
    .in(
      "item_id",
      shared.map((row) => row.id)
    )
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .returns<OptionRow[]>();

  if (optionsError) {
    console.error("loadSharedBarCategories: options failed", optionsError.message);
  }
  for (const row of options ?? []) {
    const list = optionsByItem.get(row.item_id) ?? [];
    list.push({
      id: row.id,
      name: row.name ?? {},
      surchargeCents: row.surcharge_cents,
      sortOrder: row.sort_order,
    });
    optionsByItem.set(row.item_id, list);
  }

  const byCategory = new Map<string, MenuCategory>();
  let next = 0;
  for (const row of shared) {
    const source = row.menu_categories!;
    let category = byCategory.get(source.id);
    if (!category) {
      category = {
        id: source.id,
        name: source.name ?? {},
        station: (source.station || "kitchen") as Station,
        sortOrder: baseSortOrder + next,
        items: [],
      };
      next += 1;
      byCategory.set(source.id, category);
    }
    category.items.push({
      id: row.id,
      categoryId: row.category_id,
      name: row.name ?? {},
      description: row.description ?? {},
      priceCents: row.price_cents,
      photo: row.photo,
      allergens: row.allergens ?? [],
      available: row.available,
      sortOrder: row.sort_order,
      options: optionsByItem.get(row.id) ?? [],
    });
  }

  return [...byCategory.values()];
}
