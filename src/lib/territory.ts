import { createHash } from "node:crypto";
import type { Boundary, Municipality, Raw } from "./domain";

export const MUNICIPALITIES_SOURCE =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/22/municipios";
export const GEOMETRY_SOURCE =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/22?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=municipio";

type Geometry = { type: string; features: Boundary[] };
type Provenance = {
  consultedAt: string;
  territoryConsultedAt?: string;
  municipalitiesSource: string;
  geometrySource: string;
  geometrySha256: string;
};
export type CachedTerritory = {
  municipalities: Municipality[];
  geo: Geometry;
  provenance: Provenance;
};

export function geometryHash(geo: Geometry): string {
  return createHash("sha256").update(JSON.stringify(geo)).digest("hex");
}

function validate(municipalities: Municipality[], geo: Geometry) {
  const ids = new Set(municipalities.map((t) => t.id));
  const areas = new Set(geo.features?.map((f) => String(f.properties.codarea)));
  if (
    !municipalities.length ||
    municipalities.some((t) => !/^22\d{5}$/.test(t.id) || !t.name || t.uf !== "PI") ||
    ids.size !== municipalities.length ||
    geo.type !== "FeatureCollection" ||
    ids.size !== geo.features.length ||
    areas.size !== ids.size ||
    geo.features.some(
      (f) =>
        !ids.has(String(f.properties.codarea)) ||
        !["Polygon", "MultiPolygon"].includes(f.geometry?.type) ||
        !f.geometry.coordinates.length,
    )
  )
    throw Error("Malha e cadastro municipal divergem ou estão inválidos");
}

export async function loadTerritory(
  request: <T>(url: string) => Promise<T>,
  readCached: () => Promise<CachedTerritory>,
  consultedAt: string,
  warn: (message: string) => void = console.warn,
) {
  try {
    const [towns, geo] = await Promise.all([
      request<Raw[]>(MUNICIPALITIES_SOURCE),
      request<Geometry>(GEOMETRY_SOURCE),
    ]);
    const municipalities: Municipality[] = towns
      .map((t) => ({ id: String(t.id), name: t.nome, uf: "PI" }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    validate(municipalities, geo);
    for (const f of geo.features)
      f.properties.name = municipalities.find(
        (t) => t.id === String(f.properties.codarea),
      )!.name;
    return { municipalities, geo, consultedAt, mode: "remote" as const };
  } catch (remoteError) {
    const cached = await readCached();
    validate(cached.municipalities, cached.geo);
    const date =
      cached.provenance.territoryConsultedAt ?? cached.provenance.consultedAt;
    if (
      !Number.isFinite(Date.parse(date)) ||
      cached.provenance.municipalitiesSource !== MUNICIPALITIES_SOURCE ||
      ![GEOMETRY_SOURCE, GEOMETRY_SOURCE.split("?")[0]].includes(
        cached.provenance.geometrySource,
      ) ||
      geometryHash(cached.geo) !== cached.provenance.geometrySha256 ||
      cached.geo.features.some(
        (f) =>
          f.properties.name !==
          cached.municipalities.find(
            (t) => t.id === String(f.properties.codarea),
          )?.name,
      )
    )
      throw Error("Cópia territorial do IBGE sem procedência válida");
    warn(
      `IBGE indisponível (${String(remoteError)}). Usando a cópia oficial territorial verificada de ${date}; as obras serão consultadas normalmente.`,
    );
    return {
      municipalities: cached.municipalities,
      geo: cached.geo,
      consultedAt: date,
      mode: "versioned" as const,
    };
  }
}
