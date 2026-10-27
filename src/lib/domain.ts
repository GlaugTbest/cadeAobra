import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Feature, Polygon, MultiPolygon } from "geojson";
export type Boundary = Feature<
  Polygon | MultiPolygon,
  { codarea: string; name?: string }
>;
export type Raw = Record<string, any>;
export type Municipality = { id: string; name: string; uf: string };
export type Agent = {
  id: string;
  name: string;
  type: "organization" | "person";
  identifier: string | null;
  description?: string;
};
export type Link = {
  id: string;
  workId: string;
  agentId: string;
  role: string;
  start: string | null;
  end: string | null;
  source: string;
  consultedAt: string;
  evidence?: Evidence;
};
export type Evidence = {
  id?: string;
  title: string;
  issuer: string;
  url: string | null;
  excerpt: string;
  date: string;
  public: boolean;
  file_path?: string | null;
};
export type Enrichment = {
  state: "not_fetched" | "fetched" | "error";
  fetchedAt: string | null;
  rows: Raw[];
};
export type Work = {
  id: string;
  name: string;
  description: string;
  status: string;
  category: string;
  municipalityIds: string[];
  primaryUf: string | null;
  planned: number | null;
  funding: { name: string; value: number | null }[];
  start: string | null;
  end: string | null;
  actualEnd: string | null;
  registeredAt: string | null;
  source: string;
  consultedAt: string;
  locations: { lng: number; lat: number }[];
  locationNote: string | null;
  links: Link[];
  enrichment: {
    execution: Enrichment;
    contracts: Enrichment;
    commitments: Enrichment;
    history: Enrichment;
  };
};
export type Snapshot = {
  version: string;
  consultedAt: string;
  sourceUpdatedAt: string | null;
  coverage: {
    complete: boolean;
    works: number;
    municipalities: number;
    geometryAssociations: number;
    outsidePrimaryUf: number;
    withoutMunicipality: number;
    withoutCoordinates: number;
    excludedNonWorks: number;
    enrichmentRequests: number;
  };
  municipalities: Municipality[];
  works: Work[];
  agents: Agent[];
};
export const API = "https://api-publica.obrasgov.gestao.gov.br/obras";
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const numberOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
export const sumKnown = (values: (number | null)[]) =>
  values.length && values.every((x) => x !== null)
    ? values.reduce<number>((a, b) => a + (b ?? 0), 0)
    : null;
export function normalizeWork(
  raw: Raw,
  municipalityIds: string[],
  boundaries: Boundary[],
  consultedAt: string,
): Work {
  const ids = [...new Set(municipalityIds)];
  const allowed = boundaries.filter((f) =>
    ids.includes(String(f.properties.codarea)),
  );
  const points = (raw.pins ?? []).flatMap((p: Raw) => {
    const lng = numberOrNull(p.longitude),
      lat = numberOrNull(p.latitude);
    if (
      lng === null ||
      lat === null ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90 ||
      !allowed.some((f) => booleanPointInPolygon([lng, lat], f))
    )
      return [];
    return [{ lng, lat }];
  });
  const funding = (raw.investimentos_previstos ?? []).map((v: Raw) => ({
    name: v.desc_nome_fonte_recurso ?? "Fonte não informada",
    value: numberOrNull(v.vl_investimento_previsto),
  }));
  const empty = (): Enrichment => ({
    state: "not_fetched",
    fetchedAt: null,
    rows: [],
  });
  return {
    id: String(raw.id_projeto_investimento),
    name: raw.desc_nome || "Nome não informado",
    description: raw.desc_projeto || "",
    status: raw.situacao || "Não informada",
    category: raw.eixos_tipos?.[0]?.tipo || "Não informada",
    municipalityIds: ids,
    primaryUf: raw.uf_principal ?? null,
    planned: sumKnown(funding.map((v: { value: number | null }) => v.value)),
    funding,
    start: raw.dt_inicial_prevista ?? null,
    end: raw.dt_final_prevista ?? null,
    actualEnd: raw.dt_final_efetiva ?? null,
    registeredAt: raw.dt_cadastro ?? null,
    source: `${API}/projeto-investimento?id_projeto_investimento=${encodeURIComponent(String(raw.id_projeto_investimento))}`,
    consultedAt,
    locations: [
      ...new Map(
        points.map((p: { lng: number; lat: number }) => [
          `${p.lng},${p.lat}`,
          p,
        ]),
      ).values(),
    ] as Work["locations"],
    locationNote: points.length
      ? null
      : "Localização precisa indisponível ou inconsistente com a malha municipal simplificada.",
    links: [],
    enrichment: {
      execution: empty(),
      contracts: empty(),
      commitments: empty(),
      history: empty(),
    },
  };
}
export function uniqueTotal(works: Work[]) {
  const u = [...new Map(works.map((w) => [w.id, w])).values()];
  return {
    count: u.length,
    planned: u.reduce((a, w) => a + (w.planned ?? 0), 0),
    known: u.filter((w) => w.planned !== null).length,
  };
}
export function safeOfficialUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      (u.hostname === "gov.br" ||
        u.hostname.endsWith(".gov.br") ||
        u.hostname.endsWith(".jus.br") ||
        u.hostname.endsWith(".leg.br") ||
        u.hostname.endsWith(".mp.br") ||
        u.hostname.endsWith(".edu.br"))
    );
  } catch {
    return false;
  }
}
export function validUpload(bytes: Uint8Array, type: string) {
  if (bytes.length > 5 * 1024 * 1024 || bytes.length === 0) return false;
  return (
    type === "application/pdf" &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
  );
}
export const money = (v: number | null, compact = false) =>
  v === null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 2,
      }).format(v);
export const date = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date(v.length === 10 ? `${v}T12:00:00Z` : v))
    : "Não informada";
export const statusClass = (s: string) => {
  const v = fold(s);
  return v.includes("conclu")
    ? "complete"
    : v.includes("paralis") || v.includes("cancel")
      ? "stopped"
      : v.includes("execu")
        ? "active"
        : "registered";
};
