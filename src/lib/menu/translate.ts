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

/**
 * Generic best-effort translation of one text into a set of locales —
 * used for owner-written guest-button labels and other short strings.
 * Returns only the translations that succeeded; empty without a key.
 */
export async function translateToLocales(
  text: string,
  sourceLocale: string,
  targetLocales: string[]
): Promise<Record<string, string>> {
  return translateText(text, sourceLocale, targetLocales);
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


/* ------------------------------------------------------------------ */
/* Batch translation for the spreadsheet importer.                     */
/* ------------------------------------------------------------------ */

/**
 * Translates a batch of texts into one target language with as few
 * DeepL calls as possible (up to 45 texts per request). Returns the
 * translations positionally; failures return an empty array.
 */
async function translateBatch(
  texts: string[],
  sourceLocale: string,
  targetLocale: string
): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY;
  const targetLang = DEEPL_LANG[targetLocale.split("-")[0]];
  const source = DEEPL_LANG[sourceLocale.split("-")[0]];
  if (!key || !targetLang || targetLang === source || texts.length === 0) {
    return [];
  }

  const out: string[] = [];

  for (let start = 0; start < texts.length; start += 45) {
    const chunk = texts.slice(start, start + 45);
    try {
      const response = await fetch(deeplEndpoint(key), {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: chunk,
          target_lang: targetLang,
          ...(source ? { source_lang: source } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error("translateBatch: deepl refused", response.status);
        return [];
      }

      const payload = (await response.json()) as {
        translations?: { text?: string }[];
      };
      for (const entry of payload.translations ?? []) {
        out.push(entry.text ?? "");
      }
    } catch (error) {
      console.error(
        "translateBatch: failed",
        error instanceof Error ? error.message : error
      );
      return [];
    }
  }

  return out.length === texts.length ? out : [];
}

export type ImportTranslationResult = {
  itemsTranslated: number;
  /** True when the time budget ran out before every language finished —
   *  the rest translates when those dishes are next saved. */
  timedOut: boolean;
};

/**
 * Translates freshly imported items into the venue's other guest
 * languages, batched, within a time budget (serverless functions have
 * a hard ceiling — a half-translated menu beats a dead request).
 * Respects the venue's auto-translate switch.
 */
export async function translateImportedItems(
  venueId: string,
  items: { id: string; name: string; description: string | null }[],
  deadlineAt: number
): Promise<ImportTranslationResult> {
  const none: ImportTranslationResult = { itemsTranslated: 0, timedOut: false };

  if (!process.env.DEEPL_API_KEY || items.length === 0) {
    return none;
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

    if (venue?.menu_auto_translate === false) {
      return none;
    }

    const primary = venue?.default_locale ?? "en";
    const targets = (venue?.locales ?? []).filter((code) => code !== primary);
    if (targets.length === 0) {
      return none;
    }

    const names = items.map((item) => item.name);
    const descriptions = items.map((item) => item.description ?? "");

    const nameMaps: Record<string, string>[] = items.map((item) => ({
      [primary]: item.name,
    }));
    const descriptionMaps: (Record<string, string> | null)[] = items.map(
      (item) => (item.description ? { [primary]: item.description } : null)
    );

    let timedOut = false;

    for (const target of targets) {
      if (Date.now() > deadlineAt) {
        timedOut = true;
        break;
      }

      const translatedNames = await translateBatch(names, primary, target);
      if (translatedNames.length === names.length) {
        translatedNames.forEach((value, index) => {
          if (value.trim() !== "") {
            nameMaps[index][target] = value;
          }
        });
      }

      if (Date.now() > deadlineAt) {
        timedOut = true;
        break;
      }

      // Only items that HAVE a description need one translated; empty
      // strings keep positions aligned and cost DeepL nothing.
      const translatedDescriptions = await translateBatch(
        descriptions,
        primary,
        target
      );
      if (translatedDescriptions.length === descriptions.length) {
        translatedDescriptions.forEach((value, index) => {
          const map = descriptionMaps[index];
          if (map && value.trim() !== "") {
            map[target] = value;
          }
        });
      }
    }

    let written = 0;
    for (let index = 0; index < items.length; index += 1) {
      const update: Record<string, unknown> = { name: nameMaps[index] };
      if (descriptionMaps[index]) {
        update.description = descriptionMaps[index];
      }

      const { error } = await service
        .from("menu_items")
        .update(update)
        .eq("id", items[index].id)
        .eq("venue_id", venueId);

      if (!error) {
        written += 1;
      }
    }

    return { itemsTranslated: written, timedOut };
  } catch (error) {
    console.error(
      "translateImportedItems: failed",
      error instanceof Error ? error.message : error
    );
    return none;
  }
}
