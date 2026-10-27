import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  fold,
  uniqueTotal,
  type Snapshot,
  type Work,
  type Agent,
  type Link,
  type Raw,
} from "./domain";
import { publicDb } from "./supabase";
import { displayText, displayCategory } from "./presentation";

let local: Promise<Snapshot> | undefined;
const localSnapshot = () =>
  (local ??= readFile(
    path.join(process.cwd(), "data/snapshot.json"),
    "utf8",
  ).then(JSON.parse));
export async function snapshot(): Promise<Snapshot> {
  return localSnapshot();
}
export async function publishedCurations(): Promise<{
  agents: Agent[];
  links: Link[];
  available: boolean;
}> {
  const db = publicDb();
  if (!db) return { agents: [], links: [], available: false };
  try {
    const rows: Raw[] = [];
    for (let offset = 0; ; offset += 500) {
      const r = await db
        .from("manual_links")
        .select("*,evidence(*)")
        .eq("state", "published")
        .order("id")
        .range(offset, offset + 499);
      if (r.error) throw r.error;
      rows.push(...r.data);
      if (r.data.length < 500) break;
    }
    const agents: Agent[] = [];
    for (let start = 0; ; start += 500) {
      const a = await db
        .from("agents")
        .select("*")
        .eq("official", false)
        .eq("published", true)
        .order("id")
        .range(start, start + 499);
      if (a.error) throw a.error;
      agents.push(...a.data);
      if (a.data.length < 500) break;
    }
    const officialIds = [...new Set(rows.map((l) => l.agent_id))].filter(
      (id) => !agents.some((a) => a.id === id),
    );
    for (let p = 0; p < officialIds.length; p += 100) {
      const a = await db
        .from("agents")
        .select("*")
        .in("id", officialIds.slice(p, p + 100))
        .eq("published", true);
      if (a.error) throw a.error;
      agents.push(...a.data);
    }
    const links: Link[] = rows.flatMap((l) => {
      if (!agents.some((a) => a.id === l.agent_id) || !l.evidence) return [];
      const e = l.evidence;
      return [
        {
          id: l.id,
          workId: l.work_id,
          agentId: l.agent_id,
          role: l.role,
          start: l.period_start,
          end: l.period_end,
          source: e.url ?? "",
          consultedAt: l.updated_at,
          evidence: {
            id: e.id,
            title: e.title,
            issuer: e.issuer,
            url: e.url,
            excerpt: e.excerpt,
            date: e.evidence_date,
            public: true,
            file_path: e.file_public ? e.file_path : null,
          },
        },
      ];
    });
    return { agents, links, available: true };
  } catch (error) {
    console.error("Curadoria indisponível", String(error));
    return { agents: [], links: [], available: false };
  }
}
export type Filters = {
  municipio?: string;
  situacao?: string;
  categoria?: string;
  agente?: string;
  papel?: string;
};
export const matches = (w: Work, f: Filters) =>
  (!f.municipio || w.municipalityIds.includes(f.municipio)) &&
  (!f.situacao || w.status === f.situacao) &&
  (!f.categoria || fold(w.category) === fold(f.categoria)) &&
  (!f.agente ||
    w.links.some(
      (l) => l.agentId === f.agente && (!f.papel || l.role === f.papel),
    ));
