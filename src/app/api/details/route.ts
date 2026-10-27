import { NextRequest, NextResponse } from "next/server";
import { queryPublic } from "@/lib/repository";
import { enrichWork } from "@/lib/official-details";
import type { Work } from "@/lib/domain";

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("obra") || "";
  if (!/^[\w.\-]{1,80}$/.test(id))
    return NextResponse.json(
      { error: "Identificador inválido" },
      { status: 400 },
    );
  try {
    const detail = (await queryPublic(new URLSearchParams({ obra: id }))) as {
      work: Work;
    } | null;
    if (!detail)
      return NextResponse.json(
        { error: "Obra não encontrada" },
        { status: 404 },
      );
    const work = await enrichWork(detail.work);
    const failed = Object.values(work.enrichment).some(
      (e) => e.state === "error",
    );
    return NextResponse.json(
      { enrichment: work.enrichment },
      {
        headers: {
          "Cache-Control": failed
            ? "public, s-maxage=60"
            : "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Não foi possível consultar a obra. Tente novamente." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
