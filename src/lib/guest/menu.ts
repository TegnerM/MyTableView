import { getServiceClient } from "@/lib/supabase/service";
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

  return { categories };
}
