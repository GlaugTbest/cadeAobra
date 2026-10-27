import { NextRequest, NextResponse } from "next/server";
import { queryPublic } from "@/lib/repository";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  for (const [key, value] of p)
    if (key.length > 30 || value.length > 200)
      return NextResponse.json({ error: "Consulta inválida" }, { status: 400 });
  try {
    const result = await queryPublic(p);
    if (!result)
      return NextResponse.json(
        { error: "Obra não encontrada" },
        { status: 404 },
      );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Não foi possível consultar os dados. Tente novamente." },
      { status: 503 },
    );
  }
}
