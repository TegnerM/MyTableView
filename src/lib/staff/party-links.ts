/**
 * Connectors for combined parties on the floor plan.
 *
 * A combined party is drawn as one physical unit: a ring around each
 * member table and a bar linking them. The bars follow a minimum
 * spanning tree over the member centres, so a party of three gets two
 * bars joining nearest neighbours rather than a triangle — the group
 * reads as furniture pushed together, not as a diagram.
 *
 * Pure geometry, React-free, testable on its own like chair-layout.
 */

export type PartyPoint = { x: number; y: number };

/**
 * Minimum spanning tree over a handful of points (Prim's algorithm —
 * parties are tiny, so O(n²) per step is irrelevant). Returns index
 * pairs into the input array.
 */
export function mstEdges(points: PartyPoint[]): Array<[number, number]> {
  if (points.length < 2) {
    return [];
  }

  const inTree = new Set<number>([0]);
  const edges: Array<[number, number]> = [];

  while (inTree.size < points.length) {
    let best: [number, number] | null = null;
    let bestDistSq = Infinity;

    for (const from of inTree) {
      for (let to = 0; to < points.length; to += 1) {
        if (inTree.has(to)) continue;
        const dx = points[from].x - points[to].x;
        const dy = points[from].y - points[to].y;
        const distSq = dx * dx + dy * dy;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          best = [from, to];
        }
      }
    }

    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }

  return edges;
}
