import { getServiceClient } from "@/lib/supabase/service";

/**
 * Automatic menu translation — the owner types in their own language,
 * the system fills in the venue's other guest languages.
 *
 * Uses DeepL when DEEPL_API_KEY is set (a free key translates 500k
 * characters/month — more menu than anyone rewrites). Without a key,
 * or when DeepL is down, nothing breaks: the guest page's fallback
 * shows the main language until translations exist. Best-effort by
 * design — a translation hiccup must never block a menu save.
 */

const DEEPL_LANG: Record<string, string> = {
  en: "EN",
  es: "ES",
  da: "DA",
  sv: "SV",
  no: "NB", // DeepL calls Norwegian Bokmål "NB"
  nb: "NB",
  de: "DE",
  nl: "NL",
  fr: "FR",
  it: "IT",
  pt: "PT-PT",
  pl: "PL",
  fi: "FI",
};

function deeplEndpoint(key: string): string {
  // Free keys end in ":fx" and live on the api-free host.
  return key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

/**
 * Translates `text` from `sourceLocale` into each target locale.
 * Returns only the translations that succeeded.
 */
async function translateText(
  text: string,
  sourceLocale: string,
  targetLocales: string[]
): Promise<Record<string, string>> {
  const key = process.env.DEEPL_API_KEY;
  if (!key || text.trim() === "") {
    return {};
  }

  const source = DEEPL_LANG[sourceLocale.split("-")[0]];
  const result: Record<string, string> = {};

  for (const target of targetLocales) {
    const targetLang = DEEPL_LANG[target.split("-")[0]];
    if (!targetLang || targetLang === source) {
      continue;
    }

    try {
      const response = await fetch(deeplEndpoint(key), {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: [text],
          target_lang: targetLang,
          ...(source ? { source_lang: source } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.error("translate: deepl refused", response.status);
        continue;
      }

      const payload = (await response.json()) as {
        translations?: { text?: string }[];
      };
      const translated = payload.translations?.[0]?.text;
      if (translated && translated.trim() !== "") {
        result[target] = translated;
      }
    } catch (error) {
      console.error(
        "translate: deepl failed",
        error instanceof Error ? error.message : error
      );
    }
  }

  return result;
}

type TranslatableField = "name" | "description";

/**
 * Fills the non-primary locales of a menu row's jsonb text fields from
 * the primary-language text the owner just saved. Overwrites earlier
 * machine translations on purpose: the owner edited the source, the
 * translations follow.
 */
export async function autoTranslateMenuRow(
  table: "menu_categories" | "menu_items" | "menu_item_options",
  rowId: string,
  venueId: string,
  fields: Partial<Record<TranslatableField, string>>
): Promise<void> {
  if (!process.env.DEEPL_API_KEY) {
    return;
  }

  try {
    const service = getServiceClient();

    const { data: venue } = await service
      .from("venues")
      .select("default_locale, locales, menu_auto_translate")
      .eq("id", venueId)
      .maybeSingle<{
        default_locale: string | null;
        locales: string[] | null;
        menu_auto_translate: boolean | null;
      }>();

    // The owner chose to translate by hand — never overwrite their work.
    if (venue?.menu_auto_translate === false) {
      return;
    }

    const primary = venue?.default_locale ?? "en";
    const targets = (venue?.locales ?? []).filter(
      (code) => code !== primary
    );

    if (targets.length === 0) {
      return;
    }

    const update: Record<string, Record<string, string>> = {};

    for (const [field, text] of Object.entries(fields)) {
      if (typeof text !== "string" || text.trim() === "") {
        continue;
      }
      const translations = await translateText(text, primary, targets);
      if (Object.keys(translations).length > 0) {
        update[field] = { [primary]: text, ...translations };
      }
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    const { error } = await service
      .from(table)
      .update(update)
      .eq("id", rowId)
      .eq("venue_id", venueId);

    if (error) {
      console.error("translate: row update failed", error.message);
    }
  } catch (error) {
    console.error(
      "translate: failed",
      error instanceof Error ? error.message : error
    );
  }
}
