import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase";
import { apiError, sameOrigin, boundedBody, text } from "@/lib/http";
import { safeOfficialUrl, type Raw } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { db, user } = await requireAdmin();
    const [a, l, h, r] = await Promise.all([
      db
        .from("agents")
        .select("*")
        .eq("official", false)
        .order("name")
        .limit(500),
      db
        .from("manual_links")
        .select("*,evidence(*),agents(*)")
        .order("updated_at", { ascending: false })
        .limit(500),
      db.rpc("admin_history"),
      db.rpc("admin_sync_runs"),
    ]);
    for (const v of [a, l, h, r]) if (v.error) throw v.error;
    return NextResponse.json(
      {
        email: user.email,
        agents: a.data,
        links: l.data,
        history: h.data,
        runs: r.data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const { db, user } = await requireAdmin();
    const body: Raw = JSON.parse(
      new TextDecoder().decode(await boundedBody(req, 40000)),
    );
    const action = body.action;
    if (action === "agent") {
      const id = text(body.id, 100) || "manual-" + crypto.randomUUID(),
        name = text(body.name, 200, true),
        type = body.type;
      if (!["person", "organization"].includes(type))
        throw Error("Tipo de perfil inválido.");
      const identifier = text(body.identifier, 100);
      if (type === "person" && identifier.replace(/\D/g, "").length === 11)
        throw Error(
          "Não publique CPF. Use registro profissional ou institucional público.",
        );
      const row = {
        id,
        name,
        type,
        identifier: identifier || null,
        description: text(body.description, 2000),
        published: body.published === true,
        official: false,
      };
      const result = await db.from("agents").upsert(row).select().single();
      if (result.error) throw result.error;
      return NextResponse.json(result.data);
    }
    if (action === "evidence") {
      const url = text(body.url, 2000),
        file_path = text(body.file_path, 300);
      if (!url && !file_path)
        throw Error("Informe URL oficial ou documento PDF.");
      if (url && !safeOfficialUrl(url))
        throw Error("Use uma URL HTTPS de órgão oficial brasileiro.");
      if (
        file_path &&
        (!file_path.startsWith(user.id + "/") ||
          !/^[-a-f0-9/]+\.pdf$/.test(file_path))
      )
        throw Error("Arquivo inválido. Faça o upload nesta sessão.");
      const date = text(body.evidence_date, 10, true);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw Error("Data da evidência inválida.");
      const e = {
        title: text(body.title, 300, true),
        issuer: text(body.issuer, 300, true),
        url: url || null,
        file_path: file_path || null,
        excerpt: text(body.excerpt, 6000, true),
        evidence_date: date,
        is_public: body.is_public === true,
        file_public: body.file_public === true,
      };
      if (e.file_public && !e.is_public)
        throw Error("Publicação do arquivo requer evidência pública.");
      const result = await db.from("evidence").insert(e).select().single();
      if (result.error) throw result.error;
      return NextResponse.json(result.data);
    }
    if (action === "link") {
      const id = text(body.id, 100),
        work_id = text(body.work_id, 100, true),
        agent_id = text(body.agent_id, 100, true),
        role = text(body.role, 200, true),
        evidence_id = text(body.evidence_id, 100, true);
      const work = await db
        .from("works")
        .select("id")
        .eq("id", work_id)
        .limit(1);
      if (work.error || !work.data?.length)
        throw Error(
          "Obra não encontrada na base. Use o identificador completo.",
        );
      const period_start = text(body.period_start, 10) || null,
        period_end = text(body.period_end, 10) || null;
      const row = {
        ...(id ? { id } : {}),
        work_id,
        agent_id,
        role,
        evidence_id,
        period_start,
        period_end,
        state: "draft",
        created_by: user.id,
      };
      if (id) {
        const old = await db
          .from("manual_links")
          .select("state")
          .eq("id", id)
          .single();
        if (old.error) throw old.error;
        if (old.data.state !== "draft")
          throw Error("Volte o vínculo a rascunho antes de editar.");
      }
      const result = await db
        .from("manual_links")
        .upsert(row)
        .select()
        .single();
      if (result.error) throw result.error;
      return NextResponse.json(result.data);
    }
    if (action === "state") {
      if (!["draft", "review", "published"].includes(body.state))
        throw Error("Estado inválido.");
      const result = await db
        .from("manual_links")
        .update({ state: body.state })
        .eq("id", text(body.id, 100, true))
        .select()
        .single();
      if (result.error) throw result.error;
      return NextResponse.json(result.data);
    }
    throw Error("Operação inválida.");
  } catch (e) {
    return apiError(e);
  }
}
