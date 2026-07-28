/**
 * The floor and the layout editor share which zone is on screen, per
 * venue, per device. Without this the two pages could open on
 * different zones — add tables to the terrace in the editor, come back
 * to the floor showing inside, and the additions look lost.
 *
 * localStorage, guarded: private browsing modes throw on access.
 */

function key(venueId: string): string {
  return `mtv-zone:${venueId}`;
}

export function readStoredZone(venueId: string): string | null {
  try {
    return window.localStorage.getItem(key(venueId));
  } catch {
    return null;
  }
}

export function storeZone(venueId: string, zoneId: string): void {
  try {
    window.localStorage.setItem(key(venueId), zoneId);
  } catch {
    // Best effort only.
  }
}
