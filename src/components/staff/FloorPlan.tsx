"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getStaffStrings, readStaffLocale } from "@/lib/i18n/staff";
import {
  deriveTableStatus,
  formatElapsed,
  turnAllowanceMinutes,
  type EscalationSettings,
  type FloorTable,
  type TableStatus,
  type TurnSettings,
} from "@/lib/staff/floor-types";
import { CHAIR_SIZE_M, chairPositions } from "@/lib/staff/chair-layout";
import { mstEdges } from "@/lib/staff/party-links";

/** Ring clearance beyond the tabletop edge, metres. */
const PARTY_RING_OFFSET_M = 0.09;

/**
 * Top-down floor plan, drawn to scale.
 *
 * One renderer serves both surfaces. The waiter's live floor and the
 * manager's layout editor differ only in whether tables can be dragged
 * — sharing the component means a spacing or scaling bug gets fixed
 * once, and the editor always shows exactly what the floor will show.
 *
 * Everything is in METRES. A restaurant knows its terrace is 12 by 8;
 * nobody describes a dining room in centimetres. Pixels appear only at
 * the point of drawing, via a scale factor derived from the zone size
 * and the available width.
 *
 * Positions are the CENTRE of the table, so rotating a rectangle does
 * not shift it sideways.
 */

export const GRID_SNAP_M = 0.25;

export type ZoneDimensions = {
  id: string;
  widthM: number;
  depthM: number;
};

type Props = {
  zone: ZoneDimensions;
  tables: FloorTable[];
  now: number;
  settings: EscalationSettings;
  editable?: boolean;
  /**
   * Whether to colour tables by service state.
   *
   * The live floor wants it. The layout editor does not: a manager
   * arranging furniture has no use for knowing table 4 is waiting, and
   * a pulsing red table is a distraction from the job in hand.
   */
  showStatus?: boolean;
  /** Table-time allowances; when present, an overrunning timer is
      flagged on the table. */
  turns?: TurnSettings;
  /**
   * Marker mode: tables draw as compact readable circles at their real
   * positions instead of to-scale furniture. The live floor wants this
   * — during service the question is "who's waiting, how long", not
   * "how big is the table". The editor keeps furniture, because there
   * the question is whether it fits the room.
   */
  markers?: boolean;
  selectedTableId?: string | null;
  /** Tables picked for combining, highlighted differently from selection. */
  pickedTableIds?: string[];
  onSelectTable?: (tableId: string) => void;
  onMoveTable?: (tableId: string, xM: number, yM: number) => void;
  /**
   * A new table dropped from the palette. Coordinates are the drop
   * point in metres, already snapped and clamped.
   */
  onDropNewTable?: (seats: number, shape: string, xM: number, yM: number) => void;
};

type DragState = {
  tableId: string;
  pointerId: number;
  /** Offset from the table centre to where the pointer grabbed it. */
  offsetXM: number;
  offsetYM: number;
  xM: number;
  yM: number;
};

