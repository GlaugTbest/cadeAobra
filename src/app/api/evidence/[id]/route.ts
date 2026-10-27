import { NextRequest, NextResponse } from "next/server";
import { publicDb } from "@/lib/supabase";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = publicDb();
  if (!db) return new NextResponse(null, { status: 404 });
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id))
    return new NextResponse(null, { status: 404 });
  const e = await db
    .from("evidence")
    .select("file_path,file_public")
    .eq("id", id)
    .eq("file_public", true)
    .maybeSingle();
  if (e.error || !e.data?.file_path)
    return new NextResponse(null, { status: 404 });
  const r = await db.storage
    .from("evidence")
    .createSignedUrl(e.data.file_path, 60, { download: true });
  if (r.error) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(r.data.signedUrl, {
    headers: { "Cache-Control": "no-store" },
  });
}
