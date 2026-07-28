/**
 * Chair placement around a table footprint.
 *
 * Pure geometry, deliberately free of React so it can be unit-tested
 * and previewed outside the component. Everything is in METRES,
 * relative to the table centre; the renderer adds the table position
 * and applies the table's rotation, so chairs turn with their table.
 *
 * Chairs are drawn tucked slightly under the tabletop edge, the way
 * the waiter-view design draws them: close enough to read as belonging
 * to the table, far enough out to show the true clearance a seated
 * guest occupies.
 */

export type ChairPos = {
  /** Chair centre, metres right of the table centre. */
  cx: number;
  /** Chair centre, metres below the table centre. */
  cy: number;
  /** Degrees clockwise, so a chair back can face away from the table. */
  angle: number;
};

/** Chair square edge, metres. A dining chair is ~0.45 m across. */
export const CHAIR_SIZE_M = 0.42;

/**
 * How far beyond the table edge the chair CENTRE sits. With a 0.42 m
 * chair this tucks ~0.05 m of it under the tabletop.
 */
export const CHAIR_OFFSET_M = 0.16;

export function chairPositions(
  widthM: number,
  depthM: number,
  seats: number,
  shape: string
): ChairPos[] {
  if (!Number.isFinite(seats) || seats < 1) {
    return [];
  }

  const count = Math.floor(seats);

  if (shape === "round") {
    // Evenly around the rim, first chair at the top.
    const radius = Math.max(widthM, depthM) / 2 + CHAIR_OFFSET_M;
    return Array.from({ length: count }, (_, i) => {
      const angleRad = (i / count) * 2 * Math.PI - Math.PI / 2;
      return {
        cx: Math.cos(angleRad) * radius,
        cy: Math.sin(angleRad) * radius,
        angle: (angleRad * 180) / Math.PI + 90,
      };
    });
  }

  // Rectangular: how tables are actually laid. Chairs go on the LONG
  // sides in facing pairs — a four-top seats 2 and 2 opposite each
  // other, never one per side — and the short ends are only used once
  // the long sides are full. ~0.55 m of edge per seated guest.
  const SEAT_PITCH_M = 0.55;
  const alongWidth = widthM >= depthM;
  const longLen = alongWidth ? widthM : depthM;
  const shortLen = alongWidth ? depthM : widthM;

  const longCap = Math.max(1, Math.floor(longLen / SEAT_PITCH_M + 0.001));
  const endCap = Math.max(1, Math.floor(shortLen / SEAT_PITCH_M + 0.001));

  const onLongSides = Math.min(count, 2 * longCap);
  let longA = Math.ceil(onLongSides / 2);
  let longB = Math.floor(onLongSides / 2);

  let remaining = count - onLongSides;
  const onEnds = Math.min(remaining, 2 * endCap);
  const endA = Math.ceil(onEnds / 2);
  const endB = Math.floor(onEnds / 2);

  // A party bigger than the table: crowd the long sides rather than
  // dropping chairs.
  remaining -= onEnds;
  longA += Math.ceil(remaining / 2);
  longB += Math.floor(remaining / 2);

  const counts = alongWidth
    ? [longA, longB, endA, endB] // top, bottom, left, right
    : [endA, endB, longA, longB];

  const sides = [
    { edge: "top" as const, length: widthM },
    { edge: "bottom" as const, length: widthM },
    { edge: "left" as const, length: depthM },
    { edge: "right" as const, length: depthM },
  ];

  const chairs: ChairPos[] = [];

  sides.forEach((side, sideIndex) => {
    const n = counts[sideIndex];
    if (n === 0) return;

    const alongEdge = (slot: number) => ((slot + 0.5) / n - 0.5) * side.length;
    const offsetW = widthM / 2 + CHAIR_OFFSET_M;
    const offsetD = depthM / 2 + CHAIR_OFFSET_M;

    for (let slot = 0; slot < n; slot += 1) {
      const t = alongEdge(slot);
      if (side.edge === "top") {
        chairs.push({ cx: t, cy: -offsetD, angle: 0 });
      } else if (side.edge === "bottom") {
        chairs.push({ cx: t, cy: offsetD, angle: 180 });
      } else if (side.edge === "left") {
        chairs.push({ cx: -offsetW, cy: t, angle: 270 });
      } else {
        chairs.push({ cx: offsetW, cy: t, angle: 90 });
      }
    }
  });

  return chairs;
}
