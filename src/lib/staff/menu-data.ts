import { getServiceClient } from "@/lib/supabase/service";
import type {
  MenuCategory,
  MenuItem,
  MenuOption,
  Station,
  VenueMenu,
} from "@/lib/menu/types";

/**
 * The staff view of a venue's menu: every ACTIVE category (including
 * empty ones — the owner just created it and is about to fill it),
 * with active items and options.
 *
 * Service client — callers gate on owner/manager first (same pattern
 * as the tags list on Settings).
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
  also_on_bar?: boolean | null;
};

type OptionRow = {
  id: string;
  item_id: string;
  name: Record<string, string> | null;
  surcharge_cents: number;
  sort_order: number;
};

export async function loadStaffMenu(venueId: string): Promise<VenueMenu> {
  const supabase = getServiceClient();

  const [categoriesResult, itemsResult, optionsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name, station, sort_order")
      .eq("venue_id", venueId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .returns<CategoryRow[]>(),
    loadItemRows(venueId),
    supabase
      .from("menu_item_options")
      .select("id, item_id, name, surcharge_cents, sort_order")
      .eq("venue_id", venueId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .returns<OptionRow[]>(),
  ]);

  if (categoriesResult.error) {
    console.error("loadStaffMenu: categories failed", categoriesResult.error.message);
  }
  if (itemsResult.error) {
    console.error("loadStaffMenu: items failed", itemsResult.error.message);
  }
  if (optionsResult.error) {
    console.error("loadStaffMenu: options failed", optionsResult.error.message);
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
      alsoOnBar: Boolean(row.also_on_bar),
      options: optionsByItem.get(row.id) ?? [],
    });
    itemsByCategory.set(row.category_id, list);
  }

  const categories: MenuCategory[] = (categoriesResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? {},
    station: (row.station === "bar" ? "bar" : "kitchen") as Station,
    sortOrder: row.sort_order,
    items: itemsByCategory.get(row.id) ?? [],
  }));

  return { categories };
}

/** Item rows with the bar-share flag; retries without it on a
 *  pre-migration database so the editor never goes down. */
async function loadItemRows(venueId: string) {
  const supabase = getServiceClient();

  const withFlag = await supabase
    .from("menu_items")
    .select(
      "id, category_id, name, description, price_cents, photo, allergens, available, sort_order, also_on_bar"
    )
    .eq("venue_id", venueId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .returns<ItemRow[]>();

  if (withFlag.error && /also_on_bar/.test(withFlag.error.message)) {
    return supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price_cents, photo, allergens, available, sort_order"
      )
      .eq("venue_id", venueId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .returns<ItemRow[]>();
  }

  return withFlag;
}