export function workSummary(w: Work) {
  return {
    id: w.id,
    name: w.name,
    status: w.status,
    category: w.category,
    planned: w.planned,
    municipalityIds: w.municipalityIds,
    hasLocation: w.locations.length > 0,
    roles: [...new Set(w.links.map((l) => l.role))],
  };
}
async function queryRawPublic(params: URLSearchParams) {
  const db = publicDb();
  if (db)
    try {
      if (params.get("q")) {
        const r = await db.rpc("search_public", {
          p_query: params.get("q")!.slice(0, 120),
        });
        if (r.error) throw r.error;
        return r.data;
      }
      if (params.get("obra")) {
        const active = await db
          .from("active_dataset")
          .select("dataset_id")
          .single();
        if (active.error) throw active.error;
        const row = await db
          .from("works")
          .select("data")
          .eq("dataset_id", active.data.dataset_id)
          .eq("id", params.get("obra")!)
          .maybeSingle();
        if (row.error) throw row.error;
        if (!row.data) return null;
        const [curated, municipalities] = await Promise.all([
          publishedCurations(),
          readFile(
            path.join(process.cwd(), "public/data/municipalities.json"),
            "utf8",
          ).then(JSON.parse),
        ]);
        const w = row.data.data as Work,
          work = {
            ...w,
            links: [
              ...w.links,
              ...curated.links.filter((l) => l.workId === w.id),
            ],
          };
        const ids = [...new Set(work.links.map((l) => l.agentId))];
        const agents: Agent[] = [];
        for (let offset = 0; offset < ids.length; offset += 100) {
          const a = await db
            .from("agents")
            .select("id,name,type,identifier,description")
            .in("id", ids.slice(offset, offset + 100))
            .eq("published", true);
          if (a.error) throw a.error;
          agents.push(...a.data);
        }
        return {
          work,
          agents,
          municipalities: municipalities.filter((m: { id: string }) =>
            w.municipalityIds.includes(m.id),
          ),
          curationAvailable: curated.available,
        };
      }
      const r = await db.rpc("list_public_works", {
        p_city: params.get("municipio") || "",
        p_status: params.get("situacao") || "",
        p_category: params.get("categoria") || "",
        p_agent: params.get("agente") || "",
        p_role: params.get("papel") || "",
        p_page: Math.max(
          1,
          Math.min(10000, Math.floor(Number(params.get("pagina")) || 1)),
        ),
        p_order: params.get("ordem") || "relevancia",
      });
      if (r.error || !r.data?.metadata)
        throw r.error || Error("Base não ativada");
      return r.data;
    } catch (error) {
      console.error(
        "Consulta remota indisponível; usando cópia oficial versionada",
        String(error),
      );
    }
  const [s, c] = await Promise.all([snapshot(), publishedCurations()]);
  const linksByWork = new Map<string, Link[]>();
  for (const l of c.links) {
    if (!linksByWork.has(l.workId)) linksByWork.set(l.workId, []);
    linksByWork.get(l.workId)!.push(l);
  }
  const works = s.works.map((w) =>
    linksByWork.has(w.id)
      ? { ...w, links: [...w.links, ...linksByWork.get(w.id)!] }
      : w,
  );
  const agents = [
    ...new Map([...s.agents, ...c.agents].map((a) => [a.id, a])).values(),
  ];
  const q = fold((params.get("q") ?? "").slice(0, 120));
  if (q)
    return {
      municipalities: s.municipalities
        .filter((m) => fold(m.name).includes(q))
        .slice(0, 10),
      works: works
        .filter((w) => fold(w.name + " " + w.id).includes(q))
        .slice(0, 6)
        .map(workSummary),
      agents: agents.filter((a) => fold(a.name).includes(q)).slice(0, 6),
    };
  const detail = params.get("obra");
  if (detail) {
    const w = works.find((w) => w.id === detail);
    return w
      ? {
          work: w,
          agents: agents.filter((a) => w.links.some((l) => l.agentId === a.id)),
          municipalities: s.municipalities.filter((m) =>
            w.municipalityIds.includes(m.id),
          ),
          curationAvailable: c.available,
        }
      : null;
  }
  const f: Filters = {
    municipio: params.get("municipio") || undefined,
    situacao: params.get("situacao") || undefined,
    categoria: params.get("categoria") || undefined,
    agente: params.get("agente") || undefined,
    papel: params.get("papel") || undefined,
  };
  const order = params.get("ordem") || "relevancia";
  const filtered = works
    .filter((w) => matches(w, f))
    .sort(
      (a, b) =>
        (order === "relevancia"
          ? Number(b.status === "Em execução") -
            Number(a.status === "Em execução")
          : 0) ||
        (order === "relevancia"
          ? Number(/^\p{L}/u.test(b.name.trim())) -
            Number(/^\p{L}/u.test(a.name.trim()))
          : 0) ||
        (order !== "nome" ? (b.planned ?? -1) - (a.planned ?? -1) : 0) ||
        a.name.localeCompare(b.name, "pt-BR") ||
        a.id.localeCompare(b.id),
    );
  const page = Math.max(1, Math.min(10000, Number(params.get("pagina")) || 1));
  const counts: Record<string, number> = {};
  for (const w of filtered)
    for (const id of w.municipalityIds) counts[id] = (counts[id] ?? 0) + 1;
  return {
    items: filtered.slice((page - 1) * 30, page * 30).map(workSummary),
    page,
    pages: Math.ceil(filtered.length / 30),
    totals: uniqueTotal(filtered),
    statusCounts: Object.fromEntries(
      [...new Set(filtered.map((w) => w.status))].map((status) => [
        status,
        filtered.filter((w) => w.status === status).length,
      ]),
    ),
    locatedCount: filtered.filter((w) => w.locations.length > 0).length,
    counts,
    statuses: [...new Set(works.map((w) => w.status))].sort(),
    categories: [...new Set(works.map((w) => w.category))].sort(),
    municipality: s.municipalities.find((m) => m.id === f.municipio) ?? null,
    agent: agents.find((a) => a.id === f.agente) ?? null,
    roles: f.agente
      ? [
          ...new Set(
            works.flatMap((w) =>
              w.links.filter((l) => l.agentId === f.agente).map((l) => l.role),
            ),
          ),
        ].sort()
      : [],
    points:
      f.municipio || f.agente
        ? filtered.flatMap((w) =>
            w.locations.map((p) => ({
              ...p,
              id: w.id,
              name: w.name,
              status: w.status,
            })),
          )
        : [],
    metadata: {
      version: s.version,
      consultedAt: s.consultedAt,
      sourceUpdatedAt: s.sourceUpdatedAt,
      coverage: s.coverage,
      curationAvailable: c.available,
    },
  };
}

export async function queryPublic(params: URLSearchParams) {
  const result = await queryRawPublic(params);
  if (!result) return result;
  // Labels are repaired for display. Official IDs, values, dates and raw snapshots stay intact.
  function present(value: any): any {
    if (Array.isArray(value)) return value.map(present);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === "string" && ["name", "description"].includes(key)
          ? displayText(item)
          : typeof item === "string" && key === "category"
            ? displayCategory(item)
            : key === "categories" && Array.isArray(item)
              ? [...new Set(item.map(displayCategory))].sort()
              : present(item),
      ]),
    );
  }
  return present(result);
}
