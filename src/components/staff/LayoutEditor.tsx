"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FloorPlan } from "@/components/staff/FloorPlan";
import { BrandMark } from "@/components/BrandMark";
import { pickLocale } from "@/lib/i18n/guest";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";
import { readStoredZone, storeZone } from "@/lib/staff/zone-memory";
import {
  DEFAULT_ESCALATION_SETTINGS,
  type FloorState,
  type FloorTable,
  type FloorZone,
} from "@/lib/staff/floor-types";

/**
 * Floor layout editor.
 *
 * Three columns, everything on one screen: palette left, canvas centre,
 * properties right. An earlier version put the selected-table controls
 * in a strip below the canvas, which meant scrolling away from the
 * table you were dragging in order to rotate it. Laying out forty
 * tables that way is miserable.
 *
 * Everything is deliberately small. This is a setup screen used before
 * service, on a desktop or tablet, not a handheld in a dark room — so
 * density beats large tap targets here, unlike the guest and waiter
 * surfaces.
 *
 * Light Mediterranean palette, matching the guest screen. The live
 * floor is dark for a reason that does not apply here: it runs during
 * evening service where a bright screen glares across a terrace.
 */

type Props = {
  initialState: FloorState;
  locale: string;
};

/** Whatever /api/staff/layout answers; fields beyond ok vary by action. */
type LayoutResponse = { ok: boolean } & Record<string, unknown>;

const PALETTE = [
  { seats: 2, shape: "round" },
  { seats: 2, shape: "square" },
  { seats: 4, shape: "round" },
  { seats: 4, shape: "square" },
  { seats: 6, shape: "round" },
  { seats: 6, shape: "square" },
  { seats: 8, shape: "square" },
  { seats: 10, shape: "square" },
] as const;

/**
 * The bulk-add templates. "square" covers rectangles too: the stored
 * footprint comes from the same seats-based defaults the single-add
 * palette uses, which widen with the seat count.
 */
const BULK_TEMPLATES = [
  { key: "sq2", seats: 2, shape: "square", label: "Square 2p" },
  { key: "sq4", seats: 4, shape: "square", label: "Square 4p" },
  { key: "sq6", seats: 6, shape: "square", label: "Rect 6p" },
  { key: "sq8", seats: 8, shape: "square", label: "Rect 8p" },
  { key: "rd4", seats: 4, shape: "round", label: "Round 4p" },
  { key: "rd6", seats: 6, shape: "round", label: "Round 6p" },
  { key: "rd8", seats: 8, shape: "round", label: "Round 8p" },
] as const;

