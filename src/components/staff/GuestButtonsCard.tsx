"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrderingStrings } from "@/lib/i18n/ordering";
import { readStaffLocale } from "@/lib/i18n/staff";
import { pickLocale, type LocaleMap } from "@/lib/i18n/guest";

/**
 * Settings → Guest buttons. The venue's picker for everything a guest
 * can ask for: every built-in button with an on/off switch, the taxi
 * button's suggested pickup time, and — because no list can think of
 * everything — the venue's own custom buttons, written once and
 * machine-translated into the guest languages.
 *
 * On hotels the card also carries the Room service switch (a mirror of
 * the Ordering module toggle), so the whole guest experience is picked
 * in ONE place.
 */

export type GuestButtonRow = {
  id: string;
  code: string;
  label: LocaleMap;
  sublabel: LocaleMap;
  closesSession: boolean;
  active: boolean;
  etaMinutes: number | null;
};

type Props = {
  rows: GuestButtonRow[];
  defaultLocale: string;
  edition: string;
  isOwner: boolean;
  orderingActive: boolean;
};

export function GuestButtonsCard({
  rows,
  defaultLocale,
  edition,
  isOwner,
  orderingActive,
}: Props) {
  const router = useRouter();

  const [locale, setLocale] = useState("en");
  useEffect(() => {
    setLocale(readStaffLocale());
  }, []);
  const t = getOrderingStrings(locale);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // Optimistic switch state so the toggle answers the finger.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const [etaDraft, setEtaDraft] = useState<string | null>(null);
  const [etaState, setEtaState] = useState<"idle" | "saving" | "saved">("idle");

  const [addLabel, setAddLabel] = useState("");
  const [addSublabel, setAddSublabel] = useState("");
  const [adding, setAdding] = useState(false);

  const isOn = (row: GuestButtonRow) => overrides[row.id] ?? row.active;

  const post = async (payload: Record<string, unknown>): Promise<boolean> => {
    try {
      const response = await fetch("/api/staff/request-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      return Boolean(response.ok && result?.ok);
    } catch {
      return false;
    }
  };

  const toggle = async (row: GuestButtonRow) => {
    const next = !isOn(row);
    setBusy(row.id);
    setError(false);
    setOverrides((prev) => ({ ...prev, [row.id]: next }));
    const ok = await post({ id: row.id, active: next });
    if (!ok) {
      setOverrides((prev) => ({ ...prev, [row.id]: !next }));
      setError(true);
    } else {
      router.refresh();
    }
    setBusy(null);
  };

  // Room service (hotel): the same switch as the Ordering module —
  // one place to pick everything the guest can do.
  const [roomServiceOn, setRoomServiceOn] = useState(orderingActive);
  useEffect(() => setRoomServiceOn(orderingActive), [orderingActive]);

  const toggleRoomService = async () => {
    if (!isOwner) return;
    const next = !roomServiceOn;
    if (!next && !window.confirm(t.billing.confirmDeactivate)) {
      return;
    }
    setBusy("room-service");
    setError(false);
    setRoomServiceOn(next);
    try {
      const response = await fetch("/api/billing/ordering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: next }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (!response.ok || !payload?.ok) {
        setRoomServiceOn(!next);
        setError(true);
      } else {
        router.refresh();
      }
    } catch {
      setRoomServiceOn(!next);
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  const saveEta = async (row: GuestButtonRow) => {
    if (etaDraft === null) return;
    // An emptied field clears the suggested time.
    const trimmed = etaDraft.trim();
    let value: number | null = null;
    if (trimmed !== "") {
      value = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(value) || value < 1 || value > 180) {
        setError(true);
        return;
      }
    }
    setEtaState("saving");
    setError(false);
    const ok = await post({ id: row.id, etaMinutes: value });
    if (ok) {
      setEtaState("saved");
      router.refresh();
    } else {
      setEtaState("idle");
      setError(true);
    }
  };

  const addCustom = async () => {
    const label = addLabel.trim();
    if (label.length < 2) return;
    setAdding(true);
    setError(false);
    const ok = await post({
      create: { label, sublabel: addSublabel.trim() },
    });
    if (ok) {
      setAddLabel("");
      setAddSublabel("");
      router.refresh();
    } else {
      setError(true);
    }
    setAdding(false);
  };

  const removeCustom = async (row: GuestButtonRow) => {
    if (!window.confirm(t.guestButtons.deleteConfirm)) return;
    setBusy(row.id);
    setError(false);
    const ok = await post({ id: row.id, remove: true });
    if (ok) {
      router.refresh();
    } else {
      setError(true);
    }
    setBusy(null);
  };

  const customRows = rows.filter((row) => row.code.startsWith("custom_"));
  const builtIn = rows.filter((row) => !row.code.startsWith("custom_"));

  const groups: { key: string; title: string; rows: GuestButtonRow[] }[] = [
    {
      key: "housekeeping",
      title: t.guestButtons.housekeeping,
      rows: builtIn.filter((row) => row.code.startsWith("hotel_hk_")),
    },
    {
      key: "service",
      title: t.guestButtons.service,
      rows: builtIn.filter(
        (row) => !row.code.startsWith("hotel_hk_") && !row.closesSession
      ),
    },
    {
      key: "bill",
      title: t.guestButtons.bill,
      rows: builtIn.filter((row) => row.closesSession),
    },
  ].filter((group) => group.rows.length > 0);

  const isHotel = edition === "hotel";

  const renderSwitch = (row: GuestButtonRow) => (
    <button
      type="button"
      role="switch"
      aria-checked={isOn(row)}
      className="mtv-gb-switch"
      data-on={isOn(row) ? "true" : "false"}
      disabled={busy === row.id}
      onClick={() => void toggle(row)}
    >
      <span className="mtv-gb-knob" aria-hidden="true" />
    </button>
  );

  const renderText = (row: GuestButtonRow) => (
    <span className="mtv-gb-text">
      <b>{pickLocale(row.label, locale, defaultLocale) || row.code}</b>
      {pickLocale(row.sublabel, locale, defaultLocale) ? (
        <span>{pickLocale(row.sublabel, locale, defaultLocale)}</span>
      ) : null}
    </span>
  );

  return (
    <section className="mtv-settings-card">
      <h2>{t.guestButtons.title}</h2>
      <p className="mtv-settings-intro">{t.guestButtons.desc}</p>

      {isHotel ? (
        <div className="mtv-gb-group">
          <p className="mtv-gb-grouphead">{t.guestButtons.ordering}</p>
          <div className="mtv-gb-row">
            <span className="mtv-gb-text">
              <b>{t.guestButtons.roomService}</b>
              <span>{t.guestButtons.roomServiceSub}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={roomServiceOn}
              className="mtv-gb-switch"
              data-on={roomServiceOn ? "true" : "false"}
              disabled={busy === "room-service" || !isOwner}
              onClick={() => void toggleRoomService()}
            >
              <span className="mtv-gb-knob" aria-hidden="true" />
            </button>
          </div>
          {!isOwner ? (
            <p className="mtv-settings-help">{t.billing.onlyOwner}</p>
          ) : null}
        </div>
      ) : null}

      {groups.map((group) => (
        <div key={group.key} className="mtv-gb-group">
          <p className="mtv-gb-grouphead">{group.title}</p>
          {group.rows.map((row) => (
            <div key={row.id}>
              <div className="mtv-gb-row">
                {renderText(row)}
                {renderSwitch(row)}
              </div>
              {row.code === "hotel_taxi" && isOn(row) ? (
                <div className="mtv-gb-eta">
                  <span>{t.guestButtons.taxiEtaBefore}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={etaDraft ?? (row.etaMinutes === null ? "" : String(row.etaMinutes))}
                    onChange={(event) => {
                      setEtaDraft(event.target.value);
                      setEtaState("idle");
                    }}
                  />
                  <span>{t.guestButtons.taxiEtaAfter}</span>
                  <button
                    type="button"
                    className="mtv-btn mtv-btn-small"
                    disabled={etaState === "saving" || etaDraft === null}
                    onClick={() => void saveEta(row)}
                  >
                    {etaState === "saving"
                      ? t.billing.working
                      : etaState === "saved"
                        ? t.billing.saved
                        : t.billing.save}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ))}

      {/* Custom rows render for every edition — a hotel that switched
          back to restaurant must still be able to manage (or remove)
          the buttons it created. Only the add-form is hotel-scoped. */}
      {isHotel || customRows.length > 0 ? (
        <div className="mtv-gb-group">
          <p className="mtv-gb-grouphead">{t.guestButtons.custom}</p>
          {customRows.map((row) => (
            <div key={row.id} className="mtv-gb-row">
              {renderText(row)}
              {renderSwitch(row)}
              <button
                type="button"
                className="mtv-gb-del"
                aria-label={t.guestButtons.deleteConfirm}
                disabled={busy === row.id}
                onClick={() => void removeCustom(row)}
              >
                ×
              </button>
            </div>
          ))}
          {isHotel ? (
          <div className="mtv-gb-add">
            <p>{t.guestButtons.addPrompt}</p>
            <div className="mtv-gb-addline">
              <input
                type="text"
                maxLength={48}
                placeholder={t.guestButtons.addPlaceholder}
                value={addLabel}
                onChange={(event) => setAddLabel(event.target.value)}
              />
              <button
                type="button"
                className="mtv-btn mtv-btn-primary mtv-btn-small"
                disabled={adding || addLabel.trim().length < 2}
                onClick={() => void addCustom()}
              >
                {adding ? t.billing.working : t.guestButtons.addBtn}
              </button>
            </div>
            <div className="mtv-gb-addline">
              <input
                type="text"
                maxLength={64}
                placeholder={t.guestButtons.addSubPlaceholder}
                value={addSublabel}
                onChange={(event) => setAddSublabel(event.target.value)}
              />
            </div>
            <p className="mtv-settings-help">{t.guestButtons.addHint}</p>
          </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mtv-settings-status mtv-settings-status-error">
          {t.billing.error}
        </p>
      ) : null}
    </section>
  );
}
