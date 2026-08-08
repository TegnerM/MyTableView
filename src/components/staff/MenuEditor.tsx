"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrderingStrings } from "@/lib/i18n/ordering";
import { readStaffLocale } from "@/lib/i18n/staff";
import { pickLocale, type LocaleMap } from "@/lib/i18n/guest";
import { ALLERGENS } from "@/lib/menu/allergens";
import {
  formatCents,
  photoUrl,
  STOCK_PHOTOS,
  type MenuCategory,
  type MenuItem,
  type Station,
  type VenueMenu,
} from "@/lib/menu/types";

/**
 * The menu editor — categories, dishes, options, allergens, photos.
 *
 * Editing is per-entity with explicit Save (a restaurant menu is not a
 * place for autosave surprises); availability is the exception — the
 * "sold out today" switch fires immediately because it's used
 * mid-service with a full pass and no free hands.
 */

type Props = {
  initialMenu: VenueMenu;
  /** The venue's published guest languages. */
  venueLocales: string[];
  /** The venue's main language — the field everyone always sees. */
  defaultLocale: string;
  /** true = the server machine-translates on save; false = the owner
   *  writes every language by hand (per-language fields appear). */
  autoTranslate: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "failed";

async function post(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  id?: string;
}> {
  try {
    const response = await fetch("/api/staff/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      id?: string;
    } | null;
    return { ok: Boolean(response.ok && data?.ok), id: data?.id };
  } catch {
    return { ok: false };
  }
}

export function MenuEditor({
  initialMenu,
  venueLocales,
  defaultLocale,
  autoTranslate,
}: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getOrderingStrings(locale);

  const primary = defaultLocale || venueLocales[0] || "en";
  const others = venueLocales.filter((code) => code !== primary);
  // With auto-translate ON the editor shows only the main language;
  // OFF surfaces one field per guest language for hand translation.
  const manualLocales = autoTranslate ? [] : others;

  const [toggleBusy, setToggleBusy] = useState(false);
  const setAutoTranslate = async (enabled: boolean) => {
    setToggleBusy(true);
    await post({ action: "auto_translate", enabled });
    setToggleBusy(false);
    router.refresh();
  };

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    initialMenu.categories[0]?.id ?? null
  );
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const activeCategory =
    initialMenu.categories.find((category) => category.id === activeCategoryId) ??
    initialMenu.categories[0] ??
    null;

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="mtv-menued">
      {others.length > 0 ? (
        <div className="mtv-menued-translate">
          <label className="mtv-menued-translate-switch">
            <input
              type="checkbox"
              checked={autoTranslate}
              disabled={toggleBusy}
              onChange={(event) => void setAutoTranslate(event.target.checked)}
            />
            <span>{t.editor.autoTranslate}</span>
          </label>
          <p className="mtv-menued-help">{t.editor.autoTranslateHint}</p>
        </div>
      ) : null}

      <div className="mtv-menued-cats" role="tablist">
        {initialMenu.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={activeCategory?.id === category.id}
            className="mtv-menued-cat-tab"
            data-active={activeCategory?.id === category.id ? "true" : "false"}
            onClick={() => {
              setActiveCategoryId(category.id);
              setAddingCategory(false);
              setAddingItem(false);
              setExpandedItemId(null);
            }}
          >
            {pickLocale(category.name, locale) || "—"}
            <span className="mtv-menued-cat-station">
              {category.station === "bar" ? t.editor.stationBar : t.editor.stationKitchen}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="mtv-menued-cat-add"
          onClick={() => setAddingCategory(true)}
        >
          {t.editor.addCategory}
        </button>
      </div>

      {addingCategory ? (
        <CategoryForm
          key="new-category"
          t={t}
          primary={primary}
          others={manualLocales}
          category={null}
          onDone={(newId) => {
            setAddingCategory(false);
            if (newId) {
              setActiveCategoryId(newId);
            }
            refresh();
          }}
          onCancel={() => setAddingCategory(false)}
        />
      ) : null}

      {initialMenu.categories.length === 0 && !addingCategory ? (
        <p className="mtv-menued-empty">{t.editor.emptyMenu}</p>
      ) : null}

      {activeCategory && !addingCategory ? (
        <section className="mtv-menued-panel">
          <CategoryForm
            key={activeCategory.id}
            t={t}
            primary={primary}
            others={manualLocales}
            category={activeCategory}
            onDone={() => refresh()}
            onCancel={null}
          />

          <div className="mtv-menued-items">
            {activeCategory.items.length === 0 && !addingItem ? (
              <p className="mtv-menued-empty">{t.editor.emptyCategory}</p>
            ) : null}

            {activeCategory.items.map((item) => (
              <ItemCard
                key={item.id}
                t={t}
                locale={locale}
                primary={primary}
                others={manualLocales}
                item={item}
                expanded={expandedItemId === item.id}
                onToggle={() =>
                  setExpandedItemId((prev) => (prev === item.id ? null : item.id))
                }
                onChanged={refresh}
              />
            ))}

            {addingItem ? (
              <ItemForm
                key={`new-item-${activeCategory.id}`}
                t={t}
                primary={primary}
                others={manualLocales}
                categoryId={activeCategory.id}
                item={null}
                onDone={() => {
                  setAddingItem(false);
                  refresh();
                }}
                onCancel={() => setAddingItem(false)}
              />
            ) : (
              <button
                type="button"
                className="mtv-btn mtv-menued-add-item"
                onClick={() => {
                  setAddingItem(true);
                  setExpandedItemId(null);
                }}
              >
                {t.editor.addItem}
              </button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------- category */

function CategoryForm({
  t,
  primary,
  others,
  category,
  onDone,
  onCancel,
}: {
  t: ReturnType<typeof getOrderingStrings>;
  primary: string;
  others: string[];
  category: MenuCategory | null;
  onDone: (newId?: string) => void;
  onCancel: (() => void) | null;
}) {
  const [name, setName] = useState<LocaleMap>(category?.name ?? {});
  const [station, setStation] = useState<Station>(category?.station ?? "kitchen");
  const [state, setState] = useState<SaveState>("idle");

  const save = async () => {
    setState("saving");
    const result = await post({
      action: "category_save",
      id: category?.id,
      name,
      station,
    });
    if (result.ok) {
      setState("saved");
      onDone(result.id);
    } else {
      setState("failed");
    }
  };

  const remove = async () => {
    if (!category) return;
    if (!window.confirm(t.editor.confirmDelete)) return;
    setState("saving");
    const result = await post({ action: "category_delete", id: category.id });
    if (result.ok) {
      onDone();
    } else {
      setState("failed");
    }
  };

  const moveCategory = async (direction: -1 | 1) => {
    if (!category) return;
    await post({ action: "category_move", id: category.id, direction });
    onDone();
  };

  return (
    <div className="mtv-menued-catform" data-new={category ? "false" : "true"}>
      <div className="mtv-menued-fields">
        <label className="mtv-menued-field">
          <span>{t.editor.categoryName}</span>
          <input
            type="text"
            maxLength={120}
            value={name[primary] ?? ""}
            placeholder={t.editor.newCategory}
            onChange={(event) =>
              setName((prev) => ({ ...prev, [primary]: event.target.value }))
            }
          />
        </label>

        <label className="mtv-menued-field mtv-menued-field-station">
          <span>{t.editor.station}</span>
          <select
            value={station}
            onChange={(event) => setStation(event.target.value as Station)}
          >
            <option value="kitchen">{t.editor.stationKitchen}</option>
            <option value="bar">{t.editor.stationBar}</option>
          </select>
        </label>
      </div>
      <p className="mtv-menued-help">{t.editor.stationHelp}</p>

      {others.length > 0 ? (
        <div className="mtv-menued-manual">
          <p className="mtv-menued-subhead">{t.editor.translations}</p>
          <div className="mtv-menued-fields">
            {others.map((code) => (
              <label key={code} className="mtv-menued-field">
                <span>
                  {t.editor.categoryName} <i>{code.toUpperCase()}</i>
                </span>
                <input
                  type="text"
                  maxLength={120}
                  value={name[code] ?? ""}
                  onChange={(event) =>
                    setName((prev) => ({ ...prev, [code]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mtv-menued-actions">
        <button
          type="button"
          className="mtv-btn mtv-btn-primary"
          disabled={state === "saving"}
          onClick={() => void save()}
        >
          {state === "saving" ? t.editor.saving : t.editor.save}
        </button>
        {onCancel ? (
          <button type="button" className="mtv-btn" onClick={onCancel}>
            {t.editor.cancel}
          </button>
        ) : null}
        {category ? (
          <>
            <button
              type="button"
              className="mtv-btn mtv-btn-small"
              onClick={() => void moveCategory(-1)}
              aria-label={t.editor.moveUp}
            >
              ↑
            </button>
            <button
              type="button"
              className="mtv-btn mtv-btn-small"
              onClick={() => void moveCategory(1)}
              aria-label={t.editor.moveDown}
            >
              ↓
            </button>
            <button
              type="button"
              className="mtv-btn mtv-btn-danger mtv-menued-right"
              onClick={() => void remove()}
            >
              {t.editor.delete}
            </button>
          </>
        ) : null}
      </div>
      {state === "failed" ? (
        <p className="mtv-menued-error">{t.editor.saveFailed}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ item */

function ItemCard({
  t,
  locale,
  primary,
  others,
  item,
  expanded,
  onToggle,
  onChanged,
}: {
  t: ReturnType<typeof getOrderingStrings>;
  locale: string;
  primary: string;
  others: string[];
  item: MenuItem;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [available, setAvailable] = useState(item.available);
  const photo = photoUrl(item.photo);

  // The 86 switch: instant, optimistic, and reverted on failure.
  const toggleAvailable = async () => {
    const next = !available;
    setAvailable(next);
    const result = await post({
      action: "item_availability",
      id: item.id,
      available: next,
    });
    if (!result.ok) {
      setAvailable(!next);
    } else {
      onChanged();
    }
  };

  return (
    <div className="mtv-menued-item" data-expanded={expanded ? "true" : "false"}>
      <div className="mtv-menued-item-row">
        <button type="button" className="mtv-menued-item-head" onClick={onToggle}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="mtv-menued-thumb" loading="lazy" />
          ) : (
            <span className="mtv-menued-thumb mtv-menued-thumb-empty" aria-hidden="true" />
          )}
          <span className="mtv-menued-item-name">
            {pickLocale(item.name, locale) || "—"}
          </span>
          <span className="mtv-menued-item-price">
            {formatCents(item.priceCents, locale)}
          </span>
        </button>

        <label className="mtv-menued-avail">
          <input
            type="checkbox"
            checked={available}
            onChange={() => void toggleAvailable()}
          />
          <span>{available ? t.editor.available : t.editor.soldOut}</span>
        </label>
      </div>

      {expanded ? (
        <ItemForm
          t={t}
          primary={primary}
          others={others}
          categoryId={item.categoryId}
          item={item}
          onDone={onChanged}
          onCancel={onToggle}
        />
      ) : null}
    </div>
  );
}

function ItemForm({
  t,
  primary,
  others,
  categoryId,
  item,
  onDone,
  onCancel,
}: {
  t: ReturnType<typeof getOrderingStrings>;
  primary: string;
  others: string[];
  categoryId: string;
  item: MenuItem | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState<LocaleMap>(item?.name ?? {});
  const [description, setDescription] = useState<LocaleMap>(item?.description ?? {});
  const [price, setPrice] = useState(
    item ? (item.priceCents / 100).toFixed(2) : ""
  );
  const [allergens, setAllergens] = useState<string[]>(item?.allergens ?? []);
  const [photo, setPhoto] = useState<string | null>(item?.photo ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [state, setState] = useState<SaveState>("idle");

  const priceCents = useMemo(() => {
    const value = Number.parseFloat(price.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    return Math.round(value * 100);
  }, [price]);

  const toggleAllergen = (code: string) => {
    setAllergens((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const save = async () => {
    if (priceCents === null) {
      setState("failed");
      return;
    }
    setState("saving");
    const result = await post({
      action: "item_save",
      id: item?.id,
      categoryId,
      name,
      description,
      priceCents,
      photo,
      allergens,
    });
    if (result.ok) {
      setState("saved");
      onDone();
    } else {
      setState("failed");
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!window.confirm(t.editor.confirmDelete)) return;
    const result = await post({ action: "item_delete", id: item.id });
    if (result.ok) {
      onDone();
    }
  };

  const moveItem = async (direction: -1 | 1) => {
    if (!item) return;
    await post({ action: "item_move", id: item.id, direction });
    onDone();
  };

  const currentPhotoUrl = photoUrl(photo);

  return (
    <div className="mtv-menued-itemform">
      <div className="mtv-menued-fields">
        <label className="mtv-menued-field">
          <span>{t.editor.itemName}</span>
          <input
            type="text"
            maxLength={120}
            value={name[primary] ?? ""}
            placeholder={t.editor.newItem}
            onChange={(event) =>
              setName((prev) => ({ ...prev, [primary]: event.target.value }))
            }
          />
        </label>
        <label className="mtv-menued-field mtv-menued-field-wide">
          <span>{t.editor.description}</span>
          <textarea
            rows={2}
            maxLength={400}
            value={description[primary] ?? ""}
            onChange={(event) =>
              setDescription((prev) => ({ ...prev, [primary]: event.target.value }))
            }
          />
        </label>
      </div>

      <div className="mtv-menued-fields">
        <label className="mtv-menued-field mtv-menued-field-price">
          <span>{t.editor.price}</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            placeholder="0.00"
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>

        <div className="mtv-menued-field mtv-menued-photo">
          <span>{t.editor.photoTitle}</span>
          <button
            type="button"
            className="mtv-menued-photo-btn"
            onClick={() => setPickerOpen(true)}
          >
            {currentPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentPhotoUrl} alt="" className="mtv-menued-thumb" />
            ) : (
              <span className="mtv-menued-thumb mtv-menued-thumb-empty" aria-hidden="true" />
            )}
            {t.editor.choosePhoto}
          </button>
        </div>
      </div>

      {others.length > 0 ? (
        <div className="mtv-menued-manual">
          <p className="mtv-menued-subhead">{t.editor.translations}</p>
          {others.map((code) => (
            <div key={code} className="mtv-menued-fields">
              <label className="mtv-menued-field">
                <span>
                  {t.editor.itemName} <i>{code.toUpperCase()}</i>
                </span>
                <input
                  type="text"
                  maxLength={120}
                  value={name[code] ?? ""}
                  onChange={(event) =>
                    setName((prev) => ({ ...prev, [code]: event.target.value }))
                  }
                />
              </label>
              <label className="mtv-menued-field mtv-menued-field-wide">
                <span>
                  {t.editor.description} <i>{code.toUpperCase()}</i>
                </span>
                <textarea
                  rows={2}
                  maxLength={400}
                  value={description[code] ?? ""}
                  onChange={(event) =>
                    setDescription((prev) => ({
                      ...prev,
                      [code]: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mtv-menued-subhead">{t.editor.allergensTitle}</p>
      <div className="mtv-menued-allergens">
        {ALLERGENS.map((allergen) => (
          <button
            key={allergen.code}
            type="button"
            className="mtv-menued-allergen"
            data-on={allergens.includes(allergen.code) ? "true" : "false"}
            data-dietary={allergen.dietary ? "true" : "false"}
            onClick={() => toggleAllergen(allergen.code)}
          >
            <span aria-hidden="true">{allergen.emoji}</span>{" "}
            {allergen.names[primary] ?? allergen.names.en}
          </button>
        ))}
      </div>

      {item ? (
        <OptionsEditor t={t} primary={primary} item={item} onChanged={onDone} />
      ) : null}

      <div className="mtv-menued-actions">
        <button
          type="button"
          className="mtv-btn mtv-btn-primary"
          disabled={state === "saving"}
          onClick={() => void save()}
        >
          {state === "saving" ? t.editor.saving : t.editor.save}
        </button>
        <button type="button" className="mtv-btn" onClick={onCancel}>
          {t.editor.close}
        </button>
        {item ? (
          <>
            <button
              type="button"
              className="mtv-btn mtv-btn-small"
              onClick={() => void moveItem(-1)}
              aria-label={t.editor.moveUp}
            >
              ↑
            </button>
            <button
              type="button"
              className="mtv-btn mtv-btn-small"
              onClick={() => void moveItem(1)}
              aria-label={t.editor.moveDown}
            >
              ↓
            </button>
            <button
              type="button"
              className="mtv-btn mtv-btn-danger mtv-menued-right"
              onClick={() => void remove()}
            >
              {t.editor.delete}
            </button>
          </>
        ) : null}
      </div>

      {state === "failed" ? (
        <p className="mtv-menued-error">{t.editor.saveFailed}</p>
      ) : null}

      {pickerOpen ? (
        <PhotoPicker
          t={t}
          onPick={(value) => {
            setPhoto(value);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- options */

function OptionsEditor({
  t,
  primary,
  item,
  onChanged,
}: {
  t: ReturnType<typeof getOrderingStrings>;
  primary: string;
  item: MenuItem;
  onChanged: () => void;
}) {
  const [draftName, setDraftName] = useState<LocaleMap>({});
  const [draftSurcharge, setDraftSurcharge] = useState("");
  const [busy, setBusy] = useState(false);

  const addOption = async () => {
    const value = Number.parseFloat(draftSurcharge.replace(",", "."));
    const surchargeCents =
      draftSurcharge.trim() === ""
        ? 0
        : Number.isFinite(value) && value >= 0
          ? Math.round(value * 100)
          : null;
    if (surchargeCents === null) {
      return;
    }
    setBusy(true);
    const result = await post({
      action: "option_save",
      itemId: item.id,
      name: draftName,
      surchargeCents,
    });
    setBusy(false);
    if (result.ok) {
      setDraftName({});
      setDraftSurcharge("");
      onChanged();
    }
  };

  const removeOption = async (optionId: string) => {
    setBusy(true);
    await post({ action: "option_delete", id: optionId });
    setBusy(false);
    onChanged();
  };

  return (
    <div className="mtv-menued-options">
      <p className="mtv-menued-subhead">{t.editor.optionsTitle}</p>
      <p className="mtv-menued-help">{t.editor.optionsHelp}</p>

      {item.options.map((option) => (
        <div key={option.id} className="mtv-menued-option-row">
          <span className="mtv-menued-option-name">
            {option.name[primary] ?? Object.values(option.name)[0] ?? "—"}
          </span>
          <span className="mtv-menued-option-price">
            {option.surchargeCents > 0
              ? `+${(option.surchargeCents / 100).toFixed(2)} €`
              : "—"}
          </span>
          <button
            type="button"
            className="mtv-btn mtv-btn-small"
            disabled={busy}
            onClick={() => void removeOption(option.id)}
          >
            ✕
          </button>
        </div>
      ))}

      <div className="mtv-menued-option-new">
        <input
          type="text"
          maxLength={120}
          value={draftName[primary] ?? ""}
          placeholder={t.editor.optionName}
          onChange={(event) =>
            setDraftName((prev) => ({ ...prev, [primary]: event.target.value }))
          }
        />
        <input
          type="text"
          inputMode="decimal"
          className="mtv-menued-option-surcharge"
          value={draftSurcharge}
          placeholder={t.editor.surcharge}
          onChange={(event) => setDraftSurcharge(event.target.value)}
        />
        <button
          type="button"
          className="mtv-btn mtv-btn-small"
          disabled={busy || Object.values(draftName).every((v) => !v?.trim())}
          onClick={() => void addOption()}
        >
          {t.editor.addOption}
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- photo picker */

function PhotoPicker({
  t,
  onPick,
  onClose,
}: {
  t: ReturnType<typeof getOrderingStrings>;
  onPick: (value: string | null) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"stock" | "upload">("stock");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(t.editor.uploadTooBig);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/staff/menu/photo", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
      } | null;
      if (response.ok && payload?.ok && payload.url) {
        onPick(payload.url);
        return;
      }
      setError(t.editor.uploadFailed);
    } catch {
      setError(t.editor.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mtv-menued-picker" role="dialog" aria-modal="true">
      <div className="mtv-menued-picker-card">
        <div className="mtv-menued-picker-head">
          <div className="mtv-menued-picker-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "stock"}
              data-active={tab === "stock" ? "true" : "false"}
              onClick={() => setTab("stock")}
            >
              {t.editor.stockTab}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "upload"}
              data-active={tab === "upload" ? "true" : "false"}
              onClick={() => setTab("upload")}
            >
              {t.editor.uploadTab}
            </button>
          </div>
          <button type="button" className="mtv-btn mtv-btn-small" onClick={onClose}>
            ✕
          </button>
        </div>

        {tab === "stock" ? (
          <div className="mtv-menued-stock-grid">
            <button
              type="button"
              className="mtv-menued-stock mtv-menued-stock-none"
              onClick={() => onPick(null)}
            >
              {t.editor.noPhoto}
            </button>
            {STOCK_PHOTOS.map((key) => (
              <button
                key={key}
                type="button"
                className="mtv-menued-stock"
                onClick={() => onPick(`stock:${key}`)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/menu-stock/${key}.svg`} alt={key} loading="lazy" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mtv-menued-upload">
            <p className="mtv-menued-help">{t.editor.uploadHint}</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void upload(file);
                }
              }}
            />
            {uploading ? <p>{t.editor.uploading}</p> : null}
            {error ? <p className="mtv-menued-error">{error}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
