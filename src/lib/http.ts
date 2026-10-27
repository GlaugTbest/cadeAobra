import { NextRequest, NextResponse } from "next/server";
export function sameOrigin(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    throw Error("FORBIDDEN");
}
export async function boundedBody(req: Request, max: number) {
  const reader = req.body?.getReader();
  if (!reader) throw Error("Corpo vazio");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw Error("Arquivo ou requisição excede o tamanho permitido");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function apiError(e: unknown) {
  const m =
    e instanceof Error
      ? e.message
      : String((e as { message?: string })?.message ?? "Erro na operação");
  const status =
    m === "UNAUTHORIZED"
      ? 401
      : m === "FORBIDDEN"
        ? 403
        : m === "NOT_CONFIGURED"
          ? 503
          : 400;
  return NextResponse.json(
    {
      error:
        status === 401
          ? "Entre com sua conta de administrador."
          : status === 403
            ? "Acesso não autorizado."
            : status === 503
              ? "Integração administrativa ainda não configurada."
              : m.slice(0, 500),
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function text(v: unknown, max = 300, required = false) {
  const value = typeof v === "string" ? v.trim() : "";
  if (value.length > max || (required && !value))
    throw Error(
      "Preencha os campos obrigatórios e respeite os limites de tamanho.",
    );
  return value;
}