export function LayoutEditor({ initialState, locale }: Props) {
  const router = useRouter();

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [staffLocale, setStaffLocale] = useState("en");
  useEffect(() => {
    setStaffLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(staffLocale, initialState.identity.edition);

  const [activeZoneId, setActiveZoneId] = useState<string | null>(
    () => initialState.areas[0]?.id ?? null
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle"
  );

  // Moves and rotations render immediately from local state; the server
  // catches up. Waiting for a round-trip makes dragging feel broken.
  const [positions, setPositions] = useState<
    Record<string, { xM: number; yM: number }>
  >({});
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [dimensions, setDimensions] = useState<
    Record<string, { widthM: number; depthM: number }>
  >({});

  // Adds and removes get the same treatment as moves: local state
  // renders immediately, the server confirms, and router.refresh()
  // reconciles page data in the background. Without this a removed
  // table sat on screen for the full server re-render — four
  // round-trips — which read as the button not working.
  const [addedTables, setAddedTables] = useState<FloorTable[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // Size inputs hold a string while being typed. Bound to a number,
  // Postgres numeric(6,2) arriving as "8.00" rendered as "08" and every
  // keystroke fired a save.
  const [sizeDraft, setSizeDraft] = useState<{
    zoneId: string;
    width: string;
    depth: string;
  } | null>(null);

  // Zones get the same optimistic treatment as tables: created and
  // removed zones render immediately, renames show as typed, and the
  // server refresh reconciles behind an already-correct picture.
  const [addedZones, setAddedZones] = useState<FloorZone[]>([]);
  const [removedZoneIds, setRemovedZoneIds] = useState<Set<string>>(new Set());
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({});
  const [zoneNameDraft, setZoneNameDraft] = useState<string | null>(null);

  // Per-template counts for the bulk add. Strings while typing.
  const [bulkCounts, setBulkCounts] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const zones = useMemo(() => {
    const known = new Set(initialState.areas.map((zone) => zone.id));
    return [...initialState.areas, ...addedZones.filter((z) => !known.has(z.id))]
      .filter((zone) => !removedZoneIds.has(zone.id))
      .map((zone) =>
        zoneNames[zone.id] !== undefined
          ? { ...zone, name: { ...zone.name, en: zoneNames[zone.id] } }
          : zone
      );
  }, [initialState.areas, addedZones, removedZoneIds, zoneNames]);

  // The floor page remembers the same zone (per venue, per device), so
  // jumping between the two never lands on a different room.
  useEffect(() => {
    const stored = readStoredZone(initialState.identity.venueId);
    if (stored && initialState.areas.some((zone) => zone.id === stored)) {
      setActiveZoneId(stored);
    }
    // Mount only — after that the user's clicks own the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectZone = useCallback(
    (zoneId: string) => {
      setActiveZoneId(zoneId);
      setSelected(null);
      setZoneNameDraft(null);
      storeZone(initialState.identity.venueId, zoneId);
    },
    [initialState.identity.venueId]
  );

  const activeZone = useMemo(() => {
    const zone = zones.find((z) => z.id === activeZoneId) ?? zones[0] ?? null;

    if (!zone) return null;

    const override = dimensions[zone.id];
    return override ? { ...zone, ...override } : zone;
  }, [zones, activeZoneId, dimensions]);

  const tables = useMemo(() => {
    if (!activeZone) return [];

    const isFirst = zones[0]?.id === activeZone.id;

    // Locally-added tables drop out again once a refresh has landed
    // them in initialState, so a table is never drawn twice.
    const known = new Set(initialState.tables.map((table) => table.id));
    const pendingAdds = addedTables.filter((table) => !known.has(table.id));

    return [...initialState.tables, ...pendingAdds]
      .filter((table) => !removedIds.has(table.id))
      .filter(
        (table) =>
          table.areaId === activeZone.id || (isFirst && table.areaId === null)
      )
      .map((table) => {
        const moved = positions[table.id];
        const turned = rotations[table.id];
        return {
          ...table,
          ...(moved ? { posX: moved.xM, posY: moved.yM } : {}),
          ...(turned !== undefined ? { rotation: turned } : {}),
        };
      });
  }, [
    initialState.tables,
    zones,
    activeZone,
    positions,
    rotations,
    addedTables,
    removedIds,
  ]);

  const post = useCallback(
    async (
      payload: Record<string, unknown>,
      refresh = false
    ): Promise<LayoutResponse | null> => {
      setStatus("saving");
      try {
        const response = await fetch("/api/staff/layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as LayoutResponse;
        setStatus(result.ok ? "saved" : "failed");
        if (result.ok && refresh) router.refresh();
        return result;
      } catch {
        setStatus("failed");
        return null;
      }
    },
    [router]
  );

  const saveMove = useCallback(
    (tableId: string, xM: number, yM: number) => {
      setPositions((prev) => ({ ...prev, [tableId]: { xM, yM } }));
      void post({ action: "move_table", tableId, posX: xM, posY: yM });
    },
    [post]
  );

  const saveRotation = useCallback(
    (tableId: string, degrees: number) => {
      const normalised = ((Math.round(degrees) % 360) + 360) % 360;
      setRotations((prev) => ({ ...prev, [tableId]: normalised }));
      // Refresh: the server re-clamps, because a rotated table needs
      // more clearance than an unrotated one and may now overlap a wall.
      void post({ action: "rotate_table", tableId, rotation: normalised }, true);
    },
    [post]
  );

  const saveZoneSize = useCallback(
    (zoneId: string, widthM: number, depthM: number) => {
      setDimensions((prev) => ({ ...prev, [zoneId]: { widthM, depthM } }));
      void post({ action: "zone_size", zoneId, widthM, depthM }, true);
    },
    [post]
  );

  const commitSize = useCallback(
    (zoneId: string) => {
      if (!sizeDraft || sizeDraft.zoneId !== zoneId) return;

      const width = Number(sizeDraft.width);
      const depth = Number(sizeDraft.depth);
      setSizeDraft(null);

      if (!Number.isFinite(width) || !Number.isFinite(depth)) return;
      if (width < 1 || depth < 1) return;

      saveZoneSize(zoneId, width, depth);
    },
    [sizeDraft, saveZoneSize]
  );

  const addTable = useCallback(
    (seats: number, shape: string, xM: number, yM: number) => {
      if (!activeZone) return;
      const zone = activeZone;

      void post({
        action: "add_table",
        zoneId: zone.id,
        seats,
        shape,
        posX: xM,
        posY: yM,
      }).then((result) => {
        if (!result?.ok) return;

        // One round-trip, not a full server re-render: the RPC returns
        // the stored row (label, footprint, clamped position), so the
        // table draws as soon as the insert confirms. The refresh then
        // reconciles page data behind an already-correct picture.
        if (
          typeof result.tableId === "string" &&
          typeof result.label === "string" &&
          typeof result.widthM === "number" &&
          typeof result.depthM === "number" &&
          typeof result.posX === "number" &&
          typeof result.posY === "number"
        ) {
          const added: FloorTable = {
            id: result.tableId,
            label: result.label,
            areaId: zone.id,
            areaName: zone.name,
            seats,
            posX: result.posX,
            posY: result.posY,
            shape,
            widthM: result.widthM,
            depthM: result.depthM,
            rotation: 0,
            sessionId: null,
            sessionOpenedAt: null,
            sessionState: null,
            guestCount: null,
            combinedWith: [],
            requests: [],
          };
          setAddedTables((prev) => [...prev, added]);
          // Select it immediately — the next thing after adding a table
          // is almost always turning or checking it.
          setSelected(added.id);
        }

        router.refresh();
      });
    },
    [activeZone, post, router]
  );

  const removeTable = useCallback(
    (tableId: string) => {
      setSelected(null);

      // Gone in the same frame; the server catches up.
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(tableId);
        return next;
      });

      // Deactivates rather than deletes: a table that has been in
      // service has visits and requests attached, and that history stays
      // valuable after the furniture goes.
      void post({ action: "remove_table", tableId }).then((result) => {
        if (result?.ok) {
          router.refresh();
        } else {
          // Server refused — put it back. The status strip already
          // shows "Not saved".
          setRemovedIds((prev) => {
            const next = new Set(prev);
            next.delete(tableId);
            return next;
          });
        }
      });
    },
    [post, router]
  );

  const addZone = useCallback(() => {
    const name = `Zone ${zones.length + 1}`;

    void post({
      action: "add_zone",
      name,
      widthM: 10,
      depthM: 8,
    }).then((result) => {
      if (
        !result?.ok ||
        typeof result.zoneId !== "string" ||
        typeof result.sortOrder !== "number" ||
        typeof result.widthM !== "number" ||
        typeof result.depthM !== "number"
      ) {
        return;
      }

      const zone: FloorZone = {
        id: result.zoneId,
        name: { en: name },
        sortOrder: result.sortOrder,
        widthM: result.widthM,
        depthM: result.depthM,
      };

      setAddedZones((prev) => [...prev, zone]);
      // Straight into the new room: name it in the panel, size it in
      // the bar, drop tables in.
      selectZone(zone.id);
      router.refresh();
    });
  }, [zones.length, post, selectZone, router]);

  const renameZone = useCallback(
    (zoneId: string, rawName: string) => {
      const name = rawName.trim();
      setZoneNameDraft(null);

      if (name.length < 1 || name.length > 40) return;

      setZoneNames((prev) => ({ ...prev, [zoneId]: name }));
      void post({ action: "rename_zone", zoneId, name }, true);
    },
    [post]
  );

  const removeZone = useCallback(
    (zoneId: string) => {
      // Client-side guard mirrors the server: a zone with tables in it
      // cannot be removed.
      setRemovedZoneIds((prev) => {
        const next = new Set(prev);
        next.add(zoneId);
        return next;
      });

      void post({ action: "remove_zone", zoneId }).then((result) => {
        if (result?.ok) {
          const remaining = zones.filter((z) => z.id !== zoneId);
          if (remaining[0]) selectZone(remaining[0].id);
          router.refresh();
        } else {
          setRemovedZoneIds((prev) => {
            const next = new Set(prev);
            next.delete(zoneId);
            return next;
          });
        }
      });
    },
    [post, zones, selectZone, router]
  );

  const addBulk = useCallback(() => {
    if (!activeZone || bulkBusy) return;
    const zone = activeZone;

    const items = BULK_TEMPLATES.map((template) => ({
      seats: template.seats,
      shape: template.shape,
      count: Math.max(0, Math.floor(Number(bulkCounts[template.key]) || 0)),
    })).filter((item) => item.count > 0);

    if (items.length === 0) return;

    setBulkBusy(true);

    void post({ action: "add_tables_bulk", zoneId: zone.id, items }).then(
      (result) => {
        setBulkBusy(false);

        if (!result?.ok || !Array.isArray(result.created)) return;

        const created = result.created as {
          tableId: string;
          label: string;
          seats: number;
          shape: string;
          widthM: number;
          depthM: number;
          posX: number;
          posY: number;
        }[];

        setAddedTables((prev) => [
          ...prev,
          ...created.map(
            (row): FloorTable => ({
              id: row.tableId,
              label: row.label,
              areaId: zone.id,
              areaName: zone.name,
              seats: row.seats,
              posX: row.posX,
              posY: row.posY,
              shape: row.shape,
              widthM: row.widthM,
              depthM: row.depthM,
              rotation: 0,
              sessionId: null,
              sessionOpenedAt: null,
              sessionState: null,
              guestCount: null,
              combinedWith: [],
              requests: [],
            })
          ),
        ]);
        setBulkCounts({});
        router.refresh();
      }
    );
  }, [activeZone, bulkBusy, bulkCounts, post, router]);

  const bulkTotal = BULK_TEMPLATES.reduce(
    (sum, template) =>
      sum + Math.max(0, Math.floor(Number(bulkCounts[template.key]) || 0)),
    0
  );

  const selectedTable = selected
    ? (tables.find((t) => t.id === selected) ?? null)
    : null;

  const zoneSizeValue = (field: "width" | "depth") => {
    if (!activeZone) return "";
    if (sizeDraft?.zoneId === activeZone.id) return sizeDraft[field];
    return trimNumber(field === "width" ? activeZone.widthM : activeZone.depthM);
  };

  const onSizeChange = (field: "width" | "depth", value: string) => {
    if (!activeZone) return;
    setSizeDraft({
      zoneId: activeZone.id,
      width:
        field === "width"
          ? value
          : (sizeDraft?.zoneId === activeZone.id
              ? sizeDraft.width
              : trimNumber(activeZone.widthM)),
      depth:
        field === "depth"
          ? value
          : (sizeDraft?.zoneId === activeZone.id
              ? sizeDraft.depth
              : trimNumber(activeZone.depthM)),
    });
  };

  return (
    <main className="mtv-layout">
      {/* One compact bar: title, zones, room size, status. Everything
          that used to occupy three stacked rows. */}
      <header className="mtv-bar">
        <div className="mtv-bar-title">
          <BrandMark className="mtv-bar-brand" />
          <h1>{t.layout.title}</h1>
          <span>{initialState.identity.venueName}</span>
        </div>

        <div className="mtv-bar-zones" role="tablist">
          {zones.map((zone, index) => (
            <button
              key={zone.id}
              type="button"
              role="tab"
              aria-selected={activeZone?.id === zone.id}
              className="mtv-zone-tab"
              data-active={activeZone?.id === zone.id ? "true" : "false"}
              onClick={() => selectZone(zone.id)}
            >
              {pickLocale(zone.name, locale) ||
                t.floor.zoneFallback.replace("{n}", String(index + 1))}
            </button>
          ))}
          <button
            type="button"
            className="mtv-zone-add"
            title={t.layout.addZoneTitle}
            onClick={addZone}
          >
            {t.layout.addZone}
          </button>
        </div>

        {activeZone ? (
          <div className="mtv-bar-size">
            <label>
              <span>{t.layout.widthShort}</span>
              <input
                type="number"
                min={1}
                max={200}
                step={0.5}
                value={zoneSizeValue("width")}
                onChange={(e) => onSizeChange("width", e.target.value)}
                onBlur={() => commitSize(activeZone.id)}
              />
            </label>
            <label>
              <span>{t.layout.depthShort}</span>
              <input
                type="number"
                min={1}
                max={200}
                step={0.5}
                value={zoneSizeValue("depth")}
                onChange={(e) => onSizeChange("depth", e.target.value)}
                onBlur={() => commitSize(activeZone.id)}
              />
            </label>
            <span className="mtv-unit">m</span>
          </div>
        ) : null}

        <div className="mtv-bar-end">
          <span className="mtv-status" data-state={status}>
            {status === "saving"
              ? t.layout.saving
              : status === "saved"
                ? t.layout.saved
                : status === "failed"
                  ? t.layout.notSaved
                  : ""}
          </span>
          {/* prefetch off: the prefetched floor payload predates the
              tables added in this editor and renders stale. */}
          <Link href="/staff/floor" prefetch={false} className="mtv-btn">
            {t.layout.backToFloor}
          </Link>
        </div>
      </header>

      {activeZone ? (
        <div className="mtv-grid">
          <aside className="mtv-col mtv-col-palette">
            <h2>{t.layout.addTable}</h2>
            <div className="mtv-palette-grid">
              {PALETTE.map((item) => (
                <div
                  key={`${item.seats}-${item.shape}`}
                  className="mtv-chip"
                  data-shape={item.shape}
                  draggable
                  title={t.layout.chipTitle
                    .replace("{seats}", String(item.seats))
                    .replace(
                      "{shape}",
                      item.shape === "round"
                        ? t.layout.shapeRound
                        : t.layout.shapeSquare
                    )}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(
                      "application/mtv-table",
                      JSON.stringify({ seats: item.seats, shape: item.shape })
                    );
                  }}
                >
                  <span className="mtv-chip-mark">{item.seats}</span>
                </div>
              ))}
            </div>
            <p className="mtv-note">{t.layout.dragNote}</p>

            <h2>{t.layout.addMany}</h2>
            <div className="mtv-bulk">
              {BULK_TEMPLATES.map((template) => (
                <label key={template.key} className="mtv-bulk-row">
                  <span
                    className="mtv-bulk-glyph"
                    data-shape={template.shape}
                    aria-hidden="true"
                  />
                  <span className="mtv-bulk-label">
                    {(template.shape === "round"
                      ? t.layout.bulkRound
                      : template.seats >= 6
                        ? t.layout.bulkRect
                        : t.layout.bulkSquare
                    ).replace("{seats}", String(template.seats))}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    inputMode="numeric"
                    placeholder="0"
                    className="mtv-bulk-count"
                    value={bulkCounts[template.key] ?? ""}
                    onChange={(event) =>
                      setBulkCounts((prev) => ({
                        ...prev,
                        [template.key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="mtv-btn mtv-btn-primary mtv-btn-block"
                disabled={bulkTotal < 1 || bulkBusy}
                onClick={addBulk}
              >
                {bulkBusy
                  ? t.layout.adding
                  : bulkTotal > 0
                    ? bulkTotal === 1
                      ? t.layout.addOneTable
                      : t.layout.addNTables.replace(
                          "{count}",
                          String(bulkTotal)
                        )
                    : t.layout.addTablesBtn}
              </button>
              <p className="mtv-note">{t.layout.bulkNote}</p>
            </div>

            {activeZone ? (
              <>
                <h2>{t.layout.thisZone}</h2>
                <div className="mtv-zone-box">
                  <label className="mtv-zone-name">
                    <span>{t.layout.zoneName}</span>
                    <input
                      type="text"
                      maxLength={40}
                      value={
                        zoneNameDraft ??
                        (pickLocale(activeZone.name, locale) || "")
                      }
                      onChange={(event) => setZoneNameDraft(event.target.value)}
                      onBlur={() => {
                        if (zoneNameDraft !== null) {
                          renameZone(activeZone.id, zoneNameDraft);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </label>
                  {tables.length === 0 ? (
                    <button
                      type="button"
                      className="mtv-btn mtv-btn-danger mtv-btn-block"
                      onClick={() => removeZone(activeZone.id)}
                      disabled={zones.length <= 1}
                    >
                      {t.layout.removeZone}
                    </button>
                  ) : (
                    <p className="mtv-note">{t.layout.zoneRemovableNote}</p>
                  )}
                </div>
              </>
            ) : null}
          </aside>

          <section className="mtv-col mtv-col-canvas">
            <FloorPlan
                edition={initialState.identity.edition}
              zone={{
                id: activeZone.id,
                widthM: activeZone.widthM,
                depthM: activeZone.depthM,
              }}
              tables={tables}
              now={Date.now()}
              settings={DEFAULT_ESCALATION_SETTINGS}
              editable
              showStatus={false}
              selectedTableId={selected}
              onSelectTable={(tableId) =>
                setSelected(tableId === selected ? null : tableId)
              }
              onMoveTable={saveMove}
              onDropNewTable={addTable}
            />
          </section>

          <aside className="mtv-col mtv-col-props">
            {selectedTable ? (
              <>
                <h2>{t.floor.tableN.replace("{label}", selectedTable.label)}</h2>

                <dl className="mtv-props">
                  <div>
                    <dt>{t.floor.seats}</dt>
                    <dd>{selectedTable.seats}</dd>
                  </div>
                  <div>
                    <dt>{t.layout.size}</dt>
                    <dd>
                      {trimNumber(selectedTable.widthM)} ×{" "}
                      {trimNumber(selectedTable.depthM)} m
                    </dd>
                  </div>
                  <div>
                    <dt>{t.layout.position}</dt>
                    <dd>
                      {selectedTable.posX.toFixed(2)},{" "}
                      {selectedTable.posY.toFixed(2)}
                    </dd>
                  </div>
                </dl>

                {/* Rotating a circle does nothing, so the control only
                    appears where it has an effect. */}
                {selectedTable.shape !== "round" ? (
                  <div className="mtv-rotate">
                    <div className="mtv-rotate-head">
                      <span>{t.layout.angle}</span>
                      <output>{selectedTable.rotation}°</output>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={359}
                      step={1}
                      value={selectedTable.rotation}
                      onChange={(event) =>
                        saveRotation(
                          selectedTable.id,
                          Number(event.target.value)
                        )
                      }
                    />

                    <div className="mtv-rotate-steps">
                      {[0, 45, 90, 135].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          className="mtv-btn mtv-btn-tiny"
                          data-active={
                            selectedTable.rotation === deg ? "true" : "false"
                          }
                          onClick={() => saveRotation(selectedTable.id, deg)}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="mtv-btn mtv-btn-danger mtv-btn-block"
                  onClick={() => removeTable(selectedTable.id)}
                >
                  {t.layout.removeTable}
                </button>
              </>
            ) : (
              <>
                <h2>{t.layout.nothingSelected}</h2>
                <p className="mtv-note">{t.layout.tapToEdit}</p>
              </>
            )}
          </aside>
        </div>
      ) : (
        <p className="mtv-note">{t.floor.noZones}</p>
      )}
    </main>
  );
}

/** Postgres numeric arrives as "8.00"; an input should show "8". */
function trimNumber(value: number): string {
  return String(Number(value));
}