export function FloorPlan({
  zone,
  tables,
  now,
  settings,
  editable = false,
  showStatus = true,
  turns,
  markers = false,
  selectedTableId = null,
  pickedTableIds = [],
  onSelectTable,
  onMoveTable,
  onDropNewTable,
}: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // SSR renders English; the cookie (or browser language) takes over
  // after hydration — same pattern as StaffShell.
  const [staffLocale, setStaffLocale] = useState("en");
  useEffect(() => {
    setStaffLocale(readStaffLocale());
  }, []);
  const t = getStaffStrings(staffLocale);

  // Whether a pointer actually moved. A tap that never moves is a
  // selection; anything else is a drag, and must not also select.
  const movedRef = useRef(false);

  const picked = useMemo(() => new Set(pickedTableIds), [pickedTableIds]);

  const statuses = useMemo(() => {
    const map = new Map<string, TableStatus>();
    if (!showStatus) {
      return map;
    }
    for (const table of tables) {
      map.set(table.id, deriveTableStatus(table, now, settings));
    }
    return map;
  }, [tables, now, settings, showStatus]);

  // Combined parties, grouped by shared session. Only meaningful on
  // the live floor — the editor is furniture-only, so showStatus
  // doubles as the gate. A party with members in another zone still
  // rings its visible members; the bars just have nowhere to go.
  const parties = useMemo(() => {
    if (!showStatus) return [] as FloorTable[][];
    const bySession = new Map<string, FloorTable[]>();
    for (const table of tables) {
      if (table.sessionId && table.combinedWith.length > 0) {
        const members = bySession.get(table.sessionId) ?? [];
        members.push(table);
        bySession.set(table.sessionId, members);
      }
    }
    return Array.from(bySession.values());
  }, [tables, showStatus]);

  /** Pixels per metre, from the rendered stage width. */
  const metresToPixels = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) {
      return 40;
    }
    return stage.clientWidth / zone.widthM;
  }, [zone.widthM]);

  const pointerToMetres = useCallback(
    (event: ReactPointerEvent) => {
      const stage = stageRef.current;
      if (!stage) {
        return { xM: 0, yM: 0 };
      }
      const rect = stage.getBoundingClientRect();
      const scale = rect.width / zone.widthM;
      return {
        xM: (event.clientX - rect.left) / scale,
        yM: (event.clientY - rect.top) / scale,
      };
    },
    [zone.widthM]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent, table: FloorTable) => {
      // Stop the stage handler from clearing the selection this tap is
      // about to make. Learned the hard way on Store Intelligence: the
      // event bubbles to the stage, which deselects, so the selection
      // never survives the tap that made it.
      event.stopPropagation();

      movedRef.current = false;

      if (!editable) {
        onSelectTable?.(table.id);
        return;
      }

      const { xM, yM } = pointerToMetres(event);

      (event.target as Element).setPointerCapture?.(event.pointerId);

      setDrag({
        tableId: table.id,
        pointerId: event.pointerId,
        offsetXM: xM - table.posX,
        offsetYM: yM - table.posY,
        xM: table.posX,
        yM: table.posY,
      });
    },
    [editable, onSelectTable, pointerToMetres]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      movedRef.current = true;

      const table = tables.find((t) => t.id === drag.tableId);
      if (!table) {
        return;
      }

      const { xM, yM } = pointerToMetres(event);

      // A rotated rectangle occupies a larger axis-aligned box than
      // its own footprint. Clamping to the unrotated size would let a
      // table turned 30 degrees poke through a wall.
      const { halfW, halfD } = rotatedHalfExtent(
        table.widthM ?? 0.9,
        table.depthM ?? 0.9,
        table.rotation ?? 0
      );

      // Snap to the grid, then clamp so no part of the table leaves the
      // room. Clamping after snapping keeps tables flush to a wall
      // rather than a quarter-metre short of it.
      const snappedX =
        Math.round((xM - drag.offsetXM) / GRID_SNAP_M) * GRID_SNAP_M;
      const snappedY =
        Math.round((yM - drag.offsetYM) / GRID_SNAP_M) * GRID_SNAP_M;

      setDrag({
        ...drag,
        xM: clamp(snappedX, halfW, zone.widthM - halfW),
        yM: clamp(snappedY, halfD, zone.depthM - halfD),
      });
    },
    [drag, tables, pointerToMetres, zone.widthM, zone.depthM]
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }

      if (movedRef.current) {
        onMoveTable?.(drag.tableId, drag.xM, drag.yM);
      } else {
        onSelectTable?.(drag.tableId);
      }

      setDrag(null);
      movedRef.current = false;
    },
    [drag, onMoveTable, onSelectTable]
  );

  const scale = metresToPixels();

  // Marker size: bounded, not to scale. Bounded below so every table
  // is a readable tap target on a phone; bounded above so a banquet
  // table doesn't dominate the map. Free tables shrink and quieten so
  // occupied tables carry the picture.
  const markerDiameter = (table: FloorTable, occupied: boolean) => {
    const maxDim = Math.max(table.widthM ?? 0.9, table.depthM ?? 0.9);
    const base = maxDim * scale * 0.62;
    return occupied
      ? clamp(base, 38, 56)
      : clamp(base * 0.8, 28, 44);
  };

  return (
    <div className="mtv-plan-wrap">
      <div
        ref={stageRef}
        className="mtv-plan-stage"
        style={
          {
            aspectRatio: `${zone.widthM} / ${zone.depthM}`,
            // Exposed so a surface can cap the stage's height without
            // breaking the to-scale aspect (see floor.css).
            "--mtv-plan-aspect": zone.widthM / zone.depthM,
          } as React.CSSProperties
        }
        data-editable={editable ? "true" : "false"}
        onPointerMove={editable ? handlePointerMove : undefined}
        onPointerUp={editable ? handlePointerUp : undefined}
        onPointerCancel={editable ? handlePointerUp : undefined}
        onDragOver={
          editable && onDropNewTable
            ? (event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            : undefined
        }
        onDrop={
          editable && onDropNewTable
            ? (event) => {
                event.preventDefault();

                const raw = event.dataTransfer.getData("application/mtv-table");
                if (!raw) {
                  return;
                }

                let parsed: { seats?: number; shape?: string };
                try {
                  parsed = JSON.parse(raw) as { seats?: number; shape?: string };
                } catch {
                  return;
                }

                const seats = Number(parsed.seats);
                const shape = parsed.shape === "square" ? "square" : "round";

                if (!Number.isFinite(seats) || seats < 1) {
                  return;
                }

                const stage = stageRef.current;
                if (!stage) {
                  return;
                }

                const rect = stage.getBoundingClientRect();
                const scaleNow = rect.width / zone.widthM;
                const xM =
                  Math.round(
                    ((event.clientX - rect.left) / scaleNow) / GRID_SNAP_M
                  ) * GRID_SNAP_M;
                const yM =
                  Math.round(
                    ((event.clientY - rect.top) / scaleNow) / GRID_SNAP_M
                  ) * GRID_SNAP_M;

                onDropNewTable(
                  seats,
                  shape,
                  clamp(xM, 0, zone.widthM),
                  clamp(yM, 0, zone.depthM)
                );
              }
            : undefined
        }
      >
        <GridLines widthM={zone.widthM} depthM={zone.depthM} />

        {/* Combined parties draw as one physical unit: a ring around
            each member and a bar joining them, in a colour reserved
            for combining. Fill colour stays free to carry service
            status — a combined table still turns amber and red. */}
        {parties.length > 0 ? (
          <svg
            className="mtv-plan-links"
            viewBox={`0 0 ${zone.widthM} ${zone.depthM}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {parties.map((members) => {
              const centres = members.map((member) => ({
                x: drag?.tableId === member.id ? drag.xM : member.posX,
                y: drag?.tableId === member.id ? drag.yM : member.posY,
              }));

              return (
                <g key={members.map((m) => m.id).join("+")}>
                  {mstEdges(centres).map(([from, to], index) => (
                    <line
                      key={index}
                      className="mtv-party-link"
                      x1={centres[from].x}
                      y1={centres[from].y}
                      x2={centres[to].x}
                      y2={centres[to].y}
                    />
                  ))}

                  {members.map((member, index) => {
                    const w = member.widthM ?? 0.9;
                    const d = member.depthM ?? 0.9;
                    const x = centres[index].x;
                    const y = centres[index].y;

                    if (markers) {
                      return (
                        <circle
                          key={member.id}
                          className="mtv-party-ring"
                          cx={x}
                          cy={y}
                          r={markerDiameter(member, true) / 2 / scale + 0.06}
                        />
                      );
                    }

                    return member.shape === "round" ? (
                      <circle
                        key={member.id}
                        className="mtv-party-ring"
                        cx={x}
                        cy={y}
                        r={Math.max(w, d) / 2 + PARTY_RING_OFFSET_M}
                      />
                    ) : (
                      <rect
                        key={member.id}
                        className="mtv-party-ring"
                        x={x - w / 2 - PARTY_RING_OFFSET_M}
                        y={y - d / 2 - PARTY_RING_OFFSET_M}
                        width={w + PARTY_RING_OFFSET_M * 2}
                        height={d + PARTY_RING_OFFSET_M * 2}
                        rx={0.2}
                        transform={
                          member.rotation
                            ? `rotate(${member.rotation} ${x} ${y})`
                            : undefined
                        }
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        ) : null}

        {/* Chairs live under the tables, tucked beneath the tabletop
            edge, and show the true clearance a seated guest needs —
            the tabletop alone undersells how much room a table takes.
            Purely decorative: no pointer events, no hit-testing.
            Marker mode drops them entirely: on the live floor they are
            noise between the waiter and the overview. */}
        {markers ? null : (
        <svg
          className="mtv-plan-chairs"
          viewBox={`0 0 ${zone.widthM} ${zone.depthM}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {tables.map((table) => {
            const isDragging = drag?.tableId === table.id;
            const xM = isDragging ? drag.xM : table.posX;
            const yM = isDragging ? drag.yM : table.posY;
            const chairs = chairPositions(
              table.widthM ?? 0.9,
              table.depthM ?? 0.9,
              table.seats,
              table.shape
            );

            return (
              <g
                key={table.id}
                transform={
                  table.rotation
                    ? `rotate(${table.rotation} ${xM} ${yM})`
                    : undefined
                }
              >
                {chairs.map((chair, index) => (
                  <rect
                    key={index}
                    className="mtv-chair"
                    x={xM + chair.cx - CHAIR_SIZE_M / 2}
                    y={yM + chair.cy - CHAIR_SIZE_M / 2}
                    width={CHAIR_SIZE_M}
                    height={CHAIR_SIZE_M}
                    rx={CHAIR_SIZE_M * 0.3}
                    transform={`rotate(${chair.angle} ${xM + chair.cx} ${
                      yM + chair.cy
                    })`}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        )}

        {tables.map((table) => {
          const isDragging = drag?.tableId === table.id;
          const xM = isDragging ? drag.xM : table.posX;
          const yM = isDragging ? drag.yM : table.posY;

          const widthM = table.widthM ?? 0.9;
          const depthM = table.depthM ?? 0.9;
          const status = showStatus
            ? (statuses.get(table.id) ?? "clear")
            : "layout";

          if (markers) {
            const occupied = Boolean(table.sessionId);
            const dia = markerDiameter(table, occupied);

            return (
              <div
                key={table.id}
                className="mtv-plan-marker"
                data-status={status}
                data-selected={selectedTableId === table.id ? "true" : "false"}
                data-picked={picked.has(table.id) ? "true" : "false"}
                style={{
                  left: `${(xM / zone.widthM) * 100}%`,
                  top: `${(yM / zone.depthM) * 100}%`,
                  width: `${dia}px`,
                  height: `${dia}px`,
                }}
                onPointerDown={(event) => handlePointerDown(event, table)}
                role="button"
                tabIndex={0}
                aria-label={t.floor.tableN.replace("{label}", table.label)}
              >
                <span className="mtv-plan-number">{table.label}</span>

                {table.sessionOpenedAt ? (
                  <span
                    className="mtv-plan-time"
                    data-over={
                      turns &&
                      (now - new Date(table.sessionOpenedAt).getTime()) /
                        60000 >
                        turnAllowanceMinutes(table.guestCount, turns)
                        ? "true"
                        : "false"
                    }
                  >
                    {formatElapsed(table.sessionOpenedAt, now)}
                  </span>
                ) : null}

                {table.requests.length > 0 ? (
                  <span className="mtv-plan-badge">
                    {table.requests.length}
                  </span>
                ) : null}

                {table.combinedWith.length > 0 ? (
                  <span className="mtv-plan-combined">
                    +{table.combinedWith.length}
                  </span>
                ) : null}
              </div>
            );
          }

          // The element keeps its own width and height and is rotated
          // with a CSS transform about its centre. Swapping width and
          // depth only worked for right angles; free rotation needs the
          // real transform.
          const drawW = widthM;
          const drawD = depthM;

          // The table turns; its labels must not. A waiter reading the
          // floor upside-down numbers on every rotated table is exactly
          // the kind of friction this screen exists to remove.
          const counterRotate = table.rotation
            ? { transform: `rotate(${-table.rotation}deg)` }
            : undefined;

          return (
            <div
              key={table.id}
              className="mtv-plan-table"
              data-status={status}
              data-shape={table.shape}
              data-selected={selectedTableId === table.id ? "true" : "false"}
              data-picked={picked.has(table.id) ? "true" : "false"}
              data-dragging={isDragging ? "true" : "false"}
              style={{
                left: `${((xM - drawW / 2) / zone.widthM) * 100}%`,
                top: `${((yM - drawD / 2) / zone.depthM) * 100}%`,
                width: `${(drawW / zone.widthM) * 100}%`,
                height: `${(drawD / zone.depthM) * 100}%`,
                transform: table.rotation
                  ? `rotate(${table.rotation}deg)`
                  : undefined,
              }}
              onPointerDown={(event) => handlePointerDown(event, table)}
              role="button"
              tabIndex={0}
              aria-label={t.floor.tableN.replace("{label}", table.label)}
            >
              <span className="mtv-plan-number" style={counterRotate}>
                {table.label}
              </span>

              {!showStatus && drawW * scale > 56 ? (
                <span className="mtv-plan-seats" style={counterRotate}>
                  {t.floor.seatsShort.replace("{seats}", String(table.seats))}
                </span>
              ) : null}

              {showStatus && table.requests.length > 0 ? (
                <span className="mtv-plan-badge" style={counterRotate}>
                  {table.requests.length}
                </span>
              ) : null}

              {/* Below roughly 1.1m of drawn width the timer is
                  unreadable, so it drops out rather than turning into
                  smudge. Past the venue's table-time allowance it turns
                  into a pill the eye can't skip. */}
              {showStatus && table.sessionOpenedAt && drawW * scale > 64 ? (
                <span
                  className="mtv-plan-time"
                  data-over={
                    turns &&
                    (now - new Date(table.sessionOpenedAt).getTime()) / 60000 >
                      turnAllowanceMinutes(table.guestCount, turns)
                      ? "true"
                      : "false"
                  }
                >
                  {formatElapsed(table.sessionOpenedAt, now)}
                </span>
              ) : null}

              {showStatus && table.combinedWith.length > 0 ? (
                <span className="mtv-plan-combined" style={counterRotate}>
                  +{table.combinedWith.length}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="mtv-plan-scale">
        {zone.widthM.toFixed(1)} × {zone.depthM.toFixed(1)} m
      </p>
    </div>
  );
}

/**
 * One line per metre, heavier every five. Gives a sense of scale
 * without competing with the tables for attention.
 */
function GridLines({ widthM, depthM }: { widthM: number; depthM: number }) {
  const vertical = [];
  const horizontal = [];

  for (let x = 1; x < widthM; x += 1) {
    vertical.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={depthM}
        className={x % 5 === 0 ? "mtv-grid-major" : "mtv-grid-minor"}
      />
    );
  }

  for (let y = 1; y < depthM; y += 1) {
    horizontal.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={widthM}
        y2={y}
        className={y % 5 === 0 ? "mtv-grid-major" : "mtv-grid-minor"}
      />
    );
  }

  return (
    <svg
      className="mtv-plan-grid"
      viewBox={`0 0 ${widthM} ${depthM}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {vertical}
      {horizontal}
    </svg>
  );
}

/**
 * Half the axis-aligned bounding box of a rotated rectangle.
 *
 * A 2.4 x 0.9 m table turned 45 degrees needs roughly 2.3 m of clearance
 * in both directions, not 1.2 and 0.45. Used for clamping so no part of
 * a table ever leaves the room.
 */
export function rotatedHalfExtent(
  widthM: number,
  depthM: number,
  degrees: number
): { halfW: number; halfD: number } {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  return {
    halfW: (widthM * cos + depthM * sin) / 2,
    halfD: (widthM * sin + depthM * cos) / 2,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
