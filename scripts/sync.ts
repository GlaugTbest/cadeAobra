import { readFile, writeFile, mkdir, rename, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  API,
  fold,
  normalizeWork,
  type Snapshot,
  type Raw,
  type Agent,
  type Link,
} from "../src/lib/domain";
import { collectPages, retryJson, type Page } from "../src/lib/ingestion";
import { createClient } from "@supabase/supabase-js";
import {
  loadTerritory,
  geometryHash,
  MUNICIPALITIES_SOURCE,
  GEOMETRY_SOURCE,
} from "../src/lib/territory";
const started = new Date().toISOString(),
  cycle = process.env.SYNC_CYCLE || started.slice(0, 10);
if (!/^[a-zA-Z0-9_-]{1,60}$/.test(cycle)) throw Error("SYNC_CYCLE inválido");
const dir = `data/checkpoints/${cycle}`;
await mkdir(dir, { recursive: true });
await mkdir("public/data", { recursive: true });
await mkdir("data", { recursive: true });
let requests = 0;
const budget = Number(process.env.SYNC_REQUEST_BUDGET || 400),
  deadline = Date.now() + Number(process.env.SYNC_MAX_MINUTES || 30) * 60000;
async function request<T>(url: string) {
  if (requests >= budget || Date.now() > deadline)
    throw Error(
      "Limite de trabalho atingido; executar novamente para retomar.",
    );
  requests++;
  return retryJson<T>(url);
}
async function resource(
  path: string,
  params: Record<string, string>,
  key: string,
) {
  const cache = new Map<number, unknown>();
  for (const f of await readdir(dir)) {
    if (f.startsWith(key + "-") && f.endsWith(".json")) {
      const p = Number(f.slice(key.length + 1, -5));
      if (p) cache.set(p, JSON.parse(await readFile(`${dir}/${f}`, "utf8")));
    }
  }
  return collectPages<Raw>(
    async (p) => {
      const q = new URLSearchParams({
        ...params,
        pagina: String(p),
        tamanho_da_pagina: "200",
      });
      console.log(`${path} página ${p}`);
      return request<Page<Raw>>(`${API}/${path}?${q}`);
    },
    cache,
    budget,
    async (p, value) =>
      writeFile(`${dir}/${key}-${p}.json`, JSON.stringify(value)),
  );
}
const log = {
  started,
  finished: null as string | null,
  state: "running",
  requests: 0,
  error: null as string | null,
  territory: null as { consultedAt: string; mode: string } | null,
};
try {
  const territory = await loadTerritory(
    request,
    async () => {
      const [municipalities, geo, provenance] = await Promise.all(
        ["municipalities.json", "piaui.geojson", "provenance.json"].map(
          async (file) => JSON.parse(await readFile(`public/data/${file}`, "utf8")),
        ),
      );
      return { municipalities, geo, provenance };
    },
    started,
  );
  const { municipalities, geo } = territory;
  log.territory = { consultedAt: territory.consultedAt, mode: territory.mode };
  const ids = new Set(municipalities.map((t) => t.id));
  const [projects, geometry] = await Promise.all([
    resource(
      "projeto-investimento",
      { uf_principal: "PI", natureza_intervencao: "Obra" },
      "projects",
    ),
    resource("geometria", { sg_uf: "PI" }, "geometry"),
  ]);
  const mapping = new Map<string, Set<string>>();
  for (const g of geometry) {
    if (ids.has(String(g.cod_ibge))) {
      const k = String(g.id_projeto_investimento);
      if (!mapping.has(k)) mapping.set(k, new Set());
      mapping.get(k)!.add(String(g.cod_ibge));
    }
  }
  const raws = new Map(
    projects.map((w) => [String(w.id_projeto_investimento), w]),
  );
  const missing = [...mapping.keys()].filter((id) => !raws.has(id));
  console.log(
    `Projetos PI ${raws.size}; IDs adicionais na geometria ${missing.length}`,
  );
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < missing.length) {
        const id = missing[cursor++],
          key = createHash("sha256").update(id).digest("hex").slice(0, 20),
          file = `${dir}/extra-${key}.json`;
        let rows: Raw[];
        try {
          rows = JSON.parse(await readFile(file, "utf8"));
        } catch {
          rows = await resource(
            "projeto-investimento",
            { id_projeto_investimento: id },
            `id-${key}`,
          );
          await writeFile(file, JSON.stringify(rows));
        }
        for (const w of rows) raws.set(String(w.id_projeto_investimento), w);
      }
    }),
  );
  const works: Snapshot["works"] = [],
    agents = new Map<string, Agent>();
  let excludedNonWorks = 0;
  for (const raw of raws.values()) {
    if (raw.natureza_intervencao !== "Obra") {
      excludedNonWorks++;
      continue;
    }
    const w = normalizeWork(
      raw,
      [...(mapping.get(String(raw.id_projeto_investimento)) ?? [])],
      geo.features,
      started,
    );
    const roles: [string, string, string][] = [
      ["executores", "executor", "Órgão executor"],
      ["tomadores", "tomador", "Tomador"],
      ["repassadores", "repassador", "Repassador"],
    ];
    const orgs = [
      {
        name: raw.organizacao_resp,
        cnpj: raw.cnpj_organizacao_resp,
        role: "Organização responsável",
      },
      ...roles.flatMap(([key, field, role]) =>
        (raw[key] ?? []).map((r: Raw) => ({
          name: r[`organizacao_${field}`],
          cnpj: r[`cnpj_${field}`],
          role,
        })),
      ),
    ];
    for (const org of orgs) {
      if (!org.name) continue;
      const digits = String(org.cnpj ?? "").replace(/\D/g, "");
      const id =
        digits.length === 14
          ? `cnpj-${digits}`
          : `org-${createHash("sha256").update(`${w.id}:${org.role}:${org.name}`).digest("hex").slice(0, 20)}`;
      agents.set(id, {
        id,
        name: org.name,
        type: "organization",
        identifier: digits.length === 14 ? digits : null,
      });
      const link: Link = {
        id: `${w.id}:${id}:${org.role}`,
        workId: w.id,
        agentId: id,
        role: org.role,
        start: null,
        end: null,
        source: w.source,
        consultedAt: started,
      };
      if (!w.links.some((l) => l.id === link.id)) w.links.push(link);
    }
    works.push(w);
  }
  let prior: Snapshot | undefined;
  try {
    prior = JSON.parse(await readFile("data/snapshot.json", "utf8"));
  } catch {}
  const previous = new Map(prior?.works.map((w) => [w.id, w.enrichment]));
  if (
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const active = await db
      .from("active_dataset")
      .select("dataset_id")
      .maybeSingle();
    if (active.error) throw active.error;
    if (active.data)
      for (let offset = 0; ; offset += 500) {
        const page = await db
          .from("works")
          .select("id,enrichment:data->enrichment")
          .eq("dataset_id", active.data.dataset_id)
          .order("id")
          .range(offset, offset + 499);
        if (page.error) throw page.error;
        for (const row of page.data)
          if (row.enrichment)
            previous.set(
              row.id,
              row.enrichment as unknown as Snapshot["works"][number]["enrichment"],
            );
        if (page.data.length < 500) break;
      }
  }
  for (const w of works) {
    if (previous.has(w.id)) w.enrichment = previous.get(w.id)!;
  }
  const enrichBudget = Number(process.env.ENRICH_REQUEST_BUDGET || 24);
  let used = 0;
  const queue = [...works].sort(
    (a, b) =>
      Number(fold(b.status).includes("execu")) -
        Number(fold(a.status).includes("execu")) ||
      Math.min(
        ...Object.values(a.enrichment).map((e) =>
          e.fetchedAt ? Date.parse(e.fetchedAt) : 0,
        ),
      ) -
        Math.min(
          ...Object.values(b.enrichment).map((e) =>
            e.fetchedAt ? Date.parse(e.fetchedAt) : 0,
          ),
        ),
  );
  const endpoints = {
    execution: "execucao-fisica",
    contracts: "contrato",
    commitments: "empenho",
    history: "historico-situacao-cancelada-paralisada",
  };
  for (const w of queue) {
    for (const [key, endpoint] of Object.entries(endpoints)) {
      const field = key as keyof typeof endpoints;
      if (used >= enrichBudget) break;
      const old = w.enrichment[field];
      if (
        old.fetchedAt &&
        Date.now() - new Date(old.fetchedAt).getTime() < 7 * 86400000
      )
        continue;
      try {
        const rows = await resource(
          endpoint,
          { id_projeto_investimento: w.id },
          `enrich-${createHash("sha256")
            .update(w.id + key)
            .digest("hex")
            .slice(0, 16)}`,
        );
        w.enrichment[field] = { state: "fetched", fetchedAt: started, rows };
      } catch (e) {
        console.error("Detalhe não atualizado", w.id, key, String(e));
        if (old.state !== "fetched")
          w.enrichment[field] = { ...old, state: "error" };
      }
      used++;
    }
    if (used >= enrichBudget) break;
  }
  let sourceUpdatedAt: string | null = null;
  try {
    sourceUpdatedAt =
      (await request<Raw>(`${API}/data-atualizacao`)).data_ultima_atualizacao ??
      null;
  } catch {}
  const snapshot: Snapshot = {
    version: cycle,
    consultedAt: started,
    sourceUpdatedAt,
    coverage: {
      complete: true,
      works: works.length,
      municipalities: municipalities.length,
      geometryAssociations: geometry.length,
      outsidePrimaryUf: works.filter((w) => w.primaryUf !== "PI").length,
      withoutMunicipality: works.filter((w) => !w.municipalityIds.length)
        .length,
      withoutCoordinates: works.filter((w) => !w.locations.length).length,
      excludedNonWorks,
      enrichmentRequests: used,
    },
    municipalities,
    works,
    agents: [...agents.values()],
  };
  await writeFile("data/snapshot.next.json", JSON.stringify(snapshot));
  await rename("data/snapshot.next.json", "data/snapshot.json");
  await writeFile(
    "public/data/municipalities.json",
    JSON.stringify(municipalities),
  );
  await writeFile("public/data/piaui.geojson", JSON.stringify(geo));
  await writeFile(
    "public/data/provenance.json",
    JSON.stringify(
      {
        consultedAt: started,
        sourceUpdatedAt,
        territoryConsultedAt: territory.consultedAt,
        territoryMode: territory.mode,
        municipalitiesSource: MUNICIPALITIES_SOURCE,
        geometrySource: GEOMETRY_SOURCE,
        geometrySha256: geometryHash(geo),
        coverage: snapshot.coverage,
      },
      null,
      2,
    ),
  );
  log.state = "complete";
  console.log(JSON.stringify(snapshot.coverage));
} catch (e) {
  log.state = "failed";
  log.error = String(e);
  process.exitCode = 1;
  console.error(e);
} finally {
  log.finished = new Date().toISOString();
  log.requests = requests;
  await writeFile(`${dir}/run.json`, JSON.stringify(log, null, 2));
}
