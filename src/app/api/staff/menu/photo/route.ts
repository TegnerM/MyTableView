import { NextResponse } from "next/server";
import { resolveStaff } from "@/lib/staff/venue-context";
import { getServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/staff/menu/photo — multipart upload of a dish photo.
 *
 * Owner/manager only. The file lands in the public `menu-photos`
 * bucket under the venue's own folder; the response returns the public
 * URL the editor stores on the item. 5 MB cap, images only.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json({ ok: false, reason: "invalid_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, reason: "too_big" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${me.venueId}/${crypto.randomUUID()}.${extension}`;

  const service = getServiceClient();
  const { error } = await service.storage
    .from("menu-photos")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) {
    console.error("menu photo upload failed", error.message);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }

  const { data } = service.storage.from("menu-photos").getPublicUrl(path);

  return NextResponse.json({ ok: true, url: data.publicUrl }, { status: 200 });
}
