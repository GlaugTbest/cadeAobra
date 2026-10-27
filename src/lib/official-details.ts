import { API, type Work, type Enrichment, type Raw } from "./domain";
import { unstable_cache } from "next/cache";

const resources = {
  execution: "execucao-fisica",
  contracts: "contrato",
  commitments: "empenho",
  history: "historico-situacao-cancelada-paralisada",
} as const;

// A successful first page is not evidence of a complete response.
export async function fetchOfficialDetail(
  id: string,
  endpoint: string,
  fetcher: typeof fetch = fetch,
): Promise<Enrichment> {
  const rows: Raw[] = [];
  const deadline = Date.now() + 20000;
  let total = 0;
  let pages = 0;
  for (let page = 1; page <= 5; page++) {
    const url = new URL(`${API}/${endpoint}`);
    url.searchParams.set("id_projeto_investimento", id);
    url.searchParams.set("pagina", String(page));
    url.searchParams.set("tamanho_da_pagina", "200");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Tempo de consulta excedido");
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(Math.min(7000, remaining)),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(`Fonte oficial indisponível (${response.status})`);
    const body = await response.json();
    if (
      !Array.isArray(body.data) ||
      !Number.isInteger(body.total_pages) ||
      !Number.isInteger(body.total_items)
    )
      throw new Error("Resposta oficial inválida");
    if (page === 1) {
      total = body.total_items;
      pages = body.total_pages;
    }
    if (
      total < 0 ||
      pages < 0 ||
      body.total_items !== total ||
      body.total_pages !== pages ||
      pages > 5 ||
      (body.page_number !== page && total > 0)
    )
      throw new Error("Consulta oficial incompleta");
    if (
      body.data.some((row: Raw) => String(row.id_projeto_investimento) !== id)
    )
      throw new Error("Registro não corresponde à obra");
    rows.push(...body.data);
    if (page >= body.total_pages) {
      if (rows.length !== total) throw new Error("Consulta oficial incompleta");
      return { state: "fetched", fetchedAt: new Date().toISOString(), rows };
    }
  }
  throw new Error("Consulta oficial excedeu o limite");
}

// Cache rows together with the actual consultation timestamp, never just the body.
const cachedOfficialDetail = unstable_cache(
  (id: string, endpoint: string) => fetchOfficialDetail(id, endpoint),
  ["official-detail-v1"],
  { revalidate: 86400 },
);

export async function enrichWork(work: Work): Promise<Work> {
  const enrichment = { ...work.enrichment };
  const deadline = Date.now() + 30000;
  // Two requests at a time; recent successes are retained, including empty results.
  const fields = Object.keys(resources) as (keyof typeof resources)[];
  for (let offset = 0; offset < fields.length; offset += 2) {
    await Promise.all(
      fields.slice(offset, offset + 2).map(async (field) => {
        const old = enrichment[field];
        if (
          old.state === "fetched" &&
          old.fetchedAt &&
          Date.now() - Date.parse(old.fetchedAt) < 86400000
        )
          return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const remaining = deadline - Date.now();
          if (remaining <= 0) throw new Error("Tempo de consulta excedido");
          enrichment[field] = await Promise.race([
            cachedOfficialDetail(work.id, resources[field]),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("Tempo de consulta excedido")),
                remaining,
              );
            }),
          ]);
        } catch {
          enrichment[field] = { ...old, state: "error" };
        } finally {
          if (timer) clearTimeout(timer);
        }
      }),
    );
  }
  return { ...work, enrichment };
}
