import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
import { sameOrigin, boundedBody, apiError } from "@/lib/http";
import { validUpload } from "@/lib/domain";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const { db, user } = await requireAdmin();
    const bytes = await boundedBody(req, 5 * 1024 * 1024);
    if (!validUpload(bytes, req.headers.get("content-type") ?? ""))
      throw Error("Envie um PDF válido de até 5 MB.");
    const file_path = `${user.id}/${crypto.randomUUID()}.pdf`;
    const r = await db.storage
      .from("evidence")
      .upload(file_path, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (r.error) throw r.error;
    return NextResponse.json({ file_path });
  } catch (e) {
    return apiError(e);
  }
}
