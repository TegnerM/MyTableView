import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";
import {
  importRows,
  parseWorkbook,
  type ImportSummary,
} from "@/lib/staff/menu-import";
import { translateImportedItems } from "@/lib/menu/translate";

/**
 * POST /api/staff/menu/import — multipart, one or more .xlsx files in
 * the menu template format. Owner/manager only.
 *
 * Runs the whole import synchronously (parse → upsert → batched
 * translation) inside the serverless time ceiling; translation gets
 * whatever budget is left and reports if it ran out — the remainder
 * translates whenever those dishes are next saved.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 12;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const TRANSLATE_BUDGET_MS = 40_000;

export async function POST(request: Request) {
  const startedAt = Date.now();

  const resolved = await resolveStaff();
  if (!resolved) {
    return NextResponse.json({ ok: false, reason: "not_signed_in" }, { status: 401 });
  }
  const me = resolved.current;
  if (me.role !== "owner" && me.role !== "manager") {
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File)
    .slice(0, MAX_FILES);

  if (files.length === 0) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const summary: ImportSummary = {
    categoriesCreated: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    needsPrice: 0,
    skipped: [],
    touched: [],
  };

  const parsedFiles: { name: string; rows: ReturnType<typeof parseWorkbook> }[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      summary.skipped.push({ file: file.name, row: 0, reason: "file too large" });
      continue;
    }
    try {
      const buffer = await file.arrayBuffer();
      parsedFiles.push({
        name: file.name,
        rows: parseWorkbook(file.name, buffer, summary.skipped),
      });
    } catch (error) {
      console.error(
        "menu import: parse failed",
        file.name,
        error instanceof Error ? error.message : error
      );
      summary.skipped.push({ file: file.name, row: 0, reason: "unreadable file" });
    }
  }

  const service = getServiceClient();
  const { data: venue } = await service
    .from("venues")
    .select("default_locale")
    .eq("id", me.venueId)
    .maybeSingle<{ default_locale: string | null }>();

  const primaryLocale = venue?.default_locale ?? "en";

  try {
    await importRows(me.venueId, primaryLocale, parsedFiles, summary);
  } catch (error) {
    console.error(
      "menu import: failed",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  // Whatever time remains goes to translation.
  const deadline = startedAt + TRANSLATE_BUDGET_MS;
  const translation = await translateImportedItems(
    me.venueId,
    summary.touched,
    deadline
  );

  return NextResponse.json(
    {
      ok: true,
      categoriesCreated: summary.categoriesCreated,
      itemsCreated: summary.itemsCreated,
      itemsUpdated: summary.itemsUpdated,
      needsPrice: summary.needsPrice,
      skipped: summary.skipped.slice(0, 50),
      itemsTranslated: translation.itemsTranslated,
      translationTimedOut: translation.timedOut,
    },
    { status: 200 }
  );
}
