import { randomInt } from "node:crypto";

/**
 * Tag ID generation.
 *
 * Tag IDs are encoded into the NFC chip as part of the guest URL
 * (mytableview.com/t/<id>). They must be:
 *
 *   - unguessable, so nobody can enumerate tags and fire requests at
 *     tables they are not sitting at
 *   - URL-safe and lowercase, so the encoded URL is clean
 *   - free of ambiguous characters, so a support call reading an ID
 *     aloud does not turn 0 into O or 1 into l
 *
 * The alphabet below drops 0/o, 1/i/l and u (which can be misheard as
 * "you"), leaving 29 characters. At 10 characters that is ~4.2e14
 * combinations, so a brute-force attempt is not practical against a
 * rate-limited endpoint.
 */

export const TAG_ALPHABET = "23456789abcdefghjkmnpqrstvwxyz";
export const TAG_ID_LENGTH = 10;
export const TAG_ID_PATTERN = /^[a-z0-9]{10}$/;

export function generateTagId(): string {
  let id = "";
  for (let i = 0; i < TAG_ID_LENGTH; i += 1) {
    id += TAG_ALPHABET[randomInt(TAG_ALPHABET.length)];
  }
  return id;
}

/**
 * Generates a batch of unique IDs. Uniqueness is checked in-memory here;
 * the database primary key is the real guarantee.
 */
export function generateTagBatch(count: number): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("count must be a positive integer");
  }

  const ids = new Set<string>();

  // Collisions are vanishingly unlikely, but the loop makes it impossible
  // to emit a duplicate into a manufacturing run.
  let guard = 0;
  while (ids.size < count) {
    ids.add(generateTagId());
    guard += 1;
    if (guard > count * 10) {
      throw new Error("Unable to generate enough unique IDs");
    }
  }

  return Array.from(ids);
}

export type TagBatchRow = {
  /** Encoded into the chip. */
  url: string;
  /** The unguessable ID stored as tags.id. */
  tagId: string;
  /** Printed on the face so staff know which table it belongs to. */
  printedRef: string;
  /** Manufacturing batch label. */
  batch: string;
};

export type BuildBatchOptions = {
  count: number;
  batch: string;
  baseUrl?: string;
  /** First number printed on the face. Defaults to 1. */
  startRef?: number;
  /** Zero-padding for the printed reference. Defaults to 4 digits. */
  refPadding?: number;
};

/**
 * Builds a manufacturing batch.
 *
 * The printed reference and the encoded ID are deliberately different.
 * The printed number is a human label for placement and support; the
 * encoded ID is the secret. Knowing that a tag is labelled "0042" tells
 * an attacker nothing about its URL.
 */
export function buildTagBatch(options: BuildBatchOptions): TagBatchRow[] {
  const {
    count,
    batch,
    baseUrl = "https://mytableview.com/t",
    startRef = 1,
    refPadding = 4,
  } = options;

  const ids = generateTagBatch(count);
  const trimmedBase = baseUrl.replace(/\/+$/, "");

  return ids.map((tagId, index) => {
    const ref = String(startRef + index).padStart(refPadding, "0");
    return {
      url: `${trimmedBase}/${tagId}`,
      tagId,
      printedRef: ref,
      batch,
    };
  });
}

/** CSV for the GoToTags encoding service: what to write to each chip. */
export function toEncodingCsv(rows: TagBatchRow[]): string {
  const lines = ["url,printed_ref"];
  for (const row of rows) {
    lines.push(`${row.url},${row.printedRef}`);
  }
  return lines.join("\n");
}

/** SQL to seed the batch into the tags table as stock. */
export function toSeedSql(rows: TagBatchRow[]): string {
  const values = rows
    .map(
      (row) =>
        `  ('${row.tagId}', '${row.printedRef}', '${row.batch.replace(/'/g, "''")}', 'stock')`
    )
    .join(",\n");

  return [
    "insert into tags (id, printed_ref, batch, status) values",
    values + ";",
  ].join("\n");
}
